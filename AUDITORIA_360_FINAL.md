# INFORME CONSOLIDADO: AUDITORÍA TÉCNICA 360° - SPRITEBOARD

**Fecha de Ejecución:** Octubre 2026  
**Objetivo:** Auditoría integral exhaustiva del repositorio Spriteboard para identificar inconsistencias, problemas de persistencia, facturación/pagos, suscripciones, permisos (PBAC), funciones del lienzo (canvas), código spaghetti, principio de única fuente de verdad (SSOT), elementos de UI nativos prohibidos y vulnerabilidades de arquitectura.  
**Metodología:** Análisis modular por etapas, preservación de hallazgos en reportes de fase, comprobación contra falsos positivos y consolidación unificada con evidencias de código.

---

## ÍNDICE DE SECCIONES
1. [Resumen Ejecutivo y Matriz de Severidad](#1-resumen-ejecutivo-y-matriz-de-severidad)
2. [Control de Acceso, PBAC, Roles y Suscripciones](#2-control-de-acceso-pbac-roles-y-suscripciones)
3. [Pagos, Stripe y Facturación](#3-pagos-stripe-y-facturacion)
4. [Persistencia, Bases de Datos y Almacenamiento](#4-persistencia-bases-de-datos-y-almacenamiento)
5. [Lienzos, Canvas Engine, Sincronización y WebSocket](#5-lienzos-canvas-engine-sincronizacion-y-websocket)
6. [UI, DOM, Diálogos Nativos y Componentes](#6-ui-dom-dialogos-nativos-y-componentes)
7. [Arquitectura, Código Spaghetti, Seguridad y Estándares](#7-arquitectura-codigo-spaghetti-seguridad-y-estandares)
8. [Verificación de Falsos Positivos Descartados](#8-verificacion-de-falsos-positivos-descartados)
9. [Plan de Remediación Priorizado](#9-plan-de-remediacion-priorizado)

---

## 1. RESUMEN EJECUTIVO Y MATRIZ DE SEVERIDAD

| ID | Hallazgo Principal | Componente | Severidad | Impacto |
|---|---|---|---|---|
| **PBAC-01** | `getUserEffectivePermissions` omite `subscriptionTier` si no se envía por parámetro | Backend (`permission.service.ts`) | **CRÍTICA** | Clientes Business/Pro bloqueados en creación de equipos y kits de marca |
| **PBAC-02** | Autorización por nombres de planes en listas de strings (en vez de permisos activos) | Frontend (`teams.view.ts`, `board.controller.ts`) | **ALTA** | Violación de PBAC; fragilidad con planes en español/inglés |
| **PBAC-03** | Sesiones en Redis no recalculan `permissions` tras compras o cancelaciones | Backend (`auth.service.ts`, `auth.middleware.ts`) | **CRÍTICA** | Usuario no adquiere capacidades pagadas hasta que su sesión de Redis expire |
| **PBAC-04** | Bypass de permisos mediante chequeo directo de roles (`DESIGNER`, `SUPER_ADMIN`) | Backend (`element.controller.ts`) | **ALTA** | Violación de la Regla de Oro PBAC (roles como agrupadores) |
| **STRIPE-01** | Ausencia de idempotencia por `event.id` y desfase temporal en webhooks | Backend (`stripe.service.ts`) | **ALTA** | Evento `updated` desfasado puede reactivar una suscripción cancelada |
| **PERSIST-01** | Fuga permanente de snapshots, miniaturas y multimedia al borrar cuenta de usuario | Backend (`user.service.ts`) | **CRÍTICA** | Fuga de almacenamiento (storage leak perpetuo en S3/disco) |
| **PERSIST-02** | Falta de transaccionalidad atómica entre S3 y MySQL en `createCanvas` | Backend (`canvas.service.ts`) | **MEDIA** | Blobs huérfanos en S3 si falla el INSERT en base de datos |
| **CANVAS-01** | Fuga masiva de más de 120 event listeners por omisión de `signal` en `BoardController` | Frontend (`board.controller.ts`) | **CRÍTICA** | Memory leak severo; atajos de teclado y puntero zombis activos tras salir del lienzo |
| **CANVAS-02** | Antipatrón God Class monolítico (8,368 líneas en `BoardController`) | Frontend (`board.controller.ts`) | **ALTA** | Alto acoplamiento (>100 campos privados mutables) y fragilidad extrema |
| **CANVAS-03** | Duplicidad de datos y falta de SSOT en JSON de proyecto (`elements` vs `pages.elements`) | Frontend (`board.controller.ts`) | **MEDIA** | Riesgo de desincronización de elementos entre páginas y guardado |
| **CANVAS-04** | Corrupción de caracteres (Mojibake UTF-8) en presets de texto | Frontend (`elements.manager.ts`) | **BAJA** | Textos mostrados al usuario con caracteres dañados (`tÃ­tulo`) |
| **UI-01** | Migración incompleta de `<select>`: lectura ciega de `HTMLSelectElement` inexistente | Frontend (`create-canvas-modal.component.ts`) | **ALTA** | Selector de unidad roto; el lienzo siempre se crea en `px` ignorando `cm`/`in`/`mm` |
| **UI-02** | Uso de diálogos nativos del navegador (`window.confirm`, `window.prompt`) | Frontend (`canvas-metrics-modal`, `doc`, `sheet`, `teams`) | **ALTA** | Bloqueo del hilo UI, falta de modales propios y textos sin traducir |
| **UI-03** | Manipulación directa del DOM en modales (`backdrop.style.display = 'flex'/'none'`) | Frontend (`video-timeline.manager.ts`, `video-export.service.ts`) | **MEDIA** | Violación de la Regla 15 (`modal.component.ts`) |
| **UI-04** | Más de 450 violaciones de la regla de Cero Fallbacks (`t(...) || 'default'`) | Frontend (Múltiples vistas y componentes) | **MEDIA** | Enmascara fallos de configuración en catálogo de traducciones |
| **ARCH-01** | Bypass de `api.service.js` con llamadas directas a `fetch` hacia endpoints `/api` | Frontend (`upload-element-modal`, `auth.view.ts`) | **ALTA** | Peticiones sin protección de token CSRF automático |
| **ARCH-02** | Bypass de `env.config.ts` y credenciales por defecto hardcodeadas en código fuente | Backend (`database.config.ts`, `env.config.ts`) | **ALTA** | Credenciales `sprite_password` y API keys de sandbox en repositorio |

---

## 2. CONTROL DE ACCESO, PBAC, ROLES Y SUSCRIPCIONES

### 2.1 [CRÍTICO] Bug de Pérdida de Permisos de Suscripción en `getUserEffectivePermissions`
- **Archivo afectado:** [src/services/permission.service.ts:76-154](file:///f:/Spriteboard/src/services/permission.service.ts#L76-L154)
- **Archivos invocadores con fallo:** [team.service.ts:24](file:///f:/Spriteboard/src/services/team.service.ts#L24), [brand.service.ts:200](file:///f:/Spriteboard/src/services/brand.service.ts#L200), [user.service.ts:321](file:///f:/Spriteboard/src/services/user.service.ts#L321).
- **Evidencia del fallo en `src/services/team.service.ts:19-28`:**
  ```typescript
  const [uRows] = await pool.query<mysql.RowDataPacket[]>(
    'SELECT subscription_tier FROM users WHERE id = ? LIMIT 1',
    [ownerId]
  );
  const userTier = uRows[0]?.subscription_tier || 'free';
  const effectivePermissions = await getUserEffectivePermissions(ownerId); // <-- SE LLAMA SIN userTier!

  if (!hasSubscriptionFeature(effectivePermissions, 'teams') && !hasPermission(effectivePermissions, 'teams:manage')) {
    throw new Error('La creación de equipos de trabajo es exclusiva del plan Spriteboard Negocios.');
  }
  ```
- **Causa Raíz:** `getUserEffectivePermissions(userId, role?, roles?, subscriptionTier?, subscriptionStatus?)` declara `subscriptionTier` como parámetro opcional. Si no se le proporciona, la función **no ejecuta ninguna consulta** a la tabla `users` para obtener el tier del usuario. En consecuencia, la resolución de permisos de suscripción:
  ```typescript
  const subPerms = getSubscriptionActivePermissions(subscriptionTier, subscriptionStatus);
  ```
  recibe `undefined`, otorgando únicamente los permisos del plan gratuito.
- **Impacto:** Los clientes que pagan por el plan Business o Enterprise sufren un bloqueo total al intentar crear equipos o acceder a funciones de su plan en backend, recibiendo un error 400/403.

---

### 2.2 [CRÍTICO] Desactualización de Permisos en Sesiones Activas de Redis tras Pagos
- **Archivos afectados:** [src/services/auth.service.ts:514-549](file:///f:/Spriteboard/src/services/auth.service.ts#L514-L549) y [src/middlewares/auth.middleware.ts:55-63](file:///f:/Spriteboard/src/middlewares/auth.middleware.ts#L55-L63).
- **Evidencia en `auth.service.ts:528-531`:**
  ```typescript
  const parsed = JSON.parse(dataStr);
  parsed.subscription_tier = tier; // <-- SOLO MODIFICA EL STRING DE TIER
  await redis.setex(sessionKey, SESSION_TTL_SECONDS, JSON.stringify(parsed));
  ```
- **Evidencia en `auth.middleware.ts:55-63`:**
  ```typescript
  if (!user.permissions || user.permissions.length === 0) {
    user.permissions = await getUserEffectivePermissions(...);
  }
  ```
- **Causa Raíz:** Al cambiar el tier (vía Stripe Webhook), el backend actualiza la propiedad `subscription_tier` en la sesión de Redis, pero **deja intacto el array `parsed.permissions`**. En cada petición subsecuente, `auth.middleware.ts` encuentra que `user.permissions.length > 0` (los permisos del plan free previo) y omite la llamada a `getUserEffectivePermissions`.
- **Impacto:** Hasta que la sesión de Redis expire o el usuario cierre sesión manualmente, el cliente no recibe las nuevas capacidades por las que acaba de pagar (o conserva acceso tras una cancelación).

---

### 2.3 [ALTA] Chequeos Directos de Roles Hardcodeados (Violación Regla PBAC 10.1 y 16.1)
- **Archivo afectado:** [src/controllers/element.controller.ts:103-110](file:///f:/Spriteboard/src/controllers/element.controller.ts#L103-L110)
- **Evidencia:**
  ```typescript
  const canPublish = hasPermission(userPermissions, 'elements:publish') ||
    hasPermission(userPermissions, 'elements:create') ||
    hasPermission(userPermissions, 'elements:manage_all') ||
    hasPermission(userPermissions, 'designer:dashboard') ||
    userRoles.includes('DESIGNER') ||
    userRoles.includes('SUPER_ADMIN') ||
    userRoles.includes('PLATFORM_ADMIN');
  ```
- **Problema:** Se viola la regla maestra que prohíbe evaluar roles directamente. Los roles son meros contenedores de permisos en la base de datos (`role_permissions`). La validación debe sustentarse exclusivamente en permisos del módulo (`elements:publish`, `elements:official_publish`).
- **Otras instancias:** [auth.controller.ts:809](file:///f:/Spriteboard/src/controllers/auth.controller.ts#L809) y [user.service.ts:322](file:///f:/Spriteboard/src/services/user.service.ts#L322) con `user.roles?.includes('SYSTEM_ACCOUNT')`.

---

### 2.4 [ALTA] Chequeos Directos de Nombres de Suscripción (Violación Regla PBAC 10.2 y 16.2)
- **Archivos afectados:**
  - [client/views/teams.view.ts:356](file:///f:/Spriteboard/client/views/teams.view.ts#L356):
    `const canCreateTeams = ['business', 'negocios', 'enterprise', 'empresas'].includes(userTier) || userPermissions.includes('subscription:feature:teams');`
  - [client/views/board/board.controller.ts:2996-2998](file:///f:/Spriteboard/client/views/board/board.controller.ts#L2996-L2998):
    `const isProOrBusiness = ['pro', 'business', 'ultra', 'plus', 'enterprise'].includes(userTier);`
  - [client/views/stage/stage.controller.ts:2908](file:///f:/Spriteboard/client/views/stage/stage.controller.ts#L2908): mismo patrón.
  - [client/types/auth.types.ts:160-161](file:///f:/Spriteboard/client/types/auth.types.ts#L160-L161):
    `return tier === 'pro' || tier === 'business' || tier === 'enterprise';`
- **Problema:** Comparaciones contra listas arbitrarias de cadenas de texto de planes en español e inglés, vulnerables a desincronizaciones de catálogo. Deben migrarse a `hasSubscriptionFeature(user.permissions, 'teams')` y `hasSubscriptionFeature(user.permissions, 'ai_bg_removal')`.

---

## 3. PAGOS, STRIPE Y FACTURACIÓN

### 3.1 [ALTA] Falta de Idempotencia y Desfase Temporal en Manejo de Webhooks
- **Archivo afectado:** [src/services/stripe.service.ts:122-154](file:///f:/Spriteboard/src/services/stripe.service.ts#L122-L154).
- **Problema:** En el despachador de eventos `handleWebhookEvent`:
  - Los eventos `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_succeeded` y `invoice.payment_failed` se procesan directamente sin validar un lock o registro de idempotencia contra `event.id`.
  - No se almacena ni se compara la marca temporal `event.created`. Si la red entrega con retardo un evento antiguo `subscription.updated` después de un evento `subscription.deleted`, el estado de la suscripción se revertirá erróneamente de 'canceled' a 'active'.
- **Solución requerida:** Almacenar `event.id` procesados en Redis con TTL de 24 horas (`SET webhook:processed:<event.id> 1 EX 86400 NX`) e ignorar actualizaciones cuya fecha sea anterior a la última registrada en el usuario.

---

## 4. PERSISTENCIA, BASES DE DATOS Y ALMACENAMIENTO

### 4.1 [CRÍTICO] Fuga Permanente de Almacenamiento en Borrado de Cuenta (`deleteAccount`)
- **Archivo afectado:** [src/services/user.service.ts:356-388](file:///f:/Spriteboard/src/services/user.service.ts#L356-L388).
- **Evidencia del código:**
  ```typescript
  for (const c of canvases) {
    try {
      await redis.del(`canvas:snapshot:${c.uuid}`);
      await redis.del(`canvas:meta:${c.uuid}`);
      await deleteCanvasBlob(c.uuid);
    } catch {}
  }
  await canvasPool.execute('DELETE FROM canvas_members WHERE user_id = ?', [userId]);
  await canvasPool.execute('DELETE FROM canvases WHERE user_id = ?', [userId]);
  ```
- **Problema:** `deleteCanvasBlob(c.uuid)` borra únicamente el archivo principal del lienzo. **Se omiten por completo:**
  1. `deleteCanvasAllSnapshotsBlobs(c.uuid)`: Todos los blobs de historial y snapshots en S3 quedan abandonados.
  2. `deleteCanvasThumbnail(c.uuid)`: Miniaturas generadas quedan en disco/S3.
  3. Multimedia cargada en `public/uploads/` o buckets S3 (imágenes, fuentes, videos de usuario).
  4. Avatar y banner del usuario en almacenamiento.
- **Impacto:** Pérdida permanente de control del almacenamiento, ocupando espacio indefinido y acumulando costes sin punteros en base de datos para eliminarlos posteriormente.

---

### 4.2 [MEDIA] Inserción no Atómica entre S3 y MySQL en `createCanvas`
- **Archivo afectado:** [src/services/canvas.service.ts:225-310](file:///f:/Spriteboard/src/services/canvas.service.ts#L225-L310).
- **Problema:** El blob se almacena primero en S3 (`saveCanvasBlob(uuid, dataStr)`). Si la posterior ejecución SQL (`canvasPool.execute(query, [...])`) falla por sobrecarga del pool de conexiones o desconexión, el blob de S3 no se elimina en un bloque `catch` de compensación. Además, la inserción secundaria en `canvas_teams` se efectúa sin transacción; si falla, el lienzo se crea pero desvinculado del equipo.

---

### 4.3 [MEDIA] Acoplamiento Físico por Joins Cross-Database Directos
- **Archivos afectados:** [src/services/canvas-comment.service.ts:34-35](file:///f:/Spriteboard/src/services/canvas-comment.service.ts#L34-L35), [src/services/canvas-snapshot.service.ts](file:///f:/Spriteboard/src/services/canvas-snapshot.service.ts).
- **Problema:** Consultas que unen explícitamente esquemas cruzados:
  `FROM db_canvas.canvas_comments cc LEFT JOIN db_identity.users u ON u.id = cc.user_id`
  Esto asume que ambas bases de datos residen en la misma instancia y host de MySQL, impidiendo particionar o escalar independientemente los esquemas en el futuro.

---

## 5. LIENZOS, CANVAS ENGINE, SINCRONIZACIÓN Y WEBSOCKET

### 5.1 [CRÍTICO] Fuga Masiva de más de 120 Event Listeners en `BoardController`
- **Archivo afectado:** [client/views/board/board.controller.ts](file:///f:/Spriteboard/client/views/board/board.controller.ts).
- **Problema:** Aunque la clase define `this.abortController = new AbortController();` y un método `destroy()` que invoca `this.abortController.abort()`, **más de 120 llamadas a `addEventListener`** carecen del argumento `{ signal: this.abortController.signal }`.
- **Eventos filtrados en `window` y `document`:**
  - Eventos de teclado globales: `keydown`, `keyup` (los atajos de edición del lienzo siguen reaccionando en otras páginas de la aplicación).
  - Eventos de mouse y puntero sobre el lienzo: `pointerdown`, `pointermove`, `pointerup`, `pointerleave`, `wheel`, `dblclick`, `contextmenu`, `dragover`, `dragleave`, `drop`.
- **Impacto:** Memory Leak masivo y degradación progresiva de la CPU al abrir y cerrar lienzos en la SPA. Múltiples controladores zombis coexisten compitiendo por eventos globales del navegador.

---

### 5.2 [ALTA] Antipatrón "God Class" Monolítico
- **Archivos:**
  - [board.controller.ts](file:///f:/Spriteboard/client/views/board/board.controller.ts): **8,368 líneas**.
  - [doc.controller.ts](file:///f:/Spriteboard/client/views/doc/doc.controller.ts): **3,700+ líneas**.
  - [stage.controller.ts](file:///f:/Spriteboard/client/views/stage/stage.controller.ts): **3,500+ líneas**.
- **Problema:** Falta de división de responsabilidades. `BoardController` maneja simultáneamente renderizado 2D/3D WebGL, interacciones de puntero, atajos de teclado, cálculo de gizmos, persistencia local, sync WebSocket, modales, toolbars y popovers, manteniendo más de 100 campos privados de estado mutable acoplados.

---

### 5.3 [MEDIA] Duplicidad de Datos y Ruptura de SSOT en el Guardado de Proyectos
- **Archivo afectado:** [client/views/board/board.controller.ts:6911-6920](file:///f:/Spriteboard/client/views/board/board.controller.ts#L6911-L6920).
- **Problema:** `BoardProject` serializa a la vez `elements: this.elements` (elementos de la página actual) y `pages: this.pages` (donde cada página contiene a su vez su propio array de `elements`). Al coexistir dos copias de los elementos en el mismo JSON, se vulnera la única fuente de verdad, causando que clientes o servicios lean versiones divergentes.

---

### 5.4 [BAJA] Corrupción de Caracteres (Mojibake UTF-8) en Presets de Texto
- **Archivo afectado:** [client/engine-2d/elements.manager.ts:24, 32](file:///f:/Spriteboard/client/engine-2d/elements.manager.ts#L24-L32).
- **Problema:** Cadena corrupta: `text: 'Agregar un tÃ­tulo'` y `text: 'Agregar un subtÃ­tulo'`. Debe corregirse a `'Agregar un título'` y `'Agregar un subtítulo'` o internacionalizarse con `t(...)`.

---

## 6. UI, DOM, DIÁLOGOS NATIVOS Y COMPONENTES

### 6.1 [ALTA] Bug Crítico por Migración Incompleta de `<select>` a Dropdown Custom
- **Archivo afectado:** [client/components/create-canvas-modal.component.ts:1446-1452](file:///f:/Spriteboard/client/components/create-canvas-modal.component.ts#L1446-L1452).
- **Evidencia del fallo en el handler:**
  ```typescript
  const selectCustomUnit = backdrop.querySelector<HTMLSelectElement>('[data-ref="select-custom-unit"]');
  const unit = selectCustomUnit?.value || 'px';
  ```
- **Evidencia en la plantilla HTML (líneas 160-175):**
  La UI ya no tiene ningún `<select>`, sino un dropdown personalizado:
  `[data-ref="dropdown-wrapper-custom-unit"]` con botones `data-value="px|in|mm|cm"`.
- **Consecuencia Funcional:** `selectCustomUnit` es **siempre `null`**. Por lo tanto, `unit` se evalúa siempre como `'px'`. Si el usuario selecciona pulgadas (`in`), centímetros (`cm`) o milímetros (`mm`), el sistema ignora su elección y crea el lienzo en píxeles.

---

### 6.2 [ALTA] Uso de Diálogos Nativos Bloqueantes (`window.confirm`, `window.prompt`)
- **Problema:** Congelan la renderización gráfica del navegador, rompen la identidad de diseño de Spriteboard y carecen de localización i18n.
- **Ocurrencias detectadas:**
  - `window.confirm`: [canvas-metrics-modal.component.ts:778](file:///f:/Spriteboard/client/components/canvas-metrics-modal.component.ts#L778), [doc.controller.ts:2840](file:///f:/Spriteboard/client/views/doc/doc.controller.ts#L2840), [teams.view.ts:531](file:///f:/Spriteboard/client/views/teams.view.ts#L531), [sheet.controller.ts:762](file:///f:/Spriteboard/client/views/sheet/sheet.controller.ts#L762).
  - `window.prompt`: [canvas-metrics-modal.component.ts:839, 843](file:///f:/Spriteboard/client/components/canvas-metrics-modal.component.ts#L839), [doc.controller.ts:760, 1167, 1707, 2540, 3607](file:///f:/Spriteboard/client/views/doc/doc.controller.ts#L760), [board.controller.ts:4870](file:///f:/Spriteboard/client/views/board/board.controller.ts#L4870), [sheet.controller.ts:748](file:///f:/Spriteboard/client/views/sheet/sheet.controller.ts#L748).

---

### 6.3 [MEDIA] Manipulación Manual de Modales (Violación Regla 15)
- **Archivos afectados:** [client/views/video/video-timeline.manager.ts:1583-1968](file:///f:/Spriteboard/client/views/video/video-timeline.manager.ts) y [client/views/video/video-export.service.ts:81-92](file:///f:/Spriteboard/client/views/video/video-export.service.ts).
- **Problema:** Modificación directa de `backdrop.style.display = 'flex'` y `backdrop.style.display = 'none'` en lugar de delegar el ciclo de vida a `openModal()` y `closeModal()` de `modal.component.ts`.

---

### 6.4 [MEDIA] Incumplimiento Masivo de la Regla de Cero Fallbacks en i18n (Regla 13.1)
- **Archivos afectados:** `profile.view.ts`, `upgrade.view.ts`, `teams.view.ts`, `your-apps.view.ts`, `global-dropzone.service.ts`, `app-main.ts`.
- **Problema:** Más de **450 instancias** de `t('clave') || 'Texto hardcodeado'`. Si una clave no existe, debe advertirse en el catálogo i18n conforme al principio Fail Fast en vez de enmascararse.

---

## 7. ARQUITECTURA, CÓDIGO SPAGHETTI, SEGURIDAD Y ESTÁNDARES

### 7.1 [ALTA] Peticiones HTTP Directas sin Inyección CSRF (Violación Regla 14)
- **Instancias detectadas:**
  1. [client/components/upload-element-modal.component.ts:219](file:///f:/Spriteboard/client/components/upload-element-modal.component.ts#L219):
     Usa `fetch(API_ROUTES.designer.uploadElement, { method: 'POST', body: formData })` sin `postFormApi`.
  2. [client/views/auth.view.ts:842](file:///f:/Spriteboard/client/views/auth.view.ts#L842):
     Usa `fetch(API_ROUTES.auth.resetPasswordValidate(token))` sin `getApi`.

---

### 7.2 [ALTA] Credenciales por Defecto Hardcodeadas y Bypass de Configuración
- **Archivo afectado:** [src/config/database.config.ts:56-60](file:///f:/Spriteboard/src/config/database.config.ts#L56-L60).
- **Problema:** `database.config.ts` lee directamente de `process.env` con fallbacks:
  `user: process.env.DB_USER || 'sprite_user'`, `password: process.env.DB_PASSWORD || 'sprite_password'`, `host: process.env.DB_HOST || 'mysql'`.
  En lugar de consumir la configuración validada de `env.config.ts`.
- **Archivo afectado:** [src/config/env.config.ts:66](file:///f:/Spriteboard/src/config/env.config.ts#L66):
  Clave de API de sandbox de Photoroom hardcodeada en el archivo.

---

### 7.3 [BAJA] Desorden Alfabético en Miembros de Importación (Regla 1.3)
- **Instancias detectadas:**
  - `client/components/create-canvas-modal.component.ts`: `import { CreateCanvasOptions, createAndOpenCanvas }` (debe ser `createAndOpenCanvas, CreateCanvasOptions`).
  - `client/views/stage/stage.controller.ts` y `board.controller.ts`: miembros desordenados alfabéticamente.

---

## 8. VERIFICACIÓN DE FALSOS POSITIVOS DESCARTADOS

Durante la auditoría se verificaron rigurosamente los siguientes aspectos para evitar reportar falsos problemas:

1. **¿Carece `BoardController` de método `destroy()`?**
   - **Resultado:** **FALSO POSITIVO inicial descartado.** Inicialmente ripgrep falló en indexar la función debido al tamaño del archivo (331 KB). Tras inspección de código directa en [L460-519](file:///f:/Spriteboard/client/views/board/board.controller.ts#L460-L519), se comprobó que `public destroy(): void` sí existe. El **problema real** radica en que sus más de 120 event listeners no tienen `{ signal }`, haciendo que el método no limpie los listeners del DOM.
2. **¿Los atributos `id="..."` en archivos SVG son una violación de la Regla de Cero IDs?**
   - **Resultado:** **DESCARTADO.** Las etiquetas `<symbol id="...">` y `<linearGradient id="...">` en `public/icons.svg` y plantillas vectoriales no son identificadores de manipulación DOM, sino enlaces internos exigidos por el estándar SVG para referencias `url(#id)`. Las plantillas HTML cumplen al 100% con la prohibición de `id` para elementos interactivos.
3. **¿Las llamadas `console.*` en `websocket.service.ts` son un defecto?**
   - **Resultado:** **DESCARTADO.** La Regla Maestra 2 define a `client/services/websocket.service.ts` como la **única excepción explícitamente permitida** en todo el proyecto para depuración en tiempo real del socket. En el resto del frontend y backend no existen llamadas `console.*`.
4. **¿Los mensajes de error HTTP en los controladores backend exponen stack traces?**
   - **Resultado:** **DESCARTADO.** Todos los controladores auditados en `src/controllers/` atrapan las excepciones internas, registran los detalles técnicos en `Logger` y responden al cliente con mensajes amigables y genéricos (`sendInternalError`).

---

## 9. PLAN DE REMEDIACIÓN PRIORIZADO

### Prioridad 1: Crítica e Inmediata (Bugs funcionales y de seguridad)
1. **Corregir `getUserEffectivePermissions`:**
   Si `subscriptionTier` no se suministra como argumento, consultar automáticamente `subscription_tier` y `subscription_status` de la tabla `users` en `db_identity`.
2. **Actualizar `updateUserSubscriptionInSessions`:**
   Al actualizar la suscripción de un usuario, recalcular sus permisos efectivos invocando `getUserEffectivePermissions` y persistir el array resultante en `parsed.permissions` de las sesiones de Redis.
3. **Saneamiento en `deleteAccount`:**
   Añadir las llamadas a `deleteCanvasAllSnapshotsBlobs(c.uuid)`, `deleteCanvasThumbnail(c.uuid)` y borrado de archivos multimedia del usuario en S3/disco.
4. **Corrección de Event Listeners en `BoardController`:**
   Vincular todos los listeners de eventos (`pointer*`, `window.resize`, `keydown`, `keyup`, `drag*`, etc.) pasando `{ signal: this.abortController.signal }` para garantizar su destrucción inmediata.
5. **Corrección del selector de unidad en `create-canvas-modal.component.ts`:**
   Sustituir la consulta a `HTMLSelectElement` por la lectura del estado del componente dropdown custom `[data-ref="dropdown-wrapper-custom-unit"]` / `[data-ref="custom-unit-selected-text"]`.

### Prioridad 2: Alta (PBAC y Reglas de Arquitectura)
1. **Reemplazar comprobaciones directas de roles y tiers:**
   - En `element.controller.ts`: eliminar `userRoles.includes('DESIGNER'|'SUPER_ADMIN')` y autorizar exclusivamente por `hasPermission(userPermissions, 'elements:publish')`.
   - En `teams.view.ts`, `board.controller.ts`, `stage.controller.ts`: reemplazar comprobaciones de arrays de tiers por `hasSubscriptionFeature(userPermissions, 'teams')` y `hasSubscriptionFeature(userPermissions, 'ai_bg_removal')`.
2. **Reemplazar diálogos nativos (`confirm`, `prompt`):**
   Implementar modales personalizados ligeros reutilizables en `modal.component.ts` para reemplazo de `prompt()` y `confirm()`.
3. **Migrar `fetch` directos a `api.service.ts`:**
   Usar `postFormApi` en `upload-element-modal.component.ts` y `getApi` en `auth.view.ts`.

### Prioridad 3: Media y Deuda Técnica
1. **Depuración de fallbacks `t(...) || 'default'`:**
   Eliminar fallbacks y asegurar que todas las cadenas requeridas residan en `public/translations/`.
2. **Modularización de `BoardController`:**
   Desacoplar la gestión de herramientas, eventos de teclado y menús en submódulos especializados para reducir el archivo de 8,368 líneas.
3. **Unificación de configuración de base de datos:**
   Migrar `database.config.ts` para que consuma las variables validadas desde `env.config.ts` y eliminar contraseñas por defecto en código fuente.
