export default function Loading() {
  return (
    <div
      className="min-h-dvh flex items-center justify-center"
      style={{ background: "var(--bg-void)" }}
    >
      <div
        className="w-8 h-px animate-pulse"
        style={{
          background:
            "linear-gradient(to right, var(--aura-gold-dim), var(--aura-gold))",
        }}
      />
    </div>
  );
}
