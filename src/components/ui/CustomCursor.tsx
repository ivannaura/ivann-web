"use client";

import { useEffect, useRef, useCallback } from "react";
import gsap from "gsap";
import { useUIStore } from "@/stores/useUIStore";

// Precomputed ln constants: Math.pow(c, dt) === Math.exp(ln_c * dt)
const LN_088 = Math.log(0.88);   // for 1 - Math.pow(1 - 0.12, dt)
const LN_VELOCITY_DECAY = Math.log(0.9); // VELOCITY_DECAY = 0.9

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

    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      document.body.style.cursor = "none";
    }

    let mouseX = -100;
    let mouseY = -100;
    let ringX = -100;
    let ringY = -100;

    // Scroll velocity tracking for directional ring stretch
    let lastScrollY = window.scrollY;
    let scrollVelocity = 0;
    const VELOCITY_SCALE = 0.003; // Normalize px/frame to 0-1 range
    const MAX_STRETCH = 0.4; // Cap scaleY addition at 1.4
    const VELOCITY_THRESHOLD = 0.02; // Minimum velocity to apply stretch

    const onScroll = () => {
      const currentScrollY = window.scrollY;
      const delta = currentScrollY - lastScrollY;
      lastScrollY = currentScrollY;
      scrollVelocity += delta * VELOCITY_SCALE;
    };

    // Set initial off-screen position imperatively (avoids React re-render overwriting translate)
    if (dotRef.current) dotRef.current.style.translate = "-100px -100px";
    if (ringRef.current) ringRef.current.style.translate = "-100px -100px";

    const onMouseMove = (e: MouseEvent) => {
      mouseX = e.clientX;
      mouseY = e.clientY;

      if (!visibleRef.current) {
        visibleRef.current = true;
        applyOpacity();
      }

      // GPU-composited translate instead of left/top
      if (dotRef.current) {
        dotRef.current.style.translate = `${mouseX - 4}px ${mouseY - 4}px`;
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

    // GSAP ticker callback for ring interpolation
    const animateRing = () => {
      // Skip when cursor is not visible (preserves optimization)
      if (!visibleRef.current) return;

      // Delta-time normalized to 60fps from GSAP ticker
      const dt = Math.min(gsap.ticker.deltaRatio(60), 3);

      const lerpFactor = 1 - Math.exp(LN_088 * dt);
      ringX += (mouseX - ringX) * lerpFactor;
      ringY += (mouseY - ringY) * lerpFactor;

      // Decay scroll velocity smoothly each frame (dt-corrected)
      scrollVelocity *= Math.exp(LN_VELOCITY_DECAY * dt);

      // Compute scaleY stretch from absolute velocity
      const absVelocity = Math.abs(scrollVelocity);
      const stretchY = absVelocity > VELOCITY_THRESHOLD
        ? 1 + Math.min(absVelocity, MAX_STRETCH)
        : 1;
      // Compress X slightly to maintain perceived area
      const stretchX = stretchY > 1 ? 1 / Math.sqrt(stretchY) : 1;

      if (ringRef.current) {
        // CSS translate for position (avoids large template string);
        // stretch in transform (composes independently of React `scale` hover prop)
        ringRef.current.style.translate = `${ringX - 20}px ${ringY - 20}px`;
        if (stretchY > 1) {
          ringRef.current.style.transform = `scaleX(${stretchX}) scaleY(${stretchY})`;
        } else {
          ringRef.current.style.transform = '';
        }
      }
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("scroll", onScroll, { passive: true });
    document.documentElement.addEventListener("mouseleave", onMouseLeave);
    document.documentElement.addEventListener("mouseenter", onMouseEnter);
    gsap.ticker.add(animateRing);

    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("scroll", onScroll);
      document.documentElement.removeEventListener("mouseleave", onMouseLeave);
      document.documentElement.removeEventListener("mouseenter", onMouseEnter);
      gsap.ticker.remove(animateRing);
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
