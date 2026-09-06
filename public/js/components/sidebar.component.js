import { loadTemplate } from '../services/template.service.js';
import { navigate } from '../app-router.js';
import { currentUser } from '../services/api.service.js';
import { translateElement } from '../services/i18n.service.js';
import { toggleChatSidebar } from './chat-sidebar.js';

let isSidebarOpen = false;

export function getIsSidebarOpen() {
  return isSidebarOpen;
}

export function toggleSidebar(forceState) {
  isSidebarOpen = forceState !== undefined ? forceState : !isSidebarOpen;
  const sidebar = document.querySelector('[data-ref="sidebar"]');

  if (sidebar) {
    sidebar.classList.toggle('is-active', isSidebarOpen);
    if (isSidebarOpen) {
      toggleChatSidebar(false);
    }
  }
}

// Cerrar sidebar al hacer clic fuera o al presionar Escape
document.addEventListener('click', (e) => {
  if (!isSidebarOpen) return;
  const sidebar = document.querySelector('[data-ref="sidebar"]');
  const btnToggle = document.querySelector('[data-ref="btn-toggle-menu"]');

  if (sidebar && !sidebar.contains(e.target) && (!btnToggle || !btnToggle.contains(e.target))) {
    toggleSidebar(false);
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && isSidebarOpen) {
    toggleSidebar(false);
  }
});

export async function createSidebar() {
  const sidebar = await loadTemplate('/views/components/sidebar.html');

  if (isSidebarOpen) {
    sidebar.classList.add('is-active');
  }

  const currentPath = window.location.pathname;
  const sidebarHeader = sidebar.querySelector('[data-ref="sidebar-header"]');
  const navTop = sidebar.querySelector('[data-ref="sidebar-nav-top"]');
  const navBottom = sidebar.querySelector('[data-ref="sidebar-nav-bottom"]');
  const sidebarBottom = sidebar.querySelector('[data-ref="sidebar-bottom"]');

  const bindNavLink = (btn, path) => {
    btn?.addEventListener('click', (e) => {
      e.preventDefault();
      toggleSidebar(false);
      navigate(path);
    });
  };

  if (currentPath.startsWith('/settings')) {
    // Modo Configuración
    if (sidebarBottom) {
      sidebarBottom.style.display = 'none';
    }

    if (sidebarHeader) {
      sidebarHeader.style.display = 'flex';
      sidebarHeader.innerHTML = `
        <button type="button" class="menu-item menu-item--bordered" data-ref="btn-nav-back-home">
          <span class="material-symbols-rounded menu-item__icon">arrow_back</span>
          <span class="menu-item__text" data-i18n="nav.back_home"></span>
        </button>
      `;
      translateElement(sidebarHeader);
      const btnBackHome = sidebarHeader.querySelector('[data-ref="btn-nav-back-home"]');
      bindNavLink(btnBackHome, '/');
    }

    if (navTop) {
      if (currentUser) {
        // Usuario autenticado en configuración
        navTop.innerHTML = `
          <button type="button" class="menu-item" data-ref="btn-nav-settings-account">
            <span class="material-symbols-rounded menu-item__icon">person</span>
            <span class="menu-item__text" data-i18n="nav.your_account"></span>
          </button>
          <button type="button" class="menu-item" data-ref="btn-nav-settings-security">
            <span class="material-symbols-rounded menu-item__icon">lock</span>
            <span class="menu-item__text" data-i18n="nav.security"></span>
          </button>
          <button type="button" class="menu-item" data-ref="btn-nav-settings-billing">
            <span class="material-symbols-rounded menu-item__icon">credit_card</span>
            <span class="menu-item__text" data-i18n="nav.billing"></span>
          </button>
          <button type="button" class="menu-item" data-ref="btn-nav-settings-purchases">
            <span class="material-symbols-rounded menu-item__icon">receipt_long</span>
            <span class="menu-item__text" data-i18n="nav.purchases"></span>
          </button>
          <button type="button" class="menu-item" data-ref="btn-nav-settings-accessibility">
            <span class="material-symbols-rounded menu-item__icon">accessibility_new</span>
            <span class="menu-item__text" data-i18n="nav.accessibility"></span>
          </button>
        `;
        translateElement(navTop);

        const btnAccount = navTop.querySelector('[data-ref="btn-nav-settings-account"]');
        const btnSecurity = navTop.querySelector('[data-ref="btn-nav-settings-security"]');
        const btnBilling = navTop.querySelector('[data-ref="btn-nav-settings-billing"]');
        const btnPurchases = navTop.querySelector('[data-ref="btn-nav-settings-purchases"]');
        const btnAccessibility = navTop.querySelector('[data-ref="btn-nav-settings-accessibility"]');

        if (currentPath === '/settings' || currentPath === '/settings/your-account') {
          btnAccount?.classList.add('is-active');
        } else if (currentPath === '/settings/security' || currentPath === '/settings/login-and-security') {
          btnSecurity?.classList.add('is-active');
        } else if (currentPath === '/settings/billing') {
          btnBilling?.classList.add('is-active');
        } else if (currentPath === '/settings/purchases') {
          btnPurchases?.classList.add('is-active');
        } else if (currentPath === '/settings/accessibility') {
          btnAccessibility?.classList.add('is-active');
        }

        bindNavLink(btnAccount, '/settings/your-account');
        bindNavLink(btnSecurity, '/settings/security');
        bindNavLink(btnBilling, '/settings/billing');
        bindNavLink(btnPurchases, '/settings/purchases');
        bindNavLink(btnAccessibility, '/settings/accessibility');
      } else {
        // Usuario invitado en configuración
        navTop.innerHTML = `
          <button type="button" class="menu-item" data-ref="btn-nav-settings-guest">
            <span class="material-symbols-rounded menu-item__icon">tune</span>
            <span class="menu-item__text" data-i18n="nav.guest_settings"></span>
          </button>
        `;
        translateElement(navTop);

        const btnGuest = navTop.querySelector('[data-ref="btn-nav-settings-guest"]');

        if (currentPath === '/settings' || currentPath === '/settings/guest') {
          btnGuest?.classList.add('is-active');
        }

        bindNavLink(btnGuest, '/settings/guest');
      }
    }
  } else if (currentPath.startsWith('/help')) {
    // Modo Ayuda, Legal y Documentación
    if (sidebarBottom) {
      sidebarBottom.style.display = 'none';
    }

    if (sidebarHeader) {
      sidebarHeader.style.display = 'flex';
      sidebarHeader.innerHTML = `
        <button type="button" class="menu-item menu-item--bordered" data-ref="btn-nav-back-home">
          <span class="material-symbols-rounded menu-item__icon">arrow_back</span>
          <span class="menu-item__text" data-i18n="nav.back_home"></span>
        </button>
      `;
      translateElement(sidebarHeader);
      const btnBackHome = sidebarHeader.querySelector('[data-ref="btn-nav-back-home"]');
      bindNavLink(btnBackHome, '/');
    }

    if (navTop) {
      navTop.innerHTML = `
        <button type="button" class="menu-item" data-ref="btn-nav-help-terms">
          <span class="material-symbols-rounded menu-item__icon">gavel</span>
          <span class="menu-item__text" data-i18n="help_center.terms_title"></span>
        </button>
        <button type="button" class="menu-item" data-ref="btn-nav-help-privacy">
          <span class="material-symbols-rounded menu-item__icon">shield</span>
          <span class="menu-item__text" data-i18n="help_center.privacy_title"></span>
        </button>
        <button type="button" class="menu-item" data-ref="btn-nav-help-cookies">
          <span class="material-symbols-rounded menu-item__icon">cookie</span>
          <span class="menu-item__text" data-i18n="help_center.cookies_title"></span>
        </button>
        <button type="button" class="menu-item" data-ref="btn-nav-help-legal">
          <span class="material-symbols-rounded menu-item__icon">balance</span>
          <span class="menu-item__text" data-i18n="help_center.legal_title"></span>
        </button>
        <button type="button" class="menu-item" data-ref="btn-nav-help-billing">
          <span class="material-symbols-rounded menu-item__icon">payments</span>
          <span class="menu-item__text" data-i18n="help_center.billing_title"></span>
        </button>
        <button type="button" class="menu-item" data-ref="btn-nav-help-support">
          <span class="material-symbols-rounded menu-item__icon">help</span>
          <span class="menu-item__text" data-i18n="help_center.support_title"></span>
        </button>
      `;
      translateElement(navTop);

      const btnTerms = navTop.querySelector('[data-ref="btn-nav-help-terms"]');
      const btnPrivacy = navTop.querySelector('[data-ref="btn-nav-help-privacy"]');
      const btnCookies = navTop.querySelector('[data-ref="btn-nav-help-cookies"]');
      const btnLegal = navTop.querySelector('[data-ref="btn-nav-help-legal"]');
      const btnBilling = navTop.querySelector('[data-ref="btn-nav-help-billing"]');
      const btnSupport = navTop.querySelector('[data-ref="btn-nav-help-support"]');

      if (currentPath === '/help' || currentPath === '/help/terms') {
        btnTerms?.classList.add('is-active');
      } else if (currentPath === '/help/privacy') {
        btnPrivacy?.classList.add('is-active');
      } else if (currentPath === '/help/cookies') {
        btnCookies?.classList.add('is-active');
      } else if (currentPath === '/help/legal-notice' || currentPath === '/help/legal') {
        btnLegal?.classList.add('is-active');
      } else if (currentPath === '/help/billing') {
        btnBilling?.classList.add('is-active');
      } else if (currentPath === '/help/support' || currentPath === '/help/feedback') {
        btnSupport?.classList.add('is-active');
      }

      bindNavLink(btnTerms, '/help/terms');
      bindNavLink(btnPrivacy, '/help/privacy');
      bindNavLink(btnCookies, '/help/cookies');
      bindNavLink(btnLegal, '/help/legal-notice');
      bindNavLink(btnBilling, '/help/billing');
      bindNavLink(btnSupport, '/help/support');
    }
  } else {
    // Modo Principal Normal (/ y /trash)
    if (sidebarHeader) {
      sidebarHeader.style.display = 'none';
      sidebarHeader.innerHTML = '';
    }

    if (sidebarBottom) {
      sidebarBottom.style.display = '';
    }

    if (navTop) {
      navTop.innerHTML = `
        <button type="button" class="menu-item" data-ref="btn-nav-home">
          <span class="material-symbols-rounded menu-item__icon">home</span>
          <span class="menu-item__text" data-i18n="nav.home"></span>
        </button>
      `;
      translateElement(navTop);

      const btnHome = navTop.querySelector('[data-ref="btn-nav-home"]');
      if (currentPath === '/' || currentPath === '') {
        btnHome?.classList.add('is-active');
      }
      bindNavLink(btnHome, '/');
    }

    if (navBottom) {
      navBottom.innerHTML = `
        <button type="button" class="menu-item" data-ref="btn-nav-trash">
          <span class="material-symbols-rounded menu-item__icon">delete</span>
          <span class="menu-item__text" data-i18n="nav.trash"></span>
        </button>
      `;
      translateElement(navBottom);

      const btnTrash = navBottom.querySelector('[data-ref="btn-nav-trash"]');
      if (currentPath === '/trash') {
        btnTrash?.classList.add('is-active');
      }
      bindNavLink(btnTrash, '/trash');
    }
  }

  return sidebar;
}

