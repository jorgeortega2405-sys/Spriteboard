import { navigate } from '../app-router.js';
import { clearUserState, currentUser } from './api.service.js';
import { t } from './i18n.service.js';
import { showToast } from './toast.service.js';

let ws: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let isIntentionallyClosed = false;

export function initWebSocket(): void {
  if (!currentUser) {
    closeWebSocket();
    return;
  }

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
    };

    ws.onmessage = (event: MessageEvent) => {
      try {
        const data = typeof event.data === 'string' ? JSON.parse(event.data) : null;
        console.log('[WebSocket] Mensaje recibido:', data);
        if (data?.type === 'SESSION_REVOKED') {
          closeWebSocket();
          clearUserState();
          const msg = t('settings.security.session_revoked_toast') || data.message || 'Tu sesión ha sido cerrada en todos los dispositivos.';
          showToast(msg, 'warning');
          navigate('/login');
        }
      } catch (err) {
        console.warn('[WebSocket] Error al procesar mensaje recibido:', err);
      }
    };

    ws.onclose = (event: CloseEvent) => {
      ws = null;
      if (!isIntentionallyClosed && currentUser) {
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
