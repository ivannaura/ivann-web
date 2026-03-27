# Auditoría Profunda — IVANN AURA Web

**Fecha:** 2026-03-26
**Alcance:** Documentación, lógica del código, bugs, accesibilidad, mobile, mejores prácticas de la industria

---

## 1. Estado General

| Métrica | Resultado |
|---------|-----------|
| `npm run build` | LIMPIO (0 errores) |
| TypeScript | 0 errores |
| Imports rotos | 0 |
| Documentación vs código | 100% alineada |
| Archivos muertos confirmados | 5 componentes + CSS |

---

## 2. Documentación

### Verificación CLAUDE.md ↔ Código

Cada afirmación de CLAUDE.md fue verificada contra el código fuente. **Todas coinciden exactamente:**

- Árbol de componentes: correcto
- Paths de archivos (9 componentes): correctos
- AudioMomentum constants (IMPULSE, FRICTION, MIN_RATE, MAX_RATE, MAX_VOLUME, DRIFT_THRESHOLD): correctos
- Vinyl inertia constants (EASE_FACTOR=0.1, MAX_SCRUB_SPEED=3.0): correctos
- Design tokens (10 colores CSS): correctos
- Story beats: exactamente 20
- Lenis config (lerp=0.1, duration=1.2): correcto
- Dead code listado: confirmado muerto

### Gaps menores de documentación

| Qué falta | Dónde debería estar |
|-----------|---------------------|
| `PLAY_THRESHOLD=0.05` y `STOP_THRESHOLD=0.02` | CLAUDE.md sección AudioMomentum |
| Tokens extras: `--aura-gold-bright`, `--aura-gold-dim`, `--particle-core`, `--border-subtle` | CLAUDE.md sección Design Tokens |
| Energy half-life (~766ms a 60fps, 46 frames con FRICTION=0.985) | CONVENTIONS.md sección Audio Momentum |

---

## 3. Bugs Confirmados

### 3.1 WCAG 2.1.4 — Keyboard Hijack (ALTA)

**Archivo:** `src/hooks/usePianoScroll.ts:22-28`

```ts
if (e.key.length !== 1) return; // Space (" ") tiene length 1 → pasa
```

**Problemas:**

1. **Doble scroll con Space:** Space nativo = page-down (~viewport height). Space + este handler = +80px extra. El usuario scrollea doble.
2. **Conflicto con screen readers:** NVDA usa `H` para headings, `K` para links, `T` para tablas. Todos tienen `key.length === 1` y son interceptados.
3. **Sin `preventDefault()`:** Los comportamientos nativos y custom se suman en vez de reemplazarse.
4. **Violación WCAG 2.1.4 (Nivel A):** Los atajos de tecla de un solo carácter deben poder desactivarse, remapearse, o activarse solo cuando un componente tiene foco.

**Referencia:** [WCAG 2.1.4 Character Key Shortcuts](https://www.digitala11y.com/understanding-sc-2-1-4-character-key-shortcuts/) — "If a keyboard shortcut is implemented using only letter, punctuation, number, or symbol characters, then at least one of the following is true: Turn off, Remap, or Active only on focus."

**Lo correcto:** Según la industria, los atajos de un solo carácter deben usar modifier keys (Ctrl, Alt) o activarse solo cuando el componente tiene foco. Gmail es el ejemplo canónico: la tecla `x` solo funciona dentro del grid de emails, no en toda la página.

**Fix recomendado:**
- Limitar a un whitelist de teclas (ej: solo letras a-z, excluyendo Space, números, puntuación)
- Agregar `e.preventDefault()` solo para las teclas que manejas
- Idealmente, solo activar cuando `[data-cinema]` tiene foco (requiere `tabIndex`)

---

### 3.2 Race Condition en audio.play() (MEDIA)

**Archivo:** `src/lib/audio-momentum.ts:117-125`

```ts
if (this.energy >= PLAY_THRESHOLD && !this.wasPlaying) {
    this.audio.play().then(() => { this.wasPlaying = true; });
}
```

**Problema:** Entre `.play()` (async) y `.then()`, `wasPlaying` sigue en `false`. El siguiente frame (16ms después) vuelve a llamar `.play()`. Chrome lanza `AbortError: The play() request was interrupted`.

**Referencia:** Este es un bug documentado extensamente en la comunidad web. [Howler.js](https://github.com/goldfire/howler.js/issues/1110), [video.js](https://github.com/videojs/video.js/issues/3446), y otros reproductores de audio implementan un flag `playPending` para evitarlo.

**Lo correcto:** Usar un flag de estado intermedio:

```ts
if (this.energy >= PLAY_THRESHOLD && !this.wasPlaying && !this.playPending) {
    this.playPending = true;
    this.audio.play()
        .then(() => { this.wasPlaying = true; this.playPending = false; })
        .catch(() => { this.playPending = false; });
}
```

---

### 3.3 currentTimeRef diverge del video real (MEDIA)

**Archivo:** `src/components/ui/ScrollVideoPlayer.tsx:164-171`

```ts
currentTimeRef.current = newTime;                    // ← sin clamp
const safeTime = clampToBuffered(video, newTime);    // ← clamped
video.currentTime = safeTime;                        // ← video usa safeTime
```

**Problema:** El ref guarda el tiempo "ideal" (sin clamp), pero el video reproduce el tiempo "seguro" (clamped al buffer). El audio se sincroniza contra `currentTimeRef` (vía `videoTimeGetter`), así que cuando el usuario scrollea más allá del buffer, el audio se sincroniza a una posición que el video no alcanzó.

**Lo correcto:** Actualizar el ref con el valor real:

```ts
currentTimeRef.current = safeTime; // siempre reflejar el tiempo REAL del video
```

---

### 3.4 Detección de sección #top falla al volver (MEDIA)

**Archivo:** `src/components/ui/Navigation.tsx:33-45`

```ts
document.querySelector("#top") // → null (no existe ese id en el DOM)
```

**Problema:** Cuando scrolleas hasta Contact, `activeSection` se pone en 1 (correcto). Pero al volver arriba, el loop no encuentra `#top` → nunca resetea a 0 → "Contacto" queda highlighteado.

**Fix recomendado:** Manejar `#top` como caso especial:

```ts
if (sections[0] === null) {
    // #top = scroll position 0
    if (window.scrollY < window.innerHeight * 0.3) {
        setActiveSection(0);
        break;
    }
}
```

---

### 3.5 Video fallback no resetea readyRef (MEDIA)

**Archivo:** `src/components/ui/ScrollVideoPlayer.tsx:76-84`

Cuando `videoSrc` cambia (por error del video principal), `readyRef.current` sigue en `true`. Los listeners de buffer dicen `if (readyRef.current) return;` inmediatamente. El nuevo video no pasa por verificación de buffer.

**Fix recomendado:** Key el componente por `videoSrc` en `page.tsx`:

```tsx
<ScrollVideoPlayer key={videoSrc} videoSrc={videoSrc} ... />
```

---

### 3.6 Dead zone al final del video (MEDIA)

**Archivo:** `src/components/ui/ScrollVideoPlayer.tsx:225`

```ts
scrollTargetRef.current = Math.max(0, Math.min(targetTime, durationRef.current - 0.05));
```

El `-0.05` impide que el video llegue a los últimos 50ms. En un video de 4:06 (246s), la última story beat (frame 720 = segundo 240) sí es alcanzable, pero cualquier contenido en los últimos 50ms no lo es.

**Fix recomendado:** Reducir a `- 0.01` o eliminar:

```ts
Math.min(targetTime, durationRef.current)
```

---

### 3.7 División por cero en story beats (MEDIA)

**Archivo:** `src/components/ui/ScrollStoryOverlay.tsx:533`

```ts
progress: (currentFrame - beat.frameStart) / (beat.frameEnd - beat.frameStart)
```

Si alguien define un beat con `frameStart === frameEnd`, el denominador es 0 → `Infinity` o `NaN` → crashes en las animaciones.

**Fix recomendado:**

```ts
const range = beat.frameEnd - beat.frameStart;
progress: range > 0 ? (currentFrame - beat.frameStart) / range : 1,
```

---

### 3.8 No hay impulso al scrollear hacia atrás (MEDIA)

**Archivo:** `src/components/ui/ScrollVideoPlayer.tsx:228-235`

```ts
if (scrollingForward) {
    momentumRef.current?.addImpulse();
}
```

El audio solo reacciona al scroll hacia adelante. Hacia atrás = silencio total.

**¿Es correcto?** Es una decisión de diseño. El referente del efecto de vinilo [web-audio-pitch-dropper](https://github.com/yuichkun/web-audio-pitch-dropper) solo simula desaceleración, no retroceso. Pero en el contexto de esta web, donde el usuario puede scrollear libremente en ambas direcciones, el silencio total al retroceder se siente como un bug.

**Recomendación:** Agregar impulso en ambas direcciones, o al menos documentar que es intencional.

---

## 4. Issues de Accesibilidad

### 4.1 Menú móvil sin ARIA (MEDIA)

**Archivo:** `src/components/ui/Navigation.tsx:242-273, 277-335`

- Hamburger: falta `aria-expanded={menuOpen}`
- Overlay: falta `role="dialog"` y `aria-modal="true"`
- No hay focus trap — Tab navega detrás del overlay

**Referencia:** [WebAIM Keyboard Accessibility](https://webaim.org/techniques/keyboard/) — "Custom controls must use standardized keystroke patterns. Modal dialogs must trap focus."

### 4.2 Botón de sonido sin funcionalidad (BAJA)

**Archivo:** `src/components/ui/Navigation.tsx:220-238`

Renderiza un icono de speaker pero no tiene `onClick`. Debería estar `disabled` o no renderizarse.

---

## 5. Issues de Plataforma (Mobile)

### 5.1 iOS Safari ignora preload="auto" (MEDIA)

**Archivo:** `src/components/ui/ScrollVideoPlayer.tsx:277`

iOS Safari en celular ignora `preload="auto"` y requiere interacción del usuario para empezar a cargar video. El Preloader mostraría 0% indefinidamente.

**Referencia:** [MDN Media Buffering](https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Audio_and_video_delivery/buffering_seeking_time_ranges) — iOS requires user gesture before media can load on cellular connections.

**Recomendación:** Detectar iOS y mostrar un botón "Toca para cargar" o usar `playsinline` con un gesto inicial.

### 5.2 Android: scroll-based video seeking es janky (MEDIA)

**Referencia:** [Muffin Man - Scrubbing Videos](https://muffinman.io/blog/scrubbing-videos-using-javascript/) — "Android devices struggle with native scroll-based video scrubbing."

El codec de Android re-sincroniza en cada cambio de `currentTime`, causando frame drops visibles. El all-keyframe encoding (`-g 1`) mitiga esto significativamente (ya implementado), pero en dispositivos lentos sigue habiendo stutter.

**Recomendación:** El encoding actual (`-g 1`) es la mejor práctica. Para Android viejos, considerar fallback a secuencia de imágenes (canvas-based, como el `ScrollFramePlayer` que ya existe como dead code).

### 5.3 Lenis no maneja cambio de orientación (MEDIA)

**Archivo:** `src/components/providers/SmoothScroll.tsx:12`

Al rotar un dispositivo (portrait ↔ landscape), el viewport cambia de tamaño. Lenis podría no recalcular los límites de scroll, causando que el scroll se pase del máximo.

---

## 6. Issues de Performance

### 6.1 rAF del cursor nunca para (BAJA)

**Archivo:** `src/components/ui/CustomCursor.tsx:34-43`

El ring del cursor anima a 60fps incluso cuando el mouse no se mueve. Gasta ~0.1% CPU innecesariamente.

**Lo correcto según la industria:** [CSS-Tricks rAF + React](https://css-tricks.com/using-requestanimationframe-with-react-hooks/) recomienda: "Use refs for animation metadata, empty dependency array for single init, and stop the loop when convergence is reached."

### 6.2 rAF de AudioMomentum sin pausa en background (BAJA)

**Archivo:** `src/lib/audio-momentum.ts:100-143`

Los browsers throttlean rAF en tabs de background (~1fps), así que el impacto es mínimo. Pero agregar un `visibilitychange` listener sería más limpio.

### 6.3 Preloader no refleja progreso real de video (BAJA)

**Archivo:** `src/components/ui/Preloader.tsx:11-47`

El Preloader anima a 100% en 1.8s independientemente del estado real del video. ScrollVideoPlayer tiene su propio indicador de buffer (correcto), pero el Preloader da una falsa sensación de "todo listo".

---

## 7. Dead Code (seguro eliminar)

### Componentes (5 archivos, ~740 líneas)

| Archivo | Líneas | Razón |
|---------|--------|-------|
| `src/components/ui/ScrollFramePlayer.tsx` | ~200 | Reemplazado por ScrollVideoPlayer |
| `src/components/sections/Hero.tsx` | ~150 | Reemplazado por ScrollStoryOverlay |
| `src/components/sections/Experience.tsx` | ~120 | Reemplazado por ScrollStoryOverlay |
| `src/components/sections/Music.tsx` | ~130 | Reemplazado por ScrollStoryOverlay |
| `src/components/sections/LiveShow.tsx` | ~140 | Reemplazado por ScrollStoryOverlay |

### Store fields muertos

`useUIStore.ts`: `scrollProgress` y `currentSection` están en el store pero Navigation usa estado local.

### CSS muerto

| Selector | Líneas en globals.css |
|----------|-----------------------|
| `.char-reveal .char` | 82-86 |
| `@keyframes shimmer` | 184-187 |
| `@keyframes spin-slow` | 189-192 |
| `.preloader`, `.preloader-bar`, `@keyframes preloader-fill` | 195-234 |

---

## 8. Efecto de Vinilo — Investigación

### ¿Cómo funciona el efecto de vinilo real?

Según [web-audio-pitch-dropper](https://github.com/yuichkun/web-audio-pitch-dropper), un simulador de turntable de referencia:

1. **Motor:** Un `AudioWorklet` processor mantiene una posición virtual de playback que avanza según la velocidad actual.
2. **Desaceleración:** Ease-out cúbico durante 3 segundos (`1 - Math.pow(1 - t, 3)`), simulando la inercia mecánica de un plato real.
3. **Interpolación de samples:** Interpola entre samples de audio para evitar artefactos durante cambios de velocidad.
4. **AudioParam automation:** Usa `AudioParam` para transiciones suaves de velocidad (sin glitches).

### ¿Cómo lo hace IVANN?

El sistema actual usa `HTMLMediaElement.playbackRate` + `preservesPitch = false`. Esto es más simple pero tiene limitaciones:

| Aspecto | web-audio-pitch-dropper (referencia) | IVANN (actual) |
|---------|---------------------------------------|----------------|
| Motor de audio | AudioWorklet (hilo de audio) | HTMLMediaElement (hilo principal) |
| Cambio de velocidad | AudioParam (glitch-free) | Asignación directa a `.playbackRate` |
| Interpolación | Sample-level | Browser handles it |
| Curva de decaimiento | Ease-out cúbico 3s | Friction exponencial (FRICTION=0.985) |
| Latencia | ~5ms (audio thread) | ~16ms (rAF en main thread) |

### Veredicto

**El enfoque de IVANN es válido y pragmático.** No necesita AudioWorklet porque:
- El audio es atmosférico (concierto), no requiere precisión de sample
- `preservesPitch = false` está soportado desde diciembre 2023 (baseline)
- El modelo de fricción exponencial (`energy *= 0.985`) produce una curva natural que es ligeramente diferente al ease-out cúbico pero igualmente convincente
- La implementación con `HTMLMediaElement` es mucho más simple de mantener

### Nota sobre `preservesPitch`

Según [MDN](https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/preservesPitch):
- Es propiedad estándar desde diciembre 2023
- **No necesita vendor prefixes** (las líneas 53-54 de `audio-momentum.ts` con `mozPreservesPitch` y `webkitPreservesPitch` son innecesarias en browsers modernos)

---

## 9. Scroll-Based Video — Investigación

### ¿Cuál es la forma correcta?

Según [Yoann Gueny](https://blog.yoanngueny.com/the-secrets-for-an-optimized-scroll-based-html5-video/) y [Muffin Man](https://muffinman.io/blog/scrubbing-videos-using-javascript/):

1. **Encoding:** Keyframes frecuentes. `-g 1` (all-intra) es ideal. `-g 10` es un buen compromiso.
2. **`+faststart`:** Obligatorio para web video.
3. **`readyState` check:** Verificar antes de asignar `currentTime`.
4. **Throttling:** No asignar `currentTime` en cada frame si el cambio es < 30ms (el browser no puede decodificar tan rápido).
5. **Buffer check:** Verificar `video.buffered` antes de seekear.
6. **Formato dual:** MP4 + WebM para compatibilidad (Firefox rinde mejor con WebM).

### ¿Qué hace IVANN?

| Práctica | Recomendado | IVANN | Estado |
|----------|-------------|-------|--------|
| All-keyframe encoding | `-g 1` o `-g 10` | `-g 1` | CORRECTO |
| `+faststart` | Sí | Sí | CORRECTO |
| readyState check | `>= 1` antes de seek | Buffer check al 15% | CORRECTO |
| Throttling seeks | < 30ms skip | `Math.abs(diff) > 0.03` | CORRECTO |
| Buffer clamping | Check `buffered` range | `clampToBuffered()` | CORRECTO |
| WebM fallback | Recomendado para Firefox | Solo MP4 | MEJORABLE |
| `-an` (strip audio) | Sí si audio separado | Sí | CORRECTO |
| `-bf 0` (no B-frames) | Sí para seeking | Sí | CORRECTO |

**Veredicto:** La implementación sigue todas las mejores prácticas de la industria excepto el formato dual MP4/WebM.

---

## 10. rAF en React — Investigación

### ¿Cuál es el patrón correcto?

Según [CSS-Tricks](https://css-tricks.com/using-requestanimationframe-with-react-hooks/):

1. Guardar el rAF ID en `useRef` (no en state)
2. Usar `useEffect` con `[]` para inicializar una sola vez
3. Cancelar en el cleanup del effect
4. Usar `setState(prev => ...)` para evitar stale closures
5. Guardar callbacks en refs si cambian frecuentemente

### ¿Qué hace IVANN?

| Patrón | Recomendado | IVANN | Estado |
|--------|-------------|-------|--------|
| rAF ID en ref | Sí | `rafRef`, `scrubRafRef` | CORRECTO |
| Cleanup en useEffect | Sí | `cancelAnimationFrame(...)` en return | CORRECTO |
| State en hot paths | Evitar | Usa refs, no state | CORRECTO |
| Stale closures | Callback refs | `onFrameChange` en deps del effect | FRAGIL |
| Visibility pause | `visibilitychange` listener | No implementado | MEJORABLE |

**Nota sobre stale closures:** `handleFrameChange` en `page.tsx` usa `useCallback([])` → identidad estable → el effect no se reinicia. Funciona, pero si alguien cambia el callback a no-memoized, el loop se rompe silenciosamente.

---

## 11. Resumen Priorizado

### Bugs para arreglar (por prioridad)

| # | Severidad | Issue | Archivo |
|---|-----------|-------|---------|
| 1 | **ALTA** | Keyboard hijack viola WCAG 2.1.4 | `usePianoScroll.ts` |
| 2 | **MEDIA** | audio.play() race condition | `audio-momentum.ts` |
| 3 | **MEDIA** | currentTimeRef diverge del video | `ScrollVideoPlayer.tsx` |
| 4 | **MEDIA** | Sección #top no detectada al volver | `Navigation.tsx` |
| 5 | **MEDIA** | readyRef no resetea en fallback | `ScrollVideoPlayer.tsx` |
| 6 | **MEDIA** | Dead zone 50ms al final del video | `ScrollVideoPlayer.tsx` |
| 7 | **MEDIA** | Division by zero en story beats | `ScrollStoryOverlay.tsx` |
| 8 | **MEDIA** | Sin impulso al scrollear atrás | `ScrollVideoPlayer.tsx` |
| 9 | **MEDIA** | iOS ignora preload="auto" | `ScrollVideoPlayer.tsx` |
| 10 | **MEDIA** | Menú móvil sin ARIA | `Navigation.tsx` |

### Cleanup

| # | Tipo | Qué |
|---|------|-----|
| 1 | Dead code | 5 componentes (~740 líneas) |
| 2 | Dead CSS | 4 bloques en globals.css |
| 3 | Dead store | 2 fields en useUIStore |
| 4 | Vendor prefixes | `mozPreservesPitch`, `webkitPreservesPitch` innecesarios |

### Documentación

| # | Qué | Dónde |
|---|-----|-------|
| 1 | Documentar PLAY/STOP thresholds | CLAUDE.md |
| 2 | Documentar tokens extra de CSS | CLAUDE.md |
| 3 | Documentar energy half-life | CONVENTIONS.md |
| 4 | Documentar gaps intencionales entre actos | ScrollStoryOverlay.tsx |

---

## Fuentes

- [WCAG 2.1.4 Character Key Shortcuts](https://www.digitala11y.com/understanding-sc-2-1-4-character-key-shortcuts/)
- [WebAIM Keyboard Accessibility](https://webaim.org/techniques/keyboard/)
- [Scroll Video Scrubbing - Muffin Man](https://muffinman.io/blog/scrubbing-videos-using-javascript/)
- [Optimized Scroll Video - Yoann Gueny](https://blog.yoanngueny.com/the-secrets-for-an-optimized-scroll-based-html5-video/)
- [Video Scrubbing Animations - Ghosh.dev](https://www.ghosh.dev/posts/playing-with-video-scrubbing-animations-on-the-web/)
- [Vinyl Turntable Simulator](https://github.com/yuichkun/web-audio-pitch-dropper)
- [MDN preservesPitch](https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/preservesPitch)
- [MDN playbackRate](https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/playbackRate)
- [MDN Media Buffering](https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Audio_and_video_delivery/buffering_seeking_time_ranges)
- [rAF + React Hooks - CSS-Tricks](https://css-tricks.com/using-requestanimationframe-with-react-hooks/)
- [Web Audio API Pitch Issues](https://github.com/WebAudio/web-audio-api/issues/2487)
