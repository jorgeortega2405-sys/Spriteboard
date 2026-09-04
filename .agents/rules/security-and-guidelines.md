---
trigger: always_on
---

# Reglas de Seguridad y Estándares de Spriteboard

- **Seguridad**: Prohibido exponer información sensible (stack traces, errores de BD, queries, tokens internos, variables de entorno) al frontend. Usa respuestas HTTP genéricas y registra todo en `Logger`.
- **Logging**: Prohibido usar `console.log`, `console.warn`, `console.error`. Usa `logger.app`, `logger.db` o `logger.security`.
- **Cero IDs**: Prohibido usar `id="..."`. Usa exclusivamente `data-ref="..."`.
- **Orden de atributos**: En `<button>` va `type` primero. En otros elementos va `class` primero.
- **Banners de error**: Ubicados debajo de los botones de acción en formularios.
