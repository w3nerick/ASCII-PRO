# Arquitectura

## Pipeline de render (`src/engine/engine.ts`)

Cada frame recorre estos pases, todos en WebGL2 con texturas RGBA8 y un triángulo a pantalla completa:

1. **Pre-ajuste** (`PRE_FRAG`) — muestrea la fuente aplicando recorte, rotación y volteo (`srcUV`),
   luces (foco en el cursor o puntos fijos) y color: exposición, brillo, contraste, temperatura, filtro de
   foto, tono, saturación, vibrance, tinte con modo de fusión, gradient map, escala de grises e invertir.
2. **Desenfoque global** — gaussiano separable (`BLUR1D_FRAG`) o variable (`BLUR2D_FRAG`: lente,
   tilt-shift, direccional, radial, zoom, cristalino, perspectiva, progresivo).
3. **Capas de estilo** — ping-pong entre dos targets. Cada estilo es un programa generado por
   `buildStyleFrag()`: cabecera común + uniforms automáticos por parámetro + `vec4 effect(vec2 uv)`.
   El `main()` generado mezcla el resultado con la entrada según opacidad y modo de fusión de la capa.
   - Estilos con *backdrop* reciben una versión desenfocada de su entrada (`u_back`, media resolución).
   - Estilos de caracteres usan un atlas (`glyphAtlas.ts`) muestreado con `textureGrad` para que los
     mipmaps no generen costuras entre celdas.
   - Estilos *feedback* (Datamosh) leen el frame anterior (`u_prev`).
4. **Post FX** (`POST_FRAG`) — un único pase con 18 efectos; Bloom y Character Bloom usan un pase de
   brillo + gaussiano a media resolución.
5. **Composición final** (`FINAL_FRAG`) — máscara pintada (alfa, con difuminado), capa de texto, comparador
   antes/después y salida al canvas o a un framebuffer de exportación.

### Resolución independiente

Todo parámetro en píxeles se expresa en **píxeles de diseño** (lado largo 1280). El shader multiplica por
`u_k = px de render / px de diseño` con `PX()`. Así la vista previa (ajustada a la pantalla × DPR) y la
exportación a 4× se ven idénticas.

### Compilación

Los programas se crean al usarse por primera vez. Con `KHR_parallel_shader_compile` el motor no bloquea:
mientras un estilo compila se sigue mostrando el frame anterior (`engine.pending`).

## Estado (`src/state`)

- `store.ts` — store externo con `useSyncExternalStore`. El **documento** (`look`, capa activa, recorte,
  transformación, textos) tiene historial; los cambios del mismo control en < 700 ms se agrupan.
  La **UI** (pestañas, zoom, herramienta, modales) no entra al historial.
- `renderer.ts` — un único canvas de salida compartido por Studio y Flow, loop con `requestAnimationFrame`
  que solo dibuja cuando algo cambia (o hay animación / video), miniaturas y exportaciones.
- `source.ts` — imagen (`createImageBitmap`), video, webcam, generadores Lumen animados y fotos de muestra.
- `recipes.ts` — una receta es el `look` reducido a las diferencias con los valores por defecto,
  comprimido con `deflate-raw` y en base64url (`#r=…`).

## Miniaturas

`ThumbService` usa un segundo contexto WebGL pequeño. Renderiza cada estilo con sus valores por defecto
sobre una copia estática de la fuente actual (o la foto de muestra), una a la vez, y guarda JPEG en caché.
Solo se piden las miniaturas visibles (`IntersectionObserver`).

## Exportación

- Imágenes: el motor redimensiona sus targets al tamaño pedido, renderiza a un framebuffer y lee los
  píxeles (`renderPixels`).
- GIF: frames deterministas (tiempo fijo por frame) → `lib/gifEncoder.ts` (LZW + median-cut + dither).
- Video: `canvas.captureStream()` + `MediaRecorder` (MP4 si el navegador lo soporta, si no WebM).
- TXT / HTML: lee la imagen pre-ajustada a baja resolución y mapea luminancia → caracteres.

## Pruebas

- `npm run check` valida el registro sin GPU.
- `dev-shaders.html` compila y dibuja los 100 estilos en una hoja de contacto (necesita el servidor de desarrollo).
- En desarrollo, `window.__ap` expone store, fuentes, renderer y acciones para automatizar pruebas.
