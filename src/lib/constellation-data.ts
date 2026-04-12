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
  /** SVG path d attribute (Catmull-Rom organic curve) */
  path: string;
}

// ---------------------------------------------------------------------------
// Golden angle distribution
// ---------------------------------------------------------------------------

/** Golden angle in radians (~137.5 degrees) */
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

/** Simple deterministic hash for consistent jitter */
function hashString(s: string): number {
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    hash = ((hash << 5) - hash + s.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

/** Clamp value to [min, max] */
function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

/**
 * Distribute nodes using golden-angle spiral.
 * "concierto" stays at center (50, 50); others spiral outward.
 * Positions clamped to 10-90 range (10-unit edge padding).
 */
function distributeNodes(nodes: ConstellationNode[]): ConstellationNode[] {
  const center = nodes.find((n) => n.id === "concierto")!;
  const others = nodes.filter((n) => n.id !== "concierto");

  const distributed = others.map((node, i) => {
    const angle = (i + 1) * GOLDEN_ANGLE;
    const distance = 18 + Math.sqrt(i + 1) * 10; // 18-28 units from center
    // Add subtle jitter for organic feel (+/- 2 units)
    const jitterX = (hashString(node.id) % 5) - 2;
    const jitterY = (hashString(node.id + "y") % 5) - 2;
    return {
      ...node,
      x: clamp(50 + distance * Math.cos(angle) + jitterX, 10, 90),
      y: clamp(50 + distance * Math.sin(angle) + jitterY, 10, 90),
    };
  });

  return [{ ...center, x: 50, y: 50 }, ...distributed];
}

// ---------------------------------------------------------------------------
// Catmull-Rom → SVG cubic Bezier path
// ---------------------------------------------------------------------------

/**
 * Convert Catmull-Rom control points to SVG cubic Bezier path.
 * Catmull-Rom passes through all points (organic feel).
 * Returns SVG `d` attribute string.
 */
export function catmullRomToPath(
  points: { x: number; y: number }[],
  tension = 0.5,
): string {
  if (points.length < 2) return "";
  if (points.length === 2) {
    return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;
  }

  let d = `M ${points[0].x} ${points[0].y}`;

  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];

    // Catmull-Rom to cubic Bezier control points
    const cp1x = p1.x + (p2.x - p0.x) / (6 * tension);
    const cp1y = p1.y + (p2.y - p0.y) / (6 * tension);
    const cp2x = p2.x - (p3.x - p1.x) / (6 * tension);
    const cp2y = p2.y - (p3.y - p1.y) / (6 * tension);

    d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
  }

  return d;
}

// ---------------------------------------------------------------------------
// Precompute organic curve paths for lines
// ---------------------------------------------------------------------------

/**
 * Compute a Catmull-Rom path between two nodes with a slight
 * perpendicular midpoint offset for an organic curve.
 */
function computeLinePath(
  fromNode: ConstellationNode,
  toNode: ConstellationNode,
): string {
  const midX = (fromNode.x + toNode.x) / 2;
  const midY = (fromNode.y + toNode.y) / 2;
  // Perpendicular offset (rotated 90 degrees from line direction)
  const dx = toNode.x - fromNode.x;
  const dy = toNode.y - fromNode.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  // Guard against zero-length lines
  const perpX = len > 0 ? (-dy / len) * 2 : 0; // 2 units perpendicular offset
  const perpY = len > 0 ? (dx / len) * 2 : 0;

  const points = [
    { x: fromNode.x, y: fromNode.y },
    { x: midX + perpX, y: midY + perpY },
    { x: toNode.x, y: toNode.y },
  ];

  return catmullRomToPath(points);
}

// ---------------------------------------------------------------------------
// Raw node definitions (positions will be replaced by golden-angle spiral)
// ---------------------------------------------------------------------------

const RAW_NODES: ConstellationNode[] = [
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
    x: 0, y: 0, // replaced by distributeNodes
    scale: 1,
    color: "#3B82C8",
    href: "/mar",
    active: true,
  },
  {
    id: "apocalypsis",
    label: "Apocalypsis",
    x: 0, y: 0,
    scale: 1,
    color: "#8B2020",
    href: "/apocalypsis",
    active: true,
  },
  {
    id: "pianista",
    label: "El Pianista",
    x: 0, y: 0,
    scale: 1,
    color: "#D4C9A8",
    href: "/pianista",
    active: true,
  },
  {
    id: "contratar",
    label: "Contratar",
    x: 0, y: 0,
    scale: 1,
    color: "var(--aura-gold-dim)",
    href: "/contratar",
    active: true,
  },
];

export const NODES: ConstellationNode[] = distributeNodes(RAW_NODES);

// ---------------------------------------------------------------------------
// Pre-computed node map for line path computation
// ---------------------------------------------------------------------------

const NODE_MAP_INTERNAL = new Map(NODES.map((n) => [n.id, n]));

// ---------------------------------------------------------------------------
// Line definitions with precomputed Catmull-Rom paths
// ---------------------------------------------------------------------------

const RAW_LINES: { from: string; to: string }[] = [
  { from: "concierto", to: "mar" },
  { from: "concierto", to: "apocalypsis" },
  { from: "concierto", to: "pianista" },
  { from: "concierto", to: "contratar" },
  { from: "mar", to: "pianista" },
  { from: "apocalypsis", to: "contratar" },
];

export const LINES: ConstellationLine[] = RAW_LINES.map((line) => {
  const fromNode = NODE_MAP_INTERNAL.get(line.from)!;
  const toNode = NODE_MAP_INTERNAL.get(line.to)!;
  return {
    from: line.from,
    to: line.to,
    path: computeLinePath(fromNode, toNode),
  };
});

// ---------------------------------------------------------------------------
// Decorative stars (unchanged)
// ---------------------------------------------------------------------------

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
