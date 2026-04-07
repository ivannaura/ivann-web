"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useLenis } from "lenis/react";
import { useUIStore } from "@/stores/useUIStore";
import { playHover, playClick } from "@/lib/micro-sounds";

const NAV_ITEMS = [
  { label: "Inicio", href: "#top", num: "01" },
  { label: "Espectáculo", href: "#espectaculo", num: "02" },
  { label: "Música", href: "#musica", num: "03" },
  { label: "Contacto", href: "#contacto", num: "04" },
];

interface NavigationProps {
  /** Whether audio is currently active (energy > threshold) */
  audioActive?: boolean;
}

export default function Navigation({
  audioActive = false,
}: NavigationProps) {
  const soundMuted = useUIStore((s) => s.soundMuted);
  const toggleSoundMuted = useUIStore((s) => s.toggleSoundMuted);
  const [scrolled, setScrolled] = useState(false);
  const [activeSection, setActiveSection] = useState(0);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const progressDotRef = useRef<HTMLDivElement>(null);
  const [logoHovered, setLogoHovered] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const hamburgerRef = useRef<HTMLButtonElement>(null);
  // Fixed decorative offsets — avoids Math.random() hydration mismatch (server != client)
  const logoBarOffsets = [1.12, 1.24, 1.30, 1.18, 1.08];
  const menuOpen = useUIStore((s) => s.menuOpen);
  const toggleMenu = useUIStore((s) => s.toggleMenu);
  const setMenuOpen = useUIStore((s) => s.setMenuOpen);
  const setCursorVariant = useUIStore((s) => s.setCursorVariant);
  const lenis = useLenis();
  const lenisRef = useRef(lenis);
  lenisRef.current = lenis;

  useEffect(() => {
    // Cache section elements once — no querySelector per scroll frame
    let sectionEls: (Element | null)[] | null = null;
    let ticking = false;

    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const y = window.scrollY;
        setScrolled(y > 80);

        const docHeight = document.documentElement.scrollHeight - window.innerHeight;
        const progress = docHeight > 0 ? y / docHeight : 0;
        // Direct DOM manipulation — avoids full React re-render on every scroll frame
        if (progressBarRef.current) {
          progressBarRef.current.style.transform = `scaleX(${progress})`;
        }
        if (progressDotRef.current) {
          progressDotRef.current.style.opacity = progress > 0.005 ? "1" : "0";
        }

        if (!sectionEls) {
          sectionEls = NAV_ITEMS.map((item) => document.querySelector(item.href));
        }

        let found = false;
        for (let i = sectionEls.length - 1; i >= 0; i--) {
          const section = sectionEls[i];
          if (section) {
            const rect = section.getBoundingClientRect();
            if (rect.top <= window.innerHeight * 0.4) {
              setActiveSection(i);
              found = true;
              break;
            }
          }
        }
        if (!found && y < window.innerHeight * 0.3) {
          setActiveSection(0);
        }
        ticking = false;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Native <dialog> management — showModal/close with animated entrance/exit
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (menuOpen) {
      dialog.classList.remove("dialog-closing");
      if (!dialog.open) dialog.showModal();
    } else if (dialog.open) {
      // Animate out, then close
      dialog.classList.add("dialog-closing");
      let closed = false;
      const onEnd = () => {
        if (closed) return;
        closed = true;
        dialog.classList.remove("dialog-closing");
        dialog.close();
        dialog.removeEventListener("transitionend", onTransitionEnd);
      };
      const onTransitionEnd = (e: TransitionEvent) => {
        // Wait for opacity (typically the longest visual transition) to finish
        if (e.propertyName === "opacity") onEnd();
      };
      dialog.addEventListener("transitionend", onTransitionEnd);
      // Fallback in case transition doesn't fire (e.g. reduced-motion)
      const fallback = setTimeout(onEnd, 300);
      return () => {
        clearTimeout(fallback);
        dialog.removeEventListener("transitionend", onTransitionEnd);
      };
    }
  }, [menuOpen]);

  // Close on Escape (native dialog handles this, but sync store)
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const onClose = () => {
      setMenuOpen(false);
      // Return focus to hamburger button
      hamburgerRef.current?.focus();
    };

    dialog.addEventListener("close", onClose);
    return () => dialog.removeEventListener("close", onClose);
  }, [setMenuOpen]);

  const handleClick = useCallback((href: string) => {
    playClick();
    setMenuOpen(false);
    if (href === "#top") {
      lenisRef.current?.scrollTo(0);
    } else {
      const el = document.querySelector<HTMLElement>(href);
      if (el) lenisRef.current?.scrollTo(el);
    }
  }, [setMenuOpen]);

  return (
    <>
      {/* Scroll progress bar — thin gold line at very top (GPU-composited via scaleX) */}
      <div
        ref={progressBarRef}
        aria-hidden="true"
        className="fixed top-0 left-0 w-full h-[2px] z-[1002] transition-opacity duration-500 will-change-transform"
        style={{
          transformOrigin: "left",
          transform: "scaleX(0)",
          background:
            "linear-gradient(to right, var(--aura-gold-dim), var(--aura-gold), var(--aura-gold-bright))",
          opacity: scrolled ? 1 : 0,
        }}
      >
        {/* Leading edge particle — gold shimmer dot at the progress tip */}
        <div
          ref={progressDotRef}
          aria-hidden="true"
          style={{
            position: "absolute",
            right: -1,
            top: "50%",
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: "var(--aura-gold-bright)",
            transform: "translate(50%, -50%)",
            boxShadow:
              "0 0 6px rgba(232, 200, 90, 0.8), 0 0 14px rgba(201, 168, 76, 0.4)",
            animation: scrolled ? "nav-progress-shimmer 1.5s ease-in-out infinite" : "none",
            opacity: 0,
            transition: "opacity 0.3s ease-out",
          }}
        />
      </div>

      <nav
        className={`fixed top-0 left-0 right-0 z-[1000] transition-[background-color,border-color,box-shadow,padding] duration-700 ${
          scrolled
            ? "backdrop-blur-xl py-3"
            : "bg-transparent py-6"
        }`}
        style={{
          paddingTop: `max(${scrolled ? "0.75rem" : "1.5rem"}, env(safe-area-inset-top))`,
          background: scrolled
            ? "rgba(5, 5, 8, 0.75)"
            : "transparent",
          borderBottom: scrolled
            ? "1px solid rgba(201, 168, 76, 0.06)"
            : "1px solid transparent",
          boxShadow: scrolled
            ? "0 1px 0 0 rgba(201, 168, 76, 0.03), 0 4px 24px -4px rgba(0, 0, 0, 0.5)"
            : "none",
        }}
      >
        <div className="max-w-[1400px] mx-auto px-8 md:px-16 flex items-center justify-between">
          {/* Logo — animated */}
          <a
            href="#top"
            onClick={(e) => {
              e.preventDefault();
              handleClick("#top");
            }}
            className="relative z-[1001] flex items-center gap-1 group"
            onMouseEnter={() => {
              setCursorVariant("hover");
              setLogoHovered(true);
            }}
            onMouseLeave={() => {
              setCursorVariant("default");
              setLogoHovered(false);
            }}
          >
            <div
              aria-hidden="true"
              className="w-5 h-5 mr-2 relative overflow-hidden transition-all duration-500"
              style={{
                opacity: scrolled ? 1 : 0,
                transform: scrolled ? "translateX(0)" : "translateX(-10px)",
              }}
            >
              <div className="flex gap-[1px] h-full items-end">
                {[0.4, 0.7, 1, 0.7, 0.4].map((h, i) => (
                  <div
                    key={i}
                    className="w-[3px] rounded-[0.5px] transition-all duration-500"
                    style={{
                      height: `${h * 100}%`,
                      background:
                        i === 2
                          ? "var(--aura-gold)"
                          : "var(--text-muted)",
                      transitionDelay: logoHovered
                        ? `${i * 40}ms`
                        : "0ms",
                      transform: logoHovered
                        ? `scaleY(${logoBarOffsets[i]})`
                        : "scaleY(1)",
                    }}
                  />
                ))}
              </div>
            </div>

            <span
              className="text-base tracking-[0.3em] font-extralight transition-all duration-500"
              style={{
                color: "var(--text-primary)",
                fontFamily: "var(--font-display)",
                letterSpacing: logoHovered ? "0.4em" : "0.3em",
              }}
            >
              IVANN
            </span>
            <span
              className="text-base font-extralight transition-all duration-500"
              style={{
                color: "var(--aura-gold)",
                fontFamily: "var(--font-display)",
                letterSpacing: logoHovered ? "0.4em" : "0.3em",
                opacity: logoHovered ? 1 : 0.8,
              }}
            >
              AURA
            </span>
          </a>

          {/* Desktop nav — with section numbers */}
          <div className="hidden md:flex items-center gap-1">
            {NAV_ITEMS.map((item, i) => (
              <a
                key={item.href}
                href={item.href}
                onClick={(e) => {
                  e.preventDefault();
                  handleClick(item.href);
                }}
                className="relative px-4 py-2 group transition-all duration-300"
                onMouseEnter={() => { setCursorVariant("hover"); playHover(); }}
                onMouseLeave={() => setCursorVariant("default")}
              >
                <span
                  className="absolute -top-1 left-3 text-[11px] font-mono transition-all duration-300"
                  style={{
                    color:
                      activeSection === i
                        ? "var(--aura-gold)"
                        : "transparent",
                    opacity: activeSection === i ? 0.6 : 0,
                  }}
                >
                  {item.num}
                </span>
                <span
                  className="text-[11px] tracking-[0.18em] uppercase transition-all duration-300"
                  style={{
                    color:
                      activeSection === i
                        ? "var(--text-primary)"
                        : "var(--text-muted)",
                  }}
                >
                  {item.label}
                </span>
                <span
                  className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full transition-all duration-500"
                  style={{
                    background: "var(--aura-gold)",
                    opacity: activeSection === i ? 1 : 0,
                    transform:
                      activeSection === i
                        ? "translateX(-50%) scale(1)"
                        : "translateX(-50%) scale(0)",
                  }}
                />
              </a>
            ))}

            {/* Gold diamond separator */}
            <div
              className="mx-4 flex items-center justify-center"
              aria-hidden="true"
            >
              <div
                style={{
                  width: 4,
                  height: 4,
                  background: "var(--aura-gold-dim)",
                  transform: "rotate(45deg)",
                  opacity: 0.5,
                }}
              />
            </div>

            {/* Sound toggle — wired to AudioMomentum */}
            <button
              onClick={toggleSoundMuted}
              className="w-8 h-8 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full transition-all duration-300 hover:bg-white/5 outline-none focus-visible:ring-1 focus-visible:ring-[var(--aura-gold)]"
              aria-label={soundMuted ? "Activar sonido" : "Silenciar sonido"}
              onMouseEnter={() => setCursorVariant("hover")}
              onMouseLeave={() => setCursorVariant("default")}
            >
              {soundMuted ? (
                // Muted icon
                <svg
                  aria-hidden="true"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="var(--text-muted)"
                  strokeWidth="1.5"
                >
                  <path d="M11 5L6 9H2v6h4l5 4V5z" />
                  <line x1="23" y1="9" x2="17" y2="15" />
                  <line x1="17" y1="9" x2="23" y2="15" />
                </svg>
              ) : (
                // Active icon — gold when audio is playing
                <svg
                  aria-hidden="true"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke={audioActive ? "var(--aura-gold)" : "var(--text-muted)"}
                  strokeWidth="1.5"
                  className="transition-colors duration-300"
                >
                  <path d="M11 5L6 9H2v6h4l5 4V5z" />
                  <path d="M15.54 8.46a5 5 0 010 7.07" />
                  <path d="M19.07 4.93a10 10 0 010 14.14" />
                </svg>
              )}
            </button>
          </div>

          {/* Mobile hamburger */}
          <button
            ref={hamburgerRef}
            className="md:hidden relative z-[1001] w-11 h-11 flex flex-col items-center justify-center gap-[5px] rounded-full transition-all duration-300 hover:bg-white/5"
            onClick={toggleMenu}
            aria-label="Menu"
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
          >
            <span
              aria-hidden="true"
              className="w-5 h-[1px] transition-all duration-500 origin-center"
              style={{
                background: "var(--text-primary)",
                transform: menuOpen
                  ? "rotate(45deg) translate(0, 5.5px)"
                  : "none",
              }}
            />
            <span
              aria-hidden="true"
              className="w-5 h-[1px] transition-all duration-500"
              style={{
                background: "var(--text-primary)",
                opacity: menuOpen ? 0 : 1,
                transform: menuOpen ? "scaleX(0)" : "scaleX(1)",
              }}
            />
            <span
              aria-hidden="true"
              className="w-5 h-[1px] transition-all duration-500 origin-center"
              style={{
                background: "var(--text-primary)",
                transform: menuOpen
                  ? "rotate(-45deg) translate(0, -5.5px)"
                  : "none",
              }}
            />
          </button>
        </div>
      </nav>

      {/* Mobile menu — native <dialog> for automatic focus trap + Escape + inert background */}
      <dialog
        id="mobile-menu"
        ref={dialogRef}
        className="fixed inset-0 z-[999] md:hidden w-full h-full max-w-full max-h-full m-0 p-0 border-none"
        style={{ background: "var(--bg-void)" }}
      >
        <div className="flex flex-col items-start justify-center h-full px-12 gap-2">
          {NAV_ITEMS.map((item, i) => (
            <a
              key={item.href}
              href={item.href}
              onClick={(e) => {
                e.preventDefault();
                handleClick(item.href);
              }}
              className="group flex items-baseline gap-4 py-3"
            >
              <span
                className="text-xs font-mono"
                style={{ color: "var(--aura-gold-dim)" }}
              >
                {item.num}
              </span>
              <span
                className="font-extralight tracking-[0.1em] uppercase transition-colors duration-300 group-hover:text-[var(--aura-gold)]"
                style={{ color: "var(--text-primary)", fontSize: "clamp(2rem, 8vw, 4rem)" }}
              >
                {item.label}
              </span>
            </a>
          ))}

          <div className="mt-12 flex gap-6">
            {[
              { label: "IG", name: "Instagram", url: "https://www.instagram.com/ivannaura" },
              { label: "SPT", name: "Spotify", url: "https://open.spotify.com/artist/ivannaura" },
              { label: "YT", name: "YouTube", url: "https://www.youtube.com/@ivannaura" },
              { label: "TK", name: "TikTok", url: "https://www.tiktok.com/@ivannaura" },
            ].map((s) => (
              <a
                key={s.label}
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={s.name}
                className="text-[10px] tracking-[0.2em] min-h-[44px] inline-flex items-center transition-colors duration-300 hover:text-[var(--aura-gold)]"
                style={{ color: "var(--text-muted)" }}
              >
                {s.label}
              </a>
            ))}
          </div>

          {/* Mobile sound toggle */}
          <button
            onClick={toggleSoundMuted}
            className="mt-8 w-11 h-11 flex items-center justify-center rounded-full transition-all duration-300 hover:bg-white/5 outline-none focus-visible:ring-1 focus-visible:ring-[var(--aura-gold)]"
            aria-label={soundMuted ? "Activar sonido" : "Silenciar sonido"}
          >
            {soundMuted ? (
              <svg
                aria-hidden="true"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--text-muted)"
                strokeWidth="1.5"
              >
                <path d="M11 5L6 9H2v6h4l5 4V5z" />
                <line x1="23" y1="9" x2="17" y2="15" />
                <line x1="17" y1="9" x2="23" y2="15" />
              </svg>
            ) : (
              <svg
                aria-hidden="true"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke={audioActive ? "var(--aura-gold)" : "var(--text-muted)"}
                strokeWidth="1.5"
                className="transition-colors duration-300"
              >
                <path d="M11 5L6 9H2v6h4l5 4V5z" />
                <path d="M15.54 8.46a5 5 0 010 7.07" />
                <path d="M19.07 4.93a10 10 0 010 14.14" />
              </svg>
            )}
          </button>
        </div>
      </dialog>

      {/* Side section indicators — desktop only */}
      <div
        className="fixed right-8 top-1/2 -translate-y-1/2 z-[998] hidden lg:flex flex-col items-center gap-3 transition-opacity duration-700"
        style={{ opacity: scrolled ? 1 : 0 }}
        aria-hidden={!scrolled}
      >
        {NAV_ITEMS.map((item, i) => (
          <button
            key={item.href}
            onClick={() => handleClick(item.href)}
            className="group flex items-center gap-3 rounded-sm outline-none focus-visible:ring-1 focus-visible:ring-[var(--aura-gold)]"
            aria-label={item.label}
            tabIndex={scrolled ? 0 : -1}
          >
            <span
              className="text-[9px] tracking-[0.2em] uppercase opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-2 group-hover:translate-x-0"
              style={{ color: "var(--text-muted)" }}
            >
              {item.label}
            </span>
            <div
              className="relative w-[6px] h-[6px] rounded-full transition-all duration-500"
              style={{
                background:
                  activeSection === i
                    ? "var(--aura-gold)"
                    : "var(--text-muted)",
                transform:
                  activeSection === i ? "scale(1.5)" : "scale(1)",
                opacity: activeSection === i ? 1 : 0.3,
                boxShadow:
                  activeSection === i
                    ? "0 0 6px rgba(201, 168, 76, 0.6)"
                    : "none",
                animation:
                  activeSection === i
                    ? "dot-echo 2s ease-out infinite"
                    : "none",
              }}
            />
          </button>
        ))}
      </div>
    </>
  );
}
