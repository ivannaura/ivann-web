// ---------------------------------------------------------------------------
// CinemaGL — WebGL post-processing for scroll-driven video
// Renders video frames through cinematic fragment shaders:
//   vignette, chromatic aberration, film grain, soft bloom
// ---------------------------------------------------------------------------

const VERT = `
attribute vec2 a_pos;
varying vec2 v_uv;
void main() {
  v_uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`;

const FRAG = `
precision mediump float;
varying vec2 v_uv;
uniform sampler2D u_tex;
uniform float u_time;
uniform float u_energy;

// Pseudo-random hash for film grain
float hash(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

void main() {
  vec2 uv = v_uv;
  float d = length(uv - 0.5);

  // --- Chromatic aberration ---
  // Shifts R and B channels outward from center.
  // Stronger at edges, amplified by scroll energy.
  float ca = d * 0.002 * (1.0 + u_energy * 3.0);
  vec3 c;
  c.r = texture2D(u_tex, uv + vec2(ca, 0.0)).r;
  c.g = texture2D(u_tex, uv).g;
  c.b = texture2D(u_tex, uv - vec2(ca, 0.0)).b;

  // --- Vignette ---
  // Darkens edges to focus the viewer's eye on center.
  c *= mix(0.3, 1.0, smoothstep(0.7, 0.3, d));

  // --- Film grain ---
  // Animated noise that eliminates the "too clean" digital look.
  c += hash(uv * 800.0 + fract(u_time)) * 0.06 - 0.03;

  // --- Soft bloom ---
  // Brightens already-bright areas for a dreamy glow.
  float lum = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c += max(0.0, lum - 0.65) * 0.4;

  gl_FragColor = vec4(c, 1.0);
}`;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface CinemaGL {
  /** Draw one frame: uploads video texture, runs post-processing shader. */
  render(video: HTMLVideoElement, time: number, energy: number): void;
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

  return {
    render(video, time, energy) {
      if (video.readyState < 2) return; // need HAVE_CURRENT_DATA
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);
      gl.uniform1f(uTime, time);
      gl.uniform1f(uEnergy, energy);
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
