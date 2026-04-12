# Portal Polish + Momentum Cap + Autoplay
## Documento de Diseno
## Fecha: 12 de abril de 2026
## Estado: APROBADO

---

## A. SVG Premium (6 mejoras)

### A1. Golden Ratio para posiciones de nodos

Reemplazar coordenadas manuales con distribucion Fibonacci.
El nodo central (El Concierto) queda en el centro exacto.
Los otros 4 se distribuyen con angulo dorado (137.5 grados) a distancias Fibonacci.

```
angulo = i * 137.5 grados
distancia = sqrt(i) * escala
x = 50 + distancia * cos(angulo)
y = 50 + distancia * sin(angulo)
```

Con jitter aleatorio sutil (+/-3%) para que no se vea "perfecto computado".

### A2. Curvas Catmull-Rom en las lineas

Reemplazar `<line>` rectas por `<path>` con curvas que pasan organicamente por los nodos.
Conversion Catmull-Rom -> Bezier cubico para compatibilidad SVG.
Las lineas se sienten como hilos de energia, no como reglas.

### A3. Glows premium (3 capas)

Cada nodo tiene 3 circulos de glow a diferentes radios y opacidades:
- Capa interna: r=2, blur=4, opacity=0.4
- Capa media: r=4, blur=8, opacity=0.2
- Capa externa: r=8, blur=12, opacity=0.08

Colores: MAS saturados que el nodo base (no menos).
Blend: `mix-blend-mode: screen` para efecto aditivo (HDR-like).

Importante: los glows son ESTATICOS (no animados frame a frame) para no matar performance en movil. Solo la opacidad cambia con proximidad.

### A4. Fondo procedural — nebulosa Canvas 2D

Detras del SVG, un Canvas 2D renderiza:
- Noise Perlin/simplex muy sutil en tonos dorado-oscuro
- Puntos de luz que parpadean lento (estrellas de fondo adicionales)
- Gradiente radial suave desde el centro (donde esta El Concierto)
- Todo a ~15fps (no necesita 60fps, es decorativo)
- Respeta reduced-motion (estatico si activado)

### A5. feTurbulence en lineas SVG

Las lineas de constelacion llevan un filtro SVG sutil:
```xml
<filter id="energy-line">
  <feTurbulence type="fractalNoise" baseFrequency="0.03" numOctaves="2" seed="0"/>
  <feDisplacementMap in="SourceGraphic" scale="1.5"/>
</filter>
```
Esto hace que las lineas "vibren" como si llevaran energia. El `seed` se puede animar lento (cada ~2 segundos) para variacion.
Solo en desktop (movil lo omite para performance).

### A6. Fix responsive — coordenadas JS

Reemplazar `viewBox="0 0 100 100" preserveAspectRatio="none"` por:
- SVG sin viewBox, tamanio 100% del viewport
- Coordenadas calculadas en JS al montar y en resize
- Conversion: porcentaje (0-100) del MENOR de los dos ejes para mantener proporciones
- Un circulo siempre es un circulo, nunca un ovalo
- `ResizeObserver` para recalculo (no window resize event)

---

## B. Momentum Cap

### B1. Hard cap con elastic damping

En `audio-momentum.ts`:
```
ENERGY_CAP = 0.6       // maximo confortable
ENERGY_SOFTCAP = 0.65  // margen de overshoot

Si energy > SOFTCAP:
  energy = CAP + (energy - CAP) * 0.85  // decae 15% por frame
```

### B2. Piso minimo activo

```
ENERGY_MIN_ACTIVE = 0.08

Si wasPlaying && energy > 0 && energy < MIN_ACTIVE:
  energy = MIN_ACTIVE  // mantiene el vinilo "vivo" 2-3 seg mas
```

### B3. Cap en usePianoScroll

Misma logica: `MAX_ENERGY` baja de 1.0 a 0.6. El impulse se clampea para que no pase el cap.

---

## C. Autoplay + Timeline

### C1. Boton de autoplay

En Navigation (o esquina inferior), un boton pequeno:
- Icono: triangulo (play) / dos barras (pause)
- Estilo: dorado sutil, `magnetic-btn`, mismo tamano que el mute toggle
- Al activar: la pagina scrollea sola a velocidad constante

### C2. Comportamiento del autoplay

- Velocidad: ~0.4% de progreso por segundo (2.5 min para todo el video)
- Usa Lenis `scrollTo()` con `immediate: true` para avanzar sin lag
- El AudioMomentum recibe la velocidad del autoplay como si fuera scroll real
- Si el usuario scrollea manualmente: autoplay se pausa automaticamente
- Si el usuario suelta: autoplay reanuda despues de 2 segundos de inactividad

### C3. Timeline scrubber

Barra horizontal fina en la parte inferior de la pantalla:
- Aparece cuando autoplay esta activo O cuando el usuario hace hover en la zona inferior (desktop)
- En movil: siempre visible durante autoplay, oculta en modo manual
- Un punto dorado indica la posicion actual
- El usuario puede arrastrar para saltar a cualquier momento
- Arrastrar pausa el autoplay; soltar lo reanuda
- La barra muestra el progreso del video (0-100%)
- Estilo: linea de 2px dorada con punto de 8px, fondo semi-transparente

### C4. Integracion con ScrollVideoPlayer

El autoplay no bypasea ScrollTrigger — simplemente mueve el scroll de Lenis, y ScrollTrigger lo detecta normalmente. Esto significa que TODO funciona igual (video, audio, story beats, act transitions) sin cambios en el pipeline existente.
