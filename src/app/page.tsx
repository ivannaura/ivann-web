"use client";

export default function Portal() {
  return (
    <main className="fixed inset-0 bg-[var(--bg-void)] overflow-hidden">
      <div className="absolute inset-0 flex items-center justify-center">
        <p className="text-[var(--text-muted)] text-sm tracking-widest uppercase font-light">
          Portal
        </p>
      </div>
    </main>
  );
}
