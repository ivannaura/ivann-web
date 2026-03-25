"use client";

import { useUIStore } from "@/stores/useUIStore";

const SOCIAL_LINKS = [
  { name: "Instagram", handle: "@ivannaura", url: "#" },
  { name: "Spotify", handle: "IVANN AURA", url: "#" },
  { name: "YouTube", handle: "@ivannaura", url: "#" },
  { name: "TikTok", handle: "@ivannaura", url: "#" },
];

export default function Footer() {
  const setCursorVariant = useUIStore((s) => s.setCursorVariant);

  const scrollToTop = () => {
    // Lenis intercepts window.scrollTo — this works correctly with smooth scroll
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <footer
      className="relative overflow-hidden"
      style={{ background: "var(--bg-void)" }}
    >
      {/* Top gradient */}
      <div
        className="absolute top-0 left-0 right-0 h-px"
        style={{
          background:
            "linear-gradient(to right, transparent, var(--aura-gold-dim), transparent)",
        }}
      />

      {/* Main footer content */}
      <div className="max-w-[1400px] mx-auto px-8 md:px-16 pt-24 pb-8">
        {/* Large branding */}
        <div className="mb-20">
          <div className="flex items-end justify-between">
            <div>
              <p
                className="text-xs tracking-[0.3em] uppercase mb-4"
                style={{ color: "var(--text-muted)" }}
              >
                La experiencia no termina aquí
              </p>
              <h2
                className="text-[clamp(3rem,8vw,7rem)] font-extralight leading-[0.9] tracking-[0.05em]"
                style={{ color: "var(--text-primary)" }}
              >
                IVANN
              </h2>
              <h2
                className="text-[clamp(3rem,8vw,7rem)] font-extralight leading-[0.9] tracking-[0.05em]"
                style={{ color: "var(--aura-gold)" }}
              >
                AURA
              </h2>
            </div>

            {/* Back to top */}
            <button
              onClick={scrollToTop}
              className="hidden md:flex flex-col items-center gap-2 group mb-4"
              onMouseEnter={() => setCursorVariant("hover")}
              onMouseLeave={() => setCursorVariant("default")}
            >
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center transition-all duration-500 group-hover:bg-[var(--aura-gold)] group-hover:scale-110"
                style={{
                  border: "1px solid var(--aura-gold-dim)",
                }}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  className="transition-colors duration-500 group-hover:text-[var(--bg-void)]"
                  style={{ color: "var(--aura-gold)" }}
                >
                  <path d="M12 19V5M5 12l7-7 7 7" />
                </svg>
              </div>
              <span
                className="text-[9px] tracking-[0.3em] uppercase transition-colors duration-300 group-hover:text-[var(--aura-gold)]"
                style={{ color: "var(--text-muted)" }}
              >
                Inicio
              </span>
            </button>
          </div>
        </div>

        {/* Divider */}
        <div
          className="w-full h-px mb-12"
          style={{
            background:
              "linear-gradient(to right, var(--aura-gold-dim), var(--bg-subtle), transparent)",
          }}
        />

        {/* Grid: Social + Contact + Quote */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12 mb-16">
          {/* Social */}
          <div>
            <h3
              className="text-[10px] tracking-[0.4em] uppercase mb-6"
              style={{ color: "var(--text-muted)" }}
            >
              Redes
            </h3>
            <div className="flex flex-col gap-3">
              {SOCIAL_LINKS.map((link) => (
                <a
                  key={link.name}
                  href={link.url}
                  className="group flex items-center justify-between py-1 transition-all duration-300"
                  onMouseEnter={() => setCursorVariant("hover")}
                  onMouseLeave={() => setCursorVariant("default")}
                >
                  <span
                    className="text-sm font-light tracking-wide transition-colors duration-300 group-hover:text-[var(--aura-gold)]"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    {link.name}
                  </span>
                  <span
                    className="text-xs transition-all duration-300 opacity-0 group-hover:opacity-60 translate-x-2 group-hover:translate-x-0"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {link.handle}
                  </span>
                </a>
              ))}
            </div>
          </div>

          {/* Contact */}
          <div>
            <h3
              className="text-[10px] tracking-[0.4em] uppercase mb-6"
              style={{ color: "var(--text-muted)" }}
            >
              Booking
            </h3>
            <a
              href="mailto:booking@ivannaura.com"
              className="text-sm font-light tracking-wide transition-colors duration-300 hover:text-[var(--aura-gold)] block mb-3"
              style={{ color: "var(--text-secondary)" }}
              onMouseEnter={() => setCursorVariant("hover")}
              onMouseLeave={() => setCursorVariant("default")}
            >
              booking@ivannaura.com
            </a>
            <p
              className="text-xs leading-relaxed"
              style={{ color: "var(--text-muted)" }}
            >
              Shows corporativos, festivales,
              <br />
              eventos privados, colaboraciones.
            </p>
          </div>

          {/* Quote */}
          <div className="flex flex-col justify-between">
            <blockquote
              className="text-sm font-light italic leading-relaxed"
              style={{ color: "var(--text-secondary)" }}
            >
              &ldquo;La música es un mágico vehículo
              <br />
              que nos transporta al universo.&rdquo;
            </blockquote>
            <span
              className="text-[10px] tracking-[0.2em] mt-4"
              style={{ color: "var(--aura-gold-dim)" }}
            >
              — IVANN AURA
            </span>
          </div>
        </div>

        {/* Bottom bar */}
        <div
          className="w-full h-px mb-6"
          style={{ background: "var(--bg-subtle)" }}
        />

        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <span
            className="text-[10px] tracking-[0.15em]"
            style={{ color: "var(--text-muted)" }}
          >
            &copy; {new Date().getFullYear()} IVANN AURA — Todos los derechos reservados
          </span>

          <div className="flex items-center gap-4">
            <span
              className="text-[10px] tracking-[0.15em]"
              style={{ color: "var(--text-muted)" }}
            >
              Medellín — Bogotá — El Mundo
            </span>
            <div
              className="w-1 h-1 rounded-full"
              style={{ background: "var(--aura-gold-dim)" }}
            />
            <span
              className="text-[10px] tracking-[0.15em]"
              style={{ color: "var(--text-muted)" }}
            >
              Live Experience
            </span>
          </div>
        </div>
      </div>

      {/* Ambient glow at bottom */}
      <div
        className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[600px] h-[200px] pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse, rgba(201,168,76,0.04) 0%, transparent 70%)",
        }}
      />
    </footer>
  );
}
