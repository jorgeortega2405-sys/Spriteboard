/**
 * Servicios de API, Autenticación y Estado Global del Frontend
 */

export let currentUser = null;
export let linkedAccounts = [];
export let csrfToken = '';
export const appConfig = { appName: 'Spriteboard' };

export function setCurrentUser(user) {
  currentUser = user;
  if (user && Array.isArray(linkedAccounts)) {
    const idx = linkedAccounts.findIndex((a) => a.id === user.id);
    if (idx >= 0) {
      linkedAccounts[idx] = { ...linkedAccounts[idx], ...user };
    }
  }
}

export function setLinkedAccounts(accounts) {
  linkedAccounts = Array.isArray(accounts) ? accounts : [];
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
  } catch {
    // Falla silenciosa sin llamadas console.*
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
  } catch {
    // Falla silenciosa sin llamadas console.*
  }
  return '';
}

// Comprobar si hay sesión activa del usuario y cargar cuentas vinculadas
export async function checkAuthSession() {
  try {
    const res = await fetch('/api/me');
    if (res.ok) {
      const data = await res.json();
      currentUser = data.user || null;
      linkedAccounts = Array.isArray(data.accounts) ? data.accounts : (data.user ? [data.user] : []);
    } else {
      currentUser = null;
      linkedAccounts = [];
    }
  } catch {
    currentUser = null;
    linkedAccounts = [];
  }
  return currentUser;
}

// Helper para conmutar de cuenta activa
export async function switchAccountApi(userId) {
  const res = await postApi('/api/auth/switch-account', { user_id: userId });
  if (res.ok) {
    const data = await res.json();
    if (data.user) currentUser = data.user;
    if (data.accounts) linkedAccounts = data.accounts;
    return { success: true, data };
  }
  let err = {};
  try {
    err = await res.json();
  } catch (_) {}
  return { success: false, error: err.error || err.message || '' };
}

// Helper para cerrar sesión de la cuenta activa (conmuta o desloguea)
export async function logoutApi() {
  const res = await postApi('/api/logout', {});
  if (res.ok) {
    const data = await res.json();
    if (data.switched && data.user) {
      currentUser = data.user;
      linkedAccounts = Array.isArray(data.accounts) ? data.accounts : [];
      return { success: true, switched: true, user: data.user, accounts: linkedAccounts };
    } else {
      currentUser = null;
      linkedAccounts = [];
      return { success: true, switched: false };
    }
  }
  return { success: false };
}

// Helper para cerrar todas las sesiones vinculadas
export async function logoutAllApi() {
  const res = await postApi('/api/auth/logout-all', {});
  currentUser = null;
  linkedAccounts = [];
  return res.ok;
}

// Helper para llamadas GET a la API
export async function getApi(url) {
  return fetch(url, {
    method: 'GET',
    credentials: 'include',
  });
}

// Helper para llamadas POST a la API con token CSRF y credenciales
export async function postApi(url, body) {
  if (!csrfToken) {
    await fetchCsrfToken();
  }

  const payload = body !== undefined ? JSON.stringify(body) : JSON.stringify({});

  let res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': csrfToken,
    },
    credentials: 'include',
    body: payload,
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
      body: payload,
    });
  }

  return res;
}

// Helper para llamadas multipart/form-data con token CSRF y credenciales
export async function postFormApi(url, formData) {
  if (!csrfToken) {
    await fetchCsrfToken();
  }

  let res = await fetch(url, {
    method: 'POST',
    headers: {
      'X-CSRF-Token': csrfToken,
    },
    credentials: 'include',
    body: formData,
  });

  if (res.status === 403) {
    await fetchCsrfToken();
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'X-CSRF-Token': csrfToken,
      },
      credentials: 'include',
      body: formData,
    });
  }

  return res;
}

// Helper para llamadas DELETE a la API con token CSRF y credenciales
export async function deleteApi(url, body) {
  if (!csrfToken) {
    await fetchCsrfToken();
  }

  let res = await fetch(url, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': csrfToken,
    },
    credentials: 'include',
    body: body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 403) {
    await fetchCsrfToken();
    res = await fetch(url, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrfToken,
      },
      credentials: 'include',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  return res;
}

