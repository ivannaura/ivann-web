# IVANN AURA — Visión Cinematográfica

> *"El scroll no es navegación. Es la respiración del espectador."*

---

## La Idea Central

Imagina que el usuario no está visitando una página web. Está sentado en la primera fila de un teatro oscuro. Las cortinas se abren. Un piano de cola brilla bajo un foco único. IVANN se sienta.

Cada milímetro que el usuario desplaza con su dedo o su trackpad es un instante de esa actuación. No hay prisa. No hay carga. El usuario es quien controla el tiempo — como una aguja sobre un disco de vinilo.

**El sitio no se "scrollea". Se vive.**

---

## El Disco de Vinilo

La metáfora central es un tocadiscos.

Cuando el usuario mueve el scroll hacia abajo, la aguja avanza sobre el surco. La música suena. Las imágenes se mueven. Todo responde a la velocidad de sus dedos.

Si el usuario se detiene, la aguja se levanta suavemente. La imagen se congela. El sonido se apaga con un fade natural — como cuando levantas la aguja de un disco real.

Si el usuario hace scroll rápido, la imagen acelera como cuando giras un vinilo con la mano: el tono sube, la imagen se distorsiona ligeramente, todo se siente *físico*.

Si el usuario hace scroll hacia atrás, el vinilo gira en reversa. La música suena al revés. Las imágenes retroceden. Es exactamente lo que esperarías de un disco real.

No hay botones de play/pause. No hay barras de progreso. **El dedo del usuario ES el control.**

---

## Los Cinco Sentidos de la Experiencia

### 1. Vista — El Cine en Cada Frame

El video no se reproduce como un video normal. Cada fotograma está codificado individualmente, como una película en celuloide. El navegador decodifica frame por frame y los pinta en un canvas, como un proyeccionista pasando la película a mano.

Esto permite algo que un `<video>` normal jamás podría: control absoluto. Buscar el fotograma exacto del milisegundo exacto sin esperar buffers, sin artefactos, sin saltos.

Sobre cada fotograma, el navegador aplica efectos cinematográficos en tiempo real a través de shaders GPU:

- **Bloom**: ese resplandor suave alrededor de las luces, como en una película de los 70s
- **Viñeteado**: los bordes se oscurecen, dirigiendo la mirada al centro
- **Aberración cromática**: una separación sutil de los canales rojo/azul en los bordes, como una lente real
- **Grano de película**: ruido orgánico que elimina la "perfección digital" y añade textura

Estos efectos no son filtros CSS estáticos. Son cálculos que corren en la GPU a 60fps, respondiendo dinámicamente al scroll: más bloom cuando la cámara se acerca al piano, más grano en las transiciones oscuras, más viñeteado en los momentos íntimos.

### 2. Oído — La Física del Vinilo

El audio no usa `<audio>` del navegador. Usa un procesador de audio de baja latencia (AudioWorklet) que manipula las muestras de sonido directamente, sample por sample, a 44,100 Hz.

Cuando el usuario hace scroll:
- La velocidad del scroll se traduce en velocidad de reproducción del audio
- A velocidad normal, la música suena perfecta
- Al acelerar, el tono sube naturalmente — como cuando aceleras un vinilo
- Al frenar, el tono baja — como cuando el tocadiscos pierde velocidad
- Al detenerse, el audio decae con la inercia de un disco que se para: la frecuencia baja gradualmente hasta el silencio

No hay pitch correction. No hay time-stretching. El cambio de tono ES el efecto. Es lo que hace que se sienta como un disco de verdad y no como un reproductor digital.

### 3. Tacto — La Inercia del Scroll

El scroll no es lineal. Tiene masa y fricción, como un objeto físico.

Cuando el usuario empuja el scroll, el contenido no se mueve instantáneamente al destino. Acelera, alcanza velocidad, y luego desacelera suavemente — como un disco de vinilo que sigues girando con el dedo y luego sueltas.

Esta inercia es controlada por un "director" (GSAP ScrollTrigger) que traduce la posición del scroll a la posición del video con un `scrub` suavizado. No es código manual con `requestAnimationFrame`. Es una orquesta dirigida.

El resultado: el usuario *siente* el peso del contenido. No es una página web. Es un objeto con masa.

### 4. Narrativa — Los Actos de un Concierto

La experiencia se divide en actos, como una sinfonía:

**Preludio** — La pantalla está en negro. Solo se escucha la resonancia lejana del piano. A medida que el usuario hace scroll, la oscuridad se disipa lentamente. Un foco se enciende.

**Primer Acto — El Despertar** — IVANN aparece. Sus manos se posan sobre las teclas. La primera nota resuena. El texto aparece como si se escribiera solo, sincronizado con la música. Cada palabra tiene peso.

**Segundo Acto — La Tormenta** — La intensidad crece. Los efectos visuales se intensifican: más bloom, más saturación. La cámara se acerca. Las manos vuelan sobre las teclas. El grano de película aumenta. El usuario siente la urgencia.

**Tercer Acto — El Silencio** — La calma después de la tormenta. Los efectos retroceden. La imagen se vuelve más limpia, más simple. IVANN se detiene. Respira. El usuario respira con él.

**Coda — La Invitación** — La experiencia culmina con una invitación: escuchar más, asistir a un concierto, entrar en el mundo de IVANN. No como un CTA agresivo, sino como el aplauso natural al final de una pieza.

### 5. Ambiente — Partículas y Luz

Flotando sobre toda la experiencia hay un sistema de partículas sutiles. No son decorativas — representan la música haciéndose visible:

- Cuando las notas son suaves, las partículas flotan lentamente como polvo en un rayo de luz
- Cuando la música se intensifica, las partículas se agitan, se multiplican, cambian de color
- En los silencios, se disipan lentamente

Estas partículas se renderizan en Three.js/WebGL, integradas con el canvas del video. No son un overlay HTML encima — son parte del mismo mundo visual.

---

## La Regla de Oro

**Todo lo que ocurre en la pantalla está atado al scroll.**

No hay animaciones automáticas que corran solas. No hay timers. No hay transiciones que "pasen" sin el usuario. Si el usuario deja de hacer scroll, todo se congela — video, audio, partículas, texto — como pausar un vinilo con el dedo.

El usuario no es un espectador pasivo. Es el director de tempo de su propia experiencia.

---

## ¿Por Qué No Un Video Normal?

Un video normal de YouTube o Vimeo es una experiencia pasiva: le das play y miras. No puedes explorar. No puedes detenerte en el instante exacto donde sus manos tocan la tecla. No puedes sentir el peso de la música a tu propio ritmo.

Lo que estamos construyendo es algo que un video no puede ser: **una experiencia interactiva donde la música, la imagen y la narrativa responden a tu cuerpo** — a la velocidad de tu dedo, a tu curiosidad, a tu deseo de detenerte o avanzar.

Es la diferencia entre mirar una foto de un paisaje y caminar por él.

---

## Referentes

- **Apple "Flow"**: Demostró que el scroll-video frame-a-frame puede ser imperceptible de una experiencia nativa. Usaron compresión inteligente de secuencias de frames para lograr peso liviano con calidad cinematográfica.
- **Kubrick, Terrence Malick**: La cinematografía no es lo que filmas — es lo que el espectador siente. Cada frame debe poder ser una fotografía.
- **Ryuichi Sakamoto "async"**: Un álbum donde el silencio es tan importante como el sonido. Los momentos vacíos de nuestra experiencia no son "espacio muerto" — son respiraciones intencionales.
- **Vinyl culture**: El resurgimiento del vinilo no es nostalgia — es el deseo de una relación física con la música. Nuestra interfaz captura esa relación.

---

## Lo Que NO Es

- **No es un portfolio con scroll bonito.** No estamos poniendo secciones con fade-in. Estamos construyendo una experiencia cinematográfica completa.
- **No es un music video interactivo.** No hay botones, no hay UI visible. El scroll es la única interfaz.
- **No es un demo técnico.** La tecnología es invisible. Si el usuario nota que "esto es impresionante técnicamente", fallamos. Debe sentir "esto es hermoso".
- **No es un sitio pesado.** La compresión inteligente, la carga progresiva y la decodificación eficiente hacen que la experiencia sea fluida incluso en conexiones moderadas.

---

## El Estándar

Cuando alguien visite el sitio de IVANN AURA, debe sentir que acaba de vivir un concierto privado. Que estuvo ahí. Que el piano sonó para ellos.

Y cuando cierre la pestaña, debe querer volver a abrirla.

---

*Este documento describe la visión. No el código. No la arquitectura. No los plazos. Solo la experiencia que queremos crear.*
