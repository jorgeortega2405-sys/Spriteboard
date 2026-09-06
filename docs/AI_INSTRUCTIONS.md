# Instrucciones de Desarrollo para Inteligencia Artificial - Spriteboard (docs/AI_INSTRUCTIONS.md)

Este documento define las reglas de codificación obligatorias, restricciones arquitectónicas y estándares de diseño que **TODAS** las Inteligencias Artificiales y desarrolladores deben acatar en el repositorio de Spriteboard.

---

## 1. Reglas Estrictas de Imports en JavaScript y TypeScript

1. **Escritura Horizontal Compacta**:
   - Cada declaración `import` debe escribirse en **una sola línea horizontal**, sin saltos de línea verticales entre llaves `{ ... }`, independientemente de la cantidad de elementos importados.
2. **Orden Alfabético de Módulos (Rutas)**:
   - Los bloques de `import` al inicio del archivo deben ordenarse **estrictamente de forma alfabética** según la ruta o nombre del módulo origen (`'../app-router.js'`, `'../components/layout.component.js'`, `'../services/api.service.js'`, etc.).
3. **Orden Alfabético de Miembros Importados**:
   - Los elementos nombrados dentro de las llaves `{ ... }` deben listarse en **orden alfabético estricto**.

```javascript
import { navigate } from '../app-router.js';
import { createSidebar } from '../components/layout.component.js';
import { open2FAModal, openModal } from '../components/modal.component.js';
import { clearUserState, currentUser, getApi, postApi, setCurrentUser } from '../services/api.service.js';
import { getCurrentLanguage, setLanguage, t, translateElement } from '../services/i18n.service.js';
import { showToast } from '../services/toast.service.js';
import { debounce, setupDropdown, setupPasswordToggle, withButtonLoading } from '../utils/dom.util.js';
import { AVAILABLE_LANGUAGES, detectBrowserLanguage, getLanguageName } from '../utils/languages.util.js';
import { validatePassword } from '../utils/validators.util.js';
```

---

## 2. Prohibición Total de Anotaciones y Comentarios Explicativos (Cero Anotaciones)

1. **Código 100% Auto-documentado**:
   - Queda estrictamente prohibido incluir anotaciones de tipo JSDoc (`/** @param ... */`), PHPDoc o metadatos de funciones/parámetros.
   - Queda prohibido incluir bloques de cabecera decorativos (ej. `/* ================== 1. GESTION DE ESTADO ================== */`).
   - Queda prohibido incluir comentarios inline que expliquen lo que hace el código evidente o resúmenes de cambios/historiales de edición.
2. **Excepción Única**: Comentarios regulatorios o de configuración externa indispensables que no admitan otra alternativa.

---

## 3. Estructura Estándar de Archivos JavaScript (Vistas y Controladores SPA)

Todos los módulos de vista o controladores JavaScript basados en clases o funciones de inicialización deben seguir esta secuencia estructural exacta:

1. **Imports**: Horizontales y ordenados alfabéticamente por ruta y miembro.
2. **Constantes y Estado Encapsulado**: Variables constantes a nivel de módulo o claves de almacenamiento local.
3. **Definición de Clase / Controlador**:
   - **Constructor**:
     - Instanciación de servicios y controladores de aborto (`this.abortController = null;`).
     - Vinculación de manejadores de eventos almacenados como propiedades (`this._boundClick = this.handleClick.bind(this);`).
     - Inicialización de propiedades de estado reactivo.
   - **Ciclo de Vida (`init`, `bindEvents`, `destroy`)**:
     - `init()`: Obtiene el contenedor (`document.querySelector('[data-ref="..."]')`), inicializa `AbortController`, ejecuta `bindEvents()` y carga datos iniciales.
     - `bindEvents()`: Asocia event listeners utilizando las referencias vinculadas (`this._boundClick`) delimitadas al contenedor.
     - `destroy()`: Cancela peticiones pendientes (`this.abortController.abort()`), limpia intervalos/temporizadores y remueve todos los event listeners.
   - **Manejadores de Eventos**:
     - Métodos como `handleClick(e)`, `handleSubmit(e)`, etc. que delegan acciones según atributos `data-action="..."`.
   - **Métodos Privados / Auxiliares**:
     - Lógica de negocio y llamadas al backend (prefijadas con `_` o métodos internos de clase).
4. **Exportaciones**: Exportación de la clase o funciones al final del archivo.

### Plantilla de Referencia de Controlador JS:

```javascript
import { navigate } from '../app-router.js';
import { openModal } from '../components/modal.component.js';
import { getApi, postApi } from '../services/api.service.js';
import { t } from '../services/i18n.service.js';
import { showToast } from '../services/toast.service.js';
import { withButtonLoading } from '../utils/dom.util.js';

class SettingsController {
  constructor() {
    this.container = null;
    this.abortController = null;
    this._boundClick = this.handleClick.bind(this);
    this._boundSubmit = this.handleSubmit.bind(this);
  }

  async init() {
    this.container = document.querySelector('[data-ref="settings-view"]');
    this.abortController = new AbortController();
    this.bindEvents();
    await this._loadUserData();
  }

  bindEvents() {
    if (this.container) {
      this.container.addEventListener('click', this._boundClick);
      this.container.addEventListener('submit', this._boundSubmit);
    }
  }

  destroy() {
    if (this.abortController) {
      this.abortController.abort();
    }
    if (this.container) {
      this.container.removeEventListener('click', this._boundClick);
      this.container.removeEventListener('submit', this._boundSubmit);
    }
  }

  handleClick(e) {
    const actionBtn = e.target.closest('[data-action]');
    if (!actionBtn) return;
    const action = actionBtn.getAttribute('data-action');
    if (action === 'open-security') {
      navigate('/settings/security');
    }
  }

  async handleSubmit(e) {
    e.preventDefault();
    const submitBtn = this.container.querySelector('[data-ref="btn-save"]');
    await withButtonLoading(submitBtn, async () => {
      await this._saveChanges();
    });
  }

  async _loadUserData() {
    const res = await getApi('/api/settings/profile', { signal: this.abortController.signal });
    if (res && res.success) {
      this._renderProfile(res.data);
    }
  }

  async _saveChanges() {
    const res = await postApi('/api/settings/profile', { signal: this.abortController.signal });
    if (res && res.success) {
      showToast(t('settings.profile_saved'), 'success');
    }
  }

  _renderProfile(data) {
    const usernameEl = this.container.querySelector('[data-ref="profile-username"]');
    if (usernameEl) {
      usernameEl.textContent = data.username;
    }
  }
}

export { SettingsController };
```

---

## 4. Regla de Oro de Seguridad: CERO Exposición de Información Sensible al Frontend

1. **Respuestas HTTP Seguras**:
   - **NUNCA** envíes mensajes de error técnicos, consultas SQL, comandos Cassandra, comandos Redis, trazas de depuración (stack traces), rutas de archivos del servidor ni detalles de excepciones internas en las respuestas HTTP hacia el frontend.
   - En caso de excepción o error inesperado (código 500, 400, etc.), envía siempre un mensaje genérico, amigable y seguro para el usuario final (ej. `"Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde."`).
   - Toda información técnica sensible debe registrarse **exclusivamente** en el servicio de logging centralizado (`Logger`).
2. **Protección de Datos y Secretos**:
   - **NUNCA** incluyas en respuestas al cliente credenciales, hashes de contraseñas (`password_hash`), tokens secretos internos, variables de entorno (`.env`) o claves privadas.
   - Sanitizar siempre los objetos de usuario antes de enviarlos (únicamente `id`, `username`, `email`, `avatar_url`).

---

## 5. Prohibición Total de `console.log`, `console.warn`, `console.error`

1. **Cero `console.*` en Código**:
   - Queda estrictamente prohibido utilizar `console.log`, `console.warn`, `console.error`, `console.info` o `console.debug` tanto en el backend (`src/`) como en el frontend (`public/js/`).
2. **Uso Obligatorio de `Logger`**:
   - En el backend, todos los registros deben realizarse a través del servicio centralizado `Logger` (`src/services/logger.service.ts`).
   - Categorías disponibles:
     - `logger.app`: Ciclo de vida general de la aplicación, inicio del servidor, rutas y peticiones.
     - `logger.db`: Conexiones y consultas a bases de datos (MySQL, Cassandra, Redis).
     - `logger.security`: Intentos de autenticación, fallos CSRF, validación de códigos de verificación y accesos restringidos.
   - El logger sanitiza automáticamente campos sensibles como `password`, `token`, `secret`, `cookie`, etc.

---

## 6. Reglas Estrictas de HTML y DOM (CERO IDs)

1. **Prohibido el uso de `id`**:
   - **NUNCA** agregues atributos `id="..."` a ningún elemento HTML.
   - **NUNCA** utilices `document.getElementById(...)` en JavaScript.
   - Para identificar elementos o vincular componentes con JavaScript, utiliza exclusivamente atributos de datos semánticos: `data-ref="..."` (ej. `data-ref="btn-submit-login"`).
   - En JavaScript, selecciona elementos usando `querySelector('[data-ref="..."]')` o `querySelectorAll(...)`.
2. **Campos de Formulario Flotantes**:
   - Para inputs y etiquetas, envuelve el `<input>` dentro de `<label class="field" data-ref="...">`. Esto vincula el campo de forma nativa e inclusiva sin requerir atributos `id` ni `for`.

---

## 7. Orden Estricto de Atributos en HTML

1. **Para botones (`<button>`)**:
   - El atributo `type` **debe ser siempre el primero**, seguido de `class`, luego `data-ref` (o `data-*`), y finalmente los demás atributos (`data-tooltip`, `aria-label`, etc.).
   ```html
   <button type="button" class="btn btn--h55 btn--black btn--w-full" data-ref="btn-submit-stage1">
   <button type="button" class="field__action" data-ref="btn-random-username" data-tooltip="Generar nombre aleatorio" aria-label="Generar nombre aleatorio">
   ```
2. **Para cualquier otro elemento (`<div>`, `<a>`, `<label>`, `<input>`, `<span>`, etc.)**:
   - El atributo `class` **debe ser siempre el primero**, seguido de `data-ref` (o `data-*`), y luego los demás atributos (`type`, `placeholder`, `href`, etc.).
   ```html
   <div class="menu-panel menu-panel--w-285 menu-panel--h-full" data-ref="main-menu">
   <input class="field__input field__input--has-action" data-ref="register-username" type="text" placeholder=" " autocomplete="username" />
   <a class="link" data-ref="btn-forgot-password" href="/forgot-password">
   ```

---

## 8. Cero Divs Neutros / Sin Clase (Zero Neutral Divs)

1. **Prohibido el uso de elementos sin clase**:
   - **NUNCA** crees elementos genéricos vacíos sin clases de estilo (ej. `<div></div>` o `<span></span>` sin clase).
   - Todo elemento en el DOM debe contar con clases semánticas BEM de componente o layout (ej. `.view-content`, `.component-card`, `.field`, `.form-actions`).

---

## 9. Cero `<input type="hidden">` (Uso de Atributos `data-*`)

1. **Eliminar inputs ocultos**:
   - Evita el uso de `<input type="hidden">`.
   - Utiliza atributos de datos semánticos como `data-value="..."` o `data-id="..."` en el contenedor o botón disparador correspondiente, y léelos mediante `element.dataset`.

---

## 10. Ubicación de Banners de Error y Notificaciones en Formularios

1. **Posicionamiento Estricto**:
   - Los banners de error (`<div class="banner banner--danger" data-ref="...-error">`) deben ubicarse **siempre debajo de los botones de acción** del formulario (nunca en la parte superior).

---

## 11. Cero Estilos en Línea (Zero Inline Styles)

1. **Regla General**:
   - No utilizar atributos `style="..."` estáticos en HTML ni en elementos inyectados dinámicamente. Todo diseño debe basarse en clases CSS.
2. **Excepciones Permitidas**:
   - **Temas y Colores Dinámicos de Usuario**: Valores calculados en tiempo de ejecución (colores de insignias personalizados, avatares dinámicos, bordes de suscripción).
   - **Plantillas de Correo Electrónico**: Archivos HTML de emails donde el CSS en línea es mandatorio para compatibilidad de clientes.
   - **Cálculos Geométricos Dinámicos en Tiempo Real**: Cálculos de posición de Canvas/Viewport o Tooltips que no puedan resolverse con CSS.

---

## 12. Cero Textos Hardcodeados e Internacionalización (i18n)

1. **Traducción Obligatoria**:
   - Todo texto visible para el usuario (etiquetas, alertas, modales, toasts, placeholders) debe obtenerse mediante el servicio de traducción (`t('clave')`).
2. **Idioma de Logs del Backend**:
   - Los registros internos de `Logger`, excepciones del servidor y herramientas auxiliares deben redactarse en **inglés**.

---

## 13. Cero Fallbacks (Fail Fast)

1. **Sin Fallbacks de Traducción**:
   - No escribir `t('key') || 'Texto'`. Si la clave de traducción no existe, es un error de configuración que debe subsanarse en el catálogo de traducciones.
2. **Sin Fallbacks de Variables de Entorno**:
   - No escribir `process.env.KEY || 'default'`. El sistema debe fallar de inmediato si falta una variable de entorno crítica para evitar encubrir fallas de despliegue.

---

## 14. Centralización de Peticiones HTTP (`api.service.js`)

1. **Uso Exclusivo de `api.service.js`**:
   - Todas las llamadas HTTP hacia la API deben realizarse mediante las funciones centralizadas de `api.service.js` (`getApi`, `postApi`, `postFormApi`, `deleteApi`).
   - Queda prohibido el uso directo de `fetch()` o `XMLHttpRequest` para endpoints de la API, asegurando la inyección automática de tokens CSRF, sincronización de estado de sesión y tratamiento unificado de errores.

---

## 15. Gestión de Modales

1. **Uso Exclusivo de `modal.component.js`**:
   - Nunca modifiques manualmente estilos de visualización del DOM (ej. `modal.style.display = 'block'`).
   - Utiliza siempre `openModal(...)`, `open2FAModal(...)` o `closeModal(...)` provistos por `modal.component.js`.
