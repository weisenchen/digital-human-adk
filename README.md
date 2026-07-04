# ADK Digital Human — Live2D Avatar Chatbot

Start the backend, then open the Live2D frontend to chat with a cute animated digital human.
Powered by **Google ADK 1.x** + **Gemini 2.5 Flash**.

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

## 🎙 Voice Character Selection

A built-in **Voice Character Selector** lets you customize your digital human's voice and persona:

| Feature | Description |
|---|---|
| **♂/♀ Gender toggle** | Switch between female and male voice actors |
| **Voice list** | Pick from 10+ Edge TTS voices per locale, with localized names |
| **Character name** | Edit the avatar's name displayed in the UI |
| **Popular names** | One-click suggestions based on locale and gender |
| **7 locales** | English (US/UK), Chinese (Mandarin/Cantonese), Japanese, Korean, French |

**How it works:** The character name is used in the UI and can be referenced in the agent's system prompt. The voice ID is sent to the backend's `/audio/tts` endpoint for speech synthesis. When you switch language (e.g. from EN to 中文), the voice list automatically filters to matching locale voices.

## 📽 Presentation Mode

Read scripts aloud in a full-screen slide presentation with AI-generated slides:

1. **Input** — Paste your script, set slide count & total duration, click **AI Generate**
2. **Editor** — Review/edit generated slides (display content + speech narration per slide)
3. **Present** — Full-screen with auto-advance timer, TTS narration, and navigation controls

| Feature | Description |
|---|---|
| **AI Generate** | Smartly splits script into N slides with display content + speech narration |
| **Auto-advance** | Timer counts down per-slide, auto-advances when time expires |
| **TTS narration** | Each slide read aloud using the selected voice character |
| **Keyboard shortcuts** | `←` `→` navigate, `Space` read aloud |
| **Slide editor** | Edit display text and speech script individually after generation |
| **Background overlay** | Opaque white overlay covers entire viewport to hide underlying UI |

## Architecture

```text
┌─ Frontend (Next.js + Live2D) ────────────────────────────┐
│  Character Selector                                       │
│    ├─ Gender toggle (♂/♀)                                │
│    ├─ Voice radio list (localized names)                  │
│    ├─ Character name editor                               │
│    └─ Popular names (locale-appropriate)                  │
│                                                           │
│  Text input:    POST /chat          → non-streaming reply │
│  Mic input:     Web Speech → POST /run_sse → SSE + TTS   │
│  TTS:           POST /audio/tts      → text + voice → mp3│
└──────────────────┬────────────────────────────────────────┘
                   │
┌─ Backend (ADK built-in FastAPI server) ──────────────────┐
│  ADK Web Server (google.adk.cli.fast_api)                 │
│    → /run, /run_sse, /run_live (WebSocket)                │
│    → Session management, tool calling, streaming          │
│    → ADK Web debug UI (Angular)                           │
│  + Custom /chat, /audio/tts, /api/voices endpoints      │
│  + Voice catalog (locale, gender, popular names)          │
│  + .env for API keys / provider config                    │
└───────────────────────────────────────────────────────────┘
```

## API Endpoints

| Method | Path | Description |
|---|---|---|---|
| GET  | `/api/voices` | Voice catalog (locale, gender, names) |
| POST | `/chat` | Send text, get AI reply (form: text=...) |
| POST | `/audio/tts` | Send text+voice, get audio file (form: text+language+voice) |
| POST | `/run` | ADK native agent execution API |
| POST | `/generate-slides` | AI slide generation from script (form: topic+language+num_slides) |
| GET  | `/` | ADK Web debug UI |

### `/api/voices` Response Example

```json
[
  {
    "voice_id": "en-US-JennyNeural",
    "display_name": "Jenny",
    "localized_name": "Jenny",
    "locale": "en-US",
    "gender": "female",
    "popular_names": ["Olivia", "Emma", "Charlotte", "Amelia", "Sophia", ...]
  },
  {
    "voice_id": "zh-CN-XiaoxiaoNeural",
    "display_name": "Xiaoxiao",
    "localized_name": "小笑",
    "locale": "cmn-CN",
    "gender": "female",
    "popular_names": ["小薇", "小美", "小雨", "小琳", "小娜", ...]
  },
  {
    "voice_id": "zh-CN-YunxiNeural",
    "display_name": "Yunxi",
    "localized_name": "云希",
    "locale": "cmn-CN",
    "gender": "male",
    "popular_names": ["小明", "小刚", "志强", "云浩", "伟杰", ...]
  }
]
```

## TTS Provider (Voice Output)

Speech is handled server-side. Set `TTS_PROVIDER` in `.env`:

| Provider | API Key Needed | Notes |
|---|---|---|
| `edge` | ❌ Free | **Default.** Fast, zero config. Supports 7 locales + male/female voices. Requires `pip install edge-tts` (uncomment in requirements.txt) |
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
│   └── tts.py                ← Text-to-speech + voice catalog (Edge / Google / OpenAI)
├── server.py                 ← ADK server + custom /chat, /audio/tts, /api/voices
├── frontend/                 ← Next.js + Live2D frontend
│   ├── src/pages/
│   │   ├── index.tsx
│   │   ├── services/adk-assistant.service.ts
│   │   ├── hooks/useVoiceAssistant.hook.tsx
│   │   ├── context/VoiceAssistantProvider.js
│   │   └── components/CharacterSelector/ ← Voice character picker
│   ├── public/
│   │   ├── library/          ← Live2D SDK
│   │   └── shizuku_model/    ← Live2D character model
│   └── package.json
├── requirements.txt
├── .env.example
└── README.md
```
