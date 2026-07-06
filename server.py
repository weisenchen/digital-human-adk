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

    def _build_html_presentation(slides: list, title: str = "Work Report") -> str:
        """Build a self-contained interactive HTML presentation from slide data.
        Follows the interactive-explainer-video-html format (htmlslide.md):
        - Each slide = one scene with Web Speech API narration
        - Controls: play/pause, prev/next, seek, volume, captions
        - Keyboard shortcuts, scene dots navigation
        """
        scenes_json = []
        for i, s in enumerate(slides):
            display = s.get("display", "")
            speech = s.get("speech", display)
            # Extract a title from display (first line or first ## heading)
            lines = [l.strip() for l in display.split("\n") if l.strip()]
            scene_title = lines[0].replace("##", "").strip() if lines else f"Slide {i+1}"
            # Estimate narration duration (~150 words/min)
            word_count = len(speech.split())
            duration = max(8, word_count // 3)  # ~180 wpm, min 8s
            scenes_json.append({
                "id": f"scene-{i}",
                "title": scene_title,
                "display": display.replace('"', '\\"').replace("\n", "\\n"),
                "narration": speech.replace('"', '\\"').replace("\n", "\\n"),
                "duration": duration,
            })

        scenes_str = ",\n    ".join(
            f"""{{\n      id: "{s["id"]}",\n      title: "{s["title"]}",\n      display: "{s["display"]}",\n      narration: "{s["narration"]}",\n      duration: {s["duration"]}\n    }}"""
            for s in scenes_json
        )
        total_dur = sum(s["duration"] for s in scenes_json)

        html = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{title} — Interactive Presentation</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>
  * {{ margin: 0; padding: 0; box-sizing: border-box; }}
  body {{ background: #0f0f11; color: #e8e8ed; font-family: 'DM Sans', -apple-system, sans-serif; overflow: hidden; height: 100vh; }}
  #player {{ display: flex; flex-direction: column; height: 100vh; background: linear-gradient(135deg, #0f0f11 0%, #1a1a2e 100%); }}
  #brand-logo {{ position: fixed; top: 20px; left: 24px; z-index: 100; font-size: 13px; font-weight: 600; color: rgba(255,255,255,0.5); letter-spacing: 0.5px; }}
  #duration-badge {{ position: fixed; top: 20px; right: 24px; z-index: 100; font-size: 12px; font-family: 'DM Mono', monospace; color: rgba(255,255,255,0.4); background: rgba(255,255,255,0.06); padding: 4px 12px; border-radius: 20px; }}
  #stage {{ flex: 1; position: relative; overflow: hidden; display: flex; align-items: center; justify-content: center; padding: 60px 48px 80px; }}
  .scene {{ position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 60px 48px 100px; opacity: 0; transition: opacity 0.6s ease; pointer-events: none; }}
  .scene.active {{ opacity: 1; pointer-events: auto; }}
  .scene-content {{ max-width: 800px; width: 100%; text-align: center; }}
  .scene-content h1 {{ font-size: clamp(1.8rem, 4vw, 3.2rem); font-weight: 700; line-height: 1.2; margin-bottom: 12px; color: #fff; }}
  .scene-content h2 {{ font-size: clamp(1.3rem, 3vw, 2rem); font-weight: 600; line-height: 1.3; margin-bottom: 10px; color: #e0e0e8; }}
  .scene-content h3 {{ font-size: 1.1rem; font-weight: 500; margin-bottom: 8px; color: #c0c0cc; }}
  .scene-content p {{ font-size: clamp(0.95rem, 1.5vw, 1.15rem); line-height: 1.7; color: #a0a0b0; margin-bottom: 8px; }}
  .scene-content li {{ text-align: left; font-size: clamp(0.9rem, 1.4vw, 1.1rem); line-height: 1.6; color: #c0c0cc; margin: 4px 0; list-style: none; padding-left: 20px; position: relative; }}
  .scene-content li::before {{ content: "▸"; position: absolute; left: 0; color: #6366f1; }}
  .scene-content blockquote {{ border-left: 3px solid #6366f1; padding: 8px 16px; margin: 12px 0; font-style: italic; color: #b0b0c0; text-align: left; font-size: 1.05rem; }}
  .scene-content .big-number {{ font-size: clamp(2.5rem, 6vw, 4.5rem); font-weight: 700; color: #818cf8; margin: 8px 0; }}
  .scene-content .cta {{ display: inline-block; margin-top: 16px; padding: 10px 28px; background: #6366f1; color: #fff; border-radius: 8px; font-weight: 600; font-size: 0.95rem; }}
  #scene-title-overlay {{ position: absolute; bottom: 76px; left: 50%; transform: translateX(-50%); font-size: 11px; color: rgba(255,255,255,0.3); font-family: 'DM Mono', monospace; text-transform: uppercase; letter-spacing: 1px; }}
  #subtitle-bar {{ position: absolute; bottom: 48px; left: 50%; transform: translateX(-50%); max-width: 80%; text-align: center; font-size: 0.95rem; color: rgba(255,255,255,0.7); background: rgba(0,0,0,0.5); backdrop-filter: blur(8px); padding: 8px 20px; border-radius: 12px; opacity: 0; transition: opacity 0.3s; }}
  #subtitle-bar.visible {{ opacity: 1; }}
  #voice-indicator, #voice-badge, #wait-indicator {{ display: none; }}
  #controls {{ height: 56px; background: rgba(255,255,255,0.04); backdrop-filter: blur(12px); border-top: 1px solid rgba(255,255,255,0.06); display: flex; align-items: center; justify-content: center; gap: 8px; padding: 0 24px; shrink: 0; }}
  #controls button {{ background: none; border: none; color: rgba(255,255,255,0.5); cursor: pointer; padding: 8px; border-radius: 6px; transition: all 0.15s; font-size: 14px; display: flex; align-items: center; justify-content: center; min-width: 36px; height: 36px; }}
  #controls button:hover {{ background: rgba(255,255,255,0.08); color: #fff; }}
  #controls button:disabled {{ opacity: 0.2; cursor: default; }}
  #controls .active {{ color: #818cf8; }}
  .progress-wrap {{ flex: 1; max-width: 400px; margin: 0 12px; position: relative; }}
  .progress-wrap input[type=range] {{ width: 100%; height: 4px; -webkit-appearance: none; appearance: none; background: rgba(255,255,255,0.1); border-radius: 2px; outline: none; cursor: pointer; }}
  .progress-wrap input[type=range]::-webkit-slider-thumb {{ -webkit-appearance: none; width: 12px; height: 12px; border-radius: 50%; background: #818cf8; cursor: pointer; }}
  .progress-wrap input[type=range]::-moz-range-thumb {{ width: 12px; height: 12px; border-radius: 50%; background: #818cf8; border: none; cursor: pointer; }}
  .scene-dots {{ display: flex; gap: 4px; margin: 0 8px; }}
  .scene-dots button {{ width: 8px; height: 8px; border-radius: 50%; background: rgba(255,255,255,0.15); border: none; padding: 0; min-width: unset; cursor: pointer; transition: all 0.2s; }}
  .scene-dots button.active {{ background: #818cf8; transform: scale(1.3); }}
  .time-display {{ font-family: 'DM Mono', monospace; font-size: 12px; color: rgba(255,255,255,0.35); min-width: 50px; text-align: center; }}
  .volume-wrap {{ display: flex; align-items: center; gap: 4px; }}
  .volume-wrap input[type=range] {{ width: 60px; height: 3px; -webkit-appearance: none; appearance: none; background: rgba(255,255,255,0.1); border-radius: 2px; outline: none; cursor: pointer; }}
  .volume-wrap input[type=range]::-webkit-slider-thumb {{ -webkit-appearance: none; width: 10px; height: 10px; border-radius: 50%; background: rgba(255,255,255,0.5); cursor: pointer; }}
</style>
</head>
<body>
<div id="player">
  <div id="brand-logo">{title}</div>
  <div id="duration-badge">{total_dur // 60}:{total_dur % 60:02d}</div>
  <div id="stage">
    {"".join(f'''<div class="scene{" active" if i == 0 else ""} id="{s["id"]}">
      <div class="scene-content" id="display-{i}"></div>
    </div>''' for i, s in enumerate(scenes_json))}
    <div id="scene-title-overlay"></div>
    <div id="subtitle-bar"></div>
  </div>
  <div id="controls">
    <button id="play-btn" title="Play / Pause (Space)" onclick="togglePlay()">▶</button>
    <button id="prev-btn" title="Previous scene (Left)" onclick="prevScene()" {"disabled" if len(scenes_json) <= 1 else ""}>⏮</button>
    <button id="next-btn" title="Next scene (Right)" onclick="nextScene()" {"disabled" if len(scenes_json) <= 1 else ""}>⏭</button>
    <div class="scene-dots">
      {"".join(f'<button class="dot{" active" if i == 0 else ""}" data-idx="{i}" onclick="jumpTo({i})"></button>' for i in range(len(scenes_json)))}
    </div>
    <div class="progress-wrap">
      <input type="range" id="seek-bar" min="0" max="100" value="0" step="0.1" oninput="seekTo(this.value)">
    </div>
    <span class="time-display" id="time-display">0:00 / {total_dur // 60}:{total_dur % 60:02d}</span>
    <button id="cc-btn" title="Toggle captions (C)" onclick="toggleCaptions()" class="active">CC</button>
    <div class="volume-wrap">
      <button id="vol-btn" title="Toggle mute (M)" onclick="toggleMute()">🔊</button>
      <input type="range" id="vol-bar" min="0" max="1" value="0.7" step="0.05" oninput="setVolume(this.value)">
    </div>
  </div>
</div>

<script>
  const SCENES = [{scenes_str}];
  const MIN_DURATIONS = [{", ".join(str(s["duration"]) for s in scenes_json)}];
  const TOTAL_DURATION = {total_dur};
  let currentScene = 0, sceneElapsed = 0, totalElapsed = 0, playing = false, muted = false;
  let captionsOn = true, volume = 0.7, animId = null, utterance = null, voicesLoaded = false;
  const stage = document.getElementById('stage');
  const scenes = document.querySelectorAll('.scene');
  const dots = document.querySelectorAll('.dot');
  const seekBar = document.getElementById('seek-bar');
  const timeDisplay = document.getElementById('time-display');
  const subtitleBar = document.getElementById('subtitle-bar');
  const sceneTitle = document.getElementById('scene-title-overlay');
  const playBtn = document.getElementById('play-btn');
  const volBar = document.getElementById('vol-bar');
  const volBtn = document.getElementById('vol-btn');
  const ccBtn = document.getElementById('cc-btn');

  // Load display content into scenes
  for (let i = 0; i < SCENES.length; i++) {{
    const el = document.getElementById('display-' + i);
    if (el) el.innerHTML = SCENES[i].display;
  }}

  function formatTime(s) {{ const m = Math.floor(s/60); return m + ':' + String(Math.floor(s%60)).padStart(2,'0'); }}

  function updateUI() {{
    scenes.forEach((s, i) => s.classList.toggle('active', i === currentScene));
    dots.forEach((d, i) => d.classList.toggle('active', i === currentScene));
    sceneTitle.textContent = SCENES[currentScene].title;
    const pct = totalElapsed > 0 ? (totalElapsed / TOTAL_DURATION) * 100 : 0;
    seekBar.value = Math.min(pct, 100);
    timeDisplay.textContent = formatTime(totalElapsed) + ' / ' + formatTime(TOTAL_DURATION);
    playBtn.textContent = playing ? '⏸' : '▶';
  }}

  function activateScene(idx) {{
    currentScene = idx; sceneElapsed = 0;
    updateUI(); subtitleBar.classList.remove('visible');
    subtitleBar.textContent = '';
    if (utterance) {{ window.speechSynthesis.cancel(); utterance = null; }}
  }}

  function speakScene(idx) {{
    if (utterance) {{ window.speechSynthesis.cancel(); }}
    const text = SCENES[idx].narration;
    if (!text) return;
    utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.95; utterance.pitch = 1.05; utterance.volume = muted ? 0 : volume;
    const voices = window.speechSynthesis.getVoices();
    const engVoice = voices.find(v => /(Aria|Jenny|Sonia|Libby|en-US|en-GB)/i.test(v.name)) || voices.find(v => v.lang.startsWith('en'));
    if (engVoice) utterance.voice = engVoice;
    utterance.onboundary = (e) => {{
      if (e.name === 'word' && captionsOn) {{
        subtitleBar.textContent = text.substring(0, e.charIndex + e.charLength);
        subtitleBar.classList.add('visible');
      }}
    }};
    utterance.onend = () => {{ utterance = null; }};
    window.speechSynthesis.speak(utterance);
  }}

  function togglePlay() {{
    playing = !playing;
    if (playing) {{
      if (totalElapsed === 0) activateScene(0);
      speakScene(currentScene);
      if (!animId) {{
        const step = (ts) => {{
          if (!playing) {{ animId = null; return; }}
          const dt = 0.05;
          sceneElapsed += dt; totalElapsed += dt;
          if (sceneElapsed >= MIN_DURATIONS[currentScene]) {{
            if (currentScene < SCENES.length - 1) {{
              activateScene(currentScene + 1); speakScene(currentScene + 1);
            }} else {{ playing = false; playBtn.textContent = '▶'; }}
          }}
          updateUI();
          animId = requestAnimationFrame(step);
        }};
        animId = requestAnimationFrame(step);
      }}
    }} else {{
      if (animId) {{ cancelAnimationFrame(animId); animId = null; }}
      if (utterance) {{ window.speechSynthesis.cancel(); utterance = null; }}
    }}
    updateUI();
  }}

  function prevScene() {{ if (currentScene > 0) {{ playing = false; if (animId) {{ cancelAnimationFrame(animId); animId = null; }} activateScene(currentScene - 1); }} }}
  function nextScene() {{ if (currentScene < SCENES.length - 1) {{ playing = false; if (animId) {{ cancelAnimationFrame(animId); animId = null; }} activateScene(currentScene + 1); }} }}
  function jumpTo(idx) {{ if (idx >= 0 && idx < SCENES.length) {{ playing = false; if (animId) {{ cancelAnimationFrame(animId); animId = null; }} activateScene(idx); }} }}
  function seekTo(pct) {{ totalElapsed = (pct / 100) * TOTAL_DURATION; let cum = 0; for (let i = 0; i < SCENES.length; i++) {{ cum += MIN_DURATIONS[i]; if (totalElapsed < cum) {{ if (currentScene !== i) activateScene(i); sceneElapsed = MIN_DURATIONS[i] - (cum - totalElapsed); break; }} }} updateUI(); }}
  function toggleCaptions() {{ captionsOn = !captionsOn; ccBtn.classList.toggle('active', captionsOn); if (!captionsOn) subtitleBar.classList.remove('visible'); }}
  function toggleMute() {{ muted = !muted; volBtn.textContent = muted ? '🔇' : (volume < 0.3 ? '🔈' : volume > 0.7 ? '🔊' : '🔉'); if (utterance) utterance.volume = muted ? 0 : volume; }}
  function setVolume(v) {{ volume = v; volBar.value = v; muted = false; volBtn.textContent = v < 0.3 ? '🔈' : v > 0.7 ? '🔊' : '🔉'; if (utterance) utterance.volume = v; }}

  document.addEventListener('keydown', e => {{
    if (e.target.tagName === 'INPUT') return;
    if (e.key === ' ') {{ e.preventDefault(); togglePlay(); }}
    else if (e.key === 'ArrowLeft') prevScene();
    else if (e.key === 'ArrowRight') nextScene();
    else if (e.key === 'c' || e.key === 'C') toggleCaptions();
    else if (e.key === 'm' || e.key === 'M') toggleMute();
  }});

  // Load voices and show ready
  if (window.speechSynthesis) {{
    window.speechSynthesis.onvoiceschanged = () => {{ voicesLoaded = true; }};
    window.speechSynthesis.getVoices();
  }}
</script>
</body>
</html>"""
        return html

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
            "CRITICAL: You MUST add sound effect tags to enhance the show. This is not optional.",
            "",
            "HOW TO USE:",
            "- Opening monologue → END with {{APPLAUSE}}",
            "- Guest says something impressive → END your reply with {{APPLAUSE}}",
            "- Guest makes a joke or funny remark → END with {{LAUGH}}",
            "- Transitioning between segments → END with {{WHOOSH}}",
            "- Closing the show → END with {{APPLAUSE}}",
            "",
            "EXAMPLES:",
            "  \"Welcome to the show! {{APPLAUSE}}\"",
            "  \"That's fascinating! Tell us more. {{APPLAUSE}}\"",
            "  \"That's hilarious! {{LAUGH}}\"",
            "  \"Let's move on to our next topic. {{WHOOSH}}\"",
            "",
            "RULES:",
            "- ALWAYS append at least one sound tag per response when appropriate",
            "- Never describe sounds in words (*applause*, [laughs]) — use ONLY {{TAG}}",
            "- Available tags: {{APPLAUSE}} {{LAUGH}} {{WHOOSH}}",
            "- The tag goes at the VERY END of your response, after your last sentence",
            "- Most responses should have a sound tag. A show without sound effects feels flat.",
        ]

        if background.strip():
            system_parts.append("")
            system_parts.append("── TOPIC BACKGROUND RESEARCH ──")
            system_parts.append("The following is research material about today's TOPIC. Use it to make the discussion informed and substantive:")
            system_parts.append("- Reference specific facts from the materials: \"According to...\", \"I read that...\"")
            system_parts.append("- Ask questions that explore or challenge these points with the guest")
            system_parts.append("- When the guest offers their perspective, connect it back to the facts")
            system_parts.append("- If the guest has relevant experience, ask how it relates to these findings")
            system_parts.append("")
            system_parts.append(background.strip())

        if questions.strip():
            system_parts.append("")
            system_parts.append("── INTERVIEW QUESTIONS (MANDATORY) ──")
            system_parts.append("IMPORTANT: You MUST ask ALL of the following questions during the show.")
            system_parts.append("Do NOT skip any. Work through them systematically — tick each one off as you go.")
            system_parts.append("If the guest's answer naturally leads to a follow-up, ask it, then return to the next question on the list.")
            system_parts.append("These questions are the core of the show — build the conversation around them, not away from them.")
            system_parts.append("")
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

    @app.post("/api/meeting/ask")
    async def meeting_ask(
        title: str = Form(""),
        agenda_json: str = Form("[]"),
        participants_json: str = Form("[]"),
        background: str = Form(""),
        message: str = Form(""),
        history_json: str = Form("[]"),
        language: str = Form("en"),
    ):
        """Meeting Host: AI facilitates a structured meeting with agenda and participants."""
        import json
        try:
            history: list = json.loads(history_json)
        except (json.JSONDecodeError, TypeError):
            history = []
        try:
            agenda: list = json.loads(agenda_json)
        except (json.JSONDecodeError, TypeError):
            agenda = []
        try:
            participants: list = json.loads(participants_json)
        except (json.JSONDecodeError, TypeError):
            participants = []

        total_time = sum(a.get("durationMinutes", 5) for a in agenda)
        agenda_str = "\n".join(
            f"  {i+1}. {a.get('title', 'Untitled')} ({a.get('durationMinutes', 5)} min)"
            for i, a in enumerate(agenda)
        ) or "  (no agenda set)"
        participants_str = "\n".join(
            f"  - {p.get('name', 'Unknown')}" + (f" ({p.get('role', '')})" if p.get('role') else "")
            for p in participants
        ) or "  (no participants)"

        # Determine current agenda item from host message count
        host_count = len([h for h in history if h.get("role") == "host"])
        current_item_idx = min(host_count // 3, len(agenda) - 1) if agenda else 0
        agenda_note = ""
        if current_item_idx < len(agenda):
            item = agenda[current_item_idx]
            agenda_note = f"CURRENT AGENDA ITEM #{current_item_idx + 1}: \"{item.get('title', 'Untitled')}\" — focus on this."
            if current_item_idx > 0:
                prev = agenda[current_item_idx - 1]
                agenda_note = f"PREVIOUS ITEM \"{prev.get('title', 'Untitled')}\" should be wrapped up. {agenda_note}"

        system_prompt = (
            f"You are a professional meeting facilitator. You are running a meeting titled: \"{title}\".\n\n"
            f"── AGENDA (Total: {total_time} min) ──\n{agenda_str}\n\n"
            f"── PARTICIPANTS ──\n{participants_str}\n\n"
            f"── CURRENT STATUS ──\n{agenda_note}\n\n"
            f"── YOUR ROLE ──\n"
            f"- Your job is to keep the meeting productive, on-track, and on-time.\n"
            f"- Address participants by name. Call on specific people to speak.\n"
            f"- Ensure everyone contributes — if someone hasn't spoken, invite them.\n"
            f"- When a participant says something notable, acknowledge it and recap decisions.\n\n"
            f"── TIME MANAGEMENT ──\n"
            f"- Each agenda item has a time budget. Keep track.\n"
            f"- If time is running low on an item, say: \"We have about 2 minutes left on this item.\"\n"
            f"- When time is up for an item, ask: \"We're at time for this item. Would you like to extend by a few minutes, or shall we move on?\"\n"
            f"- If the group wants to extend, allow it. Otherwise, summarize and move to the next item.\n\n"
            f"── DECISIONS & ACTIONS ──\n"
            f"- When a decision is reached, restate it clearly: \"So we've decided to...\"\n"
            f"- If an action item is assigned, state: \"[Name] will [do what] by [when].\"\n"
            f"- At the end of the meeting, summarize: decisions, action items, next steps.\n\n"
            f"── OPENING SCRIPT ──\n"
            f"If this is the start of the meeting:\n"
            f"1. Welcome everyone\n"
            f"2. State the meeting title and goal\n"
            f"3. Review the agenda: list each item and its time allocation\n"
            f"4. Introduce the first agenda item and call on the first participant\n\n"
            f"── RULES ──\n"
            f"- Speak naturally, like a real facilitator.\n"
            f"- Do NOT include stage directions or action descriptions in asterisks or brackets.\n"
            f"- All responses in {'English' if language == 'en' else 'the specified language'}.\n"
            f"- Be professional, warm, and keep things moving.\n"
        )

        if background.strip():
            system_prompt += f"\n── BACKGROUND RESEARCH ──\n{background}\n"

        messages = [{"role": "system", "content": system_prompt}]
        for h in history:
            role = "assistant" if h.get("role") == "host" else "user"
            messages.append({"role": role, "content": h.get("content", "")})

        if message.strip():
            messages.append({"role": "user", "content": message})
        elif not history:
            messages.append({"role": "user", "content": "Open the meeting."})
        else:
            messages.append({"role": "user", "content": "Continue facilitating the meeting."})

        model_id = _get_model_for_session("meeting_session")
        info = MODEL_CATALOG.get(model_id)
        if not info:
            return {"reply": "Meeting Host is not available. Please select a model in Settings."}

        if info.get("backend") == "openai":
            client = get_openai_client(model_id)
            if not client:
                return {"reply": "AI client not available."}
            try:
                resp = await asyncio.wait_for(
                    asyncio.to_thread(
                        client.chat.completions.create,
                        model=info["model"],
                        messages=messages,
                        temperature=0.7,
                        max_tokens=600,
                    ),
                    timeout=60,
                )
                reply = resp.choices[0].message.content or ""
                return {"reply": reply}
            except Exception as exc:
                logger.error("Meeting host error: %s", exc, exc_info=True)
                return {"reply": f"(Error: {exc})"}
        else:
            # ADK backend
            try:
                import google.adk.types as _types_adk
                new_msg = _types_adk.Content(role="user", parts=[_types_adk.Part(text=messages[-1]["content"])])
                _messages = messages[:-1]
                events = []
                async for event in runner.run_async(
                    user_id="default_user",
                    session_id="meeting_session",
                    new_message=new_msg,
                ):
                    events.append(event)
                reply = ""
                for e in reversed(events):
                    if e.author != "user" and e.content and e.content.parts and not e.partial:
                        reply = e.content.parts[0].text or ""
                        break
                return {"reply": reply}
            except Exception as exc:
                logger.error("Meeting host ADK error: %s", exc, exc_info=True)
                return {"reply": f"(Error: {exc})"}

    @app.post("/api/meeting/summarize")
    async def meeting_summarize(
        title: str = Form(""),
        agenda_json: str = Form("[]"),
        participants_json: str = Form("[]"),
        history_json: str = Form("[]"),
    ):
        """Generate a structured meeting summary from the full conversation."""
        import json
        try:
            history: list = json.loads(history_json)
        except (json.JSONDecodeError, TypeError):
            history = []
        try:
            agenda: list = json.loads(agenda_json)
        except (json.JSONDecodeError, TypeError):
            agenda = []
        try:
            participants: list = json.loads(participants_json)
        except (json.JSONDecodeError, TypeError):
            participants = []

        agenda_str = "\n".join(
            f"  {i+1}. {a.get('title', 'Untitled')}"
            for i, a in enumerate(agenda)
        ) or "  (no agenda)"

        participants_str = ", ".join(p.get("name", "?") for p in participants) or "None"

        transcript = "\n".join(
            f"[{h.get('role', '?')}] {h.get('content', '')}"
            for h in history
        )[:4000]

        prompt = (
            f"You are a professional meeting minutes writer. Summarize the following meeting.\n\n"
            f"── MEETING INFO ──\n"
            f"Title: {title}\n"
            f"Participants: {participants_str}\n\n"
            f"── AGENDA ──\n{agenda_str}\n\n"
            f"── TRANSCRIPT ──\n{transcript}\n\n"
            f"── OUTPUT FORMAT (return in this exact structure) ──\n"
            f"## Summary\n"
            f"[2-3 sentence overview of the meeting]\n\n"
            f"## Agenda Items Covered\n"
            f"- Item 1: [key points discussed]\n"
            f"- Item 2: [key points discussed]\n\n"
            f"## Key Decisions\n"
            f"- [Decision 1]\n"
            f"- [Decision 2]\n\n"
            f"## Action Items\n"
            f"- [Who]: [What] ([optional: deadline])\n"
            f"- [Who]: [What]\n\n"
            f"## Next Steps\n"
            f"- [Next step 1]\n"
            f"- [Next step 2]\n"
        )

        model_id = _get_model_for_session("meeting_session")
        info = MODEL_CATALOG.get(model_id)
        if not info:
            return {"summary": "Summary unavailable — no model selected."}

        if info.get("backend") == "openai":
            client = get_openai_client(model_id)
            if not client:
                return {"summary": "Summary unavailable."}
            try:
                resp = await asyncio.wait_for(
                    asyncio.to_thread(
                        client.chat.completions.create,
                        model=info["model"],
                        messages=[{"role": "user", "content": prompt}],
                        temperature=0.5,
                        max_tokens=800,
                    ),
                    timeout=60,
                )
                return {"summary": resp.choices[0].message.content or ""}
            except Exception as exc:
                return {"summary": f"(Error generating summary: {exc})"}
        else:
            try:
                import google.adk.types as _types_adk
                new_msg = _types_adk.Content(role="user", parts=[_types_adk.Part(text=prompt)])
                events = []
                async for event in runner.run_async(
                    user_id="default_user",
                    session_id="meeting_session",
                    new_message=new_msg,
                ):
                    events.append(event)
                text = ""
                for e in reversed(events):
                    if e.author != "user" and e.content and e.content.parts and not e.partial:
                        text = e.content.parts[0].text or ""
                        break
                return {"summary": text}
            except Exception as exc:
                return {"summary": f"(Error: {exc})"}

    # ── Work Report (工作汇报) ──────────────────────────────────────────────

    @app.post("/api/work-report/ask")
    async def work_report_ask(
        mode: str = Form("present"),
        slide_content: str = Form(""),
        background: str = Form(""),
        ai_personality: str = Form("data-driven"),
        message: str = Form(""),
        history_json: str = Form("[]"),
        preset_questions: str = Form("[]"),
        asked_questions: str = Form("[]"),
        language: str = Form("en"),
        current_slide_index: int = Form(0),
    ):
        """Work Report: AI plays a local team lead reporting to the CTO.

        Returns JSON: {"reply": "...", "sound_effect": "...",
                       "slide_transition": "next"|"stay"|null,
                       "next_slide_index": int}
        """
        import json
        import re as _re
        try:
            history: list = json.loads(history_json)
        except (json.JSONDecodeError, TypeError):
            history = []
        try:
            preset_qs: list = json.loads(preset_questions)
        except (json.JSONDecodeError, TypeError):
            preset_qs = []
        try:
            asked_qs: list = json.loads(asked_questions)
        except (json.JSONDecodeError, TypeError):
            asked_qs = []

        # Personality descriptions (工作汇报 style)
        PERSONALITY_MAP = {
            "data-driven": "数据汇报型 — You are a data-driven team lead. You back every statement with metrics, KPIs, and concrete numbers. You present trends, growth rates, and quantitative progress clearly. (Communication style: professional, precise, numbers-first.)",
            "engineering": "技术深耕型 — You are an engineering-focused team lead. You emphasize technical depth, architecture decisions, code quality, and system reliability. You communicate trade-offs and technical rationale. (Communication style: analytical, detailed, technically precise.)",
            "visionary": "市场激情型 — You are a market-visionary team lead. You focus on user impact, market opportunities, competitive advantages, and strategic direction. You're passionate about the product and its users. (Communication style: energetic, inspiring, big-picture.)",
            "cautious": "谨慎保守型 — You are a cautious, risk-aware team lead. You highlight potential risks, bottlenecks, and concerns before celebrating wins. You present mitigations alongside progress. (Communication style: measured, thorough, risk-conscious.)",
            "results-driven": "目标导向型 — You are a results-oriented team lead. You anchor every update to OKRs, milestones, deadlines, and deliverables. You clearly communicate what was achieved vs. what's at risk. (Communication style: direct, concise, outcome-focused.)",
        }

        style_desc = PERSONALITY_MAP.get(
            ai_personality,
            "You are a professional, data-oriented team lead reporting to the CTO.",
        )

        # Build system prompt
        lang_label = "English" if language.split("-")[0] == "en" else "Chinese"
        system_parts = [
            f"You are a local team lead (本地项目负责人) reporting work progress to the CTO. You are presenting a slide deck.",
            "",
            f"── YOUR PERSONALITY ──",
            style_desc,
            "",
            f"── COMMUNICATION STYLE ──",
            f"- Professional, respectful, and data-oriented",
            f"- Address the CTO as '您' (formal You) or 'CTO' depending on {lang_label} context",
            f"- Be concise and structured — the CTO has limited time",
            f"- Show ownership: use 'we' (our team, we've achieved) not impersonal statements",
            f"- When reporting problems, also present proposed solutions",
            f"- CRITICAL: Never include stage directions, action descriptions, or any text in asterisks",
            f"  or brackets like *presents slide*, [nods], or (gestures). Just speak your lines directly.",
            "",
            f"── MODE HANDLING ──",
        ]

        if mode == "present":
            system_parts.extend([
                f"CURRENT MODE: Presenting slide #{current_slide_index}",
                f"You are presenting a slide to the CTO. Speak naturally about what the slide shows.",
                f"Explain the key data points, insights, and implications.",
                f"After finishing the slide content, transition naturally by saying you can move to the next",
                f"slide or take questions.",
            ])
        elif mode == "cto_question":
            system_parts.extend([
                f"CURRENT MODE: Answering a question from the CTO",
                f"The CTO has asked you something. Answer professionally with data and facts.",
                f"Be direct and thorough. If you don't know something, say so honestly.",
            ])
        elif mode == "ai_question":
            system_parts.extend([
                f"CURRENT MODE: Asking a preset question to the CTO",
                f"You have prepared questions to ask the CTO. Ask one of your preset questions naturally",
                f"in the context of the current discussion. Do not ask a question that has already been asked.",
            ])

        if slide_content.strip():
            system_parts.append("")
            system_parts.append("── CURRENT SLIDE CONTENT ──")
            system_parts.append(slide_content.strip())

        if background.strip():
            system_parts.append("")
            system_parts.append("── BACKGROUND / STRATEGIC CONTEXT ──")
            system_parts.append(background.strip())

        if preset_qs and mode == "ai_question":
            # Find an unasked question
            unasked = [q for q in preset_qs if q not in asked_qs]
            if unasked:
                system_parts.append("")
                system_parts.append("── PRESET QUESTIONS FOR CTO ──")
                system_parts.append("Pick ONE of these questions to ask the CTO. Do NOT ask one that has already been asked:")
                for i, q in enumerate(unasked):
                    marker = "✅" if q in asked_qs else "⬜"
                    system_parts.append(f"  {marker} {q}")
                system_parts.append("")
                system_parts.append(f"Already asked: {len(asked_qs)}/{len(preset_qs)} questions used.")

        system_parts.append("")
        system_parts.append("── SOUND EFFECTS ──")
        system_parts.append("You can use {{SOUND}} tags to trigger subtle sound effects. Available tags:")
        system_parts.append("- {{SOUND}} — Use when transitioning between slides or key moments (e.g., slide transition, emphasis point)")
        system_parts.append("- Place {{SOUND}} at the END of your response, after your last sentence.")
        system_parts.append("- Do NOT overuse — at most one sound tag per response.")
        system_parts.append("- Do NOT describe sounds in words — use ONLY the {{SOUND}} tag.")

        system_prompt = "\n".join(system_parts)

        # Build messages
        messages = [{"role": "system", "content": system_prompt}]

        if mode == "present" and not history:
            messages.append({
                "role": "user",
                "content": (
                    f"Present slide #{current_slide_index} to the CTO. Explain what's on the slide, "
                    f"highlight key data points, and state the implications. Be professional and concise. "
                    f"If the slide_content is empty, just introduce the current section of the report."
                ),
            })
        elif mode == "cto_question" and message.strip():
            for h in history:
                role = "assistant" if h.get("role") == "ai" else "user"
                messages.append({"role": role, "content": h.get("content", "")})
            messages.append({"role": "user", "content": f"[CTO Question]: {message}"})
        elif mode == "ai_question":
            for h in history:
                role = "assistant" if h.get("role") == "ai" else "user"
                messages.append({"role": role, "content": h.get("content", "")})
            messages.append({"role": "user", "content": "Ask one of your prepared questions to the CTO now."})
        else:
            if history:
                for h in history:
                    role = "assistant" if h.get("role") == "ai" else "user"
                    messages.append({"role": role, "content": h.get("content", "")})
            if message.strip():
                messages.append({"role": "user", "content": message})
            else:
                messages.append({"role": "user", "content": f"Continue presenting slide #{current_slide_index}."})

        # Route to the active model
        model_id = _get_model_for_session("work_report_session")
        info = MODEL_CATALOG.get(model_id)

        if not info:
            return {"reply": "Work Report is not available. Please select a model in Settings.", "sound_effect": None, "slide_transition": None, "next_slide_index": current_slide_index}

        if info.get("backend") == "openai":
            client = get_openai_client(model_id)
            if not client:
                return {"reply": "AI client not available.", "sound_effect": None, "slide_transition": None, "next_slide_index": current_slide_index}
            try:
                resp = await asyncio.wait_for(
                    asyncio.to_thread(
                        client.chat.completions.create,
                        model=info["model"],
                        messages=messages,
                        temperature=0.7,
                        max_tokens=600,
                    ),
                    timeout=60,
                )
                reply = resp.choices[0].message.content or ""
            except Exception as exc:
                logger.error("Work report error: %s", exc, exc_info=True)
                return {"reply": f"(Error: {exc})", "sound_effect": None, "slide_transition": None, "next_slide_index": current_slide_index}
        else:
            # ADK (Gemini) route
            runner = _get_adk_runner(model_id)
            svc = _get_adk_session_service(model_id)
            if not runner or not svc:
                return {"reply": f"(Error: Model '{model_id}' not available)", "sound_effect": None, "slide_transition": None, "next_slide_index": current_slide_index}
            try:
                await svc.create_session(
                    app_name="digital_human",
                    user_id="default_user",
                    session_id="work_report_session",
                )
            except Exception:
                pass

            prompt_text = "\n\n".join([f"{m['role']}: {m['content']}" for m in messages])
            new_msg = types.Content(role="user", parts=[types.Part(text=prompt_text)])
            events = []
            async for event in runner.run_async(
                user_id="default_user",
                session_id="work_report_session",
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
        m = _re.search(r'\{\{(\w+)\}\}', reply)
        if m and m.group(1) in ('SOUND', 'APPLAUSE'):
            sound_effect = m.group(1).lower()
            reply = _re.sub(r'\s*\{\{\w+\}\}\s*', '', reply).strip()

        # Determine slide transition based on reply content
        slide_transition = None
        next_slide_index = current_slide_index
        lower_reply = reply.lower()
        if any(phrase in lower_reply for phrase in ["next slide", "move to the next", "let's move on", "next slide please", "go to the next"]):
            slide_transition = "next"
            next_slide_index = current_slide_index + 1

        return {
            "reply": reply,
            "sound_effect": sound_effect,
            "slide_transition": slide_transition,
            "next_slide_index": next_slide_index,
        }

    @app.post("/api/work-report/generate-slides")
    async def work_report_generate_slides(
        outline: str = Form(""),
        background: str = Form(""),
        personality: str = Form("data-driven"),
        num_slides: int = Form(5),
        language: str = Form("en"),
    ):
        """Generate work report slides from an outline with background context.

        Returns JSON: {"slides": [{"display": "...", "speech": "..."}, ...]}
        """
        try:
            # Build personality description for slide generation
            PERSONALITY_DESC = {
                "data-driven": "Data-driven: slides focus on metrics, KPIs, charts, and quantitative progress. Use DATA slide types prominently.",
                "engineering": "Engineering: slides focus on technical architecture, system design, code quality, and engineering milestones. Use CONTENT and DATA types.",
                "visionary": "Visionary: slides focus on market impact, user growth, competitive positioning, and strategic vision. Use QUOTE and DATA types.",
                "cautious": "Cautious: slides present both progress AND risks/mitigations. Use COMPARE and CONTENT types to show balanced perspective.",
                "results-driven": "Results-driven: slides are structured around OKRs, milestones, deliverables, and outcomes. Use DATA and CONTENT types.",
            }
            style = PERSONALITY_DESC.get(personality, "Professional work report format.")

            # Normalize language
            lang_code = language.split("-")[0] if language else "en"
            lang = "Chinese" if lang_code in ("zh", "cmn") else "English"

            prompt = (
                f"You are a professional presentation designer creating a WORK REPORT (工作汇报) for a local team lead "
                f"to present to the CTO.\n\n"
                f"Personality: {style}\n\n"
                f"Generate exactly {num_slides} well-structured slides based on the outline below.\n\n"
                f"Each slide has TWO parts separated by '===SPEECH===':\n"
                f"  1. DISPLAY content — what appears on screen (markdown, presentation-ready)\n"
                f"  2. SPEECH script — what the team lead says aloud (conversational narration)\n\n"
                f"── SLIDE TYPE SYSTEM ──\n"
                f"Start every slide with its type marker:\n"
                f"##TITLE — Opening slide, large centered heading + subtitle\n"
                f"##SECTION — Chapter divider between main sections\n"
                f"##CONTENT — Standard content with title and bullet points (DEFAULT)\n"
                f"##QUOTE — Highlight a key quote or testimony\n"
                f"##DATA — Emphasize a statistic or key number\n"
                f"##COMPARE — Side-by-side comparison\n"
                f"##CLOSE — Summary or call to action\n\n"
                f"── RULES ──\n"
                f"- VARY the types across {num_slides} slides. Don't use CONTENT for every slide.\n"
                f"- First slide should be TITLE. Last slide should be CLOSE.\n"
                f"- Use SECTION between major topic transitions.\n"
                f"- Use DATA when a statistic or number is the star of the slide.\n"
                f"- DISPLAY: concise, scannable, presentation-ready markdown.\n"
                f"- SPEECH: conversational narration covering the same key points in more detail.\n"
                f"- Speech can rephrase, expand, or explain — it does NOT need to match display verbatim.\n"
                f"- Use `---` to separate slides.\n"
                f"- Use {lang} for all content.\n"
            )

            if background.strip():
                prompt += f"\n── BACKGROUND / STRATEGIC CONTEXT ──\n{background}\n\n"

            prompt += f"\n── OUTLINE ──\n{outline}\n\n"

            prompt += (
                f"EXAMPLE OUTPUT (2 slides):\n"
                f"##TITLE\n## Q2 Progress Report\nKey achievements and roadmap update\n\n"
                f"===SPEECH===\nGood morning, CTO. Let me walk you through our Q2 progress...\n\n"
                f"---\n\n"
                f"##DATA\n## Revenue Growth\n**32%** increase in MRR\n- Exceeded target by 8%\n- $2.4M new ARR added\n\n"
                f"===SPEECH===\nLet's start with the numbers. Our revenue grew 32% this quarter...\n"
            )

            model_id = _get_model_for_session("work_report_session")
            info = MODEL_CATALOG.get(model_id)

            if not info:
                return {"slides": [{"display": outline, "speech": outline}]}

            if info.get("backend") == "openai":
                client = get_openai_client(model_id)
                if not client:
                    return {"slides": [{"display": outline, "speech": outline}]}
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
                except Exception as exc:
                    logger.error("Work report slide gen error: %s", exc, exc_info=True)
                    return {"slides": [{"display": outline, "speech": outline}], "error": str(exc)}
            else:
                # ADK (Gemini) route
                runner = _get_adk_runner(model_id)
                svc = _get_adk_session_service(model_id)
                if not runner or not svc:
                    return {"slides": [{"display": outline, "speech": outline}]}
                try:
                    await svc.create_session(
                        app_name="digital_human",
                        user_id="default_user",
                        session_id="work_report_session",
                    )
                except Exception:
                    pass
                new_msg = types.Content(role="user", parts=[types.Part(text=prompt)])
                events = []
                async for event in runner.run_async(
                    user_id="default_user",
                    session_id="work_report_session",
                    new_message=new_msg,
                ):
                    events.append(event)
                reply = ""
                for e in reversed(events):
                    if e.author != "user" and e.content and e.content.parts and not e.partial:
                        reply = e.content.parts[0].text or ""
                        break

            # Parse slides using the same logic as _parse_slides
            if not reply.strip():
                return {"slides": [{"display": outline, "speech": outline}]}
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

        except Exception as exc:
            logger.error("Work report slide gen error: %s", exc, exc_info=True)
            return {"slides": [{"display": outline, "speech": outline}], "error": str(exc)}

    @app.post("/api/work-report/download-html-presentation")
    async def download_html_presentation(
        slides_json: str = Form(...),
        title: str = Form("Work Report"),
    ):
        """Generate and return a self-contained interactive HTML presentation file.
        Follows the interactive-explainer-video-html format (htmlslide.md).
        Each slide becomes a scene with Web Speech API narration + controls.
        """
        try:
            import json
            slides = json.loads(slides_json)
            html = _build_html_presentation(slides, title)
            # Write to temp file and return as download
            import tempfile
            fd, path = tempfile.mkstemp(suffix=".html", prefix="presentation_")
            with os.fdopen(fd, "w", encoding="utf-8") as f:
                f.write(html)
            return FileResponse(
                path,
                media_type="text/html",
                filename=f"{title.lower().replace(' ', '-')}-presentation.html",
                headers={"Content-Disposition": f'attachment; filename="{title.lower().replace(" ", "-")}-presentation.html"'},
            )
        except Exception as exc:
            logger.error("HTML presentation gen error: %s", exc, exc_info=True)
            return JSONResponse({"error": str(exc)}, status_code=500)

    # ── Toastmaster (演讲训练) ────────────────────────────────────────────
    _toastmaster_topics_cache: list[str] | None = None

    async def _get_toastmaster_topics() -> list[str]:
        """Generate a diverse set of Table Topics topics using the AI model."""
        nonlocal _toastmaster_topics_cache
        if _toastmaster_topics_cache:
            return _toastmaster_topics_cache

        prompt = (
            "Generate 30 diverse Table Topics® style impromptu speaking prompts in English. "
            "These are used for Toastmasters speech training. "
            "Mix of:\n"
            "- Personal reflection (e.g., 'Describe a moment that changed your perspective')\n"
            "- Opinion/debate (e.g., 'Is technology making us more or less connected?')\n"
            "- Storytelling (e.g., 'Tell us about a time you failed and what you learned')\n"
            "- Abstract/creative (e.g., 'If you could have dinner with any historical figure, who would it be?')\n"
            "- Problem-solving (e.g., 'If you were mayor for a day, what would you change?')\n\n"
            "Return ONLY a JSON array of 30 strings, no other text.\n"
            'Example: ["Topic one", "Topic two", "Topic three"]'
        )

        model_id = _get_model_for_session("toastmaster_session")
        info = MODEL_CATALOG.get(model_id)

        if not info:
            # Fallback topics
            _toastmaster_topics_cache = [
                "Describe a moment that changed your perspective on life.",
                "What is the best piece of advice you've ever received?",
                "If you could travel anywhere tomorrow, where would you go and why?",
                "Is technology making us more or less connected?",
                "Tell us about a time you failed and what you learned.",
                "What does leadership mean to you?",
                "If you could have dinner with any historical figure, who would it be?",
                "What is the most important skill for the 21st century?",
                "Describe your ideal day — what does it look like?",
                "If you were mayor for a day, what would you change?",
                "What book or movie has influenced you the most?",
                "Is social media a net positive or negative for society?",
                "Tell us about a person who has inspired you.",
                "What is something you believe that most people disagree with?",
                "If you could solve one global problem, what would it be?",
                "What does success mean to you?",
                "Describe a cultural tradition you love.",
                "What is the biggest challenge facing your generation?",
                "If you could master any skill instantly, what would it be?",
                "What is the role of artificial intelligence in our future?",
                "Tell us about a small act of kindness that made a big impact.",
                "What is the biggest lesson you've learned from a mistake?",
                "If you could relive one day in your life, which would it be?",
                "What does work-life balance mean in today's world?",
                "Describe a time you had to step out of your comfort zone.",
                "What is the most underrated quality in a person?",
                "If you could invent something to make the world better, what would it be?",
                "What is a goal you're currently working toward?",
                "How do you stay motivated when things get difficult?",
                "What does 'living a good life' mean to you?",
            ]
            return _toastmaster_topics_cache

        if info.get("backend") == "openai":
            client = get_openai_client(model_id)
            if client:
                try:
                    resp = await asyncio.wait_for(
                        asyncio.to_thread(
                            client.chat.completions.create,
                            model=info["model"],
                            messages=[{"role": "user", "content": prompt}],
                            temperature=0.8,
                            max_tokens=1000,
                        ),
                        timeout=30,
                    )
                    text = resp.choices[0].message.content or ""
                    import json as _json
                    try:
                        topics = _json.loads(text)
                        if isinstance(topics, list) and len(topics) >= 10:
                            _toastmaster_topics_cache = topics[:30]
                            return _toastmaster_topics_cache
                    except (_json.JSONDecodeError, TypeError):
                        pass
                except Exception:
                    pass

        # Fallback
        _toastmaster_topics_cache = [
            "Describe a moment that changed your perspective on life.",
            "What is the best piece of advice you've ever received?",
            "If you could travel anywhere tomorrow, where would you go and why?",
            "Is technology making us more or less connected?",
            "Tell us about a time you failed and what you learned.",
            "What does leadership mean to you?",
            "If you could have dinner with any historical figure, who would it be?",
            "What is the most important skill for the 21st century?",
            "Describe your ideal day — what does it look like?",
            "If you were mayor for a day, what would you change?",
        ]
        return _toastmaster_topics_cache

    @app.post("/api/toastmaster/topic")
    async def toastmaster_topic(
        language: str = Form("en"),
        used_topics_json: str = Form("[]"),
    ):
        """Get a random Table Topics topic."""
        import json as _json
        import random
        try:
            used_topics: list = _json.loads(used_topics_json)
        except (_json.JSONDecodeError, TypeError):
            used_topics = []

        topics = await _get_toastmaster_topics()
        # Filter out used topics; if all used, reset
        available = [t for t in topics if t not in used_topics]
        if not available:
            available = topics
            used_topics = []

        topic = random.choice(available)
        return {"topic": topic, "topic_id": topics.index(topic)}

    @app.post("/api/toastmaster/evaluate")
    async def toastmaster_evaluate(
        mode: str = Form("table_topics"),
        topic: str = Form(""),
        speech_text: str = Form(""),
        duration_seconds: int = Form(0),
        language: str = Form("en"),
        round_number: int = Form(1),
    ):
        """Evaluate a Toastmasters speech (Table Topics or prepared speech).

        Returns structured evaluation with scores, strengths, and recommendations.
        """
        lang_label = "Chinese" if language.split("-")[0] in ("zh", "cmn") else "English"

        if mode == "table_topics":
            prompt = (
                f"You are a Toastmasters speech evaluator. A member has just completed "
                f"a Table Topics® impromptu speech. Evaluate their performance.\n\n"
                f"Topic: \"{topic}\"\n"
                f"Speaking time: {duration_seconds} seconds\n"
                f"Speech: \"{speech_text}\"\n\n"
                f"── EVALUATION CRITERIA (score each 1-10) ──\n"
                f"1. Content (内容): Relevance to topic, quality of ideas, examples used\n"
                f"2. Organization (结构): Clear opening/body/close, logical flow\n"
                f"3. Delivery (表达): Confidence, vocal variety, pacing, enthusiasm\n"
                f"4. Language (语言): Word choice, grammar, vocabulary range\n"
                f"5. Overall Impact (整体效果): How compelling was the speech overall?\n\n"
                f"── OUTPUT FORMAT (return valid JSON only) ──\n"
                f"{{\n"
                f'  "scores": {{"content": N, "organization": N, "delivery": N, "language": N, "overall_impact": N}},\n'
                f'  "total_score": N,\n'
                f'  "strengths": ["Strength 1", "Strength 2"],\n'
                f'  "improvements": ["Area 1", "Area 2"],\n'
                f'  "recommendations": ["Specific recommendation 1", "Specific recommendation 2"],\n'
                f'  "general_comment": "2-3 sentence summary of the evaluation"\n'
                f"}}\n\n"
                f"Use {lang_label} for all text fields (strengths, improvements, recommendations, comment). "
                f"Scores are always numbers 1-10. Return ONLY valid JSON."
            )
        else:
            # Prepared speech evaluation
            prompt = (
                f"You are a Toastmasters speech evaluator. A member has submitted "
                f"a prepared speech for evaluation.\n\n"
                f"Speech title/topic: \"{topic}\"\n"
                f"Speech text: \"{speech_text}\"\n\n"
                f"── EVALUATION CRITERIA (score each 1-10) ──\n"
                f"1. Content (内容): Substance, research, examples, clarity of message\n"
                f"2. Organization (结构): Structure, transitions, logical flow\n"
                f"3. Delivery (表达): Would it be engaging to listen to? Vocal potential\n"
                f"4. Language (语言): Rhetorical devices, word choice, imagery\n"
                f"5. Overall Impact (整体效果): Would this speech leave a lasting impression?\n\n"
                f"── OUTPUT FORMAT (return valid JSON only) ──\n"
                f"{{\n"
                f'  "scores": {{"content": N, "organization": N, "delivery": N, "language": N, "overall_impact": N}},\n'
                f'  "total_score": N,\n'
                f'  "strengths": ["Strength 1", "Strength 2"],\n'
                f'  "improvements": ["Area 1", "Area 2"],\n'
                f'  "recommendations": ["Specific recommendation 1", "Specific recommendation 2"],\n'
                f'  "general_comment": "2-3 sentence summary of the evaluation"\n'
                f"}}\n\n"
                f"Use {lang_label} for all text fields. Scores are always numbers 1-10. Return ONLY valid JSON."
            )

        model_id = _get_model_for_session("toastmaster_session")
        info = MODEL_CATALOG.get(model_id)

        if not info:
            return {"error": "No model selected. Please select a model in Settings."}

        import json as _json

        default_result = {
            "scores": {"content": 7, "organization": 7, "delivery": 7, "language": 7, "overall_impact": 7},
            "total_score": 35,
            "strengths": ["Good effort!"],
            "improvements": ["Keep practicing"],
            "recommendations": ["Practice with a timer", "Record yourself"],
            "general_comment": "Keep up the good work!",
        }

        if info.get("backend") == "openai":
            client = get_openai_client(model_id)
            if not client:
                return default_result
            try:
                resp = await asyncio.wait_for(
                    asyncio.to_thread(
                        client.chat.completions.create,
                        model=info["model"],
                        messages=[{"role": "user", "content": prompt}],
                        temperature=0.5,
                        max_tokens=800,
                    ),
                    timeout=60,
                )
                text = resp.choices[0].message.content or ""
                # Try to extract JSON from the response
                _json_match = _json.loads(text) if text.strip() else default_result
                if isinstance(_json_match, dict) and "scores" in _json_match and "strengths" in _json_match:
                    return _json_match
                return default_result
            except (_json.JSONDecodeError, Exception):
                try:
                    # Try to find JSON in the response
                    import re as _re
                    match = _re.search(r'\{.*"scores".*\}', text, _re.DOTALL)
                    if match:
                        return _json.loads(match.group())
                except Exception:
                    pass
                return default_result
        else:
            # ADK (Gemini) route
            runner = _get_adk_runner(model_id)
            svc = _get_adk_session_service(model_id)
            if not runner or not svc:
                return default_result
            try:
                await svc.create_session(
                    app_name="digital_human",
                    user_id="default_user",
                    session_id="toastmaster_session",
                )
            except Exception:
                pass
            try:
                new_msg = types.Content(role="user", parts=[types.Part(text=prompt)])
                events = []
                async for event in runner.run_async(
                    user_id="default_user",
                    session_id="toastmaster_session",
                    new_message=new_msg,
                ):
                    events.append(event)
                text = ""
                for e in reversed(events):
                    if e.author != "user" and e.content and e.content.parts and not e.partial:
                        text = e.content.parts[0].text or ""
                        break
                try:
                    if text.strip():
                        return _json.loads(text)
                except (_json.JSONDecodeError, TypeError):
                    import re as _re
                    match = _re.search(r'\{.*"scores".*\}', text, _re.DOTALL)
                    if match:
                        try:
                            return _json.loads(match.group())
                        except Exception:
                            pass
                return default_result
            except Exception:
                return default_result

    # ── Team Retro Perspective (팀 회고) ─────────────────────────────────
    _retro_sessions: dict[str, dict] = {}

    def _get_retro_session(session_id: str) -> dict:
        """Get or create a retro session."""
        if session_id not in _retro_sessions:
            _retro_sessions[session_id] = {
                "name": "Team Retro",
                "participants": [],
                "votes_per_person": 5,
                "cards": [],
                "card_id_counter": 1,
            }
        return _retro_sessions[session_id]

    @app.post("/api/team-retro/config")
    async def team_retro_config(
        session_id: str = Form("default"),
        name: str = Form("Team Retro"),
        participants_json: str = Form("[]"),
        votes_per_person: int = Form(5),
    ):
        """Create or update a retro session configuration."""
        import json
        try:
            participants: list = json.loads(participants_json)
        except (json.JSONDecodeError, TypeError):
            participants = []
        session = _get_retro_session(session_id)
        session["name"] = name
        session["participants"] = participants
        session["votes_per_person"] = votes_per_person
        return {"status": "ok", "session_id": session_id}

    @app.post("/api/team-retro/submit")
    async def team_retro_submit(
        session_id: str = Form("default"),
        title: str = Form(""),
        description: str = Form(""),
        category: str = Form("improvement"),
        author: str = Form("Anonymous"),
    ):
        """Submit a new retro card."""
        if not title.strip():
            return {"status": "error", "error": "Title is required"}
        session = _get_retro_session(session_id)
        card_id = session["card_id_counter"]
        session["card_id_counter"] += 1
        card = {
            "id": card_id,
            "title": title.strip(),
            "description": description.strip(),
            "category": category,
            "author": author.strip() or "Anonymous",
            "status": "new",
            "votes": 0,
            "voters": [],
            "created_at": int(__import__("time").time() * 1000),
        }
        session["cards"].append(card)
        return {"status": "ok", "card": card}

    @app.post("/api/team-retro/vote")
    async def team_retro_vote(
        session_id: str = Form("default"),
        card_id: int = Form(0),
        voter: str = Form("Anonymous"),
    ):
        """Toggle a vote on a card. Returns updated card."""
        session = _get_retro_session(session_id)
        card = next((c for c in session["cards"] if c["id"] == card_id), None)
        if not card:
            return {"status": "error", "error": "Card not found"}

        votes_per_person = session["votes_per_person"]

        if voter in card["voters"]:
            # Unvote
            card["voters"].remove(voter)
            card["votes"] = len(card["voters"])
        else:
            # Check voter hasn't exceeded votes_per_person
            total_votes = sum(1 for c in session["cards"] if voter in c["voters"])
            if total_votes >= votes_per_person:
                return {
                    "status": "error",
                    "error": f"Maximum {votes_per_person} votes per person",
                    "max_votes": votes_per_person,
                }
            card["voters"].append(voter)
            card["votes"] = len(card["voters"])

        # Return sorted cards (by votes desc)
        sorted_cards = sorted(session["cards"], key=lambda c: c["votes"], reverse=True)
        return {"status": "ok", "card": card, "cards": sorted_cards}

    @app.post("/api/team-retro/update-status")
    async def team_retro_update_status(
        session_id: str = Form("default"),
        card_id: int = Form(0),
        status: str = Form("new"),
    ):
        """Update a card's status."""
        VALID_STATUSES = {"new", "under-review", "approved", "in-progress", "done", "declined"}
        if status not in VALID_STATUSES:
            return {"status": "error", "error": f"Invalid status: {status}"}
        session = _get_retro_session(session_id)
        card = next((c for c in session["cards"] if c["id"] == card_id), None)
        if not card:
            return {"status": "error", "error": "Card not found"}
        card["status"] = status
        return {"status": "ok", "card": card}

    @app.get("/api/team-retro/data")
    async def team_retro_data(
        session_id: str = "default",
    ):
        """Get all retro session data."""
        session = _get_retro_session(session_id)
        sorted_cards = sorted(session["cards"], key=lambda c: c["votes"], reverse=True)
        return {
            "name": session["name"],
            "participants": session["participants"],
            "votes_per_person": session["votes_per_person"],
            "cards": sorted_cards,
        }

    @app.post("/api/team-retro/summarize")
    async def team_retro_summarize(
        session_id: str = Form("default"),
        language: str = Form("en"),
    ):
        """AI generates a structured retro summary from all cards."""
        session = _get_retro_session(session_id)
        cards = session["cards"]
        if not cards:
            return {"summary": "No cards to summarize.", "markdown": "# Team Retro Summary\n\nNo items were submitted."}

        lang_label = "Chinese" if language.split("-")[0] in ("zh", "cmn") else "English"

        # Group cards by category
        cats = {}
        for c in cards:
            cat = c.get("category", "other")
            cats.setdefault(cat, []).append(c)

        cards_text = ""
        for cat, items in cats.items():
            cards_text += f"\n## {cat.upper()}\n"
            for c in items:
                status_emoji = {"new": "🆕", "under-review": "🔍", "approved": "✅", "in-progress": "🚧", "done": "✅", "declined": "❌"}
                se = status_emoji.get(c.get("status", "new"), "🆕")
                cards_text += f"- [{se}] \"{c['title']}\" (by {c['author']}, 👍{c['votes']})\n"
                if c.get("description"):
                    cards_text += f"  > {c['description']}\n"

        prompt = (
            f"You are a facilitator helping a team review their retrospective data.\n\n"
            f"── RETRO DATA ──\n"
            f"Session: {session['name']}\n"
            f"Participants: {', '.join(session['participants']) if session['participants'] else 'N/A'}\n"
            f"Total cards: {len(cards)}\n"
            f"{cards_text}\n\n"
            f"── OUTPUT (use {lang_label}) ──\n"
            f"Generate a structured retro summary with:\n"
            f"1. Overview: 2-3 sentence summary of the retro\n"
            f"2. Key Themes: Group cards into 2-4 themes/topics, list which cards belong to each\n"
            f"3. Top Priorities: Top 3 highest-voted items with explanation\n"
            f"4. Action Items: 3-5 concrete action items the team should take\n"
            f"5. Mood/Vibe: Quick read on team sentiment\n\n"
            f"Return as markdown with ## headings."
        )

        model_id = _get_model_for_session("team_retro_session")
        info = MODEL_CATALOG.get(model_id)

        default_summary = "# Team Retro Summary\n\n## Overview\nA retrospective session was held with feedback collected from the team.\n\n## Cards\n" + "\n".join(f"- [{c.get('status','new')}] {c['title']} (👍{c['votes']})" for c in cards)

        if info and info.get("backend") == "openai":
            client = get_openai_client(model_id)
            if client:
                try:
                    resp = client.chat.completions.create(
                        model=info["model"],
                        messages=[{"role": "user", "content": prompt}],
                        temperature=0.5,
                        max_tokens=1000,
                    )
                    text = resp.choices[0].message.content or default_summary
                    return {"summary": text, "markdown": text}
                except Exception as exc:
                    logger.error("Retro summarize error: %s", exc)
                    return {"summary": default_summary, "markdown": default_summary}

        # ADK route
        if info:
            runner = _get_adk_runner(model_id)
            svc = _get_adk_session_service(model_id)
            if runner and svc:
                try:
                    await svc.create_session(
                        app_name="digital_human",
                        user_id="default_user",
                        session_id="team_retro_session",
                    )
                except Exception:
                    pass
                try:
                    new_msg = types.Content(role="user", parts=[types.Part(text=prompt)])
                    events = []
                    async for event in runner.run_async(
                        user_id="default_user",
                        session_id="team_retro_session",
                        new_message=new_msg,
                    ):
                        events.append(event)
                    text = ""
                    for e in reversed(events):
                        if e.author != "user" and e.content and e.content.parts and not e.partial:
                            text = e.content.parts[0].text or ""
                            break
                    if text:
                        return {"summary": text, "markdown": text}
                except Exception:
                    pass

        return {"summary": default_summary, "markdown": default_summary}

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
