import { AiBreakdownInfo, AiQuotaInfo, BillingDetailsResponse, PaymentMethod, StorageUsageInfo } from '../../types/subscription.types.js';
import { appConfig, cancelSubscriptionImmediateApi, checkAuthSession, createSetupIntentApi, currentUser, deletePaymentMethodApi, escapeHtml, getAiQuotaApi, getBillingDetailsApi, getPaymentMethodsApi, getStorageUsageApi, setDefaultPaymentMethodApi, updateAutoRenewalApi } from '../../services/api.service.js';
import { loadTemplate } from '../../services/template.service.js';
import { navigate } from '../../app-router.js';
import { openModal } from '../../components/modal.component.js';
import { showToast } from '../../services/toast.service.js';
import { t, translateElement } from '../../services/i18n.service.js';

let stripePromise: Promise<any> | null = null;

function loadStripeSdk(): Promise<any> {
  const win = window as any;
  if (win.Stripe && appConfig.stripePublishableKey) {
    return Promise.resolve(win.Stripe(appConfig.stripePublishableKey));
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
          resolve(win.Stripe(appConfig.stripePublishableKey));
        });
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://js.stripe.com/v3/';
      script.async = true;
      script.onload = () => {
        resolve(win.Stripe(appConfig.stripePublishableKey));
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

export async function createBillingView(): Promise<HTMLElement> {
  const container = await loadTemplate('/views/settings/billing.html');
  translateElement(container);

  const accordionHeaderSub = container.querySelector<HTMLElement>(
    '[data-ref="accordion-header-subscription"]'
  );
  const groupSub = container.querySelector<HTMLElement>('[data-ref="group-subscription-plan"]');
  accordionHeaderSub?.addEventListener('click', (e) => {
    e.preventDefault();
    groupSub?.classList.toggle('is-active');
  });

  const accordionHeaderPm = container.querySelector<HTMLElement>(
    '[data-ref="accordion-header-payment-methods"]'
  );
  const groupPm = container.querySelector<HTMLElement>('[data-ref="group-payment-methods"]');
  accordionHeaderPm?.addEventListener('click', (e) => {
    e.preventDefault();
    groupPm?.classList.toggle('is-active');
  });

  const accordionHeaderStorage = container.querySelector<HTMLElement>(
    '[data-ref="accordion-header-storage"]'
  );
  const groupStorage = container.querySelector<HTMLElement>('[data-ref="group-storage-usage"]');
  accordionHeaderStorage?.addEventListener('click', (e) => {
    e.preventDefault();
    groupStorage?.classList.toggle('is-active');
  });

  const accordionHeaderAi = container.querySelector<HTMLElement>(
    '[data-ref="accordion-header-ai-quota"]'
  );
  const groupAi = container.querySelector<HTMLElement>('[data-ref="group-ai-quota"]');
  accordionHeaderAi?.addEventListener('click', (e) => {
    e.preventDefault();
    groupAi?.classList.toggle('is-active');
  });

  const renderSubscriptionPlan = (info: BillingDetailsResponse) => {
    const planNameEl = container.querySelector<HTMLElement>('[data-ref="current-plan-name"]');
    const planStatusBadge = container.querySelector<HTMLElement>(
      '[data-ref="current-plan-status-badge"]'
    );
    const planDescEl = container.querySelector<HTMLElement>('[data-ref="current-plan-desc"]');
    const btnUpgrade = container.querySelector<HTMLElement>('[data-ref="btn-upgrade-plan"]');

    const itemAutoRenewal = container.querySelector<HTMLElement>('[data-ref="item-auto-renewal"]');
    const dividerAutoRenewal = container.querySelector<HTMLElement>('[data-ref="divider-auto-renewal"]');
    const autoRenewalDesc = container.querySelector<HTMLElement>('[data-ref="auto-renewal-desc"]');
    const btnToggleRenewal = container.querySelector<HTMLElement>(
      '[data-ref="btn-toggle-auto-renewal"]'
    );

    const itemCancelSub = container.querySelector<HTMLElement>('[data-ref="item-cancel-subscription"]');
    const dividerCancelSub = container.querySelector<HTMLElement>('[data-ref="divider-cancel-sub"]');

    const hasActiveSub = Boolean(
      info.hasSubscription && info.tier && info.tier !== 'free' && info.tier !== 'none'
    );

    if (hasActiveSub) {
      const tierFormatted = info.tier!.charAt(0).toUpperCase() + info.tier!.slice(1);
      const intervalText =
        info.interval === 'year'
          ? t('upgrade.billing_yearly') || 'Anual'
          : t('upgrade.billing_monthly') || 'Mensual';
      if (planNameEl) planNameEl.textContent = `Spriteboard ${tierFormatted} (${intervalText})`;

      let dateFormatted = '';
      if (info.current_period_end) {
        try {
          const d = new Date(info.current_period_end);
          dateFormatted = d.toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          });
        } catch (_) {}
      }

      if (planStatusBadge) {
        planStatusBadge.style.display = 'inline-flex';
        if (info.cancel_at_period_end) {
          planStatusBadge.className =
            'component-badge component-badge--sm component-badge--warning';
          planStatusBadge.textContent =
            t('settings.billing.status_cancel_scheduled') || 'Cancelación programada';
        } else {
          planStatusBadge.className =
            'component-badge component-badge--sm component-badge--success';
          planStatusBadge.textContent = t('settings.billing.status_active') || 'Activo';
        }
      }

      if (planDescEl) {
        if (info.cancel_at_period_end) {
          planDescEl.textContent =
            t('settings.billing.plan_desc_scheduled', { date: dateFormatted }) ||
            `Tu plan expirará el ${dateFormatted}. Conservas todos tus beneficios hasta esa fecha.`;
        } else {
          const amountVal = info.amount || 0;
          const amountText = amountVal > 0 ? `USD $${amountVal.toFixed(2)} - ` : '';
          planDescEl.textContent =
            t('settings.billing.plan_desc_active', {
              amount: amountText,
              date: dateFormatted,
            }) || `${amountText}Próximo cobro programado para el ${dateFormatted}.`;
        }
      }

      if (btnUpgrade) {
        btnUpgrade.textContent =
          t('settings.billing.btn_change_plan') || 'Cambiar de plan';
        btnUpgrade.onclick = (e) => {
          e.preventDefault();
          navigate('/upgrade');
        };
      }

      if (itemAutoRenewal) itemAutoRenewal.style.display = 'flex';
      if (dividerAutoRenewal) dividerAutoRenewal.style.display = 'block';
      if (itemCancelSub) itemCancelSub.style.display = 'flex';
      if (dividerCancelSub) dividerCancelSub.style.display = 'block';

      if (btnToggleRenewal && autoRenewalDesc) {
        if (info.cancel_at_period_end) {
          autoRenewalDesc.textContent =
            t('settings.billing.auto_renewal_paused_desc') ||
            'La renovación automática está pausada. Tu suscripción no se cobrará nuevamente.';
          btnToggleRenewal.textContent =
            t('settings.billing.btn_reactivate_renewal') || 'Reactivar renovación';
          btnToggleRenewal.className = 'component-button component-button--h34 component-button--black';
          btnToggleRenewal.onclick = (e) => {
            e.preventDefault();
            handleToggleAutoRenewal(false);
          };
        } else {
          autoRenewalDesc.textContent =
            t('settings.billing.auto_renewal_active_desc', { date: dateFormatted }) ||
            `Tu suscripción se renovará automáticamente el ${dateFormatted}.`;
          btnToggleRenewal.textContent =
            t('settings.billing.btn_cancel_renewal') || 'Cancelar renovación';
          btnToggleRenewal.className = 'component-button component-button--h34';
          btnToggleRenewal.onclick = (e) => {
            e.preventDefault();
            handleToggleAutoRenewal(true, dateFormatted);
          };
        }
      }
    } else if (
      info.tier &&
      ['business', 'negocios', 'pro'].includes(info.tier.toLowerCase()) &&
      info.tier.toLowerCase() !== 'free' &&
      info.tier.toLowerCase() !== 'none'
    ) {
      const activeTier = info.tier.toLowerCase();
      let displayName = t('upgrade_modal.plan_pro_name') || 'Spriteboard Pro';
      let descText = t('upgrade_modal.plan_pro_desc') || 'Para profesionales y creadores independientes.';
      if (activeTier === 'business' || activeTier === 'negocios') {
        displayName = t('upgrade_modal.plan_business_name') || 'Spriteboard Negocios';
        descText = t('upgrade_modal.plan_business_desc') || 'Plan para equipos de desarrollo y estudios creativos.';
      }

      if (planNameEl) planNameEl.textContent = displayName;
      if (planStatusBadge) {
        planStatusBadge.style.display = 'inline-flex';
        planStatusBadge.className = 'component-badge component-badge--sm component-badge--success';
        planStatusBadge.textContent = t('settings.billing.status_active') || 'Activo';
      }
      if (planDescEl) {
        planDescEl.textContent = descText;
      }

      if (btnUpgrade) {
        btnUpgrade.textContent = t('settings.billing.btn_change_plan') || 'Cambiar de plan';
        btnUpgrade.onclick = (e) => {
          e.preventDefault();
          navigate('/upgrade');
        };
      }

      if (itemAutoRenewal) itemAutoRenewal.style.display = 'none';
      if (dividerAutoRenewal) dividerAutoRenewal.style.display = 'none';
      if (itemCancelSub) itemCancelSub.style.display = 'none';
      if (dividerCancelSub) dividerCancelSub.style.display = 'none';
    } else {
      if (planNameEl)
        planNameEl.textContent = t('settings.billing.free_plan_title') || 'Plan Gratuito';
      if (planStatusBadge) planStatusBadge.style.display = 'none';
      if (planDescEl) {
        planDescEl.textContent =
          t('settings.billing.free_plan_desc') ||
          'Actualmente disfrutas del plan básico gratuito de Spriteboard.';
      }

      if (btnUpgrade) {
        btnUpgrade.textContent =
          t('settings.billing.btn_explore_plans') || 'Explorar planes';
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

  const renderStorageUsage = (storage?: StorageUsageInfo) => {
    if (!storage) return;

    const usedLabel = container.querySelector<HTMLElement>('[data-ref="storage-used-label"]');
    const limitLabel = container.querySelector<HTMLElement>('[data-ref="storage-limit-label"]');
    const percentBadge = container.querySelector<HTMLElement>('[data-ref="storage-percent-badge"]');
    const meterFill = container.querySelector<HTMLElement>('[data-ref="storage-meter-fill"]');
    const meterTrack = container.querySelector<HTMLElement>('[data-ref="storage-meter-track"]');
    const remainingText = container.querySelector<HTMLElement>('[data-ref="storage-remaining-text"]');
    const btnStorageUpgrade = container.querySelector<HTMLElement>('[data-ref="btn-storage-upgrade"]');

    if (usedLabel) usedLabel.textContent = storage.usedFormatted;
    if (limitLabel) limitLabel.textContent = storage.limitFormatted;

    if (percentBadge) {
      percentBadge.textContent = `${storage.percentage}% en uso`;
      if (storage.isOverLimit) {
        percentBadge.className = 'component-badge component-badge--sm component-badge--danger';
      } else if (storage.isNearLimit) {
        percentBadge.className = 'component-badge component-badge--sm component-badge--warning';
      } else {
        percentBadge.className = 'component-badge component-badge--sm';
      }
    }

    if (meterFill) {
      meterFill.style.width = `${Math.min(100, Math.max(storage.percentage, storage.usedBytes > 0 ? 0.5 : 0))}%`;
      meterFill.classList.remove('storage-meter__fill--warning', 'storage-meter__fill--danger');
      if (storage.isOverLimit) {
        meterFill.classList.add('storage-meter__fill--danger');
      } else if (storage.isNearLimit) {
        meterFill.classList.add('storage-meter__fill--warning');
      }
    }

    if (meterTrack) {
      meterTrack.setAttribute('aria-valuenow', String(storage.percentage));
    }

    if (remainingText) {
      if (storage.isOverLimit) {
        remainingText.textContent = t('settings.billing.storage_over_limit') || 'Has alcanzado el límite de almacenamiento de tu plan.';
      } else {
        remainingText.textContent = t('settings.billing.storage_remaining_label', { amount: storage.remainingFormatted }) || `Te quedan ${storage.remainingFormatted} de espacio disponible`;
      }
    }

    if (btnStorageUpgrade) {
      if (storage.limitBytes >= 500 * 1024 * 1024 * 1024) {
        btnStorageUpgrade.textContent = t('settings.billing.tier_business_badge') || `${storage.tierName} (${storage.limitFormatted})`;
        btnStorageUpgrade.onclick = (e) => {
          e.preventDefault();
          navigate('/upgrade');
        };
      } else {
        btnStorageUpgrade.textContent = t('settings.billing.btn_increase_storage') || 'Aumentar almacenamiento';
        btnStorageUpgrade.onclick = (e) => {
          e.preventDefault();
          navigate('/upgrade');
        };
      }
    }

    const canvasesSizeEl = container.querySelector<HTMLElement>('[data-ref="storage-canvases-size"]');
    const canvasesCountEl = container.querySelector<HTMLElement>('[data-ref="storage-canvases-count"]');
    if (canvasesSizeEl) canvasesSizeEl.textContent = storage.breakdown.canvases.formatted;
    if (canvasesCountEl) {
      const count = storage.breakdown.canvases.count || 0;
      canvasesCountEl.textContent = `${count} ${count === 1 ? 'proyecto' : 'proyectos'}`;
    }

    const snapshotsSizeEl = container.querySelector<HTMLElement>('[data-ref="storage-snapshots-size"]');
    const snapshotsCountEl = container.querySelector<HTMLElement>('[data-ref="storage-snapshots-count"]');
    if (snapshotsSizeEl) snapshotsSizeEl.textContent = storage.breakdown.snapshots.formatted;
    if (snapshotsCountEl) {
      const count = storage.breakdown.snapshots.count || 0;
      snapshotsCountEl.textContent = `${count} ${count === 1 ? 'versión' : 'versiones'}`;
    }

    const trashSizeEl = container.querySelector<HTMLElement>('[data-ref="storage-trash-size"]');
    const trashCountEl = container.querySelector<HTMLElement>('[data-ref="storage-trash-count"]');
    if (trashSizeEl) trashSizeEl.textContent = storage.breakdown.trash.formatted;
    if (trashCountEl) {
      const count = storage.breakdown.trash.count || 0;
      trashCountEl.textContent = `${count} ${count === 1 ? 'elemento' : 'elementos'}`;
    }

    const uploadsSizeEl = container.querySelector<HTMLElement>('[data-ref="storage-uploads-size"]');
    const uploadsCountEl = container.querySelector<HTMLElement>('[data-ref="storage-uploads-count"]');
    if (uploadsSizeEl) uploadsSizeEl.textContent = storage.breakdown.uploads.formatted;
    if (uploadsCountEl) {
      const count = storage.breakdown.uploads.count || 0;
      uploadsCountEl.textContent = `${count} ${count === 1 ? 'archivo' : 'archivos'}`;
    }
  };

  let aiCountdownInterval: number | null = null;

  const formatCountdown = (totalSeconds: number): string => {
    if (totalSeconds <= 0) return '00s';
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    if (hours > 0) {
      return `${hours}h ${String(minutes).padStart(2, '0')}m ${String(seconds).padStart(2, '0')}s`;
    }
    if (minutes > 0) {
      return `${minutes}m ${String(seconds).padStart(2, '0')}s`;
    }
    return `${seconds}s`;
  };

  const renderAiQuota = (aiQuota?: AiQuotaInfo, breakdown?: AiBreakdownInfo) => {
    if (!aiQuota) return;

    if (aiCountdownInterval) {
      clearInterval(aiCountdownInterval);
      aiCountdownInterval = null;
    }

    const usedLabel = container.querySelector<HTMLElement>('[data-ref="ai-quota-used-label"]');
    const limitLabel = container.querySelector<HTMLElement>('[data-ref="ai-quota-limit-label"]');
    const percentBadge = container.querySelector<HTMLElement>('[data-ref="ai-quota-percent-badge"]');
    const meterFill = container.querySelector<HTMLElement>('[data-ref="ai-quota-meter-fill"]');
    const meterTrack = container.querySelector<HTMLElement>('[data-ref="ai-quota-meter-track"]');
    const remainingText = container.querySelector<HTMLElement>('[data-ref="ai-quota-remaining-text"]');
    const resetTimerBadge = container.querySelector<HTMLElement>('[data-ref="ai-quota-reset-timer"]');
    const resetTimerText = container.querySelector<HTMLElement>('[data-ref="ai-quota-reset-timer-text"]');
    const cycleText = container.querySelector<HTMLElement>('[data-ref="ai-quota-cycle-text"]');

    if (usedLabel) usedLabel.textContent = aiQuota.tokensUsedFormatted || '0';
    if (limitLabel) limitLabel.textContent = `${aiQuota.tokensLimitFormatted || '0'} tokens`;

    if (percentBadge) {
      percentBadge.textContent = `${aiQuota.percentage}% en uso`;
      if (aiQuota.isOverLimit) {
        percentBadge.className = 'component-badge component-badge--sm component-badge--danger';
      } else if (aiQuota.percentage >= 80) {
        percentBadge.className = 'component-badge component-badge--sm component-badge--warning';
      } else {
        percentBadge.className = 'component-badge component-badge--sm';
      }
    }

    if (meterFill) {
      meterFill.style.width = `${Math.min(100, Math.max(aiQuota.percentage, aiQuota.tokensUsed > 0 ? 0.5 : 0))}%`;
      meterFill.classList.remove('storage-meter__fill--warning', 'storage-meter__fill--danger');
      if (aiQuota.isOverLimit) {
        meterFill.classList.add('storage-meter__fill--danger');
      } else if (aiQuota.percentage >= 80) {
        meterFill.classList.add('storage-meter__fill--warning');
      }
    }

    if (meterTrack) {
      meterTrack.setAttribute('aria-valuenow', String(aiQuota.percentage));
    }

    if (remainingText) {
      if (aiQuota.isOverLimit) {
        remainingText.textContent = t('settings.billing.ai_quota_over_limit') || 'Límite alcanzado en el ciclo actual. Se restablecerá al reiniciar.';
      } else {
        remainingText.textContent = t('settings.billing.ai_quota_remaining', { amount: aiQuota.tokensRemainingFormatted }) || `Te quedan ${aiQuota.tokensRemainingFormatted} tokens en este ciclo`;
      }
    }

    let remainingSecs = Math.max(0, aiQuota.secondsRemaining || 0);

    const updateTimerDisplay = () => {
      if (!resetTimerText) return;
      if (remainingSecs > 0) {
        resetTimerText.textContent = t('settings.billing.ai_quota_reset_in', { time: formatCountdown(remainingSecs) }) || `Reinicio en ${formatCountdown(remainingSecs)}`;
        if (resetTimerBadge) {
          resetTimerBadge.className = aiQuota.isOverLimit
            ? 'component-badge component-badge--sm component-badge--warning'
            : 'component-badge component-badge--sm component-badge--info';
        }
      } else {
        resetTimerText.textContent = t('settings.billing.ai_quota_cycle_inactive') || 'Ciclo inactivo (comienza al generar)';
        if (resetTimerBadge) {
          resetTimerBadge.className = 'component-badge component-badge--sm';
        }
      }
    };

    updateTimerDisplay();

    if (remainingSecs > 0) {
      aiCountdownInterval = window.setInterval(() => {
        if (!container.isConnected) {
          if (aiCountdownInterval) {
            clearInterval(aiCountdownInterval);
            aiCountdownInterval = null;
          }
          return;
        }
        remainingSecs -= 1;
        if (remainingSecs <= 0) {
          if (aiCountdownInterval) {
            clearInterval(aiCountdownInterval);
            aiCountdownInterval = null;
          }
          remainingSecs = 0;
          updateTimerDisplay();
          loadBillingData();
        } else {
          updateTimerDisplay();
        }
      }, 1000);
    }

    if (cycleText) {
      if (aiQuota.cycleResetAt && remainingSecs > 0) {
        try {
          const resetDate = new Date(aiQuota.cycleResetAt);
          const timeStr = resetDate.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
          cycleText.textContent = t('settings.billing.ai_quota_cycle_resets_at', { time: timeStr }) || `Ciclo finaliza: ${timeStr}`;
        } catch {
          cycleText.textContent = t('settings.billing.ai_quota_window_note') || 'Ventana de 12 horas';
        }
      } else {
        cycleText.textContent = t('settings.billing.ai_quota_window_note') || 'Ventana de 12 horas';
      }
    }

    const mindmapsTokensEl = container.querySelector<HTMLElement>('[data-ref="ai-mindmaps-tokens"]');
    const mindmapsCountEl = container.querySelector<HTMLElement>('[data-ref="ai-mindmaps-count"]');
    if (mindmapsTokensEl) mindmapsTokensEl.textContent = `${breakdown?.mindmap.formatted || '0'} tokens`;
    if (mindmapsCountEl) {
      const count = breakdown?.mindmap.count || 0;
      mindmapsCountEl.textContent = `${count} ${count === 1 ? 'generación' : 'generaciones'}`;
    }

    const docsTokensEl = container.querySelector<HTMLElement>('[data-ref="ai-docs-tokens"]');
    const docsCountEl = container.querySelector<HTMLElement>('[data-ref="ai-docs-count"]');
    if (docsTokensEl) docsTokensEl.textContent = `${breakdown?.doc.formatted || '0'} tokens`;
    if (docsCountEl) {
      const count = breakdown?.doc.count || 0;
      docsCountEl.textContent = `${count} ${count === 1 ? 'generación' : 'generaciones'}`;
    }

    const boardsTokensEl = container.querySelector<HTMLElement>('[data-ref="ai-boards-tokens"]');
    const boardsCountEl = container.querySelector<HTMLElement>('[data-ref="ai-boards-count"]');
    if (boardsTokensEl) boardsTokensEl.textContent = `${breakdown?.board.formatted || '0'} tokens`;
    if (boardsCountEl) {
      const count = breakdown?.board.count || 0;
      boardsCountEl.textContent = `${count} ${count === 1 ? 'generación' : 'generaciones'}`;
    }

    const presentationsTokensEl = container.querySelector<HTMLElement>('[data-ref="ai-presentations-tokens"]');
    const presentationsCountEl = container.querySelector<HTMLElement>('[data-ref="ai-presentations-count"]');
    if (presentationsTokensEl) presentationsTokensEl.textContent = `${breakdown?.presentation.formatted || '0'} tokens`;
    if (presentationsCountEl) {
      const count = breakdown?.presentation.count || 0;
      presentationsCountEl.textContent = `${count} ${count === 1 ? 'generación' : 'generaciones'}`;
    }
  };

  const loadBillingData = async () => {
    try {
      const res = await getBillingDetailsApi();
      if (res.success) {
        renderSubscriptionPlan(res);
        if (res.storage) {
          renderStorageUsage(res.storage);
        } else {
          const storageRes = await getStorageUsageApi();
          if (storageRes.success && storageRes.storage) {
            renderStorageUsage(storageRes.storage);
          }
        }
        if (res.aiQuota) {
          renderAiQuota(res.aiQuota, res.aiBreakdown);
        } else {
          const aiRes = await getAiQuotaApi();
          if (aiRes.success && aiRes.aiQuota) {
            renderAiQuota(aiRes.aiQuota, aiRes.aiBreakdown);
          }
        }
      } else {
        renderSubscriptionPlan({ success: false, hasSubscription: false });
        const [storageRes, aiRes] = await Promise.all([getStorageUsageApi(), getAiQuotaApi()]);
        if (storageRes.success && storageRes.storage) {
          renderStorageUsage(storageRes.storage);
        }
        if (aiRes.success && aiRes.aiQuota) {
          renderAiQuota(aiRes.aiQuota, aiRes.aiBreakdown);
        }
      }
    } catch {
      renderSubscriptionPlan({ success: false, hasSubscription: false });
      const [storageRes, aiRes] = await Promise.all([getStorageUsageApi(), getAiQuotaApi()]);
      if (storageRes.success && storageRes.storage) {
        renderStorageUsage(storageRes.storage);
      }
      if (aiRes.success && aiRes.aiQuota) {
        renderAiQuota(aiRes.aiQuota, aiRes.aiBreakdown);
      }
    }
  };

  const handleToggleAutoRenewal = (cancelAtPeriodEnd: boolean, dateFormatted = '') => {
    if (cancelAtPeriodEnd) {
      openModal({
        titleKey: 'settings.billing.modal_cancel_renewal_title',
        descriptionKey: 'settings.billing.modal_cancel_renewal_desc',
        descriptionParams: { date: dateFormatted },
        confirmText:
          t('settings.billing.btn_confirm_cancel_renewal') || 'Confirmar cancelación',
        confirmClass: 'component-button--black',
        cancelText: t('modal.cancel') || 'Volver',
        onConfirm: async (inst) => {
          inst.setConfirmLoading(true);
          try {
            const res = await updateAutoRenewalApi(true);
            if (res.success) {
              inst.close();
              showToast(
                t('settings.billing.toast_renewal_paused') ||
                  'Renovación automática cancelada.',
                'info'
              );
              await loadBillingData();
            } else {
              inst.setConfirmLoading(false);
              showToast(res.error || t('toasts.generic_error'), 'danger');
            }
          } catch {
            inst.setConfirmLoading(false);
            showToast(t('toasts.generic_error'), 'danger');
          }
        },
      });
    } else {
      (async () => {
        const res = await updateAutoRenewalApi(false);
        if (res.success) {
          showToast(
            t('settings.billing.toast_renewal_active') ||
              'Renovación automática reactivada.',
            'success'
          );
          await loadBillingData();
        } else {
          showToast(res.error || t('toasts.generic_error'), 'danger');
        }
      })();
    }
  };

  const btnCancelImmediate = container.querySelector<HTMLElement>(
    '[data-ref="btn-cancel-subscription-immediate"]'
  );
  btnCancelImmediate?.addEventListener('click', (e) => {
    e.preventDefault();
    openModal({
      titleKey: 'settings.billing.modal_cancel_immediate_title',
      descriptionKey: 'settings.billing.modal_cancel_immediate_desc',
      confirmText:
        t('settings.billing.btn_confirm_cancel_immediate') ||
        'Cancelar suscripción ahora',
      confirmClass: 'component-button--danger',
      cancelText: t('modal.cancel') || 'Mantener mi plan',
      onConfirm: async (inst) => {
        inst.setConfirmLoading(true);
        try {
          const res = await cancelSubscriptionImmediateApi();
          if (res.success) {
            await checkAuthSession();
            window.dispatchEvent(
              new CustomEvent('subscription-updated', { detail: currentUser })
            );
            inst.close();
            showToast(
              t('settings.billing.toast_subscription_cancelled') ||
                'Tu suscripción ha sido cancelada.',
              'info'
            );
            await loadBillingData();
          } else {
            inst.setConfirmLoading(false);
            showToast(res.error || t('toasts.generic_error'), 'danger');
          }
        } catch {
          inst.setConfirmLoading(false);
          showToast(t('toasts.generic_error'), 'danger');
        }
      },
    });
  });

  const loadPaymentMethods = async () => {
    const listContainer = container.querySelector<HTMLElement>('[data-ref="payment-methods-list"]');
    if (!listContainer) return;

    const res = await getPaymentMethodsApi();
    const pms: PaymentMethod[] = res.paymentMethods || [];

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
            <button type="button" class="component-button component-button--h34" data-ref="btn-set-default-${pm.id}">
              ${escapeHtml(t('settings.billing.btn_set_default') || 'Hacer predeterminada')}
            </button>
          ` : ''}
          <button type="button" class="component-button component-button--h34 component-button--icon-only" data-ref="btn-delete-pm-${pm.id}" data-tooltip="${escapeHtml(t('settings.billing.btn_delete_card') || 'Eliminar tarjeta')}" aria-label="${escapeHtml(t('settings.billing.btn_delete_card') || 'Eliminar tarjeta')}">
            <span class="material-symbols-rounded" style="font-size: 18px;">delete</span>
          </button>
        </div>
      `;

      const btnSetDefault = item.querySelector<HTMLButtonElement>(`[data-ref="btn-set-default-${pm.id}"]`);
      btnSetDefault?.addEventListener('click', async (e) => {
        e.preventDefault();
        btnSetDefault.disabled = true;
        const defaultRes = await setDefaultPaymentMethodApi(pm.id);
        if (defaultRes.success) {
          showToast(
            t('settings.billing.toast_card_set_default') ||
              'Tarjeta predeterminada actualizada.',
            'success'
          );
          await loadPaymentMethods();
        } else {
          showToast(defaultRes.error || t('toasts.generic_error'), 'danger');
          btnSetDefault.disabled = false;
        }
      });

      const btnDelete = item.querySelector<HTMLElement>(`[data-ref="btn-delete-pm-${pm.id}"]`);
      btnDelete?.addEventListener('click', (e) => {
        e.preventDefault();
        openModal({
          titleKey: 'settings.billing.modal_delete_card_title',
          descriptionKey: 'settings.billing.modal_delete_card_desc',
          descriptionParams: {
            brand: brandUpper,
            last4: pm.last4,
          },
          confirmText: t('modal.delete') || 'Eliminar',
          confirmClass: 'component-button--danger',
          cancelText: t('modal.cancel') || 'Cancelar',
          onConfirm: async (inst) => {
            inst.setConfirmLoading(true);
            try {
              const delRes = await deletePaymentMethodApi(pm.id);
              if (delRes.success) {
                inst.close();
                showToast(
                  t('settings.billing.toast_card_deleted') ||
                    'Tarjeta eliminada exitosamente.',
                  'success'
                );
                await loadPaymentMethods();
              } else {
                inst.setConfirmLoading(false);
                showToast(delRes.error || t('toasts.generic_error'), 'danger');
              }
            } catch {
              inst.setConfirmLoading(false);
              showToast(t('toasts.generic_error'), 'danger');
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

  const btnOpenAddCard = container.querySelector<HTMLButtonElement>('[data-ref="btn-open-add-card"]');
  btnOpenAddCard?.addEventListener('click', async (e) => {
    e.preventDefault();
    btnOpenAddCard.disabled = true;

    try {
      const [stripe, setupRes] = await Promise.all([
        loadStripeSdk(),
        createSetupIntentApi(),
      ]);
      if (!setupRes.success || !setupRes.clientSecret) {
        showToast(setupRes.error || t('toasts.generic_error'), 'danger');
        btnOpenAddCard.disabled = false;
        return;
      }

      const elements = stripe.elements();
      const isDark =
        document.documentElement.getAttribute('data-theme') === 'dark' ||
        document.documentElement.classList.contains('dark-theme');

      const cardElement = elements.create('card', {
        style: {
          base: {
            fontSize: '15px',
            color: isDark ? '#ffffff' : '#0f172a',
            fontFamily:
              '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
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
        titleKey: 'settings.billing.modal_add_card_title',
        bodyHtml,
        confirmText: t('settings.billing.btn_save_card') || 'Guardar tarjeta',
        confirmClass: 'component-button--black',
        cancelText: t('modal.cancel') || 'Cancelar',
        onConfirm: async (inst) => {
          inst.setConfirmLoading(true);
          const errorBanner = document.querySelector<HTMLElement>('[data-ref="stripe-card-error"]');
          if (errorBanner) errorBanner.style.display = 'none';

          const { error } = await stripe.confirmCardSetup(setupRes.clientSecret, {
            payment_method: {
              card: cardElement,
            },
          });

          if (error) {
            inst.setConfirmLoading(false);
            if (errorBanner) {
              errorBanner.textContent = error.message || 'Error al validar tarjeta.';
              errorBanner.style.display = 'block';
            }
            return false;
          }

          inst.close();
          showToast(
            t('settings.billing.toast_card_added') || 'Tarjeta agregada exitosamente.',
            'success'
          );
          await loadPaymentMethods();
          return true;
        },
        onClose: () => {
          cardElement.destroy();
        },
      });

      setTimeout(() => {
        const mountPoint = document.querySelector<HTMLElement>('[data-ref="stripe-card-mount-point"]');
        if (mountPoint) {
          cardElement.mount(mountPoint);
          cardElement.on('focus', () => mountPoint.classList.add('stripe-card-box--focus'));
          cardElement.on('blur', () =>
            mountPoint.classList.remove('stripe-card-box--focus')
          );
          cardElement.on('change', (event: any) => {
            const errorBanner = document.querySelector<HTMLElement>('[data-ref="stripe-card-error"]');
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
    } catch {
      showToast(
        t('toasts.generic_error') || 'Error al conectar con la pasarela de pagos.',
        'danger'
      );
    } finally {
      btnOpenAddCard.disabled = false;
    }
  });

  await Promise.allSettled([loadBillingData(), loadPaymentMethods()]);

  return container;
}
