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
      style={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--bg-void, #050508)",
        color: "var(--text-primary, #F0EDE6)",
      }}
    >
      <h2
        style={{
          fontSize: "1.5rem",
          fontWeight: 200,
          letterSpacing: "0.3em",
          marginBottom: 16,
        }}
      >
        ALGO SALIÓ MAL
      </h2>
      <p
        style={{
          fontSize: "0.75rem",
          color: "var(--text-muted, #4A4A5A)",
          marginBottom: 24,
        }}
      >
        {error.message || "Error inesperado"}
      </p>
      <button
        onClick={reset}
        style={{
          padding: "12px 32px",
          fontSize: "0.7rem",
          letterSpacing: "0.3em",
          textTransform: "uppercase",
          border: "1px solid var(--aura-gold-dim, #8A7435)",
          color: "var(--aura-gold, #C9A84C)",
          background: "transparent",
          cursor: "pointer",
        }}
      >
        Reintentar
      </button>
    </div>
  );
}
