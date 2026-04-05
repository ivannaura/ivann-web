"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import { useUIStore } from "@/stores/useUIStore";
import { playHover } from "@/lib/micro-sounds";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger, SplitText);
}

const EVENT_TYPES = [
  { value: "corporativo", label: "Evento Corporativo" },
  { value: "festival", label: "Festival" },
  { value: "privado", label: "Evento Privado" },
  { value: "colaboracion", label: "Colaboración" },
  { value: "otro", label: "Otro" },
];

const SOCIAL_LINKS = [
  { name: "Instagram", url: "https://www.instagram.com/ivannaura" },
  { name: "Spotify", url: "https://open.spotify.com/artist/ivannaura" },
  { name: "YouTube", url: "https://www.youtube.com/@ivannaura" },
  { name: "TikTok", url: "https://www.tiktok.com/@ivannaura" },
];

export default function Contact() {
  const sectionRef = useRef<HTMLElement>(null);
  const successRef = useRef<HTMLDivElement>(null);
  const setCursorVariant = useUIStore((s) => s.setCursorVariant);
  const [formState, setFormState] = useState({
    name: "",
    email: "",
    type: "corporativo",
    message: "",
  });
  const [submitted, setSubmitted] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // GSAP ScrollTrigger entrance — replaces IntersectionObserver + reveal-up CSS
  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    const ctx = gsap.context(() => {
      const mm = gsap.matchMedia();

      mm.add("(prefers-reduced-motion: no-preference)", () => {
        // Animate all reveal targets with stagger
        const targets = section.querySelectorAll<HTMLElement>("[data-reveal]");
        gsap.from(targets, {
          y: 30,
          opacity: 0,
          stagger: 0.1,
          duration: 0.8,
          ease: "power3.out",
          scrollTrigger: {
            trigger: section,
            start: "top 80%",
            once: true,
          },
        });

        // SplitText on the heading
        const heading = section.querySelector<HTMLElement>("[data-split-heading]");
        if (heading) {
          const split = SplitText.create(heading, { type: "words,chars", mask: "words" });
          gsap.from(split.chars, {
            yPercent: 100,
            stagger: 0.03,
            duration: 0.8,
            ease: "power3.out",
            scrollTrigger: {
              trigger: heading,
              start: "top 85%",
              once: true,
            },
          });
        }

        // Horizontal line animation
        const line = section.querySelector<HTMLElement>("[data-line]");
        if (line) {
          gsap.from(line, {
            scaleX: 0,
            transformOrigin: "left",
            duration: 1.2,
            ease: "power2.inOut",
            scrollTrigger: {
              trigger: line,
              start: "top 90%",
              once: true,
            },
          });
        }
      });
    }, section);

    return () => ctx.revert();
  }, []);

  // Cinematic entrance for success state
  useEffect(() => {
    if (!submitted || !successRef.current) return;

    const el = successRef.current;
    const ctx = gsap.context(() => {
      const mm = gsap.matchMedia();

      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const circle = el.querySelector<HTMLElement>("[data-success-circle]");
        const heading = el.querySelector<HTMLElement>("[data-success-heading]");
        const text = el.querySelector<HTMLElement>("[data-success-text]");
        if (!circle || !heading || !text) return;

        // Initial state
        gsap.set([circle, heading, text], { opacity: 0 });
        gsap.set(circle, { scale: 0 });
        gsap.set([heading, text], { y: 15 });

        // Staggered entrance
        const tl = gsap.timeline();
        tl.to(circle, {
          scale: 1,
          opacity: 1,
          duration: 0.6,
          ease: "back.out(1.7)",
        });
        tl.to(
          heading,
          { y: 0, opacity: 1, duration: 0.5, ease: "power3.out" },
          "-=0.2"
        );
        tl.to(
          text,
          { y: 0, opacity: 1, duration: 0.5, ease: "power3.out" },
          "-=0.3"
        );
      });
    }, el);

    return () => ctx.revert();
  }, [submitted]);

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!formState.name.trim()) e.name = "Nombre requerido";
    if (!formState.email.trim()) {
      e.email = "Email requerido";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formState.email)) {
      e.email = "Email inválido";
    }
    if (!formState.message.trim()) e.message = "Mensaje requerido";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    // Build mailto with form data as body
    const typeLabel = EVENT_TYPES.find((t) => t.value === formState.type)?.label ?? formState.type;
    const subject = encodeURIComponent(`Consulta: ${typeLabel} — ${formState.name}`);
    const body = encodeURIComponent(
      `Nombre: ${formState.name}\nEmail: ${formState.email}\nTipo: ${typeLabel}\n\n${formState.message}`
    );
    window.open(`mailto:booking@ivannaura.com?subject=${subject}&body=${body}`, "_self");
    setSubmitted(true);
  };

  const inputBase =
    "w-full bg-transparent border-b py-3 text-sm font-light transition-colors duration-300 focus:outline-none border-[var(--bg-subtle)] focus:border-[var(--aura-gold-dim)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)]";

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
        <div data-reveal className="mb-16 md:mb-24">
          <span
            className="text-[10px] tracking-[0.4em] uppercase"
            style={{ color: "var(--text-muted)" }}
          >
            04 — Contacto
          </span>
          <div
            data-line
            className="mt-4 w-full h-px"
            style={{ background: "var(--bg-subtle)" }}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-16">
          {/* Left column */}
          <div className="md:col-span-5">
            <h2
              data-split-heading
              data-reveal
              className="text-[clamp(2rem,5vw,3.5rem)] font-extralight leading-[1.1] mb-8"
              style={{ color: "var(--text-primary)" }}
            >
              Hagamos algo{" "}
              <span style={{ color: "var(--aura-gold)" }}>
                extraordinario
              </span>
            </h2>

            <p
              data-reveal
              className="text-base font-light leading-relaxed mb-12"
              style={{ color: "var(--text-secondary)" }}
            >
              Shows corporativos, festivales, eventos privados, colaboraciones.
              Cada experiencia se diseña a medida.
            </p>

            {/* Contact info */}
            <div data-reveal className="flex flex-col gap-6">
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
                  onMouseEnter={() => { setCursorVariant("hover"); playHover(); }}
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
                  {SOCIAL_LINKS.map((social) => (
                    <a
                      key={social.name}
                      href={social.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs tracking-[0.15em] uppercase transition-colors duration-300 hover:text-[var(--aura-gold)]"
                      style={{ color: "var(--text-muted)" }}
                      onMouseEnter={() => { setCursorVariant("hover"); playHover(); }}
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
              <div
                ref={successRef}
                className="flex flex-col items-center justify-center h-full text-center py-20"
              >
                <div
                  data-success-circle
                  className="w-16 h-16 rounded-full flex items-center justify-center mb-6"
                  style={{ border: "1px solid var(--aura-gold-dim)" }}
                >
                  <span style={{ color: "var(--aura-gold)" }}>✓</span>
                </div>
                <h3
                  data-success-heading
                  className="text-xl font-light mb-3"
                  style={{ color: "var(--text-primary)" }}
                >
                  Abriendo tu correo...
                </h3>
                <p
                  data-success-text
                  className="text-sm"
                  style={{ color: "var(--text-secondary)" }}
                >
                  Si no se abrió, escríbenos directamente a{" "}
                  <a
                    href="mailto:booking@ivannaura.com"
                    className="underline hover:text-[var(--aura-gold)]"
                  >
                    booking@ivannaura.com
                  </a>
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="flex flex-col gap-8" noValidate>
                <div data-reveal>
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
                    className={inputBase}
                    aria-invalid={!!errors.name}
                    aria-describedby={errors.name ? "contact-name-error" : undefined}
                  />
                  {errors.name && (
                    <p id="contact-name-error" className="text-[10px] mt-1" style={{ color: "var(--crimson)" }}>
                      {errors.name}
                    </p>
                  )}
                </div>

                <div data-reveal>
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
                    className={inputBase}
                    aria-invalid={!!errors.email}
                    aria-describedby={errors.email ? "contact-email-error" : undefined}
                  />
                  {errors.email && (
                    <p id="contact-email-error" className="text-[10px] mt-1" style={{ color: "var(--crimson)" }}>
                      {errors.email}
                    </p>
                  )}
                </div>

                <div data-reveal>
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
                    className={`${inputBase} appearance-none`}
                    style={{
                      background: "transparent",
                    }}
                  >
                    {EVENT_TYPES.map((t) => (
                      <option
                        key={t.value}
                        value={t.value}
                        style={{
                          background: "var(--bg-surface)",
                          color: "var(--text-primary)",
                        }}
                      >
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div data-reveal>
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
                    className={`${inputBase} resize-none`}
                    aria-invalid={!!errors.message}
                    aria-describedby={errors.message ? "contact-message-error" : undefined}
                  />
                  {errors.message && (
                    <p id="contact-message-error" className="text-[10px] mt-1" style={{ color: "var(--crimson)" }}>
                      {errors.message}
                    </p>
                  )}
                </div>

                <div data-reveal>
                  <button
                    type="submit"
                    className="magnetic-btn px-10 py-4 text-xs tracking-[0.3em] uppercase transition-all duration-500 rounded-sm hover:bg-[var(--aura-gold)] hover:text-[var(--bg-void)]"
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
