"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { AudioMomentum } from "@/lib/audio-momentum";
import { initCinemaGL, type CinemaGL } from "@/lib/cinema-gl";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

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
  /** Whether audio should be muted (user toggle) */
  audioMuted?: boolean;
  /** Overlay content to render on top of video */
  children?: React.ReactNode;
}

/**
 * Returns the fraction (0-1) of the video that is buffered from the start.
 * Only counts contiguous buffer from time 0.
 */
function getBufferProgress(video: HTMLVideoElement): number {
  if (!video.duration || !video.buffered.length) return 0;
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
  audioMuted = false,
  children,
}: ScrollVideoPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cinemaRef = useRef<CinemaGL | null>(null);
  const [ready, setReady] = useState(false);
  const [bufferProgress, setBufferProgress] = useState(0);
  const [hasGL, setHasGL] = useState(true);

  // Tracking refs
  const currentTimeRef = useRef(0);
  const lastFrameIndexRef = useRef(0);
  const durationRef = useRef(0);
  const energyRef = useRef(0);
  const progressRef = useRef(0);
  const renderRafRef = useRef<number>(0);
  const momentumRef = useRef<AudioMomentum | null>(null);
  const readyRef = useRef(false);

  // Stable callback refs (avoid stale closures in rAF / GSAP callbacks)
  const onFrameChangeRef = useRef(onFrameChange);
  onFrameChangeRef.current = onFrameChange;
  const onEnergyChangeRef = useRef(onEnergyChange);
  onEnergyChangeRef.current = onEnergyChange;

  // Clamp time to the furthest contiguous buffered position
  const clampToBuffered = useCallback(
    (video: HTMLVideoElement, time: number): number => {
      if (!video.buffered.length) return 0;
      for (let i = 0; i < video.buffered.length; i++) {
        if (video.buffered.start(i) <= 0.5) {
          return Math.min(time, video.buffered.end(i) - 0.1);
        }
      }
      return 0;
    },
    []
  );

  const markReady = useCallback(() => {
    const video = videoRef.current;
    if (!video || !video.duration || readyRef.current) return;
    readyRef.current = true;
    durationRef.current = video.duration;
    setReady(true);
  }, []);

  // ---------------------------------------------------------------------------
  // Buffer tracking — start at 15% (all-keyframe = any position is seekable)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const checkBuffer = () => {
      if (readyRef.current) return;
      const progress = getBufferProgress(video);
      setBufferProgress(progress);
      if (progress >= 0.15 && video.duration) markReady();
    };

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
    video.addEventListener("loadedmetadata", checkBuffer);
    checkBuffer();

    return () => {
      video.removeEventListener("progress", checkBuffer);
      video.removeEventListener("canplaythrough", onCanPlayThrough);
      video.removeEventListener("loadedmetadata", checkBuffer);
    };
  }, [markReady]);

  // ---------------------------------------------------------------------------
  // iOS fix: Safari on cellular ignores preload="auto" until user gesture.
  // A brief play+pause on first touch unlocks buffering (muted autoplay allowed).
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const unlock = () => {
      if (video.readyState < 2) {
        video.play()
          .then(() => { video.pause(); video.currentTime = 0; })
          .catch(() => {});
      }
    };

    document.addEventListener("touchstart", unlock, { once: true });
    return () => document.removeEventListener("touchstart", unlock);
  }, []);

  // ---------------------------------------------------------------------------
  // Unified WebGL2 cinema canvas — video post-processing + particles
  // Single context, shared video texture, luminance-reactive particles
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    const cinema = initCinemaGL(canvas);
    if (!cinema) {
      setHasGL(false);
      return;
    }
    cinemaRef.current = cinema;

    // Size canvas to viewport with DPR capping
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio, 2);
      cinema.resize(
        Math.round(canvas.clientWidth * dpr),
        Math.round(canvas.clientHeight * dpr)
      );
    };
    resize();

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    return () => {
      ro.disconnect();
      cinema.destroy();
      cinemaRef.current = null;
    };
  }, []);

  // ---------------------------------------------------------------------------
  // Render loop — cinema + particles + energy tracking
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!ready) return;

    let lastEnergy = -1;
    const tick = () => {
      const now = performance.now() / 1000;

      // Energy tracking
      const e = momentumRef.current?.getEnergy() ?? 0;
      energyRef.current = e;
      if (Math.abs(e - lastEnergy) > 0.01) {
        lastEnergy = e;
        onEnergyChangeRef.current?.(e);
      }

      // Unified cinema render — video post-processing + particles
      const video = videoRef.current;
      const cinema = cinemaRef.current;
      if (video && cinema) {
        cinema.render(video, now, e, progressRef.current);
      }

      renderRafRef.current = requestAnimationFrame(tick);
    };

    renderRafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(renderRafRef.current);
  }, [ready]);

  // ---------------------------------------------------------------------------
  // GSAP ScrollTrigger — scrub:1.5 = 1.5s smooth catch-up = vinyl feel
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!ready) return;
    const video = videoRef.current;
    const container = containerRef.current;
    if (!video || !container) return;

    const ctx = gsap.context(() => {
      ScrollTrigger.create({
        trigger: container,
        start: "top top",
        end: "bottom bottom",
        scrub: 1.5,
        onUpdate: (self) => {
          progressRef.current = self.progress;
          const targetTime = self.progress * durationRef.current;
          const safeTime = clampToBuffered(video, targetTime);
          currentTimeRef.current = safeTime;

          // Throttle seeks — browser can't decode faster than ~30ms
          if (Math.abs(video.currentTime - safeTime) > 0.03) {
            video.currentTime = safeTime;
          }

          // Frame change reporting (3fps overlay system)
          const frameIndex = Math.floor(safeTime * 3);
          if (frameIndex !== lastFrameIndexRef.current) {
            const dir =
              frameIndex > lastFrameIndexRef.current ? "forward" : "backward";
            lastFrameIndexRef.current = frameIndex;
            onFrameChangeRef.current?.(frameIndex, dir);
          }

          // Audio impulse from scroll velocity
          if (Math.abs(self.getVelocity()) > 50) {
            momentumRef.current?.addImpulse();
          }
        },
      });
    }, container);

    return () => ctx.revert();
  }, [ready, clampToBuffered]);

  // ---------------------------------------------------------------------------
  // AudioMomentum — physics-driven audio tied to scroll energy
  // ---------------------------------------------------------------------------
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

  // Sync mute state to AudioMomentum when user toggles
  useEffect(() => {
    momentumRef.current?.setMuted(audioMuted);
  }, [audioMuted]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div
      ref={containerRef}
      data-cinema
      style={{ height: `${scrollHeight}vh` }}
      className="relative"
    >
      <div className="sticky top-0 w-full h-screen overflow-hidden">
        {/* Hidden video element — source for WebGL texture + buffer tracking */}
        <video
          ref={videoRef}
          src={videoSrc}
          muted
          playsInline
          preload="auto"
          onError={onError}
          className="absolute inset-0 w-full h-full object-cover"
          style={{
            background: "var(--bg-void)",
            opacity: hasGL && ready ? 0 : 1,
          }}
        />

        {/* Unified WebGL2 canvas — post-processed video + luminance-reactive particles */}
        {hasGL && (
          <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full object-cover"
            style={{ opacity: ready ? 1 : 0 }}
          />
        )}

        {/* Loading state with real buffer progress */}
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

        {/* Overlay content (story beats) */}
        <div className="absolute inset-0 z-20">{children}</div>
      </div>
    </div>
  );
}
