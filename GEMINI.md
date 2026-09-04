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

Consulta el documento completo en [AGENTS.md](file:///f:/Spriteboard/AGENTS.md) para más detalles.
