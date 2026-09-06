/**
 * Modal Dividido de Autenticación en Dos Factores (1024 x 525 px)
 *
 * Características:
 * - Diseño split (columna izquierda para contenido/inputs, derecha para gradiente y QR/SVG).
 * - CERO atributos 'id', uso exclusivo de 'data-ref'.
 * - Orden estricto de atributos: <button type="..." class="..." data-ref="...">.
 * - Banner de error siempre debajo del botón de acción.
 * - Cero llamadas a console.*.
 * - Integración con qr-code-styling.
 */

import QRCodeStyling from '../vendor/qr-styling.js';
import { postApi } from '../services/api.service.js';
import { t, translateElement } from '../services/i18n.service.js';
import { showToast } from '../services/toast.service.js';

let active2FAModal = null;

/**
 * Abre el modal dividido de 1024x525 px para configurar y activar 2FA
 */
export async function open2FAModal(options = {}) {
  const { onSuccess = null, onClose = null } = options;

  if (active2FAModal) {
    active2FAModal.close();
  }

  // 1. Crear el backdrop del modal
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.setAttribute('data-ref', 'modal-2fa-backdrop');

  backdrop.innerHTML = `
    <div class="modal-container" data-ref="modal-2fa-container">
      <button type="button" class="modal-close-btn" data-ref="btn-modal-close" data-i18n-aria="modal.close" aria-label="${t('modal.close')}">
        <span class="material-symbols-rounded">close</span>
      </button>
      <div class="modal-card modal-card--split" data-ref="modal-card-2fa">
        <div class="modal-card__drag-zone" data-ref="modal-2fa-drag-zone">
          <div class="modal-card__drag-handle"></div>
        </div>
        <!-- Columna izquierda: formulario, descripciones y badges -->
        <div class="modal-split__left" data-ref="modal-split-left">
        <!-- Contenedor Etapa 1 -->
        <div class="modal-split__stage" data-ref="stage-1-container">
          <div class="modal-split__header" data-ref="stage-1-header">
            <h2 class="modal-split__title" data-ref="stage-1-title" data-i18n="settings.security.two_factor_modal_title">
              ${t('settings.security.two_factor_modal_title')}
            </h2>
            <p class="modal-split__desc" data-ref="stage-1-desc" data-i18n="settings.security.two_factor_modal_desc">
              ${t('settings.security.two_factor_modal_desc')}
            </p>
          </div>

          <div class="modal-split__form" data-ref="stage-1-form">
            <label class="field" data-ref="field-modal-2fa-code">
              <input class="field__input field__input--code" data-ref="input-modal-2fa-code" type="text" maxlength="6" placeholder=" " autocomplete="one-time-code" inputmode="numeric" />
              <span class="field__label" data-ref="label-modal-2fa-code" data-i18n="settings.security.two_factor_modal_code_label">
                ${t('settings.security.two_factor_modal_code_label')}
              </span>
            </label>

            <button type="button" class="modal-split__link-toggle" data-ref="btn-toggle-secret">
              <span class="material-symbols-rounded">key</span>
              <span data-ref="toggle-secret-text" data-i18n="settings.security.two_factor_view_secret">
                ${t('settings.security.two_factor_view_secret')}
              </span>
            </button>

            <div class="modal-split__secret-box" data-ref="box-secret-key" style="display: none;">
              <span class="modal-split__secret-value" data-ref="text-secret-value"></span>
              <button type="button" class="modal-split__secret-copy" data-ref="btn-copy-secret" data-tooltip="${t('modal.copy')}">
                <span class="material-symbols-rounded">content_copy</span>
              </button>
            </div>

            <button type="button" class="btn btn--h44 btn--black btn--w-full" data-ref="btn-continue-2fa">
              ${t('modal.continue')}
            </button>

            <div class="banner banner--danger" data-ref="modal-2fa-error" style="display: none;"></div>
          </div>
        </div>

        <!-- Contenedor Etapa 2 (Códigos de respaldo) -->
        <div class="modal-split__stage" data-ref="stage-2-container" style="display: none;">
          <div class="modal-split__header" data-ref="stage-2-header">
            <h2 class="modal-split__title" data-ref="stage-2-title" data-i18n="settings.security.two_factor_backup_title">
              ${t('settings.security.two_factor_backup_title')}
            </h2>
            <p class="modal-split__desc" data-ref="stage-2-desc" data-i18n="settings.security.two_factor_backup_desc">
              ${t('settings.security.two_factor_backup_desc')}
            </p>
          </div>

          <div class="modal-split__backup-section" data-ref="stage-2-codes">
            <div class="backup-codes-grid" data-ref="backup-codes-grid"></div>

            <div class="modal-split__backup-actions" data-ref="stage-2-actions">
              <button type="button" class="btn btn--h38" data-ref="btn-copy-backup-codes">
                <span class="material-symbols-rounded">content_copy</span>
                <span data-ref="btn-copy-text">${t('settings.security.two_factor_copy_all')}</span>
              </button>
              <button type="button" class="btn btn--h38 btn--black" data-ref="btn-finish-2fa">
                ${t('settings.security.two_factor_finish')}
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Columna derecha: gradiente moderno y contenido visual (QR / SVG) -->
      <div class="modal-split__right" data-ref="modal-split-right">
        <!-- Visual Etapa 1: QR con styling moderno -->
        <div class="modal-split__visual-stage" data-ref="visual-stage-1">
          <div class="modal-split__qr-wrapper" data-ref="qr-wrapper">
            <div class="modal-split__qr-canvas" data-ref="qr-container"></div>
          </div>
          <div class="modal-split__right-hint" data-ref="qr-hint">
            <span class="material-symbols-rounded">qr_code_scanner</span>
            <span data-i18n="settings.security.two_factor_qr_hint">${t('settings.security.two_factor_qr_hint')}</span>
          </div>
        </div>

        <!-- Visual Etapa 2: SVG ilustrativo sobre gradiente -->
        <div class="modal-split__visual-stage" data-ref="visual-stage-2" style="display: none;">
          <div class="modal-split__svg-wrapper" data-ref="svg-wrapper">
            <svg class="modal-split__shield-svg" data-ref="shield-svg" width="220" height="220" viewBox="0 0 220 220" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="110" cy="110" r="80" fill="#ffffff" fill-opacity="0.06"/>
              <circle cx="110" cy="110" r="75" stroke="#ffffff" stroke-width="1.5" stroke-dasharray="5 5" stroke-opacity="0.2"/>
              <path d="M110 40L158 62V114C158 145 137 172 110 182C83 172 62 145 62 114V62L110 40Z" fill="rgba(255,255,255,0.05)" stroke="#ffffff" stroke-width="2.5" stroke-linejoin="round"/>
              <rect x="93" y="105" width="34" height="28" rx="6" fill="rgba(255,255,255,0.12)" stroke="#ffffff" stroke-width="2"/>
              <path d="M101 105V96C101 91.0294 105.029 87 110 87C114.971 87 119 91.0294 119 96V105" stroke="#ffffff" stroke-width="2" stroke-linecap="round"/>
              <circle cx="110" cy="117" r="2.5" fill="#ffffff"/>
              <line x1="110" y1="119.5" x2="110" y2="124" stroke="#ffffff" stroke-width="2" stroke-linecap="round"/>
              <rect x="78" y="78" width="14" height="2.5" rx="1.25" fill="#ffffff" fill-opacity="0.4"/>
              <rect x="128" y="78" width="14" height="2.5" rx="1.25" fill="#ffffff" fill-opacity="0.4"/>
              <rect x="74" y="136" width="18" height="2.5" rx="1.25" fill="#ffffff" fill-opacity="0.3"/>
              <rect x="128" y="136" width="18" height="2.5" rx="1.25" fill="#ffffff" fill-opacity="0.3"/>
              <circle cx="150" cy="72" r="15" fill="#22c55e" stroke="#000000" stroke-width="2.5"/>
              <path d="M145 72L148.5 75.5L155.5 68.5" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
          <div class="modal-split__right-status" data-ref="status-badge">
            <span class="modal-split__badge-check">
              <span class="material-symbols-rounded">verified_user</span>
            </span>
            <span class="modal-split__badge-text" data-i18n="settings.security.two_factor_active_badge">
              ${t('settings.security.two_factor_active_badge')}
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
  `;

  translateElement(backdrop);

  // Referencias a elementos
  const closeBtn = backdrop.querySelector('[data-ref="btn-modal-close"]');
  const stage1Container = backdrop.querySelector('[data-ref="stage-1-container"]');
  const stage2Container = backdrop.querySelector('[data-ref="stage-2-container"]');
  const visualStage1 = backdrop.querySelector('[data-ref="visual-stage-1"]');
  const visualStage2 = backdrop.querySelector('[data-ref="visual-stage-2"]');
  const qrContainer = backdrop.querySelector('[data-ref="qr-container"]');
  const codeInput = backdrop.querySelector('[data-ref="input-modal-2fa-code"]');
  const continueBtn = backdrop.querySelector('[data-ref="btn-continue-2fa"]');
  const errorBanner = backdrop.querySelector('[data-ref="modal-2fa-error"]');
  const toggleSecretBtn = backdrop.querySelector('[data-ref="btn-toggle-secret"]');
  const secretBox = backdrop.querySelector('[data-ref="box-secret-key"]');
  const secretValueEl = backdrop.querySelector('[data-ref="text-secret-value"]');
  const copySecretBtn = backdrop.querySelector('[data-ref="btn-copy-secret"]');
  const backupCodesGrid = backdrop.querySelector('[data-ref="backup-codes-grid"]');
  const copyBackupBtn = backdrop.querySelector('[data-ref="btn-copy-backup-codes"]');
  const finishBtn = backdrop.querySelector('[data-ref="btn-finish-2fa"]');

  let currentBackupCodes = [];
  let isClosing = false;

  const showError = (message) => {
    if (errorBanner) {
      errorBanner.textContent = message;
      errorBanner.style.display = 'block';
    }
  };

  const clearError = () => {
    if (errorBanner) {
      errorBanner.textContent = '';
      errorBanner.style.display = 'none';
    }
  };

  const setButtonLoading = (btn, isLoading, loadingText = t('modal.loading')) => {
    if (!btn) return;
    if (isLoading) {
      btn.disabled = true;
      btn.setAttribute('data-original-text', btn.textContent || '');
      btn.textContent = loadingText;
    } else {
      btn.disabled = false;
      btn.textContent = btn.getAttribute('data-original-text') || t('modal.continue');
    }
  };

  const modalInstance = {
    backdrop,
    close() {
      if (isClosing) return;
      isClosing = true;

      backdrop.classList.remove('is-visible');
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);

      setTimeout(() => {
        if (backdrop.parentNode) {
          backdrop.parentNode.removeChild(backdrop);
        }
        if (active2FAModal === modalInstance) {
          active2FAModal = null;
        }
        document.body.classList.remove('modal-open');
        if (onClose) onClose();
      }, 200);
    },
  };

  active2FAModal = modalInstance;

  // Soporte de Drag & Drop para cerrar modal
  const card2fa = backdrop.querySelector('[data-ref="modal-card-2fa"]');
  const dragZone2fa = backdrop.querySelector('[data-ref="modal-2fa-drag-zone"]');
  let startY = 0;
  let currentY = 0;
  let isDragging = false;
  let activePointerId = null;

  const onPointerDown = (e) => {
    if (isClosing || !card2fa) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;

    isDragging = true;
    activePointerId = e.pointerId;
    startY = e.clientY;
    currentY = startY;

    try {
      (dragZone2fa || card2fa).setPointerCapture(activePointerId);
    } catch (_) {}

    card2fa.style.transition = 'none';
  };

  const onPointerMove = (e) => {
    if (!isDragging || (activePointerId !== null && e.pointerId !== activePointerId)) return;
    currentY = e.clientY;
    const diff = currentY - startY;

    if (card2fa) {
      if (diff > 0) {
        card2fa.style.transform = `translateY(${diff}px)`;
      } else {
        card2fa.style.transform = `translateY(${diff * 0.15}px)`;
      }
    }
  };

  const onPointerUp = (e) => {
    if (!isDragging || (activePointerId !== null && e.pointerId !== activePointerId)) return;
    isDragging = false;

    try {
      if (activePointerId !== null) {
        (dragZone2fa || card2fa).releasePointerCapture(activePointerId);
      }
    } catch (_) {}
    activePointerId = null;

    const diff = currentY - startY;

    if (diff > 80) {
      modalInstance.close();
    } else {
      if (card2fa) {
        card2fa.style.transition = 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)';
        card2fa.style.transform = '';
      }
    }
  };

  dragZone2fa?.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
  window.addEventListener('pointercancel', onPointerUp);

  // Eventos de cierre
  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      modalInstance.close();
    }
  };

  document.addEventListener('keydown', handleKeyDown);

  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) {
      e.preventDefault();
      modalInstance.close();
    }
  });

  closeBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    modalInstance.close();
  });

  // Alternar visualización del código secreto en texto
  toggleSecretBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    if (!secretBox) return;
    const isHidden = secretBox.style.display === 'none';
    secretBox.style.display = isHidden ? 'flex' : 'none';
  });

  // Copiar secreto individual
  copySecretBtn?.addEventListener('click', async (e) => {
    e.preventDefault();
    const secretText = secretValueEl?.textContent || '';
    if (secretText) {
      try {
        await navigator.clipboard.writeText(secretText);
        showToast(t('toasts.copied') || 'Copiado al portapapeles', 'success');
      } catch (_) {}
    }
  });

  // Copiar todos los códigos de respaldo
  copyBackupBtn?.addEventListener('click', async (e) => {
    e.preventDefault();
    if (currentBackupCodes.length > 0) {
      const textToCopy = `Spriteboard - Códigos de Respaldo 2FA:\n\n${currentBackupCodes.join('\n')}\n\nConserva estos códigos en un lugar seguro. Cada código solo se puede usar una vez.`;
      try {
        await navigator.clipboard.writeText(textToCopy);
        showToast(t('settings.security.two_factor_copied_toast') || 'Códigos de respaldo copiados al portapapeles.', 'success');
      } catch (_) {
        showToast(t('toasts.copied') || 'Copiado al portapapeles', 'success');
      }
    }
  });

  // Finalizar
  finishBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    modalInstance.close();
    if (onSuccess) {
      onSuccess();
    }
  });

  // Montar en el DOM y disparar animación
  document.body.appendChild(backdrop);
  document.body.classList.add('modal-open');

  requestAnimationFrame(() => {
    backdrop.classList.add('is-visible');
  });

  // 2. Solicitar al backend la generación del secreto, QR URI y códigos de respaldo
  try {
    const res = await postApi('/api/settings/2fa/generate');
    const data = await res.json();

    if (!res.ok || !data.ok) {
      showError(data.error || t('toasts.generic_error'));
      return modalInstance;
    }

    const { secret, qrUri, backupCodes } = data;
    currentBackupCodes = backupCodes || [];

    if (secretValueEl) {
      secretValueEl.textContent = secret;
    }

    // 3. Renderizar el QR estilizado usando QRCodeStyling
    if (qrContainer && qrUri && QRCodeStyling) {
      qrContainer.innerHTML = '';
      const qrCode = new QRCodeStyling({
        width: 200,
        height: 200,
        type: 'svg',
        data: qrUri,
        margin: 2,
        dotsOptions: {
          type: 'rounded',
          color: '#000000',
        },
        cornersSquareOptions: {
          type: 'extra-rounded',
          color: '#000000',
        },
        cornersDotOptions: {
          type: 'dot',
          color: '#000000',
        },
        backgroundOptions: {
          color: '#ffffff',
        },
      });

      qrCode.append(qrContainer);
    }

    codeInput?.focus();
  } catch (_) {
    showError(t('toasts.network_error'));
  }

  // Sanitizar input al escribir y permitir presionar Enter
  codeInput?.addEventListener('input', () => {
    codeInput.value = codeInput.value.replace(/[^\d\s-]/g, '').slice(0, 8);
  });

  codeInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleVerifyStage1();
    }
  });

  // 4. Validar código al presionar Continuar
  const handleVerifyStage1 = async () => {
    clearError();
    const rawCode = codeInput?.value || '';
    const code = rawCode.replace(/[\s-]+/g, '').trim();

    if (!code || code.length !== 6 || !/^\d{6}$/.test(code)) {
      showError(t('settings.security.two_factor_invalid_code') || 'Ingresa un código válido de 6 dígitos.');
      return;
    }

    setButtonLoading(continueBtn, true);

    try {
      const res = await postApi('/api/settings/2fa/enable', { code });
      const data = await res.json();

      if (!res.ok || !data.ok) {
        setButtonLoading(continueBtn, false);
        showError(data.error || t('settings.security.two_factor_invalid_code') || 'Código incorrecto o expirado.');
        return;
      }

      // 2FA activado con éxito: Pasar a Etapa 2
      if (data.backupCodes && Array.isArray(data.backupCodes)) {
        currentBackupCodes = data.backupCodes;
      }

      // Renderizar los 10 badges de códigos de respaldo
      if (backupCodesGrid) {
        backupCodesGrid.innerHTML = '';
        currentBackupCodes.forEach((bCode) => {
          const badge = document.createElement('div');
          badge.className = 'code-badge';
          badge.setAttribute('data-ref', 'code-badge-item');
          badge.textContent = bCode;
          badge.title = t('modal.copy') || 'Copiar';
          badge.addEventListener('click', async () => {
            try {
              await navigator.clipboard.writeText(bCode);
              showToast(`${t('toasts.copied') || 'Copiado'}: ${bCode}`, 'success');
            } catch (_) {}
          });
          backupCodesGrid.appendChild(badge);
        });
      }

      // Transición a la Etapa 2
      if (stage1Container) stage1Container.style.display = 'none';
      if (visualStage1) visualStage1.style.display = 'none';
      if (stage2Container) stage2Container.style.display = 'flex';
      if (visualStage2) visualStage2.style.display = 'flex';

      showToast(t('settings.security.two_factor_enabled_toast') || 'Autenticación en dos pasos activada.', 'success');
    } catch (_) {
      setButtonLoading(continueBtn, false);
      showError(t('toasts.network_error'));
    }
  };

  continueBtn?.addEventListener('click', handleVerifyStage1);

  codeInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleVerifyStage1();
    }
  });

  return modalInstance;
}
