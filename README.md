# ADK Digital Human — Live2D Avatar Chatbot

A digital human application built on **Google ADK 1.x** with a Live2D avatar frontend.

Start the backend with one command; the Live2D frontend renders the avatar.

## Architecture

```
┌─ Frontend (Next.js + Live2D) ────────────────────────┐
│  Custom:       POST /chat          → conversation    │
│  Custom:       POST /audio/stt     → speech-to-text  │
│  Custom:       POST /audio/tts     → text-to-speech  │
└──────────────────┬────────────────────────────────────┘
                   │
┌─ Backend (ADK built-in FastAPI server) ──────────────┐
│  ADK Web Server (google.adk.cli.fast_api)             │
│    → /run, /run_sse, /run_live (WebSocket)            │
│    → Session management, tool calling, streaming      │
│    → ADK Web debug UI (Angular)                       │
│  + Custom /chat, /audio/stt, /audio/tts endpoints     │
│  + .env for API keys                                  │
└───────────────────────────────────────────────────────┘
```

## Quick Start

```bash
# 1. Backend
cd digital-human-adk
cp .env.example .env   # Set GOOGLE_API_KEY
pip install google-adk python-dotenv uvicorn fastapi
python server.py       # → http://localhost:8000

# 2. Frontend (another terminal)
cd frontend
npm install
npm run dev            # → http://localhost:3000
```

## API Endpoints

| Method | Path | Description |
|---|---|---|
| POST | `/chat` | Send text, get AI reply (form: text=...) |
| POST | `/audio/stt` | Upload audio, get transcript (form: file+language) |
| POST | `/audio/tts` | Send text, get audio file (form: text+language) |
| POST | `/run` | ADK native agent execution API |
| GET  | `/` | ADK Web debug UI |

## Project Structure

```
digital-human-adk/
├── agents/
│   ├── digital_human.py    ← ADK Agent (root_agent)
│   └── tools.py            ← Custom tools (memory, etc.)
├── audio/
│   ├── stt.py              ← Speech-to-text (Google/Whisper)
│   └── tts.py              ← Text-to-speech (Google/OpenAI/Edge)
├── server.py               ← ADK server + custom endpoints
├── frontend/               ← Live2D Next.js frontend
│   ├── src/pages/
│   │   ├── index.tsx
│   │   ├── services/adk-assistant.service.ts
│   │   ├── hooks/useVoiceAssistant.hook.tsx
│   │   └── context/VoiceAssistantProvider.js
│   ├── public/
│   │   ├── library/        ← Live2D SDK
│   │   └── shizuku_model/  ← Live2D character model
│   └── package.json
├── requirements.txt
└── .env.example
```

## TTS Providers

Switch TTS by setting `TTS_PROVIDER` in `.env`:

- `google` — Google Cloud Text-to-Speech (default, needs credentials)
- `openai` — OpenAI TTS (needs OPENAI_API_KEY)
- `edge` — Microsoft Edge TTS (free, no API key needed)

## STT Providers

- `google` — Google Cloud Speech-to-Text (default)
- `whisper` — OpenAI Whisper (needs OPENAI_API_KEY)
