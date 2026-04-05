"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import CustomCursor from "@/components/ui/CustomCursor";
import Navigation from "@/components/ui/Navigation";
import ScrollVideoPlayer from "@/components/ui/ScrollVideoPlayer";
import ScrollStoryOverlay from "@/components/ui/ScrollStoryOverlay";
import Contact from "@/components/sections/Contact";
import Footer from "@/components/ui/Footer";
import PianoIndicator from "@/components/ui/PianoIndicator";
import { usePianoScroll } from "@/hooks/usePianoScroll";
import { destroyMicroSounds } from "@/lib/micro-sounds";
import { useUIStore } from "@/stores/useUIStore";
import type { FrequencyBands } from "@/lib/audio-momentum";

const VIDEO_SRC = "/videos/flamenco-graded.mp4";
const AUDIO_SRC = "/audio/flamenco.m4a";

// Mirrors getMood() in cinema-gl.ts — inlined to avoid importing 1209-line WebGL module
function getMoodCPU(progress: number): number {
  const moods = [0.5, 0.5, 0.6, 0.8, 0.9, 1.1, 1.2, 0.8, 0.5];
  const t = Math.min(Math.max(progress, 0), 1) * 8;
  const i = Math.floor(t);
  const j = Math.min(i + 1, 8);
  const f = t - i;
  const s = f * f * (3 - 2 * f);
  return moods[i] + (moods[j] - moods[i]) * s;
}

export default function Home() {
  const [currentFrame, setCurrentFrame] = useState(0);
  const soundMuted = useUIStore((s) => s.soundMuted);
  const toggleSoundMuted = useUIStore((s) => s.toggleSoundMuted);

  usePianoScroll({ enabled: true, onMuteToggle: toggleSoundMuted });

  // Progress ref for atmospheric haze color
  const progressRef = useRef(0);
  const hazeRef = useRef<HTMLDivElement>(null);

  // Energy + bands + actTransition via refs to avoid 60fps re-renders, throttled to ~10fps for display
  const energyRef = useRef(0);
  const bandsRef = useRef<FrequencyBands>({ bass: 0, mids: 0, highs: 0 });
  const actTransitionRef = useRef(0);
  const [displayEnergy, setDisplayEnergy] = useState(0);
  const [displayBands, setDisplayBands] = useState<FrequencyBands>({ bass: 0, mids: 0, highs: 0 });
  const [displayActTransition, setDisplayActTransition] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setDisplayEnergy(energyRef.current);
      setDisplayActTransition(actTransitionRef.current);
      const newBands = bandsRef.current;
      setDisplayBands(prev => {
        if (Math.abs(prev.bass - newBands.bass) < 0.01 &&
            Math.abs(prev.mids - newBands.mids) < 0.01 &&
            Math.abs(prev.highs - newBands.highs) < 0.01) {
          return prev; // same reference, no re-render
        }
        return { ...newBands };
      });

      // Update atmospheric haze color — smooth interpolation via mood curve
      // Mood range: 0.5 (calm) → 1.2 (climax), mirrors CinemaGL narrative arc
      if (hazeRef.current) {
        const mood = getMoodCPU(progressRef.current);
        // Normalize mood 0.5-1.2 → t 0-1
        const t = Math.min(Math.max((mood - 0.5) / 0.7, 0), 1);
        // Lerp between cool blue (calm) → warm amber (rising) → crimson (climax)
        // Two-segment lerp: t < 0.5 = blue→amber, t >= 0.5 = amber→crimson
        let r: number, g: number, b: number, a: number;
        if (t < 0.5) {
          const s = t * 2; // 0-1 within first segment
          r = 10 + s * 15;   // 10 → 25
          g = 15 - s * 0;    // 15 → 15 (stay neutral then drop)
          b = 30 - s * 20;   // 30 → 10
          a = 0.08 + s * 0.02; // 0.08 → 0.10
        } else {
          const s = (t - 0.5) * 2; // 0-1 within second segment
          r = 25 + s * 5;    // 25 → 30
          g = 15 - s * 7;    // 15 → 8
          b = 10 - s * 2;    // 10 → 8
          a = 0.10 + s * 0.02; // 0.10 → 0.12
        }
        hazeRef.current.style.setProperty(
          '--haze-color',
          `rgba(${Math.round(r)},${Math.round(g)},${Math.round(b)},${a.toFixed(2)})`
        );
      }
    }, 100);
    return () => clearInterval(id);
  }, []);

  // Cleanup micro-sounds on unmount
  useEffect(() => {
    return () => destroyMicroSounds();
  }, []);

  const handleFrameChange = useCallback(
    (frameIndex: number, _direction: "forward" | "backward") => {
      setCurrentFrame(frameIndex);
    },
    []
  );

  const handleEnergyChange = useCallback((e: number) => {
    energyRef.current = e;
  }, []);

  const handleBandsChange = useCallback((b: FrequencyBands) => {
    bandsRef.current = b;
  }, []);

  const handleProgressChange = useCallback((p: number) => {
    progressRef.current = p;
  }, []);

  const handleActTransition = useCallback((value: number) => {
    actTransitionRef.current = value;
  }, []);

  return (
    <>
      <CustomCursor />
      <Navigation
        audioActive={displayEnergy > 0.05}
      />
      <PianoIndicator energy={displayEnergy} bands={displayBands} />

      <main id="main-content" aria-label="Contenido principal">
        <ScrollVideoPlayer
          videoSrc={VIDEO_SRC}
          audioSrc={AUDIO_SRC}
          scrollHeight={1200}
          audioMuted={soundMuted}
          onFrameChange={handleFrameChange}
          onEnergyChange={handleEnergyChange}
          onBandsChange={handleBandsChange}
          onProgressChange={handleProgressChange}
          onActTransition={handleActTransition}
        >
          {/* Atmospheric haze — shifts color with narrative progress */}
          <div
            ref={hazeRef}
            className="absolute inset-0 pointer-events-none"
            style={{
              background: 'radial-gradient(ellipse at 50% 100%, var(--haze-color, rgba(10,15,30,0.08)), transparent 70%)',
              opacity: 0.6,
              zIndex: 10,
            }}
          />
          <ScrollStoryOverlay
            currentFrame={currentFrame}
            energy={displayEnergy}
            bands={displayBands}
            actTransition={displayActTransition}
          />
        </ScrollVideoPlayer>

        <Contact />
      </main>

      <Footer />
    </>
  );
}
