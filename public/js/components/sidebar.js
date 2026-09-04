import { loadTemplate } from '../services/template.js';
import { navigate } from '../router.js';
import { currentUser } from '../services/api.js';
import { translateElement } from '../services/i18n.js';

let isSidebarOpen = false;

export function getIsSidebarOpen() {
  return isSidebarOpen;
}

export function toggleSidebar(forceState) {
  isSidebarOpen = forceState !== undefined ? forceState : !isSidebarOpen;
  const sidebar = document.querySelector('[data-ref="sidebar"]');

  if (sidebar) {
    sidebar.classList.toggle('is-active', isSidebarOpen);
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
      if (window.innerWidth <= 768) {
        toggleSidebar(false);
      }
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
          <button type="button" class="menu-item" data-ref="btn-nav-settings-accessibility">
            <span class="material-symbols-rounded menu-item__icon">accessibility_new</span>
            <span class="menu-item__text" data-i18n="nav.accessibility"></span>
          </button>
        `;
        translateElement(navTop);

        const btnAccount = navTop.querySelector('[data-ref="btn-nav-settings-account"]');
        const btnSecurity = navTop.querySelector('[data-ref="btn-nav-settings-security"]');
        const btnAccessibility = navTop.querySelector('[data-ref="btn-nav-settings-accessibility"]');

        if (currentPath === '/settings' || currentPath === '/settings/your-account') {
          btnAccount?.classList.add('is-active');
        } else if (currentPath === '/settings/security' || currentPath === '/settings/login-and-security') {
          btnSecurity?.classList.add('is-active');
        } else if (currentPath === '/settings/accessibility') {
          btnAccessibility?.classList.add('is-active');
        }

        bindNavLink(btnAccount, '/settings/your-account');
        bindNavLink(btnSecurity, '/settings/security');
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

