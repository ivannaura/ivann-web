# IVANN AURA

Immersive scroll-driven cinematic website for IVANN AURA, a Colombian pianist and live show performer.

The entire page is a single scroll experience built on top of the concert video "Flamenco de Esfera". Each scroll, keypress, or click drives the video forward and triggers momentum-based audio that decays like a vinyl record slowing down.

## Stack

Next.js 16 &middot; React 19 &middot; TypeScript &middot; Tailwind CSS v4 &middot; Lenis &middot; Zustand

## Quick Start

```bash
npm install
npm run dev
```

Open [localhost:3000](http://localhost:3000).

## How It Works

**Scroll** controls the video position. A vinyl inertia system caps the maximum scrub speed so the video always moves smoothly, even during aggressive scrolling.

**Audio** is driven by a physics-based momentum engine. Each interaction injects energy that decays with friction. The energy drives `playbackRate` (0.25x to 1.0x) and volume through a smoothstep curve. With `preservesPitch = false`, the audio pitch drops as momentum decays — like a vinyl record slowing to a stop.

**Story beats** appear over the video at specific frame ranges, creating a narrative experience synchronized to the concert footage.

## Architecture

```
ScrollVideoPlayer (scroll → vinyl inertia → video.currentTime)
├── AudioMomentum (physics: impulse → energy → playbackRate + volume)
└── ScrollStoryOverlay (20+ frame-synced narrative beats)
```

## Documentation

- [`CLAUDE.md`](./CLAUDE.md) — Project overview, component map, conventions
- [`docs/CONVENTIONS.md`](./docs/CONVENTIONS.md) — Technical conventions and best practices
- [`docs/plans/`](./docs/plans/) — Design documents and implementation plans

## Deployment

Deployed on Vercel. Pushes to `main` trigger automatic deployments.

## License

Private. All rights reserved.
