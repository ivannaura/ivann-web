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
  const batonRef = useRef<HTMLDivElement>(null);
  const pctRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    const nameEl = nameRef.current;
    const subtitleEl = subtitleRef.current;
    const barEl = barRef.current;
    const batonEl = batonRef.current;
    if (!container || !nameEl || !subtitleEl || !barEl || !batonEl) return;

    let dismissTimeout: ReturnType<typeof setTimeout>;
    let progressInterval: ReturnType<typeof setInterval>;
    let bindRetryTimeout: ReturnType<typeof setTimeout>;
    let videoEl: HTMLVideoElement | null = null;
    let introComplete = false;
    let exitStarted = false;

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

    // --- Exit sequence: animate bar to 100%, then iris-close ---
    const startExit = () => {
      if (exitStarted) return;
      exitStarted = true;
      clearInterval(progressInterval);

      // Bar to 100%
      gsap.to(barEl, { scaleX: 1, duration: 0.3, ease: "power2.out" });
      if (pctRef.current) pctRef.current.textContent = "100%";

      // Brief hold then iris-close
      gsap.delayedCall(0.35, () => {
        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
          dismiss();
          return;
        }
        gsap.to(container, {
          clipPath: "circle(0% at 50% 50%)",
          duration: 1.0,
          ease: "power3.inOut",
          onComplete: dismiss,
        });
        gsap.to([nameEl, subtitleEl, barEl.parentElement], {
          scale: 0.95,
          opacity: 0,
          duration: 0.6,
          ease: "power2.in",
        });
      });
    };

    // --- Buffer progress tracking ---
    const getBufferProgress = (): number => {
      const video = videoEl || document.querySelector("video");
      if (!videoEl && video) videoEl = video;
      if (!video || !video.duration || !video.buffered.length) return 0;
      let maxEnd = 0;
      for (let i = 0; i < video.buffered.length; i++) {
        if (video.buffered.start(i) <= 0.5) {
          maxEnd = Math.max(maxEnd, video.buffered.end(i));
        }
      }
      return maxEnd / video.duration;
    };

    const isVideoReady = (): boolean => {
      const video = videoEl || document.querySelector("video");
      if (!video) return false;
      // Ready when 90%+ buffered or browser says canplaythrough (readyState 4)
      return video.readyState >= 4 || getBufferProgress() >= 0.9;
    };

    const checkReady = () => {
      const progress = getBufferProgress();
      // Animate bar to real progress (minimum 2% so bar is visible)
      gsap.to(barEl, {
        scaleX: Math.max(0.02, progress),
        duration: 0.4,
        ease: "none",
        overwrite: true,
      });
      if (pctRef.current) {
        pctRef.current.textContent =
          progress > 0.01
            ? `${Math.round(progress * 100)}%`
            : "Conectando...";
      }
      // If both intro is done AND video is ready, start exit
      if (introComplete && isVideoReady()) {
        startExit();
      }
    };

    // Start polling buffer progress immediately
    progressInterval = setInterval(checkReady, 250);
    checkReady();

    // Bind canplaythrough listener (video may mount after preloader)
    const onCanPlayThrough = () => {
      if (introComplete) startExit();
    };
    const bindVideo = () => {
      const video = document.querySelector("video");
      if (video && !videoEl) {
        videoEl = video;
        if (video.readyState >= 4) {
          onCanPlayThrough();
        } else {
          video.addEventListener("canplaythrough", onCanPlayThrough, {
            once: true,
          });
        }
      }
    };
    bindVideo();
    bindRetryTimeout = setTimeout(bindVideo, 500);

    // --- Intro animation ---
    const ctx = gsap.context(() => {
      const nameSplit = SplitText.create(nameEl, {
        type: "words,chars",
        mask: "words",
      });
      const subtitleSplit = SplitText.create(subtitleEl, {
        type: "words,chars",
      });

      const tl = gsap.timeline({
        onComplete: () => {
          introComplete = true;
          // If video is already loaded, exit immediately
          if (isVideoReady()) {
            startExit();
          }
          // Otherwise, the checkReady interval will trigger startExit
        },
      });

      // 1. Name reveal — chars slide up from masked words
      tl.from(nameSplit.chars, {
        yPercent: 100,
        stagger: 0.04,
        duration: 0.8,
        ease: "power3.out",
      });

      // 1b. Conductor's baton — gold line draws across during name reveal
      tl.fromTo(
        batonEl,
        { scaleX: 0, opacity: 0 },
        { scaleX: 1, opacity: 1, duration: 0.9, ease: "power2.inOut" },
        "-=0.6"
      );
      tl.to(batonEl, { opacity: 0, duration: 0.4, ease: "power2.in" });

      // 2b. Subtle float on the title during wait
      tl.to(
        nameEl,
        {
          y: -4,
          duration: 1.6,
          ease: "sine.inOut",
          yoyo: true,
          repeat: 1,
        },
        "-=0.5"
      );

      // 3. Subtitle words fade in with staggered y-offset per word
      tl.from(
        subtitleSplit.words,
        {
          opacity: 0,
          y: 12,
          stagger: 0.12,
          duration: 0.5,
          ease: "power3.out",
        },
        "-=1.8"
      );

      // 3b. Then individual chars within each word sharpen into place
      tl.from(
        subtitleSplit.chars,
        {
          opacity: 0,
          stagger: 0.015,
          duration: 0.3,
          ease: "power2.out",
        },
        "-=1.2"
      );

      // 4. Brief pause to let user read
      tl.to({}, { duration: 0.3 });
    }, container);

    // Fallback: force dismiss after 20s (even if video isn't fully loaded)
    const fallback = setTimeout(() => {
      if (!exitStarted) startExit();
    }, 20000);

    return () => {
      ctx.revert();
      clearTimeout(fallback);
      clearTimeout(dismissTimeout);
      clearTimeout(bindRetryTimeout);
      clearInterval(progressInterval);
      if (videoEl) {
        videoEl.removeEventListener("canplaythrough", onCanPlayThrough);
      }
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
          opacity: 0.08,
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E\")",
          backgroundRepeat: "repeat",
        }}
      />

      {/* Conductor's baton — gold line that sweeps across during name reveal */}
      <div
        ref={batonRef}
        aria-hidden="true"
        style={{
          position: "absolute",
          top: "calc(50% - 40px)",
          left: "20%",
          width: "60%",
          height: "1px",
          background:
            "linear-gradient(to right, transparent, var(--aura-gold-dim), var(--aura-gold), var(--aura-gold-dim), transparent)",
          transformOrigin: "left",
          transform: "scaleX(0)",
          opacity: 0,
          pointerEvents: "none",
        }}
      />

      {/* Ambient depth layer — subtle gold radial behind title */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          background:
            "radial-gradient(ellipse 60% 40% at 50% 50%, rgba(201,168,76,0.04) 0%, transparent 70%)",
        }}
      />

      {/* Name — masked char reveal */}
      <h1
        ref={nameRef}
        style={{
          fontSize: "clamp(2.5rem, 8vw, 7rem)",
          letterSpacing: "0.35em",
          fontWeight: 300,
          fontFamily: "var(--font-display)",
          color: "var(--text-primary)",
          marginBottom: 24,
        }}
      >
        <span style={{ color: "var(--text-secondary)" }}>IVANN </span>
        <span style={{ color: "var(--aura-gold)" }}>AURA</span>
      </h1>

      {/* Progress bar — tracks real video buffer progress */}
      <div
        style={{
          width: "clamp(120px, 40vw, 400px)",
          height: 1,
          background: "var(--border-subtle)",
          position: "relative",
        }}
      >
        <div
          ref={barRef}
          className="preloader-bar-glow"
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

      {/* Loading percentage */}
      <span
        ref={pctRef}
        aria-hidden="true"
        style={{
          fontSize: "clamp(9px, 1.2vw, 11px)",
          letterSpacing: "0.3em",
          color: "var(--text-muted)",
          marginTop: 12,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        Conectando...
      </span>

      {/* Subtitle — word-staggered reveal with interpuncts */}
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
        Pianista &middot; Compositor &middot; Live Experience
      </p>
    </div>
  );
}
