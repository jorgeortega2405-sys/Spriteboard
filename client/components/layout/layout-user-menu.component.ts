import { navigate, render } from '../../app-router.js';
import { API_ROUTES } from '../../config/api-routes.js';
import { hasFeature } from '../../config/plans.config.js';
import { currentUser, escapeHtml, linkedAccounts, logoutAllApi, logoutApi, switchAccountApi } from '../../services/api.service.js';
import { t } from '../../services/i18n.service.js';
import { createIconSvg, renderIcons } from '../../services/icon.service.js';
import { showToast } from '../../services/toast.service.js';
import { closeWebSocket, initWebSocket } from '../../services/websocket.service.js';
import { canAccessAdmin } from '../../types/auth.types.js';
import { closeAllDropdowns, registerActiveDropdown, unregisterActiveDropdown } from '../../utils/dom.util.js';
import { applyAvatarTier, getFallbackTierColor } from '../../utils/tier.util.js';
import { openUpgradeModal } from '../upgrade-modal.component.js';

export function setupUserMenu(sidebar: HTMLElement, closeNotifications: () => void): () => void {
  const avatarContainer = sidebar.querySelector<HTMLElement>('[data-ref="avatar-container"]');
  const btnLogin = sidebar.querySelector<HTMLElement>('[data-ref="btn-rail-login"], [data-ref="btn-login"]');
  const btnSettings = sidebar.querySelector<HTMLElement>('[data-ref="btn-rail-settings"]');

  let closeAvatarMenu = () => {};

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

      const btnSettingsMenu = avatarContainer.querySelector<HTMLElement>('[data-ref="btn-menu-settings"]');
      btnSettingsMenu?.addEventListener('click', (e) => {
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

  return closeAvatarMenu;
}
