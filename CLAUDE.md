# IVANN AURA — Scroll Cinema Website

@AGENTS.md

## Project

Awwwards-quality immersive website for IVANN AURA, a Colombian pianist and live show performer. The entire page is a single scroll-driven cinematic experience built on top of his concert video "Flamenco de Esfera".

## Stack

- **Next.js 16.2.1** (App Router, Turbopack)
- **React 19.2.4** + TypeScript
- **Tailwind CSS v4** (with `@theme inline` custom properties)
- **Lenis** for smooth scrolling (intercepts `window.scrollTo`)
- **Web Audio API** piano synthesizer (currently disabled — video has its own audio)
- **Zustand** for UI/audio stores
- **GSAP + Framer Motion** available but not yet used

## Architecture

The page has one main flow:

```
page.tsx
 ├── ScrollVideoPlayer (scroll → video.currentTime, audio plays on forward scroll)
 │    └── ScrollStoryOverlay (frame-synced text/stats/CTAs over video)
 ├── Contact section
 └── Footer
```

### Key Components

| Component | Purpose | Status |
|-----------|---------|--------|
| `ScrollVideoPlayer` | Scroll-driven HTML5 video with audio | **Active** |
| `ScrollStoryOverlay` | 20+ story beats with animations over video | **Active** |
| `ScrollFramePlayer` | Canvas-based frame-by-frame (old approach) | **Replaced** — can be deleted |
| `usePianoScroll` hook | Keyboard/click → scroll page forward | **Active** (notes disabled) |
| `piano.ts` | Web Audio Für Elise synthesizer | **Inactive** — video audio used instead |

### Sections (unused since scroll cinema)

`Hero.tsx`, `Experience.tsx`, `Music.tsx`, `LiveShow.tsx` — original section components, replaced by the scroll cinema approach. Can be deleted.

## Design Tokens (CSS Custom Properties)

```
--bg-void: #050508       (page background)
--bg-surface: #0A0A10    --bg-subtle: #12121A
--text-primary: #F0EDE6  --text-secondary: #8A8A99  --text-muted: #4A4A5A
--aura-gold: #C9A84C     --crimson: #6B1520
--deep-blue: #1A2D5A     --electric-blue: #2E5BFF
```

## Video Pipeline

Source: `public/videos/flamenco-de-esfera.mp4` (1280x720, 4:06, 67MB, YouTube)

Processing (ffmpeg):
```
crop to 2.39:1 letterbox → color grade → scale to 960p → H.264 CRF 30 → keyframes every 0.5s → AAC 96kbps → faststart
```

Output: `public/videos/flamenco-graded.mp4` (960x402, 26MB)

## Commands

```bash
npm run dev          # Dev server (Turbopack)
npm run build        # Production build
npx next dev --turbopack -p 3333   # Dev on port 3333
```

## Public Assets

- `videos/flamenco-graded.mp4` — **26MB, active** (scroll-driven video)
- `videos/flamenco-de-esfera.mp4` — 67MB, original source (fallback)
- `videos/demos/` — color grade demos (reference only)
- `videos/storyboard/` — 491 storyboard frames (reference only)
- `videos/cuts/` — 33 scene change thumbnails (reference only)
- `frames/all/` — **49MB, OBSOLETE** (old 3fps frame approach, safe to delete)

## Conventions

- All overlay content is in Spanish
- Letterbox 2.39:1 aspect ratio to hide corporate banners
- `object-cover` on video element for fullscreen display
- Frame indices use 3fps equivalence: `frameIndex = Math.floor(videoTime * 3)`
- Story beats in ScrollStoryOverlay use these frame indices for timing
