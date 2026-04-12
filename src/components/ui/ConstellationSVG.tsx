"use client";

import {
  useRef,
  useState,
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
  triggerPulse(mouseX: number, mouseY: number): void;
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
const GLOW_RADIUS_WIDE = 3; // outermost glow radius multiplier
const GLOW_RADIUS_MEDIUM = 1.8; // medium glow radius multiplier
const GLOW_RADIUS_SOFT = 1; // soft glow radius multiplier
const GLOW_RADIUS_CORE = 0.4; // sharp core radius multiplier
const HIT_AREA_RADIUS = 5; // ~44px at 1000px viewport (1 unit ≈ 10px)

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
const ConstellationSVG = forwardRef<ConstellationSVGHandle, ConstellationSVGProps>(
  function ConstellationSVG({ mouseRef, onNodeClick }, ref) {
  const svgRef = useRef<SVGSVGElement>(null);
  const nodeGroupRefs = useRef<(SVGGElement | null)[]>([]);
  const glowRefs = useRef<(SVGCircleElement | null)[]>([]);
  const lineRefs = useRef<(SVGPathElement | null)[]>([]);
  const starRefs = useRef<(SVGCircleElement | null)[]>([]);
  const tickerAddedRef = useRef(false);
  const revealedRef = useRef(false);
  const isDesktopRef = useRef(false);

  // Subscribe to portalRevealed
  const portalRevealed = useUIStore((s) => s.portalRevealed);

  // -------------------------------------------------------------------------
  // Reduced motion + desktop detection
  // -------------------------------------------------------------------------
  const prefersReducedMotion = useRef(false);
  useLayoutEffect(() => {
    if (typeof window === "undefined") return;
    prefersReducedMotion.current = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    isDesktopRef.current = window.matchMedia("(hover: hover)").matches;
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

    triggerPulse(mouseX: number, mouseY: number): void {
      if (prefersReducedMotion.current) return;
      const svg = svgRef.current;
      if (!svg) return;

      // 1. Find nearest node to (mouseX, mouseY) — both in 0-100 viewBox coords
      let nearestIdx = 0;
      let nearestDist = Infinity;
      for (let i = 0; i < NODES.length; i++) {
        const n = NODES[i];
        const dx = mouseX - n.x;
        const dy = mouseY - n.y;
        const d = dx * dx + dy * dy;
        if (d < nearestDist) {
          nearestDist = d;
          nearestIdx = i;
        }
      }

      const nearest = NODES[nearestIdx];
      const ns = "http://www.w3.org/2000/svg";

      // 2. Expanding ripple circle at nearest node
      const ripple = document.createElementNS(ns, "circle");
      ripple.setAttribute("cx", String(nearest.x));
      ripple.setAttribute("cy", String(nearest.y));
      ripple.setAttribute("r", "0.5");
      ripple.setAttribute("fill", "var(--aura-gold)");
      ripple.setAttribute("opacity", "0.8");
      ripple.setAttribute("pointer-events", "none");
      svg.appendChild(ripple);

      gsap.to(ripple, {
        attr: { r: 4 },
        opacity: 0,
        duration: 0.6,
        ease: "power2.out",
        onComplete: () => { ripple.remove(); },
      });

      // 3. Traveling dots along connected lines (follow Catmull-Rom paths)
      const nearestId = nearest.id;
      for (let li = 0; li < LINES.length; li++) {
        const line = LINES[li];
        let reverse = false;
        if (line.from === nearestId) {
          reverse = false;
        } else if (line.to === nearestId) {
          reverse = true;
        } else {
          continue;
        }

        // Use the actual SVG <path> element for getPointAtLength
        const pathEl = lineRefs.current[li];
        if (!pathEl) continue;

        const totalLen = pathEl.getTotalLength();

        const dot = document.createElementNS(ns, "circle");
        const startPt = pathEl.getPointAtLength(reverse ? totalLen : 0);
        dot.setAttribute("cx", String(startPt.x));
        dot.setAttribute("cy", String(startPt.y));
        dot.setAttribute("r", "0.3");
        dot.setAttribute("fill", "var(--aura-gold)");
        dot.setAttribute("opacity", "0.6");
        dot.setAttribute("pointer-events", "none");
        svg.appendChild(dot);

        // Animate a progress value 0→1 and sample the path
        const proxy = { t: 0 };
        gsap.to(proxy, {
          t: 1,
          duration: 0.4,
          ease: "power2.out",
          onUpdate: () => {
            const len = reverse
              ? totalLen * (1 - proxy.t)
              : totalLen * proxy.t;
            const pt = pathEl.getPointAtLength(len);
            dot.setAttribute("cx", String(pt.x));
            dot.setAttribute("cy", String(pt.y));
          },
          onComplete: () => { dot.remove(); },
        });

        // Fade out separately
        gsap.to(dot, {
          opacity: 0,
          duration: 0.4,
          ease: "power2.out",
        });
      }
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
      text.setAttribute("y", String(node.y - GLOW_RADIUS_WIDE * node.scale - 2));
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
          // Inverse distance: closer = brighter (0.15 base → 0.5 max)
          const t = 1 - dist / PROXIMITY_RADIUS;
          glow.setAttribute("opacity", String(0.15 + t * 0.35));
        } else {
          glow.setAttribute("opacity", "0.15");
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
      // Brighten medium glow on hover
      const glow = glowRefs.current[index];
      if (glow) {
        glow.setAttribute("opacity", "0.5");
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
        glow.setAttribute("opacity", "0.15");
      }
    },
    [],
  );

  // -------------------------------------------------------------------------
  // Focus tracking for focus-visible ring
  // -------------------------------------------------------------------------
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);

  const handleFocus = useCallback((index: number) => {
    setFocusedIndex(index);
  }, []);

  const handleBlur = useCallback(() => {
    setFocusedIndex(null);
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, node: ConstellationNode) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        if (node.active) {
          onNodeClick(node);
        } else {
          showProximamente(node);
        }
      }
    },
    [onNodeClick, showProximamente],
  );

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  return (
    <svg
      ref={svgRef}
      viewBox="0 0 100 100"
      preserveAspectRatio="xMidYMid slice"
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
      }}
      role="navigation"
      aria-label="Portal de mundos de IVANN AURA"
    >
      {/* SVG filter defs for multi-layer glow + energy displacement */}
      <defs>
        <filter id="glow-soft" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="0.8" />
        </filter>
        <filter id="glow-medium" x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="1.5" />
        </filter>
        <filter id="glow-wide" x="-150%" y="-150%" width="400%" height="400%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="3" />
        </filter>
        {/* feTurbulence energy filter — living energy on constellation lines (desktop only) */}
        <filter id="energy-line" x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves={2} seed="42" result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="0.8" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </defs>

      {/* Layer 1: Stars (decorative, non-interactive) */}
      <g style={{ pointerEvents: "none" }} aria-hidden="true">
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
      <g style={{ pointerEvents: "none" }} aria-hidden="true">
        {LINES.map((line, i) => (
          <path
            key={`line-${line.from}-${line.to}`}
            ref={(el) => {
              lineRefs.current[i] = el;
            }}
            d={line.path}
            fill="none"
            stroke="var(--aura-gold)"
            strokeWidth={0.15}
            opacity={0}
            filter={isDesktopRef.current ? "url(#energy-line)" : undefined}
          />
        ))}
      </g>

      {/* Layer 3: Nodes (interactive, keyboard-navigable) */}
      <g>
        {NODES.map((node, i) => (
          <g
            key={node.id}
            ref={(el) => {
              nodeGroupRefs.current[i] = el;
            }}
            tabIndex={0}
            role="link"
            aria-label={`${node.label}${node.active ? "" : " — próximamente"}`}
            style={{ cursor: "pointer", opacity: 0, outline: "none" }}
            onMouseEnter={() => handleMouseEnter(node, i)}
            onMouseLeave={() => handleMouseLeave(node, i)}
            onClick={() =>
              node.active ? onNodeClick(node) : showProximamente(node)
            }
            onKeyDown={(e) => handleKeyDown(e, node)}
            onFocus={() => handleFocus(i)}
            onBlur={handleBlur}
          >
            {/* Transparent hit area for 44px touch targets */}
            <circle
              cx={node.x}
              cy={node.y}
              r={HIT_AREA_RADIUS}
              fill="transparent"
              pointerEvents="all"
            />
            {/* Focus-visible ring (gold) */}
            {focusedIndex === i && (
              <circle
                cx={node.x}
                cy={node.y}
                r={GLOW_RADIUS_WIDE * node.scale + 1.5}
                fill="none"
                stroke="var(--aura-gold)"
                strokeWidth={0.3}
                opacity={0.8}
                pointerEvents="none"
              />
            )}
            {/* Wide glow (outermost, static) */}
            <circle
              cx={node.x}
              cy={node.y}
              r={GLOW_RADIUS_WIDE * node.scale}
              fill={node.color}
              opacity={0.06}
              filter="url(#glow-wide)"
              style={{ mixBlendMode: "screen" }}
              pointerEvents="none"
            />
            {/* Medium glow (proximity-reactive) */}
            <circle
              ref={(el) => {
                glowRefs.current[i] = el;
              }}
              cx={node.x}
              cy={node.y}
              r={GLOW_RADIUS_MEDIUM * node.scale}
              fill={node.color}
              opacity={0.15}
              filter="url(#glow-medium)"
              style={{ mixBlendMode: "screen" }}
              pointerEvents="none"
            />
            {/* Soft glow (inner, static) */}
            <circle
              cx={node.x}
              cy={node.y}
              r={GLOW_RADIUS_SOFT * node.scale}
              fill={node.color}
              opacity={0.3}
              filter="url(#glow-soft)"
              style={{ mixBlendMode: "screen" }}
              pointerEvents="none"
            />
            {/* Core (sharp, no filter) */}
            <circle
              cx={node.x}
              cy={node.y}
              r={GLOW_RADIUS_CORE * node.scale}
              fill={node.color}
              opacity={0.9}
              pointerEvents="none"
            />
            {/* Label */}
            <text
              x={node.x}
              y={node.y + GLOW_RADIUS_WIDE * node.scale + 2}
              fill="var(--text-muted)"
              fontSize={2}
              fontFamily="var(--font-body)"
              textAnchor="middle"
              aria-hidden="true"
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
