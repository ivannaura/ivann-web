"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div
      className="min-h-dvh flex flex-col items-center justify-center gap-6"
      style={{ background: "var(--bg-void)", color: "var(--text-primary)" }}
    >
      <h2 className="text-lg tracking-[0.2em] uppercase" style={{ color: "var(--aura-gold)" }}>
        Algo salió mal
      </h2>
      <button
        onClick={reset}
        className="magnetic-btn px-6 py-3 text-sm tracking-[0.15em] uppercase border border-[var(--aura-gold-dim)] hover:border-[var(--aura-gold)] transition-colors"
        style={{ color: "var(--text-secondary)" }}
      >
        Intentar de nuevo
      </button>
    </div>
  );
}
