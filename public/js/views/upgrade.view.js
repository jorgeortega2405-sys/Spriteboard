/**
 * Vista de Suscripciones y Mejoras (/upgrade)
 * Replica exactamente la arquitectura y diseño de las cards de la web del escritorio:
 * - Glider Toggle Pill (Mensual / Anual)
 * - Grid de Cards (Spriteboard Plus, Spriteboard Pro, Spriteboard Ultra)
 * - Sección de cabecera, almacenamiento en la nube, precios, botón con hover-text
 * - Separador de características ("Todo lo del plan anterior, más:") y lista detallada
 */

import { loadTemplate } from '../services/template.service.js';
import { createSidebar } from '../components/sidebar.component.js';
import { getSubscriptionsApi, escapeHtml } from '../services/api.service.js';
import { showToast } from '../services/toast.service.js';
import { t } from '../services/i18n.service.js';

export async function createUpgradeView() {
  const container = await loadTemplate('/views/upgrade/upgrade.html');

  // Insertar la barra lateral (sidebar)
  const sidebar = await createSidebar();
  container.prepend(sidebar);

  const grid = container.querySelector('[data-ref="pricing-grid"]');
  const togglePill = container.querySelector('[data-ref="billing-toggle-pill"]');
  const btnMonthly = container.querySelector('[data-ref="btn-cycle-monthly"]');
  const btnYearly = container.querySelector('[data-ref="btn-cycle-yearly"]');

  let currentBillingCycle = 'monthly';

  // Obtener planes desde el backend
  const res = await getSubscriptionsApi();
  const tiers = (res.success && Array.isArray(res.subscriptions) && res.subscriptions.length > 0)
    ? res.subscriptions
    : [
        {
          id: 'plus',
          name: 'Spriteboard Plus',
          tagline: 'Ideal para creadores y usuarios que buscan potenciar su productividad diaria.',
          storage: '1 GB de almacenamiento',
          price: 4.99,
          priceMonthly: 4.99,
          priceYearly: 3.99,
          currency: 'USD',
          billingPeriod: 'monthly',
          icon: 'bolt',
          buttonText: 'Obtén Spriteboard Plus',
          features: [
            {
              title: '1 GB de almacenamiento en la nube',
              desc: 'Guarda tus tableros, recursos y configuraciones de forma segura',
              icon: 'cloud',
            },
            {
              title: 'Historial de versiones de 30 días',
              desc: 'Restaura versiones previas de tus tableros y lienzos en cualquier momento',
              icon: 'history',
            },
            {
              title: 'Herramientas de dibujo ampliadas',
              desc: 'Pinceles avanzados, capas adicionales y paletas de color personalizadas',
              icon: 'brush',
            },
            {
              title: 'Exportación de alta velocidad',
              desc: 'Descarga tus tableros en formatos PNG, SVG y JPG sin límites de velocidad',
              icon: 'speed',
            },
            {
              title: 'Soporte estándar por correo',
              desc: 'Atención personalizada en menos de 48 horas laborales',
              icon: 'mail',
            },
          ],
        },
        {
          id: 'pro',
          name: 'Spriteboard Pro',
          tagline: 'El plan más equilibrado para profesionales y creadores exigentes.',
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
              desc: 'Espacio ampliado para proyectos de alta demanda y archivos pesados',
              icon: 'cloud',
            },
            {
              title: 'Tableros y proyectos ilimitados',
              desc: 'Crea sin restricciones de cantidad ni límites de espacio de trabajo',
              icon: 'all_inclusive',
            },
            {
              title: 'Exportación en ultra resolución 4K',
              desc: 'Calidad profesional para impresión, medios digitales y exhibición',
              icon: 'hd',
            },
            {
              title: 'Personalización avanzada',
              desc: 'Temas visuales exclusivos y controles avanzados de interfaz',
              icon: 'tune',
            },
            {
              title: 'Colaboración en tiempo real',
              desc: 'Trabaja simultáneamente con miembros de tu equipo con presencia activa',
              icon: 'groups',
            },
            {
              title: 'Soporte prioritario 24/7',
              desc: 'Respuesta rápida garantizada en menos de 4 horas por nuestro equipo',
              icon: 'support_agent',
            },
          ],
        },
        {
          id: 'ultra',
          name: 'Spriteboard Ultra',
          tagline: 'Máxima potencia, rendimiento sin límites y acceso anticipado a novedades.',
          storage: 'Almacenamiento ilimitado',
          price: 19.99,
          priceMonthly: 19.99,
          priceYearly: 15.99,
          currency: 'USD',
          billingPeriod: 'monthly',
          icon: 'diamond',
          badge: 'Máximo Rendimiento',
          isPopular: false,
          buttonText: 'Obtén Spriteboard Ultra',
          features: [
            {
              title: 'Almacenamiento ilimitado en la nube',
              desc: 'Guarda todo tu contenido sin preocuparte por límites de cuota',
              icon: 'cloud',
            },
            {
              title: 'Máxima potencia de cómputo',
              desc: 'Renderizado acelerado por GPU y procesamiento ultra rápido',
              icon: 'memory',
            },
            {
              title: 'Acceso anticipado a funciones beta',
              desc: 'Sé el primero en probar nuevas herramientas, IA y mejoras del sistema',
              icon: 'science',
            },
            {
              title: 'API dedicada e integraciones',
              desc: 'Conecta Spriteboard con tus herramientas y flujos de trabajo externos',
              icon: 'api',
            },
            {
              title: 'Atención personalizada 1 a 1',
              desc: 'Gestor de cuenta dedicado y asesoría técnica directa',
              icon: 'person_pin',
            },
            {
              title: 'SLA de disponibilidad garantizada',
              desc: 'Compromiso de 99.9% de actividad sin interrupciones de servicio',
              icon: 'verified',
            },
          ],
        },
      ];

  if (grid) {
    grid.innerHTML = '';

    tiers.forEach((tier, tierIdx) => {
      const isPopular = Boolean(tier.isPopular);
      const initialPrice = (tier.priceMonthly ?? tier.price).toFixed(2);
      const monthlyPrice = (tier.priceMonthly ?? tier.price).toFixed(2);
      const yearlyPrice = (tier.priceYearly ?? tier.price).toFixed(2);

      let featuresHtml = '';
      const featuresList = Array.isArray(tier.features) ? tier.features : [];

      featuresList.forEach((feat, idx) => {
        // En Pro y Ultra se inserta el separador después de las primeras 2 ventajas
        if (tierIdx > 0 && idx === 2) {
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
            <span class="material-symbols-rounded component-card-feature-icon">${escapeHtml(feat.icon || 'check_circle')}</span>
            <div class="component-card-feature-text-container">
              <span class="component-card-feature-title">${escapeHtml(feat.title || feat.label || '')}</span>
              <span class="component-card-feature-desc">${escapeHtml(feat.desc || '')}</span>
            </div>
          </div>
        `;
      });

      const card = document.createElement('div');
      card.className = `component-card component-card--grouped component-card--plan ${isPopular ? 'component-card--featured' : 'component-card--standard'}`;
      card.setAttribute('data-ref', `plan-card-${tier.id}`);
      card.setAttribute('data-tier', tier.id);

      card.innerHTML = `
        <!-- Sección Encabezado -->
        <div class="component-card-section component-card-section--header" data-ref="card-header-${tier.id}">
          ${isPopular ? `<div class="component-card-popular-badge" data-ref="popular-badge-${tier.id}">${escapeHtml(tier.badge || 'Más popular')}</div>` : ''}
          <h2 class="component-card-title" data-ref="card-title-${tier.id}">${escapeHtml(tier.name)}</h2>
          <p class="component-card-desc" data-ref="card-desc-${tier.id}">${escapeHtml(tier.tagline)}</p>
          <span class="component-badge component-badge--sm component-card-storage-badge" data-ref="storage-badge-${tier.id}">
            <span class="material-symbols-rounded">cloud</span>
            <span>${escapeHtml(tier.storage || 'Almacenamiento en la nube')}</span>
          </span>
        </div>

        <!-- Sección Precio -->
        <div class="component-card-section component-card-section--price" data-ref="card-price-${tier.id}">
          <div class="component-card-price-label">Desde</div>
          <div class="component-card-price-container">
            <span class="component-card-price">
              USD $<span data-ref="plan-price-${tier.id}" data-monthly="${monthlyPrice}" data-yearly="${yearlyPrice}">${initialPrice}</span>
            </span>
            <span class="component-card-period" data-ref="plan-period-${tier.id}" data-period-monthly="/ mes" data-period-yearly="/ mes facturado anualmente">/ mes</span>
          </div>
        </div>

        <!-- Sección Botón de Acción -->
        <div class="component-card-section component-card-section--action" data-ref="card-action-${tier.id}">
          <button type="button" class="component-button component-button--rounded-pill component-button--hover-text component-cursor-pointer component-card-button ${isPopular ? 'component-card-button--featured' : ''}" data-ref="btn-subscribe-${tier.id}" data-action="subscribe" data-tier="${tier.id}">
            <span class="btn-default-text">
              ${escapeHtml(tier.buttonText || `Obtén ${tier.name}`)}
            </span>
            <span class="btn-hover-text">
              Mejorar plan
            </span>
          </button>
        </div>

        <hr class="component-divider" />

        <!-- Sección Características y Límites -->
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

      // Evento del botón de suscripción
      const subscribeBtn = card.querySelector(`[data-ref="btn-subscribe-${tier.id}"]`);
      subscribeBtn?.addEventListener('click', (e) => {
        e.preventDefault();
        showToast(
          t('upgrade.toast_coming_soon', { plan: tier.name }) ||
            `El plan ${tier.name} y la pasarela de pagos estarán disponibles próximamente.`,
          'info'
        );
      });

      // Evento para expandir/ocultar características adicionales
      const toggleFeaturesBtn = card.querySelector(`[data-ref="toggle-btn-${tier.id}"]`);
      if (toggleFeaturesBtn) {
        toggleFeaturesBtn.addEventListener('click', (e) => {
          e.preventDefault();
          const hiddenItems = card.querySelectorAll(`.component-card-feature-item[data-hidden="true"]`);
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
  }

  // Conmutador interactivo de ciclo de facturación con Glider (Mensual / Anual)
  const setBillingCycle = (cycle) => {
    currentBillingCycle = cycle;
    const isYearly = cycle === 'yearly';

    if (togglePill) {
      togglePill.setAttribute('data-cycle', cycle);
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

    // Actualizar precios y etiquetas en todas las tarjetas
    tiers.forEach((tier) => {
      const priceEl = container.querySelector(`[data-ref="plan-price-${tier.id}"]`);
      const periodEl = container.querySelector(`[data-ref="plan-period-${tier.id}"]`);

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

  return container;
}
