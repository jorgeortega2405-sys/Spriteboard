import { joinCanvasRoom, leaveCanvasRoom, registerWebSocketHandler, sendCanvasAccessChanged, sendCanvasAction, sendCanvasCursor, sendCanvasFullUpdate } from '../../services/websocket.service.js';
import { getCollaboratorColor } from '../design/design-color.util.js';
import { BackgroundType, BoardCollaboratorState, BoardElement } from './board.types.js';

export interface BoardCollaborationCallbacks {
  onAccessChanged: (accessLevel: 'private' | 'public', publicRole?: 'editor' | 'viewer') => void;
  onAccessRevoked: () => void;
  onCollaboratorsChanged: () => void;
  onCursor: () => void;
  onRemoteAddElement: (element: BoardElement) => void;
  onRemoteClear: () => void;
  onRemoteDeleteElement: (elementId: string) => void;
  onRemoteFullUpdate: (data: { background?: { color: string; dotColor?: string; type: BackgroundType }; elements?: BoardElement[] }) => void;
  onRemoteReorderElements: (elements: BoardElement[]) => void;
  onRemoteUpdateBackground: (background: { color: string; dotColor?: string; type: BackgroundType }) => void;
  onRemoteUpdateElement: (element: BoardElement) => void;
  onRequestFullState: (targetConnId: string) => void;
}

export class BoardCollaborationManager {
  public accessLevel: 'private' | 'public' = 'private';
  public canvasUuid: string;
  public collaborators: Map<string, BoardCollaboratorState> = new Map();
  public isOwner = true;
  public lastSentCursorTime = 0;
  public myCollaboratorColor = '#00E5FF';
  public publicRole: 'editor' | 'viewer' = 'editor';
  public role: 'editor' | 'owner' | 'viewer' = 'owner';
  public roomToken = '';
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
      callbacks.onCollaboratorsChanged();
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
      callbacks.onCollaboratorsChanged();
    });

    const unsubCursor = registerWebSocketHandler('CANVAS_CURSOR', (payload: any) => {
      const roomUuid = typeof payload.canvasUuid === 'object' ? payload.canvasUuid?.canvasUuid : (payload.canvasUuid || payload.canvas_uuid);
      const connId = payload.connId || payload.conn_id;
      if (!connId || (roomUuid && roomUuid !== this.canvasUuid)) return;
      let collab = this.collaborators.get(connId);
      if (!collab) {
        collab = {
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
      collab.x = payload.x;
      collab.y = payload.y;
      callbacks.onCursor();
    });

    const unsubAction = registerWebSocketHandler('CANVAS_ACTION', (payload: any) => {
      const roomUuid = typeof payload.canvasUuid === 'object' ? payload.canvasUuid?.canvasUuid : (payload.canvasUuid || payload.canvas_uuid);
      if (roomUuid !== this.canvasUuid) return;
      const action = payload.action;
      const data = payload.payload || payload.params || {};
      if (action === 'board_add_element' && data.element) {
        callbacks.onRemoteAddElement(data.element);
      } else if (action === 'board_update_element' && data.element) {
        callbacks.onRemoteUpdateElement(data.element);
      } else if (action === 'board_delete_element' && data.elementId) {
        callbacks.onRemoteDeleteElement(data.elementId);
      } else if (action === 'board_clear') {
        callbacks.onRemoteClear();
      } else if (action === 'board_reorder_elements' && Array.isArray(data.elements)) {
        callbacks.onRemoteReorderElements(data.elements);
      } else if (action === 'board_update_background' && data.background) {
        callbacks.onRemoteUpdateBackground(data.background);
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
    }
  }

  public broadcastAddElement(element: BoardElement): void {
    if (this.role === 'viewer') return;
    sendCanvasAction(this.canvasUuid, 'board_add_element', { element });
  }

  public broadcastUpdateElement(element: BoardElement): void {
    if (this.role === 'viewer') return;
    sendCanvasAction(this.canvasUuid, 'board_update_element', { element });
  }

  public broadcastDeleteElement(elementId: string): void {
    if (this.role === 'viewer') return;
    sendCanvasAction(this.canvasUuid, 'board_delete_element', { elementId });
  }

  public broadcastClear(): void {
    if (this.role === 'viewer') return;
    sendCanvasAction(this.canvasUuid, 'board_clear', {});
  }

  public broadcastReorderElements(elements: BoardElement[]): void {
    if (this.role === 'viewer') return;
    sendCanvasAction(this.canvasUuid, 'board_reorder_elements', { elements });
  }

  public broadcastUpdateBackground(background: { color: string; dotColor?: string; type: BackgroundType }): void {
    if (this.role === 'viewer') return;
    sendCanvasAction(this.canvasUuid, 'board_update_background', { background });
  }

  public broadcastFullUpdate(data: { background?: { color: string; dotColor?: string; type: BackgroundType }; elements: BoardElement[] }, targetConnId?: string): void {
    sendCanvasFullUpdate(this.canvasUuid, data, targetConnId);
  }

  public broadcastAccessChanged(accessLevel: 'private' | 'public', publicRole?: 'editor' | 'viewer'): void {
    sendCanvasAccessChanged(this.canvasUuid, accessLevel, publicRole);
  }

  public cleanup(): void {
    for (const unsub of this.wsUnsubscribes) {
      unsub();
    }
    this.wsUnsubscribes = [];
    this.collaborators.clear();
  }

  public destroy(): void {
    this.cleanup();
    leaveCanvasRoom(this.canvasUuid);
  }
}
