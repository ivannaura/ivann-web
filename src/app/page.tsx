"use client";

import { useRef, useCallback, useEffect } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import ConstellationSVG from "@/components/ui/ConstellationSVG";
import type { ConstellationSVGHandle } from "@/components/ui/ConstellationSVG";
import { useUIStore } from "@/stores/useUIStore";
import { createPortalParticles } from "@/lib/portal-particles";
import type { ConstellationNode } from "@/lib/constellation-data";
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
  const setPortalRevealed = useUIStore((s) => s.setPortalRevealed);
  const setActiveWorld = useUIStore((s) => s.setActiveWorld);

  // ---------- Particle system lifecycle ----------
  useEffect(() => {
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

  // ---------- First-movement reveal (called once) ----------
  const triggerReveal = useCallback(() => {
    if (revealedRef.current) return;
    revealedRef.current = true;
    setPortalRevealed();
  }, [setPortalRevealed]);

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
      >
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
