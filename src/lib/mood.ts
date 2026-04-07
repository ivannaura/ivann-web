// ---------------------------------------------------------------------------
// CPU-side mood interpolation (mirrors GLSL getMood for bloom threshold)
// Smooth Hermite interpolation between act boundaries (no step functions):
// Despertar (0.5) -> Entrada (0.6) -> Danza (0.8) -> Espectaculo (0.9)
// -> Fuego (1.1) -> Climax (1.2) -> Resolucion (0.8) -> Cierre (0.5)
// ---------------------------------------------------------------------------

// Hoisted outside function — avoids array allocation on every call (~60fps × 2 callers)
const MOOD_KEYFRAMES = [0.5, 0.5, 0.6, 0.8, 0.9, 1.1, 1.2, 0.8, 0.5] as const;

export function getMoodCPU(progress: number): number {
  const moods = MOOD_KEYFRAMES;
  const t = Math.min(Math.max(progress, 0), 1) * 8;
  const i = Math.floor(t);
  const j = Math.min(i + 1, 8);
  const f = t - i;
  const s = f * f * (3 - 2 * f);
  return moods[i] + (moods[j] - moods[i]) * s;
}
