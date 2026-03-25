"use client";

import { useEffect, useRef } from "react";
import { useUIStore } from "@/stores/useUIStore";

export default function CustomCursor() {
  const dotRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const cursorVariant = useUIStore((s) => s.cursorVariant);

  useEffect(() => {
    // Only show custom cursor on desktop
    const isMobile = window.matchMedia("(pointer: coarse)").matches;
    if (isMobile) return;

    document.body.style.cursor = "none";

    let mouseX = 0;
    let mouseY = 0;
    let ringX = 0;
    let ringY = 0;

    const onMouseMove = (e: MouseEvent) => {
      mouseX = e.clientX;
      mouseY = e.clientY;

      if (dotRef.current) {
        dotRef.current.style.left = `${mouseX - 4}px`;
        dotRef.current.style.top = `${mouseY - 4}px`;
      }
    };

    let frameId = 0;
    const animateRing = () => {
      ringX += (mouseX - ringX) * 0.12;
      ringY += (mouseY - ringY) * 0.12;

      if (ringRef.current) {
        ringRef.current.style.left = `${ringX - 20}px`;
        ringRef.current.style.top = `${ringY - 20}px`;
      }

      frameId = requestAnimationFrame(animateRing);
    };

    window.addEventListener("mousemove", onMouseMove);
    frameId = requestAnimationFrame(animateRing);

    return () => {
      window.removeEventListener("mousemove", onMouseMove);
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
          transform: isHover ? "scale(2)" : "scale(1)",
          opacity: isHidden ? 0 : 1,
        }}
      />
      <div
        ref={ringRef}
        className="cursor-ring hidden md:block"
        style={{
          width: isHover ? "60px" : "40px",
          height: isHover ? "60px" : "40px",
          marginLeft: isHover ? "-10px" : "0",
          marginTop: isHover ? "-10px" : "0",
          opacity: isHidden ? 0 : 0.3,
          borderColor: isHover
            ? "rgba(201, 168, 76, 0.5)"
            : "rgba(201, 168, 76, 0.2)",
        }}
      />
    </>
  );
}
