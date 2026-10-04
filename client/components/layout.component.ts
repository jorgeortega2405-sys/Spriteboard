import { navigate } from '../app-router.js';
import { currentUser } from '../services/api.service.js';
import { t, translateElement } from '../services/i18n.service.js';
import { renderIcons } from '../services/icon.service.js';
import { loadTemplate } from '../services/template.service.js';
import { BoardChartElement } from '../views/board/board.types.js';
import { attachChatSidebarToView, getIsChatOpen, initChatSidebar, toggleChatSidebar } from './layout/layout-chat.component.js';
import { getActiveAppId, renderAppsDrawerContent, setActiveAppId } from './layout/layout-drawer-apps.component.js';
import { renderElementsDrawerContent } from './layout/layout-drawer-elements.component.js';
import { handleApplyCanvasUpload, renderUploadsDrawerContent } from './layout/layout-drawer-uploads.component.js';
import { renderTextDrawerContent } from './layout/layout-drawer-text.component.js';
import { getActiveChartInDrawer, renderChartsDrawerContent, setActiveChartInDrawer } from './layout/layout-drawer-charts.component.js';
import { getActiveColorTargetInDrawer, openAnimationInDrawer, openColorsInDrawer, openEffectsInDrawer, openFontsInDrawer, openMockupsInDrawer, openPixelAnimationInDrawer, openPositionInDrawer, renderAnimationDrawerContent, renderColorsDrawerContent, renderEffectsDrawerContent, renderFontsDrawerContent, renderMockupsDrawerContent, renderPixelAnimationDrawerContent, renderPositionDrawerContent, setActiveColorTargetInDrawer } from './layout/layout-drawer-inspectors.component.js';
import { renderBrandDrawerContent } from './layout/layout-drawer-brand.component.js';
import { renderHomeDrawerContent, renderTemplatesDrawerContent } from './layout/layout-drawer-templates.component.js';
import { renderProjectsDrawerContent } from './layout/layout-drawer-projects.component.js';
import { renderAiDrawerContent } from './layout/layout-drawer-ai.component.js';
import { setupRailNotifications } from './layout/layout-notifications.component.js';
import { setupUserMenu } from './layout/layout-user-menu.component.js';
import { setupRailNavigation } from './layout/layout-rail-nav.component.js';

export { attachChatSidebarToView, getActiveColorTargetInDrawer, getIsChatOpen, handleApplyCanvasUpload, initChatSidebar, openAnimationInDrawer, openColorsInDrawer, openEffectsInDrawer, openFontsInDrawer, openMockupsInDrawer, openPixelAnimationInDrawer, openPositionInDrawer, toggleChatSidebar };

export let isDrawerOpen = false;
let activeCanvasTab: 'apps' | 'animate' | 'brand' | 'charts' | 'colors' | 'effects' | 'elements' | 'fonts' | 'mockups' | 'pixel-anim' | 'position' | 'projects' | 'templates' | 'text' | 'tools' | 'uploads' | null = null;
let drawerRemovalTimer: ReturnType<typeof setTimeout> | null = null;
let sidebarInstance: HTMLElement | null = null;
let sidebarInitPromise: Promise<HTMLElement> | null = null;

export function getActiveCanvasTab(): typeof activeCanvasTab {
  return activeCanvasTab;
}

export function setActiveCanvasTab(tab: typeof activeCanvasTab): void {
  activeCanvasTab = tab;
}

export function getIsSidebarOpen(): boolean {
  return isDrawerOpen;
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

export function hasDesignatedMenuItems(pathname: string): boolean {
  if (!pathname) return false;
  return (
    pathname.startsWith('/settings') ||
    pathname.startsWith('/help') ||
    pathname.startsWith('/ai') ||
    pathname.startsWith('/ia')
  );
}

export function getActiveCanvasType(): 'board' | 'doc' | 'presentation' | 'video' {
  const path = window.location.pathname;
  if (path.startsWith('/doc')) return 'doc';
  if (path.startsWith('/presentation')) return 'presentation';
  if (path.startsWith('/video')) return 'video';
  return 'board';
}

export function getActiveCanvasController(): any {
  return (
    (window as any).boardController ||
    (window as any).docController ||
    (window as any).stageCanvasController ||
    (window as any).videoEditorController ||
    (window as any).canvasController ||
    null
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

  const btnMoreApps = sidebar.querySelector<HTMLElement>('[data-ref="btn-more-apps"]');
  const btnMoreApply = sidebar.querySelector<HTMLElement>('[data-ref="btn-more-apply-designer"]');
  btnMoreApps?.classList.toggle('is-active', path === '/your-apps');
  btnMoreApply?.classList.toggle('is-active', isDesigner || path === '/apply-designer' || path === '/designer/apply' || path === '/creators' || path === '/creators/apply');

  const itemAi = sidebar.querySelector<HTMLElement>('[data-ref="rail-item-ai"]');
  const itemBrand = sidebar.querySelector<HTMLElement>('[data-ref="rail-item-brand"]');
  const itemShared = sidebar.querySelector<HTMLElement>('[data-ref="rail-item-shared"]');
  const itemTeams = sidebar.querySelector<HTMLElement>('[data-ref="rail-item-teams"]');
  const notificationsContainer = sidebar.querySelector<HTMLElement>('[data-ref="notifications-container"]');
  const btnNotifications = sidebar.querySelector<HTMLElement>('[data-ref="btn-notifications"]');
  const btnSettings = sidebar.querySelector<HTMLElement>('[data-ref="btn-rail-settings"]');

  if (!currentUser) {
    if (itemAi) itemAi.style.display = 'none';
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
    if (itemAi) itemAi.style.display = '';
    if (itemBrand) itemBrand.style.display = '';
    if (itemShared) itemShared.style.display = '';
    if (itemTeams) itemTeams.style.display = '';
    if (notificationsContainer) notificationsContainer.style.display = 'flex';
    if (btnNotifications) btnNotifications.style.display = 'inline-flex';
    if (btnMoreApply) btnMoreApply.style.display = 'flex';
    if (btnSettings) btnSettings.style.display = 'none';
  }
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

export function renderCanvasDrawerContent(drawer: HTMLElement, drawerBody: HTMLElement): void {
  const tab = activeCanvasTab || 'templates';

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
    renderTemplatesDrawerContent(drawer, drawerBody);
    return;
  }
  if (tab === 'projects') {
    void renderProjectsDrawerContent(drawer, drawerBody);
    return;
  }
}

export async function populateDrawerContent(drawer: HTMLElement): Promise<void> {
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

async function openDynamicDrawer(sidebar: HTMLElement): Promise<void> {
  let drawer = sidebar.querySelector<HTMLElement>('[data-ref="layout-drawer"]');
  if (!drawer) {
    drawer = createDrawerElement();
    sidebar.appendChild(drawer);
  }
  await populateDrawerContent(drawer);
  drawer.classList.add('is-open');
}

function closeDynamicDrawer(): void {
  const sidebar = document.querySelector<HTMLElement>('[data-ref="sidebar"]');
  const drawer = sidebar?.querySelector<HTMLElement>('[data-ref="layout-drawer"]');
  if (drawer) {
    drawer.classList.remove('is-open');
    if (drawerRemovalTimer) {
      clearTimeout(drawerRemovalTimer);
    }
    drawerRemovalTimer = setTimeout(() => {
      drawer?.remove();
      drawerRemovalTimer = null;
    }, 280);
  }
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

export async function updateDynamicDrawer(sidebar?: HTMLElement): Promise<void> {
  const sb = sidebar || document.querySelector<HTMLElement>('[data-ref="sidebar"]');
  if (!sb) return;
  const drawer = sb.querySelector<HTMLElement>('[data-ref="layout-drawer"]');
  if (drawer && isDrawerOpen) {
    await populateDrawerContent(drawer);
  }
}

export async function createTopBar(): Promise<HTMLElement> {
  const dummy = document.createElement('div');
  dummy.className = 'layout-header-placeholder';
  dummy.style.display = 'none';
  return dummy;
}

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

  let closeAvatarMenuRef = () => {};
  const { closeNotifications } = setupRailNotifications(sidebar, () => closeAvatarMenuRef);
  closeAvatarMenuRef = setupUserMenu(sidebar, closeNotifications);
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
  setActiveChartInDrawer(chart || null);
  activeCanvasTab = 'charts';
  const sidebar = document.querySelector<HTMLElement>('[data-ref="sidebar"]');
  if (!isDrawerOpen) {
    toggleDrawer(true);
  } else if (sidebar) {
    void updateDynamicDrawer(sidebar);
    updateCanvasRailActiveState(sidebar);
  }
}

export function isChartInspectorOpen(): boolean {
  return isDrawerOpen && activeCanvasTab === 'charts';
}

export function isColorsDrawerOpen(): boolean {
  return isDrawerOpen && activeCanvasTab === 'colors';
}

export function isFontsDrawerOpen(): boolean {
  return isDrawerOpen && activeCanvasTab === 'fonts';
}

export function isPixelAnimationDrawerOpen(): boolean {
  return isDrawerOpen && activeCanvasTab === 'pixel-anim';
}

export function isEffectsDrawerOpen(): boolean {
  return isDrawerOpen && activeCanvasTab === 'effects';
}

export function isAnimationDrawerOpen(): boolean {
  return isDrawerOpen && activeCanvasTab === 'animate';
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
