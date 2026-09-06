import { ToastType } from '../types/common.types.js';

let userPreferences = {
  extended_alerts: false,
};

export function setToastPreferences(prefs: { extended_alerts?: boolean }): void {
  if (prefs && typeof prefs === 'object') {
    userPreferences = { ...userPreferences, ...prefs };
  }
}

export function showToast(message: string, type: ToastType = 'success', customDuration: number | null = null): () => void {
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
  success: (msg: string, dur?: number) => showToast(msg, 'success', dur ?? null),
  error: (msg: string, dur?: number) => showToast(msg, 'error', dur ?? null),
  warning: (msg: string, dur?: number) => showToast(msg, 'warning', dur ?? null),
  info: (msg: string, dur?: number) => showToast(msg, 'info', dur ?? null),
};
