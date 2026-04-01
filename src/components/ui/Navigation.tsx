"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useUIStore } from "@/stores/useUIStore";
import { playHover, playClick, setMicroSoundsMuted } from "@/lib/micro-sounds";

const NAV_ITEMS = [
  { label: "Inicio", href: "#top", num: "01" },
  { label: "Contacto", href: "#contacto", num: "02" },
];

interface NavigationProps {
  /** Whether audio is currently active (energy > threshold) */
  audioActive?: boolean;
  /** Called when user toggles sound on/off */
  onSoundToggle?: () => void;
  /** Whether sound is muted */
  soundMuted?: boolean;
}

export default function Navigation({
  audioActive = false,
  onSoundToggle,
  soundMuted = false,
}: NavigationProps) {
  const [scrolled, setScrolled] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [activeSection, setActiveSection] = useState(0);
  const [logoHovered, setLogoHovered] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const hamburgerRef = useRef<HTMLButtonElement>(null);
  const logoBarOffsets = useMemo(() => [0.4, 0.7, 1, 0.7, 0.4].map(() => 1 + Math.random() * 0.3), []);
  const menuOpen = useUIStore((s) => s.menuOpen);
  const toggleMenu = useUIStore((s) => s.toggleMenu);
  const setMenuOpen = useUIStore((s) => s.setMenuOpen);
  const setCursorVariant = useUIStore((s) => s.setCursorVariant);

  useEffect(() => {
    // Cache section elements once — no querySelector per scroll frame
    let sectionEls: (Element | null)[] | null = null;

    const onScroll = () => {
      const y = window.scrollY;
      setScrolled(y > 80);

      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      setScrollProgress(docHeight > 0 ? y / docHeight : 0);

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
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Native <dialog> management — showModal/close with focus return
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (menuOpen) {
      if (!dialog.open) dialog.showModal();
    } else {
      if (dialog.open) dialog.close();
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

  // Sync micro-sounds mute with sound toggle
  useEffect(() => {
    setMicroSoundsMuted(soundMuted);
  }, [soundMuted]);

  const handleClick = useCallback((href: string) => {
    playClick();
    setMenuOpen(false);
    if (href === "#top") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      const el = document.querySelector(href);
      if (el) el.scrollIntoView({ behavior: "smooth" });
    }
  }, [setMenuOpen]);

  return (
    <>
      {/* Scroll progress bar — thin gold line at very top */}
      <div
        className="fixed top-0 left-0 h-[2px] z-[1002] transition-opacity duration-500"
        style={{
          width: `${scrollProgress * 100}%`,
          background:
            "linear-gradient(to right, var(--aura-gold-dim), var(--aura-gold), var(--aura-gold-bright))",
          opacity: scrolled ? 1 : 0,
        }}
      />

      <nav
        className={`fixed top-0 left-0 right-0 z-[1000] transition-all duration-700 ${
          scrolled
            ? "backdrop-blur-xl py-3"
            : "bg-transparent py-6"
        }`}
        style={{
          background: scrolled
            ? "rgba(5, 5, 8, 0.7)"
            : "transparent",
          borderBottom: scrolled
            ? "1px solid rgba(255,255,255,0.03)"
            : "1px solid transparent",
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
                letterSpacing: logoHovered ? "0.4em" : "0.3em",
              }}
            >
              IVANN
            </span>
            <span
              className="text-base font-extralight transition-all duration-500"
              style={{
                color: "var(--aura-gold)",
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
                  className="absolute -top-1 left-3 text-[8px] font-mono transition-all duration-300"
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

            <div
              className="w-px h-4 mx-3"
              style={{ background: "var(--bg-subtle)" }}
            />

            {/* Sound toggle — wired to AudioMomentum */}
            <button
              onClick={onSoundToggle}
              className="w-8 h-8 flex items-center justify-center rounded-full transition-all duration-300 hover:bg-white/5"
              aria-label={soundMuted ? "Activar sonido" : "Silenciar sonido"}
              onMouseEnter={() => setCursorVariant("hover")}
              onMouseLeave={() => setCursorVariant("default")}
            >
              {soundMuted ? (
                // Muted icon
                <svg
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
            className="md:hidden relative z-[1001] w-10 h-10 flex flex-col items-center justify-center gap-[5px] rounded-full transition-all duration-300 hover:bg-white/5"
            onClick={toggleMenu}
            aria-label="Menu"
            aria-expanded={menuOpen}
          >
            <span
              className="w-5 h-[1px] transition-all duration-500 origin-center"
              style={{
                background: "var(--text-primary)",
                transform: menuOpen
                  ? "rotate(45deg) translate(0, 3px)"
                  : "none",
              }}
            />
            <span
              className="w-5 h-[1px] transition-all duration-500"
              style={{
                background: "var(--text-primary)",
                opacity: menuOpen ? 0 : 1,
                transform: menuOpen ? "scaleX(0)" : "scaleX(1)",
              }}
            />
            <span
              className="w-5 h-[1px] transition-all duration-500 origin-center"
              style={{
                background: "var(--text-primary)",
                transform: menuOpen
                  ? "rotate(-45deg) translate(0, -3px)"
                  : "none",
              }}
            />
          </button>
        </div>
      </nav>

      {/* Mobile menu — native <dialog> for automatic focus trap + Escape + inert background */}
      <dialog
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
                className="text-3xl font-extralight tracking-[0.1em] uppercase transition-colors duration-300 group-hover:text-[var(--aura-gold)]"
                style={{ color: "var(--text-primary)" }}
              >
                {item.label}
              </span>
            </a>
          ))}

          <div className="mt-12 flex gap-6">
            {["IG", "SP", "YT", "TK"].map((s) => (
              <a
                key={s}
                href="#"
                className="text-[10px] tracking-[0.2em] transition-colors duration-300 hover:text-[var(--aura-gold)]"
                style={{ color: "var(--text-muted)" }}
              >
                {s}
              </a>
            ))}
          </div>
        </div>
      </dialog>

      {/* Side section indicators — desktop only */}
      <div
        className="fixed right-8 top-1/2 -translate-y-1/2 z-[998] hidden lg:flex flex-col items-center gap-3 transition-opacity duration-700"
        style={{ opacity: scrolled ? 1 : 0 }}
      >
        {NAV_ITEMS.map((item, i) => (
          <button
            key={item.href}
            onClick={() => handleClick(item.href)}
            className="group flex items-center gap-3"
            aria-label={item.label}
          >
            <span
              className="text-[9px] tracking-[0.2em] uppercase opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-2 group-hover:translate-x-0"
              style={{ color: "var(--text-muted)" }}
            >
              {item.label}
            </span>
            <div
              className="w-[6px] h-[6px] rounded-full transition-all duration-500"
              style={{
                background:
                  activeSection === i
                    ? "var(--aura-gold)"
                    : "var(--text-muted)",
                transform:
                  activeSection === i ? "scale(1.5)" : "scale(1)",
                opacity: activeSection === i ? 1 : 0.3,
              }}
            />
          </button>
        ))}
      </div>
    </>
  );
}
