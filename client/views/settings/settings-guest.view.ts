import { AVAILABLE_LANGUAGES, detectBrowserLanguage, getLanguageName } from '../../utils/languages.util.js';
import { escapeHtml } from '../../services/api.service.js';
import { getCurrentLanguage, setLanguage, t } from '../../services/i18n.service.js';
import { loadTemplate } from '../../services/template.service.js';
import { navigate, render } from '../../app-router.js';
import { setupDropdown } from '../../utils/dom.util.js';
import { showToast } from '../../services/toast.service.js';

export async function createGuestSettingsView(): Promise<HTMLElement> {
  const container = await loadTemplate('/views/settings/guest.html');

  const langDropdown = container.querySelector<HTMLElement>(
    '[data-ref="dropdown-wrapper-guest-language"]'
  );
  const langSelectedText = container.querySelector<HTMLElement>(
    '[data-ref="guest-language-selected-text"]'
  );
  const langListEl = container.querySelector<HTMLElement>('[data-ref="list-guest-languages"]');
  const langSearchInput = container.querySelector<HTMLInputElement>(
    '[data-ref="input-search-guest-language"]'
  );
  const langEmptyEl = container.querySelector<HTMLElement>('[data-ref="empty-guest-languages"]');

  const renderLanguagesList = (currentLang: string) => {
    if (!langListEl) return;
    langListEl.innerHTML = AVAILABLE_LANGUAGES.map((l) => {
      const isActive = l.code.toLowerCase() === (currentLang || '').toLowerCase();
      return `<button type="button" class="menu-item${isActive ? ' is-active' : ''}" data-ref="option-guest-lang-${l.code}" data-lang="${l.code}">
        <svg class="component-icon menu-item__icon" aria-hidden="true"><use href="/icons.svg#language"></use></svg>
        <span class="menu-item__text">${escapeHtml(l.name)}</span>
      </button>`;
    }).join('');
  };

  const filterLanguages = (query: string) => {
    if (!langListEl) return;
    const cleanQuery = query.toLowerCase().trim();
    let matchesCount = 0;
    const items = langListEl.querySelectorAll<HTMLElement>('.menu-item');
    items.forEach((item) => {
      const name =
        item.querySelector('.menu-item__text')?.textContent?.toLowerCase() || '';
      const code = (item.getAttribute('data-lang') || '').toLowerCase();
      const match = !cleanQuery || name.includes(cleanQuery) || code.includes(cleanQuery);
      item.style.display = match ? 'flex' : 'none';
      if (match) matchesCount++;
    });
    if (langEmptyEl) {
      langEmptyEl.style.display = matchesCount === 0 ? 'block' : 'none';
    }
  };

  let dropdownController: { close: () => void; destroy: () => void; update: () => void } | null = null;

  langSearchInput?.addEventListener('input', (e: Event) => {
    filterLanguages((e.target as HTMLInputElement).value);
    dropdownController?.update();
  });

  let guestLanguage = getCurrentLanguage() || detectBrowserLanguage();
  renderLanguagesList(guestLanguage);
  if (langSelectedText) {
    langSelectedText.textContent = getLanguageName(guestLanguage);
  }

  if (langDropdown) {
    dropdownController = setupDropdown(langDropdown, {
      onSelect: async (lang: string) => {
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

  const btnToLogin = container.querySelector<HTMLElement>('[data-ref="btn-guest-to-login"]');
  btnToLogin?.addEventListener('click', (e) => {
    e.preventDefault();
    navigate('/login');
  });

  return container;
}
