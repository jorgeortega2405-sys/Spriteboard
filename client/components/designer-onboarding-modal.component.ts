import { navigate } from '../app-router.js';
import { API_ROUTES } from '../config/api-routes.js';
import { currentUser, escapeHtml, getApi, postApi, setCurrentUser } from '../services/api.service.js';
import { renderIcons } from '../services/icon.service.js';
import { showToast } from '../services/toast.service.js';
import { t, translateElement } from '../services/i18n.service.js';
import { debounce, setupDropdown } from '../utils/dom.util.js';

let activeOnboardingModal: { close: () => void } | null = null;

export interface DesignerOnboardingModalOptions {
  onSuccess?: () => void;
}

export function openDesignerOnboardingModal(options: DesignerOnboardingModalOptions = {}): { close: () => void } {
  if (activeOnboardingModal) {
    activeOnboardingModal.close();
  }

  const { onSuccess } = options;
  let isClosing = false;
  let isSubmitting = false;
  let isHandleValid = false;
  let selectedCountry = 'MX';

  const countryLabels: Record<string, string> = {
    AR: 'Argentina (AR)',
    CL: 'Chile (CL)',
    CO: 'Colombia (CO)',
    ES: 'España (ES)',
    MX: 'México (MX)',
    OTHER: 'Otro país',
    PE: 'Perú (PE)',
    US: 'Estados Unidos (US)',
  };

  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.setAttribute('data-ref', 'modal-designer-onboard-backdrop');

  const defaultHandle = (currentUser?.username || '').toLowerCase().replace(/[^a-z0-9_]/g, '');

  backdrop.innerHTML = `
    <div class="modal-container" data-ref="modal-designer-onboard-container">
      <button type="button" class="modal-close-btn" data-ref="btn-close-onboard-modal" data-i18n-aria="modal.close" aria-label="Cerrar modal">
        <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#close"></use></svg>
      </button>
      <div class="modal-card modal-card--md" data-ref="modal-card-designer-onboard">
        <div class="modal-card__drag-zone" data-ref="modal-drag-zone" aria-hidden="true">
          <div class="modal-card__drag-handle"></div>
        </div>
        <div class="modal-card__header" data-ref="modal-header">
          <h2 class="modal-card__title" data-ref="modal-title">¡Bienvenido al panel de Diseñadores!</h2>
          <p class="modal-card__desc" data-ref="modal-desc">
            Configura tu identificador de creador (@handle) y tus datos preferidos para recibir cobros y pagos por tus plantillas.
          </p>
        </div>

        <form class="modal-card__body" data-ref="form-designer-onboard" style="display: flex; flex-direction: column; gap: 16px;">
          <div data-ref="section-handle">
            <label class="field-label" style="display: block; font-size: 13px; font-weight: 600; margin-bottom: 6px; color: var(--text-primary);">
              Identificador de Diseñador (@handle)
            </label>
            <div style="display: flex; align-items: center; border: 1px solid var(--border-color); border-radius: 10px; background: var(--bg-surface); overflow: hidden; padding: 0 12px; height: 46px; transition: border-color 0.2s ease;">
              <span style="font-weight: 700; font-size: 15px; color: var(--text-secondary); margin-right: 4px; user-select: none;">@</span>
              <input class="field__input" data-ref="input-designer-handle" type="text" value="${escapeHtml(defaultHandle)}" placeholder="nombre_creativo" autocomplete="off" spellcheck="false" style="border: none; outline: none; background: transparent; width: 100%; height: 100%; font-size: 14px; color: var(--text-primary); padding: 0;" />
              <span data-ref="handle-status-icon" style="display: none; align-items: center; justify-content: center;"></span>
            </div>
            
            <div data-ref="handle-feedback-msg" style="font-size: 12px; margin-top: 5px; min-height: 18px; color: var(--text-secondary);"></div>

            <div class="profile-url-preview" data-ref="preview-url-box" style="margin-top: 4px; font-size: 12px; color: var(--text-secondary); display: flex; align-items: center; gap: 6px; padding: 8px 12px; border-radius: 8px; background: var(--bg-surface-secondary, rgba(0,0,0,0.03)); border: 1px solid var(--border-color);">
              <svg class="component-icon" style="font-size: 14px; width: 14px; height: 14px; flex-shrink: 0;" aria-hidden="true"><use href="/icons.svg#link"></use></svg>
              <span>Enlace de tu perfil: <strong data-ref="preview-url-text" style="color: var(--text-primary);">spriteboard.com/p/@${escapeHtml(defaultHandle)}</strong></span>
            </div>
          </div>

          <div style="border-top: 1px solid var(--border-color); padding-top: 16px;" data-ref="section-payouts">
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
              <svg class="component-icon" style="color: #10b981; font-size: 18px; width: 18px; height: 18px;" aria-hidden="true"><use href="/icons.svg#account_balance_wallet"></use></svg>
              <span style="font-weight: 600; font-size: 13.5px; color: var(--text-primary);">Configuración de Cobros en USD</span>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 14px;">
              <div>
                <label class="field-label" style="display: block; font-size: 12px; font-weight: 600; margin-bottom: 4px; color: var(--text-secondary);">País de Cobro</label>
                <div class="dropdown-wrapper dropdown-wrapper--full" data-ref="dropdown-wrapper-payout-country">
                  <button type="button" class="dropdown-trigger dropdown-trigger--full dropdown-trigger--sm" data-ref="btn-trigger-payout-country" aria-label="País de Cobro">
                    <div class="dropdown-trigger__left">
                      <svg class="component-icon dropdown-trigger__icon" aria-hidden="true"><use href="/icons.svg#public"></use></svg>
                      <span class="dropdown-trigger__text" data-ref="payout-country-selected-text">México (MX)</span>
                    </div>
                    <svg class="component-icon dropdown-trigger__chevron" aria-hidden="true"><use href="/icons.svg#expand_more"></use></svg>
                  </button>
                  <div class="dropdown-backdrop" data-ref="dropdown-backdrop-payout-country">
                    <div class="menu-panel menu-panel--dropdown menu-panel--w-full menu-panel--h-auto" data-ref="dropdown-menu-payout-country" style="max-height: 200px; overflow-y: auto;">
                      <div class="menu-panel__list">
                        <button type="button" class="menu-item is-active" data-ref="btn-country-mx" data-value="MX"><span class="menu-item__text">México (MX)</span></button>
                        <button type="button" class="menu-item" data-ref="btn-country-us" data-value="US"><span class="menu-item__text">Estados Unidos (US)</span></button>
                        <button type="button" class="menu-item" data-ref="btn-country-es" data-value="ES"><span class="menu-item__text">España (ES)</span></button>
                        <button type="button" class="menu-item" data-ref="btn-country-co" data-value="CO"><span class="menu-item__text">Colombia (CO)</span></button>
                        <button type="button" class="menu-item" data-ref="btn-country-ar" data-value="AR"><span class="menu-item__text">Argentina (AR)</span></button>
                        <button type="button" class="menu-item" data-ref="btn-country-cl" data-value="CL"><span class="menu-item__text">Chile (CL)</span></button>
                        <button type="button" class="menu-item" data-ref="btn-country-pe" data-value="PE"><span class="menu-item__text">Perú (PE)</span></button>
                        <button type="button" class="menu-item" data-ref="btn-country-other" data-value="OTHER"><span class="menu-item__text">Otro país</span></button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <label class="field-label" style="display: block; font-size: 12px; font-weight: 600; margin-bottom: 4px; color: var(--text-secondary);">Moneda de Pago</label>
                <div style="border: 1px solid var(--border-color); border-radius: 8px; background: var(--bg-surface-secondary, rgba(0,0,0,0.03)); padding: 0 10px; height: 38px; display: flex; align-items: center; justify-content: space-between;">
                  <span style="font-size: 13px; font-weight: 600; color: var(--text-primary);">USD ($)</span>
                  <span class="component-badge component-badge--success" style="font-size: 10.5px; font-weight: 600; padding: 2px 6px;">100% en Dólares</span>
                </div>
              </div>
            </div>

            <div style="display: flex; gap: 12px; align-items: flex-start; padding: 12px 14px; border-radius: 10px; background: rgba(99, 91, 255, 0.06); border: 1px solid rgba(99, 91, 255, 0.18); font-size: 12.5px; line-height: 1.45; color: var(--text-primary); margin-bottom: 6px;">
              <div style="width: 32px; height: 32px; border-radius: 8px; background: rgba(99, 91, 255, 0.15); display: flex; align-items: center; justify-content: center; color: #635bff; flex-shrink: 0; margin-top: 1px;">
                <svg class="component-icon" style="font-size: 18px; width: 18px; height: 18px;" aria-hidden="true"><use href="/icons.svg#credit_card"></use></svg>
              </div>
              <div>
                <strong style="color: var(--text-primary); display: block; margin-bottom: 2px; font-size: 13px;">Pagos directos a tu tarjeta o banco con Stripe</strong>
                <span style="color: var(--text-secondary);">Tus fondos se transfieren directamente a tu tarjeta de débito o cuenta bancaria. Al ingresar a tu panel de diseñador podrás vincular tu tarjeta o banco en 1 clic de forma segura a través de Stripe.</span>
              </div>
            </div>
          </div>

          <div class="modal-card__footer" data-ref="modal-footer" style="padding: 0; margin-top: 8px;">
            <div class="modal-card__actions" data-ref="modal-actions">
              <button type="button" class="component-button component-button--h34" data-ref="btn-cancel-designer-onboard">Cancelar</button>
              <button type="submit" class="component-button component-button--h34 component-button--black" data-ref="btn-submit-designer-onboard">
                <span data-ref="btn-submit-text">Comenzar como Diseñador</span>
              </button>
            </div>
            <div class="banner banner--danger" data-ref="onboard-error-banner" style="display: none; margin-top: 10px;"></div>
          </div>
        </form>
      </div>
    </div>
  `;

  translateElement(backdrop);
  renderIcons(backdrop);

  const inputHandle = backdrop.querySelector<HTMLInputElement>('[data-ref="input-designer-handle"]');
  const handleFeedbackMsg = backdrop.querySelector<HTMLElement>('[data-ref="handle-feedback-msg"]');
  const handleStatusIcon = backdrop.querySelector<HTMLElement>('[data-ref="handle-status-icon"]');
  const previewUrlText = backdrop.querySelector<HTMLElement>('[data-ref="preview-url-text"]');

  const btnClose = backdrop.querySelector<HTMLButtonElement>('[data-ref="btn-close-onboard-modal"]');
  const btnCancel = backdrop.querySelector<HTMLButtonElement>('[data-ref="btn-cancel-designer-onboard"]');

  const countryWrapper = backdrop.querySelector<HTMLElement>('[data-ref="dropdown-wrapper-payout-country"]');
  const countryTrigger = backdrop.querySelector<HTMLElement>('[data-ref="btn-trigger-payout-country"]');
  const countryMenu = backdrop.querySelector<HTMLElement>('[data-ref="dropdown-menu-payout-country"]');
  const countryBackdrop = backdrop.querySelector<HTMLElement>('[data-ref="dropdown-backdrop-payout-country"]');
  const countryText = backdrop.querySelector<HTMLElement>('[data-ref="payout-country-selected-text"]');

  if (countryWrapper && countryTrigger && countryMenu) {
    setupDropdown(countryWrapper, { backdrop: countryBackdrop || undefined, menu: countryMenu, trigger: countryTrigger });
    countryMenu.addEventListener('click', (e) => {
      const item = (e.target as HTMLElement).closest<HTMLElement>('.menu-item');
      if (!item) return;
      const val = item.getAttribute('data-value');
      if (val) {
        selectedCountry = val;
        countryMenu.querySelectorAll('.menu-item').forEach((m) => m.classList.toggle('is-active', m === item));
        if (countryText) countryText.textContent = countryLabels[val] || val;
      }
    });
  }

  const form = backdrop.querySelector<HTMLFormElement>('[data-ref="form-designer-onboard"]');
  const btnSubmit = backdrop.querySelector<HTMLButtonElement>('[data-ref="btn-submit-designer-onboard"]');
  const btnSubmitText = backdrop.querySelector<HTMLElement>('[data-ref="btn-submit-text"]');
  const errorBanner = backdrop.querySelector<HTMLElement>('[data-ref="onboard-error-banner"]');

  const modalInstance = {
    close() {
      if (isClosing) return;
      isClosing = true;
      backdrop.classList.remove('is-visible');
      setTimeout(() => {
        if (backdrop.parentNode) {
          backdrop.parentNode.removeChild(backdrop);
        }
        if (activeOnboardingModal === modalInstance) {
          activeOnboardingModal = null;
        }
        document.body.classList.remove('modal-open');
      }, 200);
    },
  };

  btnClose?.addEventListener('click', () => modalInstance.close());
  btnCancel?.addEventListener('click', () => modalInstance.close());

  activeOnboardingModal = modalInstance;

  const showError = (msg: string) => {
    if (errorBanner) {
      errorBanner.textContent = msg;
      errorBanner.style.display = 'block';
    }
  };

  const clearError = () => {
    if (errorBanner) {
      errorBanner.textContent = '';
      errorBanner.style.display = 'none';
    }
  };

  const checkHandleDebounced = debounce(async () => {
    const rawVal = (inputHandle?.value || '').trim().replace(/^@+/, '');
    if (previewUrlText) {
      previewUrlText.textContent = `spriteboard.com/p/@${rawVal || '...'}`;
    }

    if (!rawVal || rawVal.length < 3) {
      isHandleValid = false;
      if (handleFeedbackMsg) {
        handleFeedbackMsg.textContent = 'El identificador debe tener al menos 3 caracteres.';
        handleFeedbackMsg.style.color = 'var(--text-secondary)';
      }
      if (handleStatusIcon) handleStatusIcon.style.display = 'none';
      return;
    }

    try {
      const res = await getApi(API_ROUTES.designer.checkHandle(rawVal));
      if (res.ok) {
        const data = await res.json();
        if (data.available) {
          isHandleValid = true;
          if (handleFeedbackMsg) {
            handleFeedbackMsg.textContent = '¡Identificador disponible!';
            handleFeedbackMsg.style.color = '#10b981';
          }
          if (handleStatusIcon) {
            handleStatusIcon.innerHTML = '<svg class="component-icon" style="color: #10b981; font-size: 18px; width: 18px; height: 18px;" aria-hidden="true"><use href="/icons.svg#check_circle"></use></svg>';
            handleStatusIcon.style.display = 'flex';
            renderIcons(handleStatusIcon);
          }
        } else {
          isHandleValid = false;
          if (handleFeedbackMsg) {
            handleFeedbackMsg.textContent = data.reason || 'Este identificador no está disponible.';
            handleFeedbackMsg.style.color = 'var(--color-danger, #ef4444)';
          }
          if (handleStatusIcon) {
            handleStatusIcon.innerHTML = '<svg class="component-icon" style="color: #ef4444; font-size: 18px; width: 18px; height: 18px;" aria-hidden="true"><use href="/icons.svg#cancel"></use></svg>';
            handleStatusIcon.style.display = 'flex';
            renderIcons(handleStatusIcon);
          }
        }
      }
    } catch {
      isHandleValid = true;
    }
  }, 250);

  inputHandle?.addEventListener('input', () => {
    const clean = (inputHandle.value || '').replace(/[^a-zA-Z0-9_@]/g, '').replace(/^@+/, '').toLowerCase();
    inputHandle.value = clean;
    clearError();
    checkHandleDebounced();
  });

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (isSubmitting) return;

    clearError();
    const handleVal = (inputHandle?.value || '').trim().replace(/^@+/, '');

    if (!handleVal || handleVal.length < 3) {
      showError('Debes ingresar un identificador (@handle) de al menos 3 caracteres.');
      inputHandle?.focus();
      return;
    }

    const payoutCountry = selectedCountry || 'MX';

    isSubmitting = true;
    if (btnSubmit) btnSubmit.disabled = true;
    if (btnSubmitText) btnSubmitText.textContent = 'Guardando configuración...';

    try {
      const res = await postApi(API_ROUTES.designer.onboard, {
        handle: handleVal,
        payout_country: payoutCountry,
        payout_currency: 'USD',
        payout_type: 'stripe_connect',
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok && data.success) {
        if (currentUser) {
          currentUser.designer_handle = data.designer_handle;
          currentUser.designer_onboarded = true;
          setCurrentUser(currentUser);
        }
        showToast('¡Configuración de diseñador completada con éxito!', 'success');
        modalInstance.close();
        if (onSuccess) {
          onSuccess();
        }
      } else {
        showError(data?.error || 'Error al completar la configuración. Intenta nuevamente.');
      }
    } catch {
      showError('Error de conexión al guardar la configuración.');
    } finally {
      isSubmitting = false;
      if (btnSubmit) btnSubmit.disabled = false;
      if (btnSubmitText) btnSubmitText.textContent = 'Comenzar como Diseñador';
    }
  });

  document.body.appendChild(backdrop);
  document.body.classList.add('modal-open');

  requestAnimationFrame(() => {
    backdrop.classList.add('is-visible');
    inputHandle?.focus();
    checkHandleDebounced();
  });

  return modalInstance;
}
