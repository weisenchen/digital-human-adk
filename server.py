"""
Digital Human Server - built on ADK's built-in web server with custom TTS, chat,
model selection, and slide generation endpoints.

Usage:
    python server.py
"""

import os, sys, asyncio, logging
from pathlib import Path

AGENTS_DIR = str(Path(__file__).parent / "agents")
sys.path.insert(0, AGENTS_DIR)

from dotenv import load_dotenv
load_dotenv()  # project .env

# Also load Hermes config for API keys (DeepSeek, etc.)
hermes_env = Path(os.path.expanduser("~/.hermes/.env"))
if hermes_env.exists():
    load_dotenv(hermes_env)

from fastapi import FastAPI, Form, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse

from google.adk.cli.fast_api import get_fast_api_app
from google.adk.runners import Runner
from google.adk.agents import Agent
from google.adk.sessions import InMemorySessionService
from google.genai import types

from agents.digital_human import INSTRUCTION
from agents.tools import CUSTOM_TOOLS
from agents.model_clients import MODEL_CATALOG, list_api_models, get_openai_client
from audio.tts import synthesize, list_voices, periodic_cleanup, clear_old_cache

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("digital-human.server")

# ── Default model ──────────────────────────────────────────────────────────
DEFAULT_MODEL = "deepseek-chat"

# ── Build runners for every Gemini (ADK) model ────────────────────────────
def _build_adk_runners():
    """Pre-create one ADK Runner per Gemini model for hot-switching."""
    runners: dict[str, Runner] = {}
    session_services: dict[str, InMemorySessionService] = {}
    for mid, info in MODEL_CATALOG.items():
        if info["backend"] != "adk":
            continue
        svc = InMemorySessionService()
        agent = Agent(
            name="digital_human",
            model=mid,
            instruction=INSTRUCTION,
            tools=CUSTOM_TOOLS,
        )
        runners[mid] = Runner(
            app_name="digital_human",
            agent=agent,
            session_service=svc,
        )
        session_services[mid] = svc
    return runners, session_services


def create_app() -> FastAPI:
    """Create ADK web server with model selection, custom TTS, and chat endpoints."""

    # 1. ADK built-in server
    app = get_fast_api_app(
        agents_dir=AGENTS_DIR,
        web=True,
        allow_origins=["*"],
        auto_create_session=True,
    )

    # Explicit CORS middleware — ensures headers on ALL responses including errors
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # 2. Per-model ADK runners (Gemini models)
    _adk_runners, _adk_session_services = _build_adk_runners()

    # 3. Per-session model selection (stores selected model per session)
    _session_models: dict[str, str] = {}

    # 4. Name injection tracking per session (model-agnostic)
    _configured_sessions: dict[str, str] = {}

    # 5. Conversation history for non-ADK (OpenAI-compat) models
    #    Key: session_id, Value: list of {"role": str, "content": str}
    _openai_histories: dict[str, list[dict]] = {}

    # ── Helpers ────────────────────────────────────────────────────────────

    def _get_model_for_session(session_id: str) -> str:
        """Return the active model for a session (default if unset)."""
        return _session_models.get(session_id, DEFAULT_MODEL)

    def _get_adk_runner(model_id: str) -> Runner | None:
        """Return the ADK runner for this model, or None."""
        return _adk_runners.get(model_id)

    def _get_adk_session_service(model_id: str) -> InMemorySessionService | None:
        return _adk_session_services.get(model_id)

    def _get_system_prompt(character_name: str, personality: str = "") -> str:
        """Build the system prompt for non-ADK models."""
        parts = [f'Your name is "{character_name}". Always introduce yourself as {character_name} and refer to yourself as {character_name}.']
        if personality:
            parts.append(f"Personality: {personality}")
        parts.append(INSTRUCTION)
        return "\n\n".join(parts)

    async def _inject_name_adk(session_id: str, character_name: str, personality: str = "") -> None:
        """Inject character name into an ADK model session."""
        if not character_name:
            return
        if session_id in _configured_sessions and _configured_sessions[session_id] == character_name:
            return
        _configured_sessions[session_id] = character_name
        model_id = _get_model_for_session(session_id)
        runner = _get_adk_runner(model_id)
        if not runner:
            return  # non-ADK model, handled separately
        svc = _get_adk_session_service(model_id)
        name_msg = f'[System: Your name is "{character_name}". Always introduce yourself as {character_name} and refer to yourself as {character_name}.]'
        if personality:
            name_msg += f"\n[Personality: {personality}]"
        char_msg = types.Content(role="user", parts=[types.Part(text=name_msg)])
        try:
            await svc.create_session(
                app_name="digital_human",
                user_id="default_user",
                session_id=session_id,
            )
        except Exception:
            pass
        async for _ in runner.run_async(
            user_id="default_user",
            session_id=session_id,
            new_message=char_msg,
        ):
            pass

    async def _chat_adk(
        text: str, session_id: str, character_name: str, personality: str
    ) -> dict:
        """Chat via ADK runner (Gemini models)."""
        model_id = _get_model_for_session(session_id)
        runner = _get_adk_runner(model_id)
        svc = _get_adk_session_service(model_id)
        if not runner or not svc:
            return {"reply": f"(Error: Model '{model_id}' is not available as ADK)"}

        try:
            await svc.create_session(
                app_name="digital_human",
                user_id="default_user",
                session_id=session_id,
            )
        except Exception:
            pass

        await _inject_name_adk(session_id, character_name, personality)

        new_msg = types.Content(role="user", parts=[types.Part(text=text)])
        events = []
        async for event in runner.run_async(
            user_id="default_user",
            session_id=session_id,
            new_message=new_msg,
        ):
            events.append(event)

        reply = ""
        for e in reversed(events):
            if e.author != "user" and e.content and e.content.parts and not e.partial:
                reply = e.content.parts[0].text or ""
                break
        return {"reply": reply}

    async def _chat_openai(
        text: str, session_id: str, character_name: str, personality: str
    ) -> dict:
        """Chat via OpenAI-compatible API (DeepSeek, etc.)."""
        model_id = _get_model_for_session(session_id)
        info = MODEL_CATALOG.get(model_id)
        if not info:
            return {"reply": f"(Error: Unknown model '{model_id}')"}

        client = get_openai_client(model_id)
        if not client:
            return {"reply": f"(Error: '{info['name']}' is not configured — missing API key)"}

        # Build or get conversation history
        if session_id not in _openai_histories:
            # Fresh session — prime with system prompt
            sys_prompt = _get_system_prompt(character_name, personality)
            _openai_histories[session_id] = [
                {"role": "system", "content": sys_prompt},
            ]
            _configured_sessions[session_id] = character_name
        else:
            # Check if character name changed — rebuild system prompt
            if session_id not in _configured_sessions or _configured_sessions[session_id] != character_name:
                _configured_sessions[session_id] = character_name
                sys_prompt = _get_system_prompt(character_name, personality)
                # Replace system message
                history = _openai_histories[session_id]
                if history and history[0]["role"] == "system":
                    history[0] = {"role": "system", "content": sys_prompt}
                else:
                    history.insert(0, {"role": "system", "content": sys_prompt})

        # Add user message
        _openai_histories[session_id].append({"role": "user", "content": text})

        try:
            resp = await asyncio.wait_for(
                asyncio.to_thread(
                    client.chat.completions.create,
                    model=info["model"],
                    messages=_openai_histories[session_id],
                ),
                timeout=60,
            )
            reply = resp.choices[0].message.content or ""
            _openai_histories[session_id].append({"role": "assistant", "content": reply})
            return {"reply": reply}
        except Exception as exc:
            logger.error("OpenAI-compat chat error: %s", exc, exc_info=True)
            return {"reply": f"(Error: {exc})"}

    async def _generate_slides_adk(script: str, num_slides: int, language: str) -> dict:
        """Generate slides via ADK runner."""
        model_id = _get_model_for_session("slide_generation_session")
        runner = _get_adk_runner(model_id)
        svc = _get_adk_session_service(model_id)
        if not runner or not svc:
            return {"slides": [{"display": script, "speech": script}], "error": f"Model '{model_id}' not available for slide generation"}

        prompt = _build_slide_prompt(script, num_slides, language)
        try:
            await svc.create_session(
                app_name="digital_human",
                user_id="default_user",
                session_id="slide_generation_session",
            )
        except Exception:
            pass
        new_msg = types.Content(role="user", parts=[types.Part(text=prompt)])
        events = []
        async for event in runner.run_async(
            user_id="default_user",
            session_id="slide_generation_session",
            new_message=new_msg,
        ):
            events.append(event)

        reply = ""
        for e in reversed(events):
            if e.author != "user" and e.content and e.content.parts and not e.partial:
                reply = e.content.parts[0].text or ""
                break
        return _parse_slides(reply, script)

    async def _generate_slides_openai(script: str, num_slides: int, language: str) -> dict:
        """Generate slides via OpenAI-compatible API."""
        model_id = _get_model_for_session("slide_generation_session")
        info = MODEL_CATALOG.get(model_id)
        if not info:
            return {"slides": [{"display": script, "speech": script}], "error": f"Unknown model '{model_id}'"}
        client = get_openai_client(model_id)
        if not client:
            return {"slides": [{"display": script, "speech": script}], "error": f"'{info['name']}' not configured"}

        prompt = _build_slide_prompt(script, num_slides, language)
        try:
            resp = await asyncio.wait_for(
                asyncio.to_thread(
                    client.chat.completions.create,
                    model=info["model"],
                    messages=[{"role": "user", "content": prompt}],
                    temperature=0.3,
                ),
                timeout=120,
            )
            reply = resp.choices[0].message.content or ""
            return _parse_slides(reply, script)
        except Exception as exc:
            logger.error("Slide gen error: %s", exc, exc_info=True)
            return {"slides": [{"display": script, "speech": script}], "error": str(exc)}

    def _build_slide_prompt(script: str, num_slides: int, language: str) -> str:
        """Build the slide generation prompt with rich slide types."""
        # Normalize language: "en-US", "en-GB" → "en",  "cmn-CN", "zh" → "zh"
        lang_code = language.split("-")[0] if language else "en"
        if lang_code == "en":
            lang = "English"
        elif lang_code == "zh" or lang_code == "cmn":
            lang = "Chinese"
        else:
            lang = "English"  # fallback
        return (
            f"You are a professional presentation designer. Convert the following "
            f"raw script into exactly {num_slides} well-structured slides.\n\n"
            f"Each slide has TWO parts separated by '===SPEECH===':\n"
            f"  1. DISPLAY content — what appears on screen\n"
            f"  2. SPEECH script — what the narrator reads aloud\n\n"
            f"── SLIDE TYPE SYSTEM ──\n"
            f"Choose the BEST type for each slide. Start every slide with its type marker:\n\n"
            f"🎬 TITLE — Opening slide, large centered heading + subtitle\n"
            f"   Mark as: ##TITLE\n"
            f"   Format: ##TITLE\n## [Main Title]\n[Subtitle text]\n\n"
            f"📂 SECTION — Chapter divider between main sections\n"
            f"   Mark as: ##SECTION\n"
            f"   Format: ##SECTION\n## [Section Title]\n\n"
            f"📄 CONTENT — Standard content with title and bullet points (DEFAULT)\n"
            f"   Mark as: ##CONTENT (or no marker)\n"
            f"   Format: ## [Slide Title]\n- Key point\n- Key point\n- Key point\n\n"
            f"💬 QUOTE — Highlight a key quote or testimony\n"
            f"   Mark as: ##QUOTE\n"
            f"   Format: ##QUOTE\n> \"[Inspiring quote]\"\n— Attribution\n\n"
            f"📊 DATA — Emphasize a statistic or key number\n"
            f"   Mark as: ##DATA\n"
            f"   Format: ##DATA\n## [Metric Title]\n**XX%** or **[Big Number]** of [context]\n- Supporting detail\n\n"
            f"↔️ COMPARE — Side-by-side comparison\n"
            f"   Mark as: ##COMPARE\n"
            f"   Format: ##COMPARE\n## [Topic]\nLeft: [Option A]\n- Point\nRight: [Option B]\n- Point\n\n"
            f"🎯 CLOSE — Summary or call to action\n"
            f"   Mark as: ##CLOSE\n"
            f"   Format: ##CLOSE\n## [Closing Title]\nKey takeaway\n**Call to action:** [action]\n\n"
            f"── RULES ──\n"
            f"- VARY the types across {num_slides} slides. Don't use CONTENT for every slide.\n"
            f"- First slide should be TITLE. Last slide should be CLOSE.\n"
            f"- Use SECTION between major topic transitions.\n"
            f"- Use QUOTE to highlight a powerful statement from the script.\n"
            f"- Use DATA when a statistic or number is the star of the slide.\n"
            f"- Use COMPARE when contrasting two approaches, sides, or time periods.\n"
            f"- DISPLAY: concise, scannable, presentation-ready.\n"
            f"- SPEECH: conversational narration covering the same key points in more detail.\n"
            f"- Speech can rephrase, expand, or explain — it does NOT need to match display verbatim.\n"
            f"- Use `---` to separate slides.\n"
            f"- Use {lang} for all content.\n\n"
            f"RAW SCRIPT:\n{script}\n\n"
            f"EXAMPLE OUTPUT (3 slides):\n"
            f"##TITLE\n## The Future of AI\nHow artificial intelligence is reshaping our world\n\n===SPEECH===\nGood morning everyone, and welcome to my presentation on the future of AI...\n\n---\n\n##CONTENT\n## Key Applications\n- Healthcare diagnostics\n- Autonomous vehicles\n- Personalized education\n\n===SPEECH===\nLet me walk you through the three key applications...\n\n---\n\n##CLOSE\n## The Future is Now\nAI is transforming every industry\n**Call to action:** Start exploring AI today\n\n===SPEECH===\nIn conclusion, the future of AI is already here...\n"
        )

    def _parse_slides(reply: str, fallback: str) -> dict:
        """Parse markdown slide output into structured slides."""
        if not reply.strip():
            return {"slides": [{"display": fallback, "speech": fallback}]}
        raw_slides = [s.strip() for s in reply.split("---") if s.strip()]
        slides = []
        for slide_text in raw_slides:
            if "===SPEECH===" in slide_text:
                parts = slide_text.split("===SPEECH===", 1)
                display = parts[0].strip()
                speech = parts[1].strip()
            else:
                display = slide_text
                speech = slide_text
            slides.append({"display": display, "speech": speech})
        if not slides:
            slides = [{"display": reply.strip(), "speech": reply.strip()}]
        return {"slides": slides}

    # ── Runtime helper: route a chat request to the right backend ─────────
    async def _chat_router(
        text: str, session_id: str, character_name: str, personality: str
    ) -> dict:
        model_id = _get_model_for_session(session_id)
        info = MODEL_CATALOG.get(model_id)
        if not info:
            return {"reply": f"(Error: Unknown model '{model_id}')"}
        if info["backend"] == "adk":
            return await _chat_adk(text, session_id, character_name, personality)
        elif info["backend"] == "openai":
            return await _chat_openai(text, session_id, character_name, personality)
        return {"reply": f"(Error: Unsupported backend '{info.get('backend')}')"}

    # ── Endpoints ─────────────────────────────────────────────────────────

    @app.get("/api/models")
    async def get_models():
        """Return available models for frontend model selector."""
        return JSONResponse(list_api_models())

    @app.post("/api/select-model")
    async def select_model(
        model_id: str = Form(...),
        session_id: str = Form("default"),
    ):
        """Change the active model for a session."""
        if model_id not in MODEL_CATALOG:
            return JSONResponse({"status": "error", "error": f"Unknown model: {model_id}"}, status_code=400)
        _session_models[session_id] = model_id
        # Clear OpenAI history so new model starts fresh
        if session_id in _openai_histories:
            del _openai_histories[session_id]
        logger.info("Session %s switched to model %s", session_id, model_id)
        return {"status": "ok", "model": model_id}

    @app.get("/api/current-model")
    async def current_model(session_id: str = "default"):
        """Return the currently selected model for a session."""
        model_id = _get_model_for_session(session_id)
        info = MODEL_CATALOG.get(model_id, {})
        return {"id": model_id, "name": info.get("name", model_id)}

    @app.post("/chat")
    async def chat(
        text: str = Form(...),
        session_id: str = Form("default"),
        character_name: str = Form(""),
        personality: str = Form(""),
    ):
        """POST form: text=hello → {"reply": "Hello! How can I help?"}"""
        try:
            return await _chat_router(text, session_id, character_name, personality)
        except Exception as exc:
            logger.error("Chat error: %s", exc, exc_info=True)
            return {"reply": f"(Error: Sorry, something went wrong — {exc})"}

    @app.post("/chat/stream")
    async def chat_stream(
        text: str = Form(...),
        session_id: str = Form("default"),
        character_name: str = Form(""),
        personality: str = Form(""),
    ):
        """SSE streaming chat — same as /chat but streams tokens.
        Returns ADK-compatible SSE events for frontend parsing."""
        from fastapi.responses import StreamingResponse

        async def _stream_adk(text: str, session_id: str, character_name: str, personality: str):
            """Stream from ADK runner."""
            model_id = _get_model_for_session(session_id)
            runner = _get_adk_runner(model_id)
            svc = _get_adk_session_service(model_id)
            if not runner or not svc:
                yield f"data: {_sse_event(False, 'Sorry, this model is not available')}\n\n"
                return

            try:
                await svc.create_session(
                    app_name="digital_human",
                    user_id="default_user",
                    session_id=session_id,
                )
            except Exception:
                pass

            await _inject_name_adk(session_id, character_name, personality)

            new_msg = types.Content(role="user", parts=[types.Part(text=text)])
            async for event in runner.run_async(
                user_id="default_user",
                session_id=session_id,
                new_message=new_msg,
            ):
                if event.author == "user":
                    continue
                if event.content and event.content.parts:
                    text_part = event.content.parts[0].text or ""
                    yield f"data: {_sse_event(event.partial, text_part)}\n\n"

        async def _stream_openai(text: str, session_id: str, character_name: str, personality: str):
            """Stream from OpenAI-compatible API (DeepSeek, etc.)."""
            model_id = _get_model_for_session(session_id)
            info = MODEL_CATALOG.get(model_id)
            if not info:
                yield f"data: {_sse_event(False, f'Unknown model: {model_id}')}\n\n"
                return

            client = get_openai_client(model_id)
            if not client:
                name = info.get("name", model_id)
                yield f"data: {_sse_event(False, f'{name} is not configured')}\n\n"
                return

            # Build messages
            if session_id not in _openai_histories:
                sys_prompt = _get_system_prompt(character_name, personality)
                _openai_histories[session_id] = [
                    {"role": "system", "content": sys_prompt},
                ]
                _configured_sessions[session_id] = character_name
            elif session_id not in _configured_sessions or _configured_sessions[session_id] != character_name:
                _configured_sessions[session_id] = character_name
                sys_prompt = _get_system_prompt(character_name, personality)
                history = _openai_histories[session_id]
                if history and history[0]["role"] == "system":
                    history[0] = {"role": "system", "content": sys_prompt}
                else:
                    history.insert(0, {"role": "system", "content": sys_prompt})

            _openai_histories[session_id].append({"role": "user", "content": text})

            try:
                stream = await asyncio.wait_for(
                    asyncio.to_thread(
                        lambda: client.chat.completions.create(
                            model=info["model"],
                            messages=_openai_histories[session_id],
                            stream=True,
                        )
                    ),
                    timeout=60,
                )
                full_reply = ""
                for chunk in stream:
                    delta = chunk.choices[0].delta if chunk.choices else None
                    if delta and delta.content:
                        full_reply += delta.content
                        yield f"data: {_sse_event(True, delta.content)}\n\n"
                _openai_histories[session_id].append({"role": "assistant", "content": full_reply})
                yield f"data: {_sse_event(False, full_reply)}\n\n"
            except Exception as exc:
                logger.error("Stream error: %s", exc)
                yield f"data: {_sse_event(False, f'(Error: {exc})')}\n\n"

        def _sse_event(partial: bool, text: str):
            """Build ADK-compatible SSE event dict."""
            return __import__('json').dumps({
                "author": "digital_human",
                "partial": partial,
                "content": {
                    "parts": [{"text": text}],
                },
            })

        async def _stream_gen():
            model_id = _get_model_for_session(session_id)
            info = MODEL_CATALOG.get(model_id, {})
            if info.get("backend") == "openai":
                async for event in _stream_openai(text, session_id, character_name, personality):
                    yield event
            else:
                async for event in _stream_adk(text, session_id, character_name, personality):
                    yield event

        return StreamingResponse(
            _stream_gen(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no",
            },
        )

    @app.post("/inject-name")
    async def inject_name(
        session_id: str = Form("default"),
        character_name: str = Form(""),
        personality: str = Form(""),
    ):
        """Inject character name into a session."""
        try:
            model_id = _get_model_for_session(session_id)
            info = MODEL_CATALOG.get(model_id, {})
            if info.get("backend") == "adk":
                try:
                    svc = _get_adk_session_service(model_id)
                    if svc:
                        await svc.create_session(
                            app_name="digital_human",
                            user_id="default_user",
                            session_id=session_id,
                        )
                except Exception:
                    pass
                await _inject_name_adk(session_id, character_name, personality)
            else:
                # For non-ADK models, just update the system message
                if character_name:
                    _configured_sessions[session_id] = character_name
                    if session_id in _openai_histories:
                        sys_prompt = _get_system_prompt(character_name, personality)
                        history = _openai_histories[session_id]
                        if history and history[0]["role"] == "system":
                            history[0] = {"role": "system", "content": sys_prompt}
                        else:
                            history.insert(0, {"role": "system", "content": sys_prompt})
            return {"status": "ok"}
        except Exception as exc:
            logger.error("inject-name error: %s", exc, exc_info=True)
            return {"status": "error", "error": str(exc)}

    # ── Talk Show state (in-memory) ──────────────────────────────────────
    _talk_show_sessions: dict[str, dict] = {}

    @app.post("/api/talk-show/ask")
    async def talk_show_ask(
        topic: str = Form(""),
        guest_name: str = Form("Guest"),
        host_name: str = Form(""),
        background: str = Form(""),
        questions: str = Form(""),
        personality: str = Form("professional-humorous"),
        message: str = Form(""),
        history_json: str = Form("[]"),
        language: str = Form("en"),
        duration_minutes: int = Form(10),
    ):
        """Talk Show: host responds as a talk show host, grounded in background materials.

        Returns JSON: {"reply": "Host's spoken response"}
        """
        try:
            import json
            history: list = json.loads(history_json)
        except (json.JSONDecodeError, TypeError):
            history = []

        # Personality descriptions
        PERSONALITY_MAP = {
            "professional-humorous": "Professional with a touch of humor — witty yet polished, like a late-night talk show host who respects their guests but keeps the energy light and engaging.",
            "professional": "Professional, formal, and serious. Uses formal language, stays on-topic, and maintains a business-like demeanor.",
            "humorous": "Humorous, playful, and lighthearted. Jokes around, keeps the mood fun, and makes the guest laugh.",
            "friendly": "Warm, approachable, and casual. Creates a cozy atmosphere like chatting with an old friend.",
            "intellectual": "Intellectual, thoughtful, and deep. Asks insightful questions, references concepts, and pursues thorough understanding.",
        }

        style_desc = PERSONALITY_MAP.get(personality, personality)

        # Time budget: calculate exchange counts based on total duration
        # Opening: ~5%, Warm-up: ~15%, Discussion: ~70%, Closing: ~10%
        # Each exchange (host + guest) takes roughly 30-60 seconds in speech
        total_minutes = max(5, min(60, duration_minutes))
        budget_parts = {
            "🎬 Opening": max(1, int(total_minutes * 0.05)),
            "👋 Warm-up": max(1, int(total_minutes * 0.15)),
            "🎯 Discussion": max(2, int(total_minutes * 0.70)),
            "🎬 Closing": max(1, int(total_minutes * 0.10)),
        }
        total_exchanges = sum(budget_parts.values())
        # Track spent exchanges
        host_count = len([h for h in history if h.get("role") == "host"])
        guest_count = len([h for h in history if h.get("role") == "guest"])
        spent = host_count + guest_count
        remaining = max(1, total_exchanges - spent)

        # Determine which segment we're in based on budget
        warmup_threshold = budget_parts["🎬 Opening"] + budget_parts["👋 Warm-up"]
        disc_threshold = warmup_threshold + budget_parts["🎯 Discussion"]
        if host_count <= budget_parts["🎬 Opening"]:
            current_segment = "Opening Monologue"
        elif host_count <= warmup_threshold:
            current_segment = "Guest Introduction & Warm-up"
        elif host_count <= disc_threshold:
            current_segment = "Main Discussion"
        else:
            current_segment = "Closing"

        # Build time-budget guide
        time_guide = (
            f"── TOTAL SHOW TIME: {total_minutes} MINUTES ──\n"
            f"Plan your responses so the show fits roughly {total_minutes} minutes.\n"
            f"Segment budget (in host speaking turns):\n"
            f"  🎬 Opening: {budget_parts['🎬 Opening']} turn(s) — short & punchy (~30 sec)\n"
            f"  👋 Warm-up: {budget_parts['👋 Warm-up']} turns — brief rapport, then MOVE ON\n"
            f"  🎯 Discussion: {budget_parts['🎯 Discussion']} turns — THIS IS THE MAIN EVENT\n"
            f"  🎬 Closing: {budget_parts['🎬 Closing']} turn(s) — quick wrap-up\n"
            f"Remaining exchanges (host+guest): ~{remaining}\n"
            f"So keep responses tight — especially in Opening and Warm-up. Save depth for Discussion."
        )

        # Build the system prompt with structured show format
        system_parts = [
            f"You are a talk show host named \"{host_name}\". You are interviewing {guest_name} about the topic: {topic}.",
            "",
            time_guide,
            "",
            "── SHOW STRUCTURE ──",
            "The show follows a clear arc. Know which segment you're in and play that role:",
            "",
            "🎬 [Opening Monologue] — BRIEF. Greet the audience, introduce the topic in 2-3 sentences,",
            "   introduce the guest, and ask ONE ice-breaker. Move on fast.",
            "",
            "👋 [Guest Introduction & Warm-up] — Keep this SHORT. Ask 1-2 light questions,",
            "   then pivot quickly to the main topic. Don't linger.",
            "",
            "🎯 [Main Discussion] — THIS IS THE BULK OF THE SHOW. Spend most of your time here.",
            "   Deep dive into the background materials and key topics.",
            "   Ask substantive questions. Challenge ideas respectfully. Connect dots.",
            "   After each guest answer, ask ONE follow-up before moving to the next topic.",
            "   Reference specific facts from the background materials.",
            "",
            "🎬 [Closing] — BRIEF. Thank the guest, one key takeaway, one sentence sign-off.",
            "   Do NOT start a new topic here.",
            "",
            f"CURRENT SEGMENT: {current_segment}",
            f"Play the role of the host in the {current_segment} segment. Don't skip ahead.",
            f"You have ~{remaining} remaining host+guest exchanges — pace yourself.",
            "",
            "── HOST STYLE ──",
            style_desc,
            "",
            "── EMOTIONAL DYNAMICS ──",
            "Vary your tone throughout the show — don't stay flat:",
            "- Opening: ENERGETIC, welcoming, excited about the topic",
            "- Warm-up: WARM, curious, playful — build connection, but keep it brief",
            "- Main discussion: THOUGHTFUL, probing, occasionally surprised",
            "- When guest shares insight: Show genuine interest (\"That's fascinating!\")",
            "- When exploring: Curious and engaged (\"I want to dig deeper into that...\")",
            "- Closing: WARM, GRATEFUL, reflective — looking back at highlights",
            "",
            "── SHOWMANSHIP ──",
            "- Use occasional audience-facing remarks (\"Isn't that fascinating?\")",
            "- Build anticipation (\"Now this is where it gets really interesting...\")",
            "- Use natural transitions (\"Speaking of which...\", \"That reminds me...\")",
            "- Sound like a real person hosting a show, not an AI answering questions",
            "",
            "── FOLLOW-UP STRATEGY ──",
            "- After the guest answers, always ask ONE follow-up before moving on",
            "- A good follow-up digs deeper into something the guest JUST SAID",
            "- Patterns: \"You mentioned [X], can you elaborate?\" / \"What led you to that conclusion?\"",
            "  / \"How does [X] connect to what you said earlier about [Y]?\"",
            "- Only move to the next question when you've fully explored the current thread",
            "",
            "── RULES ──",
            f"- Address {guest_name} by name. Make them feel welcome and heard.",
            "- All responses must be in English.",
            "- Keep responses conversational and natural — spoken word, not essay.",
            "- Vary response length: some short reactions, some thoughtful questions.",
            "- Sound genuinely interested. Listen to what the guest says and react to it.",
            "- CRITICAL: Speak directly. NEVER include stage directions, action descriptions,",
            "  or any text in asterisks or brackets like *walks on stage*, [smiles], or (waves).",
            "  Just say your lines — as if you're live on air and the audience only hears your voice.",
            "",
            "── SOUND EFFECTS ──",
            "If a sound effect fits the moment, append it at the end of your response in double curly braces.",
            "NEVER describe the sound in words — use the tag and speak your lines as normal.",
            "Available sounds: {{APPLAUSE}}, {{LAUGH}}, {{WHOOSH}}",
            "- {{APPLAUSE}}: After opening announcement, after closing, after a particularly impressive insight",
            "- {{LAUGH}}: After a funny remark or joke",
            "- {{WHOOSH}}: Between segment transitions (Opening→Warm-up→Discussion→Closing)",
            "Only use a sound when it truly fits. Don't force it. Most responses have NO sound effect.",
        ]

        if background.strip():
            system_parts.append("")
            system_parts.append("── BACKGROUND MATERIALS ──")
            system_parts.append("Use these to inform your questions and responses. Strategy:")
            system_parts.append("- Extract 2-3 KEY POINTS to discuss with the guest")
            system_parts.append("- Reference specific facts: \"As mentioned in the article...\"")
            system_parts.append("- Ask questions that explore or challenge these points")
            system_parts.append("- When the guest says something new, connect it back to the materials")
            system_parts.append("")
            system_parts.append(background.strip())

        if questions.strip():
            system_parts.append("")
            system_parts.append("── INTERVIEW QUESTIONS / OUTLINE ──")
            system_parts.append("Follow these during the show, but stay flexible — let the conversation breathe:")
            system_parts.append(questions.strip())

        system_prompt = "\n".join(system_parts)

        # Build messages for the LLM
        messages = [{"role": "system", "content": system_prompt}]

        # First message from host (opening) — structured script
        if not history:
            messages.append({
                "role": "user",
                "content": (
                    f"Open the show with energy. Follow this script:\n"
                    f"1. Greet the audience warmly\n"
                    f"2. Introduce today's topic: {topic} — build excitement\n"
                    f"3. Tease what's coming (\"We have a fantastic conversation ahead\")\n"
                    f"4. Introduce your guest {guest_name} with a brief, warm welcome\n"
                    f"5. Start with a friendly ice-breaker question to get the conversation flowing\n\n"
                    f"Be warm, energetic, and natural — like a real late-night host."
                )
            })
        else:
            # Add conversation history
            for h in history:
                role = "assistant" if h.get("role") == "host" else "user"
                messages.append({"role": role, "content": h.get("content", "")})
            messages.append({"role": "user", "content": message})

        # Route to the active model
        model_id = _get_model_for_session("talk_show_session")
        info = MODEL_CATALOG.get(model_id)

        if not info:
            return {"reply": f"(Error: No model configured)"}

        if info.get("backend") == "openai":
            client = get_openai_client(model_id)
            if not client:
                return {"reply": f"(Error: '{info['name']}' not configured)"}
            try:
                resp = await asyncio.wait_for(
                    asyncio.to_thread(
                        client.chat.completions.create,
                        model=info["model"],
                        messages=messages,
                        temperature=0.7,
                    ),
                    timeout=60,
                )
                reply = resp.choices[0].message.content or ""
                # Parse sound effect
                sound_effect = None
                import re as _re
                m = _re.search(r'\{\{(\w+)\}\}', reply)
                if m and m.group(1) in ('APPLAUSE', 'LAUGH', 'WHOOSH'):
                    sound_effect = m.group(1).lower()
                    reply = _re.sub(r'\s*\{\{\w+\}\}\s*', '', reply).strip()
                return {"reply": reply, "sound_effect": sound_effect}
            except Exception as exc:
                logger.error("Talk show error: %s", exc, exc_info=True)
                return {"reply": f"(Error: {exc})"}
        else:
            # ADK (Gemini) route
            runner = _get_adk_runner(model_id)
            svc = _get_adk_session_service(model_id)
            if not runner or not svc:
                return {"reply": f"(Error: Model '{model_id}' not available)"}
            try:
                await svc.create_session(
                    app_name="digital_human",
                    user_id="default_user",
                    session_id="talk_show_session",
                )
            except Exception:
                pass

            # Build a combined text prompt for ADK
            prompt_text = "\n\n".join([f"{m['role']}: {m['content']}" for m in messages])
            new_msg = types.Content(role="user", parts=[types.Part(text=prompt_text)])
            events = []
            async for event in runner.run_async(
                user_id="default_user",
                session_id="talk_show_session",
                new_message=new_msg,
            ):
                events.append(event)
            reply = ""
            for e in reversed(events):
                if e.author != "user" and e.content and e.content.parts and not e.partial:
                    reply = e.content.parts[0].text or ""
                    break
            # Parse sound effect
            sound_effect = None
            import re as _re
            m = _re.search(r'\{\{(\w+)\}\}', reply)
            if m and m.group(1) in ('APPLAUSE', 'LAUGH', 'WHOOSH'):
                sound_effect = m.group(1).lower()
                reply = _re.sub(r'\s*\{\{\w+\}\}\s*', '', reply).strip()
            return {"reply": reply, "sound_effect": sound_effect}

    @app.post("/api/talk-show/suggest")
    async def talk_show_suggest(
        topic: str = Form(""),
        guest_name: str = Form("Guest"),
        host_name: str = Form(""),
        background: str = Form(""),
        history_json: str = Form("[]"),
        language: str = Form("en"),
    ):
        """Generate 3 suggested responses for the guest to choose from, based on current conversation context."""
        import json
        try:
            history: list = json.loads(history_json)
        except (json.JSONDecodeError, TypeError):
            history = []

        suggest_prompt = (
            f"You are {guest_name}, a guest on {host_name}'s talk show about '{topic}'.\n\n"
            f"Based on the conversation so far, suggest 3 short, natural things {guest_name} might say next.\n"
            f"Each suggestion should:\n"
            f"- Be a realistic spoken response (1-2 sentences)\n"
            f"- Reflect the guest's perspective on the topic\n"
            f"- Give the host something interesting to respond to\n\n"
            f"Return ONLY a JSON array of 3 strings, no other text.\n"
            f'Example format: ["Suggestion one", "Suggestion two", "Suggestion three"]\n'
        )

        if background.strip():
            suggest_prompt += f"\nBackground context: {background}\n"

        if history:
            suggest_prompt += "\nRecent conversation:\n"
            for h in history[-4:]:
                role_label = f"{host_name} (Host)" if h.get("role") == "host" else f"{guest_name} (Guest)"
                suggest_prompt += f"{role_label}: {h.get('content', '')}\n"

        # Route to the active model
        model_id = _get_model_for_session("talk_show_session")
        info = MODEL_CATALOG.get(model_id)

        if not info:
            return {"suggestions": ["Tell me more about that.", "That's really interesting!", "I have a different perspective on that."]}

        if info.get("backend") == "openai":
            client = get_openai_client(model_id)
            if not client:
                return {"suggestions": []}
            try:
                resp = await asyncio.wait_for(
                    asyncio.to_thread(
                        client.chat.completions.create,
                        model=info["model"],
                        messages=[{"role": "user", "content": suggest_prompt}],
                        temperature=0.8,
                        max_tokens=300,
                    ),
                    timeout=30,
                )
                text = resp.choices[0].message.content or "[]"
                try:
                    suggestions = json.loads(text)
                    if isinstance(suggestions, list) and len(suggestions) >= 1:
                        return {"suggestions": suggestions[:3]}
                except json.JSONDecodeError:
                    pass
                return {"suggestions": []}
            except Exception as exc:
                logger.error("Talk show suggest error: %s", exc)
                return {"suggestions": []}
        else:
            # ADK (Gemini) route — simple fallback
            runner = _get_adk_runner(model_id)
            svc = _get_adk_session_service(model_id)
            if not runner or not svc:
                return {"suggestions": []}
            try:
                new_msg = types.Content(role="user", parts=[types.Part(text=suggest_prompt)])
                events = []
                async for event in runner.run_async(
                    user_id="default_user",
                    session_id="talk_show_session",
                    new_message=new_msg,
                ):
                    events.append(event)
                text = ""
                for e in reversed(events):
                    if e.author != "user" and e.content and e.content.parts and not e.partial:
                        text = e.content.parts[0].text or ""
                        break
                try:
                    suggestions = json.loads(text)
                    if isinstance(suggestions, list) and len(suggestions) >= 1:
                        return {"suggestions": suggestions[:3]}
                except json.JSONDecodeError:
                    pass
                return {"suggestions": []}
            except Exception:
                return {"suggestions": []}

    @app.get("/api/voices")
    async def get_voices():
        """Return available TTS voices with locale, gender, and popular names."""
        return JSONResponse(list_voices())

    @app.post("/audio/tts")
    async def text_to_speech(
        text: str = Form(...),
        language: str = Form("en"),
        voice: str = Form(""),
        background_tasks: BackgroundTasks = None,
    ):
        try:
            path = await synthesize(text, language, voice or None)
            if background_tasks:
                background_tasks.add_task(os.remove, path)
            return FileResponse(path, media_type="audio/mpeg", filename="speech.mp3")
        except Exception as exc:
            logger.error("TTS error: %s", exc, exc_info=True)
            return JSONResponse(
                {"error": f"TTS failed: {exc}"},
                status_code=500,
            )

    @app.post("/generate-slides")
    async def generate_slides(
        script: str = Form(...),
        num_slides: int = Form(5),
        language: str = Form("en"),
    ):
        """Send a raw script to the AI for slide generation."""
        try:
            model_id = _get_model_for_session("slide_generation_session")
            info = MODEL_CATALOG.get(model_id, {})
            if info.get("backend") == "openai":
                return await _generate_slides_openai(script, num_slides, language)
            else:
                return await _generate_slides_adk(script, num_slides, language)
        except Exception as exc:
            logger.error("Slide generation error: %s", exc, exc_info=True)
            return {"slides": [{"display": script, "speech": script}], "error": str(exc)}

    @app.on_event("startup")
    async def startup():
        clear_old_cache(max_age_seconds=3600)
        asyncio.create_task(periodic_cleanup(interval=600))

    return app


if __name__ == "__main__":
    import uvicorn
    import subprocess
    import signal
    port = int(os.getenv("PORT", 8000))
    host = os.getenv("HOST", "0.0.0.0")

    # Clean up stale process on the same port before binding
    try:
        result = subprocess.run(
            ["lsof", "-t", "-i", f":{port}", "-s", "TCP:LISTEN"],
            capture_output=True, text=True, timeout=5,
        )
        pids = [int(p) for p in result.stdout.strip().split() if p]
        for pid in pids:
            os.kill(pid, signal.SIGTERM)
            logger.warning("Killed stale process PID %d holding port %d", pid, port)
    except (FileNotFoundError, subprocess.TimeoutExpired, ValueError, OSError):
        pass

    app = create_app()
    print(f"🚀 ADK Digital Human: http://{host}:{port}")
    print(f"💬 Chat:        POST /chat              (form: text=...)")
    print(f"🔊 TTS:         POST /audio/tts         (form: text+language+voice)")
    print(f"🎙 Voice:       GET  /api/voices         (voice catalog)")
    print(f"🤖 Models:      GET  /api/models         (model catalog)")
    print(f"📊 Slides:      POST /generate-slides    (form: script+language+num_slides)")
    print(f"🖥️  Web UI:     http://{host}:{port}     (ADK Web UI)")
    uvicorn.run(app, host=host, port=port)
