"use client";

import {
  useRef,
  useLayoutEffect,
  useCallback,
  forwardRef,
  useImperativeHandle,
} from "react";
import gsap from "gsap";
import { useUIStore } from "@/stores/useUIStore";
import {
  NODES,
  LINES,
  STARS,
  type ConstellationNode,
} from "@/lib/constellation-data";

// ---------------------------------------------------------------------------
// Resolve line endpoints — pre-computed map for O(1) lookup
// ---------------------------------------------------------------------------
const NODE_MAP = new Map(NODES.map((n) => [n.id, n]));

// ---------------------------------------------------------------------------
// Public handle
// ---------------------------------------------------------------------------
export interface ConstellationSVGHandle {
  playExitTransition(nodeId: string): Promise<void>;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
interface ConstellationSVGProps {
  mouseRef: React.RefObject<{ x: number; y: number } | null>;
  onNodeClick: (node: ConstellationNode) => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const PROXIMITY_RADIUS = 20; // viewBox units
const GLOW_RADIUS_OUTER = 3; // base outer glow radius
const GLOW_RADIUS_INNER = 0.6; // core circle radius

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
const ConstellationSVG = forwardRef<ConstellationSVGHandle, ConstellationSVGProps>(
  function ConstellationSVG({ mouseRef, onNodeClick }, ref) {
  const svgRef = useRef<SVGSVGElement>(null);
  const nodeGroupRefs = useRef<(SVGGElement | null)[]>([]);
  const glowRefs = useRef<(SVGCircleElement | null)[]>([]);
  const lineRefs = useRef<(SVGLineElement | null)[]>([]);
  const starRefs = useRef<(SVGCircleElement | null)[]>([]);
  const tickerAddedRef = useRef(false);
  const revealedRef = useRef(false);

  // Subscribe to portalRevealed
  const portalRevealed = useUIStore((s) => s.portalRevealed);

  // -------------------------------------------------------------------------
  // Reduced motion check
  // -------------------------------------------------------------------------
  const prefersReducedMotion = useRef(false);
  useLayoutEffect(() => {
    if (typeof window === "undefined") return;
    prefersReducedMotion.current = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
  }, []);

  // -------------------------------------------------------------------------
  // Exit transition — exposed via ref
  // -------------------------------------------------------------------------
  useImperativeHandle(ref, () => ({
    playExitTransition(nodeId: string): Promise<void> {
      return new Promise((resolve) => {
        const nodeIndex = NODES.findIndex((n) => n.id === nodeId);
        if (nodeIndex === -1 || !svgRef.current) {
          resolve();
          return;
        }

        // Reduced motion: skip animation
        if (prefersReducedMotion.current) {
          resolve();
          return;
        }

        const clickedGlow = glowRefs.current[nodeIndex];
        const tl = gsap.timeline({ onComplete: resolve });

        // 1. Clicked node glow expands to fill viewport
        if (clickedGlow) {
          tl.to(
            clickedGlow,
            {
              attr: { r: 100 },
              opacity: 0.8,
              duration: 0.8,
              ease: "power2.in",
            },
            0,
          );
        }

        // 2. All OTHER node groups fade out
        nodeGroupRefs.current.forEach((group, i) => {
          if (!group || i === nodeIndex) return;
          tl.to(group, { opacity: 0, duration: 0.3, ease: "power2.out" }, 0);
        });

        // 3. All lines fade out
        lineRefs.current.forEach((line) => {
          if (!line) return;
          tl.to(line, { opacity: 0, duration: 0.3, ease: "power2.out" }, 0);
        });

        // 4. Stars fade out
        starRefs.current.forEach((star) => {
          if (!star) return;
          tl.to(star, { opacity: 0, duration: 0.3, ease: "power2.out" }, 0);
        });
      });
    },
  }));

  // -------------------------------------------------------------------------
  // "Próximamente" tooltip for inactive nodes
  // -------------------------------------------------------------------------
  const showProximamente = useCallback(
    (node: ConstellationNode) => {
      const svg = svgRef.current;
      if (!svg || prefersReducedMotion.current) return;

      const ns = "http://www.w3.org/2000/svg";
      const text = document.createElementNS(ns, "text");
      text.setAttribute("x", String(node.x));
      text.setAttribute("y", String(node.y - GLOW_RADIUS_OUTER * node.scale - 2));
      text.setAttribute("fill", "var(--text-muted)");
      text.setAttribute("font-size", "1.5");
      text.setAttribute("font-family", "var(--font-body)");
      text.setAttribute("text-anchor", "middle");
      text.setAttribute("pointer-events", "none");
      text.textContent = "Próximamente";
      svg.appendChild(text);

      gsap.fromTo(
        text,
        { opacity: 0, y: 1 },
        {
          opacity: 1,
          y: 0,
          duration: 0.25,
          ease: "power2.out",
          onComplete: () => {
            gsap.to(text, {
              opacity: 0,
              delay: 1,
              duration: 0.25,
              ease: "power2.in",
              onComplete: () => {
                text.remove();
              },
            });
          },
        },
      );
    },
    [],
  );

  // -------------------------------------------------------------------------
  // Reveal animation
  // -------------------------------------------------------------------------
  useLayoutEffect(() => {
    if (!portalRevealed || revealedRef.current) return;
    revealedRef.current = true;

    // Reduced motion: just show everything instantly
    if (prefersReducedMotion.current) {
      starRefs.current.forEach((el) => {
        if (el) el.style.opacity = String(STARS[starRefs.current.indexOf(el)]?.opacity ?? 0.2);
      });
      lineRefs.current.forEach((el) => {
        if (el) {
          el.style.opacity = "0.3";
          el.removeAttribute("stroke-dashoffset");
        }
      });
      nodeGroupRefs.current.forEach((el) => {
        if (el) el.style.opacity = "1";
      });
      return;
    }

    const ctx = gsap.context(() => {
      // Stars — fade in with random stagger
      const validStars = starRefs.current.filter(Boolean) as SVGCircleElement[];
      if (validStars.length > 0) {
        gsap.fromTo(
          validStars,
          { opacity: 0 },
          {
            opacity: (i: number) => STARS[i]?.opacity ?? 0.2,
            duration: 0.6,
            stagger: { each: 0.5 / validStars.length, from: "random" },
            ease: "power2.out",
          },
        );
      }

      // Lines — draw on via stroke-dasharray/dashoffset
      lineRefs.current.forEach((el) => {
        if (!el) return;
        const length = el.getTotalLength();
        gsap.set(el, {
          strokeDasharray: length,
          strokeDashoffset: length,
          opacity: 0.3,
        });
        gsap.to(el, {
          strokeDashoffset: 0,
          duration: 1.2,
          delay: 0.2,
          ease: "power2.inOut",
        });
      });

      // Nodes — fade in with scale from 0
      const validNodes = nodeGroupRefs.current.filter(Boolean) as SVGGElement[];
      if (validNodes.length > 0) {
        gsap.fromTo(
          validNodes,
          { opacity: 0, scale: 0, transformOrigin: "center center" },
          {
            opacity: 1,
            scale: 1,
            duration: 0.8,
            delay: 0.3,
            stagger: 0.15,
            ease: "back.out(1.7)",
          },
        );
      }
    }, svgRef);

    return () => ctx.revert();
  }, [portalRevealed]);

  // -------------------------------------------------------------------------
  // Proximity glow — GSAP ticker (60fps, no state)
  // -------------------------------------------------------------------------
  useLayoutEffect(() => {
    if (prefersReducedMotion.current) return;
    if (tickerAddedRef.current) return;
    tickerAddedRef.current = true;

    const tick = () => {
      const mouse = mouseRef.current;
      if (!mouse) return;

      for (let i = 0; i < NODES.length; i++) {
        const glow = glowRefs.current[i];
        if (!glow) continue;

        const node = NODES[i];
        const dx = mouse.x - node.x;
        const dy = mouse.y - node.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < PROXIMITY_RADIUS) {
          // Inverse distance: closer = brighter (0.05 base → 0.5 max)
          const t = 1 - dist / PROXIMITY_RADIUS;
          glow.setAttribute("opacity", String(0.05 + t * 0.45));
        } else {
          glow.setAttribute("opacity", "0.05");
        }
      }
    };

    gsap.ticker.add(tick);
    return () => {
      gsap.ticker.remove(tick);
      tickerAddedRef.current = false;
    };
  }, [mouseRef]);

  // -------------------------------------------------------------------------
  // Node hover handlers
  // -------------------------------------------------------------------------
  const handleMouseEnter = useCallback(
    (node: ConstellationNode, index: number) => {
      useUIStore.getState().setCursorLabel(node.label);
      const group = nodeGroupRefs.current[index];
      if (group && !prefersReducedMotion.current) {
        gsap.to(group, {
          scale: 1.1,
          duration: 0.3,
          ease: "power2.out",
          transformOrigin: "center center",
        });
      }
      // Brighten outer glow on hover
      const glow = glowRefs.current[index];
      if (glow) {
        glow.setAttribute("opacity", "0.6");
      }
    },
    [],
  );

  const handleMouseLeave = useCallback(
    (_node: ConstellationNode, index: number) => {
      useUIStore.getState().setCursorLabel(null);
      const group = nodeGroupRefs.current[index];
      if (group && !prefersReducedMotion.current) {
        gsap.to(group, {
          scale: 1,
          duration: 0.3,
          ease: "power2.out",
          transformOrigin: "center center",
        });
      }
      const glow = glowRefs.current[index];
      if (glow) {
        glow.setAttribute("opacity", "0.05");
      }
    },
    [],
  );

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  return (
    <svg
      ref={svgRef}
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
      }}
      aria-hidden="true"
    >
      {/* Layer 1: Stars (decorative, non-interactive) */}
      <g style={{ pointerEvents: "none" }}>
        {STARS.map((star, i) => (
          <circle
            key={`star-${i}`}
            ref={(el) => {
              starRefs.current[i] = el;
            }}
            cx={star.x}
            cy={star.y}
            r={star.size * 0.08}
            fill="var(--aura-gold)"
            opacity={0}
          />
        ))}
      </g>

      {/* Layer 2: Lines (connecting nodes, non-interactive) */}
      <g style={{ pointerEvents: "none" }}>
        {LINES.map((line, i) => {
          const from = NODE_MAP.get(line.from);
          const to = NODE_MAP.get(line.to);
          if (!from || !to) return null;
          return (
            <line
              key={`line-${line.from}-${line.to}`}
              ref={(el) => {
                lineRefs.current[i] = el;
              }}
              x1={from.x}
              y1={from.y}
              x2={to.x}
              y2={to.y}
              stroke="var(--aura-gold)"
              strokeWidth={0.15}
              opacity={0}
            />
          );
        })}
      </g>

      {/* Layer 3: Nodes (interactive) */}
      <g>
        {NODES.map((node, i) => (
          <g
            key={node.id}
            ref={(el) => {
              nodeGroupRefs.current[i] = el;
            }}
            style={{ cursor: "pointer", opacity: 0 }}
            onMouseEnter={() => handleMouseEnter(node, i)}
            onMouseLeave={() => handleMouseLeave(node, i)}
            onClick={() =>
              node.active ? onNodeClick(node) : showProximamente(node)
            }
          >
            {/* Outer glow */}
            <circle
              ref={(el) => {
                glowRefs.current[i] = el;
              }}
              cx={node.x}
              cy={node.y}
              r={GLOW_RADIUS_OUTER * node.scale}
              fill={node.color}
              opacity={0.05}
            />
            {/* Inner core */}
            <circle
              cx={node.x}
              cy={node.y}
              r={GLOW_RADIUS_INNER * node.scale}
              fill={node.color}
            />
            {/* Label */}
            <text
              x={node.x}
              y={node.y + GLOW_RADIUS_OUTER * node.scale + 2}
              fill="var(--text-muted)"
              fontSize={2}
              fontFamily="var(--font-body)"
              textAnchor="middle"
            >
              {node.label}
            </text>
          </g>
        ))}
      </g>
    </svg>
  );
  },
);

export default ConstellationSVG;
