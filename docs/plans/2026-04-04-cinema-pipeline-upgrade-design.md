# Cinema Pipeline Upgrade — Full Awwwards Design

**Date**: 2026-04-04
**Goal**: Upgrade the scroll-driven cinema experience to Awwwards-premium level with multi-pass WebGL2 pipeline, new cinematic effects, improved particles, reactive audio, and tiered rendering.

---

## 1. WebGL2 Multi-Pass Pipeline

### Current: 2 passes → New: 5 passes (High tier)

```
Video Texture
    ↓
Pass 1: Cinema (CA + vignette + grain + color grade + heat distortion) → FBO_A
    ↓
Pass 2: Bloom threshold + downsample (FBO_A → FBO_B, half-res)
    ↓
Pass 3: Kawase blur (FBO_B ↔ FBO_B2 ping-pong, 3 iterations)
    ↓
Pass 4: Composite (FBO_A + bloom + motion blur + flare + film burn + spotlight) → screen
    ↓
Pass 5: Particles (additive blend over screen)
```

### FBO Layout

| FBO | Resolution | Purpose |
|-----|-----------|---------|
| FBO_A | Full | Cinema pass output |
| FBO_B | Half | Bloom downsample / blur read |
| FBO_B2 | Half | Bloom blur write (ping-pong) |
| FBO_D | Full | Previous frame for motion blur (read-only) |

### Tier Degradation

| Tier | Target | Passes | FBOs | Features |
|------|--------|--------|------|----------|
| **High** | Desktop + flagship mobile | 5 | 4 | All effects |
| **Mid** | Mid-range mobile | 3 | 2 | Bloom + color grade + particles (500). No motion blur, no flare, no heat |
| **Low** | Weak GPU / reduced-motion | 0 | 0 | Raw `<video>` + text overlay |

### Auto-detection

- `gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS)` >= 8 AND `navigator.deviceMemory` >= 4 → High
- WebGL2 available but low resources → Mid
- No WebGL2 OR `prefers-reduced-motion` → Low
- **Runtime downgrade**: if average frame time > 20ms for 10 consecutive frames → drop one tier

---

## 2. Shader Effects (Cinema Pass)

### 2a. Color Grading per Act

Palette interpolation in shader (no LUT texture). Each act defines shadows/midtones/highlights tints as vec3 RGB:

| Act | Shadows | Midtones | Highlights | Feel |
|-----|---------|----------|------------|------|
| Despertar | cool blue (0.15,0.18,0.25) | neutral (1,1,1) | soft amber (1,0.95,0.85) | Intimacy |
| Entrada | deep blue (0.12,0.15,0.28) | faint gold (1,0.98,0.9) | warm white (1,0.97,0.92) | Anticipation |
| Danza | purple (0.2,0.12,0.22) | rich gold (1,0.92,0.75) | amber (1,0.9,0.7) | Passion |
| Espectáculo | dark red (0.25,0.1,0.1) | orange (1,0.85,0.65) | bright gold (1,0.88,0.55) | Energy |
| Fuego | crimson (0.3,0.08,0.08) | fire red (1,0.7,0.5) | heat white (1,0.92,0.75) | Climax |
| Clímax | black (0.08,0.05,0.05) | crimson (1,0.6,0.45) | pure gold (1,0.85,0.4) | Ecstasy |
| Resolución | navy (0.1,0.12,0.2) | soft purple (0.95,0.9,1) | silver (0.95,0.95,1) | Catharsis |
| Cierre | cool blue (0.15,0.18,0.25) | neutral (1,1,1) | faint amber (1,0.96,0.9) | Rest |

Technique: separate luminance into shadow/mid/highlight zones via smoothstep, apply tint per zone, Hermite interpolation between adjacent acts.

### 2b. Bloom (Kawase)

- **Threshold**: varies with mood: 0.75 (calm) → 0.45 (climax). Highs lower by 0.15 more.
- **Kawase blur**: 3 iterations, 4 samples each, half-res. Effective radius ~32px.
- **Composite**: `cinema + bloom * (0.4 + mood * 0.3)`. Climax bloom at 70% intensity.

### 2c. Chromatic Aberration (improved)

- Velocity normalization: 2000 → 5000 px/s
- Quadratic distance falloff (concentrated at edges, clean center)
- Asymmetric RGB: R radial, G tangential, B radial-opposite (prismatic dispersion)

### 2d. Film Grain (improved)

- 2-octave FBM noise (was 1 octave)
- Amplitude: ±0.03 (rest) → ±0.08 (climax)
- Shadow-weighted: `grain *= (1.0 - luminance * 0.5)` — more visible in darks (photochemical response)

### 2e. Heat Distortion (new)

- UV displacement: sinusoidal, gated by `energy * bass > 0.3`
- Max displacement: ~3px. Modulated by mood.
- Two axes with different frequencies for organic feel.

### 2f. Vignette (improved)

- Bass-reactive breathing (existing) + mood-scaled intensity
- No changes to core algorithm, just tighter integration with color grading

---

## 3. Composite Pass Effects

### 3a. Anamorphic Lens Flare (new)

- Sample bloom texture for pixels > 0.8 luminance
- 17 horizontal samples with triangular falloff
- Tint: subtle blue-cyan `vec3(0.7, 0.85, 1.0)`
- Intensity: `0.15 * mood`
- **Tier Mid**: disabled (most expensive effect — 17 texture fetches)

### 3b. Motion Blur (new)

- Temporal accumulation: `mix(current, previousFrame, smoothVelocity * 0.3)`
- FBO_D stores previous composite frame
- At zero velocity: no ghosting. At max: 30% previous frame persists.
- **Tier Mid**: disabled

### 3c. Film Burn / Light Leak (new)

- Triggered at act boundary crossings
- `actTransition` uniform: 0→1 over 0.5s in progress space
- Warm gradient: orange → yellow, left to right
- Max opacity: 40%
- Triangular envelope: ramp up 0-0.15, hold, ramp down 0.15-0.3

### 3d. Cursor Spotlight (improved)

- Quadratic falloff (was linear): `pow(1.0 - smoothstep(0.0, 0.35, d), 2.0)`
- Intensity: 0.06 → 0.12
- Tinted with current act's highlight color

---

## 4. Particle System Upgrade

### Count: 250 → 1000 (High), 500 (Mid)

Same zero-GC pattern: pre-allocated Float32Array, bufferSubData, resetParticle in-place.

### Velocity Persistence (CPU→GPU feedback)

Current problem: luminance gradient nudge is render-time only, doesn't feed back to CPU velocity.

Fix: In the CPU physics loop, sample video luminance at particle position (using a downsampled luminance map read back from GPU every N frames, OR approximate from the last known frame data). Apply luminance gradient as a **force** to velocity, not a position offset:
```
p.vx += luminanceGradientX * LUMINANCE_FORCE * dt
p.vy += luminanceGradientY * LUMINANCE_FORCE * dt
```

Practical approach: Instead of GPU readback (expensive), maintain a CPU-side 48x20 luminance grid updated from canvas `getImageData` every 10 frames (~6fps). Particles sample this grid for gradient. Cost: one 48x20 getImageData every 166ms — negligible.

### Cursor Trail Particles (new, ~100 extra)

- Spawn at cursor position when mouse moves
- Initial velocity: random spread + slight outward from cursor
- Same luminance-attraction as main particles
- Shorter maxLife (60 frames vs 180): they're ephemeral sparks
- Color: brighter white, transitioning to act highlight color
- Total particle budget: 1000 ambient + 100 cursor = 1100 (High tier)

### Particle Burst on Act Change (new)

- When act boundary crossed, spawn 50 particles at random screen positions with high initial velocity outward from center
- maxLife: 40 frames (quick burst)
- Size: 2x normal. Color: act highlight color.
- These reuse dead particle slots — no allocation, just reset with burst parameters.

### Bass Size Pulse (improved)

Current: size modulated by bass. Improve: size **and opacity** pulse, with a slight delay between size peak and opacity peak (size leads by 2 frames) — creates a "pop then glow" feel.

---

## 5. Audio Momentum Improvements

### Proportional Impulse

Current: fixed `IMPULSE = 0.2` regardless of velocity.

New: `impulse = lerp(0.1, 0.35, normalizedVelocity)`. Gentle scroll = 0.1 energy bump. Aggressive fling = 0.35. This makes the vinyl metaphor more nuanced.

### Frequency Band Tuning

Current: bass = bins 0-10 (~0-1720Hz). This is too wide — includes mid-range piano.

New bands:
| Band | Bins | Frequency | Content |
|------|------|-----------|---------|
| Bass | 0-3 | 0-516Hz | Piano body, low octaves |
| Mids | 3-30 | 516-5160Hz | Melody, main piano |
| Highs | 30-128 | 5160Hz+ | Harmonics, shimmer, applause |

### Responsiveness

Current: `smoothingTimeConstant = 0.8` + `BAND_ALPHA = 0.2` = very sluggish.

New: `smoothingTimeConstant = 0.6`, `BAND_ALPHA = 0.35`. Combined responsiveness jumps from 16% to 26% per frame — percussive piano attacks become visible in the shader effects and PianoIndicator.

### Drift Correction

Current: hard snap at 3.0s threshold.

New: Two-tier correction:
- Soft correction: if drift > 1.0s, gradually adjust (`audio.currentTime += drift * 0.1` per frame)
- Hard snap: if drift > 3.0s (unchanged, safety net)

---

## 6. Scroll Feel Improvements

### Velocity Normalization

2000 → 5000 px/s saturation. Trackpad fast scroll (~3000-5000 px/s) now produces 0.6-1.0 velocity instead of clamped 1.0.

### Bass Screen Shake (new)

On bass peaks > 0.7, apply micro-transform to the canvas container:
```css
transform: translate(shakeX, shakeY)
```
`shakeX/shakeY` = random ±1.5px, decaying over 4 frames. Applied via ref (no React re-render). Gated by `prefers-reduced-motion`.

### Dynamic Letterbox (new)

The 2.39:1 letterbox bars animate with act mood:
- Calm acts (Despertar, Cierre): bars are thicker → more intimate, narrower viewport
- Intense acts (Fuego, Clímax): bars thin out → wider viewport, more epic
- Range: ±15% of base bar height
- Animated via GSAP tween on progress change, CSS transform on bar elements
- Purely CSS/GSAP — zero GPU cost

---

## 7. Story Overlay Improvements

### Exit Animations (GSAP reverse)

Current: CSS opacity fade (inline style). New: GSAP-driven exit with reverse of entry:
- Masked reveal → chars slide back down behind word mask
- Char fade → opacity + y + blur reverse
- Word fade → opacity + y reverse
- Exit triggered at progress > 0.8, timeline reversed with `timeline.reverse()`

### Parallax Depth Layers

Text elements get a `data-depth` attribute (0.5, 1.0, 1.5). During scroll, each layer moves at `scrollDelta * depth` rate. Deeper elements (1.5) move faster — creates Z-axis separation. Pure CSS transform driven by scroll progress ref.

### Sound-Reactive Typography (new)

During high-energy moments (energy > 0.5), text elements with `data-reactive` attribute get subtle CSS modulations:
- `letter-spacing`: ±0.5px pulsing with mids
- `font-weight` variation (if variable font): subtle weight oscillation with energy
- Applied via CSS custom properties updated from the energy ref at 10fps (same throttle as PianoIndicator)

---

## 8. Atmospheric Haze (new)

A CSS gradient overlay (`pointer-events: none`) that shifts with progress:
- Low progress: subtle blue-black gradient from bottom
- Mid progress: warm amber haze from edges
- High progress (climax): red-black atmosphere
- Opacity: 0.05-0.12 — barely there, but unifies the color grading with the overlay space

Implemented as a single `div` with `background: radial-gradient(...)` and CSS custom properties driven by progress. Zero GPU cost.

---

## 9. Files to Modify

| File | Changes |
|------|---------|
| `src/lib/cinema-gl.ts` | Complete rewrite: FBO pipeline, new shaders, tier system, Kawase bloom, all new effects |
| `src/components/ui/ScrollVideoPlayer.tsx` | Velocity norm, proportional impulse, bass shake, letterbox, tier detection, luminance grid |
| `src/lib/audio-momentum.ts` | Proportional impulse, band tuning, responsiveness, soft drift correction |
| `src/components/ui/ScrollStoryOverlay.tsx` | Exit animations, parallax depth, sound-reactive typography, data attributes |
| `src/app/page.tsx` | Atmospheric haze div, letterbox elements, tier state management |
| `src/components/ui/PianoIndicator.tsx` | Updated band ranges to match new bass/mids/highs boundaries |

---

## 10. Performance Budget

| Metric | Current | Target (High) | Target (Mid) |
|--------|---------|---------------|--------------|
| Draw calls/frame | 2 | ~8 | ~4 |
| FBOs | 0 | 4 | 2 |
| Particles | 250 | 1100 | 500 |
| Texture fetches/frame | ~260 | ~1400 | ~600 |
| GPU memory (FBOs) | 0 | ~12MB | ~4MB |
| Target framerate | 60fps | 60fps | 55-60fps |
| Frame budget | 16.6ms | <14ms | <16ms |
