import { joinCanvasRoom, leaveCanvasRoom, registerWebSocketHandler, sendCanvasAccessChanged, sendCanvasAction, sendCanvasCursor, sendCanvasElementLock, sendCanvasElementUnlock, sendCanvasFullUpdate } from '../../services/websocket.service.js';
import { getCollaboratorColor } from '../../utils/color.util.js';
import { BackgroundType, BoardCollaboratorState, BoardElement, BoardPageItem } from './board.types.js';

export interface LockedElementInfo {
  color: string;
  connId: string;
  lockedAt: number;
  userId: number;
  username: string;
}

export interface BoardCollaborationCallbacks {
  onAccessChanged: (accessLevel: 'private' | 'public', publicRole?: 'editor' | 'viewer') => void;
  onAccessRevoked: () => void;
  onCollaboratorsChanged: () => void;
  onCursor: () => void;
  onElementLocked?: (elementId: string, info: LockedElementInfo) => void;
  onElementUnlocked?: (elementId: string) => void;
  onRemoteAddElement: (element: BoardElement, pageId?: string) => void;
  onRemoteClear: (pageId?: string) => void;
  onRemoteDeleteElement: (elementId: string, pageId?: string) => void;
  onRemoteFullUpdate: (data: { activePageId?: string; background?: { color: string; dotColor?: string; type: BackgroundType }; elements?: BoardElement[]; pages?: BoardPageItem[] }) => void;
  onRemotePageAdd: (page: BoardPageItem, insertIndex?: number) => void;
  onRemotePageDelete: (pageId: string) => void;
  onRemotePageReorder: (pageIds: string[]) => void;
  onRemoteReorderElements: (elements: BoardElement[], pageId?: string) => void;
  onRemoteUpdateBackground: (background: { color: string; dotColor?: string; type: BackgroundType }, pageId?: string) => void;
  onRemoteUpdateElement: (element: BoardElement, pageId?: string) => void;
  onRequestFullState: (targetConnId: string) => void;
}

export class BoardCollaborationManager {
  public accessLevel: 'private' | 'public' = 'private';
  public activePageId = '';
  public canvasUuid: string;
  public collaborators: Map<string, BoardCollaboratorState> = new Map();
  public elementLocks: Map<string, LockedElementInfo> = new Map();
  public isOwner = true;
  public lastSentCursorTime = 0;
  public myCollaboratorColor = '#00E5FF';
  public publicRole: 'editor' | 'viewer' = 'editor';
  public role: 'editor' | 'owner' | 'viewer' = 'owner';
  public roomToken = '';
  private myUserId: number | null = null;
  private wsUnsubscribes: Array<() => void> = [];

  constructor(canvasUuid: string) {
    this.canvasUuid = canvasUuid;
  }

  public init(
    userId: number | null | undefined,
    username: string,
    avatarUrl: string | null | undefined,
    tier: BoardCollaboratorState['subscriptionTier'],
    callbacks: BoardCollaborationCallbacks
  ): void {
    this.cleanup();
    this.myUserId = userId || null;
    this.myCollaboratorColor = getCollaboratorColor(userId ? userId : Math.random().toString());

    joinCanvasRoom(this.canvasUuid, userId || undefined, username, this.myCollaboratorColor, this.roomToken, avatarUrl || undefined, tier);

    const unsubJoinError = registerWebSocketHandler('CANVAS_JOIN_ERROR', (payload: any) => {
      const roomUuid = typeof payload.canvasUuid === 'object' ? payload.canvasUuid?.canvasUuid : (payload.canvasUuid || payload.canvas_uuid);
      if (roomUuid !== this.canvasUuid) return;
      if (this.isOwner) return;
      callbacks.onAccessRevoked();
    });

    const unsubPresence = registerWebSocketHandler('ROOM_PRESENCE', (payload: any) => {
      const roomUuid = typeof payload.canvasUuid === 'object' ? payload.canvasUuid?.canvasUuid : (payload.canvasUuid || payload.canvas_uuid);
      if (roomUuid !== this.canvasUuid) return;
      if (payload.yourRole) {
        this.role = payload.yourRole;
      }
      this.collaborators.clear();
      if (Array.isArray(payload.users)) {
        for (const u of payload.users) {
          const uConnId = u.connId || u.conn_id;
          const uUserId = u.userId !== undefined ? u.userId : u.user_id;
          const uUsername = u.username || 'Invitado';
          const uColor = u.color || getCollaboratorColor(uUserId || uConnId);
          const uRole = (u.role || 'editor') as 'editor' | 'owner' | 'viewer';
          const uAvatar = u.avatarUrl || u.avatar_url || null;
          const uTier = (u.subscriptionTier || u.subscription_tier || 'free') as BoardCollaboratorState['subscriptionTier'];
          if (uUserId && uUserId === userId && uUsername === username) continue;
          this.collaborators.set(uConnId, {
            activePageId: u.activePageId || u.active_page_id,
            avatarUrl: uAvatar,
            color: uColor,
            connId: uConnId,
            role: uRole,
            subscriptionTier: uTier,
            userId: uUserId,
            username: uUsername,
          });
        }
      }
      this.elementLocks.clear();
      if (Array.isArray(payload.elementLocks)) {
        for (const l of payload.elementLocks) {
          if (!l.elementId) continue;
          this.elementLocks.set(l.elementId, {
            color: l.color || getCollaboratorColor(l.userId || l.connId),
            connId: l.connId || '',
            lockedAt: l.lockedAt || Date.now(),
            userId: l.userId || 0,
            username: l.username || 'Colaborador',
          });
        }
      }
      callbacks.onCollaboratorsChanged();
      callbacks.onCursor();
    });

    const unsubJoined = registerWebSocketHandler('USER_JOINED', (payload: any) => {
      const roomUuid = typeof payload.canvasUuid === 'object' ? payload.canvasUuid?.canvasUuid : (payload.canvasUuid || payload.canvas_uuid);
      if (roomUuid !== this.canvasUuid || !payload.user) return;
      const u = payload.user;
      const uConnId = u.connId || u.conn_id;
      const uUserId = u.userId !== undefined ? u.userId : u.user_id;
      const uUsername = u.username || 'Invitado';
      const uColor = u.color || getCollaboratorColor(uUserId || uConnId);
      const uRole = (u.role || 'editor') as 'editor' | 'owner' | 'viewer';
      const uAvatar = u.avatarUrl || u.avatar_url || null;
      const uTier = (u.subscriptionTier || u.subscription_tier || 'free') as BoardCollaboratorState['subscriptionTier'];
      if (uUserId && uUserId === userId && uUsername === username) return;
      this.collaborators.set(uConnId, {
        activePageId: u.activePageId || u.active_page_id,
        avatarUrl: uAvatar,
        color: uColor,
        connId: uConnId,
        role: uRole,
        subscriptionTier: uTier,
        userId: uUserId,
        username: uUsername,
      });
      callbacks.onCollaboratorsChanged();
      if (this.isOwner) {
        callbacks.onRequestFullState(uConnId);
      }
    });

    const unsubLeft = registerWebSocketHandler('USER_LEFT', (payload: any) => {
      const roomUuid = typeof payload.canvasUuid === 'object' ? payload.canvasUuid?.canvasUuid : (payload.canvasUuid || payload.canvas_uuid);
      const connId = payload.connId || payload.conn_id;
      if (roomUuid !== this.canvasUuid || !connId) return;
      this.collaborators.delete(connId);
      for (const [elId, lock] of this.elementLocks.entries()) {
        if (lock.connId === connId) {
          this.elementLocks.delete(elId);
          callbacks.onElementUnlocked?.(elId);
        }
      }
      callbacks.onCollaboratorsChanged();
      callbacks.onCursor();
    });

    const unsubLocked = registerWebSocketHandler('ELEMENT_LOCKED', (payload: any) => {
      const roomUuid = typeof payload.canvasUuid === 'object' ? payload.canvasUuid?.canvasUuid : (payload.canvasUuid || payload.canvas_uuid);
      if (roomUuid !== this.canvasUuid || !payload.elementId || !payload.user) return;
      const u = payload.user;
      const info: LockedElementInfo = {
        color: u.color || getCollaboratorColor(u.userId || u.connId),
        connId: u.connId || u.conn_id || '',
        lockedAt: u.lockedAt || Date.now(),
        userId: u.userId || 0,
        username: u.username || 'Colaborador',
      };
      this.elementLocks.set(payload.elementId, info);
      callbacks.onElementLocked?.(payload.elementId, info);
      callbacks.onCursor();
    });

    const unsubUnlocked = registerWebSocketHandler('ELEMENT_UNLOCKED', (payload: any) => {
      const roomUuid = typeof payload.canvasUuid === 'object' ? payload.canvasUuid?.canvasUuid : (payload.canvasUuid || payload.canvas_uuid);
      if (roomUuid !== this.canvasUuid || !payload.elementId) return;
      this.elementLocks.delete(payload.elementId);
      callbacks.onElementUnlocked?.(payload.elementId);
      callbacks.onCursor();
    });

    const unsubCursor = registerWebSocketHandler('CANVAS_CURSOR', (payload: any) => {
      const roomUuid = typeof payload.canvasUuid === 'object' ? payload.canvasUuid?.canvasUuid : (payload.canvasUuid || payload.canvas_uuid);
      const connId = payload.connId || payload.conn_id;
      if (!connId || (roomUuid && roomUuid !== this.canvasUuid)) return;
      let collab = this.collaborators.get(connId);
      if (!collab) {
        collab = {
          activePageId: payload.pageId || payload.activePageId,
          avatarUrl: payload.avatarUrl || payload.avatar_url || null,
          color: payload.color || getCollaboratorColor(payload.userId || connId),
          connId,
          role: (payload.role || 'editor') as 'editor' | 'owner' | 'viewer',
          subscriptionTier: (payload.subscriptionTier || payload.subscription_tier || 'free') as BoardCollaboratorState['subscriptionTier'],
          userId: payload.userId || 0,
          username: payload.username || 'Invitado',
        };
        this.collaborators.set(connId, collab);
        callbacks.onCollaboratorsChanged();
      }
      if (payload.pageId !== undefined) {
        collab.activePageId = payload.pageId;
      }
      collab.x = payload.x;
      collab.y = payload.y;
      callbacks.onCursor();
    });

    const unsubAction = registerWebSocketHandler('CANVAS_ACTION', (payload: any) => {
      const roomUuid = typeof payload.canvasUuid === 'object' ? payload.canvasUuid?.canvasUuid : (payload.canvasUuid || payload.canvas_uuid);
      if (roomUuid !== this.canvasUuid) return;
      const action = payload.action;
      const data = payload.payload || payload.params || {};
      const senderConnId = payload.senderConnId;

      if (action === 'board_cursor_page_move') {
        if (senderConnId && this.collaborators.has(senderConnId)) {
          const c = this.collaborators.get(senderConnId)!;
          c.activePageId = data.pageId;
          c.x = data.x;
          c.y = data.y;
          callbacks.onCursor();
        }
      } else if (action === 'board_change_page') {
        if (senderConnId && this.collaborators.has(senderConnId)) {
          const c = this.collaborators.get(senderConnId)!;
          c.activePageId = data.pageId;
          callbacks.onCollaboratorsChanged();
          callbacks.onCursor();
        }
      } else if (action === 'board_page_add' && data.page) {
        callbacks.onRemotePageAdd(data.page, data.insertIndex);
      } else if (action === 'board_page_delete' && data.pageId) {
        callbacks.onRemotePageDelete(data.pageId);
      } else if (action === 'board_page_reorder' && Array.isArray(data.pageIds)) {
        callbacks.onRemotePageReorder(data.pageIds);
      } else if (action === 'board_add_element' && data.element) {
        callbacks.onRemoteAddElement(data.element, data.pageId);
      } else if (action === 'board_update_element' && data.element) {
        callbacks.onRemoteUpdateElement(data.element, data.pageId);
      } else if (action === 'board_delete_element' && data.elementId) {
        callbacks.onRemoteDeleteElement(data.elementId, data.pageId);
      } else if (action === 'board_clear') {
        callbacks.onRemoteClear(data.pageId);
      } else if (action === 'board_reorder_elements' && Array.isArray(data.elements)) {
        callbacks.onRemoteReorderElements(data.elements, data.pageId);
      } else if (action === 'board_update_background' && data.background) {
        callbacks.onRemoteUpdateBackground(data.background, data.pageId);
      }
    });

    const unsubFullUpdate = registerWebSocketHandler('CANVAS_FULL_UPDATE', (payload: any) => {
      const roomUuid = typeof payload.canvasUuid === 'object' ? payload.canvasUuid?.canvasUuid : (payload.canvasUuid || payload.canvas_uuid);
      const projectData = payload.data || payload.project;
      if (roomUuid !== this.canvasUuid || !projectData) return;
      callbacks.onRemoteFullUpdate(projectData);
    });

    const unsubAccess = registerWebSocketHandler('CANVAS_ACCESS_CHANGED', (payload: any) => {
      const roomUuid = typeof payload.canvasUuid === 'object' ? payload.canvasUuid?.canvasUuid : (payload.canvasUuid || payload.canvas_uuid);
      if (roomUuid !== this.canvasUuid) return;
      const accessLevel = payload.accessLevel || payload.access_level || 'private';
      const publicRole = payload.publicRole || payload.public_role;
      this.accessLevel = accessLevel;
      if (publicRole) this.publicRole = publicRole;
      callbacks.onAccessChanged(accessLevel, publicRole);
    });

    const unsubRemoved = registerWebSocketHandler('CANVAS_MEMBER_REMOVED', (payload: any) => {
      const roomUuid = typeof payload.canvasUuid === 'object' ? payload.canvasUuid?.canvasUuid : (payload.canvasUuid || payload.canvas_uuid);
      if (roomUuid !== this.canvasUuid) return;
      const targetUserId = payload.targetUserId || payload.target_user_id;
      if (targetUserId && targetUserId === userId) {
        callbacks.onAccessRevoked();
      }
    });

    this.wsUnsubscribes = [
      unsubJoinError,
      unsubPresence,
      unsubJoined,
      unsubLeft,
      unsubLocked,
      unsubUnlocked,
      unsubCursor,
      unsubAction,
      unsubFullUpdate,
      unsubAccess,
      unsubRemoved,
    ];
  }

  public sendCursor(worldX: number, worldY: number): void {
    const now = Date.now();
    if (now - this.lastSentCursorTime > 40) {
      this.lastSentCursorTime = now;
      sendCanvasCursor(this.canvasUuid, worldX, worldY);
      if (this.activePageId) {
        sendCanvasAction(this.canvasUuid, 'board_cursor_page_move', {
          pageId: this.activePageId,
          x: worldX,
          y: worldY,
        });
      }
    }
  }

  public broadcastPageChange(pageId: string): void {
    this.activePageId = pageId;
    sendCanvasAction(this.canvasUuid, 'board_change_page', { pageId });
  }

  public broadcastPageAdd(page: BoardPageItem, insertIndex?: number): void {
    if (this.role === 'viewer') return;
    sendCanvasAction(this.canvasUuid, 'board_page_add', { insertIndex, page });
  }

  public broadcastPageDelete(pageId: string): void {
    if (this.role === 'viewer') return;
    sendCanvasAction(this.canvasUuid, 'board_page_delete', { pageId });
  }

  public broadcastPageReorder(pageIds: string[]): void {
    if (this.role === 'viewer') return;
    sendCanvasAction(this.canvasUuid, 'board_page_reorder', { pageIds });
  }

  public broadcastAddElement(element: BoardElement, pageId?: string): void {
    if (this.role === 'viewer') return;
    sendCanvasAction(this.canvasUuid, 'board_add_element', { element, pageId: pageId || this.activePageId });
  }

  public broadcastUpdateElement(element: BoardElement, pageId?: string): void {
    if (this.role === 'viewer') return;
    sendCanvasAction(this.canvasUuid, 'board_update_element', { element, pageId: pageId || this.activePageId });
  }

  public broadcastDeleteElement(elementId: string, pageId?: string): void {
    if (this.role === 'viewer') return;
    sendCanvasAction(this.canvasUuid, 'board_delete_element', { elementId, pageId: pageId || this.activePageId });
  }

  public broadcastClear(pageId?: string): void {
    if (this.role === 'viewer') return;
    sendCanvasAction(this.canvasUuid, 'board_clear', { pageId: pageId || this.activePageId });
  }

  public broadcastReorderElements(elements: BoardElement[], pageId?: string): void {
    if (this.role === 'viewer') return;
    sendCanvasAction(this.canvasUuid, 'board_reorder_elements', { elements, pageId: pageId || this.activePageId });
  }

  public broadcastUpdateBackground(background: { color: string; dotColor?: string; type: BackgroundType }, pageId?: string): void {
    if (this.role === 'viewer') return;
    sendCanvasAction(this.canvasUuid, 'board_update_background', { background, pageId: pageId || this.activePageId });
  }

  public broadcastFullUpdate(data: { activePageId?: string; background?: { color: string; dotColor?: string; type: BackgroundType }; elements?: BoardElement[]; pages?: BoardPageItem[] }, targetConnId?: string): void {
    sendCanvasFullUpdate(this.canvasUuid, data, targetConnId);
  }

  public broadcastAccessChanged(accessLevel: 'private' | 'public', publicRole?: 'editor' | 'viewer'): void {
    sendCanvasAccessChanged(this.canvasUuid, accessLevel, publicRole);
  }

  public lockElement(elementId: string): void {
    if (this.role === 'viewer') return;
    sendCanvasElementLock(this.canvasUuid, elementId);
  }

  public unlockElement(elementId: string): void {
    sendCanvasElementUnlock(this.canvasUuid, elementId);
  }

  public isElementLockedByOther(elementId: string): boolean {
    const lock = this.elementLocks.get(elementId);
    if (!lock) return false;
    if (this.myUserId && lock.userId === this.myUserId) return false;
    return true;
  }

  public getLockOwner(elementId: string): LockedElementInfo | null {
    return this.elementLocks.get(elementId) || null;
  }

  public cleanup(): void {
    for (const unsub of this.wsUnsubscribes) {
      unsub();
    }
    this.wsUnsubscribes = [];
    this.collaborators.clear();
    this.elementLocks.clear();
  }

  public destroy(): void {
    this.cleanup();
    leaveCanvasRoom(this.canvasUuid);
  }
}
