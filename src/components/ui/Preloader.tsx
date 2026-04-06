"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { SplitText } from "gsap/SplitText";
import { playClick } from "@/lib/micro-sounds";

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

  useEffect(() => {
    const container = containerRef.current;
    const nameEl = nameRef.current;
    const subtitleEl = subtitleRef.current;
    const barEl = barRef.current;
    if (!container || !nameEl || !subtitleEl || !barEl) return;

    let dismissTimeout: ReturnType<typeof setTimeout>;

    const dismiss = () => {
      setDismissed(true);
      dismissTimeout = setTimeout(() => setHidden(true), 1100);
    };

    // Reduced-motion: skip all animations, show static content briefly, dismiss
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const rmTimeout = setTimeout(dismiss, 500);
      return () => {
        clearTimeout(rmTimeout);
        clearTimeout(dismissTimeout);
      };
    }

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
          // Wait for video readiness before iris-close exit
          const video = document.querySelector("video");
          const proceedDismiss = () => {
            if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
              dismiss();
              return;
            }

            // Exit: cinematic iris-close — circle collapses to center, revealing page
            gsap.to(container, {
              clipPath: "circle(0.01% at 50% 50%)",
              duration: 1.0,
              ease: "power3.inOut",
              onComplete: dismiss,
            });

            // Simultaneously scale content down for parallax depth
            gsap.to([nameEl, subtitleEl, barEl.parentElement], {
              scale: 0.95,
              opacity: 0.5,
              duration: 1.0,
              ease: "power2.in",
            });
          };

          if (video && video.readyState < 4) {
            video.addEventListener("canplaythrough", proceedDismiss, { once: true });
          } else {
            proceedDismiss();
          }
        },
      });

      // 1. Name reveal — chars slide up from masked words
      tl.from(nameSplit.chars, {
        yPercent: 100,
        stagger: 0.04,
        duration: 0.8,
        ease: "power3.out",
        onComplete: () => playClick(), // Audio primer — primes AudioContext for iOS
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

      // 3. Subtitle chars fade in
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

      // 4. Brief pause to let user read
      tl.to({}, { duration: 0.3 });
    }, container);

    // Fallback: force dismiss after 8s
    const fallback = setTimeout(dismiss, 8000);

    return () => {
      ctx.revert();
      clearTimeout(fallback);
      clearTimeout(dismissTimeout);
    };
  }, []);

  if (hidden) return null;

  return (
    <div
      ref={containerRef}
      role="status"
      aria-live="polite"
      aria-label="Cargando IVANN AURA"
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
      {/* Subtle grain texture overlay */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          opacity: 0.03,
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E\")",
          backgroundRepeat: "repeat",
        }}
      />
      {/* Name — masked char reveal */}
      <h1
        ref={nameRef}
        style={{
          fontSize: "clamp(1.5rem, 4vw, 2.5rem)",
          letterSpacing: "0.35em",
          fontWeight: 300,
          fontFamily: "var(--font-display)",
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

      {/* Subtitle */}
      <p
        ref={subtitleRef}
        style={{
          fontSize: "clamp(11px, 1.5vw, 13px)",
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
