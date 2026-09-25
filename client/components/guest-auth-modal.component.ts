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
        <div class="guest-auth-layout" data-ref="guest-auth-layout">
          <div class="guest-auth-left" data-ref="guest-auth-left">
            <h1 class="guest-auth-title" data-ref="guest-auth-title">Ingresa o regístrate para crear tus propios diseños</h1>
            <p class="guest-auth-desc" data-ref="guest-auth-desc">
              <strong>${escapeHtml(ownerName)}</strong> compartió un diseño contigo. Una vez que ingreses a Spriteboard, podrás acceder a miles de plantillas para crear diseños increíbles y trabajar en equipo fácilmente.
            </p>

            <div class="guest-auth-actions" data-ref="guest-auth-actions">
              <button type="button" class="component-button component-button--h55 component-button--outline component-button--w-full guest-auth-btn-pill" data-ref="btn-guest-google">
                <svg class="guest-auth-google-icon" data-ref="google-icon" width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
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
