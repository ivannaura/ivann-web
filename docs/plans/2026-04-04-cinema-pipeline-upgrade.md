# Cinema Pipeline Upgrade — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Upgrade the scroll-driven cinema to Awwwards-premium quality: multi-pass FBO pipeline with Kawase bloom, color grading, motion blur, anamorphic flares, heat distortion, 1100 particles, film burns, bass shake, dynamic letterbox, parallax text, reactive typography, and atmospheric haze — with tiered rendering for performance.

**Architecture:** CinemaGL is rewritten as a 5-pass WebGL2 pipeline (cinema → bloom threshold → Kawase blur → composite → particles) with 4 FBOs. A tier system (High/Mid/Low) auto-detects GPU capability and degrades gracefully. AudioMomentum gets tighter frequency bands and proportional impulse. ScrollStoryOverlay gets GSAP exit animations, parallax depth, and sound-reactive typography. Page layout adds atmospheric haze and dynamic letterbox.

**Tech Stack:** WebGL2 (GLSL ES 3.0), GSAP + ScrollTrigger + SplitText, React 19, CSS custom properties, requestAnimationFrame

**Design doc:** `docs/plans/2026-04-04-cinema-pipeline-upgrade-design.md`

---

### Task 1: Audio Momentum — Band Tuning + Proportional Impulse + Soft Drift

Foundation task — improved frequency data feeds all visual effects.

**Files:**
- Modify: `src/lib/audio-momentum.ts`

**Step 1: Update frequency band boundaries**

Change bin ranges to isolate real bass from mid-range piano:

```typescript
// Old: BASS_END = 10, MIDS_END = 50
// New: bass 0-516Hz, mids 516-5160Hz, highs 5160Hz+
const BASS_END = 3;   // bins 0-2: ~0-516Hz (piano body, low octaves)
const MIDS_END = 30;  // bins 3-29: ~516-5160Hz (melody, main piano)
// Highs: bins 30-128: ~5160Hz+ (harmonics, shimmer, applause)
```

**Step 2: Increase frequency responsiveness**

```typescript
// Old: smoothingTimeConstant = 0.8, BAND_ALPHA = 0.2
// New: faster response to percussive attacks
this.analyser.smoothingTimeConstant = 0.6;
const BAND_ALPHA = 0.35;
```

**Step 3: Make impulse proportional to velocity**

Change `addImpulse` signature and ScrollVideoPlayer call site:

```typescript
// audio-momentum.ts
addImpulse(normalizedVelocity: number = 0.5): void {
  const amount = 0.1 + normalizedVelocity * 0.25; // 0.1 gentle → 0.35 aggressive
  this.energy = Math.min(1.0, this.energy + amount);
}
```

**Step 4: Add soft drift correction**

Replace hard-snap-only with two-tier correction:

```typescript
private checkDrift(): void {
  if (!this.audio || !this.videoTimeGetter) return;
  const videoTime = this.videoTimeGetter();
  if (!Number.isFinite(videoTime)) return;
  const drift = this.audio.currentTime - videoTime;
  const absDrift = Math.abs(drift);

  if (absDrift > DRIFT_THRESHOLD) {
    // Hard snap (safety net)
    this.syncToVideo();
  } else if (absDrift > 1.0) {
    // Soft correction — nudge 10% per frame
    this.audio.currentTime -= drift * 0.1;
  }
}
```

**Step 5: Verify build**

Run: `npm run typecheck`
Expected: No errors

**Step 6: Commit**

```bash
git add src/lib/audio-momentum.ts
git commit -m "feat(audio): tighter frequency bands, proportional impulse, soft drift correction"
```

---

### Task 2: CinemaGL — FBO Infrastructure + Tier Detection

Build the multi-pass rendering backbone. No shader changes yet — passes render identity (passthrough) to verify FBO pipeline works.

**Files:**
- Modify: `src/lib/cinema-gl.ts`

**Step 1: Add tier detection and FBO helpers**

At the top of the file, after imports:

```typescript
// Rendering tiers
export type CinemaTier = 'high' | 'mid' | 'low';

export function detectTier(gl: WebGL2RenderingContext): CinemaTier {
  const maxTexUnits = gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS);
  const renderer = gl.getParameter(gl.RENDERER) || '';
  const deviceMemory = (navigator as any).deviceMemory ?? 8;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (reducedMotion) return 'low';
  if (maxTexUnits >= 8 && deviceMemory >= 4 && !/Mali-4|Adreno 3|PowerVR SGX/i.test(renderer)) {
    return 'high';
  }
  return 'mid';
}

interface FBO {
  framebuffer: WebGLFramebuffer;
  texture: WebGLTexture;
  width: number;
  height: number;
}

function createFBO(gl: WebGL2RenderingContext, w: number, h: number): FBO | null {
  const framebuffer = gl.createFramebuffer();
  const texture = gl.createTexture();
  if (!framebuffer || !texture) return null;

  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);

  return { framebuffer, texture, width: w, height: h };
}

function resizeFBO(gl: WebGL2RenderingContext, fbo: FBO, w: number, h: number): void {
  fbo.width = w;
  fbo.height = h;
  gl.bindTexture(gl.TEXTURE_2D, fbo.texture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
}

function destroyFBO(gl: WebGL2RenderingContext, fbo: FBO): void {
  gl.deleteFramebuffer(fbo.framebuffer);
  gl.deleteTexture(fbo.texture);
}
```

**Step 2: Update CinemaGLParams and CinemaGL interface**

Add tier and act transition to the public API:

```typescript
export interface CinemaGLParams {
  video: HTMLVideoElement;
  time: number;
  energy: number;
  progress: number;
  bands: FrequencyBands;
  mouseX: number;
  mouseY: number;
  velocity: number;
  actTransition: number; // 0-1, peaks at act boundaries
}

export interface CinemaGL {
  render(params: CinemaGLParams): void;
  resize(w: number, h: number): void;
  destroy(): void;
  readonly lost: boolean;
  readonly tier: CinemaTier;
}
```

**Step 3: Create FBOs in initCinemaGL**

After creating programs but before the return object, create the FBO set based on tier:

```typescript
const tier = detectTier(gl);

// FBOs — only allocated for mid+ tiers
let fboA: FBO | null = null;  // full-res cinema output
let fboB: FBO | null = null;  // half-res bloom ping
let fboB2: FBO | null = null; // half-res bloom pong
let fboD: FBO | null = null;  // full-res previous frame (motion blur)

if (tier !== 'low') {
  fboA = createFBO(gl, w, h);
  fboB = createFBO(gl, Math.ceil(w / 2), Math.ceil(h / 2));
  fboB2 = createFBO(gl, Math.ceil(w / 2), Math.ceil(h / 2));
  if (tier === 'high') {
    fboD = createFBO(gl, w, h);
  }
  if (!fboA || !fboB || !fboB2 || (tier === 'high' && !fboD)) {
    console.warn('CinemaGL: FBO creation failed, falling back to low tier');
    // Clean up any created FBOs and continue without them
    [fboA, fboB, fboB2, fboD].forEach(f => f && destroyFBO(gl, f));
    fboA = fboB = fboB2 = fboD = null;
  }
}
const effectiveTier: CinemaTier = fboA ? tier : 'low';
```

**Step 4: Update resize to resize FBOs**

```typescript
resize(newW, newH) {
  w = newW;
  h = newH;
  canvas.width = w;
  canvas.height = h;
  gl.viewport(0, 0, w, h);

  if (fboA) resizeFBO(gl, fboA, w, h);
  if (fboB) resizeFBO(gl, fboB, Math.ceil(w / 2), Math.ceil(h / 2));
  if (fboB2) resizeFBO(gl, fboB2, Math.ceil(w / 2), Math.ceil(h / 2));
  if (fboD) resizeFBO(gl, fboD, w, h);
},
```

**Step 5: Update destroy to clean up FBOs**

Add before the existing cleanup:

```typescript
[fboA, fboB, fboB2, fboD].forEach(f => f && destroyFBO(gl, f));
```

**Step 6: Wire cinema pass to FBO_A (mid+ tiers)**

In the render function, change the cinema pass to render to FBO_A when available:

```typescript
// --- Pass 1: Cinema post-processing ---
if (fboA) {
  gl.bindFramebuffer(gl.FRAMEBUFFER, fboA.framebuffer);
  gl.viewport(0, 0, fboA.width, fboA.height);
} else {
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
}
gl.disable(gl.BLEND);
gl.useProgram(cinemaProg);
// ... uniforms unchanged ...
gl.bindVertexArray(cinemaVAO);
gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

// For now: if FBO pipeline, blit FBO_A to screen (will be replaced by bloom+composite)
if (fboA) {
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.viewport(0, 0, w, h);
  // Use a simple blit pass (reuse cinema quad with a passthrough shader)
  // TODO: Replace with bloom+composite in Task 4-5
}
```

**Step 7: Add passthrough/blit shader for FBO debugging**

```glsl
// BLIT_FRAG — simple texture copy, used temporarily and for fallback
const BLIT_FRAG = `#version 300 es
precision mediump float;
in vec2 v_uv;
uniform sampler2D u_tex;
out vec4 fragColor;
void main() {
  fragColor = texture(u_tex, v_uv);
}`;
```

Create blit program using CINEMA_VERT + BLIT_FRAG, with its own uniform location for `u_tex`.

**Step 8: Add runtime tier downgrade**

Add frame time tracking in the render function:

```typescript
// Runtime performance monitoring — auto-downgrade
let frameTimeSum = 0;
let frameTimeCount = 0;
let runtimeTier = effectiveTier;

// In render():
const frameStart = performance.now();
// ... all rendering ...
const frameTime = performance.now() - frameStart;
frameTimeSum += frameTime;
frameTimeCount++;
if (frameTimeCount >= 10) {
  const avg = frameTimeSum / frameTimeCount;
  if (avg > 20 && runtimeTier === 'high') {
    runtimeTier = 'mid';
    // Destroy high-only FBOs
    if (fboD) { destroyFBO(gl, fboD); fboD = null; }
  }
  frameTimeSum = 0;
  frameTimeCount = 0;
}
```

**Step 9: Verify build**

Run: `npm run typecheck`
Expected: No errors (need to update ScrollVideoPlayer to pass `actTransition`)

**Step 10: Commit**

```bash
git add src/lib/cinema-gl.ts
git commit -m "feat(cinema): FBO infrastructure, tier detection, runtime auto-downgrade"
```

---

### Task 3: CinemaGL — Cinema Shader Rewrite

Rewrite CINEMA_FRAG with color grading, improved CA, 2-octave grain, heat distortion.

**Files:**
- Modify: `src/lib/cinema-gl.ts` (CINEMA_FRAG shader string + new uniforms)

**Step 1: Rewrite CINEMA_FRAG**

Replace the entire CINEMA_FRAG string with:

```glsl
const CINEMA_FRAG = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_tex;
uniform float u_time;
uniform float u_energy;
uniform float u_progress;
uniform float u_bass;
uniform float u_mids;
uniform float u_highs;
uniform vec2 u_mouse;
uniform float u_velocity;
uniform float u_actTransition; // 0-1 peaks at act boundaries
out vec4 fragColor;

// --- Noise ---
float hash(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}
float hash2(vec2 p) {
  return fract(sin(dot(p, vec2(45.5432, 98.1234))) * 23421.6312);
}

// --- Narrative mood (same 9-point Hermite) ---
float getMood(float progress) {
  float moods[9] = float[9](0.5, 0.5, 0.6, 0.8, 0.9, 1.1, 1.2, 0.8, 0.5);
  float t = clamp(progress, 0.0, 1.0) * 8.0;
  int i = int(floor(t));
  int j = min(i + 1, 8);
  float f = fract(t);
  float s = f * f * (3.0 - 2.0 * f);
  return mix(moods[i], moods[j], s);
}

// --- Color grading per act ---
// Returns tint for shadows, midtones, highlights as 3x vec3
// Interpolated between adjacent acts using same Hermite as mood
struct ColorGrade {
  vec3 shadows;
  vec3 midtones;
  vec3 highlights;
};

ColorGrade getColorGrade(float progress) {
  // 8 acts: each defined by shadow/mid/highlight tints
  vec3 sh[9] = vec3[9](
    vec3(0.15,0.18,0.25), // pre-roll
    vec3(0.15,0.18,0.25), // Despertar
    vec3(0.12,0.15,0.28), // Entrada
    vec3(0.20,0.12,0.22), // Danza
    vec3(0.25,0.10,0.10), // Espectáculo
    vec3(0.30,0.08,0.08), // Fuego
    vec3(0.08,0.05,0.05), // Clímax
    vec3(0.10,0.12,0.20), // Resolución
    vec3(0.15,0.18,0.25)  // Cierre
  );
  vec3 mt[9] = vec3[9](
    vec3(1.0,1.0,1.0),
    vec3(1.0,1.0,1.0),
    vec3(1.0,0.98,0.90),
    vec3(1.0,0.92,0.75),
    vec3(1.0,0.85,0.65),
    vec3(1.0,0.70,0.50),
    vec3(1.0,0.60,0.45),
    vec3(0.95,0.90,1.0),
    vec3(1.0,1.0,1.0)
  );
  vec3 hl[9] = vec3[9](
    vec3(1.0,0.96,0.90),
    vec3(1.0,0.95,0.85),
    vec3(1.0,0.97,0.92),
    vec3(1.0,0.90,0.70),
    vec3(1.0,0.88,0.55),
    vec3(1.0,0.92,0.75),
    vec3(1.0,0.85,0.40),
    vec3(0.95,0.95,1.0),
    vec3(1.0,0.96,0.90)
  );

  float t = clamp(progress, 0.0, 1.0) * 8.0;
  int i = int(floor(t));
  int j = min(i + 1, 8);
  float f = fract(t);
  float s = f * f * (3.0 - 2.0 * f);

  ColorGrade g;
  g.shadows = mix(sh[i], sh[j], s);
  g.midtones = mix(mt[i], mt[j], s);
  g.highlights = mix(hl[i], hl[j], s);
  return g;
}

vec3 applyColorGrade(vec3 c, ColorGrade grade) {
  float lum = dot(c, vec3(0.2126, 0.7152, 0.0722));
  // Shadow/mid/highlight zones via smoothstep
  float shadowW = 1.0 - smoothstep(0.0, 0.35, lum);
  float highlightW = smoothstep(0.65, 1.0, lum);
  float midW = 1.0 - shadowW - highlightW;

  vec3 graded = c;
  graded = mix(graded, graded * (grade.shadows / max(grade.shadows, vec3(0.01))) * 1.2, shadowW * 0.4);
  graded *= mix(vec3(1.0), grade.midtones, midW * 0.3);
  graded = mix(graded, graded * grade.highlights, highlightW * 0.25);
  return graded;
}

void main() {
  vec2 uv = v_uv;
  float mood = getMood(u_progress);
  float dCenter = length(uv - 0.5);
  vec2 cursorOffset = uv - u_mouse;
  float dCursor = length(cursorOffset);

  // --- Heat distortion (gated by energy * bass > 0.3) ---
  float heatIntensity = max(0.0, u_energy * u_bass - 0.3) * mood;
  vec2 heat = vec2(
    sin(uv.y * 30.0 + u_time * 3.0) * 0.003,
    cos(uv.x * 25.0 + u_time * 2.5) * 0.002
  ) * heatIntensity;
  uv += heat;

  // --- Chromatic aberration (improved: quadratic, prismatic, wider range) ---
  float caBase = dCenter * dCenter * 0.004 * (1.0 + u_energy * 3.0 + u_mids * 2.0) * mood;
  float caVelocity = u_velocity * 0.003 * mood;
  vec2 radialDir = normalize(uv - 0.5 + 0.001);
  vec2 tangentDir = vec2(-radialDir.y, radialDir.x);
  vec2 caDir = normalize(cursorOffset + 0.001) * dCursor * 0.0015 * u_energy;

  vec3 c;
  c.r = texture(u_tex, uv + radialDir * (caBase + caVelocity) + caDir).r;
  c.g = texture(u_tex, uv + tangentDir * caBase * 0.3).g;
  c.b = texture(u_tex, uv - radialDir * (caBase + caVelocity) - caDir).b;

  // --- Color grading per act ---
  ColorGrade grade = getColorGrade(u_progress);
  c = applyColorGrade(c, grade);

  // --- Vignette with bass pulse ---
  float bassPulse = u_bass * 0.08;
  float vigEdge = 0.7 - mood * 0.1 + bassPulse;
  float vigCenter = 0.3 - mood * 0.05 + bassPulse;
  c *= mix(0.2 + (1.0 - mood) * 0.15, 1.0, smoothstep(vigEdge, vigCenter, dCenter));

  // --- Cursor spotlight (improved: quadratic falloff, act-tinted) ---
  float spot = pow(1.0 - smoothstep(0.0, 0.35, dCursor), 2.0);
  vec3 spotTint = mix(vec3(1.0), grade.highlights, 0.3);
  c += c * spot * 0.12 * u_energy * spotTint;

  // --- Film grain (2-octave FBM, shadow-weighted) ---
  float lum = dot(c, vec3(0.2126, 0.7152, 0.0722));
  float grainAmt = (0.03 + mood * 0.05) * (1.0 - lum * 0.5);
  float grain = hash(uv * 800.0 + fract(u_time)) * 0.6
              + hash2(uv * 1600.0 + fract(u_time * 1.3)) * 0.4;
  c += (grain * 2.0 - 1.0) * grainAmt;

  fragColor = vec4(c, 1.0);
}`;
```

**Step 2: Add u_actTransition uniform**

In the initCinemaGL function, after the existing uniform locations:

```typescript
const cUActTransition = gl.getUniformLocation(cinemaProg, "u_actTransition");
```

And in the render function, set it:

```typescript
gl.uniform1f(cUActTransition, params.actTransition);
```

**Step 3: Verify build**

Run: `npm run typecheck`
Expected: No errors

**Step 4: Verify dev server renders correctly**

Run: `npm run dev`
Open browser, scroll through page. Video should show:
- Quadratic CA stronger at edges
- Color shifting between acts
- Visible grain in dark areas
- Heat distortion when scrolling fast over bass notes

**Step 5: Commit**

```bash
git add src/lib/cinema-gl.ts
git commit -m "feat(cinema): color grading per act, prismatic CA, FBM grain, heat distortion"
```

---

### Task 4: CinemaGL — Bloom Pipeline (Kawase)

Add bloom threshold + 3-iteration Kawase blur passes.

**Files:**
- Modify: `src/lib/cinema-gl.ts`

**Step 1: Add bloom threshold shader**

New shader that reads from FBO_A, outputs bright pixels only to FBO_B (half-res):

```glsl
const BLOOM_THRESH_FRAG = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_tex;
uniform float u_threshold;
out vec4 fragColor;
void main() {
  vec3 c = texture(u_tex, v_uv).rgb;
  float lum = dot(c, vec3(0.2126, 0.7152, 0.0722));
  float excess = max(0.0, lum - u_threshold);
  fragColor = vec4(c * excess, 1.0);
}`;
```

**Step 2: Add Kawase blur shader**

```glsl
const KAWASE_BLUR_FRAG = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_tex;
uniform vec2 u_texelSize;
uniform float u_offset;
out vec4 fragColor;
void main() {
  vec2 off = u_texelSize * (u_offset + 0.5);
  vec4 c = texture(u_tex, v_uv + vec2(-off.x, -off.y))
         + texture(u_tex, v_uv + vec2( off.x, -off.y))
         + texture(u_tex, v_uv + vec2(-off.x,  off.y))
         + texture(u_tex, v_uv + vec2( off.x,  off.y));
  fragColor = c * 0.25;
}`;
```

**Step 3: Create bloom programs and uniform locations**

Inside initCinemaGL, create two more programs:

```typescript
// Bloom threshold program
const bloomThreshProg = createProgram(gl, CINEMA_VERT, BLOOM_THRESH_FRAG);
const btUTex = gl.getUniformLocation(bloomThreshProg, "u_tex");
const btUThreshold = gl.getUniformLocation(bloomThreshProg, "u_threshold");

// Kawase blur program
const kawaseProg = createProgram(gl, CINEMA_VERT, KAWASE_BLUR_FRAG);
const kUTex = gl.getUniformLocation(kawaseProg, "u_tex");
const kUTexelSize = gl.getUniformLocation(kawaseProg, "u_texelSize");
const kUOffset = gl.getUniformLocation(kawaseProg, "u_offset");
```

Also add a `createProgram` helper to reduce repeated boilerplate:

```typescript
function createProgram(gl: WebGL2RenderingContext, vertSrc: string, fragSrc: string): WebGLProgram | null {
  const vs = compile(gl, gl.VERTEX_SHADER, vertSrc);
  const fs = compile(gl, gl.FRAGMENT_SHADER, fragSrc);
  if (!vs || !fs) return null;
  const prog = gl.createProgram();
  if (!prog) return null;
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    console.warn('CinemaGL: program link failed:', gl.getProgramInfoLog(prog));
    return null;
  }
  return prog;
}
```

**Step 4: Add bloom passes to render function**

After cinema pass (Pass 1), before particles:

```typescript
// --- Pass 2: Bloom threshold (FBO_A → FBO_B, half-res) ---
if (fboA && fboB && bloomThreshProg) {
  gl.bindFramebuffer(gl.FRAMEBUFFER, fboB.framebuffer);
  gl.viewport(0, 0, fboB.width, fboB.height);
  gl.useProgram(bloomThreshProg);
  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D, fboA.texture);
  gl.uniform1i(btUTex, 1);
  const mood = getMoodCPU(params.progress); // need CPU-side mood
  const threshold = 0.75 - mood * 0.1 - params.bands.highs * 0.15;
  gl.uniform1f(btUThreshold, Math.max(0.3, threshold));
  gl.bindVertexArray(cinemaVAO);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

  // --- Pass 3: Kawase blur (FBO_B ↔ FBO_B2, 3 iterations) ---
  if (fboB2 && kawaseProg) {
    gl.useProgram(kawaseProg);
    const tw = 1.0 / fboB.width;
    const th = 1.0 / fboB.height;
    gl.uniform2f(kUTexelSize, tw, th);

    for (let i = 0; i < 3; i++) {
      const readFbo = i % 2 === 0 ? fboB : fboB2;
      const writeFbo = i % 2 === 0 ? fboB2 : fboB;

      gl.bindFramebuffer(gl.FRAMEBUFFER, writeFbo.framebuffer);
      gl.viewport(0, 0, writeFbo.width, writeFbo.height);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, readFbo.texture);
      gl.uniform1i(kUTex, 1);
      gl.uniform1f(kUOffset, float(i));
      gl.bindVertexArray(cinemaVAO);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
  }
}
```

**Step 5: Add CPU-side getMood helper**

```typescript
function getMoodCPU(progress: number): number {
  const moods = [0.5, 0.5, 0.6, 0.8, 0.9, 1.1, 1.2, 0.8, 0.5];
  const t = Math.min(Math.max(progress, 0), 1) * 8;
  const i = Math.floor(t);
  const j = Math.min(i + 1, 8);
  const f = t - i;
  const s = f * f * (3 - 2 * f);
  return moods[i] + (moods[j] - moods[i]) * s;
}
```

**Step 6: Verify build + dev server**

Run: `npm run typecheck && npm run dev`
Expected: Bloom halos visible around bright areas in the video, especially during climax sections.

**Step 7: Commit**

```bash
git add src/lib/cinema-gl.ts
git commit -m "feat(cinema): Kawase bloom pipeline — threshold + 3-iteration blur"
```

---

### Task 5: CinemaGL — Composite Pass

Final composite: FBO_A (cinema) + bloom + motion blur + anamorphic flare + film burn → screen.

**Files:**
- Modify: `src/lib/cinema-gl.ts`

**Step 1: Write composite fragment shader**

```glsl
const COMPOSITE_FRAG = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_cinema;     // FBO_A
uniform sampler2D u_bloom;      // FBO_B (blurred)
uniform sampler2D u_prevFrame;  // FBO_D (previous frame, for motion blur)
uniform float u_mood;
uniform float u_velocity;
uniform float u_highs;
uniform float u_actTransition;
uniform bool u_useMotionBlur;
uniform bool u_useFlare;
out vec4 fragColor;

void main() {
  vec3 cinema = texture(u_cinema, v_uv).rgb;
  vec3 bloom = texture(u_bloom, v_uv).rgb;

  // --- Bloom composite ---
  float bloomStr = 0.4 + u_mood * 0.3;
  vec3 c = cinema + bloom * bloomStr;

  // --- Motion blur (High tier only) ---
  if (u_useMotionBlur) {
    vec3 prev = texture(u_prevFrame, v_uv).rgb;
    float blurFactor = u_velocity * 0.3;
    c = mix(c, prev, blurFactor);
  }

  // --- Anamorphic lens flare (High tier only) ---
  if (u_useFlare) {
    float flare = 0.0;
    for (int i = -8; i <= 8; i++) {
      vec2 off = vec2(float(i) * 0.012, 0.0);
      float s = texture(u_bloom, v_uv + off).r;
      float w = 1.0 - abs(float(i)) / 8.0;
      flare += s * w * w; // quadratic falloff for softer streaks
    }
    flare *= 0.12 * u_mood;
    c += flare * vec3(0.7, 0.85, 1.0); // blue-cyan tint
  }

  // --- Film burn at act transitions ---
  float burn = smoothstep(0.0, 0.15, u_actTransition) * smoothstep(0.3, 0.15, u_actTransition);
  vec3 leak = mix(vec3(1.0, 0.6, 0.2), vec3(1.0, 0.9, 0.5), v_uv.x);
  c = mix(c, leak, burn * 0.35);

  fragColor = vec4(c, 1.0);
}`;
```

**Step 2: Create composite program and uniforms**

```typescript
const compositeProg = createProgram(gl, CINEMA_VERT, COMPOSITE_FRAG);
const cpUCinema = gl.getUniformLocation(compositeProg, "u_cinema");
const cpUBloom = gl.getUniformLocation(compositeProg, "u_bloom");
const cpUPrevFrame = gl.getUniformLocation(compositeProg, "u_prevFrame");
const cpUMood = gl.getUniformLocation(compositeProg, "u_mood");
const cpUVelocity = gl.getUniformLocation(compositeProg, "u_velocity");
const cpUHighs = gl.getUniformLocation(compositeProg, "u_highs");
const cpUActTransition = gl.getUniformLocation(compositeProg, "u_actTransition");
const cpUUseMotionBlur = gl.getUniformLocation(compositeProg, "u_useMotionBlur");
const cpUUseFlare = gl.getUniformLocation(compositeProg, "u_useFlare");
```

**Step 3: Add composite pass to render**

After bloom passes, before particles:

```typescript
// --- Pass 4: Composite (FBO_A + bloom + prev frame → screen) ---
if (fboA && compositeProg) {
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.viewport(0, 0, w, h);
  gl.useProgram(compositeProg);

  // Bind textures
  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D, fboA.texture);
  gl.uniform1i(cpUCinema, 1);

  // Bloom result is in the last-written fbo (depends on iteration count)
  const bloomResult = (3 % 2 === 0) ? fboB : fboB2;
  gl.activeTexture(gl.TEXTURE2);
  gl.bindTexture(gl.TEXTURE_2D, bloomResult!.texture);
  gl.uniform1i(cpUBloom, 2);

  // Previous frame (motion blur)
  if (fboD) {
    gl.activeTexture(gl.TEXTURE3);
    gl.bindTexture(gl.TEXTURE_2D, fboD.texture);
    gl.uniform1i(cpUPrevFrame, 3);
  }

  const mood = getMoodCPU(params.progress);
  gl.uniform1f(cpUMood, mood);
  gl.uniform1f(cpUVelocity, params.velocity);
  gl.uniform1f(cpUHighs, params.bands.highs);
  gl.uniform1f(cpUActTransition, params.actTransition);
  gl.uniform1i(cpUUseMotionBlur, fboD ? 1 : 0);
  gl.uniform1i(cpUUseFlare, runtimeTier === 'high' ? 1 : 0);

  gl.bindVertexArray(cinemaVAO);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

  // Copy current composite to FBO_D for next frame's motion blur
  if (fboD) {
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, fboD.framebuffer);
    gl.blitFramebuffer(0, 0, w, h, 0, 0, w, h, gl.COLOR_BUFFER_BIT, gl.NEAREST);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
  }
}
```

**Step 4: Remove old single-pass bloom from CINEMA_FRAG**

The old bloom code in the cinema shader (lines 97-100 of original) is already gone since Task 3 replaced the entire shader. Verify it's not present.

**Step 5: Verify build + visual**

Run: `npm run typecheck && npm run dev`
Expected:
- Soft bloom halos around bright areas
- Motion trails on fast scroll (desktop)
- Blue-cyan horizontal flare streaks from brightest spots
- Orange film burn flash at act transitions

**Step 6: Commit**

```bash
git add src/lib/cinema-gl.ts
git commit -m "feat(cinema): composite pass — motion blur, anamorphic flare, film burn"
```

---

### Task 6: CinemaGL — Particle System Upgrade

1000 particles, velocity persistence, cursor trails, act burst.

**Files:**
- Modify: `src/lib/cinema-gl.ts`

**Step 1: Increase particle count and add types**

```typescript
const PARTICLE_COUNT_HIGH = 1000;
const PARTICLE_COUNT_MID = 500;
const CURSOR_TRAIL_COUNT = 100;
const BURST_COUNT = 50; // reuses dead slots

interface Particle {
  x: number; y: number;
  vx: number; vy: number;
  life: number; maxLife: number;
  size: number;
  isCursorTrail: boolean;
}
```

Choose count based on `effectiveTier`:
```typescript
const particleCount = effectiveTier === 'high'
  ? PARTICLE_COUNT_HIGH + CURSOR_TRAIL_COUNT
  : effectiveTier === 'mid'
    ? PARTICLE_COUNT_MID
    : 0;
```

**Step 2: Add luminance grid for CPU-side velocity persistence**

```typescript
// CPU-side luminance grid (48x20) — updated every 10 frames from canvas
const GRID_W = 48;
const GRID_H = 20;
const lumGrid = new Float32Array(GRID_W * GRID_H);
let lumGridFrame = 0;
const LUM_GRID_INTERVAL = 10;

function updateLuminanceGrid(): void {
  if (!fboA || contextLost) return;
  // Read from FBO_A at low resolution
  const pixels = new Uint8Array(GRID_W * GRID_H * 4);
  gl.bindFramebuffer(gl.FRAMEBUFFER, fboA.framebuffer);
  // Use a scaled readPixels (WebGL reads at framebuffer res, so we need to sample)
  // Alternative: render FBO_A to a tiny FBO and readPixels from that
  // For simplicity, read full and downsample in JS:
  // Actually, just sample corners of each grid cell
  for (let gy = 0; gy < GRID_H; gy++) {
    for (let gx = 0; gx < GRID_W; gx++) {
      const px = Math.floor((gx / GRID_W) * w);
      const py = Math.floor((gy / GRID_H) * h);
      // We can't readPixels per-pixel efficiently — use a different approach:
      // Render to tiny FBO
    }
  }
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
}
```

Actually, reading per-pixel from GPU is expensive. Better approach: keep the luminance grid approximated from the video texture via a small readback FBO:

```typescript
// Create a tiny FBO for luminance readback
let lumFBO: FBO | null = null;
if (effectiveTier !== 'low') {
  lumFBO = createFBO(gl, GRID_W, GRID_H);
}

function updateLuminanceGrid(): void {
  if (!lumFBO || !fboA) return;
  // Blit FBO_A → lumFBO (downscaled)
  gl.bindFramebuffer(gl.READ_FRAMEBUFFER, fboA.framebuffer);
  gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, lumFBO.framebuffer);
  gl.blitFramebuffer(0, 0, fboA.width, fboA.height, 0, 0, GRID_W, GRID_H, gl.COLOR_BUFFER_BIT, gl.LINEAR);
  gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);
  gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);

  // Read back
  const pixels = new Uint8Array(GRID_W * GRID_H * 4);
  gl.bindFramebuffer(gl.FRAMEBUFFER, lumFBO.framebuffer);
  gl.readPixels(0, 0, GRID_W, GRID_H, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);

  // Convert to luminance
  for (let i = 0; i < GRID_W * GRID_H; i++) {
    const r = pixels[i * 4] / 255;
    const g = pixels[i * 4 + 1] / 255;
    const b = pixels[i * 4 + 2] / 255;
    lumGrid[i] = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }
}

function sampleLumGrid(px: number, py: number): { lum: number; gx: number; gy: number } {
  const gx = Math.floor((px / w) * (GRID_W - 1));
  const gy = Math.floor((py / h) * (GRID_H - 1));
  const idx = gy * GRID_W + gx;
  return {
    lum: lumGrid[idx] ?? 0,
    gx: ((lumGrid[Math.min(idx + 1, lumGrid.length - 1)] ?? 0) - (lumGrid[Math.max(idx - 1, 0)] ?? 0)) * 0.5,
    gy: ((lumGrid[Math.min(idx + GRID_W, lumGrid.length - 1)] ?? 0) - (lumGrid[Math.max(idx - GRID_W, 0)] ?? 0)) * 0.5,
  };
}
```

**Step 3: Update particle physics with velocity persistence**

In the CPU physics loop:

```typescript
const LUMINANCE_FORCE = 2.0;
const CURSOR_FORCE = 0.8;

for (let i = 0; i < particleCount; i++) {
  const p = particles[i];
  p.life -= dt * speed;
  if (p.life <= 0) {
    resetParticle(p, w, h, i >= PARTICLE_COUNT_HIGH); // cursor trail flag
    continue;
  }

  // Luminance gradient force (persistent velocity, not position offset)
  if (lumGridFrame > 0) {
    const sample = sampleLumGrid(p.x, p.y);
    p.vx += sample.gx * LUMINANCE_FORCE * energy * dt;
    p.vy += sample.gy * LUMINANCE_FORCE * energy * dt;
  }

  // Cursor attraction (as velocity, not position)
  const toCursorX = mouseX - p.x;
  const toCursorY = mouseY - p.y;
  const cursorDist = Math.sqrt(toCursorX * toCursorX + toCursorY * toCursorY) + 1;
  if (cursorDist < 300) {
    const pull = (1 - cursorDist / 300) * CURSOR_FORCE * energy;
    p.vx += (toCursorX / cursorDist) * pull * dt;
    p.vy += (toCursorY / cursorDist) * pull * dt;
  }

  // Damping (prevents infinite acceleration)
  p.vx *= 0.98;
  p.vy *= 0.98;

  p.x += p.vx * dt * 60;
  p.y += p.vy * dt * 60;
  p.y -= 0.15 * dt * speed * 60;

  // Wrap
  if (p.x < -20) p.x = w + 20;
  if (p.x > w + 20) p.x = -20;
  if (p.y < -20) p.y = h + 20;
  if (p.y > h + 20) p.y = -20;

  // Alpha with bass/size pulse (size leads by 2 frames)
  // ... (existing fade-in/out code, enhanced)
}
```

**Step 4: Add cursor trail spawning**

Add a method to spawn cursor trail particles from the mouse position:

```typescript
// In render, when mouse has moved:
if (effectiveTier === 'high') {
  const trailStart = PARTICLE_COUNT_HIGH;
  const trailEnd = trailStart + CURSOR_TRAIL_COUNT;
  // Find a dead cursor trail particle and respawn it at cursor
  for (let i = trailStart; i < trailEnd; i++) {
    if (particles[i].life <= 0) {
      const p = particles[i];
      p.x = mouseX;
      p.y = mouseY;
      p.vx = (Math.random() - 0.5) * 2;
      p.vy = (Math.random() - 0.5) * 2;
      p.life = 0.8 + Math.random() * 0.5; // shorter lived
      p.maxLife = p.life;
      p.size = 1.5 + Math.random() * 2;
      p.isCursorTrail = true;
      break; // one per frame
    }
  }
}
```

**Step 5: Add particle burst on act change**

Track previous act index, and when it changes burst 50 particles:

```typescript
let lastActIndex = 0;

// In render:
const actIndex = Math.floor(params.progress * 8);
if (actIndex !== lastActIndex && actIndex > 0) {
  lastActIndex = actIndex;
  // Burst: reset 50 random particles with high velocity outward from center
  let burst = 0;
  for (let i = 0; i < particleCount && burst < BURST_COUNT; i++) {
    const p = particles[i];
    if (p.life < p.maxLife * 0.3) { // nearly dead = safe to reuse
      p.x = w * 0.5 + (Math.random() - 0.5) * w * 0.3;
      p.y = h * 0.5 + (Math.random() - 0.5) * h * 0.3;
      const angle = Math.random() * Math.PI * 2;
      const speed = 3 + Math.random() * 5;
      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed;
      p.life = 0.5 + Math.random() * 0.3;
      p.maxLife = p.life;
      p.size = 3 + Math.random() * 3;
      burst++;
    }
  }
}
```

**Step 6: Update particle buffer and draw call**

```typescript
const particleData = new Float32Array(particleCount * STRIDE);
// ... update bufferData size ...
gl.bufferData(gl.ARRAY_BUFFER, particleData.byteLength, gl.DYNAMIC_DRAW);
// ... drawArrays count ...
gl.drawArrays(gl.POINTS, 0, particleCount);
```

**Step 7: Update luminance grid periodically**

```typescript
// In render, before particle physics:
lumGridFrame++;
if (lumGridFrame % LUM_GRID_INTERVAL === 0 && fboA) {
  updateLuminanceGrid();
}
```

**Step 8: Verify build + visual**

Run: `npm run typecheck && npm run dev`
Expected: Dense particle field, particles visibly drifting toward bright video areas, cursor leaves a trail of sparks, burst on act transitions.

**Step 9: Commit**

```bash
git add src/lib/cinema-gl.ts
git commit -m "feat(cinema): 1100 particles, luminance velocity persistence, cursor trails, act burst"
```

---

### Task 7: ScrollVideoPlayer — Velocity, Impulse, Shake, Letterbox

**Files:**
- Modify: `src/components/ui/ScrollVideoPlayer.tsx`

**Step 1: Update velocity normalization**

```typescript
// Line ~357: change 2000 to 5000
velocityRef.current = Math.min(1.0, rawVelocity / 5000);
```

**Step 2: Pass proportional impulse**

```typescript
// Line ~359: pass normalized velocity to addImpulse
const normVel = Math.min(1.0, rawVelocity / 5000);
momentumRef.current?.addImpulse(normVel);
```

**Step 3: Compute act transition**

Add a ref to track act boundaries and compute transition value:

```typescript
const lastActRef = useRef(0);
const actTransitionRef = useRef(0);

// In the render loop tick():
// Decay act transition toward 0
actTransitionRef.current *= 0.95;
const actIndex = Math.floor(progressRef.current * 8);
if (actIndex !== lastActRef.current && actIndex > 0) {
  lastActRef.current = actIndex;
  actTransitionRef.current = 1.0;
}
```

Pass to cinema.render:

```typescript
cinema.render({
  // ... existing params ...
  actTransition: actTransitionRef.current,
});
```

**Step 4: Add bass screen shake**

```typescript
const shakeRef = useRef({ x: 0, y: 0 });
const stickyRef = useRef<HTMLDivElement>(null);

// In render loop tick(), after bands:
if (bands.bass > 0.7 && e > 0.3) {
  const intensity = (bands.bass - 0.7) * 5; // 0-1.5
  shakeRef.current.x = (Math.random() - 0.5) * intensity * 3;
  shakeRef.current.y = (Math.random() - 0.5) * intensity * 3;
} else {
  shakeRef.current.x *= 0.8;
  shakeRef.current.y *= 0.8;
}

// Apply shake to sticky div via ref (no re-render)
const sticky = stickyRef.current;
if (sticky && (Math.abs(shakeRef.current.x) > 0.1 || Math.abs(shakeRef.current.y) > 0.1)) {
  sticky.style.transform = `translate(${shakeRef.current.x}px, ${shakeRef.current.y}px)`;
} else if (sticky) {
  sticky.style.transform = '';
}
```

Add ref to the sticky div:

```tsx
<div ref={stickyRef} className="sticky top-0 w-full h-dvh overflow-hidden">
```

**Step 5: Add dynamic letterbox**

Add letterbox bar elements inside the sticky div:

```tsx
{/* Dynamic letterbox bars */}
<div
  ref={letterboxTopRef}
  className="absolute top-0 left-0 right-0 z-30 pointer-events-none"
  style={{ background: 'var(--bg-void)', height: '4vh', transformOrigin: 'top' }}
/>
<div
  ref={letterboxBottomRef}
  className="absolute bottom-0 left-0 right-0 z-30 pointer-events-none"
  style={{ background: 'var(--bg-void)', height: '4vh', transformOrigin: 'bottom' }}
/>
```

In the render loop, animate letterbox height based on mood:

```typescript
const letterboxTopRef = useRef<HTMLDivElement>(null);
const letterboxBottomRef = useRef<HTMLDivElement>(null);

// In tick():
const mood = 0.5 + progressRef.current * 0.7; // approximate
const barScale = 1.3 - mood * 0.4; // calm=1.1 (thick), intense=0.7 (thin)
const clampedScale = Math.max(0.5, Math.min(1.5, barScale));
if (letterboxTopRef.current) {
  letterboxTopRef.current.style.transform = `scaleY(${clampedScale})`;
}
if (letterboxBottomRef.current) {
  letterboxBottomRef.current.style.transform = `scaleY(${clampedScale})`;
}
```

**Step 6: Verify build**

Run: `npm run typecheck`
Expected: No errors

**Step 7: Commit**

```bash
git add src/components/ui/ScrollVideoPlayer.tsx
git commit -m "feat(scroll): proportional impulse, bass shake, dynamic letterbox, act transitions"
```

---

### Task 8: ScrollStoryOverlay — Exit Animations + Parallax + Reactive Typography

**Files:**
- Modify: `src/components/ui/ScrollStoryOverlay.tsx`
- Modify: `src/app/page.tsx` (pass energy + bands to overlay)

**Step 1: Add GSAP exit animations**

Replace CSS opacity exit with GSAP timeline reverse. In `AnimatedBeat`:

```typescript
const tlRef = useRef<gsap.core.Timeline | null>(null);

useLayoutEffect(() => {
  // ... existing setup ...
  // Store timeline reference for exit
  if (splitTargets.length > 0) {
    const tl = gsap.timeline();
    // ... existing entry animations ...
    tlRef.current = tl;
  }
  // ...
}, [beat.animation]);

// Exit: reverse GSAP timeline when progress > 0.8
useEffect(() => {
  if (progress > 0.8 && tlRef.current) {
    const exitProgress = (progress - 0.8) / 0.2; // 0-1
    tlRef.current.progress(1 - exitProgress);
  }
}, [progress]);
```

Remove the CSS opacity exit — the GSAP reverse handles it.

**Step 2: Add parallax depth via data attribute**

Add `data-depth` to story beat content for key elements. In the story beats definition:

```tsx
// Hero title gets depth 1.2 (moves faster than scroll)
<div className="text-center" data-depth="1.2">
// Stats get depth 0.8 (moves slower, feels further)
<div className="flex gap-12 md:gap-20" data-depth="0.8">
```

In `AnimatedBeat`, apply parallax offset based on depth:

```typescript
// Parallax: apply transform based on scroll progress and depth
const depth = parseFloat(ref.current?.querySelector('[data-depth]')?.getAttribute('data-depth') || '1');
const parallaxOffset = (progress - 0.5) * (depth - 1) * 50; // px
```

Apply via inline transform on the container.

**Step 3: Add sound-reactive typography**

Add `data-reactive` attribute to key text elements. In `AnimatedBeat`, when energy/bands are available:

```typescript
// Sound-reactive: modulate letter-spacing with mids
const reactiveEls = el.querySelectorAll('[data-reactive]');
reactiveEls.forEach(el => {
  el.style.letterSpacing = `${0.3 + bands.mids * 0.15}em`;
});
```

This needs energy and bands props passed down from `page.tsx` through `ScrollStoryOverlay`.

**Step 4: Update ScrollStoryOverlay props**

```typescript
interface ScrollStoryOverlayProps {
  currentFrame: number;
  energy?: number;
  bands?: FrequencyBands;
}
```

**Step 5: Update page.tsx to pass energy + bands**

```tsx
<ScrollStoryOverlay
  currentFrame={currentFrame}
  energy={displayEnergy}
  bands={displayBands}
/>
```

**Step 6: Verify build + visual**

Run: `npm run typecheck && npm run dev`
Expected: Text now reverses out on exit (slides back, blurs back). Elements with depth shift on scroll. Text spacing pulses with audio.

**Step 7: Commit**

```bash
git add src/components/ui/ScrollStoryOverlay.tsx src/app/page.tsx
git commit -m "feat(overlay): GSAP exit animations, parallax depth, sound-reactive typography"
```

---

### Task 9: Page Layout — Atmospheric Haze

**Files:**
- Modify: `src/app/page.tsx`

**Step 1: Add haze overlay div**

Inside the ScrollVideoPlayer children, add a haze layer:

```tsx
<ScrollVideoPlayer ...>
  <ScrollStoryOverlay ... />
  {/* Atmospheric haze — shifts color with narrative progress */}
  <div
    ref={hazeRef}
    className="absolute inset-0 z-10 pointer-events-none"
    style={{
      background: 'radial-gradient(ellipse at 50% 100%, var(--haze-color, rgba(10,10,20,0.08)), transparent 70%)',
      opacity: 0.08,
      transition: 'opacity 2s ease',
    }}
  />
</ScrollVideoPlayer>
```

**Step 2: Update haze color with progress**

In the 10fps `setInterval`, also update the haze:

```typescript
const hazeRef = useRef<HTMLDivElement>(null);

useEffect(() => {
  const id = setInterval(() => {
    setDisplayEnergy(energyRef.current);
    setDisplayBands({ ...bandsRef.current });

    // Update haze color based on approximate act
    if (hazeRef.current) {
      const p = progressRef.current;
      let color: string;
      if (p < 0.25) color = 'rgba(10,15,30,0.08)';      // blue-black
      else if (p < 0.5) color = 'rgba(25,18,10,0.10)';   // warm amber
      else if (p < 0.75) color = 'rgba(30,8,8,0.12)';    // red-black
      else color = 'rgba(10,12,25,0.06)';                  // cool fade
      hazeRef.current.style.setProperty('--haze-color', color);
    }
  }, 100);
  return () => clearInterval(id);
}, []);
```

**Step 3: Need progressRef in page.tsx**

Add a progress ref passed from ScrollVideoPlayer. Add `onProgressChange` callback:

```typescript
// In ScrollVideoPlayer, add to props:
onProgressChange?: (progress: number) => void;

// In onUpdate:
onProgressChangeRef.current?.(self.progress);
```

```typescript
// In page.tsx:
const progressRef = useRef(0);
const handleProgressChange = useCallback((p: number) => {
  progressRef.current = p;
}, []);
```

**Step 4: Verify build + visual**

Run: `npm run typecheck && npm run dev`
Expected: Subtle atmospheric gradient visible at bottom of viewport, color shifts warm/red/cool across the experience.

**Step 5: Commit**

```bash
git add src/app/page.tsx src/components/ui/ScrollVideoPlayer.tsx
git commit -m "feat(page): atmospheric haze overlay shifting with narrative progress"
```

---

### Task 10: PianoIndicator — Updated Band Boundaries

**Files:**
- Modify: `src/components/ui/PianoIndicator.tsx`

**Step 1: Adjust bar heights for new band ranges**

The new bass band (0-516Hz) will have lower values since it covers fewer bins. Adjust the bar height multipliers:

```typescript
const barHeights = [
  0.2 + b.highs * 0.8,   // outer high (more range since highs now broader)
  0.4 + b.mids * 0.6,    // mid
  0.5 + b.bass * 0.5,    // center bass (narrower band = sharper peaks)
  0.4 + b.mids * 0.6,    // mid
  0.2 + b.highs * 0.8,   // outer high
];
```

**Step 2: Verify visual**

Run: `npm run dev`
Expected: PianoIndicator bars respond more sharply to actual bass hits (low piano notes), mids react to melody.

**Step 3: Commit**

```bash
git add src/components/ui/PianoIndicator.tsx
git commit -m "feat(piano): adjusted bar heights for refined frequency band boundaries"
```

---

### Task 11: Integration Testing + Final Typecheck

**Files:** None (verification only)

**Step 1: Full typecheck**

Run: `npm run typecheck`
Expected: No errors

**Step 2: Production build**

Run: `npm run build`
Expected: Build succeeds without errors

**Step 3: Visual testing in dev server**

Run: `npm run dev`

Verify in browser:
- [ ] Color grading shifts visible across acts
- [ ] Bloom halos around bright areas
- [ ] Motion blur on fast scroll
- [ ] Anamorphic flare on very bright spots
- [ ] Film burn flash at act transitions
- [ ] Heat distortion on fast scroll + bass
- [ ] Dense particle field (1000+)
- [ ] Particles drift toward bright areas over time
- [ ] Cursor leaves particle trail
- [ ] Particle burst at act changes
- [ ] Bass screen shake on strong low notes
- [ ] Dynamic letterbox breathing
- [ ] Text exit animations (reverse of entry)
- [ ] Atmospheric haze color shift
- [ ] Piano indicator responsive to refined bands
- [ ] `prefers-reduced-motion` → low tier (raw video, text only)
- [ ] No console errors or WebGL warnings

**Step 4: Final commit**

```bash
git commit -m "feat: cinema pipeline upgrade complete — full Awwwards-quality"
```

---

## Execution Order + Dependencies

```
Task 1 (AudioMomentum) ─────────────────────┐
Task 2 (FBO infrastructure) ─────────────────┤
                                              ├─→ Task 7 (ScrollVideoPlayer)
Task 3 (Cinema shader) ──depends on 2───────┤        │
Task 4 (Bloom pipeline) ─depends on 2,3─────┤        ├─→ Task 9 (Page: haze)
Task 5 (Composite pass) ─depends on 4───────┤        │
Task 6 (Particles) ──────depends on 2───────┘        │
                                                       │
Task 8 (ScrollStoryOverlay) ──────────────────────────┘
Task 10 (PianoIndicator) ──depends on 1─────────────────
Task 11 (Integration) ──depends on all──────────────────
```

**Parallelizable pairs:**
- Task 1 + Task 2 (independent foundations)
- Task 8 + Task 10 (independent UI changes, after Task 7)
