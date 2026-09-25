import { navigate } from '../app-router.js';
import { API_ROUTES } from '../config/api-routes.js';
import { currentUser, escapeHtml, getApi, postApi, setCurrentUser } from '../services/api.service.js';
import { t, translateElement } from '../services/i18n.service.js';
import { renderIcons } from '../services/icon.service.js';
import { showToast } from '../services/toast.service.js';
import { debounce } from '../utils/dom.util.js';

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

  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.setAttribute('data-ref', 'modal-designer-onboard-backdrop');

  const defaultHandle = (currentUser?.username || '').toLowerCase().replace(/[^a-z0-9_]/g, '');

  backdrop.innerHTML = `
    <div class="modal-container" data-ref="modal-designer-onboard-container">
      <div class="modal-card modal-card--w-540" data-ref="modal-card-designer-onboard" style="padding: 24px 28px; max-height: 90vh; overflow-y: auto;">
        <div class="modal-card__header" data-ref="modal-header" style="margin-bottom: 20px; text-align: left;">
          <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
            <div style="width: 40px; height: 40px; border-radius: 10px; background: rgba(99, 102, 241, 0.12); display: flex; align-items: center; justify-content: center; color: #6366f1; flex-shrink: 0;">
              <svg class="component-icon" style="font-size: 22px; width: 22px; height: 22px;" aria-hidden="true"><use href="/icons.svg#palette"></use></svg>
            </div>
            <h2 class="modal-card__title" data-ref="modal-title" style="font-size: 19px; font-weight: 700; margin: 0;">¡Bienvenido al panel de Diseñadores!</h2>
          </div>
          <p class="modal-card__desc" data-ref="modal-desc" style="font-size: 13.5px; color: var(--text-secondary); margin: 0; line-height: 1.45;">
            Configura tu identificador de creador (@handle) y tus datos preferidos para recibir cobros y pagos por tus plantillas.
          </p>
        </div>

        <form data-ref="form-designer-onboard" style="display: flex; flex-direction: column; gap: 16px;">
          
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
                <div style="border: 1px solid var(--border-color); border-radius: 8px; background: var(--bg-surface); padding: 0 8px; height: 40px; display: flex; align-items: center;">
                  <select data-ref="select-payout-country" style="width: 100%; border: none; background: transparent; outline: none; font-size: 13px; color: var(--text-primary);">
                    <option value="MX">México (MX)</option>
                    <option value="US">Estados Unidos (US)</option>
                    <option value="ES">España (ES)</option>
                    <option value="CO">Colombia (CO)</option>
                    <option value="AR">Argentina (AR)</option>
                    <option value="CL">Chile (CL)</option>
                    <option value="PE">Perú (PE)</option>
                    <option value="OTHER">Otro país</option>
                  </select>
                </div>
              </div>

              <div>
                <label class="field-label" style="display: block; font-size: 12px; font-weight: 600; margin-bottom: 4px; color: var(--text-secondary);">Moneda de Pago</label>
                <div style="border: 1px solid var(--border-color); border-radius: 8px; background: var(--bg-surface-secondary, rgba(0,0,0,0.03)); padding: 0 10px; height: 40px; display: flex; align-items: center; justify-content: space-between;">
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

          <div style="margin-top: 6px;">
            <button type="submit" class="component-button component-button--h44 component-button--black component-button--w-full" data-ref="btn-submit-designer-onboard">
              <span data-ref="btn-submit-text">Comenzar como Diseñador</span>
            </button>
            <div class="banner banner--danger" data-ref="onboard-error-banner" style="display: none; margin-top: 10px; font-size: 12.5px; padding: 10px 14px; border-radius: 8px;"></div>
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

  const selectCountry = backdrop.querySelector<HTMLSelectElement>('[data-ref="select-payout-country"]');

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

    const payoutCountry = selectCountry?.value || 'MX';

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
