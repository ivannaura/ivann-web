// ---------------------------------------------------------------------------
// CinemaGL — Unified WebGL2 renderer for scroll-driven video cinema
// Multi-pass rendering pipeline:
//   Pass 1: Video post-processing → FBO_A (vignette, chromatic aberration, grain)
//   Pass 2: Bloom threshold (FBO_A → FBO_B, half-res luminance extraction)
//   Pass 3: Kawase blur (FBO_B ↔ FBO_B2, 3 iterations with increasing offset)
//   Pass 4: Composite (FBO_A + bloom + motion blur + flare + burn → screen)
//   Pass 5: Luminance-reactive particles (additive blending on screen)
//
// Tier system:
//   high — full FBO pipeline (A + B + B2 + D), all post-processing
//   mid  — reduced FBO pipeline (A + B + B2), no detail FBO
//   low  — direct to screen (no FBOs), reduced-motion or weak GPU
//
// Reactive uniforms:
//   u_bass / u_mids / u_highs — real-time frequency bands from AnalyserNode
//   u_mouse — cursor position (NDC) for interactive lens effects
//   u_velocity — scroll velocity (0-1) for motion-driven distortion
//   u_energy — accumulated scroll momentum (0-1)
//   u_progress — narrative position (0-1) for dynamic mood per act
// ---------------------------------------------------------------------------

import type { FrequencyBands } from './audio-momentum';

// ---------------------------------------------------------------------------
// Tier detection
// ---------------------------------------------------------------------------

export type CinemaTier = 'high' | 'mid' | 'low';

export function detectTier(gl: WebGL2RenderingContext): CinemaTier {
  const maxTexUnits = gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS);
  const renderer = (gl.getParameter(gl.RENDERER) || '') as string;
  const deviceMemory = (navigator as any).deviceMemory ?? 8;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (reducedMotion) return 'low';
  if (maxTexUnits >= 8 && deviceMemory >= 4 && !/Mali-4|Adreno 3|PowerVR SGX/i.test(renderer)) {
    return 'high';
  }
  return 'mid';
}

// ---------------------------------------------------------------------------
// FBO helpers
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Program creation helper
// ---------------------------------------------------------------------------

function createProgramFromSources(
  gl: WebGL2RenderingContext, vertSrc: string, fragSrc: string
): WebGLProgram | null {
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

// ---------------------------------------------------------------------------
// Shaders — Cinema (video post-processing)
// ---------------------------------------------------------------------------

const CINEMA_VERT = `#version 300 es
in vec2 a_pos;
out vec2 v_uv;
void main() {
  v_uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`;

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
out vec4 fragColor;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}
float hash2(vec2 p) {
  return fract(sin(dot(p, vec2(45.5432, 98.1234))) * 23421.6312);
}

// Smooth narrative mood — Hermite interpolation between act intensities
float getMood(float progress) {
  float moods[9] = float[9](0.5, 0.5, 0.6, 0.8, 0.9, 1.1, 1.2, 0.8, 0.5);
  float t = clamp(progress, 0.0, 1.0) * 8.0;
  int i = int(floor(t));
  int j = min(i + 1, 8);
  float f = fract(t);
  float s = f * f * (3.0 - 2.0 * f);
  return mix(moods[i], moods[j], s);
}

// Color grading — per-act shadow/midtone/highlight tints
struct ColorGrade {
  vec3 shadows;
  vec3 midtones;
  vec3 highlights;
};

ColorGrade getColorGrade(float progress) {
  vec3 sh[9] = vec3[9](
    vec3(0.15,0.18,0.25),
    vec3(0.15,0.18,0.25),
    vec3(0.12,0.15,0.28),
    vec3(0.20,0.12,0.22),
    vec3(0.25,0.10,0.10),
    vec3(0.30,0.08,0.08),
    vec3(0.08,0.05,0.05),
    vec3(0.10,0.12,0.20),
    vec3(0.15,0.18,0.25)
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

  // --- Chromatic aberration (prismatic: quadratic falloff, asymmetric RGB) ---
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

  // --- Cursor spotlight (quadratic falloff, act-tinted) ---
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

// ---------------------------------------------------------------------------
// Shaders — Particles (luminance-reactive light motes)
// ---------------------------------------------------------------------------

const PARTICLE_VERT = `#version 300 es
in vec2 a_pos;
in float a_alpha;
in float a_size;
uniform vec2 u_res;
uniform sampler2D u_videoTex;
uniform float u_energy;
uniform float u_bass;
uniform float u_highs;
uniform vec2 u_mouse; // pixel coords

out float v_alpha;
out float v_lum;

float luminance(vec3 c) {
  return dot(c, vec3(0.2126, 0.7152, 0.0722));
}

void main() {
  // Sample video luminance at particle position
  vec2 uv = clamp(a_pos / u_res, 0.0, 1.0);
  uv.y = 1.0 - uv.y;
  float lum = luminance(texture(u_videoTex, uv).rgb);

  // Luminance gradient — nudge particles toward bright areas
  float dx = 20.0 / u_res.x;
  float dy = 20.0 / u_res.y;
  float lumR = luminance(texture(u_videoTex, clamp(uv + vec2(dx, 0.0), 0.0, 1.0)).rgb);
  float lumL = luminance(texture(u_videoTex, clamp(uv - vec2(dx, 0.0), 0.0, 1.0)).rgb);
  float lumU = luminance(texture(u_videoTex, clamp(uv - vec2(0.0, dy), 0.0, 1.0)).rgb);
  float lumD = luminance(texture(u_videoTex, clamp(uv + vec2(0.0, dy), 0.0, 1.0)).rgb);
  vec2 lumGrad = vec2(lumR - lumL, lumD - lumU);
  vec2 nudge = lumGrad * u_energy * 25.0;

  // Cursor attraction — particles drift gently toward cursor
  vec2 toCursor = u_mouse - a_pos;
  float cursorDist = length(toCursor);
  float cursorPull = smoothstep(300.0, 0.0, cursorDist) * u_energy * 15.0;
  nudge += normalize(toCursor + 0.001) * cursorPull;

  vec2 finalPos = a_pos + nudge;
  vec2 ndc = (finalPos / u_res) * 2.0 - 1.0;
  ndc.y *= -1.0;
  gl_Position = vec4(ndc, 0.0, 1.0);

  // Size: base + luminance boost + bass pulse
  gl_PointSize = a_size * (1.0 + lum * u_energy * 2.0 + u_bass * 1.5);

  v_alpha = a_alpha * (0.6 + lum * 0.5);
  v_lum = lum;
}`;

const PARTICLE_FRAG = `#version 300 es
precision mediump float;
in float v_alpha;
in float v_lum;
uniform vec3 u_colorLow;
uniform vec3 u_colorHigh;
uniform float u_energy;
uniform float u_highs;
out vec4 fragColor;

void main() {
  float d = length(gl_PointCoord - 0.5) * 2.0;
  float circle = smoothstep(1.0, 0.2, d);
  vec3 color = mix(u_colorLow, u_colorHigh, u_energy);
  // Bright video areas → whiter/hotter, boosted by highs
  color = mix(color, vec3(1.0, 0.98, 0.95), v_lum * u_energy * 0.4 + u_highs * 0.2);
  fragColor = vec4(color, circle * v_alpha);
}`;

// ---------------------------------------------------------------------------
// Shaders — Blit (passthrough for FBO → screen)
// ---------------------------------------------------------------------------

const BLIT_FRAG = `#version 300 es
precision mediump float;
in vec2 v_uv;
uniform sampler2D u_tex;
out vec4 fragColor;
void main() {
  fragColor = texture(u_tex, v_uv);
}`;

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

const COMPOSITE_FRAG = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_cinema;
uniform sampler2D u_bloom;
uniform sampler2D u_prevFrame;
uniform float u_mood;
uniform float u_velocity;
uniform float u_highs;
uniform float u_actTransition;
uniform int u_useMotionBlur;
uniform int u_useFlare;
out vec4 fragColor;

void main() {
  vec3 cinema = texture(u_cinema, v_uv).rgb;
  vec3 bloom = texture(u_bloom, v_uv).rgb;

  // --- Bloom composite ---
  float bloomStr = 0.4 + u_mood * 0.3;
  vec3 c = cinema + bloom * bloomStr;

  // --- Motion blur (High tier only) ---
  if (u_useMotionBlur == 1) {
    vec3 prev = texture(u_prevFrame, v_uv).rgb;
    float blurFactor = u_velocity * 0.3;
    c = mix(c, prev, blurFactor);
  }

  // --- Anamorphic lens flare (High tier only) ---
  if (u_useFlare == 1) {
    float flare = 0.0;
    for (int i = -8; i <= 8; i++) {
      vec2 off = vec2(float(i) * 0.012, 0.0);
      float s = texture(u_bloom, v_uv + off).r;
      float w = 1.0 - abs(float(i)) / 8.0;
      flare += s * w * w;
    }
    flare *= 0.12 * u_mood;
    c += flare * vec3(0.7, 0.85, 1.0);
  }

  // --- Film burn at act transitions ---
  float burn = smoothstep(0.0, 0.15, u_actTransition) * smoothstep(0.3, 0.15, u_actTransition);
  vec3 leak = mix(vec3(1.0, 0.6, 0.2), vec3(1.0, 0.9, 0.5), v_uv.x);
  c = mix(c, leak, burn * 0.35);

  fragColor = vec4(c, 1.0);
}`;

// ---------------------------------------------------------------------------
// Particle state (CPU-side physics)
// ---------------------------------------------------------------------------

const PARTICLE_COUNT = 250;
const STRIDE = 4; // x, y, alpha, size per vertex

interface Particle {
  x: number; y: number;
  vx: number; vy: number;
  life: number; maxLife: number;
  size: number;
}

function spawnParticle(w: number, h: number): Particle {
  return {
    x: Math.random() * w,
    y: Math.random() * h,
    vx: (Math.random() - 0.5) * 0.5,
    vy: (Math.random() - 0.5) * 0.3,
    life: 3 + Math.random() * 5,
    maxLife: 3 + Math.random() * 5,
    size: 1 + Math.random() * 3,
  };
}

/** Reset an existing particle in-place (avoids GC pressure in render loop). */
function resetParticle(p: Particle, w: number, h: number): void {
  p.x = Math.random() * w;
  p.y = Math.random() * h;
  p.vx = (Math.random() - 0.5) * 0.5;
  p.vy = (Math.random() - 0.5) * 0.3;
  p.maxLife = 3 + Math.random() * 5;
  p.life = p.maxLife;
  p.size = 1 + Math.random() * 3;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface CinemaGLParams {
  video: HTMLVideoElement;
  time: number;
  energy: number;
  progress: number;
  bands: FrequencyBands;
  mouseX: number;   // pixel coords on canvas
  mouseY: number;
  velocity: number;  // normalized 0-1
  actTransition: number; // 0-1, peaks at act boundaries
}

export interface CinemaGL {
  /** Draw one frame with all reactive parameters. */
  render(params: CinemaGLParams): void;
  /** Update canvas resolution (call on resize). */
  resize(w: number, h: number): void;
  /** Release all GL resources. */
  destroy(): void;
  /** True if the WebGL context was lost (render is a no-op, fall back to raw video). */
  readonly lost: boolean;
  /** Current rendering tier (may downgrade at runtime if GPU is slow). */
  readonly tier: CinemaTier;
}

// ---------------------------------------------------------------------------
// CPU-side mood interpolation (mirrors GLSL getMood for bloom threshold)
// ---------------------------------------------------------------------------

function getMoodCPU(progress: number): number {
  const moods = [0.5, 0.5, 0.6, 0.8, 0.9, 1.1, 1.2, 0.8, 0.5];
  const t = Math.min(Math.max(progress, 0), 1) * 8;
  const i = Math.floor(t);
  const j = Math.min(i + 1, 8);
  const f = t - i;
  const s = f * f * (3 - 2 * f);
  return moods[i] + (moods[j] - moods[i]) * s;
}

export function initCinemaGL(canvas: HTMLCanvasElement): CinemaGL | null {
  const gl = canvas.getContext("webgl2", {
    alpha: false,
    antialias: false,
    premultipliedAlpha: false,
  });
  if (!gl) {
    console.warn("CinemaGL: WebGL2 context creation failed");
    return null;
  }

  // Track context loss — skip render calls while lost
  let contextLost = false;
  const onContextLost = (e: Event) => {
    e.preventDefault();
    contextLost = true;
  };
  canvas.addEventListener("webglcontextlost", onContextLost, false);
  // Note: we do NOT handle webglcontextrestored — all GL objects (programs,
  // buffers, VAOs, textures) are invalid after restore and would need full
  // reinitialization. Instead, contextLost stays true and the render loop
  // returns early. ScrollVideoPlayer checks cinema.lost to fall back to <video>.

  // ---------------------------------------------------------------------------
  // Cinema program (video post-processing)
  // ---------------------------------------------------------------------------
  const cinemaVS = compile(gl, gl.VERTEX_SHADER, CINEMA_VERT);
  const cinemaFS = compile(gl, gl.FRAGMENT_SHADER, CINEMA_FRAG);
  if (!cinemaVS || !cinemaFS) {
    console.warn("CinemaGL: cinema shader compilation failed");
    return null;
  }

  const cinemaProg = gl.createProgram();
  if (!cinemaProg) {
    console.warn("CinemaGL: cinema program creation failed");
    return null;
  }
  gl.attachShader(cinemaProg, cinemaVS);
  gl.attachShader(cinemaProg, cinemaFS);
  gl.linkProgram(cinemaProg);
  if (!gl.getProgramParameter(cinemaProg, gl.LINK_STATUS)) {
    console.warn("CinemaGL: cinema program link failed:", gl.getProgramInfoLog(cinemaProg));
    return null;
  }

  // Cinema geometry — fullscreen quad (triangle strip)
  const quadBuf = gl.createBuffer();
  if (!quadBuf) return null;
  gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);

  // Cinema VAO
  const cinemaVAO = gl.createVertexArray();
  if (!cinemaVAO) return null;
  gl.bindVertexArray(cinemaVAO);
  const cinemaAPos = gl.getAttribLocation(cinemaProg, "a_pos");
  gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
  gl.enableVertexAttribArray(cinemaAPos);
  gl.vertexAttribPointer(cinemaAPos, 2, gl.FLOAT, false, 0, 0);
  gl.bindVertexArray(null);

  // Cinema uniforms
  gl.useProgram(cinemaProg);
  const cUTex = gl.getUniformLocation(cinemaProg, "u_tex");
  gl.uniform1i(cUTex, 0);
  const cUTime = gl.getUniformLocation(cinemaProg, "u_time");
  const cUEnergy = gl.getUniformLocation(cinemaProg, "u_energy");
  const cUProgress = gl.getUniformLocation(cinemaProg, "u_progress");
  const cUBass = gl.getUniformLocation(cinemaProg, "u_bass");
  const cUMids = gl.getUniformLocation(cinemaProg, "u_mids");
  const cUHighs = gl.getUniformLocation(cinemaProg, "u_highs");
  const cUMouse = gl.getUniformLocation(cinemaProg, "u_mouse");
  const cUVelocity = gl.getUniformLocation(cinemaProg, "u_velocity");

  // ---------------------------------------------------------------------------
  // Particle program (luminance-reactive light motes)
  // ---------------------------------------------------------------------------
  const particleVS = compile(gl, gl.VERTEX_SHADER, PARTICLE_VERT);
  const particleFS = compile(gl, gl.FRAGMENT_SHADER, PARTICLE_FRAG);
  if (!particleVS || !particleFS) {
    console.warn("CinemaGL: particle shader compilation failed");
    return null;
  }

  const particleProg = gl.createProgram();
  if (!particleProg) {
    console.warn("CinemaGL: particle program creation failed");
    return null;
  }
  gl.attachShader(particleProg, particleVS);
  gl.attachShader(particleProg, particleFS);
  gl.linkProgram(particleProg);
  if (!gl.getProgramParameter(particleProg, gl.LINK_STATUS)) {
    console.warn("CinemaGL: particle program link failed:", gl.getProgramInfoLog(particleProg));
    return null;
  }

  // Particle buffer — pre-allocate for bufferSubData updates
  const particleBuf = gl.createBuffer();
  if (!particleBuf) return null;
  const particleData = new Float32Array(PARTICLE_COUNT * STRIDE);
  gl.bindBuffer(gl.ARRAY_BUFFER, particleBuf);
  gl.bufferData(gl.ARRAY_BUFFER, particleData.byteLength, gl.DYNAMIC_DRAW);

  // Particle VAO
  const particleVAO = gl.createVertexArray();
  if (!particleVAO) return null;
  gl.bindVertexArray(particleVAO);
  const pAPos = gl.getAttribLocation(particleProg, "a_pos");
  const pAAlpha = gl.getAttribLocation(particleProg, "a_alpha");
  const pASize = gl.getAttribLocation(particleProg, "a_size");
  gl.bindBuffer(gl.ARRAY_BUFFER, particleBuf);
  const bytes = STRIDE * 4;
  gl.enableVertexAttribArray(pAPos);
  gl.vertexAttribPointer(pAPos, 2, gl.FLOAT, false, bytes, 0);
  gl.enableVertexAttribArray(pAAlpha);
  gl.vertexAttribPointer(pAAlpha, 1, gl.FLOAT, false, bytes, 8);
  gl.enableVertexAttribArray(pASize);
  gl.vertexAttribPointer(pASize, 1, gl.FLOAT, false, bytes, 12);
  gl.bindVertexArray(null);

  // Particle uniforms
  const pURes = gl.getUniformLocation(particleProg, "u_res");
  const pUColorLow = gl.getUniformLocation(particleProg, "u_colorLow");
  const pUColorHigh = gl.getUniformLocation(particleProg, "u_colorHigh");
  const pUEnergy = gl.getUniformLocation(particleProg, "u_energy");
  const pUVideoTex = gl.getUniformLocation(particleProg, "u_videoTex");
  const pUBass = gl.getUniformLocation(particleProg, "u_bass");
  const pUHighs = gl.getUniformLocation(particleProg, "u_highs");
  const pUMouse = gl.getUniformLocation(particleProg, "u_mouse");

  // Set static particle uniforms
  gl.useProgram(particleProg);
  gl.uniform3f(pUColorLow, 1.0, 0.992, 0.91);   // warm white #FFFDE8
  gl.uniform3f(pUColorHigh, 0.91, 0.784, 0.353);  // --aura-gold-bright: #E8C85A

  // ---------------------------------------------------------------------------
  // Shared video texture
  // ---------------------------------------------------------------------------
  const tex = gl.createTexture();
  if (!tex) return null;
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

  // ---------------------------------------------------------------------------
  // Particle CPU state
  // ---------------------------------------------------------------------------
  let w = canvas.width || 960;
  let h = canvas.height || 540;
  const particles: Particle[] = [];
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    particles.push(spawnParticle(w, h));
  }
  let lastTime = 0;
  let lastVideoTime = -1; // guard against redundant texImage2D uploads

  // ---------------------------------------------------------------------------
  // Tier detection + FBO infrastructure
  // ---------------------------------------------------------------------------
  const tier = detectTier(gl);

  // FBOs — only for mid+ tiers
  let fboA: FBO | null = null;
  let fboB: FBO | null = null;
  let fboB2: FBO | null = null;
  let fboD: FBO | null = null;

  if (tier !== 'low') {
    fboA = createFBO(gl, w, h);
    fboB = createFBO(gl, Math.ceil(w / 2), Math.ceil(h / 2));
    fboB2 = createFBO(gl, Math.ceil(w / 2), Math.ceil(h / 2));
    if (tier === 'high') {
      fboD = createFBO(gl, w, h);
    }
    if (!fboA || !fboB || !fboB2 || (tier === 'high' && !fboD)) {
      console.warn('CinemaGL: FBO creation failed, falling back');
      [fboA, fboB, fboB2, fboD].forEach(f => f && destroyFBO(gl, f));
      fboA = fboB = fboB2 = fboD = null;
    }
  }
  const effectiveTier: CinemaTier = fboA ? tier : 'low';

  // Blit program (passthrough FBO → screen)
  const blitProg = createProgramFromSources(gl, CINEMA_VERT, BLIT_FRAG);
  const blitUTex = blitProg ? gl.getUniformLocation(blitProg, "u_tex") : null;

  // Bloom threshold program
  const bloomThreshProg = createProgramFromSources(gl, CINEMA_VERT, BLOOM_THRESH_FRAG);
  let btUTex: WebGLUniformLocation | null = null;
  let btUThreshold: WebGLUniformLocation | null = null;
  if (bloomThreshProg) {
    gl.useProgram(bloomThreshProg);
    btUTex = gl.getUniformLocation(bloomThreshProg, "u_tex");
    btUThreshold = gl.getUniformLocation(bloomThreshProg, "u_threshold");
  }

  // Kawase blur program
  const kawaseProg = createProgramFromSources(gl, CINEMA_VERT, KAWASE_BLUR_FRAG);
  let kUTex: WebGLUniformLocation | null = null;
  let kUTexelSize: WebGLUniformLocation | null = null;
  let kUOffset: WebGLUniformLocation | null = null;
  if (kawaseProg) {
    gl.useProgram(kawaseProg);
    kUTex = gl.getUniformLocation(kawaseProg, "u_tex");
    kUTexelSize = gl.getUniformLocation(kawaseProg, "u_texelSize");
    kUOffset = gl.getUniformLocation(kawaseProg, "u_offset");
  }

  // Composite program
  const compositeProg = createProgramFromSources(gl, CINEMA_VERT, COMPOSITE_FRAG);
  let cpUCinema: WebGLUniformLocation | null = null;
  let cpUBloom: WebGLUniformLocation | null = null;
  let cpUPrevFrame: WebGLUniformLocation | null = null;
  let cpUMood: WebGLUniformLocation | null = null;
  let cpUVelocity: WebGLUniformLocation | null = null;
  let cpUHighs: WebGLUniformLocation | null = null;
  let cpUActTransition: WebGLUniformLocation | null = null;
  let cpUUseMotionBlur: WebGLUniformLocation | null = null;
  let cpUUseFlare: WebGLUniformLocation | null = null;
  if (compositeProg) {
    gl.useProgram(compositeProg);
    cpUCinema = gl.getUniformLocation(compositeProg, "u_cinema");
    cpUBloom = gl.getUniformLocation(compositeProg, "u_bloom");
    cpUPrevFrame = gl.getUniformLocation(compositeProg, "u_prevFrame");
    cpUMood = gl.getUniformLocation(compositeProg, "u_mood");
    cpUVelocity = gl.getUniformLocation(compositeProg, "u_velocity");
    cpUHighs = gl.getUniformLocation(compositeProg, "u_highs");
    cpUActTransition = gl.getUniformLocation(compositeProg, "u_actTransition");
    cpUUseMotionBlur = gl.getUniformLocation(compositeProg, "u_useMotionBlur");
    cpUUseFlare = gl.getUniformLocation(compositeProg, "u_useFlare");
  }

  // ---------------------------------------------------------------------------
  // Runtime performance monitoring
  // ---------------------------------------------------------------------------
  let frameTimeSum = 0;
  let frameTimeCount = 0;
  let runtimeTier = effectiveTier;

  // ---------------------------------------------------------------------------
  // Render pipeline
  // ---------------------------------------------------------------------------
  return {
    get lost() { return contextLost; },
    get tier() { return runtimeTier; },

    render(params) {
      const { video, time, energy, progress, bands, mouseX, mouseY, velocity } = params;
      if (contextLost || video.readyState < 2) return;

      const frameStart = performance.now();

      // Upload video texture only when frame changed (avoids redundant GPU upload)
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      if (video.currentTime !== lastVideoTime) {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);
        lastVideoTime = video.currentTime;
      }

      // --- Pass 1: Cinema → FBO_A (or screen if low tier) ---
      if (fboA) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, fboA.framebuffer);
        gl.viewport(0, 0, fboA.width, fboA.height);
      } else {
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(0, 0, w, h);
      }
      gl.disable(gl.BLEND);
      gl.useProgram(cinemaProg);
      gl.uniform1f(cUTime, time);
      gl.uniform1f(cUEnergy, energy);
      gl.uniform1f(cUProgress, progress);
      gl.uniform1f(cUBass, bands.bass);
      gl.uniform1f(cUMids, bands.mids);
      gl.uniform1f(cUHighs, bands.highs);
      gl.uniform2f(cUMouse, mouseX / w, 1.0 - mouseY / h); // NDC 0-1, flip Y
      gl.uniform1f(cUVelocity, velocity);
      gl.bindVertexArray(cinemaVAO);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

      // --- Pass 2: Bloom threshold (FBO_A → FBO_B, half-res) ---
      if (fboA && fboB && bloomThreshProg) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, fboB.framebuffer);
        gl.viewport(0, 0, fboB.width, fboB.height);
        gl.useProgram(bloomThreshProg);
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, fboA.texture);
        gl.uniform1i(btUTex, 1);
        const mood = getMoodCPU(progress);
        const threshold = Math.max(0.3, 0.75 - mood * 0.1 - bands.highs * 0.15);
        gl.uniform1f(btUThreshold, threshold);
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
            gl.uniform1f(kUOffset, i);
            gl.bindVertexArray(cinemaVAO);
            gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
          }
        }
      }

      // --- Pass 4: Composite (FBO_A + bloom + motion blur + flare + burn → screen) ---
      if (fboA && compositeProg) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(0, 0, w, h);
        gl.disable(gl.BLEND);
        gl.useProgram(compositeProg);

        // Bind cinema texture (FBO_A)
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, fboA.texture);
        gl.uniform1i(cpUCinema, 1);

        // Bind bloom texture (FBO_B2 after 3 Kawase iterations)
        if (fboB2) {
          gl.activeTexture(gl.TEXTURE2);
          gl.bindTexture(gl.TEXTURE_2D, fboB2.texture);
          gl.uniform1i(cpUBloom, 2);
        }

        // Bind previous frame (FBO_D, for motion blur)
        if (fboD) {
          gl.activeTexture(gl.TEXTURE3);
          gl.bindTexture(gl.TEXTURE_2D, fboD.texture);
          gl.uniform1i(cpUPrevFrame, 3);
        }

        const mood = getMoodCPU(progress);
        gl.uniform1f(cpUMood, mood);
        gl.uniform1f(cpUVelocity, velocity);
        gl.uniform1f(cpUHighs, bands.highs);
        gl.uniform1f(cpUActTransition, params.actTransition);
        gl.uniform1i(cpUUseMotionBlur, fboD ? 1 : 0);
        gl.uniform1i(cpUUseFlare, runtimeTier === 'high' ? 1 : 0);

        gl.bindVertexArray(cinemaVAO);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

        // Copy current screen to FBO_D for next frame's motion blur
        if (fboD) {
          gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
          gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, fboD.framebuffer);
          gl.blitFramebuffer(0, 0, w, h, 0, 0, fboD.width, fboD.height, gl.COLOR_BUFFER_BIT, gl.NEAREST);
          gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);
          gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
        }
      } else if (fboA && blitProg) {
        // Fallback: simple blit if composite program failed
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(0, 0, w, h);
        gl.useProgram(blitProg);
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, fboA.texture);
        gl.uniform1i(blitUTex, 1);
        gl.bindVertexArray(cinemaVAO);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      }

      // --- Pass 5: Particles (additive blending on top) ---
      const dt = lastTime ? Math.min(time - lastTime, 0.05) : 0.016;
      lastTime = time;
      const speed = 0.05 + energy * 0.95;

      // Update particle physics (CPU-side)
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const p = particles[i];
        p.life -= dt * speed;
        if (p.life <= 0) {
          resetParticle(p, w, h);
          continue;
        }

        p.x += p.vx * dt * speed * 60;
        p.y += p.vy * dt * speed * 60;
        p.y -= 0.15 * dt * speed * 60; // gentle upward drift

        // Wrap edges
        if (p.x < -20) p.x = w + 20;
        if (p.x > w + 20) p.x = -20;
        if (p.y < -20) p.y = h + 20;
        if (p.y > h + 20) p.y = -20;

        // Alpha: fade in 20%, fade out 30%
        const lifeFrac = p.life / p.maxLife;
        let alpha: number;
        if (lifeFrac > 0.8) alpha = (1 - lifeFrac) / 0.2;
        else if (lifeFrac < 0.3) alpha = lifeFrac / 0.3;
        else alpha = 1;
        alpha *= 0.3 + energy * 0.5;

        const idx = i * STRIDE;
        particleData[idx] = p.x;
        particleData[idx + 1] = p.y;
        particleData[idx + 2] = alpha;
        particleData[idx + 3] = p.size * (0.7 + energy * 0.6);
      }

      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE); // additive = glowing

      gl.useProgram(particleProg);
      gl.uniform2f(pURes, w, h);
      gl.uniform1f(pUEnergy, energy);
      gl.uniform1f(pUBass, bands.bass);
      gl.uniform1f(pUHighs, bands.highs);
      gl.uniform2f(pUMouse, mouseX, mouseY); // pixel coords for particles
      gl.uniform1i(pUVideoTex, 0);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, tex);

      gl.bindBuffer(gl.ARRAY_BUFFER, particleBuf);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, particleData);
      gl.bindVertexArray(particleVAO);
      gl.drawArrays(gl.POINTS, 0, PARTICLE_COUNT);

      gl.bindVertexArray(null);
      gl.disable(gl.BLEND);

      // Runtime auto-downgrade
      const frameTime = performance.now() - frameStart;
      frameTimeSum += frameTime;
      frameTimeCount++;
      if (frameTimeCount >= 10) {
        const avg = frameTimeSum / frameTimeCount;
        if (avg > 20 && runtimeTier === 'high') {
          runtimeTier = 'mid';
          if (fboD) { destroyFBO(gl, fboD); fboD = null; }
        }
        frameTimeSum = 0;
        frameTimeCount = 0;
      }
    },

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

    destroy() {
      canvas.removeEventListener("webglcontextlost", onContextLost);
      // FBO cleanup
      [fboA, fboB, fboB2, fboD].forEach(f => f && destroyFBO(gl, f));
      if (blitProg) gl.deleteProgram(blitProg);
      if (bloomThreshProg) gl.deleteProgram(bloomThreshProg);
      if (kawaseProg) gl.deleteProgram(kawaseProg);
      if (compositeProg) gl.deleteProgram(compositeProg);
      // Existing cleanup
      gl.deleteTexture(tex);
      gl.deleteBuffer(quadBuf);
      gl.deleteBuffer(particleBuf);
      gl.deleteVertexArray(cinemaVAO);
      gl.deleteVertexArray(particleVAO);
      gl.deleteProgram(cinemaProg);
      gl.deleteProgram(particleProg);
      gl.deleteShader(cinemaVS);
      gl.deleteShader(cinemaFS);
      gl.deleteShader(particleVS);
      gl.deleteShader(particleFS);
    },
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function compile(
  gl: WebGL2RenderingContext,
  type: number,
  src: string
): WebGLShader | null {
  const s = gl.createShader(type);
  if (!s) return null;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    console.error("CinemaGL shader error:", gl.getShaderInfoLog(s));
    gl.deleteShader(s);
    return null;
  }
  return s;
}
