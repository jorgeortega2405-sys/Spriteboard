import { loadTemplate } from '../../services/template.js';
import { createSidebar } from '../../components/sidebar.js';
import { navigate, render } from '../../router.js';
import { escapeHtml } from '../../services/api.js';
import { setupDropdown } from '../../utils/dom.js';
import { showToast } from '../../services/toast.js';
import { t, setLanguage, getCurrentLanguage } from '../../services/i18n.js';
import {
  AVAILABLE_LANGUAGES,
  getLanguageName,
  detectBrowserLanguage,
} from '../../utils/languages.js';

export async function createGuestSettingsView() {
  const container = await loadTemplate('/views/settings/guest.html');

  // Insertar la barra lateral (sidebar) dentro del contenedor de contenido
  const sidebar = await createSidebar();
  container.prepend(sidebar);

  // Inicializar dropdown de idioma
  const langDropdown = container.querySelector('[data-ref="dropdown-wrapper-guest-language"]');
  const langSelectedText = container.querySelector('[data-ref="guest-language-selected-text"]');
  const langListEl = container.querySelector('[data-ref="list-guest-languages"]');
  const langSearchInput = container.querySelector('[data-ref="input-search-guest-language"]');
  const langEmptyEl = container.querySelector('[data-ref="empty-guest-languages"]');

  const renderLanguagesList = (activeLang) => {
    if (!langListEl) return;
    langListEl.innerHTML = AVAILABLE_LANGUAGES.map((l) => {
      const isActive = l.code.toLowerCase() === (activeLang || '').toLowerCase();
      return `<button type="button" class="menu-item${isActive ? ' is-active' : ''}" data-ref="option-guest-lang-${l.code}" data-lang="${l.code}">
        <span class="material-symbols-rounded menu-item__icon">language</span>
        <span class="menu-item__text">${escapeHtml(l.name)}</span>
      </button>`;
    }).join('');
  };

  const filterLanguages = (query) => {
    if (!langListEl) return;
    const cleanQuery = query.toLowerCase().trim();
    let matchesCount = 0;
    const items = langListEl.querySelectorAll('.menu-item');
    items.forEach((item) => {
      const name = item.querySelector('.menu-item__text')?.textContent?.toLowerCase() || '';
      const code = (item.getAttribute('data-lang') || '').toLowerCase();
      const match = !cleanQuery || name.includes(cleanQuery) || code.includes(cleanQuery);
      item.style.display = match ? 'flex' : 'none';
      if (match) matchesCount++;
    });
    if (langEmptyEl) {
      langEmptyEl.style.display = matchesCount === 0 ? 'block' : 'none';
    }
  };

  let dropdownController = null;

  langSearchInput?.addEventListener('input', (e) => {
    filterLanguages(e.target.value);
    dropdownController?.update();
  });

  let guestLanguage = getCurrentLanguage() || detectBrowserLanguage();
  renderLanguagesList(guestLanguage);
  if (langSelectedText) {
    langSelectedText.textContent = getLanguageName(guestLanguage);
  }

  if (langDropdown) {
    dropdownController = setupDropdown(langDropdown, {
      onSelect: async (lang) => {
        guestLanguage = lang;
        if (langSelectedText) {
          langSelectedText.textContent = getLanguageName(lang);
        }
        await setLanguage(lang);
        showToast(t('toasts.language_updated'), 'success');
        render();
      },
      onClose: () => {
        if (langSearchInput) {
          langSearchInput.value = '';
          filterLanguages('');
        }
      },
    });
  }

  const btnToLogin = container.querySelector('[data-ref="btn-guest-to-login"]');
  btnToLogin?.addEventListener('click', (e) => {
    e.preventDefault();
    navigate('/login');
  });

  return container;
}
