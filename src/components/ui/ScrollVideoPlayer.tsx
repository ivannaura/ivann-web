"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { AudioMomentum, type FrequencyBands } from "@/lib/audio-momentum";
import { initCinemaGL, type CinemaGL } from "@/lib/cinema-gl";
import { playWhoosh, setMicroSoundsMuted } from "@/lib/micro-sounds";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

interface ScrollVideoPlayerProps {
  videoSrc: string;
  audioSrc: string;
  scrollHeight?: number;
  onFrameChange?: (
    frameIndex: number,
    direction: "forward" | "backward"
  ) => void;
  onEnergyChange?: (energy: number) => void;
  onBandsChange?: (bands: FrequencyBands) => void;
  onError?: () => void;
  audioMuted?: boolean;
  children?: React.ReactNode;
}

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
  onBandsChange,
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

  // Mouse tracking for cursor → WebGL interaction
  const mouseRef = useRef({ x: 0.5, y: 0.5 }); // normalized 0-1 of canvas

  // Scroll velocity tracking (smoothed for shader)
  const velocityRef = useRef(0);
  const smoothVelocityRef = useRef(0);
  const lastWhooshRef = useRef(0); // throttle whoosh sounds

  // Stable callback refs
  const onFrameChangeRef = useRef(onFrameChange);
  onFrameChangeRef.current = onFrameChange;
  const onEnergyChangeRef = useRef(onEnergyChange);
  onEnergyChangeRef.current = onEnergyChange;
  const onBandsChangeRef = useRef(onBandsChange);
  onBandsChangeRef.current = onBandsChange;

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
  // Buffer tracking
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
  // iOS touch unlock
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const unlock = () => {
      if (video.readyState < 2) {
        video
          .play()
          .then(() => {
            video.pause();
            video.currentTime = 0;
          })
          .catch(() => {});
      }
    };

    document.addEventListener("touchstart", unlock, { once: true });
    return () => document.removeEventListener("touchstart", unlock);
  }, []);

  // ---------------------------------------------------------------------------
  // Mouse tracking — updates ref on mousemove over sticky viewport
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio, 2);
      mouseRef.current.x = (e.clientX - rect.left) * dpr;
      mouseRef.current.y = (e.clientY - rect.top) * dpr;
    };

    // Track on the parent sticky div, not just canvas (overlay blocks pointer)
    const sticky = canvas.parentElement;
    if (sticky) {
      sticky.addEventListener("mousemove", onMove, { passive: true });
      return () => sticky.removeEventListener("mousemove", onMove);
    }
  }, []);

  // ---------------------------------------------------------------------------
  // WebGL2 cinema canvas
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
  // Render loop — cinema + particles + energy + frequency bands + mouse + velocity
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!ready) return;

    let lastEnergy = -1;
    const defaultBands = { bass: 0, mids: 0, highs: 0 };

    const tick = () => {
      const now = performance.now() / 1000;

      // Energy tracking
      const momentum = momentumRef.current;
      const e = momentum?.getEnergy() ?? 0;
      energyRef.current = e;
      if (Math.abs(e - lastEnergy) > 0.01) {
        lastEnergy = e;
        onEnergyChangeRef.current?.(e);
      }

      // Frequency bands from AnalyserNode — also forwarded to page
      const bands = momentum?.getFrequencyBands() ?? defaultBands;
      onBandsChangeRef.current?.(bands);

      // Smooth velocity decay (exponential toward 0 when not scrolling)
      smoothVelocityRef.current +=
        (velocityRef.current - smoothVelocityRef.current) * 0.15;
      // Decay raw velocity toward 0 each frame (cleared on scroll)
      velocityRef.current *= 0.92;

      // Unified cinema render
      const video = videoRef.current;
      const cinema = cinemaRef.current;
      if (video && cinema) {
        cinema.render({
          video,
          time: now,
          energy: e,
          progress: progressRef.current,
          bands,
          mouseX: mouseRef.current.x,
          mouseY: mouseRef.current.y,
          velocity: smoothVelocityRef.current,
        });
      }

      renderRafRef.current = requestAnimationFrame(tick);
    };

    renderRafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(renderRafRef.current);
  }, [ready]);

  // ---------------------------------------------------------------------------
  // GSAP ScrollTrigger via matchMedia
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!ready) return;
    const video = videoRef.current;
    const container = containerRef.current;
    if (!video || !container) return;

    const mm = gsap.matchMedia();

    mm.add(
      {
        standard: "(prefers-reduced-motion: no-preference)",
        reduced: "(prefers-reduced-motion: reduce)",
      },
      (context) => {
        const { reduced } = context.conditions!;
        const isDesktop = window.innerWidth >= 768;

        ScrollTrigger.create({
          trigger: container,
          start: "top top",
          end: "bottom bottom",
          scrub: reduced ? true : isDesktop ? 1.5 : 2,
          onUpdate: (self) => {
            progressRef.current = self.progress;
            const targetTime = self.progress * durationRef.current;
            const safeTime = clampToBuffered(video, targetTime);
            currentTimeRef.current = safeTime;

            if (Math.abs(video.currentTime - safeTime) > 0.03) {
              video.currentTime = safeTime;
            }

            // Frame change reporting (3fps)
            const frameIndex = Math.floor(safeTime * 3);
            if (frameIndex !== lastFrameIndexRef.current) {
              const dir =
                frameIndex > lastFrameIndexRef.current
                  ? "forward"
                  : "backward";
              lastFrameIndexRef.current = frameIndex;
              onFrameChangeRef.current?.(frameIndex, dir);
            }

            // Scroll velocity → shader + audio impulse
            const rawVelocity = Math.abs(self.getVelocity());
            if (!reduced) {
              // Normalize: 0 at rest, 1 at ~2000px/s
              velocityRef.current = Math.min(1.0, rawVelocity / 2000);

              if (rawVelocity > 50) {
                momentumRef.current?.addImpulse();

                // Whoosh sound on fast scroll (throttled to 1/sec)
                const now = performance.now();
                if (rawVelocity > 800 && now - lastWhooshRef.current > 1000) {
                  lastWhooshRef.current = now;
                  playWhoosh();
                }
              }
            }
          },
        });
      }
    );

    return () => mm.revert();
  }, [ready, clampToBuffered]);

  // ---------------------------------------------------------------------------
  // AudioMomentum
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

  useEffect(() => {
    momentumRef.current?.setMuted(audioMuted);
    setMicroSoundsMuted(audioMuted);
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
      <div className="sticky top-0 w-full h-dvh overflow-hidden">
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

        {hasGL && (
          <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full object-cover"
            style={{ opacity: ready ? 1 : 0 }}
          />
        )}

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

        <div className="absolute inset-0 z-20">{children}</div>
      </div>
    </div>
  );
}
