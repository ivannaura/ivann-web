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
  usePianoScroll({ enabled: true, scrollThreshold: 80 });

  const [currentFrame, setCurrentFrame] = useState(0);
  const [soundMuted, setSoundMuted] = useState(false);

  // Energy + bands via refs to avoid 60fps re-renders, throttled to ~10fps for display
  const energyRef = useRef(0);
  const bandsRef = useRef<FrequencyBands>({ bass: 0, mids: 0, highs: 0 });
  const [displayEnergy, setDisplayEnergy] = useState(0);
  const [displayBands, setDisplayBands] = useState<FrequencyBands>({ bass: 0, mids: 0, highs: 0 });

  useEffect(() => {
    const id = setInterval(() => {
      setDisplayEnergy(energyRef.current);
      setDisplayBands({ ...bandsRef.current });
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
        >
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
