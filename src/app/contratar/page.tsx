"use client";

import Link from "next/link";
import dynamic from "next/dynamic";

const CustomCursor = dynamic(() => import("@/components/ui/CustomCursor"), { ssr: false });
const Contact = dynamic(() => import("@/components/sections/Contact"), { ssr: false });
const Footer = dynamic(() => import("@/components/ui/Footer"), { ssr: false });

export default function Contratar() {
  return (
    <>
      <CustomCursor />
      <Link
        href="/"
        className="magnetic-btn fixed z-50 text-[var(--text-muted)] text-xs tracking-widest uppercase font-light hover:text-[var(--aura-gold)] transition-colors duration-300"
        style={{ top: "max(1.5rem, env(safe-area-inset-top))", left: "1.5rem" }}
        aria-label="Volver al portal"
      >
        &larr; Portal
      </Link>
      <main className="min-h-dvh" style={{ background: "var(--bg-void)" }}>
        <div className="flex flex-col items-center justify-center pt-24 pb-12 px-6">
          <h1
            className="text-4xl md:text-6xl font-light tracking-wider text-center"
            style={{ fontFamily: "var(--font-display)", color: "var(--aura-gold)" }}
          >
            Contrata el Show
          </h1>
          <p
            className="mt-4 text-sm md:text-base tracking-widest uppercase text-center"
            style={{ color: "var(--text-secondary)" }}
          >
            Llevamos la experiencia IVANN AURA a tu evento
          </p>
        </div>
        <Contact />
      </main>
      <Footer />
    </>
  );
}
