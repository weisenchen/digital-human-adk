# CLAUDE.md

Behavioral guidelines for AI-assisted development on the ADK Digital Human project.
Merge with your editor/agent's own instructions as needed.

**Tradeoff:** These guidelines bias toward caution over correctness. For trivial changes (typos, one-line fixes), use judgment.

---

## Project Overview

Live2D avatar chatbot powered by Google ADK 1.x. Two modes: text chat (`POST /chat`) and voice chat (`POST /run_sse` + sentence-level TTS). Voice character selection (male/female, 7 locales, 40+ voices). All code and documentation in English.

## Tech Stack

| Layer | Stack |
|---|---|
| Backend | Python 3.10+, FastAPI (via ADK's `get_fast_api_app`), Google ADK 1.x (`google-adk>=1.0,<2.0`) |
| LLM | Gemini 2.5 Flash (via ADK) |
| TTS | edge-tts (default, free), Google Cloud TTS, OpenAI TTS |
| Frontend | Next.js 13.4, React 18.2, TypeScript |
| Rendering | Pixi.js 6.5 + pixi-live2d-display |
| Styling | Tailwind CSS 3.4 + shadcn/ui |
| Animation | framer-motion 11 |
| Icons | lucide-react |

## Directory Structure

```
digital-human-adk/
├── agents/
│   ├── digital_human.py    ← root_agent definition (name REQUIRED)
│   └── tools.py            ← custom tools for the agent
├── audio/
│   └── tts.py              ← TTS synthesis + voice catalog (VOICE_CATALOG + POPULAR_NAMES)
├── server.py               ← ADK server + custom endpoints
├── frontend/
│   ├── src/pages/
│   │   ├── index.tsx                    ← Main layout: 7/5 grid (Live2D + Chat)
│   │   ├── services/adk-assistant.service.ts  ← API client (sendChatMessage, sendChatStream, etc.)
│   │   ├── hooks/useVoiceAssistant.hook.tsx   ← State management hook
│   │   ├── context/VoiceAssistantContext.js   ← React context (DO NOT convert to TS)
│   │   ├── context/VoiceAssistantProvider.js  ← Provider wrapper (DO NOT convert to TS)
│   │   └── components/
│   │       ├── CharacterSelector/     ← Voice character picker
│   │       ├── ConversationContainer/ ← Input + chat display + character selector
│   │       ├── DigitalHumanContainer/ ← Live2D canvas + status indicator
│   │       ├── ChatDisplay/           ← Streaming chat bubbles
│   │       ├── VoiceRecorder/         ← Web Speech API mic button
│   │       ├── Loading/               ← Animated loading indicator
│   │       ├── HeaderContainer/       ← Top bar
│   │       └── LanguageSelector/      ← Language picker
│   ├── public/
│   │   ├── library/          ← Live2D SDK (MUST commit these files)
│   │   └── shizuku_model/    ← Live2D character model
│   └── package.json
├── requirements.txt
├── .env.example
├── DESIGN.md
└── CLAUDE.md
```

## ─── 1. Think Before Coding ───

### State Assumptions Explicitly

Before implementing:
- State what you're assuming about the system state. If uncertain, STOP and check.
- If multiple valid interpretations exist, present them — don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, name what's confusing. Check the code, don't guess.

### Project-Specific Assumptions to Verify

- **ADK version**: This project uses ADK 1.x (specifically 1.36.x). ADK 2.x has different APIs (`get_fast_api_app` signature, runner args, session handling). NEVER assume 2.x APIs work.
- **`get_fast_api_app(agents_dir, web=True, allow_origins=["*"], auto_create_session=True)`** — this exact call signature. `agent_dir` (singular, not `agents_dir`) was renamed in 2.x.
- **Runner requires `session_service=InMemorySessionService()`** — this is a mandatory keyword arg in 1.x.
- **`root_agent` variable name** — ADK's agent loader specifically looks for `root_agent`. Naming it anything else fails silently.
- **Context files are `.js`** — `VoiceAssistantContext.js` and `VoiceAssistantProvider.js` are JavaScript files intentionally. Converting to `.tsx` breaks imports. DO NOT touch.
- **Live2D SDK files MUST be committed** — `public/library/live2d.min.js` and `live2dcubismcore.js` are required for the frontend to work. They are NOT in node_modules. The `.gitignore` excludes `node_modules/` but these are in `public/` so they are tracked.

### When to Ask

Ask the user when:
- The request is ambiguous about which mode (text vs voice) or which language
- You need to add a new dependency (pip or npm)
- The change would affect the API contract (endpoints, response format)
- You want to change established patterns (new component structure, state management approach)

---

## ─── 2. Simplicity First ───

**Minimum code that solves the problem. Nothing speculative.**

### Rules

- No features beyond what was asked.
- No abstractions for single-use code. No premature "this might be useful later".
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios. (But DO handle real failure modes — see Stability section.)
- If you write 200 lines and it could be 50, rewrite it.

### Dual-Mode Pattern (canonical)

The project has exactly two communication modes. Keep this pattern intact:

| Mode | Trigger | Endpoint | TTS | When to add a third mode? **Only if explicitly asked.** |
|---|---|---|---|---|
| Text chat | User types + Enter | `POST /chat` | No | — |
| Voice chat | User speaks | `POST /run_sse` | Yes (sentence-level) | — |

### What NOT to Do

- ❌ Don't add real-time WebSocket mode unless asked (we have SSE streaming).
- ❌ Don't add server-side STT (browser Web Speech API handles it, zero config).
- ❌ Don't add authentication/production middleware unless asked.
- ❌ Don't add database persistence (session is in-memory, tools are in-memory).
- ❌ Don't add Redis/caching layer (project runs single-process).

---

## ─── 3. Surgical Changes ───

**Touch only what you must. Clean up only your own mess.**

### When Editing Existing Code

- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it — don't delete it.

### What to Clean Up (your own changes)

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.
- If you rename something, update ALL references in the same commit.

### The Test

Every changed line should trace directly to the user's request.

### Conventions to Match

| Aspect | Convention |
|---|---|
| Backend imports | `import os, sys` at top, then stdlib, then third-party, then local. Dotenv loaded at module level. |
| Backend docstrings | `"""One-line description."""` or `"""Args/Returns"""` for complex functions. |
| Frontend imports | React/Next first, then UI components, then context, then local components, then services. |
| Frontend TypeScript | Use interfaces (not types) for props. Use `React.FC<Props>` for function components. |
| Styling | Tailwind utility classes with custom `[#hex]` values. Use DESIGN.md tokens where applicable. |
| Error messages | English only. Console errors use `console.error("ComponentName: message", err)`. |
| State management | React Context + hooks pattern. Custom hook (`useVoiceAssistant`) provides all state + actions. |

---

## ─── 4. Goal-Driven Execution ───

**Define success criteria. Loop until verified.**

### How to Start a Task

Before writing code, state a brief plan:

```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

### Verification Checklist (project-specific)

| Change Type | Always Verify |
|---|---|
| New backend endpoint | Start server, `curl` the endpoint, check status + response shape |
| Modified TTS | `curl -X POST -F text="hello" -F language="en" http://localhost:8000/audio/tts -o test.mp3 && file test.mp3` |
| New frontend component | `npm run dev`, open browser, check console for errors |
| Hook/context change | No React "undefined is not an object" errors in console |
| Imports | All new imports resolve (no red squiggles in IDE) |
| TypeScript | `tsc --noEmit` passes (if node_modules installed) |
| Python | `python -c "ast.parse(open('file.py').read())"` for syntax |
| API contract change | Both frontend + backend aligned on new field/format |
| Token/secret change | `.env` NEVER committed. API keys stay in `.env`, `.env.example` has placeholder values. |

### Strong Criteria vs Weak Criteria

| Weak ("make it work") | Strong ("verifiable goal") |
|---|---|
| "Add a voice selector" | "CharacterSelector renders with gender tabs, selects voice_id on click, passes it to TTS API, verify by changing voice and hearing the difference" |
| "Fix the SSE bug" | "Send voice message, verify onComplete doesn't double the text, inspect console logs" |
| "Improve stability" | "Server survives 10 rapid voice inputs without crash, /tmp doesn't fill up, SSE times out after 30s idle" |

---

## ─── 5. Stability & Safety Rules ───

These are non-negotiable. Every change must respect them.

### Never

- **Never commit `.env`** or any file containing real API keys/tokens. `.env` is in `.gitignore`.
- **Never commit `node_modules/`** or `.next/`. The root `.gitignore` already covers these.
- **Never add a new dependency without a good reason.** Each dep = build time + security surface + maintenance burden.
- **Never use `allow_origins=["*"]`** in production-facing code. Fine for local dev.
- **Never add secrets to code.** Use `.env` + `os.getenv()` for backend, env vars for frontend.

### Always

| Situation | Rule |
|---|---|
| SSE streaming | ALWAYS return a cancel function (AbortController). ALWAYS handle AbortError silently. ALWAYS add idle timeout. |
| TTS synthesis | ALWAYS wrap in `asyncio.wait_for(timeout=30)`. ALWAYS clean up temp file after response (BackgroundTasks). |
| Audio playback | ALWAYS use a single shared AudioContext. ALWAYS stop previous source before starting new one. |
| `/chat` endpoint | ALWAYS wrap in try/except. ALWAYS return a structured `{reply: "..."}` even on error. |
| Character name | ALWAYS inject only once per session (`_configured_sessions` set), not every message. |
| Live2D | ALWAYS destroy PIXI app in useEffect cleanup. ALWAYS wrap Live2D operations in try/catch. |
| fetch() calls | ALWAYS handle non-OK response. ALWAYS handle network errors. |
| File writes | ALWAYS use `Path.mkdir(parents=True, exist_ok=True)` before writing. |

---

## ─── 6. Known Pitfalls ───

### ADK 1.x Specific

- **Runner crashes without `session_service`.** Always pass `session_service=InMemorySessionService()`.
- **Messages use `google.genai.types.Content`, not dicts.** `types.Content(role="user", parts=[types.Part(text=...)])`.
- **No `stream` param in 1.x.** Streaming is implicit via async generator. DON'T add `stream=True`.
- **`auto_create_session=True` REQUIRED** in `get_fast_api_app()`, or first request gets 404.
- **`root_agent` variable name REQUIRED.** ADK loader specifically looks for this name. `my_agent` fails silently.

### Frontend Specific

- **SSE final event has FULL text, not delta.** The non-partial event contains the complete response. Use `textPart` directly — don't prepend accumulated text.
- **Chinese sentence boundaries in streaming TTS.** Regex must include `。！？` (U+3002, U+FF01, U+FF1F) in addition to `. ! ?`. Without these, Chinese responses won't trigger per-sentence TTS.
- **`streaming: true` REQUIRED in POST body** for ADK's `/run_sse`. Without it, all events are non-partial (no token-level streaming).
- **`EventSource` doesn't work** (GET only). ADK's `/run_sse` is POST. Use `fetch` + `ReadableStream`.
- **Web Speech API is Chrome-only** (`webkitSpeechRecognition`). Not supported in Firefox/Safari.
- **Context files are `.js`** — `VoiceAssistantContext.js` and `VoiceAssistantProvider.js`. Do NOT convert to `.tsx`.
- **Dual session services** — ADK's internal one and the `/chat` custom one are separate. Sessions don't cross over.

### Live2D Specific

- **SDK files must be committed.** `public/library/live2d.min.js` and `live2dcubismcore.js` are tracked in git (they're under `public/`, not `node_modules/`).
- **PIXI app must be destroyed** on unmount or it leaks memory and breaks React Strict Mode.
- **Mouth animation uses `PARAM_MOUTH_OPEN_Y`.** The param name is case-sensitive.
- **`expression('f00')` may throw** if the model doesn't have that expression. Always wrap in try/catch.

### Git & Commits

- **Credentials:** GitHub PAT stored in `~/.git-credentials-hermes` (chmod 600), NOT in the repo.
- **Commit messages:** English, imperative mood, describe WHAT and WHY, not HOW.
- **Push:** First push needs `git push --set-upstream origin main` (branch has no upstream).
