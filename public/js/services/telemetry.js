/**
 * Servicio de Telemetría del Frontend para Spriteboard
 *
 * Captura y envía métricas de rendimiento (Web Vitals: LCP, FID, CLS, FCP, TTFB)
 * y eventos de interacción en la interfaz de usuario hacia el backend.
 *
 * Cumple estrictamente con las directivas de seguridad y cero console.*.
 */

import { postApi } from './api.js';

// Calificaciones estándar de Web Vitals según umbrales de Google
function rateMetric(name, value) {
  switch (name) {
    case 'LCP':
      return value <= 2500 ? 'good' : value <= 4000 ? 'needs_improvement' : 'poor';
    case 'FID':
      return value <= 100 ? 'good' : value <= 300 ? 'needs_improvement' : 'poor';
    case 'CLS':
      return value <= 0.1 ? 'good' : value <= 0.25 ? 'needs_improvement' : 'poor';
    case 'FCP':
      return value <= 1800 ? 'good' : value <= 3000 ? 'needs_improvement' : 'poor';
    case 'TTFB':
      return value <= 800 ? 'good' : value <= 1800 ? 'needs_improvement' : 'poor';
    default:
      return 'good';
  }
}

/**
 * Reporta un evento analítico o de interacción del usuario
 * @param {string} eventName - Nombre del evento (ej: 'page_view', 'theme_changed')
 * @param {string} [category='ui'] - Categoría (ej: 'ui', 'navigation', 'auth')
 * @param {Record<string, any>} [metadata={}] - Metadatos contextuales
 */
export async function reportEvent(eventName, category = 'ui', metadata = {}) {
  try {
    await postApi('/api/telemetry/events', {
      eventName,
      event_name: eventName,
      category,
      metadata,
    });
  } catch {
    // Falla silenciosa sin llamadas a console.*
  }
}

/**
 * Reporta una métrica de Core Web Vitals al backend
 * @param {string} name - Nombre de la métrica (LCP, FID, CLS, FCP, TTFB)
 * @param {number} value - Valor medido
 * @param {'good' | 'needs_improvement' | 'poor'} [rating] - Calificación
 */
export async function reportWebVital(name, value, rating = null) {
  try {
    const finalRating = rating || rateMetric(name, value);
    await postApi('/api/telemetry/vitals', {
      metricName: name,
      metric_name: name,
      value: Math.round(value * 100) / 100,
      rating: finalRating,
      pagePath: window.location.pathname || '/',
      route: window.location.pathname || '/',
    });
  } catch {
    // Falla silenciosa sin llamadas a console.*
  }
}

/**
 * Registra un evento de cambio de ruta / vista
 * @param {string} toPath - Ruta destino
 * @param {string} [fromPath] - Ruta previa
 */
export function trackPageView(toPath, fromPath = '') {
  reportEvent('page_view', 'navigation', {
    to: toPath,
    from: fromPath,
    title: document.title,
  });
}

/**
 * Inicializa la recolección automática de Core Web Vitals usando PerformanceObserver
 */
export function initWebVitals() {
  if (typeof window === 'undefined' || !('PerformanceObserver' in window)) {
    return;
  }

  // Medir Time to First Byte (TTFB) desde el Navigation Timing API
  try {
    const navEntries = performance.getEntriesByType('navigation');
    if (navEntries.length > 0) {
      const nav = navEntries[0];
      const ttfb = nav.responseStart - nav.requestStart;
      if (ttfb > 0) {
        reportWebVital('TTFB', ttfb);
      }
    }
  } catch {
    // Falla silenciosa
  }

  // Medir First Contentful Paint (FCP)
  try {
    const paintObserver = new PerformanceObserver((entryList) => {
      for (const entry of entryList.getEntries()) {
        if (entry.name === 'first-contentful-paint') {
          reportWebVital('FCP', entry.startTime);
          paintObserver.disconnect();
          break;
        }
      }
    });
    paintObserver.observe({ type: 'paint', buffered: true });
  } catch {
    // Falla silenciosa
  }

  // Medir Largest Contentful Paint (LCP)
  try {
    let lastLcp = 0;
    const lcpObserver = new PerformanceObserver((entryList) => {
      const entries = entryList.getEntries();
      if (entries.length > 0) {
        lastLcp = entries[entries.length - 1].startTime;
      }
    });
    lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });

    const sendLcp = () => {
      if (lastLcp > 0) {
        reportWebVital('LCP', lastLcp);
        lastLcp = 0;
      }
    };
    window.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        sendLcp();
      }
    });
    window.addEventListener('pagehide', sendLcp);
  } catch {
    // Falla silenciosa
  }

  // Medir Cumulative Layout Shift (CLS)
  try {
    let clsValue = 0;
    const clsObserver = new PerformanceObserver((entryList) => {
      for (const entry of entryList.getEntries()) {
        if (!entry.hadRecentInput) {
          clsValue += entry.value;
        }
      }
    });
    clsObserver.observe({ type: 'layout-shift', buffered: true });

    const sendCls = () => {
      if (clsValue > 0) {
        reportWebVital('CLS', clsValue);
        clsValue = 0;
      }
    };
    window.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        sendCls();
      }
    });
    window.addEventListener('pagehide', sendCls);
  } catch {
    // Falla silenciosa
  }

  // Medir First Input Delay (FID)
  try {
    const fidObserver = new PerformanceObserver((entryList) => {
      const firstInput = entryList.getEntries()[0];
      if (firstInput) {
        const delay = firstInput.processingStart - firstInput.startTime;
        reportWebVital('FID', delay);
        fidObserver.disconnect();
      }
    });
    fidObserver.observe({ type: 'first-input', buffered: true });
  } catch {
    // Falla silenciosa
  }
}
