"use client";

import { useRef, useCallback, useEffect } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import ConstellationSVG from "@/components/ui/ConstellationSVG";
import type { ConstellationSVGHandle } from "@/components/ui/ConstellationSVG";
import { useUIStore } from "@/stores/useUIStore";
import { createPortalParticles } from "@/lib/portal-particles";
import { NODES, type ConstellationNode } from "@/lib/constellation-data";
import { playPortalNote } from "@/lib/portal-sounds";
import type { PortalParticles } from "@/lib/portal-particles";

const CustomCursor = dynamic(
  () => import("@/components/ui/CustomCursor"),
  { ssr: false },
);

export default function Portal() {
  const router = useRouter();
  const mouseRef = useRef<{ x: number; y: number }>({ x: 50, y: 50 });
  const constellationRef = useRef<ConstellationSVGHandle>(null);
  const revealedRef = useRef(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<PortalParticles | null>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const suppressClickRef = useRef(false);
  const setPortalRevealed = useUIStore((s) => s.setPortalRevealed);
  const setActiveWorld = useUIStore((s) => s.setActiveWorld);

  // ---------- First-movement reveal (called once) ----------
  const triggerReveal = useCallback(() => {
    if (revealedRef.current) return;
    revealedRef.current = true;
    setPortalRevealed();
  }, [setPortalRevealed]);

  // ---------- Reduced-motion: reveal immediately, skip particles ----------
  useEffect(() => {
    if (typeof window === "undefined") return;
    const prefersReduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (prefersReduced) {
      triggerReveal();
    }
  }, [triggerReveal]);

  // ---------- Particle system lifecycle ----------
  useEffect(() => {
    // Skip particle system entirely for reduced-motion users
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }

    const particles = createPortalParticles();
    particlesRef.current = particles;

    if (canvasRef.current) {
      particles.start(canvasRef.current);
    }

    const handleResize = () => particles.resize();
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      particles.destroy();
      particlesRef.current = null;
    };
  }, []);

  // ---------- Preloader → Portal burst transition ----------
  useEffect(() => {
    const unsub = useUIStore.subscribe((state, prev) => {
      if (state.preloaderDone && !prev.preloaderDone && particlesRef.current && canvasRef.current) {
        const cx = canvasRef.current.clientWidth / 2;
        const cy = canvasRef.current.clientHeight / 2;
        particlesRef.current.burst(cx, cy, 24);
      }
    });
    // If preloaderDone was already true before mount (e.g. fast HMR), fire burst now
    if (useUIStore.getState().preloaderDone && particlesRef.current && canvasRef.current) {
      const cx = canvasRef.current.clientWidth / 2;
      const cy = canvasRef.current.clientHeight / 2;
      particlesRef.current.burst(cx, cy, 24);
    }
    return unsub;
  }, []);

  // ---------- Mouse tracking ----------
  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLElement>) => {
      triggerReveal();
      mouseRef.current = {
        x: (e.clientX / window.innerWidth) * 100,
        y: (e.clientY / window.innerHeight) * 100,
      };
      particlesRef.current?.updateMouse(e.clientX, e.clientY);
    },
    [triggerReveal],
  );

  // ---------- Touch tracking (mobile) ----------
  const handleTouchStart = useCallback(
    (e: React.TouchEvent<HTMLElement>) => {
      triggerReveal();
      const t = e.touches[0];
      if (t) {
        touchStartRef.current = { x: t.clientX, y: t.clientY };
        mouseRef.current = {
          x: (t.clientX / window.innerWidth) * 100,
          y: (t.clientY / window.innerHeight) * 100,
        };
        particlesRef.current?.updateMouse(t.clientX, t.clientY);
      }
    },
    [triggerReveal],
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent<HTMLElement>) => {
      const t = e.touches[0];
      if (t) {
        mouseRef.current = {
          x: (t.clientX / window.innerWidth) * 100,
          y: (t.clientY / window.innerHeight) * 100,
        };
        particlesRef.current?.updateMouse(t.clientX, t.clientY);
      }
    },
    [],
  );

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent<HTMLElement>) => {
      const start = touchStartRef.current;
      if (!start) return;
      touchStartRef.current = null;

      const t = e.changedTouches[0];
      if (!t) return;

      const dx = t.clientX - start.x;
      const dy = t.clientY - start.y;
      if (dx * dx + dy * dy > 100) return; // > 10px movement — not a tap

      // Suppress the synthetic click that follows touchend
      suppressClickRef.current = true;

      const normalizedX = (t.clientX / window.innerWidth) * 100;
      const normalizedY = (t.clientY / window.innerHeight) * 100;

      // Visual pulse on constellation
      constellationRef.current?.triggerPulse(normalizedX, normalizedY);

      // Find nearest node for sound
      let nearestId = NODES[0].id;
      let nearestDist = Infinity;
      for (const n of NODES) {
        const ndx = normalizedX - n.x;
        const ndy = normalizedY - n.y;
        const d = ndx * ndx + ndy * ndy;
        if (d < nearestDist) {
          nearestDist = d;
          nearestId = n.id;
        }
      }

      playPortalNote(nearestId);
    },
    [],
  );

  // ---------- Keypress → SVG pulse + portal note ----------
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only letter keys a-z (same filter as usePianoScroll)
      if (e.key.length !== 1 || !/[a-z]/i.test(e.key)) return;
      // Do NOT preventDefault — WCAG 2.1.4

      const mouse = mouseRef.current;

      // Trigger visual pulse on constellation
      constellationRef.current?.triggerPulse(mouse.x, mouse.y);

      // Find nearest node for sound character
      let nearestId = NODES[0].id;
      let nearestDist = Infinity;
      for (const n of NODES) {
        const dx = mouse.x - n.x;
        const dy = mouse.y - n.y;
        const d = dx * dx + dy * dy;
        if (d < nearestDist) {
          nearestDist = d;
          nearestId = n.id;
        }
      }

      playPortalNote(nearestId);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // ---------- Suppress synthetic click after touch tap ----------
  const handleClick = useCallback(
    (_e: React.MouseEvent<HTMLElement>) => {
      if (suppressClickRef.current) {
        suppressClickRef.current = false;
        // Click already handled by touchend — skip
      }
    },
    [],
  );

  // ---------- Node click handler ----------
  const handleNodeClick = useCallback(
    async (node: ConstellationNode) => {
      if (!node.active) return;
      setActiveWorld(node.id);
      await constellationRef.current?.playExitTransition(node.id);
      router.push(node.href);
    },
    [setActiveWorld, router],
  );

  return (
    <>
      <CustomCursor />
      <main
        className="fixed inset-0 bg-[var(--bg-void)] overflow-hidden"
        onMouseMove={handleMouseMove}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={handleClick}
      >
        <h1 className="sr-only">IVANN AURA — Portal</h1>
        <canvas
          ref={canvasRef}
          className="absolute inset-0 pointer-events-none"
          style={{ zIndex: 0 }}
          aria-hidden="true"
        />
        <ConstellationSVG ref={constellationRef} mouseRef={mouseRef} onNodeClick={handleNodeClick} />
      </main>
    </>
  );
}
