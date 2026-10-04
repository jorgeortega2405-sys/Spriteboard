import { navigate } from '../../app-router.js';
import { getTierLimits, getUserTier } from '../../config/plans.config.js';
import { currentUser, escapeHtml, getApi } from '../../services/api.service.js';
import { t, translateElement } from '../../services/i18n.service.js';
import { renderIcons } from '../../services/icon.service.js';
import { showToast } from '../../services/toast.service.js';
import { toggleDrawer } from '../layout.component.js';
import { openUpgradeModal } from '../upgrade-modal.component.js';

export async function renderAiDrawerContent(drawer: HTMLElement, drawerBody: HTMLElement): Promise<void> {
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

  let sessionsCount = 0;
  const btnNewChat = drawerBody.querySelector<HTMLElement>('[data-ref="btn-nav-ai-new-chat"]');
  btnNewChat?.addEventListener('click', (e) => {
    e.preventDefault();
    if (window.innerWidth <= 768) {
      toggleDrawer(false);
    }
    const limits = getTierLimits(currentUser?.subscription_tier);
    if (currentUser && sessionsCount >= limits.maxAiStudioSessions) {
      showToast(`Has alcanzado el límite de ${limits.maxAiStudioSessions} conversaciones de tu plan.`, 'warning');
      const userTier = getUserTier(currentUser);
      openUpgradeModal(userTier === 'free' ? 'pro' : 'business');
      return;
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

  const chatsList = drawerBody.querySelector<HTMLElement>('[data-ref="drawer-ai-chats-list"]');
  const chatsEmpty = drawerBody.querySelector<HTMLElement>('[data-ref="drawer-ai-chats-empty"]');

  if (currentUser) {
    try {
      const res = await getApi('/api/ai/studio-sessions');
      if (res.ok) {
        const data = await res.json();
        const sessions: Array<{ title: string; updated_at: string; uuid: string }> = Array.isArray(data?.sessions) ? data.sessions : [];
        sessionsCount = sessions.length;
        const limits = getTierLimits(currentUser?.subscription_tier);
        const sectionTitleEl = drawerBody.querySelector<HTMLElement>('[data-ref="drawer-header-ai-chats"] .drawer-section__title');
        if (sectionTitleEl) {
          sectionTitleEl.textContent = `Conversaciones (${sessions.length}/${limits.maxAiStudioSessions})`;
        }
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
