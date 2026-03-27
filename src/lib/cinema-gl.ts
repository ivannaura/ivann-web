// ---------------------------------------------------------------------------
// CinemaGL — Unified WebGL2 renderer for scroll-driven video cinema
// Single context rendering pipeline:
//   Pass 1: Video post-processing (vignette, chromatic aberration, grain, bloom)
//   Pass 2: Luminance-reactive particles (additive blending, energy-responsive)
// Effects vary dynamically per narrative act (u_progress).
// Particles sample the video texture for luminance — they glow brighter
// near bright video areas and drift toward light sources.
// ---------------------------------------------------------------------------

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
precision mediump float;
in vec2 v_uv;
uniform sampler2D u_tex;
uniform float u_time;
uniform float u_energy;
uniform float u_progress;
out vec4 fragColor;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

void main() {
  vec2 uv = v_uv;
  float d = length(uv - 0.5);

  // --- Narrative mood ---
  float act = u_progress * 8.0;
  float mood;
  if (act < 1.0) mood = 0.5;
  else if (act < 2.0) mood = 0.6;
  else if (act < 3.0) mood = 0.8;
  else if (act < 4.0) mood = 0.9;
  else if (act < 5.0) mood = 1.1;
  else if (act < 6.0) mood = 1.2;
  else if (act < 7.0) mood = 0.8;
  else mood = 0.5;

  // --- Chromatic aberration ---
  float ca = d * 0.002 * (1.0 + u_energy * 3.0) * mood;
  vec3 c;
  c.r = texture(u_tex, uv + vec2(ca, 0.0)).r;
  c.g = texture(u_tex, uv).g;
  c.b = texture(u_tex, uv - vec2(ca, 0.0)).b;

  // --- Vignette ---
  float vigEdge = 0.7 - mood * 0.1;
  float vigCenter = 0.3 - mood * 0.05;
  c *= mix(0.2 + (1.0 - mood) * 0.15, 1.0, smoothstep(vigEdge, vigCenter, d));

  // --- Film grain ---
  float grainAmt = (0.04 + mood * 0.025);
  c += hash(uv * 800.0 + fract(u_time)) * grainAmt * 2.0 - grainAmt;

  // --- Soft bloom ---
  float bloomThresh = 0.7 - mood * 0.1;
  float lum = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c += max(0.0, lum - bloomThresh) * (0.3 + mood * 0.15);

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
  vec2 grad = vec2(lumR - lumL, lumD - lumU);
  vec2 nudge = grad * u_energy * 25.0;

  vec2 finalPos = a_pos + nudge;
  vec2 ndc = (finalPos / u_res) * 2.0 - 1.0;
  ndc.y *= -1.0;
  gl_Position = vec4(ndc, 0.0, 1.0);

  // Particles over bright areas are larger and more visible
  gl_PointSize = a_size * (1.0 + lum * u_energy * 2.0);

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
out vec4 fragColor;

void main() {
  float d = length(gl_PointCoord - 0.5) * 2.0;
  float circle = smoothstep(1.0, 0.2, d);
  vec3 color = mix(u_colorLow, u_colorHigh, u_energy);
  // Particles near bright video areas trend whiter/hotter
  color = mix(color, vec3(1.0, 0.98, 0.95), v_lum * u_energy * 0.4);
  fragColor = vec4(color, circle * v_alpha);
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

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface CinemaGL {
  /** Draw one frame: video post-processing + particles. */
  render(video: HTMLVideoElement, time: number, energy: number, progress: number): void;
  /** Update canvas resolution (call on resize). */
  resize(w: number, h: number): void;
  /** Release all GL resources. */
  destroy(): void;
}

export function initCinemaGL(canvas: HTMLCanvasElement): CinemaGL | null {
  const gl = canvas.getContext("webgl2", {
    alpha: false,
    antialias: false,
    premultipliedAlpha: false,
  });
  if (!gl) return null;

  // ---------------------------------------------------------------------------
  // Cinema program (video post-processing)
  // ---------------------------------------------------------------------------
  const cinemaVS = compile(gl, gl.VERTEX_SHADER, CINEMA_VERT);
  const cinemaFS = compile(gl, gl.FRAGMENT_SHADER, CINEMA_FRAG);
  if (!cinemaVS || !cinemaFS) return null;

  const cinemaProg = gl.createProgram()!;
  gl.attachShader(cinemaProg, cinemaVS);
  gl.attachShader(cinemaProg, cinemaFS);
  gl.linkProgram(cinemaProg);
  if (!gl.getProgramParameter(cinemaProg, gl.LINK_STATUS)) return null;

  // Cinema geometry — fullscreen quad (triangle strip)
  const quadBuf = gl.createBuffer()!;
  gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);

  // Cinema VAO
  const cinemaVAO = gl.createVertexArray()!;
  gl.bindVertexArray(cinemaVAO);
  const cinemaAPos = gl.getAttribLocation(cinemaProg, "a_pos");
  gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
  gl.enableVertexAttribArray(cinemaAPos);
  gl.vertexAttribPointer(cinemaAPos, 2, gl.FLOAT, false, 0, 0);
  gl.bindVertexArray(null);

  // Cinema uniforms
  const cUTime = gl.getUniformLocation(cinemaProg, "u_time");
  const cUEnergy = gl.getUniformLocation(cinemaProg, "u_energy");
  const cUProgress = gl.getUniformLocation(cinemaProg, "u_progress");

  // ---------------------------------------------------------------------------
  // Particle program (luminance-reactive light motes)
  // ---------------------------------------------------------------------------
  const particleVS = compile(gl, gl.VERTEX_SHADER, PARTICLE_VERT);
  const particleFS = compile(gl, gl.FRAGMENT_SHADER, PARTICLE_FRAG);
  if (!particleVS || !particleFS) return null;

  const particleProg = gl.createProgram()!;
  gl.attachShader(particleProg, particleVS);
  gl.attachShader(particleProg, particleFS);
  gl.linkProgram(particleProg);
  if (!gl.getProgramParameter(particleProg, gl.LINK_STATUS)) return null;

  // Particle buffer
  const particleBuf = gl.createBuffer()!;
  const particleData = new Float32Array(PARTICLE_COUNT * STRIDE);

  // Particle VAO
  const particleVAO = gl.createVertexArray()!;
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

  // Set static particle uniforms
  gl.useProgram(particleProg);
  // --particle-core: #FFFDE8 (warm white dust)
  gl.uniform3f(pUColorLow, 1.0, 0.992, 0.91);
  // --aura-gold-bright: #E8C85A (energized gold)
  gl.uniform3f(pUColorHigh, 0.91, 0.784, 0.353);

  // ---------------------------------------------------------------------------
  // Shared video texture
  // ---------------------------------------------------------------------------
  const tex = gl.createTexture()!;
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

  // ---------------------------------------------------------------------------
  // Render pipeline
  // ---------------------------------------------------------------------------
  return {
    render(video, time, energy, progress) {
      if (video.readyState < 2) return;

      // Upload video texture (shared by both programs)
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);

      // --- Pass 1: Cinema post-processing ---
      gl.disable(gl.BLEND);
      gl.useProgram(cinemaProg);
      gl.uniform1f(cUTime, time);
      gl.uniform1f(cUEnergy, energy);
      gl.uniform1f(cUProgress, progress);
      gl.bindVertexArray(cinemaVAO);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

      // --- Pass 2: Particles (additive blending on top) ---
      const dt = lastTime ? Math.min(time - lastTime, 0.05) : 0.016;
      lastTime = time;
      const speed = 0.05 + energy * 0.95;

      // Update particle physics (CPU-side)
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const p = particles[i];
        p.life -= dt * speed;
        if (p.life <= 0) {
          particles[i] = spawnParticle(w, h);
          particles[i].life = particles[i].maxLife;
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
      gl.uniform1i(pUVideoTex, 0); // texture unit 0

      gl.bindBuffer(gl.ARRAY_BUFFER, particleBuf);
      gl.bufferData(gl.ARRAY_BUFFER, particleData, gl.DYNAMIC_DRAW);
      gl.bindVertexArray(particleVAO);
      gl.drawArrays(gl.POINTS, 0, PARTICLE_COUNT);

      gl.bindVertexArray(null);
      gl.disable(gl.BLEND);
    },

    resize(newW, newH) {
      w = newW;
      h = newH;
      canvas.width = w;
      canvas.height = h;
      gl.viewport(0, 0, w, h);
    },

    destroy() {
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
  const s = gl.createShader(type)!;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    console.error("CinemaGL shader error:", gl.getShaderInfoLog(s));
    gl.deleteShader(s);
    return null;
  }
  return s;
}
