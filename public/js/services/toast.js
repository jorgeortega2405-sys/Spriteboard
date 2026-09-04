/**
 * Servicio Centralizado de Notificaciones Toast de Spriteboard
 * - CERO IDs (utiliza exclusivamente data-ref)
 * - CERO llamadas a console.*
 * - Animaciones suaves con soporte para preferencia de alertas extendidas
 */

let userPreferences = {
  extended_alerts: false,
};

export function setToastPreferences(prefs) {
  if (prefs && typeof prefs === 'object') {
    userPreferences = { ...userPreferences, ...prefs };
  }
}

/**
 * Muestra una notificación toast emergente
 * @param {string} message - Mensaje a mostrar
 * @param {'success'|'error'|'warning'|'info'} [type='success'] - Tipo de toast
 * @param {number|null} [customDuration=null] - Duración personalizada en ms
 * @returns {() => void} Función para cerrar el toast manualmente
 */
export function showToast(message, type = 'success', customDuration = null) {
  if (!message) return () => {};

  let container = document.querySelector('[data-ref="toast-container"]');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    container.setAttribute('data-ref', 'toast-container');
    document.body.appendChild(container);
  }

  const toastEl = document.createElement('div');
  toastEl.className = `toast-item toast-item--${type}`;
  toastEl.setAttribute('data-ref', 'toast-item');

  let iconName = 'check_circle';
  if (type === 'error' || type === 'danger') {
    iconName = 'error';
  } else if (type === 'warning') {
    iconName = 'warning';
  } else if (type === 'info') {
    iconName = 'info';
  }

  toastEl.innerHTML = `
    <div class="toast-item__icon" data-ref="toast-icon">
      <span class="material-symbols-rounded">${iconName}</span>
    </div>
    <div class="toast-item__text" data-ref="toast-text">${message}</div>
  `;

  container.appendChild(toastEl);
  requestAnimationFrame(() => toastEl.classList.add('is-active'));

  const duration = customDuration !== null
    ? customDuration
    : (userPreferences.extended_alerts ? 8000 : 4000);

  let isDismissed = false;
  const dismiss = () => {
    if (isDismissed) return;
    isDismissed = true;
    toastEl.classList.remove('is-active');
    setTimeout(() => {
      toastEl.remove();
      if (container && container.childNodes.length === 0 && container.parentNode) {
        container.remove();
      }
    }, 280);
  };

  toastEl.addEventListener('click', dismiss);
  setTimeout(dismiss, duration);

  return dismiss;
}

export const toast = {
  success: (msg, dur) => showToast(msg, 'success', dur),
  error: (msg, dur) => showToast(msg, 'error', dur),
  warning: (msg, dur) => showToast(msg, 'warning', dur),
  info: (msg, dur) => showToast(msg, 'info', dur),
};
