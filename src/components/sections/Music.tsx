"use client";

import { useEffect, useRef, useState } from "react";
import { useUIStore } from "@/stores/useUIStore";

interface Album {
  title: string;
  year: string;
  description: string;
  auraColor: string;
  tracks: string[];
}

const ALBUMS: Album[] = [
  {
    title: "Apocalypsis",
    year: "2023",
    description:
      "Fusión sinfónico-electrónica. Una experiencia apocalíptica donde el piano clásico colapsa con beats del futuro.",
    auraColor: "var(--crimson)",
    tracks: [
      "Apocalypsis",
      "Resurrection",
      "Dark Waltz",
      "Storm",
      "New Dawn",
    ],
  },
  {
    title: "Romantique",
    year: "2020",
    description:
      "Versiones cinematicas de clásicos del romanticismo. Chopin, Beethoven y Liszt reimaginados.",
    auraColor: "var(--deep-blue)",
    tracks: [
      "Claro de Luna",
      "Vals de las Flores",
      "Liebestraum",
      "Nocturne Op.9",
      "La Campanella",
    ],
  },
  {
    title: "Piano & Fire",
    year: "2018",
    description:
      "El álbum que definió el sonido IVANN AURA. Piano acústico + producción electrónica.",
    auraColor: "var(--aura-gold)",
    tracks: [
      "Ignition",
      "Sacred Fire",
      "Midnight Sun",
      "Ember",
      "Phoenix",
    ],
  },
  {
    title: "First Light",
    year: "2015",
    description:
      "El debut. Composiciones originales de piano solo. Puro, íntimo, emocional.",
    auraColor: "var(--text-secondary)",
    tracks: [
      "Dawn",
      "Solitude",
      "Memory Lane",
      "Lullaby",
      "First Light",
    ],
  },
];

export default function Music() {
  const sectionRef = useRef<HTMLElement>(null);
  const [activeAlbum, setActiveAlbum] = useState(0);
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
          }
        });
      },
      { threshold: 0.1 }
    );

    observer.observe(section);
    return () => observer.disconnect();
  }, []);

  const album = ALBUMS[activeAlbum];

  return (
    <section
      id="music"
      ref={sectionRef}
      className="relative py-32 md:py-48 px-6 md:px-12"
      style={{ background: "var(--bg-surface)" }}
    >
      {/* Background aura glow based on active album */}
      <div
        className="absolute inset-0 transition-all duration-1000 pointer-events-none"
        style={{
          background: `radial-gradient(ellipse at 50% 50%, ${album.auraColor}15 0%, transparent 60%)`,
        }}
      />

      <div className="max-w-[1200px] mx-auto relative z-10">
        {/* Section label */}
        <div className="reveal-up mb-16 md:mb-24">
          <span
            className="text-[10px] tracking-[0.4em] uppercase"
            style={{ color: "var(--text-muted)" }}
          >
            02 — Música
          </span>
          <div
            className="line-grow mt-4 w-full h-px"
            style={{ background: "var(--bg-subtle)" }}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-12">
          {/* Album selector (left) */}
          <div className="md:col-span-4">
            <div className="flex flex-col gap-2">
              {ALBUMS.map((a, i) => (
                <button
                  key={a.title}
                  onClick={() => setActiveAlbum(i)}
                  className={`reveal-up text-left py-4 px-5 rounded-sm transition-all duration-500 group ${
                    i === activeAlbum
                      ? "bg-[var(--bg-subtle)]"
                      : "bg-transparent hover:bg-[var(--bg-subtle)]/30"
                  }`}
                  onMouseEnter={() => setCursorVariant("hover")}
                  onMouseLeave={() => setCursorVariant("default")}
                >
                  <div className="flex items-baseline gap-4">
                    <span
                      className="text-xs font-mono"
                      style={{
                        color:
                          i === activeAlbum
                            ? a.auraColor
                            : "var(--text-muted)",
                      }}
                    >
                      {a.year}
                    </span>
                    <span
                      className="text-lg md:text-xl font-light tracking-wide transition-colors duration-300"
                      style={{
                        color:
                          i === activeAlbum
                            ? "var(--text-primary)"
                            : "var(--text-secondary)",
                      }}
                    >
                      {a.title}
                    </span>
                  </div>
                  {/* Active indicator line */}
                  <div
                    className="mt-3 h-px transition-all duration-500"
                    style={{
                      background: i === activeAlbum ? a.auraColor : "transparent",
                      transform: i === activeAlbum ? "scaleX(1)" : "scaleX(0)",
                      transformOrigin: "left",
                    }}
                  />
                </button>
              ))}
            </div>

            {/* Streaming links */}
            <div className="reveal-up mt-12 flex gap-6">
              {["Spotify", "Apple Music", "YouTube"].map((platform) => (
                <a
                  key={platform}
                  href="#"
                  className="text-[10px] tracking-[0.2em] uppercase transition-colors duration-300 hover:text-[var(--aura-gold)]"
                  style={{ color: "var(--text-muted)" }}
                  onMouseEnter={() => setCursorVariant("hover")}
                  onMouseLeave={() => setCursorVariant("default")}
                >
                  {platform}
                </a>
              ))}
            </div>
          </div>

          {/* Album detail (right) */}
          <div className="md:col-span-1" />
          <div className="md:col-span-7">
            <div className="reveal-up">
              {/* Album art placeholder — large square with aura */}
              <div
                className="relative aspect-square w-full max-w-[500px] rounded-sm overflow-hidden mb-10 group"
                style={{
                  background: `linear-gradient(135deg, var(--bg-subtle) 0%, var(--bg-void) 100%)`,
                }}
              >
                {/* Aura glow */}
                <div
                  className="absolute inset-0 transition-all duration-1000"
                  style={{
                    background: `radial-gradient(circle at 50% 50%, ${album.auraColor}30 0%, transparent 70%)`,
                  }}
                />
                {/* Album title */}
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span
                    className="text-[clamp(2rem,5vw,4rem)] font-extralight tracking-[0.2em]"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {album.title}
                  </span>
                  <span
                    className="text-sm tracking-[0.3em] mt-2"
                    style={{ color: album.auraColor }}
                  >
                    {album.year}
                  </span>
                </div>
                {/* Decorative particles */}
                <div
                  className="absolute w-2 h-2 rounded-full"
                  style={{
                    background: album.auraColor,
                    top: "20%",
                    left: "15%",
                    opacity: 0.3,
                    animation: "float 4s ease-in-out infinite",
                  }}
                />
                <div
                  className="absolute w-1 h-1 rounded-full"
                  style={{
                    background: album.auraColor,
                    bottom: "30%",
                    right: "20%",
                    opacity: 0.5,
                    animation: "float 3s ease-in-out infinite 0.5s",
                  }}
                />
                <div
                  className="absolute w-1.5 h-1.5 rounded-full"
                  style={{
                    background: "var(--particle-core)",
                    top: "40%",
                    right: "30%",
                    opacity: 0.2,
                    animation: "float 5s ease-in-out infinite 1s",
                  }}
                />
              </div>

              {/* Description */}
              <p
                className="text-base font-light leading-relaxed mb-8"
                style={{ color: "var(--text-secondary)" }}
              >
                {album.description}
              </p>

              {/* Track list */}
              <div className="flex flex-col">
                {album.tracks.map((track, i) => (
                  <div
                    key={track}
                    className="flex items-center gap-4 py-3 border-b group cursor-pointer transition-colors duration-300 hover:bg-[var(--bg-subtle)]/20"
                    style={{ borderColor: "var(--bg-subtle)" }}
                    onMouseEnter={() => setCursorVariant("hover")}
                    onMouseLeave={() => setCursorVariant("default")}
                  >
                    <span
                      className="text-xs font-mono w-6"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span
                      className="text-sm tracking-wide flex-1 transition-colors duration-300 group-hover:text-[var(--aura-gold)]"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      {track}
                    </span>
                    {/* Play icon */}
                    <svg
                      className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                      viewBox="0 0 12 12"
                      fill="none"
                    >
                      <path
                        d="M2.5 1L10.5 6L2.5 11V1Z"
                        fill="var(--aura-gold)"
                      />
                    </svg>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
