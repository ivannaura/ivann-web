"use client";

import { useState, useCallback } from "react";
import CustomCursor from "@/components/ui/CustomCursor";
import Navigation from "@/components/ui/Navigation";
import ScrollVideoPlayer from "@/components/ui/ScrollVideoPlayer";
import ScrollStoryOverlay from "@/components/ui/ScrollStoryOverlay";
import Contact from "@/components/sections/Contact";
import Footer from "@/components/ui/Footer";
import PianoIndicator from "@/components/ui/PianoIndicator";
import { usePianoScroll } from "@/hooks/usePianoScroll";

// Use graded video if available, fall back to original
const VIDEO_SRC = "/videos/flamenco-graded.mp4";
const VIDEO_FALLBACK = "/videos/flamenco-de-esfera.mp4";
const AUDIO_SRC = "/audio/flamenco.m4a";

export default function Home() {
  usePianoScroll({ enabled: true, scrollThreshold: 80 });

  const [currentFrame, setCurrentFrame] = useState(0);
  const [energy, setEnergy] = useState(0);
  const [videoSrc, setVideoSrc] = useState(VIDEO_SRC);
  const [soundMuted, setSoundMuted] = useState(false);

  const handleFrameChange = useCallback(
    (frameIndex: number, _direction: "forward" | "backward") => {
      setCurrentFrame(frameIndex);
    },
    []
  );

  const handleVideoError = useCallback(() => {
    if (videoSrc === VIDEO_SRC) {
      setVideoSrc(VIDEO_FALLBACK);
    }
  }, [videoSrc]);

  const handleSoundToggle = useCallback(() => {
    setSoundMuted((prev) => !prev);
  }, []);

  return (
    <>
      <CustomCursor />
      <Navigation
        audioActive={energy > 0.05}
        soundMuted={soundMuted}
        onSoundToggle={handleSoundToggle}
      />
      <PianoIndicator energy={energy} />

      <main>
        <ScrollVideoPlayer
          key={videoSrc}
          videoSrc={videoSrc}
          audioSrc={AUDIO_SRC}
          scrollHeight={1200}
          audioMuted={soundMuted}
          onFrameChange={handleFrameChange}
          onEnergyChange={setEnergy}
          onError={handleVideoError}
        >
          <ScrollStoryOverlay currentFrame={currentFrame} />
        </ScrollVideoPlayer>

        <Contact />
      </main>

      <Footer />
    </>
  );
}
