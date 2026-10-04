import { navigate } from '../../app-router.js';
import { hasFeature, protectRoute } from '../../config/plans.config.js';
import { currentUser } from '../../services/api.service.js';
import { canPublishTemplates } from '../../types/auth.types.js';
import { closeAllDropdowns, registerActiveDropdown, unregisterActiveDropdown } from '../../utils/dom.util.js';
import { openCreateCanvasModal } from '../create-canvas-modal.component.js';
import { getActiveCanvasController, getActiveCanvasTab, isDrawerOpen, setActiveCanvasTab, toggleDrawer, updateCanvasRailActiveState, updateDynamicDrawer } from '../layout.component.js';
import { openUpgradeModal } from '../upgrade-modal.component.js';

export function setupRailNavigation(sidebar: HTMLElement): void {
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
    const itemAi = sidebar.querySelector<HTMLElement>('[data-ref="rail-item-ai"]');
    const itemBrand = sidebar.querySelector<HTMLElement>('[data-ref="rail-item-brand"]');
    const itemShared = sidebar.querySelector<HTMLElement>('[data-ref="rail-item-shared"]');
    const itemTeams = sidebar.querySelector<HTMLElement>('[data-ref="rail-item-teams"]');
    if (itemAi) itemAi.style.display = 'none';
    if (itemBrand) itemBrand.style.display = 'none';
    if (itemShared) itemShared.style.display = 'none';
    if (itemTeams) itemTeams.style.display = 'none';
    if (btnMoreApply) btnMoreApply.style.display = 'none';
  }

  const updateRailBrandBadge = () => {
    const railBrandBadge = sidebar.querySelector<HTMLElement>('[data-ref="rail-brand-badge"]');
    const railCanvasBrandBadge = sidebar.querySelector<HTMLElement>('[data-ref="rail-canvas-brand-badge"]');
    const hasBrandAccess = hasFeature('brand_kits', currentUser);
    if (railBrandBadge) {
      railBrandBadge.classList.toggle('is-hidden', hasBrandAccess);
    }
    if (railCanvasBrandBadge) {
      railCanvasBrandBadge.classList.toggle('is-hidden', hasBrandAccess);
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
    setActiveCanvasTab(null);
    navigate('/');
  };
  btnCanvasHome?.addEventListener('click', canvasHomeHandler);
  itemCanvasHome?.addEventListener('click', (e) => {
    if (e.target !== btnCanvasHome && !btnCanvasHome?.contains(e.target as Node)) {
      canvasHomeHandler(e);
    }
  });

  const canvasItems: Array<{ btnRef: string; itemRef: string; tab: 'apps' | 'brand' | 'elements' | 'projects' | 'templates' | 'text' | 'tools' | 'uploads' }> = [
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
      if (tab === 'brand') {
        const hasBrandAccess = hasFeature('brand_kits', currentUser);
        if (!hasBrandAccess) {
          openUpgradeModal('business');
          return;
        }
      }
      if (tab === 'tools') {
        if (isDrawerOpen) {
          toggleDrawer(false);
        }
        const controller = getActiveCanvasController();
        if (controller && typeof controller.toggleVerticalToolbar === 'function') {
          const isNowActive = controller.toggleVerticalToolbar();
          setActiveCanvasTab(isNowActive ? 'tools' : null);
          updateCanvasRailActiveState(sidebar);
        }
        return;
      }
      if (isDrawerOpen && getActiveCanvasTab() === tab) {
        toggleDrawer(false);
      } else {
        setActiveCanvasTab(tab);
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
