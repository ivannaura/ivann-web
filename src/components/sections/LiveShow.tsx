"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useUIStore } from "@/stores/useUIStore";

const GALLERY_IMAGES = [
  { src: "/images/red-piano.png", alt: "Piano rojo teatral", aspect: "landscape" },
  { src: "/images/piano-led.png", alt: "Piano con LED", aspect: "portrait" },
  { src: "/images/dancer.png", alt: "Bailarina con IVANN", aspect: "landscape" },
  { src: "/images/theatrical.png", alt: "Show teatral", aspect: "landscape" },
  { src: "/images/flamenco.png", alt: "Flamenco", aspect: "landscape" },
  { src: "/images/stage-wide.png", alt: "Escenario completo", aspect: "landscape" },
  { src: "/images/show-1.png", alt: "Show en vivo 1", aspect: "landscape" },
  { src: "/images/show-2.png", alt: "Show en vivo 2", aspect: "landscape" },
];

const SHOW_ELEMENTS = [
  { icon: "♪", title: "Piano de Cola", desc: "Steinway & Sons, el corazón del show" },
  { icon: "◇", title: "Producción Visual", desc: "LED walls, lasers, mapping" },
  { icon: "☆", title: "Artistas Aéreos", desc: "Trapecistas y telas suspendidas" },
  { icon: "◈", title: "Danza", desc: "Ballet, contemporáneo, flamenco" },
];

export default function LiveShow() {
  const sectionRef = useRef<HTMLElement>(null);
  const [lightboxImg, setLightboxImg] = useState<string | null>(null);
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
              setTimeout(() => el.classList.add("active"), i * 200 + 200);
            });
          }
        });
      },
      { threshold: 0.08 }
    );

    observer.observe(section);
    return () => observer.disconnect();
  }, []);

  return (
    <>
      <section
        id="live"
        ref={sectionRef}
        className="relative py-32 md:py-48 px-6 md:px-12 overflow-hidden"
        style={{ background: "var(--bg-void)" }}
      >
        {/* Subtle red atmospheric glow */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse at 70% 30%, rgba(107,21,32,0.08) 0%, transparent 50%)",
          }}
        />

        <div className="max-w-[1200px] mx-auto relative z-10">
          {/* Section label */}
          <div className="reveal-up mb-16 md:mb-24">
            <span
              className="text-[10px] tracking-[0.4em] uppercase"
              style={{ color: "var(--text-muted)" }}
            >
              03 — El Show
            </span>
            <div
              className="line-grow mt-4 w-full h-px"
              style={{ background: "var(--bg-subtle)" }}
            />
          </div>

          {/* Main heading */}
          <h2
            className="reveal-up text-[clamp(2rem,6vw,4.5rem)] font-extralight leading-[1.05] mb-6 max-w-3xl"
            style={{ color: "var(--text-primary)" }}
          >
            Una experiencia que
            <br />
            <span style={{ color: "var(--crimson)" }}>
              desafía los sentidos
            </span>
          </h2>

          <p
            className="reveal-up text-base md:text-lg font-light leading-relaxed max-w-xl mb-16"
            style={{ color: "var(--text-secondary)" }}
          >
            Más de 200 shows han demostrado que cuando la música clásica se
            encuentra con el espectáculo, sucede algo que no se puede describir.
            Solo se puede vivir.
          </p>

          {/* Show elements grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-24">
            {SHOW_ELEMENTS.map((el) => (
              <div
                key={el.title}
                className="reveal-up p-6 rounded-sm transition-all duration-500 hover:bg-[var(--bg-subtle)]/30 group"
                style={{ border: "1px solid var(--bg-subtle)" }}
                onMouseEnter={() => setCursorVariant("hover")}
                onMouseLeave={() => setCursorVariant("default")}
              >
                <span
                  className="text-2xl block mb-4 transition-transform duration-500 group-hover:scale-110"
                  style={{ color: "var(--aura-gold)" }}
                >
                  {el.icon}
                </span>
                <h3
                  className="text-sm tracking-wide mb-2"
                  style={{ color: "var(--text-primary)" }}
                >
                  {el.title}
                </h3>
                <p
                  className="text-xs leading-relaxed"
                  style={{ color: "var(--text-muted)" }}
                >
                  {el.desc}
                </p>
              </div>
            ))}
          </div>

          {/* Gallery masonry-like grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
            {GALLERY_IMAGES.slice(0, 6).map((img, i) => (
              <div
                key={img.src}
                className={`img-reveal relative overflow-hidden rounded-sm cursor-pointer group ${
                  i === 0 ? "md:col-span-2 md:row-span-2" : ""
                }`}
                style={{
                  aspectRatio: i === 0 ? "4/3" : img.aspect === "portrait" ? "3/4" : "4/3",
                }}
                onClick={() => setLightboxImg(img.src)}
                onMouseEnter={() => setCursorVariant("hover")}
                onMouseLeave={() => setCursorVariant("default")}
              >
                <Image
                  src={img.src}
                  alt={img.alt}
                  fill
                  className="object-cover transition-transform duration-700 group-hover:scale-105"
                  sizes={i === 0 ? "(max-width: 768px) 100vw, 66vw" : "(max-width: 768px) 50vw, 33vw"}
                />
                {/* Hover overlay */}
                <div
                  className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                  style={{
                    background: "linear-gradient(to top, rgba(5,5,8,0.6) 0%, transparent 50%)",
                  }}
                />
              </div>
            ))}
          </div>

          {/* CTA */}
          <div className="reveal-up mt-16 text-center">
            <a
              href="#contact"
              onClick={(e) => {
                e.preventDefault();
                document.querySelector("#contact")?.scrollIntoView({ behavior: "smooth" });
              }}
              className="inline-block px-10 py-4 text-xs tracking-[0.3em] uppercase transition-all duration-500 rounded-sm hover:bg-[var(--aura-gold)] hover:text-[var(--bg-void)]"
              style={{
                border: "1px solid var(--aura-gold-dim)",
                color: "var(--aura-gold)",
              }}
              onMouseEnter={() => setCursorVariant("hover")}
              onMouseLeave={() => setCursorVariant("default")}
            >
              Contrata el Show
            </a>
          </div>
        </div>
      </section>

      {/* Lightbox */}
      {lightboxImg && (
        <div
          className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/90 backdrop-blur-sm cursor-pointer"
          onClick={() => setLightboxImg(null)}
        >
          <div className="relative max-w-[90vw] max-h-[90vh]">
            <Image
              src={lightboxImg}
              alt="IVANN AURA show"
              width={1200}
              height={800}
              className="object-contain max-h-[90vh] w-auto"
            />
          </div>
          <button
            className="absolute top-8 right-8 text-white/50 hover:text-white text-2xl transition-colors"
            onClick={() => setLightboxImg(null)}
          >
            ✕
          </button>
        </div>
      )}
    </>
  );
}
