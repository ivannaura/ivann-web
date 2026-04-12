// portal-nebula.ts — Subtle procedural nebula background for the portal page
// Uses Canvas 2D at low frame rate. No external dependencies.

export interface PortalNebula {
  start(canvas: HTMLCanvasElement): void;
  stop(): void;
  destroy(): void;
  resize(): void;
}

// ---------- Simple 2D value noise ----------

function noise2D(x: number, y: number): number {
  const ix = Math.floor(x),
    iy = Math.floor(y);
  const fx = x - ix,
    fy = y - iy;
  // Simple hash
  const hash = (n: number) => {
    const s = Math.sin(n) * 43758.5453;
    return s - Math.floor(s);
  };
  const a = hash(ix + iy * 57);
  const b = hash(ix + 1 + iy * 57);
  const c = hash(ix + (iy + 1) * 57);
  const d = hash(ix + 1 + (iy + 1) * 57);
  // Smoothstep interpolation
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}

// ---------- Constants ----------

const STAR_COUNT_MIN = 30;
const STAR_COUNT_MAX = 50;
const NOISE_SCALE = 0.006; // How "zoomed in" the noise is
const NOISE_OCTAVES = 3;
const TARGET_FPS = 12; // ~12fps decorative
const FRAME_INTERVAL = 1000 / TARGET_FPS;

// ---------- Star struct ----------

interface Star {
  x: number; // 0-1 normalized
  y: number; // 0-1 normalized
  size: number; // 1-2 px
  phase: number; // pulse offset
}

// ---------- Factory ----------

export function createPortalNebula(): PortalNebula {
  let canvas: HTMLCanvasElement | null = null;
  let ctx: CanvasRenderingContext2D | null = null;
  let rafId = 0;
  let running = false;
  let lastFrameTime = 0;
  let width = 0;
  let height = 0;
  let stars: Star[] = [];
  let reducedMotion = false;

  // Pre-generate a static noise ImageData to avoid computing noise per frame
  let noiseImageData: ImageData | null = null;

  function initStars(): void {
    const count =
      STAR_COUNT_MIN +
      Math.floor(Math.random() * (STAR_COUNT_MAX - STAR_COUNT_MIN + 1));
    stars = [];
    for (let i = 0; i < count; i++) {
      stars.push({
        x: Math.random(),
        y: Math.random(),
        size: 1 + Math.random(), // 1-2 px
        phase: Math.random() * Math.PI * 2,
      });
    }
  }

  function generateNoiseImage(): void {
    if (!ctx || width === 0 || height === 0) return;

    noiseImageData = ctx.createImageData(width, height);
    const data = noiseImageData.data;

    for (let py = 0; py < height; py++) {
      for (let px = 0; px < width; px++) {
        // Multi-octave value noise
        let n = 0;
        let amp = 1;
        let freq = NOISE_SCALE;
        let totalAmp = 0;
        for (let o = 0; o < NOISE_OCTAVES; o++) {
          n += noise2D(px * freq, py * freq) * amp;
          totalAmp += amp;
          amp *= 0.5;
          freq *= 2;
        }
        n /= totalAmp; // 0-1

        // Dark gold-brown, very faint
        const idx = (py * width + px) * 4;
        data[idx] = Math.round(80 * n); // R
        data[idx + 1] = Math.round(60 * n); // G
        data[idx + 2] = Math.round(20 * n); // B
        data[idx + 3] = Math.round(8 * n); // A — very subtle (max ~8/255 ≈ 0.03)
      }
    }
  }

  function renderFrame(time: number): void {
    if (!ctx || !canvas) return;

    // Clear
    ctx.clearRect(0, 0, width, height);

    // Layer 1: Noise base
    if (noiseImageData) {
      ctx.putImageData(noiseImageData, 0, 0);
    }

    // Layer 2: Central radial glow
    const cx = width / 2;
    const cy = height / 2;
    const radius = Math.max(width, height) * 0.5;
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
    grad.addColorStop(0, "rgba(201, 168, 76, 0.04)");
    grad.addColorStop(1, "rgba(201, 168, 76, 0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    // Layer 3: Twinkling stars
    for (let i = 0; i < stars.length; i++) {
      const star = stars[i];
      const opacity = reducedMotion
        ? 0.175 // Static mid-value
        : 0.1 + 0.15 * Math.sin(time * 0.001 + star.phase);
      ctx.globalAlpha = opacity;
      ctx.fillStyle = "rgb(240, 230, 210)";
      ctx.beginPath();
      ctx.arc(
        star.x * width,
        star.y * height,
        star.size,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function loop(time: number): void {
    if (!running) return;

    // Frame rate limiting
    if (time - lastFrameTime >= FRAME_INTERVAL) {
      lastFrameTime = time;
      renderFrame(time);
    }

    rafId = requestAnimationFrame(loop);
  }

  function setupCanvas(): void {
    if (!canvas) return;
    // DPR capped at 1 — decorative background, pixel density irrelevant
    width = canvas.clientWidth;
    height = canvas.clientHeight;
    canvas.width = width;
    canvas.height = height;
  }

  // ---------- Public API ----------

  function start(c: HTMLCanvasElement): void {
    canvas = c;
    ctx = canvas.getContext("2d");
    if (!ctx) return;

    reducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    setupCanvas();
    initStars();
    generateNoiseImage();

    if (reducedMotion) {
      // Render one static frame, then stop
      renderFrame(0);
      return;
    }

    running = true;
    lastFrameTime = 0;
    rafId = requestAnimationFrame(loop);
  }

  function stop(): void {
    running = false;
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = 0;
    }
  }

  function destroy(): void {
    stop();
    canvas = null;
    ctx = null;
    noiseImageData = null;
    stars = [];
  }

  function resize(): void {
    if (!canvas || !ctx) return;
    setupCanvas();
    generateNoiseImage();
    // Re-render immediately after resize
    renderFrame(performance.now());
  }

  return { start, stop, destroy, resize };
}
