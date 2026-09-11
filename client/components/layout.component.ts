import { navigate, render } from '../app-router.js';
import { API_ROUTES } from '../config/api-routes.js';
import { currentUser, deleteApi, escapeHtml, getApi, linkedAccounts, logoutAllApi, logoutApi, patchApi, postApi, switchAccountApi } from '../services/api.service.js';
import { renderIcons } from '../services/icon.service.js';
import { t, translateElement } from '../services/i18n.service.js';
import { loadTemplate } from '../services/template.service.js';
import { showToast } from '../services/toast.service.js';
import { closeWebSocket, initWebSocket } from '../services/websocket.service.js';
import { openCreateCanvasModal } from './create-canvas-modal.component.js';
import { openUpgradeModal } from './upgrade-modal.component.js';

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
    openUpgradeModal();
  });

  const btnHelpChat = topbar.querySelector<HTMLElement>('[data-ref="btn-help-chat"]');
  btnHelpChat?.addEventListener('click', (e) => {
    e.preventDefault();
    toggleChatSidebar();
  });

  const btnMobileSearch = topbar.querySelector<HTMLElement>('[data-ref="btn-mobile-search"]');
  const searchInput = topbar.querySelector<HTMLInputElement>('[data-ref="topbar-search-input"]');
  const searchIcon = topbar.querySelector<HTMLElement>('[data-ref="topbar-search-icon"]');

  if (window.location.pathname === '/search' && searchInput) {
    const urlParams = new URLSearchParams(window.location.search);
    const initialQ = urlParams.get('q');
    if (initialQ) {
      searchInput.value = initialQ;
    }
  }

  const triggerSearch = () => {
    const q = (searchInput?.value || '').trim();
    if (!q) return;
    navigate(`/search?q=${encodeURIComponent(q)}`);
    topbar.classList.remove('layout-header--search-active');
  };

  searchInput?.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      triggerSearch();
    }
  });

  searchIcon?.addEventListener('click', () => {
    triggerSearch();
  });

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

  const btnNotifications = topbar.querySelector<HTMLElement>('[data-ref="btn-notifications"]');
  const notificationsBadge = topbar.querySelector<HTMLElement>('[data-ref="notifications-badge"]');
  const notificationsBackdrop = topbar.querySelector<HTMLElement>('[data-ref="notifications-backdrop"]');
  const notificationsPanel = topbar.querySelector<HTMLElement>('[data-ref="notifications-panel"]');
  const notificationsDragZone = topbar.querySelector<HTMLElement>('[data-ref="notifications-drag-zone"]');
  const btnMarkAllRead = topbar.querySelector<HTMLElement>('[data-ref="btn-mark-all-read"]');
  const notificationsList = topbar.querySelector<HTMLElement>('[data-ref="notifications-list"]');
  const notificationsEmpty = topbar.querySelector<HTMLElement>('[data-ref="notifications-empty"]');

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
    } catch {
      // Ignorar fallo de red silenciosamente en background
    }
  };

  const openNotifications = () => {
    if (!currentUser) {
      navigate('/login');
      return;
    }
    if (isNotificationsClosing) return;
    closeAvatarMenu();
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
            'avatar-tier--ultra',
            'avatar-tier--business',
            'avatar-tier--negocios'
          );
          avatarBtn.classList.add(`avatar-tier--${tVal}`);
        }
        if (activeAvatarBox) {
          activeAvatarBox.setAttribute('data-tier', tVal);
          activeAvatarBox.classList.remove(
            'avatar-tier--free',
            'avatar-tier--plus',
            'avatar-tier--pro',
            'avatar-tier--ultra',
            'avatar-tier--business',
            'avatar-tier--negocios'
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
        closeNotifications();

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

  if (currentUser) {
    void loadNotifications();
    const notifInterval = setInterval(() => {
      if (document.body.contains(topbar)) {
        void loadNotifications();
      } else {
        clearInterval(notifInterval);
      }
    }, 35000);
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

    if (currentUser) {
      if (sidebarBottom) {
        sidebarBottom.style.display = '';
      }

      if (navTop) {
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

        const btnAccount = navTop.querySelector<HTMLElement>('[data-ref="btn-nav-settings-account"]');
        const btnSecurity = navTop.querySelector<HTMLElement>('[data-ref="btn-nav-settings-security"]');
        const btnAccessibility = navTop.querySelector<HTMLElement>('[data-ref="btn-nav-settings-accessibility"]');

        if (currentPath === '/settings' || currentPath === '/settings/your-account') {
          btnAccount?.classList.add('is-active');
        } else if (
          currentPath === '/settings/security' ||
          currentPath === '/settings/login-and-security'
        ) {
          btnSecurity?.classList.add('is-active');
        } else if (currentPath === '/settings/accessibility') {
          btnAccessibility?.classList.add('is-active');
        }

        bindNavLink(btnAccount, '/settings/your-account');
        bindNavLink(btnSecurity, '/settings/security');
        bindNavLink(btnAccessibility, '/settings/accessibility');
      }

      if (navBottom) {
        navBottom.innerHTML = `
          <button type="button" class="menu-item" data-ref="btn-nav-settings-billing">
            <span class="material-symbols-rounded menu-item__icon">credit_card</span>
            <span class="menu-item__text" data-i18n="nav.billing"></span>
          </button>
          <button type="button" class="menu-item" data-ref="btn-nav-settings-purchases">
            <span class="material-symbols-rounded menu-item__icon">receipt_long</span>
            <span class="menu-item__text" data-i18n="nav.purchases"></span>
          </button>
        `;
        translateElement(navBottom);

        const btnBilling = navBottom.querySelector<HTMLElement>('[data-ref="btn-nav-settings-billing"]');
        const btnPurchases = navBottom.querySelector<HTMLElement>('[data-ref="btn-nav-settings-purchases"]');

        if (currentPath === '/settings/billing') {
          btnBilling?.classList.add('is-active');
        } else if (currentPath === '/settings/purchases') {
          btnPurchases?.classList.add('is-active');
        }

        bindNavLink(btnBilling, '/settings/billing');
        bindNavLink(btnPurchases, '/settings/purchases');
      }
    } else {
      if (sidebarBottom) {
        sidebarBottom.style.display = 'none';
      }

      if (navTop) {
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
        <button type="button" class="menu-item" data-ref="btn-nav-shared">
          <span class="material-symbols-rounded menu-item__icon">folder_shared</span>
          <span class="menu-item__text" data-i18n="nav.shared"></span>
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

      const btnShared = navTop.querySelector<HTMLElement>('[data-ref="btn-nav-shared"]');
      if (currentPath === '/shared') {
        btnShared?.classList.add('is-active');
      }
      bindNavLink(btnShared, '/shared');
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

      const actions = document.createElement('div');
      actions.className = 'chat-agent-actions';
      actions.setAttribute('data-ref', 'chat-agent-actions');

      const btnLike = document.createElement('button');
      btnLike.type = 'button';
      btnLike.className = 'btn btn--icon chat-feedback-btn chat-feedback-btn--like';
      btnLike.setAttribute('data-ref', 'btn-chat-like');
      btnLike.setAttribute('data-tooltip', 'Buena respuesta');
      btnLike.setAttribute('aria-label', 'Buena respuesta');
      btnLike.innerHTML = '<span class="material-symbols-rounded">thumb_up</span>';

      const btnDislike = document.createElement('button');
      btnDislike.type = 'button';
      btnDislike.className = 'btn btn--icon chat-feedback-btn chat-feedback-btn--dislike';
      btnDislike.setAttribute('data-ref', 'btn-chat-dislike');
      btnDislike.setAttribute('data-tooltip', 'Mala respuesta');
      btnDislike.setAttribute('aria-label', 'Mala respuesta');
      btnDislike.innerHTML = '<span class="material-symbols-rounded">thumb_down</span>';

      const btnCopy = document.createElement('button');
      btnCopy.type = 'button';
      btnCopy.className = 'btn btn--icon chat-feedback-btn chat-feedback-btn--copy';
      btnCopy.setAttribute('data-ref', 'btn-chat-copy');
      btnCopy.setAttribute('data-tooltip', 'Copiar respuesta');
      btnCopy.setAttribute('aria-label', 'Copiar respuesta');
      btnCopy.innerHTML = '<span class="material-symbols-rounded">content_copy</span>';

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

      renderIcons(actions);
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
    if (isProcessing) return;
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
