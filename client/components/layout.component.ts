import { navigate, render } from '../app-router.js';
import { API_ROUTES } from '../config/api-routes.js';
import { APP_CATEGORIES, SPRITEBOARD_APPS, getAppById, getAppsByCategory, searchApps } from '../config/apps.config.js';
import { BOARD_3D_SHAPES } from '../config/board-3d-shapes.config.js';
import { DIAGRAM_COMPONENTS, DiagramComponentItem } from '../config/diagram-components.data.js';
import { ALL_MOCKUP_ITEMS, FRAME_CATEGORIES, FRAME_TEMPLATES, GRID_CATEGORIES, GRID_TEMPLATES, MOCKUP_GENERAL_CATEGORIES, MOCKUP_TEMPLATES } from '../config/mockups.config.js';
import { hasFeature, protectRoute } from '../config/plans.config.js';
import { STICKY_NOTE_PRESETS } from '../config/sticky-notes.config.js';
import { ALL_PRESETS, PresetItem } from '../config/templates.config.js';
import { currentUser, deleteApi, deleteUploadApi, escapeHtml, getApi, getUploadsApi, linkedAccounts, logoutAllApi, logoutApi, patchApi, postApi, switchAccountApi, uploadFilesApi } from '../services/api.service.js';
import { getBrandKitDetailApi, getBrandKitsApi } from '../services/brand.service.js';
import { getAllLocalCanvases, getLocalCanvasByUuid } from '../services/canvas-storage.service.js';
import { GoogleDriveFile, connectGoogleDrive, disconnectGoogleDrive, fetchGoogleDriveFileBlob, formatFileSize, getGoogleDriveUser, isGoogleDriveConnected, listGoogleDriveFiles, openGooglePicker, uploadCanvasExportToDrive } from '../services/google-drive.service.js';
import { MAP_PRESET_LOCATIONS, MapStyleOption, MapTypeOption, buildStaticMapUrl, fetchMapImageBlob, getGoogleMapsExternalUrl } from '../services/google-maps.service.js';
import { GooglePhotoAlbum, GooglePhotoItem, connectGooglePhotos, disconnectGooglePhotos, fetchPhotoBlob, getGooglePhotosUser, isGooglePhotosConnected, listGooglePhotos, listGooglePhotosAlbums, openGooglePhotosPicker } from '../services/google-photos.service.js';
import { t, translateElement } from '../services/i18n.service.js';
import { createIconSvg, renderIcons } from '../services/icon.service.js';
import { loadTemplate } from '../services/template.service.js';
import { showToast } from '../services/toast.service.js';
import { closeWebSocket, initWebSocket, registerWebSocketHandler } from '../services/websocket.service.js';
import { openYouTubePlayerModal, searchYouTubeVideos } from '../services/youtube.service.js';
import { AppCategory, SpriteboardApp } from '../types/apps.types.js';
import { canPublishTemplates, isUserAdmin } from '../types/auth.types.js';
import { BrandKit, BrandKitAsset, BrandKitDetail } from '../types/brand.types.js';
import { CanvasItem } from '../types/canvas.types.js';
import { FrameCategory, GridCategory, MockupGeneralCategory, MockupTemplate } from '../types/mockups.types.js';
import { UserStorageUsage } from '../types/subscription.types.js';
import { UserUploadItem } from '../types/upload.types.js';
import { closeAllDropdowns, registerActiveDropdown, setupDropdown, unregisterActiveDropdown } from '../utils/dom.util.js';
import { PIXEL_SHAPES, PixelShape, ShapeCategory } from '../utils/pixel-shapes.util.js';
import { applyAvatarTier, getFallbackTierColor } from '../utils/tier.util.js';
import { validateAndSanitizeFiles } from '../utils/validators.util.js';
import { CHART_CATALOG } from '../views/board/board-charts-panel.component.js';
import { BoardChartElement, BoardProject, ChartType, Shape3DType, ShapeType } from '../views/board/board.types.js';
import { DOC_TEMPLATES, getDocTemplateById } from '../views/doc/doc-templates.config.js';
import { DocPage, DocProject } from '../views/doc/doc.types.js';
import { openCreateCanvasModal } from './create-canvas-modal.component.js';
import { openInsertPixelGridModal } from './insert-pixel-grid-modal.component.js';
import { openModal } from './modal.component.js';
import { openUpgradeModal } from './upgrade-modal.component.js';

let isDrawerOpen = false;
let isChatOpen = false;
let activeCanvasTab: 'templates' | 'brand' | 'elements' | 'text' | 'tools' | 'uploads' | 'apps' | 'projects' | 'charts' | 'mockups' | 'colors' | 'fonts' | 'pixel-anim' | 'effects' | 'animate' | 'position' | null = null;
let activeAppId: string | null = null;
let activeAppCategory: AppCategory = 'all';
let activeChartInDrawer: BoardChartElement | null = null;
let activeColorTargetInDrawer: 'stroke' | 'fill' | 'text' | 'slide-bg' = 'stroke';
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
        <button type="button" class="menu-item${currentPath === '/settings/billing' ? ' is-active' : ''}" data-ref="btn-nav-settings-billing" data-tooltip="${t('nav.billing') || 'Facturación'}" aria-label="${t('nav.billing') || 'Facturación'}">
          <svg class="component-icon menu-item__icon" aria-hidden="true"><use href="/icons.svg#credit_card"></use></svg>
          <span class="menu-item__text" data-i18n="nav.billing">${t('nav.billing') || 'Facturación'}</span>
        </button>
        <button type="button" class="menu-item${currentPath === '/settings/purchases' ? ' is-active' : ''}" data-ref="btn-nav-settings-purchases" data-tooltip="${t('nav.purchases') || 'Compras'}" aria-label="${t('nav.purchases') || 'Compras'}">
          <svg class="component-icon menu-item__icon" aria-hidden="true"><use href="/icons.svg#receipt_long"></use></svg>
          <span class="menu-item__text" data-i18n="nav.purchases">${t('nav.purchases') || 'Compras'}</span>
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
    pathname === '/design' ||
    pathname.startsWith('/design/') ||
    pathname === '/board' ||
    pathname.startsWith('/board/') ||
    pathname === '/doc' ||
    pathname.startsWith('/doc/') ||
    pathname === '/presentation' ||
    pathname.startsWith('/presentation/')
  );
}

export function updateCanvasRailActiveState(sidebar: HTMLElement): void {
  const tabs = ['templates', 'brand', 'elements', 'text', 'tools', 'uploads', 'apps', 'projects'] as const;
  tabs.forEach((tabKey) => {
    const item = sidebar.querySelector<HTMLElement>(`[data-ref="rail-item-canvas-${tabKey}"]`);
    const btn = sidebar.querySelector<HTMLElement>(`[data-ref="btn-rail-canvas-${tabKey}"]`);
    const isActive = tabKey === 'tools'
      ? activeCanvasTab === 'tools'
      : tabKey === 'elements'
      ? isDrawerOpen && (activeCanvasTab === 'elements' || activeCanvasTab === 'charts' || activeCanvasTab === 'mockups')
      : tabKey === 'text'
      ? isDrawerOpen && (activeCanvasTab === 'text' || activeCanvasTab === 'fonts')
      : isDrawerOpen && activeCanvasTab === tabKey;
    item?.classList.toggle('is-active', isActive);
    btn?.classList.toggle('is-active', isActive);
  });
}

export function updateSidebarActiveState(sidebar: HTMLElement, path = window.location.pathname): void {
  const isCanvas = isCanvasRoute(path);
  sidebar.classList.toggle('is-canvas-mode', isCanvas);

  if (!isCanvas) {
    activeCanvasTab = null;
    updateCanvasRailActiveState(sidebar);
  } else {
    updateCanvasRailActiveState(sidebar);
  }

  const isHome = path === '/' || path === '' || path.startsWith('/folder/');
  const isTemplates = path === '/templates';
  const isDesigner = path === '/designer' || path.startsWith('/designer');
  const isBrand = path === '/brand' || path === '/marca';
  const isShared = path === '/shared';
  const isTeams = path === '/teams';
  const isMore = path === '/your-apps' || path === '/apply-designer' || path === '/designer/apply' || isDesigner;

  const updateItem = (itemRef: string, btnRef: string, isActive: boolean) => {
    const item = sidebar.querySelector<HTMLElement>(`[data-ref="${itemRef}"]`);
    const btn = sidebar.querySelector<HTMLElement>(`[data-ref="${btnRef}"]`);
    item?.classList.toggle('is-active', isActive);
    btn?.classList.toggle('is-active', isActive);
  };

  updateItem('rail-item-home', 'btn-rail-home', isHome);
  updateItem('rail-item-templates', 'btn-rail-templates', isTemplates);
  updateItem('rail-item-brand', 'btn-rail-brand', isBrand);
  updateItem('rail-item-shared', 'btn-rail-shared', isShared);
  updateItem('rail-item-teams', 'btn-rail-teams', isTeams);
  updateItem('rail-item-more', 'btn-rail-more', isMore);

  const isDesignerUser = canPublishTemplates(currentUser);
  const btnMoreApplyText = sidebar.querySelector<HTMLElement>('[data-ref="btn-more-apply-designer-text"]');
  if (btnMoreApplyText) {
    btnMoreApplyText.textContent = isDesignerUser
      ? (t('nav.designer') || 'Diseñador')
      : (t('nav.creator_program') || 'Programa de diseñadores');
  }

  const btnMoreApps = sidebar.querySelector<HTMLElement>('[data-ref="btn-more-apps"]');
  const btnMoreApply = sidebar.querySelector<HTMLElement>('[data-ref="btn-more-apply-designer"]');
  btnMoreApps?.classList.toggle('is-active', path === '/your-apps');
  btnMoreApply?.classList.toggle('is-active', isDesigner || path === '/apply-designer' || path === '/designer/apply');

  const itemBrand = sidebar.querySelector<HTMLElement>('[data-ref="rail-item-brand"]');
  const itemShared = sidebar.querySelector<HTMLElement>('[data-ref="rail-item-shared"]');
  const itemTeams = sidebar.querySelector<HTMLElement>('[data-ref="rail-item-teams"]');
  const notificationsContainer = sidebar.querySelector<HTMLElement>('[data-ref="notifications-container"]');
  const btnNotifications = sidebar.querySelector<HTMLElement>('[data-ref="btn-notifications"]');
  const btnSettings = sidebar.querySelector<HTMLElement>('[data-ref="btn-rail-settings"]');

  if (!currentUser) {
    if (itemBrand) itemBrand.style.display = 'none';
    if (itemShared) itemShared.style.display = 'none';
    if (itemTeams) itemTeams.style.display = 'none';
    if (notificationsContainer) notificationsContainer.style.display = 'none';
    if (btnNotifications) btnNotifications.style.display = 'none';
    if (btnSettings) {
      btnSettings.style.display = 'inline-flex';
      btnSettings.classList.toggle('is-active', path.startsWith('/settings'));
    }
  } else {
    if (itemBrand) itemBrand.style.display = '';
    if (itemShared) itemShared.style.display = '';
    if (itemTeams) itemTeams.style.display = '';
    if (notificationsContainer) notificationsContainer.style.display = '';
    if (btnNotifications) btnNotifications.style.display = '';
    if (btnSettings) {
      btnSettings.style.display = 'none';
      btnSettings.classList.remove('is-active');
    }
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
  bindNav('rail-item-brand', 'btn-rail-brand', '/brand', currentPath === '/brand' || currentPath === '/marca');
  bindNav('rail-item-shared', 'btn-rail-shared', '/shared', currentPath === '/shared');
  bindNav('rail-item-teams', 'btn-rail-teams', '/teams', currentPath === '/teams');

  const moreContainer = sidebar.querySelector<HTMLElement>('[data-ref="rail-item-more"]');
  const btnMore = moreContainer?.querySelector<HTMLElement>('[data-ref="btn-rail-more"]');
  const moreBackdrop = moreContainer?.querySelector<HTMLElement>('[data-ref="more-menu-backdrop"]');
  const moreMenu = moreContainer?.querySelector<HTMLElement>('[data-ref="more-menu"]');
  const btnMoreApps = moreContainer?.querySelector<HTMLElement>('[data-ref="btn-more-apps"]');
  const btnMoreApply = moreContainer?.querySelector<HTMLElement>('[data-ref="btn-more-apply-designer"]');

  if (moreContainer && btnMore && moreMenu) {
    let isMoreOpen = false;

    const positionMoreMenu = () => {
      if (window.innerWidth > 768) {
        const btnRect = btnMore.getBoundingClientRect();
        moreMenu.style.position = 'fixed';
        moreMenu.style.left = `${Math.round(btnRect.right + 10)}px`;
        const menuHeight = moreMenu.offsetHeight || 90;
        if (btnRect.top + menuHeight > window.innerHeight - 16) {
          moreMenu.style.top = 'auto';
          moreMenu.style.bottom = `${Math.max(16, window.innerHeight - btnRect.bottom)}px`;
        } else {
          moreMenu.style.top = `${Math.max(16, Math.round(btnRect.top - 6))}px`;
          moreMenu.style.bottom = 'auto';
        }
      } else {
        moreMenu.style.position = '';
        moreMenu.style.left = '';
        moreMenu.style.top = '';
        moreMenu.style.bottom = '';
      }
    };

    const openMoreMenu = () => {
      closeAllDropdowns();
      isMoreOpen = true;
      btnMore.classList.add('is-active');
      moreMenu.classList.add('is-open');
      positionMoreMenu();
      registerActiveDropdown({
        close: closeMoreMenu,
        wrapper: moreMenu,
      });
      if (moreBackdrop) moreBackdrop.classList.add('is-visible');
    };

    const closeMoreMenu = () => {
      if (!isMoreOpen) return;
      isMoreOpen = false;
      btnMore.classList.remove('is-active');
      moreMenu.classList.remove('is-open');
      unregisterActiveDropdown(moreMenu);
      if (moreBackdrop) moreBackdrop.classList.remove('is-visible');
    };

    btnMore.addEventListener('click', (e) => {
      e.stopPropagation();
      if (isMoreOpen) {
        closeMoreMenu();
      } else {
        openMoreMenu();
      }
    });

    btnMoreApps?.addEventListener('click', (e) => {
      e.preventDefault();
      closeMoreMenu();
      navigate('/your-apps');
    });

    btnMoreApply?.addEventListener('click', (e) => {
      e.preventDefault();
      closeMoreMenu();
      if (canPublishTemplates(currentUser)) {
        navigate('/designer');
      } else {
        navigate('/apply-designer');
      }
    });

    moreBackdrop?.addEventListener('click', (e) => {
      if (e.target === moreBackdrop) {
        closeMoreMenu();
      }
    });

    document.addEventListener('click', (e) => {
      if (isMoreOpen && !moreContainer.contains(e.target as Node)) {
        closeMoreMenu();
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && isMoreOpen) {
        closeMoreMenu();
      }
    });

    window.addEventListener('resize', () => {
      if (isMoreOpen) {
        positionMoreMenu();
      }
    }, { passive: true });
  }

  if (!currentUser) {
    const itemBrand = sidebar.querySelector<HTMLElement>('[data-ref="rail-item-brand"]');
    const itemShared = sidebar.querySelector<HTMLElement>('[data-ref="rail-item-shared"]');
    const itemTeams = sidebar.querySelector<HTMLElement>('[data-ref="rail-item-teams"]');
    if (itemBrand) itemBrand.style.display = 'none';
    if (itemShared) itemShared.style.display = 'none';
    if (itemTeams) itemTeams.style.display = 'none';
  }

  const updateRailBrandBadge = () => {
    const railBrandBadge = sidebar.querySelector<HTMLElement>('[data-ref="rail-brand-badge"]');
    if (railBrandBadge) {
      const hasBrandAccess = hasFeature('brand_kits', currentUser);
      railBrandBadge.classList.toggle('is-hidden', hasBrandAccess);
    }
  };
  updateRailBrandBadge();
  window.addEventListener('subscription-updated', updateRailBrandBadge);

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
    toggleDrawer(false);
    activeCanvasTab = null;
    navigate('/');
  };
  btnCanvasHome?.addEventListener('click', canvasHomeHandler);
  itemCanvasHome?.addEventListener('click', (e) => {
    if (e.target !== btnCanvasHome && !btnCanvasHome?.contains(e.target as Node)) {
      canvasHomeHandler(e);
    }
  });

  const canvasItems: Array<{ tab: 'templates' | 'brand' | 'elements' | 'text' | 'tools' | 'uploads' | 'apps' | 'projects'; btnRef: string; itemRef: string }> = [
    { btnRef: 'btn-rail-canvas-templates', itemRef: 'rail-item-canvas-templates', tab: 'templates' },
    { btnRef: 'btn-rail-canvas-brand', itemRef: 'rail-item-canvas-brand', tab: 'brand' },
    { btnRef: 'btn-rail-canvas-elements', itemRef: 'rail-item-canvas-elements', tab: 'elements' },
    { btnRef: 'btn-rail-canvas-text', itemRef: 'rail-item-canvas-text', tab: 'text' },
    { btnRef: 'btn-rail-canvas-tools', itemRef: 'rail-item-canvas-tools', tab: 'tools' },
    { btnRef: 'btn-rail-canvas-uploads', itemRef: 'rail-item-canvas-uploads', tab: 'uploads' },
    { btnRef: 'btn-rail-canvas-apps', itemRef: 'rail-item-canvas-apps', tab: 'apps' },
    { btnRef: 'btn-rail-canvas-projects', itemRef: 'rail-item-canvas-projects', tab: 'projects' },
  ];

  canvasItems.forEach(({ btnRef, itemRef, tab }) => {
    const btn = sidebar.querySelector<HTMLElement>(`[data-ref="${btnRef}"]`);
    const item = sidebar.querySelector<HTMLElement>(`[data-ref="${itemRef}"]`);
    const handler = (e: Event) => {
      e.preventDefault();
      if (tab === 'tools') {
        if (isDrawerOpen) {
          toggleDrawer(false);
        }
        const controller = getActiveCanvasController();
        if (controller && typeof controller.toggleVerticalToolbar === 'function') {
          const isNowActive = controller.toggleVerticalToolbar();
          activeCanvasTab = isNowActive ? 'tools' : null;
          updateCanvasRailActiveState(sidebar);
        }
        return;
      }
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
  const isPresentation = canvas.canvas_type === 'presentation' || canvas.unit === 'presentation';
  const isDoc = canvas.canvas_type === 'doc' || canvas.unit === 'doc';
  const targetUrl = `/design/${canvas.uuid}`;
  const iconName = isPresentation ? 'slideshow' : (isDoc ? 'description' : 'dashboard');

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
    window.open(targetUrl, '_blank');
  });

  return item;
}

async function renderHomeDrawerContent(drawerBody: HTMLElement): Promise<void> {
  const favoritesSectionHtml = currentUser ? `
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
  ` : `
    <div class="drawer-section" data-ref="drawer-section-favorites" style="display: none;">
      <div class="drawer-section__header" data-ref="drawer-header-favorites">
        <span class="drawer-section__title">Favoritos</span>
      </div>
      <div class="drawer-items-list" data-ref="drawer-favorites-list"></div>
    </div>
  `;

  drawerBody.innerHTML = `
    ${favoritesSectionHtml}

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

  const sectionFavorites = drawerBody.querySelector<HTMLElement>('[data-ref="drawer-section-favorites"]');
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
    if (sectionFavorites && favoritesList) {
      if (!currentUser || favorites.length === 0) {
        sectionFavorites.style.display = 'none';
        favoritesList.innerHTML = '';
      } else {
        sectionFavorites.style.display = '';
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
    if (sectionFavorites) {
      sectionFavorites.style.display = 'none';
    }
    if (favoritesList) {
      favoritesList.innerHTML = '';
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

function getActiveCanvasType(): 'board' | 'doc' | 'presentation' {
  const content = document.querySelector<HTMLElement>('[data-ref="app"] .layout-content, .layout-content');
  const viewEl = content?.querySelector<HTMLElement>('[data-ref="board-view"], [data-ref="doc-view"], [data-ref="presentation-view"], [data-ref="design-view"], .view-wrapper');
  const ref = viewEl?.getAttribute('data-ref') || content?.getAttribute('data-ref');
  if (ref === 'doc-view' || window.location.pathname.startsWith('/doc/')) return 'doc';
  if (ref === 'presentation-view' || window.location.pathname.startsWith('/presentation/')) return 'presentation';
  return 'board';
}

function getActiveCanvasController(): any {
  const content = document.querySelector<HTMLElement>('[data-ref="app"] .layout-content, .layout-content');
  if (!content) return null;
  if ((content as any).__controller) return (content as any).__controller;
  for (let i = 0; i < content.children.length; i++) {
    const child = content.children[i] as any;
    if (child?.__controller) return child.__controller;
  }
  const viewEl = content.querySelector<HTMLElement>('[data-ref="board-view"], [data-ref="doc-view"], [data-ref="presentation-view"], [data-ref="design-view"], .view-wrapper');
  if (viewEl && (viewEl as any).__controller) return (viewEl as any).__controller;
  return null;
}

function handleApplyCanvasTemplate(preset: PresetItem, canvasType: 'board' | 'doc' | 'presentation'): void {
  const controller = getActiveCanvasController();

  if (canvasType === 'presentation') {
    if (!controller) {
      showToast('No se encontró el controlador de la presentación', 'warning');
      return;
    }
    const templateId = preset.boardTemplateId || preset.id;
    controller.applyTemplate?.(templateId, 'insert');
    showToast(`Plantilla «${preset.name}» añadida a la presentación`, 'success');
    if (window.innerWidth <= 768) {
      toggleDrawer(false);
    }
    return;
  }

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
}

let activeElementsCategory: 'root' | 'shapes' | 'stickers' | 'stickies' | 'diagrams' | 'tables' | 'charts' | 'frames' | 'grids' | 'mockups' | '3d' = 'root';
let activeFramesFilter: FrameCategory | 'all' = 'all';
let activeMockupsFilter: MockupGeneralCategory | 'all' = 'all';

interface TablePresetItem {
  cols: number;
  description: string;
  id: string;
  name: string;
  rows: number;
}

const TABLE_PRESETS: TablePresetItem[] = [
  { cols: 3, description: 'Tabla clásica de 3 filas por 3 columnas', id: 'table_3x3', name: 'Tabla 3 × 3', rows: 3 },
  { cols: 4, description: 'Tabla mediana de 4 filas por 4 columnas', id: 'table_4x4', name: 'Tabla 4 × 4', rows: 4 },
  { cols: 3, description: 'Tabla vertical de 5 filas por 3 columnas', id: 'table_5x3', name: 'Tabla 5 × 3', rows: 5 },
  { cols: 4, description: 'Tabla horizontal de 2 filas por 4 columnas', id: 'table_2x4', name: 'Tabla 2 × 4', rows: 2 },
  { cols: 6, description: 'Cuadrícula amplia de 6 filas por 6 columnas', id: 'table_6x6', name: 'Tabla 6 × 6', rows: 6 },
];

interface RecentElementItem {
  category?: ShapeCategory;
  diagramCategory?: string;
  file?: string;
  fillColor?: string;
  id: string;
  name: string;
  pathD?: string;
  previewSvg?: string;
  shapeType?: ShapeType;
  strokeColor?: string;
  text?: string;
  textColor?: string;
  type: 'vector' | 'sticker' | 'diagram' | 'sticky';
}

function getRecentElements(): RecentElementItem[] {
  try {
    const raw = localStorage.getItem('spriteboard_recent_elements');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return [];
}

function addRecentElement(item: RecentElementItem): void {
  try {
    const current = getRecentElements().filter((r) => r.id !== item.id);
    current.unshift(item);
    localStorage.setItem('spriteboard_recent_elements', JSON.stringify(current.slice(0, 16)));
  } catch {}
}

const SHAPE_SECTIONS: Array<{ key: string; label: string; prefixes: string[] }> = [
  {
    key: 'basic',
    label: 'Formas básicas',
    prefixes: [
      'square', 'rounded_rectangle', 'chamfer_square', 'circle', 'semi_circle',
      'quarter_circle', 'quadrant_ring', 'semi_ring', 'diamond', 'triangle_up',
      'triangle_down', 'triangle_right_angle', 'trapezoid_up', 'trapezoid_down',
      'parallelogram_left', 'parallelogram_right'
    ],
  },
  {
    key: 'polygons',
    label: 'Polígonos',
    prefixes: ['pentagon', 'hexagon_flat', 'hexagon_pointy', 'heptagon', 'octagon', 'decagon'],
  },
  {
    key: 'stars',
    label: 'Estrellas y Destellos',
    prefixes: [
      'star_4_sparkle', 'star_5', 'star_6', 'star_7', 'star_8', 'sparkle_8',
      'sparkle_12', 'sunburst_16', 'burst_10', 'burst_12', 'burst_16', 'burst_20', 'burst_24', 'seal_scallop_32'
    ],
  },
  {
    key: 'arrows',
    label: 'Flechas y Líneas',
    prefixes: [
      'arrow_right', 'arrow_left', 'arrow_up', 'arrow_down', 'arrow_double_horizontal',
      'arrow_double_vertical', 'arrow_pointed_double', 'arrow_pointed_left', 'arrow_ribbon',
      'chevron_right', 'wave_multi_ribbon', 'wave_s_curve'
    ],
  },
  {
    key: 'callouts',
    label: 'Llamadas y Nubes',
    prefixes: [
      'callout_rectangular', 'callout_rounded_rect', 'callout_oval', 'callout_cloud',
      'callout_curved_tail', 'cloud_fluffy_soft', 'cloud_flat_base_multi', 'cloud_flat_base_triple',
      'cloud_round_dome', 'cloud_puffy_full'
    ],
  },
  {
    key: 'banners',
    label: 'Banners y Cintas',
    prefixes: [
      'banner_horizontal_ribbon', 'banner_rounded_notch', 'banner_rounded_point',
      'banner_vertical_notch', 'banner_vertical_point'
    ],
  },
  {
    key: 'flow',
    label: 'Símbolos de Flujo',
    prefixes: [
      'flow_process', 'flow_decision', 'flow_data', 'flow_document', 'flow_terminator',
      'flow_preparation', 'flow_delay', 'flow_manual', 'flow_merge', 'flow_offpage', 'flow_shield'
    ],
  },
  {
    key: 'symbols',
    label: 'Símbolos y Naturaleza',
    prefixes: [
      'heart_classic', 'heart_rounded', 'heart_narrow', 'heart_wide', 'heart_playful',
      'cross', 'leaf_curved', 'clover_4_leaves', 'flower_4_petals_cross', 'flower_6_petals_center_hole',
      'flower_6_petals_drop', 'flower_8_petals_round', 'flower_8_petals_sharp', 'shield_u', 'ticket',
      'arch', 'barrel', 'gear_12_teeth_large_hole', 'gear_12_teeth_pointed', 'gear_12_teeth_small_hole',
      'gear_14_teeth_pointed', 'gear_16_teeth_large_hole', 'gear_16_teeth_pointed', 'tear_curved_flame',
      'tear_narrow', 'tear_straight', 'tear_tilted', 'tear_wide'
    ],
  },
];

function handleApplyDiagramComponent(item: DiagramComponentItem, canvasType: 'board' | 'doc' | 'presentation'): void {
  const controller = getActiveCanvasController();

  addRecentElement({
    diagramCategory: item.category,
    fillColor: item.fillColor,
    id: item.id,
    name: item.name,
    previewSvg: item.previewSvg,
    shapeType: item.shapeType,
    strokeColor: item.strokeColor,
    text: item.text,
    textColor: item.textColor,
    type: 'diagram',
  });

  if (canvasType === 'doc') {
    if (!controller) {
      showToast('No se encontró el controlador del documento', 'warning');
      return;
    }

    if (item.type === 'shape' && item.shapeType) {
      controller.insertShapeSvg?.(item.previewSvg, item.name, item.strokeColor || '#1e293b');
      showToast(`«${item.name}» insertado en el documento`, 'success');
    } else {
      showToast(`Elemento de diagrama «${item.name}» optimizado para Pizarrón`, 'info');
    }
    if (window.innerWidth <= 768) {
      toggleDrawer(false);
    }
    return;
  }

  if (canvasType === 'board' || canvasType === 'presentation') {
    if (!controller) {
      showToast('No se encontró el controlador del lienzo', 'warning');
      return;
    }

    if (item.type === 'shape' && item.shapeType) {
      controller.insertDiagramNode?.({
        fillColor: item.fillColor,
        height: item.height,
        isMindMapNode: item.isMindMapNode,
        shapeType: item.shapeType,
        strokeColor: item.strokeColor,
        text: item.text,
        textColor: item.textColor,
        width: item.width,
      });
      showToast(`«${item.name}» añadido al lienzo`, 'success');
    } else if (item.type === 'sticky') {
      controller.insertStickyNote?.(item.fillColor || '#fef08a', item.text);
      showToast(`Nota «${item.name}» añadida al lienzo`, 'success');
    } else if (item.type === 'connector') {
      controller.activateConnectorTool?.(item.connectorStyle);
      showToast(`Herramienta ${item.name} activada: arrastra entre nodos`, 'info');
    }

    if (window.innerWidth <= 768) {
      toggleDrawer(false);
    }
  }
}

function handleApplyCanvasElement(shape: PixelShape, canvasType: 'board' | 'doc' | 'presentation'): void {
  const controller = getActiveCanvasController();

  addRecentElement({
    category: shape.category,
    file: shape.file,
    id: shape.id,
    name: shape.name,
    pathD: shape.pathD,
    type: shape.type,
  });

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

  if (canvasType === 'board' || canvasType === 'presentation') {
    if (!controller) {
      showToast('No se encontró el controlador del lienzo', 'warning');
      return;
    }

    controller.insertShapeOrSticker?.(shape);
    showToast(`«${shape.name}» añadido al lienzo`, 'success');
    if (window.innerWidth <= 768) {
      toggleDrawer(false);
    }
    return;
  }
}

function handleApplyStickyPreset(item: { color: string; id: string; name: string; stroke: string; text?: string; textColor?: string }, canvasType: 'board' | 'doc' | 'presentation'): void {
  const controller = getActiveCanvasController();
  const noteText = item.text || 'Nota';

  addRecentElement({
    fillColor: item.color,
    id: item.id,
    name: item.name,
    strokeColor: item.stroke,
    text: noteText,
    type: 'sticky',
  });

  if ((canvasType === 'board' || canvasType === 'presentation') && controller) {
    controller.insertStickyNote?.(item.color, noteText);
    showToast(`Nota «${item.name}» añadida al lienzo`, 'success');
  } else if (canvasType === 'doc' && controller) {
    showToast('Las notas adhesivas están optimizadas para el pizarrón', 'info');
  }

  if (window.innerWidth <= 768) {
    toggleDrawer(false);
  }
}

function handleApplyRecentElement(item: RecentElementItem, canvasType: 'board' | 'doc' | 'presentation'): void {
  if (item.type === 'sticky') {
    handleApplyStickyPreset({
      color: item.fillColor || '#fef08a',
      id: item.id,
      name: item.name,
      stroke: item.strokeColor || '#fde047',
      text: item.text || 'Nota',
    }, canvasType);
    return;
  }
  if (item.type === 'diagram') {
    const diag = DIAGRAM_COMPONENTS.find((d) => d.id === item.id);
    if (diag) {
      handleApplyDiagramComponent(diag, canvasType);
    } else {
      handleApplyDiagramComponent({
        category: (item.diagramCategory as any) || 'flowchart',
        categoryLabel: 'Diagramas',
        description: item.name,
        fillColor: item.fillColor,
        id: item.id,
        name: item.name,
        previewSvg: item.previewSvg || '',
        shapeType: item.shapeType,
        strokeColor: item.strokeColor,
        text: item.text,
        textColor: item.textColor,
        type: 'shape',
      }, canvasType);
    }
    return;
  }
  const shape = PIXEL_SHAPES.find((s) => s.id === item.id);
  if (shape) {
    handleApplyCanvasElement(shape, canvasType);
  } else {
    handleApplyCanvasElement({
      category: item.category || 'shapes',
      file: item.file,
      height: 60,
      id: item.id,
      name: item.name,
      pathD: item.pathD,
      type: item.type as 'vector' | 'sticker',
      width: 60,
    }, canvasType);
  }
}

function handleApplyChart(chartType: ChartType, canvasType: 'board' | 'doc' | 'presentation'): void {
  const controller = getActiveCanvasController();
  if ((canvasType === 'board' || canvasType === 'presentation') && controller) {
    controller.insertChart?.(chartType);
    showToast('Gráfica añadida al lienzo', 'success');
  } else if (canvasType === 'doc' && controller) {
    showToast('Las gráficas interactivas están disponibles en el pizarrón', 'info');
  }
  if (window.innerWidth <= 768) {
    toggleDrawer(false);
  }
}

function handleApplyMockup(tpl: MockupTemplate, canvasType: 'board' | 'doc' | 'presentation'): void {
  const controller = getActiveCanvasController();
  if ((canvasType === 'board' || canvasType === 'presentation') && controller) {
    controller.insertMockup?.(tpl);
    showToast(`Mockup «${tpl.name}» añadido al lienzo`, 'success');
  } else if (canvasType === 'doc' && controller) {
    showToast('Los mockups están disponibles en el pizarrón', 'info');
  }
  if (window.innerWidth <= 768) {
    toggleDrawer(false);
  }
}

function handleApply3DShape(shapeId: Shape3DType, canvasType: 'board' | 'doc' | 'presentation'): void {
  const controller = getActiveCanvasController();
  if ((canvasType === 'board' || canvasType === 'presentation') && controller) {
    controller.insert3DShape?.(shapeId);
    showToast('Figura 3D añadida al lienzo', 'success');
  } else if (canvasType === 'doc' && controller) {
    showToast('Los elementos 3D están disponibles en el pizarrón', 'info');
  }
  if (window.innerWidth <= 768) {
    toggleDrawer(false);
  }
}

function handleApplyTable(rows: number, cols: number, canvasType: 'board' | 'doc' | 'presentation'): void {
  const controller = getActiveCanvasController();
  if ((canvasType === 'board' || canvasType === 'presentation') && controller) {
    controller.insertTable?.(rows, cols);
    showToast(`Tabla de ${rows}×${cols} añadida al lienzo`, 'success');
  } else if (canvasType === 'doc' && controller) {
    controller.insertTable?.(rows, cols);
    showToast(`Tabla de ${rows}×${cols} añadida al documento`, 'success');
  }
  if (window.innerWidth <= 768) {
    toggleDrawer(false);
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
        <div class="menu-panel__search" data-ref="canvas-elements-search">
          <svg class="component-icon menu-panel__search-icon" aria-hidden="true"><use href="/icons.svg#search"></use></svg>
          <input class="menu-panel__search-input" data-ref="canvas-elements-search-input" type="text" maxlength="50" autocomplete="off" placeholder="Buscar elementos..." />
        </div>

        <div class="elements-drawer-content" data-ref="elements-drawer-content"></div>
      </div>
    </div>
  `;

  const btnClose = drawerBody.querySelector<HTMLElement>('[data-ref="btn-close-canvas-panel"]');
  btnClose?.addEventListener('click', (e) => {
    e.preventDefault();
    toggleDrawer(false);
  });

  const searchInput = drawerBody.querySelector<HTMLInputElement>('[data-ref="canvas-elements-search-input"]');
  const contentContainer = drawerBody.querySelector<HTMLElement>('[data-ref="elements-drawer-content"]');

  const renderContent = (query = '') => {
    if (!contentContainer) return;
    const cleanQ = query.trim().toLowerCase();

    if (cleanQ) {
      const matchingDiagrams = DIAGRAM_COMPONENTS.filter((d) => d.name.toLowerCase().includes(cleanQ) || d.description.toLowerCase().includes(cleanQ) || d.categoryLabel.toLowerCase().includes(cleanQ));
      const matchingShapes = PIXEL_SHAPES.filter((s) => s.name.toLowerCase().includes(cleanQ) || s.id.toLowerCase().includes(cleanQ));
      const matchingCharts = CHART_CATALOG.filter((c) => c.name.toLowerCase().includes(cleanQ) || c.description.toLowerCase().includes(cleanQ) || 'gráficas'.includes(cleanQ) || 'graficas'.includes(cleanQ) || 'charts'.includes(cleanQ));
      const matching3D = BOARD_3D_SHAPES.filter((s) => s.name.toLowerCase().includes(cleanQ) || s.id.toLowerCase().includes(cleanQ) || '3d'.includes(cleanQ));
      const matchingMockups = ALL_MOCKUP_ITEMS.filter((m) => m.name.toLowerCase().includes(cleanQ) || m.description.toLowerCase().includes(cleanQ) || 'mockup'.includes(cleanQ) || 'maqueta'.includes(cleanQ) || 'marco'.includes(cleanQ) || 'cuadricula'.includes(cleanQ) || 'collage'.includes(cleanQ));
      const matchingTables = (cleanQ.includes('tabl') || cleanQ.includes('table') || cleanQ.includes('cuad')) ? TABLE_PRESETS : [];

      if (matchingDiagrams.length === 0 && matchingShapes.length === 0 && matchingCharts.length === 0 && matching3D.length === 0 && matchingMockups.length === 0 && matchingTables.length === 0) {
        contentContainer.innerHTML = `
          <div class="canvas-panel-card__empty" data-ref="elements-empty">
            <span class="canvas-panel-card__empty-title">Sin resultados</span>
            <p class="canvas-panel-card__empty-desc">No se encontraron elementos para «${escapeHtml(query)}»</p>
          </div>
        `;
        return;
      }

      let html = '<div class="elements-grid" data-ref="elements-grid">';

      if (matchingCharts.length > 0) {
        html += '<div class="elements-section-title">Gráficas</div>';
        html += matchingCharts.map((item) => `
          <button type="button" class="element-grid-item element-grid-item--diagram" data-ref="btn-chart-item-${item.type}" data-chart-type="${item.type}" data-tooltip="${escapeHtml(item.description)}" aria-label="${escapeHtml(item.name)}">
            <div style="width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; pointer-events: none;">
              ${item.iconSvg}
            </div>
            <span class="element-grid-item__label">${escapeHtml(item.name)}</span>
          </button>
        `).join('');
      }

      if (matching3D.length > 0) {
        html += '<div class="elements-section-title">Elementos 3D</div>';
        html += matching3D.map((shape) => `
          <button type="button" class="element-grid-item element-grid-item--diagram" data-ref="btn-3d-item-${shape.id}" data-shape3d-id="${shape.id}" data-tooltip="${escapeHtml(shape.name)}" aria-label="${escapeHtml(shape.name)}">
            <div style="width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; background: rgba(99, 102, 241, 0.08); border-radius: 8px; color: #6366f1; pointer-events: none;">
              <svg class="component-icon" aria-hidden="true" style="width: 22px; height: 22px;"><use href="/icons.svg#${shape.icon}"></use></svg>
            </div>
            <span class="element-grid-item__label">${escapeHtml(shape.name)}</span>
          </button>
        `).join('');
      }

      if (matchingTables.length > 0) {
        html += '<div class="elements-section-title">Tablas</div>';
        html += matchingTables.map((item) => `
          <button type="button" class="element-grid-item element-grid-item--diagram" data-ref="btn-table-item-${item.id}" data-table-rows="${item.rows}" data-table-cols="${item.cols}" data-tooltip="${escapeHtml(item.description)}" aria-label="${escapeHtml(item.name)}">
            <svg viewBox="0 0 48 48" aria-hidden="true" style="width: 32px; height: 32px;">
              <rect x="6" y="8" width="36" height="32" rx="4" fill="none" stroke="#0284c7" stroke-width="2" />
              <rect x="6" y="8" width="36" height="10" rx="4" fill="#38bdf8" fill-opacity="0.3" stroke="#0284c7" stroke-width="1.5" />
              <line x1="6" y1="28" x2="42" y2="28" stroke="#cbd5e1" stroke-width="1.5" />
              <line x1="18" y1="8" x2="18" y2="40" stroke="#cbd5e1" stroke-width="1.5" />
              <line x1="30" y1="8" x2="30" y2="40" stroke="#cbd5e1" stroke-width="1.5" />
            </svg>
            <span class="element-grid-item__label">${escapeHtml(item.name)}</span>
          </button>
        `).join('');
      }

      if (matchingMockups.length > 0) {
        html += '<div class="elements-section-title">Mockups</div>';
        html += matchingMockups.map((tpl) => `
          <button type="button" class="element-grid-item element-grid-item--diagram" data-ref="btn-mockup-item-${tpl.id}" data-mockup-id="${tpl.id}" data-tooltip="${escapeHtml(tpl.description || tpl.name)}" aria-label="${escapeHtml(tpl.name)}">
            <div style="width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; overflow: hidden; pointer-events: none;">
              ${tpl.thumbnailSvg}
            </div>
            <span class="element-grid-item__label">${escapeHtml(tpl.name)}</span>
          </button>
        `).join('');
      }

      if (matchingDiagrams.length > 0) {
        html += '<div class="elements-section-title">Diagramas</div>';
        html += matchingDiagrams.map((item) => `
          <button type="button" class="element-grid-item element-grid-item--diagram" data-ref="btn-diagram-item-${item.id}" data-diagram-id="${item.id}" data-tooltip="${escapeHtml(item.description || item.name)}" aria-label="${escapeHtml(item.name)}">
            <svg viewBox="0 0 48 48" aria-hidden="true">${item.previewSvg}</svg>
            <span class="element-grid-item__label">${escapeHtml(item.name)}</span>
          </button>
        `).join('');
      }

      if (matchingShapes.length > 0) {
        html += '<div class="elements-section-title">Figuras y Formas</div>';
        html += matchingShapes.map((item) => {
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
      }

      html += '</div>';
      contentContainer.innerHTML = html;
      bindItemClicks(contentContainer);
      renderIcons(contentContainer);
      return;
    }

    if (activeElementsCategory === 'root') {
      const recents = getRecentElements().slice(0, 6);
      const recentsHtml = recents.length > 0 ? `
        <div class="elements-recents-section" data-ref="elements-recents-section" style="margin-bottom: 14px;">
          <span class="elements-categories-heading">Usados recientemente</span>
          <div class="elements-grid elements-recents-grid" data-ref="elements-recents-grid">
            ${recents.map((item) => {
              let preview = '';
              if (item.type === 'vector' && item.pathD) {
                preview = `<svg viewBox="0 0 48 48" aria-hidden="true" style="width: 24px; height: 24px;"><path d="${item.pathD}" fill="currentColor" /></svg>`;
              } else if (item.type === 'sticker' && item.file) {
                preview = `<img src="/assets/img/stickers/${item.file}" alt="${escapeHtml(item.name)}" loading="lazy" style="width: 26px; height: 26px; object-fit: contain;" />`;
              } else if (item.type === 'diagram' && item.previewSvg) {
                preview = `<svg viewBox="0 0 48 48" aria-hidden="true" style="width: 24px; height: 24px;">${item.previewSvg}</svg>`;
              } else if (item.type === 'sticky') {
                preview = `<div style="background-color: ${item.fillColor || '#fef08a'}; border: 1.5px solid ${item.strokeColor || '#fde047'}; border-radius: 4px; width: 24px; height: 24px;"></div>`;
              } else {
                preview = `<svg class="component-icon" aria-hidden="true"><use href="/icons.svg#category"></use></svg>`;
              }
              return `
                <button type="button" class="element-grid-item" data-ref="btn-recent-item-${item.id}" data-recent-id="${item.id}" data-tooltip="${escapeHtml(item.name)}" aria-label="${escapeHtml(item.name)}">
                  ${preview}
                </button>
              `;
            }).join('')}
          </div>
        </div>
      ` : '';

      contentContainer.innerHTML = `
        <div class="elements-categories-menu" data-ref="elements-categories-menu">
          ${recentsHtml}
          <span class="elements-categories-heading">Explora las categorías</span>
          <div class="elements-categories-grid" data-ref="elements-categories-grid">
            <button type="button" class="element-category-card" data-ref="btn-category-stickies" data-category="stickies">
              <div class="element-category-card__stack" data-ref="category-stack-stickies">
                <div class="element-category-card__layer element-category-card__layer--back element-category-card__layer--stickies-back">
                  <svg class="element-category-card__svg" viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect x="6" y="6" width="60" height="60" rx="16" fill="url(#cva-grad-sticky-back)" />
                    <path d="M46 50L66 50L66 30Z" fill="#047857" opacity="0.35" />
                    <path d="M46 50L66 30L46 30Z" fill="#34d399" />
                    <defs>
                      <linearGradient id="cva-grad-sticky-back" x1="6" y1="6" x2="66" y2="66" gradientUnits="userSpaceOnUse">
                        <stop stop-color="#34d399" />
                        <stop offset="0.5" stop-color="#10b981" />
                        <stop offset="1" stop-color="#059669" />
                      </linearGradient>
                    </defs>
                  </svg>
                </div>
                <div class="element-category-card__layer element-category-card__layer--front element-category-card__layer--stickies-front">
                  <svg class="element-category-card__svg" viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect x="6" y="6" width="60" height="60" rx="16" fill="url(#cva-grad-sticky-front)" />
                    <rect x="6.5" y="6.5" width="59" height="59" rx="15.5" stroke="rgba(255,255,255,0.4)" stroke-width="1" />
                    <path d="M18 18H54C55.1 18 56 18.9 56 20V42L44 54H20C18.9 54 18 53.1 18 52V18Z" fill="#FFFBEB" />
                    <rect x="23" y="24" width="22" height="3" rx="1.5" fill="#FBBF24" />
                    <rect x="23" y="30" width="26" height="3" rx="1.5" fill="#FDE68A" />
                    <rect x="23" y="36" width="16" height="3" rx="1.5" fill="#FDE68A" />
                    <path d="M44 42L56 42L44 54Z" fill="#B45309" opacity="0.25" />
                    <path d="M44 42L56 42C54 46 50 52 44 54L44 42Z" fill="url(#cva-grad-sticky-fold)" />
                    <defs>
                      <linearGradient id="cva-grad-sticky-front" x1="6" y1="6" x2="66" y2="66" gradientUnits="userSpaceOnUse">
                        <stop stop-color="#FEF08A" />
                        <stop offset="0.3" stop-color="#FDE047" />
                        <stop offset="1" stop-color="#F59E0B" />
                      </linearGradient>
                      <linearGradient id="cva-grad-sticky-fold" x1="44" y1="42" x2="56" y2="54" gradientUnits="userSpaceOnUse">
                        <stop stop-color="#FB7185" />
                        <stop offset="1" stop-color="#E11D48" />
                      </linearGradient>
                    </defs>
                  </svg>
                </div>
              </div>
              <span class="element-category-card__label">Notas adhesivas</span>
            </button>

            <button type="button" class="element-category-card" data-ref="btn-category-shapes" data-category="shapes">
              <div class="element-category-card__stack" data-ref="category-stack-shapes">
                <div class="element-category-card__layer element-category-card__layer--back element-category-card__layer--shapes-back">
                  <svg class="element-category-card__svg" viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect x="6" y="6" width="60" height="60" rx="16" fill="url(#cva-grad-shapes-back)" />
                    <path d="M48 14L50.5 19.5L56 20.5L52 24.5L53 30L48 27L43 30L44 24.5L40 20.5L45.5 19.5Z" fill="#F97316" />
                    <line x1="36" y1="46" x2="58" y2="46" stroke="#FFFFFF" stroke-width="2.5" stroke-linecap="round" />
                    <circle cx="58" cy="46" r="4.5" fill="#FFFFFF" />
                    <defs>
                      <linearGradient id="cva-grad-shapes-back" x1="6" y1="6" x2="66" y2="66" gradientUnits="userSpaceOnUse">
                        <stop stop-color="#2DD4BF" />
                        <stop offset="0.5" stop-color="#06B6D4" />
                        <stop offset="1" stop-color="#0284C7" />
                      </linearGradient>
                    </defs>
                  </svg>
                </div>
                <div class="element-category-card__layer element-category-card__layer--front element-category-card__layer--shapes-front">
                  <svg class="element-category-card__svg" viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect x="6" y="6" width="60" height="60" rx="16" fill="url(#cva-grad-shapes-front)" />
                    <rect x="6.5" y="6.5" width="59" height="59" rx="15.5" stroke="rgba(255,255,255,0.4)" stroke-width="1" />
                    <path d="M26 20L35 25L32 36H18L15 25L26 20Z" fill="rgba(255,255,255,0.78)" />
                    <path d="M48 24C49 22.5 51 22.5 52 24L59 36C60 37.5 59 39.5 57 39.5H43C41 39.5 40 37.5 41 36L48 24Z" fill="url(#cva-grad-pink-triangle)" />
                    <g fill="#0F172A" opacity="0.85">
                      <circle cx="20" cy="48" r="2.2" />
                      <circle cx="26" cy="48" r="2.2" />
                      <circle cx="32" cy="48" r="2.2" />
                      <circle cx="38" cy="48" r="2.2" />
                      <circle cx="44" cy="48" r="2.2" />
                      <circle cx="50" cy="48" r="2.2" />
                    </g>
                    <defs>
                      <linearGradient id="cva-grad-shapes-front" x1="6" y1="6" x2="66" y2="66" gradientUnits="userSpaceOnUse">
                        <stop stop-color="#22D3EE" />
                        <stop offset="0.4" stop-color="#06B6D4" />
                        <stop offset="1" stop-color="#0284C7" />
                      </linearGradient>
                      <linearGradient id="cva-grad-pink-triangle" x1="41" y1="23" x2="59" y2="39" gradientUnits="userSpaceOnUse">
                        <stop stop-color="#F472B6" />
                        <stop offset="1" stop-color="#EC4899" />
                      </linearGradient>
                    </defs>
                  </svg>
                </div>
              </div>
              <span class="element-category-card__label">Formas</span>
            </button>

            <button type="button" class="element-category-card" data-ref="btn-category-stickers" data-category="stickers">
              <div class="element-category-card__stack" data-ref="category-stack-stickers">
                <div class="element-category-card__layer element-category-card__layer--back element-category-card__layer--stickers-back">
                  <svg class="element-category-card__svg" viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect x="6" y="6" width="60" height="60" rx="16" fill="url(#cva-grad-stickers-back)" />
                    <path d="M48 14L49.8 19.2L55 21L49.8 22.8L48 28L46.2 22.8L41 21L46.2 19.2Z" fill="#FFFFFF" />
                    <path d="M56 32L57.2 35.5L60.5 36.5L57.2 37.5L56 41L54.8 37.5L51.5 36.5L54.8 35.5Z" fill="#FEF08A" />
                    <defs>
                      <linearGradient id="cva-grad-stickers-back" x1="6" y1="6" x2="66" y2="66" gradientUnits="userSpaceOnUse">
                        <stop stop-color="#FDE047" />
                        <stop offset="0.5" stop-color="#FBBF24" />
                        <stop offset="1" stop-color="#F59E0B" />
                      </linearGradient>
                    </defs>
                  </svg>
                </div>
                <div class="element-category-card__layer element-category-card__layer--front element-category-card__layer--stickers-front">
                  <svg class="element-category-card__svg" viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect x="6" y="6" width="60" height="60" rx="16" fill="url(#cva-grad-stickers-front)" />
                    <rect x="6.5" y="6.5" width="59" height="59" rx="15.5" stroke="rgba(255,255,255,0.4)" stroke-width="1" />
                    <path d="M22 47C26 43 32 45 36 49C29 53 23 51 22 47Z" fill="#10B981" />
                    <path d="M50 47C46 43 40 45 36 49C43 53 49 51 50 47Z" fill="#10B981" />
                    <circle cx="36" cy="33" r="14" fill="#FBBF24" />
                    <path d="M36 17L38.5 22.5L44.5 21L43.5 27L49 28.5L45.5 33L49 37.5L43.5 39L44.5 45L38.5 43.5L36 49L33.5 43.5L27.5 45L28.5 39L23 37.5L26.5 33L23 28.5L28.5 27L27.5 21L33.5 22.5Z" fill="url(#cva-grad-sunflower-petals)" />
                    <circle cx="36" cy="33" r="7.5" fill="url(#cva-grad-sunflower-center)" />
                    <circle cx="36" cy="33" r="5.5" fill="#78350F" opacity="0.6" />
                    <defs>
                      <linearGradient id="cva-grad-stickers-front" x1="6" y1="6" x2="66" y2="66" gradientUnits="userSpaceOnUse">
                        <stop stop-color="#FB923C" />
                        <stop offset="0.4" stop-color="#F97316" />
                        <stop offset="1" stop-color="#EF4444" />
                      </linearGradient>
                      <linearGradient id="cva-grad-sunflower-petals" x1="23" y1="17" x2="49" y2="49" gradientUnits="userSpaceOnUse">
                        <stop stop-color="#FEF08A" />
                        <stop offset="0.5" stop-color="#FDE047" />
                        <stop offset="1" stop-color="#F59E0B" />
                      </linearGradient>
                      <linearGradient id="cva-grad-sunflower-center" x1="30" y1="27" x2="42" y2="39" gradientUnits="userSpaceOnUse">
                        <stop stop-color="#92400E" />
                        <stop offset="1" stop-color="#451A03" />
                      </linearGradient>
                    </defs>
                  </svg>
                </div>
              </div>
              <span class="element-category-card__label">Figuras</span>
            </button>

            <button type="button" class="element-category-card" data-ref="btn-category-diagrams" data-category="diagrams">
              <div class="element-category-card__stack" data-ref="category-stack-diagrams">
                <div class="element-category-card__layer element-category-card__layer--back element-category-card__layer--diagrams-back">
                  <svg class="element-category-card__svg" viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect x="6" y="6" width="60" height="60" rx="16" fill="url(#cva-grad-diagrams-back)" />
                    <path d="M42 20H52C54 20 55 21 55 23V32" stroke="#FFFFFF" stroke-width="2.5" stroke-linecap="round" />
                    <rect x="48" y="32" width="14" height="10" rx="4" fill="#FFFFFF" />
                    <defs>
                      <linearGradient id="cva-grad-diagrams-back" x1="6" y1="6" x2="66" y2="66" gradientUnits="userSpaceOnUse">
                        <stop stop-color="#E879F9" />
                        <stop offset="0.5" stop-color="#C084FC" />
                        <stop offset="1" stop-color="#9333EA" />
                      </linearGradient>
                    </defs>
                  </svg>
                </div>
                <div class="element-category-card__layer element-category-card__layer--front element-category-card__layer--diagrams-front">
                  <svg class="element-category-card__svg" viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect x="6" y="6" width="60" height="60" rx="16" fill="url(#cva-grad-diagrams-front)" />
                    <rect x="6.5" y="6.5" width="59" height="59" rx="15.5" stroke="rgba(255,255,255,0.4)" stroke-width="1" />
                    <path d="M36 26V35M36 35H25V42M36 35H47V42" stroke="#FFFFFF" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
                    <rect x="27" y="17" width="18" height="11" rx="5.5" fill="#FFFFFF" />
                    <rect x="30" y="21" width="12" height="3" rx="1.5" fill="#4F46E5" />
                    <rect x="17" y="42" width="16" height="12" rx="4" fill="#C7D2FE" />
                    <rect x="20" y="46" width="10" height="2.5" rx="1.2" fill="#3730A3" />
                    <rect x="39" y="42" width="16" height="12" rx="4" fill="#A5F3FC" />
                    <rect x="42" y="46" width="10" height="2.5" rx="1.2" fill="#0E7490" />
                    <defs>
                      <linearGradient id="cva-grad-diagrams-front" x1="6" y1="6" x2="66" y2="66" gradientUnits="userSpaceOnUse">
                        <stop stop-color="#818CF8" />
                        <stop offset="0.4" stop-color="#6366F1" />
                        <stop offset="1" stop-color="#4F46E5" />
                      </linearGradient>
                    </defs>
                  </svg>
                </div>
              </div>
              <span class="element-category-card__label">Diagramas</span>
            </button>

            <button type="button" class="element-category-card" data-ref="btn-category-tables" data-category="tables">
              <div class="element-category-card__stack" data-ref="category-stack-tables">
                <div class="element-category-card__layer element-category-card__layer--back">
                  <svg class="element-category-card__svg" viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect x="6" y="6" width="60" height="60" rx="16" fill="url(#cva-grad-tables-back)" />
                    <rect x="18" y="18" width="36" height="36" rx="4" stroke="#ffffff" stroke-width="2" stroke-opacity="0.5" />
                    <defs>
                      <linearGradient id="cva-grad-tables-back" x1="6" y1="6" x2="66" y2="66" gradientUnits="userSpaceOnUse">
                        <stop stop-color="#0284c7" />
                        <stop offset="1" stop-color="#0369a1" />
                      </linearGradient>
                    </defs>
                  </svg>
                </div>
                <div class="element-category-card__layer element-category-card__layer--front">
                  <svg class="element-category-card__svg" viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect x="6" y="6" width="60" height="60" rx="16" fill="url(#cva-grad-tables-front)" />
                    <rect x="6.5" y="6.5" width="59" height="59" rx="15.5" stroke="rgba(255,255,255,0.4)" stroke-width="1" />
                    <rect x="16" y="16" width="40" height="40" rx="6" fill="#ffffff" fill-opacity="0.9" />
                    <rect x="16" y="16" width="40" height="12" rx="6" fill="#38bdf8" />
                    <line x1="16" y1="28" x2="56" y2="28" stroke="#0284c7" stroke-width="1" />
                    <line x1="16" y1="42" x2="56" y2="42" stroke="#e2e8f0" stroke-width="1.5" />
                    <line x1="29" y1="16" x2="29" y2="56" stroke="#e2e8f0" stroke-width="1.5" />
                    <line x1="43" y1="16" x2="43" y2="56" stroke="#e2e8f0" stroke-width="1.5" />
                    <defs>
                      <linearGradient id="cva-grad-tables-front" x1="6" y1="6" x2="66" y2="66" gradientUnits="userSpaceOnUse">
                        <stop stop-color="#38bdf8" />
                        <stop offset="0.5" stop-color="#0284c7" />
                        <stop offset="1" stop-color="#0369a1" />
                      </linearGradient>
                    </defs>
                  </svg>
                </div>
              </div>
              <span class="element-category-card__label">Tablas</span>
            </button>

            <button type="button" class="element-category-card" data-ref="btn-category-charts" data-category="charts">
              <div class="element-category-card__stack" data-ref="category-stack-charts">
                <div class="element-category-card__layer element-category-card__layer--back">
                  <svg class="element-category-card__svg" viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect x="6" y="6" width="60" height="60" rx="16" fill="url(#cva-grad-charts-back)" />
                    <path d="M18 48L32 34L44 42L56 22" stroke="#ffffff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" opacity="0.4" />
                    <defs>
                      <linearGradient id="cva-grad-charts-back" x1="6" y1="6" x2="66" y2="66" gradientUnits="userSpaceOnUse">
                        <stop stop-color="#8b5cf6" />
                        <stop offset="1" stop-color="#6d28d9" />
                      </linearGradient>
                    </defs>
                  </svg>
                </div>
                <div class="element-category-card__layer element-category-card__layer--front">
                  <svg class="element-category-card__svg" viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect x="6" y="6" width="60" height="60" rx="16" fill="url(#cva-grad-charts-front)" />
                    <rect x="6.5" y="6.5" width="59" height="59" rx="15.5" stroke="rgba(255,255,255,0.4)" stroke-width="1" />
                    <rect x="18" y="36" width="7" height="18" rx="3.5" fill="#ffffff" />
                    <rect x="29" y="24" width="7" height="30" rx="3.5" fill="#facc15" />
                    <rect x="40" y="30" width="7" height="24" rx="3.5" fill="#38bdf8" />
                    <rect x="51" y="18" width="7" height="36" rx="3.5" fill="#4ade80" />
                    <path d="M18 32L29 20L40 26L54 14" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
                    <circle cx="54" cy="14" r="3" fill="#ffffff" />
                    <defs>
                      <linearGradient id="cva-grad-charts-front" x1="6" y1="6" x2="66" y2="66" gradientUnits="userSpaceOnUse">
                        <stop stop-color="#a855f7" />
                        <stop offset="0.5" stop-color="#8b5cf6" />
                        <stop offset="1" stop-color="#7c3aed" />
                      </linearGradient>
                    </defs>
                  </svg>
                </div>
              </div>
              <span class="element-category-card__label">Gráficas</span>
            </button>

            <button type="button" class="element-category-card" data-ref="btn-category-frames" data-category="frames">
              <div class="element-category-card__stack" data-ref="category-stack-frames">
                <div class="element-category-card__layer element-category-card__layer--back">
                  <svg class="element-category-card__svg" viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect x="6" y="6" width="60" height="60" rx="16" fill="url(#cva-grad-frames-back)" />
                    <rect x="18" y="18" width="36" height="36" rx="8" stroke="#ffffff" stroke-width="2" stroke-dasharray="4 4" opacity="0.4" />
                    <defs>
                      <linearGradient id="cva-grad-frames-back" x1="6" y1="6" x2="66" y2="66" gradientUnits="userSpaceOnUse">
                        <stop stop-color="#0284c7" />
                        <stop offset="1" stop-color="#0369a1" />
                      </linearGradient>
                    </defs>
                  </svg>
                </div>
                <div class="element-category-card__layer element-category-card__layer--front">
                  <svg class="element-category-card__svg" viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect x="6" y="6" width="60" height="60" rx="16" fill="url(#cva-grad-frames-front)" />
                    <rect x="6.5" y="6.5" width="59" height="59" rx="15.5" stroke="rgba(255,255,255,0.4)" stroke-width="1" />
                    <rect x="16" y="16" width="40" height="40" rx="8" fill="#ffffff" fill-opacity="0.9" />
                    <rect x="20" y="20" width="32" height="32" rx="4" fill="#38bdf8" />
                    <circle cx="28" cy="28" r="3" fill="#fef08a" />
                    <path d="M20 44 Q28 34 36 38 Q44 42 52 32 L52 52 L20 52 Z" fill="#679c16" />
                    <defs>
                      <linearGradient id="cva-grad-frames-front" x1="6" y1="6" x2="66" y2="66" gradientUnits="userSpaceOnUse">
                        <stop stop-color="#38bdf8" />
                        <stop offset="0.5" stop-color="#0284c7" />
                        <stop offset="1" stop-color="#0369a1" />
                      </linearGradient>
                    </defs>
                  </svg>
                </div>
              </div>
              <span class="element-category-card__label">Marcos</span>
            </button>

            <button type="button" class="element-category-card" data-ref="btn-category-grids" data-category="grids">
              <div class="element-category-card__stack" data-ref="category-stack-grids">
                <div class="element-category-card__layer element-category-card__layer--back">
                  <svg class="element-category-card__svg" viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect x="6" y="6" width="60" height="60" rx="16" fill="url(#cva-grad-grids-back)" />
                    <rect x="18" y="18" width="16" height="36" rx="4" fill="#ffffff" opacity="0.25" />
                    <rect x="38" y="18" width="16" height="36" rx="4" fill="#ffffff" opacity="0.25" />
                    <defs>
                      <linearGradient id="cva-grad-grids-back" x1="6" y1="6" x2="66" y2="66" gradientUnits="userSpaceOnUse">
                        <stop stop-color="#6366f1" />
                        <stop offset="1" stop-color="#4338ca" />
                      </linearGradient>
                    </defs>
                  </svg>
                </div>
                <div class="element-category-card__layer element-category-card__layer--front">
                  <svg class="element-category-card__svg" viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect x="6" y="6" width="60" height="60" rx="16" fill="url(#cva-grad-grids-front)" />
                    <rect x="6.5" y="6.5" width="59" height="59" rx="15.5" stroke="rgba(255,255,255,0.4)" stroke-width="1" />
                    <rect x="16" y="16" width="18" height="18" rx="4" fill="#ffffff" fill-opacity="0.9" />
                    <rect x="38" y="16" width="18" height="18" rx="4" fill="#c7d2fe" />
                    <rect x="16" y="38" width="18" height="18" rx="4" fill="#a5b4fc" />
                    <rect x="38" y="38" width="18" height="18" rx="4" fill="#ffffff" fill-opacity="0.9" />
                    <defs>
                      <linearGradient id="cva-grad-grids-front" x1="6" y1="6" x2="66" y2="66" gradientUnits="userSpaceOnUse">
                        <stop stop-color="#818cf8" />
                        <stop offset="0.5" stop-color="#6366f1" />
                        <stop offset="1" stop-color="#4f46e5" />
                      </linearGradient>
                    </defs>
                  </svg>
                </div>
              </div>
              <span class="element-category-card__label">Cuadrícula</span>
            </button>

            <button type="button" class="element-category-card" data-ref="btn-category-mockups" data-category="mockups">
              <div class="element-category-card__stack" data-ref="category-stack-mockups">
                <div class="element-category-card__layer element-category-card__layer--back">
                  <svg class="element-category-card__svg" viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect x="6" y="6" width="60" height="60" rx="16" fill="url(#cva-grad-mockups-back)" />
                    <rect x="16" y="24" width="40" height="26" rx="4" fill="#ffffff" opacity="0.3" />
                    <defs>
                      <linearGradient id="cva-grad-mockups-back" x1="6" y1="6" x2="66" y2="66" gradientUnits="userSpaceOnUse">
                        <stop stop-color="#ec4899" />
                        <stop offset="1" stop-color="#be185d" />
                      </linearGradient>
                    </defs>
                  </svg>
                </div>
                <div class="element-category-card__layer element-category-card__layer--front">
                  <svg class="element-category-card__svg" viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect x="6" y="6" width="60" height="60" rx="16" fill="url(#cva-grad-mockups-front)" />
                    <rect x="6.5" y="6.5" width="59" height="59" rx="15.5" stroke="rgba(255,255,255,0.4)" stroke-width="1" />
                    <rect x="15" y="22" width="34" height="22" rx="3" fill="#ffffff" fill-opacity="0.85" />
                    <rect x="18" y="25" width="28" height="16" rx="1" fill="#38bdf8" />
                    <path d="M12 44H52C53.1 44 54 44.9 54 46V47H10V46C10 44.9 10.9 44 12 44Z" fill="#e2e8f0" />
                    <rect x="42" y="26" width="16" height="28" rx="4" fill="#1e293b" />
                    <rect x="43.5" y="28" width="13" height="24" rx="2.5" fill="#fb7185" />
                    <circle cx="50" cy="50" r="1" fill="#ffffff" />
                    <defs>
                      <linearGradient id="cva-grad-mockups-front" x1="6" y1="6" x2="66" y2="66" gradientUnits="userSpaceOnUse">
                        <stop stop-color="#f43f5e" />
                        <stop offset="0.5" stop-color="#e11d48" />
                        <stop offset="1" stop-color="#be123c" />
                      </linearGradient>
                    </defs>
                  </svg>
                </div>
              </div>
              <span class="element-category-card__label">Mockups</span>
            </button>

            <button type="button" class="element-category-card" data-ref="btn-category-3d" data-category="3d">
              <div class="element-category-card__stack" data-ref="category-stack-3d">
                <div class="element-category-card__layer element-category-card__layer--back">
                  <svg class="element-category-card__svg" viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect x="6" y="6" width="60" height="60" rx="16" fill="url(#cva-grad-3d-back)" />
                    <circle cx="36" cy="36" r="18" stroke="#ffffff" stroke-width="2" stroke-dasharray="4 4" opacity="0.35" />
                    <defs>
                      <linearGradient id="cva-grad-3d-back" x1="6" y1="6" x2="66" y2="66" gradientUnits="userSpaceOnUse">
                        <stop stop-color="#14b8a6" />
                        <stop offset="1" stop-color="#0f766e" />
                      </linearGradient>
                    </defs>
                  </svg>
                </div>
                <div class="element-category-card__layer element-category-card__layer--front">
                  <svg class="element-category-card__svg" viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect x="6" y="6" width="60" height="60" rx="16" fill="url(#cva-grad-3d-front)" />
                    <rect x="6.5" y="6.5" width="59" height="59" rx="15.5" stroke="rgba(255,255,255,0.4)" stroke-width="1" />
                    <g transform="translate(36, 36)">
                      <path d="M0 -18L16 -9L0 0L-16 -9Z" fill="#a7f3d0" />
                      <path d="M-16 -9L0 0V18L-16 9Z" fill="#34d399" />
                      <path d="M0 0L16 -9V9L0 18Z" fill="#059669" />
                    </g>
                    <defs>
                      <linearGradient id="cva-grad-3d-front" x1="6" y1="6" x2="66" y2="66" gradientUnits="userSpaceOnUse">
                        <stop stop-color="#10b981" />
                        <stop offset="0.5" stop-color="#059669" />
                        <stop offset="1" stop-color="#047857" />
                      </linearGradient>
                    </defs>
                  </svg>
                </div>
              </div>
              <span class="element-category-card__label">Elementos 3D</span>
            </button>

            <button type="button" class="element-category-card" data-ref="btn-category-pixel-grid" data-category="pixel-grid">
              <div class="element-category-card__stack" data-ref="category-stack-pixel-grid">
                <div class="element-category-card__layer element-category-card__layer--back">
                  <svg class="element-category-card__svg" viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect x="6" y="6" width="60" height="60" rx="16" fill="url(#cva-grad-pixel-back)" />
                    <defs>
                      <linearGradient id="cva-grad-pixel-back" x1="6" y1="6" x2="66" y2="66" gradientUnits="userSpaceOnUse">
                        <stop stop-color="#8b5cf6" />
                        <stop offset="1" stop-color="#6d28d9" />
                      </linearGradient>
                    </defs>
                  </svg>
                </div>
                <div class="element-category-card__layer element-category-card__layer--front">
                  <svg class="element-category-card__svg" viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect x="6" y="6" width="60" height="60" rx="16" fill="url(#cva-grad-pixel-front)" />
                    <rect x="6.5" y="6.5" width="59" height="59" rx="15.5" stroke="rgba(255,255,255,0.4)" stroke-width="1" />
                    <rect x="18" y="18" width="8" height="8" rx="1" fill="#ffffff" />
                    <rect x="28" y="18" width="8" height="8" rx="1" fill="#c4b5fd" />
                    <rect x="38" y="18" width="8" height="8" rx="1" fill="#ffffff" />
                    <rect x="48" y="18" width="8" height="8" rx="1" fill="#a78bfa" />
                    <rect x="18" y="28" width="8" height="8" rx="1" fill="#c4b5fd" />
                    <rect x="28" y="28" width="8" height="8" rx="1" fill="#7c3aed" />
                    <rect x="38" y="28" width="8" height="8" rx="1" fill="#7c3aed" />
                    <rect x="48" y="28" width="8" height="8" rx="1" fill="#c4b5fd" />
                    <rect x="18" y="38" width="8" height="8" rx="1" fill="#ffffff" />
                    <rect x="28" y="38" width="8" height="8" rx="1" fill="#7c3aed" />
                    <rect x="38" y="38" width="8" height="8" rx="1" fill="#7c3aed" />
                    <rect x="48" y="38" width="8" height="8" rx="1" fill="#ffffff" />
                    <rect x="18" y="48" width="8" height="8" rx="1" fill="#a78bfa" />
                    <rect x="28" y="48" width="8" height="8" rx="1" fill="#c4b5fd" />
                    <rect x="38" y="48" width="8" height="8" rx="1" fill="#ffffff" />
                    <rect x="48" y="48" width="8" height="8" rx="1" fill="#c4b5fd" />
                    <defs>
                      <linearGradient id="cva-grad-pixel-front" x1="6" y1="6" x2="66" y2="66" gradientUnits="userSpaceOnUse">
                        <stop stop-color="#a855f7" />
                        <stop offset="0.5" stop-color="#8b5cf6" />
                        <stop offset="1" stop-color="#6d28d9" />
                      </linearGradient>
                    </defs>
                  </svg>
                </div>
              </div>
              <span class="element-category-card__label">Píxel Art</span>
            </button>
          </div>
        </div>
      `;

      contentContainer.querySelectorAll<HTMLButtonElement>('[data-category]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const cat = btn.getAttribute('data-category') as 'shapes' | 'stickers' | 'stickies' | 'diagrams' | 'tables' | 'charts' | 'frames' | 'grids' | 'mockups' | '3d' | 'pixel-grid';
          if (cat === 'charts') {
            openChartInspectorInDrawer();
            return;
          }
          if (cat === 'pixel-grid') {
            const controller = getActiveCanvasController();
            openInsertPixelGridModal({
              onInsert: (cfg) => {
                controller?.insertPixelGrid?.(cfg);
              },
            });
            return;
          }
          if (cat) {
            activeElementsCategory = cat;
            renderContent('');
          }
        });
      });

      bindItemClicks(contentContainer);
      renderIcons(contentContainer);
      return;
    }

    let backTitle = 'Formas';
    if (activeElementsCategory === 'stickers') backTitle = 'Figuras';
    if (activeElementsCategory === 'stickies') backTitle = 'Notas adhesivas';
    if (activeElementsCategory === 'diagrams') backTitle = 'Diagramas';
    if (activeElementsCategory === 'tables') backTitle = 'Tablas';
    if (activeElementsCategory === 'charts') backTitle = 'Gráficas';
    if (activeElementsCategory === 'frames') backTitle = 'Marcos';
    if (activeElementsCategory === 'grids') backTitle = 'Cuadrícula';
    if (activeElementsCategory === 'mockups') backTitle = 'Mockups';
    if (activeElementsCategory === '3d') backTitle = 'Elementos 3D';

    let html = `
      <button type="button" class="elements-back-btn" data-ref="btn-elements-back">
        <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#arrow_back"></use></svg>
        <span>Volver a categorías (${escapeHtml(backTitle)})</span>
      </button>
      <div class="elements-grid" data-ref="elements-grid">
    `;

    if (activeElementsCategory === 'shapes') {
      const vectorShapes = PIXEL_SHAPES.filter((s) => s.category === 'shapes' && s.type === 'vector');
      const assignedShapeIds = new Set<string>();

      SHAPE_SECTIONS.forEach((sec) => {
        const matching = vectorShapes.filter((s) => {
          const rawKey = s.id.replace(/^shape_/, '');
          return sec.prefixes.includes(rawKey) || sec.prefixes.some((p) => rawKey.startsWith(p));
        });

        if (matching.length > 0) {
          matching.forEach((s) => assignedShapeIds.add(s.id));
          html += `<div class="elements-section-title">${escapeHtml(sec.label)}</div>`;
          html += matching.map((item) => `
            <button type="button" class="element-grid-item" data-ref="btn-element-item-${item.id}" data-element-id="${item.id}" data-tooltip="${escapeHtml(item.name)}" aria-label="${escapeHtml(item.name)}">
              <svg viewBox="0 0 48 48" aria-hidden="true"><path d="${item.pathD || ''}" fill="currentColor" /></svg>
            </button>
          `).join('');
        }
      });

      const remainingShapes = vectorShapes.filter((s) => !assignedShapeIds.has(s.id));
      if (remainingShapes.length > 0) {
        html += '<div class="elements-section-title">Otras formas</div>';
        html += remainingShapes.map((item) => `
          <button type="button" class="element-grid-item" data-ref="btn-element-item-${item.id}" data-element-id="${item.id}" data-tooltip="${escapeHtml(item.name)}" aria-label="${escapeHtml(item.name)}">
            <svg viewBox="0 0 48 48" aria-hidden="true"><path d="${item.pathD || ''}" fill="currentColor" /></svg>
          </button>
        `).join('');
      }
    } else if (activeElementsCategory === 'stickers') {
      const stickers = PIXEL_SHAPES.filter((s) => s.type === 'sticker');
      html += stickers.map((item) => `
        <button type="button" class="element-grid-item" data-ref="btn-element-item-${item.id}" data-element-id="${item.id}" data-tooltip="${escapeHtml(item.name)}" aria-label="${escapeHtml(item.name)}">
          <img src="/assets/img/stickers/${item.file}" alt="${escapeHtml(item.name)}" loading="lazy" />
        </button>
      `).join('');
    } else if (activeElementsCategory === 'stickies') {
      html += STICKY_NOTE_PRESETS.map((item) => `
        <button type="button" class="element-grid-item element-grid-item--diagram" data-ref="btn-sticky-item-${item.id}" data-sticky-id="${item.id}" data-tooltip="${escapeHtml(item.name)}" aria-label="${escapeHtml(item.name)}">
          <div style="background-color: ${item.color}; border: 1.5px solid ${item.stroke}; border-radius: 6px; width: 34px; height: 34px; box-shadow: 0 2px 6px rgba(0,0,0,0.1); display: flex; align-items: center; justify-content: center;">
            <span style="font-size: 9px; font-weight: 700; color: #1e293b;">Aa</span>
          </div>
          <span class="element-grid-item__label">${escapeHtml(item.name)}</span>
        </button>
      `).join('');
    } else if (activeElementsCategory === 'diagrams') {
      const categories: Array<{ key: string; label: string }> = [
        { key: 'flowchart', label: 'Diagramas de Flujo' },
        { key: 'mindmap', label: 'Mapas Mentales & Conceptuales' },
        { key: 'cloud_data', label: 'Arquitectura Cloud & Infra' },
        { key: 'structure', label: 'Estructura & Organización' },
        { key: 'connectors', label: 'Conectores & Flechas' },
        { key: 'stickies', label: 'Notas Adhesivas' },
      ];

      categories.forEach((cat) => {
        const catItems = DIAGRAM_COMPONENTS.filter((item) => item.category === cat.key);
        if (catItems.length === 0) return;
        html += `<div class="elements-section-title">${escapeHtml(cat.label)}</div>`;
        html += catItems.map((item) => `
          <button type="button" class="element-grid-item element-grid-item--diagram" data-ref="btn-diagram-item-${item.id}" data-diagram-id="${item.id}" data-tooltip="${escapeHtml(item.description || item.name)}" aria-label="${escapeHtml(item.name)}">
            <svg viewBox="0 0 48 48" aria-hidden="true">${item.previewSvg}</svg>
            <span class="element-grid-item__label">${escapeHtml(item.name)}</span>
          </button>
        `).join('');
      });
    } else if (activeElementsCategory === 'tables') {
      html += '<div class="elements-section-title">Tablas predeterminadas</div>';
      html += TABLE_PRESETS.map((item) => `
        <button type="button" class="element-grid-item element-grid-item--diagram" data-ref="btn-table-item-${item.id}" data-table-rows="${item.rows}" data-table-cols="${item.cols}" data-tooltip="${escapeHtml(item.description)}" aria-label="${escapeHtml(item.name)}">
          <svg viewBox="0 0 48 48" aria-hidden="true" style="width: 32px; height: 32px;">
            <rect x="6" y="8" width="36" height="32" rx="4" fill="none" stroke="#0284c7" stroke-width="2" />
            <rect x="6" y="8" width="36" height="10" rx="4" fill="#38bdf8" fill-opacity="0.3" stroke="#0284c7" stroke-width="1.5" />
            <line x1="6" y1="28" x2="42" y2="28" stroke="#cbd5e1" stroke-width="1.5" />
            <line x1="18" y1="8" x2="18" y2="40" stroke="#cbd5e1" stroke-width="1.5" />
            <line x1="30" y1="8" x2="30" y2="40" stroke="#cbd5e1" stroke-width="1.5" />
          </svg>
          <span class="element-grid-item__label">${escapeHtml(item.name)}</span>
        </button>
      `).join('');

      html += `
        <div class="elements-section-title" style="margin-top: 16px;">Tabla personalizada</div>
        <div style="grid-column: 1 / -1; display: flex; flex-direction: column; gap: 8px; padding: 4px 2px;">
          <div style="display: flex; gap: 8px;">
            <label class="field" style="flex: 1;">
              <span class="field__label">Filas</span>
              <input class="field__input" data-ref="input-custom-table-rows" type="number" min="1" max="15" value="3" />
            </label>
            <label class="field" style="flex: 1;">
              <span class="field__label">Columnas</span>
              <input class="field__input" data-ref="input-custom-table-cols" type="number" min="1" max="10" value="3" />
            </label>
          </div>
          <button type="button" class="component-button component-button--h36 component-button--black component-button--w-full" data-ref="btn-insert-custom-table">
            <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#add"></use></svg>
            <span>Insertar tabla</span>
          </button>
        </div>
      `;
    } else if (activeElementsCategory === 'charts') {
      html += '<div class="elements-section-title">Tipos de gráficas</div>';
      html += CHART_CATALOG.map((item) => `
        <button type="button" class="element-grid-item element-grid-item--diagram" data-ref="btn-chart-item-${item.type}" data-chart-type="${item.type}" data-tooltip="${escapeHtml(item.description)}" aria-label="${escapeHtml(item.name)}">
          <div style="width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; pointer-events: none;">
            ${item.iconSvg}
          </div>
          <span class="element-grid-item__label">${escapeHtml(item.name)}</span>
        </button>
      `).join('');
    } else if (activeElementsCategory === 'frames') {
      html += `
        <div class="mockup-category-tabs" style="grid-column: 1 / -1; margin-bottom: 6px;">
          <button type="button" class="mockup-category-pill ${activeFramesFilter === 'all' ? 'is-active' : ''}" data-ref="frame-cat-pill-all" data-frame-cat="all">Todos</button>
          ${FRAME_CATEGORIES.map((c) => `
            <button type="button" class="mockup-category-pill ${activeFramesFilter === c.id ? 'is-active' : ''}" data-ref="frame-cat-pill-${c.id}" data-frame-cat="${c.id}">${escapeHtml(c.name)}</button>
          `).join('')}
        </div>
        <div class="elements-section-title">Marcos disponibles</div>
      `;
      let filteredFrames = FRAME_TEMPLATES;
      if (activeFramesFilter !== 'all') {
        filteredFrames = filteredFrames.filter((f) => f.category === activeFramesFilter);
      }
      if (cleanQ) {
        filteredFrames = filteredFrames.filter((f) => f.name.toLowerCase().includes(cleanQ) || f.description.toLowerCase().includes(cleanQ));
      }
      if (filteredFrames.length === 0) {
        html += '<div class="mockup-empty-state">No se encontraron marcos.</div>';
      } else {
        html += filteredFrames.map((tpl) => `
          <button type="button" class="element-grid-item element-grid-item--diagram" data-ref="btn-mockup-item-${tpl.id}" data-mockup-id="${tpl.id}" data-tooltip="${escapeHtml(tpl.description || tpl.name)}" aria-label="${escapeHtml(tpl.name)}">
            <div style="width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; overflow: hidden; pointer-events: none;">
              ${tpl.thumbnailSvg}
            </div>
            <span class="element-grid-item__label">${escapeHtml(tpl.name)}</span>
          </button>
        `).join('');
      }
    } else if (activeElementsCategory === 'grids') {
      html += '<div class="elements-section-title">Distribuciones y collages</div>';
      let filteredGrids = GRID_TEMPLATES;
      if (cleanQ) {
        filteredGrids = filteredGrids.filter((g) => g.name.toLowerCase().includes(cleanQ) || g.description.toLowerCase().includes(cleanQ));
      }
      if (filteredGrids.length === 0) {
        html += '<div class="mockup-empty-state">No se encontraron cuadrículas.</div>';
      } else {
        html += filteredGrids.map((tpl) => `
          <button type="button" class="element-grid-item element-grid-item--diagram" data-ref="btn-mockup-item-${tpl.id}" data-mockup-id="${tpl.id}" data-tooltip="${escapeHtml(tpl.description || tpl.name)}" aria-label="${escapeHtml(tpl.name)}">
            <div style="width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; overflow: hidden; pointer-events: none;">
              ${tpl.thumbnailSvg}
            </div>
            <span class="element-grid-item__label">${escapeHtml(tpl.name)}</span>
          </button>
        `).join('');
      }
    } else if (activeElementsCategory === 'mockups') {
      html += `
        <div style="grid-column: 1 / -1; margin-bottom: 4px;">
          <button type="button" class="component-button component-button--h36 component-button--secondary component-button--w-full" data-ref="btn-elements-open-mockups-panel">
            <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#devices"></use></svg>
            <span>Explorar catálogo de mockups</span>
          </button>
        </div>
        <div class="mockup-category-tabs" style="grid-column: 1 / -1; margin-bottom: 6px;">
          <button type="button" class="mockup-category-pill ${activeMockupsFilter === 'all' ? 'is-active' : ''}" data-ref="mockup-cat-pill-all" data-mockup-general-cat="all">Todos</button>
          ${MOCKUP_GENERAL_CATEGORIES.map((c) => `
            <button type="button" class="mockup-category-pill ${activeMockupsFilter === c.id ? 'is-active' : ''}" data-ref="mockup-cat-pill-${c.id}" data-mockup-general-cat="${c.id}">${escapeHtml(c.name)}</button>
          `).join('')}
        </div>
        <div class="elements-section-title">Maquetas disponibles</div>
      `;
      let filteredMockups = MOCKUP_TEMPLATES;
      if (activeMockupsFilter !== 'all') {
        filteredMockups = filteredMockups.filter((m) => m.category === activeMockupsFilter);
      }
      if (cleanQ) {
        filteredMockups = filteredMockups.filter((m) => m.name.toLowerCase().includes(cleanQ) || m.description.toLowerCase().includes(cleanQ));
      }
      if (filteredMockups.length === 0) {
        html += '<div class="mockup-empty-state">No se encontraron mockups.</div>';
      } else {
        html += filteredMockups.map((tpl) => `
          <button type="button" class="element-grid-item element-grid-item--diagram" data-ref="btn-mockup-item-${tpl.id}" data-mockup-id="${tpl.id}" data-tooltip="${escapeHtml(tpl.description || tpl.name)}" aria-label="${escapeHtml(tpl.name)}">
            <div style="width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; overflow: hidden; pointer-events: none;">
              ${tpl.thumbnailSvg}
            </div>
            <span class="element-grid-item__label">${escapeHtml(tpl.name)}</span>
          </button>
        `).join('');
      }
    } else if (activeElementsCategory === '3d') {
      html += '<div class="elements-section-title">Modelos e Ilustraciones 3D</div>';
      html += BOARD_3D_SHAPES.map((shape) => `
        <button type="button" class="element-grid-item element-grid-item--diagram" data-ref="btn-3d-item-${shape.id}" data-shape3d-id="${shape.id}" data-tooltip="${escapeHtml(shape.name)}" aria-label="${escapeHtml(shape.name)}">
          <div style="width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; background: rgba(99, 102, 241, 0.08); border-radius: 8px; color: #6366f1; pointer-events: none;">
            <svg class="component-icon" aria-hidden="true" style="width: 22px; height: 22px;"><use href="/icons.svg#${shape.icon}"></use></svg>
          </div>
          <span class="element-grid-item__label">${escapeHtml(shape.name)}</span>
        </button>
      `).join('');
    }

    html += '</div>';
    contentContainer.innerHTML = html;

    const btnBack = contentContainer.querySelector<HTMLButtonElement>('[data-ref="btn-elements-back"]');
    btnBack?.addEventListener('click', () => {
      activeElementsCategory = 'root';
      renderContent('');
    });

    bindItemClicks(contentContainer);
    renderIcons(contentContainer);
  };

  const bindItemClicks = (container: HTMLElement) => {
    container.querySelectorAll<HTMLButtonElement>('[data-frame-cat]').forEach((pill) => {
      pill.addEventListener('click', () => {
        activeFramesFilter = pill.getAttribute('data-frame-cat') as FrameCategory | 'all';
        renderContent(searchInput?.value || '');
      });
    });

    container.querySelectorAll<HTMLButtonElement>('[data-mockup-general-cat]').forEach((pill) => {
      pill.addEventListener('click', () => {
        activeMockupsFilter = pill.getAttribute('data-mockup-general-cat') as MockupGeneralCategory | 'all';
        renderContent(searchInput?.value || '');
      });
    });

    container.querySelectorAll<HTMLButtonElement>('[data-element-id]').forEach((itemBtn) => {
      itemBtn.addEventListener('click', () => {
        const elId = itemBtn.getAttribute('data-element-id');
        const found = PIXEL_SHAPES.find((s) => s.id === elId);
        if (found) {
          handleApplyCanvasElement(found, canvasType);
        }
      });
    });

    container.querySelectorAll<HTMLButtonElement>('[data-diagram-id]').forEach((itemBtn) => {
      itemBtn.addEventListener('click', () => {
        const diagId = itemBtn.getAttribute('data-diagram-id');
        const found = DIAGRAM_COMPONENTS.find((d) => d.id === diagId);
        if (found) {
          handleApplyDiagramComponent(found, canvasType);
        }
      });
    });

    container.querySelectorAll<HTMLButtonElement>('[data-sticky-id]').forEach((itemBtn) => {
      itemBtn.addEventListener('click', () => {
        const stkId = itemBtn.getAttribute('data-sticky-id');
        const found = STICKY_NOTE_PRESETS.find((s) => s.id === stkId);
        if (found) {
          handleApplyStickyPreset(found, canvasType);
        }
      });
    });

    container.querySelectorAll<HTMLButtonElement>('[data-recent-id]').forEach((itemBtn) => {
      itemBtn.addEventListener('click', () => {
        const recId = itemBtn.getAttribute('data-recent-id');
        const recents = getRecentElements();
        const found = recents.find((r) => r.id === recId);
        if (found) {
          handleApplyRecentElement(found, canvasType);
        }
      });
    });

    container.querySelectorAll<HTMLButtonElement>('[data-chart-type]').forEach((itemBtn) => {
      itemBtn.addEventListener('click', () => {
        const chartType = itemBtn.getAttribute('data-chart-type') as ChartType;
        if (chartType) {
          handleApplyChart(chartType, canvasType);
        }
      });
    });

    container.querySelectorAll<HTMLButtonElement>('[data-shape3d-id]').forEach((itemBtn) => {
      itemBtn.addEventListener('click', () => {
        const shapeId = itemBtn.getAttribute('data-shape3d-id') as Shape3DType;
        if (shapeId) {
          handleApply3DShape(shapeId, canvasType);
        }
      });
    });

    container.querySelectorAll<HTMLButtonElement>('[data-mockup-id]').forEach((itemBtn) => {
      itemBtn.addEventListener('click', () => {
        const mockupId = itemBtn.getAttribute('data-mockup-id');
        const tpl = ALL_MOCKUP_ITEMS.find((m) => m.id === mockupId);
        if (tpl) {
          handleApplyMockup(tpl, canvasType);
        }
      });
    });

    container.querySelectorAll<HTMLButtonElement>('[data-table-rows]').forEach((itemBtn) => {
      itemBtn.addEventListener('click', () => {
        const rows = parseInt(itemBtn.getAttribute('data-table-rows') || '3', 10);
        const cols = parseInt(itemBtn.getAttribute('data-table-cols') || '3', 10);
        handleApplyTable(rows, cols, canvasType);
      });
    });

    const btnCustomTable = container.querySelector<HTMLButtonElement>('[data-ref="btn-insert-custom-table"]');
    btnCustomTable?.addEventListener('click', () => {
      const inputRows = container.querySelector<HTMLInputElement>('[data-ref="input-custom-table-rows"]');
      const inputCols = container.querySelector<HTMLInputElement>('[data-ref="input-custom-table-cols"]');
      const rows = Math.min(15, Math.max(1, parseInt(inputRows?.value || '3', 10) || 3));
      const cols = Math.min(10, Math.max(1, parseInt(inputCols?.value || '3', 10) || 3));
      handleApplyTable(rows, cols, canvasType);
    });

    const btnOpenMockups = container.querySelector<HTMLButtonElement>('[data-ref="btn-elements-open-mockups-panel"]');
    btnOpenMockups?.addEventListener('click', () => {
      const controller = getActiveCanvasController();
      controller?.openMockupsPanel?.();
    });
  };

  searchInput?.addEventListener('input', () => {
    renderContent(searchInput.value);
  });

  renderContent();

  const drawerFooter = drawer.querySelector<HTMLElement>('[data-ref="drawer-footer"]');
  if (drawerFooter) {
    drawerFooter.style.display = 'none';
  }

  if (sidebar) {
    updateCanvasRailActiveState(sidebar);
  }

  renderIcons(drawerBody);
}

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  if (i === 0) return `${bytes} B`;
  const rawValue = bytes / Math.pow(1024, i);
  const formatted = rawValue % 1 === 0 ? rawValue.toString() : rawValue.toFixed(rawValue >= 100 || i >= 3 ? 1 : 2);
  return `${formatted} ${units[i]}`;
}

function handleApplyCanvasUpload(item: UserUploadItem, canvasType: 'board' | 'doc' | 'presentation'): void {
  const controller = getActiveCanvasController();

  if (canvasType === 'doc') {
    if (!controller) {
      showToast('No se encontró el controlador del documento', 'warning');
      return;
    }

    controller.insertImage(item.url, item.original_filename);
    showToast(`«${item.original_filename}» insertada en el documento`, 'success');
    if (window.innerWidth <= 768) {
      toggleDrawer(false);
    }
    return;
  }

  if (canvasType === 'board' || canvasType === 'presentation') {
    if (!controller) {
      showToast('No se encontró el controlador del lienzo', 'warning');
      return;
    }

    controller.insertImage?.(item.url, item.width || undefined, item.height || undefined, item.original_filename);
    showToast(`«${item.original_filename}» añadida al lienzo`, 'success');
    if (window.innerWidth <= 768) {
      toggleDrawer(false);
    }
    return;
  }
}

function renderUploadsDrawerContent(drawer: HTMLElement, drawerBody: HTMLElement): void {
  const sidebar = drawer.closest<HTMLElement>('[data-ref="sidebar"]') || document.querySelector<HTMLElement>('[data-ref="sidebar"]');
  const canvasType = getActiveCanvasType();

  drawerBody.innerHTML = `
    <div class="canvas-panel-card" data-ref="canvas-panel-card">
      <div class="canvas-panel-card__header" data-ref="canvas-panel-header">
        <div class="canvas-panel-card__title-box" data-ref="canvas-panel-title-box">
          <svg class="component-icon canvas-panel-card__icon" aria-hidden="true"><use href="/icons.svg#cloud_upload"></use></svg>
          <span class="canvas-panel-card__title" data-ref="canvas-panel-title">${t('nav.uploads') || 'Subidos'}</span>
        </div>
        <div style="display: flex; align-items: center; gap: 4px;">
          <button type="button" class="component-button component-button--h32 component-button--icon-only rail-btn" data-ref="btn-upload-file-trigger" data-tooltip="Subir imagen" aria-label="Subir imagen">
            <svg class="component-icon rail-btn__icon" aria-hidden="true"><use href="/icons.svg#add"></use></svg>
          </button>
          <button type="button" class="component-button component-button--h32 component-button--icon-only rail-btn canvas-panel-card__close" data-ref="btn-close-canvas-panel" data-tooltip="Cerrar panel" aria-label="Cerrar panel">
            <svg class="component-icon rail-btn__icon" aria-hidden="true"><use href="/icons.svg#close"></use></svg>
          </button>
        </div>
      </div>
      <div class="canvas-panel-card__body" data-ref="canvas-panel-body">
        <input class="canvas-upload-file-input" data-ref="canvas-upload-file-input" type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml" multiple style="display: none;" />

        <div class="menu-panel__search" data-ref="canvas-uploads-search">
          <svg class="component-icon menu-panel__search-icon" aria-hidden="true"><use href="/icons.svg#search"></use></svg>
          <input class="menu-panel__search-input" data-ref="canvas-uploads-search-input" type="text" maxlength="50" autocomplete="off" placeholder="Buscar subidos..." />
        </div>

        <div class="elements-grid" data-ref="canvas-uploads-grid">
          <div class="skeleton" style="aspect-ratio: 1 / 1; border-radius: 8px;"></div>
          <div class="skeleton" style="aspect-ratio: 1 / 1; border-radius: 8px;"></div>
          <div class="skeleton" style="aspect-ratio: 1 / 1; border-radius: 8px;"></div>
          <div class="skeleton" style="aspect-ratio: 1 / 1; border-radius: 8px;"></div>
          <div class="skeleton" style="aspect-ratio: 1 / 1; border-radius: 8px;"></div>
          <div class="skeleton" style="aspect-ratio: 1 / 1; border-radius: 8px;"></div>
          <div class="skeleton" style="aspect-ratio: 1 / 1; border-radius: 8px;"></div>
          <div class="skeleton" style="aspect-ratio: 1 / 1; border-radius: 8px;"></div>
          <div class="skeleton" style="aspect-ratio: 1 / 1; border-radius: 8px;"></div>
        </div>
      </div>
    </div>
  `;

  const btnClose = drawerBody.querySelector<HTMLElement>('[data-ref="btn-close-canvas-panel"]');
  btnClose?.addEventListener('click', (e) => {
    e.preventDefault();
    toggleDrawer(false);
  });

  const btnUploadTrigger = drawerBody.querySelector<HTMLButtonElement>('[data-ref="btn-upload-file-trigger"]');
  const fileInput = drawerBody.querySelector<HTMLInputElement>('[data-ref="canvas-upload-file-input"]');
  const searchInput = drawerBody.querySelector<HTMLInputElement>('[data-ref="canvas-uploads-search-input"]');
  const grid = drawerBody.querySelector<HTMLElement>('[data-ref="canvas-uploads-grid"]');

  let uploads: UserUploadItem[] = [];
  let isUploading = false;

  const renderGrid = (query = '') => {
    if (!grid) return;
    const cleanQ = query.trim().toLowerCase();
    const filtered = cleanQ
      ? uploads.filter((u) => u.original_filename.toLowerCase().includes(cleanQ))
      : uploads;

    if (filtered.length === 0) {
      if (uploads.length === 0) {
        grid.innerHTML = `
          <div class="canvas-panel-card__empty" style="grid-column: 1 / -1;" data-ref="canvas-uploads-empty">
            <div class="canvas-panel-card__empty-icon">
              <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#cloud_upload"></use></svg>
            </div>
            <span class="canvas-panel-card__empty-title">Aún no tienes archivos subidos</span>
            <p class="canvas-panel-card__empty-desc">Sube fotos o imágenes para colocarlas en tus lienzos.</p>
            <button type="button" class="component-button component-button--h36 component-button--black" data-ref="btn-upload-empty-trigger" style="margin-top: 8px;">
              <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#add"></use></svg>
              <span>Subir imagen</span>
            </button>
          </div>
        `;
        const btnEmptyUpload = grid.querySelector<HTMLButtonElement>('[data-ref="btn-upload-empty-trigger"]');
        btnEmptyUpload?.addEventListener('click', () => {
          fileInput?.click();
        });
      } else {
        grid.innerHTML = `
          <div class="canvas-panel-card__empty" style="grid-column: 1 / -1;" data-ref="canvas-uploads-no-results">
            <span class="canvas-panel-card__empty-title">Sin resultados</span>
            <p class="canvas-panel-card__empty-desc">No se encontraron archivos que coincidan con «${escapeHtml(query)}»</p>
          </div>
        `;
      }
      renderIcons(grid);
      return;
    }

    grid.innerHTML = filtered.map((item) => `
      <button type="button" class="element-grid-item" data-ref="btn-upload-item-${item.uuid}" data-upload-uuid="${item.uuid}" data-tooltip="${escapeHtml(item.original_filename)}" aria-label="${escapeHtml(item.original_filename)}">
        <img class="canvas-upload-img image-lazy-fade" data-ref="img-upload-${item.uuid}" src="${escapeHtml(item.url)}" alt="${escapeHtml(item.original_filename)}" loading="lazy" decoding="async" onload="this.classList.add('image-loaded')" onerror="this.classList.add('image-loaded')" />
        <button type="button" class="canvas-upload-card__delete" data-ref="btn-delete-upload-${item.uuid}" data-delete-uuid="${item.uuid}" data-tooltip="Eliminar imagen" aria-label="Eliminar imagen">
          <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#delete"></use></svg>
        </button>
      </button>
    `).join('');

    renderIcons(grid);

    grid.querySelectorAll<HTMLElement>('.element-grid-item').forEach((card) => {
      card.addEventListener('click', (e) => {
        const target = e.target as HTMLElement | null;
        if (target?.closest('[data-delete-uuid]')) return;
        const uuid = card.getAttribute('data-upload-uuid');
        const found = uploads.find((u) => u.uuid === uuid);
        if (found) {
          handleApplyCanvasUpload(found, canvasType);
        }
      });
    });

    grid.querySelectorAll<HTMLButtonElement>('[data-delete-uuid]').forEach((btnDel) => {
      btnDel.addEventListener('click', (e) => {
        e.stopPropagation();
        const uuid = btnDel.getAttribute('data-delete-uuid');
        const found = uploads.find((u) => u.uuid === uuid);
        if (!found) return;

        const modal = openModal({
          cancelText: 'Cancelar',
          confirmClass: 'component-button--danger',
          confirmText: 'Eliminar',
          description: `¿Estás seguro de que deseas eliminar «${found.original_filename}»? Esta acción liberará espacio de tu cuenta.`,
          showCancel: true,
          showConfirm: true,
          title: 'Eliminar archivo subido',
          onConfirm: async () => {
            const res = await deleteUploadApi(found.uuid);
            if (res.success) {
              showToast('Archivo eliminado con éxito', 'success');
              uploads = uploads.filter((u) => u.uuid !== found.uuid);
              renderGrid(searchInput?.value || '');
            } else {
              showToast(res.message || 'Error al eliminar el archivo.', 'danger');
            }
          },
        });
      });
    });
  };

  const handleFiles = async (files: FileList | File[]) => {
    if (!currentUser) {
      showToast('Debes iniciar sesión para subir fotos.', 'warning');
      return;
    }
    const validation = validateAndSanitizeFiles(files, { maxMb: 15 });
    if (!validation.valid) {
      showToast(validation.error || 'Por favor selecciona archivos de imagen válidos (PNG, JPEG, WebP, GIF, SVG).', 'warning');
      return;
    }

    if (isUploading) return;
    isUploading = true;
    showToast('Subiendo archivo(s)...', 'info');

    const railUploadBtns = document.querySelectorAll<HTMLElement>('[data-ref="btn-rail-canvas-uploads"]');
    railUploadBtns.forEach((b) => b.classList.add('is-uploading'));
    if (btnUploadTrigger) {
      btnUploadTrigger.disabled = true;
    }

    if (grid && uploads.length > 0) {
      const placeholder = document.createElement('div');
      placeholder.className = 'element-grid-item';
      placeholder.setAttribute('data-ref', 'upload-item-placeholder');
      placeholder.innerHTML = `
        <div class="skeleton" style="width: 100%; height: 100%; border-radius: 6px; display: flex; align-items: center; justify-content: center;">
          <svg class="component-icon" style="width: 18px; height: 18px; animation: railBtnUploadSpin 0.75s linear infinite; color: var(--accent-pink);" aria-hidden="true"><use href="/icons.svg#sync"></use></svg>
        </div>
      `;
      grid.prepend(placeholder);
    }

    try {
      const res = await uploadFilesApi(validation.files);
      if (res.success) {
        showToast(res.message || 'Archivos subidos correctamente.', 'success');
        if (res.uploads && res.uploads.length > 0) {
          uploads = [...res.uploads, ...uploads];
        }
        renderGrid(searchInput?.value || '');
      } else {
        showToast(res.message || 'Error al subir los archivos.', 'danger');
        renderGrid(searchInput?.value || '');
      }
    } catch {
      showToast('Error al subir los archivos.', 'danger');
      renderGrid(searchInput?.value || '');
    } finally {
      isUploading = false;
      railUploadBtns.forEach((b) => b.classList.remove('is-uploading'));
      if (btnUploadTrigger) {
        btnUploadTrigger.disabled = false;
      }
    }
  };

  btnUploadTrigger?.addEventListener('click', () => {
    fileInput?.click();
  });

  fileInput?.addEventListener('change', () => {
    if (fileInput.files && fileInput.files.length > 0) {
      void handleFiles(fileInput.files);
      fileInput.value = '';
    }
  });

  drawerBody.addEventListener('dragover', (e) => {
    e.preventDefault();
  });

  drawerBody.addEventListener('drop', (e) => {
    e.preventDefault();
    if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
      void handleFiles(e.dataTransfer.files);
    }
  });

  searchInput?.addEventListener('input', () => {
    renderGrid(searchInput.value);
  });

  if (!currentUser) {
    uploads = [];
    renderGrid();
  } else {
    void getUploadsApi().then((res) => {
      if (res.success) {
        uploads = res.uploads || [];
      } else {
        uploads = [];
      }
      renderGrid(searchInput?.value || '');
    });
  }

  const drawerFooter = drawer.querySelector<HTMLElement>('[data-ref="drawer-footer"]');
  if (drawerFooter) {
    drawerFooter.style.display = 'none';
  }

  if (sidebar) {
    updateCanvasRailActiveState(sidebar);
  }

  renderIcons(drawerBody);
}

function renderYouTubeAppContent(drawer: HTMLElement, drawerBody: HTMLElement): void {
  const sidebar = drawer.closest<HTMLElement>('[data-ref="sidebar"]') || document.querySelector<HTMLElement>('[data-ref="sidebar"]');

  drawerBody.innerHTML = `
    <div class="canvas-panel-card" data-ref="canvas-panel-card">
      <div class="canvas-panel-card__header" data-ref="canvas-panel-header">
        <div class="canvas-panel-card__title-box" data-ref="canvas-panel-title-box">
          <svg class="canvas-panel-card__icon" viewBox="0 0 24 24" aria-hidden="true" style="fill: #ef4444;"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
          <span class="canvas-panel-card__title" data-ref="canvas-panel-title">YouTube</span>
        </div>
        <button type="button" class="component-button component-button--h32 component-button--icon-only rail-btn canvas-panel-card__close" data-ref="btn-close-canvas-panel" data-tooltip="Cerrar panel" aria-label="Cerrar panel">
          <svg class="component-icon rail-btn__icon" aria-hidden="true"><use href="/icons.svg#close"></use></svg>
        </button>
      </div>
      <div class="canvas-panel-card__body youtube-drawer-body" data-ref="canvas-panel-body">
        <button type="button" class="elements-back-btn" data-ref="btn-apps-back" style="margin-bottom: 12px;">
          <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#arrow_back"></use></svg>
          <span>Volver a Apps</span>
        </button>

        <div class="menu-panel__search" data-ref="youtube-search-wrapper">
          <svg class="component-icon menu-panel__search-icon" aria-hidden="true"><use href="/icons.svg#search"></use></svg>
          <input class="menu-panel__search-input" data-ref="youtube-search-input" type="text" maxlength="80" autocomplete="off" placeholder="Buscar en YouTube..." />
        </div>

        <div class="youtube-chips-row" data-ref="youtube-chips">
          <button type="button" class="mockup-category-pill" data-ref="chip-yt-spriteboard" data-query="Spriteboard">Spriteboard</button>
          <button type="button" class="mockup-category-pill" data-ref="chip-yt-tutorial" data-query="Diseño tutorial">Tutorial</button>
          <button type="button" class="mockup-category-pill" data-ref="chip-yt-music" data-query="Musica lofi">Música</button>
          <button type="button" class="mockup-category-pill" data-ref="chip-yt-pixel" data-query="Pixel art speedpaint">Pixel Art</button>
          <button type="button" class="mockup-category-pill" data-ref="chip-yt-animation" data-query="2D Animation">Animación</button>
        </div>

        <div class="youtube-results-container" data-ref="youtube-results-container">
          <div class="youtube-initial-state" data-ref="youtube-initial-state">
            <div class="youtube-initial-icon" data-ref="youtube-initial-icon">
              <svg viewBox="0 0 24 24" aria-hidden="true" style="width: 44px; height: 44px; fill: #ef4444;"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
            </div>
            <span class="youtube-initial-title" data-ref="youtube-initial-title">Busca videos en YouTube</span>
            <span class="youtube-initial-desc" data-ref="youtube-initial-desc">Escribe en el buscador o pulsa una sugerencia para encontrar e insertar videos en tu lienzo.</span>
          </div>
        </div>
      </div>
    </div>
  `;

  const btnBack = drawerBody.querySelector<HTMLButtonElement>('[data-ref="btn-apps-back"]');
  btnBack?.addEventListener('click', () => {
    activeAppId = null;
    renderAppsDrawerContent(drawer, drawerBody);
  });

  const btnClose = drawerBody.querySelector<HTMLElement>('[data-ref="btn-close-canvas-panel"]');
  btnClose?.addEventListener('click', (e) => {
    e.preventDefault();
    toggleDrawer(false);
  });

  const searchInput = drawerBody.querySelector<HTMLInputElement>('[data-ref="youtube-search-input"]');
  const resultsContainer = drawerBody.querySelector<HTMLElement>('[data-ref="youtube-results-container"]');

  let debounceTimer: number | null = null;

  const performSearch = async (query: string) => {
    if (!resultsContainer) return;
    const cleanQ = query.trim();
    if (!cleanQ) {
      resultsContainer.innerHTML = `
        <div class="youtube-initial-state" data-ref="youtube-initial-state">
          <div class="youtube-initial-icon" data-ref="youtube-initial-icon">
            <svg viewBox="0 0 24 24" aria-hidden="true" style="width: 44px; height: 44px; fill: #ef4444;"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
          </div>
          <span class="youtube-initial-title" data-ref="youtube-initial-title">Busca videos en YouTube</span>
          <span class="youtube-initial-desc" data-ref="youtube-initial-desc">Escribe en el buscador o pulsa una sugerencia para encontrar e insertar videos en tu lienzo.</span>
        </div>
      `;
      return;
    }

    resultsContainer.innerHTML = `
      <div class="youtube-loading-state" data-ref="youtube-loading-state">
        <div class="component-spinner" style="width: 28px; height: 28px; border-width: 3px; border-color: #ef4444; border-top-color: transparent;"></div>
        <span style="font-size: 13px; color: var(--text-secondary);">Buscando en YouTube...</span>
      </div>
    `;

    const videos = await searchYouTubeVideos(cleanQ);

    if (videos.length === 0) {
      resultsContainer.innerHTML = `
        <div class="mockup-empty-state" data-ref="youtube-empty">
          No se encontraron videos para «${escapeHtml(cleanQ)}». Intenta con otra búsqueda.
        </div>
      `;
      return;
    }

    resultsContainer.innerHTML = `
      <div class="youtube-results-grid" data-ref="youtube-results-grid">
        ${videos.map((v) => `
          <div class="youtube-video-card" data-ref="youtube-video-card-${v.id}" data-video-id="${v.id}">
            <div class="youtube-video-card__thumb-box" data-ref="youtube-thumb-box-${v.id}">
              <img class="youtube-video-card__img" data-ref="youtube-img-${v.id}" src="${v.thumbnailUrl}" alt="${escapeHtml(v.title)}" loading="lazy" />
              <div class="youtube-video-card__overlay" data-ref="youtube-overlay-${v.id}">
                <button type="button" class="youtube-video-card__play-btn" data-ref="btn-preview-yt-${v.id}" data-tooltip="Previsualizar video" aria-label="Previsualizar">
                  <svg viewBox="0 0 24 24" aria-hidden="true" style="width: 20px; height: 20px; fill: #ffffff;"><path d="M8 5v14l11-7z"/></svg>
                </button>
              </div>
            </div>
            <div class="youtube-video-card__info" data-ref="youtube-info-${v.id}">
              <span class="youtube-video-card__title" data-ref="youtube-title-${v.id}" title="${escapeHtml(v.title)}">${escapeHtml(v.title)}</span>
              <span class="youtube-video-card__channel" data-ref="youtube-channel-${v.id}">${escapeHtml(v.channelTitle)}</span>
            </div>
          </div>
        `).join('')}
      </div>
    `;

    resultsContainer.querySelectorAll<HTMLElement>('.youtube-video-card').forEach((card) => {
      const vidId = card.getAttribute('data-video-id');
      const item = videos.find((v) => v.id === vidId);
      if (!item) return;

      const previewBtn = card.querySelector<HTMLButtonElement>(`[data-ref="btn-preview-yt-${item.id}"]`);
      previewBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        openYouTubePlayerModal(item.id, item.title);
      });

      card.addEventListener('click', () => {
        const canvasType = getActiveCanvasType();
        const controller = getActiveCanvasController();

        if (canvasType === 'doc') {
          if (!controller) {
            showToast('No se encontró el controlador del documento', 'warning');
            return;
          }
          if (typeof controller.insertYouTubeEmbed === 'function') {
            controller.insertYouTubeEmbed(item.id, item.title);
          } else {
            showToast('No se pudo insertar el video en el documento', 'warning');
          }
        } else if (canvasType === 'presentation') {
          if (!controller) {
            showToast('No se encontró el controlador de la presentación', 'warning');
            return;
          }
          if (typeof controller.insertYouTube === 'function') {
            controller.insertYouTube(item);
          }
        } else {
          if (!controller) {
            showToast('No se encontró el controlador del lienzo', 'warning');
            return;
          }
          if (typeof controller.insertYouTube === 'function') {
            controller.insertYouTube(item);
          }
        }

        if (window.innerWidth <= 768) {
          toggleDrawer(false);
        }
      });
    });

    renderIcons(resultsContainer);
  };

  searchInput?.addEventListener('input', () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = window.setTimeout(() => {
      void performSearch(searchInput.value);
    }, 450);
  });

  drawerBody.querySelectorAll<HTMLButtonElement>('[data-query]').forEach((chip) => {
    chip.addEventListener('click', () => {
      const q = chip.getAttribute('data-query');
      if (q && searchInput) {
        searchInput.value = q;
        void performSearch(q);
      }
    });
  });

  if (sidebar) {
    updateCanvasRailActiveState(sidebar);
  }
  renderIcons(drawerBody);
}

let driveFolderStack: Array<{ id: string; name: string }> = [{ id: 'root', name: 'Mi unidad' }];
let driveActiveFilter: 'all' | 'documents' | 'folders' | 'images' = 'all';
let driveSearchQuery = '';

async function handleInsertDriveFile(file: GoogleDriveFile): Promise<void> {
  const canvasType = getActiveCanvasType();
  const controller = getActiveCanvasController();

  if (!controller) {
    showToast('No se encontró el controlador del lienzo activo', 'warning');
    return;
  }

  if (file.isImage) {
    showToast(`Cargando «${file.name}» desde Drive...`, 'info');
    try {
      const result = await fetchGoogleDriveFileBlob(file.id);
      if (canvasType === 'doc') {
        controller.insertImage(result.dataUrl, file.name, '60%');
      } else {
        controller.insertImage?.(result.dataUrl, undefined, undefined, file.name);
      }
      showToast(`«${file.name}» insertada en el lienzo`, 'success');
      if (window.innerWidth <= 768) {
        toggleDrawer(false);
      }
    } catch {
      showToast('Error al descargar la imagen desde Google Drive', 'danger');
    }
    return;
  }

  if (file.isPdf || file.isDoc) {
    if (file.thumbnailLink) {
      showToast(`Insertando vista previa de «${file.name}»...`, 'info');
      try {
        const result = await fetchGoogleDriveFileBlob(file.id);
        if (canvasType === 'doc') {
          controller.insertImage(result.dataUrl, file.name, '60%');
        } else {
          controller.insertImage?.(result.dataUrl, undefined, undefined, file.name);
        }
        showToast(`«${file.name}» insertado en el lienzo`, 'success');
        if (window.innerWidth <= 768) {
          toggleDrawer(false);
        }
        return;
      } catch {}
    }

    if (canvasType === 'doc' && typeof controller.insertLink === 'function') {
      controller.insertLink(file.webViewLink || '#', file.name);
      showToast(`Enlace a «${file.name}» insertado`, 'success');
    } else {
      window.open(file.webViewLink || `https://drive.google.com/file/d/${file.id}/view`, '_blank');
      showToast(`Abriendo «${file.name}» en Google Drive`, 'info');
    }
  }
}

function renderGoogleDriveAppContent(drawer: HTMLElement, drawerBody: HTMLElement): void {
  const sidebar = drawer.closest<HTMLElement>('[data-ref="sidebar"]') || document.querySelector<HTMLElement>('[data-ref="sidebar"]');

  if (!isGoogleDriveConnected()) {
    drawerBody.innerHTML = `
      <div class="canvas-panel-card" data-ref="canvas-panel-card">
        <div class="canvas-panel-card__header" data-ref="canvas-panel-header">
          <div class="canvas-panel-card__title-box" data-ref="canvas-panel-title-box">
            <svg class="canvas-panel-card__icon" viewBox="0 0 64 64" fill="none" aria-hidden="true" style="width: 22px; height: 22px;"><rect width="64" height="64" rx="14" fill="#0284c7"/><path d="M23 44L14 28L25 10H39L30 26L23 44Z" fill="#22c55e"/><path d="M50 44H23L30 32H57L50 44Z" fill="#eab308"/><path d="M39 10L57 40L50 52L32 22L39 10Z" fill="#3b82f6"/></svg>
            <span class="canvas-panel-card__title" data-ref="canvas-panel-title">Google Drive</span>
          </div>
          <button type="button" class="component-button component-button--h32 component-button--icon-only rail-btn canvas-panel-card__close" data-ref="btn-close-canvas-panel" data-tooltip="Cerrar panel" aria-label="Cerrar panel">
            <svg class="component-icon rail-btn__icon" aria-hidden="true"><use href="/icons.svg#close"></use></svg>
          </button>
        </div>
        <div class="canvas-panel-card__body drive-drawer-body" data-ref="canvas-panel-body">
          <button type="button" class="elements-back-btn" data-ref="btn-apps-back" style="margin-bottom: 12px;">
            <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#arrow_back"></use></svg>
            <span>Volver a Apps</span>
          </button>

          <div class="drive-connect-card" data-ref="drive-connect-card">
            <div class="drive-connect-icon" data-ref="drive-connect-icon">
              <svg viewBox="0 0 64 64" fill="none" aria-hidden="true"><rect width="64" height="64" rx="14" fill="#0284c7"/><path d="M23 44L14 28L25 10H39L30 26L23 44Z" fill="#22c55e"/><path d="M50 44H23L30 32H57L50 44Z" fill="#eab308"/><path d="M39 10L57 40L50 52L32 22L39 10Z" fill="#3b82f6"/></svg>
            </div>
            <span class="drive-connect-title" data-ref="drive-connect-title">Conecta con Google Drive</span>
            <span class="drive-connect-desc" data-ref="drive-connect-desc">Accede a tus fotos, ilustraciones, carpetas y documentos de Google Drive sin salir de Spriteboard.</span>

            <div class="drive-connect-features" data-ref="drive-connect-features">
              <div class="drive-connect-feature-item" data-ref="drive-feat-1">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
                <span>Explora todas tus carpetas y archivos en la nube</span>
              </div>
              <div class="drive-connect-feature-item" data-ref="drive-feat-2">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
                <span>Inserta imágenes en alta resolución con un solo clic</span>
              </div>
              <div class="drive-connect-feature-item" data-ref="drive-feat-3">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
                <span>Exporta y guarda tus diseños en tu Drive</span>
              </div>
            </div>

            <button type="button" class="component-button component-button--h44 component-button--black component-button--w-full" data-ref="btn-connect-google-drive">
              <svg class="component-icon" aria-hidden="true" style="width: 20px; height: 20px;"><use href="/icons.svg#add_to_drive"></use></svg>
              <span>Conectar con Google Drive</span>
            </button>
          </div>
        </div>
      </div>
    `;

    const btnBack = drawerBody.querySelector<HTMLButtonElement>('[data-ref="btn-apps-back"]');
    btnBack?.addEventListener('click', () => {
      activeAppId = null;
      renderAppsDrawerContent(drawer, drawerBody);
    });

    const btnClose = drawerBody.querySelector<HTMLElement>('[data-ref="btn-close-canvas-panel"]');
    btnClose?.addEventListener('click', (e) => {
      e.preventDefault();
      toggleDrawer(false);
    });

    const btnConnect = drawerBody.querySelector<HTMLButtonElement>('[data-ref="btn-connect-google-drive"]');
    btnConnect?.addEventListener('click', async () => {
      if (!btnConnect) return;
      btnConnect.disabled = true;
      btnConnect.innerHTML = `
        <div class="component-spinner" style="width: 18px; height: 18px; border-width: 2px;"></div>
        <span>Conectando con Google...</span>
      `;
      const res = await connectGoogleDrive();
      if (res.success) {
        showToast('Google Drive conectado exitosamente', 'success');
        driveFolderStack = [{ id: 'root', name: 'Mi unidad' }];
        driveSearchQuery = '';
        renderGoogleDriveAppContent(drawer, drawerBody);
      } else {
        btnConnect.disabled = false;
        btnConnect.innerHTML = `
          <svg class="component-icon" aria-hidden="true" style="width: 20px; height: 20px;"><use href="/icons.svg#add_to_drive"></use></svg>
          <span>Conectar con Google Drive</span>
        `;
        renderIcons(btnConnect);
        if (res.error) {
          showToast(res.error, 'warning');
        }
      }
    });

    if (sidebar) {
      updateCanvasRailActiveState(sidebar);
    }
    renderIcons(drawerBody);
    return;
  }

  const user = getGoogleDriveUser();

  drawerBody.innerHTML = `
    <div class="canvas-panel-card" data-ref="canvas-panel-card">
      <div class="canvas-panel-card__header" data-ref="canvas-panel-header">
        <div class="canvas-panel-card__title-box" data-ref="canvas-panel-title-box">
          <svg class="canvas-panel-card__icon" viewBox="0 0 64 64" fill="none" aria-hidden="true" style="width: 22px; height: 22px;"><rect width="64" height="64" rx="14" fill="#0284c7"/><path d="M23 44L14 28L25 10H39L30 26L23 44Z" fill="#22c55e"/><path d="M50 44H23L30 32H57L50 44Z" fill="#eab308"/><path d="M39 10L57 40L50 52L32 22L39 10Z" fill="#3b82f6"/></svg>
          <span class="canvas-panel-card__title" data-ref="canvas-panel-title">Google Drive</span>
        </div>
        <button type="button" class="component-button component-button--h32 component-button--icon-only rail-btn canvas-panel-card__close" data-ref="btn-close-canvas-panel" data-tooltip="Cerrar panel" aria-label="Cerrar panel">
          <svg class="component-icon rail-btn__icon" aria-hidden="true"><use href="/icons.svg#close"></use></svg>
        </button>
      </div>
      <div class="canvas-panel-card__body drive-drawer-body" data-ref="canvas-panel-body">
        <div style="display: flex; align-items: center; justify-content: space-between;">
          <button type="button" class="elements-back-btn" data-ref="btn-apps-back" style="margin-bottom: 0;">
            <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#arrow_back"></use></svg>
            <span>Volver a Apps</span>
          </button>
          <button type="button" class="component-button component-button--h28 component-button--ghost" data-ref="btn-disconnect-drive" data-tooltip="Desconectar cuenta" aria-label="Desconectar">
            <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#logout"></use></svg>
            <span style="font-size: 11px;">Desconectar</span>
          </button>
        </div>

        <div class="drive-user-bar" data-ref="drive-user-bar">
          <div class="drive-user-profile" data-ref="drive-user-profile">
            ${user?.photoLink ? `<img class="drive-user-avatar" data-ref="drive-user-avatar-img" src="${user.photoLink}" alt="Avatar" />` : `<div class="drive-user-avatar" data-ref="drive-user-avatar-initial">${escapeHtml((user?.displayName || 'G').charAt(0).toUpperCase())}</div>`}
            <div class="drive-user-details" data-ref="drive-user-details">
              <span class="drive-user-name" data-ref="drive-user-name">${escapeHtml(user?.displayName || 'Cuenta de Google')}</span>
              <span class="drive-user-email" data-ref="drive-user-email">${escapeHtml(user?.emailAddress || 'Conectado')}</span>
            </div>
          </div>
        </div>

        <div class="drive-quick-actions" data-ref="drive-quick-actions">
          <button type="button" class="component-button component-button--h32 component-button--subtle" data-ref="btn-open-google-picker" style="flex: 1;" data-tooltip="Abrir selector modal oficial de Google Drive" aria-label="Selector de Google">
            <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#open_in_new"></use></svg>
            <span style="font-size: 11px;">Abrir Picker</span>
          </button>
          <button type="button" class="component-button component-button--h32 component-button--subtle" data-ref="btn-export-to-drive" style="flex: 1;" data-tooltip="Guardar captura del lienzo actual en Drive" aria-label="Guardar en Drive">
            <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#cloud_upload"></use></svg>
            <span style="font-size: 11px;">Guardar en Drive</span>
          </button>
        </div>

        <div class="menu-panel__search" data-ref="drive-search-wrapper">
          <svg class="component-icon menu-panel__search-icon" aria-hidden="true"><use href="/icons.svg#search"></use></svg>
          <input class="menu-panel__search-input" data-ref="drive-search-input" type="text" maxlength="80" autocomplete="off" placeholder="Buscar en Google Drive..." />
        </div>

        <div class="drive-breadcrumbs" data-ref="drive-breadcrumbs"></div>

        <div class="mockup-category-tabs" data-ref="drive-category-tabs" style="margin-bottom: 2px;">
          <button type="button" class="mockup-category-pill ${driveActiveFilter === 'all' ? 'is-active' : ''}" data-ref="drive-filter-all" data-drive-filter="all">Todos</button>
          <button type="button" class="mockup-category-pill ${driveActiveFilter === 'images' ? 'is-active' : ''}" data-ref="drive-filter-images" data-drive-filter="images">Imágenes</button>
          <button type="button" class="mockup-category-pill ${driveActiveFilter === 'folders' ? 'is-active' : ''}" data-ref="drive-filter-folders" data-drive-filter="folders">Carpetas</button>
          <button type="button" class="mockup-category-pill ${driveActiveFilter === 'documents' ? 'is-active' : ''}" data-ref="drive-filter-documents" data-drive-filter="documents">Documentos</button>
        </div>

        <div class="drive-results-container" data-ref="drive-results-container"></div>
      </div>
    </div>
  `;

  const btnBack = drawerBody.querySelector<HTMLButtonElement>('[data-ref="btn-apps-back"]');
  btnBack?.addEventListener('click', () => {
    activeAppId = null;
    renderAppsDrawerContent(drawer, drawerBody);
  });

  const btnClose = drawerBody.querySelector<HTMLElement>('[data-ref="btn-close-canvas-panel"]');
  btnClose?.addEventListener('click', (e) => {
    e.preventDefault();
    toggleDrawer(false);
  });

  const btnDisconnect = drawerBody.querySelector<HTMLButtonElement>('[data-ref="btn-disconnect-drive"]');
  btnDisconnect?.addEventListener('click', () => {
    disconnectGoogleDrive();
    showToast('Cuenta de Google Drive desconectada', 'info');
    renderGoogleDriveAppContent(drawer, drawerBody);
  });

  const breadcrumbsEl = drawerBody.querySelector<HTMLElement>('[data-ref="drive-breadcrumbs"]');
  const resultsContainer = drawerBody.querySelector<HTMLElement>('[data-ref="drive-results-container"]');
  const searchInput = drawerBody.querySelector<HTMLInputElement>('[data-ref="drive-search-input"]');

  const updateBreadcrumbs = () => {
    if (!breadcrumbsEl) return;
    breadcrumbsEl.innerHTML = driveFolderStack
      .map((crumb, idx) => `
        <button type="button" class="drive-breadcrumb-pill ${idx === driveFolderStack.length - 1 ? 'is-active' : ''}" data-ref="btn-drive-crumb-${crumb.id}" data-folder-id="${crumb.id}">
          <svg class="component-icon" aria-hidden="true" style="width: 13px; height: 13px;"><use href="/icons.svg#folder"></use></svg>
          <span>${escapeHtml(crumb.name)}</span>
        </button>
        ${idx < driveFolderStack.length - 1 ? '<span class="drive-breadcrumb-sep">/</span>' : ''}
      `)
      .join('');

    breadcrumbsEl.querySelectorAll<HTMLButtonElement>('[data-folder-id]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const targetId = btn.getAttribute('data-folder-id');
        if (!targetId) return;
        const targetIdx = driveFolderStack.findIndex((c) => c.id === targetId);
        if (targetIdx !== -1) {
          driveFolderStack = driveFolderStack.slice(0, targetIdx + 1);
          driveSearchQuery = '';
          if (searchInput) searchInput.value = '';
          void loadAndRenderFiles();
        }
      });
    });
    renderIcons(breadcrumbsEl);
  };

  const loadAndRenderFiles = async () => {
    if (!resultsContainer) return;
    updateBreadcrumbs();

    resultsContainer.innerHTML = `
      <div class="drive-loading-state" data-ref="drive-loading-state">
        <div class="component-spinner" style="width: 28px; height: 28px; border-width: 3px; border-color: #0284c7; border-top-color: transparent;"></div>
        <span style="font-size: 13px; color: var(--text-secondary);">Cargando Google Drive...</span>
      </div>
    `;

    const currentFolder = driveFolderStack[driveFolderStack.length - 1];
    const folderId = driveSearchQuery ? undefined : currentFolder?.id || 'root';

    try {
      const resp = await listGoogleDriveFiles({
        filterType: driveActiveFilter,
        folderId,
        query: driveSearchQuery,
      });

      if (resp.files.length === 0) {
        resultsContainer.innerHTML = `
          <div class="drive-empty-state" data-ref="drive-empty">
            <svg class="component-icon" aria-hidden="true" style="width: 38px; height: 38px; opacity: 0.4;"><use href="/icons.svg#folder_open"></use></svg>
            <span>${driveSearchQuery ? `No se encontraron archivos para «${escapeHtml(driveSearchQuery)}»` : 'Esta carpeta está vacía'}</span>
          </div>
        `;
        renderIcons(resultsContainer);
        return;
      }

      const folders = resp.files.filter((f) => f.isFolder);
      const files = resp.files.filter((f) => !f.isFolder);

      let html = '';

      if (folders.length > 0) {
        html += `
          <div class="elements-section-title" data-ref="drive-folders-title" style="margin-top: 4px; margin-bottom: 6px;">Carpetas</div>
          <div class="drive-grid" data-ref="drive-folders-grid" style="margin-bottom: 12px;">
            ${folders.map((folder) => `
              <button type="button" class="drive-folder-card" data-ref="drive-folder-${folder.id}" data-folder-id="${folder.id}" data-folder-name="${escapeHtml(folder.name)}" data-tooltip="Abrir carpeta ${escapeHtml(folder.name)}">
                <svg class="component-icon drive-folder-card__icon" aria-hidden="true"><use href="/icons.svg#folder"></use></svg>
                <span class="drive-folder-card__name" data-ref="drive-folder-name-${folder.id}">${escapeHtml(folder.name)}</span>
              </button>
            `).join('')}
          </div>
        `;
      }

      if (files.length > 0) {
        html += `
          <div class="elements-section-title" data-ref="drive-files-title" style="margin-top: 4px; margin-bottom: 6px;">Archivos e imágenes</div>
          <div class="drive-grid" data-ref="drive-files-grid">
            ${files.map((file) => {
              let thumbSrc = file.thumbnailLink || '';
              if (thumbSrc && thumbSrc.includes('=s220')) {
                thumbSrc = thumbSrc.replace(/=s220.*/, '=s400');
              }
              const iconName = file.isPdf ? 'picture_as_pdf' : file.isDoc ? 'description' : 'image';
              const iconColor = file.isPdf ? '#ef4444' : file.isDoc ? '#2563eb' : '#0284c7';

              return `
                <div class="drive-file-card" data-ref="drive-file-${file.id}" data-file-id="${file.id}">
                  <div class="drive-file-card__thumb-box" data-ref="drive-thumb-box-${file.id}">
                    ${thumbSrc ? `<img class="drive-file-card__thumb-img" data-ref="drive-img-${file.id}" src="${thumbSrc}" alt="${escapeHtml(file.name)}" loading="lazy" />` : `<svg class="component-icon drive-file-card__thumb-icon" aria-hidden="true" style="fill: ${iconColor};"><use href="/icons.svg#${iconName}"></use></svg>`}
                    <div class="drive-file-card__overlay" data-ref="drive-overlay-${file.id}">
                      <button type="button" class="drive-file-card__insert-btn" data-ref="btn-insert-drive-${file.id}">Insertar</button>
                    </div>
                  </div>
                  <div class="drive-file-card__info" data-ref="drive-info-${file.id}">
                    <span class="drive-file-card__title" data-ref="drive-title-${file.id}" title="${escapeHtml(file.name)}">${escapeHtml(file.name)}</span>
                    <span class="drive-file-card__meta" data-ref="drive-meta-${file.id}">
                      <span>${file.isImage ? 'Imagen' : file.isPdf ? 'PDF' : 'Archivo'}</span>
                      ${file.size ? `<span>${formatFileSize(file.size)}</span>` : ''}
                    </span>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        `;
      }

      resultsContainer.innerHTML = html;

      resultsContainer.querySelectorAll<HTMLButtonElement>('.drive-folder-card').forEach((card) => {
        card.addEventListener('click', () => {
          const fid = card.getAttribute('data-folder-id');
          const fname = card.getAttribute('data-folder-name') || 'Carpeta';
          if (fid) {
            driveFolderStack.push({ id: fid, name: fname });
            driveSearchQuery = '';
            if (searchInput) searchInput.value = '';
            void loadAndRenderFiles();
          }
        });
      });

      resultsContainer.querySelectorAll<HTMLElement>('.drive-file-card').forEach((card) => {
        const fid = card.getAttribute('data-file-id');
        const file = resp.files.find((f) => f.id === fid);
        if (!file) return;

        card.addEventListener('click', () => {
          void handleInsertDriveFile(file);
        });
      });

      renderIcons(resultsContainer);
    } catch (err: any) {
      resultsContainer.innerHTML = `
        <div class="drive-empty-state" data-ref="drive-error" style="color: #ef4444;">
          <svg class="component-icon" aria-hidden="true" style="width: 32px; height: 32px;"><use href="/icons.svg#error"></use></svg>
          <span>${escapeHtml(err?.message || 'Error al conectar con Google Drive')}</span>
          <button type="button" class="component-button component-button--h32 component-button--subtle" data-ref="btn-retry-drive" style="margin-top: 8px;">
            <span>Reintentar</span>
          </button>
        </div>
      `;
      const btnRetry = resultsContainer.querySelector<HTMLButtonElement>('[data-ref="btn-retry-drive"]');
      btnRetry?.addEventListener('click', () => void loadAndRenderFiles());
      renderIcons(resultsContainer);
    }
  };

  let debounceTimer: number | null = null;
  searchInput?.addEventListener('input', () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = window.setTimeout(() => {
      driveSearchQuery = searchInput.value.trim();
      void loadAndRenderFiles();
    }, 450);
  });

  drawerBody.querySelectorAll<HTMLButtonElement>('[data-drive-filter]').forEach((pill) => {
    pill.addEventListener('click', () => {
      const filter = pill.getAttribute('data-drive-filter') as any;
      if (filter) {
        driveActiveFilter = filter;
        drawerBody.querySelectorAll<HTMLButtonElement>('[data-drive-filter]').forEach((p) => {
          p.classList.toggle('is-active', p.getAttribute('data-drive-filter') === filter);
        });
        void loadAndRenderFiles();
      }
    });
  });

  const btnPicker = drawerBody.querySelector<HTMLButtonElement>('[data-ref="btn-open-google-picker"]');
  btnPicker?.addEventListener('click', async () => {
    await openGooglePicker((picked) => {
      void handleInsertDriveFile(picked);
    });
  });

  const btnExport = drawerBody.querySelector<HTMLButtonElement>('[data-ref="btn-export-to-drive"]');
  btnExport?.addEventListener('click', async () => {
    const controller = getActiveCanvasController();
    const canvasType = getActiveCanvasType();
    const nowStr = new Date().toISOString().slice(0, 10);
    const boardName = controller?.boardName || controller?.canvasRecord?.name || 'Spriteboard_Diseno';
    const cleanFilename = `${boardName.replace(/[^a-zA-Z0-9_-]/g, '_')}_${nowStr}.png`;

    showToast('Preparando captura para Google Drive...', 'info');

    let blob: Blob | null = null;
    const canvasEl = controller?.canvasElement || controller?.canvas || document.querySelector<HTMLCanvasElement>('canvas');

    if (canvasEl && canvasType !== 'doc') {
      blob = await new Promise<Blob | null>((resolve) => {
        canvasEl.toBlob((b: Blob | null) => resolve(b), 'image/png');
      });
    } else if (canvasType === 'doc') {
      const docEl = document.querySelector<HTMLElement>('[data-ref="doc-editor-content"], .doc-page, .doc-editor');
      const text = docEl?.innerText || 'Documento Spriteboard';
      blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    }

    if (!blob) {
      showToast('No se pudo generar la captura del lienzo para guardar', 'warning');
      return;
    }

    try {
      const currentFolder = driveFolderStack[driveFolderStack.length - 1];
      const folderId = currentFolder?.id !== 'root' ? currentFolder?.id : undefined;
      const uploaded = await uploadCanvasExportToDrive(blob, cleanFilename, folderId);
      showToast(`«${uploaded.name}» guardado con éxito en Google Drive`, 'success');
      void loadAndRenderFiles();
    } catch {
      showToast('Error al guardar el archivo en Google Drive', 'danger');
    }
  });

  void loadAndRenderFiles();

  if (sidebar) {
    updateCanvasRailActiveState(sidebar);
  }
  renderIcons(drawerBody);
}

let photosActiveTab: 'albums' | 'recent' = 'recent';
let photosActiveAlbumId: string | null = null;
let photosActiveAlbumTitle: string | null = null;

async function handleInsertPhoto(photo: GooglePhotoItem): Promise<void> {
  const canvasType = getActiveCanvasType();
  const controller = getActiveCanvasController();

  if (!controller) {
    showToast('No se encontró el controlador del lienzo activo', 'warning');
    return;
  }

  showToast(`Cargando foto «${photo.filename}»...`, 'info');
  try {
    const result = await fetchPhotoBlob(photo.baseUrl);
    if (canvasType === 'doc') {
      controller.insertImage(result.dataUrl, photo.filename, '60%');
    } else {
      controller.insertImage?.(result.dataUrl, photo.width || undefined, photo.height || undefined, photo.filename);
    }
    showToast(`«${photo.filename}» añadida al diseño`, 'success');
    if (window.innerWidth <= 768) {
      toggleDrawer(false);
    }
  } catch {
    showToast('Error al descargar la foto desde Google Fotos', 'danger');
  }
}

function renderGooglePhotosAppContent(drawer: HTMLElement, drawerBody: HTMLElement): void {
  const sidebar = drawer.closest<HTMLElement>('[data-ref="sidebar"]') || document.querySelector<HTMLElement>('[data-ref="sidebar"]');

  if (!isGooglePhotosConnected()) {
    drawerBody.innerHTML = `
      <div class="canvas-panel-card" data-ref="canvas-panel-card">
        <div class="canvas-panel-card__header" data-ref="canvas-panel-header">
          <div class="canvas-panel-card__title-box" data-ref="canvas-panel-title-box">
            <svg class="canvas-panel-card__icon" viewBox="0 0 64 64" fill="none" aria-hidden="true" style="width: 22px; height: 22px;"><rect width="64" height="64" rx="14" fill="#ffffff" stroke="#e2e8f0" stroke-width="1.5"/><path d="M32 14C32 14 32 24 32 24H22C22 18.48 26.48 14 32 14Z" fill="#ea4335"/><path d="M50 32C50 32 40 32 40 32V22C45.52 22 50 26.48 50 32Z" fill="#fbbc05"/><path d="M32 50C32 50 32 40 32 40H42C42 45.52 37.52 50 32 50Z" fill="#34a853"/><path d="M14 32C14 32 24 32 24 32V42C18.48 42 14 37.52 14 32Z" fill="#4285f4"/></svg>
            <span class="canvas-panel-card__title" data-ref="canvas-panel-title">Google Fotos</span>
          </div>
          <button type="button" class="component-button component-button--h32 component-button--icon-only rail-btn canvas-panel-card__close" data-ref="btn-close-canvas-panel" data-tooltip="Cerrar panel" aria-label="Cerrar panel">
            <svg class="component-icon rail-btn__icon" aria-hidden="true"><use href="/icons.svg#close"></use></svg>
          </button>
        </div>
        <div class="canvas-panel-card__body photos-drawer-body" data-ref="canvas-panel-body">
          <button type="button" class="elements-back-btn" data-ref="btn-apps-back" style="margin-bottom: 12px;">
            <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#arrow_back"></use></svg>
            <span>Volver a Apps</span>
          </button>

          <div class="drive-connect-card" data-ref="photos-connect-card">
            <div class="drive-connect-icon" data-ref="photos-connect-icon">
              <svg viewBox="0 0 64 64" fill="none" aria-hidden="true"><rect width="64" height="64" rx="14" fill="#ffffff" stroke="#e2e8f0" stroke-width="1.5"/><path d="M32 14C32 14 32 24 32 24H22C22 18.48 26.48 14 32 14Z" fill="#ea4335"/><path d="M50 32C50 32 40 32 40 32V22C45.52 22 50 26.48 50 32Z" fill="#fbbc05"/><path d="M32 50C32 50 32 40 32 40H42C42 45.52 37.52 50 32 50Z" fill="#34a853"/><path d="M14 32C14 32 24 32 24 32V42C18.48 42 14 37.52 14 32Z" fill="#4285f4"/></svg>
            </div>
            <span class="drive-connect-title" data-ref="photos-connect-title">Conecta con Google Fotos</span>
            <span class="drive-connect-desc" data-ref="photos-connect-desc">Accede a tus fotografías, ilustraciones y álbumes personales para agregarlos directamente a tu diseño.</span>

            <div class="drive-connect-features" data-ref="photos-connect-features">
              <div class="drive-connect-feature-item" data-ref="photos-feat-1">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
                <span>Accede a tus fotos y álbumes de Google</span>
              </div>
              <div class="drive-connect-feature-item" data-ref="photos-feat-2">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
                <span>Inserta imágenes en alta calidad en un solo clic</span>
              </div>
              <div class="drive-connect-feature-item" data-ref="photos-feat-3">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
                <span>Selección rápida con Google Photos Picker</span>
              </div>
            </div>

            <button type="button" class="component-button component-button--h44 component-button--black component-button--w-full" data-ref="btn-connect-google-photos">
              <svg class="component-icon" aria-hidden="true" style="width: 20px; height: 20px;"><use href="/icons.svg#photo_library"></use></svg>
              <span>Conectar con Google Fotos</span>
            </button>
          </div>
        </div>
      </div>
    `;

    const btnBack = drawerBody.querySelector<HTMLButtonElement>('[data-ref="btn-apps-back"]');
    btnBack?.addEventListener('click', () => {
      activeAppId = null;
      renderAppsDrawerContent(drawer, drawerBody);
    });

    const btnClose = drawerBody.querySelector<HTMLElement>('[data-ref="btn-close-canvas-panel"]');
    btnClose?.addEventListener('click', (e) => {
      e.preventDefault();
      toggleDrawer(false);
    });

    const btnConnect = drawerBody.querySelector<HTMLButtonElement>('[data-ref="btn-connect-google-photos"]');
    btnConnect?.addEventListener('click', async () => {
      if (!btnConnect) return;
      btnConnect.disabled = true;
      btnConnect.innerHTML = `
        <div class="component-spinner" style="width: 18px; height: 18px; border-width: 2px;"></div>
        <span>Conectando con Google...</span>
      `;
      const res = await connectGooglePhotos();
      if (res.success) {
        showToast('Google Fotos conectado exitosamente', 'success');
        photosActiveTab = 'recent';
        photosActiveAlbumId = null;
        renderGooglePhotosAppContent(drawer, drawerBody);
      } else {
        btnConnect.disabled = false;
        btnConnect.innerHTML = `
          <svg class="component-icon" aria-hidden="true" style="width: 20px; height: 20px;"><use href="/icons.svg#photo_library"></use></svg>
          <span>Conectar con Google Fotos</span>
        `;
        renderIcons(btnConnect);
        if (res.error) {
          showToast(res.error, 'warning');
        }
      }
    });

    if (sidebar) {
      updateCanvasRailActiveState(sidebar);
    }
    renderIcons(drawerBody);
    return;
  }

  const user = getGooglePhotosUser();

  drawerBody.innerHTML = `
    <div class="canvas-panel-card" data-ref="canvas-panel-card">
      <div class="canvas-panel-card__header" data-ref="canvas-panel-header">
        <div class="canvas-panel-card__title-box" data-ref="canvas-panel-title-box">
          <svg class="canvas-panel-card__icon" viewBox="0 0 64 64" fill="none" aria-hidden="true" style="width: 22px; height: 22px;"><rect width="64" height="64" rx="14" fill="#ffffff" stroke="#e2e8f0" stroke-width="1.5"/><path d="M32 14C32 14 32 24 32 24H22C22 18.48 26.48 14 32 14Z" fill="#ea4335"/><path d="M50 32C50 32 40 32 40 32V22C45.52 22 50 26.48 50 32Z" fill="#fbbc05"/><path d="M32 50C32 50 32 40 32 40H42C42 45.52 37.52 50 32 50Z" fill="#34a853"/><path d="M14 32C14 32 24 32 24 32V42C18.48 42 14 37.52 14 32Z" fill="#4285f4"/></svg>
          <span class="canvas-panel-card__title" data-ref="canvas-panel-title">Google Fotos</span>
        </div>
        <button type="button" class="component-button component-button--h32 component-button--icon-only rail-btn canvas-panel-card__close" data-ref="btn-close-canvas-panel" data-tooltip="Cerrar panel" aria-label="Cerrar panel">
          <svg class="component-icon rail-btn__icon" aria-hidden="true"><use href="/icons.svg#close"></use></svg>
        </button>
      </div>
      <div class="canvas-panel-card__body photos-drawer-body" data-ref="canvas-panel-body">
        <div style="display: flex; align-items: center; justify-content: space-between;">
          <button type="button" class="elements-back-btn" data-ref="btn-apps-back" style="margin-bottom: 0;">
            <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#arrow_back"></use></svg>
            <span>Volver a Apps</span>
          </button>
          <button type="button" class="component-button component-button--h28 component-button--ghost" data-ref="btn-disconnect-photos" data-tooltip="Desconectar cuenta" aria-label="Desconectar">
            <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#logout"></use></svg>
            <span style="font-size: 11px;">Desconectar</span>
          </button>
        </div>

        <div class="drive-user-bar" data-ref="photos-user-bar">
          <div class="drive-user-profile" data-ref="photos-user-profile">
            ${user?.photoLink ? `<img class="drive-user-avatar" data-ref="photos-user-avatar-img" src="${user.photoLink}" alt="Avatar" />` : `<div class="drive-user-avatar" data-ref="photos-user-avatar-initial" style="background: #ea4335;">${escapeHtml((user?.displayName || 'P').charAt(0).toUpperCase())}</div>`}
            <div class="drive-user-details" data-ref="photos-user-details">
              <span class="drive-user-name" data-ref="photos-user-name">${escapeHtml(user?.displayName || 'Cuenta de Google')}</span>
              <span class="drive-user-email" data-ref="photos-user-email">${escapeHtml(user?.emailAddress || 'Conectado')}</span>
            </div>
          </div>
        </div>

        <button type="button" class="component-button component-button--h32 component-button--subtle component-button--w-full" data-ref="btn-open-photos-picker" data-tooltip="Abrir selector modal oficial de Google Fotos" aria-label="Selector de Fotos">
          <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#open_in_new"></use></svg>
          <span style="font-size: 11px;">Abrir Google Photos Picker</span>
        </button>

        <div class="mockup-category-tabs" data-ref="photos-tabs" style="margin-bottom: 2px;">
          <button type="button" class="mockup-category-pill ${photosActiveTab === 'recent' ? 'is-active' : ''}" data-ref="photos-tab-recent" data-photos-tab="recent">Fotos recientes</button>
          <button type="button" class="mockup-category-pill ${photosActiveTab === 'albums' ? 'is-active' : ''}" data-ref="photos-tab-albums" data-photos-tab="albums">Álbumes</button>
        </div>

        ${photosActiveAlbumId ? `
          <div style="display: flex; align-items: center; gap: 6px; padding: 4px 0;">
            <button type="button" class="elements-back-btn" data-ref="btn-back-to-albums" style="margin-bottom: 0; padding: 2px 6px; font-size: 11px;">
              <svg class="component-icon" aria-hidden="true" style="width: 14px; height: 14px;"><use href="/icons.svg#arrow_back"></use></svg>
              <span>Todos los álbumes</span>
            </button>
            <span style="font-size: 11.5px; font-weight: 600; color: var(--text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(photosActiveAlbumTitle || '')}</span>
          </div>
        ` : ''}

        <div class="photos-results-container" data-ref="photos-results-container"></div>
      </div>
    </div>
  `;

  const btnBack = drawerBody.querySelector<HTMLButtonElement>('[data-ref="btn-apps-back"]');
  btnBack?.addEventListener('click', () => {
    activeAppId = null;
    renderAppsDrawerContent(drawer, drawerBody);
  });

  const btnClose = drawerBody.querySelector<HTMLElement>('[data-ref="btn-close-canvas-panel"]');
  btnClose?.addEventListener('click', (e) => {
    e.preventDefault();
    toggleDrawer(false);
  });

  const btnDisconnect = drawerBody.querySelector<HTMLButtonElement>('[data-ref="btn-disconnect-photos"]');
  btnDisconnect?.addEventListener('click', () => {
    disconnectGooglePhotos();
    showToast('Cuenta de Google Fotos desconectada', 'info');
    renderGooglePhotosAppContent(drawer, drawerBody);
  });

  const btnBackToAlbums = drawerBody.querySelector<HTMLButtonElement>('[data-ref="btn-back-to-albums"]');
  btnBackToAlbums?.addEventListener('click', () => {
    photosActiveAlbumId = null;
    photosActiveAlbumTitle = null;
    renderGooglePhotosAppContent(drawer, drawerBody);
  });

  const resultsContainer = drawerBody.querySelector<HTMLElement>('[data-ref="photos-results-container"]');

  const loadAndRenderPhotos = async () => {
    if (!resultsContainer) return;
    resultsContainer.innerHTML = `
      <div class="drive-loading-state" data-ref="photos-loading-state">
        <div class="component-spinner" style="width: 28px; height: 28px; border-width: 3px; border-color: #ea4335; border-top-color: transparent;"></div>
        <span style="font-size: 13px; color: var(--text-secondary);">Cargando fotos...</span>
      </div>
    `;

    try {
      if (photosActiveTab === 'albums' && !photosActiveAlbumId) {
        const resp = await listGooglePhotosAlbums(30);
        if (resp.albums.length === 0) {
          resultsContainer.innerHTML = `
            <div class="drive-empty-state" data-ref="photos-empty">
              <svg class="component-icon" aria-hidden="true" style="width: 38px; height: 38px; opacity: 0.4;"><use href="/icons.svg#photo_library"></use></svg>
              <span>No se encontraron álbumes en tu cuenta</span>
            </div>
          `;
          renderIcons(resultsContainer);
          return;
        }

        resultsContainer.innerHTML = `
          <div class="photos-grid" data-ref="photos-albums-grid">
            ${resp.albums.map((alb) => `
              <div class="photos-album-card" data-ref="album-${alb.id}" data-album-id="${alb.id}" data-album-title="${escapeHtml(alb.title)}">
                <div class="photos-album-card__cover" data-ref="album-cover-${alb.id}">
                  ${alb.coverPhotoBaseUrl ? `<img src="${alb.coverPhotoBaseUrl}" alt="${escapeHtml(alb.title)}" loading="lazy" />` : `<svg class="component-icon" aria-hidden="true" style="width: 32px; height: 32px; opacity: 0.5;"><use href="/icons.svg#photo_library"></use></svg>`}
                </div>
                <div class="photos-album-card__info" data-ref="album-info-${alb.id}">
                  <span class="photos-album-card__title" data-ref="album-title-${alb.id}">${escapeHtml(alb.title)}</span>
                  ${alb.mediaItemsCount !== undefined ? `<span class="photos-album-card__count" data-ref="album-count-${alb.id}">${alb.mediaItemsCount} elementos</span>` : ''}
                </div>
              </div>
            `).join('')}
          </div>
        `;

        resultsContainer.querySelectorAll<HTMLElement>('.photos-album-card').forEach((card) => {
          card.addEventListener('click', () => {
            const albId = card.getAttribute('data-album-id');
            const albTitle = card.getAttribute('data-album-title');
            if (albId) {
              photosActiveAlbumId = albId;
              photosActiveAlbumTitle = albTitle || 'Álbum';
              renderGooglePhotosAppContent(drawer, drawerBody);
            }
          });
        });

        renderIcons(resultsContainer);
        return;
      }

      const resp = await listGooglePhotos({
        albumId: photosActiveAlbumId || undefined,
        pageSize: 40,
      });

      if (resp.mediaItems.length === 0) {
        resultsContainer.innerHTML = `
          <div class="drive-empty-state" data-ref="photos-empty">
            <svg class="component-icon" aria-hidden="true" style="width: 38px; height: 38px; opacity: 0.4;"><use href="/icons.svg#image"></use></svg>
            <span>No se encontraron fotos en esta sección</span>
          </div>
        `;
        renderIcons(resultsContainer);
        return;
      }

      resultsContainer.innerHTML = `
        <div class="photos-grid" data-ref="photos-grid">
          ${resp.mediaItems.map((item) => `
            <div class="photos-card" data-ref="photo-${item.id}" data-photo-id="${item.id}">
              <div class="photos-card__thumb-box" data-ref="photo-thumb-box-${item.id}">
                <img class="photos-card__img" data-ref="photo-img-${item.id}" src="${item.thumbnailUrl}" alt="${escapeHtml(item.filename)}" loading="lazy" />
                <div class="photos-card__overlay" data-ref="photo-overlay-${item.id}">
                  <button type="button" class="photos-card__insert-btn" data-ref="btn-insert-photo-${item.id}">Insertar</button>
                </div>
              </div>
              <div class="photos-card__info" data-ref="photo-info-${item.id}">
                <span class="photos-card__name" data-ref="photo-name-${item.id}" title="${escapeHtml(item.filename)}">${escapeHtml(item.filename)}</span>
              </div>
            </div>
          `).join('')}
        </div>
      `;

      resultsContainer.querySelectorAll<HTMLElement>('.photos-card').forEach((card) => {
        const pid = card.getAttribute('data-photo-id');
        const photo = resp.mediaItems.find((p) => p.id === pid);
        if (!photo) return;
        card.addEventListener('click', () => {
          void handleInsertPhoto(photo);
        });
      });

      renderIcons(resultsContainer);
    } catch (err: any) {
      const isScopeErr = String(err?.message || '').toLowerCase().includes('permiso') || String(err?.message || '').toLowerCase().includes('scope');
      resultsContainer.innerHTML = `
        <div class="drive-empty-state" data-ref="photos-error" style="color: var(--text-secondary); text-align: center; padding: 20px 12px;">
          <svg class="component-icon" aria-hidden="true" style="width: 34px; height: 34px; color: #ef4444; margin-bottom: 6px;"><use href="/icons.svg#error"></use></svg>
          <div style="font-size: 13px; font-weight: 600; color: var(--text-primary); margin-bottom: 4px;">
            ${isScopeErr ? 'Permisos insuficientes' : 'Error al cargar fotos'}
          </div>
          <span style="font-size: 11.5px; color: var(--text-tertiary); line-height: 1.45; margin-bottom: 12px; display: block;">
            ${escapeHtml(err?.message || 'Error al conectar con Google Fotos')}
          </span>
          <div style="display: flex; flex-direction: column; gap: 8px; width: 100%; max-width: 230px; margin: 0 auto;">
            <button type="button" class="component-button component-button--h32 component-button--black component-button--w-full" data-ref="btn-reconnect-photos">
              <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#refresh"></use></svg>
              <span>Reconectar y autorizar</span>
            </button>
            <button type="button" class="component-button component-button--h32 component-button--subtle component-button--w-full" data-ref="btn-picker-from-error">
              <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#open_in_new"></use></svg>
              <span>Abrir Google Photos Picker</span>
            </button>
          </div>
        </div>
      `;

      const btnReconnect = resultsContainer.querySelector<HTMLButtonElement>('[data-ref="btn-reconnect-photos"]');
      btnReconnect?.addEventListener('click', async () => {
        disconnectGooglePhotos();
        const res = await connectGooglePhotos();
        if (res.success) {
          renderGooglePhotosAppContent(drawer, drawerBody);
        } else if (res.error) {
          showToast(res.error, 'warning');
        }
      });

      const btnPickerFromError = resultsContainer.querySelector<HTMLButtonElement>('[data-ref="btn-picker-from-error"]');
      btnPickerFromError?.addEventListener('click', async () => {
        await openGooglePhotosPicker((picked) => {
          void handleInsertPhoto(picked);
        });
      });

      renderIcons(resultsContainer);
    }
  };

  drawerBody.querySelectorAll<HTMLButtonElement>('[data-photos-tab]').forEach((tabBtn) => {
    tabBtn.addEventListener('click', () => {
      const tab = tabBtn.getAttribute('data-photos-tab') as any;
      if (tab) {
        photosActiveTab = tab;
        photosActiveAlbumId = null;
        photosActiveAlbumTitle = null;
        drawerBody.querySelectorAll<HTMLButtonElement>('[data-photos-tab]').forEach((b) => {
          b.classList.toggle('is-active', b.getAttribute('data-photos-tab') === tab);
        });
        void loadAndRenderPhotos();
      }
    });
  });

  const btnPicker = drawerBody.querySelector<HTMLButtonElement>('[data-ref="btn-open-photos-picker"]');
  btnPicker?.addEventListener('click', async () => {
    await openGooglePhotosPicker((picked) => {
      void handleInsertPhoto(picked);
    });
  });

  void loadAndRenderPhotos();

  if (sidebar) {
    updateCanvasRailActiveState(sidebar);
  }
  renderIcons(drawerBody);
}

let mapsAddress = 'Madrid, España';
let mapsZoom = 14;
let mapsType: MapTypeOption = 'roadmap';
let mapsStyle: MapStyleOption = 'standard';
let mapsShowMarker = true;

function renderGoogleMapsAppContent(drawer: HTMLElement, drawerBody: HTMLElement): void {
  const sidebar = drawer.closest<HTMLElement>('[data-ref="sidebar"]') || document.querySelector<HTMLElement>('[data-ref="sidebar"]');

  drawerBody.innerHTML = `
    <div class="canvas-panel-card" data-ref="canvas-panel-card">
      <div class="canvas-panel-card__header" data-ref="canvas-panel-header">
        <div class="canvas-panel-card__title-box" data-ref="canvas-panel-title-box">
          <svg class="canvas-panel-card__icon" viewBox="0 0 64 64" fill="none" aria-hidden="true" style="width: 22px; height: 22px;"><rect width="64" height="64" rx="14" fill="#10b981"/><path d="M32 14C23.7 14 17 20.7 17 29C17 39.5 32 50 32 50C32 50 47 39.5 47 29C47 20.7 40.3 14 32 14ZM32 35C28.7 35 26 32.3 26 29C26 25.7 28.7 23 32 23C35.3 23 38 25.7 38 29C38 32.3 35.3 35 32 35Z" fill="#ffffff"/></svg>
          <span class="canvas-panel-card__title" data-ref="canvas-panel-title">Google Maps</span>
        </div>
        <button type="button" class="component-button component-button--h32 component-button--icon-only rail-btn canvas-panel-card__close" data-ref="btn-close-canvas-panel" data-tooltip="Cerrar panel" aria-label="Cerrar panel">
          <svg class="component-icon rail-btn__icon" aria-hidden="true"><use href="/icons.svg#close"></use></svg>
        </button>
      </div>
      <div class="canvas-panel-card__body maps-drawer-body" data-ref="canvas-panel-body">
        <button type="button" class="elements-back-btn" data-ref="btn-apps-back" style="margin-bottom: 2px;">
          <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#arrow_back"></use></svg>
          <span>Volver a Apps</span>
        </button>

        <div class="menu-panel__search" data-ref="maps-search-wrapper">
          <svg class="component-icon menu-panel__search-icon" aria-hidden="true"><use href="/icons.svg#search"></use></svg>
          <input class="menu-panel__search-input" data-ref="maps-search-input" type="text" maxlength="120" autocomplete="off" placeholder="Buscar dirección o ciudad..." value="${escapeHtml(mapsAddress)}" />
        </div>

        <div class="maps-chips-row" data-ref="maps-presets-row">
          ${MAP_PRESET_LOCATIONS.map((loc) => `
            <button type="button" class="mockup-category-pill" data-ref="chip-map-${loc.name}" data-map-loc="${escapeHtml(loc.address)}">
              ${escapeHtml(loc.name)}
            </button>
          `).join('')}
        </div>

        <div class="maps-preview-card" data-ref="maps-preview-card">
          <div class="maps-preview-box" data-ref="maps-preview-box">
            <img class="maps-preview-img" data-ref="maps-preview-img" src="${buildStaticMapUrl({ address: mapsAddress, mapType: mapsType, showMarker: mapsShowMarker, styleTheme: mapsStyle, zoom: mapsZoom })}" alt="Vista previa del mapa" />
          </div>
        </div>

        <div class="maps-controls-section" data-ref="maps-controls-style">
          <span class="maps-controls-label" data-ref="label-maps-style">Estilo de mapa</span>
          <div class="maps-style-grid" data-ref="maps-style-grid">
            <button type="button" class="maps-style-btn ${mapsType === 'roadmap' && mapsStyle === 'standard' ? 'is-active' : ''}" data-ref="btn-map-roadmap" data-map-type="roadmap" data-map-style="standard">Estándar</button>
            <button type="button" class="maps-style-btn ${mapsType === 'satellite' ? 'is-active' : ''}" data-ref="btn-map-satellite" data-map-type="satellite" data-map-style="standard">Satélite</button>
            <button type="button" class="maps-style-btn ${mapsType === 'hybrid' ? 'is-active' : ''}" data-ref="btn-map-hybrid" data-map-type="hybrid" data-map-style="standard">Híbrido</button>
            <button type="button" class="maps-style-btn ${mapsStyle === 'dark' ? 'is-active' : ''}" data-ref="btn-map-dark" data-map-type="roadmap" data-map-style="dark">Oscuro</button>
          </div>
        </div>

        <div class="maps-controls-section" data-ref="maps-controls-zoom">
          <div style="display: flex; align-items: center; justify-content: space-between;">
            <span class="maps-controls-label" data-ref="label-maps-zoom">Zoom</span>
            <span style="font-size: 11px; color: var(--text-tertiary);" data-ref="label-maps-zoom-val">${mapsZoom}</span>
          </div>
          <input class="qr-range-slider" data-ref="slider-maps-zoom" type="range" min="3" max="18" step="1" value="${mapsZoom}" aria-label="Nivel de zoom del mapa" />
        </div>

        <div style="display: flex; align-items: center; justify-content: space-between; padding: 2px 0;">
          <label style="display: flex; align-items: center; gap: 8px; font-size: 11.5px; color: var(--text-secondary); cursor: pointer;" data-ref="label-marker-toggle">
            <input data-ref="check-maps-marker" type="checkbox" ${mapsShowMarker ? 'checked' : ''} />
            <span>Marcador de ubicación</span>
          </label>
          <a class="link" data-ref="link-open-gmaps" href="${getGoogleMapsExternalUrl(mapsAddress)}" target="_blank" rel="noopener noreferrer" style="font-size: 11px; display: flex; align-items: center; gap: 4px;">
            <span>Abrir Maps</span>
            <svg class="component-icon" aria-hidden="true" style="width: 12px; height: 12px;"><use href="/icons.svg#open_in_new"></use></svg>
          </a>
        </div>

        <button type="button" class="component-button component-button--h44 component-button--black component-button--w-full" data-ref="btn-insert-map-canvas">
          <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#add"></use></svg>
          <span>Insertar mapa en el diseño</span>
        </button>
      </div>
    </div>
  `;

  const btnBack = drawerBody.querySelector<HTMLButtonElement>('[data-ref="btn-apps-back"]');
  btnBack?.addEventListener('click', () => {
    activeAppId = null;
    renderAppsDrawerContent(drawer, drawerBody);
  });

  const btnClose = drawerBody.querySelector<HTMLElement>('[data-ref="btn-close-canvas-panel"]');
  btnClose?.addEventListener('click', (e) => {
    e.preventDefault();
    toggleDrawer(false);
  });

  const searchInput = drawerBody.querySelector<HTMLInputElement>('[data-ref="maps-search-input"]');
  const previewImg = drawerBody.querySelector<HTMLImageElement>('[data-ref="maps-preview-img"]');
  const zoomSlider = drawerBody.querySelector<HTMLInputElement>('[data-ref="slider-maps-zoom"]');
  const zoomValLabel = drawerBody.querySelector<HTMLElement>('[data-ref="label-maps-zoom-val"]');
  const markerCheck = drawerBody.querySelector<HTMLInputElement>('[data-ref="check-maps-marker"]');
  const linkOpen = drawerBody.querySelector<HTMLAnchorElement>('[data-ref="link-open-gmaps"]');
  const btnInsert = drawerBody.querySelector<HTMLButtonElement>('[data-ref="btn-insert-map-canvas"]');

  const updateMapPreview = () => {
    const url = buildStaticMapUrl({
      address: mapsAddress,
      mapType: mapsType,
      showMarker: mapsShowMarker,
      styleTheme: mapsStyle,
      zoom: mapsZoom,
    });
    if (previewImg) previewImg.src = url;
    if (linkOpen) linkOpen.href = getGoogleMapsExternalUrl(mapsAddress);
    if (zoomValLabel) zoomValLabel.textContent = String(mapsZoom);
  };

  let debounceTimer: number | null = null;
  searchInput?.addEventListener('input', () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = window.setTimeout(() => {
      const q = searchInput.value.trim();
      if (q) {
        mapsAddress = q;
        updateMapPreview();
      }
    }, 500);
  });

  drawerBody.querySelectorAll<HTMLButtonElement>('[data-map-loc]').forEach((chip) => {
    chip.addEventListener('click', () => {
      const loc = chip.getAttribute('data-map-loc');
      if (loc && searchInput) {
        mapsAddress = loc;
        searchInput.value = loc;
        updateMapPreview();
      }
    });
  });

  drawerBody.querySelectorAll<HTMLButtonElement>('[data-map-type]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const mType = btn.getAttribute('data-map-type') as MapTypeOption;
      const mStyle = btn.getAttribute('data-map-style') as MapStyleOption;
      if (mType) {
        mapsType = mType;
        mapsStyle = mStyle || 'standard';
        drawerBody.querySelectorAll<HTMLButtonElement>('[data-map-type]').forEach((b) => b.classList.remove('is-active'));
        btn.classList.add('is-active');
        updateMapPreview();
      }
    });
  });

  zoomSlider?.addEventListener('input', () => {
    mapsZoom = Number(zoomSlider.value);
    updateMapPreview();
  });

  markerCheck?.addEventListener('change', () => {
    mapsShowMarker = markerCheck.checked;
    updateMapPreview();
  });

  btnInsert?.addEventListener('click', async () => {
    const controller = getActiveCanvasController();
    const canvasType = getActiveCanvasType();
    if (!controller) {
      showToast('No se encontró el controlador del lienzo activo', 'warning');
      return;
    }

    const mapUrl = buildStaticMapUrl({
      address: mapsAddress,
      height: 480,
      mapType: mapsType,
      showMarker: mapsShowMarker,
      styleTheme: mapsStyle,
      width: 640,
      zoom: mapsZoom,
    });

    showToast(`Generando mapa de «${mapsAddress}»...`, 'info');

    try {
      const res = await fetchMapImageBlob(mapUrl);
      if (canvasType === 'doc') {
        controller.insertImage(res.dataUrl, `Mapa: ${mapsAddress}`, '75%');
      } else {
        controller.insertImage?.(res.dataUrl, 640, 480, `Mapa: ${mapsAddress}`);
      }
      showToast(`Mapa de «${mapsAddress}» insertado en el lienzo`, 'success');
      if (window.innerWidth <= 768) {
        toggleDrawer(false);
      }
    } catch {
      if (canvasType === 'doc') {
        controller.insertImage(mapUrl, `Mapa: ${mapsAddress}`, '75%');
      } else {
        controller.insertImage?.(mapUrl, 640, 480, `Mapa: ${mapsAddress}`);
      }
      showToast(`Mapa de «${mapsAddress}» insertado`, 'success');
      if (window.innerWidth <= 768) {
        toggleDrawer(false);
      }
    }
  });

  if (sidebar) {
    updateCanvasRailActiveState(sidebar);
  }
  renderIcons(drawerBody);
}

function renderAppsDrawerContent(drawer: HTMLElement, drawerBody: HTMLElement): void {
  const sidebar = drawer.closest<HTMLElement>('[data-ref="sidebar"]') || document.querySelector<HTMLElement>('[data-ref="sidebar"]');

  if (activeAppId === 'google-photos') {
    renderGooglePhotosAppContent(drawer, drawerBody);
    return;
  }

  if (activeAppId === 'google-maps') {
    renderGoogleMapsAppContent(drawer, drawerBody);
    return;
  }

  if (activeAppId === 'google-drive') {
    renderGoogleDriveAppContent(drawer, drawerBody);
    return;
  }

  if (activeAppId === 'youtube') {
    renderYouTubeAppContent(drawer, drawerBody);
    return;
  }

  if (activeAppId === 'qr-code') {
    void import('qr-code-styling').then(({ default: QRCodeStyling }) => {
      drawerBody.innerHTML = `
      <div class="canvas-panel-card" data-ref="canvas-panel-card">
        <div class="canvas-panel-card__header" data-ref="canvas-panel-header">
          <div class="canvas-panel-card__title-box" data-ref="canvas-panel-title-box">
            <svg class="component-icon canvas-panel-card__icon" aria-hidden="true"><use href="/icons.svg#qr_code"></use></svg>
            <span class="canvas-panel-card__title" data-ref="canvas-panel-title">Código QR</span>
          </div>
          <button type="button" class="component-button component-button--h32 component-button--icon-only rail-btn canvas-panel-card__close" data-ref="btn-close-canvas-panel" data-tooltip="Cerrar panel" aria-label="Cerrar panel">
            <svg class="component-icon rail-btn__icon" aria-hidden="true"><use href="/icons.svg#close"></use></svg>
          </button>
        </div>
        <div class="canvas-panel-card__body qr-drawer-body" data-ref="canvas-panel-body">
          <button type="button" class="elements-back-btn" data-ref="btn-apps-back" style="margin-bottom: 12px;">
            <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#arrow_back"></use></svg>
            <span>Volver a Apps</span>
          </button>

          <div class="qr-preview-wrapper" data-ref="qr-preview-wrapper">
            <div class="qr-preview-card" data-ref="qr-preview-card">
              <div class="qr-preview-box" data-ref="qr-preview-box"></div>
            </div>
          </div>

          <div class="qr-drawer-section" data-ref="qr-section-url">
            <label class="field" data-ref="field-qr-url">
              <input class="field__input" data-ref="qr-input-url" type="text" placeholder=" " value="https://spriteboard.com" autocomplete="off" />
              <span class="field__label">URL o contenido</span>
            </label>
          </div>

          <div class="qr-drawer-section" data-ref="qr-section-fg-color">
            <div class="qr-drawer-section__header">
              <span class="qr-drawer-section__title">Color del código</span>
              <span class="qr-drawer-section__hex" data-ref="qr-fg-hex-label">#000000</span>
            </div>
            <div class="qr-color-controls">
              <div class="design-color-btn-rainbow-wrapper" data-tooltip="Elegir color personalizado">
                <input class="design-color-active-input" data-ref="input-qr-fg-color" type="color" value="#000000" aria-label="Color del código QR" />
                <div class="design-color-btn-rainbow">
                  <div class="design-color-btn-rainbow__inner">
                    <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#add"></use></svg>
                  </div>
                </div>
              </div>
              <div class="qr-swatches-grid" data-ref="qr-fg-swatches">
                <button type="button" class="qr-swatch-btn is-active" data-ref="qr-fg-swatch-000000" data-color="#000000" style="background-color: #000000;" data-tooltip="Negro" aria-label="Negro"></button>
                <button type="button" class="qr-swatch-btn" data-ref="qr-fg-swatch-1e293b" data-color="#1e293b" style="background-color: #1e293b;" data-tooltip="Pizarra" aria-label="Pizarra"></button>
                <button type="button" class="qr-swatch-btn" data-ref="qr-fg-swatch-2563eb" data-color="#2563eb" style="background-color: #2563eb;" data-tooltip="Azul" aria-label="Azul"></button>
                <button type="button" class="qr-swatch-btn" data-ref="qr-fg-swatch-7c3aed" data-color="#7c3aed" style="background-color: #7c3aed;" data-tooltip="Violeta" aria-label="Violeta"></button>
                <button type="button" class="qr-swatch-btn" data-ref="qr-fg-swatch-db2777" data-color="#db2777" style="background-color: #db2777;" data-tooltip="Rosa" aria-label="Rosa"></button>
                <button type="button" class="qr-swatch-btn" data-ref="qr-fg-swatch-059669" data-color="#059669" style="background-color: #059669;" data-tooltip="Esmeralda" aria-label="Esmeralda"></button>
                <button type="button" class="qr-swatch-btn" data-ref="qr-fg-swatch-ea580c" data-color="#ea580c" style="background-color: #ea580c;" data-tooltip="Naranja" aria-label="Naranja"></button>
              </div>
            </div>
          </div>

          <div class="qr-drawer-section" data-ref="qr-section-bg-color">
            <div class="qr-drawer-section__header">
              <span class="qr-drawer-section__title">Color de fondo</span>
              <span class="qr-drawer-section__hex" data-ref="qr-bg-hex-label">#FFFFFF</span>
            </div>
            <div class="qr-color-controls">
              <div class="design-color-btn-rainbow-wrapper" data-tooltip="Elegir color personalizado">
                <input class="design-color-active-input" data-ref="input-qr-bg-color" type="color" value="#ffffff" aria-label="Color de fondo" />
                <div class="design-color-btn-rainbow">
                  <div class="design-color-btn-rainbow__inner">
                    <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#add"></use></svg>
                  </div>
                </div>
              </div>
              <div class="qr-swatches-grid" data-ref="qr-bg-swatches">
                <button type="button" class="qr-swatch-btn is-active" data-ref="qr-bg-swatch-ffffff" data-color="#ffffff" style="background-color: #ffffff;" data-tooltip="Blanco" aria-label="Blanco"></button>
                <button type="button" class="qr-swatch-btn qr-swatch-btn--transparent" data-ref="qr-bg-swatch-transparent" data-color="transparent" data-tooltip="Transparente" aria-label="Transparente"></button>
                <button type="button" class="qr-swatch-btn" data-ref="qr-bg-swatch-000000" data-color="#000000" style="background-color: #000000;" data-tooltip="Negro" aria-label="Negro"></button>
                <button type="button" class="qr-swatch-btn" data-ref="qr-bg-swatch-f8fafc" data-color="#f8fafc" style="background-color: #f8fafc;" data-tooltip="Gris claro" aria-label="Gris claro"></button>
                <button type="button" class="qr-swatch-btn" data-ref="qr-bg-swatch-fef3c7" data-color="#fef3c7" style="background-color: #fef3c7;" data-tooltip="Crema" aria-label="Crema"></button>
                <button type="button" class="qr-swatch-btn" data-ref="qr-bg-swatch-eff6ff" data-color="#eff6ff" style="background-color: #eff6ff;" data-tooltip="Azul pastel" aria-label="Azul pastel"></button>
                <button type="button" class="qr-swatch-btn" data-ref="qr-bg-swatch-fdf2f8" data-color="#fdf2f8" style="background-color: #fdf2f8;" data-tooltip="Rosa pastel" aria-label="Rosa pastel"></button>
              </div>
            </div>
          </div>

          <div class="qr-drawer-section" data-ref="qr-section-margin">
            <div class="qr-drawer-section__header">
              <span class="qr-drawer-section__title">Margen</span>
              <span class="qr-drawer-section__value" data-ref="qr-margin-val-label">10px</span>
            </div>
            <div class="qr-slider-row">
              <input class="qr-range-slider" data-ref="slider-qr-margin" type="range" min="0" max="40" step="2" value="10" aria-label="Margen del código QR" />
            </div>
          </div>

          <div class="qr-drawer-actions" data-ref="qr-drawer-actions">
            <button type="button" class="component-button component-button--h44 component-button--black component-button--w-full" data-ref="btn-insert-qr">
              <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#add"></use></svg>
              <span>Agregar al diseño</span>
            </button>
          </div>
        </div>
      </div>
    `;

    const btnBack = drawerBody.querySelector<HTMLButtonElement>('[data-ref="btn-apps-back"]');
    btnBack?.addEventListener('click', () => {
      activeAppId = null;
      renderAppsDrawerContent(drawer, drawerBody);
    });

    const btnClose = drawerBody.querySelector<HTMLElement>('[data-ref="btn-close-canvas-panel"]');
    btnClose?.addEventListener('click', (e) => {
      e.preventDefault();
      toggleDrawer(false);
    });

    const previewBox = drawerBody.querySelector<HTMLElement>('[data-ref="qr-preview-box"]');
    const inputUrl = drawerBody.querySelector<HTMLInputElement>('[data-ref="qr-input-url"]');
    const inputFgColor = drawerBody.querySelector<HTMLInputElement>('[data-ref="input-qr-fg-color"]');
    const inputBgColor = drawerBody.querySelector<HTMLInputElement>('[data-ref="input-qr-bg-color"]');
    const fgHexLabel = drawerBody.querySelector<HTMLElement>('[data-ref="qr-fg-hex-label"]');
    const bgHexLabel = drawerBody.querySelector<HTMLElement>('[data-ref="qr-bg-hex-label"]');
    const sliderMargin = drawerBody.querySelector<HTMLInputElement>('[data-ref="slider-qr-margin"]');
    const marginValLabel = drawerBody.querySelector<HTMLElement>('[data-ref="qr-margin-val-label"]');
    const btnInsert = drawerBody.querySelector<HTMLButtonElement>('[data-ref="btn-insert-qr"]');
    const fgSwatches = drawerBody.querySelectorAll<HTMLButtonElement>('[data-ref="qr-fg-swatches"] .qr-swatch-btn');
    const bgSwatches = drawerBody.querySelectorAll<HTMLButtonElement>('[data-ref="qr-bg-swatches"] .qr-swatch-btn');

    let currentUrl = 'https://spriteboard.com';
    let currentFg = '#000000';
    let currentBg = '#ffffff';
    let currentMargin = 10;

    const qrInstance = new QRCodeStyling({
      width: 200,
      height: 200,
      data: currentUrl,
      margin: currentMargin,
      qrOptions: { errorCorrectionLevel: 'Q' },
      dotsOptions: { color: currentFg, type: 'square' },
      cornersSquareOptions: { color: currentFg, type: 'square' },
      cornersDotOptions: { color: currentFg, type: 'square' },
      backgroundOptions: { color: currentBg === 'transparent' ? '#00000000' : currentBg },
    });

    if (previewBox) {
      previewBox.innerHTML = '';
      qrInstance.append(previewBox);
    }

    const updatePreview = () => {
      qrInstance.update({
        data: currentUrl.trim() || 'https://spriteboard.com',
        margin: currentMargin,
        dotsOptions: { color: currentFg, type: 'square' },
        cornersSquareOptions: { color: currentFg, type: 'square' },
        cornersDotOptions: { color: currentFg, type: 'square' },
        backgroundOptions: { color: currentBg === 'transparent' ? '#00000000' : currentBg },
      });
    };

    inputUrl?.addEventListener('input', () => {
      currentUrl = inputUrl.value;
      updatePreview();
    });

    const setFgColor = (color: string) => {
      currentFg = color;
      if (inputFgColor) inputFgColor.value = color;
      if (fgHexLabel) fgHexLabel.textContent = color.toUpperCase();
      fgSwatches.forEach((s) => s.classList.toggle('is-active', s.getAttribute('data-color')?.toLowerCase() === color.toLowerCase()));
      updatePreview();
    };

    const setBgColor = (color: string) => {
      currentBg = color;
      if (inputBgColor && color !== 'transparent') inputBgColor.value = color;
      if (bgHexLabel) bgHexLabel.textContent = color === 'transparent' ? 'TRANSPARENTE' : color.toUpperCase();
      bgSwatches.forEach((s) => s.classList.toggle('is-active', s.getAttribute('data-color')?.toLowerCase() === color.toLowerCase()));
      updatePreview();
    };

    inputFgColor?.addEventListener('input', () => {
      setFgColor(inputFgColor.value);
    });

    inputBgColor?.addEventListener('input', () => {
      setBgColor(inputBgColor.value);
    });

    fgSwatches.forEach((btn) => {
      btn.addEventListener('click', () => {
        const color = btn.getAttribute('data-color');
        if (color) setFgColor(color);
      });
    });

    bgSwatches.forEach((btn) => {
      btn.addEventListener('click', () => {
        const color = btn.getAttribute('data-color');
        if (color) setBgColor(color);
      });
    });

    sliderMargin?.addEventListener('input', () => {
      currentMargin = parseInt(sliderMargin.value, 10) || 0;
      if (marginValLabel) marginValLabel.textContent = `${currentMargin}px`;
      updatePreview();
    });

    btnInsert?.addEventListener('click', async () => {
      try {
        btnInsert.disabled = true;

        const exportQr = new QRCodeStyling({
          width: 600,
          height: 600,
          data: currentUrl.trim() || 'https://spriteboard.com',
          margin: currentMargin * 2,
          qrOptions: { errorCorrectionLevel: 'Q' },
          dotsOptions: { color: currentFg, type: 'square' },
          cornersSquareOptions: { color: currentFg, type: 'square' },
          cornersDotOptions: { color: currentFg, type: 'square' },
          backgroundOptions: { color: currentBg === 'transparent' ? '#00000000' : currentBg },
        });

        const blob = (await exportQr.getRawData('png')) as Blob | null;
        if (!blob) {
          showToast('Error al generar el código QR', 'danger');
          return;
        }

        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });

        const canvasType = getActiveCanvasType();
        const controller = getActiveCanvasController();

        if (canvasType === 'doc') {
          if (!controller) {
            showToast('No se encontró el controlador del documento', 'warning');
            return;
          }
          controller.insertImage(dataUrl, 'Código QR', '220px');
        } else {
          if (!controller) {
            showToast('No se encontró el controlador del lienzo', 'warning');
            return;
          }
          controller.insertImage?.(dataUrl, 260, 260, 'Código QR');
        }

        showToast('Código QR agregado al diseño', 'success');
        if (window.innerWidth <= 768) {
          toggleDrawer(false);
        }
      } catch {
        showToast('Error al generar el código QR', 'danger');
      } finally {
        btnInsert.disabled = false;
      }
    });

    if (sidebar) {
      updateCanvasRailActiveState(sidebar);
    }
    renderIcons(drawerBody);
  });
  return;
}

  drawerBody.innerHTML = `
    <div class="canvas-panel-card" data-ref="canvas-panel-card">
      <div class="canvas-panel-card__header" data-ref="canvas-panel-header">
        <div class="canvas-panel-card__title-box" data-ref="canvas-panel-title-box">
          <svg class="component-icon canvas-panel-card__icon" aria-hidden="true"><use href="/icons.svg#apps"></use></svg>
          <span class="canvas-panel-card__title" data-ref="canvas-panel-title">Apps</span>
        </div>
        <button type="button" class="component-button component-button--h32 component-button--icon-only rail-btn canvas-panel-card__close" data-ref="btn-close-canvas-panel" data-tooltip="Cerrar panel" aria-label="Cerrar panel">
          <svg class="component-icon rail-btn__icon" aria-hidden="true"><use href="/icons.svg#close"></use></svg>
        </button>
      </div>
      <div class="canvas-panel-card__body apps-drawer-body" data-ref="canvas-panel-body">
        <div class="menu-panel__search" data-ref="canvas-apps-search">
          <svg class="component-icon menu-panel__search-icon" aria-hidden="true"><use href="/icons.svg#search"></use></svg>
          <input class="menu-panel__search-input" data-ref="canvas-apps-search-input" type="text" maxlength="50" autocomplete="off" placeholder="Buscar aplicaciones..." />
        </div>

        <div class="mockup-category-tabs" data-ref="apps-category-tabs" style="margin-bottom: 10px;">
          ${APP_CATEGORIES.map((cat) => `
            <button type="button" class="mockup-category-pill ${activeAppCategory === cat.id ? 'is-active' : ''}" data-ref="app-cat-pill-${cat.id}" data-app-cat="${cat.id}">
              ${escapeHtml(cat.name)}
            </button>
          `).join('')}
        </div>

        <div class="elements-section-title" data-ref="apps-section-title">Aplicaciones e integraciones</div>
        <div class="apps-grid" data-ref="apps-grid"></div>
      </div>
    </div>
  `;

  const btnClose = drawerBody.querySelector<HTMLElement>('[data-ref="btn-close-canvas-panel"]');
  btnClose?.addEventListener('click', (e) => {
    e.preventDefault();
    toggleDrawer(false);
  });

  const searchInput = drawerBody.querySelector<HTMLInputElement>('[data-ref="canvas-apps-search-input"]');
  const appsGrid = drawerBody.querySelector<HTMLElement>('[data-ref="apps-grid"]');

  const renderAppsList = (query = '') => {
    if (!appsGrid) return;
    const filtered = searchApps(query, activeAppCategory);

    if (filtered.length === 0) {
      appsGrid.innerHTML = `
        <div class="mockup-empty-state" data-ref="apps-empty">
          No se encontraron aplicaciones que coincidan con la búsqueda.
        </div>
      `;
      return;
    }

    appsGrid.innerHTML = filtered.map((app) => `
      <button type="button" class="app-card" data-ref="btn-app-card-${app.id}" data-app-id="${app.id}" data-tooltip="${escapeHtml(app.description)}" aria-label="${escapeHtml(app.name)}">
        <div class="app-card__thumb" data-ref="app-card-thumb-${app.id}">
          ${app.iconSvg || `<svg class="component-icon" aria-hidden="true" style="width: 36px; height: 36px;"><use href="/icons.svg#${app.icon}"></use></svg>`}
          ${app.badge ? `<span class="app-card__badge app-card__badge--${app.status}" data-ref="app-badge-${app.id}">${escapeHtml(app.badge)}</span>` : ''}
        </div>
        <div class="app-card__info" data-ref="app-card-info-${app.id}">
          <span class="app-card__title" data-ref="app-card-title-${app.id}">${escapeHtml(app.name)}</span>
          <span class="app-card__author" data-ref="app-card-author-${app.id}">${escapeHtml(app.author)}</span>
          <span class="app-card__desc" data-ref="app-card-desc-${app.id}">${escapeHtml(app.description)}</span>
        </div>
      </button>
    `).join('');

    appsGrid.querySelectorAll<HTMLButtonElement>('[data-app-id]').forEach((card) => {
      card.addEventListener('click', () => {
        const appId = card.getAttribute('data-app-id');
        const found = getAppById(appId || '');
        if (!found) return;

        if (found.id === 'google-drive') {
          activeAppId = 'google-drive';
          renderAppsDrawerContent(drawer, drawerBody);
          return;
        }

        if (found.id === 'google-photos') {
          activeAppId = 'google-photos';
          renderAppsDrawerContent(drawer, drawerBody);
          return;
        }

        if (found.id === 'google-maps') {
          activeAppId = 'google-maps';
          renderAppsDrawerContent(drawer, drawerBody);
          return;
        }

        if (found.id === 'qr-code') {
          activeAppId = 'qr-code';
          renderAppsDrawerContent(drawer, drawerBody);
          return;
        }

        if (found.id === 'youtube') {
          activeAppId = 'youtube';
          renderAppsDrawerContent(drawer, drawerBody);
          return;
        }

        if (found.status === 'coming_soon') {
          showToast(`La integración con ${found.name} estará disponible próximamente`, 'info');
        }
      });
    });

    renderIcons(appsGrid);
  };

  searchInput?.addEventListener('input', () => {
    renderAppsList(searchInput.value);
  });

  drawerBody.querySelectorAll<HTMLButtonElement>('[data-app-cat]').forEach((pill) => {
    pill.addEventListener('click', () => {
      const cat = pill.getAttribute('data-app-cat') as AppCategory;
      if (cat) {
        activeAppCategory = cat;
        drawerBody.querySelectorAll<HTMLButtonElement>('[data-app-cat]').forEach((p) => {
          p.classList.toggle('is-active', p.getAttribute('data-app-cat') === cat);
        });
        renderAppsList(searchInput?.value || '');
      }
    });
  });

  renderAppsList(searchInput?.value || '');

  if (sidebar) {
    updateCanvasRailActiveState(sidebar);
  }
  renderIcons(drawerBody);
}

function handleApplyTextPreset(type: 'heading' | 'subheading' | 'body', canvasType: 'board' | 'doc' | 'presentation'): void {
  const controller = getActiveCanvasController();
  if (!controller) {
    showToast('No se encontró el controlador del lienzo activo', 'warning');
    return;
  }

  if (typeof controller.insertTextPreset === 'function') {
    controller.insertTextPreset(type);
    const labelMap = {
      body: 'Texto',
      heading: 'Título',
      subheading: 'Subtítulo',
    };
    showToast(`«${labelMap[type]}» insertado en el lienzo`, 'success');
    if (window.innerWidth <= 768) {
      toggleDrawer(false);
    }
    return;
  }

  showToast('No se pudo insertar el texto en este modo', 'warning');
}

function renderTextDrawerContent(drawer: HTMLElement, drawerBody: HTMLElement): void {
  const sidebar = drawer.closest<HTMLElement>('[data-ref="sidebar"]') || document.querySelector<HTMLElement>('[data-ref="sidebar"]');
  const canvasType = getActiveCanvasType();

  drawerBody.innerHTML = `
    <div class="canvas-panel-card" data-ref="canvas-panel-card">
      <div class="canvas-panel-card__header" data-ref="canvas-panel-header">
        <div class="canvas-panel-card__title-box" data-ref="canvas-panel-title-box">
          <svg class="component-icon canvas-panel-card__icon" aria-hidden="true"><use href="/icons.svg#text_fields"></use></svg>
          <span class="canvas-panel-card__title" data-ref="canvas-panel-title">${t('nav.text') || 'Texto'}</span>
        </div>
        <button type="button" class="component-button component-button--h32 component-button--icon-only rail-btn canvas-panel-card__close" data-ref="btn-close-canvas-panel" data-tooltip="Cerrar panel" aria-label="Cerrar panel">
          <svg class="component-icon rail-btn__icon" aria-hidden="true"><use href="/icons.svg#close"></use></svg>
        </button>
      </div>
      <div class="canvas-panel-card__body" data-ref="canvas-panel-body">
        <div class="text-drawer-actions" data-ref="text-drawer-actions">
          <button type="button" class="component-button component-button--h40 component-button--primary component-button--w-full" data-ref="btn-add-textbox">
            <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#text_fields"></use></svg>
            <span>Agregar caja de texto</span>
          </button>
          <button type="button" class="component-button component-button--h40 component-button--w-full" data-ref="btn-magic-text">
            <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#auto_awesome"></use></svg>
            <span>Texto mágico</span>
          </button>
        </div>

        <div class="elements-section-title">Texto predeterminado</div>
        <div class="text-drawer-presets" data-ref="text-drawer-presets">
          <button type="button" class="text-preset-btn text-preset-btn--heading" data-ref="btn-text-preset-heading" data-preset="heading">
            <span class="text-preset-btn__label">Agregar un título</span>
          </button>
          <button type="button" class="text-preset-btn text-preset-btn--subheading" data-ref="btn-text-preset-subheading" data-preset="subheading">
            <span class="text-preset-btn__label">Agregar un subtítulo</span>
          </button>
          <button type="button" class="text-preset-btn text-preset-btn--body" data-ref="btn-text-preset-body" data-preset="body">
            <span class="text-preset-btn__label">Agregar algo de texto</span>
          </button>
        </div>
      </div>
    </div>
  `;

  const btnClose = drawerBody.querySelector<HTMLElement>('[data-ref="btn-close-canvas-panel"]');
  btnClose?.addEventListener('click', (e) => {
    e.preventDefault();
    toggleDrawer(false);
  });

  const btnAddTextbox = drawerBody.querySelector<HTMLButtonElement>('[data-ref="btn-add-textbox"]');
  btnAddTextbox?.addEventListener('click', (e) => {
    e.preventDefault();
    const vtoolTextBtn = document.querySelector<HTMLButtonElement>('[data-ref="vertical-tool-text"]');
    if (vtoolTextBtn) {
      vtoolTextBtn.click();
    } else {
      handleApplyTextPreset('body', canvasType);
    }
  });

  const btnMagicText = drawerBody.querySelector<HTMLButtonElement>('[data-ref="btn-magic-text"]');
  btnMagicText?.addEventListener('click', (e) => {
    e.preventDefault();
  });

  const presetBtns = drawerBody.querySelectorAll<HTMLButtonElement>('[data-ref^="btn-text-preset-"]');
  presetBtns.forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const presetType = btn.getAttribute('data-preset') as 'heading' | 'subheading' | 'body';
      if (presetType) {
        handleApplyTextPreset(presetType, canvasType);
      }
    });
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

function renderChartsDrawerContent(drawer: HTMLElement, drawerBody: HTMLElement): void {
  const sidebar = drawer.closest<HTMLElement>('[data-ref="sidebar"]') || document.querySelector<HTMLElement>('[data-ref="sidebar"]');

  drawerBody.innerHTML = `
    <div class="canvas-panel-card" data-ref="canvas-panel-card">
      <div class="canvas-panel-card__header" data-ref="canvas-panel-header">
        <div class="canvas-panel-card__title-box" data-ref="canvas-panel-title-box">
          <button type="button" class="component-button component-button--h32 component-button--icon-only${activeChartInDrawer ? '' : ' is-hidden'}" data-ref="btn-chart-back-to-gallery" data-tooltip="Volver a tipos de gráfica" aria-label="Volver">
            <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#arrow_back"></use></svg>
          </button>
          <svg class="component-icon canvas-panel-card__icon" aria-hidden="true"><use href="/icons.svg#bar_chart"></use></svg>
          <span class="canvas-panel-card__title" data-ref="canvas-panel-title">Gráficas</span>
        </div>
        <button type="button" class="component-button component-button--h32 component-button--icon-only rail-btn canvas-panel-card__close" data-ref="btn-close-canvas-panel" data-tooltip="Cerrar panel" aria-label="Cerrar panel">
          <svg class="component-icon rail-btn__icon" aria-hidden="true"><use href="/icons.svg#close"></use></svg>
        </button>
      </div>
      <div class="canvas-panel-card__body layout-drawer__chart-body" data-ref="board-charts-drawer">
        <div class="chart-drawer-view" data-ref="chart-drawer-gallery-view">
          <div class="chart-gallery-header">
            <span class="chart-gallery-subtitle">Selecciona una gráfica para añadir al lienzo</span>
          </div>
          <div class="chart-gallery-grid" data-ref="chart-gallery-grid"></div>
        </div>

        <div class="chart-drawer-view is-hidden" data-ref="chart-drawer-inspector-view">
          <div class="chart-type-selector-box">
            <div class="settings-dropdown-wrapper settings-dropdown-wrapper--full" data-ref="dropdown-wrapper-chart-type">
              <button type="button" class="dropdown-trigger dropdown-trigger--full" data-ref="trigger-chart-type">
                <div class="dropdown-trigger__left">
                  <svg class="component-icon dropdown-trigger__icon" data-ref="icon-chart-type" aria-hidden="true"><use href="/icons.svg#bar_chart"></use></svg>
                  <span class="dropdown-trigger__text" data-ref="text-chart-type">Barras verticales</span>
                </div>
                <svg class="component-icon dropdown-trigger__chevron" aria-hidden="true"><use href="/icons.svg#expand_more"></use></svg>
              </button>
              <div class="dropdown-backdrop" data-ref="backdrop-chart-type">
                <div class="menu-panel menu-panel--dropdown menu-panel--w-full menu-panel--h-auto" data-ref="menu-chart-type">
                  <div class="menu-panel__drag-zone" aria-hidden="true">
                    <div class="menu-panel__drag-handle"></div>
                  </div>
                  <div class="menu-panel__list" data-ref="list-chart-types">
                    <button type="button" class="menu-item is-active" data-ref="opt-chart-type-bar-vertical" data-value="bar-vertical">
                      <span class="menu-item__text">Barras verticales</span>
                    </button>
                    <button type="button" class="menu-item" data-ref="opt-chart-type-bar-horizontal" data-value="bar-horizontal">
                      <span class="menu-item__text">Barras horizontales</span>
                    </button>
                    <button type="button" class="menu-item" data-ref="opt-chart-type-bar-categorical" data-value="bar-categorical">
                      <span class="menu-item__text">Barras categóricas</span>
                    </button>
                    <button type="button" class="menu-item" data-ref="opt-chart-type-bar-categorical-horizontal" data-value="bar-categorical-horizontal">
                      <span class="menu-item__text">Filas categóricas</span>
                    </button>
                    <button type="button" class="menu-item" data-ref="opt-chart-type-bar-grouped-vertical" data-value="bar-grouped-vertical">
                      <span class="menu-item__text">Barras agrupadas</span>
                    </button>
                    <button type="button" class="menu-item" data-ref="opt-chart-type-bar-grouped-horizontal" data-value="bar-grouped-horizontal">
                      <span class="menu-item__text">Filas agrupadas</span>
                    </button>
                    <button type="button" class="menu-item" data-ref="opt-chart-type-bar-stacked-vertical" data-value="bar-stacked-vertical">
                      <span class="menu-item__text">Barras apiladas</span>
                    </button>
                    <button type="button" class="menu-item" data-ref="opt-chart-type-bar-stacked-horizontal" data-value="bar-stacked-horizontal">
                      <span class="menu-item__text">Filas apiladas</span>
                    </button>
                    <button type="button" class="menu-item" data-ref="opt-chart-type-bar-stacked-100-vertical" data-value="bar-stacked-100-vertical">
                      <span class="menu-item__text">Barras 100% apiladas</span>
                    </button>
                    <button type="button" class="menu-item" data-ref="opt-chart-type-line" data-value="line">
                      <span class="menu-item__text">Líneas</span>
                    </button>
                    <button type="button" class="menu-item" data-ref="opt-chart-type-area" data-value="area">
                      <span class="menu-item__text">Área</span>
                    </button>
                    <button type="button" class="menu-item" data-ref="opt-chart-type-pie" data-value="pie">
                      <span class="menu-item__text">Circular (Pastel)</span>
                    </button>
                    <button type="button" class="menu-item" data-ref="opt-chart-type-donut" data-value="donut">
                      <span class="menu-item__text">Anillo (Donut)</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="chart-tabs-bar">
            <button type="button" class="chart-tab-btn is-active" data-ref="chart-tab-data">Datos</button>
            <button type="button" class="chart-tab-btn" data-ref="chart-tab-customize">Personalizar</button>
          </div>

          <div class="chart-tab-pane" data-ref="chart-pane-data">
            <div class="chart-spreadsheet-wrapper">
              <table class="chart-spreadsheet-table">
                <thead>
                  <tr data-ref="chart-table-head-row"></tr>
                </thead>
                <tbody data-ref="chart-table-body"></tbody>
              </table>
            </div>

            <div class="chart-spreadsheet-actions">
              <button type="button" class="component-button component-button--h32 component-button--secondary chart-action-btn" data-ref="chart-btn-add-row">
                <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#add"></use></svg>
                <span>Fila</span>
              </button>
              <button type="button" class="component-button component-button--h32 component-button--secondary chart-action-btn" data-ref="chart-btn-add-series">
                <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#add"></use></svg>
                <span>Serie</span>
              </button>
              <button type="button" class="component-button component-button--h32 component-button--secondary chart-action-btn" data-ref="chart-btn-open-import" data-tooltip="Importar datos CSV/Excel" aria-label="Importar datos">
                <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#upload_file"></use></svg>
                <span>Importar</span>
              </button>
              <button type="button" class="component-button component-button--h32 component-button--secondary component-button--icon-only" data-ref="chart-btn-transpose" data-tooltip="Transponer filas y columnas" aria-label="Transponer">
                <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#swap_horiz"></use></svg>
              </button>
              <button type="button" class="component-button component-button--h32 component-button--secondary component-button--icon-only" data-ref="chart-btn-clear-data" data-tooltip="Limpiar tabla" aria-label="Limpiar">
                <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#delete_outline"></use></svg>
              </button>
            </div>

            <div class="chart-data-config-section">
              <div class="chart-config-title">Configuración de la gráfica</div>
              <div class="chart-control-row">
                <span class="chart-control-label">Colorear por</span>
                <div class="settings-dropdown-wrapper" data-ref="dropdown-wrapper-color-by">
                  <button type="button" class="dropdown-trigger dropdown-trigger--sm dropdown-trigger--full" data-ref="trigger-chart-color-by">
                    <span class="dropdown-trigger__text" data-ref="text-chart-color-by">Por categoría (multicolor)</span>
                    <svg class="component-icon dropdown-trigger__chevron" aria-hidden="true"><use href="/icons.svg#expand_more"></use></svg>
                  </button>
                  <div class="dropdown-backdrop" data-ref="backdrop-chart-color-by">
                    <div class="menu-panel menu-panel--dropdown menu-panel--w-full menu-panel--h-auto" data-ref="menu-chart-color-by">
                      <div class="menu-panel__drag-zone" aria-hidden="true">
                        <div class="menu-panel__drag-handle"></div>
                      </div>
                      <div class="menu-panel__list" data-ref="list-color-by">
                        <button type="button" class="menu-item menu-item--sm is-active" data-ref="opt-color-by-category" data-value="category">
                          <span class="menu-item__text">Por categoría (multicolor)</span>
                        </button>
                        <button type="button" class="menu-item menu-item--sm" data-ref="opt-color-by-series" data-value="series">
                          <span class="menu-item__text">Por serie de datos</span>
                        </button>
                        <button type="button" class="menu-item menu-item--sm" data-ref="opt-color-by-single" data-value="single">
                          <span class="menu-item__text">Color único uniforme</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="chart-tab-pane is-hidden" data-ref="chart-pane-customize">
            <div class="chart-accordion">
              <div class="chart-accordion__item">
                <div class="chart-accordion__header">
                  <span class="chart-accordion__title">Texto y Leyenda</span>
                  <svg class="component-icon chart-accordion__arrow" aria-hidden="true"><use href="/icons.svg#expand_more"></use></svg>
                </div>
                <div class="chart-accordion__content">
                  <div class="chart-control-row">
                    <span class="chart-control-label">Leyenda</span>
                    <label class="chart-switch">
                      <input class="chart-switch__input" data-ref="chart-toggle-legend" type="checkbox" checked />
                      <span class="chart-switch__slider"></span>
                    </label>
                  </div>

                  <div class="chart-control-row">
                    <span class="chart-control-label">Etiquetas de datos</span>
                    <label class="chart-switch">
                      <input class="chart-switch__input" data-ref="chart-toggle-data-labels" type="checkbox" />
                      <span class="chart-switch__slider"></span>
                    </label>
                  </div>

                  <div class="chart-control-col">
                    <span class="chart-control-label">Posición de etiqueta</span>
                    <div class="chart-segmented-control">
                      <button type="button" class="chart-segmented-btn is-active" data-chart-pos="auto">Automático</button>
                      <button type="button" class="chart-segmented-btn" data-chart-pos="outside">Externo</button>
                      <button type="button" class="chart-segmented-btn" data-chart-pos="inside">Interno</button>
                    </div>
                  </div>

                  <div class="chart-control-col">
                    <label class="field field--sm" data-ref="field-chart-title">
                      <input class="field__input" data-ref="chart-input-title" type="text" placeholder=" " />
                      <span class="field__label" data-ref="label-chart-title">Título</span>
                    </label>
                  </div>

                  <div class="chart-control-col">
                    <label class="field field--sm" data-ref="field-chart-subtitle">
                      <input class="field__input" data-ref="chart-input-subtitle" type="text" placeholder=" " />
                      <span class="field__label" data-ref="label-chart-subtitle">Subtítulo</span>
                    </label>
                  </div>

                  <div class="chart-control-col">
                    <label class="field field--sm" data-ref="field-chart-source">
                      <input class="field__input" data-ref="chart-input-source" type="text" placeholder=" " />
                      <span class="field__label" data-ref="label-chart-source">Fuente</span>
                    </label>
                  </div>
                </div>
              </div>

              <div class="chart-accordion__item">
                <div class="chart-accordion__header">
                  <span class="chart-accordion__title">Eje X</span>
                  <svg class="component-icon chart-accordion__arrow" aria-hidden="true"><use href="/icons.svg#expand_more"></use></svg>
                </div>
                <div class="chart-accordion__content">
                  <div class="chart-control-col">
                    <label class="field field--sm" data-ref="field-chart-x-title">
                      <input class="field__input" data-ref="chart-input-x-title" type="text" placeholder=" " />
                      <span class="field__label" data-ref="label-chart-x-title">Título del eje X</span>
                    </label>
                  </div>
                  <div class="chart-control-row">
                    <span class="chart-control-label">Etiquetas del eje X</span>
                    <label class="chart-switch">
                      <input class="chart-switch__input" data-ref="chart-toggle-x-labels" type="checkbox" checked />
                      <span class="chart-switch__slider"></span>
                    </label>
                  </div>
                </div>
              </div>

              <div class="chart-accordion__item">
                <div class="chart-accordion__header">
                  <span class="chart-accordion__title">Eje Y</span>
                  <svg class="component-icon chart-accordion__arrow" aria-hidden="true"><use href="/icons.svg#expand_more"></use></svg>
                </div>
                <div class="chart-accordion__content">
                  <div class="chart-control-col">
                    <label class="field field--sm" data-ref="field-chart-y-title">
                      <input class="field__input" data-ref="chart-input-y-title" type="text" placeholder=" " />
                      <span class="field__label" data-ref="label-chart-y-title">Título del eje Y</span>
                    </label>
                  </div>

                  <div class="chart-control-row">
                    <span class="chart-control-label">Etiquetas del eje Y</span>
                    <label class="chart-switch">
                      <input class="chart-switch__input" data-ref="chart-toggle-y-labels" type="checkbox" checked />
                      <span class="chart-switch__slider"></span>
                    </label>
                  </div>

                  <div class="chart-control-row">
                    <span class="chart-control-label">Estilo numérico</span>
                    <div class="settings-dropdown-wrapper" data-ref="dropdown-wrapper-number-style">
                      <button type="button" class="dropdown-trigger dropdown-trigger--sm dropdown-trigger--full" data-ref="trigger-chart-number-style">
                        <span class="dropdown-trigger__text" data-ref="text-chart-number-style">1000.00</span>
                        <svg class="component-icon dropdown-trigger__chevron" aria-hidden="true"><use href="/icons.svg#expand_more"></use></svg>
                      </button>
                      <div class="dropdown-backdrop" data-ref="backdrop-chart-number-style">
                        <div class="menu-panel menu-panel--dropdown menu-panel--w-full menu-panel--h-auto" data-ref="menu-chart-number-style">
                          <div class="menu-panel__drag-zone" aria-hidden="true">
                            <div class="menu-panel__drag-handle"></div>
                          </div>
                          <div class="menu-panel__list" data-ref="list-number-style">
                            <button type="button" class="menu-item menu-item--sm is-active" data-ref="opt-number-style-normal" data-value="normal">
                              <span class="menu-item__text">1000.00</span>
                            </button>
                            <button type="button" class="menu-item menu-item--sm" data-ref="opt-number-style-comma" data-value="comma">
                              <span class="menu-item__text">1,000.00</span>
                            </button>
                            <button type="button" class="menu-item menu-item--sm" data-ref="opt-number-style-dot" data-value="dot">
                              <span class="menu-item__text">1.000,00</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div class="chart-control-row">
                    <span class="chart-control-label">Abreviatura</span>
                    <div class="settings-dropdown-wrapper" data-ref="dropdown-wrapper-abbrev">
                      <button type="button" class="dropdown-trigger dropdown-trigger--sm dropdown-trigger--full" data-ref="trigger-chart-abbrev">
                        <span class="dropdown-trigger__text" data-ref="text-chart-abbrev">Ninguno</span>
                        <svg class="component-icon dropdown-trigger__chevron" aria-hidden="true"><use href="/icons.svg#expand_more"></use></svg>
                      </button>
                      <div class="dropdown-backdrop" data-ref="backdrop-chart-abbrev">
                        <div class="menu-panel menu-panel--dropdown menu-panel--w-full menu-panel--h-auto" data-ref="menu-chart-abbrev">
                          <div class="menu-panel__drag-zone" aria-hidden="true">
                            <div class="menu-panel__drag-handle"></div>
                          </div>
                          <div class="menu-panel__list" data-ref="list-abbrev">
                            <button type="button" class="menu-item menu-item--sm is-active" data-ref="opt-abbrev-none" data-value="none">
                              <span class="menu-item__text">Ninguno</span>
                            </button>
                            <button type="button" class="menu-item menu-item--sm" data-ref="opt-abbrev-kmb" data-value="kmb">
                              <span class="menu-item__text">K / M / B</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div class="chart-control-row">
                    <span class="chart-control-label">Decimales</span>
                    <div class="chart-stepper">
                      <button type="button" class="chart-stepper__btn" data-ref="chart-btn-decimals-dec" aria-label="Menos decimales">-</button>
                      <span class="chart-stepper__value" data-ref="chart-label-decimals">0</span>
                      <button type="button" class="chart-stepper__btn" data-ref="chart-btn-decimals-inc" aria-label="Más decimales">+</button>
                    </div>
                  </div>

                  <div class="chart-control-row chart-control-row--dual">
                    <label class="field field--sm chart-field--half" data-ref="field-chart-prefix">
                      <input class="field__input" data-ref="chart-input-prefix" type="text" placeholder=" " />
                      <span class="field__label" data-ref="label-chart-prefix">Prefijo</span>
                    </label>
                    <label class="field field--sm chart-field--half" data-ref="field-chart-suffix">
                      <input class="field__input" data-ref="chart-input-suffix" type="text" placeholder=" " />
                      <span class="field__label" data-ref="label-chart-suffix">Sufijo</span>
                    </label>
                  </div>
                </div>
              </div>

              <div class="chart-accordion__item">
                <div class="chart-accordion__header">
                  <span class="chart-accordion__title">Estilo y Colores</span>
                  <svg class="component-icon chart-accordion__arrow" aria-hidden="true"><use href="/icons.svg#expand_more"></use></svg>
                </div>
                <div class="chart-accordion__content">
                  <div class="chart-control-col">
                    <span class="chart-control-label">Paleta de colores</span>
                    <div class="chart-palettes-list" data-ref="chart-palettes-list"></div>
                  </div>

                  <div class="chart-control-col">
                    <span class="chart-control-label">Redondeo de barras</span>
                    <input class="chart-slider" data-ref="chart-slider-radius" type="range" min="0" max="24" value="8" aria-label="Redondeo de barras" />
                  </div>

                  <div class="chart-control-row">
                    <span class="chart-control-label">Líneas de cuadrícula</span>
                    <label class="chart-switch">
                      <input class="chart-switch__input" data-ref="chart-toggle-gridlines" type="checkbox" checked />
                      <span class="chart-switch__slider"></span>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  const btnClose = drawerBody.querySelector<HTMLElement>('[data-ref="btn-close-canvas-panel"]');
  btnClose?.addEventListener('click', (e) => {
    e.preventDefault();
    toggleDrawer(false);
  });

  const btnBack = drawerBody.querySelector<HTMLButtonElement>('[data-ref="btn-chart-back-to-gallery"]');
  btnBack?.addEventListener('click', () => {
    const controller = getActiveCanvasController();
    const chartsPanel = controller?.getChartsPanel?.();
    if (activeChartInDrawer) {
      activeChartInDrawer = null;
      chartsPanel?.showGallery();
      btnBack.classList.add('is-hidden');
    } else {
      activeCanvasTab = 'elements';
      if (drawer) {
        void populateDrawerContent(drawer);
      }
    }
  });

  const controller = getActiveCanvasController();
  const chartsPanel = controller?.getChartsPanel?.();
  const panelEl = drawerBody.querySelector<HTMLElement>('[data-ref="board-charts-drawer"]');
  if (panelEl && chartsPanel) {
    chartsPanel.attach(panelEl, activeChartInDrawer || undefined, btnBack);
  }

  const drawerFooter = drawer.querySelector<HTMLElement>('[data-ref="drawer-footer"]');
  if (drawerFooter) {
    drawerFooter.style.display = 'none';
  }

  if (sidebar) {
    updateCanvasRailActiveState(sidebar);
  }

  renderIcons(drawerBody);
}

function renderMockupsDrawerContent(drawer: HTMLElement, drawerBody: HTMLElement): void {
  const sidebar = drawer.closest<HTMLElement>('[data-ref="sidebar"]') || document.querySelector<HTMLElement>('[data-ref="sidebar"]');

  drawerBody.innerHTML = `
    <div class="canvas-panel-card" data-ref="canvas-panel-card">
      <div class="canvas-panel-card__header" data-ref="canvas-panel-header">
        <div class="canvas-panel-card__title-box" data-ref="canvas-panel-title-box">
          <button type="button" class="component-button component-button--h32 component-button--icon-only" data-ref="btn-mockups-back-to-elements" data-tooltip="Volver a elementos" aria-label="Volver">
            <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#arrow_back"></use></svg>
          </button>
          <svg class="component-icon canvas-panel-card__icon" aria-hidden="true"><use href="/icons.svg#devices"></use></svg>
          <span class="canvas-panel-card__title" data-ref="canvas-panel-title">Mockups</span>
        </div>
        <button type="button" class="component-button component-button--h32 component-button--icon-only rail-btn canvas-panel-card__close" data-ref="btn-close-canvas-panel" data-tooltip="Cerrar panel" aria-label="Cerrar panel">
          <svg class="component-icon rail-btn__icon" aria-hidden="true"><use href="/icons.svg#close"></use></svg>
        </button>
      </div>
      <div class="canvas-panel-card__body layout-drawer__mockup-body" data-ref="board-mockups-drawer">
        <div class="mockup-search-box">
          <label class="field field--sm mockup-search-field" data-ref="field-mockup-search">
            <input class="field__input mockup-search-input" data-ref="mockup-search-input" type="text" placeholder=" " />
            <span class="field__label" data-ref="label-mockup-search">Buscar mockups...</span>
          </label>
        </div>
        <div class="mockup-category-tabs" data-ref="mockup-category-tabs"></div>
        <div class="mockup-templates-grid" data-ref="mockup-templates-grid"></div>
      </div>
    </div>
  `;

  const btnClose = drawerBody.querySelector<HTMLElement>('[data-ref="btn-close-canvas-panel"]');
  btnClose?.addEventListener('click', (e) => {
    e.preventDefault();
    toggleDrawer(false);
  });

  const btnBack = drawerBody.querySelector<HTMLButtonElement>('[data-ref="btn-mockups-back-to-elements"]');
  btnBack?.addEventListener('click', () => {
    activeCanvasTab = 'elements';
    if (drawer) {
      void populateDrawerContent(drawer);
    }
  });

  const controller = getActiveCanvasController();
  const mockupsPanel = controller?.getMockupsPanel?.();
  const panelEl = drawerBody.querySelector<HTMLElement>('[data-ref="board-mockups-drawer"]');
  if (panelEl && mockupsPanel) {
    mockupsPanel.attach(panelEl);
  }

  const drawerFooter = drawer.querySelector<HTMLElement>('[data-ref="drawer-footer"]');
  if (drawerFooter) {
    drawerFooter.style.display = 'none';
  }

  if (sidebar) {
    updateCanvasRailActiveState(sidebar);
  }

  renderIcons(drawerBody);
}

function renderColorsDrawerContent(drawer: HTMLElement, drawerBody: HTMLElement): void {
  const sidebar = drawer.closest<HTMLElement>('[data-ref="sidebar"]') || document.querySelector<HTMLElement>('[data-ref="sidebar"]');
  const target = activeColorTargetInDrawer;
  const title = target === 'slide-bg' ? 'Color de fondo de diapositiva' : (target === 'stroke' ? 'Color de trazo o borde' : (target === 'fill' ? 'Color de relleno' : 'Color de texto'));

  drawerBody.innerHTML = `
    <div class="canvas-panel-card" data-ref="canvas-panel-card">
      <div class="canvas-panel-card__header" data-ref="board-colors-header">
        <div class="canvas-panel-card__title-box" data-ref="board-colors-title-box">
          <svg class="component-icon canvas-panel-card__icon" aria-hidden="true"><use href="/icons.svg#palette"></use></svg>
          <span class="canvas-panel-card__title" data-ref="board-colors-title">${title}</span>
        </div>
        <button type="button" class="component-button component-button--h32 component-button--icon-only rail-btn canvas-panel-card__close" data-ref="btn-close-canvas-panel" data-tooltip="Cerrar panel" aria-label="Cerrar panel">
          <svg class="component-icon rail-btn__icon" aria-hidden="true"><use href="/icons.svg#close"></use></svg>
        </button>
      </div>
      <div class="canvas-panel-card__body layout-drawer__colors-body" data-ref="board-colors-body">
        <div class="design-colors-section" data-ref="custom-colors-section">
          <div class="design-colors-section__header">
            <div class="design-colors-section__title-box">
              <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#palette"></use></svg>
              <span class="design-colors-section__title">Colores personalizados</span>
            </div>
            <span class="design-colors-hex" data-ref="board-colors-hex-text">#1E293B</span>
          </div>
          <div class="design-colors-custom-row">
            <div class="design-color-btn-rainbow-wrapper" data-tooltip="Elegir color personalizado">
              <input class="design-color-active-input" data-ref="input-custom-color" type="color" value="#1e293b" aria-label="Seleccionar color personalizado" />
              <div class="design-color-btn-rainbow">
                <div class="design-color-btn-rainbow__inner">
                  <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#add"></use></svg>
                </div>
              </div>
            </div>
            <button type="button" class="design-color-btn-eyedropper" data-ref="btn-color-eyedropper" data-tooltip="Cuentagotas / Selector de color" aria-label="Selector de color">
              <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#colorize"></use></svg>
            </button>
            <button type="button" class="design-color-swatch-btn is-transparent" data-ref="color-swatch-transparent" data-color="transparent" data-tooltip="Transparente / Sin relleno" aria-label="Transparente"></button>
          </div>
        </div>

        <div class="design-colors-section" data-ref="colors-ramp-section">
          <div class="design-colors-section__header">
            <div class="design-colors-section__title-box">
              <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#gradient"></use></svg>
              <span class="design-colors-section__title">Rampa de sombreado</span>
            </div>
          </div>
          <div class="design-colors-ramp-grid" data-ref="board-colors-ramp-grid"></div>
        </div>

        <div class="design-colors-section" data-ref="colors-recent-section">
          <div class="design-colors-section__header">
            <div class="design-colors-section__title-box">
              <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#history"></use></svg>
              <span class="design-colors-section__title">Colores recientes</span>
            </div>
          </div>
          <div class="design-colors-palette-grid" data-ref="board-colors-recent-grid"></div>
        </div>

        <div class="design-colors-section" data-ref="colors-default-section">
          <div class="design-colors-section__header">
            <div class="design-colors-section__title-box">
              <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#color_lens"></use></svg>
              <span class="design-colors-section__title">Paleta por defecto</span>
            </div>
          </div>
          <div class="design-colors-palette-grid" data-ref="board-palette-grid"></div>
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

  const controller = getActiveCanvasController();
  if (controller && typeof controller.attachColorsUI === 'function') {
    controller.attachColorsUI(drawerBody, target);
  }
}

function renderFontsDrawerContent(drawer: HTMLElement, drawerBody: HTMLElement): void {
  const sidebar = drawer.closest<HTMLElement>('[data-ref="sidebar"]') || document.querySelector<HTMLElement>('[data-ref="sidebar"]');

  drawerBody.innerHTML = `
    <div class="canvas-panel-card" data-ref="canvas-panel-card">
      <div class="canvas-panel-card__header" data-ref="canvas-panel-header">
        <div class="canvas-panel-card__title-box" data-ref="canvas-panel-title-box">
          <svg class="component-icon canvas-panel-card__icon" aria-hidden="true"><use href="/icons.svg#font_download"></use></svg>
          <span class="canvas-panel-card__title" data-ref="canvas-panel-title">Tipografía</span>
        </div>
        <button type="button" class="component-button component-button--h32 component-button--icon-only rail-btn canvas-panel-card__close" data-ref="btn-close-canvas-panel" data-tooltip="Cerrar panel" aria-label="Cerrar panel">
          <svg class="component-icon rail-btn__icon" aria-hidden="true"><use href="/icons.svg#close"></use></svg>
        </button>
      </div>
      <div class="canvas-panel-card__body doc-font-picker-panel-body" data-ref="board-fonts-drawer-body" style="height: calc(100vh - 120px); overflow-y: auto; padding: 12px 14px;"></div>
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

  const fontsContainer = drawerBody.querySelector<HTMLElement>('[data-ref="board-fonts-drawer-body"]');
  const controller = getActiveCanvasController();
  if (controller && typeof controller.attachFontsUI === 'function' && fontsContainer) {
    controller.attachFontsUI(fontsContainer);
  }
}

function renderPixelAnimationDrawerContent(drawer: HTMLElement, drawerBody: HTMLElement): void {
  const sidebar = drawer.closest<HTMLElement>('[data-ref="sidebar"]') || document.querySelector<HTMLElement>('[data-ref="sidebar"]');

  drawerBody.innerHTML = `
    <div class="canvas-panel-card" data-ref="canvas-panel-card">
      <div class="canvas-panel-card__header" data-ref="canvas-panel-header">
        <div class="canvas-panel-card__title-box" data-ref="canvas-panel-title-box">
          <svg class="component-icon canvas-panel-card__icon" aria-hidden="true"><use href="/icons.svg#movie"></use></svg>
          <span class="canvas-panel-card__title" data-ref="canvas-panel-title">Capas y Animación</span>
        </div>
        <button type="button" class="component-button component-button--h32 component-button--icon-only rail-btn canvas-panel-card__close" data-ref="btn-close-canvas-panel" data-tooltip="Cerrar panel" aria-label="Cerrar panel">
          <svg class="component-icon rail-btn__icon" aria-hidden="true"><use href="/icons.svg#close"></use></svg>
        </button>
      </div>
      <div class="canvas-panel-card__body pixel-anim-panel-body" data-ref="board-pixel-anim-drawer-body" style="height: calc(100vh - 120px); overflow-y: auto; padding: 12px 14px;"></div>
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

  const container = drawerBody.querySelector<HTMLElement>('[data-ref="board-pixel-anim-drawer-body"]');
  const controller = getActiveCanvasController();
  if (controller && typeof controller.attachPixelAnimationUI === 'function' && container) {
    controller.attachPixelAnimationUI(container);
  }
}

function renderEffectsDrawerContent(drawer: HTMLElement, drawerBody: HTMLElement): void {
  const sidebar = drawer.closest<HTMLElement>('[data-ref="sidebar"]') || document.querySelector<HTMLElement>('[data-ref="sidebar"]');

  drawerBody.innerHTML = `
    <div class="canvas-panel-card" data-ref="board-effects-drawer">
      <div class="canvas-panel-card__header" data-ref="board-effects-header">
        <div class="canvas-panel-card__title-box" data-ref="board-effects-title-box">
          <svg class="component-icon canvas-panel-card__icon" aria-hidden="true"><use href="/icons.svg#auto_fix_high"></use></svg>
          <span class="canvas-panel-card__title" data-ref="board-effects-title">Efectos</span>
        </div>
        <button type="button" class="component-button component-button--h32 component-button--icon-only rail-btn canvas-panel-card__close" data-ref="btn-close-canvas-panel" data-tooltip="Cerrar panel" aria-label="Cerrar panel">
          <svg class="component-icon rail-btn__icon" aria-hidden="true"><use href="/icons.svg#close"></use></svg>
        </button>
      </div>
      <div class="canvas-panel-card__body layout-drawer__effects-body" data-ref="board-effects-body">
        <div class="elements-section-title">Efectos básicos</div>
        <div class="board-effects-grid canva-effects-grid" data-ref="effects-basic-grid"></div>
        <div class="board-effects-subcontrols canva-effects-subcontrols is-hidden" data-ref="effects-subcontrols-container"></div>
        <div class="elements-section-title" style="margin-top: 14px;">Filtros y estilo</div>
        <div class="board-effects-grid canva-effects-grid" data-ref="effects-advanced-grid"></div>
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

  const panelEl = drawerBody.querySelector<HTMLElement>('[data-ref="board-effects-drawer"]');
  const controller = getActiveCanvasController();
  const effectsPanel = controller?.getEffectsPanel?.();
  if (panelEl && effectsPanel) {
    effectsPanel.attach(panelEl);
    const selected = controller.getSelectedElements?.() || [];
    effectsPanel.sync(selected[0] || null);
  }
}

function renderAnimationDrawerContent(drawer: HTMLElement, drawerBody: HTMLElement): void {
  const sidebar = drawer.closest<HTMLElement>('[data-ref="sidebar"]') || document.querySelector<HTMLElement>('[data-ref="sidebar"]');

  drawerBody.innerHTML = `
    <div class="canvas-panel-card" data-ref="board-animation-drawer">
      <div class="canvas-panel-card__header" data-ref="board-animation-header">
        <div class="canvas-panel-card__title-box" data-ref="board-animation-title-box">
          <svg class="component-icon canvas-panel-card__icon" aria-hidden="true"><use href="/icons.svg#animation"></use></svg>
          <span class="canvas-panel-card__title" data-ref="board-animation-title">Animar</span>
        </div>
        <button type="button" class="component-button component-button--h32 component-button--icon-only rail-btn canvas-panel-card__close" data-ref="btn-close-canvas-panel" data-tooltip="Cerrar panel" aria-label="Cerrar panel">
          <svg class="component-icon rail-btn__icon" aria-hidden="true"><use href="/icons.svg#close"></use></svg>
        </button>
      </div>
      <div class="canvas-panel-card__body layout-drawer__animation-body" data-ref="board-animation-body">
        <div class="board-animation-config canva-animation-config is-hidden" data-ref="animation-config-container"></div>
        <div class="elements-section-title">Animaciones del elemento</div>
        <div class="board-effects-grid canva-effects-grid" data-ref="animation-presets-grid"></div>
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

  const panelEl = drawerBody.querySelector<HTMLElement>('[data-ref="board-animation-drawer"]');
  const controller = getActiveCanvasController();
  const animationPanel = controller?.getAnimationPanel?.();
  if (panelEl && animationPanel) {
    animationPanel.attach(panelEl);
    const selected = controller.getSelectedElements?.() || [];
    animationPanel.sync(selected[0] || null);
  }
}

function renderPositionDrawerContent(drawer: HTMLElement, drawerBody: HTMLElement): void {
  const sidebar = drawer.closest<HTMLElement>('[data-ref="sidebar"]') || document.querySelector<HTMLElement>('[data-ref="sidebar"]');

  drawerBody.innerHTML = `
    <div class="canvas-panel-card" data-ref="board-position-drawer">
      <div class="canvas-panel-card__header" data-ref="board-position-header">
        <div class="canvas-panel-card__title-box" data-ref="board-position-title-box">
          <svg class="component-icon canvas-panel-card__icon" aria-hidden="true"><use href="/icons.svg#layers"></use></svg>
          <span class="canvas-panel-card__title" data-ref="board-position-title">Posición</span>
        </div>
        <button type="button" class="component-button component-button--h32 component-button--icon-only rail-btn canvas-panel-card__close" data-ref="btn-close-canvas-panel" data-tooltip="Cerrar panel" aria-label="Cerrar panel">
          <svg class="component-icon rail-btn__icon" aria-hidden="true"><use href="/icons.svg#close"></use></svg>
        </button>
      </div>
      <div class="board-pos-tabs canva-pos-tabs" data-ref="board-pos-tabs">
        <button type="button" class="board-pos-tab canva-pos-tab is-active" data-ref="pos-tab-arrange">Organizar</button>
        <button type="button" class="board-pos-tab canva-pos-tab" data-ref="pos-tab-layers">Capas</button>
      </div>
      <div class="canvas-panel-card__body layout-drawer__position-body" data-ref="board-position-body">
        <div class="board-pos-view canva-pos-view" data-ref="pos-view-arrange"></div>
        <div class="board-pos-view canva-pos-view is-hidden" data-ref="pos-view-layers"></div>
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

  const panelEl = drawerBody.querySelector<HTMLElement>('[data-ref="board-position-drawer"]');
  const controller = getActiveCanvasController();
  const positionPanel = controller?.getPositionPanel?.();
  if (panelEl && positionPanel) {
    positionPanel.attach(panelEl);
    const selected = controller.getSelectedElements?.() || [];
    const elements = controller.elements || controller.getElements?.() || [];
    positionPanel.sync(selected[0] || null, elements);
  }
}

async function renderBrandDrawerContent(drawer: HTMLElement, drawerBody: HTMLElement): Promise<void> {
  const sidebar = drawer.closest<HTMLElement>('[data-ref="sidebar"]') || document.querySelector<HTMLElement>('[data-ref="sidebar"]');
  const canvasType = getActiveCanvasType();

  if (!currentUser || !hasFeature('brand_kits', currentUser)) {
    drawerBody.innerHTML = `
      <div class="canvas-panel-card" data-ref="canvas-panel-card">
        <div class="canvas-panel-card__header" data-ref="canvas-panel-header">
          <div class="canvas-panel-card__title-box" data-ref="canvas-panel-title-box">
            <svg class="component-icon canvas-panel-card__icon" aria-hidden="true"><use href="/icons.svg#palette"></use></svg>
            <span class="canvas-panel-card__title" data-ref="canvas-panel-title">${t('brand.title') || 'Kits de marca'}</span>
          </div>
          <button type="button" class="component-button component-button--h32 component-button--icon-only rail-btn canvas-panel-card__close" data-ref="btn-close-canvas-panel" data-tooltip="Cerrar panel" aria-label="Cerrar panel">
            <svg class="component-icon rail-btn__icon" aria-hidden="true"><use href="/icons.svg#close"></use></svg>
          </button>
        </div>
        <div class="canvas-panel-card__body" data-ref="canvas-panel-body">
          <div class="canvas-panel-card__empty" data-ref="brand-drawer-locked">
            <div class="brand-locked-badge" style="display: inline-flex; align-items: center; justify-content: center; width: 48px; height: 48px; border-radius: 50%; background: var(--bg-hover); margin-bottom: 12px; color: var(--color-primary, #6366f1);">
              <svg class="component-icon" style="width: 24px; height: 24px;" aria-hidden="true"><use href="/icons.svg#workspace_premium"></use></svg>
            </div>
            <span class="canvas-panel-card__empty-title" style="font-size: 15px; font-weight: 600; margin-bottom: 6px;">${t('brand.business_exclusive_title') || 'Exclusivo para Business'}</span>
            <p class="canvas-panel-card__empty-desc" style="margin-bottom: 16px;">${t('brand.drawer_locked_desc') || 'Gestiona hasta 500 kits de marca con paletas, logos, tipografías y recursos directamente en tu lienzo.'}</p>
            <button type="button" class="component-button component-button--h40 component-button--black component-button--w-full" data-ref="btn-drawer-upgrade-brand">
              <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#workspace_premium"></use></svg>
              <span>${t('plans.upgrade_to_business') || 'Actualizar a Business'}</span>
            </button>
          </div>
        </div>
      </div>
    `;

    const btnClose = drawerBody.querySelector<HTMLElement>('[data-ref="btn-close-canvas-panel"]');
    btnClose?.addEventListener('click', (e) => {
      e.preventDefault();
      toggleDrawer(false);
    });

    const btnUpgrade = drawerBody.querySelector<HTMLElement>('[data-ref="btn-drawer-upgrade-brand"]');
    btnUpgrade?.addEventListener('click', (e) => {
      e.preventDefault();
      openUpgradeModal('business');
    });

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

  drawerBody.innerHTML = `
    <div class="canvas-panel-card" data-ref="canvas-panel-card">
      <div class="canvas-panel-card__header" data-ref="canvas-panel-header">
        <div class="canvas-panel-card__title-box" data-ref="canvas-panel-title-box">
          <svg class="component-icon canvas-panel-card__icon" aria-hidden="true"><use href="/icons.svg#palette"></use></svg>
          <span class="canvas-panel-card__title" data-ref="canvas-panel-title">${t('brand.title') || 'Kit de marca'}</span>
        </div>
        <div style="display: flex; align-items: center; gap: 4px;">
          <button type="button" class="component-button component-button--h32 component-button--icon-only rail-btn" data-ref="btn-drawer-open-brand-page" data-tooltip="${t('brand.drawer_manage') || 'Administrar kits de marca'}" aria-label="${t('brand.drawer_manage') || 'Administrar kits de marca'}">
            <svg class="component-icon rail-btn__icon" aria-hidden="true"><use href="/icons.svg#open_in_new"></use></svg>
          </button>
          <button type="button" class="component-button component-button--h32 component-button--icon-only rail-btn canvas-panel-card__close" data-ref="btn-close-canvas-panel" data-tooltip="Cerrar panel" aria-label="Cerrar panel">
            <svg class="component-icon rail-btn__icon" aria-hidden="true"><use href="/icons.svg#close"></use></svg>
          </button>
        </div>
      </div>
      <div class="canvas-panel-card__body brand-drawer-body" data-ref="canvas-panel-body">
        <div class="brand-drawer-loading" data-ref="brand-drawer-loading">
          <div class="skeleton" style="height: 38px; border-radius: 8px; margin-bottom: 12px;"></div>
          <div class="skeleton" style="height: 100px; border-radius: 8px; margin-bottom: 12px;"></div>
          <div class="skeleton" style="height: 100px; border-radius: 8px;"></div>
        </div>
        <div class="brand-drawer-content" data-ref="brand-drawer-content" style="display: none;"></div>
      </div>
    </div>
  `;

  const btnClose = drawerBody.querySelector<HTMLElement>('[data-ref="btn-close-canvas-panel"]');
  btnClose?.addEventListener('click', (e) => {
    e.preventDefault();
    toggleDrawer(false);
  });

  const btnOpenPage = drawerBody.querySelector<HTMLElement>('[data-ref="btn-drawer-open-brand-page"]');
  btnOpenPage?.addEventListener('click', (e) => {
    e.preventDefault();
    toggleDrawer(false);
    navigate('/brand');
  });

  const drawerFooter = drawer.querySelector<HTMLElement>('[data-ref="drawer-footer"]');
  if (drawerFooter) {
    drawerFooter.style.display = 'none';
  }
  if (sidebar) {
    updateCanvasRailActiveState(sidebar);
  }
  renderIcons(drawerBody);

  const loadingEl = drawerBody.querySelector<HTMLElement>('[data-ref="brand-drawer-loading"]');
  const contentEl = drawerBody.querySelector<HTMLElement>('[data-ref="brand-drawer-content"]');

  const res = await getBrandKitsApi();
  const kits = res.kits || [];

  if (!loadingEl || !contentEl) return;
  loadingEl.style.display = 'none';
  contentEl.style.display = 'block';

  if (kits.length === 0) {
    contentEl.innerHTML = `
      <div class="canvas-panel-card__empty" data-ref="brand-drawer-empty">
        <div class="canvas-panel-card__empty-icon">
          <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#palette"></use></svg>
        </div>
        <span class="canvas-panel-card__empty-title">${t('brand.drawer_empty_title') || 'No hay kits de marca'}</span>
        <p class="canvas-panel-card__empty-desc">${t('brand.drawer_empty_desc') || 'Crea tu primer kit de marca para organizar tus logos, paletas y recursos.'}</p>
        <button type="button" class="component-button component-button--h36 component-button--black component-button--w-full" data-ref="btn-drawer-create-first-kit" style="margin-top: 12px;">
          <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#add"></use></svg>
          <span>${t('brand.create_kit') || 'Crear kit de marca'}</span>
        </button>
      </div>
    `;
    const btnCreateKit = contentEl.querySelector<HTMLElement>('[data-ref="btn-drawer-create-first-kit"]');
    btnCreateKit?.addEventListener('click', () => {
      toggleDrawer(false);
      navigate('/brand');
    });
    renderIcons(contentEl);
    return;
  }

  let activeKitUuid = kits.find((k) => k.is_default)?.uuid || kits[0].uuid;

  const roleLabels: Record<string, string> = {
    body: 'Cuerpo',
    body_secondary: 'Texto secundario',
    caption: 'Pie de página',
    heading_secondary: 'Subtítulo secundario',
    subtitle: 'Subtítulo',
    title: 'Título',
  };

  const renderActiveKitDetail = async (uuid: string) => {
    const activeKit = kits.find((k) => k.uuid === uuid) || kits[0];

    contentEl.innerHTML = `
      <div class="settings-dropdown-wrapper settings-dropdown-wrapper--full" data-ref="dropdown-wrapper-brand-kit" style="margin-bottom: 12px;">
        <button type="button" class="dropdown-trigger dropdown-trigger--full" data-ref="trigger-brand-kit">
          <div class="dropdown-trigger__left">
            <svg class="component-icon dropdown-trigger__icon" aria-hidden="true"><use href="/icons.svg#${activeKit.is_default ? 'star' : 'palette'}"></use></svg>
            <span class="dropdown-trigger__text" data-ref="text-brand-kit">${escapeHtml(activeKit.name)}</span>
          </div>
          <svg class="component-icon dropdown-trigger__chevron" aria-hidden="true"><use href="/icons.svg#expand_more"></use></svg>
        </button>
        <div class="dropdown-backdrop" data-ref="backdrop-brand-kit">
          <div class="menu-panel menu-panel--dropdown menu-panel--w-full menu-panel--h-auto" data-ref="menu-brand-kit">
            <div class="menu-panel__drag-zone" aria-hidden="true">
              <div class="menu-panel__drag-handle"></div>
            </div>
            <div class="menu-panel__list" data-ref="list-brand-kits">
              ${kits.map((k) => `
                <button type="button" class="menu-item${k.uuid === uuid ? ' is-active' : ''}" data-ref="opt-brand-kit-${k.uuid}" data-value="${k.uuid}">
                  <svg class="component-icon menu-item__icon" aria-hidden="true"><use href="/icons.svg#${k.is_default ? 'star' : 'palette'}"></use></svg>
                  <span class="menu-item__text">${escapeHtml(k.name)}</span>
                  ${k.is_default ? '<span class="menu-item__shortcut">Predeterminado</span>' : ''}
                </button>
              `).join('')}
            </div>
          </div>
        </div>
      </div>
      <div class="brand-drawer-kit-loading">
        <div class="skeleton" style="height: 80px; border-radius: 8px; margin-bottom: 10px;"></div>
        <div class="skeleton" style="height: 80px; border-radius: 8px;"></div>
      </div>
    `;

    const dropdownWrapper = contentEl.querySelector<HTMLElement>('[data-ref="dropdown-wrapper-brand-kit"]');
    if (dropdownWrapper) {
      setupDropdown(dropdownWrapper, {
        onSelect: (val) => {
          if (val && val !== activeKitUuid) {
            activeKitUuid = val;
            void renderActiveKitDetail(activeKitUuid);
          }
        },
      });
    }

    const detailRes = await getBrandKitDetailApi(uuid);
    const kit = detailRes.kit;
    if (!kit) {
      contentEl.innerHTML = `<p class="canvas-panel-card__empty-desc">Error al cargar kit de marca.</p>`;
      return;
    }

    let html = `
      <div class="settings-dropdown-wrapper settings-dropdown-wrapper--full" data-ref="dropdown-wrapper-brand-kit" style="margin-bottom: 12px;">
        <button type="button" class="dropdown-trigger dropdown-trigger--full" data-ref="trigger-brand-kit">
          <div class="dropdown-trigger__left">
            <svg class="component-icon dropdown-trigger__icon" aria-hidden="true"><use href="/icons.svg#${activeKit.is_default ? 'star' : 'palette'}"></use></svg>
            <span class="dropdown-trigger__text" data-ref="text-brand-kit">${escapeHtml(activeKit.name)}</span>
          </div>
          <svg class="component-icon dropdown-trigger__chevron" aria-hidden="true"><use href="/icons.svg#expand_more"></use></svg>
        </button>
        <div class="dropdown-backdrop" data-ref="backdrop-brand-kit">
          <div class="menu-panel menu-panel--dropdown menu-panel--w-full menu-panel--h-auto" data-ref="menu-brand-kit">
            <div class="menu-panel__drag-zone" aria-hidden="true">
              <div class="menu-panel__drag-handle"></div>
            </div>
            <div class="menu-panel__list" data-ref="list-brand-kits">
              ${kits.map((k) => `
                <button type="button" class="menu-item${k.uuid === uuid ? ' is-active' : ''}" data-ref="opt-brand-kit-${k.uuid}" data-value="${k.uuid}">
                  <svg class="component-icon menu-item__icon" aria-hidden="true"><use href="/icons.svg#${k.is_default ? 'star' : 'palette'}"></use></svg>
                  <span class="menu-item__text">${escapeHtml(k.name)}</span>
                  ${k.is_default ? '<span class="menu-item__shortcut">Predeterminado</span>' : ''}
                </button>
              `).join('')}
            </div>
          </div>
        </div>
      </div>
      <div class="brand-drawer-sections" data-ref="brand-drawer-sections">
    `;

    let hasAnyItems = false;

    if (kit.colors && kit.colors.length > 0) {
      hasAnyItems = true;
      html += `
        <div class="elements-section-title">
          <span>${t('brand.tab_colors') || 'Colores'}</span>
          <span style="font-size: 11px; opacity: 0.6; font-weight: normal; margin-left: auto;">${kit.colors.length}</span>
        </div>
        <div class="brand-drawer-swatches-grid" data-ref="brand-drawer-colors-grid">
          ${kit.colors.map((c) => {
            const hexVal = c.hex || c.hex_value || '#6366f1';
            return `
              <button type="button" class="brand-drawer-swatch-btn" data-ref="brand-swatch-${c.id}" data-color-hex="${hexVal}" data-color-name="${escapeHtml(c.name)}" data-tooltip="${escapeHtml(c.name)} (${hexVal})" aria-label="${escapeHtml(c.name)}" style="background-color: ${hexVal};"></button>
            `;
          }).join('')}
        </div>
      `;
    }

    if (kit.fonts && kit.fonts.length > 0) {
      hasAnyItems = true;
      html += `
        <div class="elements-section-title">
          <span>${t('brand.tab_fonts') || 'Tipografía'}</span>
          <span style="font-size: 11px; opacity: 0.6; font-weight: normal; margin-left: auto;">${kit.fonts.length}</span>
        </div>
        <div class="brand-drawer-fonts-list" style="display: flex; flex-direction: column; gap: 4px; margin-bottom: 12px;">
          ${kit.fonts.map((f) => {
            const roleLabel = roleLabels[f.role] || f.role;
            return `
              <button type="button" class="menu-item menu-item--bordered brand-drawer-font-item" data-ref="brand-font-btn-${f.role}" data-font-family="${escapeHtml(f.font_family)}" data-font-weight="${f.font_weight}" data-font-size="${f.font_size || 16}" data-font-role="${f.role}">
                <div style="display: flex; flex-direction: column; gap: 2px; overflow: hidden; min-width: 0; text-align: left;">
                  <span style="font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-tertiary);">${escapeHtml(roleLabel)}</span>
                  <span class="brand-drawer-font-preview" style="font-size: 13px; font-family: '${escapeHtml(f.font_family)}', sans-serif; font-weight: ${f.font_weight};">${escapeHtml(f.font_family)}</span>
                </div>
                <span class="menu-item__shortcut" style="margin-left: 8px;">${f.font_size || 16}px</span>
              </button>
            `;
          }).join('')}
        </div>
      `;
    }

    if (kit.logos && kit.logos.length > 0) {
      hasAnyItems = true;
      html += `
        <div class="elements-section-title">
          <span>${t('brand.tab_logos') || 'Logos'}</span>
          <span style="font-size: 11px; opacity: 0.6; font-weight: normal; margin-left: auto;">${kit.logos.length}</span>
        </div>
        <div class="elements-grid" data-ref="canvas-brand-logos-grid">
          ${kit.logos.map((l) => {
            const url = l.url || l.file_url || '';
            return `
              <button type="button" class="element-grid-item" data-ref="brand-logo-btn-${l.id}" data-asset-url="${url}" data-asset-name="${escapeHtml(l.name)}" data-asset-w="${l.width || 200}" data-asset-h="${l.height || 200}" data-tooltip="${escapeHtml(l.name)}" aria-label="${escapeHtml(l.name)}">
                <img class="canvas-upload-img image-lazy-fade image-loaded" data-ref="img-brand-logo-${l.id}" src="${url}" alt="${escapeHtml(l.name)}" loading="lazy" decoding="async" onload="this.classList.add('image-loaded')" onerror="this.classList.add('image-loaded')" />
              </button>
            `;
          }).join('')}
        </div>
      `;
    }

    if (kit.photos && kit.photos.length > 0) {
      hasAnyItems = true;
      html += `
        <div class="elements-section-title">
          <span>${t('brand.tab_photos') || 'Fotos'}</span>
          <span style="font-size: 11px; opacity: 0.6; font-weight: normal; margin-left: auto;">${kit.photos.length}</span>
        </div>
        <div class="elements-grid" data-ref="canvas-brand-photos-grid">
          ${kit.photos.map((p) => {
            const url = p.url || p.file_url || '';
            return `
              <button type="button" class="element-grid-item" data-ref="brand-photo-btn-${p.id}" data-asset-url="${url}" data-asset-name="${escapeHtml(p.name)}" data-asset-w="${p.width || 300}" data-asset-h="${p.height || 200}" data-tooltip="${escapeHtml(p.name)}" aria-label="${escapeHtml(p.name)}">
                <img class="canvas-upload-img image-lazy-fade image-loaded" data-ref="img-brand-photo-${p.id}" src="${url}" alt="${escapeHtml(p.name)}" loading="lazy" decoding="async" onload="this.classList.add('image-loaded')" onerror="this.classList.add('image-loaded')" />
              </button>
            `;
          }).join('')}
        </div>
      `;
    }

    const brandGraphics = kit.elements || kit.graphics || [];
    if (brandGraphics.length > 0) {
      hasAnyItems = true;
      html += `
        <div class="elements-section-title">
          <span>${t('brand.tab_graphics') || 'Elementos'}</span>
          <span style="font-size: 11px; opacity: 0.6; font-weight: normal; margin-left: auto;">${brandGraphics.length}</span>
        </div>
        <div class="elements-grid" data-ref="canvas-brand-graphics-grid">
          ${brandGraphics.map((g: BrandKitAsset) => {
            const url = g.url || g.file_url || '';
            return `
              <button type="button" class="element-grid-item" data-ref="brand-graphic-btn-${g.id}" data-asset-url="${url}" data-asset-name="${escapeHtml(g.name)}" data-asset-w="${g.width || 200}" data-asset-h="${g.height || 200}" data-tooltip="${escapeHtml(g.name)}" aria-label="${escapeHtml(g.name)}">
                <img class="canvas-upload-img image-lazy-fade image-loaded" data-ref="img-brand-graphic-${g.id}" src="${url}" alt="${escapeHtml(g.name)}" loading="lazy" decoding="async" onload="this.classList.add('image-loaded')" onerror="this.classList.add('image-loaded')" />
              </button>
            `;
          }).join('')}
        </div>
      `;
    }

    if (kit.charts && kit.charts.length > 0) {
      hasAnyItems = true;
      html += `
        <div class="elements-section-title">
          <span>${t('brand.tab_charts') || 'Gráficas'}</span>
          <span style="font-size: 11px; opacity: 0.6; font-weight: normal; margin-left: auto;">${kit.charts.length}</span>
        </div>
        <div style="display: flex; flex-direction: column; gap: 4px; margin-bottom: 12px;">
          ${kit.charts.map((c) => `
            <button type="button" class="menu-item menu-item--bordered" data-ref="brand-chart-btn-${c.id}" data-chart-type="${c.chart_type}">
              <svg class="component-icon menu-item__icon" aria-hidden="true"><use href="/icons.svg#bar_chart"></use></svg>
              <span class="menu-item__text">${escapeHtml(c.name)}</span>
            </button>
          `).join('')}
        </div>
      `;
    }

    if (kit.templates && kit.templates.length > 0) {
      hasAnyItems = true;
      html += `
        <div class="elements-section-title">
          <span>${t('brand.tab_templates') || 'Plantillas'}</span>
          <span style="font-size: 11px; opacity: 0.6; font-weight: normal; margin-left: auto;">${kit.templates.length}</span>
        </div>
        <div class="elements-grid" data-ref="canvas-brand-templates-grid">
          ${kit.templates.map((tItem) => {
            const tplUuid = tItem.template_canvas_uuid || tItem.canvas_uuid || tItem.uuid || '';
            return `
              <button type="button" class="element-grid-item" data-ref="brand-template-btn-${tItem.id}" data-template-uuid="${tplUuid}" data-tooltip="${escapeHtml(tItem.name)}" aria-label="${escapeHtml(tItem.name)}">
                ${tItem.preview_thumbnail ? `<img class="canvas-upload-img image-lazy-fade image-loaded" src="${tItem.preview_thumbnail}" alt="${escapeHtml(tItem.name)}" loading="lazy" decoding="async" onload="this.classList.add('image-loaded')" onerror="this.classList.add('image-loaded')" />` : `<svg class="component-icon" aria-hidden="true"><use href="/icons.svg#space_dashboard"></use></svg>`}
              </button>
            `;
          }).join('')}
        </div>
      `;
    }

    if (!hasAnyItems) {
      html += `
        <div class="canvas-panel-card__empty" data-ref="brand-kit-empty" style="padding: 20px 8px;">
          <span class="canvas-panel-card__empty-title">Kit sin elementos</span>
          <p class="canvas-panel-card__empty-desc">Personaliza este kit agregando colores, logos, tipografías y recursos.</p>
        </div>
      `;
    }

    html += `
        <div style="padding-top: 12px; border-top: 1px solid var(--border-color); margin-top: 8px; display: flex; flex-direction: column; gap: 4px;">
          <button type="button" class="menu-item" data-ref="btn-drawer-manage-kit">
            <svg class="component-icon menu-item__icon" aria-hidden="true"><use href="/icons.svg#tune"></use></svg>
            <span class="menu-item__text">${t('brand.drawer_manage') || 'Administrar kit de marca'}</span>
          </button>
        </div>
      </div>
    `;

    contentEl.innerHTML = html;

    const newDropdownWrapper = contentEl.querySelector<HTMLElement>('[data-ref="dropdown-wrapper-brand-kit"]');
    if (newDropdownWrapper) {
      setupDropdown(newDropdownWrapper, {
        onSelect: (val) => {
          if (val && val !== activeKitUuid) {
            activeKitUuid = val;
            void renderActiveKitDetail(activeKitUuid);
          }
        },
      });
    }

    const btnManage = contentEl.querySelector<HTMLElement>('[data-ref="btn-drawer-manage-kit"]');
    btnManage?.addEventListener('click', () => {
      toggleDrawer(false);
      navigate('/brand');
    });

    contentEl.querySelectorAll<HTMLButtonElement>('[data-color-hex]').forEach((swatch) => {
      swatch.addEventListener('click', () => {
        const hex = swatch.getAttribute('data-color-hex') || '';
        if (!hex) return;
        try {
          navigator.clipboard.writeText(hex);
          showToast(`Color ${hex} copiado al portapapeles`, 'success');
        } catch {}

        const controller = getActiveCanvasController();
        if (controller && typeof controller.applyFillColor === 'function') {
          controller.applyFillColor(hex);
        } else if (controller && typeof controller.setColor === 'function') {
          controller.setColor(hex);
        }
      });
    });

    contentEl.querySelectorAll<HTMLButtonElement>('[data-font-family]').forEach((fontBtn) => {
      fontBtn.addEventListener('click', () => {
        const fontFamily = fontBtn.getAttribute('data-font-family') || 'sans-serif';
        const fontWeight = parseInt(fontBtn.getAttribute('data-font-weight') || '400', 10);
        const fontSize = parseInt(fontBtn.getAttribute('data-font-size') || '16', 10);
        const role = fontBtn.getAttribute('data-font-role') || 'body';

        const controller = getActiveCanvasController();
        const activeCanvas = getActiveCanvasType();

        if (activeCanvas === 'board' || activeCanvas === 'presentation') {
          if (typeof controller?.insertTextPreset === 'function') {
            controller.insertTextPreset({ fontFamily, fontSize, fontWeight, role });
          } else if (typeof controller?.insertText === 'function') {
            controller.insertText(role === 'title' ? 'Título de marca' : (role === 'subtitle' ? 'Subtítulo de marca' : 'Texto de párrafo'), fontFamily);
          }
          showToast(`Texto con «${fontFamily}» añadido al lienzo`, 'success');
        } else if (activeCanvas === 'doc') {
          controller?.insertText?.(fontFamily);
          showToast(`Texto insertado en el documento`, 'success');
        }
        if (window.innerWidth <= 768) toggleDrawer(false);
      });
    });

    contentEl.querySelectorAll<HTMLButtonElement>('[data-asset-url]').forEach((assetBtn) => {
      assetBtn.addEventListener('click', () => {
        const url = assetBtn.getAttribute('data-asset-url') || '';
        const name = assetBtn.getAttribute('data-asset-name') || 'Recurso de marca';
        const w = parseInt(assetBtn.getAttribute('data-asset-w') || '200', 10);
        const h = parseInt(assetBtn.getAttribute('data-asset-h') || '200', 10);

        const controller = getActiveCanvasController();
        const activeCanvas = getActiveCanvasType();

        if (activeCanvas === 'board' || activeCanvas === 'presentation') {
          controller?.insertImage?.(url, w, h, name);
          showToast(`«${name}» añadido al lienzo`, 'success');
        } else if (activeCanvas === 'doc') {
          controller?.insertImage?.(url, name);
          showToast(`«${name}» insertado en el documento`, 'success');
        }
        if (window.innerWidth <= 768) toggleDrawer(false);
      });
    });

    contentEl.querySelectorAll<HTMLButtonElement>('[data-chart-type]').forEach((chartBtn) => {
      chartBtn.addEventListener('click', () => {
        const chartType = chartBtn.getAttribute('data-chart-type') as ChartType;
        if (chartType) {
          handleApplyChart(chartType, canvasType);
        }
      });
    });

    renderIcons(contentEl);
  };

  await renderActiveKitDetail(activeKitUuid);
}

function renderCanvasDrawerContent(drawer: HTMLElement, drawerBody: HTMLElement): void {
  const tab = activeCanvasTab || 'templates';
  const sidebar = drawer.closest<HTMLElement>('[data-ref="sidebar"]') || document.querySelector<HTMLElement>('[data-ref="sidebar"]');

  if (tab === 'brand') {
    void renderBrandDrawerContent(drawer, drawerBody);
    return;
  }

  if (tab === 'effects') {
    renderEffectsDrawerContent(drawer, drawerBody);
    return;
  }

  if (tab === 'animate') {
    renderAnimationDrawerContent(drawer, drawerBody);
    return;
  }

  if (tab === 'position') {
    renderPositionDrawerContent(drawer, drawerBody);
    return;
  }

  if (tab === 'text') {
    renderTextDrawerContent(drawer, drawerBody);
    return;
  }

  if (tab === 'fonts') {
    renderFontsDrawerContent(drawer, drawerBody);
    return;
  }

  if (tab === 'pixel-anim') {
    renderPixelAnimationDrawerContent(drawer, drawerBody);
    return;
  }

  if (tab === 'elements') {
    renderElementsDrawerContent(drawer, drawerBody);
    return;
  }

  if (tab === 'charts') {
    renderChartsDrawerContent(drawer, drawerBody);
    return;
  }

  if (tab === 'mockups') {
    renderMockupsDrawerContent(drawer, drawerBody);
    return;
  }

  if (tab === 'colors') {
    renderColorsDrawerContent(drawer, drawerBody);
    return;
  }

  if (tab === 'uploads') {
    renderUploadsDrawerContent(drawer, drawerBody);
    return;
  }

  if (tab === 'apps') {
    renderAppsDrawerContent(drawer, drawerBody);
    return;
  }

  if (tab === 'templates') {
    const canvasType = getActiveCanvasType();
    const presets = ALL_PRESETS.filter((item) => {
      if (canvasType === 'doc') return item.canvasType === 'doc';
      return item.canvasType === 'board';
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
          <div class="menu-panel__search" data-ref="canvas-templates-search">
            <svg class="component-icon menu-panel__search-icon" aria-hidden="true"><use href="/icons.svg#search"></use></svg>
            <input class="menu-panel__search-input" data-ref="canvas-templates-search-input" type="text" maxlength="50" autocomplete="off" placeholder="${t('templates.search_placeholder') || 'Buscar plantillas...'}" />
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
        <div class="canvas-card template-card" data-ref="canvas-template-card-${item.id}" data-template-id="${item.id}" data-tooltip="${escapeHtml(item.name)}">
          <div class="canvas-card__thumbnail template-card__thumbnail" data-ref="template-thumb-${item.id}">
            <img class="canvas-card__image image-lazy-fade" data-ref="template-img-${item.id}" src="${item.imagePath}" alt="${escapeHtml(item.name)}" loading="lazy" decoding="async" onload="this.classList.add('image-loaded')" onerror="this.classList.add('image-loaded')" />
          </div>
        </div>
      `).join('');

      templatesList.querySelectorAll<HTMLElement>('.template-card').forEach((card) => {
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

  if (tab === 'projects') {
    void renderProjectsDrawerContent(drawer, drawerBody);
    return;
  }

  const tabMeta: Record<string, { desc: string; icon: string; title: string }> = {
    brand: {
      desc: 'Gestiona logos, colores, tipografías y recursos de tus kits de marca.',
      icon: 'palette',
      title: t('brand.title') || 'Kit de marca',
    },
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
    text: {
      desc: 'Agrega títulos, subtítulos y párrafos de texto a tu lienzo.',
      icon: 'text_fields',
      title: t('nav.text') || 'Texto',
    },
    tools: {
      desc: 'Herramientas de dibujo, selección, notas y formas en el lienzo.',
      icon: 'draw',
      title: t('nav.tools') || 'Herramientas',
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

function renderDocPageToDataUrl(page: DocPage, title = 'Documento'): Promise<string> {
  return new Promise((resolve) => {
    try {
      const width = 816;
      const height = 1056;
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(width * 1.5);
      canvas.height = Math.round(height * 1.5);
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve('');
        return;
      }

      ctx.scale(1.5, 1.5);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);

      const contentHtml = page.contentHtml || '<p>Página sin contenido</p>';
      const cleanHtml = contentHtml
        .replace(/&nbsp;/g, ' ')
        .replace(/<br>/g, '<br/>')
        .replace(/<img([^>]*?)(?<!\/)>/gi, '<img$1 />')
        .replace(/<hr([^>]*?)(?<!\/)>/gi, '<hr$1 />')
        .replace(/<input([^>]*?)(?<!\/)>/gi, '<input$1 />');

      const svgString = `
        <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
          <foreignObject width="100%" height="100%">
            <div xmlns="http://www.w3.org/1999/xhtml" style="box-sizing: border-box; width: ${width}px; height: ${height}px; padding: 48px 56px; background-color: #ffffff; color: #1e293b; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 14px; line-height: 1.6; word-break: break-word; overflow: hidden;">
              <style>
                p { margin: 0 0 10px 0; }
                h1 { font-size: 26px; font-weight: 700; margin: 0 0 16px 0; color: #0f172a; }
                h2 { font-size: 20px; font-weight: 600; margin: 16px 0 12px 0; color: #0f172a; }
                h3 { font-size: 16px; font-weight: 600; margin: 14px 0 8px 0; color: #0f172a; }
                ul, ol { margin: 0 0 12px 0; padding-left: 24px; }
                li { margin-bottom: 4px; }
                blockquote { border-left: 3px solid #3b82f6; padding-left: 12px; margin: 12px 0; color: #475569; font-style: italic; }
                table { width: 100%; border-collapse: collapse; margin: 12px 0; }
                th, td { border: 1px solid #cbd5e1; padding: 8px 12px; text-align: left; }
                th { background: #f8fafc; font-weight: 600; }
                img { max-width: 100%; height: auto; border-radius: 6px; }
                hr { border: none; border-top: 1px solid #e2e8f0; margin: 16px 0; }
              </style>
              ${cleanHtml}
            </div>
          </foreignObject>
        </svg>
      `;

      const img = new Image();
      const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
      const blobUrl = URL.createObjectURL(svgBlob);

      img.onload = () => {
        ctx.drawImage(img, 0, 0, width, height);
        URL.revokeObjectURL(blobUrl);
        resolve(canvas.toDataURL('image/png'));
      };

      img.onerror = () => {
        URL.revokeObjectURL(blobUrl);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(0, 0, width, 60);
        ctx.strokeStyle = '#e2e8f0';
        ctx.strokeRect(0, 0, width, height);
        ctx.fillStyle = '#0f172a';
        ctx.font = 'bold 20px sans-serif';
        ctx.fillText(title, 40, 38);
        ctx.fillStyle = '#64748b';
        ctx.font = '14px sans-serif';
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = page.contentHtml || '';
        const lines = (tempDiv.textContent || '').trim().split('\n').filter(Boolean);
        let y = 100;
        lines.slice(0, 25).forEach((line) => {
          ctx.fillText(line.slice(0, 80), 40, y);
          y += 24;
        });
        resolve(canvas.toDataURL('image/png'));
      };

      img.src = blobUrl;
    } catch {
      resolve('');
    }
  });
}

function openDocPageSelectionModal(
  canvas: CanvasItem,
  docProject: DocProject,
  targetCanvasType: 'board' | 'doc' | 'presentation'
): void {
  const pages = docProject.pages || [];
  if (pages.length === 0) {
    showToast('El documento no contiene páginas para insertar.', 'warning');
    return;
  }

  let selectedIndex = -1;

  const getPageSnippet = (html: string): string => {
    const temp = document.createElement('div');
    temp.innerHTML = html;
    const text = (temp.textContent || '').replace(/\s+/g, ' ').trim();
    return text.length > 90 ? `${text.slice(0, 90)}...` : (text || 'Página en blanco');
  };

  const modal = openModal({
    cancelText: 'Cancelar',
    confirmClass: 'component-button--black',
    confirmText: 'Insertar en el lienzo',
    description: `Este documento tiene ${pages.length} páginas. Selecciona cuál deseas colocar en tu lienzo:`,
    showCancel: true,
    showConfirm: true,
    size: 'lg',
    title: `Seleccionar página de «${canvas.name}»`,
    bodyHtml: `
      <div class="doc-page-picker" data-ref="doc-page-picker">
        <button type="button" class="doc-page-picker__item is-selected" data-ref="card-page-all">
          <div class="doc-page-picker__icon">
            <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#library_books"></use></svg>
          </div>
          <div class="doc-page-picker__info">
            <span class="doc-page-picker__title">Todas las páginas (${pages.length})</span>
            <span class="doc-page-picker__snippet">Inserta el documento entero con todas sus páginas de forma secuencial.</span>
          </div>
        </button>
        ${pages.map((p, idx) => `
          <button type="button" class="doc-page-picker__item" data-ref="card-page-${idx}" data-page-idx="${idx}">
            <div class="doc-page-picker__icon">
              <span class="doc-page-picker__page-num">${idx + 1}</span>
            </div>
            <div class="doc-page-picker__info">
              <span class="doc-page-picker__title">Página ${idx + 1}</span>
              <span class="doc-page-picker__snippet">${escapeHtml(getPageSnippet(p.contentHtml || ''))}</span>
            </div>
          </button>
        `).join('')}
      </div>
    `,
    onConfirm: async () => {
      modal.close();
      await handleApplyCanvasProject(canvas, targetCanvasType, selectedIndex, docProject);
    },
  });

  const pickerEl = modal.backdrop.querySelector<HTMLElement>('[data-ref="doc-page-picker"]');
  const allCard = pickerEl?.querySelector<HTMLElement>('[data-ref="card-page-all"]');
  const pageCards = pickerEl?.querySelectorAll<HTMLElement>('[data-page-idx]');

  const updateSelection = (idx: number) => {
    selectedIndex = idx;
    allCard?.classList.toggle('is-selected', selectedIndex === -1);
    pageCards?.forEach((c) => {
      const cardIdx = parseInt(c.getAttribute('data-page-idx') || '-99', 10);
      c.classList.toggle('is-selected', cardIdx === selectedIndex);
    });
  };

  allCard?.addEventListener('click', () => updateSelection(-1));
  pageCards?.forEach((c) => {
    c.addEventListener('click', () => {
      const idx = parseInt(c.getAttribute('data-page-idx') || '-1', 10);
      updateSelection(idx);
    });
  });

  renderIcons(modal.backdrop);
}

async function handleApplyCanvasProject(
  canvas: CanvasItem,
  targetCanvasType: 'board' | 'doc' | 'presentation',
  pageIndex = -1,
  loadedProjectData?: any
): Promise<void> {
  const controller = getActiveCanvasController();
  if (!controller) {
    showToast('No se encontró el controlador del lienzo activo', 'warning');
    return;
  }

  let projectData = loadedProjectData;
  if (!projectData) {
    if (canvas.data) {
      try {
        projectData = typeof canvas.data === 'string' ? JSON.parse(canvas.data) : canvas.data;
      } catch {}
    }
    if (!projectData) {
      const fullCanvas = await getLocalCanvasByUuid(canvas.uuid);
      if (fullCanvas?.data) {
        try {
          projectData = typeof fullCanvas.data === 'string' ? JSON.parse(fullCanvas.data) : fullCanvas.data;
        } catch {}
      }
    }
    if (!projectData && currentUser && canvas.id) {
      try {
        const res = await getApi(API_ROUTES.canvases.byId(canvas.uuid));
        if (res.ok) {
          const resData = await res.json();
          if (resData?.canvas?.data) {
            projectData = typeof resData.canvas.data === 'string' ? JSON.parse(resData.canvas.data) : resData.canvas.data;
          }
        }
      } catch {}
    }
  }

  const sourceType = canvas.canvas_type || (canvas.unit === 'board' ? 'board' : (canvas.unit === 'diagram' ? 'diagram' : (canvas.unit === 'doc' ? 'doc' : (canvas.unit === 'presentation' ? 'presentation' : 'pixel'))));

  if (targetCanvasType === 'board') {
    if (sourceType === 'board' && projectData && Array.isArray(projectData.elements) && projectData.elements.length > 0) {
      if (typeof controller.insertBoardElements === 'function') {
        controller.insertBoardElements(projectData.elements);
        showToast(`Elementos de «${canvas.name}» insertados en el pizarrón`, 'success');
        if (window.innerWidth <= 768) toggleDrawer(false);
        return;
      }
    }

    if ((sourceType === 'doc' || sourceType === 'presentation') && projectData && Array.isArray(projectData.pages) && projectData.pages.length > 0) {
      const pagesToInsert: DocPage[] = pageIndex >= 0 && projectData.pages[pageIndex]
        ? [projectData.pages[pageIndex]]
        : projectData.pages;

      if (typeof controller.insertDocAsBoardElements === 'function') {
        controller.insertDocAsBoardElements(pagesToInsert, canvas.name);
        showToast(`«${canvas.name}» insertado como tarjetas y textos editables`, 'success');
        if (window.innerWidth <= 768) toggleDrawer(false);
        return;
      }
    }

    if (projectData && projectData.nodes) {
      if (typeof controller.insertDiagramAsBoardElements === 'function') {
        controller.insertDiagramAsBoardElements(projectData, canvas.name);
        showToast(`Diagrama «${canvas.name}» insertado como figuras y flechas editables`, 'success');
        if (window.innerWidth <= 768) toggleDrawer(false);
        return;
      }
    }

    if (sourceType === 'pixel' && canvas.preview_thumbnail) {
      if (typeof controller.insertPixelGridElement === 'function') {
        controller.insertPixelGridElement(canvas.preview_thumbnail, canvas.width || 32, canvas.height || 32, canvas.name);
        showToast(`Pixel art «${canvas.name}» insertado como grilla de píxeles editable`, 'success');
        if (window.innerWidth <= 768) toggleDrawer(false);
        return;
      }
    }

    const fallbackThumbnail = canvas.preview_thumbnail || '';
    if (fallbackThumbnail) {
      controller.insertImage(fallbackThumbnail, canvas.width || 320, canvas.height || 240, canvas.name);
      showToast(`«${canvas.name}» colocado en el pizarrón`, 'success');
      if (window.innerWidth <= 768) toggleDrawer(false);
      return;
    }

    showToast(`No se pudo obtener la información de «${canvas.name}»`, 'warning');
    return;
  }

  if (targetCanvasType === 'doc') {
    if (sourceType === 'doc' && projectData && Array.isArray(projectData.pages) && projectData.pages.length > 0) {
      const pagesToInsert: DocPage[] = pageIndex >= 0 && projectData.pages[pageIndex]
        ? [projectData.pages[pageIndex]]
        : projectData.pages;

      pagesToInsert.forEach((page) => {
        if (typeof controller.insertDocPage === 'function') {
          controller.insertDocPage(page, 'new_page');
        } else if (typeof controller.applyTemplateAsNewPage === 'function') {
          controller.applyTemplateAsNewPage({
            badge: '',
            description: '',
            icon: '',
            id: `doc_import_${Date.now()}`,
            initialPages: [page],
            name: canvas.name,
            settings: {},
          });
        }
      });
      showToast(`Página(s) de «${canvas.name}» insertadas en el documento`, 'success');
      if (window.innerWidth <= 768) toggleDrawer(false);
      return;
    }

    if (projectData && projectData.nodes) {
      if (typeof controller.insertDiagramAsDocOutline === 'function') {
        controller.insertDiagramAsDocOutline(projectData, canvas.name);
        showToast(`Esquema estructurado de «${canvas.name}» insertado en el documento`, 'success');
        if (window.innerWidth <= 768) toggleDrawer(false);
        return;
      }
    }

    if (sourceType === 'board' && projectData && Array.isArray(projectData.elements)) {
      if (typeof controller.insertBoardAsDocContent === 'function') {
        controller.insertBoardAsDocContent(projectData, canvas.name);
        showToast(`Notas y textos de «${canvas.name}» insertados en el documento`, 'success');
        if (window.innerWidth <= 768) toggleDrawer(false);
        return;
      }
    }

    const fallbackThumbnail = canvas.preview_thumbnail || '';
    if (fallbackThumbnail) {
      controller.insertImage(fallbackThumbnail, canvas.name, '400px');
      showToast(`«${canvas.name}» insertado en el documento`, 'success');
      if (window.innerWidth <= 768) toggleDrawer(false);
      return;
    }

    showToast(`No se pudo insertar «${canvas.name}» en el documento`, 'warning');
    return;
  }
}

async function renderProjectsDrawerContent(drawer: HTMLElement, drawerBody: HTMLElement): Promise<void> {
  const sidebar = drawer.closest<HTMLElement>('[data-ref="sidebar"]') || document.querySelector<HTMLElement>('[data-ref="sidebar"]');
  const targetCanvasType = getActiveCanvasType();

  drawerBody.innerHTML = `
    <div class="canvas-panel-card" data-ref="canvas-panel-card">
      <div class="canvas-panel-card__header" data-ref="canvas-panel-header">
        <div class="canvas-panel-card__title-box" data-ref="canvas-panel-title-box">
          <svg class="component-icon canvas-panel-card__icon" aria-hidden="true"><use href="/icons.svg#folder"></use></svg>
          <span class="canvas-panel-card__title" data-ref="canvas-panel-title">${t('nav.projects') || 'Proyectos'}</span>
        </div>
        <button type="button" class="component-button component-button--h32 component-button--icon-only rail-btn canvas-panel-card__close" data-ref="btn-close-canvas-panel" data-tooltip="Cerrar panel" aria-label="Cerrar panel">
          <svg class="component-icon rail-btn__icon" aria-hidden="true"><use href="/icons.svg#close"></use></svg>
        </button>
      </div>
      <div class="canvas-panel-card__body canvas-projects-container" data-ref="canvas-panel-body">
        <div class="menu-panel__search" data-ref="canvas-projects-search">
          <svg class="component-icon menu-panel__search-icon" aria-hidden="true"><use href="/icons.svg#search"></use></svg>
          <input class="menu-panel__search-input" data-ref="canvas-projects-search-input" type="text" maxlength="50" autocomplete="off" placeholder="Buscar en tus proyectos..." />
        </div>

        <div class="canvas-panel-templates-grid canvas-panel-projects-grid" data-ref="canvas-projects-grid">
          <div class="skeleton" style="aspect-ratio: 16 / 10; border-radius: 12px;"></div>
          <div class="skeleton" style="aspect-ratio: 16 / 10; border-radius: 12px;"></div>
          <div class="skeleton" style="aspect-ratio: 16 / 10; border-radius: 12px;"></div>
          <div class="skeleton" style="aspect-ratio: 16 / 10; border-radius: 12px;"></div>
          <div class="skeleton" style="aspect-ratio: 16 / 10; border-radius: 12px;"></div>
          <div class="skeleton" style="aspect-ratio: 16 / 10; border-radius: 12px;"></div>
        </div>
      </div>
    </div>
  `;

  const btnClose = drawerBody.querySelector<HTMLElement>('[data-ref="btn-close-canvas-panel"]');
  btnClose?.addEventListener('click', (e) => {
    e.preventDefault();
    toggleDrawer(false);
  });

  const searchInput = drawerBody.querySelector<HTMLInputElement>('[data-ref="canvas-projects-search-input"]');
  const grid = drawerBody.querySelector<HTMLElement>('[data-ref="canvas-projects-grid"]');

  let projectItems: CanvasItem[] = [];

  const getCanvasTypeKey = (c: CanvasItem): 'board' | 'doc' | 'presentation' => {
    if (c.canvas_type === 'presentation' || c.unit === 'presentation') return 'presentation';
    if (c.canvas_type === 'doc' || c.unit === 'doc') return 'doc';
    return 'board';
  };

  const getTypeIcon = (typeKey: 'board' | 'doc' | 'presentation'): string => {
    if (typeKey === 'presentation') return 'slideshow';
    if (typeKey === 'doc') return 'description';
    return 'dashboard';
  };

  const renderGrid = (query = '') => {
    if (!grid) return;
    const cleanQ = query.trim().toLowerCase();

    let filtered = projectItems.filter((c) => !c.deleted_at);

    if (cleanQ) {
      filtered = filtered.filter((c) => (c.name || '').toLowerCase().includes(cleanQ));
    }

    if (filtered.length === 0) {
      if (projectItems.length === 0) {
        grid.innerHTML = `
          <div class="canvas-panel-card__empty" style="grid-column: 1 / -1;" data-ref="canvas-projects-empty">
            <div class="canvas-panel-card__empty-icon">
              <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#folder_open"></use></svg>
            </div>
            <span class="canvas-panel-card__empty-title">Aún no tienes proyectos</span>
            <p class="canvas-panel-card__empty-desc">Crea diseños, pizarrones o documentos para verlos aquí y colocarlos en tus lienzos.</p>
          </div>
        `;
      } else {
        grid.innerHTML = `
          <div class="canvas-panel-card__empty" style="grid-column: 1 / -1;" data-ref="canvas-projects-no-results">
            <span class="canvas-panel-card__empty-title">Sin resultados</span>
            <p class="canvas-panel-card__empty-desc">No encontramos proyectos que coincidan con «${escapeHtml(query)}»</p>
          </div>
        `;
      }
      renderIcons(grid);
      return;
    }

    grid.innerHTML = filtered.map((c) => {
      const typeKey = getCanvasTypeKey(c);
      const iconName = getTypeIcon(typeKey);
      const thumbHtml = c.preview_thumbnail
        ? `<img class="canvas-card__image image-lazy-fade" data-ref="img-proj-${c.uuid}" src="${c.preview_thumbnail}" alt="${escapeHtml(c.name || '')}" loading="lazy" decoding="async" onload="this.classList.add('image-loaded')" onerror="this.classList.add('image-loaded')" />`
        : `<svg class="component-icon" aria-hidden="true" style="position: absolute; inset: 0; margin: auto; width: 44px; height: 44px; color: var(--text-tertiary);"><use href="/icons.svg#${iconName}"></use></svg>`;

      return `
        <div class="canvas-card template-card" data-ref="canvas-project-card-${c.uuid}" data-project-uuid="${c.uuid}" data-tooltip="${escapeHtml(c.name || 'Diseño sin título')}">
          <div class="canvas-card__thumbnail template-card__thumbnail" data-ref="project-thumb-${c.uuid}">
            ${thumbHtml}
          </div>
        </div>
      `;
    }).join('');

    renderIcons(grid);

    grid.querySelectorAll<HTMLElement>('.template-card').forEach((card) => {
      card.addEventListener('click', async () => {
        const uuid = card.getAttribute('data-project-uuid');
        const found = projectItems.find((p) => p.uuid === uuid);
        if (!found) return;

        const typeKey = getCanvasTypeKey(found);

        if (typeKey === 'doc') {
          let docProj: DocProject | null = null;
          if (found.data) {
            try {
              docProj = typeof found.data === 'string' ? JSON.parse(found.data) : found.data;
            } catch {}
          }
          if (!docProj) {
            const localData = await getLocalCanvasByUuid(found.uuid);
            if (localData?.data) {
              try {
                docProj = typeof localData.data === 'string' ? JSON.parse(localData.data) : localData.data;
              } catch {}
            }
          }
          if (!docProj && currentUser && found.id) {
            try {
              const res = await getApi(API_ROUTES.canvases.byId(found.uuid));
              if (res.ok) {
                const resData = await res.json();
                if (resData?.canvas?.data) {
                  docProj = typeof resData.canvas.data === 'string' ? JSON.parse(resData.canvas.data) : resData.canvas.data;
                }
              }
            } catch {}
          }

          if (docProj && docProj.pages && docProj.pages.length > 1) {
            openDocPageSelectionModal(found, docProj, targetCanvasType);
            return;
          }
        }

        await handleApplyCanvasProject(found, targetCanvasType, -1);
      });
    });
  };

  searchInput?.addEventListener('input', () => {
    renderGrid(searchInput.value);
  });

  try {
    const localCanvases = await getAllLocalCanvases();
    if (currentUser) {
      try {
        const res = await getApi(API_ROUTES.canvases.base);
        if (res.ok) {
          const data = await res.json();
          if (data && Array.isArray(data.canvases)) {
            const cloudUuids = new Set(data.canvases.map((c: CanvasItem) => c.uuid));
            const unsynced = localCanvases.filter((c) => c.is_local && !cloudUuids.has(c.uuid) && !c.id && (!c.user_id || c.user_id === currentUser?.id));
            projectItems = [...unsynced, ...data.canvases];
          } else {
            projectItems = localCanvases;
          }
        } else {
          projectItems = localCanvases;
        }
      } catch {
        projectItems = localCanvases;
      }
    } else {
      projectItems = localCanvases.filter((c) => c.is_local && !c.user_id && !c.id);
    }
  } catch {
    projectItems = [];
  }

  projectItems.sort((a, b) => {
    const timeA = new Date(a.updated_at || a.created_at).getTime();
    const timeB = new Date(b.updated_at || b.created_at).getTime();
    return timeB - timeA;
  });

  renderGrid(searchInput?.value || '');

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
  const btnSettings = sidebar.querySelector<HTMLElement>('[data-ref="btn-rail-settings"]');

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

      if (avatarImg && avatarImg.getAttribute('data-loaded-src') !== avatarUrl) {
        avatarImg.setAttribute('data-loaded-src', avatarUrl);
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

      if (activeAvatar && activeAvatar.getAttribute('data-loaded-src') !== avatarUrl) {
        activeAvatar.setAttribute('data-loaded-src', avatarUrl);
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

      const btnAdmin = avatarContainer.querySelector<HTMLElement>('[data-ref="btn-menu-admin"]');
      if (btnAdmin) {
        const hasAdminAccess = isUserAdmin(currentUser?.role, currentUser?.roles);
        btnAdmin.style.display = hasAdminAccess ? 'flex' : 'none';
        btnAdmin.addEventListener('click', (e) => {
          e.preventDefault();
          closeMenu();
          const adminUrl = `${window.location.protocol}//${window.location.hostname}:3002`;
          window.open(adminUrl, '_blank', 'noopener,noreferrer');
        });
      }

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
    if (btnSettings) {
      btnSettings.style.display = 'inline-flex';
      btnSettings.addEventListener('click', (e) => {
        e.preventDefault();
        navigate(currentUser ? '/settings/your-account' : '/settings/guest');
      });
    }
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

let sidebarInstance: HTMLElement | null = null;
let sidebarInitPromise: Promise<HTMLElement> | null = null;

export function getSidebarElement(): HTMLElement | null {
  return sidebarInstance;
}

export function resetSidebar(): void {
  if (sidebarInstance) {
    sidebarInstance.remove();
    sidebarInstance = null;
    sidebarInitPromise = null;
  }
}

export async function createSidebar(): Promise<HTMLElement> {
  if (sidebarInstance) {
    updateSidebarActiveState(sidebarInstance, window.location.pathname);
    return sidebarInstance;
  }
  if (sidebarInitPromise) {
    return sidebarInitPromise;
  }

  sidebarInitPromise = (async () => {
    document.querySelector('[data-ref="btn-help-chat"]')?.remove();
    const sidebar = await loadTemplate('/views/components/sidebar.html');
    translateElement(sidebar);

    setupRailNavigation(sidebar);
    setupDrawerContent(sidebar);
    setupRailUserControls(sidebar);
    updateSidebarActiveState(sidebar, window.location.pathname);

    renderIcons(sidebar);
    sidebarInstance = sidebar;
    return sidebar;
  })();

  return sidebarInitPromise;
}

export function mountSidebarSkeleton(layoutContent: HTMLElement): HTMLElement | null {
  const existing = layoutContent.querySelector<HTMLElement>('[data-ref="sidebar"], [data-ref="sidebar-skeleton"], .layout-nav');
  if (existing) return existing;

  const sidebarSkeleton = document.createElement('div');
  sidebarSkeleton.className = 'layout-nav';
  sidebarSkeleton.setAttribute('data-ref', 'sidebar-skeleton');
  sidebarSkeleton.style.pointerEvents = 'none';
  sidebarSkeleton.innerHTML = `
    <div class="layout-rail" data-ref="layout-rail">
      <div class="layout-rail__top" data-ref="rail-top">
        <div class="rail-top-default" data-ref="rail-top-default">
          <div class="skeleton" style="width: 40px; height: 40px; border-radius: 12px;"></div>
          <div class="skeleton" style="width: 40px; height: 40px; border-radius: 12px;"></div>
        </div>
      </div>
      <hr class="rail-divider" data-ref="rail-divider" />
      <div class="layout-rail__center" data-ref="rail-center">
        <div class="rail-center-default" data-ref="rail-center-default">
          <div class="skeleton" style="width: 40px; height: 40px; border-radius: 12px;"></div>
          <div class="skeleton" style="width: 40px; height: 40px; border-radius: 12px;"></div>
          <div class="skeleton" style="width: 40px; height: 40px; border-radius: 12px;"></div>
          <div class="skeleton" style="width: 40px; height: 40px; border-radius: 12px;"></div>
        </div>
      </div>
      <div class="layout-rail__bottom" data-ref="rail-bottom">
        <div class="skeleton skeleton--circle" style="width: 36px; height: 36px;"></div>
      </div>
    </div>
  `;
  layoutContent.prepend(sidebarSkeleton);
  return sidebarSkeleton;
}

export async function ensureSidebarMounted(layoutContent: HTMLElement): Promise<HTMLElement> {
  const sidebar = await createSidebar();
  const skeletonSidebar = layoutContent.querySelector<HTMLElement>('[data-ref="sidebar-skeleton"]');
  if (skeletonSidebar) {
    skeletonSidebar.replaceWith(sidebar);
  } else if (sidebar.parentElement !== layoutContent) {
    layoutContent.prepend(sidebar);
  }
  return sidebar;
}

window.addEventListener('auth-changed', () => {
  resetSidebar();
  const layoutContent = document.querySelector<HTMLElement>('.layout-content');
  if (layoutContent) {
    void ensureSidebarMounted(layoutContent);
  }
});

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
      historyList.innerHTML = `
        <div class="skeleton" style="height: 72px; border-radius: 12px; margin-bottom: 8px; width: 100%;"></div>
        <div class="skeleton" style="height: 72px; border-radius: 12px; margin-bottom: 8px; width: 100%;"></div>
        <div class="skeleton" style="height: 72px; border-radius: 12px; width: 100%;"></div>
      `;
      historyList.style.display = 'flex';
      historyList.style.flexDirection = 'column';
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
      ticketDetailMessages.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 10px; width: 100%; padding: 12px 0;">
          <div class="skeleton" style="height: 48px; border-radius: 12px; width: 70%;"></div>
          <div class="skeleton" style="height: 56px; border-radius: 12px; width: 80%; align-self: flex-end;"></div>
          <div class="skeleton" style="height: 40px; border-radius: 12px; width: 60%;"></div>
        </div>
      `;
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

export function openChartInspectorInDrawer(chart?: BoardChartElement): void {
  activeChartInDrawer = chart || null;
  activeCanvasTab = 'charts';
  const sidebar = document.querySelector<HTMLElement>('[data-ref="sidebar"]');
  if (!isDrawerOpen) {
    toggleDrawer(true);
  } else if (sidebar) {
    void updateDynamicDrawer(sidebar);
    updateCanvasRailActiveState(sidebar);
  }
}

export function openMockupsInDrawer(): void {
  activeCanvasTab = 'mockups';
  const sidebar = document.querySelector<HTMLElement>('[data-ref="sidebar"]');
  if (!isDrawerOpen) {
    toggleDrawer(true);
  } else if (sidebar) {
    void updateDynamicDrawer(sidebar);
    updateCanvasRailActiveState(sidebar);
  }
}

export function openColorsInDrawer(target: 'stroke' | 'fill' | 'text' | 'slide-bg' = 'stroke'): void {
  activeColorTargetInDrawer = target;
  activeCanvasTab = 'colors';
  const sidebar = document.querySelector<HTMLElement>('[data-ref="sidebar"]');
  if (!isDrawerOpen) {
    toggleDrawer(true);
  } else if (sidebar) {
    void updateDynamicDrawer(sidebar);
    updateCanvasRailActiveState(sidebar);
  }
}

export function isColorsDrawerOpen(): boolean {
  return isDrawerOpen && activeCanvasTab === 'colors';
}

export function getActiveColorTargetInDrawer(): 'stroke' | 'fill' | 'text' | 'slide-bg' {
  return activeColorTargetInDrawer;
}

export function isChartInspectorOpen(): boolean {
  return isDrawerOpen && activeCanvasTab === 'charts';
}

export function openFontsInDrawer(): void {
  activeCanvasTab = 'fonts';
  const sidebar = document.querySelector<HTMLElement>('[data-ref="sidebar"]');
  if (!isDrawerOpen) {
    toggleDrawer(true);
  } else if (sidebar) {
    void updateDynamicDrawer(sidebar);
    updateCanvasRailActiveState(sidebar);
  }
}

export function isFontsDrawerOpen(): boolean {
  return isDrawerOpen && activeCanvasTab === 'fonts';
}

export function openPixelAnimationInDrawer(): void {
  activeCanvasTab = 'pixel-anim';
  const sidebar = document.querySelector<HTMLElement>('[data-ref="sidebar"]');
  if (!isDrawerOpen) {
    toggleDrawer(true);
  } else if (sidebar) {
    void updateDynamicDrawer(sidebar);
    updateCanvasRailActiveState(sidebar);
  }
}

export function isPixelAnimationDrawerOpen(): boolean {
  return isDrawerOpen && activeCanvasTab === 'pixel-anim';
}

export function openEffectsInDrawer(): void {
  activeCanvasTab = 'effects';
  const sidebar = document.querySelector<HTMLElement>('[data-ref="sidebar"]');
  if (!isDrawerOpen) {
    toggleDrawer(true);
  } else if (sidebar) {
    void updateDynamicDrawer(sidebar);
    updateCanvasRailActiveState(sidebar);
  }
}

export function isEffectsDrawerOpen(): boolean {
  return isDrawerOpen && activeCanvasTab === 'effects';
}

export function openAnimationInDrawer(): void {
  activeCanvasTab = 'animate';
  const sidebar = document.querySelector<HTMLElement>('[data-ref="sidebar"]');
  if (!isDrawerOpen) {
    toggleDrawer(true);
  } else if (sidebar) {
    void updateDynamicDrawer(sidebar);
    updateCanvasRailActiveState(sidebar);
  }
}

export function isAnimationDrawerOpen(): boolean {
  return isDrawerOpen && activeCanvasTab === 'animate';
}

export function openPositionInDrawer(): void {
  activeCanvasTab = 'position';
  const sidebar = document.querySelector<HTMLElement>('[data-ref="sidebar"]');
  if (!isDrawerOpen) {
    toggleDrawer(true);
  } else if (sidebar) {
    void updateDynamicDrawer(sidebar);
    updateCanvasRailActiveState(sidebar);
  }
}

export function isPositionDrawerOpen(): boolean {
  return isDrawerOpen && activeCanvasTab === 'position';
}

export function openAppsInDrawer(appId?: string): void {
  activeCanvasTab = 'apps';
  activeAppId = appId || null;
  const sidebar = document.querySelector<HTMLElement>('[data-ref="sidebar"]');
  if (!isDrawerOpen) {
    toggleDrawer(true);
  } else if (sidebar) {
    void updateDynamicDrawer(sidebar);
    updateCanvasRailActiveState(sidebar);
  }
}

export function isAppsDrawerOpen(): boolean {
  return isDrawerOpen && activeCanvasTab === 'apps';
}

export function openQrInDrawer(): void {
  openAppsInDrawer('qr-code');
}

export function isQrDrawerOpen(): boolean {
  return isDrawerOpen && activeCanvasTab === 'apps' && activeAppId === 'qr-code';
}

export function openYouTubeInDrawer(): void {
  openAppsInDrawer('youtube');
}

export function isYouTubeDrawerOpen(): boolean {
  return isDrawerOpen && activeCanvasTab === 'apps' && activeAppId === 'youtube';
}

