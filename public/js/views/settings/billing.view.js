/**
 * Vista de Facturación y Suscripciones (/settings/billing)
 * CERO atributos id, orden estricto de atributos, sin console.*
 */

import { loadTemplate } from '../../services/template.service.js';
import { createSidebar } from '../../components/sidebar.component.js';
import { t, translateElement } from '../../services/i18n.service.js';
import { showToast } from '../../services/toast.service.js';
import { openModal } from '../../components/modal-dialog.js';
import { navigate } from '../../app-router.js';
import {
  currentUser,
  checkAuthSession,
  appConfig,
  escapeHtml,
  getBillingDetailsApi,
  updateAutoRenewalApi,
  cancelSubscriptionImmediateApi,
  getPaymentMethodsApi,
  createSetupIntentApi,
  setDefaultPaymentMethodApi,
  deletePaymentMethodApi,
} from '../../services/api.service.js';

let stripePromise = null;

function loadStripeSdk() {
  if (window.Stripe && appConfig.stripePublishableKey) {
    return Promise.resolve(window.Stripe(appConfig.stripePublishableKey));
  }
  if (!stripePromise) {
    stripePromise = new Promise((resolve, reject) => {
      if (!appConfig.stripePublishableKey) {
        reject(new Error('Clave pública de Stripe ausente.'));
        return;
      }
      const existingScript = document.querySelector('script[src="https://js.stripe.com/v3/"]');
      if (existingScript) {
        existingScript.addEventListener('load', () => {
          resolve(window.Stripe(appConfig.stripePublishableKey));
        });
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://js.stripe.com/v3/';
      script.async = true;
      script.onload = () => {
        resolve(window.Stripe(appConfig.stripePublishableKey));
      };
      script.onerror = () => {
        stripePromise = null;
        reject(new Error('No se pudo cargar Stripe.js.'));
      };
      document.head.appendChild(script);
    });
  }
  return stripePromise;
}

export async function createBillingView() {
  const container = await loadTemplate('/views/settings/billing.html');
  translateElement(container);

  // Insertar la barra lateral (sidebar) dentro del contenedor de contenido
  const sidebar = await createSidebar();
  container.prepend(sidebar);

  // Acordeones interactivos: conmutar estado de apertura y cierre
  const accordionHeaderSub = container.querySelector('[data-ref="accordion-header-subscription"]');
  const groupSub = container.querySelector('[data-ref="group-subscription-plan"]');
  accordionHeaderSub?.addEventListener('click', (e) => {
    e.preventDefault();
    groupSub?.classList.toggle('is-active');
  });

  const accordionHeaderPm = container.querySelector('[data-ref="accordion-header-payment-methods"]');
  const groupPm = container.querySelector('[data-ref="group-payment-methods"]');
  accordionHeaderPm?.addEventListener('click', (e) => {
    e.preventDefault();
    groupPm?.classList.toggle('is-active');
  });

  let billingInfo = null;

  // 1. Cargar detalles del plan
  const loadBillingData = async () => {
    try {
      const res = await getBillingDetailsApi();
      if (res.success) {
        billingInfo = res;
        renderSubscriptionPlan(res);
      } else {
        renderSubscriptionPlan({ hasSubscription: false });
      }
    } catch {
      renderSubscriptionPlan({ hasSubscription: false });
    }
  };

  // 2. Renderizar bloque de suscripción
  const renderSubscriptionPlan = (info) => {
    const planNameEl = container.querySelector('[data-ref="current-plan-name"]');
    const planStatusBadge = container.querySelector('[data-ref="current-plan-status-badge"]');
    const planDescEl = container.querySelector('[data-ref="current-plan-desc"]');
    const btnUpgrade = container.querySelector('[data-ref="btn-upgrade-plan"]');

    const itemAutoRenewal = container.querySelector('[data-ref="item-auto-renewal"]');
    const dividerAutoRenewal = container.querySelector('[data-ref="divider-auto-renewal"]');
    const autoRenewalDesc = container.querySelector('[data-ref="auto-renewal-desc"]');
    const btnToggleRenewal = container.querySelector('[data-ref="btn-toggle-auto-renewal"]');

    const itemCancelSub = container.querySelector('[data-ref="item-cancel-subscription"]');
    const dividerCancelSub = container.querySelector('[data-ref="divider-cancel-sub"]');

    const hasActiveSub = Boolean(info.hasSubscription && info.tier && info.tier !== 'free' && info.tier !== 'none');

    if (hasActiveSub) {
      const tierFormatted = info.tier.charAt(0).toUpperCase() + info.tier.slice(1);
      const intervalText = info.interval === 'year' ? t('upgrade.billing_yearly') || 'Anual' : t('upgrade.billing_monthly') || 'Mensual';
      if (planNameEl) planNameEl.textContent = `Spriteboard ${tierFormatted} (${intervalText})`;

      let dateFormatted = '';
      if (info.current_period_end) {
        try {
          const d = new Date(info.current_period_end);
          dateFormatted = d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
        } catch (_) {}
      }

      if (planStatusBadge) {
        planStatusBadge.style.display = 'inline-flex';
        if (info.cancel_at_period_end) {
          planStatusBadge.className = 'component-badge component-badge--sm component-badge--warning';
          planStatusBadge.textContent = t('settings.billing.status_cancel_scheduled') || 'Cancelación programada';
        } else {
          planStatusBadge.className = 'component-badge component-badge--sm component-badge--success';
          planStatusBadge.textContent = t('settings.billing.status_active') || 'Activo';
        }
      }

      if (planDescEl) {
        if (info.cancel_at_period_end) {
          planDescEl.textContent = t('settings.billing.plan_desc_scheduled', { date: dateFormatted }) ||
            `Tu plan expirará el ${dateFormatted}. Conservas todos tus beneficios hasta esa fecha.`;
        } else {
          const amountText = info.amount > 0 ? `USD $${info.amount.toFixed(2)} - ` : '';
          planDescEl.textContent = t('settings.billing.plan_desc_active', { amount: amountText, date: dateFormatted }) ||
            `${amountText}Próximo cobro programado para el ${dateFormatted}.`;
        }
      }

      if (btnUpgrade) {
        btnUpgrade.textContent = t('settings.billing.btn_change_plan') || 'Cambiar de plan';
        btnUpgrade.onclick = (e) => {
          e.preventDefault();
          navigate('/upgrade');
        };
      }

      // Mostrar ítems de renovación automática y cancelación
      if (itemAutoRenewal) itemAutoRenewal.style.display = 'flex';
      if (dividerAutoRenewal) dividerAutoRenewal.style.display = 'block';
      if (itemCancelSub) itemCancelSub.style.display = 'flex';
      if (dividerCancelSub) dividerCancelSub.style.display = 'block';

      if (btnToggleRenewal && autoRenewalDesc) {
        if (info.cancel_at_period_end) {
          autoRenewalDesc.textContent = t('settings.billing.auto_renewal_paused_desc') ||
            'La renovación automática está pausada. Tu suscripción no se cobrará nuevamente.';
          btnToggleRenewal.textContent = t('settings.billing.btn_reactivate_renewal') || 'Reactivar renovación';
          btnToggleRenewal.className = 'btn btn--h34 btn--black';
          btnToggleRenewal.onclick = (e) => {
            e.preventDefault();
            handleToggleAutoRenewal(false);
          };
        } else {
          autoRenewalDesc.textContent = t('settings.billing.auto_renewal_active_desc', { date: dateFormatted }) ||
            `Tu suscripción se renovará automáticamente el ${dateFormatted}.`;
          btnToggleRenewal.textContent = t('settings.billing.btn_cancel_renewal') || 'Cancelar renovación';
          btnToggleRenewal.className = 'btn btn--h34';
          btnToggleRenewal.onclick = (e) => {
            e.preventDefault();
            handleToggleAutoRenewal(true, dateFormatted);
          };
        }
      }
    } else {
      // Plan Gratuito
      if (planNameEl) planNameEl.textContent = t('settings.billing.free_plan_title') || 'Plan Gratuito';
      if (planStatusBadge) planStatusBadge.style.display = 'none';
      if (planDescEl) {
        planDescEl.textContent = t('settings.billing.free_plan_desc') ||
          'Actualmente disfrutas del plan básico gratuito de Spriteboard.';
      }

      if (btnUpgrade) {
        btnUpgrade.textContent = t('settings.billing.btn_explore_plans') || 'Explorar planes';
        btnUpgrade.onclick = (e) => {
          e.preventDefault();
          navigate('/upgrade');
        };
      }

      if (itemAutoRenewal) itemAutoRenewal.style.display = 'none';
      if (dividerAutoRenewal) dividerAutoRenewal.style.display = 'none';
      if (itemCancelSub) itemCancelSub.style.display = 'none';
      if (dividerCancelSub) dividerCancelSub.style.display = 'none';
    }
  };

  // 3. Manejo de conmutación de renovación automática
  const handleToggleAutoRenewal = (cancelAtPeriodEnd, dateFormatted = '') => {
    if (cancelAtPeriodEnd) {
      openModal({
        title: t('settings.billing.modal_cancel_renewal_title') || '¿Cancelar renovación automática?',
        description: t('settings.billing.modal_cancel_renewal_desc', { date: dateFormatted }) ||
          `Tu suscripción no se renovará al concluir el ciclo actual. Mantendrás todas tus funciones premium hasta el ${dateFormatted}.`,
        confirmText: t('settings.billing.btn_confirm_cancel_renewal') || 'Confirmar cancelación',
        confirmClass: 'btn--black',
        cancelText: t('modal.cancel') || 'Volver',
        onConfirm: async () => {
          const res = await updateAutoRenewalApi(true);
          if (res.success) {
            showToast(t('settings.billing.toast_renewal_paused') || 'Renovación automática cancelada.', 'info');
            await loadBillingData();
          } else {
            showToast(res.error || t('toasts.generic_error'), 'error');
          }
        },
      });
    } else {
      (async () => {
        const res = await updateAutoRenewalApi(false);
        if (res.success) {
          showToast(t('settings.billing.toast_renewal_active') || 'Renovación automática reactivada.', 'success');
          await loadBillingData();
        } else {
          showToast(res.error || t('toasts.generic_error'), 'error');
        }
      })();
    }
  };

  // 4. Manejo de cancelación inmediata de suscripción
  const btnCancelImmediate = container.querySelector('[data-ref="btn-cancel-subscription-immediate"]');
  btnCancelImmediate?.addEventListener('click', (e) => {
    e.preventDefault();
    openModal({
      title: t('settings.billing.modal_cancel_immediate_title') || '¿Cancelar tu suscripción ahora?',
      description: t('settings.billing.modal_cancel_immediate_desc') ||
        'Esta acción cancelará tu suscripción de inmediato. Perderás tus funciones premium y almacenamiento adicional en este momento, volviendo al plan gratuito.',
      confirmText: t('settings.billing.btn_confirm_cancel_immediate') || 'Cancelar suscripción ahora',
      confirmClass: 'btn--danger',
      cancelText: t('modal.cancel') || 'Mantener mi plan',
      onConfirm: async () => {
        const res = await cancelSubscriptionImmediateApi();
        if (res.success) {
          await checkAuthSession();
          window.dispatchEvent(new CustomEvent('subscription-updated', { detail: currentUser }));
          showToast(t('settings.billing.toast_subscription_cancelled') || 'Tu suscripción ha sido cancelada.', 'info');
          await loadBillingData();
        } else {
          showToast(res.error || t('toasts.generic_error'), 'error');
        }
      },
    });
  });

  // 5. Cargar y renderizar métodos de pago
  const loadPaymentMethods = async () => {
    const listContainer = container.querySelector('[data-ref="payment-methods-list"]');
    if (!listContainer) return;

    const res = await getPaymentMethodsApi();
    const pms = res.paymentMethods || [];

    if (pms.length === 0) {
      listContainer.innerHTML = `
        <div class="settings-item" data-ref="payment-methods-empty" style="padding: 24px; color: var(--text-muted); font-size: 14px;">
          <span>${escapeHtml(t('settings.billing.no_payment_methods') || 'No tienes tarjetas de pago guardadas.')}</span>
        </div>
      `;
      return;
    }

    listContainer.innerHTML = '';
    pms.forEach((pm, idx) => {
      const item = document.createElement('div');
      item.className = 'settings-item';
      item.setAttribute('data-ref', `payment-method-item-${pm.id}`);

      const brandUpper = (pm.brand || 'Card').toUpperCase();
      const expFormatted = `${String(pm.exp_month).padStart(2, '0')}/${String(pm.exp_year).slice(-2)}`;

      item.innerHTML = `
        <div class="settings-item__content" data-ref="payment-method-content-${pm.id}">
          <div class="settings-item__icon-box" data-ref="payment-method-icon-${pm.id}">
            <span class="material-symbols-rounded">credit_card</span>
          </div>
          <div class="settings-item__text" data-ref="payment-method-text-${pm.id}">
            <div style="display: flex; align-items: center; gap: 8px;">
              <h3 class="settings-item__title" data-ref="payment-method-title-${pm.id}">${escapeHtml(brandUpper)} •••• ${escapeHtml(pm.last4)}</h3>
              ${pm.is_default ? `<span class="component-badge component-badge--sm component-badge--success" data-ref="badge-default-${pm.id}">${escapeHtml(t('settings.billing.badge_default_card') || 'Predeterminada')}</span>` : ''}
            </div>
            <p class="settings-item__desc" data-ref="payment-method-desc-${pm.id}">${escapeHtml(t('settings.billing.card_expires') || 'Vence:')} ${escapeHtml(expFormatted)}</p>
          </div>
        </div>
        <div class="settings-item__actions" data-ref="payment-method-actions-${pm.id}">
          ${!pm.is_default ? `
            <button type="button" class="btn btn--h34" data-ref="btn-set-default-${pm.id}">
              ${escapeHtml(t('settings.billing.btn_set_default') || 'Hacer predeterminada')}
            </button>
          ` : ''}
          <button type="button" class="btn btn--h34 btn--icon" data-ref="btn-delete-pm-${pm.id}" data-tooltip="${escapeHtml(t('settings.billing.btn_delete_card') || 'Eliminar tarjeta')}" aria-label="${escapeHtml(t('settings.billing.btn_delete_card') || 'Eliminar tarjeta')}">
            <span class="material-symbols-rounded" style="font-size: 18px;">delete</span>
          </button>
        </div>
      `;

      // Evento establecer como predeterminada
      const btnSetDefault = item.querySelector(`[data-ref="btn-set-default-${pm.id}"]`);
      btnSetDefault?.addEventListener('click', async (e) => {
        e.preventDefault();
        btnSetDefault.disabled = true;
        const defaultRes = await setDefaultPaymentMethodApi(pm.id);
        if (defaultRes.success) {
          showToast(t('settings.billing.toast_card_set_default') || 'Tarjeta predeterminada actualizada.', 'success');
          await loadPaymentMethods();
        } else {
          showToast(defaultRes.error || t('toasts.generic_error'), 'error');
          btnSetDefault.disabled = false;
        }
      });

      // Evento eliminar tarjeta
      const btnDelete = item.querySelector(`[data-ref="btn-delete-pm-${pm.id}"]`);
      btnDelete?.addEventListener('click', (e) => {
        e.preventDefault();
        openModal({
          title: t('settings.billing.modal_delete_card_title') || '¿Eliminar método de pago?',
          description: t('settings.billing.modal_delete_card_desc', { brand: brandUpper, last4: pm.last4 }) ||
            `¿Estás seguro de que deseas eliminar tu tarjeta ${brandUpper} terminada en ${pm.last4}?`,
          confirmText: t('modal.delete') || 'Eliminar',
          confirmClass: 'btn--danger',
          cancelText: t('modal.cancel') || 'Cancelar',
          onConfirm: async () => {
            const delRes = await deletePaymentMethodApi(pm.id);
            if (delRes.success) {
              showToast(t('settings.billing.toast_card_deleted') || 'Tarjeta eliminada exitosamente.', 'success');
              await loadPaymentMethods();
            } else {
              showToast(delRes.error || t('toasts.generic_error'), 'error');
            }
          },
        });
      });

      if (idx > 0) {
        const divider = document.createElement('hr');
        divider.className = 'settings-divider';
        listContainer.appendChild(divider);
      }
      listContainer.appendChild(item);
    });
  };

  // 6. Modal interactivo para agregar tarjeta con Stripe Elements
  const btnOpenAddCard = container.querySelector('[data-ref="btn-open-add-card"]');
  btnOpenAddCard?.addEventListener('click', async (e) => {
    e.preventDefault();
    btnOpenAddCard.disabled = true;

    try {
      const [stripe, setupRes] = await Promise.all([loadStripeSdk(), createSetupIntentApi()]);
      if (!setupRes.success || !setupRes.clientSecret) {
        showToast(setupRes.error || t('toasts.generic_error'), 'error');
        btnOpenAddCard.disabled = false;
        return;
      }

      const elements = stripe.elements();
      const isDark = document.documentElement.getAttribute('data-theme') === 'dark' || document.documentElement.classList.contains('dark-theme');

      const cardElement = elements.create('card', {
        style: {
          base: {
            fontSize: '15px',
            color: isDark ? '#ffffff' : '#0f172a',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            '::placeholder': {
              color: isDark ? '#64748b' : '#94a3b8',
            },
          },
          invalid: {
            color: '#ef4444',
            iconColor: '#ef4444',
          },
        },
      });

      const bodyHtml = `
        <div class="stripe-card-form-wrapper" style="display: flex; flex-direction: column; gap: 14px; width: 100%;">
          <p style="margin: 0; font-size: 14px; color: var(--text-secondary);">${escapeHtml(t('settings.billing.card_form_instruction') || 'Ingresa los datos de tu tarjeta de crédito o débito. La información es procesada de forma segura por Stripe.')}</p>
          <div class="stripe-card-box" data-ref="stripe-card-mount-point"></div>
          <div class="banner banner--danger" data-ref="stripe-card-error" style="display: none; font-size: 13px; padding: 10px 14px;"></div>
        </div>
      `;

      openModal({
        title: t('settings.billing.modal_add_card_title') || 'Agregar método de pago',
        bodyHtml,
        confirmText: t('settings.billing.btn_save_card') || 'Guardar tarjeta',
        confirmClass: 'btn--black',
        cancelText: t('modal.cancel') || 'Cancelar',
        onConfirm: async () => {
          const errorBanner = document.querySelector('[data-ref="stripe-card-error"]');
          if (errorBanner) errorBanner.style.display = 'none';

          const { setupIntent, error } = await stripe.confirmCardSetup(setupRes.clientSecret, {
            payment_method: {
              card: cardElement,
            },
          });

          if (error) {
            if (errorBanner) {
              errorBanner.textContent = error.message || 'Error al validar tarjeta.';
              errorBanner.style.display = 'block';
            }
            return false; // Mantener modal abierto
          }

          showToast(t('settings.billing.toast_card_added') || 'Tarjeta agregada exitosamente.', 'success');
          await loadPaymentMethods();
          return true;
        },
        onClose: () => {
          cardElement.destroy();
        },
      });

      // Montar Stripe Card Element dentro del modal
      setTimeout(() => {
        const mountPoint = document.querySelector('[data-ref="stripe-card-mount-point"]');
        if (mountPoint) {
          cardElement.mount(mountPoint);
          cardElement.on('focus', () => mountPoint.classList.add('stripe-card-box--focus'));
          cardElement.on('blur', () => mountPoint.classList.remove('stripe-card-box--focus'));
          cardElement.on('change', (event) => {
            const errorBanner = document.querySelector('[data-ref="stripe-card-error"]');
            if (errorBanner) {
              if (event.error) {
                errorBanner.textContent = event.error.message;
                errorBanner.style.display = 'block';
              } else {
                errorBanner.style.display = 'none';
              }
            }
          });
        }
      }, 50);
    } catch (err) {
      showToast(t('toasts.generic_error') || 'Error al conectar con la pasarela de pagos.', 'error');
    } finally {
      btnOpenAddCard.disabled = false;
    }
  });

  // Inicializar llamadas en paralelo de manera resiliente
  await Promise.allSettled([loadBillingData(), loadPaymentMethods()]);

  return container;
}
