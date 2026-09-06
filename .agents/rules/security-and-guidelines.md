---
trigger: always_on
---

# Reglas de Seguridad y Estándares de Spriteboard

- **Seguridad**: Prohibido exponer información sensible (stack traces, errores de BD, queries, tokens internos, variables de entorno) al frontend. Usa respuestas HTTP genéricas y registra todo en `Logger`.
- **Logging**: Prohibido usar `console.log`, `console.warn`, `console.error` (Excepción única: `client/services/websocket.service.ts` para depuración WebSocket). En backend usa `logger.app`, `logger.db` o `logger.security`.
- **Cero IDs**: Prohibido usar `id="..."`. Usa exclusivamente `data-ref="..."`.
- **Orden de atributos**: En `<button>` va `type` primero. En otros elementos va `class` primero.
- **Banners de error**: Ubicados debajo de los botones de acción en formularios.
- **Imports JS/TS**: En una sola línea horizontal compacta, ordenados alfabéticamente por módulo y miembros internos en `{ ... }`.
- **Cero Anotaciones**: Prohibido JSDoc, PHPDoc, bloques decorativos y comentarios inline de código evidente.
- **Arquitectura JS**: Controladores con ciclo de vida `init()`, `bindEvents()`, `destroy()` y `AbortController`.
- **Referencia**: Consulta `docs/AI_INSTRUCTIONS.md` y `AGENTS.md`.

