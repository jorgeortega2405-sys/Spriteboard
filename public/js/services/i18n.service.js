import { detectBrowserLanguage } from '../utils/languages.util.js';
import { currentUser, postApi } from './api.service.js';

let currentLanguage = 'es-419';
let currentTranslations = {};

function getNestedValue(obj, path) {
  if (!obj || typeof obj !== 'object' || !path) return undefined;
  const keys = path.split('.');
  let current = obj;
  for (const k of keys) {
    if (current === undefined || current === null || typeof current !== 'object') {
      return undefined;
    }
    current = current[k];
  }
  return current;
}

export function t(key, params = {}) {
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

export function getCurrentLanguage() {
  return currentLanguage;
}

async function loadTranslationFile(code) {
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

export async function initI18n() {
  const savedLang = localStorage.getItem('sb_language');
  const userLang = currentUser?.language;
  const browserLang = detectBrowserLanguage();

  currentLanguage = userLang || savedLang || browserLang || 'es-419';
  await loadTranslationFile(currentLanguage);
}

export async function setLanguage(code) {
  if (!code) return;
  currentLanguage = code;
  localStorage.setItem('sb_language', code);

  await loadTranslationFile(code);

  if (currentUser) {
    try {
      await postApi('/api/settings/preferences', { language: code });
    } catch (_) {}
  }
}

export function translateElement(rootEl) {
  if (!rootEl || !(rootEl instanceof HTMLElement)) return rootEl;

  const processNode = (el) => {
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

    const i18nTitleKey = el.getAttribute('data-i18n-title');
    if (i18nTitleKey) {
      el.setAttribute('title', t(i18nTitleKey));
    }
  };

  processNode(rootEl);
  rootEl.querySelectorAll('[data-i18n], [data-i18n-html], [data-i18n-placeholder], [data-i18n-tooltip], [data-i18n-aria], [data-i18n-title]').forEach(processNode);

  return rootEl;
}
