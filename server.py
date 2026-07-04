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
    ):
        """POST form: text=hello → {"reply": "Hi! I'm Xiao Wei~"}"""
        try:
            # Only inject character name once per session (optimization:
            # avoids running a full Gemini cycle on every single message)
            if session_id not in _configured_sessions:
                _configured_sessions.add(session_id)
                char_msg = types.Content(
                    role="user",
                    parts=[types.Part(
                        text=f'[System: Your name is "{character_name}". '
                             f'Introduce yourself as {character_name} if asked.]'
                    )]
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

    # 5. Startup: clean stale files + start periodic cleanup
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
    print(f"💬 Chat:  POST /chat           (form: text=...)")
    print(f"🔊 TTS:   POST /audio/tts      (form: text+language+voice)")
    print(f"🎙 Voice: GET  /api/voices       (voice catalog)")
    print(f"🖥️  Web:  http://{host}:{port}             (ADK Web UI)")
    uvicorn.run(app, host=host, port=port)
