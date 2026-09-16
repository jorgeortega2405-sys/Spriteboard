import { navigate } from '../app-router.js';
import { clearUserState, currentUser } from './api.service.js';
import { showToast } from './toast.service.js';

type WebSocketHandler = (payload: any) => void;

let ws: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let isIntentionallyClosed = false;
const messageHandlers: Map<string, Set<WebSocketHandler>> = new Map();
const pendingMessages: any[] = [];

export function initWebSocket(): void {
  if (!currentUser) {
    return;
  }

  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING || ws.readyState === WebSocket.CLOSING)) {
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
    console.log('[Admin WebSocket] Conectando a:', wsUrl);
    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('[Admin WebSocket] Conexión establecida exitosamente con el servidor.');
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

        console.log('[Admin WebSocket] Mensaje recibido:', data);

        if (data.type === 'SESSION_REVOKED') {
          closeWebSocket();
          clearUserState();
          showToast('Tu sesión de administración ha expirado.', 'warning');
          navigate('/login');
          return;
        }

        const handlers = messageHandlers.get(data.type);
        if (handlers && handlers.size > 0) {
          console.log(`[Admin WebSocket] Despachando evento '${data.type}' a ${handlers.size} manejador(es):`, data);
          handlers.forEach((handler) => {
            try {
              handler(data);
            } catch (err) {
              console.warn('[Admin WebSocket] Error en manejador de mensaje:', err);
            }
          });
        } else {
          console.warn(`[Admin WebSocket] No hay manejadores registrados para el tipo de evento: '${data.type}'`);
        }
      } catch (err) {
        console.warn('[Admin WebSocket] Error al procesar mensaje recibido:', err);
      }
    };

    const currentWs = ws;
    ws.onclose = (event: CloseEvent) => {
      if (ws === currentWs) {
        ws = null;
      }
      if (!isIntentionallyClosed && currentUser) {
        console.warn(`[Admin WebSocket] Conexión cerrada (código: ${event.code}). Reconectando en 4 segundos...`);
        if (reconnectTimer) clearTimeout(reconnectTimer);
        reconnectTimer = setTimeout(() => {
          if (currentUser) {
            initWebSocket();
          }
        }, 4000);
      } else {
        console.log('[Admin WebSocket] Conexión cerrada.');
      }
    };

    ws.onerror = (err: Event) => {
      console.error('[Admin WebSocket] Error de conexión:', err);
    };
  } catch (err) {
    console.error('[Admin WebSocket] Excepción al inicializar WebSocket:', err);
    ws = null;
  }
}

export function closeWebSocket(): void {
  isIntentionallyClosed = true;
  pendingMessages.length = 0;
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }

  if (ws) {
    const activeWs = ws;
    ws = null;
    try {
      activeWs.close();
      console.log('[Admin WebSocket] Conexión cerrada voluntariamente.');
    } catch (_) {}
  }
}

export function sendWebSocketMessage(msg: any): void {
  if (!currentUser) {
    return;
  }

  if (ws && ws.readyState === WebSocket.OPEN) {
    try {
      ws.send(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } catch (err) {
      console.warn('[Admin WebSocket] Error al enviar mensaje:', err);
    }
  } else {
    if (pendingMessages.length < 50) {
      pendingMessages.push(msg);
    }
    initWebSocket();
  }
}

export function registerWebSocketHandler(type: string, handler: WebSocketHandler): () => void {
  console.log(`[Admin WebSocket] Registrando manejador para evento: '${type}'`);
  if (!messageHandlers.has(type)) {
    messageHandlers.set(type, new Set());
  }
  messageHandlers.get(type)!.add(handler);

  return () => {
    console.log(`[Admin WebSocket] Desregistrando manejador para evento: '${type}'`);
    const set = messageHandlers.get(type);
    if (set) {
      set.delete(handler);
      if (set.size === 0) {
        messageHandlers.delete(type);
      }
    }
  };
}
