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

  // Vinyl inertia: scroll sets a target, video glides toward it at max speed
  const scrollTargetRef = useRef(0);
  const scrubRafRef = useRef<number>(0);
  const lastTickRef = useRef(0);

  // Vinyl inertia tuning
  const MAX_SCRUB_SPEED = 3.0;   // max video-seconds per real-second (speed cap)
  const EASE_FACTOR = 0.1;       // lerp factor per frame — 0.1 = smooth ease, 0.2 = snappy

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

  // Vinyl inertia loop: glides currentTime toward scrollTarget at capped speed
  useEffect(() => {
    if (!ready) return;

    const video = videoRef.current;
    if (!video) return;

    lastTickRef.current = performance.now();

    const tick = (now: number) => {
      const dt = Math.min((now - lastTickRef.current) / 1000, 0.05); // cap dt at 50ms
      lastTickRef.current = now;

      const target = scrollTargetRef.current;
      const current = currentTimeRef.current;
      const delta = target - current;

      if (Math.abs(delta) > 0.01) {
        // Exponential ease toward target (fast when far, slows near target)
        // then cap at MAX_SCRUB_SPEED so it never jumps too fast
        const eased = delta * EASE_FACTOR;
        const maxStep = MAX_SCRUB_SPEED * dt;
        const step = Math.max(-maxStep, Math.min(maxStep, eased));
        const newTime = current + step;

        // Clamp to buffered range and apply to video
        const safeTime = clampToBuffered(video, newTime);
        currentTimeRef.current = safeTime;
        if (Math.abs(video.currentTime - safeTime) > 0.03) {
          video.currentTime = safeTime;
        }

        // Report frame change
        const frameIndex = timeToFrame(newTime);
        if (frameIndex !== lastFrameIndexRef.current) {
          const direction =
            frameIndex > lastFrameIndexRef.current ? "forward" : "backward";
          lastFrameIndexRef.current = frameIndex;
          onFrameChange?.(frameIndex, direction);
        }
      }

      scrubRafRef.current = requestAnimationFrame(tick);
    };

    scrubRafRef.current = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(scrubRafRef.current);
    };
  }, [ready, clampToBuffered, timeToFrame, onFrameChange]);

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

  // Scroll-driven target update (vinyl loop handles the actual seeking)
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

      // Set target — the vinyl inertia loop will glide toward it
      scrollTargetRef.current = Math.max(
        0,
        Math.min(targetTime, durationRef.current)
      );

      // Audio impulse in both scroll directions
      const currentY = window.scrollY;
      if (currentY !== lastScrollYRef.current) {
        momentumRef.current?.addImpulse();
      }
      lastScrollYRef.current = currentY;
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
    };
  }, [ready]);

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
