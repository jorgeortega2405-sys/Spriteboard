import { joinCanvasRoom, leaveCanvasRoom, registerWebSocketHandler, sendCanvasAccessChanged, sendCanvasAction, sendCanvasBinaryStroke, sendCanvasCursor, sendCanvasDrawStroke, sendCanvasFullUpdate } from '../../services/websocket.service.js';
import { getCollaboratorColor } from './design-color.util.js';
import { CollaboratorState, SubscriptionTierType } from './design.types.js';

export interface CollaborationCallbacks {
  onAccessChanged: (accessLevel: 'private' | 'public', publicRole?: 'viewer' | 'editor') => void;
  onAccessRevoked: () => void;
  onAction: (payload: any) => void;
  onCollaboratorsChanged: () => void;
  onCursor: () => void;
  onFullUpdate: (projectData: any) => void;
  onMemberRemoved: (targetUserId: number) => void;
  onPresence: () => void;
  onStroke: (payload: any) => void;
}

export class DesignCollaborationManager {
  public accessLevel: 'private' | 'public' = 'private';
  public canvasUuid: string;
  public collaborators: Map<string, CollaboratorState> = new Map();
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
    tier: SubscriptionTierType,
    callbacks: CollaborationCallbacks
  ): void {
    this.cleanup();
    this.myCollaboratorColor = getCollaboratorColor(userId ? userId : Math.random().toString());

    joinCanvasRoom(this.canvasUuid, userId || undefined, username, this.myCollaboratorColor, this.roomToken, avatarUrl || undefined, tier);

    const unsubJoinError = registerWebSocketHandler('CANVAS_JOIN_ERROR', (payload: any) => {
      const roomUuid = payload.canvasUuid || payload.canvas_uuid;
      if (roomUuid !== this.canvasUuid) return;
      callbacks.onAccessRevoked();
    });

    const unsubPresence = registerWebSocketHandler('ROOM_PRESENCE', (payload: any) => {
      const roomUuid = payload.canvasUuid || payload.canvas_uuid;
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
          const uRole = u.role || 'editor';
          const uAvatar = u.avatarUrl || u.avatar_url || null;
          const uTier = (u.subscriptionTier || u.subscription_tier || 'free') as SubscriptionTierType;
          if (uUserId && uUserId === userId && uUsername === username) continue;
          this.collaborators.set(uConnId, {
            avatarUrl: uAvatar,
            color: uColor,
            connId: uConnId,
            hideCursor: false,
            role: uRole,
            subscriptionTier: uTier,
            userId: uUserId,
            username: uUsername,
          });
        }
      }
      callbacks.onPresence();
    });

    const unsubJoined = registerWebSocketHandler('USER_JOINED', (payload: any) => {
      const roomUuid = payload.canvasUuid || payload.canvas_uuid;
      if (roomUuid !== this.canvasUuid || !payload.user) return;
      const u = payload.user;
      const uConnId = u.connId || u.conn_id;
      const uUserId = u.userId !== undefined ? u.userId : u.user_id;
      const uUsername = u.username || 'Invitado';
      const uColor = u.color || getCollaboratorColor(uUserId || uConnId);
      const uRole = u.role || 'editor';
      const uAvatar = u.avatarUrl || u.avatar_url || null;
      const uTier = (u.subscriptionTier || u.subscription_tier || 'free') as SubscriptionTierType;
      if (uUserId && uUserId === userId && uUsername === username) return;
      this.collaborators.set(uConnId, {
        avatarUrl: uAvatar,
        color: uColor,
        connId: uConnId,
        hideCursor: false,
        role: uRole,
        subscriptionTier: uTier,
        userId: uUserId,
        username: uUsername,
      });
      callbacks.onCollaboratorsChanged();
    });

    const unsubLeft = registerWebSocketHandler('USER_LEFT', (payload: any) => {
      const roomUuid = payload.canvasUuid || payload.canvas_uuid;
      const connId = payload.connId || payload.conn_id;
      if (roomUuid !== this.canvasUuid || !connId) return;
      this.collaborators.delete(connId);
      callbacks.onCollaboratorsChanged();
    });

    const unsubCursor = registerWebSocketHandler('CANVAS_CURSOR', (payload: any) => {
      const roomUuid = payload.canvasUuid || payload.canvas_uuid;
      const connId = payload.connId || payload.conn_id;
      if (!connId || (roomUuid && roomUuid !== this.canvasUuid)) return;
      let collab = this.collaborators.get(connId);
      if (!collab) {
        collab = {
          avatarUrl: payload.avatarUrl || payload.avatar_url || null,
          color: payload.color || getCollaboratorColor(payload.userId || connId),
          connId,
          hideCursor: false,
          role: payload.role || 'editor',
          subscriptionTier: payload.subscriptionTier || payload.subscription_tier || 'free',
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

    const unsubStroke = registerWebSocketHandler('CANVAS_DRAW_STROKE', (payload: any) => {
      const roomUuid = payload.canvasUuid || payload.canvas_uuid;
      if (roomUuid && roomUuid !== this.canvasUuid) return;
      callbacks.onStroke(payload);
    });

    const unsubAction = registerWebSocketHandler('CANVAS_ACTION', (payload: any) => {
      const roomUuid = payload.canvasUuid || payload.canvas_uuid;
      if (roomUuid !== this.canvasUuid) return;
      callbacks.onAction(payload);
    });

    const unsubFullUpdate = registerWebSocketHandler('CANVAS_FULL_UPDATE', (payload: any) => {
      const roomUuid = payload.canvasUuid || payload.canvas_uuid;
      const projectData = payload.data || payload.project;
      if (roomUuid !== this.canvasUuid || !projectData) return;
      callbacks.onFullUpdate(projectData);
    });

    const unsubAccess = registerWebSocketHandler('CANVAS_ACCESS_CHANGED', (payload: any) => {
      const roomUuid = payload.canvasUuid || payload.canvas_uuid;
      if (roomUuid !== this.canvasUuid) return;
      this.accessLevel = payload.accessLevel || payload.access_level || 'private';
      if (payload.publicRole) {
        this.publicRole = payload.publicRole;
      }
      callbacks.onAccessChanged(this.accessLevel, this.publicRole);
    });

    const unsubMemberRemoved = registerWebSocketHandler('CANVAS_MEMBER_REMOVED', (payload: any) => {
      const roomUuid = payload.canvasUuid || payload.canvas_uuid;
      if (roomUuid !== this.canvasUuid) return;
      const targetUserId = Number(payload.targetUserId || payload.target_user_id);
      callbacks.onMemberRemoved(targetUserId);
    });

    this.wsUnsubscribes.push(
      unsubPresence,
      unsubJoined,
      unsubLeft,
      unsubCursor,
      unsubStroke,
      unsubAction,
      unsubFullUpdate,
      unsubAccess,
      unsubMemberRemoved,
      unsubJoinError
    );
  }

  public sendCursor(x: number, y: number): void {
    const now = performance.now();
    if (now - this.lastSentCursorTime >= 35) {
      this.lastSentCursorTime = now;
      sendCanvasCursor(this.canvasUuid, x, y);
    }
  }

  public sendBinaryStroke(tool: string, color: string, size: number, points: Array<{ x: number; y: number }>): void {
    sendCanvasBinaryStroke(this.canvasUuid, tool, color, size, points);
  }

  public sendDrawStroke(
    tool: string,
    color: string,
    size: number,
    points: Array<{ x: number; y: number }>,
    extra: Record<string, any>
  ): void {
    sendCanvasDrawStroke(this.canvasUuid, tool, color, size, points, extra);
  }

  public sendAction(action: string, payload: any): void {
    sendCanvasAction(this.canvasUuid, action, payload);
  }

  public sendAccessChanged(level: 'private' | 'public', role: 'editor' | 'viewer'): void {
    sendCanvasAccessChanged(this.canvasUuid, level, role);
  }

  public sendFullUpdate(project: any, targetConnId?: string): void {
    sendCanvasFullUpdate(this.canvasUuid, project, targetConnId);
  }

  public cleanup(): void {
    for (const unsub of this.wsUnsubscribes) {
      unsub();
    }
    this.wsUnsubscribes = [];
    this.collaborators.clear();
    leaveCanvasRoom(this.canvasUuid);
  }
}
