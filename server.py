"""
Digital Human Server — built on ADK's built-in web server with custom STT/TTS and chat endpoints.

Usage:
    python server.py
"""

import os, sys
from pathlib import Path

AGENTS_DIR = str(Path(__file__).parent / "agents")
sys.path.insert(0, AGENTS_DIR)

from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, UploadFile, File, Form
from fastapi.responses import FileResponse

from google.adk.cli.fast_api import get_fast_api_app
from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from google.genai import types

from agents.digital_human import root_agent
from audio.stt import transcribe_audio
from audio.tts import synthesize


def create_app() -> FastAPI:
    """Create ADK web server with custom STT/TTS and chat endpoints."""

    # 1. ADK built-in server (Web UI, /run, /run_sse, WebSocket, session mgmt)
    app = get_fast_api_app(
        agents_dir=AGENTS_DIR,
        web=True,
        allow_origins=["*"],
        auto_create_session=True,
    )

    # 2. Simplified chat endpoint (text in, text out)
    _session_service = InMemorySessionService()
    _runner = Runner(
        app_name="digital_human",
        agent=root_agent,
        session_service=_session_service,
    )

    @app.post("/chat")
    async def chat(text: str = Form(...), session_id: str = Form("default")):
        """POST form: text=hello → {"reply": "Hi! I'm Xiao Wei~"}"""
        new_msg = types.Content(role="user", parts=[types.Part(text=text)])
        events = []
        async for event in _runner.run_async(
            user_id="default_user",
            session_id=session_id,
            new_message=new_msg,
        ):
            events.append(event)
        # Extract the last non-user, non-partial text event
        reply = ""
        for e in reversed(events):
            if e.author != "user" and e.content and e.content.parts and not e.partial:
                reply = e.content.parts[0].text or ""
                break
        return {"reply": reply}

    # 3. Speech-to-Text
    @app.post("/audio/stt")
    async def speech_to_text(file: UploadFile = File(...), language: str = Form("en")):
        audio_bytes = await file.read()
        text = await transcribe_audio(audio_bytes, language)
        return {"text": text}

    # 4. Text-to-Speech
    @app.post("/audio/tts")
    async def text_to_speech(text: str = Form(...), language: str = Form("en")):
        path = await synthesize(text, language)
        return FileResponse(path, media_type="audio/mpeg", filename="speech.mp3")

    return app


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    host = os.getenv("HOST", "0.0.0.0")
    app = create_app()
    print(f"🚀 ADK Digital Human: http://{host}:{port}")
    print(f"💬 Chat: POST /chat           (form: text=...)")
    print(f"🎤 STT:  POST /audio/stt      (form: file+language)")
    print(f"🔊 TTS:  POST /audio/tts      (form: text+language)")
    print(f"🖥️  Web:  http://{host}:{port}            (ADK Web UI)")
    uvicorn.run(app, host=host, port=port)
