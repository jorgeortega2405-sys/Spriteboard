import { API_ROUTES } from '../../config/api-routes.js';
import { currentUser } from '../../services/api.service.js';
import { showToast } from '../../services/toast.service.js';
import { getCollaboratorColor } from '../../utils/color.util.js';
import { getGuestIdentity } from '../../utils/guest.util.js';
import { applyAvatarTier } from '../../utils/tier.util.js';
import { DocCollaborationManager, DocCollaboratorState } from './doc-collaboration.manager.js';
import { DocProject } from './doc.types.js';

export interface DocCollaborationUiOptions {
  accessLevel: 'private' | 'public';
  collaborationManager: DocCollaborationManager;
  collaboratorsBarEl: HTMLElement | null;
  collaboratorsListEl: HTMLElement | null;
  container: HTMLElement;
  isOwner: boolean;
  onAccessChanged: (accessLevel: 'private' | 'public', publicRole?: 'editor' | 'viewer') => void;
  onRemoteDocUpdate: (remoteProject: DocProject) => void;
  onSyncPages: () => void;
  ownerInfo: { avatarUrl: string | null; id: number | null; subscriptionTier: string; username: string } | null;
  project: DocProject;
  publicRole: 'editor' | 'viewer';
  role: 'editor' | 'owner' | 'viewer';
  roomToken: string;
}

export function renderDocCollaboratorCursors(
  pagesContainer: HTMLElement | null,
  collaborationManager: DocCollaborationManager
): void {
  if (!pagesContainer) return;

  let overlay = pagesContainer.querySelector<HTMLElement>('[data-ref="doc-cursor-overlay"]');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.className = 'doc-cursor-overlay';
    overlay.setAttribute('data-ref', 'doc-cursor-overlay');
    overlay.style.position = 'absolute';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    overlay.style.pointerEvents = 'none';
    overlay.style.zIndex = '50';
    pagesContainer.style.position = 'relative';
    pagesContainer.appendChild(overlay);
  }

  const activeConns = new Set<string>();
  collaborationManager.collaborators.forEach((collab, connId) => {
    if (collab.x === undefined || collab.y === undefined) return;
    activeConns.add(connId);

    let cursorEl = overlay!.querySelector<HTMLElement>(`[data-ref="doc-cursor-${connId}"]`);
    if (!cursorEl) {
      cursorEl = document.createElement('div');
      cursorEl.className = 'doc-collaborator-cursor';
      cursorEl.setAttribute('data-ref', `doc-cursor-${connId}`);
      cursorEl.style.position = 'absolute';
      cursorEl.style.pointerEvents = 'none';
      cursorEl.style.transition = 'left 0.05s ease-out, top 0.05s ease-out';
      cursorEl.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 16 16" fill="${collab.color}" style="display:block; filter: drop-shadow(0 1px 2px rgba(0,0,0,0.3));">
          <path d="M0 0 L0 14 L4 10 L8 14 L10 12 L6 8 L11 8 Z" stroke="#ffffff" stroke-width="1"/>
        </svg>
        <span style="display:inline-block; background-color:${collab.color}; color:#ffffff; font-size:11px; font-weight:600; padding:2px 6px; border-radius:4px; margin-left:10px; margin-top:-6px; white-space:nowrap; box-shadow:0 1px 3px rgba(0,0,0,0.2);">
          ${collab.username || 'Invitado'}
        </span>
      `;
      overlay!.appendChild(cursorEl);
    }

    cursorEl.style.left = `${collab.x}px`;
    cursorEl.style.top = `${collab.y}px`;
  });

  overlay.querySelectorAll('.doc-collaborator-cursor').forEach((el) => {
    const ref = el.getAttribute('data-ref') || '';
    const connId = ref.replace('doc-cursor-', '');
    if (!activeConns.has(connId)) {
      el.remove();
    }
  });
}

export function renderDocCollaboratorsBar(
  collaboratorsBarEl: HTMLElement | null,
  collaboratorsListEl: HTMLElement | null,
  isOwner: boolean,
  ownerInfo: { avatarUrl: string | null; id: number | null; subscriptionTier: string; username: string } | null,
  collaborationManager: DocCollaborationManager,
  publicRole: 'editor' | 'viewer'
): void {
  if (!collaboratorsBarEl || !collaboratorsListEl) return;
  collaboratorsBarEl.classList.remove('is-hidden');
  collaboratorsListEl.innerHTML = '';

  const stackItems: Array<{
    avatarUrl: string;
    isOwner: boolean;
    tier: string;
    tierColor?: string;
    tooltip: string;
    username: string;
  }> = [];

  const isCurrentUserOwner = Boolean(isOwner && currentUser);
  const ownerData = isCurrentUserOwner
    ? {
        avatarUrl: currentUser?.avatar_url || ownerInfo?.avatarUrl || null,
        id: currentUser?.id ?? null,
        subscriptionTier: currentUser?.subscription_tier || ownerInfo?.subscriptionTier || 'free',
        subscriptionTierColor: currentUser?.subscription_tier_color,
        username: currentUser?.username || ownerInfo?.username || 'Propietario',
      }
    : ownerInfo
    ? {
        avatarUrl: ownerInfo.avatarUrl || null,
        id: ownerInfo.id || null,
        subscriptionTier: ownerInfo.subscriptionTier || 'free',
        subscriptionTierColor: undefined,
        username: ownerInfo.username || 'Propietario',
      }
    : {
        avatarUrl: null,
        id: null,
        subscriptionTier: 'free',
        subscriptionTierColor: undefined,
        username: 'Propietario',
      };

  const isOwnerOnline = isOwner || Array.from(collaborationManager.collaborators.values()).some(
    (c) => (c.userId && ownerData.id && c.userId === ownerData.id) || (c.username && c.username === ownerData.username)
  );

  const ownerAvatar = ownerData.avatarUrl || API_ROUTES.avatar(ownerData.username);
  const ownerTier = ownerData.subscriptionTier || 'free';
  const ownerStatusText = isOwnerOnline ? ' • En línea' : '';
  const ownerRoleText = isOwner ? ' (Dueño • Tú)' : ` (Dueño${ownerStatusText})`;

  stackItems.push({
    avatarUrl: ownerAvatar,
    isOwner: true,
    tier: ownerTier,
    tierColor: ownerData.subscriptionTierColor,
    tooltip: `${ownerData.username}${ownerRoleText}`,
    username: ownerData.username,
  });

  if (!isOwner && currentUser) {
    const myAvatar = currentUser.avatar_url || API_ROUTES.avatar(currentUser.username);
    const myTier = currentUser.subscription_tier || 'free';
    const myRole = publicRole === 'viewer' ? 'Lector' : 'Editor';
    stackItems.push({
      avatarUrl: myAvatar,
      isOwner: false,
      tier: myTier,
      tierColor: currentUser.subscription_tier_color,
      tooltip: `${currentUser.username} (${myRole} • En línea • Tú)`,
      username: currentUser.username,
    });
  }

  const seenUserIds = new Set<number>();
  if (currentUser?.id) seenUserIds.add(currentUser.id);
  if (ownerData.id) seenUserIds.add(ownerData.id);

  collaborationManager.collaborators.forEach((collab) => {
    if (collab.userId && seenUserIds.has(collab.userId)) return;
    if (collab.userId) seenUserIds.add(collab.userId);

    const avatar = collab.avatarUrl || API_ROUTES.avatar(collab.username);
    const roleText = collab.role === 'owner' ? 'Dueño' : collab.role === 'viewer' ? 'Lector' : 'Editor';
    stackItems.push({
      avatarUrl: avatar,
      isOwner: collab.role === 'owner',
      tier: collab.subscriptionTier || 'free',
      tierColor: undefined,
      tooltip: `${collab.username} (${roleText} • En línea)`,
      username: collab.username,
    });
  });

  for (const item of stackItems) {
    const avatarBtn = document.createElement('div');
    avatarBtn.className = 'design-collaborator-avatar';
    avatarBtn.setAttribute('data-tooltip', item.tooltip);
    avatarBtn.setAttribute('aria-label', item.tooltip);
    applyAvatarTier(avatarBtn, item.tier, item.tierColor);

    const img = document.createElement('img');
    img.src = item.avatarUrl;
    img.alt = item.username;
    img.className = 'avatar-preview-img';
    img.referrerPolicy = 'no-referrer';
    img.onerror = () => {
      img.remove();
      const fallback = document.createElement('div');
      fallback.className = 'design-collaborator-avatar__fallback';
      fallback.style.backgroundColor = getCollaboratorColor(item.username);
      fallback.textContent = (item.username[0] || '?').toUpperCase();
      avatarBtn.appendChild(fallback);
    };

    avatarBtn.appendChild(img);
    collaboratorsListEl.appendChild(avatarBtn);
  }
}

export function setupDocCollaboration(options: DocCollaborationUiOptions): void {
  const {
    accessLevel,
    collaborationManager,
    collaboratorsBarEl,
    collaboratorsListEl,
    container,
    isOwner,
    onAccessChanged,
    onRemoteDocUpdate,
    onSyncPages,
    ownerInfo,
    project,
    publicRole,
    role,
    roomToken,
  } = options;

  const guest = !currentUser ? getGuestIdentity() : null;
  const userId = currentUser ? currentUser.id : guest?.id;
  const username = currentUser ? currentUser.username : (guest?.username || 'Invitado');
  const avatarUrl = currentUser?.avatar_url || guest?.avatarUrl || null;
  const tier = (currentUser?.subscription_tier || 'free') as DocCollaboratorState['subscriptionTier'];

  collaborationManager.isOwner = isOwner;
  collaborationManager.accessLevel = accessLevel;
  collaborationManager.publicRole = publicRole;
  collaborationManager.role = role;
  collaborationManager.roomToken = roomToken;

  const pagesContainer = container.querySelector<HTMLElement>('[data-ref="doc-pages-container"]');

  collaborationManager.init(userId, username, avatarUrl, tier, {
    onAccessChanged: (newAccessLevel, newPublicRole) => {
      onAccessChanged(newAccessLevel, newPublicRole);
    },
    onAccessRevoked: () => {
      showToast('El acceso a este documento ha sido revocado', 'warning');
    },
    onCollaboratorsChanged: () => {
      renderDocCollaboratorsBar(collaboratorsBarEl, collaboratorsListEl, isOwner, ownerInfo, collaborationManager, publicRole);
      renderDocCollaboratorCursors(pagesContainer, collaborationManager);
    },
    onCursor: () => {
      renderDocCollaboratorCursors(pagesContainer, collaborationManager);
    },
    onRemoteDocUpdate: (remoteProject) => {
      onRemoteDocUpdate(remoteProject);
    },
    onRemoteFullUpdate: (remoteProject) => {
      onRemoteDocUpdate(remoteProject);
    },
    onRequestFullState: (targetConnId) => {
      onSyncPages();
      collaborationManager.broadcastFullState(project, targetConnId);
    },
  });

  renderDocCollaboratorsBar(collaboratorsBarEl, collaboratorsListEl, isOwner, ownerInfo, collaborationManager, publicRole);
}
