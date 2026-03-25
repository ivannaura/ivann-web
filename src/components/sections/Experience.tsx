"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import { useUIStore } from "@/stores/useUIStore";

const STATS = [
  { number: "200+", label: "Shows" },
  { number: "15+", label: "Años" },
  { number: "4", label: "Álbumes" },
  { number: "∞", label: "Emociones" },
];

export default function Experience() {
  const sectionRef = useRef<HTMLElement>(null);
  const setCursorVariant = useUIStore((s) => s.setCursorVariant);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const reveals = section.querySelectorAll(".reveal-up");
            reveals.forEach((el, i) => {
              setTimeout(() => el.classList.add("active"), i * 150);
            });
            const images = section.querySelectorAll(".img-reveal");
            images.forEach((el, i) => {
              setTimeout(() => el.classList.add("active"), i * 200 + 300);
            });
            const lines = section.querySelectorAll(".line-grow");
            lines.forEach((el) => {
              setTimeout(() => el.classList.add("active"), 400);
            });
          }
        });
      },
      { threshold: 0.15 }
    );

    observer.observe(section);
    return () => observer.disconnect();
  }, []);

  return (
    <section
      id="experience"
      ref={sectionRef}
      className="relative py-32 md:py-48 px-6 md:px-12"
      style={{ background: "var(--bg-void)" }}
    >
      <div className="max-w-[1200px] mx-auto">
        {/* Section label */}
        <div className="reveal-up mb-16 md:mb-24">
          <span
            className="text-[10px] tracking-[0.4em] uppercase"
            style={{ color: "var(--text-muted)" }}
          >
            01 — La Experiencia
          </span>
          <div
            className="line-grow mt-4 w-full h-px"
            style={{ background: "var(--bg-subtle)" }}
          />
        </div>

        {/* Main content grid */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-12 md:gap-8">
          {/* Text column */}
          <div className="md:col-span-5 flex flex-col justify-center">
            <h2
              className="reveal-up text-[clamp(2rem,5vw,3.5rem)] font-extralight leading-[1.1] mb-8"
              style={{ color: "var(--text-primary)" }}
            >
              No es un
              <br />
              <span style={{ color: "var(--aura-gold)" }}>concierto.</span>
              <br />
              Es un viaje.
            </h2>

            <p
              className="reveal-up text-base md:text-lg leading-relaxed mb-6 font-light"
              style={{ color: "var(--text-secondary)" }}
            >
              Imagina un escenario donde la música clásica se encuentra con la
              tecnología del futuro. Donde un piano de cola convive con luces
              LED, bailarinas aéreas, y beats electrónicos.
            </p>

            <p
              className="reveal-up text-base md:text-lg leading-relaxed mb-10 font-light"
              style={{ color: "var(--text-secondary)" }}
            >
              IVANN AURA no toca conciertos — crea experiencias donde cada nota
              se ve, cada acorde se siente, y cada momento se vive como si fuera
              único. Porque lo es.
            </p>

            <blockquote
              className="reveal-up border-l-2 pl-6 py-2 italic"
              style={{
                borderColor: "var(--aura-gold-dim)",
                color: "var(--text-secondary)",
              }}
            >
              &ldquo;Si Beethoven estuviera vivo, usaría la tecnología
              disponible.&rdquo;
              <span
                className="block mt-2 text-sm not-italic"
                style={{ color: "var(--text-muted)" }}
              >
                — IVANN AURA
              </span>
            </blockquote>
          </div>

          {/* Spacer */}
          <div className="hidden md:block md:col-span-1" />

          {/* Image column */}
          <div className="md:col-span-6 relative">
            <div className="img-reveal relative aspect-[3/4] md:aspect-[4/5] rounded-sm overflow-hidden">
              <Image
                src="/images/portrait.png"
                alt="IVANN AURA retrato"
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 50vw"
              />
              {/* Overlay gradient */}
              <div
                className="absolute inset-0"
                style={{
                  background:
                    "linear-gradient(to top, var(--bg-void) 0%, transparent 30%)",
                }}
              />
            </div>

            {/* Floating decorative element */}
            <div
              className="absolute -bottom-6 -left-6 w-24 h-24 rounded-full opacity-20"
              style={{
                background:
                  "radial-gradient(circle, var(--aura-gold) 0%, transparent 70%)",
                animation: "pulse-glow 3s ease-in-out infinite",
              }}
            />
          </div>
        </div>

        {/* Stats row */}
        <div className="mt-24 md:mt-32 grid grid-cols-2 md:grid-cols-4 gap-8">
          {STATS.map((stat, i) => (
            <div key={stat.label} className="reveal-up text-center md:text-left">
              <div
                className="text-[clamp(2rem,4vw,3rem)] font-extralight tracking-wider"
                style={{
                  color: "var(--aura-gold)",
                  transitionDelay: `${i * 100}ms`,
                }}
              >
                {stat.number}
              </div>
              <div
                className="text-xs tracking-[0.3em] uppercase mt-2"
                style={{ color: "var(--text-muted)" }}
              >
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
