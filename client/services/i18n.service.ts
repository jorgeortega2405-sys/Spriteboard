import { API_ROUTES } from '../config/api-routes.js';
import { detectBrowserLanguage } from '../utils/languages.util.js';
import { currentUser, postApi } from './api.service.js';

let currentLanguage = 'es-419';
let currentTranslations: Record<string, unknown> = {};

function getNestedValue(obj: unknown, path: string): unknown {
  if (!obj || typeof obj !== 'object' || !path) return undefined;
  const keys = path.split('.');
  let current: any = obj;
  for (const k of keys) {
    if (current === undefined || current === null || typeof current !== 'object') {
      return undefined;
    }
    current = current[k];
  }
  return current;
}

export function t(key: string, params: Record<string, string | number> = {}): string {
  if (!key) return '';
  const val = getNestedValue(currentTranslations, key);

  if (val === undefined || val === null) {
    return key;
  }

  let result = String(val);
  if (params && typeof params === 'object') {
    Object.entries(params).forEach(([paramKey, paramValue]) => {
      result = result.replaceAll(`{${paramKey}}`, String(paramValue));
    });
  }

  return result;
}

export function getCurrentLanguage(): string {
  return currentLanguage;
}

async function loadTranslationFile(code: string): Promise<void> {
  try {
    const res = await fetch(`/translations/${encodeURIComponent(code)}.json`);
    if (res.ok) {
      currentTranslations = await res.json();
    } else {
      currentTranslations = {};
    }
  } catch (_) {
    currentTranslations = {};
  }
}

export async function initI18n(): Promise<void> {
  const savedLang = localStorage.getItem('sb_language');
  const userLang = currentUser?.language;
  const browserLang = detectBrowserLanguage();

  currentLanguage = userLang || savedLang || browserLang || 'es-419';
  await loadTranslationFile(currentLanguage);
}

export async function setLanguage(code: string): Promise<void> {
  if (!code) return;
  currentLanguage = code;
  localStorage.setItem('sb_language', code);

  await loadTranslationFile(code);

  if (currentUser) {
    try {
      await postApi(API_ROUTES.settings.preferences, { language: code });
    } catch (_) {}
  }
}

export function translateElement(rootEl: HTMLElement): HTMLElement {
  if (!rootEl || !(rootEl instanceof HTMLElement)) return rootEl;

  const processNode = (el: HTMLElement) => {
    const i18nKey = el.getAttribute('data-i18n');
    if (i18nKey) {
      el.textContent = t(i18nKey);
    }

    const i18nHtmlKey = el.getAttribute('data-i18n-html');
    if (i18nHtmlKey) {
      el.innerHTML = t(i18nHtmlKey);
    }

    const i18nPlaceholderKey = el.getAttribute('data-i18n-placeholder');
    if (i18nPlaceholderKey) {
      el.setAttribute('placeholder', t(i18nPlaceholderKey));
    }

    const i18nTooltipKey = el.getAttribute('data-i18n-tooltip');
    if (i18nTooltipKey) {
      el.setAttribute('data-tooltip', t(i18nTooltipKey));
    }

    const i18nAriaKey = el.getAttribute('data-i18n-aria');
    if (i18nAriaKey) {
      el.setAttribute('aria-label', t(i18nAriaKey));
    }
  };

  processNode(rootEl);
  const elements = rootEl.querySelectorAll<HTMLElement>(
    '[data-i18n], [data-i18n-html], [data-i18n-placeholder], [data-i18n-tooltip], [data-i18n-aria]'
  );
  elements.forEach(processNode);

  return rootEl;
}
