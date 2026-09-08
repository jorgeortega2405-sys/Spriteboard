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
    ws.binaryType = 'arraybuffer';

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
        if (event.data instanceof ArrayBuffer) {
          const view = new DataView(event.data);
          if (view.byteLength < 2) return;
          const opcode = view.getUint8(0);

          if (opcode === 1) {
            const connLen = view.getUint8(1);
            if (view.byteLength >= 2 + connLen + 11) {
              const connIdBytes = new Uint8Array(event.data, 2, connLen);
              const connId = new TextDecoder().decode(connIdBytes);
              const r = view.getUint8(2 + connLen);
              const g = view.getUint8(2 + connLen + 1);
              const b = view.getUint8(2 + connLen + 2);
              const x = view.getFloat32(2 + connLen + 3);
              const y = view.getFloat32(2 + connLen + 7);
              const color = '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');

              const handlers = messageHandlers.get('CANVAS_CURSOR');
              if (handlers) {
                handlers.forEach((h) => {
                  try {
                    h({ color, connId, type: 'CANVAS_CURSOR', x, y });
                  } catch (err) {
                    console.warn('[WebSocket] Error en manejador binario de cursor:', err);
                  }
                });
              }
            }
            return;
          }

          if (opcode === 2) {
            const connLen = view.getUint8(1);
            if (view.byteLength >= 2 + connLen + 7) {
              const connIdBytes = new Uint8Array(event.data, 2, connLen);
              const connId = new TextDecoder().decode(connIdBytes);
              let offset = 2 + connLen;
              const toolId = view.getUint8(offset);
              offset += 1;
              const r = view.getUint8(offset);
              const g = view.getUint8(offset + 1);
              const b = view.getUint8(offset + 2);
              offset += 3;
              const color = '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
              const size = view.getUint8(offset);
              offset += 1;
              const pointCount = view.getUint16(offset);
              offset += 2;
              const points: Array<{ x: number; y: number }> = [];
              for (let i = 0; i < pointCount && offset + 4 <= view.byteLength; i++) {
                const px = view.getInt16(offset);
                const py = view.getInt16(offset + 2);
                points.push({ x: px, y: py });
                offset += 4;
              }
              const toolNames = ['brush', 'eraser', 'dither', 'shading', 'spray', 'bucket'];
              const tool = toolNames[toolId] || 'brush';

              const handlers = messageHandlers.get('CANVAS_DRAW_STROKE');
              if (handlers) {
                handlers.forEach((h) => {
                  try {
                    h({ color, points, senderConnId: connId, size, tool, type: 'CANVAS_DRAW_STROKE' });
                  } catch (err) {
                    console.warn('[WebSocket] Error en manejador binario de trazo:', err);
                  }
                });
              }
            }
            return;
          }

          return;
        }

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
  color?: string,
  roomToken?: string
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
    roomToken,
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
  sendCanvasBinaryCursor(canvasUuid, x, y);
}

export function sendCanvasBinaryCursor(canvasUuid: string, x: number, y: number): void {
  if (ws && ws.readyState === WebSocket.OPEN) {
    const enc = new TextEncoder();
    const uuidBytes = enc.encode(canvasUuid);
    const buf = new ArrayBuffer(2 + uuidBytes.length + 8);
    const view = new DataView(buf);
    view.setUint8(0, 1);
    view.setUint8(1, uuidBytes.length);
    new Uint8Array(buf, 2, uuidBytes.length).set(uuidBytes);
    const offset = 2 + uuidBytes.length;
    view.setFloat32(offset, x);
    view.setFloat32(offset + 4, y);
    try {
      ws.send(buf);
    } catch (_) {}
  } else {
    sendWebSocketMessage({
      canvasUuid,
      type: 'CANVAS_CURSOR',
      x,
      y,
    });
  }
}

export function sendCanvasBinaryStroke(
  canvasUuid: string,
  tool: string,
  color: string,
  size: number,
  points: Array<{ x: number; y: number }>
): void {
  if (ws && ws.readyState === WebSocket.OPEN) {
    const enc = new TextEncoder();
    const uuidBytes = enc.encode(canvasUuid);
    const toolMap: Record<string, number> = {
      brush: 0,
      eraser: 1,
      dither: 2,
      shading: 3,
      spray: 4,
      bucket: 5,
    };
    const toolId = toolMap[tool] !== undefined ? toolMap[tool] : 0;
    let hex = color.replace('#', '');
    if (hex.length === 3) {
      hex = hex.split('').map((c) => c + c).join('');
    }
    const r = parseInt(hex.slice(0, 2), 16) || 0;
    const g = parseInt(hex.slice(2, 4), 16) || 0;
    const b = parseInt(hex.slice(4, 6), 16) || 0;
    const clampedSize = Math.max(1, Math.min(255, size || 1));
    const safePoints = points.slice(0, 65535);

    const buf = new ArrayBuffer(2 + uuidBytes.length + 7 + safePoints.length * 4);
    const view = new DataView(buf);
    view.setUint8(0, 2);
    view.setUint8(1, uuidBytes.length);
    new Uint8Array(buf, 2, uuidBytes.length).set(uuidBytes);

    let offset = 2 + uuidBytes.length;
    view.setUint8(offset, toolId);
    offset += 1;
    view.setUint8(offset, r);
    view.setUint8(offset + 1, g);
    view.setUint8(offset + 2, b);
    offset += 3;
    view.setUint8(offset, clampedSize);
    offset += 1;
    view.setUint16(offset, safePoints.length);
    offset += 2;

    for (let i = 0; i < safePoints.length; i++) {
      view.setInt16(offset, Math.round(safePoints[i].x));
      view.setInt16(offset + 2, Math.round(safePoints[i].y));
      offset += 4;
    }

    try {
      ws.send(buf);
    } catch (_) {}
  } else {
    sendCanvasDrawStroke(canvasUuid, tool, color, size, points);
  }
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

export function sendCanvasAccessChanged(canvasUuid: string, accessLevel: 'private' | 'public', publicRole?: 'viewer' | 'editor'): void {
  sendWebSocketMessage({
    accessLevel,
    canvasUuid,
    publicRole,
    type: 'CANVAS_ACCESS_CHANGED',
  });
}

export function sendCanvasMemberRemoved(canvasUuid: string, targetUserId: number): void {
  sendWebSocketMessage({
    type: 'CANVAS_MEMBER_REMOVED',
    canvasUuid,
    targetUserId,
  });
}

