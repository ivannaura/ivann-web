// portal-particles.ts — 2D canvas golden cursor trail for the portal page
// Uses Canvas 2D (not WebGL) to avoid GL context conflicts with CinemaGL

export interface PortalParticles {
  start(canvas: HTMLCanvasElement): void;
  updateMouse(x: number, y: number): void;
  stop(): void;
  destroy(): void;
  resize(): void;
}

// ---------- Constants ----------

const MAX_PARTICLES = 150;
const SPAWN_PER_FRAME = 2;
const LN_DAMPING = Math.log(0.96); // pre-computed for delta-time correction
const UPWARD_DRIFT = -0.1;
const GOLD_R = 201;
const GOLD_G = 168;
const GOLD_B = 76;
const MAX_DPR = 2;

// ---------- Particle struct ----------

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  alpha: number;
  active: boolean;
}

function createParticle(): Particle {
  return {
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    life: 0,
    maxLife: 1,
    size: 0,
    alpha: 0,
    active: false,
  };
}

function resetParticle(p: Particle, x: number, y: number): void {
  p.x = x;
  p.y = y;
  p.vx = (Math.random() - 0.5) * 1.2;
  p.vy = -(Math.random() * 0.8 + 0.2); // mostly upward
  const life = Math.random() * 40 + 20;
  p.life = life;
  p.maxLife = life; // same random value, no mismatch
  p.size = Math.random() * 2.5 + 1;
  p.alpha = 1;
  p.active = true;
}

// ---------- Factory ----------

export function createPortalParticles(): PortalParticles {
  // Pre-allocate pool (zero GC)
  const pool: Particle[] = [];
  for (let i = 0; i < MAX_PARTICLES; i++) {
    pool.push(createParticle());
  }

  let canvas: HTMLCanvasElement | null = null;
  let ctx: CanvasRenderingContext2D | null = null;
  let rafId = 0;
  let running = false;
  let lastTime = 0;
  let mouseX = 0;
  let mouseY = 0;
  let mouseActive = false;
  let spawnIndex = 0; // round-robin index into pool

  function handleResize(): void {
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    canvas.width = canvas.clientWidth * dpr;
    canvas.height = canvas.clientHeight * dpr;
    if (ctx) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
  }

  function tick(now: number): void {
    if (!running || !canvas || !ctx) return;

    // Pause when tab hidden
    if (document.hidden) {
      lastTime = 0;
      rafId = requestAnimationFrame(tick);
      return;
    }

    // Delta-time normalized to 60fps
    if (lastTime === 0) lastTime = now;
    const rawDt = now - lastTime;
    lastTime = now;
    const dt = rawDt / 16.667;

    const w = canvas.clientWidth;
    const h = canvas.clientHeight;

    // Clear (transparent)
    ctx.clearRect(0, 0, w, h);

    // Spawn particles at mouse
    if (mouseActive) {
      for (let s = 0; s < SPAWN_PER_FRAME; s++) {
        const p = pool[spawnIndex];
        resetParticle(p, mouseX, mouseY);
        spawnIndex = (spawnIndex + 1) % MAX_PARTICLES;
      }
    }

    // Damping factor for this frame
    const damping = Math.exp(LN_DAMPING * dt);

    // Update and draw
    for (let i = 0; i < MAX_PARTICLES; i++) {
      const p = pool[i];
      if (!p.active) continue;

      // Physics
      p.vx *= damping;
      p.vy *= damping;
      p.vy += UPWARD_DRIFT * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;

      // Life
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        continue;
      }

      // Fade based on remaining life
      const lifeRatio = p.life / p.maxLife;
      p.alpha = lifeRatio;

      // Draw
      ctx.globalAlpha = p.alpha * 0.8;
      ctx.fillStyle = `rgb(${GOLD_R}, ${GOLD_G}, ${GOLD_B})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * lifeRatio, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.globalAlpha = 1;

    rafId = requestAnimationFrame(tick);
  }

  return {
    start(c: HTMLCanvasElement): void {
      // Respect prefers-reduced-motion
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

      canvas = c;
      ctx = canvas.getContext("2d");
      if (!ctx) return;

      handleResize();
      running = true;
      lastTime = 0;
      rafId = requestAnimationFrame(tick);
    },

    updateMouse(x: number, y: number): void {
      mouseX = x;
      mouseY = y;
      mouseActive = true;
    },

    stop(): void {
      running = false;
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = 0;
      }
    },

    destroy(): void {
      running = false;
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = 0;
      }
      canvas = null;
      ctx = null;
      mouseActive = false;
    },

    resize(): void {
      handleResize();
    },
  };
}
