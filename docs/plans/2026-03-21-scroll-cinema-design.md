# IVANN AURA — Scroll Cinema Experience

## Vision

The entire page is a single cinematic experience driven by scroll. The video "Flamenco de Esfera" plays frame-by-frame as the user scrolls, while page elements (text, stats, cards, CTAs) appear and disappear synchronized with what's happening on screen. Each keypress also advances the video and plays a piano note (Fur Elise).

**Source video:** `public/videos/flamenco-de-esfera.mp4` (1280x720, 29.97fps, 4:06)
**Total frames at 2fps:** 491 storyboard frames
**Target scroll frames:** ~300-400 frames (extracted at ~3fps, selecting best segments)

---

## Storyboard — 8 Acts

### ACT 1: "EL DESPERTAR" (0:00 - 0:30)

**Video content:** Black → distant stage with blue LED → blurry camera movement with lights → IVANN silhouette appears

**Page elements:**
- Start: Full black screen
- 0:05 → Subtle grain texture fades in
- 0:10 → "IVANN AURA" title fades in (large, centered, letter-spacing animation)
- 0:15 → "LIVE EXPERIENCE" subtitle appears below
- 0:25 → "SCROLL" indicator pulses at bottom
- All text fades out as Act 2 begins

**Color grade:** Ultra dark — crush blacks to pure black, only stage lights visible. `eq=brightness=-0.15:contrast=1.6:saturation=0.8` + heavy vignette

**ffmpeg pipeline:**
```
crop → remove top/bottom bars
eq=brightness=-0.15:contrast=1.6:saturation=0.8
curves (crush blacks)
vignette=PI/3
```

**Overlay behavior:** Text uses `mix-blend-mode: difference` or `screen` to interact with the video

---

### ACT 2: "LA ENTRADA" (0:30 - 1:00)

**Video content:** IVANN close-up (dramatic, wild hair, purple light) → bailarina enters with red dress → piano rojo visible → rapid camera changes, high energy

**Page elements:**
- 0:30 → Previous text fades out
- 0:33 → IVANN close-up: quote appears: *"Si Beethoven estuviera vivo, usaria la tecnologia disponible"*
- 0:38 → Quote fades, stats fly in one by one:
  - "200+" SHOWS (left)
  - "15+" ANOS (center-left)
  - "4" ALBUMES (center-right)
  - "∞" EMOCIONES (right)
- 0:45 → Stats fade, bailarina is dancing: "Pianista. Compositor. Visionario." text reveals letter by letter
- 0:55 → All text clears for transition

**Color grade:** Cinematic Dark — deep blacks, teal shadows, warm highlights
```
eq=brightness=-0.08:contrast=1.4:saturation=1.3
curves=m='0/0 0.15/0.02 0.5/0.45 0.85/0.85 1/1'
vignette=PI/4
```

**Key frames to enhance:**
- 0:30 IVANN close-up → sharpen face, deep contrast
- 0:37 bailarina first appearance → slow motion if possible
- 0:44 wide shot with piano → crop corporate banners

---

### ACT 3: "LA DANZA" (1:00 - 1:30)

**Video content:** Red fabric flying, dress close-ups, dancers around IVANN, wide shots with golden/yellow lights

**Page elements:**
- 1:00 → Section marker "01 — LA EXPERIENCIA" slides in from left
- 1:05 → Bio text appears in columns (left side, 40% width):
  - "Ivan Dario Arias"
  - "Nacido en Medellin, Colombia"
  - "Conservatorio de Bellas Artes"
  - "Master en Composicion — University of Wollongong, Sydney"
- 1:15 → Bio fades, "Cada nota es un universo" large text appears
- 1:25 → Text clears

**Color grade:** Mixed — Crimson Noir for close-ups (red tones), Golden Aura for wide shots
```
# Crimson:
eq=brightness=-0.12:contrast=1.5:saturation=1.1
colorbalance=rs=0.25:gs=-0.1:bs=-0.15

# Golden:
eq=brightness=-0.05:contrast=1.3:saturation=0.8
colorbalance=rs=0.15:gs=0.05:bs=-0.2
```

**Key moments:**
- 1:02 dress close-up with sequins → Crimson Noir, potential hero image
- 1:18 wide shot with yellow lights → Golden Aura, crop banners

---

### ACT 4: "EL ESPECTACULO" (1:30 - 2:00)

**Video content:** Full show wide shots, all dancers, piano rojo as centerpiece. Corporate banners visible (must crop).

**Page elements:**
- 1:30 → Section marker "02 — EL SHOW" slides in
- 1:35 → Show element cards appear one by one (bottom of screen):
  - Piano de Cola — "Steinway & Sons, el corazon del show"
  - Produccion Visual — "LED walls, lasers, mapping"
  - Artistas Aereos — "Trapecistas y telas suspendidas"
  - Danza — "Ballet, contemporaneo, flamenco"
- 1:50 → Cards fade, "Una experiencia que desafia los sentidos" appears large
- 1:55 → Clear for transition

**Color grade:** Cinematic Dark + aggressive crop
```
crop=iw:iw*9/16:0:(ih-iw*9/16)/2   # crop to remove banners
eq=brightness=-0.08:contrast=1.4:saturation=1.2
vignette=PI/4
```

**Special treatment:** These frames need the most work — crop top/bottom to hide "Grupo Exito" banners, letterbox to 2.39:1 aspect ratio

---

### ACT 5: "FUEGO Y PASION" (2:00 - 2:30)

**Video content:** IVANN playing intensely, green/yellow lasers, dancers on the floor, cinematic light rays

**Page elements:**
- 2:00 → Section marker "03 — MUSICA" slides in
- 2:05 → Album covers appear (floating, semi-transparent):
  - Apocalypsis (2023) — with track list
  - Romantique (2020)
  - Piano & Fire (2018)
  - First Light (2015)
- 2:15 → Albums fade, Spotify/Apple Music player embed appears
- 2:25 → Player fades

**Color grade:** Teal & Orange (Hollywood blockbuster look) for laser shots
```
eq=brightness=-0.04:contrast=1.3:saturation=1.4
colorbalance=rs=0.1:gs=-0.05:bs=-0.2:rh=0.05:gh=0.05:bh=0.15
```

**Special:** Slow motion on laser moments (setpts=2*PTS on select frames)

---

### ACT 6: "EL CLIMAX" (2:30 - 3:00)

**Video content:** Dancers with red cape, golden light explosion (overexposed flash), cape flying, peak energy

**Page elements:**
- 2:30 → "VIVE LA EXPERIENCIA" large text
- 2:40 → The overexposed flash frame → screen goes white/gold briefly → transition effect
- 2:43 → After the flash: "Contrata el Show" CTA button appears (golden, glowing)
- 2:50 → Contact info appears: email, phone, social links

**Color grade:** Let the natural overexposure work FOR us — the flash becomes a designed transition
```
# Before flash: Crimson Noir
# Flash frame: boost even more, let it bloom
# After flash: fade back to Cinematic Dark
```

**Special effect:** The overexposed frame (2:43) is the HERO MOMENT — we lean into it as a designed "explosion of light" transition. Could add a CSS radial gradient overlay that pulses from the flash point.

---

### ACT 7: "LA RESOLUCION" (3:00 - 3:30)

**Video content:** Piano rojo close-up, IVANN playing focused, lasers, lights, calmer energy

**Page elements:**
- 3:00 → Section marker "04 — PRENSA & REDES"
- 3:05 → Press logos appear: Caracol Radio, RCN, El Pais, LA F.m.
- 3:10 → Social media links with follower counts
- 3:15 → Quote: "Mas de 200 shows han demostrado que cuando la musica clasica se encuentra con el espectaculo, sucede algo que no se puede describir."
- 3:25 → Everything fades

**Color grade:** Monochrome Gold — almost B&W with warm sepia undertone, reflective mood
```
eq=brightness=-0.06:contrast=1.5:saturation=0.15
colorbalance=rs=0.2:gs=0.1:bs=-0.1
vignette=PI/4
```

---

### ACT 8: "EL CIERRE" (3:30 - 4:06)

**Video content:** Stage from far away, lights dimming, night atmosphere. Returns to the same distant perspective as the beginning. Full circle.

**Page elements:**
- 3:30 → "IVANN AURA" large branding (same as opening but now with context)
- 3:40 → Footer content slides up: social links, booking info, location
- 3:50 → "Medellin — Bogota — El Mundo" location line
- 4:00 → Back-to-top button appears with "Volver al inicio"
- 4:06 → Final frame holds — ambient gold glow at bottom

**Color grade:** Gradual fade to dark — each frame slightly darker than the last
```
# Progressive darkening using curves
# Final frames approach pure black
eq=brightness=-0.2:contrast=1.2:saturation=0.5
```

---

## Technical Pipeline

### Phase 1: Video Processing (ffmpeg) — DONE

Single-pass re-encode with color grading, crop, and web optimization:

```bash
ffmpeg -y -i flamenco-de-esfera.mp4 \
  -vf "crop=1280:536,eq=brightness=-0.06:contrast=1.3:saturation=1.2,vignette=PI/4,scale=960:-2" \
  -c:v libx264 -preset slow -crf 30 \
  -g 15 -keyint_min 15 \
  -c:a aac -b:a 96k \
  -movflags +faststart \
  flamenco-graded.mp4
```

Key flags:
- `crop=1280:536` — letterbox 2.39:1, hides corporate banners
- `-g 15` — keyframe every 0.5s for instant scroll seeking
- `-movflags +faststart` — moov atom at file start for web streaming
- `scale=960:-2` — 960px wide, sufficient for web
- Result: **26MB** (down from 67MB source)

Note: Per-act color grading was attempted (8 separate encodes + concat) but corrupted the MP4 container. Currently using a single uniform grade. Per-act grading can be revisited by encoding the full video with segment-aware filtergraph instead of concat.

### Phase 2: Quality Enhancement (Google Colab) — PREPARED, NOT RUN

Pipeline in `docs/colab-upscale.py`:
1. **Real-ESRGAN** — upscale 720p → 1440p (2x)
2. **RIFE** — frame interpolation (doubles frame count)

### Phase 3: Overlay System — DONE

`ScrollStoryOverlay` component with:
- 20+ story beats mapped to 3fps-equivalent frame ranges
- Position system: center, left, right, bottom, top-left, bottom-left, bottom-right
- Animations: fade, slide-left, slide-up, slide-right (entry + exit)
- CSS `mix-blend-mode: difference` for text-on-video
- All content in Spanish

### Phase 4: Integration — DONE

`ScrollVideoPlayer` + `ScrollStoryOverlay` wired together:
- Scroll position → `video.currentTime`
- Video time → 3fps frame index → overlay triggers
- Video audio plays at 1x when scrolling forward, fades on pause
- Keyboard/click advances scroll (via `usePianoScroll` hook)
- Piano synthesizer disabled (video has original concert audio)

---

## Resources

- **Source video:** `public/videos/flamenco-de-esfera.mp4`
- **Storyboard frames:** `public/videos/storyboard/` (491 frames at 2fps)
- **Camera cuts:** `public/videos/cuts/` (33 detected scene changes)
- **Color grade demos:** `public/videos/demos/` (6 styles tested)
- **YouTube channel:** https://www.youtube.com/@IVANNSHOWPIANO (202 videos)
- **Current website:** https://www.ivann.com.co
- **Instagram:** @pianoshowivannoficial
- **Spotify:** https://open.spotify.com/album/3LJcUdZGtqlSq76kq6kmi3
- **Contact:** ivannprensa@gmail.com / 310 2254687

---

## Decisions Made

1. [x] **Frame approach** — switched from individual frame images (736 JPGs at 3fps) to scroll-driven HTML5 video (30fps native). Single MP4 file.
2. [x] **Audio** — using original concert audio from the video instead of Für Elise synthesizer. Audio plays when scrolling forward, fades when idle.
3. [x] **Crop strategy** — letterbox 2.39:1 (`crop=1280:536`) hides corporate banners and adds cinematic feel.
4. [x] **Video chosen** — "Flamenco de Esfera" from YouTube (best camera work, production quality).

## Decisions Pending

1. [ ] Per-act color grading (currently uniform — needs filtergraph approach, not concat)
2. [ ] Whether to use Real-ESRGAN upscale via Google Colab
3. [ ] Whether to add RIFE frame interpolation
4. [ ] Mobile behavior — smaller video? static images? different experience?
5. [ ] Final overlay text content review (Spanish copy)
6. [ ] Additional videos for variety (MOZART DANCE, LA PASSION, etc.)
7. [ ] Visual verification that overlay timing matches video content
8. [ ] Clean up obsolete files (frames/all/, old section components)
