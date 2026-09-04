/**
 * Servicio Central de Internacionalización (i18n) para Spriteboard
 * Garantiza:
 * - Carga asíncrona de diccionarios JSON desde /translations/{code}.json
 * - CERO Fallbacks: Si no existe el archivo o la clave, retorna directamente la clave solicitada
 * - CERO llamadas a console.*
 * - Traducción automática de atributos semánticos [data-i18n*] en el DOM
 */

import { currentUser, postApi } from './api.js';
import { detectBrowserLanguage } from '../utils/languages.js';

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

/**
 * Retorna la traducción para una clave dada con reemplazo de parámetros opcionales.
 * REGLA ESTRICTA: Si la clave no existe o no hay diccionario para el idioma seleccionado, retorna la clave literal.
 * @param {string} key - Clave jerárquica de traducción (ej: 'nav.home')
 * @param {Record<string, string|number>} [params] - Parámetros de interpolación {nombre: 'valor'}
 * @returns {string}
 */
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

/**
 * Obtiene el código del idioma activo actualmente
 * @returns {string}
 */
export function getCurrentLanguage() {
  return currentLanguage;
}

/**
 * Carga el diccionario de traducción para un código de idioma
 * @param {string} code - Código del idioma (ej: 'es-419', 'en-US')
 */
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

/**
 * Inicializa el sistema de traducción antes del renderizado inicial
 * @returns {Promise<void>}
 */
export async function initI18n() {
  const savedLang = localStorage.getItem('sb_language');
  const userLang = currentUser?.language;
  const browserLang = detectBrowserLanguage();

  currentLanguage = userLang || savedLang || browserLang || 'es-419';
  await loadTranslationFile(currentLanguage);
}

/**
 * Cambia el idioma activo de la aplicación
 * @param {string} code - Código de idioma a establecer
 * @returns {Promise<void>}
 */
export async function setLanguage(code) {
  if (!code) return;
  currentLanguage = code;
  localStorage.setItem('sb_language', code);

  await loadTranslationFile(code);

  if (currentUser) {
    try {
      await postApi('/api/user/preferences', { language: code });
    } catch (_) {
      // Falla silenciosa sin console.*
    }
  }
}

/**
 * Aplica traducciones en un elemento del DOM procesando todos sus atributos [data-i18n*]
 * @param {HTMLElement} rootEl - Elemento raíz a traducir
 * @returns {HTMLElement}
 */
export function translateElement(rootEl) {
  if (!rootEl || !(rootEl instanceof HTMLElement)) return rootEl;

  const processNode = (el) => {
    // 1. data-i18n -> textContent
    const i18nKey = el.getAttribute('data-i18n');
    if (i18nKey) {
      el.textContent = t(i18nKey);
    }

    // 2. data-i18n-html -> innerHTML
    const i18nHtmlKey = el.getAttribute('data-i18n-html');
    if (i18nHtmlKey) {
      el.innerHTML = t(i18nHtmlKey);
    }

    // 3. data-i18n-placeholder -> placeholder
    const i18nPlaceholderKey = el.getAttribute('data-i18n-placeholder');
    if (i18nPlaceholderKey) {
      el.setAttribute('placeholder', t(i18nPlaceholderKey));
    }

    // 4. data-i18n-tooltip -> data-tooltip
    const i18nTooltipKey = el.getAttribute('data-i18n-tooltip');
    if (i18nTooltipKey) {
      el.setAttribute('data-tooltip', t(i18nTooltipKey));
    }

    // 5. data-i18n-aria -> aria-label
    const i18nAriaKey = el.getAttribute('data-i18n-aria');
    if (i18nAriaKey) {
      el.setAttribute('aria-label', t(i18nAriaKey));
    }

    // 6. data-i18n-title -> title
    const i18nTitleKey = el.getAttribute('data-i18n-title');
    if (i18nTitleKey) {
      el.setAttribute('title', t(i18nTitleKey));
    }
  };

  processNode(rootEl);
  rootEl.querySelectorAll('[data-i18n], [data-i18n-html], [data-i18n-placeholder], [data-i18n-tooltip], [data-i18n-aria], [data-i18n-title]').forEach(processNode);

  return rootEl;
}
