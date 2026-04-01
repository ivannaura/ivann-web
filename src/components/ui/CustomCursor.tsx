"use client";

import { useEffect, useRef } from "react";
import { useUIStore } from "@/stores/useUIStore";

export default function CustomCursor() {
  const dotRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const cursorVariant = useUIStore((s) => s.cursorVariant);

  useEffect(() => {
    const isMobile = window.matchMedia("(pointer: coarse)").matches;
    if (isMobile) return;

    document.body.style.cursor = "none";

    let mouseX = -100;
    let mouseY = -100;
    let ringX = -100;
    let ringY = -100;
    let visible = false;

    // Set initial off-screen position imperatively (avoids React re-render overwriting transform)
    if (dotRef.current) dotRef.current.style.transform = "translate(-100px, -100px)";
    if (ringRef.current) ringRef.current.style.transform = "translate(-100px, -100px)";

    const onMouseMove = (e: MouseEvent) => {
      mouseX = e.clientX;
      mouseY = e.clientY;

      if (!visible) {
        visible = true;
        if (dotRef.current) dotRef.current.style.opacity = "";
        if (ringRef.current) ringRef.current.style.opacity = "";
      }

      // GPU-composited transform instead of left/top
      if (dotRef.current) {
        dotRef.current.style.transform = `translate(${mouseX - 4}px, ${mouseY - 4}px)`;
      }
    };

    const onMouseLeave = () => {
      visible = false;
      if (dotRef.current) dotRef.current.style.opacity = "0";
      if (ringRef.current) ringRef.current.style.opacity = "0";
    };

    const onMouseEnter = () => {
      visible = true;
      if (dotRef.current) dotRef.current.style.opacity = "";
      if (ringRef.current) ringRef.current.style.opacity = "";
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
  }, []);

  const isHover = cursorVariant === "hover";
  const isHidden = cursorVariant === "hidden";

  return (
    <>
      <div
        ref={dotRef}
        className="cursor-dot hidden md:block"
        style={{
          ...(isHover ? { scale: "2" } : {}),
          opacity: isHidden ? 0 : 1,
        }}
      />
      <div
        ref={ringRef}
        className="cursor-ring hidden md:block"
        style={{
          width: isHover ? "60px" : "40px",
          height: isHover ? "60px" : "40px",
          opacity: isHidden ? 0 : 0.3,
          borderColor: isHover
            ? "rgba(201, 168, 76, 0.5)"
            : "rgba(201, 168, 76, 0.2)",
        }}
      />
    </>
  );
}
