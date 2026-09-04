/**
 * Servicios de API, Autenticación y Estado Global del Frontend
 */

export let currentUser = null;
export let csrfToken = '';
export const appConfig = { appName: 'Spriteboard' };

export function setCurrentUser(user) {
  currentUser = user;
}

export function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Obtener configuración pública de la app desde el backend
export async function fetchAppConfig() {
  try {
    const res = await fetch('/api/config');
    if (res.ok) {
      const data = await res.json();
      if (data.appName) {
        appConfig.appName = data.appName;
        document.title = data.appName;
      }
    }
  } catch (err) {
    console.warn('No se pudo cargar la configuración de la app:', err);
  }
}

// Obtener o refrescar Token CSRF desde el backend
export async function fetchCsrfToken() {
  try {
    const res = await fetch('/api/csrf-token');
    if (res.ok) {
      const data = await res.json();
      csrfToken = data.csrfToken;
      return csrfToken;
    }
  } catch (err) {
    console.error('Error al obtener token CSRF:', err);
  }
  return '';
}

// Comprobar si hay sesión activa del usuario
export async function checkAuthSession() {
  try {
    const res = await fetch('/api/me');
    if (res.ok) {
      const data = await res.json();
      currentUser = data.user;
    } else {
      currentUser = null;
    }
  } catch {
    currentUser = null;
  }
  return currentUser;
}

// Helper para llamadas POST a la API con token CSRF y credenciales
export async function postApi(url, body) {
  if (!csrfToken) {
    await fetchCsrfToken();
  }

  let res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': csrfToken,
    },
    credentials: 'include',
    body: JSON.stringify(body),
  });

  // Reintento automático si el token expiró
  if (res.status === 403) {
    await fetchCsrfToken();
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrfToken,
      },
      credentials: 'include',
      body: JSON.stringify(body),
    });
  }

  return res;
}
