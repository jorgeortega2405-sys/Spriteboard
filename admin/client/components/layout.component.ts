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

  const bindNavLink = (btn: HTMLElement | null, path: string) => {
    btn?.addEventListener('click', (e) => {
      e.preventDefault();
      if (window.innerWidth <= 768) {
        toggleDrawer(false);
      }
      navigate(path);
    });
  };

  if (currentPath.startsWith('/settings')) {
    const isYourAccount = currentPath === '/settings/your-account' || currentPath === '/settings';
    const isSecurity = currentPath === '/settings/security';
    const isAccessibility = currentPath === '/settings/accessibility';

    drawerBody.innerHTML = `
      <div class="drawer-section__header" style="padding: 8px 8px 4px 8px;">
        <span class="drawer-section__title" style="font-size: 13px; font-weight: 600; color: var(--text-primary);">Configuración</span>
      </div>
      <button type="button" class="menu-item${isYourAccount ? ' is-active' : ''}" data-ref="btn-drawer-your-account">
        <svg class="component-icon menu-item__icon" aria-hidden="true"><use href="/icons.svg#person"></use></svg>
        <span class="menu-item__text">Tu cuenta</span>
      </button>
      <button type="button" class="menu-item${isSecurity ? ' is-active' : ''}" data-ref="btn-drawer-security">
        <svg class="component-icon menu-item__icon" aria-hidden="true"><use href="/icons.svg#lock"></use></svg>
        <span class="menu-item__text">Seguridad</span>
      </button>
      <button type="button" class="menu-item${isAccessibility ? ' is-active' : ''}" data-ref="btn-drawer-accessibility">
        <svg class="component-icon menu-item__icon" aria-hidden="true"><use href="/icons.svg#accessibility_new"></use></svg>
        <span class="menu-item__text">Accesibilidad</span>
      </button>
    `;

    const btnYourAccount = drawerBody.querySelector<HTMLElement>('[data-ref="btn-drawer-your-account"]');
    const btnSecurity = drawerBody.querySelector<HTMLElement>('[data-ref="btn-drawer-security"]');
    const btnAccessibility = drawerBody.querySelector<HTMLElement>('[data-ref="btn-drawer-accessibility"]');

    bindNavLink(btnYourAccount, '/settings/your-account');
    bindNavLink(btnSecurity, '/settings/security');
    bindNavLink(btnAccessibility, '/settings/accessibility');

    renderIcons(drawerBody);
    return;
  }

  const isDashboard = currentPath === '/' || currentPath === '' || currentPath === '/dashboard';
  const isUsers = currentPath === '/users' || currentPath.startsWith('/users/');
  const isSupport = currentPath === '/support' || currentPath.startsWith('/support/');
  const isBackups = currentPath === '/backups' || currentPath.startsWith('/backups/');
  const isSystem = currentPath === '/system' || currentPath.startsWith('/system/') || currentPath === '/system-settings';

  drawerBody.innerHTML = `
    <div class="drawer-section__header" style="padding: 8px 8px 4px 8px;">
      <span class="drawer-section__title" style="font-size: 13px; font-weight: 600; color: var(--text-primary);">Panel de Administración</span>
    </div>
    <button type="button" class="menu-item${isDashboard ? ' is-active' : ''}" data-ref="btn-drawer-dashboard">
      <svg class="component-icon menu-item__icon" aria-hidden="true"><use href="/icons.svg#dashboard"></use></svg>
      <span class="menu-item__text">Dashboard</span>
    </button>
    <button type="button" class="menu-item${isUsers ? ' is-active' : ''}" data-ref="btn-drawer-users">
      <svg class="component-icon menu-item__icon" aria-hidden="true"><use href="/icons.svg#group"></use></svg>
      <span class="menu-item__text">Gestionar Usuarios</span>
    </button>
    <button type="button" class="menu-item${isSupport ? ' is-active' : ''}" data-ref="btn-drawer-support">
      <svg class="component-icon menu-item__icon" aria-hidden="true"><use href="/icons.svg#chat_bubble"></use></svg>
      <span class="menu-item__text">Soporte Técnico</span>
    </button>
    <button type="button" class="menu-item${isBackups ? ' is-active' : ''}" data-ref="btn-drawer-backups">
      <svg class="component-icon menu-item__icon" aria-hidden="true"><use href="/icons.svg#cloud_upload"></use></svg>
      <span class="menu-item__text">Copias de Seguridad</span>
    </button>
    <button type="button" class="menu-item${isSystem ? ' is-active' : ''}" data-ref="btn-drawer-system">
      <svg class="component-icon menu-item__icon" aria-hidden="true"><use href="/icons.svg#settings"></use></svg>
      <span class="menu-item__text">Configuración del Sistema</span>
    </button>
  `;

  const btnDashboard = drawerBody.querySelector<HTMLElement>('[data-ref="btn-drawer-dashboard"]');
  const btnUsers = drawerBody.querySelector<HTMLElement>('[data-ref="btn-drawer-users"]');
  const btnSupport = drawerBody.querySelector<HTMLElement>('[data-ref="btn-drawer-support"]');
  const btnBackups = drawerBody.querySelector<HTMLElement>('[data-ref="btn-drawer-backups"]');
  const btnSystem = drawerBody.querySelector<HTMLElement>('[data-ref="btn-drawer-system"]');

  bindNavLink(btnDashboard, '/dashboard');
  bindNavLink(btnUsers, '/users');
  bindNavLink(btnSupport, '/support');
  bindNavLink(btnBackups, '/backups');
  bindNavLink(btnSystem, '/system');

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
  const isSupport = path === '/support' || path.startsWith('/support/');
  const isBackups = path === '/backups' || path.startsWith('/backups/');
  const isSystem = path === '/system' || path.startsWith('/system/') || path === '/system-settings';

  const itemDashboard = sidebar.querySelector<HTMLElement>('[data-ref="rail-item-dashboard"]');
  const btnDashboard = sidebar.querySelector<HTMLElement>('[data-ref="btn-rail-dashboard"]');
  const itemUsers = sidebar.querySelector<HTMLElement>('[data-ref="rail-item-users"]');
  const btnUsers = sidebar.querySelector<HTMLElement>('[data-ref="btn-rail-users"]');
  const itemSupport = sidebar.querySelector<HTMLElement>('[data-ref="rail-item-support"]');
  const btnSupport = sidebar.querySelector<HTMLElement>('[data-ref="btn-rail-support"]');
  const itemBackups = sidebar.querySelector<HTMLElement>('[data-ref="rail-item-backups"]');
  const btnBackups = sidebar.querySelector<HTMLElement>('[data-ref="btn-rail-backups"]');
  const itemSystem = sidebar.querySelector<HTMLElement>('[data-ref="rail-item-system"]');
  const btnSystem = sidebar.querySelector<HTMLElement>('[data-ref="btn-rail-system"]');

  if (itemDashboard) itemDashboard.classList.toggle('is-active', isDashboard);
  if (btnDashboard) btnDashboard.classList.toggle('is-active', isDashboard);
  if (itemUsers) itemUsers.classList.toggle('is-active', isUsers);
  if (btnUsers) btnUsers.classList.toggle('is-active', isUsers);
  if (itemSupport) itemSupport.classList.toggle('is-active', isSupport);
  if (btnSupport) btnSupport.classList.toggle('is-active', isSupport);
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
  bindRailNav('btn-rail-support', 'rail-item-support', '/support');
  bindRailNav('btn-rail-backups', 'rail-item-backups', '/backups');
  bindRailNav('btn-rail-system', 'rail-item-system', '/system');

  const avatarContainer = sidebar.querySelector<HTMLElement>('[data-ref="avatar-container"]');
  const btnAvatar = sidebar.querySelector<HTMLElement>('[data-ref="btn-avatar"]');
  const avatarImg = sidebar.querySelector<HTMLImageElement>('[data-ref="avatar-img"]');
  const avatarBackdrop = sidebar.querySelector<HTMLElement>('[data-ref="avatar-menu-backdrop"]');
  const avatarMenu = sidebar.querySelector<HTMLElement>('[data-ref="avatar-menu"]');
  const dragZone = sidebar.querySelector<HTMLElement>('[data-ref="avatar-menu-drag-zone"]');

  if (currentUser && avatarContainer) {
    avatarContainer.style.display = 'inline-flex';

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
          showPanel('main');
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
        showPanel('main');
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

    let startY = 0;
    let currentY = 0;
    let startTime = 0;
    let isDragging = false;
    let activePointerId: number | null = null;

    const detachAvatarPointerListeners = () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
    };

    const onPointerDown = (e: PointerEvent) => {
      if (window.innerWidth > 768 || isClosing || !avatarMenu) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;

      isDragging = true;
      activePointerId = e.pointerId;
      startY = e.clientY;
      currentY = startY;
      startTime = performance.now();

      try {
        dragZone?.setPointerCapture(activePointerId);
      } catch {}

      avatarMenu.style.transition = 'none';
      if (avatarBackdrop) {
        avatarBackdrop.style.transition = 'none';
      }

      window.addEventListener('pointermove', onPointerMove, { passive: true });
      window.addEventListener('pointerup', onPointerUp);
      window.addEventListener('pointercancel', onPointerUp);
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!isDragging || (activePointerId !== null && e.pointerId !== activePointerId)) return;
      currentY = e.clientY;
      const diff = currentY - startY;

      if (avatarMenu) {
        if (diff > 0) {
          avatarMenu.style.transform = `translateY(${diff}px)`;
          if (avatarBackdrop) {
            const progress = Math.min(diff / 240, 1);
            avatarBackdrop.style.opacity = `${Math.max(0.2, 1 - progress * 0.8)}`;
          }
        } else {
          const rubberDiff = Math.max(diff * 0.15, -24);
          avatarMenu.style.transform = `translateY(${rubberDiff}px)`;
        }
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      if (!isDragging || (activePointerId !== null && e.pointerId !== activePointerId)) return;
      isDragging = false;
      detachAvatarPointerListeners();

      try {
        if (activePointerId !== null) {
          dragZone?.releasePointerCapture(activePointerId);
        }
      } catch {}
      activePointerId = null;

      const diff = currentY - startY;
      const elapsed = Math.max(1, performance.now() - startTime);
      const velocity = diff / elapsed;

      if (diff > 75 || (diff > 25 && velocity > 0.45)) {
        closeMenu();
      } else {
        if (avatarBackdrop) {
          avatarBackdrop.style.transition = 'opacity 0.25s ease';
          avatarBackdrop.style.opacity = '1';
        }
        if (avatarMenu) {
          avatarMenu.style.transition = 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)';
          avatarMenu.style.transform = 'translateY(0)';
        }
      }
    };

    dragZone?.addEventListener('pointerdown', onPointerDown);
    dragZone?.addEventListener('lostpointercapture', onPointerUp);

    const closeMenuHandler = (e: MouseEvent) => {
      if (!avatarMenu?.contains(e.target as Node) && !btnAvatar?.contains(e.target as Node)) {
        closeMenu();
      }
    };
    document.addEventListener('click', closeMenuHandler);

    const closeMenuKeydownHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && avatarMenu?.classList.contains('is-open')) {
        closeMenu();
      }
    };
    document.addEventListener('keydown', closeMenuKeydownHandler);

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

