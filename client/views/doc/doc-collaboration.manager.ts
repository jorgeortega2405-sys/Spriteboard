import { joinCanvasRoom, leaveCanvasRoom, registerWebSocketHandler, sendCanvasAccessChanged, sendCanvasAction, sendCanvasFullUpdate } from '../../services/websocket.service.js';
import { getCollaboratorColor } from '../../utils/color.util.js';
import { DocProject } from './doc.types.js';

export interface DocCollaboratorState {
  avatarUrl: string | null;
  color: string;
  connId: string;
  role: 'editor' | 'owner' | 'viewer';
  subscriptionTier: 'business' | 'enterprise' | 'free' | 'pro';
  userId: number;
  username: string;
}

export interface DocCollaborationCallbacks {
  onAccessChanged: (accessLevel: 'private' | 'public', publicRole?: 'editor' | 'viewer') => void;
  onAccessRevoked: () => void;
  onCollaboratorsChanged: () => void;
  onRemoteDocUpdate: (project: DocProject) => void;
  onRemoteFullUpdate: (project: DocProject) => void;
  onRequestFullState: (targetConnId: string) => void;
}

export class DocCollaborationManager {
  public accessLevel: 'private' | 'public' = 'private';
  public canvasUuid: string;
  public collaborators: Map<string, DocCollaboratorState> = new Map();
  public isOwner = true;
  public myCollaboratorColor = '#3b82f6';
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
    tier: DocCollaboratorState['subscriptionTier'],
    callbacks: DocCollaborationCallbacks
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
          const uTier = (u.subscriptionTier || u.subscription_tier || 'free') as DocCollaboratorState['subscriptionTier'];
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
      const uTier = (u.subscriptionTier || u.subscription_tier || 'free') as DocCollaboratorState['subscriptionTier'];
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

    const unsubAction = registerWebSocketHandler('CANVAS_ACTION', (payload: any) => {
      const roomUuid = typeof payload.canvasUuid === 'object' ? payload.canvasUuid?.canvasUuid : (payload.canvasUuid || payload.canvas_uuid);
      if (roomUuid !== this.canvasUuid) return;
      const action = payload.action;
      const data = payload.payload || payload.params || {};
      if (action === 'doc_update_project' && data.project) {
        callbacks.onRemoteDocUpdate(data.project);
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

    this.wsUnsubscribes = [unsubJoinError, unsubPresence, unsubJoined, unsubLeft, unsubAction, unsubFullUpdate, unsubAccess];
  }

  public broadcastDocUpdate(project: DocProject): void {
    sendCanvasAction(this.canvasUuid, 'doc_update_project', { project });
  }

  public broadcastFullState(project: DocProject, targetConnId?: string): void {
    sendCanvasFullUpdate(this.canvasUuid, project, targetConnId);
  }

  public broadcastAccessChange(accessLevel: 'private' | 'public', publicRole?: 'editor' | 'viewer'): void {
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
