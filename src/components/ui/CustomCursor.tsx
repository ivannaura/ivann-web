"use client";

import { useEffect, useRef, useCallback } from "react";
import { useUIStore } from "@/stores/useUIStore";

export default function CustomCursor() {
  const dotRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const cursorVariant = useUIStore((s) => s.cursorVariant);

  // All opacity is managed imperatively — never via React style props.
  // This prevents React re-renders from overwriting mouse-event-driven opacity.
  const visibleRef = useRef(false);
  const cursorVariantRef = useRef(cursorVariant);
  cursorVariantRef.current = cursorVariant;

  const applyOpacity = useCallback(() => {
    const show = visibleRef.current && cursorVariantRef.current !== "hidden";
    if (dotRef.current) dotRef.current.style.opacity = show ? "1" : "0";
    if (ringRef.current) ringRef.current.style.opacity = show ? "0.3" : "0";
  }, []);

  // Sync Zustand cursorVariant → imperative opacity
  useEffect(() => {
    applyOpacity();
  }, [cursorVariant, applyOpacity]);

  useEffect(() => {
    const isMobile = window.matchMedia("(pointer: coarse)").matches;
    if (isMobile) return;

    document.body.style.cursor = "none";

    let mouseX = -100;
    let mouseY = -100;
    let ringX = -100;
    let ringY = -100;

    // Set initial off-screen position imperatively (avoids React re-render overwriting transform)
    if (dotRef.current) dotRef.current.style.transform = "translate(-100px, -100px)";
    if (ringRef.current) ringRef.current.style.transform = "translate(-100px, -100px)";

    const onMouseMove = (e: MouseEvent) => {
      mouseX = e.clientX;
      mouseY = e.clientY;

      if (!visibleRef.current) {
        visibleRef.current = true;
        applyOpacity();
      }

      // GPU-composited transform instead of left/top
      if (dotRef.current) {
        dotRef.current.style.transform = `translate(${mouseX - 4}px, ${mouseY - 4}px)`;
      }
    };

    const onMouseLeave = () => {
      visibleRef.current = false;
      applyOpacity();
    };

    const onMouseEnter = () => {
      visibleRef.current = true;
      applyOpacity();
    };

    let frameId = 0;
    const animateRing = () => {
      ringX += (mouseX - ringX) * 0.12;
      ringY += (mouseY - ringY) * 0.12;

      if (ringRef.current) {
        ringRef.current.style.transform = `translate(${ringX - 20}px, ${ringY - 20}px)`;
      }

      frameId = requestAnimationFrame(animateRing);
    };

    window.addEventListener("mousemove", onMouseMove);
    document.documentElement.addEventListener("mouseleave", onMouseLeave);
    document.documentElement.addEventListener("mouseenter", onMouseEnter);
    frameId = requestAnimationFrame(animateRing);

    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      document.documentElement.removeEventListener("mouseleave", onMouseLeave);
      document.documentElement.removeEventListener("mouseenter", onMouseEnter);
      cancelAnimationFrame(frameId);
      document.body.style.cursor = "";
    };
  }, [applyOpacity]);

  const isHover = cursorVariant === "hover";

  return (
    <>
      <div
        ref={dotRef}
        className="cursor-dot hidden md:block"
        style={{
          ...(isHover ? { scale: "2" } : {}),
        }}
      />
      <div
        ref={ringRef}
        className="cursor-ring hidden md:block"
        style={{
          scale: isHover ? "1.5" : "1",
          borderColor: isHover
            ? "rgba(201, 168, 76, 0.5)"
            : "rgba(201, 168, 76, 0.2)",
        }}
      />
    </>
  );
}
