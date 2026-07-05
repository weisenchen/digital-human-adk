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
        """Build the slide generation prompt."""
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
            f"  1. DISPLAY content — what appears on screen (headings, bullet points, short text)\n"
            f"  2. SPEECH script — what the narrator reads aloud (full sentences, explanatory, can differ)\n\n"
            f"RULES:\n"
            f"- DISPLAY: concise, scannable, presentation-ready. Use ## headings, bullet points, short paragraphs.\n"
            f"- SPEECH: conversational narration that covers the same key points in more detail.\n"
            f"- Speech can rephrase, expand, or explain — it does NOT need to match display verbatim.\n"
            f"- But speech MUST cover all KEY POINTS from the display.\n"
            f"- Use `---` to separate slides.\n"
            f"- Use {lang} for all content.\n\n"
            f"RAW SCRIPT:\n{script}\n\n"
            f"OUTPUT FORMAT (exactly):\n"
            f"## Slide 1 Title\nDisplay content here...\n\n===SPEECH===\nFull speech narration for slide 1...\n\n---\n\n"
            f"## Slide 2 Title\nDisplay content...\n\n===SPEECH===\nSpeech for slide 2...\n"
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
        message: str = Form(""),
        history_json: str = Form("[]"),
        language: str = Form("en"),
    ):
        """Talk Show: host responds as a talk show host, grounded in background materials.

        Returns JSON: {\"reply\": \"Host's spoken response\"}
        """
        try:
            import json
            history: list = json.loads(history_json)
        except (json.JSONDecodeError, TypeError):
            history = []

        # Build the system prompt
        system_parts = [
            f'You are a talk show host named "{host_name}". You are interviewing {guest_name} about the topic: {topic}.',
            "",
            "RULES:",
            "- You are the HOST. Ask questions, follow up, and keep the conversation flowing.",
            f"- Your guest is {guest_name}. Address them by name and make them feel welcome.",
            "- All responses must be in English.",
            "- Keep responses conversational, natural, and engaging — like a real interview.",
            "- Ask follow-up questions based on what the guest says.",
            "- Sound genuinely interested and professional.",
        ]

        if background.strip():
            system_parts.append("")
            system_parts.append("BACKGROUND MATERIALS (use these to inform your questions and responses):")
            system_parts.append(background.strip())

        if questions.strip():
            system_parts.append("")
            system_parts.append("INTERVIEW QUESTIONS / OUTLINE (follow these during the show):")
            system_parts.append(questions.strip())

        system_prompt = "\n".join(system_parts)

        # Build messages for the LLM
        messages = [{"role": "system", "content": system_prompt}]

        # First message from host (opening)
        if not history:
            messages.append({
                "role": "user",
                "content": f"Open the show. Introduce yourself as {host_name}, welcome {guest_name}, and introduce the topic: {topic}. Be warm and engaging."
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
                return {"reply": reply}
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
            return {"reply": reply}

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
