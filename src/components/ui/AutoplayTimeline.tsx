"use client";

import { useRef, useCallback, useEffect, useState } from "react";
import { useUIStore } from "@/stores/useUIStore";

interface AutoplayTimelineProps {
  progress: number;
  onSeek: (progress: number) => void;
}

export default function AutoplayTimeline({ progress, onSeek }: AutoplayTimelineProps) {
  const autoplayActive = useUIStore((s) => s.autoplayActive);
  const toggleAutoplay = useUIStore((s) => s.toggleAutoplay);
  const setAutoplayActive = useUIStore((s) => s.setAutoplayActive);

  const trackRef = useRef<HTMLDivElement>(null);
  const dragState = useRef({
    dragging: false,
    wasAutoplayActive: false,
  });

  // Scrubber visibility: visible when autoplay is active, or hovering bottom 15% on desktop
  const [hoveringBottom, setHoveringBottom] = useState(false);
  const scrubberVisible = autoplayActive || hoveringBottom;

  // Desktop: show scrubber when mouse is in bottom 15% of viewport
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const threshold = window.innerHeight * 0.85;
      setHoveringBottom(e.clientY >= threshold);
    };
    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  // Drag logic — all ref-based for touch-rate updates
  const getProgressFromEvent = useCallback((clientX: number): number => {
    const track = trackRef.current;
    if (!track) return 0;
    const rect = track.getBoundingClientRect();
    const x = clientX - rect.left;
    return Math.max(0, Math.min(1, x / rect.width));
  }, []);

  const handleDragStart = useCallback(
    (clientX: number) => {
      dragState.current.dragging = true;
      dragState.current.wasAutoplayActive = autoplayActive;
      if (autoplayActive) {
        setAutoplayActive(false);
      }
      const p = getProgressFromEvent(clientX);
      onSeek(p);
    },
    [autoplayActive, setAutoplayActive, getProgressFromEvent, onSeek]
  );

  const handleDragMove = useCallback(
    (clientX: number) => {
      if (!dragState.current.dragging) return;
      const p = getProgressFromEvent(clientX);
      onSeek(p);
    },
    [getProgressFromEvent, onSeek]
  );

  const handleDragEnd = useCallback(() => {
    if (!dragState.current.dragging) return;
    dragState.current.dragging = false;
    if (dragState.current.wasAutoplayActive) {
      setAutoplayActive(true);
    }
  }, [setAutoplayActive]);

  // Mouse drag listeners
  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      handleDragStart(e.clientX);
    },
    [handleDragStart]
  );

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => handleDragMove(e.clientX);
    const onMouseUp = () => handleDragEnd();

    window.addEventListener("mousemove", onMouseMove, { passive: true });
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [handleDragMove, handleDragEnd]);

  // Touch drag listeners
  const onTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (e.touches.length === 1) {
        handleDragStart(e.touches[0].clientX);
      }
    },
    [handleDragStart]
  );

  useEffect(() => {
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 1) handleDragMove(e.touches[0].clientX);
    };
    const onTouchEnd = () => handleDragEnd();

    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("touchend", onTouchEnd);
    return () => {
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
    };
  }, [handleDragMove, handleDragEnd]);

  const clampedProgress = Math.max(0, Math.min(1, progress));

  return (
    <>
      {/* Autoplay toggle button — fixed bottom-right */}
      <button
        onClick={toggleAutoplay}
        className="magnetic-btn fixed z-50 flex items-center justify-center rounded-full"
        style={{
          width: 40,
          height: 40,
          bottom: "max(1.5rem, env(safe-area-inset-bottom))",
          right: "1.5rem",
          background: "var(--bg-surface)",
          border: "1px solid var(--border-subtle)",
          color: "var(--aura-gold)",
          transition: "opacity 0.3s, transform 0.3s",
        }}
        aria-label="Reproduccion automatica"
        aria-pressed={autoplayActive}
      >
        {autoplayActive ? (
          /* Pause icon */
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
            <rect x="3" y="2" width="4" height="12" rx="1" />
            <rect x="9" y="2" width="4" height="12" rx="1" />
          </svg>
        ) : (
          /* Play icon */
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
            <path d="M4 2.5v11l9-5.5z" />
          </svg>
        )}
      </button>

      {/* Timeline scrubber bar — fixed at bottom */}
      <div
        className="fixed left-0 right-0 z-40"
        style={{
          bottom: 0,
          padding: "0 0 env(safe-area-inset-bottom, 0px)",
          opacity: scrubberVisible ? 1 : 0,
          transform: scrubberVisible ? "translateY(0)" : "translateY(8px)",
          transition: "opacity 0.3s ease, transform 0.3s ease",
          pointerEvents: scrubberVisible ? "auto" : "none",
        }}
      >
        {/* Hit area — taller for easier touch interaction */}
        <div
          ref={trackRef}
          className="relative w-full cursor-pointer"
          style={{ height: 24, display: "flex", alignItems: "flex-end" }}
          onMouseDown={onMouseDown}
          onTouchStart={onTouchStart}
        >
          {/* Track background */}
          <div
            className="absolute left-0 right-0"
            style={{
              bottom: 0,
              height: 2,
              background: "var(--bg-subtle)",
              opacity: 0.5,
            }}
          />
          {/* Progress fill */}
          <div
            className="absolute left-0"
            style={{
              bottom: 0,
              height: 2,
              width: `${clampedProgress * 100}%`,
              background: "var(--aura-gold)",
              transition: dragState.current.dragging ? "none" : "width 0.1s linear",
            }}
          />
          {/* Draggable thumb */}
          <div
            className="absolute"
            style={{
              bottom: -5,
              left: `${clampedProgress * 100}%`,
              width: 12,
              height: 12,
              borderRadius: "50%",
              background: "var(--aura-gold)",
              transform: "translateX(-50%)",
              boxShadow: "0 0 6px rgba(201,168,76,0.4)",
              transition: dragState.current.dragging ? "none" : "left 0.1s linear",
            }}
          />
        </div>
      </div>
    </>
  );
}
