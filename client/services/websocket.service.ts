import { navigate } from '../app-router.js';
import { clearUserState, currentUser } from './api.service.js';
import { t } from './i18n.service.js';
import { showToast } from './toast.service.js';

type WebSocketHandler = (payload: any) => void;

let ws: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let isIntentionallyClosed = false;
const messageHandlers: Map<string, Set<WebSocketHandler>> = new Map();
const pendingMessages: any[] = [];

export function initWebSocket(): void {
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
    return;
  }

  isIntentionallyClosed = false;
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}/ws`;

  try {
    console.log('[WebSocket] Conectando a:', wsUrl);
    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('[WebSocket] Conexión establecida exitosamente con el servidor.');
      while (pendingMessages.length > 0 && ws?.readyState === WebSocket.OPEN) {
        const msg = pendingMessages.shift();
        try {
          ws.send(typeof msg === 'string' ? msg : JSON.stringify(msg));
        } catch (_) {}
      }
    };

    ws.onmessage = (event: MessageEvent) => {
      try {
        const data = typeof event.data === 'string' ? JSON.parse(event.data) : null;
        if (!data || !data.type) return;

        console.log('[WebSocket] Mensaje recibido:', data);

        if (data.type === 'SESSION_REVOKED') {
          closeWebSocket();
          clearUserState();
          const msg = t('settings.security.session_revoked_toast') || data.message || 'Tu sesión ha sido cerrada en todos los dispositivos.';
          showToast(msg, 'warning');
          navigate('/login');
          return;
        }

        const handlers = messageHandlers.get(data.type);
        if (handlers) {
          handlers.forEach((handler) => {
            try {
              handler(data);
            } catch (err) {
              console.warn('[WebSocket] Error en manejador de mensaje:', err);
            }
          });
        }
      } catch (err) {
        console.warn('[WebSocket] Error al procesar mensaje recibido:', err);
      }
    };

    ws.onclose = (event: CloseEvent) => {
      ws = null;
      if (!isIntentionallyClosed) {
        console.warn(`[WebSocket] Conexión cerrada (código: ${event.code}). Reconectando en 4 segundos...`);
        if (reconnectTimer) clearTimeout(reconnectTimer);
        reconnectTimer = setTimeout(() => {
          initWebSocket();
        }, 4000);
      } else {
        console.log('[WebSocket] Conexión cerrada.');
      }
    };

    ws.onerror = (err: Event) => {
      console.error('[WebSocket] Error de conexión:', err);
    };
  } catch (err) {
    console.error('[WebSocket] Excepción al inicializar WebSocket:', err);
    ws = null;
  }
}

export function closeWebSocket(): void {
  isIntentionallyClosed = true;
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }

  if (ws) {
    try {
      ws.close();
      console.log('[WebSocket] Conexión cerrada voluntariamente.');
    } catch (_) {}
    ws = null;
  }
}

export function sendWebSocketMessage(msg: any): void {
  if (ws && ws.readyState === WebSocket.OPEN) {
    try {
      ws.send(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } catch (err) {
      console.warn('[WebSocket] Error al enviar mensaje:', err);
    }
  } else {
    pendingMessages.push(msg);
    initWebSocket();
  }
}

export function registerWebSocketHandler(type: string, handler: WebSocketHandler): () => void {
  if (!messageHandlers.has(type)) {
    messageHandlers.set(type, new Set());
  }
  messageHandlers.get(type)!.add(handler);

  return () => {
    const set = messageHandlers.get(type);
    if (set) {
      set.delete(handler);
      if (set.size === 0) {
        messageHandlers.delete(type);
      }
    }
  };
}

export function joinCanvasRoom(
  canvasUuid: string,
  user?: number | { color?: string; id?: number; username?: string },
  username?: string,
  color?: string
): void {
  const userObj = {
    color: '#00E5FF',
    id: currentUser?.id ?? 0,
    username: currentUser?.username ?? 'Invitado',
  };

  if (typeof user === 'number') {
    userObj.id = user;
    if (username) userObj.username = username;
    if (color) userObj.color = color;
  } else if (user && typeof user === 'object') {
    if (user.id !== undefined) userObj.id = user.id;
    if (user.username) userObj.username = user.username;
    if (user.color) userObj.color = user.color;
  }

  sendWebSocketMessage({
    canvasUuid,
    type: 'JOIN_CANVAS',
    user: userObj,
  });
}

export function leaveCanvasRoom(canvasUuid: string): void {
  sendWebSocketMessage({
    canvasUuid,
    type: 'LEAVE_CANVAS',
  });
}

export function sendCanvasCursor(canvasUuid: string, x: number, y: number): void {
  sendWebSocketMessage({
    canvasUuid,
    type: 'CANVAS_CURSOR',
    x,
    y,
  });
}

export function sendCanvasDrawStroke(
  canvasUuid: string,
  toolOrPayload: string | any,
  color?: string,
  size?: number,
  points?: Array<{ x: number; y: number }>,
  options?: any
): void {
  if (typeof toolOrPayload === 'string') {
    sendWebSocketMessage({
      canvasUuid,
      color,
      frameId: options?.frameId,
      layerId: options?.layerId,
      options,
      points,
      size,
      tool: toolOrPayload,
      type: 'CANVAS_DRAW_STROKE',
    });
  } else {
    sendWebSocketMessage({
      canvasUuid,
      type: 'CANVAS_DRAW_STROKE',
      ...toolOrPayload,
    });
  }
}

export function sendCanvasAction(canvasUuid: string, action: string, payload: any): void {
  sendWebSocketMessage({
    type: 'CANVAS_ACTION',
    canvasUuid,
    action,
    payload,
  });
}

export function sendCanvasFullUpdate(canvasUuid: string, data: any): void {
  sendWebSocketMessage({
    type: 'CANVAS_FULL_UPDATE',
    canvasUuid,
    data,
  });
}

export function sendCanvasAccessChanged(canvasUuid: string, accessLevel: 'private' | 'public'): void {
  sendWebSocketMessage({
    type: 'CANVAS_ACCESS_CHANGED',
    canvasUuid,
    accessLevel,
  });
}

export function sendCanvasMemberRemoved(canvasUuid: string, targetUserId: number): void {
  sendWebSocketMessage({
    type: 'CANVAS_MEMBER_REMOVED',
    canvasUuid,
    targetUserId,
  });
}

