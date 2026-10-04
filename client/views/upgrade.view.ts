import { navigate } from '../app-router.js';
import { checkAuthSession, createSubscriptionCheckoutApi, currentUser, escapeHtml, getSubscriptionsApi, verifySubscriptionSessionApi } from '../services/api.service.js';
import { t } from '../services/i18n.service.js';
import { loadTemplate } from '../services/template.service.js';
import { showToast } from '../services/toast.service.js';

export async function createUpgradeView(): Promise<HTMLElement> {
  const container = await loadTemplate('/views/upgrade/upgrade.html');

  const urlParams = new URLSearchParams(window.location.search);
  const paymentStatus = urlParams.get('payment');
  const sessionId = urlParams.get('session_id');

  if (paymentStatus === 'success' && sessionId) {
    try {
      const verifyRes = await verifySubscriptionSessionApi(sessionId);
      if (verifyRes.success) {
        await checkAuthSession();
        window.dispatchEvent(new CustomEvent('subscription-updated', { detail: currentUser }));
      }
    } catch (_) {
    } finally {
      const rawTier = currentUser?.subscription_tier || 'pro';
      const activeTierName = (rawTier === 'business' ? 'negocios' : rawTier).toUpperCase();
      showToast(
        t('upgrade.payment_success_toast', { plan: activeTierName }) ||
          `¡Felicidades! Tu suscripción a Spriteboard ${activeTierName} ha sido activada con éxito.`,
        'success'
      );
      window.history.replaceState({}, '', '/upgrade');
    }
  } else if (paymentStatus === 'cancelled') {
    showToast(
      t('upgrade.payment_cancelled_toast') || 'El proceso de pago fue cancelado. No se ha realizado ningún cobro.',
      'info'
    );
    window.history.replaceState({}, '', '/upgrade');
  }

  const grid = container.querySelector<HTMLElement>('[data-ref="pricing-grid"]');
  const billingTogglePill = container.querySelector<HTMLElement>('[data-ref="billing-toggle-pill"]');
  const btnMonthly = container.querySelector<HTMLElement>('[data-ref="btn-cycle-monthly"]');
  const btnYearly = container.querySelector<HTMLElement>('[data-ref="btn-cycle-yearly"]');

  let currentBillingCycle = 'monthly';

  const res = await getSubscriptionsApi();
  const rawTiers: any[] = (res.success && Array.isArray(res.subscriptions) && res.subscriptions.length > 0)
    ? res.subscriptions
    : [];

  const freeTier = rawTiers.find((tier) => tier.id === 'free') || {
    id: 'free',
    name: 'Spriteboard Free',
    tagline: 'Ideal for getting started exploring, sketching, and designing at no cost.',
    storage: '5 GB de almacenamiento',
    price: 0,
    priceMonthly: 0,
    priceYearly: 0,
    currency: 'USD',
    billingPeriod: 'monthly',
    icon: 'brush',
    buttonText: 'Current plan',
    features: [
      {
        title: '5 GB cloud storage',
        desc: 'Keep your projects and canvases secure',
        icon: 'cloud',
      },
      {
        title: 'Live collaboration (up to 3 people)',
        desc: 'You and 2 colleagues editing simultaneously with active cursors',
        icon: 'group',
      },
    ],
  };

  const proTier = rawTiers.find((tier) => tier.id === 'pro') || {
    id: 'pro',
    name: 'Spriteboard Pro',
    tagline: 'The most balanced plan for professionals and independent creators.',
    storage: '100 GB de almacenamiento',
    price: 9.99,
    priceMonthly: 9.99,
    priceYearly: 7.99,
    currency: 'USD',
    billingPeriod: 'monthly',
    icon: 'auto_awesome',
    badge: 'Most Popular',
    isPopular: true,
    buttonText: 'Get Spriteboard Pro',
    features: [
      {
        title: '100 GB cloud storage',
        desc: '20x more space for high-demand projects and large assets',
        icon: 'cloud',
      },
      {
        title: 'Extended live collaboration (up to 6 people)',
        desc: 'Collaborative rooms for design teams',
        icon: 'groups',
      },
    ],
  };

  const businessTier = rawTiers.find((tier) => tier.id === 'business' || tier.id === 'negocios') || {
    id: 'business',
    name: 'Spriteboard Business',
    tagline: 'Maximum power and advanced collaboration for studios and teams.',
    storage: '500 GB de almacenamiento',
    price: 19.99,
    priceMonthly: 19.99,
    priceYearly: 15.99,
    currency: 'USD',
    billingPeriod: 'monthly',
    icon: 'business_center',
    badge: 'For Teams',
    isPopular: false,
    buttonText: 'Get Spriteboard Business',
    features: [
      {
        title: '500 GB massive storage',
        desc: 'Capacity for large-scale projects and historic studio archive',
        icon: 'cloud',
      },
      {
        title: 'Centralized team management',
        desc: 'Create and manage multiple teams, roles, and shared canvases',
        icon: 'domain',
      },
      {
        title: 'Massive collaboration (up to 50 people live)',
        desc: 'Large canvas rooms for your entire team of artists and animators',
        icon: 'groups_3',
      },
      {
        title: 'Brand kits and centralized palettes',
        desc: 'Official logos, fonts, and colors shared with your whole organization',
        icon: 'palette',
      },
    ],
  };

  const enterpriseTier = rawTiers.find((tier) => tier.id === 'enterprise' || tier.id === 'empresas') || {
    id: 'enterprise',
    name: 'Spriteboard Enterprise',
    tagline: 'Corporate security, access control, and large-scale solutions.',
    storage: '5 TB de almacenamiento',
    price: 0,
    priceMonthly: 0,
    priceYearly: 0,
    currency: 'USD',
    billingPeriod: 'monthly',
    icon: 'corporate_fare',
    badge: 'For Enterprises',
    isPopular: false,
    isCustomPrice: true,
    buttonText: 'Contact sales',
    features: [
      {
        title: '5 TB massive storage',
        desc: 'Maximum capacity for corporate storage and enterprise-scale projects',
        icon: 'cloud',
      },
      {
        title: 'Enterprise-wide collaboration',
        desc: 'Large canvas rooms across your entire company and departments',
        icon: 'groups_3',
      },
      {
        title: 'Centralized team management',
        desc: 'Create and manage multiple teams, roles, and shared canvases',
        icon: 'domain',
      },
      {
        title: 'Brand kits and centralized palettes',
        desc: 'Official logos, fonts, and colors shared with your whole organization',
        icon: 'palette',
      },
      {
        title: 'Enterprise authentication (SSO & SAML)',
        desc: 'Centralized corporate login via SAML 2.0 and SCIM provisioning',
        icon: 'vpn_key',
      },
    ],
  };

  const tiers = [freeTier, proTier, businessTier, enterpriseTier];

  const TIER_HIERARCHY: Record<string, number> = {
    free: 0,
    none: 0,
    pro: 1,
    business: 2,
    negocios: 2,
    enterprise: 3,
    empresas: 3,
  };

  const renderCards = (): void => {
    if (!grid) return;
    grid.innerHTML = '';

    const userTier = (currentUser?.subscription_tier || 'free').toLowerCase();
    const userTierLevel = TIER_HIERARCHY[userTier] ?? 0;

    tiers.forEach((tier, tierIdx) => {
      const isPopular = Boolean(tier.isPopular);
      const isFree = tier.id === 'free';
      const isCurrentPlan = Boolean(
        currentUser && (
          userTier === tier.id ||
          (tier.id === 'business' && userTier === 'negocios')
        )
      );
      const cardTierLevel = TIER_HIERARCHY[tier.id] ?? 0;
      const isDowngrade = Boolean(currentUser && userTierLevel > cardTierLevel && userTier !== 'free');

      const isYearly = currentBillingCycle === 'yearly';
      const initialPrice = isFree ? '0.00' : Number(isYearly ? (tier.priceYearly ?? tier.price) : (tier.priceMonthly ?? tier.price)).toFixed(2);
      const monthlyPrice = isFree ? '0.00' : Number(tier.priceMonthly ?? tier.price).toFixed(2);
      const yearlyPrice = isFree ? '0.00' : Number(tier.priceYearly ?? tier.price).toFixed(2);

      let featuresHtml = '';
      const featuresList = Array.isArray(tier.features) ? tier.features : [];

      featuresList.forEach((feat: any, idx: number) => {
        if (tierIdx > 0 && idx === 2) {
          featuresHtml += `
            <div class="component-card-feature-divider-container" data-ref="feature-divider-${tier.id}">
              <hr class="component-divider component-card-feature-divider" />
              <p class="component-card-feature-divider-text">${t('upgrade.all_previous_plus')}</p>
            </div>
          `;
        }

        const isHidden = idx > 4;
        featuresHtml += `
          <div class="component-card-feature-item ${isHidden ? 'component-card-feature-item--hidden' : ''}" data-ref="feature-item-${tier.id}" data-hidden="${isHidden ? 'true' : 'false'}">
            <svg class="component-icon component-card-feature-icon" aria-hidden="true"><use href="/icons.svg#${escapeHtml(feat.icon || 'check_circle')}"></use></svg>
            <div class="component-card-feature-text-container">
              <span class="component-card-feature-title">${escapeHtml(t(`upgrade.plans.${tier.id}.features.${idx}.title`) || feat.title || feat.label || '')}</span>
              <span class="component-card-feature-desc">${escapeHtml(t(`upgrade.plans.${tier.id}.features.${idx}.desc`) || feat.desc || '')}</span>
            </div>
          </div>
        `;
      });

      const card = document.createElement('div');
      card.className = `component-card component-card--grouped component-card--plan ${
        isCurrentPlan
          ? 'component-card--current'
          : (isPopular ? 'component-card--featured' : 'component-card--standard')
      }`;
      card.setAttribute('data-ref', `plan-card-${tier.id}`);
      card.setAttribute('data-tier', tier.id);

      card.innerHTML = `
        <div class="component-card-section component-card-section--header" data-ref="card-header-${tier.id}">
          ${isCurrentPlan ? `
            <div class="component-card-current-badge" data-ref="current-badge-${tier.id}">
              <svg class="component-icon" aria-hidden="true" style="font-size: 14px;"><use href="/icons.svg#check_circle"></use></svg>
              <span>${escapeHtml(t('upgrade.plans.free.button') || t('upgrade.current_plan') || 'Tu plan actual')}</span>
            </div>
          ` : (tier.badge ? `
            <div class="component-card-popular-badge" data-ref="popular-badge-${tier.id}">${escapeHtml(t(`upgrade.plans.${tier.id}.badge`) || tier.badge)}</div>
          ` : '')}
          <h2 class="component-card-title" data-ref="card-title-${tier.id}">${escapeHtml(t(`upgrade.plans.${tier.id}.name`) || tier.name)}</h2>
          <p class="component-card-desc" data-ref="card-desc-${tier.id}">${escapeHtml(t(`upgrade.plans.${tier.id}.tagline`) || tier.tagline)}</p>
          <span class="component-badge component-badge--sm component-card-storage-badge" data-ref="storage-badge-${tier.id}">
            <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#cloud"></use></svg>
            <span>${escapeHtml(t(`upgrade.plans.${tier.id}.storage`) || tier.storage || 'Almacenamiento en la nube')}</span>
          </span>
        </div>

        <div class="component-card-section component-card-section--price" data-ref="card-price-${tier.id}">
          <div class="component-card-price-label">${tier.isCustomPrice ? 'Presupuesto' : isFree ? 'Para siempre' : 'Desde'}</div>
          <div class="component-card-price-container">
            ${tier.isCustomPrice ? `
              <span class="component-card-price" style="font-size: 26px;">Contáctanos</span>
              <span class="component-card-period">/ a medida</span>
            ` : `
              <span class="component-card-price">
                USD $<span data-ref="plan-price-${tier.id}" data-monthly="${monthlyPrice}" data-yearly="${yearlyPrice}">${initialPrice}</span>
              </span>
              <span class="component-card-period" data-ref="plan-period-${tier.id}" data-period-monthly="/ mes" data-period-yearly="${isFree ? '/ mes' : '/ mes facturado anualmente'}">${isFree ? '/ mes' : isYearly ? '/ mes facturado anualmente' : '/ mes'}</span>
            `}
          </div>
        </div>

        <div class="component-card-section component-card-section--action" data-ref="card-action-${tier.id}">
          ${isCurrentPlan ? `
            <button type="button" class="component-button component-button--rounded-pill component-card-button component-card-button--current" data-ref="btn-subscribe-${tier.id}" data-action="current-plan" disabled>
              <svg class="component-icon" aria-hidden="true" style="font-size: 18px; margin-right: 6px;"><use href="/icons.svg#check_circle"></use></svg>
              <span>${escapeHtml(t('upgrade.plans.free.button') || t('upgrade.current_plan') || 'Tu plan actual')}</span>
            </button>
          ` : isDowngrade ? `
            <button type="button" class="component-button component-button--rounded-pill component-card-button component-card-button--downgrade" data-ref="btn-subscribe-${tier.id}" data-action="downgrade" disabled>
              <span>${escapeHtml(t('upgrade.included_in_plan') || 'Incluido en tu plan')}</span>
            </button>
          ` : isFree ? `
            <button type="button" class="component-button component-button--rounded-pill component-button--hover-text component-cursor-pointer component-card-button" data-ref="btn-subscribe-${tier.id}" data-action="register" data-tier="${tier.id}">
              <span class="component-button__default-text">
                Comenzar gratis
              </span>
              <span class="component-button__hover-text">
                Crear cuenta
              </span>
            </button>
          ` : tier.id === 'enterprise' ? `
            <button type="button" class="component-button component-button--rounded-pill component-button--hover-text component-cursor-pointer component-card-button" data-ref="btn-subscribe-${tier.id}" data-action="contact-sales" data-tier="${tier.id}">
              <span class="component-button__default-text">
                ${escapeHtml(t(`upgrade.plans.${tier.id}.button`) || tier.buttonText || 'Hablar con ventas')}
              </span>
              <span class="component-button__hover-text">
                ${t('upgrade.contact')}
              </span>
            </button>
          ` : `
            <button type="button" class="component-button component-button--rounded-pill component-button--hover-text component-cursor-pointer component-card-button ${isPopular ? 'component-card-button--featured' : ''}" data-ref="btn-subscribe-${tier.id}" data-action="subscribe" data-tier="${tier.id}">
              <span class="component-button__default-text">
                ${escapeHtml(t(`upgrade.plans.${tier.id}.button`) || tier.buttonText || `Obtén ${tier.name}`)}
              </span>
              <span class="component-button__hover-text">
                ${t('upgrade.upgrade_plan')}
              </span>
            </button>
          `}
        </div>

        <hr class="component-divider" />

        <div class="component-card-section component-card-section--features" data-ref="card-features-${tier.id}">
          <div class="component-card-features" data-ref="features-container-${tier.id}">
            ${featuresHtml}
            ${featuresList.length > 5 ? `
              <div class="component-card-features-toggle-container">
                <span class="component-card-features-toggle" data-ref="toggle-btn-${tier.id}" data-action="toggle-plan-features">Mostrar todas las funciones</span>
              </div>
            ` : ''}
          </div>
        </div>
      `;

      const subscribeBtn = card.querySelector<HTMLButtonElement>(`[data-ref="btn-subscribe-${tier.id}"]`);
      if (subscribeBtn && !isCurrentPlan && !isDowngrade) {
        subscribeBtn.addEventListener('click', async (e) => {
          e.preventDefault();

          if (tier.id === 'enterprise') {
            navigate('/contact/sales');
            return;
          }

          if (tier.id === 'free') {
            if (!currentUser) {
              navigate('/register');
            }
            return;
          }

          if (!currentUser) {
            showToast(
              t('upgrade.login_required') || 'Debes iniciar sesión para contratar una suscripción.',
              'info'
            );
            navigate('/login');
            return;
          }

          subscribeBtn.disabled = true;
          subscribeBtn.style.opacity = '0.7';

          try {
            const checkoutRes = await createSubscriptionCheckoutApi(tier.id, currentBillingCycle);
            if (checkoutRes.success && checkoutRes.url) {
              window.location.href = checkoutRes.url;
            } else {
              showToast(
                checkoutRes.error || t('toasts.generic_error') || 'Error al conectar con la pasarela de pagos.',
                'error'
              );
              subscribeBtn.disabled = false;
              subscribeBtn.style.opacity = '1';
            }
          } catch {
            showToast(t('toasts.network_error') || 'Error de conexión con el servidor.', 'error');
            subscribeBtn.disabled = false;
            subscribeBtn.style.opacity = '1';
          }
        });
      }

      const toggleFeaturesBtn = card.querySelector<HTMLElement>(`[data-ref="toggle-btn-${tier.id}"]`);
      if (toggleFeaturesBtn) {
        toggleFeaturesBtn.addEventListener('click', (e) => {
          e.preventDefault();
          const hiddenItems = card.querySelectorAll<HTMLElement>(`.component-card-feature-item[data-hidden="true"]`);
          if (!hiddenItems.length) return;

          const isCurrentlyHidden = hiddenItems[0].classList.contains('component-card-feature-item--hidden');
          if (isCurrentlyHidden) {
            hiddenItems.forEach((item) => item.classList.remove('component-card-feature-item--hidden'));
            toggleFeaturesBtn.textContent = 'Ocultar funciones';
          } else {
            hiddenItems.forEach((item) => item.classList.add('component-card-feature-item--hidden'));
            toggleFeaturesBtn.textContent = 'Mostrar todas las funciones';
          }
        });
      }

      grid.appendChild(card);
    });
  };

  const setBillingCycle = (cycle: string): void => {
    currentBillingCycle = cycle;
    const isYearly = cycle === 'yearly';

    if (billingTogglePill) {
      billingTogglePill.setAttribute('data-cycle', cycle);
    }

    if (btnMonthly && btnYearly) {
      if (isYearly) {
        btnMonthly.classList.remove('active');
        btnYearly.classList.add('active');
      } else {
        btnYearly.classList.remove('active');
        btnMonthly.classList.add('active');
      }
    }

    tiers.forEach((tier) => {
      if (tier.isCustomPrice) return;
      const priceEl = container.querySelector<HTMLElement>(`[data-ref="plan-price-${tier.id}"]`);
      const periodEl = container.querySelector<HTMLElement>(`[data-ref="plan-period-${tier.id}"]`);

      if (priceEl && periodEl) {
        priceEl.style.opacity = '0';
        periodEl.style.opacity = '0';

        setTimeout(() => {
          priceEl.textContent = isYearly
            ? priceEl.getAttribute('data-yearly')
            : priceEl.getAttribute('data-monthly');
          periodEl.textContent = isYearly
            ? priceEl.getAttribute('data-period-yearly') || '/ mes facturado anualmente'
            : priceEl.getAttribute('data-period-monthly') || '/ mes';
          priceEl.style.opacity = '1';
          periodEl.style.opacity = '1';
        }, 120);
      }
    });
  };

  btnMonthly?.addEventListener('click', (e) => {
    e.preventDefault();
    if (currentBillingCycle !== 'monthly') {
      setBillingCycle('monthly');
    }
  });

  btnYearly?.addEventListener('click', (e) => {
    e.preventDefault();
    if (currentBillingCycle !== 'yearly') {
      setBillingCycle('yearly');
    }
  });

  const disclaimerLinks = container.querySelectorAll<HTMLAnchorElement>('.component-disclaimer a.link');
  disclaimerLinks.forEach((link) => {
    link.addEventListener('click', (e) => {
      const href = link.getAttribute('href');
      if (href && href.startsWith('/')) {
        e.preventDefault();
        navigate(href);
      }
    });
  });

  renderCards();

  const requestedPlan = (urlParams.get('plan') || '').toLowerCase();
  if (requestedPlan) {
    let targetId = requestedPlan;
    if (targetId === 'negocios') targetId = 'business';
    setTimeout(() => {
      const card = container.querySelector<HTMLElement>(`[data-ref="plan-card-${targetId}"]`);
      if (card) {
        card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }, 150);
  }

  return container;
}
