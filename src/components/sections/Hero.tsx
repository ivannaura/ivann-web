"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";

export default function Hero() {
  const sectionRef = useRef<HTMLElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const subtitleRef = useRef<HTMLParagraphElement>(null);
  const scrollIndicatorRef = useRef<HTMLDivElement>(null);
  useEffect(() => {

    // Animate title
    const title = titleRef.current;
    const subtitle = subtitleRef.current;
    const scrollInd = scrollIndicatorRef.current;

    if (title) {
      title.style.opacity = "0";
      title.style.transform = "translateY(40px)";
      setTimeout(() => {
        title.style.transition =
          "opacity 1.2s cubic-bezier(0.16, 1, 0.3, 1), transform 1.2s cubic-bezier(0.16, 1, 0.3, 1)";
        title.style.opacity = "1";
        title.style.transform = "translateY(0)";
      }, 300);
    }

    if (subtitle) {
      subtitle.style.opacity = "0";
      subtitle.style.transform = "translateY(30px)";
      setTimeout(() => {
        subtitle.style.transition =
          "opacity 1s cubic-bezier(0.16, 1, 0.3, 1), transform 1s cubic-bezier(0.16, 1, 0.3, 1)";
        subtitle.style.opacity = "1";
        subtitle.style.transform = "translateY(0)";
      }, 800);
    }

    if (scrollInd) {
      scrollInd.style.opacity = "0";
      setTimeout(() => {
        scrollInd.style.transition = "opacity 1s ease-out";
        scrollInd.style.opacity = "1";
      }, 1800);
    }
  }, []);

  // Parallax on scroll
  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    const onScroll = () => {
      const y = window.scrollY;
      const img = section.querySelector(".hero-img") as HTMLElement;
      if (img) {
        img.style.transform = `scale(1.1) translateY(${y * 0.15}px)`;
      }
      // Fade out on scroll
      const opacity = Math.max(0, 1 - y / (window.innerHeight * 0.6));
      const content = section.querySelector(".hero-content") as HTMLElement;
      if (content) {
        content.style.opacity = String(opacity);
        content.style.transform = `translateY(${y * 0.3}px)`;
      }
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <section
      id="hero"
      ref={sectionRef}
      className="relative h-screen w-full overflow-hidden"
    >
      {/* Background image with overlay */}
      <div className="absolute inset-0">
        <Image
          src="/images/hero-piano.png"
          alt="IVANN AURA en concierto"
          fill
          className="hero-img object-cover object-center scale-110"
          priority
          sizes="100vw"
        />
        {/* Dark overlay */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse at center, rgba(5,5,8,0.5) 0%, rgba(5,5,8,0.85) 60%, rgba(5,5,8,0.95) 100%)",
          }}
        />
        {/* Blue atmospheric glow */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse at 50% 30%, rgba(26,45,90,0.25) 0%, transparent 60%)",
          }}
        />
        {/* Gold accent glow from below */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse at 50% 120%, rgba(201,168,76,0.08) 0%, transparent 50%)",
          }}
        />
      </div>

      {/* Bottom gradient fade to void */}
      <div className="absolute bottom-0 left-0 right-0 h-40 gradient-fade-b z-10" />

      {/* Content */}
      <div className="hero-content relative z-20 flex flex-col items-center justify-center h-full text-center px-6">
        <h1
          ref={titleRef}
          className="text-[clamp(3rem,10vw,8rem)] font-extralight tracking-[0.15em] leading-none mb-4"
        >
          <span style={{ color: "var(--text-primary)" }}>IVANN</span>
          <br />
          <span
            className="mt-2 block"
            style={{ color: "var(--aura-gold)" }}
          >
            AURA
          </span>
        </h1>

        <p
          ref={subtitleRef}
          className="text-[clamp(0.75rem,2vw,1rem)] tracking-[0.4em] uppercase font-light mt-6"
          style={{ color: "var(--text-secondary)" }}
        >
          Live Experience
        </p>

        {/* Decorative line */}
        <div
          className="w-12 h-px mt-8"
          style={{ background: "var(--aura-gold-dim)" }}
        />
      </div>

      {/* Scroll indicator */}
      <div
        ref={scrollIndicatorRef}
        className="absolute bottom-12 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-3"
      >
        <span
          className="text-[10px] tracking-[0.3em] uppercase"
          style={{ color: "var(--text-muted)" }}
        >
          Scroll
        </span>
        <div className="w-px h-12 relative overflow-hidden">
          <div
            className="w-full h-full"
            style={{
              background: "linear-gradient(to bottom, var(--aura-gold-dim), transparent)",
              animation: "float 2s ease-in-out infinite",
            }}
          />
        </div>
      </div>
    </section>
  );
}
