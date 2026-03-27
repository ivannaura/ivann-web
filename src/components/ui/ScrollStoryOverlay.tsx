"use client";

import { useMemo } from "react";

interface StoryBeat {
  /** First frame where this element is visible */
  frameStart: number;
  /** Last frame where this element is visible */
  frameEnd: number;
  /** Content to render */
  content: React.ReactNode;
  /** Position on screen */
  position:
    | "center"
    | "left"
    | "right"
    | "bottom"
    | "bottom-left"
    | "bottom-right"
    | "top-left";
  /** Entry animation */
  animation: "fade" | "slide-left" | "slide-up" | "slide-right" | "typewriter";
  /** CSS blend mode for text-on-video interaction */
  blendMode?: string;
}

// Frame ranges per act (at 3fps):
// Act 1: frames 0-89   (0:00-0:30)
// Act 2: frames 90-179 (0:30-1:00)
// Act 3: frames 180-269 (1:00-1:30)
// Act 4: frames 270-359 (1:30-2:00)
// Act 5: frames 360-449 (2:00-2:30)
// Act 6: frames 450-539 (2:30-3:00)
// Act 7: frames 540-629 (3:00-3:30)
// Act 8: frames 630-738 (3:30-4:06)

const STORY_BEATS: StoryBeat[] = [
  // === ACT 1: EL DESPERTAR ===
  {
    frameStart: 15,
    frameEnd: 75,
    content: (
      <div className="text-center">
        <h1
          className="text-[clamp(3rem,8vw,8rem)] font-extralight tracking-[0.3em] leading-none"
          style={{ color: "var(--text-primary)" }}
        >
          IVANN
        </h1>
        <h1
          className="text-[clamp(3rem,8vw,8rem)] font-extralight tracking-[0.3em] leading-none mt-2"
          style={{ color: "var(--aura-gold)" }}
        >
          AURA
        </h1>
      </div>
    ),
    position: "center",
    animation: "fade",
    blendMode: "difference",
  },
  {
    frameStart: 30,
    frameEnd: 70,
    content: (
      <p
        className="text-[clamp(0.6rem,1.2vw,0.9rem)] tracking-[0.4em] uppercase"
        style={{ color: "var(--text-muted)" }}
      >
        Live Experience
      </p>
    ),
    position: "center",
    animation: "fade",
  },
  {
    frameStart: 60,
    frameEnd: 85,
    content: (
      <div className="flex flex-col items-center gap-2">
        <span
          className="text-[9px] tracking-[0.3em] uppercase animate-pulse"
          style={{ color: "var(--text-muted)" }}
        >
          Scroll
        </span>
        <div
          className="w-[1px] h-8"
          style={{ background: "var(--aura-gold)", opacity: 0.5 }}
        />
      </div>
    ),
    position: "bottom",
    animation: "fade",
  },

  // === ACT 2: LA ENTRADA ===
  {
    frameStart: 95,
    frameEnd: 130,
    content: (
      <p
        className="text-[clamp(1rem,2.5vw,1.8rem)] italic font-light max-w-[600px] leading-relaxed"
        style={{ color: "var(--text-secondary)" }}
      >
        &ldquo;Si Beethoven estuviera vivo, usaría la tecnología
        disponible.&rdquo;
        <span
          className="block text-[0.6em] mt-3 not-italic tracking-[0.2em] uppercase"
          style={{ color: "var(--text-muted)" }}
        >
          — IVANN AURA
        </span>
      </p>
    ),
    position: "left",
    animation: "slide-left",
  },
  {
    frameStart: 135,
    frameEnd: 170,
    content: (
      <div className="flex gap-12 md:gap-20">
        {[
          { num: "200+", label: "SHOWS" },
          { num: "15+", label: "AÑOS" },
          { num: "4", label: "ÁLBUMES" },
          { num: "∞", label: "EMOCIONES" },
        ].map((stat) => (
          <div key={stat.label} className="text-center">
            <span
              className="text-[clamp(1.5rem,4vw,3.5rem)] font-extralight block"
              style={{ color: "var(--text-primary)" }}
            >
              {stat.num}
            </span>
            <span
              className="text-[9px] tracking-[0.25em] uppercase block mt-1"
              style={{ color: "var(--text-muted)" }}
            >
              {stat.label}
            </span>
          </div>
        ))}
      </div>
    ),
    position: "center",
    animation: "slide-up",
  },
  {
    frameStart: 155,
    frameEnd: 178,
    content: (
      <p
        className="text-[clamp(0.7rem,1.5vw,1.1rem)] tracking-[0.15em] font-light"
        style={{ color: "var(--text-secondary)" }}
      >
        Pianista · Compositor · Visionario
      </p>
    ),
    position: "bottom",
    animation: "fade",
  },

  // === ACT 3: LA DANZA ===
  {
    frameStart: 183,
    frameEnd: 200,
    content: (
      <span
        className="text-[10px] tracking-[0.4em] uppercase font-mono"
        style={{ color: "var(--aura-gold)" }}
      >
        01 — La Experiencia
      </span>
    ),
    position: "top-left",
    animation: "slide-left",
  },
  {
    frameStart: 200,
    frameEnd: 250,
    content: (
      <div className="max-w-[400px] space-y-3">
        <h3
          className="text-[clamp(1rem,2vw,1.5rem)] font-light"
          style={{ color: "var(--text-primary)" }}
        >
          Ivan Darío Arias
        </h3>
        <p
          className="text-[clamp(0.65rem,1vw,0.8rem)] leading-relaxed"
          style={{ color: "var(--text-muted)" }}
        >
          Nacido en Medellín, Colombia. Graduado del Conservatorio de Bellas
          Artes. Becado para su Maestría en Composición en la University of
          Wollongong, Sydney, Australia.
        </p>
      </div>
    ),
    position: "left",
    animation: "slide-left",
  },
  {
    frameStart: 250,
    frameEnd: 268,
    content: (
      <p
        className="text-[clamp(1.2rem,3vw,2.5rem)] font-extralight italic"
        style={{ color: "var(--text-primary)" }}
      >
        Cada nota es un universo
      </p>
    ),
    position: "center",
    animation: "fade",
  },

  // === ACT 4: EL ESPECTÁCULO ===
  {
    frameStart: 273,
    frameEnd: 290,
    content: (
      <span
        className="text-[10px] tracking-[0.4em] uppercase font-mono"
        style={{ color: "var(--aura-gold)" }}
      >
        02 — El Show
      </span>
    ),
    position: "top-left",
    animation: "slide-left",
  },
  {
    frameStart: 290,
    frameEnd: 345,
    content: (
      <div className="flex gap-4 md:gap-6 pointer-events-auto">
        {[
          { icon: "♪", title: "Piano de Cola", desc: "Steinway & Sons" },
          { icon: "◇", title: "Producción Visual", desc: "LED, lasers, mapping" },
          { icon: "☆", title: "Artistas Aéreos", desc: "Trapecistas y telas" },
          { icon: "◆", title: "Danza", desc: "Ballet y flamenco" },
        ].map((item) => (
          <div
            key={item.title}
            className="border px-4 py-3 md:px-6 md:py-4 backdrop-blur-sm"
            style={{
              borderColor: "var(--border-subtle)",
              background: "rgba(5,5,8,0.6)",
            }}
          >
            <span className="text-lg block mb-1">{item.icon}</span>
            <span
              className="text-[0.75rem] font-medium block"
              style={{ color: "var(--text-primary)" }}
            >
              {item.title}
            </span>
            <span
              className="text-[0.6rem] block mt-0.5"
              style={{ color: "var(--text-muted)" }}
            >
              {item.desc}
            </span>
          </div>
        ))}
      </div>
    ),
    position: "bottom",
    animation: "slide-up",
  },
  {
    frameStart: 340,
    frameEnd: 358,
    content: (
      <p
        className="text-[clamp(1rem,2.5vw,2rem)] font-extralight max-w-[700px] text-center leading-relaxed"
        style={{ color: "var(--text-primary)" }}
      >
        Una experiencia que desafía los sentidos
      </p>
    ),
    position: "center",
    animation: "fade",
  },

  // === ACT 5: FUEGO Y PASIÓN ===
  {
    frameStart: 363,
    frameEnd: 380,
    content: (
      <span
        className="text-[10px] tracking-[0.4em] uppercase font-mono"
        style={{ color: "var(--aura-gold)" }}
      >
        03 — Música
      </span>
    ),
    position: "top-left",
    animation: "slide-left",
  },
  {
    frameStart: 380,
    frameEnd: 435,
    content: (
      <div className="flex gap-6 md:gap-8">
        {[
          { year: "2023", title: "Apocalypsis", color: "#6B1520" },
          { year: "2020", title: "Romantique", color: "#C9A84C" },
          { year: "2018", title: "Piano & Fire", color: "#8B2500" },
          { year: "2015", title: "First Light", color: "#2A4A6B" },
        ].map((album) => (
          <div key={album.title} className="text-center">
            <div
              className="w-20 h-20 md:w-28 md:h-28 mb-2 border"
              style={{
                background: `linear-gradient(135deg, ${album.color}, transparent)`,
                borderColor: "var(--border-subtle)",
              }}
            />
            <span
              className="text-[0.7rem] font-medium block"
              style={{ color: "var(--text-primary)" }}
            >
              {album.title}
            </span>
            <span
              className="text-[0.55rem] block"
              style={{ color: "var(--text-muted)" }}
            >
              {album.year}
            </span>
          </div>
        ))}
      </div>
    ),
    position: "right",
    animation: "slide-right",
  },

  // === ACT 6: EL CLÍMAX ===
  {
    frameStart: 453,
    frameEnd: 490,
    content: (
      <p
        className="text-[clamp(1.5rem,4vw,3.5rem)] font-extralight tracking-[0.15em] text-center"
        style={{ color: "var(--text-primary)" }}
      >
        VIVE LA EXPERIENCIA
      </p>
    ),
    position: "center",
    animation: "fade",
    blendMode: "difference",
  },
  {
    frameStart: 500,
    frameEnd: 538,
    content: (
      <div className="text-center pointer-events-auto">
        <a
          href="#contacto"
          className="inline-block px-10 py-4 text-[0.75rem] tracking-[0.3em] uppercase border transition-all duration-300 hover:bg-[var(--aura-gold)] hover:text-[var(--bg-void)] hover:border-[var(--aura-gold)]"
          style={{
            color: "var(--aura-gold)",
            borderColor: "var(--aura-gold)",
          }}
        >
          Contrata el Show
        </a>
        <p
          className="text-[0.65rem] mt-4 tracking-[0.15em]"
          style={{ color: "var(--text-muted)" }}
        >
          ivannprensa@gmail.com · +57 310 225 4687
        </p>
      </div>
    ),
    position: "center",
    animation: "slide-up",
  },

  // === ACT 7: LA RESOLUCIÓN ===
  {
    frameStart: 543,
    frameEnd: 560,
    content: (
      <span
        className="text-[10px] tracking-[0.4em] uppercase font-mono"
        style={{ color: "var(--aura-gold)" }}
      >
        04 — Prensa & Redes
      </span>
    ),
    position: "top-left",
    animation: "slide-left",
  },
  {
    frameStart: 560,
    frameEnd: 610,
    content: (
      <div className="max-w-[500px]">
        <p
          className="text-[clamp(0.8rem,1.5vw,1.1rem)] font-light italic leading-relaxed"
          style={{ color: "var(--text-secondary)" }}
        >
          Más de 200 shows han demostrado que cuando la música clásica se
          encuentra con el espectáculo, sucede algo que no se puede describir.
        </p>
        <p
          className="text-[0.65rem] mt-4 tracking-[0.15em]"
          style={{ color: "var(--text-muted)" }}
        >
          Solo se puede vivir.
        </p>
      </div>
    ),
    position: "left",
    animation: "slide-left",
  },

  // === ACT 8: EL CIERRE ===
  {
    frameStart: 640,
    frameEnd: 720,
    content: (
      <div className="text-center">
        <h2
          className="text-[clamp(2rem,6vw,5rem)] font-extralight tracking-[0.3em]"
          style={{ color: "var(--text-primary)" }}
        >
          IVANN
        </h2>
        <h2
          className="text-[clamp(2rem,6vw,5rem)] font-extralight tracking-[0.3em]"
          style={{ color: "var(--aura-gold)" }}
        >
          AURA
        </h2>
        <div className="flex gap-6 mt-8 justify-center">
          {["YouTube", "Instagram", "Spotify"].map((platform) => (
            <span
              key={platform}
              className="text-[0.6rem] tracking-[0.2em] uppercase"
              style={{ color: "var(--text-muted)" }}
            >
              {platform}
            </span>
          ))}
        </div>
        <p
          className="text-[0.55rem] tracking-[0.3em] uppercase mt-6"
          style={{ color: "var(--text-muted)" }}
        >
          Medellín — Bogotá — El Mundo
        </p>
      </div>
    ),
    position: "center",
    animation: "fade",
  },
];

// Position classes
const POSITION_CLASSES: Record<string, string> = {
  center: "flex items-center justify-center",
  left: "flex items-center justify-start pl-8 md:pl-16",
  right: "flex items-center justify-end pr-8 md:pr-16",
  bottom: "flex items-end justify-center pb-12 md:pb-16",
  "bottom-left": "flex items-end justify-start pl-8 md:pl-16 pb-12",
  "bottom-right": "flex items-end justify-end pr-8 md:pr-16 pb-12",
  "top-left": "flex items-start justify-start pl-8 md:pl-16 pt-20 md:pt-24",
};

// Animation classes
function getAnimationStyle(
  animation: string,
  progress: number
): React.CSSProperties {
  const opacity = progress < 0.15 ? progress / 0.15 : progress > 0.85 ? (1 - progress) / 0.15 : 1;

  const base: React.CSSProperties = {
    opacity: Math.max(0, Math.min(1, opacity)),
    transition: "opacity 0.3s ease",
  };

  if (progress < 0.15) {
    const entry = progress / 0.15;
    switch (animation) {
      case "slide-left":
        return { ...base, transform: `translateX(${(1 - entry) * -40}px)` };
      case "slide-right":
        return { ...base, transform: `translateX(${(1 - entry) * 40}px)` };
      case "slide-up":
        return { ...base, transform: `translateY(${(1 - entry) * 30}px)` };
      default:
        return base;
    }
  }

  if (progress > 0.85) {
    const exit = (1 - progress) / 0.15;
    switch (animation) {
      case "slide-left":
        return { ...base, transform: `translateX(${(1 - exit) * 40}px)` };
      case "slide-right":
        return { ...base, transform: `translateX(${(1 - exit) * -40}px)` };
      case "slide-up":
        return { ...base, transform: `translateY(${(1 - exit) * -20}px)` };
      default:
        return base;
    }
  }

  return base;
}

interface ScrollStoryOverlayProps {
  currentFrame: number;
}

export default function ScrollStoryOverlay({
  currentFrame,
}: ScrollStoryOverlayProps) {
  const visibleBeats = useMemo(() => {
    return STORY_BEATS.filter(
      (beat) => currentFrame >= beat.frameStart && currentFrame <= beat.frameEnd
    ).map((beat) => {
      const range = beat.frameEnd - beat.frameStart;
      return {
        ...beat,
        progress: range > 0 ? (currentFrame - beat.frameStart) / range : 1,
      };
    });
  }, [currentFrame]);

  return (
    <div className="absolute inset-0 z-20 pointer-events-none">
      {visibleBeats.map((beat, i) => (
        <div
          key={`${beat.frameStart}-${i}`}
          className={`absolute inset-0 ${POSITION_CLASSES[beat.position] || POSITION_CLASSES.center}`}
          style={{
            ...getAnimationStyle(beat.animation, beat.progress),
            mixBlendMode: (beat.blendMode as React.CSSProperties["mixBlendMode"]) || "normal",
          }}
        >
          {beat.content}
        </div>
      ))}
    </div>
  );
}
