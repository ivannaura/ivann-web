"use client";

import { useEffect, useRef, useState, useCallback } from "react";

interface ScrollFramePlayerProps {
  /** Directory path where frames are stored (e.g., "/frames/") */
  frameDir: string;
  /** Frame filename pattern — use {n} for frame number (e.g., "frame-{n}.webp") */
  framePattern: string;
  /** Total number of frames */
  totalFrames: number;
  /** Number of digits for zero-padding (e.g., 3 → "001") */
  padDigits?: number;
  /** Height of the scroll area (in vh units) — more height = slower animation */
  scrollHeight?: number;
  /** Callback when frame changes — useful for triggering piano notes */
  onFrameChange?: (frameIndex: number, direction: "forward" | "backward") => void;
  /** Overlay content to render on top of frames */
  children?: React.ReactNode;
}

export default function ScrollFramePlayer({
  frameDir,
  framePattern,
  totalFrames,
  padDigits = 3,
  scrollHeight = 500,
  onFrameChange,
  children,
}: ScrollFramePlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imagesRef = useRef<HTMLImageElement[]>([]);
  const currentFrameRef = useRef(0);
  const [loaded, setLoaded] = useState(false);
  const [loadProgress, setLoadProgress] = useState(0);

  // Build frame URL from index
  const getFrameUrl = useCallback(
    (index: number) => {
      const padded = String(index).padStart(padDigits, "0");
      const filename = framePattern.replace("{n}", padded);
      return `${frameDir}${filename}`;
    },
    [frameDir, framePattern, padDigits]
  );

  // Preload all frames
  useEffect(() => {
    if (totalFrames <= 0) return;

    let loadedCount = 0;
    const images: HTMLImageElement[] = new Array(totalFrames);

    const onLoad = () => {
      loadedCount++;
      setLoadProgress(loadedCount / totalFrames);
      if (loadedCount === totalFrames) {
        imagesRef.current = images;
        setLoaded(true);
        // Draw first frame
        drawFrame(0);
      }
    };

    const onError = () => {
      loadedCount++;
      setLoadProgress(loadedCount / totalFrames);
      if (loadedCount === totalFrames) {
        imagesRef.current = images;
        setLoaded(true);
        drawFrame(0);
      }
    };

    for (let i = 0; i < totalFrames; i++) {
      const img = new Image();
      img.src = getFrameUrl(i);
      img.onload = onLoad;
      img.onerror = onError;
      images[i] = img;
    }

    return () => {
      // Cleanup
      images.forEach((img) => {
        img.onload = null;
        img.onerror = null;
      });
    };
  }, [totalFrames, getFrameUrl]);

  // Draw a specific frame to canvas
  const drawFrame = useCallback((index: number) => {
    const canvas = canvasRef.current;
    const images = imagesRef.current;
    if (!canvas || !images[index] || !images[index].complete) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const img = images[index];

    // Scale to cover canvas
    const canvasRatio = canvas.width / canvas.height;
    const imgRatio = img.naturalWidth / img.naturalHeight;

    let drawWidth: number, drawHeight: number, offsetX: number, offsetY: number;

    if (imgRatio > canvasRatio) {
      drawHeight = canvas.height;
      drawWidth = drawHeight * imgRatio;
      offsetX = (canvas.width - drawWidth) / 2;
      offsetY = 0;
    } else {
      drawWidth = canvas.width;
      drawHeight = drawWidth / imgRatio;
      offsetX = 0;
      offsetY = (canvas.height - drawHeight) / 2;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);
  }, []);

  // Resize canvas to match viewport
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      // Redraw current frame
      if (loaded) drawFrame(currentFrameRef.current);
    };

    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [loaded, drawFrame]);

  // Scroll-driven frame update
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !loaded || totalFrames <= 0) return;

    const onScroll = () => {
      const rect = container.getBoundingClientRect();
      const scrollableHeight = container.offsetHeight - window.innerHeight;
      const scrolled = -rect.top;
      const progress = Math.max(0, Math.min(1, scrolled / scrollableHeight));
      const frameIndex = Math.min(
        totalFrames - 1,
        Math.floor(progress * totalFrames)
      );

      if (frameIndex !== currentFrameRef.current) {
        const direction =
          frameIndex > currentFrameRef.current ? "forward" : "backward";
        currentFrameRef.current = frameIndex;
        drawFrame(frameIndex);
        onFrameChange?.(frameIndex, direction);
      }
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [loaded, totalFrames, drawFrame, onFrameChange]);

  // Keyboard-driven frame advance
  useEffect(() => {
    if (!loaded || totalFrames <= 0) return;

    const onKeyDown = (e: KeyboardEvent) => {
      // Any letter/number key advances a frame
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const next = Math.min(
          totalFrames - 1,
          currentFrameRef.current + 1
        );
        if (next !== currentFrameRef.current) {
          currentFrameRef.current = next;
          drawFrame(next);
          onFrameChange?.(next, "forward");
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [loaded, totalFrames, drawFrame, onFrameChange]);

  return (
    <div
      ref={containerRef}
      style={{ height: `${scrollHeight}vh` }}
      className="relative"
    >
      {/* Sticky canvas viewport */}
      <div className="sticky top-0 w-full h-screen overflow-hidden">
        <canvas
          ref={canvasRef}
          className="absolute inset-0"
          style={{ background: "var(--bg-void)" }}
        />

        {/* Loading indicator */}
        {!loaded && totalFrames > 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center z-10">
            <div
              className="w-24 h-[1px] relative overflow-hidden"
              style={{ background: "var(--bg-subtle)" }}
            >
              <div
                className="absolute left-0 top-0 h-full transition-all duration-200"
                style={{
                  width: `${loadProgress * 100}%`,
                  background: "var(--aura-gold)",
                }}
              />
            </div>
            <span
              className="text-[10px] font-mono mt-3"
              style={{ color: "var(--text-muted)" }}
            >
              {Math.round(loadProgress * 100)}%
            </span>
          </div>
        )}

        {/* Overlay content (text, reveals, etc.) */}
        <div className="absolute inset-0 z-20 pointer-events-none">
          {children}
        </div>
      </div>
    </div>
  );
}
