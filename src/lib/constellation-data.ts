// ---------------------------------------------------------------------------
// Constellation data — node positions, connecting lines, decorative stars
// ---------------------------------------------------------------------------

export interface ConstellationNode {
  id: string;
  label: string;
  /** Position as percentage of viewport (0-100) */
  x: number;
  y: number;
  /** Visual size multiplier (1 = normal, 1.5 = larger) */
  scale: number;
  /** CSS color for the node glow */
  color: string;
  /** Route to navigate to */
  href: string;
  /** Whether the world is built or "coming soon" */
  active: boolean;
}

export interface ConstellationLine {
  from: string;
  to: string;
}

export const NODES: ConstellationNode[] = [
  {
    id: "concierto",
    label: "El Concierto",
    x: 50, y: 50,
    scale: 1.5,
    color: "var(--aura-gold)",
    href: "/concierto",
    active: true,
  },
  {
    id: "mar",
    label: "El Mar",
    x: 22, y: 68,
    scale: 1,
    color: "#3B82C8",
    href: "/mar",
    active: true,
  },
  {
    id: "apocalypsis",
    label: "Apocalypsis",
    x: 78, y: 28,
    scale: 1,
    color: "#8B2020",
    href: "/apocalypsis",
    active: true,
  },
  {
    id: "pianista",
    label: "El Pianista",
    x: 25, y: 30,
    scale: 1,
    color: "#D4C9A8",
    href: "/pianista",
    active: true,
  },
  {
    id: "contratar",
    label: "Contratar",
    x: 75, y: 72,
    scale: 1,
    color: "var(--aura-gold-dim)",
    href: "/contratar",
    active: true,
  },
];

export const LINES: ConstellationLine[] = [
  { from: "concierto", to: "mar" },
  { from: "concierto", to: "apocalypsis" },
  { from: "concierto", to: "pianista" },
  { from: "concierto", to: "contratar" },
  { from: "mar", to: "pianista" },
  { from: "apocalypsis", to: "contratar" },
];

export const STARS: readonly { x: number; y: number; size: number; opacity: number }[] = [
  { x: 10, y: 15, size: 2, opacity: 0.3 },
  { x: 35, y: 12, size: 1.5, opacity: 0.2 },
  { x: 60, y: 18, size: 2, opacity: 0.25 },
  { x: 85, y: 22, size: 1, opacity: 0.15 },
  { x: 15, y: 45, size: 1.5, opacity: 0.2 },
  { x: 88, y: 50, size: 2, opacity: 0.3 },
  { x: 40, y: 80, size: 1, opacity: 0.15 },
  { x: 65, y: 85, size: 1.5, opacity: 0.2 },
  { x: 8, y: 78, size: 2, opacity: 0.25 },
  { x: 92, y: 82, size: 1, opacity: 0.15 },
  { x: 30, y: 40, size: 1, opacity: 0.1 },
  { x: 70, y: 60, size: 1, opacity: 0.1 },
  { x: 45, y: 25, size: 1.5, opacity: 0.15 },
  { x: 55, y: 75, size: 1.5, opacity: 0.15 },
];
