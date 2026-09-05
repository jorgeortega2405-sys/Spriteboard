import { loadTemplate } from '../services/template.js';
import {
  currentUser,
  linkedAccounts,
  escapeHtml,
  switchAccountApi,
  logoutApi,
  logoutAllApi,
} from '../services/api.js';
import { toggleSidebar, getIsSidebarOpen } from './sidebar.js';
import { toggleChatSidebar } from './chat-sidebar.js';
import { navigate, render } from '../router.js';
import { t } from '../services/i18n.js';
import { showToast } from '../services/toast.js';

export async function createTopBar() {
  const topbar = await loadTemplate('/views/components/topbar.html');

  const btnToggle = topbar.querySelector('[data-ref="btn-toggle-menu"]');
  btnToggle?.addEventListener('click', (e) => {
    e.preventDefault();
    toggleSidebar();
  });

  const btnHelpChat = topbar.querySelector('[data-ref="btn-help-chat"]');
  btnHelpChat?.addEventListener('click', (e) => {
    e.preventDefault();
    toggleChatSidebar();
  });

  const btnMobileSearch = topbar.querySelector('[data-ref="btn-mobile-search"]');
  const searchInput = topbar.querySelector('[data-ref="topbar-search-input"]');

  btnMobileSearch?.addEventListener('click', (e) => {
    e.preventDefault();
    const isActive = topbar.classList.toggle('layout-header--search-active');
    if (isActive) {
      setTimeout(() => searchInput?.focus(), 60);
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && topbar.classList.contains('layout-header--search-active')) {
      topbar.classList.remove('layout-header--search-active');
    }
  });

  const avatarContainer = topbar.querySelector('[data-ref="avatar-container"]');
  const btnLogin = topbar.querySelector('[data-ref="btn-login"]');

  if (currentUser) {
    if (avatarContainer) {
      avatarContainer.style.display = 'inline-flex';

      const avatarImg = avatarContainer.querySelector('[data-ref="avatar-img"]');
      const avatarBtn = avatarContainer.querySelector('[data-ref="btn-avatar"]');
      const avatarBackdrop = avatarContainer.querySelector('[data-ref="avatar-menu-backdrop"]');
      const avatarMenu = avatarContainer.querySelector('[data-ref="avatar-menu"]');
      const dragZone = avatarContainer.querySelector('[data-ref="avatar-menu-drag-zone"]');
      const btnLogout = avatarContainer.querySelector('[data-ref="btn-logout"]');

      // Paneles del menú desplegable
      const panelMain = avatarContainer.querySelector('[data-ref="panel-main-options"]');
      const panelSwitcher = avatarContainer.querySelector('[data-ref="panel-account-switcher"]');
      const btnSwitchAccountMenu = avatarContainer.querySelector('[data-ref="btn-switch-account-menu"]');
      const btnBackToMainMenu = avatarContainer.querySelector('[data-ref="btn-back-to-main-menu"]');
      const btnAddAccount = avatarContainer.querySelector('[data-ref="btn-add-account"]');
      const btnLogoutAll = avatarContainer.querySelector('[data-ref="btn-logout-all"]');
      const accountSwitcherList = avatarContainer.querySelector('[data-ref="account-switcher-list"]');

      // Datos de la cuenta activa en el panel principal
      const activeAvatar = avatarContainer.querySelector('[data-ref="active-account-avatar"]');
      const activeName = avatarContainer.querySelector('[data-ref="active-account-name"]');
      const activeEmail = avatarContainer.querySelector('[data-ref="active-account-email"]');

      const avatarUrl = currentUser.avatar_url || `/api/avatar?name=${encodeURIComponent(currentUser.username)}`;

      if (avatarImg) {
        avatarImg.src = avatarUrl;
        avatarImg.alt = escapeHtml(currentUser.username);
        avatarImg.onerror = () => {
          avatarImg.onerror = null;
          avatarImg.src = `/api/avatar?name=${encodeURIComponent(currentUser.username)}`;
        };
      }

      if (activeAvatar) {
        activeAvatar.src = avatarUrl;
        activeAvatar.alt = escapeHtml(currentUser.username);
        activeAvatar.onerror = () => {
          activeAvatar.onerror = null;
          activeAvatar.src = `/api/avatar?name=${encodeURIComponent(currentUser.username)}`;
        };
      }

      if (activeName) {
        activeName.textContent = currentUser.username;
      }

      if (activeEmail) {
        activeEmail.textContent = currentUser.email || '';
      }

      const showPanel = (panelName) => {
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

        const accounts = Array.isArray(linkedAccounts) && linkedAccounts.length > 0
          ? linkedAccounts
          : [currentUser];

        accounts.forEach((acc) => {
          const isActive = acc.id === currentUser.id;
          const item = document.createElement('button');
          item.type = 'button';
          item.className = `menu-item menu-item--bordered account-item ${isActive ? 'account-item--active' : ''}`;
          item.setAttribute('data-ref', `account-item-${acc.id}`);

          const accAvatarUrl = acc.avatar_url || `/api/avatar?name=${encodeURIComponent(acc.username)}`;

          item.innerHTML = `
            <div class="account-item__avatar" data-ref="account-avatar-${acc.id}">
              <img class="avatar-img" data-ref="avatar-img-${acc.id}" src="${accAvatarUrl}" alt="${escapeHtml(acc.username)}" referrerpolicy="no-referrer" />
            </div>
            <div class="account-item__info" data-ref="account-info-${acc.id}">
              <span class="account-item__name" data-ref="account-name-${acc.id}">${escapeHtml(acc.username)}</span>
              <span class="account-item__email" data-ref="account-email-${acc.id}">${escapeHtml(acc.email || '')}</span>
            </div>
            ${isActive ? '<span class="material-symbols-rounded account-item__check">check_circle</span>' : ''}
          `;

          const imgEl = item.querySelector('img');
          if (imgEl) {
            imgEl.onerror = () => {
              imgEl.onerror = null;
              imgEl.src = `/api/avatar?name=${encodeURIComponent(acc.username)}`;
            };
          }

          if (!isActive) {
            item.addEventListener('click', async (e) => {
              e.preventDefault();
              closeMenu();
              const res = await switchAccountApi(acc.id);
              if (res.success) {
                showToast(t('toasts.account_switched') || 'Has cambiado de cuenta exitosamente.', 'success');
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

          // Forzar reflujo de layout
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

      // Transición al panel conmutador de cuentas
      btnSwitchAccountMenu?.addEventListener('click', (e) => {
        e.preventDefault();
        showPanel('switcher');
      });

      // Retorno al panel principal
      btnBackToMainMenu?.addEventListener('click', (e) => {
        e.preventDefault();
        showPanel('main');
      });

      // Agregar otra cuenta (redirección a login)
      btnAddAccount?.addEventListener('click', (e) => {
        e.preventDefault();
        closeMenu();
        navigate('/login');
      });

      // Cerrar al hacer clic fuera del menu-panel (en el backdrop oscuro en móviles)
      avatarBackdrop?.addEventListener('click', (e) => {
        if (!avatarMenu?.contains(e.target)) {
          closeMenu();
        }
      });

      // Sistema robusto de Drag and Drop universal (Touch, Mouse, Pointer)
      let startY = 0;
      let currentY = 0;
      let isDragging = false;
      let activePointerId = null;

      const onPointerDown = (e) => {
        if (window.innerWidth > 768 || isClosing || !avatarMenu) return;
        if (e.pointerType === 'mouse' && e.button !== 0) return;

        isDragging = true;
        activePointerId = e.pointerId;
        startY = e.clientY;
        currentY = startY;

        try {
          dragZone?.setPointerCapture(activePointerId);
        } catch (_) {}

        // Desactivar transiciones para seguimiento 1:1 con el dedo sin latencia
        avatarMenu.style.transition = 'none';
      };

      const onPointerMove = (e) => {
        if (!isDragging || (activePointerId !== null && e.pointerId !== activePointerId)) return;
        currentY = e.clientY;
        const diff = currentY - startY;

        if (avatarMenu) {
          if (diff > 0) {
            avatarMenu.style.transform = `translateY(${diff}px)`;
          } else {
            avatarMenu.style.transform = `translateY(${diff * 0.15}px)`;
          }
        }
      };

      const onPointerUp = (e) => {
        if (!isDragging || (activePointerId !== null && e.pointerId !== activePointerId)) return;
        isDragging = false;

        try {
          if (activePointerId !== null) {
            dragZone?.releasePointerCapture(activePointerId);
          }
        } catch (_) {}
        activePointerId = null;

        const diff = currentY - startY;

        if (diff > 75) {
          closeMenu();
        } else {
          if (avatarMenu) {
            avatarMenu.style.transition = 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)';
            avatarMenu.style.transform = 'translateY(0)';
          }
        }
      };

      dragZone?.addEventListener('pointerdown', onPointerDown);
      window.addEventListener('pointermove', onPointerMove, { passive: true });
      window.addEventListener('pointerup', onPointerUp);
      window.addEventListener('pointercancel', onPointerUp);

      // Cerrar menú al hacer clic fuera del panel en cualquier dispositivo
      const closeMenuHandler = (e) => {
        if (!avatarMenu?.contains(e.target) && !avatarBtn?.contains(e.target)) {
          closeMenu();
        }
      };
      document.addEventListener('click', closeMenuHandler);

      const closeMenuKeydownHandler = (e) => {
        if (e.key === 'Escape' && avatarMenu?.classList.contains('is-open')) {
          closeMenu();
        }
      };
      document.addEventListener('keydown', closeMenuKeydownHandler);

      const cleanupAndRender = () => {
        document.removeEventListener('click', closeMenuHandler);
        document.removeEventListener('keydown', closeMenuKeydownHandler);
        render();
      };

      // Configuración
      const btnSettings = avatarContainer.querySelector('[data-ref="btn-menu-settings"]');
      btnSettings?.addEventListener('click', (e) => {
        e.preventDefault();
        closeMenu();
        navigate(currentUser ? '/settings/your-account' : '/settings/guest');
      });

      // Ayuda
      const btnHelp = avatarContainer.querySelector('[data-ref="btn-menu-help"]');
      btnHelp?.addEventListener('click', (e) => {
        e.preventDefault();
        closeMenu();
        toggleChatSidebar(true);
      });

      // Cerrar sesión de la cuenta activa (conmuta o desloguea)
      btnLogout?.addEventListener('click', async (e) => {
        e.preventDefault();
        closeMenu();
        const res = await logoutApi();
        if (res.success) {
          if (res.switched) {
            showToast(t('toasts.account_switched') || 'Has cambiado de cuenta.', 'info');
          }
          cleanupAndRender();
        }
      });

      // Cerrar todas las sesiones vinculadas
      btnLogoutAll?.addEventListener('click', async (e) => {
        e.preventDefault();
        closeMenu();
        await logoutAllApi();
        showToast(t('toasts.all_sessions_closed') || 'Se han cerrado todas las sesiones activas.', 'info');
        cleanupAndRender();
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
