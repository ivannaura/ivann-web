// ---------------------------------------------------------------------------
// FractalGL — Julia Set fractal WebGL2 renderer for the IVANN AURA preloader
//
// Draws a gold-palette Julia Set on a fullscreen quad. The fractal implodes
// (collapses inward) as `progress` goes from 0 (expanded) to 1 (singularity).
// Uses Inigo Quilez cosine palette for warm gold coloring.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface FractalRenderer {
  /** Update the implosion progress (0 = expanded, 1 = singularity) */
  setProgress(progress: number): void;
  /** Resize canvas to match container */
  resize(): void;
  /** Clean up all GL resources */
  destroy(): void;
}

// ---------------------------------------------------------------------------
// Shaders
// ---------------------------------------------------------------------------

const VERT_SRC = `#version 300 es
layout(location = 0) in vec2 aPosition;
out vec2 vUV;
void main() {
    gl_Position = vec4(aPosition, 0.0, 1.0);
    vUV = aPosition * 0.5 + 0.5;
}
`;

const FRAG_SRC = `#version 300 es
precision highp float;

in vec2 vUV;
out vec4 fragColor;

uniform float u_progress;  // 0.0 = full fractal, 1.0 = singularity
uniform float u_time;      // seconds since start
uniform vec2 u_resolution; // canvas pixel size

// Inigo Quilez cosine palette for gold colors
vec3 palette(float t) {
    vec3 a = vec3(0.05, 0.03, 0.01);    // near-black base
    vec3 b = vec3(0.7, 0.5, 0.15);      // gold amplitude
    vec3 c = vec3(1.0, 0.7, 0.4);       // warm frequency
    vec3 d = vec3(0.0, 0.15, 0.30);     // phase offset
    return a + b * cos(6.283185 * (c * t + d));
}

void main() {
    // Map pixel to complex plane centered at origin
    vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution) / min(u_resolution.x, u_resolution.y);
    uv *= 2.5; // scale to show the full Julia set

    // Julia set c parameter — animated along Mandelbrot boundary
    // As progress -> 1, c -> 0 (Julia set collapses to a circle then a point)
    float angle = u_time * 0.2;  // slow rotation for visual interest
    float radius = 0.7885 * (1.0 - u_progress * 0.97);  // 0.7885 -> ~0.024
    vec2 c = vec2(cos(angle), sin(angle)) * radius;

    // Julia set iteration
    vec2 z = uv;
    float iter = 0.0;
    const float MAX_ITER = 80.0;
    const float BAILOUT = 4.0;

    for (float i = 0.0; i < MAX_ITER; i++) {
        if (dot(z, z) > BAILOUT) break;
        z = vec2(z.x * z.x - z.y * z.y, 2.0 * z.x * z.y) + c;
        iter += 1.0;
    }

    // Smooth iteration count (Inigo Quilez method)
    float smoothIter = iter - log2(log2(dot(z, z))) + 4.0;
    float t = smoothIter / MAX_ITER;

    // Color: gold palette
    vec3 col = palette(t);

    // Interior of set = pure black
    if (iter >= MAX_ITER - 1.0) col = vec3(0.0);

    // Subtle fake bloom on bright areas
    col += col * col * 0.25;

    // Vignette — darken edges
    vec2 vigUV = vUV - 0.5;
    float vig = 1.0 - dot(vigUV, vigUV) * 1.5;
    col *= clamp(vig, 0.0, 1.0);

    // Fade to black near singularity
    col *= smoothstep(1.0, 0.8, u_progress);

    fragColor = vec4(col, 1.0);
}
`;

// ---------------------------------------------------------------------------
// Shader compilation helpers (mirrors cinema-gl.ts pattern)
// ---------------------------------------------------------------------------

function compile(
  gl: WebGL2RenderingContext,
  type: number,
  src: string,
): WebGLShader | null {
  const s = gl.createShader(type);
  if (!s) return null;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    console.error('FractalGL shader error:', gl.getShaderInfoLog(s));
    gl.deleteShader(s);
    return null;
  }
  return s;
}

function createProgramFromSources(
  gl: WebGL2RenderingContext,
  vertSrc: string,
  fragSrc: string,
): WebGLProgram | null {
  const vs = compile(gl, gl.VERTEX_SHADER, vertSrc);
  const fs = compile(gl, gl.FRAGMENT_SHADER, fragSrc);
  if (!vs || !fs) {
    if (vs) gl.deleteShader(vs);
    if (fs) gl.deleteShader(fs);
    return null;
  }
  const prog = gl.createProgram();
  if (!prog) {
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    return null;
  }
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  // Shaders can be deleted after linking — the program retains them internally
  gl.detachShader(prog, vs);
  gl.detachShader(prog, fs);
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    console.warn('FractalGL: program link failed:', gl.getProgramInfoLog(prog));
    gl.deleteProgram(prog);
    return null;
  }
  return prog;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createFractalRenderer(
  canvas: HTMLCanvasElement,
): FractalRenderer | null {
  // Reduced motion check — return null so preloader falls back gracefully
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return null;

  const gl = canvas.getContext('webgl2', {
    alpha: true, // true is better on iOS than false
    antialias: false,
    depth: false,
    stencil: false,
    premultipliedAlpha: false,
    preserveDrawingBuffer: false,
  });
  if (!gl) return null;

  // Track context loss — skip render calls while lost
  let contextLost = false;
  const onContextLost = (e: Event) => {
    e.preventDefault();
    contextLost = true;
  };
  canvas.addEventListener('webglcontextlost', onContextLost, false);
  const onContextRestored = () => {
    // Context restore not supported — all GL resources are invalid after loss.
    // contextLost remains true intentionally.
  };
  canvas.addEventListener('webglcontextrestored', onContextRestored, false);

  // ---------------------------------------------------------------------------
  // Compile program
  // ---------------------------------------------------------------------------
  const program = createProgramFromSources(gl, VERT_SRC, FRAG_SRC);
  if (!program) {
    const ext = gl.getExtension('WEBGL_lose_context');
    if (ext) ext.loseContext();
    canvas.removeEventListener('webglcontextlost', onContextLost);
    canvas.removeEventListener('webglcontextrestored', onContextRestored);
    return null;
  }

  // ---------------------------------------------------------------------------
  // Uniform locations
  // ---------------------------------------------------------------------------
  gl.useProgram(program);
  const uProgress = gl.getUniformLocation(program, 'u_progress');
  const uTime = gl.getUniformLocation(program, 'u_time');
  const uResolution = gl.getUniformLocation(program, 'u_resolution');

  // ---------------------------------------------------------------------------
  // Fullscreen quad VAO
  // ---------------------------------------------------------------------------
  const vao = gl.createVertexArray();
  if (!vao) {
    gl.deleteProgram(program);
    const ext = gl.getExtension('WEBGL_lose_context');
    if (ext) ext.loseContext();
    canvas.removeEventListener('webglcontextlost', onContextLost);
    canvas.removeEventListener('webglcontextrestored', onContextRestored);
    return null;
  }
  gl.bindVertexArray(vao);

  const quadBuffer = gl.createBuffer();
  if (!quadBuffer) {
    gl.deleteVertexArray(vao);
    gl.deleteProgram(program);
    const ext = gl.getExtension('WEBGL_lose_context');
    if (ext) ext.loseContext();
    canvas.removeEventListener('webglcontextlost', onContextLost);
    canvas.removeEventListener('webglcontextrestored', onContextRestored);
    return null;
  }

  // Two triangles covering clip space (-1 to 1)
  const quadVerts = new Float32Array([
    -1, -1, 1, -1, -1, 1,
    -1, 1, 1, -1, 1, 1,
  ]);
  gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, quadVerts, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  gl.bindVertexArray(null);

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------
  let progress = 0;
  let destroyed = false;
  let rafId = 0;
  const startTime = performance.now();

  // ---------------------------------------------------------------------------
  // Render loop
  // ---------------------------------------------------------------------------
  function render() {
    if (destroyed || contextLost) return;

    // Pause when tab is hidden — save GPU cycles
    if (document.hidden) {
      rafId = requestAnimationFrame(render);
      return;
    }

    const t = (performance.now() - startTime) / 1000;

    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.useProgram(program);
    gl.bindVertexArray(vao);

    gl.uniform1f(uProgress, progress);
    gl.uniform1f(uTime, t);
    gl.uniform2f(uResolution, canvas.width, canvas.height);

    gl.drawArrays(gl.TRIANGLES, 0, 6);

    rafId = requestAnimationFrame(render);
  }

  // ---------------------------------------------------------------------------
  // DPR handling — cap at 1.5 (it's a preloader, not the main content)
  // ---------------------------------------------------------------------------
  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    canvas.width = canvas.clientWidth * dpr;
    canvas.height = canvas.clientHeight * dpr;
  }

  resize();
  rafId = requestAnimationFrame(render);

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------
  return {
    setProgress(p: number) {
      progress = Math.max(0, Math.min(1, p));
    },

    resize,

    destroy() {
      destroyed = true;
      cancelAnimationFrame(rafId);

      canvas.removeEventListener('webglcontextlost', onContextLost);
      canvas.removeEventListener('webglcontextrestored', onContextRestored);

      gl.deleteBuffer(quadBuffer);
      gl.deleteVertexArray(vao);
      gl.deleteProgram(program);

      const ext = gl.getExtension('WEBGL_lose_context');
      if (ext) ext.loseContext();
    },
  };
}
