// ---------------------------------------------------------------------------
// ParticlesGL — WebGL particle system driven by scroll energy
// Renders floating light motes that respond to the AudioMomentum energy:
//   idle = gentle drift like dust in a sunbeam
//   active = agitated, multiplied, bright gold
// Follows VISION.md "Regla de Oro": everything is tied to scroll.
// ---------------------------------------------------------------------------

const COUNT = 250;
const STRIDE = 4; // x, y, alpha, size per vertex

const VERT = `
attribute vec2 a_pos;
attribute float a_alpha;
attribute float a_size;
uniform vec2 u_res;

varying float v_alpha;

void main() {
  vec2 ndc = (a_pos / u_res) * 2.0 - 1.0;
  ndc.y *= -1.0;
  gl_Position = vec4(ndc, 0.0, 1.0);
  gl_PointSize = a_size;
  v_alpha = a_alpha;
}`;

const FRAG = `
precision mediump float;
varying float v_alpha;
uniform vec3 u_colorLow;
uniform vec3 u_colorHigh;
uniform float u_energy;

void main() {
  float d = length(gl_PointCoord - 0.5) * 2.0;
  float circle = smoothstep(1.0, 0.2, d);
  vec3 color = mix(u_colorLow, u_colorHigh, u_energy);
  gl_FragColor = vec4(color, circle * v_alpha);
}`;

// ---------------------------------------------------------------------------
// Particle state (CPU-side)
// ---------------------------------------------------------------------------

interface Particle {
  x: number; y: number;
  vx: number; vy: number;
  life: number; maxLife: number;
  size: number;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface ParticlesGL {
  render(time: number, energy: number): void;
  resize(w: number, h: number): void;
  destroy(): void;
}

export function initParticlesGL(canvas: HTMLCanvasElement): ParticlesGL | null {
  const gl = canvas.getContext("webgl", {
    alpha: true,
    premultipliedAlpha: true,
    antialias: false,
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

  // Enable blending for transparency
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE); // additive blending = glowing

  // Attributes
  const buf = gl.createBuffer()!;
  const aPos = gl.getAttribLocation(prog, "a_pos");
  const aAlpha = gl.getAttribLocation(prog, "a_alpha");
  const aSize = gl.getAttribLocation(prog, "a_size");

  // Uniforms
  const uRes = gl.getUniformLocation(prog, "u_res");
  const uColorLow = gl.getUniformLocation(prog, "u_colorLow");
  const uColorHigh = gl.getUniformLocation(prog, "u_colorHigh");
  const uEnergy = gl.getUniformLocation(prog, "u_energy");

  // Design token colors
  // --particle-core: #FFFDE8 (warm white dust)
  // --aura-gold-bright: #E8C85A (energized gold)
  gl.uniform3f(uColorLow, 1.0, 0.992, 0.91);
  gl.uniform3f(uColorHigh, 0.91, 0.784, 0.353);

  let w = canvas.width;
  let h = canvas.height;

  // Initialize particles
  const particles: Particle[] = [];
  for (let i = 0; i < COUNT; i++) {
    particles.push(spawnParticle(w, h));
  }

  // GPU buffer
  const data = new Float32Array(COUNT * STRIDE);
  let lastTime = 0;

  return {
    render(time, energy) {
      const dt = lastTime ? Math.min(time - lastTime, 0.05) : 0.016;
      lastTime = time;

      // Speed multiplier: 5% drift at idle, 100% at full energy
      const speed = 0.05 + energy * 0.95;

      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform1f(uEnergy, energy);
      gl.uniform2f(uRes, w, h);

      for (let i = 0; i < COUNT; i++) {
        const p = particles[i];

        // Update life
        p.life -= dt * speed;
        if (p.life <= 0) {
          particles[i] = spawnParticle(w, h);
          particles[i].life = particles[i].maxLife;
        }

        // Move
        p.x += p.vx * dt * speed * 60;
        p.y += p.vy * dt * speed * 60;

        // Gentle upward drift (floating dust)
        p.y -= 0.15 * dt * speed * 60;

        // Wrap around edges
        if (p.x < -20) p.x = w + 20;
        if (p.x > w + 20) p.x = -20;
        if (p.y < -20) p.y = h + 20;
        if (p.y > h + 20) p.y = -20;

        // Alpha: fade in first 20%, fade out last 30%
        const lifeFrac = p.life / p.maxLife;
        let alpha: number;
        if (lifeFrac > 0.8) alpha = (1 - lifeFrac) / 0.2;
        else if (lifeFrac < 0.3) alpha = lifeFrac / 0.3;
        else alpha = 1;
        alpha *= 0.3 + energy * 0.5; // brighter with energy

        const idx = i * STRIDE;
        data[idx] = p.x;
        data[idx + 1] = p.y;
        data[idx + 2] = alpha;
        data[idx + 3] = p.size * (0.7 + energy * 0.6);
      }

      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);

      const bytes = STRIDE * 4;
      gl.enableVertexAttribArray(aPos);
      gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, bytes, 0);
      gl.enableVertexAttribArray(aAlpha);
      gl.vertexAttribPointer(aAlpha, 1, gl.FLOAT, false, bytes, 8);
      gl.enableVertexAttribArray(aSize);
      gl.vertexAttribPointer(aSize, 1, gl.FLOAT, false, bytes, 12);

      gl.drawArrays(gl.POINTS, 0, COUNT);
    },

    resize(newW, newH) {
      w = newW;
      h = newH;
      canvas.width = w;
      canvas.height = h;
      gl.viewport(0, 0, w, h);
    },

    destroy() {
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

function compile(
  gl: WebGLRenderingContext,
  type: number,
  src: string
): WebGLShader | null {
  const s = gl.createShader(type)!;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    console.error("ParticlesGL shader error:", gl.getShaderInfoLog(s));
    gl.deleteShader(s);
    return null;
  }
  return s;
}
