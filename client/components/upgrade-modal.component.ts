import { navigate } from '../app-router.js';
import { renderIcons } from '../services/icon.service.js';
import { t, translateElement } from '../services/i18n.service.js';

type PlanTier = 'plus' | 'pro' | 'ultra';

let activeUpgradeModal: { close: () => void } | null = null;

export function openUpgradeModal(initialPlan: PlanTier = 'pro'): { close: () => void } {
  if (activeUpgradeModal) {
    activeUpgradeModal.close();
  }

  let selectedPlan: PlanTier = initialPlan;

  const plusTitle = t('upgrade_modal.plan_plus_name') || 'Spriteboard Plus';
  const proTitle = t('upgrade_modal.plan_pro_name') || 'Spriteboard Pro';
  const ultraTitle = t('upgrade_modal.plan_ultra_name') || 'Spriteboard Ultra';

  const getPlanName = (p: PlanTier): string => {
    if (p === 'plus') return plusTitle;
    if (p === 'ultra') return ultraTitle;
    return proTitle;
  };

  const getCtaLabel = (p: PlanTier): string => `${t('upgrade_modal.cta_prefix') || 'Sube de categoría a'} ${getPlanName(p)}`;

  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop is-visible';
  backdrop.setAttribute('data-ref', 'modal-upgrade-backdrop');

  backdrop.innerHTML = `
    <div class="modal-container" data-ref="modal-upgrade-container">
      <button type="button" class="modal-close-btn" data-ref="btn-upgrade-modal-close" data-i18n-aria="modal.close" aria-label="${t('modal.close')}">
        <span class="material-symbols-rounded">close</span>
      </button>

      <div class="modal-card modal-card--875x525" data-ref="modal-card-upgrade">
        <div class="modal-card__drag-zone" data-ref="modal-drag-zone" aria-hidden="true">
          <div class="modal-card__drag-handle"></div>
        </div>

        <div class="modal-split__grid" data-ref="modal-split-grid">
          <div class="upgrade-modal__left" data-ref="upgrade-modal-left">
            <div class="upgrade-modal__left-top" data-ref="upgrade-modal-left-top">
              <div class="upgrade-modal__heading" data-ref="upgrade-modal-heading">
                <h2 class="upgrade-modal__title">
                  <span class="upgrade-modal__title-prefix">${t('upgrade_modal.title_prefix') || 'Sube de categoría a'}</span>
                  <span class="upgrade-modal__title-plan" data-ref="plan-title-highlight">${getPlanName(selectedPlan)}</span>
                </h2>
                <p class="upgrade-modal__subtitle">${t('upgrade_modal.choose_plan') || 'Elige tu plan.'}</p>
              </div>

              <div class="upgrade-modal__plans" data-ref="upgrade-modal-plans">
                <div class="upgrade-plan-card${selectedPlan === 'plus' ? ' is-selected' : ''}" data-ref="card-plan-plus" data-plan="plus">
                  <div class="upgrade-plan-card__radio" data-ref="radio-plan-plus">
                    <span class="upgrade-plan-card__dot"></span>
                  </div>
                  <div class="upgrade-plan-card__info">
                    <div class="upgrade-plan-card__header-row">
                      <span class="upgrade-plan-card__name">${plusTitle}</span>
                      <span class="upgrade-plan-card__price">${t('upgrade_modal.plan_plus_price') || '$4.99/mes'}</span>
                    </div>
                    <span class="upgrade-plan-card__desc">${t('upgrade_modal.plan_plus_desc') || 'Ideal para creadores y uso diario.'}</span>
                  </div>
                </div>

                <div class="upgrade-plan-card${selectedPlan === 'pro' ? ' is-selected' : ''}" data-ref="card-plan-pro" data-plan="pro">
                  <div class="upgrade-plan-card__radio" data-ref="radio-plan-pro">
                    <span class="upgrade-plan-card__dot"></span>
                  </div>
                  <div class="upgrade-plan-card__info">
                    <div class="upgrade-plan-card__header-row">
                      <span class="upgrade-plan-card__name">${proTitle}</span>
                      <span class="upgrade-plan-card__price">${t('upgrade_modal.plan_pro_price') || '$9.99/mes'}</span>
                    </div>
                    <span class="upgrade-plan-card__desc">${t('upgrade_modal.plan_pro_desc') || 'Para profesionales y creadores exigentes.'}</span>
                  </div>
                </div>

                <div class="upgrade-plan-card${selectedPlan === 'ultra' ? ' is-selected' : ''}" data-ref="card-plan-ultra" data-plan="ultra">
                  <div class="upgrade-plan-card__radio" data-ref="radio-plan-ultra">
                    <span class="upgrade-plan-card__dot"></span>
                  </div>
                  <div class="upgrade-plan-card__info">
                    <div class="upgrade-plan-card__header-row">
                      <span class="upgrade-plan-card__name">${ultraTitle}</span>
                      <span class="upgrade-plan-card__price">${t('upgrade_modal.plan_ultra_price') || '$19.99/mes'}</span>
                    </div>
                    <span class="upgrade-plan-card__desc">${t('upgrade_modal.plan_ultra_desc') || 'Máxima potencia, rendimiento sin límites y API.'}</span>
                  </div>
                </div>
              </div>

              <button type="button" class="btn btn--h40 btn--black btn--w-full upgrade-modal__btn-cta" data-ref="btn-upgrade-cta">
                <span class="upgrade-modal__btn-text" data-ref="upgrade-cta-text">${getCtaLabel(selectedPlan)}</span>
              </button>
            </div>

            <button type="button" class="btn btn--h40 btn--w-full upgrade-modal__btn-view-all" data-ref="btn-upgrade-view-all">
              <span>${t('upgrade_modal.view_all_link') || 'Ver todos los planes y características'}</span>
              <span class="material-symbols-rounded">arrow_forward</span>
            </button>
          </div>

          <div class="upgrade-modal__right" data-ref="upgrade-modal-right">
            <div class="upgrade-modal__table-wrapper" data-ref="upgrade-table-wrapper" data-plan="${selectedPlan}">
              <div class="upgrade-modal__active-indicator" data-ref="active-column-indicator"></div>
              <table class="upgrade-modal__table" data-ref="upgrade-comparison-table">
                <thead>
                  <tr>
                    <th class="col-feature">${t('upgrade_modal.col_benefits') || 'Beneficios'}</th>
                    <th class="col-plan col-plan--plus${selectedPlan === 'plus' ? ' is-active' : ''}" data-ref="th-plan-plus">${t('upgrade_modal.col_plus') || 'Plus'}</th>
                    <th class="col-plan col-plan--pro${selectedPlan === 'pro' ? ' is-active' : ''}" data-ref="th-plan-pro">${t('upgrade_modal.col_pro') || 'Pro'}</th>
                    <th class="col-plan col-plan--ultra${selectedPlan === 'ultra' ? ' is-active' : ''}" data-ref="th-plan-ultra">${t('upgrade_modal.col_ultra') || 'Ultra'}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td class="col-feature">
                      <span>${t('upgrade_modal.benefit_storage') || 'Almacenamiento en la nube'}</span>
                    </td>
                    <td class="col-plan col-plan--plus${selectedPlan === 'plus' ? ' is-active' : ''}">1 GB</td>
                    <td class="col-plan col-plan--pro${selectedPlan === 'pro' ? ' is-active' : ''}">10 GB</td>
                    <td class="col-plan col-plan--ultra${selectedPlan === 'ultra' ? ' is-active' : ''}">Ilimitado</td>
                  </tr>
                  <tr>
                    <td class="col-feature">
                      <span>${t('upgrade_modal.benefit_canvases') || 'Tableros y proyectos'}</span>
                    </td>
                    <td class="col-plan col-plan--plus${selectedPlan === 'plus' ? ' is-active' : ''}">Estándar</td>
                    <td class="col-plan col-plan--pro${selectedPlan === 'pro' ? ' is-active' : ''}">Ilimitados</td>
                    <td class="col-plan col-plan--ultra${selectedPlan === 'ultra' ? ' is-active' : ''}">Ilimitados</td>
                  </tr>
                  <tr>
                    <td class="col-feature">
                      <span>${t('upgrade_modal.benefit_export') || 'Exportación'}</span>
                    </td>
                    <td class="col-plan col-plan--plus${selectedPlan === 'plus' ? ' is-active' : ''}">Alta velocidad</td>
                    <td class="col-plan col-plan--pro${selectedPlan === 'pro' ? ' is-active' : ''}">Ultra 4K y SVG</td>
                    <td class="col-plan col-plan--ultra${selectedPlan === 'ultra' ? ' is-active' : ''}">Ultra 4K y SVG</td>
                  </tr>
                  <tr>
                    <td class="col-feature">
                      <span>${t('upgrade_modal.benefit_history') || 'Historial de versiones'}</span>
                    </td>
                    <td class="col-plan col-plan--plus${selectedPlan === 'plus' ? ' is-active' : ''}">30 días</td>
                    <td class="col-plan col-plan--pro${selectedPlan === 'pro' ? ' is-active' : ''}">30 días</td>
                    <td class="col-plan col-plan--ultra${selectedPlan === 'ultra' ? ' is-active' : ''}">Ilimitado</td>
                  </tr>
                  <tr>
                    <td class="col-feature">
                      <span>${t('upgrade_modal.benefit_tools') || 'Herramientas de dibujo'}</span>
                    </td>
                    <td class="col-plan col-plan--plus${selectedPlan === 'plus' ? ' is-active' : ''}">
                      <span class="material-symbols-rounded icon-check">check</span>
                    </td>
                    <td class="col-plan col-plan--pro${selectedPlan === 'pro' ? ' is-active' : ''}">
                      <span class="material-symbols-rounded icon-check">check</span>
                    </td>
                    <td class="col-plan col-plan--ultra${selectedPlan === 'ultra' ? ' is-active' : ''}">
                      <span class="material-symbols-rounded icon-check">check</span>
                    </td>
                  </tr>
                  <tr>
                    <td class="col-feature">
                      <span>${t('upgrade_modal.benefit_collab') || 'Colaboración en tiempo real'}</span>
                    </td>
                    <td class="col-plan col-plan--plus${selectedPlan === 'plus' ? ' is-active' : ''}">—</td>
                    <td class="col-plan col-plan--pro${selectedPlan === 'pro' ? ' is-active' : ''}">
                      <span class="material-symbols-rounded icon-check">check</span>
                    </td>
                    <td class="col-plan col-plan--ultra${selectedPlan === 'ultra' ? ' is-active' : ''}">
                      <span class="material-symbols-rounded icon-check">check</span>
                    </td>
                  </tr>
                  <tr>
                    <td class="col-feature">
                      <span>${t('upgrade_modal.benefit_customization') || 'Personalización avanzada'}</span>
                    </td>
                    <td class="col-plan col-plan--plus${selectedPlan === 'plus' ? ' is-active' : ''}">—</td>
                    <td class="col-plan col-plan--pro${selectedPlan === 'pro' ? ' is-active' : ''}">
                      <span class="material-symbols-rounded icon-check">check</span>
                    </td>
                    <td class="col-plan col-plan--ultra${selectedPlan === 'ultra' ? ' is-active' : ''}">
                      <span class="material-symbols-rounded icon-check">check</span>
                    </td>
                  </tr>
                  <tr>
                    <td class="col-feature">
                      <span>${t('upgrade_modal.benefit_gpu') || 'Potencia de cómputo GPU'}</span>
                    </td>
                    <td class="col-plan col-plan--plus${selectedPlan === 'plus' ? ' is-active' : ''}">Estándar</td>
                    <td class="col-plan col-plan--pro${selectedPlan === 'pro' ? ' is-active' : ''}">Estándar</td>
                    <td class="col-plan col-plan--ultra${selectedPlan === 'ultra' ? ' is-active' : ''}">Acelerada</td>
                  </tr>
                  <tr>
                    <td class="col-feature">
                      <span>${t('upgrade_modal.benefit_beta_api') || 'Acceso beta y API dedicada'}</span>
                    </td>
                    <td class="col-plan col-plan--plus${selectedPlan === 'plus' ? ' is-active' : ''}">—</td>
                    <td class="col-plan col-plan--pro${selectedPlan === 'pro' ? ' is-active' : ''}">—</td>
                    <td class="col-plan col-plan--ultra${selectedPlan === 'ultra' ? ' is-active' : ''}">
                      <span class="material-symbols-rounded icon-check">check</span>
                    </td>
                  </tr>
                  <tr>
                    <td class="col-feature">
                      <span>${t('upgrade_modal.benefit_support') || 'Soporte técnico'}</span>
                    </td>
                    <td class="col-plan col-plan--plus${selectedPlan === 'plus' ? ' is-active' : ''}">Estándar</td>
                    <td class="col-plan col-plan--pro${selectedPlan === 'pro' ? ' is-active' : ''}">Prioritario 24/7</td>
                    <td class="col-plan col-plan--ultra${selectedPlan === 'ultra' ? ' is-active' : ''}">1 a 1 Dedicado</td>
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

  const cardPlus = backdrop.querySelector<HTMLElement>('[data-ref="card-plan-plus"]');
  const cardPro = backdrop.querySelector<HTMLElement>('[data-ref="card-plan-pro"]');
  const cardUltra = backdrop.querySelector<HTMLElement>('[data-ref="card-plan-ultra"]');
  const highlightTitle = backdrop.querySelector<HTMLElement>('[data-ref="plan-title-highlight"]');
  const ctaBtn = backdrop.querySelector<HTMLButtonElement>('[data-ref="btn-upgrade-cta"]');
  const ctaTextEl = backdrop.querySelector<HTMLElement>('[data-ref="upgrade-cta-text"]');
  const btnClose = backdrop.querySelector<HTMLButtonElement>('[data-ref="btn-upgrade-modal-close"]');
  const btnViewAll = backdrop.querySelector<HTMLButtonElement>('[data-ref="btn-upgrade-view-all"]');
  const tableWrapper = backdrop.querySelector<HTMLElement>('[data-ref="upgrade-table-wrapper"]');
  const activeIndicator = backdrop.querySelector<HTMLElement>('[data-ref="active-column-indicator"]');

  const updateIndicatorPosition = (plan: PlanTier) => {
    if (!activeIndicator || !tableWrapper) return;
    tableWrapper.setAttribute('data-plan', plan);
    const activeTh = backdrop.querySelector<HTMLElement>(`[data-ref="th-plan-${plan}"]`);
    if (!activeTh) return;
    const wrapperRect = tableWrapper.getBoundingClientRect();
    const thRect = activeTh.getBoundingClientRect();
    activeIndicator.style.left = `${thRect.left - wrapperRect.left}px`;
    activeIndicator.style.width = `${thRect.width}px`;
  };

  const updateSelectedPlan = (plan: PlanTier) => {
    selectedPlan = plan;
    cardPlus?.classList.toggle('is-selected', plan === 'plus');
    cardPro?.classList.toggle('is-selected', plan === 'pro');
    cardUltra?.classList.toggle('is-selected', plan === 'ultra');

    if (highlightTitle) {
      highlightTitle.textContent = getPlanName(plan);
    }
    if (ctaTextEl) {
      ctaTextEl.textContent = getCtaLabel(plan);
    }

    const plusCols = backdrop.querySelectorAll<HTMLElement>('.col-plan--plus');
    const proCols = backdrop.querySelectorAll<HTMLElement>('.col-plan--pro');
    const ultraCols = backdrop.querySelectorAll<HTMLElement>('.col-plan--ultra');

    plusCols.forEach((el) => el.classList.toggle('is-active', plan === 'plus'));
    proCols.forEach((el) => el.classList.toggle('is-active', plan === 'pro'));
    ultraCols.forEach((el) => el.classList.toggle('is-active', plan === 'ultra'));

    updateIndicatorPosition(plan);
  };

  updateIndicatorPosition(selectedPlan);

  const handleResize = () => {
    updateIndicatorPosition(selectedPlan);
  };

  window.addEventListener('resize', handleResize);

  cardPlus?.addEventListener('click', () => {
    updateSelectedPlan('plus');
  });

  cardPro?.addEventListener('click', () => {
    updateSelectedPlan('pro');
  });

  cardUltra?.addEventListener('click', () => {
    updateSelectedPlan('ultra');
  });

  const goToUpgrade = (e: MouseEvent) => {
    e.preventDefault();
    closeModal();
    navigate(`/upgrade?plan=${selectedPlan}`);
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
    window.removeEventListener('keydown', handleKeyDown);
    window.removeEventListener('resize', handleResize);
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
