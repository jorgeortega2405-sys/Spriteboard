import { postApi } from './api.service.js';

function rateMetric(name: string, value: number): 'good' | 'needs_improvement' | 'poor' {
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

export async function reportEvent(eventName: string, category = 'ui', metadata: Record<string, unknown> = {}): Promise<void> {
  try {
    await postApi('/api/telemetry/events', {
      eventName,
      event_name: eventName,
      category,
      metadata,
    });
  } catch {}
}

export async function reportWebVital(name: string, value: number, rating: string | null = null): Promise<void> {
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
  } catch {}
}

export function trackPageView(toPath: string, fromPath = ''): void {
  reportEvent('page_view', 'navigation', {
    to: toPath,
    from: fromPath,
    title: document.title,
  });
}

export function initWebVitals(): void {
  if (typeof window === 'undefined' || !('PerformanceObserver' in window)) {
    return;
  }

  try {
    const navEntries = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
    if (navEntries.length > 0) {
      const nav = navEntries[0];
      const ttfb = nav.responseStart - nav.requestStart;
      if (ttfb > 0) {
        reportWebVital('TTFB', ttfb);
      }
    }
  } catch {}

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
  } catch {}

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
  } catch {}

  try {
    let clsValue = 0;
    const clsObserver = new PerformanceObserver((entryList) => {
      for (const entry of entryList.getEntries()) {
        const layoutShift = entry as any;
        if (!layoutShift.hadRecentInput) {
          clsValue += layoutShift.value;
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
  } catch {}

  try {
    const fidObserver = new PerformanceObserver((entryList) => {
      const firstInput = entryList.getEntries()[0] as any;
      if (firstInput) {
        const delay = firstInput.processingStart - firstInput.startTime;
        reportWebVital('FID', delay);
        fidObserver.disconnect();
      }
    });
    fidObserver.observe({ type: 'first-input', buffered: true });
  } catch {}
}
