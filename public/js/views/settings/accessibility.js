import { loadTemplate } from '../../services/template.js';
import { createSidebar } from '../../components/sidebar.js';
import { getApi, postApi } from '../../services/api.js';
import { setupDropdown } from '../../utils/dom.js';
import { showToast, setToastPreferences } from '../../services/toast.js';
import { t } from '../../services/i18n.js';
import { setTheme, initTheme, applyAccessibilityPreferences } from '../../services/theme.service.js';

export async function createAccessibilityView() {
  const container = await loadTemplate('/views/settings/accessibility.html');

  // Insertar la barra lateral (sidebar) dentro del contenedor de contenido
  const sidebar = await createSidebar();
  container.prepend(sidebar);

  const themeDropdown = container.querySelector('[data-ref="dropdown-wrapper-theme"]');
  const themeSelectedText = container.querySelector('[data-ref="theme-selected-text"]');
  const themeSelectedIcon = container.querySelector('[data-ref="theme-selected-icon"]');

  const toggleReduceMotion = container.querySelector('[data-ref="toggle-reduce-motion"]');
  const toggleHighContrast = container.querySelector('[data-ref="toggle-high-contrast"]');
  const toggleExtendedAlerts = container.querySelector('[data-ref="toggle-extended-alerts"]');

  const getThemeLabel = (theme) => {
    switch (theme) {
      case 'light': return t('settings.accessibility.theme_light');
      case 'dark': return t('settings.accessibility.theme_dark');
      default: return t('settings.accessibility.theme_system');
    }
  };

  const themeIcons = {
    system: 'brightness_auto',
    light: 'light_mode',
    dark: 'dark_mode',
  };

  if (themeSelectedText) {
    themeSelectedText.textContent = getThemeLabel('system');
  }

  // 1. Cargar preferencias existentes
  try {
    const prefRes = await getApi('/api/settings/preferences');
    if (prefRes.ok) {
      const prefData = await prefRes.json();
      const prefs = prefData.preferences;

      if (prefs) {
        setToastPreferences(prefs);
        applyAccessibilityPreferences(prefs);
        initTheme(prefs);

        if (prefs.theme && themeIcons[prefs.theme]) {
          if (themeSelectedText) themeSelectedText.textContent = getThemeLabel(prefs.theme);
          if (themeSelectedIcon) themeSelectedIcon.textContent = themeIcons[prefs.theme];

          if (themeDropdown) {
            const activeItem = themeDropdown.querySelector(`[data-theme="${prefs.theme}"]`);
            if (activeItem) {
              themeDropdown.querySelectorAll('.menu-item').forEach((i) => i.classList.remove('is-active'));
              activeItem.classList.add('is-active');
            }
          }
        }

        if (toggleReduceMotion) toggleReduceMotion.checked = Boolean(prefs.reduce_motion);
        if (toggleHighContrast) toggleHighContrast.checked = Boolean(prefs.high_contrast);
        if (toggleExtendedAlerts) toggleExtendedAlerts.checked = Boolean(prefs.extended_alerts);
      }
    }
  } catch (_) {}

  // 2. Inicializar dropdown de tema
  if (themeDropdown) {
    setupDropdown(themeDropdown, {
      onSelect: async (theme) => {
        try {
          if (themeSelectedText) themeSelectedText.textContent = getThemeLabel(theme);
          if (themeSelectedIcon && themeIcons[theme]) themeSelectedIcon.textContent = themeIcons[theme];
          await setTheme(theme, true);
          showToast(t('toasts.theme_updated'), 'success');
        } catch (_) {}
      },
    });
  }

  // 3. Listeners para interruptores toggle
  toggleReduceMotion?.addEventListener('change', async (e) => {
    try {
      applyAccessibilityPreferences({ reduce_motion: e.target.checked });
      await postApi('/api/settings/preferences', { reduce_motion: e.target.checked });
      showToast(t('toasts.preferences_saved'), 'success');
    } catch (_) {}
  });

  toggleHighContrast?.addEventListener('change', async (e) => {
    try {
      applyAccessibilityPreferences({ high_contrast: e.target.checked });
      await postApi('/api/settings/preferences', { high_contrast: e.target.checked });
      showToast(t('toasts.preferences_saved'), 'success');
    } catch (_) {}
  });

  toggleExtendedAlerts?.addEventListener('change', async (e) => {
    try {
      await postApi('/api/settings/preferences', { extended_alerts: e.target.checked });
      setToastPreferences({ extended_alerts: e.target.checked });
      showToast(t('toasts.preferences_saved'), 'success');
    } catch (_) {}
  });

  return container;
}
