import { navigate } from '../app-router.js';
import { clearUserState, currentUser } from './api.service.js';
import { t } from './i18n.service.js';
import { showToast } from './toast.service.js';

let ws = null;
let reconnectTimer = null;
let isIntentionallyClosed = false;

export function initWebSocket() {
  if (!currentUser) {
    closeWebSocket();
    return;
  }

  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
    return;
  }

  isIntentionallyClosed = false;
  clearTimeout(reconnectTimer);

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}/ws`;

  try {
    ws = new WebSocket(wsUrl);

    ws.onopen = () => {};

    ws.onmessage = (event) => {
      try {
        const data = typeof event.data === 'string' ? JSON.parse(event.data) : null;
        if (data?.type === 'SESSION_REVOKED') {
          closeWebSocket();
          clearUserState();
          const msg = t('settings.security.session_revoked_toast') || data.message || 'Tu sesión ha sido cerrada en todos los dispositivos.';
          showToast(msg, 'warning');
          navigate('/login');
        }
      } catch (_) {}
    };

    ws.onclose = () => {
      ws = null;
      if (!isIntentionallyClosed && currentUser) {
        clearTimeout(reconnectTimer);
        reconnectTimer = setTimeout(() => {
          initWebSocket();
        }, 4000);
      }
    };

    ws.onerror = () => {};
  } catch (_) {
    ws = null;
  }
}

export function closeWebSocket() {
  isIntentionallyClosed = true;
  clearTimeout(reconnectTimer);
  reconnectTimer = null;

  if (ws) {
    try {
      ws.close();
    } catch (_) {}
    ws = null;
  }
}
