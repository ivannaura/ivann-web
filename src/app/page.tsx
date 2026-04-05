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
import type { FrequencyBands } from "@/lib/audio-momentum";

const VIDEO_SRC = "/videos/flamenco-graded.mp4";
const AUDIO_SRC = "/audio/flamenco.m4a";

export default function Home() {
  usePianoScroll({ enabled: true });

  const [currentFrame, setCurrentFrame] = useState(0);
  const [soundMuted, setSoundMuted] = useState(false);

  // Progress ref for atmospheric haze color
  const progressRef = useRef(0);
  const hazeRef = useRef<HTMLDivElement>(null);

  // Energy + bands via refs to avoid 60fps re-renders, throttled to ~10fps for display
  const energyRef = useRef(0);
  const bandsRef = useRef<FrequencyBands>({ bass: 0, mids: 0, highs: 0 });
  const [displayEnergy, setDisplayEnergy] = useState(0);
  const [displayBands, setDisplayBands] = useState<FrequencyBands>({ bass: 0, mids: 0, highs: 0 });

  useEffect(() => {
    const id = setInterval(() => {
      setDisplayEnergy(energyRef.current);
      const newBands = bandsRef.current;
      setDisplayBands(prev => {
        if (Math.abs(prev.bass - newBands.bass) < 0.01 &&
            Math.abs(prev.mids - newBands.mids) < 0.01 &&
            Math.abs(prev.highs - newBands.highs) < 0.01) {
          return prev; // same reference, no re-render
        }
        return { ...newBands };
      });

      // Update atmospheric haze color
      if (hazeRef.current) {
        const p = progressRef.current;
        let color: string;
        if (p < 0.25) color = 'rgba(10,15,30,0.08)';
        else if (p < 0.5) color = 'rgba(25,18,10,0.10)';
        else if (p < 0.75) color = 'rgba(30,8,8,0.12)';
        else color = 'rgba(10,12,25,0.06)';
        hazeRef.current.style.setProperty('--haze-color', color);
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

  const handleSoundToggle = useCallback(() => {
    setSoundMuted((prev) => !prev);
  }, []);

  return (
    <>
      <CustomCursor />
      <Navigation
        audioActive={displayEnergy > 0.05}
        soundMuted={soundMuted}
        onSoundToggle={handleSoundToggle}
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
          />
        </ScrollVideoPlayer>

        <Contact />
      </main>

      <Footer />
    </>
  );
}
