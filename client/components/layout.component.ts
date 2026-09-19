import { navigate, render } from '../app-router.js';
import { API_ROUTES } from '../config/api-routes.js';
import { hasFeature, protectRoute } from '../config/plans.config.js';
import { ALL_PRESETS, PresetItem } from '../config/templates.config.js';
import { currentUser, deleteApi, escapeHtml, getApi, linkedAccounts, logoutAllApi, logoutApi, patchApi, postApi, switchAccountApi } from '../services/api.service.js';
import { getAllLocalCanvases } from '../services/canvas-storage.service.js';
import { t, translateElement } from '../services/i18n.service.js';
import { createIconSvg, renderIcons } from '../services/icon.service.js';
import { loadTemplate } from '../services/template.service.js';
import { showToast } from '../services/toast.service.js';
import { closeWebSocket, initWebSocket, registerWebSocketHandler } from '../services/websocket.service.js';
import { CanvasItem } from '../types/canvas.types.js';
import { closeAllDropdowns, registerActiveDropdown, unregisterActiveDropdown } from '../utils/dom.util.js';
import { PIXEL_SHAPES, PixelShape } from '../utils/pixel-shapes.util.js';
import { applyAvatarTier, getFallbackTierColor } from '../utils/tier.util.js';
import { DOC_TEMPLATES, getDocTemplateById } from '../views/doc/doc-templates.config.js';
import { openCreateCanvasModal } from './create-canvas-modal.component.js';
import { openModal } from './modal.component.js';
import { openUpgradeModal } from './upgrade-modal.component.js';

let isDrawerOpen = false;
let isChatOpen = false;
let activeCanvasTab: 'templates' | 'elements' | 'uploads' | 'projects' | null = null;
let chatSidebarElement: HTMLElement | null = null;
let chatSidebarInitPromise: Promise<HTMLElement> | null = null;

let drawerRemovalTimer: ReturnType<typeof setTimeout> | null = null;

function createDrawerSkeletonRow(): HTMLElement {
  const row = document.createElement('div');
  row.className = 'drawer-canvas-item is-skeleton';
  row.setAttribute('data-ref', 'drawer-canvas-skeleton');
  row.style.pointerEvents = 'none';
  row.innerHTML = `
    <div class="drawer-canvas-item__thumb skeleton" style="border: none;"></div>
    <div class="skeleton skeleton--text" style="width: 65%; height: 12px; border-radius: 4px; margin-left: 2px;"></div>
  `;
  return row;
}

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

function updateDrawerFooter(drawer: HTMLElement, currentPath: string): void {
  const drawerFooter = drawer.querySelector<HTMLElement>('[data-ref="drawer-footer"]');
  if (!drawerFooter) return;

  if (isCanvasRoute(currentPath)) {
    drawerFooter.style.display = 'none';
    return;
  }

  drawerFooter.innerHTML = '';

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
    if (currentUser) {
      drawerFooter.style.display = 'flex';
      drawerFooter.innerHTML = `
        <button type="button" class="drawer-footer-item${currentPath === '/settings/billing' ? ' is-active' : ''}" data-ref="btn-nav-settings-billing" data-tooltip="${t('nav.billing') || 'Facturación'}" aria-label="${t('nav.billing') || 'Facturación'}">
          <svg class="component-icon drawer-footer-item__icon" aria-hidden="true"><use href="/icons.svg#credit_card"></use></svg>
          <span class="drawer-footer-item__text" data-i18n="nav.billing">${t('nav.billing') || 'Facturación'}</span>
        </button>
        <button type="button" class="drawer-footer-item${currentPath === '/settings/purchases' ? ' is-active' : ''}" data-ref="btn-nav-settings-purchases" data-tooltip="${t('nav.purchases') || 'Compras'}" aria-label="${t('nav.purchases') || 'Compras'}">
          <svg class="component-icon drawer-footer-item__icon" aria-hidden="true"><use href="/icons.svg#receipt_long"></use></svg>
          <span class="drawer-footer-item__text" data-i18n="nav.purchases">${t('nav.purchases') || 'Compras'}</span>
        </button>
      `;
      const btnBilling = drawerFooter.querySelector<HTMLElement>('[data-ref="btn-nav-settings-billing"]');
      const btnPurchases = drawerFooter.querySelector<HTMLElement>('[data-ref="btn-nav-settings-purchases"]');
      bindNavLink(btnBilling, '/settings/billing');
      bindNavLink(btnPurchases, '/settings/purchases');
      translateElement(drawerFooter);
      renderIcons(drawerFooter);
    } else {
      drawerFooter.style.display = 'none';
    }
  } else if (currentPath.startsWith('/help')) {
    drawerFooter.style.display = 'none';
  } else {
    drawerFooter.style.display = 'flex';
    const btnTrash = document.createElement('button');
    btnTrash.type = 'button';
    btnTrash.className = `drawer-footer-item${currentPath === '/trash' ? ' is-active' : ''}`;
    btnTrash.setAttribute('data-ref', 'drawer-btn-trash');
    btnTrash.setAttribute('data-tooltip', t('nav.trash') || 'Papelera');
    btnTrash.setAttribute('aria-label', t('nav.trash') || 'Papelera');
    btnTrash.innerHTML = `
      <svg class="component-icon drawer-footer-item__icon" aria-hidden="true"><use href="/icons.svg#delete"></use></svg>
      <span class="drawer-footer-item__text" data-i18n="nav.trash">${t('nav.trash') || 'Papelera'}</span>
    `;
    bindNavLink(btnTrash, '/trash');
    drawerFooter.appendChild(btnTrash);
    translateElement(drawerFooter);
    renderIcons(drawerFooter);
  }
}

export function getIsSidebarOpen(): boolean {
  return isDrawerOpen;
}

export function toggleDrawer(forceState?: boolean): void {
  const sidebar = document.querySelector<HTMLElement>('[data-ref="sidebar"]');
  const btnToggle = sidebar?.querySelector<HTMLElement>('[data-ref="btn-toggle-drawer"]') || document.querySelector<HTMLElement>('[data-ref="btn-toggle-drawer"]');
  const currentlyOpen = isDrawerOpen;
  const nextOpen = forceState !== undefined ? forceState : !currentlyOpen;

  isDrawerOpen = nextOpen;
  btnToggle?.classList.toggle('is-active', isDrawerOpen);

  if (isDrawerOpen) {
    if (drawerRemovalTimer) {
      clearTimeout(drawerRemovalTimer);
      drawerRemovalTimer = null;
    }
    if (sidebar) {
      void openDynamicDrawer(sidebar);
    }
    if (isChatOpen) {
      toggleChatSidebar(false);
    }
  } else {
    activeCanvasTab = null;
    if (sidebar) {
      updateCanvasRailActiveState(sidebar);
    }
    closeDynamicDrawer();
  }
}

export function toggleSidebar(forceState?: boolean): void {
  toggleDrawer(forceState);
}

export function hasDesignatedMenuItems(pathname: string): boolean {
  if (!pathname) return false;
  return (
    pathname.startsWith('/settings') ||
    pathname.startsWith('/help')
  );
}

export function isCanvasRoute(pathname: string): boolean {
  if (!pathname) return false;
  return (
    pathname.startsWith('/design') ||
    pathname.startsWith('/board') ||
    pathname.startsWith('/diagram') ||
    pathname.startsWith('/mindmap') ||
    pathname.startsWith('/doc')
  );
}

export function updateCanvasRailActiveState(sidebar: HTMLElement): void {
  const tabs = ['templates', 'elements', 'uploads', 'projects'] as const;
  tabs.forEach((tabKey) => {
    const item = sidebar.querySelector<HTMLElement>(`[data-ref="rail-item-canvas-${tabKey}"]`);
    const btn = sidebar.querySelector<HTMLElement>(`[data-ref="btn-rail-canvas-${tabKey}"]`);
    const isActive = isDrawerOpen && activeCanvasTab === tabKey;
    item?.classList.toggle('is-active', isActive);
    btn?.classList.toggle('is-active', isActive);
  });
}

export function updateSidebarActiveState(sidebar: HTMLElement, path = window.location.pathname): void {
  const isCanvas = isCanvasRoute(path);
  sidebar.classList.toggle('is-canvas-mode', isCanvas);

  if (!isCanvas) {
    activeCanvasTab = null;
  } else {
    updateCanvasRailActiveState(sidebar);
  }

  const isHome = path === '/' || path === '' || path.startsWith('/folder/');
  const isTemplates = path === '/templates';
  const isShared = path === '/shared';
  const isTeams = path === '/teams';

  const updateItem = (itemRef: string, btnRef: string, isActive: boolean) => {
    const item = sidebar.querySelector<HTMLElement>(`[data-ref="${itemRef}"]`);
    const btn = sidebar.querySelector<HTMLElement>(`[data-ref="${btnRef}"]`);
    item?.classList.toggle('is-active', isActive);
    btn?.classList.toggle('is-active', isActive);
  };

  updateItem('rail-item-home', 'btn-rail-home', isHome);
  updateItem('rail-item-templates', 'btn-rail-templates', isTemplates);
  updateItem('rail-item-shared', 'btn-rail-shared', isShared);
  updateItem('rail-item-teams', 'btn-rail-teams', isTeams);

  const itemShared = sidebar.querySelector<HTMLElement>('[data-ref="rail-item-shared"]');
  const itemTeams = sidebar.querySelector<HTMLElement>('[data-ref="rail-item-teams"]');
  const notificationsContainer = sidebar.querySelector<HTMLElement>('[data-ref="notifications-container"]');
  const btnNotifications = sidebar.querySelector<HTMLElement>('[data-ref="btn-notifications"]');

  if (!currentUser) {
    if (itemShared) itemShared.style.display = 'none';
    if (itemTeams) itemTeams.style.display = 'none';
    if (notificationsContainer) notificationsContainer.style.display = 'none';
    if (btnNotifications) btnNotifications.style.display = 'none';
  } else {
    if (itemShared) itemShared.style.display = '';
    if (itemTeams) itemTeams.style.display = '';
    if (notificationsContainer) notificationsContainer.style.display = '';
    if (btnNotifications) btnNotifications.style.display = '';
  }
}

export async function updateDynamicDrawer(sidebar?: HTMLElement): Promise<void> {
  const sb = sidebar || document.querySelector<HTMLElement>('[data-ref="sidebar"]');
  if (!sb) return;
  const drawer = sb.querySelector<HTMLElement>('[data-ref="layout-drawer"]');
  if (drawer && isDrawerOpen) {
    await populateDrawerContent(drawer);
  }
}

export function getIsChatOpen(): boolean {
  return isChatOpen;
}

export async function toggleChatSidebar(forceState?: boolean): Promise<void> {
  if (!currentUser) {
    if (forceState === true) {
      navigate('/help/terms');
    }
    return;
  }
  const nextOpen = forceState !== undefined ? forceState : !isChatOpen;
  isChatOpen = nextOpen;

  const btnRailHelp = document.querySelector<HTMLElement>('[data-ref="btn-rail-help"]');
  btnRailHelp?.classList.toggle('is-active', isChatOpen);

  if (isChatOpen) {
    const chatEl = await initChatSidebar();
    if (!isChatOpen) return;
    const activeContent = document.querySelector<HTMLElement>('[data-ref="app"] .layout-content');
    if (activeContent && chatEl.parentNode !== activeContent) {
      activeContent.appendChild(chatEl);
    }
    chatEl.classList.add('is-active');
    updateChatEmptyState();
    toggleSidebar(false);
    const chatInput = chatEl.querySelector<HTMLInputElement>('[data-ref="chat-input"]');
    setTimeout(() => chatInput?.focus(), 80);
  } else {
    if (chatSidebarElement) {
      chatSidebarElement.classList.remove('is-active');
      chatSidebarElement.remove();
    }
  }
}

export function attachChatSidebarToView(contentElement: HTMLElement | null): void {
  if (!contentElement || !chatSidebarElement || !isChatOpen) return;
  if (chatSidebarElement.parentNode !== contentElement) {
    contentElement.appendChild(chatSidebarElement);
  }
}

function updateChatEmptyState(): void {
  if (!chatSidebarElement) return;
  const chatPanel = chatSidebarElement.querySelector<HTMLElement>('[data-ref="chat-panel"]');
  const messages = chatSidebarElement.querySelectorAll('.chat-message');
  chatPanel?.classList.toggle('is-empty', messages.length === 0);
}

document.addEventListener('keydown', (e: KeyboardEvent) => {
  if (e.key === 'Escape') {
    if (window.innerWidth <= 768 && isDrawerOpen) toggleDrawer(false);
    if (isChatOpen) toggleChatSidebar(false);
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

  if (isChatOpen) {
    const chatSidebar = document.querySelector<HTMLElement>('[data-ref="chat-sidebar"]');
    const btnRailHelp = document.querySelector<HTMLElement>('[data-ref="btn-rail-help"]');
    const btnMenuHelp = document.querySelector<HTMLElement>('[data-ref="btn-menu-help"]');

    const isClickInside =
      (chatSidebar && target && chatSidebar.contains(target)) ||
      (btnRailHelp && target && btnRailHelp.contains(target)) ||
      (btnMenuHelp && target && btnMenuHelp.contains(target));

    if (!isClickInside) {
      toggleChatSidebar(false);
    }
  }
});

function formatNotificationTime(iso?: string | null): string {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    const diffSec = Math.floor((Date.now() - d.getTime()) / 1000);
    if (diffSec < 60) return 'Hace un momento';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `Hace ${diffMin} min`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `Hace ${diffHours} h`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `Hace ${diffDays} d`;
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}

export async function createTopBar(): Promise<HTMLElement> {
  const dummy = document.createElement('div');
  dummy.className = 'layout-header-placeholder';
  dummy.style.display = 'none';
  return dummy;
}

function setupRailNavigation(sidebar: HTMLElement): void {
  const currentPath = window.location.pathname;

  const bindNav = (itemRef: string, btnRef: string, path: string, isActive: boolean) => {
    const item = sidebar.querySelector<HTMLElement>(`[data-ref="${itemRef}"]`);
    const btn = sidebar.querySelector<HTMLElement>(`[data-ref="${btnRef}"]`);
    const handler = (e: Event) => {
      e.preventDefault();
      const routeGate = protectRoute(path, currentUser);
      if (!routeGate.allowed) {
        openUpgradeModal(routeGate.requiredTier || 'business');
        return;
      }
      navigate(path);
    };
    btn?.addEventListener('click', handler);
    item?.addEventListener('click', (e) => {
      if (e.target !== btn && !btn?.contains(e.target as Node)) {
        handler(e);
      }
    });

    if (isActive) {
      btn?.classList.add('is-active');
      item?.classList.add('is-active');
    }
  };

  const isHome = currentPath === '/' || currentPath === '' || currentPath.startsWith('/folder/');
  bindNav('rail-item-home', 'btn-rail-home', '/', isHome);
  bindNav('rail-item-templates', 'btn-rail-templates', '/templates', currentPath === '/templates');
  bindNav('rail-item-shared', 'btn-rail-shared', '/shared', currentPath === '/shared');
  bindNav('rail-item-teams', 'btn-rail-teams', '/teams', currentPath === '/teams');

  if (!currentUser) {
    const itemShared = sidebar.querySelector<HTMLElement>('[data-ref="rail-item-shared"]');
    const itemTeams = sidebar.querySelector<HTMLElement>('[data-ref="rail-item-teams"]');
    if (itemShared) itemShared.style.display = 'none';
    if (itemTeams) itemTeams.style.display = 'none';
  }

  const updateRailTeamsBadge = () => {
    const railTeamsBadge = sidebar.querySelector<HTMLElement>('[data-ref="rail-teams-badge"]');
    if (railTeamsBadge) {
      const hasTeamsAccess = hasFeature('teams', currentUser);
      railTeamsBadge.classList.toggle('is-hidden', hasTeamsAccess);
    }
  };
  updateRailTeamsBadge();
  window.addEventListener('subscription-updated', updateRailTeamsBadge);

  const btnCreate = sidebar.querySelector<HTMLElement>('[data-ref="btn-rail-create"]');
  const itemCreate = sidebar.querySelector<HTMLElement>('[data-ref="rail-item-create"]');
  const createHandler = (e: Event) => {
    e.preventDefault();
    openCreateCanvasModal();
  };
  btnCreate?.addEventListener('click', createHandler);
  itemCreate?.addEventListener('click', (e) => {
    if (e.target !== btnCreate && !btnCreate?.contains(e.target as Node)) {
      createHandler(e);
    }
  });

  const btnCanvasHome = sidebar.querySelector<HTMLElement>('[data-ref="btn-rail-canvas-home"]');
  const itemCanvasHome = sidebar.querySelector<HTMLElement>('[data-ref="rail-item-canvas-home"]');
  const canvasHomeHandler = (e: Event) => {
    e.preventDefault();
    navigate('/');
  };
  btnCanvasHome?.addEventListener('click', canvasHomeHandler);
  itemCanvasHome?.addEventListener('click', (e) => {
    if (e.target !== btnCanvasHome && !btnCanvasHome?.contains(e.target as Node)) {
      canvasHomeHandler(e);
    }
  });

  const canvasItems: Array<{ tab: 'templates' | 'elements' | 'uploads' | 'projects'; btnRef: string; itemRef: string }> = [
    { btnRef: 'btn-rail-canvas-templates', itemRef: 'rail-item-canvas-templates', tab: 'templates' },
    { btnRef: 'btn-rail-canvas-elements', itemRef: 'rail-item-canvas-elements', tab: 'elements' },
    { btnRef: 'btn-rail-canvas-uploads', itemRef: 'rail-item-canvas-uploads', tab: 'uploads' },
    { btnRef: 'btn-rail-canvas-projects', itemRef: 'rail-item-canvas-projects', tab: 'projects' },
  ];

  canvasItems.forEach(({ btnRef, itemRef, tab }) => {
    const btn = sidebar.querySelector<HTMLElement>(`[data-ref="${btnRef}"]`);
    const item = sidebar.querySelector<HTMLElement>(`[data-ref="${itemRef}"]`);
    const handler = (e: Event) => {
      e.preventDefault();
      if (isDrawerOpen && activeCanvasTab === tab) {
        toggleDrawer(false);
      } else {
        activeCanvasTab = tab;
        if (!isDrawerOpen) {
          toggleDrawer(true);
        } else {
          void updateDynamicDrawer(sidebar);
          updateCanvasRailActiveState(sidebar);
        }
      }
    };
    btn?.addEventListener('click', handler);
    item?.addEventListener('click', (e) => {
      if (e.target !== btn && !btn?.contains(e.target as Node)) {
        handler(e);
      }
    });
  });
}

function createDrawerCanvasRow(canvas: CanvasItem): HTMLElement {
  const item = document.createElement('button');
  item.type = 'button';
  item.className = 'drawer-canvas-item';
  item.setAttribute('data-ref', `drawer-canvas-${canvas.uuid}`);
  const isDoc = canvas.canvas_type === 'doc' || canvas.unit === 'doc';
  const isDiagram = !isDoc && (canvas.canvas_type === 'diagram' || canvas.canvas_type === 'mindmap' || canvas.unit === 'diagram');
  const isBoard = !isDoc && !isDiagram && (canvas.canvas_type === 'board' || canvas.unit === 'board');
  const targetUrl = `/design/${canvas.uuid}`;
  const iconName = isDoc ? 'description' : (isDiagram ? 'psychology' : (isBoard ? 'dashboard' : 'grid_view'));

  const thumbHtml = canvas.preview_thumbnail
    ? `<img class="drawer-canvas-item__thumb-img" src="${canvas.preview_thumbnail}" alt="" />`
    : `<svg class="component-icon drawer-canvas-item__thumb-icon" aria-hidden="true"><use href="/icons.svg#${iconName}"></use></svg>`;

  item.innerHTML = `
    <div class="drawer-canvas-item__thumb">
      ${thumbHtml}
    </div>
    <span class="drawer-canvas-item__title">${escapeHtml(canvas.name || 'Diseño sin título')}</span>
  `;

  item.addEventListener('click', (e) => {
    e.preventDefault();
    if (window.innerWidth <= 768) {
      toggleDrawer(false);
    }
    navigate(targetUrl);
  });

  return item;
}

async function renderHomeDrawerContent(drawerBody: HTMLElement): Promise<void> {
  drawerBody.innerHTML = `
    <div class="drawer-section" data-ref="drawer-section-favorites">
      <div class="drawer-section__header" data-ref="drawer-header-favorites">
        <span class="drawer-section__title">Favoritos</span>
        <button type="button" class="drawer-section__action" data-ref="btn-drawer-add-favorite" data-tooltip="Crear diseño" aria-label="Crear diseño">
          <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#add"></use></svg>
        </button>
      </div>
      <div class="drawer-items-list" data-ref="drawer-favorites-list">
        <div class="drawer-canvas-item is-skeleton" style="pointer-events: none;">
          <div class="drawer-canvas-item__thumb skeleton" style="border: none;"></div>
          <div class="skeleton skeleton--text" style="width: 60%; height: 12px; border-radius: 4px;"></div>
        </div>
        <div class="drawer-canvas-item is-skeleton" style="pointer-events: none;">
          <div class="drawer-canvas-item__thumb skeleton" style="border: none;"></div>
          <div class="skeleton skeleton--text" style="width: 75%; height: 12px; border-radius: 4px;"></div>
        </div>
      </div>
    </div>

    <div class="drawer-section" data-ref="drawer-section-recents">
      <div class="drawer-section__header" data-ref="drawer-header-recents">
        <span class="drawer-section__title">Diseños recientes</span>
      </div>
      <div class="drawer-items-list" data-ref="drawer-recents-list">
        <div class="drawer-canvas-item is-skeleton" style="pointer-events: none;">
          <div class="drawer-canvas-item__thumb skeleton" style="border: none;"></div>
          <div class="skeleton skeleton--text" style="width: 70%; height: 12px; border-radius: 4px;"></div>
        </div>
        <div class="drawer-canvas-item is-skeleton" style="pointer-events: none;">
          <div class="drawer-canvas-item__thumb skeleton" style="border: none;"></div>
          <div class="skeleton skeleton--text" style="width: 50%; height: 12px; border-radius: 4px;"></div>
        </div>
        <div class="drawer-canvas-item is-skeleton" style="pointer-events: none;">
          <div class="drawer-canvas-item__thumb skeleton" style="border: none;"></div>
          <div class="skeleton skeleton--text" style="width: 65%; height: 12px; border-radius: 4px;"></div>
        </div>
      </div>
      <button type="button" class="drawer-link-btn" data-ref="btn-drawer-view-all" style="display: none;">Ver todo</button>
    </div>
  `;

  const favoritesList = drawerBody.querySelector<HTMLElement>('[data-ref="drawer-favorites-list"]');
  const recentsList = drawerBody.querySelector<HTMLElement>('[data-ref="drawer-recents-list"]');
  const btnAddFav = drawerBody.querySelector<HTMLElement>('[data-ref="btn-drawer-add-favorite"]');
  const btnViewAll = drawerBody.querySelector<HTMLElement>('[data-ref="btn-drawer-view-all"]');

  btnAddFav?.addEventListener('click', (e) => {
    e.preventDefault();
    openCreateCanvasModal();
  });

  const INITIAL_RECENTS_LIMIT = 8;
  const BATCH_LIMIT = 10;
  const renderedUuids = new Set<string>();
  let currentBatchPage = 1;
  let hasMoreBatches = false;
  let isLoadingBatch = false;
  let isBatchScrollActive = false;

  try {
    let items: CanvasItem[] = [];
    const localCanvases = await getAllLocalCanvases();

    if (currentUser) {
      try {
        const res = await getApi(API_ROUTES.canvases.base);
        if (res.ok) {
          const data = await res.json();
          if (data && Array.isArray(data.canvases)) {
            const cloudUuids = new Set(data.canvases.map((c: CanvasItem) => c.uuid));
            const unsynced = localCanvases.filter((c) => c.is_local && !cloudUuids.has(c.uuid) && !c.id && (!c.user_id || c.user_id === currentUser?.id));
            items = [...unsynced, ...data.canvases];
          } else {
            items = localCanvases;
          }
        } else {
          items = localCanvases;
        }
      } catch {
        items = localCanvases;
      }
    } else {
      items = localCanvases.filter((c) => c.is_local && !c.user_id && !c.id);
    }

    const nonDeleted = items.filter((c) => !c.deleted_at);

    const favorites = nonDeleted.filter((c) => c.is_favorite);
    if (favoritesList) {
      if (favorites.length === 0) {
        favoritesList.innerHTML = `
          <div class="drawer-empty-card" data-ref="drawer-empty-card-favorites">
            <div class="drawer-empty-card__title">Diseños favoritos</div>
            <div class="drawer-empty-card__desc">Aquí aparecerán los diseños que marques como favoritos.</div>
          </div>
        `;
      } else {
        favoritesList.innerHTML = '';
        favorites.slice(0, 6).forEach((c) => {
          favoritesList.appendChild(createDrawerCanvasRow(c));
        });
      }
    }

    const sortedRecents = [...nonDeleted].sort((a, b) => {
      const timeA = new Date(a.updated_at || a.created_at).getTime();
      const timeB = new Date(b.updated_at || b.created_at).getTime();
      return timeB - timeA;
    });

    if (recentsList) {
      recentsList.innerHTML = '';
      if (sortedRecents.length === 0) {
        recentsList.innerHTML = `
          <div class="drawer-empty-card" data-ref="drawer-empty-card-recents">
            <div class="drawer-empty-card__title">Diseños recientes</div>
            <div class="drawer-empty-card__desc">Aquí aparecerán los últimos diseños que hayas creado o abierto.</div>
          </div>
        `;
      } else {
        const initialSlice = sortedRecents.slice(0, INITIAL_RECENTS_LIMIT);
        initialSlice.forEach((c) => {
          renderedUuids.add(c.uuid);
          recentsList.appendChild(createDrawerCanvasRow(c));
        });
      }
    }

    if (sortedRecents.length > INITIAL_RECENTS_LIMIT) {
      if (btnViewAll) {
        btnViewAll.style.display = 'block';
      }
      hasMoreBatches = true;
    } else {
      if (btnViewAll) {
        btnViewAll.style.display = 'none';
      }
      hasMoreBatches = false;
    }

    const loadNextBatch = async () => {
      if (isLoadingBatch || !hasMoreBatches || !recentsList) return;
      isLoadingBatch = true;
      currentBatchPage++;

      const skeletons = [createDrawerSkeletonRow(), createDrawerSkeletonRow(), createDrawerSkeletonRow()];
      skeletons.forEach((s) => recentsList.appendChild(s));

      try {
        if (currentUser) {
          const res = await getApi(`${API_ROUTES.canvases.base}?page=${currentBatchPage}&limit=${BATCH_LIMIT}&sort=activity`);
          skeletons.forEach((s) => s.remove());
          if (res.ok) {
            const data = await res.json();
            if (data && Array.isArray(data.canvases) && data.canvases.length > 0) {
              let addedCount = 0;
              data.canvases.forEach((c: CanvasItem) => {
                if (!renderedUuids.has(c.uuid) && !c.deleted_at) {
                  renderedUuids.add(c.uuid);
                  recentsList.appendChild(createDrawerCanvasRow(c));
                  addedCount++;
                }
              });
              hasMoreBatches = Boolean(data.hasMore);
              if (!hasMoreBatches && addedCount === 0) {
                hasMoreBatches = false;
              }
            } else {
              hasMoreBatches = false;
            }
          } else {
            hasMoreBatches = false;
          }
        } else {
          await new Promise((resolve) => setTimeout(resolve, 180));
          skeletons.forEach((s) => s.remove());
          const startIdx = (currentBatchPage - 1) * BATCH_LIMIT;
          const localSlice = sortedRecents.slice(startIdx, startIdx + BATCH_LIMIT);
          localSlice.forEach((c) => {
            if (!renderedUuids.has(c.uuid)) {
              renderedUuids.add(c.uuid);
              recentsList.appendChild(createDrawerCanvasRow(c));
            }
          });
          hasMoreBatches = startIdx + BATCH_LIMIT < sortedRecents.length;
        }
      } catch {
        skeletons.forEach((s) => s.remove());
        hasMoreBatches = false;
      } finally {
        isLoadingBatch = false;
      }
    };

    btnViewAll?.addEventListener('click', async (e) => {
      e.preventDefault();
      if (btnViewAll) {
        btnViewAll.style.display = 'none';
      }
      await loadNextBatch();

      if (!isBatchScrollActive) {
        isBatchScrollActive = true;
        drawerBody.addEventListener(
          'scroll',
          () => {
            if (!hasMoreBatches || isLoadingBatch) return;
            const scrollRemaining = drawerBody.scrollHeight - drawerBody.scrollTop - drawerBody.clientHeight;
            if (scrollRemaining < 80) {
              void loadNextBatch();
            }
          },
          { passive: true }
        );
      }
    });
  } catch {
    if (favoritesList) {
      favoritesList.innerHTML = `
        <div class="drawer-empty-card" data-ref="drawer-empty-card-favorites">
          <div class="drawer-empty-card__title">Diseños favoritos</div>
          <div class="drawer-empty-card__desc">Aquí aparecerán los diseños que marques como favoritos.</div>
        </div>
      `;
    }
    if (recentsList) {
      recentsList.innerHTML = `
        <div class="drawer-empty-card" data-ref="drawer-empty-card-recents">
          <div class="drawer-empty-card__title">Diseños recientes</div>
          <div class="drawer-empty-card__desc">Aquí aparecerán los últimos diseños que hayas creado o abierto.</div>
        </div>
      `;
    }
  }
}

async function openDynamicDrawer(sidebar: HTMLElement): Promise<void> {
  let drawer = sidebar.querySelector<HTMLElement>('[data-ref="layout-drawer"]');
  if (!drawer) {
    drawer = createDrawerElement();
    sidebar.appendChild(drawer);
    renderIcons(drawer);
  }

  await populateDrawerContent(drawer);

  void drawer.offsetWidth;
  drawer.classList.add('is-expanded');
}

function closeDynamicDrawer(): void {
  const drawer = document.querySelector<HTMLElement>('[data-ref="layout-drawer"]');
  if (drawer) {
    drawer.classList.remove('is-expanded');
    if (drawerRemovalTimer) {
      clearTimeout(drawerRemovalTimer);
    }
    drawerRemovalTimer = setTimeout(() => {
      if (!isDrawerOpen && drawer.parentNode) {
        drawer.remove();
      }
      drawerRemovalTimer = null;
    }, 230);
  }
}

function getActiveCanvasType(): 'board' | 'diagram' | 'doc' | 'pixel' {
  const content = document.querySelector<HTMLElement>('[data-ref="app"] .layout-content, .layout-content');
  const ref = content?.getAttribute('data-ref');
  if (ref === 'doc-view' || window.location.pathname.startsWith('/doc/')) return 'doc';
  if (ref === 'board-view' || window.location.pathname.startsWith('/board/')) return 'board';
  if (ref === 'mindmap-view' || window.location.pathname.startsWith('/mindmap/') || window.location.pathname.startsWith('/diagram/')) return 'diagram';
  return 'pixel';
}

function getActiveCanvasController(): any {
  const content = document.querySelector<HTMLElement>('[data-ref="app"] .layout-content, .layout-content');
  return (content as any)?.__controller || null;
}

function handleApplyCanvasTemplate(preset: PresetItem, canvasType: 'board' | 'diagram' | 'doc' | 'pixel'): void {
  const controller = getActiveCanvasController();

  if (canvasType === 'doc') {
    const docPreset = getDocTemplateById(preset.docTemplateId || preset.id) || DOC_TEMPLATES.find((p) => p.id === preset.docTemplateId) || DOC_TEMPLATES[0];
    if (!controller) {
      showToast('No se encontró el controlador del documento', 'warning');
      return;
    }

    if (typeof controller.isDocumentEmpty === 'function' && controller.isDocumentEmpty()) {
      controller.applyTemplateToDocument(docPreset);
      showToast(`Plantilla «${preset.name}» aplicada`, 'success');
      if (window.innerWidth <= 768) {
        toggleDrawer(false);
      }
      return;
    }

    const modal = openModal({
      cancelText: 'Cancelar',
      description: `¿Cómo deseas aplicar «${preset.name}» en tu documento actual?`,
      showCancel: true,
      showConfirm: false,
      title: 'Aplicar plantilla en el documento',
      bodyHtml: `
        <div class="template-choice-options" data-ref="template-choice-options">
          <button type="button" class="template-choice-card" data-ref="btn-choice-new-page">
            <div class="template-choice-card__icon">
              <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#note_add"></use></svg>
            </div>
            <div class="template-choice-card__content">
              <span class="template-choice-card__title">Añadir como nueva página</span>
              <span class="template-choice-card__desc">Inserta el contenido de la plantilla en una página nueva al final.</span>
            </div>
          </button>

          <button type="button" class="template-choice-card" data-ref="btn-choice-current-page">
            <div class="template-choice-card__icon">
              <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#find_replace"></use></svg>
            </div>
            <div class="template-choice-card__content">
              <span class="template-choice-card__title">Reemplazar página actual</span>
              <span class="template-choice-card__desc">Sobrescribe el contenido de la página actual con esta plantilla.</span>
            </div>
          </button>

          <button type="button" class="template-choice-card template-choice-card--danger" data-ref="btn-choice-replace-doc">
            <div class="template-choice-card__icon">
              <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#refresh"></use></svg>
            </div>
            <div class="template-choice-card__content">
              <span class="template-choice-card__title">Reemplazar todo el documento</span>
              <span class="template-choice-card__desc">Elimina las páginas existentes y aplica la plantilla completa.</span>
            </div>
          </button>
        </div>
      `,
    });

    const btnNewPage = modal.card?.querySelector<HTMLElement>('[data-ref="btn-choice-new-page"]');
    const btnCurrentPage = modal.card?.querySelector<HTMLElement>('[data-ref="btn-choice-current-page"]');
    const btnReplaceDoc = modal.card?.querySelector<HTMLElement>('[data-ref="btn-choice-replace-doc"]');

    btnNewPage?.addEventListener('click', () => {
      controller.applyTemplateAsNewPage(docPreset);
      modal.close();
      showToast(`Plantilla «${preset.name}» añadida como nueva página`, 'success');
      if (window.innerWidth <= 768) {
        toggleDrawer(false);
      }
    });

    btnCurrentPage?.addEventListener('click', () => {
      controller.applyTemplateToCurrentPage(docPreset);
      modal.close();
      showToast(`Página actual actualizada con «${preset.name}»`, 'success');
      if (window.innerWidth <= 768) {
        toggleDrawer(false);
      }
    });

    btnReplaceDoc?.addEventListener('click', () => {
      controller.applyTemplateToDocument(docPreset);
      modal.close();
      showToast(`Documento reemplazado con «${preset.name}»`, 'success');
      if (window.innerWidth <= 768) {
        toggleDrawer(false);
      }
    });
    return;
  }

  if (canvasType === 'board') {
    if (!controller) {
      showToast('No se encontró el controlador del pizarrón', 'warning');
      return;
    }

    const templateId = preset.boardTemplateId || preset.id;

    if (typeof controller.isBoardEmpty === 'function' && controller.isBoardEmpty()) {
      controller.applyTemplate(templateId, 'replace');
      showToast(`Plantilla «${preset.name}» cargada en el pizarrón`, 'success');
      if (window.innerWidth <= 768) {
        toggleDrawer(false);
      }
      return;
    }

    const modal = openModal({
      cancelText: 'Cancelar',
      description: `¿Cómo deseas insertar «${preset.name}» en tu pizarrón?`,
      showCancel: true,
      showConfirm: false,
      title: 'Insertar plantilla en el pizarrón',
      bodyHtml: `
        <div class="template-choice-options" data-ref="template-choice-options">
          <button type="button" class="template-choice-card" data-ref="btn-choice-insert-board">
            <div class="template-choice-card__icon">
              <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#add_circle"></use></svg>
            </div>
            <div class="template-choice-card__content">
              <span class="template-choice-card__title">Añadir al pizarrón</span>
              <span class="template-choice-card__desc">Inserta los elementos de la plantilla sin borrar tus elementos actuales.</span>
            </div>
          </button>

          <button type="button" class="template-choice-card template-choice-card--danger" data-ref="btn-choice-replace-board">
            <div class="template-choice-card__icon">
              <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#refresh"></use></svg>
            </div>
            <div class="template-choice-card__content">
              <span class="template-choice-card__title">Reemplazar todo el pizarrón</span>
              <span class="template-choice-card__desc">Limpia el pizarrón actual y coloca únicamente la plantilla seleccionada.</span>
            </div>
          </button>
        </div>
      `,
    });

    const btnInsertBoard = modal.card?.querySelector<HTMLElement>('[data-ref="btn-choice-insert-board"]');
    const btnReplaceBoard = modal.card?.querySelector<HTMLElement>('[data-ref="btn-choice-replace-board"]');

    btnInsertBoard?.addEventListener('click', () => {
      controller.applyTemplate(templateId, 'insert');
      modal.close();
      showToast(`Plantilla «${preset.name}» añadida al pizarrón`, 'success');
      if (window.innerWidth <= 768) {
        toggleDrawer(false);
      }
    });

    btnReplaceBoard?.addEventListener('click', () => {
      controller.applyTemplate(templateId, 'replace');
      modal.close();
      showToast(`Pizarrón reemplazado con «${preset.name}»`, 'success');
      if (window.innerWidth <= 768) {
        toggleDrawer(false);
      }
    });
    return;
  }

  if (canvasType === 'diagram') {
    if (!controller) {
      showToast('No se encontró el controlador del diagrama', 'warning');
      return;
    }

    const templateId = preset.diagramTemplateId || preset.id;
    const subtype = preset.diagramSubtype || 'mindmap';

    if (typeof controller.isDiagramEmpty === 'function' && controller.isDiagramEmpty()) {
      controller.applyTemplate(templateId, subtype);
      showToast(`Plantilla «${preset.name}» aplicada al diagrama`, 'success');
      if (window.innerWidth <= 768) {
        toggleDrawer(false);
      }
      return;
    }

    const modal = openModal({
      cancelText: 'Cancelar',
      confirmClass: 'component-button--black',
      confirmText: 'Reemplazar diagrama',
      description: `¿Deseas reemplazar el diagrama actual con la plantilla «${preset.name}»?`,
      showCancel: true,
      showConfirm: true,
      title: 'Aplicar plantilla de diagrama',
      onConfirm: () => {
        controller.applyTemplate(templateId, subtype);
        modal.close();
        showToast(`Plantilla «${preset.name}» aplicada`, 'success');
        if (window.innerWidth <= 768) {
          toggleDrawer(false);
        }
      },
    });
    return;
  }

  if (canvasType === 'pixel') {
    if (!controller) {
      showToast('No se encontró el controlador de diseño', 'warning');
      return;
    }

    void controller.applyTemplate(preset.imagePath, preset.name);
    showToast(`Plantilla «${preset.name}» importada`, 'success');
    if (window.innerWidth <= 768) {
      toggleDrawer(false);
    }
  }
}

let activeElementsCategory: 'shapes' | 'templates' = 'shapes';

function handleApplyCanvasElement(shape: PixelShape, canvasType: 'board' | 'diagram' | 'doc' | 'pixel'): void {
  const controller = getActiveCanvasController();

  if (canvasType === 'doc') {
    if (!controller) {
      showToast('No se encontró el controlador del documento', 'warning');
      return;
    }

    if (shape.type === 'vector' && shape.pathD) {
      controller.insertShapeSvg(shape.pathD, shape.name, '#1e293b');
    } else if (shape.type === 'sticker' && shape.file) {
      controller.insertImage(`/assets/img/stickers/${shape.file}`, shape.name);
    }
    showToast(`«${shape.name}» insertado en el documento`, 'success');
    if (window.innerWidth <= 768) {
      toggleDrawer(false);
    }
    return;
  }

  if (canvasType === 'board') {
    if (!controller) {
      showToast('No se encontró el controlador del pizarrón', 'warning');
      return;
    }

    controller.insertShapeOrSticker(shape);
    showToast(`«${shape.name}» añadido al pizarrón`, 'success');
    if (window.innerWidth <= 768) {
      toggleDrawer(false);
    }
    return;
  }

  if (canvasType === 'diagram') {
    if (!controller) {
      showToast('No se encontró el controlador del diagrama', 'warning');
      return;
    }

    controller.insertShapeOrSticker(shape);
    showToast(`«${shape.name}» añadido al diagrama`, 'success');
    if (window.innerWidth <= 768) {
      toggleDrawer(false);
    }
    return;
  }

  if (canvasType === 'pixel') {
    if (!controller) {
      showToast('No se encontró el controlador de diseño', 'warning');
      return;
    }

    void controller.applyShapeOrSticker(shape);
    showToast(`«${shape.name}» agregado en una nueva capa`, 'success');
    if (window.innerWidth <= 768) {
      toggleDrawer(false);
    }
  }
}

function renderElementsDrawerContent(drawer: HTMLElement, drawerBody: HTMLElement): void {
  const sidebar = drawer.closest<HTMLElement>('[data-ref="sidebar"]') || document.querySelector<HTMLElement>('[data-ref="sidebar"]');
  const canvasType = getActiveCanvasType();

  drawerBody.innerHTML = `
    <div class="canvas-panel-card" data-ref="canvas-panel-card">
      <div class="canvas-panel-card__header" data-ref="canvas-panel-header">
        <div class="canvas-panel-card__title-box" data-ref="canvas-panel-title-box">
          <svg class="component-icon canvas-panel-card__icon" aria-hidden="true"><use href="/icons.svg#category"></use></svg>
          <span class="canvas-panel-card__title" data-ref="canvas-panel-title">${t('nav.elements') || 'Elementos'}</span>
        </div>
        <button type="button" class="component-button component-button--h32 component-button--icon-only rail-btn canvas-panel-card__close" data-ref="btn-close-canvas-panel" data-tooltip="Cerrar panel" aria-label="Cerrar panel">
          <svg class="component-icon rail-btn__icon" aria-hidden="true"><use href="/icons.svg#close"></use></svg>
        </button>
      </div>
      <div class="canvas-panel-card__body" data-ref="canvas-panel-body">
        <div class="elements-tabs-bar" data-ref="elements-tabs-bar">
          <button type="button" class="elements-tab-btn${activeElementsCategory === 'shapes' ? ' is-active' : ''}" data-ref="btn-tab-elements-shapes">
            <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#category"></use></svg>
            <span>Figuras</span>
          </button>
          <button type="button" class="elements-tab-btn${activeElementsCategory === 'templates' ? ' is-active' : ''}" data-ref="btn-tab-elements-templates">
            <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#auto_awesome"></use></svg>
            <span>Plantillas</span>
          </button>
        </div>

        <div class="canvas-panel-search" data-ref="canvas-panel-search">
          <svg class="component-icon canvas-panel-search__icon" aria-hidden="true"><use href="/icons.svg#search"></use></svg>
          <input class="canvas-panel-search__input" data-ref="canvas-elements-search-input" type="text" placeholder="${activeElementsCategory === 'shapes' ? 'Buscar figuras...' : 'Buscar plantillas...'}" />
        </div>

        <div class="elements-grid" data-ref="elements-grid"></div>
      </div>
    </div>
  `;

  const btnClose = drawerBody.querySelector<HTMLElement>('[data-ref="btn-close-canvas-panel"]');
  btnClose?.addEventListener('click', (e) => {
    e.preventDefault();
    toggleDrawer(false);
  });

  const btnTabShapes = drawerBody.querySelector<HTMLButtonElement>('[data-ref="btn-tab-elements-shapes"]');
  const btnTabTemplates = drawerBody.querySelector<HTMLButtonElement>('[data-ref="btn-tab-elements-templates"]');
  const searchInput = drawerBody.querySelector<HTMLInputElement>('[data-ref="canvas-elements-search-input"]');
  const grid = drawerBody.querySelector<HTMLElement>('[data-ref="elements-grid"]');

  const renderGrid = (query = '') => {
    if (!grid) return;
    const cleanQ = query.trim().toLowerCase();
    const items = PIXEL_SHAPES.filter((s) => s.category === activeElementsCategory);
    const filtered = cleanQ
      ? items.filter((s) => s.name.toLowerCase().includes(cleanQ) || s.id.toLowerCase().includes(cleanQ))
      : items;

    if (filtered.length === 0) {
      grid.innerHTML = `
        <div class="canvas-panel-card__empty" style="grid-column: 1 / -1;" data-ref="elements-empty">
          <span class="canvas-panel-card__empty-title">Sin resultados</span>
          <p class="canvas-panel-card__empty-desc">No se encontraron elementos para «${escapeHtml(query)}»</p>
        </div>
      `;
      return;
    }

    grid.innerHTML = filtered.map((item) => {
      let previewHtml = '';
      if (item.type === 'vector' && item.pathD) {
        previewHtml = `<svg viewBox="0 0 48 48" aria-hidden="true"><path d="${item.pathD}" fill="currentColor" /></svg>`;
      } else if (item.type === 'sticker' && item.file) {
        previewHtml = `<img src="/assets/img/stickers/${item.file}" alt="${escapeHtml(item.name)}" loading="lazy" />`;
      }

      return `
        <button type="button" class="element-grid-item" data-ref="btn-element-item-${item.id}" data-element-id="${item.id}" data-tooltip="${escapeHtml(item.name)}" aria-label="${escapeHtml(item.name)}">
          ${previewHtml}
        </button>
      `;
    }).join('');

    grid.querySelectorAll<HTMLButtonElement>('.element-grid-item').forEach((itemBtn) => {
      itemBtn.addEventListener('click', () => {
        const elId = itemBtn.getAttribute('data-element-id');
        const found = PIXEL_SHAPES.find((s) => s.id === elId);
        if (found) {
          handleApplyCanvasElement(found, canvasType);
        }
      });
    });
  };

  btnTabShapes?.addEventListener('click', () => {
    if (activeElementsCategory === 'shapes') return;
    activeElementsCategory = 'shapes';
    btnTabShapes.classList.add('is-active');
    btnTabTemplates?.classList.remove('is-active');
    if (searchInput) {
      searchInput.placeholder = 'Buscar figuras...';
      searchInput.value = '';
    }
    renderGrid('');
  });

  btnTabTemplates?.addEventListener('click', () => {
    if (activeElementsCategory === 'templates') return;
    activeElementsCategory = 'templates';
    btnTabTemplates.classList.add('is-active');
    btnTabShapes?.classList.remove('is-active');
    if (searchInput) {
      searchInput.placeholder = 'Buscar plantillas...';
      searchInput.value = '';
    }
    renderGrid('');
  });

  searchInput?.addEventListener('input', () => {
    renderGrid(searchInput.value);
  });

  renderGrid();

  const drawerFooter = drawer.querySelector<HTMLElement>('[data-ref="drawer-footer"]');
  if (drawerFooter) {
    drawerFooter.style.display = 'none';
  }

  if (sidebar) {
    updateCanvasRailActiveState(sidebar);
  }

  renderIcons(drawerBody);
}

function renderCanvasDrawerContent(drawer: HTMLElement, drawerBody: HTMLElement): void {
  const tab = activeCanvasTab || 'templates';
  const sidebar = drawer.closest<HTMLElement>('[data-ref="sidebar"]') || document.querySelector<HTMLElement>('[data-ref="sidebar"]');

  if (tab === 'elements') {
    renderElementsDrawerContent(drawer, drawerBody);
    return;
  }

  if (tab === 'templates') {
    const canvasType = getActiveCanvasType();
    const presets = ALL_PRESETS.filter((item) => {
      if (canvasType === 'doc') return item.canvasType === 'doc';
      if (canvasType === 'board') return item.canvasType === 'board';
      if (canvasType === 'diagram') return item.canvasType === 'diagram' || item.categoryKey === 'mindmap' || item.categoryKey === 'conceptmap' || item.categoryKey === 'flowchart';
      return item.canvasType === 'pixel' || item.categoryKey === 'pixel';
    });

    drawerBody.innerHTML = `
      <div class="canvas-panel-card" data-ref="canvas-panel-card">
        <div class="canvas-panel-card__header" data-ref="canvas-panel-header">
          <div class="canvas-panel-card__title-box" data-ref="canvas-panel-title-box">
            <svg class="component-icon canvas-panel-card__icon" aria-hidden="true"><use href="/icons.svg#space_dashboard"></use></svg>
            <span class="canvas-panel-card__title" data-ref="canvas-panel-title">${t('nav.templates') || 'Plantillas'}</span>
          </div>
          <button type="button" class="component-button component-button--h32 component-button--icon-only rail-btn canvas-panel-card__close" data-ref="btn-close-canvas-panel" data-tooltip="Cerrar panel" aria-label="Cerrar panel">
            <svg class="component-icon rail-btn__icon" aria-hidden="true"><use href="/icons.svg#close"></use></svg>
          </button>
        </div>
        <div class="canvas-panel-card__body" data-ref="canvas-panel-body">
          <div class="canvas-panel-search" data-ref="canvas-panel-search">
            <svg class="component-icon canvas-panel-search__icon" aria-hidden="true"><use href="/icons.svg#search"></use></svg>
            <input class="canvas-panel-search__input" data-ref="canvas-templates-search-input" type="text" placeholder="${t('templates.search_placeholder') || 'Buscar plantillas...'}" />
          </div>
          <div class="canvas-panel-templates-grid" data-ref="canvas-templates-list"></div>
        </div>
      </div>
    `;

    const searchInput = drawerBody.querySelector<HTMLInputElement>('[data-ref="canvas-templates-search-input"]');
    const templatesList = drawerBody.querySelector<HTMLElement>('[data-ref="canvas-templates-list"]');
    const btnClose = drawerBody.querySelector<HTMLElement>('[data-ref="btn-close-canvas-panel"]');

    btnClose?.addEventListener('click', (e) => {
      e.preventDefault();
      toggleDrawer(false);
    });

    const renderList = (query = '') => {
      if (!templatesList) return;
      const cleanQ = query.trim().toLowerCase();
      const filtered = cleanQ
        ? presets.filter((p) => p.name.toLowerCase().includes(cleanQ) || p.categoryName?.toLowerCase().includes(cleanQ) || (p.tags && p.tags.some((tag) => tag.toLowerCase().includes(cleanQ))))
        : presets;

      if (filtered.length === 0) {
        templatesList.innerHTML = `
          <div class="canvas-panel-card__empty" data-ref="canvas-panel-empty">
            <span class="canvas-panel-card__empty-title">Sin resultados</span>
            <p class="canvas-panel-card__empty-desc">No encontramos plantillas que coincidan con «${escapeHtml(query)}»</p>
          </div>
        `;
        return;
      }

      templatesList.innerHTML = filtered.map((item) => `
        <div class="canvas-panel-template-card" data-ref="canvas-template-card-${item.id}" data-template-id="${item.id}">
          <div class="canvas-panel-template-card__thumb" data-ref="template-thumb-${item.id}">
            <img class="canvas-panel-template-card__img" data-ref="template-img-${item.id}" src="${item.imagePath}" alt="${escapeHtml(item.name)}" loading="lazy" />
          </div>
          <div class="canvas-panel-template-card__info" data-ref="template-info-${item.id}">
            <span class="canvas-panel-template-card__title" data-ref="template-title-${item.id}">${escapeHtml(item.name)}</span>
            <span class="canvas-panel-template-card__badge" data-ref="template-badge-${item.id}">${escapeHtml(item.categoryName || (canvasType === 'doc' ? 'Documento' : (canvasType === 'board' ? 'Pizarrón' : (canvasType === 'diagram' ? 'Diagrama' : `${item.width}×${item.height}`))))}</span>
          </div>
        </div>
      `).join('');

      templatesList.querySelectorAll<HTMLElement>('.canvas-panel-template-card').forEach((card) => {
        card.addEventListener('click', () => {
          const tmplId = card.getAttribute('data-template-id');
          const found = presets.find((p) => p.id === tmplId);
          if (found) {
            handleApplyCanvasTemplate(found, canvasType);
          }
        });
      });
    };

    searchInput?.addEventListener('input', () => {
      renderList(searchInput.value);
    });

    renderList();

    const drawerFooter = drawer.querySelector<HTMLElement>('[data-ref="drawer-footer"]');
    if (drawerFooter) {
      drawerFooter.style.display = 'none';
    }

    if (sidebar) {
      updateCanvasRailActiveState(sidebar);
    }

    renderIcons(drawerBody);
    return;
  }

  const tabMeta: Record<string, { desc: string; icon: string; title: string }> = {
    elements: {
      desc: 'Agrega figuras, iconos, gráficos y componentes a tu lienzo.',
      icon: 'category',
      title: t('nav.elements') || 'Elementos',
    },
    projects: {
      desc: 'Accede a tus proyectos, carpetas y otros diseños creados.',
      icon: 'folder',
      title: t('nav.projects') || 'Proyectos',
    },
    templates: {
      desc: 'Explora plantillas predeterminadas para iniciar rápidamente tus diseños.',
      icon: 'space_dashboard',
      title: t('nav.templates') || 'Plantillas',
    },
    uploads: {
      desc: 'Sube y administra imágenes, archivos multimedia y recursos para tu lienzo.',
      icon: 'cloud_upload',
      title: t('nav.uploads') || 'Subidos',
    },
  };

  const meta = tabMeta[tab] || tabMeta.templates;

  drawerBody.innerHTML = `
    <div class="canvas-panel-card" data-ref="canvas-panel-card">
      <div class="canvas-panel-card__header" data-ref="canvas-panel-header">
        <div class="canvas-panel-card__title-box" data-ref="canvas-panel-title-box">
          <svg class="component-icon canvas-panel-card__icon" aria-hidden="true"><use href="/icons.svg#${meta.icon}"></use></svg>
          <span class="canvas-panel-card__title" data-ref="canvas-panel-title">${escapeHtml(meta.title)}</span>
        </div>
        <button type="button" class="component-button component-button--h32 component-button--icon-only rail-btn canvas-panel-card__close" data-ref="btn-close-canvas-panel" data-tooltip="Cerrar panel" aria-label="Cerrar panel">
          <svg class="component-icon rail-btn__icon" aria-hidden="true"><use href="/icons.svg#close"></use></svg>
        </button>
      </div>
      <div class="canvas-panel-card__body" data-ref="canvas-panel-body">
        <div class="canvas-panel-card__empty" data-ref="canvas-panel-empty">
          <div class="canvas-panel-card__empty-icon" data-ref="canvas-panel-empty-icon">
            <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#${meta.icon}"></use></svg>
          </div>
          <span class="canvas-panel-card__empty-title" data-ref="canvas-panel-empty-title">${escapeHtml(meta.title)}</span>
          <p class="canvas-panel-card__empty-desc" data-ref="canvas-panel-empty-desc">${escapeHtml(meta.desc)}</p>
        </div>
      </div>
    </div>
  `;

  const btnClose = drawerBody.querySelector<HTMLElement>('[data-ref="btn-close-canvas-panel"]');
  btnClose?.addEventListener('click', (e) => {
    e.preventDefault();
    toggleDrawer(false);
  });

  const drawerFooter = drawer.querySelector<HTMLElement>('[data-ref="drawer-footer"]');
  if (drawerFooter) {
    drawerFooter.style.display = 'none';
  }

  if (sidebar) {
    updateCanvasRailActiveState(sidebar);
  }

  renderIcons(drawerBody);
}

async function populateDrawerContent(drawer: HTMLElement): Promise<void> {
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

  const isHome = currentPath === '/' || currentPath === '' || currentPath.startsWith('/folder/');

  if (isCanvasRoute(currentPath)) {
    renderCanvasDrawerContent(drawer, drawerBody);
    return;
  }

  if (currentPath.startsWith('/settings')) {
    if (currentUser) {
      drawerBody.innerHTML = `
        <div class="drawer-section__header" style="padding: 8px 8px 4px 8px;">
          <span class="drawer-section__title" style="font-size: 13px; font-weight: 600; color: var(--text-primary);" data-i18n="nav.settings">${t('nav.settings') || 'Configuración'}</span>
        </div>
        <button type="button" class="menu-item" data-ref="btn-nav-settings-account">
          <svg class="component-icon menu-item__icon" aria-hidden="true"><use href="/icons.svg#person"></use></svg>
          <span class="menu-item__text" data-i18n="nav.your_account">Tu cuenta</span>
        </button>
        <button type="button" class="menu-item" data-ref="btn-nav-settings-security">
          <svg class="component-icon menu-item__icon" aria-hidden="true"><use href="/icons.svg#lock"></use></svg>
          <span class="menu-item__text" data-i18n="nav.security">Seguridad</span>
        </button>
        <button type="button" class="menu-item" data-ref="btn-nav-settings-accessibility">
          <svg class="component-icon menu-item__icon" aria-hidden="true"><use href="/icons.svg#accessibility_new"></use></svg>
          <span class="menu-item__text" data-i18n="nav.accessibility">Accesibilidad</span>
        </button>
      `;
      translateElement(drawerBody);

      const btnAccount = drawerBody.querySelector<HTMLElement>('[data-ref="btn-nav-settings-account"]');
      const btnSecurity = drawerBody.querySelector<HTMLElement>('[data-ref="btn-nav-settings-security"]');
      const btnAccessibility = drawerBody.querySelector<HTMLElement>('[data-ref="btn-nav-settings-accessibility"]');

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
      drawerBody.innerHTML = `
        <button type="button" class="menu-item" data-ref="btn-nav-settings-guest">
          <svg class="component-icon menu-item__icon" aria-hidden="true"><use href="/icons.svg#tune"></use></svg>
          <span class="menu-item__text" data-i18n="nav.guest_settings">Configuración</span>
        </button>
      `;
      translateElement(drawerBody);
      const btnGuest = drawerBody.querySelector<HTMLElement>('[data-ref="btn-nav-settings-guest"]');
      btnGuest?.classList.add('is-active');
      bindNavLink(btnGuest, '/settings/guest');
    }
  } else if (currentPath.startsWith('/help')) {
    drawerBody.innerHTML = `
      <div class="drawer-section__header" style="padding: 8px 8px 4px 8px;">
        <span class="drawer-section__title" style="font-size: 13px; font-weight: 600; color: var(--text-primary);" data-i18n="nav.help">${t('nav.help') || 'Centro de ayuda'}</span>
      </div>
      <button type="button" class="menu-item" data-ref="btn-nav-help-terms">
        <svg class="component-icon menu-item__icon" aria-hidden="true"><use href="/icons.svg#gavel"></use></svg>
        <span class="menu-item__text" data-i18n="help_center.terms_title">Términos</span>
      </button>
      <button type="button" class="menu-item" data-ref="btn-nav-help-privacy">
        <svg class="component-icon menu-item__icon" aria-hidden="true"><use href="/icons.svg#shield"></use></svg>
        <span class="menu-item__text" data-i18n="help_center.privacy_title">Privacidad</span>
      </button>
      <button type="button" class="menu-item" data-ref="btn-nav-help-cookies">
        <svg class="component-icon menu-item__icon" aria-hidden="true"><use href="/icons.svg#cookie"></use></svg>
        <span class="menu-item__text" data-i18n="help_center.cookies_title">Cookies</span>
      </button>
      <button type="button" class="menu-item" data-ref="btn-nav-help-legal">
        <svg class="component-icon menu-item__icon" aria-hidden="true"><use href="/icons.svg#balance"></use></svg>
        <span class="menu-item__text" data-i18n="help_center.legal_title">Aviso legal</span>
      </button>
      <button type="button" class="menu-item" data-ref="btn-nav-help-billing">
        <svg class="component-icon menu-item__icon" aria-hidden="true"><use href="/icons.svg#payments"></use></svg>
        <span class="menu-item__text" data-i18n="help_center.billing_title">Facturación</span>
      </button>
      <button type="button" class="menu-item" data-ref="btn-nav-help-support">
        <svg class="component-icon menu-item__icon" aria-hidden="true"><use href="/icons.svg#help"></use></svg>
        <span class="menu-item__text" data-i18n="help_center.support_title">Soporte</span>
      </button>
    `;
    translateElement(drawerBody);

    const btnTerms = drawerBody.querySelector<HTMLElement>('[data-ref="btn-nav-help-terms"]');
    const btnPrivacy = drawerBody.querySelector<HTMLElement>('[data-ref="btn-nav-help-privacy"]');
    const btnCookies = drawerBody.querySelector<HTMLElement>('[data-ref="btn-nav-help-cookies"]');
    const btnLegal = drawerBody.querySelector<HTMLElement>('[data-ref="btn-nav-help-legal"]');
    const btnBilling = drawerBody.querySelector<HTMLElement>('[data-ref="btn-nav-help-billing"]');
    const btnSupport = drawerBody.querySelector<HTMLElement>('[data-ref="btn-nav-help-support"]');

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
  } else {
    await renderHomeDrawerContent(drawerBody);
  }
  updateDrawerFooter(drawer, currentPath);
  renderIcons(drawerBody);
}

function setupDrawerContent(sidebar: HTMLElement): void {
  const btnToggle = sidebar.querySelector<HTMLElement>('[data-ref="btn-toggle-drawer"]');
  btnToggle?.addEventListener('click', (e) => {
    e.preventDefault();
    toggleDrawer();
  });

  isDrawerOpen = false;
  btnToggle?.classList.remove('is-active');
  const existingDrawer = sidebar.querySelector<HTMLElement>('[data-ref="layout-drawer"]');
  existingDrawer?.remove();
}


function setupRailUserControls(sidebar: HTMLElement): void {
  const btnRailHelp = sidebar.querySelector<HTMLElement>('[data-ref="btn-rail-help"]');
  btnRailHelp?.addEventListener('click', (e) => {
    e.preventDefault();
    if (!currentUser) {
      navigate('/help/terms');
      return;
    }
    void toggleChatSidebar();
  });
  if (isChatOpen) {
    btnRailHelp?.classList.add('is-active');
  }

  const notificationsContainer = sidebar.querySelector<HTMLElement>('[data-ref="notifications-container"]');
  const btnNotifications = sidebar.querySelector<HTMLElement>('[data-ref="btn-notifications"]');
  const notificationsBadge = sidebar.querySelector<HTMLElement>('[data-ref="notifications-badge"]');
  const notificationsBackdrop = sidebar.querySelector<HTMLElement>('[data-ref="notifications-backdrop"]');
  const notificationsPanel = sidebar.querySelector<HTMLElement>('[data-ref="notifications-panel"]');
  const notificationsDragZone = sidebar.querySelector<HTMLElement>('[data-ref="notifications-drag-zone"]');
  const btnMarkAllRead = sidebar.querySelector<HTMLElement>('[data-ref="btn-mark-all-read"]');
  const notificationsList = sidebar.querySelector<HTMLElement>('[data-ref="notifications-list"]');
  const notificationsEmpty = sidebar.querySelector<HTMLElement>('[data-ref="notifications-empty"]');

  if (!currentUser) {
    if (notificationsContainer) notificationsContainer.style.display = 'none';
    if (btnNotifications) btnNotifications.style.display = 'none';
  }

  let closeAvatarMenu = () => {};
  let isNotificationsClosing = false;
  let currentUnreadCount = 0;

  const updateBadge = (count: number) => {
    currentUnreadCount = count;
    if (!notificationsBadge) return;
    if (count > 0) {
      notificationsBadge.textContent = count > 9 ? '9+' : String(count);
      notificationsBadge.classList.remove('is-hidden');
    } else {
      notificationsBadge.textContent = '';
      notificationsBadge.classList.add('is-hidden');
    }
  };

  const renderNotifications = (notifications: any[]) => {
    if (!notificationsList || !notificationsEmpty) return;

    if (!notifications || notifications.length === 0) {
      notificationsList.style.display = 'none';
      notificationsList.innerHTML = '';
      notificationsEmpty.style.display = 'flex';
      return;
    }

    notificationsEmpty.style.display = 'none';
    notificationsList.style.display = 'flex';
    notificationsList.innerHTML = '';

    notifications.forEach((notif) => {
      const item = document.createElement('div');
      item.className = `notification-item${notif.is_read ? '' : ' is-unread'}`;
      item.setAttribute('data-ref', `notification-item-${notif.id}`);

      let iconName = 'notifications';
      if (notif.type === 'canvas_invite') iconName = 'palette';
      else if (notif.type === 'team_invite') iconName = 'groups';

      const timeText = formatNotificationTime(notif.created_at);

      item.innerHTML = `
        <div class="notification-item__icon" data-ref="notification-icon-${notif.id}">
          <span class="material-symbols-rounded">${iconName}</span>
        </div>
        <div class="notification-item__content" data-ref="notification-content-${notif.id}">
          <span class="notification-item__title" data-ref="notification-title-${notif.id}">${escapeHtml(notif.title)}</span>
          <span class="notification-item__message" data-ref="notification-msg-${notif.id}">${escapeHtml(notif.message)}</span>
          ${timeText ? `<span class="notification-item__time" data-ref="notification-time-${notif.id}">${escapeHtml(timeText)}</span>` : ''}
        </div>
        <button type="button" class="notification-item__delete" data-ref="btn-delete-notif-${notif.id}" aria-label="Eliminar notificación">
          <span class="material-symbols-rounded" style="font-size: 18px;">close</span>
        </button>
      `;

      item.addEventListener('click', async (e) => {
        const target = e.target as HTMLElement | null;
        if (target?.closest('[data-ref^="btn-delete-notif-"]')) return;

        if (!notif.is_read) {
          notif.is_read = true;
          item.classList.remove('is-unread');
          updateBadge(Math.max(0, currentUnreadCount - 1));
          void patchApi(API_ROUTES.notifications.markRead(notif.id));
        }

        closeNotifications();

        if (notif.link_url) {
          navigate(notif.link_url);
        }
      });

      const btnDelete = item.querySelector<HTMLElement>('[data-ref^="btn-delete-notif-"]');
      btnDelete?.addEventListener('click', async (e) => {
        e.stopPropagation();
        item.remove();
        if (!notif.is_read) {
          updateBadge(Math.max(0, currentUnreadCount - 1));
        }
        if (notificationsList.children.length === 0) {
          notificationsList.style.display = 'none';
          notificationsEmpty.style.display = 'flex';
        }
        await deleteApi(API_ROUTES.notifications.delete(notif.id));
      });

      notificationsList.appendChild(item);
    });

    renderIcons(notificationsList);
  };

  const loadNotifications = async () => {
    if (!currentUser) {
      updateBadge(0);
      renderNotifications([]);
      return;
    }
    try {
      const res = await getApi(API_ROUTES.notifications.base);
      if (res.ok) {
        const data = await res.json();
        updateBadge(Number(data.unreadCount || 0));
        renderNotifications(data.notifications || []);
      }
    } catch {}
  };

  const openNotifications = () => {
    if (!currentUser) {
      navigate('/login');
      return;
    }
    if (isNotificationsClosing) return;
    closeAvatarMenu();
    closeAllDropdowns();
    if (notificationsPanel) {
      registerActiveDropdown({
        close: closeNotifications,
        wrapper: notificationsPanel,
      });
    }
    void loadNotifications();

    if (window.innerWidth <= 768 && notificationsBackdrop && notificationsPanel) {
      notificationsBackdrop.style.display = 'flex';
      notificationsBackdrop.style.opacity = '0';
      notificationsBackdrop.style.pointerEvents = 'auto';
      notificationsPanel.style.transform = 'translateY(100%)';
      notificationsPanel.style.transition = 'none';
      notificationsBackdrop.style.transition = 'none';

      void notificationsPanel.offsetHeight;

      notificationsBackdrop.classList.add('is-open');
      notificationsPanel.classList.add('is-open');

      notificationsBackdrop.style.transition = 'opacity 0.25s ease';
      notificationsPanel.style.transition = 'transform 0.28s cubic-bezier(0.16, 1, 0.3, 1)';
      notificationsBackdrop.style.opacity = '1';
      notificationsPanel.style.transform = 'translateY(0)';
    } else {
      notificationsBackdrop?.classList.add('is-open');
      notificationsPanel?.classList.add('is-open');
    }
  };

  const closeNotifications = () => {
    if (isNotificationsClosing || !notificationsPanel?.classList.contains('is-open')) return;
    if (notificationsPanel) {
      unregisterActiveDropdown(notificationsPanel);
    }

    if (window.innerWidth <= 768 && notificationsBackdrop && notificationsPanel) {
      isNotificationsClosing = true;
      notificationsBackdrop.style.pointerEvents = 'none';
      notificationsBackdrop.style.transition = 'opacity 0.2s ease';
      notificationsPanel.style.transition = 'transform 0.2s cubic-bezier(0.4, 0, 1, 1)';
      notificationsBackdrop.style.opacity = '0';
      notificationsPanel.style.transform = 'translateY(100%)';

      setTimeout(() => {
        notificationsBackdrop.classList.remove('is-open');
        notificationsPanel.classList.remove('is-open');
        notificationsBackdrop.style.display = '';
        notificationsBackdrop.style.opacity = '';
        notificationsBackdrop.style.transition = '';
        notificationsBackdrop.style.pointerEvents = '';
        notificationsPanel.style.transform = '';
        notificationsPanel.style.transition = '';
        isNotificationsClosing = false;
      }, 200);
    } else {
      notificationsBackdrop?.classList.remove('is-open');
      notificationsPanel?.classList.remove('is-open');
      if (notificationsBackdrop) {
        notificationsBackdrop.style.display = '';
        notificationsBackdrop.style.opacity = '';
        notificationsBackdrop.style.transition = '';
      }
      if (notificationsPanel) {
        notificationsPanel.style.transform = '';
        notificationsPanel.style.transition = '';
      }
    }
  };

  const toggleNotifications = () => {
    if (notificationsPanel?.classList.contains('is-open') && !isNotificationsClosing) {
      closeNotifications();
    } else {
      openNotifications();
    }
  };

  btnNotifications?.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleNotifications();
  });

  btnMarkAllRead?.addEventListener('click', async (e) => {
    e.preventDefault();
    if (currentUnreadCount === 0) return;
    try {
      const res = await postApi(API_ROUTES.notifications.markAllRead);
      if (res.ok) {
        updateBadge(0);
        const unreadItems = notificationsList?.querySelectorAll('.notification-item.is-unread');
        unreadItems?.forEach((el) => el.classList.remove('is-unread'));
        showToast(t('notifications.mark_all_read_success') || 'Todas las notificaciones marcadas como leídas.', 'success');
      }
    } catch {
      showToast(t('error.general_desc') || 'Error al actualizar notificaciones.', 'danger');
    }
  });

  notificationsBackdrop?.addEventListener('click', (e) => {
    if (!notificationsPanel?.contains(e.target as Node)) {
      closeNotifications();
    }
  });

  let notifStartY = 0;
  let notifCurrentY = 0;
  let notifStartTime = 0;
  let notifIsDragging = false;
  let notifActivePointerId: number | null = null;

  const detachNotifPointerListeners = () => {
    window.removeEventListener('pointermove', onNotifPointerMove);
    window.removeEventListener('pointerup', onNotifPointerUp);
    window.removeEventListener('pointercancel', onNotifPointerUp);
  };

  const onNotifPointerDown = (e: PointerEvent) => {
    if (window.innerWidth > 768 || isNotificationsClosing || !notificationsPanel) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;

    notifIsDragging = true;
    notifActivePointerId = e.pointerId;
    notifStartY = e.clientY;
    notifCurrentY = notifStartY;
    notifStartTime = performance.now();

    try {
      notificationsDragZone?.setPointerCapture(notifActivePointerId);
    } catch (_) {}

    notificationsPanel.style.transition = 'none';
    if (notificationsBackdrop) {
      notificationsBackdrop.style.transition = 'none';
    }

    window.addEventListener('pointermove', onNotifPointerMove, { passive: true });
    window.addEventListener('pointerup', onNotifPointerUp);
    window.addEventListener('pointercancel', onNotifPointerUp);
  };

  const onNotifPointerMove = (e: PointerEvent) => {
    if (!notifIsDragging || (notifActivePointerId !== null && e.pointerId !== notifActivePointerId)) return;
    notifCurrentY = e.clientY;
    const diff = notifCurrentY - notifStartY;

    if (notificationsPanel) {
      if (diff > 0) {
        notificationsPanel.style.transform = `translateY(${diff}px)`;
        if (notificationsBackdrop) {
          const progress = Math.min(diff / 240, 1);
          notificationsBackdrop.style.opacity = `${Math.max(0.2, 1 - progress * 0.8)}`;
        }
      } else {
        const rubberDiff = Math.max(diff * 0.15, -24);
        notificationsPanel.style.transform = `translateY(${rubberDiff}px)`;
      }
    }
  };

  const onNotifPointerUp = (e: PointerEvent) => {
    if (!notifIsDragging || (notifActivePointerId !== null && e.pointerId !== notifActivePointerId)) return;
    notifIsDragging = false;
    detachNotifPointerListeners();

    try {
      if (notifActivePointerId !== null) {
        notificationsDragZone?.releasePointerCapture(notifActivePointerId);
      }
    } catch (_) {}
    notifActivePointerId = null;

    const diff = notifCurrentY - notifStartY;
    const elapsed = Math.max(1, performance.now() - notifStartTime);
    const velocity = diff / elapsed;

    if (diff > 75 || (diff > 25 && velocity > 0.45)) {
      closeNotifications();
    } else {
      if (notificationsBackdrop) {
        notificationsBackdrop.style.transition = 'opacity 0.25s ease';
        notificationsBackdrop.style.opacity = '1';
      }
      if (notificationsPanel) {
        notificationsPanel.style.transition = 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)';
        notificationsPanel.style.transform = 'translateY(0)';
      }
    }
  };

  notificationsDragZone?.addEventListener('pointerdown', onNotifPointerDown);
  notificationsDragZone?.addEventListener('lostpointercapture', onNotifPointerUp);

  const closeNotificationsHandler = (e: MouseEvent) => {
    if (!notificationsPanel?.contains(e.target as Node) && !btnNotifications?.contains(e.target as Node)) {
      closeNotifications();
    }
  };
  document.addEventListener('click', closeNotificationsHandler);

  const closeNotificationsKeydownHandler = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && notificationsPanel?.classList.contains('is-open')) {
      closeNotifications();
    }
  };
  document.addEventListener('keydown', closeNotificationsKeydownHandler);

  const onNotifWindowResize = () => {
    if (notificationsPanel?.classList.contains('is-open') && window.innerWidth > 768) {
      if (notificationsBackdrop) {
        notificationsBackdrop.style.display = '';
        notificationsBackdrop.style.opacity = '';
        notificationsBackdrop.style.transition = '';
        notificationsBackdrop.style.pointerEvents = '';
      }
      if (notificationsPanel) {
        notificationsPanel.style.transform = '';
        notificationsPanel.style.transition = '';
      }
    }
  };
  window.addEventListener('resize', onNotifWindowResize, { passive: true });

  const avatarContainer = sidebar.querySelector<HTMLElement>('[data-ref="avatar-container"]');
  const btnLogin = sidebar.querySelector<HTMLElement>('[data-ref="btn-rail-login"], [data-ref="btn-login"]');

  if (currentUser) {
    if (avatarContainer) {
      avatarContainer.style.display = 'inline-flex';

      const avatarImg = avatarContainer.querySelector<HTMLImageElement>('[data-ref="avatar-img"]');
      const avatarBtn = avatarContainer.querySelector<HTMLElement>('[data-ref="btn-avatar"]');
      const avatarBackdrop = avatarContainer.querySelector<HTMLElement>('[data-ref="avatar-menu-backdrop"]');
      const avatarMenu = avatarContainer.querySelector<HTMLElement>('[data-ref="avatar-menu"]');
      const dragZone = avatarContainer.querySelector<HTMLElement>('[data-ref="avatar-menu-drag-zone"]');
      const btnLogout = avatarContainer.querySelector<HTMLElement>('[data-ref="btn-logout"]');

      const panelMain = avatarContainer.querySelector<HTMLElement>('[data-ref="panel-main-options"]');
      const panelSwitcher = avatarContainer.querySelector<HTMLElement>('[data-ref="panel-account-switcher"]');
      const btnSwitchAccountMenu = avatarContainer.querySelector<HTMLElement>('[data-ref="btn-switch-account-menu"]');
      const btnBackToMainMenu = avatarContainer.querySelector<HTMLElement>('[data-ref="btn-back-to-main-menu"]');
      const btnAddAccount = avatarContainer.querySelector<HTMLElement>('[data-ref="btn-add-account"]');
      const btnLogoutAll = avatarContainer.querySelector<HTMLElement>('[data-ref="btn-logout-all"]');
      const accountSwitcherList = avatarContainer.querySelector<HTMLElement>('[data-ref="account-switcher-list"]');

      const activeAvatar = avatarContainer.querySelector<HTMLImageElement>('[data-ref="active-account-avatar"]');
      const activeAvatarBox = avatarContainer.querySelector<HTMLElement>('[data-ref="active-account-avatar-box"]');
      const activeName = avatarContainer.querySelector<HTMLElement>('[data-ref="active-account-name"]');
      const activeEmail = avatarContainer.querySelector<HTMLElement>('[data-ref="active-account-email"]');

      const userTier = currentUser.subscription_tier || 'free';
      const updateTopBarTier = (tier: string) => {
        const tVal = tier || (currentUser ? currentUser.subscription_tier : 'free') || 'free';
        const color = currentUser?.subscription_tier_color;
        if (avatarBtn) {
          applyAvatarTier(avatarBtn, tVal, color);
        }
        if (activeAvatarBox) {
          applyAvatarTier(activeAvatarBox, tVal, color);
        }
      };
      updateTopBarTier(userTier);

      const groupMenuTeams = avatarContainer.querySelector<HTMLElement>('[data-ref="group-menu-teams"]');
      const menuTeamsBadge = avatarContainer.querySelector<HTMLElement>('[data-ref="menu-teams-badge"]');
      const updateTeamsVisibility = () => {
        if (groupMenuTeams) {
          groupMenuTeams.style.display = 'block';
        }
        if (menuTeamsBadge) {
          const hasTeamsAccess = hasFeature('teams', currentUser);
          menuTeamsBadge.classList.toggle('is-hidden', hasTeamsAccess);
        }
      };
      updateTeamsVisibility();

      const handleSubscriptionUpdated = (e: any) => {
        const tier = e.detail?.subscription_tier || currentUser?.subscription_tier || 'free';
        updateTopBarTier(tier);
        updateTeamsVisibility();
        renderAccountList();
      };
      window.addEventListener('subscription-updated', handleSubscriptionUpdated);

      const avatarUrl =
        currentUser.avatar_url ||
        API_ROUTES.avatar(currentUser.username);

      if (avatarImg) {
        avatarImg.classList.add('image-lazy-fade');
        avatarImg.classList.remove('image-loaded');
        avatarImg.src = avatarUrl;
        avatarImg.alt = escapeHtml(currentUser.username);
        avatarImg.onload = () => {
          avatarImg.classList.add('image-loaded');
        };
        avatarImg.onerror = () => {
          avatarImg.onerror = null;
          avatarImg.src = API_ROUTES.avatar(currentUser?.username || '');
          avatarImg.classList.add('image-loaded');
        };
        if (avatarImg.complete && avatarImg.naturalWidth > 0) {
          avatarImg.classList.add('image-loaded');
        }
      }

      if (activeAvatar) {
        activeAvatar.classList.add('image-lazy-fade');
        activeAvatar.classList.remove('image-loaded');
        activeAvatar.src = avatarUrl;
        activeAvatar.alt = escapeHtml(currentUser.username);
        activeAvatar.onload = () => {
          activeAvatar.classList.add('image-loaded');
        };
        activeAvatar.onerror = () => {
          activeAvatar.onerror = null;
          activeAvatar.src = API_ROUTES.avatar(currentUser?.username || '');
          activeAvatar.classList.add('image-loaded');
        };
        if (activeAvatar.complete && activeAvatar.naturalWidth > 0) {
          activeAvatar.classList.add('image-loaded');
        }
      }

      if (activeName) {
        activeName.textContent = currentUser.username;
      }

      if (activeEmail) {
        activeEmail.textContent = currentUser.email || '';
      }

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

        const accounts =
          Array.isArray(linkedAccounts) && linkedAccounts.length > 0
            ? linkedAccounts
            : currentUser ? [currentUser] : [];

        accounts.forEach((acc) => {
          const isActive = acc.id === currentUser?.id;
          const item = document.createElement('button');
          item.type = 'button';
          item.className = 'menu-item menu-item--bordered account-item';
          item.setAttribute('data-ref', `account-item-${acc.id}`);

          const accTier = acc.subscription_tier || 'free';
          const accAvatarUrl =
            acc.avatar_url || API_ROUTES.avatar(acc.username);

          item.innerHTML = `
            <div class="account-item__avatar" data-ref="account-avatar-${acc.id}" data-tier="${accTier}" style="--avatar-tier-bg: ${acc.subscription_tier_color || getFallbackTierColor(accTier)};">
              <img class="avatar-img image-lazy-fade" data-ref="avatar-img-${acc.id}" src="${accAvatarUrl}" alt="${escapeHtml(acc.username)}" referrerpolicy="no-referrer" onload="this.classList.add('image-loaded')" onerror="this.classList.add('image-loaded')" />
            </div>
            <div class="account-item__info" data-ref="account-info-${acc.id}">
              <span class="account-item__name" data-ref="account-name-${acc.id}">${escapeHtml(acc.username)}</span>
              <span class="account-item__email" data-ref="account-email-${acc.id}">${escapeHtml(acc.email || '')}</span>
            </div>
            ${isActive ? createIconSvg('check_circle', 'account-item__check') : ''}
          `;

          const imgEl = item.querySelector<HTMLImageElement>('img');
          if (imgEl) {
            imgEl.onerror = () => {
              imgEl.onerror = null;
              imgEl.src = API_ROUTES.avatar(acc.username);
              imgEl.classList.add('image-loaded');
            };
            if (imgEl.complete && imgEl.naturalWidth > 0) {
              imgEl.classList.add('image-loaded');
            }
          }

          if (!isActive) {
            item.addEventListener('click', async (e) => {
              e.preventDefault();
              closeMenu();
              const res = await switchAccountApi(acc.id);
              if (res.success) {
                closeWebSocket();
                initWebSocket();
                showToast(
                  t('toasts.account_switched') || 'Has cambiado de cuenta exitosamente.',
                  'success'
                );
                cleanupAndRender();
              } else {
                showToast(res.error || t('toasts.generic_error'), 'error');
              }
            });
          }

          accountSwitcherList.appendChild(item);
        });

        renderIcons(accountSwitcherList);

        if (btnAddAccount) {
          btnAddAccount.style.display = accounts.length >= 5 ? 'none' : 'flex';
        }
      };

      let isClosing = false;

      const openMenu = () => {
        if (isClosing) return;
        closeNotifications();
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
      closeAvatarMenu = closeMenu;

      const toggleMenu = () => {
        if (avatarMenu?.classList.contains('is-open') && !isClosing) {
          closeMenu();
        } else {
          openMenu();
        }
      };

      if (avatarBtn) {
        avatarBtn.setAttribute('data-tooltip', currentUser.username || t('nav.profile'));
        avatarBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          toggleMenu();
        });
      }

      btnSwitchAccountMenu?.addEventListener('click', (e) => {
        e.preventDefault();
        showPanel('switcher');
      });

      btnBackToMainMenu?.addEventListener('click', (e) => {
        e.preventDefault();
        showPanel('main');
      });

      btnAddAccount?.addEventListener('click', (e) => {
        e.preventDefault();
        closeMenu();
        navigate('/login?action=add-account');
      });

      avatarBackdrop?.addEventListener('click', (e) => {
        if (!avatarMenu?.contains(e.target as Node)) {
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
        } catch (_) {}

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
        } catch (_) {}
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
        if (!avatarMenu?.contains(e.target as Node) && !avatarBtn?.contains(e.target as Node)) {
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

      const onWindowResize = () => {
        if (avatarMenu?.classList.contains('is-open') && window.innerWidth > 768) {
          if (avatarBackdrop) {
            avatarBackdrop.style.display = '';
            avatarBackdrop.style.opacity = '';
            avatarBackdrop.style.transition = '';
            avatarBackdrop.style.pointerEvents = '';
          }
          if (avatarMenu) {
            avatarMenu.style.transform = '';
            avatarMenu.style.transition = '';
          }
        }
      };
      window.addEventListener('resize', onWindowResize, { passive: true });

      const cleanupAndRender = () => {
        detachAvatarPointerListeners();
        detachNotifPointerListeners();
        dragZone?.removeEventListener('pointerdown', onPointerDown);
        dragZone?.removeEventListener('lostpointercapture', onPointerUp);
        notificationsDragZone?.removeEventListener('pointerdown', onNotifPointerDown);
        notificationsDragZone?.removeEventListener('lostpointercapture', onNotifPointerUp);
        document.removeEventListener('click', closeMenuHandler);
        document.removeEventListener('click', closeNotificationsHandler);
        document.removeEventListener('keydown', closeMenuKeydownHandler);
        document.removeEventListener('keydown', closeNotificationsKeydownHandler);
        window.removeEventListener('resize', onWindowResize);
        window.removeEventListener('resize', onNotifWindowResize);
        window.removeEventListener('subscription-updated', handleSubscriptionUpdated);
        render();
      };

      const btnTeams = avatarContainer.querySelector<HTMLElement>('[data-ref="btn-menu-teams"]');
      btnTeams?.addEventListener('click', (e) => {
        e.preventDefault();
        closeMenu();
        if (!hasFeature('teams', currentUser)) {
          openUpgradeModal('business');
          return;
        }
        navigate('/teams');
      });

      const btnSettings = avatarContainer.querySelector<HTMLElement>('[data-ref="btn-menu-settings"]');
      btnSettings?.addEventListener('click', (e) => {
        e.preventDefault();
        closeMenu();
        navigate(currentUser ? '/settings/your-account' : '/settings/guest');
      });

      const btnHelp = avatarContainer.querySelector<HTMLElement>('[data-ref="btn-menu-help"]');
      btnHelp?.addEventListener('click', (e) => {
        e.preventDefault();
        closeMenu();
        navigate('/help/terms');
      });

      const btnPlans = avatarContainer.querySelector<HTMLElement>('[data-ref="btn-menu-plans"]');
      btnPlans?.addEventListener('click', (e) => {
        e.preventDefault();
        closeMenu();
        navigate('/upgrade');
      });

      const btnPurchases = avatarContainer.querySelector<HTMLElement>('[data-ref="btn-menu-purchases"]');
      btnPurchases?.addEventListener('click', (e) => {
        e.preventDefault();
        closeMenu();
        navigate('/settings/purchases');
      });

      btnLogout?.addEventListener('click', async (e) => {
        e.preventDefault();
        closeMenu();
        const res = await logoutApi();
        if (res.success) {
          if (res.switched) {
            closeWebSocket();
            initWebSocket();
            showToast(t('toasts.account_switched') || 'Has cambiado de cuenta.', 'info');
          } else {
            closeWebSocket();
          }
          cleanupAndRender();
        }
      });

      btnLogoutAll?.addEventListener('click', async (e) => {
        e.preventDefault();
        closeMenu();
        closeWebSocket();
        await logoutAllApi();
        showToast(
          t('toasts.all_sessions_closed') || 'Se han cerrado todas las sesiones activas.',
          'info'
        );
        navigate('/login');
      });
    }
  } else {
    if (btnLogin) {
      btnLogin.style.display = 'inline-flex';
      btnLogin.addEventListener('click', (e) => {
        e.preventDefault();
        navigate('/login');
      });
    }
  }

  if (currentUser) {
    void loadNotifications();
    const notifInterval = setInterval(() => {
      if (document.body.contains(sidebar)) {
        void loadNotifications();
      } else {
        clearInterval(notifInterval);
      }
    }, 35000);
  }
}

export async function createSidebar(): Promise<HTMLElement> {
  document.querySelector('[data-ref="btn-help-chat"]')?.remove();
  const sidebar = await loadTemplate('/views/components/sidebar.html');
  translateElement(sidebar);

  setupRailNavigation(sidebar);
  setupDrawerContent(sidebar);
  setupRailUserControls(sidebar);
  updateSidebarActiveState(sidebar, window.location.pathname);

  renderIcons(sidebar);
  return sidebar;
}

function setupChatSidebarEvents(sidebarElement: HTMLElement): void {
  const conversationHistory: Array<{ role: string; text: string }> = [];
  let activeTicket: any = null;
  let currentViewingTicketId: number | null = null;
  let currentView: 'chat' | 'history-list' | 'ticket-detail' = 'chat';
  let isAwaitingSupportReason = false;
  const renderedMessageIds = new Set<number>();
  const renderedDetailMessageIds = new Set<number>();

  const btnClose = sidebarElement.querySelector<HTMLElement>('[data-ref="btn-chat-close"]');
  const btnHistory = sidebarElement.querySelector<HTMLElement>('[data-ref="btn-chat-history"]');
  const btnBack = sidebarElement.querySelector<HTMLElement>('[data-ref="btn-chat-back"]');
  const panelTitle = sidebarElement.querySelector<HTMLElement>('[data-ref="chat-panel-title"]');

  const chatMessages = sidebarElement.querySelector<HTMLElement>('[data-ref="chat-messages"]');
  const historyContainer = sidebarElement.querySelector<HTMLElement>('[data-ref="chat-history-container"]');
  const historyList = sidebarElement.querySelector<HTMLElement>('[data-ref="chat-history-list"]');
  const historyEmpty = sidebarElement.querySelector<HTMLElement>('[data-ref="chat-history-empty-state"]');

  const ticketDetail = sidebarElement.querySelector<HTMLElement>('[data-ref="chat-ticket-detail"]');
  const ticketDetailTitle = sidebarElement.querySelector<HTMLElement>('[data-ref="chat-ticket-detail-title"]');
  const ticketDetailBadge = sidebarElement.querySelector<HTMLElement>('[data-ref="chat-ticket-detail-badge"]');
  const ticketDetailMessages = sidebarElement.querySelector<HTMLElement>('[data-ref="chat-ticket-messages"]');
  const ticketClosedNotice = sidebarElement.querySelector<HTMLElement>('[data-ref="chat-ticket-closed-notice"]');
  const btnHistoryBackToList = sidebarElement.querySelector<HTMLElement>('[data-ref="btn-history-back-to-list"]');
  const btnTicketNewChat = sidebarElement.querySelector<HTMLElement>('[data-ref="btn-ticket-new-chat"]');

  const chatInput = sidebarElement.querySelector<HTMLTextAreaElement>('[data-ref="chat-input"]');
  const chatInputBox = sidebarElement.querySelector<HTMLElement>('[data-ref="chat-input-box"]');
  const btnSend = sidebarElement.querySelector<HTMLButtonElement>('[data-ref="btn-chat-send"]');
  const chatBottom = sidebarElement.querySelector<HTMLElement>('[data-ref="chat-panel-bottom"]');
  const chatDisclaimer = sidebarElement.querySelector<HTMLElement>('[data-ref="chat-disclaimer"]');

  const bannerEl = sidebarElement.querySelector<HTMLElement>('[data-ref="chat-support-banner"]');
  const ticketNumEl = sidebarElement.querySelector<HTMLElement>('[data-ref="chat-support-ticket-num"]');
  const statusPillEl = sidebarElement.querySelector<HTMLElement>('[data-ref="chat-support-status-pill"]');
  const waitTimeEl = sidebarElement.querySelector<HTMLElement>('[data-ref="chat-support-wait-time"]');
  const btnCancelSupport = sidebarElement.querySelector<HTMLButtonElement>('[data-ref="btn-chat-cancel-support"]');

  const AGENT_AVATAR_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none">
    <defs>
      <linearGradient id="sb-bright-c" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#FFFFFF"/>
        <stop offset="50%" stop-color="#E2E8F0"/>
        <stop offset="100%" stop-color="#94A3B8"/>
      </linearGradient>
      <linearGradient id="sb-subtle-c" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#CBD5E1"/>
        <stop offset="100%" stop-color="#64748B"/>
      </linearGradient>
    </defs>
    <rect width="32" height="32" rx="8" fill="#161619"/>
    <rect x="0.5" y="0.5" width="31" height="31" rx="7.5" stroke="rgba(255,255,255,0.15)"/>
    <rect x="7" y="7" width="8" height="8" rx="2.5" fill="url(#sb-bright-c)"/>
    <rect x="17" y="7" width="8" height="8" rx="2.5" fill="url(#sb-subtle-c)"/>
    <rect x="7" y="17" width="8" height="8" rx="2.5" fill="url(#sb-subtle-c)"/>
    <rect x="17" y="17" width="8" height="8" rx="2.5" fill="url(#sb-bright-c)"/>
  </svg>`;

  function updateChatEmptyState(): void {
    const emptyState = sidebarElement.querySelector<HTMLElement>('[data-ref="chat-empty-state"]');
    const messages = sidebarElement.querySelectorAll('[data-ref="chat-messages"] .chat-message');
    const chatPanel = sidebarElement.querySelector<HTMLElement>('[data-ref="chat-panel"]');
    const hasMessages = messages.length > 0;
    const isChatView = currentView === 'chat';
    const isEmpty = isChatView && !hasMessages && !activeTicket;

    if (emptyState) {
      emptyState.style.display = isEmpty ? 'flex' : 'none';
    }

    if (chatPanel) {
      if (isEmpty) {
        chatPanel.classList.add('is-empty');
      } else {
        chatPanel.classList.remove('is-empty');
      }
    }
  }

  function formatChatDate(dateValue?: string | Date | null): string {
    if (!dateValue) return '';
    const d = new Date(dateValue);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) {
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return d.toLocaleDateString([], { day: 'numeric', month: 'short' });
  }

  function getStatusMeta(status: string): { badgeClass: string; label: string } {
    switch (status) {
      case 'queued':
        return { badgeClass: 'component-badge--warning', label: t('chat.status_queued') || 'En cola' };
      case 'in_progress':
        return { badgeClass: 'component-badge--success', label: t('chat.status_in_progress') || 'En atención' };
      case 'escalated':
        return { badgeClass: 'component-badge--info', label: t('chat.status_escalated') || 'Escalado' };
      case 'resolved':
        return { badgeClass: 'component-badge--success', label: t('chat.status_resolved') || 'Resuelto' };
      case 'closed':
      default:
        return { badgeClass: 'component-badge--neutral', label: t('chat.status_closed') || 'Cerrado' };
    }
  }

  function switchView(view: 'chat' | 'history-list' | 'ticket-detail'): void {
    currentView = view;

    if (view === 'chat') {
      currentViewingTicketId = null;
      if (btnHistory) btnHistory.style.display = 'inline-flex';
      if (btnBack) btnBack.style.display = 'none';
      if (panelTitle) panelTitle.style.display = 'none';

      if (chatMessages) chatMessages.style.display = 'flex';
      if (historyContainer) historyContainer.style.display = 'none';
      if (ticketDetail) ticketDetail.style.display = 'none';

      if (chatBottom) chatBottom.style.display = 'block';
      if (chatDisclaimer) chatDisclaimer.style.display = 'block';

      if (activeTicket) {
        renderSupportBanner(activeTicket);
      } else {
        hideSupportBanner();
      }
      updateChatEmptyState();
    } else if (view === 'history-list') {
      currentViewingTicketId = null;
      if (btnHistory) btnHistory.style.display = 'none';
      if (btnBack) btnBack.style.display = 'inline-flex';
      if (panelTitle) {
        panelTitle.style.display = 'block';
        panelTitle.textContent = t('chat.history_title') || 'Historial de Soporte';
      }

      if (chatMessages) chatMessages.style.display = 'none';
      if (historyContainer) historyContainer.style.display = 'flex';
      if (ticketDetail) ticketDetail.style.display = 'none';
      hideSupportBanner();

      if (chatBottom) chatBottom.style.display = 'none';
      updateChatEmptyState();
      void loadSupportHistory();
    } else if (view === 'ticket-detail') {
      if (btnHistory) btnHistory.style.display = 'none';
      if (btnBack) btnBack.style.display = 'inline-flex';
      if (panelTitle) {
        panelTitle.style.display = 'block';
        panelTitle.textContent = t('chat.history_title') || 'Historial de Soporte';
      }

      if (chatMessages) chatMessages.style.display = 'none';
      if (historyContainer) historyContainer.style.display = 'none';
      if (ticketDetail) ticketDetail.style.display = 'flex';
      hideSupportBanner();
      updateChatEmptyState();
    }
  }

  async function loadSupportHistory(): Promise<void> {
    if (!currentUser) {
      if (historyEmpty) historyEmpty.style.display = 'flex';
      if (historyList) historyList.style.display = 'none';
      return;
    }

    if (historyList) {
      historyList.innerHTML = '<div style="padding: 16px; text-align: center; color: var(--text-tertiary); font-size: 12px;">Cargando historial...</div>';
      historyList.style.display = 'flex';
    }
    if (historyEmpty) historyEmpty.style.display = 'none';

    try {
      const res = await getApi(API_ROUTES.support.history);
      if (res.ok) {
        const data = await res.json();
        const conversations = Array.isArray(data.conversations) ? data.conversations : [];

        if (historyList) historyList.innerHTML = '';

        if (conversations.length === 0) {
          if (historyEmpty) historyEmpty.style.display = 'flex';
          if (historyList) historyList.style.display = 'none';
          return;
        }

        if (historyEmpty) historyEmpty.style.display = 'none';
        if (historyList) historyList.style.display = 'flex';

        for (const conv of conversations) {
          const card = document.createElement('div');
          card.className = 'chat-history-card';
          card.setAttribute('data-ref', 'chat-history-card');

          const tId = Number(conv.ticket_id || conv.id);
          const meta = getStatusMeta(conv.status);

          const topRow = document.createElement('div');
          topRow.className = 'chat-history-card__top';

          const numSpan = document.createElement('span');
          numSpan.className = 'chat-history-card__num';
          numSpan.textContent = `#${conv.ticket_number || tId}`;

          const dateSpan = document.createElement('span');
          dateSpan.className = 'chat-history-card__date';
          dateSpan.textContent = formatChatDate(conv.created_at);

          topRow.appendChild(numSpan);
          topRow.appendChild(dateSpan);

          const subjSpan = document.createElement('div');
          subjSpan.className = 'chat-history-card__subject';
          subjSpan.textContent = conv.subject || 'Consulta de soporte';

          const prevSpan = document.createElement('div');
          prevSpan.className = 'chat-history-card__preview';
          prevSpan.textContent = conv.last_message || conv.description || 'Sin mensajes';

          const btmRow = document.createElement('div');
          btmRow.className = 'chat-history-card__bottom';

          const badge = document.createElement('div');
          badge.className = `component-badge ${meta.badgeClass}`;
          badge.style.fontSize = '10px';
          badge.style.padding = '1px 6px';
          badge.textContent = meta.label;
          btmRow.appendChild(badge);

          if (conv.assigned_agent_name) {
            const agentSpan = document.createElement('span');
            agentSpan.className = 'chat-history-card__agent';
            agentSpan.innerHTML = `${createIconSvg('support_agent', 'chat-card-agent-icon')} <span>${escapeHtml(conv.assigned_agent_name)}</span>`;
            btmRow.appendChild(agentSpan);
          }

          card.appendChild(topRow);
          card.appendChild(subjSpan);
          card.appendChild(prevSpan);
          card.appendChild(btmRow);

          card.addEventListener('click', (e) => {
            e.preventDefault();
            void openTicketDetail(tId);
          });

          historyList?.appendChild(card);
        }
      } else {
        if (historyList) historyList.innerHTML = '<div style="padding: 16px; text-align: center; color: var(--text-tertiary); font-size: 12px;">No se pudo cargar el historial.</div>';
      }
    } catch (_) {
      if (historyList) historyList.innerHTML = '<div style="padding: 16px; text-align: center; color: var(--text-tertiary); font-size: 12px;">Error de conexión.</div>';
    }
  }

  async function openTicketDetail(ticketId: number): Promise<void> {
    currentViewingTicketId = ticketId;
    renderedDetailMessageIds.clear();
    switchView('ticket-detail');

    if (ticketDetailTitle) {
      ticketDetailTitle.textContent = `Ticket #${ticketId}`;
    }
    if (ticketDetailBadge) {
      ticketDetailBadge.className = 'component-badge component-badge--neutral';
      ticketDetailBadge.textContent = '...';
    }
    if (ticketDetailMessages) {
      ticketDetailMessages.innerHTML = '<div style="padding: 16px; text-align: center; color: var(--text-tertiary); font-size: 12px;">Cargando mensajes...</div>';
    }
    if (ticketClosedNotice) ticketClosedNotice.style.display = 'none';

    try {
      const res = await getApi(API_ROUTES.support.historyTicket(ticketId));
      if (res.ok) {
        const data = await res.json();
        const ticket = data.ticket;
        const messages = Array.isArray(data.messages) ? data.messages : [];

        if (ticketDetailTitle && ticket) {
          ticketDetailTitle.textContent = `#${ticket.ticket_number || ticket.ticket_id || ticketId}`;
        }
        if (ticketDetailBadge && ticket) {
          const meta = getStatusMeta(ticket.status);
          ticketDetailBadge.className = `component-badge ${meta.badgeClass}`;
          ticketDetailBadge.textContent = meta.label;
        }

        if (ticketDetailMessages) ticketDetailMessages.innerHTML = '';

        for (const msg of messages) {
          renderTicketDetailMessage(msg);
        }

        const isLive = ticket && (ticket.status === 'queued' || ticket.status === 'in_progress' || ticket.status === 'escalated');
        if (isLive) {
          activeTicket = ticket;
          if (chatBottom) chatBottom.style.display = 'block';
          if (chatDisclaimer) chatDisclaimer.style.display = 'none';
          if (ticketClosedNotice) ticketClosedNotice.style.display = 'none';
        } else {
          if (chatBottom) chatBottom.style.display = 'none';
          if (ticketClosedNotice) ticketClosedNotice.style.display = 'flex';
        }

        const scrollArea = sidebarElement.querySelector<HTMLElement>('[data-ref="chat-panel-center"]');
        if (scrollArea) scrollArea.scrollTop = scrollArea.scrollHeight;
      } else {
        if (ticketDetailMessages) ticketDetailMessages.innerHTML = '<div style="padding: 16px; text-align: center; color: var(--text-tertiary); font-size: 12px;">No se pudo cargar la conversación.</div>';
      }
    } catch (_) {
      if (ticketDetailMessages) ticketDetailMessages.innerHTML = '<div style="padding: 16px; text-align: center; color: var(--text-tertiary); font-size: 12px;">Error al conectar con el servidor.</div>';
    }
  }

  function renderTicketDetailMessage(msg: any): void {
    if (!ticketDetailMessages) return;
    const msgId = Number(msg.id);
    if (msgId && renderedDetailMessageIds.has(msgId)) return;
    if (msgId) renderedDetailMessageIds.add(msgId);

    const type = msg.sender_type || 'user';
    const text = msg.message || '';

    if (type === 'agent') {
      const wrapper = document.createElement('div');
      wrapper.className = 'chat-message chat-message--agent';
      wrapper.setAttribute('data-ref', 'chat-message-agent');
      wrapper.appendChild(createSupportAgentBadge(msg.sender_name || 'Agente de Soporte', msg.sender_avatar || null));

      const bubble = document.createElement('div');
      bubble.className = 'chat-agent-bubble';
      bubble.textContent = text;
      wrapper.appendChild(bubble);

      ticketDetailMessages.appendChild(wrapper);
    } else if (type === 'system') {
      const wrapper = document.createElement('div');
      wrapper.className = 'chat-message chat-message--system';
      wrapper.setAttribute('data-ref', 'chat-message-system');
      wrapper.style.alignSelf = 'center';
      wrapper.style.fontSize = '11px';
      wrapper.style.color = 'var(--text-tertiary)';
      wrapper.style.padding = '4px 12px';
      wrapper.style.borderRadius = '12px';
      wrapper.style.background = 'var(--bg-hover)';
      wrapper.style.margin = '4px 0';
      wrapper.textContent = text;
      ticketDetailMessages.appendChild(wrapper);
    } else {
      const wrapper = document.createElement('div');
      wrapper.className = 'chat-message chat-message--user';
      wrapper.setAttribute('data-ref', 'chat-message-user');
      wrapper.textContent = text;
      ticketDetailMessages.appendChild(wrapper);
    }
  }

  function createAgentBadge(thinking = false): HTMLElement {
    const badge = document.createElement('div');
    badge.className = 'chat-agent-badge';

    const icon = document.createElement('span');
    icon.className = `chat-agent-badge__icon${thinking ? ' chat-agent-badge__icon--thinking' : ''}`;
    icon.innerHTML = AGENT_AVATAR_SVG;

    const label = document.createElement('span');
    label.textContent = 'Spritebot';

    badge.appendChild(icon);
    badge.appendChild(label);
    return badge;
  }

  function createSupportAgentBadge(name?: string, avatarUrl?: string | null): HTMLElement {
    const badge = document.createElement('div');
    badge.className = 'chat-agent-badge';

    const iconWrap = document.createElement('span');
    iconWrap.className = 'chat-agent-badge__icon';
    iconWrap.style.display = 'inline-flex';
    iconWrap.style.alignItems = 'center';
    iconWrap.style.justifyContent = 'center';

    if (avatarUrl) {
      const img = document.createElement('img');
      img.src = avatarUrl;
      img.alt = name || 'Soporte';
      img.style.width = '100%';
      img.style.height = '100%';
      img.style.borderRadius = '4px';
      img.style.objectFit = 'cover';
      iconWrap.appendChild(img);
    } else {
      iconWrap.innerHTML = `<svg class="component-icon" style="width: 14px; height: 14px; color: var(--action-primary);" aria-hidden="true"><use href="/icons.svg#support_agent"></use></svg>`;
    }

    const label = document.createElement('span');
    label.textContent = name ? `${name} (${t('chat.agent_support') || 'Soporte'})` : (t('chat.agent_support') || 'Soporte Técnico');

    badge.appendChild(iconWrap);
    badge.appendChild(label);
    return badge;
  }

  function appendSystemNotice(text: string): HTMLElement {
    const messagesContainer = sidebarElement.querySelector<HTMLElement>('[data-ref="chat-messages"]');
    const emptyState = sidebarElement.querySelector<HTMLElement>('[data-ref="chat-empty-state"]');
    if (emptyState) emptyState.style.display = 'none';

    const wrapper = document.createElement('div');
    wrapper.className = 'chat-message chat-message--system';
    wrapper.setAttribute('data-ref', 'chat-message-system');
    wrapper.style.alignSelf = 'center';
    wrapper.style.fontSize = '11px';
    wrapper.style.color = 'var(--text-tertiary)';
    wrapper.style.padding = '4px 12px';
    wrapper.style.borderRadius = '12px';
    wrapper.style.background = 'var(--bg-hover)';
    wrapper.style.margin = '4px 0';
    wrapper.textContent = text;

    messagesContainer?.appendChild(wrapper);
    updateChatEmptyState();
    const scrollArea = sidebarElement.querySelector<HTMLElement>('[data-ref="chat-panel-center"]');
    if (scrollArea) scrollArea.scrollTop = scrollArea.scrollHeight;
    return wrapper;
  }

  function appendMessage(
    type: string,
    text: string,
    options?: { agentName?: string; avatarUrl?: string | null; isHumanAgent?: boolean }
  ): HTMLElement {
    const messagesContainer = sidebarElement.querySelector<HTMLElement>('[data-ref="chat-messages"]');
    const emptyState = sidebarElement.querySelector<HTMLElement>('[data-ref="chat-empty-state"]');
    if (emptyState) emptyState.style.display = 'none';

    const wrapper = document.createElement('div');
    wrapper.className = `chat-message chat-message--${type}`;
    wrapper.setAttribute('data-ref', `chat-message-${type}`);

    if (type === 'agent') {
      if (options?.isHumanAgent) {
        wrapper.appendChild(createSupportAgentBadge(options.agentName, options.avatarUrl));
      } else {
        wrapper.appendChild(createAgentBadge(false));
      }

      const bubble = document.createElement('div');
      bubble.className = 'chat-agent-bubble';
      bubble.textContent = text;
      wrapper.appendChild(bubble);

      const actions = document.createElement('div');
      actions.className = 'chat-agent-actions';
      actions.setAttribute('data-ref', 'chat-agent-actions');

      const btnLike = document.createElement('button');
      btnLike.type = 'button';
      btnLike.className = 'component-button component-button--icon-only chat-feedback-btn chat-feedback-btn--like';
      btnLike.setAttribute('data-ref', 'btn-chat-like');
      btnLike.setAttribute('data-tooltip', 'Buena respuesta');
      btnLike.setAttribute('aria-label', 'Buena respuesta');
      btnLike.innerHTML = createIconSvg('thumb_up');

      const btnDislike = document.createElement('button');
      btnDislike.type = 'button';
      btnDislike.className = 'component-button component-button--icon-only chat-feedback-btn chat-feedback-btn--dislike';
      btnDislike.setAttribute('data-ref', 'btn-chat-dislike');
      btnDislike.setAttribute('data-tooltip', 'Mala respuesta');
      btnDislike.setAttribute('aria-label', 'Mala respuesta');
      btnDislike.innerHTML = createIconSvg('thumb_down');

      const btnCopy = document.createElement('button');
      btnCopy.type = 'button';
      btnCopy.className = 'component-button component-button--icon-only chat-feedback-btn chat-feedback-btn--copy';
      btnCopy.setAttribute('data-ref', 'btn-chat-copy');
      btnCopy.setAttribute('data-tooltip', 'Copiar respuesta');
      btnCopy.setAttribute('aria-label', 'Copiar respuesta');
      btnCopy.innerHTML = createIconSvg('content_copy');

      btnLike.addEventListener('click', () => {
        const isLiked = btnLike.classList.toggle('is-active');
        if (isLiked) {
          btnDislike.classList.remove('is-active');
          showToast('¡Gracias por tus comentarios!', 'success');
          postApi(API_ROUTES.chatFeedback, {
            message: text,
            rating: 'like',
          }).catch(() => {});
        }
      });

      btnDislike.addEventListener('click', () => {
        const isDisliked = btnDislike.classList.toggle('is-active');
        if (isDisliked) {
          btnLike.classList.remove('is-active');
          showToast('Gracias, trabajaremos para mejorar las respuestas.', 'info');
          postApi(API_ROUTES.chatFeedback, {
            message: text,
            rating: 'dislike',
          }).catch(() => {});
        }
      });

      btnCopy.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(text);
          btnCopy.classList.add('is-copied');
          showToast('Copiado al portapapeles', 'info');
          setTimeout(() => btnCopy.classList.remove('is-copied'), 1500);
        } catch (_) {}
      });

      actions.appendChild(btnLike);
      actions.appendChild(btnDislike);
      actions.appendChild(btnCopy);
      wrapper.appendChild(actions);
    } else {
      wrapper.textContent = text;
    }

    messagesContainer?.appendChild(wrapper);
    updateChatEmptyState();

    const scrollArea = sidebarElement.querySelector<HTMLElement>('[data-ref="chat-panel-center"]');
    if (scrollArea) scrollArea.scrollTop = scrollArea.scrollHeight;

    return wrapper;
  }


  function appendTypingIndicator(): HTMLElement {
    const messagesContainer = sidebarElement.querySelector<HTMLElement>('[data-ref="chat-messages"]');

    const wrapper = document.createElement('div');
    wrapper.className = 'chat-message chat-message--agent chat-message--typing';
    wrapper.setAttribute('data-ref', 'chat-typing-indicator');

    wrapper.appendChild(createAgentBadge(true));

    const dots = document.createElement('div');
    dots.className = 'chat-typing-dots';
    dots.appendChild(document.createElement('span'));
    dots.appendChild(document.createElement('span'));
    dots.appendChild(document.createElement('span'));
    wrapper.appendChild(dots);

    messagesContainer?.appendChild(wrapper);

    const scrollArea = sidebarElement.querySelector<HTMLElement>('[data-ref="chat-panel-center"]');
    if (scrollArea) scrollArea.scrollTop = scrollArea.scrollHeight;

    return wrapper;
  }

  const renderSupportBanner = (ticket: any) => {
    if (!bannerEl || currentView !== 'chat') return;
    bannerEl.style.display = 'flex';
    if (ticketNumEl) {
      ticketNumEl.textContent = `Ticket #${ticket.ticket_number || ticket.id || ticket.ticket_id}`;
    }
    if (statusPillEl) {
      const meta = getStatusMeta(ticket.status);
      statusPillEl.textContent = meta.label;
      statusPillEl.className = `component-badge ${meta.badgeClass}`;
    }
    if (waitTimeEl) {
      if (ticket.status === 'queued') {
        waitTimeEl.textContent = 'Buscando agente disponible...';
      } else if (ticket.status === 'in_progress' || ticket.status === 'escalated') {
        waitTimeEl.textContent = ticket.assigned_agent_name ? `Agente: ${ticket.assigned_agent_name}` : 'Agente asignado';
      }
    }
  };

  const hideSupportBanner = () => {
    if (bannerEl) bannerEl.style.display = 'none';
  };

  const renderSupportMessage = (msg: any) => {
    if (currentView === 'ticket-detail' && currentViewingTicketId) {
      renderTicketDetailMessage(msg);
      return;
    }

    if (renderedMessageIds.has(msg.id)) return;
    renderedMessageIds.add(msg.id);

    if (msg.sender_type === 'agent') {
      appendMessage('agent', msg.message, {
        agentName: msg.sender_name || 'Agente de Soporte',
        avatarUrl: msg.sender_avatar || null,
        isHumanAgent: true,
      });
    } else if (msg.sender_type === 'system') {
      appendSystemNotice(msg.message);
    } else if (msg.sender_type === 'user') {
      appendMessage('user', msg.message);
    }
  };

  registerWebSocketHandler('SUPPORT_MESSAGE_RECEIVED', (data: any) => {
    if (!data) return;
    if (currentView === 'ticket-detail' && currentViewingTicketId && Number(data.ticketId) === currentViewingTicketId && data.message) {
      renderTicketDetailMessage(data.message);
      return;
    }
    if (!activeTicket) return;
    if (Number(data.ticketId) === Number(activeTicket.id || activeTicket.ticket_id) && data.message) {
      renderSupportMessage(data.message);
    }
  });

  function openSupportRatingModal(ticketId: number, agentName?: string | null): void {
    let selectedRating = 5;
    const ratingLabels = [
      'Muy mala',
      'Mala',
      'Regular',
      'Buena',
      'Excelente',
    ];

    const promptText = agentName
      ? `¿Cómo calificarías la atención brindada por @${escapeHtml(agentName)}?`
      : '¿Cómo calificarías la atención recibida por parte de nuestro equipo de soporte técnico?';

    const modal = openModal({
      bodyHtml: `
        <div class="support-rating-modal" data-ref="modal-support-rating" style="display: flex; flex-direction: column; gap: 16px; padding: 4px 0;">
          <p style="margin: 0; font-size: 13px; color: var(--text-secondary); line-height: 1.5; text-align: center;">
            ${promptText}
          </p>

          <div style="display: flex; flex-direction: column; align-items: center; gap: 8px;">
            <div class="support-rating-stars" data-ref="rating-stars-container" style="display: flex; gap: 6px; justify-content: center;">
              ${[1, 2, 3, 4, 5].map((star) => `
                <button type="button" class="component-button component-button--icon-only" data-ref="btn-star-${star}" data-star="${star}" style="width: 36px; height: 36px; border: none; background: transparent; cursor: pointer; padding: 0; display: flex; align-items: center; justify-content: center; transition: transform 0.15s ease;" aria-label="${star} estrellas">
                  <svg class="component-icon" style="width: 28px; height: 28px; color: #f59e0b;" aria-hidden="true">
                    <use href="/icons.svg#star_fill"></use>
                  </svg>
                </button>
              `).join('')}
            </div>
            <span class="support-rating-label" data-ref="rating-text-label" style="font-size: 12px; font-weight: 600; color: #f59e0b;">Excelente</span>
          </div>

          <label class="field" data-ref="field-rating-comment">
            <textarea class="field__textarea" data-ref="input-rating-comment" placeholder=" " maxlength="1000" rows="3" style="min-height: 80px; resize: vertical;"></textarea>
            <span class="field__label">Comentarios o sugerencias sobre el servicio (opcional)</span>
          </label>
        </div>
      `,
      cancelText: 'Omitir',
      confirmClass: 'component-button--black',
      confirmText: 'Enviar calificación',
      description: 'Tus comentarios nos ayudan a mejorar la calidad de nuestro servicio.',
      onConfirm: async () => {
        const commentInput = modal.body.querySelector<HTMLTextAreaElement>('[data-ref="input-rating-comment"]');
        const comment = (commentInput?.value || '').trim();

        modal.setConfirmLoading?.(true, 'Enviando...');
        try {
          const res = await postApi(API_ROUTES.support.rate, {
            comment: comment || undefined,
            rating: selectedRating,
            ticketId,
          });
          modal.setConfirmLoading?.(false);

          if (res.ok) {
            showToast('¡Gracias por tus comentarios!', 'success');
            modal.close();
          } else {
            const errData = await res.json().catch(() => ({}));
            modal.setError(errData.error || 'No se pudo registrar la calificación.');
          }
        } catch {
          modal.setConfirmLoading?.(false);
          modal.setError('Error de conexión al enviar la calificación.');
        }
      },
      title: 'Calificar atención de soporte',
    });

    const starsContainer = modal.body.querySelector<HTMLElement>('[data-ref="rating-stars-container"]');
    const labelEl = modal.body.querySelector<HTMLElement>('[data-ref="rating-text-label"]');
    const starButtons = modal.body.querySelectorAll<HTMLButtonElement>('[data-star]');

    const updateStarVisuals = (hoverVal?: number) => {
      const val = hoverVal !== undefined ? hoverVal : selectedRating;
      starButtons.forEach((btn) => {
        const starNum = parseInt(btn.getAttribute('data-star') || '1', 10);
        const svg = btn.querySelector('svg');
        const use = btn.querySelector('use');
        const isFilled = starNum <= val;

        if (svg) {
          svg.style.color = isFilled ? '#f59e0b' : 'var(--text-tertiary)';
        }
        if (use) {
          use.setAttribute('href', isFilled ? '/icons.svg#star_fill' : '/icons.svg#star');
        }
        btn.style.transform = isFilled ? 'scale(1.1)' : 'scale(1)';
      });

      if (labelEl) {
        labelEl.textContent = ratingLabels[val - 1] || `${val} estrellas`;
      }
    };

    starButtons.forEach((btn) => {
      const starNum = parseInt(btn.getAttribute('data-star') || '1', 10);
      btn.addEventListener('mouseenter', () => {
        updateStarVisuals(starNum);
      });

      btn.addEventListener('click', (e) => {
        e.preventDefault();
        selectedRating = starNum;
        updateStarVisuals();
      });
    });

    starsContainer?.addEventListener('mouseleave', () => {
      updateStarVisuals();
    });

    updateStarVisuals();
    renderIcons(modal.body);
  }

  registerWebSocketHandler('SUPPORT_TICKET_UPDATED', (data: any) => {
    if (!data || !data.ticket) return;

    if (currentView === 'ticket-detail' && currentViewingTicketId && Number(data.ticket.id || data.ticket.ticket_id) === currentViewingTicketId) {
      const meta = getStatusMeta(data.ticket.status);
      if (ticketDetailBadge) {
        ticketDetailBadge.className = `component-badge ${meta.badgeClass}`;
        ticketDetailBadge.textContent = meta.label;
      }
      if (data.ticket.status === 'resolved' || data.ticket.status === 'closed') {
        if (chatBottom) chatBottom.style.display = 'none';
        if (ticketClosedNotice) ticketClosedNotice.style.display = 'flex';
      }
    }

    if (!activeTicket) return;
    if (Number(data.ticket.id || data.ticket.ticket_id) === Number(activeTicket.id || activeTicket.ticket_id)) {
      const prevStatus = activeTicket.status;
      const finishedTicketId = Number(activeTicket.id || activeTicket.ticket_id);
      const assignedAgent = activeTicket.assigned_agent_name;
      activeTicket = data.ticket;

      if (activeTicket.status === 'resolved' || activeTicket.status === 'closed' || activeTicket.status === 'cancelled') {
        hideSupportBanner();
        appendSystemNotice('La sesión de soporte técnico ha finalizado.');
        activeTicket = null;
        openSupportRatingModal(finishedTicketId, assignedAgent);
        return;
      }

      renderSupportBanner(activeTicket);

      if (prevStatus === 'queued' && (activeTicket.status === 'in_progress' || activeTicket.status === 'escalated')) {
        appendSystemNotice(
          activeTicket.assigned_agent_name
            ? `El agente @${activeTicket.assigned_agent_name} se ha conectado a la conversación.`
            : 'Un agente de soporte se ha conectado.'
        );
      }
    }
  });

  const checkActiveSupportTicket = async () => {
    if (!currentUser) return;
    try {
      const res = await getApi(API_ROUTES.support.active);
      if (res.ok) {
        const data = await res.json();
        if (data.active && data.ticket) {
          activeTicket = data.ticket;
          renderSupportBanner(activeTicket);
          if (Array.isArray(data.messages) && data.messages.length > 0) {
            for (const msg of data.messages) {
              renderSupportMessage(msg);
            }
          }
        } else {
          hideSupportBanner();
        }
      }
    } catch (_) {}
  };

  btnCancelSupport?.addEventListener('click', async (e) => {
    e.preventDefault();
    if (!activeTicket) return;
    try {
      const targetId = activeTicket.id || activeTicket.ticket_id;
      const agentName = activeTicket.assigned_agent_name;
      const res = await postApi(API_ROUTES.support.cancel, { ticketId: targetId });
      if (res.ok) {
        hideSupportBanner();
        appendSystemNotice('Has finalizado la sesión de soporte técnico.');
        appendMessage('agent', '¿Hay algo más en lo que pueda ayudarte hoy?');
        activeTicket = null;
        showToast('Sesión de soporte finalizada', 'info');
        openSupportRatingModal(targetId, agentName);
      } else {
        showToast('No se pudo cancelar la solicitud de soporte.', 'error');
      }
    } catch (_) {
      showToast('Error al procesar la cancelación.', 'error');
    }
  });

  btnClose?.addEventListener('click', (e) => {
    e.preventDefault();
    toggleChatSidebar(false);
  });

  btnHistory?.addEventListener('click', (e) => {
    e.preventDefault();
    switchView('history-list');
  });

  btnBack?.addEventListener('click', (e) => {
    e.preventDefault();
    if (currentView === 'ticket-detail') {
      switchView('history-list');
    } else {
      switchView('chat');
    }
  });

  btnHistoryBackToList?.addEventListener('click', (e) => {
    e.preventDefault();
    switchView('history-list');
  });

  btnTicketNewChat?.addEventListener('click', (e) => {
    e.preventDefault();
    switchView('chat');
    chatInput?.focus();
  });

  let isProcessing = false;

  function setLoading(loading: boolean): void {
    isProcessing = loading;
    if (btnSend) btnSend.disabled = loading;
  }

  function autoResizeTextarea(): void {
    if (!chatInput) return;
    const text = chatInput.value;

    if (!text || text.trim().length === 0) {
      chatInputBox?.classList.remove('is-multiline');
      chatInput.style.height = '';
      return;
    }

    const scrollArea = sidebarElement.querySelector<HTMLElement>('[data-ref="chat-panel-center"]');

    if (text.includes('\n')) {
      chatInputBox?.classList.add('is-multiline');
      chatInput.style.height = 'auto';
      const nextH = Math.min(Math.max(chatInput.scrollHeight, 24), 120);
      chatInput.style.height = `${nextH}px`;
      if (scrollArea) scrollArea.scrollTop = scrollArea.scrollHeight;
      return;
    }

    const wasMultiline = chatInputBox?.classList.contains('is-multiline');
    if (wasMultiline) {
      chatInputBox?.classList.remove('is-multiline');
    }
    chatInput.style.height = 'auto';
    const singleRowScrollH = chatInput.scrollHeight;

    if (singleRowScrollH > 24) {
      chatInputBox?.classList.add('is-multiline');
      chatInput.style.height = 'auto';
      const nextH = Math.min(Math.max(chatInput.scrollHeight, 24), 120);
      chatInput.style.height = `${nextH}px`;
      if (scrollArea) scrollArea.scrollTop = scrollArea.scrollHeight;
    } else {
      chatInputBox?.classList.remove('is-multiline');
      chatInput.style.height = '';
    }
  }

  const sendMessage = async () => {
    if (!currentUser) {
      showToast(t('auth.login_required') || 'Inicia sesión para enviar mensajes al asistente.', 'warning');
      navigate('/login');
      return;
    }
    if (isProcessing) return;
    const text = chatInput?.value?.trim();
    if (!text) return;

    if (chatInput) {
      chatInput.value = '';
      autoResizeTextarea();
    }

    if (currentView === 'ticket-detail' && currentViewingTicketId) {
      renderTicketDetailMessage({
        created_at: new Date().toISOString(),
        id: Date.now(),
        message: text,
        sender_type: 'user',
        ticket_id: currentViewingTicketId,
      });

      setLoading(true);
      try {
        const res = await postApi(API_ROUTES.support.message, {
          message: text,
          ticketId: currentViewingTicketId,
        });
        if (res.ok) {
          const data = await res.json().catch(() => ({}));
          if (data && data.message && data.message.id) {
            renderedDetailMessageIds.add(data.message.id);
          }
        } else {
          showToast('No se pudo enviar el mensaje a soporte. Intenta de nuevo.', 'error');
        }
      } catch (_) {
        showToast('Error al enviar el mensaje. Verifica tu conexión.', 'error');
      } finally {
        setLoading(false);
        chatInput?.focus();
      }
      return;
    }

    appendMessage('user', text);

    if (activeTicket) {
      setLoading(true);
      try {
        const targetId = activeTicket.id || activeTicket.ticket_id;
        const res = await postApi(API_ROUTES.support.message, {
          message: text,
          ticketId: targetId,
        });
        if (res.ok) {
          const data = await res.json().catch(() => ({}));
          if (data && data.message && data.message.id) {
            renderedMessageIds.add(data.message.id);
          }
        } else {
          showToast('No se pudo enviar el mensaje a soporte. Intenta de nuevo.', 'error');
        }
      } catch (_) {
        showToast('Error al enviar el mensaje. Verifica tu conexión.', 'error');
      } finally {
        setLoading(false);
        chatInput?.focus();
      }
      return;
    }

    if (isAwaitingSupportReason) {
      isAwaitingSupportReason = false;
      setLoading(true);
      const typingIndicator = appendTypingIndicator();
      try {
        const res = await postApi(API_ROUTES.support.request, {
          description: text,
          priority: 'medium',
          subject: text.slice(0, 80),
        });
        typingIndicator.remove();
        if (res.ok) {
          const data = await res.json();
          if (data.ticket) {
            activeTicket = data.ticket;
            renderSupportBanner(activeTicket);
            appendMessage('agent', `Hemos registrado tu solicitud con el Ticket #${activeTicket.ticket_number || activeTicket.id}. Te hemos añadido a la lista de espera de soporte técnico; un agente se comunicará contigo en breve.`);
          }
        } else {
          appendMessage('agent', 'No se pudo crear la solicitud de soporte en este momento. Por favor intenta más tarde.');
        }
      } catch (_) {
        typingIndicator.remove();
        appendMessage('agent', 'Error al conectar con el servidor de soporte. Por favor intenta de nuevo.');
      } finally {
        setLoading(false);
        chatInput?.focus();
      }
      return;
    }

    conversationHistory.push({ role: 'user', text });
    setLoading(true);
    const typingIndicator = appendTypingIndicator();

    try {
      const res = await postApi(API_ROUTES.chat, {
        history: conversationHistory.slice(-10),
        message: text,
      });

      typingIndicator.remove();

      if (res.ok) {
        const data = await res.json();
        const reply = data.reply || 'No pude generar una respuesta. Por favor intenta de nuevo.';
        appendMessage('agent', reply);
        conversationHistory.push({ role: 'model', text: reply });

        if (data.isSupportHandover) {
          isAwaitingSupportReason = true;
        }
      } else {
        appendMessage(
          'agent',
          'Lo siento, ocurrió un problema al procesar tu mensaje. Por favor intenta de nuevo.'
        );
      }
    } catch (_err) {
      typingIndicator.remove();
      appendMessage(
        'agent',
        'No se pudo conectar con el asistente. Verifica tu conexión e intenta más tarde.'
      );
    } finally {
      setLoading(false);
      chatInput?.focus();
    }
  };

  btnSend?.addEventListener('click', (e) => {
    e.preventDefault();
    if (!isProcessing) {
      sendMessage();
    }
  });

  chatInput?.addEventListener('input', () => {
    autoResizeTextarea();
  });

  chatInput?.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!isProcessing) {
        sendMessage();
      }
    }
  });

  void checkActiveSupportTicket();
}

export async function initChatSidebar(): Promise<HTMLElement> {
  if (chatSidebarElement) return chatSidebarElement;
  if (chatSidebarInitPromise) return chatSidebarInitPromise;

  chatSidebarInitPromise = (async () => {
    const el = await loadTemplate('/views/components/chat-sidebar.html');
    translateElement(el);
    setupChatSidebarEvents(el);

    const chatPanel = el.querySelector<HTMLElement>('[data-ref="chat-panel"]');
    chatPanel?.classList.add('is-empty');

    chatSidebarElement = el;
    return el;
  })();

  return chatSidebarInitPromise;
}
