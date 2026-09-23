import { joinCanvasRoom, leaveCanvasRoom, registerWebSocketHandler, sendCanvasAccessChanged, sendCanvasAction, sendCanvasCursor, sendCanvasFullUpdate } from '../../services/websocket.service.js';
import { PresentationProject, PresentationSlideItem } from '../../types/presentation.types.js';
import { getCollaboratorColor } from '../../utils/color.util.js';
import { BackgroundType, BoardCollaboratorState, BoardElement } from '../board/board.types.js';

export interface PresentationCollaborationCallbacks {
  onAccessChanged: (accessLevel: 'private' | 'public', publicRole?: 'editor' | 'viewer') => void;
  onAccessRevoked: () => void;
  onCollaboratorsChanged: () => void;
  onCursor: () => void;
  onRemoteAddElement: (element: BoardElement, slideId?: string) => void;
  onRemoteClear: (slideId?: string) => void;
  onRemoteDeleteElement: (elementId: string, slideId?: string) => void;
  onRemoteFullUpdate: (data: PresentationProject | { activePageId?: string; background?: { color: string; dotColor?: string; type: BackgroundType }; elements?: BoardElement[]; height?: number; pages?: PresentationSlideItem[]; width?: number }) => void;
  onRemoteReorderElements: (elements: BoardElement[], slideId?: string) => void;
  onRemoteSlideAdd: (slide: PresentationSlideItem, insertIndex?: number) => void;
  onRemoteSlideDelete: (slideId: string) => void;
  onRemoteSlideDuration: (slideId: string, duration: number) => void;
  onRemoteSlideReorder: (slideIds: string[]) => void;
  onRemoteUpdateBackground: (background: { color: string; dotColor?: string; type: BackgroundType }, slideId?: string) => void;
  onRemoteUpdateElement: (element: BoardElement, slideId?: string) => void;
  onRequestFullState: (targetConnId: string) => void;
}

export class PresentationCollaborationManager {
  public accessLevel: 'private' | 'public' = 'private';
  public activeSlideId = 'slide-1';
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
    callbacks: PresentationCollaborationCallbacks
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
      callbacks.onCollaboratorsChanged();
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

      if (action === 'presentation_cursor_slide_move' || action === 'board_cursor_page_move') {
        if (senderConnId && this.collaborators.has(senderConnId)) {
          const c = this.collaborators.get(senderConnId)!;
          c.activePageId = data.slideId || data.pageId;
          c.x = data.x;
          c.y = data.y;
          callbacks.onCursor();
        }
      } else if (action === 'presentation_change_slide' || action === 'board_change_page') {
        if (senderConnId && this.collaborators.has(senderConnId)) {
          const c = this.collaborators.get(senderConnId)!;
          c.activePageId = data.slideId || data.pageId;
          callbacks.onCollaboratorsChanged();
          callbacks.onCursor();
        }
      } else if ((action === 'presentation_slide_add' || action === 'board_page_add') && (data.slide || data.page)) {
        callbacks.onRemoteSlideAdd(data.slide || data.page, data.insertIndex);
      } else if ((action === 'presentation_slide_delete' || action === 'board_page_delete') && (data.slideId || data.pageId)) {
        callbacks.onRemoteSlideDelete(data.slideId || data.pageId);
      } else if ((action === 'presentation_slide_reorder' || action === 'board_page_reorder') && (Array.isArray(data.slideIds) || Array.isArray(data.pageIds))) {
        callbacks.onRemoteSlideReorder(data.slideIds || data.pageIds);
      } else if (action === 'presentation_slide_duration' && data.slideId && typeof data.duration === 'number') {
        callbacks.onRemoteSlideDuration(data.slideId, data.duration);
      } else if ((action === 'presentation_add_element' || action === 'board_add_element') && data.element) {
        callbacks.onRemoteAddElement(data.element, data.slideId || data.pageId);
      } else if ((action === 'presentation_update_element' || action === 'board_update_element') && data.element) {
        callbacks.onRemoteUpdateElement(data.element, data.slideId || data.pageId);
      } else if ((action === 'presentation_delete_element' || action === 'board_delete_element') && data.elementId) {
        callbacks.onRemoteDeleteElement(data.elementId, data.slideId || data.pageId);
      } else if (action === 'presentation_clear' || action === 'board_clear') {
        callbacks.onRemoteClear(data.slideId || data.pageId);
      } else if ((action === 'presentation_reorder_elements' || action === 'board_reorder_elements') && Array.isArray(data.elements)) {
        callbacks.onRemoteReorderElements(data.elements, data.slideId || data.pageId);
      } else if ((action === 'presentation_update_background' || action === 'board_update_background') && data.background) {
        callbacks.onRemoteUpdateBackground(data.background, data.slideId || data.pageId);
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

  public sendCursor(worldX: number, worldY: number, slideId?: string): void {
    const now = Date.now();
    if (now - this.lastSentCursorTime > 40) {
      this.lastSentCursorTime = now;
      sendCanvasCursor(this.canvasUuid, worldX, worldY);
      const targetSlideId = slideId || this.activeSlideId;
      if (targetSlideId) {
        sendCanvasAction(this.canvasUuid, 'presentation_cursor_slide_move', {
          slideId: targetSlideId,
          x: worldX,
          y: worldY,
        });
      }
    }
  }

  public broadcastSlideChange(slideId: string): void {
    this.activeSlideId = slideId;
    sendCanvasAction(this.canvasUuid, 'presentation_change_slide', { slideId });
  }

  public broadcastSlideAdd(slide: PresentationSlideItem, insertIndex?: number): void {
    if (this.role === 'viewer') return;
    sendCanvasAction(this.canvasUuid, 'presentation_slide_add', { insertIndex, slide });
  }

  public broadcastSlideDelete(slideId: string): void {
    if (this.role === 'viewer') return;
    sendCanvasAction(this.canvasUuid, 'presentation_slide_delete', { slideId });
  }

  public broadcastSlideReorder(slideIds: string[]): void {
    if (this.role === 'viewer') return;
    sendCanvasAction(this.canvasUuid, 'presentation_slide_reorder', { slideIds });
  }

  public broadcastSlideDuration(slideId: string, duration: number): void {
    if (this.role === 'viewer') return;
    sendCanvasAction(this.canvasUuid, 'presentation_slide_duration', { duration, slideId });
  }

  public broadcastAddElement(element: BoardElement, slideId?: string): void {
    if (this.role === 'viewer') return;
    sendCanvasAction(this.canvasUuid, 'presentation_add_element', { element, slideId: slideId || this.activeSlideId });
  }

  public broadcastUpdateElement(element: BoardElement, slideId?: string): void {
    if (this.role === 'viewer') return;
    sendCanvasAction(this.canvasUuid, 'presentation_update_element', { element, slideId: slideId || this.activeSlideId });
  }

  public broadcastDeleteElement(elementId: string, slideId?: string): void {
    if (this.role === 'viewer') return;
    sendCanvasAction(this.canvasUuid, 'presentation_delete_element', { elementId, slideId: slideId || this.activeSlideId });
  }

  public broadcastClear(slideId?: string): void {
    if (this.role === 'viewer') return;
    sendCanvasAction(this.canvasUuid, 'presentation_clear', { slideId: slideId || this.activeSlideId });
  }

  public broadcastReorderElements(elements: BoardElement[], slideId?: string): void {
    if (this.role === 'viewer') return;
    sendCanvasAction(this.canvasUuid, 'presentation_reorder_elements', { elements, slideId: slideId || this.activeSlideId });
  }

  public broadcastUpdateBackground(background: { color: string; dotColor?: string; type: BackgroundType }, slideId?: string): void {
    if (this.role === 'viewer') return;
    sendCanvasAction(this.canvasUuid, 'presentation_update_background', { background, slideId: slideId || this.activeSlideId });
  }

  public broadcastFullUpdate(data: PresentationProject | { activePageId?: string; background?: { color: string; dotColor?: string; type: BackgroundType }; elements?: BoardElement[]; height?: number; pages?: PresentationSlideItem[]; width?: number }, targetConnId?: string): void {
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
