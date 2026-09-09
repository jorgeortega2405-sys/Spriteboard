import { navigate, render } from '../app-router.js';
import { API_ROUTES } from '../config/api-routes.js';
import { currentUser, escapeHtml, linkedAccounts, logoutAllApi, logoutApi, postApi, switchAccountApi } from '../services/api.service.js';
import { t, translateElement } from '../services/i18n.service.js';
import { loadTemplate } from '../services/template.service.js';
import { showToast } from '../services/toast.service.js';
import { closeWebSocket, initWebSocket } from '../services/websocket.service.js';
import { openCreateCanvasModal } from './create-canvas-modal.component.js';

let isSidebarOpen = false;
let isChatOpen = false;
let chatSidebarElement: HTMLElement | null = null;

export function getIsSidebarOpen(): boolean {
  return isSidebarOpen;
}

export function toggleSidebar(forceState?: boolean): void {
  isSidebarOpen = forceState !== undefined ? forceState : !isSidebarOpen;
  const sidebar = document.querySelector<HTMLElement>('[data-ref="sidebar"]');

  if (sidebar) {
    sidebar.classList.toggle('is-active', isSidebarOpen);
    if (isSidebarOpen) {
      toggleChatSidebar(false);
    }
  }
}

export function getIsChatOpen(): boolean {
  return isChatOpen;
}

export function toggleChatSidebar(forceState?: boolean): void {
  isChatOpen = forceState !== undefined ? forceState : !isChatOpen;

  const activeContent = document.querySelector<HTMLElement>('[data-ref="app"] .layout-content');
  if (activeContent && chatSidebarElement && chatSidebarElement.parentNode !== activeContent) {
    activeContent.appendChild(chatSidebarElement);
  }

  if (chatSidebarElement) {
    chatSidebarElement.classList.toggle('is-active', isChatOpen);
    updateChatEmptyState();

    if (isChatOpen) {
      toggleSidebar(false);
      const chatInput = chatSidebarElement.querySelector<HTMLInputElement>('[data-ref="chat-input"]');
      setTimeout(() => chatInput?.focus(), 80);
    }
  }
}

export function attachChatSidebarToView(contentElement: HTMLElement | null): void {
  if (!contentElement || !chatSidebarElement) return;
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
    if (isSidebarOpen) toggleSidebar(false);
    if (isChatOpen) toggleChatSidebar(false);
  }
});

document.addEventListener('click', (e: MouseEvent) => {
  const target = e.target as Node | null;
  if (isSidebarOpen) {
    const sidebar = document.querySelector<HTMLElement>('[data-ref="sidebar"]');
    const btnToggle = document.querySelector<HTMLElement>('[data-ref="btn-toggle-menu"]');
    if (sidebar && target && !sidebar.contains(target) && (!btnToggle || !btnToggle.contains(target))) {
      toggleSidebar(false);
    }
  }

  if (isChatOpen) {
    const chatSidebar = document.querySelector<HTMLElement>('[data-ref="chat-sidebar"]');
    const btnToggle = document.querySelector<HTMLElement>('[data-ref="btn-help-chat"]');
    const btnMenuHelp = document.querySelector<HTMLElement>('[data-ref="btn-menu-help"]');

    const isClickInside =
      (chatSidebar && target && chatSidebar.contains(target)) ||
      (btnToggle && target && btnToggle.contains(target)) ||
      (btnMenuHelp && target && btnMenuHelp.contains(target));

    if (!isClickInside) {
      toggleChatSidebar(false);
    }
  }
});

export async function createTopBar(): Promise<HTMLElement> {
  const topbar = await loadTemplate('/views/components/topbar.html');

  const btnToggle = topbar.querySelector<HTMLElement>('[data-ref="btn-toggle-menu"]');
  btnToggle?.addEventListener('click', (e) => {
    e.preventDefault();
    toggleSidebar();
  });

  const btnCreateCanvas = topbar.querySelector<HTMLElement>('[data-ref="btn-create-canvas"]');
  btnCreateCanvas?.addEventListener('click', (e) => {
    e.preventDefault();
    openCreateCanvasModal();
  });

  const btnUpgrade = topbar.querySelector<HTMLElement>('[data-ref="btn-upgrade"]');
  btnUpgrade?.addEventListener('click', (e) => {
    e.preventDefault();
    navigate('/upgrade');
  });

  const btnHelpChat = topbar.querySelector<HTMLElement>('[data-ref="btn-help-chat"]');
  btnHelpChat?.addEventListener('click', (e) => {
    e.preventDefault();
    toggleChatSidebar();
  });

  const btnMobileSearch = topbar.querySelector<HTMLElement>('[data-ref="btn-mobile-search"]');
  const searchInput = topbar.querySelector<HTMLInputElement>('[data-ref="topbar-search-input"]');

  btnMobileSearch?.addEventListener('click', (e) => {
    e.preventDefault();
    const isActive = topbar.classList.toggle('layout-header--search-active');
    if (isActive) {
      setTimeout(() => searchInput?.focus(), 60);
    }
  });

  document.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Escape' && topbar.classList.contains('layout-header--search-active')) {
      topbar.classList.remove('layout-header--search-active');
    }
  });

  const avatarContainer = topbar.querySelector<HTMLElement>('[data-ref="avatar-container"]');
  const btnLogin = topbar.querySelector<HTMLElement>('[data-ref="btn-login"]');

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
        if (avatarBtn) {
          avatarBtn.setAttribute('data-tier', tVal);
          avatarBtn.classList.remove(
            'avatar-tier--free',
            'avatar-tier--plus',
            'avatar-tier--pro',
            'avatar-tier--ultra'
          );
          avatarBtn.classList.add(`avatar-tier--${tVal}`);
        }
        if (activeAvatarBox) {
          activeAvatarBox.setAttribute('data-tier', tVal);
          activeAvatarBox.classList.remove(
            'avatar-tier--free',
            'avatar-tier--plus',
            'avatar-tier--pro',
            'avatar-tier--ultra'
          );
          activeAvatarBox.classList.add(`avatar-tier--${tVal}`);
        }
      };
      updateTopBarTier(userTier);

      const handleSubscriptionUpdated = (e: any) => {
        const tier = e.detail?.subscription_tier || currentUser?.subscription_tier || 'free';
        updateTopBarTier(tier);
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
            <div class="account-item__avatar avatar-tier--${accTier}" data-ref="account-avatar-${acc.id}" data-tier="${accTier}">
              <img class="avatar-img image-lazy-fade" data-ref="avatar-img-${acc.id}" src="${accAvatarUrl}" alt="${escapeHtml(acc.username)}" referrerpolicy="no-referrer" onload="this.classList.add('image-loaded')" onerror="this.classList.add('image-loaded')" />
            </div>
            <div class="account-item__info" data-ref="account-info-${acc.id}">
              <span class="account-item__name" data-ref="account-name-${acc.id}">${escapeHtml(acc.username)}</span>
              <span class="account-item__email" data-ref="account-email-${acc.id}">${escapeHtml(acc.email || '')}</span>
            </div>
            ${isActive ? '<span class="material-symbols-rounded account-item__check">check_circle</span>' : ''}
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

        if (btnAddAccount) {
          btnAddAccount.style.display = accounts.length >= 5 ? 'none' : 'flex';
        }
      };

      let isClosing = false;

      const openMenu = () => {
        if (isClosing) return;

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
        dragZone?.removeEventListener('pointerdown', onPointerDown);
        dragZone?.removeEventListener('lostpointercapture', onPointerUp);
        document.removeEventListener('click', closeMenuHandler);
        document.removeEventListener('keydown', closeMenuKeydownHandler);
        window.removeEventListener('resize', onWindowResize);
        window.removeEventListener('subscription-updated', handleSubscriptionUpdated);
        render();
      };

      const btnTeams = avatarContainer.querySelector<HTMLElement>('[data-ref="btn-menu-teams"]');
      btnTeams?.addEventListener('click', (e) => {
        e.preventDefault();
        closeMenu();
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

  return topbar;
}

export async function createSidebar(): Promise<HTMLElement> {
  const sidebar = await loadTemplate('/views/components/sidebar.html');

  if (isSidebarOpen) {
    sidebar.classList.add('is-active');
  }

  const currentPath = window.location.pathname;
  const sidebarHeader = sidebar.querySelector<HTMLElement>('[data-ref="sidebar-header"]');
  const navTop = sidebar.querySelector<HTMLElement>('[data-ref="sidebar-nav-top"]');
  const navBottom = sidebar.querySelector<HTMLElement>('[data-ref="sidebar-nav-bottom"]');
  const sidebarBottom = sidebar.querySelector<HTMLElement>('[data-ref="sidebar-bottom"]');

  const bindNavLink = (btn: HTMLElement | null, path: string) => {
    btn?.addEventListener('click', (e) => {
      e.preventDefault();
      toggleSidebar(false);
      navigate(path);
    });
  };

  if (currentPath.startsWith('/settings')) {
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
      const btnBackHome = sidebarHeader.querySelector<HTMLElement>('[data-ref="btn-nav-back-home"]');
      bindNavLink(btnBackHome, '/');
    }

    if (navTop) {
      if (currentUser) {
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

        const btnAccount = navTop.querySelector<HTMLElement>('[data-ref="btn-nav-settings-account"]');
        const btnSecurity = navTop.querySelector<HTMLElement>('[data-ref="btn-nav-settings-security"]');
        const btnBilling = navTop.querySelector<HTMLElement>('[data-ref="btn-nav-settings-billing"]');
        const btnPurchases = navTop.querySelector<HTMLElement>('[data-ref="btn-nav-settings-purchases"]');
        const btnAccessibility = navTop.querySelector<HTMLElement>(
          '[data-ref="btn-nav-settings-accessibility"]'
        );

        if (currentPath === '/settings' || currentPath === '/settings/your-account') {
          btnAccount?.classList.add('is-active');
        } else if (
          currentPath === '/settings/security' ||
          currentPath === '/settings/login-and-security'
        ) {
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
        navTop.innerHTML = `
          <button type="button" class="menu-item" data-ref="btn-nav-settings-guest">
            <span class="material-symbols-rounded menu-item__icon">tune</span>
            <span class="menu-item__text" data-i18n="nav.guest_settings"></span>
          </button>
        `;
        translateElement(navTop);

        const btnGuest = navTop.querySelector<HTMLElement>('[data-ref="btn-nav-settings-guest"]');
        if (currentPath === '/settings' || currentPath === '/settings/guest') {
          btnGuest?.classList.add('is-active');
        }
        bindNavLink(btnGuest, '/settings/guest');
      }
    }
  } else if (currentPath.startsWith('/help')) {
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
      const btnBackHome = sidebarHeader.querySelector<HTMLElement>('[data-ref="btn-nav-back-home"]');
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

      const btnTerms = navTop.querySelector<HTMLElement>('[data-ref="btn-nav-help-terms"]');
      const btnPrivacy = navTop.querySelector<HTMLElement>('[data-ref="btn-nav-help-privacy"]');
      const btnCookies = navTop.querySelector<HTMLElement>('[data-ref="btn-nav-help-cookies"]');
      const btnLegal = navTop.querySelector<HTMLElement>('[data-ref="btn-nav-help-legal"]');
      const btnBilling = navTop.querySelector<HTMLElement>('[data-ref="btn-nav-help-billing"]');
      const btnSupport = navTop.querySelector<HTMLElement>('[data-ref="btn-nav-help-support"]');

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
        <button type="button" class="menu-item" data-ref="btn-nav-templates">
          <span class="material-symbols-rounded menu-item__icon">space_dashboard</span>
          <span class="menu-item__text" data-i18n="nav.templates"></span>
        </button>
      `;
      translateElement(navTop);

      const btnHome = navTop.querySelector<HTMLElement>('[data-ref="btn-nav-home"]');
      if (currentPath === '/' || currentPath === '') {
        btnHome?.classList.add('is-active');
      }
      bindNavLink(btnHome, '/');

      const btnTemplates = navTop.querySelector<HTMLElement>('[data-ref="btn-nav-templates"]');
      if (currentPath === '/templates') {
        btnTemplates?.classList.add('is-active');
      }
      bindNavLink(btnTemplates, '/templates');
    }

    if (navBottom) {
      navBottom.innerHTML = `
        <button type="button" class="menu-item" data-ref="btn-nav-trash">
          <span class="material-symbols-rounded menu-item__icon">delete</span>
          <span class="menu-item__text" data-i18n="nav.trash"></span>
        </button>
      `;
      translateElement(navBottom);

      const btnTrash = navBottom.querySelector<HTMLElement>('[data-ref="btn-nav-trash"]');
      if (currentPath === '/trash') {
        btnTrash?.classList.add('is-active');
      }
      bindNavLink(btnTrash, '/trash');
    }
  }

  return sidebar;
}

function setupChatSidebarEvents(sidebarElement: HTMLElement): void {
  const conversationHistory: Array<{ role: string; text: string }> = [];

  const btnClose = sidebarElement.querySelector<HTMLElement>('[data-ref="btn-chat-close"]');
  btnClose?.addEventListener('click', (e) => {
    e.preventDefault();
    toggleChatSidebar(false);
  });

  const btnHistory = sidebarElement.querySelector<HTMLElement>('[data-ref="btn-chat-history"]');
  btnHistory?.addEventListener('click', (e) => {
    e.preventDefault();
    const emptyStateTitle = sidebarElement.querySelector<HTMLElement>('[data-ref="chat-empty-state"] h3');
    const emptyStateDesc = sidebarElement.querySelector<HTMLElement>('[data-ref="chat-empty-state"] p');
    if (emptyStateTitle && emptyStateDesc) {
      emptyStateTitle.textContent = 'Historial de Chats';
      emptyStateDesc.textContent = 'No hay conversaciones previas registradas.';
    }
  });

  const chatInput = sidebarElement.querySelector<HTMLTextAreaElement>('[data-ref="chat-input"]');
  const chatInputBox = sidebarElement.querySelector<HTMLElement>('[data-ref="chat-input-box"]');
  const btnSend = sidebarElement.querySelector<HTMLButtonElement>('[data-ref="btn-chat-send"]');

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

  function appendMessage(type: string, text: string): HTMLElement {
    const messagesContainer = sidebarElement.querySelector<HTMLElement>('[data-ref="chat-messages"]');
    const emptyState = sidebarElement.querySelector<HTMLElement>('[data-ref="chat-empty-state"]');
    if (emptyState) emptyState.style.display = 'none';

    const wrapper = document.createElement('div');
    wrapper.className = `chat-message chat-message--${type}`;
    wrapper.setAttribute('data-ref', `chat-message-${type}`);

    if (type === 'agent') {
      wrapper.appendChild(createAgentBadge(false));
      const bubble = document.createElement('div');
      bubble.className = 'chat-agent-bubble';
      bubble.textContent = text;
      wrapper.appendChild(bubble);
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

  function setLoading(loading: boolean): void {
    if (chatInput) chatInput.disabled = loading;
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
    const text = chatInput?.value?.trim();
    if (!text) return;

    if (chatInput) {
      chatInput.value = '';
      autoResizeTextarea();
    }
    appendMessage('user', text);
    conversationHistory.push({ role: 'user', text });

    setLoading(true);
    const typingIndicator = appendTypingIndicator();

    try {
      const res = await postApi(API_ROUTES.chat, {
        message: text,
        history: conversationHistory.slice(-10),
      });

      typingIndicator.remove();

      if (res.ok) {
        const data = await res.json();
        const reply = data.reply || 'No pude generar una respuesta. Por favor intenta de nuevo.';
        appendMessage('agent', reply);
        conversationHistory.push({ role: 'model', text: reply });
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
    sendMessage();
  });

  chatInput?.addEventListener('input', () => {
    autoResizeTextarea();
  });

  chatInput?.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });
}

export async function initChatSidebar(): Promise<HTMLElement> {
  if (chatSidebarElement) return chatSidebarElement;

  chatSidebarElement = await loadTemplate('/views/components/chat-sidebar.html');
  translateElement(chatSidebarElement);
  setupChatSidebarEvents(chatSidebarElement);

  const chatPanel = chatSidebarElement.querySelector<HTMLElement>('[data-ref="chat-panel"]');
  chatPanel?.classList.add('is-empty');

  return chatSidebarElement;
}
