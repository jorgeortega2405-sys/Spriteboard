import { navigate } from '../../app-router.js';
import { API_ROUTES } from '../../config/api-routes.js';
import { currentUser, deleteApi, escapeHtml, getApi, patchApi, postApi } from '../../services/api.service.js';
import { t } from '../../services/i18n.service.js';
import { renderIcons } from '../../services/icon.service.js';
import { showToast } from '../../services/toast.service.js';
import { closeAllDropdowns, registerActiveDropdown, unregisterActiveDropdown } from '../../utils/dom.util.js';

export function formatNotificationTime(iso?: string | null): string {
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

export function setupRailNotifications(sidebar: HTMLElement, getCloseAvatarMenu: () => (() => void)): {
  closeNotifications: () => void;
  loadNotifications: () => Promise<void>;
} {
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
    const closeAvatarMenu = getCloseAvatarMenu();
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

  return { closeNotifications, loadNotifications };
}
