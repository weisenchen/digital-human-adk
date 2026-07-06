---
name: interactive-explainer-video-html
description: Generate a single-file, narrated, animated, and interactive HTML explainer video that runs fully in-browser with synchronized captions, timeline controls, and click-to-explore detail overlays. Use whenever the user asks for an explainer video, narrated demo, animated story deck, interactive product walkthrough, or browser-playable presentation with pause-and-explore behavior.
---


# Interactive Explainer Video HTML


For narrated explainers that must run in a browser with no build step, this skill produces one self-contained HTML file that behaves like a media player and story engine at the same time.


## When to use this skill


- "Create an interactive explainer video for X"
- "Build a narrated HTML walkthrough"
- "Make an animated product story with voice-over and captions"
- "Generate a browser video deck with controls and hotspots"
- Any request requiring scene-based storytelling plus viewer interaction and deep-dive detail panels


Use this over a simple slide deck when the user needs timeline playback, narration, subtitles, media controls, and pause-to-explore interactions.


## Output requirements


Produce exactly one complete `.html` file, self-contained:


- No build tools, no frameworks, no external JS libraries.
- Inline CSS and inline JavaScript.
- Google Fonts CDN links are allowed.
- Must run in modern Chrome/Edge and degrade gracefully if voice is unavailable.


The output must be an interactive explainer player with:


- Scene-by-scene story progression
- Web Speech API narration
- Synchronized subtitles
- Full control bar (play/pause, prev/next, seek, volume, CC, narrate, explore, export)
- Clickable interactive elements that open detail content without breaking timeline state


## Mandatory HTML structure


Top-level anatomy must include:


- `#player`
- `#stage`
- `#brand-logo` (top-left)
- `#duration-badge` (top-right)
- `#scene-title-overlay`
- `#voice-indicator`
- `#voice-badge`
- `#wait-indicator`
- `#interactive-hint`
- `#detail-panel`
- `#modal-overlay`
- `#export-panel`
- `.scene` sections (one per scene; first has `active`)
- `#subtitle-bar`
- `#controls` containing all required player controls


The script must define:


- `SCENES` array with `id`, `title`, `subtitles`, and `narration`
- `MIN_DURATIONS` array (seconds per scene)
- `TOTAL_DURATION` derived from duration sum
- `DETAILS` lookup keyed by each `data-detail` id used in DOM


## Story and pacing rules


Default structure is 7 scenes:


1. Title / Hook
2. Why it matters
3. Core idea / pillars
4. How it works
5. Trust / controls / details
6. Impact / benefits
7. Close / CTA


Guidelines:


- Keep narration warm, plain-language, and concise.
- Use 1-3 subtitle chunks per scene with realistic timing offsets.
- Estimate spoken duration by word count and set `MIN_DURATIONS` slightly above spoken length.
- Keep default total duration around 90-120 seconds unless the user overrides.
- Exploration time is not part of playback duration (timeline freezes while interacting).


Never fabricate statistics, quotes, or dates. If facts are missing, stay qualitative or label placeholders as illustrative.


## Scene engine behavior


Implement a robust timeline state machine:


- Use `requestAnimationFrame` loop to track total elapsed and scene elapsed.
- Auto-advance scene when `sceneElapsed >= MIN_DURATIONS[currentScene]`.
- If narration is still speaking, set pending transition and wait for utterance end.
- Show `#wait-indicator` while waiting to transition.
- Apply a short post-narration pause before transitioning.


Playback controls must include:


- Play/Pause
- Previous/Next scene
- Progress track click-to-seek
- Scene dots/markers jump
- Caption toggle
- Narration toggle
- Volume slider
- Keyboard shortcuts: Space, Left, Right, `f`, Esc


Start paused on load. Do not autoplay speech without user gesture.


## Narration rules (Web Speech API)


Use `window.speechSynthesis` with `SpeechSynthesisUtterance`.


Voice selection should prefer natural, enterprise-sounding voices by priority, then fall back:


- Preferred named voices (for example: Aria/Jenny/Sonia/Libby natural variants)
- Other English female voices
- Any English voice
- Any available voice


Honor requested gender/accent if provided.


Default voice tuning:


- `rate`: ~0.92-0.98
- `pitch`: ~1.02-1.10
- `volume`: bound to slider


Handle async voice loading (`onvoiceschanged`) and update `#voice-badge`.


If no voice is available, captions and timing still work.


## Interactivity layer (required)


Every content scene should include 2-5 interactable elements.


Each interactive element must:


- Use class `interactive`
- Include `data-detail="..."`
- Be keyboard accessible with `tabindex="0"` and `role="button"`
- Support click, Enter, and Space activation


Discoverability:


- Persistent affordance for interactive targets
- Stronger highlight/pulse in paused/explore mode
- `#interactive-hint` visible while paused and exploring


Activation behavior:


- Auto-pause timeline
- Cancel current scene narration safely
- Open detail content by `DETAILS[id].kind` (`panel`, `modal`, or `tooltip`)
- Render `title`, `body`, and `tags`
- Optionally narrate `DETAILS[id].narrate` if narration is enabled


Close behavior:


- Stop detail narration
- Preserve timeline state correctness
- Keep main playback paused until user resumes
- Return focus to triggering control
- Support close button and Esc


Interaction state safety:


- Track `interacting` boolean
- Freeze timeline and suspend auto-advance while interacting
- Guard `pendingTransition` and transition timers so seeking/toggling/interacting cannot desync scene logic


Accessibility:


- Focus trap for modal dialogs
- Visible focus outlines for all controls/hotspots
- Correct dialog semantics (`role="dialog"`, `aria-modal="true"`)
- Use `aria-expanded` / `aria-controls` where applicable


## Visual style rules


Use a polished enterprise style, not generic template visuals.


- Typography: `DM Sans` + `DM Mono`
- Balanced scene rhythm with alternating background treatments
- Smooth cross-fade scene transitions and staggered content entrance
- Subtle reusable motion motifs (grid drift, glow, particles, status pulses)
- Inline SVG icons preferred over emoji
- No layout shift: fixed controls area and stable overlays


Default palette (override when user provides brand):


- `--brand: #003EA4`
- `--brand-dark: #002D72`
- `--brand-med: #0056B3`
- `--brand-light: #E8F0FE`
- `--accent: #4DA3FF`
- `--accent-red: #d9261c`
- Grays for UI surfaces and text hierarchy


If the user explicitly requests Citi branding, use a Citi-style palette and include an inline SVG logo lockup at top-left.


## Export behavior


Include an export panel with:


- `Download as HTML` (serialize current document HTML to Blob and download)
- Guidance for exporting to MP4/MOV via screen recording tools


## Quality bar


Do:


- Keep all code in one file.
- Make layout responsive for desktop and mobile.
- Keep interactions robust under pause, seek, narrate toggle, and scene jumps.
- Add concise code comments for scene data, details data, and state-machine logic.


Do not:


- Add external JS dependencies.
- Autoplay narration before user interaction.
- Overcrowd scenes with too many focal elements.
- Let interactions break progression, narration, or subtitle sync.


## Response format


Return:


- One named HTML artifact file such as `<topic>-interactive-explainer.html`
- A brief implementation summary covering:
 - scene plan and total duration
 - narration/voice behavior
 - interaction flow (pause -> explore -> close -> resume)
- 2-3 concrete follow-up customization options (tone, brand, scene count, deeper details)

