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

# Optional: TTS (voice output) provider
#   edge   — Edge TTS (free, no API key) ← recommended
#   google — Google Cloud TTS (needs GCP service account)
#   openai — OpenAI TTS (needs OPENAI_API_KEY)
TTS_PROVIDER=edge
```

> **Voice out of the box?** `TTS_PROVIDER=edge` is free and needs no API key. Just uncomment `edge-tts` in `requirements.txt`.
>
> **Speech input (mic → text)?** Handled by the browser's Web Speech API — no API key, no backend setup needed.

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
│  Browser:     Web Speech API → transcription → /chat  │
│  Custom:       POST /chat          → conversation    │
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
| POST | `/audio/tts` | Send text, get audio file (form: text+language) |
| POST | `/run` | ADK native agent execution API |
| GET  | `/` | ADK Web debug UI |

## TTS Provider (Voice Output)

Speech is handled server-side. Set `TTS_PROVIDER` in `.env`:

| Provider | API Key Needed | Notes |
|---|---|---|
| `edge` | ❌ Free | **Default.** Fast, zero config. Requires `pip install edge-tts` (uncomment in requirements.txt) |
| `google` | ✅ GCP credentials | Natural voices, needs `GOOGLE_APPLICATION_CREDENTIALS` env var |
| `openai` | ✅ OPENAI_API_KEY | `TTS_PROVIDER=openai` |

**Speech Input (STT):** The frontend uses the browser's built-in Web Speech API (`webkitSpeechRecognition`). Speech is transcribed to text locally in the browser, then sent to the backend as a text message — no raw audio upload needed, no API key required.

## Project Structure

```text
digital-human-adk/
├── agents/
│   ├── digital_human.py      ← ADK Agent ("Xiao Wei", Gemini 2.5 Flash)
│   └── tools.py              ← Custom tools (in-memory memory, etc.)
├── audio/
│   └── tts.py                ← Text-to-speech (Edge / Google / OpenAI)
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
