# Audio Momentum System — Design Doc

**Date:** 2026-03-25
**Status:** Approved

## Summary

Replace the current choppy scroll-seeking audio with a momentum-based system where each interaction (scroll, keypress, click) injects energy that drives smooth continuous audio playback. The music decelerates and stops naturally when the user stops interacting — like pushing a vinyl record.

## Architecture

```
Interaction (scroll/key/click)
     │
     ├──→ ScrollVideoPlayer: video.currentTime = f(scroll)  [VISUAL, muted]
     │
     └──→ AudioMomentum: energy += impulse                   [AUDIO]
              │
              ├── playbackRate = f(energy)    [0.25 → 1.0]
              ├── volume = f(energy)          [0 → 0.7]
              └── preservesPitch = false      [vinyl slowdown effect]
```

- **Video** stays muted, controlled by scroll (visual scrubbing, unchanged).
- **Audio** is a separate `<audio>` element with the extracted soundtrack (~2MB AAC). Continuous playback controlled by momentum physics.

## Momentum Physics

```typescript
// Constants
IMPULSE = 0.2        // energy added per interaction
FRICTION = 0.985     // decay per animation frame (~1.5s from full to silence)
MIN_RATE = 0.25      // minimum browser playbackRate
MAX_RATE = 1.0       // normal speed
MAX_VOLUME = 0.7
PLAY_THRESHOLD = 0.05   // energy below this → pause
DRIFT_THRESHOLD = 3.0   // seconds of audio/video drift before correction

// Per interaction (scroll forward, keypress, click):
energy = min(1.0, energy + IMPULSE)

// Per animation frame (~16ms):
energy *= FRICTION

// Derived audio values:
playbackRate = lerp(MIN_RATE, MAX_RATE, energy)
volume = smoothstep(0, 0.15, energy) * MAX_VOLUME
```

## Interaction Behaviors

| Input | Effect |
|-------|--------|
| Scroll forward | Adds energy → music plays/sustains |
| Scroll backward | NO energy added → momentum decays, audio fades, video scrubs back visually |
| Keypress | Adds energy + scrolls page forward (same as current) |
| Click (cinema area) | Adds energy + scrolls page forward |
| No interaction | Energy decays via friction → music decelerates → pitch drops (vinyl) → silence |

## Audio ↔ Video Sync

- **On playback start** (energy crosses 0 → PLAY_THRESHOLD): `audio.currentTime = video.currentTime`
- **During playback**: audio advances on its own at `playbackRate`. Small drift is imperceptible in a piano concert.
- **On drift > 3s**: soft correction — `audio.currentTime = video.currentTime`

## Vinyl Slowdown Effect

`preservesPitch = false` on the audio element. As momentum decays, `playbackRate` drops from 1.0 → 0.25 and the piano pitch lowers — like a vinyl record or music box winding down.

## Audio Pipeline

```bash
ffmpeg -i public/videos/flamenco-graded.mp4 -vn -acodec aac -b:a 128k public/audio/flamenco.m4a
```

~2MB for 4:06 at 128kbps. Loaded with `<audio preload="auto">`.

## Components

| Component | Action |
|-----------|--------|
| `AudioMomentum` (new) | Class: momentum physics + `<audio>` element control |
| `ScrollVideoPlayer` | Integrate AudioMomentum, pass impulses from scroll events |
| `usePianoScroll` | Pass impulses from keypress/click to AudioMomentum |
| `piano.ts` | Delete — replaced by AudioMomentum |
| `PianoIndicator` | Update to visualize momentum energy |
| `useAudioStore` | Delete — unused |

## What Doesn't Change

- Scroll → video.currentTime mapping (visual)
- ScrollStoryOverlay beats and animations
- Lenis smooth scroll
- CustomCursor, Navigation, Contact, Footer

## Decisions Made

- **Separate audio file** over using video's built-in audio (avoids choppy seeking)
- **Momentum/inertia model** over discrete fragments or micro-fragments
- **preservesPitch = false** for cinematic vinyl slowdown
- **Backward scroll silences** rather than playing in reverse
- **Coarse sync (3s threshold)** rather than frame-perfect sync
