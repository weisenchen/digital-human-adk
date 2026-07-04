---
version: alpha
name: Xiao Wei
description: A warm, friendly AI digital human companion with a cute Live2D avatar.
colors:
  primary: "#1A202C"
  secondary: "#4A5568"
  tertiary: "#6B46C1"
  tertiary-light: "#E9D8FD"
  accent: "#667EEA"
  surface: "#FFFFFF"
  background: "#F7FAFC"
  user-bubble: "#EDF2F7"
  ai-bubble: "#EBF4FF"
  on-primary: "#FFFFFF"
  on-tertiary: "#FFFFFF"
  on-surface: "#1A202C"
  muted: "#A0AEC0"
  border-light: "#E2E8F0"
  shadow: "rgba(0, 0, 0, 0.08)"
  success: "#48BB78"
typography:
  h1:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: 2rem
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  h2:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: 1.5rem
    fontWeight: 600
    lineHeight: 1.3
  body-lg:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: 1.125rem
    lineHeight: 1.6
  body-md:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: 1rem
    lineHeight: 1.5
  body-sm:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: 0.875rem
    lineHeight: 1.4
  label:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: 0.75rem
    fontWeight: 600
    letterSpacing: "0.06em"
rounded:
  sm: 6px
  md: 12px
  lg: 16px
  xl: 20px
  full: 9999px
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  xxl: 48px
elevation:
  card: "0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.06)"
  elevated: "0 4px 6px rgba(0,0,0,0.07), 0 2px 4px rgba(0,0,0,0.06)"
  modal: "0 10px 15px rgba(0,0,0,0.1), 0 4px 6px rgba(0,0,0,0.05)"
components:
  chat-input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.primary}"
    rounded: "{rounded.full}"
    padding: "12px 48px 12px 20px"
    border: "2px solid {colors.border-light}"
  chat-input-focus:
    border: "2px solid {colors.tertiary}"
  send-button:
    backgroundColor: "{colors.tertiary}"
    textColor: "{colors.on-tertiary}"
    rounded: "{rounded.full}"
    size: 36px
  send-button-hover:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.on-tertiary}"
  mic-button:
    backgroundColor: "{colors.tertiary}"
    textColor: "{colors.on-tertiary}"
    rounded: "{rounded.full}"
    size: 40px
  mic-button-recording:
    backgroundColor: "#E53E3E"
    textColor: "{colors.on-tertiary}"
    rounded: "{rounded.full}"
    size: 40px
  chat-bubble-user:
    backgroundColor: "{colors.user-bubble}"
    textColor: "{colors.primary}"
    rounded: "{rounded.lg}"
    padding: "12px 16px"
  chat-bubble-ai:
    backgroundColor: "{colors.ai-bubble}"
    textColor: "{colors.primary}"
    rounded: "{rounded.lg}"
    padding: "12px 16px"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.on-surface}"
    rounded: "{rounded.lg}"
    shadow: "{elevation.card}"
    padding: "{spacing.md}"
  header:
    backgroundColor: "rgba(255, 255, 255, 0.9)"
    textColor: "{colors.primary}"
    borderBottom: "1px solid {colors.border-light}"
  loading-dot:
    backgroundColor: "{colors.tertiary}"
    size: 8px
    rounded: "{rounded.full}"
---
## Overview

Xiao Wei is a cute digital human assistant rendered as a Live2D avatar. The
visual identity should feel warm, approachable, and slightly playful — like a
friendly companion, not a corporate tool. The palette uses soft neutrals with
a purple-lavender accent that signals "AI" without feeling cold or clinical.

Desktop-first layout with a split panel: the Live2D avatar occupies the left
(60% width), and the conversation panel occupies the right (40% width). On
mobile, the avatar collapses to a small top bar and the conversation fills the
screen.

## Colors

- **Primary (#1A202C):** Deep charcoal for headlines and primary text. Softens
  pure black for a more approachable feel.
- **Secondary (#4A5568):** Muted slate for secondary text, timestamps, metadata.
- **Tertiary (#6B46C1):** "Warm Purple" — the signature AI accent. Used for
  interactive elements: send button, mic button, links, focus states.
- **Accent (#667EEA):** Soft blue-purple for hover states and secondary
  interactive elements.
- **Surface (#FFFFFF):** Clean white for card backgrounds and panels.
- **Background (#F7FAFC):** Warm off-white page background, softer than pure white.
- **User Bubble (#EDF2F7):** Subtle gray-blue for user message bubbles.
- **AI Bubble (#EBF4FF):** Subtle lavender-blue for AI message bubbles.
- **Muted (#A0AEC0):** Placeholder text, disabled states, subtle dividers.
- **Border Light (#E2E8F0):** Subtle borders and dividers.

## Typography

Inter is the primary typeface — clean, highly readable at any size, with a
friendly mechanical precision that suits an AI companion.

- **h1:** Section titles (e.g., "Conversation Dialog"). Bold, tight tracking.
- **h2:** Header title / brand name.
- **body-lg:** Chat message text. Slightly larger for readability.
- **body-md:** Input placeholder text, secondary content.
- **label:** Language selector labels, badge text. Uppercase via letter-spacing.

## Layout & Spacing

The layout follows a 4px baseline with proportional gaps:

- **xs (4px)** — Tight icon/gap spacing, loading dot gaps.
- **sm (8px)** — Button-to-button, icon-to-text gaps.
- **md (16px)** — Card padding, intra-component gaps.
- **lg (24px)** — Inter-component gaps, section padding.
- **xl (32px)** — Section margins, panel padding.
- **xxl (48px)** — Page-level margins.

## Elevation & Depth

- **card:** Default panel shadow. Subtle, almost flat — the panels sit on the
  background, not above it.
- **elevated:** Hovered cards, dropdowns, the interim-transcript bubble.
- **modal:** Reserved for future use (dialogs, overlays).

## Shapes

The system uses consistently gentle rounded corners — nothing aggressive:

- **sm (6px):** Interactive elements (buttons, small controls).
- **md (12px):** Cards, panels, input fields.
- **lg (16px):** Chat bubbles.
- **xl (20px):** Larger containers.
- **full:** Avatars, mic button, send button.

## Components

### chat-input
The text input field for typing messages. Full-width with a circular pill
shape. The send button sits inside the right edge. On focus, the border
transitions to the tertiary (purple) color.

### send-button
A small circular button inside the input field. Purple background with white
icon. On hover, shifts to the accent blue-purple.

### mic-button
A circular button next to the input. Same size as the send button. Purple at
rest, transitions to red when recording (visually distinct, not "danger" red —
a recording indicator).

### chat-bubble
Two variants: user (gray-blue) and AI (lavender-blue). AI bubbles optionally
prefixed with a small Xiao Wei avatar circle. Streaming text shows a subtle
blinking cursor at the end to indicate "still speaking."

### card
The standard container for both panels (avatar + conversation). White
background, gentle shadow, rounded corners.

### header
Fixed top bar with branding and language selector. Semi-transparent white
with backdrop blur for a frosted-glass effect.

### loading-dot
Three bouncing dots using the tertiary color. Used while waiting for AI
response.

## Do's and Don'ts

- **Do** use the tertiary purple as the primary interactive color — it's the
  signal for "clickable."
- **Do** keep backgrounds soft and text high-contrast for readability.
- **Don't** use orange or yellow as primary UI colors — they clash with the
  purple accent and create a "warning" or "food" vibe.
- **Don't** introduce colors outside the palette. Extend the palette via the
  YAML front matter first.
- **Do** animate transitions smoothly — the Live2D avatar is already animated;
  the UI should match that fluidity.
- **Don't** use aggressive gradients. The brand gradient (purple-blue) should
  be subtle if used at all.
- **Do** maintain adequate contrast — body text on surfaces must pass WCAG AA.
