/**
 * Servicio Centralizado de Gestión de Temas y Accesibilidad (ThemeService)
 *
 * Administra el modo claro (light), oscuro (dark) y sincronización con el sistema (system).
 * Aplica atributos data-theme, data-contrast y data-reduce-motion al elemento <html>.
 * Garantiza persistencia en localStorage y sincronización con el backend (/api/settings/preferences).
 *
 * Cumple con las directivas de seguridad y cero console.*.
 */

import { postApi } from './api.js';
import { reportEvent } from './telemetry.js';

const STORAGE_KEY = 'sprite_theme';
let currentThemeSetting = 'system';
let systemMediaListenerAttached = false;

/**
 * Determina el tema efectivo ('light' o 'dark') en base a la configuración actual
 */
export function getEffectiveTheme(setting = currentThemeSetting) {
  if (setting === 'dark') return 'dark';
  if (setting === 'light') return 'light';
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return 'light';
}

/**
 * Obtiene la configuración actual ('system' | 'light' | 'dark')
 */
export function getTheme() {
  return currentThemeSetting;
}

/**
 * Aplica el tema al DOM en document.documentElement (<html>)
 */
function applyThemeToDom(themeSetting) {
  if (typeof document === 'undefined') return;
  const effective = getEffectiveTheme(themeSetting);
  document.documentElement.setAttribute('data-theme', effective);
  document.documentElement.classList.toggle('dark-theme', effective === 'dark');
  document.documentElement.classList.toggle('light-theme', effective === 'light');

  // Notificar cambio a posibles observadores o componentes dinámicos
  window.dispatchEvent(
    new CustomEvent('themechange', {
      detail: { setting: themeSetting, effective },
    })
  );
}

/**
 * Cambia la configuración del tema y opcionalmente la persiste en backend y localStorage
 * @param {'system' | 'light' | 'dark'} newTheme
 * @param {boolean} [syncBackend=false]
 */
export async function setTheme(newTheme, syncBackend = false) {
  if (!['system', 'light', 'dark'].includes(newTheme)) {
    newTheme = 'system';
  }

  currentThemeSetting = newTheme;

  try {
    localStorage.setItem(STORAGE_KEY, newTheme);
  } catch {
    // Falla silenciosa de almacenamiento local
  }

  applyThemeToDom(newTheme);

  // Registrar evento analítico en telemetría
  reportEvent('theme_changed', 'ui', {
    theme: newTheme,
    effective: getEffectiveTheme(newTheme),
  });

  if (syncBackend) {
    try {
      await postApi('/api/settings/preferences', { theme: newTheme });
    } catch {
      // Falla silenciosa
    }
  }
}

/**
 * Aplica preferencias de accesibilidad adicionales (alto contraste y reducción de movimiento)
 */
export function applyAccessibilityPreferences(prefs = {}) {
  if (typeof document === 'undefined') return;

  if (typeof prefs.high_contrast === 'boolean') {
    document.documentElement.setAttribute('data-contrast', prefs.high_contrast ? 'high' : 'normal');
    document.documentElement.classList.toggle('high-contrast', prefs.high_contrast);
  }

  if (typeof prefs.reduce_motion === 'boolean') {
    document.documentElement.setAttribute('data-reduce-motion', prefs.reduce_motion ? 'true' : 'false');
    document.documentElement.classList.toggle('reduce-motion', prefs.reduce_motion);
  }
}

/**
 * Inicializa el servicio de temas al cargar la aplicación
 * @param {object} [initialPrefs] - Preferencias cargadas del usuario si existen
 */
export function initTheme(initialPrefs = null) {
  // 1. Cargar desde preferencias de base de datos o localStorage
  let savedTheme = 'system';
  if (initialPrefs && initialPrefs.theme) {
    savedTheme = initialPrefs.theme;
  } else {
    try {
      savedTheme = localStorage.getItem(STORAGE_KEY) || 'system';
    } catch {
      savedTheme = 'system';
    }
  }

  currentThemeSetting = savedTheme;
  applyThemeToDom(savedTheme);

  if (initialPrefs) {
    applyAccessibilityPreferences(initialPrefs);
  }

  // 2. Escuchar cambios de preferencia de color del sistema operativo si no está fijado en light/dark
  if (!systemMediaListenerAttached && typeof window !== 'undefined' && window.matchMedia) {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleSystemChange = () => {
      if (currentThemeSetting === 'system') {
        applyThemeToDom('system');
      }
    };

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleSystemChange);
    } else if (mediaQuery.addListener) {
      mediaQuery.addListener(handleSystemChange);
    }

    systemMediaListenerAttached = true;
  }
}
