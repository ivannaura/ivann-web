// ---------------------------------------------------------------------------
// CinemaGL — WebGL post-processing for scroll-driven video
// Renders video frames through cinematic fragment shaders.
// Effects vary dynamically per narrative act (u_progress):
//   - Gentle during Despertar/Cierre, intense during Tormenta/Clímax
// ---------------------------------------------------------------------------

const VERT = `
attribute vec2 a_pos;
varying vec2 v_uv;
void main() {
  v_uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`;

// Dynamic mood: u_progress (0-1) maps to narrative intensity.
// Acts 1-2: gentle (0.5), Acts 3-4: building (0.8), Acts 5-6: peak (1.2),
// Acts 7-8: resolution (0.6). All effects scale with this intensity.
const FRAG = `
precision mediump float;
varying vec2 v_uv;
uniform sampler2D u_tex;
uniform float u_time;
uniform float u_energy;
uniform float u_progress;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

void main() {
  vec2 uv = v_uv;
  float d = length(uv - 0.5);

  // --- Narrative mood ---
  // Map scroll progress to effect intensity across 8 acts
  float act = u_progress * 8.0;
  float mood;
  if (act < 1.0) mood = 0.5;        // Act 1: Despertar — gentle
  else if (act < 2.0) mood = 0.6;   // Act 2: Entrada — warming up
  else if (act < 3.0) mood = 0.8;   // Act 3: Danza — building
  else if (act < 4.0) mood = 0.9;   // Act 4: Espectáculo — strong
  else if (act < 5.0) mood = 1.1;   // Act 5: Fuego — peak
  else if (act < 6.0) mood = 1.2;   // Act 6: Clímax — maximum
  else if (act < 7.0) mood = 0.8;   // Act 7: Resolución — calming
  else mood = 0.5;                   // Act 8: Cierre — peaceful

  // --- Chromatic aberration ---
  // Stronger at edges, amplified by energy AND narrative mood
  float ca = d * 0.002 * (1.0 + u_energy * 3.0) * mood;
  vec3 c;
  c.r = texture2D(u_tex, uv + vec2(ca, 0.0)).r;
  c.g = texture2D(u_tex, uv).g;
  c.b = texture2D(u_tex, uv - vec2(ca, 0.0)).b;

  // --- Vignette ---
  // Tighter vignette during intense acts, softer during gentle ones
  float vigEdge = 0.7 - mood * 0.1;
  float vigCenter = 0.3 - mood * 0.05;
  c *= mix(0.2 + (1.0 - mood) * 0.15, 1.0, smoothstep(vigEdge, vigCenter, d));

  // --- Film grain ---
  // More grain during transitions and dark moments
  float grainAmt = (0.04 + mood * 0.025);
  c += hash(uv * 800.0 + fract(u_time)) * grainAmt * 2.0 - grainAmt;

  // --- Soft bloom ---
  // Lower threshold during peak acts = more glow
  float bloomThresh = 0.7 - mood * 0.1;
  float lum = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c += max(0.0, lum - bloomThresh) * (0.3 + mood * 0.15);

  gl_FragColor = vec4(c, 1.0);
}`;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface CinemaGL {
  /** Draw one frame with post-processing. Progress = scroll position 0-1. */
  render(video: HTMLVideoElement, time: number, energy: number, progress: number): void;
  /** Update canvas resolution (call on resize). */
  resize(w: number, h: number): void;
  /** Release all GL resources. */
  destroy(): void;
}

export function initCinemaGL(canvas: HTMLCanvasElement): CinemaGL | null {
  const gl = canvas.getContext("webgl", {
    alpha: false,
    antialias: false,
    premultipliedAlpha: false,
  });
  if (!gl) return null;

  const vs = compile(gl, gl.VERTEX_SHADER, VERT);
  const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) return null;

  const prog = gl.createProgram()!;
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
  gl.useProgram(prog);

  // Fullscreen quad (triangle strip)
  const buf = gl.createBuffer()!;
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
    gl.STATIC_DRAW
  );
  const aPos = gl.getAttribLocation(prog, "a_pos");
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  // Video texture
  const tex = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

  const uTime = gl.getUniformLocation(prog, "u_time");
  const uEnergy = gl.getUniformLocation(prog, "u_energy");
  const uProgress = gl.getUniformLocation(prog, "u_progress");

  return {
    render(video, time, energy, progress) {
      if (video.readyState < 2) return;
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);
      gl.uniform1f(uTime, time);
      gl.uniform1f(uEnergy, energy);
      gl.uniform1f(uProgress, progress);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    },

    resize(w, h) {
      canvas.width = w;
      canvas.height = h;
      gl.viewport(0, 0, w, h);
    },

    destroy() {
      gl.deleteTexture(tex);
      gl.deleteBuffer(buf);
      gl.deleteProgram(prog);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
    },
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function compile(
  gl: WebGLRenderingContext,
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
