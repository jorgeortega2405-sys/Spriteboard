import { API_ROUTES } from '../../config/api-routes.js';
import { applyAccessibilityPreferences, getTheme, setTheme } from '../../services/theme.service.js';
import { debounce, setupDropdown } from '../../utils/dom.util.js';
import { getApi, postApi } from '../../services/api.service.js';
import { loadTemplate } from '../../services/template.service.js';
import { setToastPreferences, showToast } from '../../services/toast.service.js';
import { t } from '../../services/i18n.service.js';

export async function createAccessibilityView(): Promise<HTMLElement> {
  const container = await loadTemplate('/views/settings/accessibility.html');

  const themeDropdown = container.querySelector<HTMLElement>('[data-ref="dropdown-wrapper-theme"]');
  const themeSelectedText = container.querySelector<HTMLElement>('[data-ref="theme-selected-text"]');
  const themeSelectedIcon = container.querySelector<HTMLElement>('[data-ref="theme-selected-icon"]');

  const toggleReduceMotion = container.querySelector<HTMLInputElement>('[data-ref="toggle-reduce-motion"]');
  const toggleHighContrast = container.querySelector<HTMLInputElement>('[data-ref="toggle-high-contrast"]');
  const toggleExtendedAlerts = container.querySelector<HTMLInputElement>(
    '[data-ref="toggle-extended-alerts"]'
  );

  const getThemeLabel = (theme: string) => {
    switch (theme) {
      case 'light':
        return t('settings.accessibility.theme_light') || 'Claro';
      case 'dark':
        return t('settings.accessibility.theme_dark') || 'Oscuro';
      default:
        return t('settings.accessibility.theme_system') || 'Automático (del sistema)';
    }
  };

  const themeIcons: Record<string, string> = {
    system: 'brightness_auto',
    light: 'light_mode',
    dark: 'dark_mode',
  };

  const updateThemeUi = (theme: string) => {
    const validTheme = ['system', 'light', 'dark'].includes(theme) ? theme : 'system';
    if (themeSelectedText) {
      themeSelectedText.textContent = getThemeLabel(validTheme);
    }
    if (themeSelectedIcon && themeIcons[validTheme]) {
      themeSelectedIcon.textContent = themeIcons[validTheme];
    }
    if (themeDropdown) {
      const activeItem = themeDropdown.querySelector<HTMLElement>(
        `[data-theme-value="${validTheme}"], [data-theme="${validTheme}"]`
      );
      if (activeItem) {
        themeDropdown
          .querySelectorAll('.menu-item')
          .forEach((i) => i.classList.remove('is-active'));
        activeItem.classList.add('is-active');
      }
    }
  };

  updateThemeUi(getTheme());

  try {
    const prefRes = await getApi(API_ROUTES.settings.preferences);
    if (prefRes.ok) {
      const prefData = await prefRes.json();
      const prefs = prefData.preferences;

      if (prefs) {
        setToastPreferences(prefs);
        applyAccessibilityPreferences(prefs);

        const currentLocal = localStorage.getItem('sprite_theme');
        if (!currentLocal && prefs.theme && ['system', 'light', 'dark'].includes(prefs.theme)) {
          await setTheme(prefs.theme, false);
          updateThemeUi(prefs.theme);
        } else {
          updateThemeUi(getTheme());
        }

        if (toggleReduceMotion)
          toggleReduceMotion.checked = Boolean(prefs.reduce_motion);
        if (toggleHighContrast)
          toggleHighContrast.checked = Boolean(prefs.high_contrast);
        if (toggleExtendedAlerts)
          toggleExtendedAlerts.checked = Boolean(prefs.extended_alerts);
      }
    }
  } catch (_) {}

  if (themeDropdown) {
    setupDropdown(themeDropdown, {
      onSelect: async (theme: string) => {
        try {
          updateThemeUi(theme);
          await setTheme(theme, true);
          showToast(t('toasts.theme_updated') || 'Tema actualizado', 'success');
        } catch (_) {}
      },
    });
  }

  const saveReduceMotion = debounce(async (checked: boolean) => {
    try {
      await postApi(API_ROUTES.settings.preferences, { reduce_motion: checked });
      showToast(t('toasts.preferences_saved'), 'success');
    } catch (_) {}
  }, 350);

  const saveHighContrast = debounce(async (checked: boolean) => {
    try {
      await postApi(API_ROUTES.settings.preferences, { high_contrast: checked });
      showToast(t('toasts.preferences_saved'), 'success');
    } catch (_) {}
  }, 350);

  const saveExtendedAlerts = debounce(async (checked: boolean) => {
    try {
      await postApi(API_ROUTES.settings.preferences, { extended_alerts: checked });
      showToast(t('toasts.preferences_saved'), 'success');
    } catch (_) {}
  }, 350);

  toggleReduceMotion?.addEventListener('change', (e: Event) => {
    const checked = (e.target as HTMLInputElement).checked;
    applyAccessibilityPreferences({ reduce_motion: checked });
    saveReduceMotion(checked);
  });

  toggleHighContrast?.addEventListener('change', (e: Event) => {
    const checked = (e.target as HTMLInputElement).checked;
    applyAccessibilityPreferences({ high_contrast: checked });
    saveHighContrast(checked);
  });

  toggleExtendedAlerts?.addEventListener('change', (e: Event) => {
    const checked = (e.target as HTMLInputElement).checked;
    setToastPreferences({ extended_alerts: checked });
    saveExtendedAlerts(checked);
  });

  return container;
}
