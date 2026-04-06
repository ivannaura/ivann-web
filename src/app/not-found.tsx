import Link from "next/link";

export default function NotFound() {
  return (
    <div
      className="min-h-dvh flex flex-col items-center justify-center gap-6"
      style={{ background: "var(--bg-void)", color: "var(--text-primary)" }}
    >
      <h2
        className="text-lg tracking-[0.2em] uppercase"
        style={{ color: "var(--aura-gold)" }}
      >
        404
      </h2>
      <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
        Esta página no existe
      </p>
      <Link
        href="/"
        className="magnetic-btn px-6 py-3 text-sm tracking-[0.15em] uppercase border border-[var(--aura-gold-dim)] hover:border-[var(--aura-gold)] transition-colors"
        style={{ color: "var(--text-secondary)" }}
      >
        Volver al inicio
      </Link>
    </div>
  );
}
