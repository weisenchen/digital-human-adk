# ADK Digital Human — Live2D Avatar Chatbot

A digital human application built on **Google ADK 1.x** with a Live2D avatar frontend.

A digital human application built on **Google ADK 1.x** with a Live2D avatar frontend.

Start the backend, then open the Live2D frontend to chat with a cute animated digital human.

## ⚡ Quickest Start (5 minutes)

```bash
# Prerequisites
git clone https://github.com/weisenchen/digital-human-adk.git
cd digital-human-adk

# 1. Backend
cp .env.example .env        # Edit .env later; for quick test use defaults below
pip install -r requirements.txt   # Install all deps
python server.py             # → http://localhost:8000

# 2. Frontend (another terminal, requires Node.js 18+)
cd frontend
npm install
npm run dev                  # → http://localhost:3000
```

> **First run?** The backend uses `gemini-2.5-flash` as the AI brain. Set your Gemini API key in `.env`:
> ```
> GOOGLE_API_KEY=your_gemini_api_key_here
> ```
> Get a free key at [aistudio.google.com](https://aistudio.google.com).

## 🚀 Quick Start (Detailed)

### Backend Setup

```bash
cd digital-human-adk
cp .env.example .env
```

Edit `.env` — **you only need `GOOGLE_API_KEY`** to get started:

```ini
# Required: Gemini API key (get at https://aistudio.google.com)
GOOGLE_API_KEY=your_gemini_api_key_here

# Optional: TTS / STT provider
#   edge       — Edge TTS (free, no API key) ← recommended for first run
#   google     — Google Cloud TTS/STT (needs GCP service account)
#   openai     — OpenAI TTS/API key
#   whisper    — OpenAI Whisper STT (needs OPENAI_API_KEY)
TTS_PROVIDER=edge
STT_PROVIDER=whisper
OPENAI_API_KEY=sk-...   # only if using whisper/openai
```

> **Need quick voice without API keys?** Set `TTS_PROVIDER=edge` (free, zero config) and uncomment `edge-tts` in `requirements.txt` then reinstall.
>
> **Google Cloud STT/TTS** need a GCP service account key (`GOOGLE_APPLICATION_CREDENTIALS`), which is separate from `GOOGLE_API_KEY` (Gemini).

```bash
pip install -r requirements.txt
python server.py   # → http://localhost:8000
```

### Frontend Setup (another terminal)

```bash
cd frontend
npm install        # Requires Node.js 18+
npm run dev        # → http://localhost:3000
```

Open `http://localhost:3000` — the Live2D avatar appears and you can chat via text or voice!

## Architecture

```text
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
│  + .env for API keys / provider config                │
└───────────────────────────────────────────────────────┘
```

## API Endpoints

| Method | Path | Description |
|---|---|---|
| POST | `/chat` | Send text, get AI reply (form: text=...) |
| POST | `/audio/stt` | Upload audio, get transcript (form: file+language) |
| POST | `/audio/tts` | Send text, get audio file (form: text+language) |
| POST | `/run` | ADK native agent execution API |
| GET  | `/` | ADK Web debug UI |

## TTS Providers

| Provider | API Key Needed | Config |
|---|---|---|
| `edge` | ❌ Free | `TTS_PROVIDER=edge` (fastest to start) |
| `google` | ✅ GCP credentials | Needs `GOOGLE_APPLICATION_CREDENTIALS` |
| `openai` | ✅ OPENAI_API_KEY | `TTS_PROVIDER=openai` |

## STT Providers

| Provider | API Key Needed | Config |
|---|---|---|
| `whisper` | ✅ OPENAI_API_KEY | `STT_PROVIDER=whisper` |
| `google` | ✅ GCP credentials | Needs `GOOGLE_APPLICATION_CREDENTIALS` |

## Project Structure

```text
digital-human-adk/
├── agents/
│   ├── digital_human.py      ← ADK Agent ("Xiao Wei", Gemini 2.5 Flash)
│   └── tools.py              ← Custom tools (in-memory memory, etc.)
├── audio/
│   ├── stt.py                ← Speech-to-text (Google / Whisper)
│   └── tts.py                ← Text-to-speech (Google / OpenAI / Edge)
├── server.py                 ← ADK server + custom /chat, /audio/* endpoints
├── frontend/                 ← Next.js + Live2D frontend
│   ├── src/pages/
│   │   ├── index.tsx
│   │   ├── services/adk-assistant.service.ts
│   │   ├── hooks/useVoiceAssistant.hook.tsx
│   │   └── context/VoiceAssistantProvider.js
│   ├── public/
│   │   ├── library/          ← Live2D SDK
│   │   └── shizuku_model/    ← Live2D character model
│   └── package.json
├── requirements.txt
├── .env.example
└── README.md
```
