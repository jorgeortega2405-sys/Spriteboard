import { API_ROUTES } from '../config/api-routes.js';
import { postApi } from './api.service.js';
import { reportEvent } from './telemetry.service.js';

const STORAGE_KEY = 'sprite_theme';
let currentThemeSetting = 'system';
let systemMediaListenerAttached = false;

export function getEffectiveTheme(setting = currentThemeSetting): 'dark' | 'light' {
  if (setting === 'dark') return 'dark';
  if (setting === 'light') return 'light';
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return 'light';
}

export function getTheme(): string {
  return currentThemeSetting;
}

function applyThemeToDom(themeSetting: string): void {
  if (typeof document === 'undefined') return;
  const effective = getEffectiveTheme(themeSetting);
  document.documentElement.setAttribute('data-theme', effective);
  document.documentElement.classList.toggle('dark-theme', effective === 'dark');
  document.documentElement.classList.toggle('light-theme', effective === 'light');

  window.dispatchEvent(
    new CustomEvent('themechange', {
      detail: { setting: themeSetting, effective },
    })
  );
}

export async function setTheme(newTheme: string, syncBackend = false): Promise<void> {
  if (!['system', 'light', 'dark'].includes(newTheme)) {
    newTheme = 'system';
  }

  currentThemeSetting = newTheme;

  try {
    localStorage.setItem(STORAGE_KEY, newTheme);
  } catch {}

  applyThemeToDom(newTheme);

  reportEvent('theme_changed', 'ui', {
    theme: newTheme,
    effective: getEffectiveTheme(newTheme),
  });

  if (syncBackend) {
    try {
      await postApi(API_ROUTES.settings.preferences, { theme: newTheme });
    } catch {}
  }
}

export function applyAccessibilityPreferences(prefs: { high_contrast?: boolean; reduce_motion?: boolean } = {}): void {
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

export function initTheme(initialPrefs: { theme?: string; high_contrast?: boolean; reduce_motion?: boolean } | null = null): void {
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
