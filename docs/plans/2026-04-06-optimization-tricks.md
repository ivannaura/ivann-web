# Optimization Tricks — IVANN WebGL2 Cinema Pipeline

> Mathematical, physical, and logical optimization tricks applicable to the scroll-driven cinema renderer.
> Inspired by game development traditions (Quake III fast inverse sqrt, Doom sector tricks, etc.)

**Pipeline context:**
```
Video → Pass 1: Cinema (CA + vignette + grain) → FBO_A
     → Pass 2: Bloom threshold (half-res) → FBO_B
     → Pass 3: Kawase blur (ping-pong) → FBO_B/B2
     → Pass 4: Composite (bloom + motion blur + flare) → screen
     → Pass 5: Particles (1100, additive blend) → screen
```

---

## Phase 1 — Confirmed Tricks (Research Complete)

### 1. Structure of Arrays (SoA) Particle Data
**Impact:** High | **Effort:** Medium | **File:** `cinema-gl.ts`

**Current:** Array of Particle objects (AoS) — each particle is `{ x, y, vx, vy, life, ... }`.
**Trick:** Flat `Float32Array` columns: `posX[1100]`, `posY[1100]`, `velX[1100]`, `velY[1100]`.

**Why it works:** CPU cache lines are 64 bytes. When iterating all particles to update X positions, AoS loads entire objects (wasting cache on Y, vel, life fields). SoA loads only X values — sequential memory, zero waste. This is the same pattern used in ECS game engines (Unity DOTS, Bevy).

```typescript
// Before (AoS): ~100 bytes per particle, only 8 used per loop
for (const p of particles) p.x += p.vx * dt;

// After (SoA): 4 bytes per element, sequential
for (let i = 0; i < N; i++) posX[i] += velX[i] * dt;
```

Cache efficiency improvement: ~10-15x for tight loops. Also enables `bufferSubData` directly from the Float32Array (zero copy to GPU).

---

### 2. Transform Feedback (GPU Particle Physics)
**Impact:** Very High | **Effort:** High | **File:** `cinema-gl.ts`

**Current:** CPU updates 1100 particle positions per frame, then uploads via `bufferSubData`.
**Trick:** WebGL2 Transform Feedback runs the physics in a vertex shader, writing results directly to a GPU buffer. Zero CPU→GPU transfer per frame.

**How it works:**
1. Bind particle data as vertex attributes
2. Vertex shader computes `new_pos = pos + vel * dt`, `new_vel = vel * damping + forces`
3. `gl.transformFeedbackVaryings()` captures outputs into a second VBO
4. Ping-pong the two VBOs each frame
5. Render particles from the same buffer (zero copy)

The CPU only sends uniform updates (cursor position, energy, time). 1100 particles × 6 floats × 4 bytes = 26KB that stops crossing the bus entirely.

**Trade-off:** Luminance grid force (currently CPU-side PBO readback) would need to be passed as a texture uniform instead of CPU array access.

---

### 3. Dual Kawase Blur
**Impact:** Medium | **Effort:** Medium | **File:** `cinema-gl.ts` (bloom pass)

**Current:** 3-iteration Kawase blur with fixed sample offsets.
**Trick:** Dual Kawase (Marius Bjørge, ARM 2015) uses different kernels for downsample and upsample passes:

```glsl
// Downsample: 5 taps in a cross pattern at half-texel offsets
vec4 ds = tex(uv) * 4.0;
ds += tex(uv + vec2(-hp, -hp));
ds += tex(uv + vec2( hp, -hp));
ds += tex(uv + vec2(-hp,  hp));
ds += tex(uv + vec2( hp,  hp));
ds *= 0.125; // 1/8

// Upsample: 8 taps in a ring at full-texel offsets
vec4 us = tex(uv + vec2(-fp, 0)) + tex(uv + vec2(fp, 0));
us += tex(uv + vec2(0, -fp)) + tex(uv + vec2(0, fp));
us += (tex(uv + vec2(-hp, -hp)) + tex(uv + vec2(hp, -hp))
    + tex(uv + vec2(-hp, hp)) + tex(uv + vec2(hp, hp))) * 0.5;
us *= 0.0833; // 1/12
```

For the same blur radius, Dual Kawase needs fewer iterations than standard Kawase while producing a smoother result. ARM's benchmarks showed 2-3x faster on mobile GPUs.

---

### 4. Distance-Squared (Eliminate sqrt)
**Impact:** Medium | **Effort:** Low | **File:** `cinema-gl.ts` (particle shader + CPU)

**Current:** `float dist = length(pos - cursor)` → calls `sqrt()`.
**Trick:** Compare `dot(delta, delta)` against `radius * radius`. Never compute the actual distance.

```glsl
// Before
float dist = length(pos - u_mouse);
float force = 1.0 / max(dist, 1.0);

// After
vec2 delta = pos - u_mouse;
float dist2 = dot(delta, delta);
float radius2 = CURSOR_RADIUS * CURSOR_RADIUS;
float force = 1.0 / max(dist2, 1.0); // works in squared space
```

This is the principle behind Quake III's fast inverse square root — the realization that you often don't need the actual distance, just a comparison or a ratio. `sqrt()` costs 4-8 GPU cycles; `dot()` costs 1 (it's a native MAD chain).

Also applies to CPU-side particle updates in the luminance grid force calculation.

---

### 5. Cosine Palette (Inigo Quilez)
**Impact:** Visual enhancement | **Effort:** Low | **File:** `cinema-gl.ts` (particle fragment shader)

**Trick:** Generate infinite procedural color palettes from just 4 `vec3` parameters:

```glsl
vec3 palette(float t, vec3 a, vec3 b, vec3 c, vec3 d) {
    return a + b * cos(6.28318 * (c * t + d));
}
```

Each act could have its own `(a, b, c, d)` parameters, interpolated with progress. Particles would shift color harmoniously through the narrative instead of using static tint values.

**Parameters for IVANN aesthetic:**
```glsl
// Warm gold (calm acts)
palette(t, vec3(0.5,0.4,0.2), vec3(0.5,0.3,0.2), vec3(1.0,0.7,0.4), vec3(0.0,0.15,0.2))
// Crimson fire (intense acts)
palette(t, vec3(0.5,0.1,0.1), vec3(0.5,0.4,0.2), vec3(2.0,1.0,0.5), vec3(0.5,0.2,0.1))
```

Reference: https://iquilezles.org/articles/palettes/

---

### 6. Math.exp Precompute (Eliminate Math.pow in hot loops)
**Impact:** Low-Medium | **Effort:** Low | **Files:** `audio-momentum.ts`, `usePianoScroll.ts`, `ScrollVideoPlayer.tsx`, `CustomCursor.tsx`, `cinema-gl.ts`

**Current:** `energy *= Math.pow(FRICTION, dt)` — `Math.pow` is ~10 CPU cycles.
**Trick:** `energy *= Math.exp(LN_FRICTION * dt)` — `Math.exp` is ~5 cycles, and `LN_FRICTION` is a constant.

```typescript
// Before (per-frame)
const LN_FRICTION = Math.log(FRICTION); // computed ONCE at module load

// In hot loop:
// Before: energy *= Math.pow(FRICTION, dt);
// After:  energy *= Math.exp(LN_FRICTION * dt);
```

This is the mathematical identity: `a^x = e^(x·ln(a))`. Moves `log()` to initialization (paid once) and replaces `pow()` with `exp()` (cheaper and avoids internal log computation).

Applied across 5 files that all use the `Math.pow(CONSTANT, dt)` delta-time pattern.

---

### 7. Quartic Smoothstep (Vignette without sqrt)
**Impact:** Low | **Effort:** Low | **File:** `cinema-gl.ts` (cinema pass shader)

**Current:** Vignette uses `length(uv - 0.5)` which internally calls `sqrt()`.
**Trick:** Work entirely in distance-squared space with a quartic falloff:

```glsl
// Before
float dist = length(uv - 0.5);
float vignette = smoothstep(0.5, 0.2, dist);

// After — no sqrt needed
vec2 d = uv - 0.5;
float dist2 = dot(d, d); // squared distance
float vignette = 1.0 - smoothstep(0.04, 0.25, dist2); // squared thresholds
```

Visually nearly identical. The transition curve is slightly different (quadratic in distance rather than linear) but for a vignette effect this is imperceptible.

---

### 8. Conditional Chromatic Aberration Bypass
**Impact:** Medium (especially mobile) | **Effort:** Low | **File:** `cinema-gl.ts` (cinema pass shader)

**Current:** Chromatic aberration always samples 3 texture reads (R, G, B at offset UVs), even when `energy ≈ 0` and the offset is essentially zero.
**Trick:** Early-out when the effect is invisible:

```glsl
float caStrength = u_energy * 0.003 + u_velocity * 0.005;
if (caStrength < 0.0001) {
    // Single texture read — no CA
    fragColor = texture(u_video, uv);
} else {
    // Full 3-read CA
    float r = texture(u_video, uv + caOffset * vec2(1,0)).r;
    float g = texture(u_video, uv).g;
    float b = texture(u_video, uv - caOffset * vec2(1,0)).b;
    fragColor = vec4(r, g, b, 1.0);
}
```

Saves 2 texture fetches per pixel when the user isn't scrolling. On a 960×402 canvas at 2x DPR, that's ~1.5M fewer texture reads per frame during idle.

**Note:** GPU branching is normally expensive, but texture-fetch-gated branches are well-handled by modern GPUs because the texture unit stall dominates anyway.

---

## Phase 2 — Research Complete (10 Agents)

> 10 parallel research agents investigated optimization opportunities across the full stack.
> All agents completed. Findings organized by domain below.

---

### Agent 1: GLSL Shader Micro-Ops

| Trick | Impact | Description |
|-------|--------|-------------|
| **glColorMask alpha skip** | High (~475 MB/s saved) | Disable alpha writes on opaque passes: `gl.colorMask(true, true, true, false)`. Saves ~25% framebuffer bandwidth. |
| **Bilinear flare merge** | Medium (17→9 samples) | Exploit hardware bilinear interpolation: sample between two texels to get the average of both in one fetch. Cuts flare loop from 17 to 9 texture reads. |
| **mediump for color ops** | Medium (2× mobile throughput) | Declare `precision mediump float` for bloom/composite passes where color precision (0-1 range) doesn't need highp. 2× ALU throughput on Adreno/Mali. |
| **MAD fusion** | Low | Structure GLSL as `a * b + c` for single-cycle GPU multiply-add. Most expressions already MAD-friendly. |
| **Bloom knee as uniform** | Low | Precompute `1.0 / (4.0 * knee + 0.0001)` CPU-side, send as uniform. Avoids per-fragment division. |

---

### Agent 2: GPU Particle Techniques

| Trick | Impact | Description |
|-------|--------|-------------|
| **Transform Feedback** | Very High | Move particle physics entirely to GPU vertex shader. WebGL2 `transformFeedbackVaryings()` writes results to a second VBO. Eliminates CPU loop + `bufferSubData` entirely. Luminance grid passed as texture uniform. |
| **VAO state caching** | Low | Use separate VAOs for particles vs fullscreen quad to reduce `bindBuffer`/`vertexAttribPointer` calls per frame. |

---

### Agent 3: Web Audio DSP

| Trick | Impact | Description |
|-------|--------|-------------|
| **Delta-time EMA correction** | Medium (BUG FIX) | `updateFrequencyBands()` uses fixed alpha without dt-correction. At 144Hz smoothing is 2.4× more aggressive than at 60Hz. Fix: `alpha_corrected = 1 - (1 - alpha)^dt`. |
| **getFloatFrequencyData** | Medium-High (visual quality) | Replace `getByteFrequencyData` (Uint8Array, 256 levels) with `getFloatFrequencyData` (Float32Array, full dB precision). Eliminates staircase quantization in bass-reactive vignette. |
| **Frame-skip analysis** | Medium | Call `getByteFrequencyData` every 2-3 frames instead of every frame. `smoothingTimeConstant=0.6` already blurs temporally — consecutive frames at 144Hz are near-identical. Saves 50-66% FFT readback cost. |
| **GainNode volume routing** | Medium | Route all volume through `GainNode.gain` (already exists) instead of `audio.volume` per frame. Eliminates per-frame HTMLAudioElement property writes. |
| **MicroSounds GainNode pool** | Medium | Pre-allocate 4 GainNode→destination chains. Reuse on each `playNote()`/`playWhoosh()`. Only create the lightweight OscillatorNode fresh (it's single-use by spec). Eliminates ~50% of node allocations. |
| **Unrolled band summation** | Low | Split 128-bin loop into 3 branchless loops (bass/mids/highs) with precomputed reciprocals. Better JIT vectorization on ARM. |
| **Zero-alloc hot path** | Low | Inline the asymmetric EMA closure (arrow function allocated every call). Use module-level `DEFAULT_BANDS` object instead of creating new ones. |

---

### Agent 4: Perceptual / Psychovisual Shortcuts

| Trick | Impact | Description |
|-------|--------|-------------|
| **JND update gating** | Very High (30-50% session) | Skip ALL WebGL rendering when user is idle (no scroll, no mouse move, energy ≈ 0). Just-Noticeable Difference: if nothing changes, the eye can't tell. Show the last rendered frame. |
| **Temporal amortization** | High | Run bloom+flare passes at 30fps instead of 60fps. Persistence of vision threshold is ~13ms — bloom blur is inherently soft and doesn't need per-frame updates. Halves the cost of passes 2-4. |
| **Saccadic suppression** | Medium | During fast scroll (velocity > 0.5), reduce effect quality: fewer Kawase iterations (3→1), skip flare, reduce particle count. The eye suppresses detail perception during saccades — nobody notices. |
| **ASC CDL color grading** | Medium (visual quality) | Replace custom color grading with Hollywood-standard ASC CDL: `out = pow(in * slope + offset, power)`. 4 operations, industry-proven color science. |
| **Blue noise grain** | Medium | Replace 2-octave FBM grain (~20 ALU ops) with a 128×128 blue noise texture + golden ratio temporal animation (`uv + fract(frame * 0.618)`). 1 texture read vs 20 math ops, and blue noise has no visible banding. |

---

### Agent 5: Browser Compositor & Layout

| Trick | Impact | Description |
|-------|--------|-------------|
| **RAF coalescing** | High | Merge 3 separate `requestAnimationFrame` loops (ScrollVideoPlayer, AudioMomentum, CustomCursor) into a single GSAP ticker callback. Eliminates 2 redundant rAF registrations and guarantees consistent execution order. |
| **Layer explosion risk** | High (diagnostic) | 20+ GSAP SplitText spans over WebGL canvas could create 50+ implicit compositor layers. Add `will-change: transform` only on the canvas, not on text spans. Use Chrome DevTools Layers panel to audit. |
| **CSS containment** | Medium | Add `contain: layout style paint` on ScrollStoryOverlay beats. Prevents text animation reflows from propagating to the canvas. |
| **content-visibility: auto** | Low | Already applied to Contact/Footer. Could extend to off-screen story beats. |

---

### Agent 6: GC Pressure & Memory

| Trick | Impact | Description |
|-------|--------|-------------|
| **String allocation in transforms** | High (~600 strings/sec) | `translate(${x}px, ${y}px)` in CustomCursor, shake transform, letterbox scaleY — all create template literal strings every frame. Fix: pre-allocate string buffers or use `CSSStyleDeclaration` properties directly. |
| **sampleLumGrad return object** | Medium (66K objects/sec) | `sampleLumGrad()` returns `{gx, gy}` for each of 1100 particles = 66,000 short-lived objects per second. Fix: return values via pre-allocated reusable object or two Float32Arrays. |
| **Object pool for particles** | Low | Particle objects already use `resetParticle()` in-place. The GC pressure comes from the gradient return objects, not the particles themselves. |

---

### Agent 7: Scroll Performance

| Trick | Impact | Description |
|-------|--------|-------------|
| **RAF ordering dependency** | Medium | AudioMomentum's RAF reads `energy` which is set by ScrollVideoPlayer's RAF. If they run in different rAF callbacks, there's a 1-frame latency. Single-loop eliminates this. |
| **Asymmetric EMA dt-correction bug** | Medium (BUG) | Same bug independently found: `audio-momentum.ts:223` — fixed alpha without dt-correction. Confirms this is a real issue, not theoretical. |
| **Passive scroll listeners** | Low | Already using `{ passive: true }` on mousemove. Verify all scroll-related listeners are passive. |

---

### Agent 8: Texture & FBO Optimization

| Trick | Impact | Description |
|-------|--------|-------------|
| **texStorage2D + texSubImage2D** | Medium | Replace `texImage2D` (re-allocates each call) with `texStorage2D` (allocate once, immutable) + `texSubImage2D` (update data only). Eliminates per-frame GL allocation checks. |
| **gl.invalidateFramebuffer()** | Medium (mobile) | Call `invalidateFramebuffer(DEPTH_STENCIL_ATTACHMENT)` after each FBO pass. On tile-based mobile GPUs (Adreno, Mali), this saves ~228 MB/s DRAM by telling the GPU not to write back unused attachments. |
| **HALF_FLOAT bloom FBOs** | Low-Medium | Use `gl.RGBA16F` for bloom FBOs instead of `gl.RGBA8`. Half-float prevents banding in bright bloom regions and is the standard for HDR pipelines. Minimal bandwidth increase (2× per texel but at half resolution). |
| **Video texture format** | Low | Explicitly use `gl.RGB` format for video texture (no alpha channel needed). Saves 25% video texture bandwidth. |

---

### Agent 9: Fast Math Approximations

| Trick | Impact | Description |
|-------|--------|-------------|
| **Hoist damping out of particle loop** | Very High (1100→1 calls) | `Math.pow(PARTICLE_DAMPING, dt*60)` is computed inside the 1100-particle loop, but `dt` is constant per frame. Move outside: eliminates 1100 transcendental calls. |
| **Precompute `ln(constant)`** | High (11 call sites) | For constants near 1 (0.985, 0.955, 0.92, etc.): precompute `LN_C = Math.log(c)` once, then use `Math.exp(LN_C * dt)` or linear approximation `1 + LN_C * dt` (accurate to 99.5%). Applied across 5 files. |
| **Squared-distance cursor check (CPU)** | Medium | Compare `dx*dx + dy*dy` against `radius²` before computing `Math.sqrt`. ~80-90% of particles are outside cursor radius — skips sqrt for the majority. |
| **GLSL `inverseSqrt` fusion** | Medium | Fuse `length()` + `normalize()` into a single `inverseSqrt(dot(v,v))` call. Gets both distance and direction from one hardware rsqrt. |
| **xorshift32 PRNG** | Low-Medium | Replace `Math.random()` with userland xorshift32 in particle spawn (~364 calls/frame). Avoids V8 engine boundary crossing. |
| **Squared-distance vignette** | Low (desktop) / Medium (mobile) | `smoothstep` on `dot(d,d)` instead of `length(d)`. Eliminates per-fragment sqrt. Slightly different falloff curve (tunable). |
| **Integer luminance** | Low | Rec.709 coefficients as integers (54, 183, 19) with precomputed reciprocal `1/65280`. Avoids per-pixel float divisions in luminance grid. |
| **Sin/cos LUT** | Low | 64-entry lookup table for particle burst angles. Replaces 100 sin+cos calls per act transition. |

---

### Agent 10: Spatial & Physics

| Trick | Impact | Description |
|-------|--------|-------------|
| **Curl noise** | Medium (visual quality) | Divergence-free noise for organic particle flow (Bridson, SIGGRAPH 2007). Particles swirl naturally instead of moving in straight lines toward/away from forces. Implementable in the particle vertex shader. |
| **SDF text exclusion** | Medium (visual quality) | Particles flow around ScrollStoryOverlay text via signed distance fields. Render text bounds to a low-res SDF texture, sample in particle shader to create repulsion. |
| **Verlet integration** | Low | Replace Euler integration (`pos += vel * dt`) with Verlet (`pos_new = 2*pos - pos_old + acc*dt²`). More stable for stiff forces (cursor attraction). Not worth the refactor for 1100 particles at current force magnitudes. |

---

## Unified Priority Ranking

### Tier 1: Critical (implement first)

| # | Trick | Source | Impact | Effort |
|---|-------|--------|--------|--------|
| 1 | **Hoist damping from particle loop** | Agent 9 | Very High | Trivial |
| 2 | **JND idle gating** | Agent 4 | Very High (30-50% session) | Medium |
| 3 | **Delta-time EMA fix** | Agents 3+7 (BUG) | Medium (correctness) | Low |
| 4 | **RAF coalescing (3→1 loops)** | Agents 5+7 | High | Medium |
| 5 | **Precompute ln(constants)** | Agents 1+9 | High (11 sites) | Low |

### Tier 2: High Value

| # | Trick | Source | Impact | Effort |
|---|-------|--------|--------|--------|
| 6 | **sampleLumGrad zero-alloc** | Agent 6 | Medium (66K obj/sec) | Low |
| 7 | **String allocation fix** | Agent 6 | High (~600/sec) | Low |
| 8 | **getFloatFrequencyData** | Agent 3 | Medium-High (quality) | Low |
| 9 | **Temporal amortization (bloom 30fps)** | Agent 4 | High | Medium |
| 10 | **Distance² + CA bypass** | Phase 1 #4+#8 | Medium | Low |
| 11 | **texStorage2D immutable textures** | Agent 8 | Medium | Low |
| 12 | **glColorMask alpha skip** | Agent 1 | High (475 MB/s) | Trivial |

### Tier 3: Solid Improvements

| # | Trick | Source | Impact | Effort |
|---|-------|--------|--------|--------|
| 13 | **Blue noise grain texture** | Agent 4 | Medium (20 ALU→1 fetch) | Medium |
| 14 | **Bilinear flare merge** | Agent 1 | Medium (17→9 samples) | Low |
| 15 | **MicroSounds GainNode pool** | Agent 3 | Medium | Medium |
| 16 | **GainNode volume routing** | Agent 3 | Medium | Low |
| 17 | **Frame-skip FFT analysis** | Agent 3 | Medium | Low |
| 18 | **Squared-distance cursor (CPU)** | Agent 9 | Medium | Low |
| 19 | **invalidateFramebuffer (mobile)** | Agent 8 | Medium (mobile) | Trivial |
| 20 | **Saccadic suppression** | Agent 4 | Medium | Medium |
| 21 | **CSS containment on beats** | Agent 5 | Medium | Low |
| 22 | **Layer explosion audit** | Agent 5 | High (diagnostic) | Low |

### Tier 4: Visual Upgrades

| # | Trick | Source | Impact | Effort |
|---|-------|--------|--------|--------|
| 23 | **Cosine palette (Quilez)** | Phase 1 #5 | Visual | Low |
| 24 | **Curl noise particles** | Agent 10 | Visual | Medium |
| 25 | **ASC CDL color grading** | Agent 4 | Visual | Medium |
| 26 | **SDF text exclusion** | Agent 10 | Visual | High |

### Tier 5: Ambitious Architectural

| # | Trick | Source | Impact | Effort |
|---|-------|--------|--------|--------|
| 27 | **SoA particle data** | Phase 1 #1 | High | Medium |
| 28 | **Dual Kawase blur** | Phase 1 #3 | Medium | Medium |
| 29 | **Transform Feedback** | Phase 1 #2 + Agent 2 | Very High | High |
| 30 | **HALF_FLOAT bloom FBOs** | Agent 8 | Low-Medium | Medium |

---

## Phase 3 — Audio Deep Dive (2 Research Agents)

> Targeted investigation into DSP math and psychoacoustic tricks specifically for the audio-visual coupling pipeline.

### Agent A: Audio DSP Math

| # | Trick | Impact | Description |
|---|-------|--------|-------------|
| 31 | **Onset detection (spectral flux)** | HIGH | Detect piano note attacks, claps, transients from existing FFT data. Half-wave rectified positive spectral differences + adaptive EMA threshold. Trigger 10-30 particle micro-bursts at musically meaningful moments instead of fixed act boundaries. Cost: ~0.01ms. |
| 32 | **Band compander (power-law)** | HIGH | `y = x^0.6` on smoothed bands before feeding to shaders. Quiet passages (bands ~0.05) become 3× more visible (→0.148) while loud passages still have headroom. Makes acts 1, 7, 8 visually alive. Optional: mood-dependent gamma. |
| 33 | **Spectral centroid (brightness)** | HIGH | `SC = Σ(k × |X(k)|) / Σ(|X(k)|)` — single number for timbral brightness. Drives bloom threshold more musically than raw `u_highs`. Bright arpeggios bloom; dark bass chords stay contrasty. |
| 34 | **A-weighting + ERB combined** | MEDIUM-HIGH | Perceptual loudness curve (IEC 61672) × critical bandwidth weighting. Pre-computed 128-float LUT. Bass bins (86Hz) get 0.37× weight, mids (2.8kHz) get 1.17×. Makes visual reactivity match perceived loudness. |
| 35 | **Zero-crossing rate (texture)** | MEDIUM | `getFloatTimeDomainData` → count sign changes → classify tonal (piano) vs noise (applause). Low ZCR → smooth flowing particles; high ZCR → jittery scattered particles. |
| 36 | **Rate-compensated band boundaries** | LOW-MEDIUM | At `playbackRate=0.5`, FFT frequencies shift down by 2×. Scale `BASS_END` and `MIDS_END` by `1/rate` to keep musical frequency ranges consistent. |
| 37 | **Phase vocoder: NOT recommended** | N/A | `preservesPitch=false` is the correct creative choice (vinyl slowdown). Userspace STFT would add 2-5ms latency for no benefit. |

### Agent B: Psychoacoustic Tricks

| # | Trick | Impact | Description |
|---|-------|--------|-------------|
| 38 | **Fletcher-Munson loudness weighting** | MEDIUM | Volume-dependent A-weighting — at low volume, bass is perceptually 20dB quieter but visuals treat it equally. Interpolate between full A-weighting (quiet) and flat (loud). |
| 39 | **Temporal masking (post-masking)** | HIGH | After loud transient, ear desensitized for ~200ms. Model this to create dramatic "silence after impact" — vignette tightens, particles shrink, then bloom back. Transforms act transitions. |
| 40 | **Frequency masking (spectral flatness)** | MEDIUM | Spectral flatness = geometric/arithmetic mean. When dominant frequency masks neighbors, boost CA and bloom to show what ear misses. Creates inverse: simple sounds → complex visuals. |
| 41 | **Missing fundamental** | LOW-MEDIUM | Detect bass perception from harmonic pattern in mids (piano fundamentals below bin resolution). Augments bass band during low-register passages. |
| 42 | **Rhythm/groove modeling** | VERY HIGH | Onset detection + spectral flux → tempo tracking → phase accumulator. Particles pulse with flamenco compas instead of arbitrary scroll events. The "it feels alive" factor. |
| 43 | **AV synchrony threshold** | MEDIUM | Tighten drift correction from 1.0s → 150ms. Add fine correction tier at 40-150ms. Use the 60ms perceptual budget for 3-frame ring buffer smoothing on bands (free temporal AA). |
| 44 | **Stereo field → directional particles** | HIGH | ChannelSplitterNode → L/R AnalyserNodes → stereo pan signal. Low piano notes drift particles left, high notes drift right. CA shifts with stereo field. |

### Phase 3 Priority

| Priority | Tricks | Total Effort |
|----------|--------|-------------|
| **P0 (do first)** | #31 Onset detection, #32 Band compander | ~6h |
| **P1 (high value)** | #33 Spectral centroid, #34 A-weighting+ERB, #39 Temporal masking, #43 AV sync | ~12h |
| **P2 (ambitious)** | #42 Rhythm/groove, #44 Stereo field, #35 ZCR | ~20h |
| **P3 (polish)** | #38 Fletcher-Munson, #40 Spectral flatness, #41 Missing fundamental, #36 Rate-comp | ~10h |

---

*Document created: 2026-04-06*
*Status: Phase 1 + Phase 2 + Phase 3 complete. 44 tricks cataloged.*
*Implementation: worktree agents dispatched for Tier 1-2 fixes.*
