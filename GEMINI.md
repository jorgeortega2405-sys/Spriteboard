# Reglas de Desarrollo y Seguridad de Spriteboard (GEMINI.md)

Este archivo complementa a `AGENTS.md` y es cargado directamente por Antigravity / Gemini CLI para gobernar el comportamiento en este repositorio.

## Directivas Primarias

1. **CERO Exposición de Información Sensible**:
   - Nunca expongas stack traces, queries SQL, errores de base de datos o secretos de configuración al frontend en respuestas HTTP.
   - En caso de error, responde siempre con mensajes genéricos y amigables.
   - Registra todos los detalles técnicos exclusivamente en `Logger`.

2. **CERO `console.log`, `console.warn`, `console.error`**:
   - Todo log en backend debe usar `logger.app.*`, `logger.db.*` o `logger.security.*`.
   - En el frontend no deben existir llamadas `console.*`.

3. **CERO Atributos `id`**:
   - Usa exclusivamente `data-ref="..."` para identificar elementos.
   - En JavaScript usa `querySelector('[data-ref="..."]')`.

4. **Orden de Atributos**:
   - `<button type="..." class="..." data-ref="...">` (type primero).
   - En los demás elementos: `<div class="..." data-ref="...">` (class primero).

5. **Ubicación de Banners de Error**:
   - Colocar los banners de error debajo de los botones de acción del formulario.

6. **Imports Horizontales y Alfabéticos**:
   - Escribir cada `import` en una sola línea horizontal.
   - Ordenar las declaraciones alfabéticamente por ruta de módulo, y los miembros `{ ... }` alfabéticamente.

7. **CERO Anotaciones y Comentarios Explicativos**:
   - Prohibido JSDoc, PHPDoc, bloques decorativos y comentarios inline de código obvio. Código 100% auto-documentado.

8. **Estructura Estándar de Controladores / Vistas JS**:
   - Seguir el ciclo de vida: `init()` (con `AbortController`), `bindEvents()` y `destroy()`.

9. **Frontend TypeScript (`client/`) y Compilación Vite**:
   - Todo el código cliente se escribe en TypeScript estricto dentro de `client/` (vistas, componentes, servicios, tipos, utilidades).
   - Los archivos estáticos en tiempo de ejecución (`views/`, `translations/`, `css/`, `uploads/`) residen en `public/`.
   - En desarrollo, Vite corre como middleware Express (`npm run dev`). En producción, Vite compila a `dist/client/` (`npm run build:client`).
   - La verificación de tipos estricta se ejecuta con `npm run typecheck`.

Consulta las especificaciones completas en [docs/AI_INSTRUCTIONS.md](file:///f:/Spriteboard/docs/AI_INSTRUCTIONS.md) y [AGENTS.md](file:///f:/Spriteboard/AGENTS.md).

