"use client";

import { useRef, useCallback } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import ConstellationSVG from "@/components/ui/ConstellationSVG";
import { useUIStore } from "@/stores/useUIStore";
import type { ConstellationNode } from "@/lib/constellation-data";

const CustomCursor = dynamic(
  () => import("@/components/ui/CustomCursor"),
  { ssr: false },
);

export default function Portal() {
  const router = useRouter();
  const mouseRef = useRef<{ x: number; y: number }>({ x: 50, y: 50 });
  const revealedRef = useRef(false);
  const setPortalRevealed = useUIStore((s) => s.setPortalRevealed);
  const setActiveWorld = useUIStore((s) => s.setActiveWorld);

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
      }
    },
    [],
  );

  // ---------- Node click handler ----------
  const handleNodeClick = useCallback(
    (node: ConstellationNode) => {
      if (!node.active) return;
      setActiveWorld(node.id);
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
        <ConstellationSVG mouseRef={mouseRef} onNodeClick={handleNodeClick} />
      </main>
    </>
  );
}
