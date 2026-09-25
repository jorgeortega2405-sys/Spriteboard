import { API_ROUTES } from '../config/api-routes.js';
import { postApi } from './api.service.js';

export interface CanvasViewTracker {
  stop: () => void;
}

export function startCanvasViewTracking(canvasUuid: string): CanvasViewTracker {
  if (!canvasUuid || canvasUuid.startsWith('local-')) {
    return { stop: () => {} };
  }

  const sessionId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const startTime = Date.now();
  let isStopped = false;

  const recordInitialView = async () => {
    try {
      await postApi(API_ROUTES.canvases.recordView(canvasUuid), { sessionId });
    } catch {}
  };

  void recordInitialView();

  const sendHeartbeat = async () => {
    if (isStopped) return;
    const durationSeconds = Math.max(1, Math.floor((Date.now() - startTime) / 1000));
    try {
      await postApi(API_ROUTES.canvases.heartbeatView(canvasUuid), { durationSeconds, sessionId });
    } catch {}
  };

  const heartbeatInterval = window.setInterval(() => {
    void sendHeartbeat();
  }, 15000);

  const handleVisibilityChange = () => {
    if (document.visibilityState === 'hidden') {
      void sendHeartbeat();
    }
  };

  const handlePageUnload = () => {
    void sendHeartbeat();
  };

  document.addEventListener('visibilitychange', handleVisibilityChange);
  window.addEventListener('beforeunload', handlePageUnload);
  window.addEventListener('pagehide', handlePageUnload);

  const stop = () => {
    if (isStopped) return;
    isStopped = true;
    window.clearInterval(heartbeatInterval);
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    window.removeEventListener('beforeunload', handlePageUnload);
    window.removeEventListener('pagehide', handlePageUnload);
    void sendHeartbeat();
  };

  return { stop };
}
