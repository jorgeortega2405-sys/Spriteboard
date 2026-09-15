import { navigate, render } from '../app-router.js';
import { currentUser, linkedAccounts, loadTemplate, logoutAllApi, logoutApi, switchAccountApi } from '../services/api.service.js';
import { createIconSvg, renderIcons } from '../services/icon.service.js';
import { showToast } from '../services/toast.service.js';
import { closeAllDropdowns, escapeHtml, registerActiveDropdown, unregisterActiveDropdown } from '../utils/dom.util.js';

let isDrawerOpen = false;
let drawerRemovalTimer: ReturnType<typeof setTimeout> | null = null;

function createDrawerElement(): HTMLElement {
  const drawer = document.createElement('div');
  drawer.className = 'layout-drawer';
  drawer.setAttribute('data-ref', 'layout-drawer');

  const drawerBody = document.createElement('div');
  drawerBody.className = 'layout-drawer__body';
  drawerBody.setAttribute('data-ref', 'drawer-body');
  drawer.appendChild(drawerBody);

  const drawerFooter = document.createElement('div');
  drawerFooter.className = 'layout-drawer__footer';
  drawerFooter.setAttribute('data-ref', 'drawer-footer');
  drawer.appendChild(drawerFooter);

  return drawer;
}

function populateDrawerContent(drawer: HTMLElement): void {
  const drawerBody = drawer.querySelector<HTMLElement>('[data-ref="drawer-body"]');
  if (!drawerBody) return;

  const currentPath = window.location.pathname;

  if (currentPath.startsWith('/settings')) {
    const isYourAccount = currentPath === '/settings/your-account' || currentPath === '/settings';
    const isSecurity = currentPath === '/settings/security';
    const isAccessibility = currentPath === '/settings/accessibility';

    drawerBody.innerHTML = `
      <div class="drawer-section" data-ref="drawer-section-settings">
        <div class="drawer-section__header" data-ref="drawer-header-settings">
          <span class="drawer-section__title">Configuración</span>
        </div>
        <div class="drawer-nav-list" data-ref="drawer-settings-list" style="display: flex; flex-direction: column; gap: 4px;">
          <button type="button" class="component-button component-button--w-full drawer-nav-item ${isYourAccount ? 'is-active' : ''}" data-ref="btn-drawer-your-account" style="justify-content: flex-start; text-align: left; padding: 10px 14px; gap: 10px;">
            <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#person"></use></svg>
            <span>Tu Cuenta</span>
          </button>
          <button type="button" class="component-button component-button--w-full drawer-nav-item ${isSecurity ? 'is-active' : ''}" data-ref="btn-drawer-security" style="justify-content: flex-start; text-align: left; padding: 10px 14px; gap: 10px;">
            <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#shield"></use></svg>
            <span>Seguridad</span>
          </button>
          <button type="button" class="component-button component-button--w-full drawer-nav-item ${isAccessibility ? 'is-active' : ''}" data-ref="btn-drawer-accessibility" style="justify-content: flex-start; text-align: left; padding: 10px 14px; gap: 10px;">
            <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#tune"></use></svg>
            <span>Accesibilidad</span>
          </button>
        </div>
      </div>
    `;

    const btnYourAccount = drawerBody.querySelector<HTMLElement>('[data-ref="btn-drawer-your-account"]');
    const btnSecurity = drawerBody.querySelector<HTMLElement>('[data-ref="btn-drawer-security"]');
    const btnAccessibility = drawerBody.querySelector<HTMLElement>('[data-ref="btn-drawer-accessibility"]');

    const handleNav = (url: string) => {
      if (window.innerWidth <= 768) {
        toggleDrawer(false);
      }
      navigate(url);
    };

    btnYourAccount?.addEventListener('click', (e) => { e.preventDefault(); handleNav('/settings/your-account'); });
    btnSecurity?.addEventListener('click', (e) => { e.preventDefault(); handleNav('/settings/security'); });
    btnAccessibility?.addEventListener('click', (e) => { e.preventDefault(); handleNav('/settings/accessibility'); });

    renderIcons(drawerBody);
    return;
  }

  const isDashboard = currentPath === '/' || currentPath === '' || currentPath === '/dashboard';
  const isUsers = currentPath === '/users' || currentPath.startsWith('/users/');
  const isBackups = currentPath === '/backups' || currentPath.startsWith('/backups/');
  const isSystem = currentPath === '/system' || currentPath.startsWith('/system/') || currentPath === '/system-settings';

  drawerBody.innerHTML = `
    <div class="drawer-section" data-ref="drawer-section-admin">
      <div class="drawer-section__header" data-ref="drawer-header-admin">
        <span class="drawer-section__title">Panel de Administración</span>
      </div>
      <div class="drawer-nav-list" data-ref="drawer-admin-list" style="display: flex; flex-direction: column; gap: 4px;">
        <button type="button" class="component-button component-button--w-full drawer-nav-item ${isDashboard ? 'is-active' : ''}" data-ref="btn-drawer-dashboard" style="justify-content: flex-start; text-align: left; padding: 10px 14px; gap: 10px;">
          <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#dashboard"></use></svg>
          <span>Dashboard</span>
        </button>
        <button type="button" class="component-button component-button--w-full drawer-nav-item ${isUsers ? 'is-active' : ''}" data-ref="btn-drawer-users" style="justify-content: flex-start; text-align: left; padding: 10px 14px; gap: 10px;">
          <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#group"></use></svg>
          <span>Gestionar Usuarios</span>
        </button>
        <button type="button" class="component-button component-button--w-full drawer-nav-item ${isBackups ? 'is-active' : ''}" data-ref="btn-drawer-backups" style="justify-content: flex-start; text-align: left; padding: 10px 14px; gap: 10px;">
          <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#cloud_upload"></use></svg>
          <span>Copias de Seguridad</span>
        </button>
        <button type="button" class="component-button component-button--w-full drawer-nav-item ${isSystem ? 'is-active' : ''}" data-ref="btn-drawer-system" style="justify-content: flex-start; text-align: left; padding: 10px 14px; gap: 10px;">
          <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#settings"></use></svg>
          <span>Configuración del Sistema</span>
        </button>
      </div>
    </div>
  `;

  const btnDashboard = drawerBody.querySelector<HTMLElement>('[data-ref="btn-drawer-dashboard"]');
  const btnUsers = drawerBody.querySelector<HTMLElement>('[data-ref="btn-drawer-users"]');
  const btnBackups = drawerBody.querySelector<HTMLElement>('[data-ref="btn-drawer-backups"]');
  const btnSystem = drawerBody.querySelector<HTMLElement>('[data-ref="btn-drawer-system"]');

  const handleNav = (url: string) => {
    if (window.innerWidth <= 768) {
      toggleDrawer(false);
    }
    navigate(url);
  };

  btnDashboard?.addEventListener('click', (e) => { e.preventDefault(); handleNav('/dashboard'); });
  btnUsers?.addEventListener('click', (e) => { e.preventDefault(); handleNav('/users'); });
  btnBackups?.addEventListener('click', (e) => { e.preventDefault(); handleNav('/backups'); });
  btnSystem?.addEventListener('click', (e) => { e.preventDefault(); handleNav('/system'); });

  renderIcons(drawerBody);
}

export function getIsDrawerOpen(): boolean {
  return isDrawerOpen;
}

export function toggleDrawer(forceState?: boolean): void {
  const sidebar = document.querySelector<HTMLElement>('[data-ref="sidebar"]');
  const btnToggle = sidebar?.querySelector<HTMLElement>('[data-ref="btn-toggle-drawer"]') || document.querySelector<HTMLElement>('[data-ref="btn-toggle-drawer"]');
  const nextOpen = forceState !== undefined ? forceState : !isDrawerOpen;

  isDrawerOpen = nextOpen;
  btnToggle?.classList.toggle('is-active', isDrawerOpen);

  if (isDrawerOpen) {
    if (drawerRemovalTimer) {
      clearTimeout(drawerRemovalTimer);
      drawerRemovalTimer = null;
    }
    if (sidebar) {
      let drawer = sidebar.querySelector<HTMLElement>('[data-ref="layout-drawer"]');
      if (!drawer) {
        drawer = createDrawerElement();
        sidebar.appendChild(drawer);
        renderIcons(drawer);
      }
      populateDrawerContent(drawer);
      void drawer.offsetWidth;
      drawer.classList.add('is-expanded');
    }
  } else {
    const drawer = document.querySelector<HTMLElement>('[data-ref="layout-drawer"]');
    if (drawer) {
      drawer.classList.remove('is-expanded');
      if (drawerRemovalTimer) {
        clearTimeout(drawerRemovalTimer);
      }
      drawerRemovalTimer = setTimeout(() => {
        if (!isDrawerOpen && drawer && drawer.parentNode) {
          drawer.remove();
        }
      }, 250);
    }
  }
}

export function updateSidebarActiveState(sidebar: HTMLElement, path: string): void {
  const isDashboard = path === '/' || path === '' || path === '/dashboard';
  const isUsers = path === '/users' || path.startsWith('/users/');
  const isBackups = path === '/backups' || path.startsWith('/backups/');
  const isSystem = path === '/system' || path.startsWith('/system/') || path === '/system-settings';

  const itemDashboard = sidebar.querySelector<HTMLElement>('[data-ref="rail-item-dashboard"]');
  const btnDashboard = sidebar.querySelector<HTMLElement>('[data-ref="btn-rail-dashboard"]');
  const itemUsers = sidebar.querySelector<HTMLElement>('[data-ref="rail-item-users"]');
  const btnUsers = sidebar.querySelector<HTMLElement>('[data-ref="btn-rail-users"]');
  const itemBackups = sidebar.querySelector<HTMLElement>('[data-ref="rail-item-backups"]');
  const btnBackups = sidebar.querySelector<HTMLElement>('[data-ref="btn-rail-backups"]');
  const itemSystem = sidebar.querySelector<HTMLElement>('[data-ref="rail-item-system"]');
  const btnSystem = sidebar.querySelector<HTMLElement>('[data-ref="btn-rail-system"]');

  if (itemDashboard) itemDashboard.classList.toggle('is-active', isDashboard);
  if (btnDashboard) btnDashboard.classList.toggle('is-active', isDashboard);
  if (itemUsers) itemUsers.classList.toggle('is-active', isUsers);
  if (btnUsers) btnUsers.classList.toggle('is-active', isUsers);
  if (itemBackups) itemBackups.classList.toggle('is-active', isBackups);
  if (btnBackups) btnBackups.classList.toggle('is-active', isBackups);
  if (itemSystem) itemSystem.classList.toggle('is-active', isSystem);
  if (btnSystem) btnSystem.classList.toggle('is-active', isSystem);
}

document.addEventListener('keydown', (e: KeyboardEvent) => {
  if (e.key === 'Escape') {
    if (window.innerWidth <= 768 && isDrawerOpen) toggleDrawer(false);
  }
});

document.addEventListener('click', (e: MouseEvent) => {
  const target = e.target as Node | null;
  if (window.innerWidth <= 768 && isDrawerOpen) {
    const drawer = document.querySelector<HTMLElement>('[data-ref="layout-drawer"]');
    const btnToggle = document.querySelector<HTMLElement>('[data-ref="btn-toggle-drawer"]');
    if (drawer && target && !drawer.contains(target) && (!btnToggle || !btnToggle.contains(target))) {
      toggleDrawer(false);
    }
  }
});

export async function createSidebar(): Promise<HTMLElement> {
  const sidebar = await loadTemplate('/views/components/sidebar.html');
  const currentPath = window.location.pathname;

  updateSidebarActiveState(sidebar, currentPath);

  const btnToggleDrawer = sidebar.querySelector<HTMLElement>('[data-ref="btn-toggle-drawer"]');
  btnToggleDrawer?.addEventListener('click', (e: Event) => {
    e.preventDefault();
    toggleDrawer();
  });
  if (isDrawerOpen) {
    btnToggleDrawer?.classList.add('is-active');
    let drawer = sidebar.querySelector<HTMLElement>('[data-ref="layout-drawer"]');
    if (!drawer) {
      drawer = createDrawerElement();
      sidebar.appendChild(drawer);
      renderIcons(drawer);
    }
    populateDrawerContent(drawer);
    drawer.classList.add('is-expanded');
  }

  const bindRailNav = (btnRef: string, itemRef: string, route: string) => {
    const btn = sidebar.querySelector<HTMLElement>(`[data-ref="${btnRef}"]`);
    const item = sidebar.querySelector<HTMLElement>(`[data-ref="${itemRef}"]`);
    const handler = (e: Event) => {
      e.preventDefault();
      if (window.innerWidth <= 768) {
        toggleDrawer(false);
      }
      navigate(route);
    };
    btn?.addEventListener('click', handler);
    item?.addEventListener('click', (e) => {
      if (e.target !== btn && !btn?.contains(e.target as Node)) {
        handler(e);
      }
    });
  };

  bindRailNav('btn-rail-dashboard', 'rail-item-dashboard', '/dashboard');
  bindRailNav('btn-rail-users', 'rail-item-users', '/users');
  bindRailNav('btn-rail-backups', 'rail-item-backups', '/backups');
  bindRailNav('btn-rail-system', 'rail-item-system', '/system');

  const avatarContainer = sidebar.querySelector<HTMLElement>('[data-ref="avatar-container"]');
  const btnAvatar = sidebar.querySelector<HTMLElement>('[data-ref="btn-avatar"]');
  const avatarImg = sidebar.querySelector<HTMLImageElement>('[data-ref="avatar-img"]');
  const avatarBackdrop = sidebar.querySelector<HTMLElement>('[data-ref="avatar-menu-backdrop"]');
  const avatarMenu = sidebar.querySelector<HTMLElement>('[data-ref="avatar-menu"]');

  if (currentUser && avatarContainer) {
    avatarContainer.style.display = 'block';

    const defaultAvatar = `/api/avatar?name=${encodeURIComponent(currentUser.username)}`;
    const avatarUrl = currentUser.avatar_url || defaultAvatar;

    if (avatarImg) {
      avatarImg.src = avatarUrl;
      avatarImg.alt = escapeHtml(currentUser.username);
      avatarImg.onload = () => avatarImg.classList.add('image-loaded');
      avatarImg.onerror = () => {
        avatarImg.onerror = null;
        avatarImg.src = defaultAvatar;
        avatarImg.classList.add('image-loaded');
      };
    }

    const panelMain = avatarContainer.querySelector<HTMLElement>('[data-ref="panel-main-options"]');
    const panelSwitcher = avatarContainer.querySelector<HTMLElement>('[data-ref="panel-account-switcher"]');
    const btnSwitchAccountMenu = avatarContainer.querySelector<HTMLElement>('[data-ref="btn-switch-account-menu"]');
    const btnBackToMainMenu = avatarContainer.querySelector<HTMLElement>('[data-ref="btn-back-to-main-menu"]');
    const btnMenuSettings = avatarContainer.querySelector<HTMLElement>('[data-ref="btn-menu-settings"]');
    const btnLogout = avatarContainer.querySelector<HTMLElement>('[data-ref="btn-logout"]');
    const btnLogoutAll = avatarContainer.querySelector<HTMLElement>('[data-ref="btn-logout-all"]');
    const accountSwitcherList = avatarContainer.querySelector<HTMLElement>('[data-ref="account-switcher-list"]');

    const activeAvatar = avatarContainer.querySelector<HTMLImageElement>('[data-ref="active-account-avatar"]');
    const activeName = avatarContainer.querySelector<HTMLElement>('[data-ref="active-account-name"]');
    const activeEmail = avatarContainer.querySelector<HTMLElement>('[data-ref="active-account-email"]');

    if (activeAvatar) {
      activeAvatar.src = avatarUrl;
      activeAvatar.alt = escapeHtml(currentUser.username);
      activeAvatar.onload = () => activeAvatar.classList.add('image-loaded');
      activeAvatar.onerror = () => {
        activeAvatar.onerror = null;
        activeAvatar.src = defaultAvatar;
        activeAvatar.classList.add('image-loaded');
      };
    }

    if (activeName) activeName.textContent = currentUser.username;
    if (activeEmail) activeEmail.textContent = currentUser.email;

    const showPanel = (panelName: string) => {
      if (panelName === 'switcher') {
        if (panelMain) panelMain.style.display = 'none';
        if (panelSwitcher) panelSwitcher.style.display = 'flex';
        renderAccountList();
      } else {
        if (panelSwitcher) panelSwitcher.style.display = 'none';
        if (panelMain) panelMain.style.display = 'flex';
      }
    };

    const renderAccountList = () => {
      if (!accountSwitcherList) return;
      accountSwitcherList.innerHTML = '';

      const accounts = Array.isArray(linkedAccounts) && linkedAccounts.length > 0 ? linkedAccounts : currentUser ? [currentUser] : [];

      accounts.forEach((acc) => {
        const isActive = acc.id === currentUser?.id;
        const item = document.createElement('button');
        item.type = 'button';
        item.className = 'menu-item menu-item--bordered account-item';
        item.setAttribute('data-ref', `account-item-${acc.id}`);

        const accAvatar = acc.avatar_url || `/api/avatar?name=${encodeURIComponent(acc.username)}`;

        item.innerHTML = `
          <div class="account-item__avatar" data-ref="account-avatar-${acc.id}">
            <img class="avatar-img image-lazy-fade" data-ref="avatar-img-${acc.id}" src="${accAvatar}" alt="${escapeHtml(acc.username)}" referrerpolicy="no-referrer" />
          </div>
          <div class="account-item__info" data-ref="account-info-${acc.id}">
            <span class="account-item__name" data-ref="account-name-${acc.id}">${escapeHtml(acc.username)}</span>
            <span class="account-item__email" data-ref="account-email-${acc.id}">${escapeHtml(acc.email || '')}</span>
          </div>
          ${isActive ? createIconSvg('check_circle', 'account-item__check') : ''}
        `;

        if (!isActive) {
          item.addEventListener('click', async (e) => {
            e.preventDefault();
            closeMenu();
            const res = await switchAccountApi(acc.id);
            if (res.success) {
              showToast('Has cambiado de cuenta exitosamente.', 'success');
              void render();
            } else {
              showToast(res.error || 'Error al cambiar de cuenta.', 'error');
            }
          });
        }

        accountSwitcherList.appendChild(item);
      });

      renderIcons(accountSwitcherList);
    };

    let isClosing = false;

    const openMenu = () => {
      if (isClosing) return;
      closeAllDropdowns();
      if (avatarMenu) {
        registerActiveDropdown({
          close: closeMenu,
          wrapper: avatarMenu,
        });
      }

      showPanel('main');

      if (window.innerWidth <= 768 && avatarBackdrop && avatarMenu) {
        avatarBackdrop.style.display = 'flex';
        avatarBackdrop.style.opacity = '0';
        avatarBackdrop.style.pointerEvents = 'auto';
        avatarMenu.style.transform = 'translateY(100%)';
        avatarMenu.style.transition = 'none';
        avatarBackdrop.style.transition = 'none';

        void avatarMenu.offsetHeight;

        avatarBackdrop.classList.add('is-open');
        avatarMenu.classList.add('is-open');

        avatarBackdrop.style.transition = 'opacity 0.25s ease';
        avatarMenu.style.transition = 'transform 0.28s cubic-bezier(0.16, 1, 0.3, 1)';
        avatarBackdrop.style.opacity = '1';
        avatarMenu.style.transform = 'translateY(0)';
      } else {
        avatarBackdrop?.classList.add('is-open');
        avatarMenu?.classList.add('is-open');
      }
    };

    const closeMenu = () => {
      if (isClosing || !avatarMenu?.classList.contains('is-open')) return;
      if (avatarMenu) {
        unregisterActiveDropdown(avatarMenu);
      }

      if (window.innerWidth <= 768 && avatarBackdrop && avatarMenu) {
        isClosing = true;
        avatarBackdrop.style.pointerEvents = 'none';
        avatarBackdrop.style.transition = 'opacity 0.2s ease';
        avatarMenu.style.transition = 'transform 0.2s cubic-bezier(0.4, 0, 1, 1)';
        avatarBackdrop.style.opacity = '0';
        avatarMenu.style.transform = 'translateY(100%)';

        setTimeout(() => {
          avatarBackdrop.classList.remove('is-open');
          avatarMenu.classList.remove('is-open');
          avatarBackdrop.style.display = '';
          avatarBackdrop.style.opacity = '';
          avatarBackdrop.style.transition = '';
          avatarBackdrop.style.pointerEvents = '';
          avatarMenu.style.transform = '';
          avatarMenu.style.transition = '';
          isClosing = false;
        }, 200);
      } else {
        avatarBackdrop?.classList.remove('is-open');
        avatarMenu?.classList.remove('is-open');
        if (avatarBackdrop) {
          avatarBackdrop.style.display = '';
          avatarBackdrop.style.opacity = '';
          avatarBackdrop.style.transition = '';
        }
        if (avatarMenu) {
          avatarMenu.style.transform = '';
          avatarMenu.style.transition = '';
        }
      }
    };

    btnAvatar?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (avatarMenu?.classList.contains('is-open')) {
        closeMenu();
      } else {
        openMenu();
      }
    });

    avatarBackdrop?.addEventListener('click', (e) => {
      if (e.target === avatarBackdrop) {
        closeMenu();
      }
    });

    btnSwitchAccountMenu?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      showPanel('switcher');
    });

    btnBackToMainMenu?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      showPanel('main');
    });

    btnMenuSettings?.addEventListener('click', (e) => {
      e.preventDefault();
      closeMenu();
      if (window.innerWidth <= 768) {
        toggleDrawer(false);
      }
      navigate('/settings/your-account');
    });

    btnLogout?.addEventListener('click', async (e) => {
      e.preventDefault();
      closeMenu();
      await logoutApi();
      showToast('Sesión cerrada correctamente.', 'success');
      navigate('/login');
    });

    btnLogoutAll?.addEventListener('click', async (e) => {
      e.preventDefault();
      closeMenu();
      await logoutAllApi();
      showToast('Todas las sesiones han sido cerradas.', 'success');
      navigate('/login');
    });
  }

  renderIcons(sidebar);
  return sidebar;
}
