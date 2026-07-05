# Plan: Read Script → Talk Show

## Goal

Transform the current Read Script feature from a slide-only presentation overlay into a **Talk Show** where the Digital Human (Live2D avatar) appears as a host, reading the script aloud with synchronized mouth movement, while slides appear as visual content alongside or behind the avatar.

## Current State

- **PresentationMode** is a full-screen fixed overlay (zIndex:50) that covers the entire page
- The DigitalHumanContainer (Live2D avatar) is rendered **inside** ConversationContainer with `compact` layout
- When PresentationMode opens, the avatar is completely hidden behind the overlay
- TTS playback uses `getSharedAudioContext()` but does **not** trigger mouthOpen animation
- The avatar only animates during voice chat mode (via `useVoiceAssistant.hook.tsx`'s `speakFromBlob`)

## Proposed Approach

### Layout Change: Split View

Instead of a full-screen overlay, when "Start Presentation" is clicked:
1. The main layout changes to a **split view**:
   - **Left side**: DigitalHumanContainer (avatar, ~40% width) — same as the normal chat layout
   - **Right side**: PresentationMode slides (~60% width)
2. The background page remains visible underneath (no fixed overlay)

This way the avatar is always visible during the talk show.

### Avatar Mouth Animation During TTS

Currently:
- `useVoiceAssistant.hook.tsx` has `speakFromBlob()` which uses `AnalyserNode` to read frequency data and call `setMouthOpen()`
- PresentationMode's `speakText()` just plays audio via AudioContext without any mouth animation

**Fix**: After `source.connect(ctx.destination)`, also connect through an `AnalyserNode` to drive mouth movement, similar to how the main voice chat works.

### Architecture Changes

#### Files to modify:

1. **`index.tsx`**:
   - Move `showPresentation` state up from ConversationContainer to index.tsx
   - Add a layout condition: when showPresentation is true, render a split view instead of the normal layout
   - Pass `onPresentationStart/onPresentationEnd` callbacks

2. **`ConversationContainer.component.tsx`**:
   - Remove PresentationMode rendering (moved to index.tsx)
   - Keep the `open-presentation` event listener but change it to communicate with parent (or use context)

3. **`PresentationMode.component.tsx`**:
   - Remove the fixed full-screen overlay styling
   - Add a `compact` or `talkShow` prop that renders without fixed positioning
   - When in talk show mode, render slides on the right side of a horizontal layout
   - Add `mouthOpen` / `setMouthOpen` props OR add AnalyserNode inside speakText to drive mouth movement
   - Show a "character name" label/indicator during the show

4. **`useVoiceAssistant.hook.tsx`** or **`PresentationMode.component.tsx`**:
   - Add `AnalyserNode` in `speakText()` (similar to `speakFromBlob()`)
   - Expose `mouthOpen` state for the avatar animation

5. **`DigitalHumanContainer.component.tsx`**:
   - Already uses `mouthOpen` from context — may need to also accept `mouthOpen` as a prop for the talk show mode

#### Optional / Future:

- Add a "Talk Show" intro animation
- Add teleprompter-style scrolling text
- Allow switching between slides via avatar gesture/commands

## Step-by-Step Implementation

### Step 1: Lift showPresentation to index.tsx

- Add `isPresentationMode` state to index.tsx
- Listen for `open-presentation` custom event in index.tsx
- When activated, replace the main layout with a split view
- When deactivated, restore normal layout

### Step 2: Modify PresentationMode

- Remove fixed overlay (position:fixed, zIndex:50)
- Accept a `talkShow` boolean prop
- In talk show mode: render as a flex row with slides on the right
- Add an `AnalyserNode` after `source.connect(ctx.destination)` to track volume
- Drive `mouthOpen` state from the analyser data

### Step 3: Wire mouthOpen to avatar

- The DigitalHumanContainer is rendered alongside PresentationMode in the split view
- Pass mouthOpen state to the container via context or props
- Avatar's mouth animates during TTS

### Step 4: Clean up

- Remove old overlay code from PresentationMode
- Ensure console doesn't show errors
- Test end-to-end

## Files Likely to Change

| File | Change |
|---|---|
| `frontend/src/pages/index.tsx` | Add showPresentation state, split layout |
| `frontend/src/pages/components/ConversationContainer/ConversationContainer.component.tsx` | Remove PresentationMode overlay |
| `frontend/src/pages/components/PresentationMode/PresentationMode.component.tsx` | Split view mode, AnalyserNode for mouth animation |
| `frontend/src/pages/hooks/useVoiceAssistant.hook.tsx` | Minor — maybe expose AnalyserNode logic |

## Validation

1. Open sidebar → Read Script → input text → AI Generate → Start Presentation
2. See avatar on left, slides on right
3. Click play button → avatar mouth moves while TTS plays
4. Slides advance with auto-advance or manual navigation
5. Close exits back to normal chat layout

## Risks & Tradeoffs

- **Risk**: Splitting the layout might break responsive design on smaller screens
  - *Mitigation*: Keep the avatar compact on small screens, or stack vertically
- **Risk**: AnalyserNode might not work perfectly with the shared AudioContext
  - *Mitigation*: Create a separate AnalyserNode per playback, connect/disconnect properly
- **Risk**: Mouth animation might look unnatural
  - *Mitigation*: Use the same frequency-based approach as voice chat, which already works
- **Tradeoff**: Moving PresentationMode out of ConversationContainer changes component boundaries
- **Tradeoff**: The avatar will need to be visible but not interactive (no chat) during the talk show

## Open Questions for User

1. **Layout preference**: Avatar on left + slides on right? Or slides as overlay on top of avatar (PiP style)?
2. **Avatar size**: Same as chat mode, or larger/smaller during talk show?
3. **Slide content**: Should slides appear as a teleprompter (scrolling text) or as traditional slides with page breaks?
4. **Exit behavior**: Should there be a clear "End Talk Show" button?
