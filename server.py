"""
Digital Human Server - built on ADK's built-in web server with custom TTS and chat endpoints.

Usage:
    python server.py
"""

import os, sys, asyncio, logging
from pathlib import Path

AGENTS_DIR = str(Path(__file__).parent / "agents")
sys.path.insert(0, AGENTS_DIR)

from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, Form, BackgroundTasks
from fastapi.responses import FileResponse, JSONResponse

from google.adk.cli.fast_api import get_fast_api_app
from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from google.genai import types

from agents.digital_human import root_agent
from audio.tts import synthesize, list_voices, periodic_cleanup, clear_old_cache

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("digital-human.server")


def create_app() -> FastAPI:
    """Create ADK web server with custom TTS, voice catalog, and chat endpoints."""

    # 1. ADK built-in server
    app = get_fast_api_app(
        agents_dir=AGENTS_DIR,
        web=True,
        allow_origins=["*"],
        auto_create_session=True,
    )

    # 2. Simplified chat endpoint
    _session_service = InMemorySessionService()
    _runner = Runner(
        app_name="digital_human",
        agent=root_agent,
        session_service=_session_service,
    )

    # Track which sessions have already received the character name injection
    # to avoid running a full agent cycle for it on every message.
    _configured_sessions: set[str] = set()

    @app.post("/chat")
    async def chat(
        text: str = Form(...),
        session_id: str = Form("default"),
        character_name: str = Form("Xiao Wei"),
        personality: str = Form(""),
    ):
        """POST form: text=hello → {"reply": "Hi! I'm Xiao Wei~"}"""
        try:
            # Ensure session exists before running
            try:
                await _session_service.create_session(
                    app_name="digital_human",
                    user_id="default_user",
                    session_id=session_id,
                )
            except Exception:
                pass  # session may already exist

            if session_id not in _configured_sessions:
                _configured_sessions.add(session_id)
                name_msg = f'[System: Your name is "{character_name}". Introduce yourself as {character_name} if asked.]'
                if personality:
                    name_msg += f"\n[Personality: {personality}]"
                char_msg = types.Content(
                    role="user",
                    parts=[types.Part(text=name_msg)]
                )
                async for _ in _runner.run_async(
                    user_id="default_user",
                    session_id=session_id,
                    new_message=char_msg,
                ):
                    pass

            new_msg = types.Content(role="user", parts=[types.Part(text=text)])
            events = []
            async for event in _runner.run_async(
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

        except Exception as exc:
            logger.error("Chat error: %s", exc, exc_info=True)
            return {"reply": f"(Error: Sorry, something went wrong — {exc})"}

    # 3. Voice catalog API (already cached in audio/tts.py module)
    @app.get("/api/voices")
    async def get_voices():
        """Return available TTS voices with locale, gender, and popular names."""
        return JSONResponse(list_voices())

    # 4. Text-to-Speech with BackgroundTasks cleanup
    @app.post("/audio/tts")
    async def text_to_speech(
        text: str = Form(...),
        language: str = Form("en"),
        voice: str = Form(""),
        background_tasks: BackgroundTasks = None,
    ):
        path = await synthesize(text, language, voice or None)
        # Schedule file deletion after the response is sent
        if background_tasks:
            background_tasks.add_task(os.remove, path)
        return FileResponse(path, media_type="audio/mpeg", filename="speech.mp3")

    # 5. Slide generation endpoint - AI-powered script-to-slides
    @app.post("/generate-slides")
    async def generate_slides(
        script: str = Form(...),
        num_slides: int = Form(5),
        language: str = Form("en"),
    ):
        """Send a raw script to the ADK agent for AI slide generation."""
        try:
            prompt = (
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
                f"- Use {'English' if language == 'en' else 'Chinese'} for all content.\n\n"
                f"RAW SCRIPT:\n{script}\n\n"
                f"OUTPUT FORMAT (exactly):\n"
                f"## Slide 1 Title\nDisplay content here...\n\n===SPEECH===\nFull speech narration for slide 1...\n\n---\n\n"
                f"## Slide 2 Title\nDisplay content...\n\n===SPEECH===\nSpeech for slide 2...\n"
            )

            new_msg = types.Content(role="user", parts=[types.Part(text=prompt)])
            # Ensure session exists for slide generation
            try:
                await _session_service.create_session(
                    app_name="digital_human",
                    user_id="default_user",
                    session_id="slide_generation_session",
                )
            except Exception:
                pass
            events = []
            async for event in _runner.run_async(
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

            if not reply.strip():
                return {"slides": [{"display": script, "speech": script}]}

            # Parse slides from the markdown reply
            raw_slides = [s.strip() for s in reply.split("---") if s.strip()]
            slides = []
            for slide_text in raw_slides:
                if "===SPEECH===" in slide_text:
                    parts = slide_text.split("===SPEECH===", 1)
                    display = parts[0].strip()
                    speech = parts[1].strip()
                else:
                    display = slide_text
                    speech = slide_text  # fallback
                slides.append({"display": display, "speech": speech})

            if not slides:
                slides = [{"display": reply.strip(), "speech": reply.strip()}]

            return {"slides": slides}

        except Exception as exc:
            logger.error("Slide generation error: %s", exc, exc_info=True)
            return {"slides": [{"display": script, "speech": script}], "error": str(exc)}

    # 6. Startup: clean stale files + start periodic cleanup
    @app.on_event("startup")
    async def startup():
        clear_old_cache(max_age_seconds=3600)
        asyncio.create_task(periodic_cleanup(interval=600))

    return app


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    host = os.getenv("HOST", "0.0.0.0")
    app = create_app()
    print(f"🚀 ADK Digital Human: http://{host}:{port}")
    print(f"💬 Chat:        POST /chat              (form: text=...)")
    print(f"🔊 TTS:         POST /audio/tts         (form: text+language+voice)")
    print(f"🎙 Voice:       GET  /api/voices         (voice catalog)")
    print(f"📊 Slides:      POST /generate-slides    (form: script+language+num_slides)")
    print(f"🖥️  Web UI:     http://{host}:{port}     (ADK Web UI)")
    uvicorn.run(app, host=host, port=port)
