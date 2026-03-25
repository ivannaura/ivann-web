"use client";

import { useEffect, useRef, useState } from "react";
import { useUIStore } from "@/stores/useUIStore";

export default function Contact() {
  const sectionRef = useRef<HTMLElement>(null);
  const setCursorVariant = useUIStore((s) => s.setCursorVariant);
  const [formState, setFormState] = useState({
    name: "",
    email: "",
    type: "corporativo",
    message: "",
  });
  const [submitted, setSubmitted] = useState(false);

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: integrate with backend
    setSubmitted(true);
  };

  const inputClass =
    "w-full bg-transparent border-b py-3 text-sm font-light focus:outline-none transition-colors duration-300";

  return (
    <section
      id="contacto"
      ref={sectionRef}
      className="relative py-32 md:py-48 px-6 md:px-12"
      style={{ background: "var(--bg-surface)" }}
    >
      {/* Golden glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at 30% 70%, rgba(201,168,76,0.05) 0%, transparent 50%)",
        }}
      />

      <div className="max-w-[1200px] mx-auto relative z-10">
        {/* Section label */}
        <div className="reveal-up mb-16 md:mb-24">
          <span
            className="text-[10px] tracking-[0.4em] uppercase"
            style={{ color: "var(--text-muted)" }}
          >
            04 — Contacto
          </span>
          <div
            className="line-grow mt-4 w-full h-px"
            style={{ background: "var(--bg-subtle)" }}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-16">
          {/* Left column */}
          <div className="md:col-span-5">
            <h2
              className="reveal-up text-[clamp(2rem,5vw,3.5rem)] font-extralight leading-[1.1] mb-8"
              style={{ color: "var(--text-primary)" }}
            >
              Hagamos algo
              <br />
              <span style={{ color: "var(--aura-gold)" }}>
                extraordinario
              </span>
            </h2>

            <p
              className="reveal-up text-base font-light leading-relaxed mb-12"
              style={{ color: "var(--text-secondary)" }}
            >
              Shows corporativos, festivales, eventos privados, colaboraciones.
              Cada experiencia se diseña a medida.
            </p>

            {/* Contact info */}
            <div className="reveal-up flex flex-col gap-6">
              <div>
                <span
                  className="text-[10px] tracking-[0.3em] uppercase block mb-2"
                  style={{ color: "var(--text-muted)" }}
                >
                  Management
                </span>
                <a
                  href="mailto:booking@ivannaura.com"
                  className="text-sm transition-colors duration-300 hover:text-[var(--aura-gold)]"
                  style={{ color: "var(--text-secondary)" }}
                  onMouseEnter={() => setCursorVariant("hover")}
                  onMouseLeave={() => setCursorVariant("default")}
                >
                  booking@ivannaura.com
                </a>
              </div>

              <div>
                <span
                  className="text-[10px] tracking-[0.3em] uppercase block mb-2"
                  style={{ color: "var(--text-muted)" }}
                >
                  Redes
                </span>
                <div className="flex gap-6">
                  {[
                    { name: "Instagram", url: "#" },
                    { name: "Spotify", url: "#" },
                    { name: "YouTube", url: "#" },
                    { name: "TikTok", url: "#" },
                  ].map((social) => (
                    <a
                      key={social.name}
                      href={social.url}
                      className="text-xs tracking-[0.15em] uppercase transition-colors duration-300 hover:text-[var(--aura-gold)]"
                      style={{ color: "var(--text-muted)" }}
                      onMouseEnter={() => setCursorVariant("hover")}
                      onMouseLeave={() => setCursorVariant("default")}
                    >
                      {social.name}
                    </a>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Right column — form */}
          <div className="md:col-span-1" />
          <div className="md:col-span-6">
            {submitted ? (
              <div className="reveal-up flex flex-col items-center justify-center h-full text-center py-20">
                <div
                  className="w-16 h-16 rounded-full flex items-center justify-center mb-6"
                  style={{ border: "1px solid var(--aura-gold-dim)" }}
                >
                  <span style={{ color: "var(--aura-gold)" }}>✓</span>
                </div>
                <h3
                  className="text-xl font-light mb-3"
                  style={{ color: "var(--text-primary)" }}
                >
                  Mensaje enviado
                </h3>
                <p
                  className="text-sm"
                  style={{ color: "var(--text-secondary)" }}
                >
                  Te responderemos pronto.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="flex flex-col gap-8">
                <div className="reveal-up">
                  <label
                    htmlFor="contact-name"
                    className="text-[10px] tracking-[0.3em] uppercase block mb-2"
                    style={{ color: "var(--text-muted)" }}
                  >
                    Nombre
                  </label>
                  <input
                    id="contact-name"
                    type="text"
                    required
                    value={formState.name}
                    onChange={(e) =>
                      setFormState((s) => ({ ...s, name: e.target.value }))
                    }
                    className={inputClass}
                    style={{
                      color: "var(--text-primary)",
                      borderColor: "var(--bg-subtle)",
                    }}
                    onFocus={(e) =>
                      (e.target.style.borderColor = "var(--aura-gold-dim)")
                    }
                    onBlur={(e) =>
                      (e.target.style.borderColor = "var(--bg-subtle)")
                    }
                  />
                </div>

                <div className="reveal-up">
                  <label
                    htmlFor="contact-email"
                    className="text-[10px] tracking-[0.3em] uppercase block mb-2"
                    style={{ color: "var(--text-muted)" }}
                  >
                    Email
                  </label>
                  <input
                    id="contact-email"
                    type="email"
                    required
                    value={formState.email}
                    onChange={(e) =>
                      setFormState((s) => ({ ...s, email: e.target.value }))
                    }
                    className={inputClass}
                    style={{
                      color: "var(--text-primary)",
                      borderColor: "var(--bg-subtle)",
                    }}
                    onFocus={(e) =>
                      (e.target.style.borderColor = "var(--aura-gold-dim)")
                    }
                    onBlur={(e) =>
                      (e.target.style.borderColor = "var(--bg-subtle)")
                    }
                  />
                </div>

                <div className="reveal-up">
                  <label
                    htmlFor="contact-type"
                    className="text-[10px] tracking-[0.3em] uppercase block mb-2"
                    style={{ color: "var(--text-muted)" }}
                  >
                    Tipo de evento
                  </label>
                  <select
                    id="contact-type"
                    value={formState.type}
                    onChange={(e) =>
                      setFormState((s) => ({ ...s, type: e.target.value }))
                    }
                    className={`${inputClass} appearance-none`}
                    style={{
                      color: "var(--text-primary)",
                      borderColor: "var(--bg-subtle)",
                      background: "transparent",
                    }}
                  >
                    <option value="corporativo" style={{ background: "var(--bg-surface)" }}>
                      Evento Corporativo
                    </option>
                    <option value="festival" style={{ background: "var(--bg-surface)" }}>
                      Festival
                    </option>
                    <option value="privado" style={{ background: "var(--bg-surface)" }}>
                      Evento Privado
                    </option>
                    <option value="colaboracion" style={{ background: "var(--bg-surface)" }}>
                      Colaboración
                    </option>
                    <option value="otro" style={{ background: "var(--bg-surface)" }}>
                      Otro
                    </option>
                  </select>
                </div>

                <div className="reveal-up">
                  <label
                    htmlFor="contact-message"
                    className="text-[10px] tracking-[0.3em] uppercase block mb-2"
                    style={{ color: "var(--text-muted)" }}
                  >
                    Mensaje
                  </label>
                  <textarea
                    id="contact-message"
                    rows={4}
                    required
                    value={formState.message}
                    onChange={(e) =>
                      setFormState((s) => ({ ...s, message: e.target.value }))
                    }
                    className={`${inputClass} resize-none`}
                    style={{
                      color: "var(--text-primary)",
                      borderColor: "var(--bg-subtle)",
                    }}
                    onFocus={(e) =>
                      (e.target.style.borderColor = "var(--aura-gold-dim)")
                    }
                    onBlur={(e) =>
                      (e.target.style.borderColor = "var(--bg-subtle)")
                    }
                  />
                </div>

                <div className="reveal-up">
                  <button
                    type="submit"
                    className="px-10 py-4 text-xs tracking-[0.3em] uppercase transition-all duration-500 rounded-sm hover:bg-[var(--aura-gold)] hover:text-[var(--bg-void)]"
                    style={{
                      border: "1px solid var(--aura-gold-dim)",
                      color: "var(--aura-gold)",
                    }}
                    onMouseEnter={() => setCursorVariant("hover")}
                    onMouseLeave={() => setCursorVariant("default")}
                  >
                    Enviar
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
