import { isUserAdmin, SessionAccount, UserPayload } from '../types/auth.types.js';

export const API_ROUTES = {
  auth: {
    login: '/api/login',
    logout: '/api/logout',
    logoutAll: '/api/logout-all',
    me: '/api/me',
    switchAccount: '/api/switch-account',
    verify2fa: '/api/login/verify-2fa',
  },
  avatar: (name: string) => `/api/avatar?name=${encodeURIComponent(name)}`,
  config: '/api/config',
  csrfToken: '/api/csrf-token',
  health: '/health',
  settings: {
    avatar: '/api/settings/avatar',
    disable2fa: '/api/settings/2fa/disable',
    email: '/api/settings/email',
    enable2fa: '/api/settings/2fa/enable',
    generate2fa: '/api/settings/2fa/generate',
    googleUnlink: '/api/settings/google/unlink',
    password: '/api/settings/password',
    preferences: '/api/settings/preferences',
    revokeSession: '/api/settings/sessions/revoke',
    sessions: '/api/settings/sessions',
    status2fa: '/api/settings/2fa/status',
    username: '/api/settings/username',
    verifyPassword: '/api/settings/password/verify',
  },
  users: {
    account: (id: number) => `/api/users/${id}/account`,
    allRoles: '/api/users/roles/all',
    avatar: (id: number) => `/api/users/${id}/avatar`,
    base: '/api/users',
    byId: (id: number) => `/api/users/${id}`,
    email: (id: number) => `/api/users/${id}/email`,
    manage: (id: number) => `/api/users/${id}/manage`,
    preferences: (id: number) => `/api/users/${id}/preferences`,
    revokeSanction: (id: number, sanctionId: number) => `/api/users/${id}/sanctions/${sanctionId}`,
    revokeSessions: (id: number) => `/api/users/${id}/revoke-sessions`,
    roles: (id: number) => `/api/users/${id}/roles`,
    sanctions: (id: number) => `/api/users/${id}/sanctions`,
    username: (id: number) => `/api/users/${id}/username`,
  },
};

export let currentUser: UserPayload | null = null;
export let linkedAccounts: SessionAccount[] = [];
export let csrfToken = '';
export const appConfig = { appName: 'Spriteboard Admin' };

export function setCurrentUser(user: UserPayload | null): void {
  currentUser = user;
  if (user && Array.isArray(linkedAccounts)) {
    const idx = linkedAccounts.findIndex((a) => a.id === user.id);
    if (idx >= 0) {
      linkedAccounts[idx] = { ...linkedAccounts[idx], ...user };
    }
  }
}

export function setLinkedAccounts(accounts: SessionAccount[]): void {
  linkedAccounts = Array.isArray(accounts) ? accounts : [];
}

export function clearUserState(): void {
  currentUser = null;
  linkedAccounts = [];
}

export function escapeHtml(str?: string | null): string {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export async function fetchAppConfig(): Promise<void> {
  try {
    const res = await fetch(API_ROUTES.config);
    if (res.ok) {
      const data = await res.json();
      if (data.appName) {
        appConfig.appName = data.appName;
        document.title = data.appName;
      }
    }
  } catch {}
}

export async function fetchCsrfToken(): Promise<string> {
  try {
    const res = await fetch(API_ROUTES.csrfToken);
    if (res.ok) {
      const data = await res.json();
      csrfToken = data.csrfToken;
      return csrfToken;
    }
  } catch {}
  return '';
}

export async function checkAuthSession(): Promise<UserPayload | null> {
  try {
    const res = await fetch(API_ROUTES.auth.me);
    if (res.ok) {
      const data = await res.json();
      if (data.user && isUserAdmin(data.user.role, data.user.roles)) {
        currentUser = data.user;
        linkedAccounts = Array.isArray(data.accounts) ? data.accounts : [data.user];
      } else {
        currentUser = null;
        linkedAccounts = [];
      }
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

export async function apiRequest(url: string, options: RequestInit = {}): Promise<Response> {
  const method = (options.method || 'GET').toUpperCase();
  const headers = new Headers(options.headers || {});

  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
    if (!csrfToken) {
      await fetchCsrfToken();
    }
    if (csrfToken) {
      headers.set('x-csrf-token', csrfToken);
    }
  }

  return fetch(url, {
    ...options,
    credentials: 'same-origin',
    headers,
  });
}

export async function getApi(url: string): Promise<Response> {
  return apiRequest(url, { method: 'GET' });
}

export async function postApi(url: string, data?: any): Promise<Response> {
  return apiRequest(url, {
    body: data ? JSON.stringify(data) : undefined,
    method: 'POST',
  });
}

export async function putApi(url: string, data?: any): Promise<Response> {
  return apiRequest(url, {
    body: data ? JSON.stringify(data) : undefined,
    method: 'PUT',
  });
}

export async function patchApi(url: string, data?: any): Promise<Response> {
  return apiRequest(url, {
    body: data ? JSON.stringify(data) : undefined,
    method: 'PATCH',
  });
}

export async function deleteApi(url: string, data?: any): Promise<Response> {
  return apiRequest(url, {
    body: data ? JSON.stringify(data) : undefined,
    method: 'DELETE',
  });
}

export async function loginApi(credentials: { email: string; password: string }): Promise<{ accounts?: SessionAccount[]; error?: string; requires2FA?: boolean; success: boolean; tempToken?: string; user?: UserPayload }> {
  try {
    const res = await postApi(API_ROUTES.auth.login, credentials);
    const data = await res.json();
    if (res.ok && data.ok) {
      if (data.requires2FA) {
        return { requires2FA: true, success: true, tempToken: data.tempToken };
      }
      if (data.user && !isUserAdmin(data.user.role, data.user.roles)) {
        return { error: 'Acceso denegado. No tienes permisos de administrador.', success: false };
      }
      currentUser = data.user || null;
      linkedAccounts = Array.isArray(data.accounts) ? data.accounts : (data.user ? [data.user] : []);
      return { accounts: linkedAccounts, success: true, user: currentUser! };
    }
    return { error: data.error || 'Credenciales inválidas.', success: false };
  } catch {
    return { error: 'Error al conectar con el servidor. Intenta nuevamente.', success: false };
  }
}

export async function verify2FALoginApi(tempToken: string, code: string): Promise<{ accounts?: SessionAccount[]; error?: string; success: boolean; user?: UserPayload }> {
  try {
    const res = await postApi(API_ROUTES.auth.verify2fa, { code, tempToken });
    const data = await res.json();
    if (res.ok && data.ok) {
      if (data.user && !isUserAdmin(data.user.role, data.user.roles)) {
        return { error: 'Acceso denegado. No tienes permisos de administrador.', success: false };
      }
      currentUser = data.user || null;
      linkedAccounts = Array.isArray(data.accounts) ? data.accounts : (data.user ? [data.user] : []);
      return { accounts: linkedAccounts, success: true, user: currentUser! };
    }
    return { error: data.error || 'Código 2FA incorrecto o expirado.', success: false };
  } catch {
    return { error: 'Error al conectar con el servidor. Intenta nuevamente.', success: false };
  }
}

export async function logoutApi(userId?: number): Promise<{ accounts: SessionAccount[]; activeUser: UserPayload | null; success: boolean }> {
  try {
    const res = await postApi(API_ROUTES.auth.logout, { userId });
    if (res.ok) {
      const data = await res.json();
      currentUser = data.activeUser || null;
      linkedAccounts = Array.isArray(data.accounts) ? data.accounts : [];
      return { accounts: linkedAccounts, activeUser: currentUser, success: true };
    }
  } catch {}
  clearUserState();
  return { accounts: [], activeUser: null, success: true };
}

export async function logoutAllApi(): Promise<boolean> {
  try {
    const res = await postApi(API_ROUTES.auth.logoutAll);
    clearUserState();
    return res.ok;
  } catch {
    clearUserState();
    return false;
  }
}

export async function switchAccountApi(userId: number): Promise<{ data?: any; error?: string; success: boolean }> {
  try {
    const res = await postApi(API_ROUTES.auth.switchAccount, { userId });
    if (res.ok) {
      const data = await res.json();
      if (data.user) currentUser = data.user;
      if (data.accounts) linkedAccounts = data.accounts;
      return { data, success: true };
    }
    const err = await res.json().catch(() => ({}));
    return { error: err.error || 'No se pudo cambiar de cuenta.', success: false };
  } catch {
    return { error: 'Error al conectar con el servidor.', success: false };
  }
}

export async function getPreferencesApi(): Promise<{ error?: string; preferences?: any; success: boolean }> {
  try {
    const res = await getApi(API_ROUTES.settings.preferences);
    const data = await res.json();
    if (res.ok) return { preferences: data.preferences, success: true };
    return { error: data.error || 'Error al obtener preferencias.', success: false };
  } catch {
    return { error: 'Error al conectar con el servidor.', success: false };
  }
}

export async function updatePreferencesApi(updates: any): Promise<{ error?: string; preferences?: any; success: boolean }> {
  try {
    const res = await postApi(API_ROUTES.settings.preferences, updates);
    const data = await res.json();
    if (res.ok) return { preferences: data.preferences, success: true };
    return { error: data.error || 'Error al guardar preferencias.', success: false };
  } catch {
    return { error: 'Error al conectar con el servidor.', success: false };
  }
}

export async function updateUsernameApi(username: string): Promise<{ error?: string; success: boolean }> {
  try {
    const res = await postApi(API_ROUTES.settings.username, { username });
    const data = await res.json();
    if (res.ok) {
      if (currentUser) currentUser.username = username;
      return { success: true };
    }
    return { error: data.error || 'Error al actualizar nombre de usuario.', success: false };
  } catch {
    return { error: 'Error al conectar con el servidor.', success: false };
  }
}

export async function updateEmailApi(email: string): Promise<{ email?: string; error?: string; success: boolean }> {
  try {
    const res = await postApi(API_ROUTES.settings.email, { email });
    const data = await res.json();
    if (res.ok) {
      if (currentUser) currentUser.email = data.email || email;
      return { email: data.email || email, success: true };
    }
    return { error: data.error || 'Error al actualizar correo electrónico.', success: false };
  } catch {
    return { error: 'Error al conectar con el servidor.', success: false };
  }
}

export async function unlinkGoogleApi(): Promise<{ error?: string; success: boolean }> {
  try {
    const res = await postApi(API_ROUTES.settings.googleUnlink);
    const data = await res.json();
    if (res.ok) {
      if (currentUser) currentUser.google_id = null;
      return { success: true };
    }
    return { error: data.error || 'Error al desvincular Google.', success: false };
  } catch {
    return { error: 'Error al conectar con el servidor.', success: false };
  }
}

export async function verifyCurrentPasswordApi(password: string): Promise<{ error?: string; success: boolean }> {
  try {
    const res = await postApi(API_ROUTES.settings.verifyPassword, { password });
    const data = await res.json();
    if (res.ok) return { success: true };
    return { error: data.error || 'Contraseña incorrecta.', success: false };
  } catch {
    return { error: 'Error al conectar con el servidor.', success: false };
  }
}

export async function updatePasswordApi(currentPassword: string, newPassword: string): Promise<{ error?: string; success: boolean }> {
  try {
    const res = await postApi(API_ROUTES.settings.password, { currentPassword, newPassword });
    const data = await res.json();
    if (res.ok) return { success: true };
    return { error: data.error || 'Error al cambiar contraseña.', success: false };
  } catch {
    return { error: 'Error al conectar con el servidor.', success: false };
  }
}

export async function get2FAStatusApi(): Promise<{ enabled: boolean }> {
  try {
    const res = await getApi(API_ROUTES.settings.status2fa);
    if (res.ok) {
      const data = await res.json();
      return { enabled: Boolean(data.enabled) };
    }
  } catch {}
  return { enabled: false };
}

export async function generate2FAApi(): Promise<{ error?: string; otpauthUrl?: string; secret?: string; success: boolean }> {
  try {
    const res = await postApi(API_ROUTES.settings.generate2fa);
    const data = await res.json();
    if (res.ok) return { otpauthUrl: data.otpauthUrl, secret: data.secret, success: true };
    return { error: data.error || 'Error al generar clave 2FA.', success: false };
  } catch {
    return { error: 'Error al conectar con el servidor.', success: false };
  }
}

export async function enable2FAApi(code: string, secret?: string): Promise<{ error?: string; recoveryCodes?: string[]; success: boolean }> {
  try {
    const res = await postApi(API_ROUTES.settings.enable2fa, { code, secret });
    const data = await res.json();
    if (res.ok) return { recoveryCodes: data.recoveryCodes, success: true };
    return { error: data.error || 'Código 2FA incorrecto.', success: false };
  } catch {
    return { error: 'Error al conectar con el servidor.', success: false };
  }
}

export async function disable2FAApi(password: string): Promise<{ error?: string; success: boolean }> {
  try {
    const res = await postApi(API_ROUTES.settings.disable2fa, { password });
    const data = await res.json();
    if (res.ok) return { success: true };
    return { error: data.error || 'Contraseña incorrecta.', success: false };
  } catch {
    return { error: 'Error al conectar con el servidor.', success: false };
  }
}

export async function updateAvatarApi(avatarBase64: string): Promise<{ avatar_url?: string; error?: string; success: boolean }> {
  try {
    const res = await postApi(API_ROUTES.settings.avatar, { avatarBase64 });
    const data = await res.json();
    if (res.ok) {
      if (currentUser) currentUser.avatar_url = data.avatar_url;
      return { avatar_url: data.avatar_url, success: true };
    }
    return { error: data.error || 'Error al actualizar avatar.', success: false };
  } catch {
    return { error: 'Error al conectar con el servidor.', success: false };
  }
}

export async function deleteAvatarApi(): Promise<{ error?: string; success: boolean }> {
  try {
    const res = await deleteApi(API_ROUTES.settings.avatar);
    const data = await res.json();
    if (res.ok) {
      if (currentUser) currentUser.avatar_url = null;
      return { success: true };
    }
    return { error: data.error || 'Error al eliminar avatar.', success: false };
  } catch {
    return { error: 'Error al conectar con el servidor.', success: false };
  }
}

export async function getActiveSessionsApi(): Promise<{ error?: string; sessions?: any[]; success: boolean }> {
  try {
    const res = await getApi(API_ROUTES.settings.sessions);
    const data = await res.json();
    if (res.ok) return { sessions: data.sessions || [], success: true };
    return { error: data.error || 'Error al obtener sesiones activas.', success: false };
  } catch {
    return { error: 'Error al conectar con el servidor.', success: false };
  }
}

export async function revokeSessionApi(sessionId: string): Promise<{ error?: string; success: boolean }> {
  try {
    const res = await postApi(API_ROUTES.settings.revokeSession, { sessionId });
    const data = await res.json();
    if (res.ok) return { success: true };
    return { error: data.error || 'Error al revocar sesión.', success: false };
  } catch {
    return { error: 'Error al conectar con el servidor.', success: false };
  }
}

export async function getUsersApi(options: {
  limit?: number;
  page?: number;
  role?: string;
  search?: string;
  two_factor?: string;
} = {}): Promise<{
  error?: string;
  ok: boolean;
  pagination?: { limit: number; page: number; total: number; totalPages: number };
  users?: any[];
}> {
  try {
    const params = new URLSearchParams();
    if (options.page) params.set('page', String(options.page));
    if (options.limit) params.set('limit', String(options.limit));
    if (options.search) params.set('search', options.search);
    if (options.role) params.set('role', options.role);
    if (options.two_factor) params.set('two_factor', options.two_factor);

    const qs = params.toString();
    const url = `${API_ROUTES.users.base}${qs ? `?${qs}` : ''}`;
    const res = await getApi(url);
    const data = await res.json();
    if (res.ok && data.ok) {
      return { ok: true, pagination: data.pagination, users: data.users || [] };
    }
    return { error: data.error || 'Error al obtener usuarios.', ok: false, users: [] };
  } catch {
    return { error: 'Error al conectar con el servidor.', ok: false, users: [] };
  }
}

export async function getUserDetailsApi(userId: number): Promise<{
  error?: string;
  ok: boolean;
  sanctions?: any[];
  user?: any;
}> {
  try {
    const res = await getApi(API_ROUTES.users.byId(userId));
    const data = await res.json();
    if (res.ok && data.ok) {
      return { ok: true, sanctions: data.sanctions || [], user: data.user };
    }
    return { error: data.error || 'Error al obtener detalles del usuario.', ok: false };
  } catch {
    return { error: 'Error al conectar con el servidor.', ok: false };
  }
}

export async function updateUserRolesApi(
  userId: number,
  roles: string[]
): Promise<{ error?: string; ok: boolean }> {
  try {
    const res = await putApi(API_ROUTES.users.roles(userId), { roles });
    const data = await res.json();
    if (res.ok && data.ok) return { ok: true };
    return { error: data.error || 'Error al actualizar roles.', ok: false };
  } catch {
    return { error: 'Error al conectar con el servidor.', ok: false };
  }
}

export async function updateUserAccountApi(
  userId: number,
  payload: { email?: string; subscription_tier?: string; username?: string }
): Promise<{ error?: string; ok: boolean }> {
  try {
    const res = await putApi(API_ROUTES.users.account(userId), payload);
    const data = await res.json();
    if (res.ok && data.ok) return { ok: true };
    return { error: data.error || 'Error al actualizar cuenta.', ok: false };
  } catch {
    return { error: 'Error al conectar con el servidor.', ok: false };
  }
}

export async function applyUserSanctionApi(
  userId: number,
  payload: { durationDays?: number; reason: string; type: 'ban' | 'suspension' | 'warning' }
): Promise<{ error?: string; ok: boolean }> {
  try {
    const res = await postApi(API_ROUTES.users.sanctions(userId), payload);
    const data = await res.json();
    if (res.ok && data.ok) return { ok: true };
    return { error: data.error || 'Error al aplicar sanción.', ok: false };
  } catch {
    return { error: 'Error al conectar con el servidor.', ok: false };
  }
}

export async function getUserSanctionsApi(userId: number): Promise<{
  error?: string;
  ok: boolean;
  sanctions?: any[];
  user?: any;
}> {
  try {
    const res = await getApi(API_ROUTES.users.sanctions(userId));
    const data = await res.json();
    if (res.ok && data.ok) {
      return { ok: true, sanctions: data.sanctions || [], user: data.user };
    }
    return { error: data.error || 'Error al obtener sanciones.', ok: false };
  } catch {
    return { error: 'Error al conectar con el servidor.', ok: false };
  }
}

export async function revokeUserSanctionApi(
  userId: number,
  sanctionId: number
): Promise<{ error?: string; ok: boolean }> {
  try {
    const res = await deleteApi(API_ROUTES.users.revokeSanction(userId, sanctionId));
    const data = await res.json();
    if (res.ok && data.ok) return { ok: true };
    return { error: data.error || 'Error al revocar sanción.', ok: false };
  } catch {
    return { error: 'Error al conectar con el servidor.', ok: false };
  }
}

export async function getAllRolesApi(): Promise<{ error?: string; ok: boolean; roles?: any[] }> {
  try {
    const res = await getApi(API_ROUTES.users.allRoles);
    const data = await res.json();
    if (res.ok && data.ok) return { ok: true, roles: data.roles || [] };
    return { error: data.error || 'Error al obtener lista de roles.', ok: false };
  } catch {
    return { error: 'Error al conectar con el servidor.', ok: false };
  }
}

export async function getUserManagementDataApi(userId: number): Promise<{
  activeSessionsCount?: number;
  error?: string;
  ok: boolean;
  preferences?: any;
  user?: any;
}> {
  try {
    const res = await getApi(API_ROUTES.users.manage(userId));
    const data = await res.json();
    if (res.ok && data.ok) {
      return { activeSessionsCount: data.activeSessionsCount || 0, ok: true, preferences: data.preferences, user: data.user };
    }
    return { error: data.error || 'Error al obtener datos de gestión del usuario.', ok: false };
  } catch {
    return { error: 'Error al conectar con el servidor.', ok: false };
  }
}

export async function adminUpdateUserUsernameApi(
  userId: number,
  username: string
): Promise<{ error?: string; ok: boolean; username?: string }> {
  try {
    const res = await patchApi(API_ROUTES.users.username(userId), { username });
    const data = await res.json();
    if (res.ok && data.ok) return { ok: true, username: data.username };
    return { error: data.error || 'Error al actualizar nombre de usuario.', ok: false };
  } catch {
    return { error: 'Error al conectar con el servidor.', ok: false };
  }
}

export async function adminUpdateUserEmailApi(
  userId: number,
  email: string
): Promise<{ email?: string; error?: string; ok: boolean }> {
  try {
    const res = await patchApi(API_ROUTES.users.email(userId), { email });
    const data = await res.json();
    if (res.ok && data.ok) return { email: data.email, ok: true };
    return { error: data.error || 'Error al actualizar correo electrónico.', ok: false };
  } catch {
    return { error: 'Error al actualizar correo electrónico.', ok: false };
  }
}

export async function adminUpdateUserAvatarApi(
  userId: number,
  avatarBase64: string
): Promise<{ avatar_url?: string; error?: string; ok: boolean }> {
  try {
    const res = await postApi(API_ROUTES.users.avatar(userId), { avatarBase64 });
    const data = await res.json();
    if (res.ok && data.ok) return { avatar_url: data.avatar_url, ok: true };
    return { error: data.error || 'Error al actualizar avatar.', ok: false };
  } catch {
    return { error: 'Error al conectar con el servidor.', ok: false };
  }
}

export async function adminDeleteUserAvatarApi(
  userId: number
): Promise<{ error?: string; ok: boolean }> {
  try {
    const res = await deleteApi(API_ROUTES.users.avatar(userId));
    const data = await res.json();
    if (res.ok && data.ok) return { ok: true };
    return { error: data.error || 'Error al eliminar avatar.', ok: false };
  } catch {
    return { error: 'Error al conectar con el servidor.', ok: false };
  }
}

export async function adminUpdateUserPreferencesApi(
  userId: number,
  preferences: any
): Promise<{ error?: string; ok: boolean; preferences?: any }> {
  try {
    const res = await patchApi(API_ROUTES.users.preferences(userId), preferences);
    const data = await res.json();
    if (res.ok && data.ok) return { ok: true, preferences: data.preferences };
    return { error: data.error || 'Error al actualizar preferencias.', ok: false };
  } catch {
    return { error: 'Error al conectar con el servidor.', ok: false };
  }
}

export async function adminRevokeUserSessionsApi(
  userId: number
): Promise<{ error?: string; ok: boolean }> {
  try {
    const res = await postApi(API_ROUTES.users.revokeSessions(userId));
    const data = await res.json();
    if (res.ok && data.ok) return { ok: true };
    return { error: data.error || 'Error al revocar sesiones.', ok: false };
  } catch {
    return { error: 'Error al conectar con el servidor.', ok: false };
  }
}


const templateCache = new Map<string, string>();

export async function loadTemplate(path: string): Promise<HTMLElement> {
  let html = templateCache.get(path);
  if (!html) {
    const res = await fetch(path);
    if (!res.ok) {
      throw new Error(`Error al cargar plantilla: ${path}`);
    }
    html = await res.text();
    templateCache.set(path, html);
  }
  const wrapper = document.createElement('div');
  wrapper.innerHTML = html.trim();
  return wrapper.firstElementChild as HTMLElement;
}
