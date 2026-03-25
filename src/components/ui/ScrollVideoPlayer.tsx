"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { AudioMomentum } from "@/lib/audio-momentum";

interface ScrollVideoPlayerProps {
  /** Path to the video file */
  videoSrc: string;
  /** Path to the separate audio file for momentum-driven playback */
  audioSrc: string;
  /** Height of the scroll area (in vh units) — more height = slower scrub */
  scrollHeight?: number;
  /** Callback when the equivalent frame changes (3fps frame index for overlay compat) */
  onFrameChange?: (
    frameIndex: number,
    direction: "forward" | "backward"
  ) => void;
  /** Callback reporting current energy level (0-1) for UI indicators */
  onEnergyChange?: (energy: number) => void;
  /** Called if video fails to load */
  onError?: () => void;
  /** Overlay content to render on top of video */
  children?: React.ReactNode;
}

export default function ScrollVideoPlayer({
  videoSrc,
  audioSrc,
  scrollHeight = 800,
  onFrameChange,
  onEnergyChange,
  onError,
  children,
}: ScrollVideoPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [ready, setReady] = useState(false);

  // Tracking refs
  const currentTimeRef = useRef(0);
  const lastFrameIndexRef = useRef(0);
  const durationRef = useRef(0);
  const lastScrollYRef = useRef(0);
  const rafRef = useRef<number>(0);
  const momentumRef = useRef<AudioMomentum | null>(null);

  // Convert video time to 3fps frame index (overlay compatibility)
  const timeToFrame = useCallback((time: number) => Math.floor(time * 3), []);

  // Ref to prevent double-init without putting `ready` in callback deps
  const readyRef = useRef(false);

  // Video metadata loaded — we can seek now (fires before canplay)
  const handleLoadedMetadata = useCallback(() => {
    const video = videoRef.current;
    if (!video || !video.duration || readyRef.current) return;
    readyRef.current = true;
    durationRef.current = video.duration;
    setReady(true);
  }, []);

  // Handle case where video is already ready (SSR hydration race condition)
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Already loaded before React hydrated
    if (video.readyState >= 1 && !readyRef.current) {
      handleLoadedMetadata();
      return;
    }

    // Re-attach listeners in case React's onLoadedMetadata missed the event
    const handler = () => handleLoadedMetadata();
    video.addEventListener("loadedmetadata", handler);
    video.addEventListener("canplay", handler);
    return () => {
      video.removeEventListener("loadedmetadata", handler);
      video.removeEventListener("canplay", handler);
    };
  }, [handleLoadedMetadata]);

  // Seek video and report frame change
  const seekTo = useCallback(
    (time: number) => {
      const video = videoRef.current;
      if (!video || !durationRef.current) return;

      const clamped = Math.max(0, Math.min(time, durationRef.current - 0.05));
      currentTimeRef.current = clamped;

      // Only set currentTime if it actually changed (avoid redundant seeks)
      if (Math.abs(video.currentTime - clamped) > 0.03) {
        video.currentTime = clamped;
      }

      const frameIndex = timeToFrame(clamped);
      if (frameIndex !== lastFrameIndexRef.current) {
        const direction =
          frameIndex > lastFrameIndexRef.current ? "forward" : "backward";
        lastFrameIndexRef.current = frameIndex;
        onFrameChange?.(frameIndex, direction);
      }
    },
    [onFrameChange, timeToFrame]
  );

  // Initialize AudioMomentum when ready and audioSrc available
  useEffect(() => {
    if (!ready || !audioSrc) return;

    const momentum = new AudioMomentum();
    momentum.init(audioSrc);
    momentum.setVideoTimeGetter(() => currentTimeRef.current);
    momentumRef.current = momentum;

    return () => {
      momentum.destroy();
      momentumRef.current = null;
    };
  }, [ready, audioSrc]);

  // Scroll-driven seeking
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !ready) return;

    const onScroll = () => {
      const rect = container.getBoundingClientRect();
      const scrollableHeight = container.offsetHeight - window.innerHeight;
      if (scrollableHeight <= 0) return;

      const scrolled = -rect.top;
      const progress = Math.max(0, Math.min(1, scrolled / scrollableHeight));
      const targetTime = progress * durationRef.current;

      // Direction
      const currentY = window.scrollY;
      const scrollingForward = currentY > lastScrollYRef.current;
      lastScrollYRef.current = currentY;

      seekTo(targetTime);

      // Add impulse on forward scroll
      if (scrollingForward) {
        momentumRef.current?.addImpulse();
      }
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
    };
  }, [ready, seekTo]);

  // Energy reporting loop
  useEffect(() => {
    if (!ready) return;

    let lastEnergy = -1;
    const tick = () => {
      const e = momentumRef.current?.getEnergy() ?? 0;
      if (Math.abs(e - lastEnergy) > 0.01) {
        lastEnergy = e;
        onEnergyChange?.(e);
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(rafRef.current);
    };
  }, [ready, onEnergyChange]);

  return (
    <div
      ref={containerRef}
      data-cinema
      style={{ height: `${scrollHeight}vh` }}
      className="relative"
    >
      <div className="sticky top-0 w-full h-screen overflow-hidden">
        <video
          ref={videoRef}
          src={videoSrc}
          muted
          playsInline
          preload="auto"
          onLoadedMetadata={handleLoadedMetadata}
          onCanPlay={handleLoadedMetadata}
          onError={onError}
          className="absolute inset-0 w-full h-full object-cover"
          style={{ background: "var(--bg-void)" }}
        />

        {/* Loading state */}
        {!ready && (
          <div className="absolute inset-0 flex flex-col items-center justify-center z-10">
            <div className="w-16 h-[1px] relative overflow-hidden bg-white/10">
              <div
                className="absolute left-0 top-0 h-full bg-white/40 animate-pulse"
                style={{ width: "60%" }}
              />
            </div>
            <span className="text-[10px] font-mono mt-3 text-white/30">
              Cargando...
            </span>
          </div>
        )}

        {/* Overlay content — pointer-events managed by children */}
        <div className="absolute inset-0 z-20">
          {children}
        </div>
      </div>
    </div>
  );
}
