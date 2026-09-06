/**
 * Servicio de WebSocket en Tiempo Real (Microservicio Rust)
 *
 * Solo establece conexión para usuarios autenticados con sesión activa.
 * Usuarios invitados/sin sesión no establecen conexión.
 */

import { currentUser, clearUserState } from './api.service.js';
import { showToast } from './toast.service.js';
import { t } from './i18n.service.js';
import { navigate } from '../app-router.js';

let ws = null;
let reconnectTimer = null;
let isIntentionallyClosed = false;

/**
 * Inicializa la conexión WebSocket si hay una sesión de usuario activa
 */
export function initWebSocket() {
  // Si el usuario no está logueado, no se establece conexión WebSocket
  if (!currentUser) {
    closeWebSocket();
    return;
  }

  // Evitar conexiones duplicadas si ya está abierta o en proceso de apertura
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
    return;
  }

  isIntentionallyClosed = false;
  clearTimeout(reconnectTimer);

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}/ws`;

  try {
    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      // Conexión exitosa sin registrar console.* según directiva AGENTS.md
    };

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
      // Reintentar conexión automática solo si la sesión sigue activa y no fue cierre intencional
      if (!isIntentionallyClosed && currentUser) {
        clearTimeout(reconnectTimer);
        reconnectTimer = setTimeout(() => {
          initWebSocket();
        }, 4000);
      }
    };

    ws.onerror = () => {
      // Falla silenciosa sin ensuciar la consola
    };
  } catch (_) {
    ws = null;
  }
}

/**
 * Cierra la conexión WebSocket y cancela cualquier reintento (logout o cambio de cuenta)
 */
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
