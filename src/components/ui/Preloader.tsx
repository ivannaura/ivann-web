"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { SplitText } from "gsap/SplitText";

if (typeof window !== "undefined") {
  gsap.registerPlugin(SplitText);
}

export default function Preloader() {
  const [hidden, setHidden] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const nameRef = useRef<HTMLHeadingElement>(null);
  const subtitleRef = useRef<HTMLParagraphElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const percentRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    const nameEl = nameRef.current;
    const subtitleEl = subtitleRef.current;
    const barEl = barRef.current;
    const percentEl = percentRef.current;
    if (!container || !nameEl || !subtitleEl || !barEl || !percentEl) return;

    const ctx = gsap.context(() => {
      // Split "IVANN AURA" into chars with word masking
      const nameSplit = SplitText.create(nameEl, {
        type: "words,chars",
        mask: "words",
      });

      // Split subtitle into chars
      const subtitleSplit = SplitText.create(subtitleEl, { type: "chars" });

      // Master timeline
      const tl = gsap.timeline({
        onComplete: () => {
          // Exit: scale up + fade out
          gsap.to(container, {
            opacity: 0,
            scale: 1.05,
            duration: 0.6,
            ease: "power2.in",
            onComplete: () => {
              setDismissed(true);
              // Let React remove from DOM after transition
              setTimeout(() => setHidden(true), 100);
            },
          });
        },
      });

      // 1. Name reveal — chars slide up from masked words
      tl.from(nameSplit.chars, {
        yPercent: 100,
        stagger: 0.04,
        duration: 0.8,
        ease: "power3.out",
      });

      // 2. Progress bar grows
      tl.to(
        barEl,
        {
          scaleX: 1,
          duration: 1.2,
          ease: "power2.inOut",
        },
        "-=0.3"
      );

      // 3. Counter ticks up
      tl.to(
        { val: 0 },
        {
          val: 100,
          duration: 1.2,
          ease: "power2.inOut",
          onUpdate: function () {
            percentEl.textContent = `${Math.round(this.targets()[0].val)}%`;
          },
        },
        "<"
      );

      // 4. Subtitle chars fade in
      tl.from(
        subtitleSplit.chars,
        {
          opacity: 0,
          y: 6,
          stagger: 0.02,
          duration: 0.4,
          ease: "power2.out",
        },
        "-=0.5"
      );

      // 5. Brief pause to let user read
      tl.to({}, { duration: 0.3 });
    }, container);

    // Fallback: force dismiss after 5s
    const fallback = setTimeout(() => {
      setDismissed(true);
      setTimeout(() => setHidden(true), 100);
    }, 5000);

    return () => {
      ctx.revert();
      clearTimeout(fallback);
    };
  }, []);

  if (hidden) return null;

  return (
    <div
      ref={containerRef}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100000,
        background: "var(--bg-void)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        pointerEvents: dismissed ? "none" : "auto",
      }}
    >
      {/* Name — masked char reveal */}
      <h1
        ref={nameRef}
        style={{
          fontSize: "clamp(1.5rem, 4vw, 2.5rem)",
          letterSpacing: "0.35em",
          fontWeight: 200,
          color: "var(--text-primary)",
          marginBottom: 24,
        }}
      >
        <span style={{ color: "var(--text-primary)" }}>IVANN </span>
        <span style={{ color: "var(--aura-gold)" }}>AURA</span>
      </h1>

      {/* Progress bar — starts at scaleX(0) */}
      <div
        style={{
          width: 120,
          height: 1,
          background: "var(--border-subtle)",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          ref={barRef}
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            height: "100%",
            width: "100%",
            background:
              "linear-gradient(to right, var(--aura-gold-dim), var(--aura-gold))",
            transformOrigin: "left",
            transform: "scaleX(0)",
          }}
        />
      </div>

      {/* Percentage counter */}
      <span
        ref={percentRef}
        style={{
          fontSize: 11,
          fontFamily: "var(--font-geist-mono), monospace",
          color: "var(--text-muted)",
          marginTop: 12,
          letterSpacing: "0.1em",
        }}
      >
        0%
      </span>

      {/* Subtitle */}
      <p
        ref={subtitleRef}
        style={{
          fontSize: 10,
          letterSpacing: "0.3em",
          textTransform: "uppercase",
          color: "var(--text-muted)",
          marginTop: 24,
        }}
      >
        Live Experience
      </p>
    </div>
  );
}
