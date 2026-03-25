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

/**
 * Returns the fraction (0-1) of the video that is buffered from the start.
 * Only counts contiguous buffer from time 0.
 */
function getBufferProgress(video: HTMLVideoElement): number {
  if (!video.duration || !video.buffered.length) return 0;
  // Find the contiguous buffered range starting near 0
  for (let i = 0; i < video.buffered.length; i++) {
    if (video.buffered.start(i) <= 0.5) {
      return video.buffered.end(i) / video.duration;
    }
  }
  return 0;
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
  const [bufferProgress, setBufferProgress] = useState(0);

  // Tracking refs
  const currentTimeRef = useRef(0);
  const lastFrameIndexRef = useRef(0);
  const durationRef = useRef(0);
  const lastScrollYRef = useRef(0);
  const rafRef = useRef<number>(0);
  const momentumRef = useRef<AudioMomentum | null>(null);

  // rAF-throttled seek target
  const pendingSeekRef = useRef<number | null>(null);
  const seekRafRef = useRef<number>(0);

  // Convert video time to 3fps frame index (overlay compatibility)
  const timeToFrame = useCallback((time: number) => Math.floor(time * 3), []);

  // Ref to prevent double-init
  const readyRef = useRef(false);

  const markReady = useCallback(() => {
    const video = videoRef.current;
    if (!video || !video.duration || readyRef.current) return;
    readyRef.current = true;
    durationRef.current = video.duration;
    setReady(true);
  }, []);

  // Track buffer progress and mark ready when enough is buffered
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const checkBuffer = () => {
      if (readyRef.current) return;
      const progress = getBufferProgress(video);
      setBufferProgress(progress);

      // With all-keyframe encoding, any buffered position is instantly seekable.
      // Start at 15% so the user can begin scrolling while the rest loads.
      if (progress >= 0.15 && video.duration) {
        markReady();
      }
    };

    // Check if already fully loaded (local dev / cache hit)
    if (video.readyState >= 4) {
      setBufferProgress(1);
      markReady();
      return;
    }

    const onCanPlayThrough = () => {
      setBufferProgress(1);
      markReady();
    };

    video.addEventListener("progress", checkBuffer);
    video.addEventListener("canplaythrough", onCanPlayThrough);
    // Also check on loadedmetadata in case readyState jumps
    video.addEventListener("loadedmetadata", checkBuffer);

    // Initial check
    checkBuffer();

    return () => {
      video.removeEventListener("progress", checkBuffer);
      video.removeEventListener("canplaythrough", onCanPlayThrough);
      video.removeEventListener("loadedmetadata", checkBuffer);
    };
  }, [markReady]);

  // Clamp time to the furthest contiguous buffered position
  const clampToBuffered = useCallback((video: HTMLVideoElement, time: number): number => {
    if (!video.buffered.length) return 0;
    for (let i = 0; i < video.buffered.length; i++) {
      if (video.buffered.start(i) <= 0.5) {
        return Math.min(time, video.buffered.end(i) - 0.1);
      }
    }
    return 0;
  }, []);

  // rAF-throttled seek: applies pending seek on next animation frame
  const scheduleSeek = useCallback(
    (time: number) => {
      const video = videoRef.current;
      if (!video || !durationRef.current) return;

      const clamped = Math.max(0, Math.min(time, durationRef.current - 0.05));
      currentTimeRef.current = clamped;
      pendingSeekRef.current = clamped;

      // Report frame change immediately (overlay stays responsive)
      const frameIndex = timeToFrame(clamped);
      if (frameIndex !== lastFrameIndexRef.current) {
        const direction =
          frameIndex > lastFrameIndexRef.current ? "forward" : "backward";
        lastFrameIndexRef.current = frameIndex;
        onFrameChange?.(frameIndex, direction);
      }

      // Batch the actual video.currentTime update to next rAF
      if (!seekRafRef.current) {
        seekRafRef.current = requestAnimationFrame(() => {
          seekRafRef.current = 0;
          const target = pendingSeekRef.current;
          if (target !== null && video) {
            // Clamp to buffered range to avoid stalling on unbuffered data
            const safeTarget = clampToBuffered(video, target);
            if (Math.abs(video.currentTime - safeTarget) > 0.05) {
              video.currentTime = safeTarget;
            }
            pendingSeekRef.current = null;
          }
        });
      }
    },
    [onFrameChange, timeToFrame, clampToBuffered]
  );

  // Cleanup seek rAF on unmount
  useEffect(() => {
    return () => {
      if (seekRafRef.current) cancelAnimationFrame(seekRafRef.current);
    };
  }, []);

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

      scheduleSeek(targetTime);

      // Add impulse on forward scroll
      if (scrollingForward) {
        momentumRef.current?.addImpulse();
      }
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
    };
  }, [ready, scheduleSeek]);

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
          onError={onError}
          className="absolute inset-0 w-full h-full object-cover"
          style={{ background: "var(--bg-void)" }}
        />

        {/* Loading state with real progress */}
        {!ready && (
          <div className="absolute inset-0 flex flex-col items-center justify-center z-10">
            <div className="w-24 h-[1px] relative overflow-hidden bg-white/10">
              <div
                className="absolute left-0 top-0 h-full bg-white/50 transition-all duration-300"
                style={{ width: `${bufferProgress * 100}%` }}
              />
            </div>
            <span className="text-[10px] font-mono mt-3 text-white/30">
              {bufferProgress < 0.1
                ? "Conectando..."
                : `Cargando ${Math.round(bufferProgress * 100)}%`}
            </span>
          </div>
        )}

        {/* Overlay content */}
        <div className="absolute inset-0 z-20">
          {children}
        </div>
      </div>
    </div>
  );
}
