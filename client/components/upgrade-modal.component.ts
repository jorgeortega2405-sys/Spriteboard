import { navigate } from '../app-router.js';
import { t, translateElement } from '../services/i18n.service.js';
import { renderIcons } from '../services/icon.service.js';

type PlanTier = 'free' | 'pro' | 'business';

let activeUpgradeModal: { close: () => void } | null = null;

export function openUpgradeModal(initialPlan: PlanTier = 'pro'): { close: () => void } {
  if (activeUpgradeModal) {
    activeUpgradeModal.close();
  }

  let selectedPlan: PlanTier = initialPlan === 'free' ? 'pro' : initialPlan;

  const proTitle = t('upgrade_modal.plan_pro_name') || 'Spriteboard Pro';
  const businessTitle = t('upgrade_modal.plan_business_name') || 'Spriteboard Negocios';

  const getPlanName = (p: PlanTier): string => {
    if (p === 'business') return businessTitle;
    return proTitle;
  };

  const getCtaLabel = (p: PlanTier): string => {
    return `${t('upgrade_modal.cta_prefix') || 'Sube de categoría a'} ${getPlanName(p)}`;
  };

  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.setAttribute('data-ref', 'modal-upgrade-backdrop');

  backdrop.innerHTML = `
    <div class="modal-container" data-ref="modal-upgrade-container">
      <button type="button" class="modal-close-btn" data-ref="btn-upgrade-modal-close" data-i18n-aria="modal.close" aria-label="${t('modal.close')}">
        <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#close"></use></svg>
      </button>

      <div class="modal-card modal-card--875x525" data-ref="modal-card-upgrade">
        <div class="modal-card__drag-zone" data-ref="modal-drag-zone" aria-hidden="true">
          <div class="modal-card__drag-handle"></div>
        </div>

        <div class="modal-split__grid" data-ref="modal-split-grid">
          <div class="modal-split__left" data-ref="modal-split-left">
            <div class="modal-split__left-top" data-ref="modal-split-left-top">
              <div class="modal-split__heading" data-ref="modal-split-heading">
                <h2 class="modal-split__title">
                  <span class="modal-split__title-prefix">${t('upgrade_modal.title_prefix') || 'Sube de categoría a'}</span>
                  <span class="modal-split__title-plan" data-ref="plan-title-highlight">${getPlanName(selectedPlan)}</span>
                </h2>
                <p class="modal-split__subtitle">${t('upgrade_modal.choose_plan') || 'Elige tu plan.'}</p>
              </div>

              <div class="modal-split__plans" data-ref="modal-split-plans">
                <div class="modal-split-plan-card upgrade-plan-card${selectedPlan === 'pro' ? ' is-selected' : ''}" data-ref="card-plan-pro" data-plan="pro">
                  <div class="modal-split-plan-card__radio upgrade-plan-card__radio" data-ref="radio-plan-pro">
                    <span class="modal-split-plan-card__dot upgrade-plan-card__dot"></span>
                  </div>
                  <div class="modal-split-plan-card__info upgrade-plan-card__info">
                    <div class="modal-split-plan-card__header-row upgrade-plan-card__header-row">
                      <span class="modal-split-plan-card__name upgrade-plan-card__name">${proTitle}</span>
                      <span class="modal-split-plan-card__price upgrade-plan-card__price">${t('upgrade_modal.plan_pro_price') || '$9.99/mes'}</span>
                    </div>
                    <span class="modal-split-plan-card__desc upgrade-plan-card__desc">${t('upgrade_modal.plan_pro_desc') || 'Para profesionales y creadores exigentes.'}</span>
                  </div>
                </div>

                <div class="modal-split-plan-card upgrade-plan-card${selectedPlan === 'business' ? ' is-selected' : ''}" data-ref="card-plan-business" data-plan="business">
                  <div class="modal-split-plan-card__radio upgrade-plan-card__radio" data-ref="radio-plan-business">
                    <span class="modal-split-plan-card__dot upgrade-plan-card__dot"></span>
                  </div>
                  <div class="modal-split-plan-card__info upgrade-plan-card__info">
                    <div class="modal-split-plan-card__header-row upgrade-plan-card__header-row">
                      <span class="modal-split-plan-card__name upgrade-plan-card__name">${businessTitle}</span>
                      <span class="modal-split-plan-card__price upgrade-plan-card__price">${t('upgrade_modal.plan_business_price') || '$19.99/mes'}</span>
                    </div>
                    <span class="modal-split-plan-card__desc upgrade-plan-card__desc">${t('upgrade_modal.plan_business_desc') || 'Máxima potencia, colaboración y equipos centralizados.'}</span>
                  </div>
                </div>
              </div>

              <button type="button" class="component-button component-button--h40 component-button--brand component-button--w-full modal-split__btn-cta upgrade-modal__btn-cta" data-ref="btn-upgrade-cta">
                <span class="modal-split__btn-text upgrade-modal__btn-text" data-ref="upgrade-cta-text">${getCtaLabel(selectedPlan)}</span>
              </button>

              <button type="button" class="modal-split__view-all-link upgrade-modal__view-all-link" data-ref="btn-upgrade-view-all">
                <span>${t('upgrade_modal.view_all_link') || 'Ver todos los planes y características'}</span>
                <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#arrow_forward"></use></svg>
              </button>
            </div>
          </div>

          <div class="modal-split__right" data-ref="modal-split-right">
            <div class="modal-split__table-wrapper upgrade-modal__table-wrapper" data-ref="upgrade-table-wrapper" data-plan="${selectedPlan}">
              <div class="modal-split__active-indicator upgrade-modal__active-indicator" data-ref="active-column-indicator"></div>
              <table class="modal-split__table upgrade-modal__table" data-ref="upgrade-comparison-table">
                <thead>
                  <tr>
                    <th class="col-feature">${t('upgrade_modal.col_benefits') || 'Beneficios'}</th>
                    <th class="col-plan col-plan--pro${selectedPlan === 'pro' ? ' is-active' : ''}" data-ref="th-plan-pro">${t('upgrade_modal.col_pro') || 'Pro'}</th>
                    <th class="col-plan col-plan--business${selectedPlan === 'business' ? ' is-active' : ''}" data-ref="th-plan-business">${t('upgrade_modal.col_business') || 'Negocios'}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td class="col-feature">
                      <span>${t('upgrade_modal.benefit_storage') || 'Almacenamiento en la nube'}</span>
                    </td>
                    <td class="col-plan col-plan--pro${selectedPlan === 'pro' ? ' is-active' : ''}">100 GB</td>
                    <td class="col-plan col-plan--business${selectedPlan === 'business' ? ' is-active' : ''}">500 GB</td>
                  </tr>
                  <tr>
                    <td class="col-feature">
                      <span>${t('upgrade_modal.benefit_collab') || 'Colaboración en vivo'}</span>
                    </td>
                    <td class="col-plan col-plan--pro${selectedPlan === 'pro' ? ' is-active' : ''}">Hasta 6 personas</td>
                    <td class="col-plan col-plan--business${selectedPlan === 'business' ? ' is-active' : ''}">Hasta 50 personas</td>
                  </tr>
                  <tr>
                    <td class="col-feature">
                      <span>${t('upgrade_modal.benefit_teams') || 'Equipos de trabajo'}</span>
                    </td>
                    <td class="col-plan col-plan--pro${selectedPlan === 'pro' ? ' is-active' : ''}">—</td>
                    <td class="col-plan col-plan--business${selectedPlan === 'business' ? ' is-active' : ''}">Incluido</td>
                  </tr>
                  <tr>
                    <td class="col-feature">
                      <span>${t('upgrade_modal.benefit_sso') || 'Autenticación empresarial SSO'}</span>
                    </td>
                    <td class="col-plan col-plan--pro${selectedPlan === 'pro' ? ' is-active' : ''}">—</td>
                    <td class="col-plan col-plan--business${selectedPlan === 'business' ? ' is-active' : ''}">Incluido</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  translateElement(backdrop);
  renderIcons(backdrop);
  document.body.appendChild(backdrop);
  document.body.classList.add('modal-open');

  const card = backdrop.querySelector<HTMLElement>('[data-ref="modal-card-upgrade"]');
  const cardPro = backdrop.querySelector<HTMLElement>('[data-ref="card-plan-pro"]');
  const cardBusiness = backdrop.querySelector<HTMLElement>('[data-ref="card-plan-business"]');
  const highlightTitle = backdrop.querySelector<HTMLElement>('[data-ref="plan-title-highlight"]');
  const ctaBtn = backdrop.querySelector<HTMLButtonElement>('[data-ref="btn-upgrade-cta"]');
  const ctaTextEl = backdrop.querySelector<HTMLElement>('[data-ref="upgrade-cta-text"]');
  const btnClose = backdrop.querySelector<HTMLButtonElement>('[data-ref="btn-upgrade-modal-close"]');
  const btnViewAll = backdrop.querySelector<HTMLButtonElement>('[data-ref="btn-upgrade-view-all"]');
  const tableWrapper = backdrop.querySelector<HTMLElement>('[data-ref="upgrade-table-wrapper"]');
  const activeIndicator = backdrop.querySelector<HTMLElement>('[data-ref="active-column-indicator"]');
  const dragZone = backdrop.querySelector<HTMLElement>('[data-ref="modal-drag-zone"]');

  const updateIndicatorPosition = (plan: PlanTier) => {
    if (!activeIndicator || !tableWrapper) return;
    const normalized = plan;
    tableWrapper.setAttribute('data-plan', normalized);
    const activeTh = backdrop.querySelector<HTMLElement>(`[data-ref="th-plan-${normalized}"]`);
    const table = backdrop.querySelector<HTMLElement>('[data-ref="upgrade-comparison-table"]');
    if (!activeTh || !table) return;
    const wrapperRect = tableWrapper.getBoundingClientRect();
    const thRect = activeTh.getBoundingClientRect();
    const tableRect = table.getBoundingClientRect();
    if (thRect.width > 0) {
      activeIndicator.style.left = `${thRect.left - wrapperRect.left}px`;
      activeIndicator.style.width = `${thRect.width}px`;
      activeIndicator.style.top = `${tableRect.top - wrapperRect.top}px`;
      activeIndicator.style.height = `${tableRect.height}px`;
    }
  };

  const updateSelectedPlan = (plan: PlanTier) => {
    selectedPlan = plan;
    const normalized = plan;
    cardPro?.classList.toggle('is-selected', normalized === 'pro');
    cardBusiness?.classList.toggle('is-selected', normalized === 'business');

    if (highlightTitle) {
      highlightTitle.textContent = getPlanName(plan);
    }
    if (ctaTextEl) {
      ctaTextEl.textContent = getCtaLabel(plan);
    }

    const proCols = backdrop.querySelectorAll<HTMLElement>('.col-plan--pro');
    const businessCols = backdrop.querySelectorAll<HTMLElement>('.col-plan--business');

    proCols.forEach((el) => el.classList.toggle('is-active', normalized === 'pro'));
    businessCols.forEach((el) => el.classList.toggle('is-active', normalized === 'business'));

    updateIndicatorPosition(plan);
  };

  requestAnimationFrame(() => {
    backdrop.classList.add('is-visible');
    updateIndicatorPosition(selectedPlan);
  });

  const handleResize = () => {
    updateIndicatorPosition(selectedPlan);
  };

  window.addEventListener('resize', handleResize);

  cardPro?.addEventListener('click', () => {
    updateSelectedPlan('pro');
  });

  cardBusiness?.addEventListener('click', () => {
    updateSelectedPlan('business');
  });

  let isClosing = false;

  let startY = 0;
  let currentY = 0;
  let startTime = 0;
  let isDragging = false;
  let activePointerId: number | null = null;

  const detachPointerListeners = () => {
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
    window.removeEventListener('pointercancel', onPointerUp);
  };

  const onPointerDown = (e: PointerEvent) => {
    if (isClosing || !card) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;

    isDragging = true;
    activePointerId = e.pointerId;
    startY = e.clientY;
    currentY = startY;
    startTime = performance.now();

    try {
      (dragZone || card).setPointerCapture(activePointerId);
    } catch (_) {}

    card.style.transition = 'none';
    backdrop.style.transition = 'none';

    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
  };

  const onPointerMove = (e: PointerEvent) => {
    if (!isDragging || (activePointerId !== null && e.pointerId !== activePointerId)) return;
    currentY = e.clientY;
    const diff = currentY - startY;

    if (card) {
      if (diff > 0) {
        card.style.transform = `translateY(${diff}px)`;
        const progress = Math.min(diff / 240, 1);
        backdrop.style.opacity = `${Math.max(0.2, 1 - progress * 0.8)}`;
      } else {
        const rubberDiff = Math.max(diff * 0.15, -24);
        card.style.transform = `translateY(${rubberDiff}px)`;
      }
    }
  };

  const onPointerUp = (e: PointerEvent) => {
    if (!isDragging || (activePointerId !== null && e.pointerId !== activePointerId)) return;
    isDragging = false;
    detachPointerListeners();

    try {
      if (activePointerId !== null) {
        (dragZone || card)?.releasePointerCapture(activePointerId);
      }
    } catch (_) {}
    activePointerId = null;

    const diff = currentY - startY;
    const elapsed = Math.max(1, performance.now() - startTime);
    const velocity = diff / elapsed;

    if (diff > 80 || (diff > 25 && velocity > 0.45)) {
      closeModal();
    } else {
      backdrop.style.transition = 'opacity 0.25s ease';
      backdrop.style.opacity = '1';
      if (card) {
        card.style.transition = 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)';
        card.style.transform = '';
      }
    }
  };

  dragZone?.addEventListener('pointerdown', onPointerDown);
  dragZone?.addEventListener('lostpointercapture', onPointerUp);

  const goToUpgrade = (e: MouseEvent) => {
    e.preventDefault();
    closeModal();
    navigate('/upgrade');
  };

  ctaBtn?.addEventListener('click', goToUpgrade);
  btnViewAll?.addEventListener('click', goToUpgrade);

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      closeModal();
    }
  };

  const handleBackdropClick = (e: MouseEvent) => {
    if (e.target === backdrop) {
      closeModal();
    }
  };

  const closeModal = () => {
    if (isClosing) return;
    isClosing = true;

    window.removeEventListener('keydown', handleKeyDown);
    window.removeEventListener('resize', handleResize);
    detachPointerListeners();
    dragZone?.removeEventListener('pointerdown', onPointerDown);
    dragZone?.removeEventListener('lostpointercapture', onPointerUp);
    backdrop.removeEventListener('click', handleBackdropClick);

    backdrop.classList.remove('is-visible');
    document.body.classList.remove('modal-open');
    setTimeout(() => {
      backdrop.remove();
      if (activeUpgradeModal && activeUpgradeModal.close === closeModal) {
        activeUpgradeModal = null;
      }
    }, 200);
  };

  btnClose?.addEventListener('click', closeModal);
  backdrop.addEventListener('click', handleBackdropClick);
  window.addEventListener('keydown', handleKeyDown);

  activeUpgradeModal = { close: closeModal };

  return activeUpgradeModal;
}
