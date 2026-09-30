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
import { canAccessAdmin, canPublishTemplates } from '../types/auth.types.js';
import { BrandKit, BrandKitAsset, BrandKitDetail } from '../types/brand.types.js';
import { CanvasItem } from '../types/canvas.types.js';
import { FrameCategory, GridCategory, MockupGeneralCategory, MockupTemplate } from '../types/mockups.types.js';
import { UserStorageUsage } from '../types/subscription.types.js';
import { UserUploadItem } from '../types/upload.types.js';
import { closeAllDropdowns, registerActiveDropdown, setupDropdown, unregisterActiveDropdown } from '../utils/dom.util.js';
import { PIXEL_SHAPES, PixelShape, ShapeCategory } from '../utils/pixel-shapes.util.js';
import { applyAvatarTier, getFallbackTierColor } from '../utils/tier.util.js';
import { formatVideoDuration, validateAndSanitizeFiles } from '../utils/validators.util.js';
import { CHART_CATALOG } from '../views/board/board-charts-panel.component.js';
import { BoardChartElement, BoardProject, ChartType, Shape3DType, ShapeType } from '../views/board/board.types.js';
import { DOC_TEMPLATES, getDocTemplateById } from '../views/doc/doc-templates.config.js';
import { DocPage, DocProject } from '../views/doc/doc.types.js';
import { openCreateCanvasModal } from './create-canvas-modal.component.js';
import { openInsertPixelGridModal } from './insert-pixel-grid-modal.component.js';
import { attachChatSidebarToView, getIsChatOpen, initChatSidebar, toggleChatSidebar } from './layout/layout-chat.component.js';
import { getActiveAppId, renderAppsDrawerContent, setActiveAppId } from './layout/layout-drawer-apps.component.js';
import { handleApplyChart, renderElementsDrawerContent } from './layout/layout-drawer-elements.component.js';
export { attachChatSidebarToView, getIsChatOpen, initChatSidebar, toggleChatSidebar };
import { openModal } from './modal.component.js';
import { openUpgradeModal } from './upgrade-modal.component.js';

let isDrawerOpen = false;
let isChatOpen = false;
let activeCanvasTab: 'templates' | 'brand' | 'elements' | 'text' | 'tools' | 'uploads' | 'apps' | 'projects' | 'charts' | 'mockups' | 'colors' | 'fonts' | 'pixel-anim' | 'effects' | 'animate' | 'position' | null = null;
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
    if (getIsChatOpen()) {
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
    pathname.startsWith('/help') ||
    pathname.startsWith('/ai') ||
    pathname.startsWith('/ia')
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
    pathname.startsWith('/presentation/') ||
    pathname === '/social' ||
    pathname.startsWith('/social/') ||
    pathname === '/sheet' ||
    pathname.startsWith('/sheet/') ||
    pathname === '/video' ||
    pathname.startsWith('/video/')
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
  const isAi = path === '/ai' || path === '/ia' || path.startsWith('/ai/') || path.startsWith('/ia/');
  const isTemplates = path === '/templates';
  const isDesigner = path === '/designer' || path.startsWith('/designer');
  const isBrand = path === '/brand' || path === '/marca';
  const isShared = path === '/shared';
  const isTeams = path === '/teams';
  const isMore = path === '/your-apps' || path === '/apply-designer' || path === '/designer/apply' || path === '/creators' || path === '/creators/apply' || isDesigner;

  const updateItem = (itemRef: string, btnRef: string, isActive: boolean) => {
    const item = sidebar.querySelector<HTMLElement>(`[data-ref="${itemRef}"]`);
    const btn = sidebar.querySelector<HTMLElement>(`[data-ref="${btnRef}"]`);
    item?.classList.toggle('is-active', isActive);
    btn?.classList.toggle('is-active', isActive);
  };

  updateItem('rail-item-home', 'btn-rail-home', isHome);
  updateItem('rail-item-ai', 'btn-rail-ai', isAi);
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
  btnMoreApply?.classList.toggle('is-active', isDesigner || path === '/apply-designer' || path === '/designer/apply' || path === '/creators' || path === '/creators/apply');

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
    if (btnMoreApply) btnMoreApply.style.display = 'none';
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
    if (btnMoreApply) btnMoreApply.style.display = '';
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

document.addEventListener('keydown', (e: KeyboardEvent) => {
  if (e.key === 'Escape') {
    if (window.innerWidth <= 768 && isDrawerOpen) toggleDrawer(false);
    if (getIsChatOpen()) toggleChatSidebar(false);
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

  if (getIsChatOpen()) {
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
  const isAi = currentPath === '/ai' || currentPath === '/ia' || currentPath.startsWith('/ai/') || currentPath.startsWith('/ia/');
  bindNav('rail-item-home', 'btn-rail-home', '/', isHome);
  bindNav('rail-item-ai', 'btn-rail-ai', '/ai', isAi);
  bindNav('rail-item-templates', 'btn-rail-templates', '/templates', currentPath === '/templates');
  bindNav('rail-item-brand', 'btn-rail-brand', '/brand', currentPath === '/brand' || currentPath === '/marca');
  bindNav('rail-item-shared', 'btn-rail-shared', '/shared', currentPath === '/shared');
  bindNav('rail-item-teams', 'btn-rail-teams', '/teams', currentPath === '/teams');

  const moreContainer = sidebar.querySelector<HTMLElement>('[data-ref="rail-item-more"]');
  const btnMore = moreContainer?.querySelector<HTMLElement>('[data-ref="btn-rail-more"]');
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
    };

    const closeMoreMenu = () => {
      if (!isMoreOpen) return;
      isMoreOpen = false;
      btnMore.classList.remove('is-active');
      moreMenu.classList.remove('is-open');
      unregisterActiveDropdown(moreMenu);
    };

    const toggleMoreMenu = (e: Event) => {
      e.stopPropagation();
      if (isMoreOpen) {
        closeMoreMenu();
      } else {
        openMoreMenu();
      }
    };

    btnMore.addEventListener('click', toggleMoreMenu);
    moreContainer.addEventListener('click', (e) => {
      if (e.target !== btnMore && !btnMore.contains(e.target as Node) && !moreMenu.contains(e.target as Node)) {
        toggleMoreMenu(e);
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
        navigate('/creators');
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
    if (btnMoreApply) btnMoreApply.style.display = 'none';
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

export function getActiveCanvasType(): 'board' | 'doc' | 'presentation' | 'video' {
  const content = document.querySelector<HTMLElement>('[data-ref="app"] .layout-content, .layout-content');
  const viewEl = content?.querySelector<HTMLElement>('[data-ref="board-view"], [data-ref="doc-view"], [data-ref="presentation-view"], [data-ref="design-view"], [data-ref="video-wrapper"], .video-editor-wrapper, .view-wrapper');
  const ref = viewEl?.getAttribute('data-ref') || content?.getAttribute('data-ref');
  if (ref === 'video-wrapper' || viewEl?.classList.contains('video-editor-wrapper') || content?.querySelector('[data-ref="video-wrapper"]') || content?.querySelector('.video-editor-wrapper')) return 'video';
  if (ref === 'doc-view' || window.location.pathname.startsWith('/doc/')) return 'doc';
  if (ref === 'presentation-view' || window.location.pathname.startsWith('/presentation/')) return 'presentation';
  return 'board';
}

export function getActiveCanvasController(): any {
  const content = document.querySelector<HTMLElement>('[data-ref="app"] .layout-content, .layout-content');
  if (!content) return null;
  if ((content as any).__controller) return (content as any).__controller;
  for (let i = 0; i < content.children.length; i++) {
    const child = content.children[i] as any;
    if (child?.__controller) return child.__controller;
  }
  const viewEl = content.querySelector<HTMLElement>('[data-ref="board-view"], [data-ref="doc-view"], [data-ref="presentation-view"], [data-ref="design-view"], [data-ref="video-wrapper"], .video-editor-wrapper, .view-wrapper');
  if (viewEl && (viewEl as any).__controller) return (viewEl as any).__controller;
  return null;
}

function handleApplyCanvasTemplate(preset: PresetItem, canvasType: 'board' | 'doc' | 'presentation' | 'video'): void {
  const controller = getActiveCanvasController();

  if (canvasType === 'video') {
    showToast('Las plantillas de video se configuran al crear un nuevo video', 'info');
    if (window.innerWidth <= 768) {
      toggleDrawer(false);
    }
    return;
  }

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

// Elements drawer extracted to layout-drawer-elements.component.ts
function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  if (i === 0) return `${bytes} B`;
  const rawValue = bytes / Math.pow(1024, i);
  const formatted = rawValue % 1 === 0 ? rawValue.toString() : rawValue.toFixed(rawValue >= 100 || i >= 3 ? 1 : 2);
  return `${formatted} ${units[i]}`;
}

export function handleApplyCanvasUpload(item: UserUploadItem, canvasType: 'board' | 'doc' | 'presentation' | 'video'): void {
  const controller = getActiveCanvasController();

  if (canvasType === 'video') {
    if (!controller) {
      showToast('No se encontró el controlador del video', 'warning');
      return;
    }

    if (item.media_type === 'video') {
      controller.insertVideo?.({
        duration: item.duration_seconds || 5,
        height: item.height || undefined,
        thumbnailUrl: item.thumbnail_url || '',
        title: item.original_filename,
        url: item.url,
        width: item.width || undefined,
      });
      showToast(`Video «${item.original_filename}» añadido al proyecto`, 'success');
    } else if (item.mime_type && item.mime_type.startsWith('audio/')) {
      controller.insertAudio?.({
        duration: item.duration_seconds || 10,
        title: item.original_filename,
        url: item.url,
      });
      showToast(`Audio «${item.original_filename}» añadido a la pista de audio`, 'success');
    } else {
      controller.insertImage?.({
        height: item.height || undefined,
        title: item.original_filename,
        url: item.url,
        width: item.width || undefined,
      });
      showToast(`Imagen «${item.original_filename}» añadida al video`, 'success');
    }
    if (window.innerWidth <= 768) {
      toggleDrawer(false);
    }
    return;
  }

  if (item.media_type === 'video') {
    if (canvasType === 'doc') {
      if (!controller) {
        showToast('No se encontró el controlador del documento', 'warning');
        return;
      }

      controller.insertVideo?.(item.url, item.original_filename, item.thumbnail_url || '');
      showToast(`Video «${item.original_filename}» insertado en el documento`, 'success');
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

      controller.insertVideo?.({
        duration: item.duration_seconds || undefined,
        height: item.height || undefined,
        thumbnailUrl: item.thumbnail_url || '',
        title: item.original_filename,
        url: item.url,
        width: item.width || undefined,
      });
      if (window.innerWidth <= 768) {
        toggleDrawer(false);
      }
      return;
    }
    return;
  }

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
          <button type="button" class="component-button component-button--h32 component-button--icon-only rail-btn" data-ref="btn-upload-file-trigger" data-tooltip="Subir fotos o videos" aria-label="Subir fotos o videos">
            <svg class="component-icon rail-btn__icon" aria-hidden="true"><use href="/icons.svg#add"></use></svg>
          </button>
          <button type="button" class="component-button component-button--h32 component-button--icon-only rail-btn canvas-panel-card__close" data-ref="btn-close-canvas-panel" data-tooltip="Cerrar panel" aria-label="Cerrar panel">
            <svg class="component-icon rail-btn__icon" aria-hidden="true"><use href="/icons.svg#close"></use></svg>
          </button>
        </div>
      </div>
      <div class="canvas-uploads-filter-bar" data-ref="canvas-uploads-tabs" style="display: flex; gap: 4px; padding: 4px 12px 8px 12px; border-bottom: 1px solid var(--border-color, rgba(255,255,255,0.08));">
        <button type="button" class="component-button component-button--h28 component-button--ghost is-active" data-ref="tab-filter-all" data-tab-filter="all" style="font-size: 12px; padding: 0 10px; border-radius: 6px;">Todos</button>
        <button type="button" class="component-button component-button--h28 component-button--ghost" data-ref="tab-filter-images" data-tab-filter="image" style="font-size: 12px; padding: 0 10px; border-radius: 6px;">Imágenes</button>
        <button type="button" class="component-button component-button--h28 component-button--ghost" data-ref="tab-filter-videos" data-tab-filter="video" style="font-size: 12px; padding: 0 10px; border-radius: 6px;">Videos</button>
      </div>
      <div class="canvas-panel-card__body" data-ref="canvas-panel-body">
        <input class="canvas-upload-file-input" data-ref="canvas-upload-file-input" type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/avif,image/svg+xml,video/mp4,video/webm,video/quicktime,video/x-m4v,video/ogg" multiple style="display: none;" />

        <div class="menu-panel__search" data-ref="canvas-uploads-search">
          <svg class="component-icon menu-panel__search-icon" aria-hidden="true"><use href="/icons.svg#search"></use></svg>
          <input class="menu-panel__search-input" data-ref="canvas-uploads-search-input" type="text" maxlength="50" autocomplete="off" placeholder="Buscar fotos y videos..." />
        </div>

        <div class="elements-grid" data-ref="canvas-uploads-grid">
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
  const tabFilterBtns = drawerBody.querySelectorAll<HTMLButtonElement>('[data-tab-filter]');

  let uploads: UserUploadItem[] = [];
  let currentFilter: 'all' | 'image' | 'video' = 'all';
  let isUploading = false;

  const renderGrid = (query = '') => {
    if (!grid) return;
    const cleanQ = query.trim().toLowerCase();

    let filtered = uploads;
    if (currentFilter === 'image') {
      filtered = filtered.filter((u) => u.media_type === 'image');
    } else if (currentFilter === 'video') {
      filtered = filtered.filter((u) => u.media_type === 'video');
    }

    if (cleanQ) {
      filtered = filtered.filter((u) => u.original_filename.toLowerCase().includes(cleanQ));
    }

    if (filtered.length === 0) {
      if (uploads.length === 0) {
        grid.innerHTML = `
          <div class="canvas-panel-card__empty" style="grid-column: 1 / -1;" data-ref="canvas-uploads-empty">
            <div class="canvas-panel-card__empty-icon">
              <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#cloud_upload"></use></svg>
            </div>
            <span class="canvas-panel-card__empty-title">Aún no tienes archivos subidos</span>
            <p class="canvas-panel-card__empty-desc">Sube fotos o videos para colocarlos e interactuar en tus lienzos.</p>
            <button type="button" class="component-button component-button--h36 component-button--black" data-ref="btn-upload-empty-trigger" style="margin-top: 8px;">
              <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#add"></use></svg>
              <span>Subir fotos y videos</span>
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
            <p class="canvas-panel-card__empty-desc">No se encontraron archivos en «${currentFilter === 'video' ? 'Videos' : currentFilter === 'image' ? 'Imágenes' : 'Todos'}» que coincidan con «${escapeHtml(query)}»</p>
          </div>
        `;
      }
      renderIcons(grid);
      return;
    }

    grid.innerHTML = filtered.map((item) => {
      const isVideo = item.media_type === 'video';
      const previewSrc = isVideo ? (item.thumbnail_url || item.url) : item.url;
      const durationBadge = isVideo && item.duration_seconds
        ? `<div class="canvas-upload-badge canvas-upload-badge--video" style="position: absolute; bottom: 6px; right: 6px; display: flex; align-items: center; gap: 3px; background: rgba(0,0,0,0.75); color: #ffffff; padding: 2px 6px; border-radius: 4px; font-size: 11px; font-weight: 600; pointer-events: none; backdrop-filter: blur(4px);"><svg class="component-icon" style="width: 12px; height: 12px;" aria-hidden="true"><use href="/icons.svg#play_arrow"></use></svg><span>${formatVideoDuration(item.duration_seconds)}</span></div>`
        : isVideo
        ? `<div class="canvas-upload-badge canvas-upload-badge--video" style="position: absolute; bottom: 6px; right: 6px; display: flex; align-items: center; gap: 3px; background: rgba(0,0,0,0.75); color: #ffffff; padding: 2px 6px; border-radius: 4px; font-size: 11px; font-weight: 600; pointer-events: none; backdrop-filter: blur(4px);"><svg class="component-icon" style="width: 12px; height: 12px;" aria-hidden="true"><use href="/icons.svg#movie"></use></svg></div>`
        : '';

      return `
        <button type="button" class="element-grid-item" data-ref="btn-upload-item-${item.uuid}" data-upload-uuid="${item.uuid}" draggable="true" data-tooltip="${escapeHtml(item.original_filename)}" aria-label="${escapeHtml(item.original_filename)}" style="position: relative; cursor: grab;">
          <img class="canvas-upload-img image-lazy-fade" data-ref="img-upload-${item.uuid}" src="${escapeHtml(previewSrc)}" alt="${escapeHtml(item.original_filename)}" loading="lazy" decoding="async" draggable="false" style="pointer-events: none;" onload="this.classList.add('image-loaded')" onerror="this.classList.add('image-loaded')" />
          ${durationBadge}
          <button type="button" class="canvas-upload-card__delete" data-ref="btn-delete-upload-${item.uuid}" data-delete-uuid="${item.uuid}" data-tooltip="Eliminar ${isVideo ? 'video' : 'imagen'}" aria-label="Eliminar ${isVideo ? 'video' : 'imagen'}">
            <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#delete"></use></svg>
          </button>
        </button>
      `;
    }).join('');

    renderIcons(grid);

    grid.querySelectorAll<HTMLElement>('.element-grid-item').forEach((card) => {
      card.addEventListener('dragstart', (e) => {
        const uuid = card.getAttribute('data-upload-uuid');
        const found = uploads.find((u) => u.uuid === uuid);
        if (!found) return;

        const isVid = found.media_type === 'video';
        const isAud = (found as any).media_type === 'audio' || Boolean(found.mime_type && found.mime_type.startsWith('audio/'));
        const mediaType = isVid ? 'video' : (isAud ? 'audio' : 'image');
        const dur = Math.max(1, found.duration_seconds || (isVid ? 5 : (isAud ? 10 : 4)));

        const clipData = {
          assetUrl: found.url,
          duration: dur,
          mediaType,
          name: found.original_filename || (isVid ? 'Video' : (isAud ? 'Audio' : 'Foto')),
          sourceDuration: dur,
          thumbnailUrl: found.thumbnail_url || (isVid ? found.url : ''),
          trimEnd: dur,
          trimStart: 0,
        };

        if (e.dataTransfer) {
          e.dataTransfer.setData('application/json', JSON.stringify(clipData));
          e.dataTransfer.setData('spriteboard/clip-data', JSON.stringify(clipData));
          e.dataTransfer.setData('spriteboard/internal-upload', uuid || '');
          e.dataTransfer.setData('text/plain', found.url);
          e.dataTransfer.setData('text/uri-list', found.url);
          e.dataTransfer.effectAllowed = 'copy';
        }
      });

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
          title: `Eliminar ${found.media_type === 'video' ? 'video' : 'imagen'}`,
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

  tabFilterBtns.forEach((tabBtn) => {
    tabBtn.addEventListener('click', () => {
      tabFilterBtns.forEach((b) => b.classList.remove('is-active'));
      tabBtn.classList.add('is-active');
      currentFilter = (tabBtn.getAttribute('data-tab-filter') as 'all' | 'image' | 'video') || 'all';
      renderGrid(searchInput?.value || '');
    });
  });

  const handleFiles = async (files: FileList | File[]) => {
    if (!currentUser) {
      showToast('Debes iniciar sesión para subir fotos y videos.', 'warning');
      return;
    }
    const validation = validateAndSanitizeFiles(files, { maxMb: 1024 });
    if (!validation.valid) {
      showToast(validation.error || 'Por favor selecciona archivos compatibles (PNG, JPG, WEBP, GIF, SVG, MP4, WebM, MOV).', 'warning');
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

  const handleExternalUploads = (e: Event) => {
    const customEvent = e as CustomEvent<UserUploadItem[]>;
    if (customEvent.detail && Array.isArray(customEvent.detail) && customEvent.detail.length > 0) {
      uploads = [...customEvent.detail, ...uploads];
      renderGrid(searchInput?.value || '');
    }
  };
  window.addEventListener('spriteboard:uploads-updated', handleExternalUploads);

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

// Apps drawer extracted to layout-drawer-apps.component.ts
function handleApplyTextPreset(type: 'heading' | 'subheading' | 'body', canvasType: 'board' | 'doc' | 'presentation' | 'video'): void {
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
  targetCanvasType: 'board' | 'doc' | 'presentation' | 'video'
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
  targetCanvasType: 'board' | 'doc' | 'presentation' | 'video',
  pageIndex = -1,
  loadedProjectData?: any
): Promise<void> {
  const controller = getActiveCanvasController();
  if (!controller) {
    showToast('No se encontró el controlador del lienzo activo', 'warning');
    return;
  }

  if (targetCanvasType === 'video') {
    showToast('Los elementos de proyectos se agregan desde el panel de subidos o herramientas', 'info');
    if (window.innerWidth <= 768) toggleDrawer(false);
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

async function renderAiDrawerContent(drawer: HTMLElement, drawerBody: HTMLElement): Promise<void> {
  const currentPath = window.location.pathname;
  const match = currentPath.match(/^\/(?:ai|ia)\/([a-zA-Z0-9_-]+)/);
  const activeSessionUuid = match?.[1] || null;

  drawerBody.innerHTML = `
    <div class="drawer-section__header" style="padding: 8px 8px 4px 8px;">
      <span class="drawer-section__title" style="font-size: 13px; font-weight: 600; color: var(--text-primary);" data-i18n="nav.ai">${t('nav.ai') || 'Spriteboard IA'}</span>
    </div>
    <button type="button" class="menu-item menu-item--bordered" data-ref="btn-nav-ai-new-chat" style="margin-bottom: 8px;">
      <svg class="component-icon menu-item__icon" aria-hidden="true"><use href="/icons.svg#add"></use></svg>
      <span class="menu-item__text" data-i18n="ai.new_chat">${t('ai.new_chat') || 'Nueva conversación'}</span>
    </button>

    <div class="drawer-section" data-ref="drawer-section-ai-tools">
      <div class="drawer-section__header" data-ref="drawer-header-ai-tools">
        <span class="drawer-section__title">Herramientas IA</span>
      </div>
      <button type="button" class="menu-item" data-ref="btn-nav-ai-tool-presentation" data-prompt="Crea una presentación de 5 diapositivas para lanzar una startup de inteligencia artificial">
        <svg class="component-icon menu-item__icon" aria-hidden="true"><use href="/icons.svg#slideshow"></use></svg>
        <span class="menu-item__text">Presentación Ejecutiva</span>
      </button>
      <button type="button" class="menu-item" data-ref="btn-nav-ai-tool-mindmap" data-prompt="Crea un mapa mental sobre energías renovables y sostenibilidad">
        <svg class="component-icon menu-item__icon" aria-hidden="true"><use href="/icons.svg#psychology"></use></svg>
        <span class="menu-item__text">Mapa Mental</span>
      </button>
      <button type="button" class="menu-item" data-ref="btn-nav-ai-tool-doc" data-prompt="Redacta un documento con las políticas de trabajo remoto y mejores prácticas para el equipo">
        <svg class="component-icon menu-item__icon" aria-hidden="true"><use href="/icons.svg#article"></use></svg>
        <span class="menu-item__text">Documento o Reporte</span>
      </button>
      <button type="button" class="menu-item" data-ref="btn-nav-ai-tool-social" data-prompt="Diseña un post para Instagram promocionando una semana de descuentos en cursos digitales">
        <svg class="component-icon menu-item__icon" aria-hidden="true"><use href="/icons.svg#share"></use></svg>
        <span class="menu-item__text">Post para Redes</span>
      </button>
    </div>

    <div class="drawer-section" data-ref="drawer-section-ai-chats">
      <div class="drawer-section__header" data-ref="drawer-header-ai-chats">
        <span class="drawer-section__title">Conversaciones</span>
      </div>
      <div class="drawer-items-list" data-ref="drawer-ai-chats-list">
        <div class="drawer-canvas-item is-skeleton" style="pointer-events: none;">
          <div class="drawer-canvas-item__thumb skeleton" style="border: none;"></div>
          <div class="skeleton skeleton--text" style="width: 70%; height: 12px; border-radius: 4px;"></div>
        </div>
      </div>
      <div class="ai-studio-history-empty" data-ref="drawer-ai-chats-empty" style="display: none; padding: 12px; font-size: 12px; color: var(--text-tertiary); text-align: center;">
        <p>No tienes chats previos aún.</p>
      </div>
    </div>
  `;

  translateElement(drawerBody);

  const btnNewChat = drawerBody.querySelector<HTMLElement>('[data-ref="btn-nav-ai-new-chat"]');
  btnNewChat?.addEventListener('click', (e) => {
    e.preventDefault();
    if (window.innerWidth <= 768) {
      toggleDrawer(false);
    }
    const currentP = window.location.pathname;
    if (currentP === '/ai' || currentP === '/ia') {
      const activeBtnNew = document.querySelector<HTMLElement>('[data-ref="btn-new-chat"]');
      if (activeBtnNew) {
        activeBtnNew.click();
        return;
      }
    }
    navigate('/ai');
  });

  const toolBtns = drawerBody.querySelectorAll<HTMLElement>('[data-ref^="btn-nav-ai-tool-"]');
  toolBtns.forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const prompt = btn.getAttribute('data-prompt');
      if (window.innerWidth <= 768) {
        toggleDrawer(false);
      }
      const currentP = window.location.pathname;
      if (currentP.startsWith('/ai') || currentP.startsWith('/ia')) {
        const textarea = document.querySelector<HTMLTextAreaElement>('[data-ref="chat-input"]');
        const sendBtn = document.querySelector<HTMLButtonElement>('[data-ref="btn-chat-send"]');
        if (textarea && sendBtn && prompt) {
          textarea.value = prompt;
          sendBtn.click();
          return;
        }
      }
      if (prompt) {
        navigate(`/ai?prompt=${encodeURIComponent(prompt)}`);
      } else {
        navigate('/ai');
      }
    });
  });

  const chatsList = drawerBody.querySelector<HTMLElement>('[data-ref="drawer-ai-chats-list"]');
  const chatsEmpty = drawerBody.querySelector<HTMLElement>('[data-ref="drawer-ai-chats-empty"]');

  if (currentUser) {
    try {
      const res = await getApi('/api/ai/studio-sessions');
      if (res.ok) {
        const data = await res.json();
        const sessions: Array<{ uuid: string; title: string; updated_at: string }> = Array.isArray(data?.sessions) ? data.sessions : [];
        if (chatsList && chatsEmpty) {
          if (sessions.length === 0) {
            chatsList.style.display = 'none';
            chatsEmpty.style.display = 'block';
          } else {
            chatsEmpty.style.display = 'none';
            chatsList.style.display = 'flex';
            chatsList.innerHTML = '';
            sessions.forEach((sess) => {
              const itemBtn = document.createElement('button');
              itemBtn.type = 'button';
              itemBtn.className = `menu-item${sess.uuid === activeSessionUuid ? ' is-active' : ''}`;
              itemBtn.setAttribute('data-ref', `drawer-chat-item-${sess.uuid}`);
              itemBtn.innerHTML = `
                <svg class="component-icon menu-item__icon" aria-hidden="true"><use href="/icons.svg#chat_bubble_outline"></use></svg>
                <span class="menu-item__text">${escapeHtml(sess.title || 'Conversación')}</span>
              `;
              itemBtn.addEventListener('click', (e) => {
                e.preventDefault();
                if (window.innerWidth <= 768) {
                  toggleDrawer(false);
                }
                navigate(`/ai/${sess.uuid}`);
              });
              chatsList.appendChild(itemBtn);
            });
          }
        }
      }
    } catch {
      if (chatsList) chatsList.style.display = 'none';
      if (chatsEmpty) chatsEmpty.style.display = 'block';
    }
  } else {
    if (chatsList) chatsList.style.display = 'none';
    if (chatsEmpty) chatsEmpty.style.display = 'block';
  }

  const drawerFooter = drawer.querySelector<HTMLElement>('[data-ref="drawer-footer"]');
  if (drawerFooter) {
    drawerFooter.style.display = 'none';
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

  if (currentPath.startsWith('/ai') || currentPath.startsWith('/ia')) {
    await renderAiDrawerContent(drawer, drawerBody);
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
        <button type="button" class="menu-item" data-ref="btn-nav-settings-profile">
          <svg class="component-icon menu-item__icon" aria-hidden="true"><use href="/icons.svg#public"></use></svg>
          <span class="menu-item__text" data-i18n="nav.public_profile">Perfil público</span>
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
      const btnProfile = drawerBody.querySelector<HTMLElement>('[data-ref="btn-nav-settings-profile"]');
      const btnSecurity = drawerBody.querySelector<HTMLElement>('[data-ref="btn-nav-settings-security"]');
      const btnAccessibility = drawerBody.querySelector<HTMLElement>('[data-ref="btn-nav-settings-accessibility"]');

      if (currentPath === '/settings' || currentPath === '/settings/your-account') {
        btnAccount?.classList.add('is-active');
      } else if (currentPath === '/settings/profile' || currentPath === '/settings/public-profile') {
        btnProfile?.classList.add('is-active');
      } else if (currentPath === '/settings/security' || currentPath === '/settings/login-and-security') {
        btnSecurity?.classList.add('is-active');
      } else if (currentPath === '/settings/accessibility') {
        btnAccessibility?.classList.add('is-active');
      }

      bindNavLink(btnAccount, '/settings/your-account');
      bindNavLink(btnProfile, '/settings/profile');
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
  if (getIsChatOpen()) {
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
        const hasAdminAccess = canAccessAdmin(currentUser);
        btnAdmin.style.display = hasAdminAccess ? 'flex' : 'none';
        btnAdmin.addEventListener('click', (e) => {
          e.preventDefault();
          closeMenu();
          const adminUrl = `${window.location.protocol}//${window.location.hostname}:3002`;
          window.open(adminUrl, '_blank', 'noopener,noreferrer');
        });
      }

      const btnOpenDesktop = avatarContainer.querySelector<HTMLElement>('[data-ref="btn-menu-open-desktop"]');
      const desktopDivider = avatarContainer.querySelector<HTMLElement>('[data-ref="desktop-divider"]');
      if (btnOpenDesktop) {
        const isAlreadyInDesktop = Boolean((window as any).spriteDesktop?.isDesktop);
        if (isAlreadyInDesktop) {
          btnOpenDesktop.style.display = 'none';
          if (desktopDivider) {
            desktopDivider.style.display = 'none';
          }
        } else {
          btnOpenDesktop.addEventListener('click', (e) => {
            e.preventDefault();
            closeMenu();
            const currentRoute = window.location.pathname + window.location.search;
            const customProtocolUrl = `spriteboard://open?path=${encodeURIComponent(currentRoute)}`;

            let didBlur = false;
            const onBlurHandler = () => {
              didBlur = true;
            };
            window.addEventListener('blur', onBlurHandler, { once: true });

            const iframe = document.createElement('iframe');
            iframe.style.display = 'none';
            iframe.src = customProtocolUrl;
            document.body.appendChild(iframe);

            setTimeout(() => {
              iframe.remove();
              window.removeEventListener('blur', onBlurHandler);
              if (!didBlur) {
                navigate('/download');
              }
            }, 1200);
          });
        }
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
  setActiveAppId(appId || null);
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
  return isDrawerOpen && activeCanvasTab === 'apps' && getActiveAppId() === 'qr-code';
}

export function openYouTubeInDrawer(): void {
  openAppsInDrawer('youtube');
}

export function isYouTubeDrawerOpen(): boolean {
  return isDrawerOpen && activeCanvasTab === 'apps' && getActiveAppId() === 'youtube';
}

