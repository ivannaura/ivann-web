"use client";

import { useMemo, useRef, useLayoutEffect, useEffect } from "react";
import gsap from "gsap";
import { SplitText } from "gsap/SplitText";
import type { FrequencyBands } from "@/lib/audio-momentum";
import { useUIStore } from "@/stores/useUIStore";

if (typeof window !== "undefined") {
  gsap.registerPlugin(SplitText);
}

interface StoryBeat {
  frameStart: number;
  frameEnd: number;
  content: React.ReactNode;
  position:
    | "center"
    | "left"
    | "right"
    | "bottom"
    | "bottom-left"
    | "bottom-right"
    | "top-left";
  animation: "fade" | "slide-left" | "slide-up" | "slide-right";
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
//
// Gaps between acts are intentional "breathing room" — the video plays
// without overlay text, letting the concert footage speak for itself.

const STORY_BEATS: StoryBeat[] = [
  // === ACT 1: EL DESPERTAR ===
  {
    frameStart: 15,
    frameEnd: 75,
    content: (
      <div className="text-center" data-depth="1.2">
        <p
          data-split="chars"
          data-split-mask="words"
          data-split-stagger="0.04"
          className="text-[clamp(3rem,8vw,8rem)] font-extralight tracking-[0.3em] leading-none"
          style={{ color: "var(--text-primary)" }}
        >
          IVANN
        </p>
        <p
          data-split="chars"
          data-split-mask="words"
          data-split-stagger="0.04"
          className="text-[clamp(3rem,8vw,8rem)] font-extralight tracking-[0.3em] leading-none mt-2"
          style={{ color: "var(--aura-gold)" }}
        >
          AURA
        </p>
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
        data-split="chars"
        data-split-stagger="0.02"
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
          aria-hidden="true"
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
      <div className="max-w-[600px]">
        <p
          data-reactive
          data-split="words"
          data-split-stagger="0.06"
          className="text-[clamp(1rem,2.5vw,1.8rem)] italic font-light leading-relaxed"
          style={{ color: "var(--text-secondary)" }}
        >
          &ldquo;Si Beethoven estuviera vivo, usaría la tecnología
          disponible.&rdquo;
        </p>
        <p
          data-split="chars"
          data-split-stagger="0.02"
          className="text-[0.6em] mt-3 tracking-[0.2em] uppercase"
          style={{ color: "var(--text-muted)" }}
        >
          — IVANN AURA
        </p>
      </div>
    ),
    position: "left",
    animation: "slide-left",
  },
  {
    frameStart: 135,
    frameEnd: 170,
    content: (
      <div className="flex gap-12 md:gap-20" data-depth="0.8">
        {[
          { num: "200+", label: "SHOWS" },
          { num: "15+", label: "AÑOS" },
          { num: "4", label: "ÁLBUMES" },
          { num: "∞", label: "EMOCIONES" },
        ].map((stat) => (
          <div key={stat.label} data-stagger className="text-center">
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
        data-split="chars"
        data-split-stagger="0.02"
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
        data-split="chars"
        data-split-stagger="0.02"
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
          data-split="chars"
          data-split-stagger="0.02"
          className="text-[clamp(1rem,2vw,1.5rem)] font-light"
          style={{ color: "var(--text-primary)" }}
        >
          Ivan Darío Arias
        </h3>
        <p
          data-split="words"
          data-split-stagger="0.02"
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
        data-reactive
        data-split="chars"
        data-split-mask="words"
        data-split-stagger="0.03"
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
        data-split="chars"
        data-split-stagger="0.02"
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
            data-stagger
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
        data-split="words"
        data-split-stagger="0.04"
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
        data-split="chars"
        data-split-stagger="0.02"
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
          <div key={album.title} data-stagger className="text-center">
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
        data-reactive
        data-depth="1.3"
        data-split="chars"
        data-split-mask="words"
        data-split-stagger="0.025"
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
          onMouseEnter={() => useUIStore.getState().setCursorVariant("hover")}
          onMouseLeave={() => useUIStore.getState().setCursorVariant("default")}
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
        data-split="chars"
        data-split-stagger="0.02"
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
          data-split="words"
          data-split-stagger="0.04"
          className="text-[clamp(0.8rem,1.5vw,1.1rem)] font-light italic leading-relaxed"
          style={{ color: "var(--text-secondary)" }}
        >
          Más de 200 shows han demostrado que cuando la música clásica se
          encuentra con el espectáculo, sucede algo que no se puede describir.
        </p>
        <p
          data-split="chars"
          data-split-stagger="0.03"
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
      <div className="text-center" data-depth="1.1">
        <h2
          data-split="chars"
          data-split-mask="words"
          data-split-stagger="0.04"
          className="text-[clamp(2rem,6vw,5rem)] font-extralight tracking-[0.3em]"
          style={{ color: "var(--text-primary)" }}
        >
          IVANN
        </h2>
        <h2
          data-split="chars"
          data-split-mask="words"
          data-split-stagger="0.04"
          className="text-[clamp(2rem,6vw,5rem)] font-extralight tracking-[0.3em]"
          style={{ color: "var(--aura-gold)" }}
        >
          AURA
        </h2>
        <div className="flex gap-6 mt-8 justify-center">
          {["YouTube", "Instagram", "Spotify"].map((platform) => (
            <span
              key={platform}
              data-stagger
              className="text-[0.6rem] tracking-[0.2em] uppercase"
              style={{ color: "var(--text-muted)" }}
            >
              {platform}
            </span>
          ))}
        </div>
        <p
          data-split="chars"
          data-split-stagger="0.02"
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

// ---------------------------------------------------------------------------
// AnimatedBeat — GSAP SplitText entrance + exit, parallax, reactive typography
// ---------------------------------------------------------------------------

interface AnimatedBeatProps {
  beat: StoryBeat;
  progress: number;
  energy?: number;
  bands?: FrequencyBands;
}

function AnimatedBeat({ beat, progress, energy = 0, bands }: AnimatedBeatProps) {
  const ref = useRef<HTMLDivElement>(null);
  const tlRef = useRef<gsap.core.Timeline | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    const mm = gsap.matchMedia();
    // Collect SplitText instances for explicit cleanup (prevents double-split
    // when AnimatedBeat unmounts and remounts on scroll direction reversal)
    const splits: { revert: () => void }[] = [];

    mm.add("(prefers-reduced-motion: no-preference)", () => {
      const splitTargets = el.querySelectorAll<HTMLElement>("[data-split]");
      const staggerTargets = el.querySelectorAll<HTMLElement>("[data-stagger]");
      const isDesktop = window.innerWidth >= 768;

      if (splitTargets.length > 0) {
        // SplitText per-char/word reveals with timeline for sequential targets
        const tl = gsap.timeline();

        splitTargets.forEach((target, i) => {
          const splitType = target.dataset.split || "chars";
          const mask = target.dataset.splitMask as
            | "words"
            | "lines"
            | "chars"
            | undefined;
          const stagger = parseFloat(
            target.dataset.splitStagger || "0.03"
          );

          // Build SplitText config
          const type = mask ? `${mask},${splitType}` : splitType;
          const split = SplitText.create(target, {
            type,
            ...(mask ? { mask } : {}),
          });
          splits.push(split);

          const elements = split.chars.length
            ? split.chars
            : split.words.length
              ? split.words
              : split.lines;

          if (mask) {
            // Masked reveal — chars slide up from behind word overflow
            tl.from(
              elements,
              {
                yPercent: 100,
                stagger,
                duration: isDesktop ? 0.8 : 0.5,
                ease: "power3.out",
              },
              i === 0 ? 0 : ">-0.3"
            );
          } else {
            // Fade + blur reveal
            tl.from(
              elements,
              {
                opacity: 0,
                y: isDesktop ? 12 : 8,
                ...(isDesktop ? { filter: "blur(4px)" } : {}),
                stagger,
                duration: isDesktop ? 0.6 : 0.4,
                ease: "power2.out",
              },
              i === 0 ? 0 : ">-0.3"
            );
          }
        });

        tlRef.current = tl;
      } else if (staggerTargets.length > 0) {
        // Compound elements — stagger children
        const fromVars: gsap.TweenVars = { opacity: 0 };
        switch (beat.animation) {
          case "slide-left":
            fromVars.x = -30;
            break;
          case "slide-right":
            fromVars.x = 30;
            break;
          case "slide-up":
            fromVars.y = 25;
            break;
        }

        gsap.from(staggerTargets, {
          ...fromVars,
          stagger: 0.08,
          duration: 0.5,
          ease: "power2.out",
        });
      } else {
        // Fallback — animate content container
        const fromVars: gsap.TweenVars = { opacity: 0 };
        switch (beat.animation) {
          case "slide-left":
            fromVars.x = -30;
            break;
          case "slide-right":
            fromVars.x = 30;
            break;
          case "slide-up":
            fromVars.y = 25;
            break;
        }

        gsap.from(el.children[0] || el, {
          ...fromVars,
          duration: 0.6,
          ease: "power2.out",
        });
      }
    });

    return () => {
      tlRef.current = null;
      mm.revert();
      // Explicitly revert SplitText DOM mutations — matchMedia.revert() may not
      // handle SplitText cleanup in all GSAP versions
      splits.forEach(s => s.revert());
    };
  }, [beat.animation]);

  // GSAP exit — reverse the entry timeline as beat approaches exit
  useEffect(() => {
    const tl = tlRef.current;
    if (!tl) return;
    if (progress <= 0.8) return;
    // Don't reverse a timeline that hasn't started playing yet
    if (tl.totalProgress() === 0) return;

    const exitProgress = (progress - 0.8) / 0.2;
    tl.progress(Math.max(0, 1 - exitProgress));
  }, [progress]);

  // Parallax depth — elements with data-depth shift on Y axis based on progress
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const depthEl = el.querySelector<HTMLElement>("[data-depth]");
    if (!depthEl) return;
    const depth = parseFloat(depthEl.dataset.depth || "1");
    const offset = (progress - 0.5) * (depth - 1) * 60;
    depthEl.style.transform = `translateY(${offset}px)`;
  }, [progress]);

  // Sound-reactive typography — letter-spacing scales continuously with energy + mids
  // No hard threshold: gentle scroll = subtle expansion, aggressive = dramatic
  useEffect(() => {
    const el = ref.current;
    if (!el || !bands) return;
    const reactiveEls = el.querySelectorAll<HTMLElement>('[data-reactive]');
    if (reactiveEls.length === 0) return;

    const intensity = energy * bands.mids * 0.08;
    reactiveEls.forEach(target => {
      // Use a data attribute to cache original spacing (set once)
      if (!target.dataset.baseSpacing) {
        target.dataset.baseSpacing = getComputedStyle(target).letterSpacing || '0px';
      }
      const base = target.dataset.baseSpacing;
      target.style.letterSpacing = `calc(${base} + ${intensity}em)`;
    });

    return () => {
      const els = el?.querySelectorAll<HTMLElement>('[data-reactive]');
      els?.forEach(target => {
        target.style.letterSpacing = '';
      });
    };
  }, [energy, bands]);

  return (
    <div
      ref={ref}
      className={`absolute inset-0 ${POSITION_CLASSES[beat.position] || POSITION_CLASSES.center}`}
      style={{
        mixBlendMode:
          (beat.blendMode as React.CSSProperties["mixBlendMode"]) || "normal",
      }}
    >
      {beat.content}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ScrollStoryOverlay
// ---------------------------------------------------------------------------

interface ScrollStoryOverlayProps {
  currentFrame: number;
  energy?: number;
  bands?: FrequencyBands;
}

export default function ScrollStoryOverlay({
  currentFrame,
  energy = 0,
  bands,
}: ScrollStoryOverlayProps) {
  const visibleBeats = useMemo(() => {
    return STORY_BEATS.filter(
      (beat) =>
        currentFrame >= beat.frameStart && currentFrame <= beat.frameEnd
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
      {visibleBeats.map((beat) => (
        <AnimatedBeat
          key={`${beat.frameStart}-${beat.frameEnd}`}
          beat={beat}
          progress={beat.progress}
          energy={energy}
          bands={bands}
        />
      ))}
    </div>
  );
}
