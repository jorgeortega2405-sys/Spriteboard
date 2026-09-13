import { navigate } from '../app-router.js';
import { createSidebar } from '../components/layout.component.js';
import { openModal } from '../components/modal.component.js';
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

  const sidebar = await createSidebar();
  container.prepend(sidebar);

  const grid = container.querySelector<HTMLElement>('[data-ref="pricing-grid"]');
  const categoryPill = container.querySelector<HTMLElement>('[data-ref="category-toggle-pill"]');
  const btnCatPersonalTeams = container.querySelector<HTMLElement>('[data-ref="btn-cat-personal-teams"]');
  const btnCatEducation = container.querySelector<HTMLElement>('[data-ref="btn-cat-education"]');

  const billingTogglePill = container.querySelector<HTMLElement>('[data-ref="billing-toggle-pill"]');
  const btnMonthly = container.querySelector<HTMLElement>('[data-ref="btn-cycle-monthly"]');
  const btnYearly = container.querySelector<HTMLElement>('[data-ref="btn-cycle-yearly"]');

  let currentCategory: 'personal_teams' | 'education' = 'personal_teams';
  let currentBillingCycle = 'monthly';

  const res = await getSubscriptionsApi();
  const rawTiers: any[] = (res.success && Array.isArray(res.subscriptions) && res.subscriptions.length > 0)
    ? res.subscriptions
    : [];

  const freeTier = rawTiers.find((tier) => tier.id === 'free') || {
    id: 'free',
    name: 'Spriteboard Gratis',
    tagline: 'Ideal para comenzar a explorar, crear bocetos y diseñar sin costo.',
    storage: '1 GB de almacenamiento',
    price: 0,
    priceMonthly: 0,
    priceYearly: 0,
    currency: 'USD',
    billingPeriod: 'monthly',
    icon: 'brush',
    buttonText: 'Plan actual',
    features: [
      {
        title: '1 GB de almacenamiento en la nube',
        desc: 'Guarda tus proyectos y lienzos de forma segura',
        icon: 'cloud',
      },
      {
        title: 'Lienzos sin límites de tamaño',
        desc: 'Crea en cualquier resolución hasta 16K, condicionado a tu almacenamiento',
        icon: 'aspect_ratio',
      },
      {
        title: 'Colaboración en vivo (Tú + 2)',
        desc: 'Hasta 3 personas editando simultáneamente con cursores activos',
        icon: 'group',
      },
      {
        title: 'Hasta 5 capas por lienzo',
        desc: 'Herramientas esenciales para separar línea, color y sombras',
        icon: 'layers',
      },
      {
        title: 'Exportación PNG y Proyecto JSON',
        desc: 'Descargas en resolución nativa 1x y escalado 2x',
        icon: 'image',
      },
      {
        title: 'Historial de 3 snapshots',
        desc: 'Guarda hasta 3 versiones de respaldo por lienzo',
        icon: 'history',
      },
    ],
  };

  const proTier = rawTiers.find((tier) => tier.id === 'pro') || {
    id: 'pro',
    name: 'Spriteboard Pro',
    tagline: 'El plan más equilibrado para profesionales y creadores independientes.',
    storage: '10 GB de almacenamiento',
    price: 9.99,
    priceMonthly: 9.99,
    priceYearly: 7.99,
    currency: 'USD',
    billingPeriod: 'monthly',
    icon: 'auto_awesome',
    badge: 'Más Popular',
    isPopular: true,
    buttonText: 'Obtén Spriteboard Pro',
    features: [
      {
        title: '10 GB de almacenamiento en la nube',
        desc: '10x más espacio para proyectos de alta demanda y archivos pesados',
        icon: 'cloud',
      },
      {
        title: 'Lienzos sin límites de tamaño',
        desc: 'Crea en cualquier resolución masiva con 10 GB de almacenamiento',
        icon: 'aspect_ratio',
      },
      {
        title: 'Colaboración en vivo (Tú + 5)',
        desc: 'Hasta 6 personas trabajando en tiempo real en el mismo lienzo',
        icon: 'groups',
      },
      {
        title: '1 equipo de trabajo (hasta 3 miembros)',
        desc: 'Crea tu equipo con proyectos compartidos y roles de acceso',
        icon: 'diversity_3',
      },
      {
        title: 'Capas ilimitadas por lienzo',
        desc: 'Composiciones complejas sin restricciones de capas',
        icon: 'layers',
      },
      {
        title: 'Exportación GIF animado y Hoja de sprites',
        desc: 'Exporta animaciones fluidas y spritesheets con escala hasta 8x',
        icon: 'gif',
      },
      {
        title: 'Historial de 30 snapshots',
        desc: 'Control de versiones extendido durante 30 días',
        icon: 'history_toggle_off',
      },
    ],
  };

  const businessTier = rawTiers.find((tier) => tier.id === 'business' || tier.id === 'negocios') || {
    id: 'business',
    name: 'Spriteboard Negocios',
    tagline: 'Máxima potencia, colaboración avanzada para equipos y estudios de desarrollo.',
    storage: '1 TB de almacenamiento',
    price: 19.99,
    priceMonthly: 19.99,
    priceYearly: 15.99,
    currency: 'USD',
    billingPeriod: 'monthly',
    icon: 'business_center',
    badge: 'Para Equipos',
    isPopular: true,
    buttonText: 'Obtén Spriteboard Negocios',
    features: [
      {
        title: '1 TB de almacenamiento masivo',
        desc: 'Capacidad para proyectos a gran escala y archivo histórico de estudio',
        icon: 'cloud',
      },
      {
        title: 'Lienzos sin límites de tamaño',
        desc: 'Crea en cualquier resolución masiva con 1 TB de almacenamiento masivo',
        icon: 'aspect_ratio',
      },
      {
        title: 'Colaboración masiva (hasta 50 en vivo)',
        desc: 'Salas de lienzo masivas para todo tu equipo de artistas y animadores',
        icon: 'groups_3',
      },
      {
        title: 'Equipos y miembros ilimitados',
        desc: 'Múltiples equipos, roles de administración y lienzos centralizados',
        icon: 'domain',
      },
      {
        title: 'Capas y snapshots ilimitados',
        desc: 'Flujo de trabajo sin límites y auditoría histórica permanente',
        icon: 'all_inclusive',
      },
      {
        title: 'Exportación Game Atlas (Spritesheet + JSON)',
        desc: 'Atlas de texturas listos para Unity, Godot, Phaser y Unreal Engine',
        icon: 'sports_esports',
      },
      {
        title: 'Exportación Ultra 4K (hasta 16x)',
        desc: 'Máximo escalado pixel-perfect para impresión comercial y cartelería',
        icon: 'hd',
      },
      {
        title: 'Herencia de ventajas para tu equipo',
        desc: 'Tus invitados disfrutan de las ventajas al colaborar en tus lienzos',
        icon: 'military_tech',
      },
    ],
  };

  const educationTier = {
    id: 'schools',
    name: 'Spriteboard Educación',
    tagline: 'Infraestructura creativa centralizada para colegios, academias, universidades y docentes.',
    storage: '1 TB+ de almacenamiento institucional',
    price: 0,
    priceMonthly: 0,
    priceYearly: 0,
    isCustomPrice: true,
    currency: 'USD',
    billingPeriod: 'yearly',
    icon: 'school',
    badge: 'Escuelas e Instituciones',
    isPopular: true,
    buttonText: t('upgrade.btn_contact_education') || 'Contactar asesor educativo',
    isContact: true,
    features: [
      {
        title: 'Panel escolar y salones de clase',
        desc: 'Gestión centralizada de aulas, códigos de unión (SP-XXXXXX) y docentes',
        icon: 'school',
      },
      {
        title: 'Directorio de docentes y licencias',
        desc: 'Aprovisionamiento centralizado de profesores con permisos escolares',
        icon: 'group_add',
      },
      {
        title: 'Aulas, proyectos y alumnos ilimitados',
        desc: 'Organiza todos tus cursos y materias con acceso estructurado y seguro',
        icon: 'menu_book',
      },
      {
        title: 'Colaboración masiva en vivo (hasta 50 alumnos)',
        desc: 'Toda la clase trabajando en tiempo real en proyectos de lienzo compartidos',
        icon: 'groups_3',
      },
      {
        title: 'Capas y snapshots históricos ilimitados',
        desc: 'Monitorea el proceso de los alumnos y restaura versiones anteriores en un clic',
        icon: 'all_inclusive',
      },
      {
        title: 'Exportación Game Atlas (Spritesheet + JSON)',
        desc: 'Exportación directa para proyectos de videojuegos en Unity, Godot y Phaser',
        icon: 'sports_esports',
      },
      {
        title: 'Exportación Ultra 4K (hasta 16x)',
        desc: 'Escalado en máxima fidelidad para exposiciones escolares y pósteres',
        icon: 'hd',
      },
      {
        title: 'Herencia de ventajas en el aula',
        desc: 'Tus alumnos disfrutan de las ventajas de Negocios al trabajar en tus lienzos',
        icon: 'military_tech',
      },
      {
        title: 'Privacidad escolar y cumplimiento COPPA/FERPA',
        desc: 'Entorno cerrado y seguro para estudiantes sin exposición pública de datos',
        icon: 'security',
      },
      {
        title: 'Acompañamiento pedagógico y soporte dedicado',
        desc: 'Capacitación técnica y asistencia continua para el equipo educativo',
        icon: 'support_agent',
      },
    ],
  };

  const categoryTiers: Record<'personal_teams' | 'education', any[]> = {
    personal_teams: [freeTier, proTier, businessTier],
    education: [educationTier],
  };

  const TIER_HIERARCHY: Record<string, number> = {
    free: 0,
    none: 0,
    pro: 1,
    business: 2,
    negocios: 2,
    docentes: 2,
    escuelas: 3,
  };

  const renderCards = (category: 'personal_teams' | 'education'): void => {
    if (!grid) return;
    grid.innerHTML = '';

    const tiersToRender = categoryTiers[category] || [];
    const userTier = (currentUser?.subscription_tier || 'free').toLowerCase();
    const userTierLevel = TIER_HIERARCHY[userTier] ?? 0;

    tiersToRender.forEach((tier, tierIdx) => {
      const isPopular = Boolean(tier.isPopular);
      const isFree = tier.id === 'free';
      const isCurrentPlan = Boolean(
        currentUser && (
          userTier === tier.id ||
          (tier.id === 'business' && userTier === 'negocios') ||
          (tier.id === 'schools' && ['schools', 'escuelas', 'docentes', 'education'].includes(userTier))
        )
      );
      const cardTierLevel = TIER_HIERARCHY[tier.id] ?? 0;
      const isDowngrade = Boolean(currentUser && userTierLevel > cardTierLevel && userTier !== 'free' && !tier.isVerification && !tier.isContact);

      const isYearly = currentBillingCycle === 'yearly';
      const initialPrice = isFree ? '0.00' : Number(isYearly ? (tier.priceYearly ?? tier.price) : (tier.priceMonthly ?? tier.price)).toFixed(2);
      const monthlyPrice = isFree ? '0.00' : Number(tier.priceMonthly ?? tier.price).toFixed(2);
      const yearlyPrice = isFree ? '0.00' : Number(tier.priceYearly ?? tier.price).toFixed(2);

      let featuresHtml = '';
      const featuresList = Array.isArray(tier.features) ? tier.features : [];

      featuresList.forEach((feat: any, idx: number) => {
        if (tierIdx > 0 && idx === 2 && category === 'personal_teams') {
          featuresHtml += `
            <div class="component-card-feature-divider-container" data-ref="feature-divider-${tier.id}">
              <hr class="component-divider component-card-feature-divider" />
              <p class="component-card-feature-divider-text">Todo lo del plan anterior, más:</p>
            </div>
          `;
        }

        const isHidden = idx > 4;
        featuresHtml += `
          <div class="component-card-feature-item ${isHidden ? 'component-card-feature-item--hidden' : ''}" data-ref="feature-item-${tier.id}" data-hidden="${isHidden ? 'true' : 'false'}">
            <svg class="component-icon component-card-feature-icon" aria-hidden="true"><use href="/icons.svg#${escapeHtml(feat.icon || 'check_circle')}"></use></svg>
            <div class="component-card-feature-text-container">
              <span class="component-card-feature-title">${escapeHtml(feat.title || feat.label || '')}</span>
              <span class="component-card-feature-desc">${escapeHtml(feat.desc || '')}</span>
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
              <span>${escapeHtml(t('upgrade.current_plan') || 'Tu plan actual')}</span>
            </div>
          ` : (tier.badge ? `
            <div class="component-card-popular-badge" data-ref="popular-badge-${tier.id}">${escapeHtml(tier.badge)}</div>
          ` : '')}
          <h2 class="component-card-title" data-ref="card-title-${tier.id}">${escapeHtml(tier.name)}</h2>
          <p class="component-card-desc" data-ref="card-desc-${tier.id}">${escapeHtml(tier.tagline)}</p>
          <span class="component-badge component-badge--sm component-card-storage-badge" data-ref="storage-badge-${tier.id}">
            <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#cloud"></use></svg>
            <span>${escapeHtml(tier.storage || 'Almacenamiento en la nube')}</span>
          </span>
        </div>

        <div class="component-card-section component-card-section--price" data-ref="card-price-${tier.id}">
          <div class="component-card-price-label">${tier.isCustomPrice ? 'Presupuesto' : isFree ? 'Para siempre' : tier.isVerification ? 'Gratis con verificación' : 'Desde'}</div>
          <div class="component-card-price-container">
            ${tier.isCustomPrice ? `
              <span class="component-card-price" style="font-size: 26px;">A medida</span>
              <span class="component-card-period">/ institucional</span>
            ` : `
              <span class="component-card-price">
                USD $<span data-ref="plan-price-${tier.id}" data-monthly="${monthlyPrice}" data-yearly="${yearlyPrice}">${initialPrice}</span>
              </span>
              <span class="component-card-period" data-ref="plan-period-${tier.id}" data-period-monthly="/ mes" data-period-yearly="${isFree ? '/ mes' : '/ mes facturado anualmente'}">${tier.isVerification ? '/ gratis' : isFree ? '/ mes' : isYearly ? '/ mes facturado anualmente' : '/ mes'}</span>
            `}
          </div>
        </div>

        <div class="component-card-section component-card-section--action" data-ref="card-action-${tier.id}">
          ${isCurrentPlan ? `
            <button type="button" class="component-button component-button--rounded-pill component-card-button component-card-button--current" data-ref="btn-subscribe-${tier.id}" data-action="current-plan" disabled>
              <svg class="component-icon" aria-hidden="true" style="font-size: 18px; margin-right: 6px;"><use href="/icons.svg#check_circle"></use></svg>
              <span>${escapeHtml(t('upgrade.current_plan') || 'Tu plan actual')}</span>
            </button>
          ` : isDowngrade ? `
            <button type="button" class="component-button component-button--rounded-pill component-card-button component-card-button--downgrade" data-ref="btn-subscribe-${tier.id}" data-action="downgrade" disabled>
              <span>${escapeHtml(t('upgrade.included_in_plan') || 'Incluido en tu plan')}</span>
            </button>
          ` : tier.isVerification ? `
            <button type="button" class="component-button component-button--rounded-pill component-button--hover-text component-cursor-pointer component-card-button ${isPopular ? 'component-card-button--featured' : ''}" data-ref="btn-subscribe-${tier.id}" data-action="verify-docente">
              <span class="component-button__default-text">
                ${escapeHtml(tier.buttonText || 'Completar verificación')}
              </span>
              <span class="component-button__hover-text">
                Verificar cuenta
              </span>
            </button>
          ` : tier.isContact ? `
            <button type="button" class="component-button component-button--rounded-pill component-button--hover-text component-cursor-pointer component-card-button" data-ref="btn-subscribe-${tier.id}" data-action="contact-schools">
              <span class="component-button__default-text">
                ${escapeHtml(tier.buttonText || 'Contactar asesor')}
              </span>
              <span class="component-button__hover-text">
                Escribirnos
              </span>
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
          ` : `
            <button type="button" class="component-button component-button--rounded-pill component-button--hover-text component-cursor-pointer component-card-button ${isPopular ? 'component-card-button--featured' : ''}" data-ref="btn-subscribe-${tier.id}" data-action="subscribe" data-tier="${tier.id}">
              <span class="component-button__default-text">
                ${escapeHtml(tier.buttonText || `Obtén ${tier.name}`)}
              </span>
              <span class="component-button__hover-text">
                Mejorar plan
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

          if (tier.isVerification) {
            if (!currentUser) {
              showToast(t('upgrade.login_required') || 'Debes iniciar sesión para solicitar la verificación docente.', 'info');
              navigate('/login');
              return;
            }
            openModal({
              title: 'Verificación para Docentes y Educadores',
              description: 'El Plan Docentes es 100% gratuito e incluye todas las ventajas de Spriteboard Negocios para tus clases.',
              bodyHtml: `
                <div style="font-size: 14px; line-height: 1.6; color: var(--text-secondary); display: flex; flex-direction: column; gap: 12px;">
                  <p>Actualmente la activación del Plan Docentes se realiza de forma asistida. Para verificar tu condición docente, necesitamos confirmar tu vinculación con una institución educativa.</p>
                  <div style="background: var(--bg-hover-light, rgba(0,0,0,0.03)); padding: 14px; border-radius: var(--radius-md); border: 1px solid var(--border-color);">
                    <strong style="color: var(--text-primary); display: block; margin-bottom: 6px;">Requisitos de verificación:</strong>
                    <ul style="margin: 0; padding-left: 20px;">
                      <li>Correo electrónico institucional (.edu o dominio escolar oficial)</li>
                      <li>O credencial / carnet docente vigente</li>
                      <li>Nombre de tu colegio, instituto o universidad</li>
                    </ul>
                  </div>
                  <p>Envíanos un correo a <a class="link" href="mailto:soporte@spriteboard.com?subject=Solicitud%20de%20Verificaci%C3%B3n%20Docente%20-%20Spriteboard">soporte@spriteboard.com</a> y nuestro equipo activará tu plan educativo en menos de 24 horas.</p>
                </div>
              `,
              confirmText: 'Enviar correo de verificación',
              cancelText: 'Cerrar',
              onConfirm: () => {
                window.location.href = 'mailto:soporte@spriteboard.com?subject=Solicitud%20de%20Verificaci%C3%B3n%20Docente%20-%20Spriteboard';
              },
            });
            return;
          }

          if (tier.isContact) {
            openModal({
              title: 'Plan Escuelas y Sistemas Educativos',
              description: 'Infraestructura creativa centralizada para colegios, universidades y distritos escolares.',
              bodyHtml: `
                <div style="font-size: 14px; line-height: 1.6; color: var(--text-secondary); display: flex; flex-direction: column; gap: 12px;">
                  <p>Diseñamos propuestas a medida con despliegue multi-profesor, panel de control administrativo, acuerdos de privacidad de datos (COPPA/FERPA) e integración con plataformas educativas.</p>
                  <div style="background: var(--bg-hover-light, rgba(0,0,0,0.03)); padding: 14px; border-radius: var(--radius-md); border: 1px solid var(--border-color);">
                    <strong style="color: var(--text-primary); display: block; margin-bottom: 6px;">¿Qué incluye una propuesta institucional?</strong>
                    <ul style="margin: 0; padding-left: 20px;">
                      <li>Gestión centralizada de licencias docentes</li>
                      <li>Aulas y alumnos ilimitados con almacenamiento a medida</li>
                      <li>Capacitación técnica y pedagógica para tus profesores</li>
                      <li>Facturación anual por orden de compra o transferencia</li>
                    </ul>
                  </div>
                  <p>Contáctanos directamente en <a class="link" href="mailto:soporte@spriteboard.com?subject=Consulta%20Plan%20Escuelas%20e%20Instituciones%20-%20Spriteboard">soporte@spriteboard.com</a> para coordinar una reunión con nuestro equipo educativo.</p>
                </div>
              `,
              confirmText: 'Contactar asesor',
              cancelText: 'Cerrar',
              onConfirm: () => {
                window.location.href = 'mailto:soporte@spriteboard.com?subject=Consulta%20Plan%20Escuelas%20e%20Instituciones%20-%20Spriteboard';
              },
            });
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

  const switchCategory = (category: 'personal_teams' | 'education'): void => {
    currentCategory = category;

    if (categoryPill) {
      categoryPill.setAttribute('data-category', category);
    }

    btnCatPersonalTeams?.classList.toggle('active', category === 'personal_teams');
    btnCatEducation?.classList.toggle('active', category === 'education');

    if (billingTogglePill) {
      billingTogglePill.style.display = category === 'education' ? 'none' : 'inline-grid';
    }

    renderCards(category);
  };

  btnCatPersonalTeams?.addEventListener('click', (e) => {
    e.preventDefault();
    if (currentCategory !== 'personal_teams') switchCategory('personal_teams');
  });

  btnCatEducation?.addEventListener('click', (e) => {
    e.preventDefault();
    if (currentCategory !== 'education') switchCategory('education');
  });

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

    const currentTiers = categoryTiers[currentCategory] || [];
    currentTiers.forEach((tier) => {
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
          periodEl.textContent = tier.isVerification
            ? '/ gratis'
            : isYearly
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

  const requestedPlan = (urlParams.get('plan') || '').toLowerCase();
  const requestedCategory = (urlParams.get('category') || '').toLowerCase();

  if (requestedCategory === 'education' || requestedPlan === 'docentes' || requestedPlan === 'schools') {
    switchCategory('education');
  } else {
    switchCategory('personal_teams');
  }

  if (requestedPlan) {
    const targetId = requestedPlan === 'negocios' ? 'business' : requestedPlan;
    setTimeout(() => {
      const card = container.querySelector<HTMLElement>(`[data-ref="plan-card-${targetId}"]`);
      if (card) {
        card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }, 150);
  }

  return container;
}
