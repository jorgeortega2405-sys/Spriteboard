import { navigate } from '../app-router.js';
import { API_ROUTES } from '../config/api-routes.js';
import { escapeHtml } from '../services/api.service.js';
import { renderIcons } from '../services/icon.service.js';
import { CanvasItem } from '../types/canvas.types.js';

let activeGuestAuthModal: { close: () => void } | null = null;

export function openGuestAuthInvitationModal(canvas?: CanvasItem | null): void {
  if (activeGuestAuthModal) {
    activeGuestAuthModal.close();
  }

  const ownerName = canvas?.owner_name ? canvas.owner_name.trim() : 'Un compañero';
  const canvasName = canvas?.name ? canvas.name.trim() : 'Diseño compartido';
  const previewThumbnail = canvas?.preview_thumbnail || '';

  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop guest-auth-backdrop';
  backdrop.setAttribute('data-ref', 'guest-auth-backdrop');

  backdrop.innerHTML = `
    <div class="modal-container guest-auth-modal-container" data-ref="guest-auth-container">
      <button type="button" class="modal-close-btn guest-auth-close-btn" data-ref="btn-guest-auth-close" aria-label="Cerrar ventana">
        <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#close"></use></svg>
      </button>

      <div class="modal-card guest-auth-card" data-ref="guest-auth-card">
        <div class="modal-card__drag-zone" data-ref="guest-auth-drag-zone" aria-hidden="true">
          <div class="modal-card__drag-handle"></div>
        </div>
        <div class="guest-auth-layout" data-ref="guest-auth-layout">
          <div class="guest-auth-left" data-ref="guest-auth-left">
            <h1 class="guest-auth-title" data-ref="guest-auth-title">Ingresa o regístrate para crear tus propios diseños</h1>
            <p class="guest-auth-desc" data-ref="guest-auth-desc">
              <strong>${escapeHtml(ownerName)}</strong> compartió un diseño contigo. Una vez que ingreses a Spriteboard, podrás acceder a miles de plantillas para crear diseños increíbles y trabajar en equipo fácilmente.
            </p>

            <div class="guest-auth-actions" data-ref="guest-auth-actions">
              <button type="button" class="component-button component-button--h55 component-button--outline component-button--w-full guest-auth-btn-pill" data-ref="btn-guest-google">
                <svg class="guest-auth-google-icon" data-ref="google-icon" width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
                  <use href="/icons.svg#google_colored"></use>
                </svg>
                <span class="guest-auth-btn-text" data-ref="text-google">Usar Google</span>
              </button>

              <button type="button" class="component-button component-button--h55 component-button--outline component-button--w-full guest-auth-btn-pill" data-ref="btn-guest-email">
                <svg class="component-icon guest-auth-email-icon" aria-hidden="true"><use href="/icons.svg#mail"></use></svg>
                <span class="guest-auth-btn-text" data-ref="text-email">Usar mi correo</span>
              </button>
            </div>

            <div class="guest-auth-alternate" data-ref="guest-auth-alternate">
              <a class="guest-auth-link-alt" data-ref="link-other-auth" href="/login">Continuar de otra forma</a>
            </div>

            <p class="guest-auth-legal" data-ref="guest-auth-legal">
              Al continuar, aceptas las <a class="link link--primary" data-ref="link-terms" href="/help/terms" target="_blank">Condiciones de uso</a> de Spriteboard.<br/>
              Consulta nuestra <a class="link link--primary" data-ref="link-privacy" href="/help/privacy" target="_blank">Política de privacidad</a>.
            </p>
          </div>

          <div class="guest-auth-right" data-ref="guest-auth-right">
            <div class="guest-auth-preview-card" data-ref="guest-auth-preview-card">
              ${
                previewThumbnail
                  ? `<img class="guest-auth-preview-img" data-ref="preview-img" src="${escapeHtml(previewThumbnail)}" alt="${escapeHtml(canvasName)}" />`
                  : `<div class="guest-auth-preview-placeholder" data-ref="preview-placeholder">
                      <div class="guest-auth-placeholder-badge" data-ref="placeholder-badge">
                        <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#palette"></use></svg>
                        <span>${escapeHtml(canvasName)}</span>
                      </div>
                      <div class="guest-auth-placeholder-sheet" data-ref="placeholder-sheet">
                        <div class="guest-auth-sheet-line guest-auth-sheet-line--title"></div>
                        <div class="guest-auth-sheet-line"></div>
                        <div class="guest-auth-sheet-line guest-auth-sheet-line--short"></div>
                        <div class="guest-auth-sheet-box"></div>
                      </div>
                    </div>`
              }
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(backdrop);
  renderIcons(backdrop);

  requestAnimationFrame(() => {
    backdrop.classList.add('is-visible', 'is-active');
  });

  const close = () => {
    backdrop.classList.remove('is-visible', 'is-active');
    setTimeout(() => {
      backdrop.remove();
      if (activeGuestAuthModal?.close === close) {
        activeGuestAuthModal = null;
      }
    }, 200);
  };

  activeGuestAuthModal = { close };

  const closeBtn = backdrop.querySelector<HTMLButtonElement>('[data-ref="btn-guest-auth-close"]');
  closeBtn?.addEventListener('click', close);

  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop || (e.target as HTMLElement).classList.contains('guest-auth-modal-container')) {
      close();
    }
  });

  const btnGoogle = backdrop.querySelector<HTMLButtonElement>('[data-ref="btn-guest-google"]');
  btnGoogle?.addEventListener('click', () => {
    window.location.href = API_ROUTES.auth.google;
  });

  const btnEmail = backdrop.querySelector<HTMLButtonElement>('[data-ref="btn-guest-email"]');
  btnEmail?.addEventListener('click', () => {
    close();
    navigate('/login');
  });

  const linkOther = backdrop.querySelector<HTMLAnchorElement>('[data-ref="link-other-auth"]');
  linkOther?.addEventListener('click', (e) => {
    e.preventDefault();
    close();
    navigate('/login');
  });
}
