"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import gsap from "gsap";

interface TeaserWorldProps {
  name: string;
  subtitle: string;
  color: string; // CSS color for the accent
}

export default function TeaserWorld({ name, subtitle, color }: TeaserWorldProps) {
  const nameRef = useRef<HTMLHeadingElement>(null);
  const subtitleRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    // Simple entrance: name fades in + slides up, then subtitle
    const tl = gsap.timeline();
    if (nameRef.current) {
      tl.fromTo(nameRef.current,
        { opacity: 0, y: 20 },
        { opacity: 1, y: 0, duration: 1, ease: "power2.out" }
      );
    }
    if (subtitleRef.current) {
      tl.fromTo(subtitleRef.current,
        { opacity: 0 },
        { opacity: 1, duration: 0.6, ease: "power2.out" },
        "-=0.3"
      );
    }
    return () => { tl.kill(); };
  }, []);

  return (
    <>
      <Link
        href="/"
        className="fixed top-6 left-6 z-50 text-xs tracking-widest uppercase magnetic-btn transition-colors duration-300"
        style={{
          color: "var(--text-muted)",
          top: "max(1.5rem, env(safe-area-inset-top))",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.color = "var(--aura-gold)")}
        onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
      >
        ← Portal
      </Link>
      <main
        className="fixed inset-0 flex flex-col items-center justify-center"
        style={{ background: "var(--bg-void)" }}
      >
        {/* Subtle radial glow in the world's color */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: `radial-gradient(ellipse at 50% 50%, ${color}15, transparent 60%)`,
          }}
        />
        <h1
          ref={nameRef}
          className="text-5xl md:text-7xl font-light tracking-wider text-center relative z-10"
          style={{
            fontFamily: "var(--font-display)",
            color,
            opacity: 0,
          }}
        >
          {name}
        </h1>
        <p
          ref={subtitleRef}
          className="mt-6 text-sm tracking-[0.3em] uppercase relative z-10"
          style={{
            color: "var(--text-muted)",
            opacity: 0,
          }}
        >
          {subtitle}
        </p>
        <p
          className="mt-12 text-xs tracking-widest uppercase relative z-10"
          style={{ color: "var(--text-muted)", opacity: 0.5 }}
        >
          Próximamente
        </p>
      </main>
    </>
  );
}
