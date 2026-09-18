import { AdRowData, AdvertiserRowData } from '../types/ad.types.js';
import { AdminAuditRecord, CopilotAuditRecord, UserChatMessageRecord, UserChatSessionRecord } from '../types/audit.types.js';
import { isUserAdmin, SessionAccount, UserPayload } from '../types/auth.types.js';
import { BackupCreatePayload, BackupRecord, BackupScheduleConfig, BackupSchedulePayload, BackupTargetOptions } from '../types/backup.types.js';
import { DashboardStatsResponse } from '../types/dashboard.types.js';
import { CompensationHistoryItem, Employee, EmployeeDetailResponse, EmployeesResponse, OrgChartNode, TimeOffBalance, TimeOffRequest } from '../types/hr.types.js';
import { LogFileContent, LogFileRecord } from '../types/log.types.js';

export const API_ROUTES = {
  ads: {
    advertiserAds: (id: number | string) => `/api/ads/advertisers/${id}/ads`,
    advertiserById: (id: number | string) => `/api/ads/advertisers/${id}`,
    advertisers: '/api/ads/advertisers',
    itemById: (id: number | string) => `/api/ads/items/${id}`,
    itemStatus: (id: number | string) => `/api/ads/items/${id}/status`,
    public: '/api/ads/public',
  },
  ai: {
    chat: '/api/ai/chat',
  },
  analytics: {
    breakdown: '/api/analytics/breakdown',
    export: (range = '30d') => `/api/analytics/export?range=${encodeURIComponent(range)}`,
    financials: '/api/analytics/financials',
    overview: '/api/analytics/overview',
    query: '/api/analytics/query',
    rankings: '/api/analytics/rankings',
    schema: '/api/analytics/schema',
    trends: (range = '30d') => `/api/analytics/trends?range=${encodeURIComponent(range)}`,
  },
  auth: {
    firstChangePassword: '/api/login/first-change-password',
    login: '/api/login',
    logout: '/api/logout',
    logoutAll: '/api/logout-all',
    me: '/api/me',
    switchAccount: '/api/switch-account',
    verify2fa: '/api/login/verify-2fa',
  },
  avatar: (name: string) => `/api/avatar?name=${encodeURIComponent(name)}`,
  backups: {
    base: '/api/backups',
    byId: (id: number | string) => `/api/backups/${id}`,
    download: (id: number | string) => `/api/backups/${id}/download`,
    schedule: '/api/backups/schedule',
    scheduleTrigger: '/api/backups/schedule/trigger',
    targets: '/api/backups/targets',
  },
  config: '/api/config',
  csrfToken: '/api/csrf-token',
  dashboard: {
    stats: '/api/dashboard/stats',
  },
  health: '/health',
  hr: {
    base: '/api/hr/employees',
    byId: (id: number | string) => `/api/hr/employees/${id}`,
    careerHistory: (id: number | string) => `/api/hr/employees/${id}/career-history`,
    documentDownload: (docUuid: string, download = false) => `/api/hr/documents/${docUuid}/download${download ? '?download=true' : ''}`,
    documents: (id: number | string) => `/api/hr/employees/${id}/documents`,
    hire: '/api/hr/hire',
    orgChart: '/api/hr/org-chart',
    promotions: (id: number | string) => `/api/hr/employees/${id}/promotions`,
    status: (id: number | string) => `/api/hr/employees/${id}/status`,
    timeOff: '/api/hr/time-off',
    timeOffCalendar: '/api/hr/time-off/calendar',
    timeOffRequest: '/api/hr/time-off/request',
    timeOffReview: (id: number | string) => `/api/hr/time-off/${id}/review`,
  },
  logs: {
    audit: (params: { actorId?: number; limit?: number; month?: string } = {}) => {
      const sp = new URLSearchParams();
      if (params.actorId) sp.append('actorId', String(params.actorId));
      if (params.limit) sp.append('limit', String(params.limit));
      if (params.month) sp.append('month', params.month);
      const q = sp.toString();
      return `/api/logs/audit${q ? `?${q}` : ''}`;
    },
    base: '/api/logs',
    content: '/api/logs/content',
    copilot: (params: { adminId?: number; limit?: number; month?: string } = {}) => {
      const sp = new URLSearchParams();
      if (params.adminId) sp.append('adminId', String(params.adminId));
      if (params.limit) sp.append('limit', String(params.limit));
      if (params.month) sp.append('month', params.month);
      const q = sp.toString();
      return `/api/logs/copilot${q ? `?${q}` : ''}`;
    },
    download: (fileId: string) => `/api/logs/download?fileId=${encodeURIComponent(fileId)}`,
    userChatMessages: (sessionId: string) => `/api/logs/ai-chat/messages?sessionId=${encodeURIComponent(sessionId)}`,
    userChatSessions: (params: { limit?: number; month?: string; userId?: number } = {}) => {
      const sp = new URLSearchParams();
      if (params.userId) sp.append('userId', String(params.userId));
      if (params.limit) sp.append('limit', String(params.limit));
      if (params.month) sp.append('month', params.month);
      const q = sp.toString();
      return `/api/logs/ai-chat/sessions${q ? `?${q}` : ''}`;
    },
  },
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
  system: {
    cachePurge: '/api/system/cache/purge',
    config: '/api/system/config',
    diagnostics: '/api/system/diagnostics',
    reset: '/api/system/config/reset',
  },
  users: {
    account: (id: number | string) => `/api/users/${id}/account`,
    allRoles: '/api/users/roles/all',
    avatar: (id: number | string) => `/api/users/${id}/avatar`,
    base: '/api/users',
    byId: (id: number | string) => `/api/users/${id}`,
    email: (id: number | string) => `/api/users/${id}/email`,
    manage: (id: number | string) => `/api/users/${id}/manage`,
    preferences: (id: number | string) => `/api/users/${id}/preferences`,
    revokeSanction: (id: number | string, sanctionId: number) => `/api/users/${id}/sanctions/${sanctionId}`,
    revokeSessions: (id: number | string) => `/api/users/${id}/revoke-sessions`,
    roles: (id: number | string) => `/api/users/${id}/roles`,
    sanctions: (id: number | string) => `/api/users/${id}/sanctions`,
    username: (id: number | string) => `/api/users/${id}/username`,
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

export async function getUserDetailsApi(userId: number | string): Promise<{
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
  userId: number | string,
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
  userId: number | string,
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
  userId: number | string,
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

export async function getUserSanctionsApi(userId: number | string): Promise<{
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
  userId: number | string,
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

export async function getUserManagementDataApi(userId: number | string): Promise<{
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
  userId: number | string,
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
  userId: number | string,
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
  userId: number | string,
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
  userId: number | string
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
  userId: number | string,
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
  userId: number | string
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

export async function getSystemConfigApi(): Promise<{
  categories?: Record<string, any[]>;
  error?: string;
  items?: any[];
  map?: Record<string, any>;
  ok: boolean;
}> {
  try {
    const res = await getApi(API_ROUTES.system.config);
    const data = await res.json();
    if (res.ok && (data.ok || data.success)) {
      return {
        categories: data.categories || data.data?.categories,
        items: data.items || data.data?.items,
        map: data.map || data.data?.map,
        ok: true,
      };
    }
    return { error: data.error || 'Error al obtener la configuración del sistema.', ok: false };
  } catch {
    return { error: 'Error de conexión al cargar la configuración.', ok: false };
  }
}

export async function updateSystemConfigApi(configs: Record<string, any>): Promise<{ error?: string; message?: string; ok: boolean }> {
  try {
    const res = await putApi(API_ROUTES.system.config, { configs });
    const data = await res.json();
    if (res.ok && (data.ok || data.success)) {
      return { message: data.message || data.data?.message || 'Configuración actualizada con éxito.', ok: true };
    }
    return { error: data.error || 'Error al guardar la configuración.', ok: false };
  } catch {
    return { error: 'Error de conexión al guardar la configuración.', ok: false };
  }
}

export async function resetSystemConfigApi(category?: string): Promise<{ error?: string; message?: string; ok: boolean }> {
  try {
    const res = await postApi(API_ROUTES.system.reset, { category });
    const data = await res.json();
    if (res.ok && (data.ok || data.success)) {
      return { message: data.message || data.data?.message || 'Valores restablecidos con éxito.', ok: true };
    }
    return { error: data.error || 'Error al restablecer la configuración.', ok: false };
  } catch {
    return { error: 'Error de conexión al restablecer la configuración.', ok: false };
  }
}

export async function getSystemDiagnosticsApi(): Promise<{
  data?: {
    mysql: { canvasDbSizeMb: string; identityDbSizeMb: string; pingMs: number; status: string; totalTables: number };
    node: { heapTotalMb: string; heapUsedMb: string; nodeVersion: string; platform: string; rssMb: string; uptimeSeconds: number };
    redis: { clients: number; keysCount: number; memoryHuman: string; pingMs: number; status: string; uptimeSeconds: number };
  };
  error?: string;
  ok: boolean;
}> {
  try {
    const res = await getApi(API_ROUTES.system.diagnostics);
    const data = await res.json();
    if (res.ok && (data.ok || data.success)) {
      return { data: data.data || data, ok: true };
    }
    return { error: data.error || 'Error al obtener diagnóstico del sistema.', ok: false };
  } catch {
    return { error: 'Error de conexión al cargar diagnóstico.', ok: false };
  }
}

export async function purgeRedisCacheApi(): Promise<{ error?: string; message?: string; ok: boolean }> {
  try {
    const res = await postApi(API_ROUTES.system.cachePurge);
    const data = await res.json();
    if (res.ok && (data.ok || data.success)) {
      return { message: data.message || data.data?.message || 'Caché de Redis purgada con éxito.', ok: true };
    }
    return { error: data.error || 'Error al purgar la caché.', ok: false };
  } catch {
    return { error: 'Error de conexión al purgar la caché.', ok: false };
  }
}

export async function getBackupsApi(params?: {
  limit?: number;
  page?: number;
  search?: string;
  status?: string;
}): Promise<{
  backups?: BackupRecord[];
  error?: string;
  ok: boolean;
  pagination?: { limit: number; page: number; total: number; totalPages: number };
}> {
  try {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', String(params.page));
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.search) query.set('search', params.search);
    if (params?.status && params.status !== 'all') query.set('status', params.status);

    const url = `${API_ROUTES.backups.base}${query.toString() ? `?${query.toString()}` : ''}`;
    const res = await getApi(url);
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.ok) {
      return {
        backups: data.backups || [],
        ok: true,
        pagination: data.pagination,
      };
    }
    return { error: data.error || 'Error al cargar las copias de seguridad.', ok: false };
  } catch {
    return { error: 'Error de conexión al cargar las copias de seguridad.', ok: false };
  }
}

export async function getBackupTargetsApi(): Promise<{
  error?: string;
  ok: boolean;
  targets?: BackupTargetOptions;
}> {
  try {
    const res = await getApi(API_ROUTES.backups.targets);
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.ok) {
      return {
        ok: true,
        targets: data.targets,
      };
    }
    return { error: data.error || 'Error al consultar destinos de respaldo.', ok: false };
  } catch {
    return { error: 'Error de conexión al consultar destinos de respaldo.', ok: false };
  }
}

export async function createBackupApi(payload: BackupCreatePayload): Promise<{
  backup?: BackupRecord;
  error?: string;
  ok: boolean;
}> {
  try {
    const res = await postApi(API_ROUTES.backups.base, payload);
    const data = await res.json().catch(() => ({}));
    if (res.ok && (data.ok || data.success)) {
      return {
        backup: data.backup,
        ok: true,
      };
    }
    return { error: data.error || 'Error al iniciar la copia de seguridad.', ok: false };
  } catch {
    return { error: 'Error de conexión al solicitar la copia de seguridad.', ok: false };
  }
}

export async function getBackupStatusApi(idOrUuid: number | string): Promise<{
  backup?: BackupRecord;
  error?: string;
  ok: boolean;
}> {
  try {
    const res = await getApi(API_ROUTES.backups.byId(idOrUuid));
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.ok) {
      return {
        backup: data.backup,
        ok: true,
      };
    }
    return { error: data.error || 'Error al consultar estado de la copia de seguridad.', ok: false };
  } catch {
    return { error: 'Error de conexión al consultar el estado.', ok: false };
  }
}

export async function deleteBackupApi(idOrUuid: number | string): Promise<{
  error?: string;
  ok: boolean;
}> {
  try {
    const res = await deleteApi(API_ROUTES.backups.byId(idOrUuid));
    const data = await res.json().catch(() => ({}));
    if (res.ok && (data.ok || data.success)) {
      return { ok: true };
    }
    return { error: data.error || 'Error al eliminar la copia de seguridad.', ok: false };
  } catch {
    return { error: 'Error de conexión al eliminar la copia de seguridad.', ok: false };
  }
}

export async function getBackupScheduleApi(): Promise<{
  error?: string;
  ok: boolean;
  schedule?: BackupScheduleConfig;
}> {
  try {
    const res = await getApi(API_ROUTES.backups.schedule);
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.ok) {
      return { ok: true, schedule: data.schedule };
    }
    return { error: data.error || 'Error al consultar la configuración de programación.', ok: false };
  } catch {
    return { error: 'Error de conexión al consultar la programación.', ok: false };
  }
}

export async function saveBackupScheduleApi(payload: BackupSchedulePayload): Promise<{
  error?: string;
  ok: boolean;
  schedule?: BackupScheduleConfig;
}> {
  try {
    const res = await postApi(API_ROUTES.backups.schedule, payload);
    const data = await res.json().catch(() => ({}));
    if (res.ok && (data.ok || data.success)) {
      return { ok: true, schedule: data.schedule };
    }
    return { error: data.error || 'Error al guardar la configuración de programación.', ok: false };
  } catch {
    return { error: 'Error de conexión al guardar la programación.', ok: false };
  }
}

export async function triggerBackupScheduleApi(): Promise<{
  backup?: BackupRecord;
  error?: string;
  ok: boolean;
}> {
  try {
    const res = await postApi(API_ROUTES.backups.scheduleTrigger, {});
    const data = await res.json().catch(() => ({}));
    if (res.ok && (data.ok || data.success)) {
      return { backup: data.backup, ok: true };
    }
    return { error: data.error || 'Error al ejecutar la copia de seguridad programada.', ok: false };
  } catch {
    return { error: 'Error de conexión al ejecutar el respaldo.', ok: false };
  }
}

export async function getLogFilesApi(): Promise<{
  error?: string;
  files?: LogFileRecord[];
  ok: boolean;
}> {
  try {
    const res = await getApi(API_ROUTES.logs.base);
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.ok) {
      return { files: data.files, ok: true };
    }
    return { error: data.error || 'Error al obtener la lista de registros de logs.', ok: false };
  } catch {
    return { error: 'Error de conexión al cargar archivos de logs.', ok: false };
  }
}

export async function getLogContentApi(fileIds: string[]): Promise<{
  error?: string;
  files?: LogFileContent[];
  ok: boolean;
}> {
  try {
    const res = await postApi(API_ROUTES.logs.content, { fileIds });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.ok) {
      return { files: data.files, ok: true };
    }
    return { error: data.error || 'Error al obtener el contenido de los registros seleccionados.', ok: false };
  } catch {
    return { error: 'Error de conexión al cargar contenido de los logs.', ok: false };
  }
}

export async function getAdminAuditLogsApi(params: { actorId?: number; limit?: number; month?: string } = {}): Promise<{
  error?: string;
  logs?: AdminAuditRecord[];
  ok: boolean;
}> {
  try {
    const res = await getApi(API_ROUTES.logs.audit(params));
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.ok) {
      return { logs: data.logs, ok: true };
    }
    return { error: data.error || 'Error al obtener registros de auditoría.', ok: false };
  } catch {
    return { error: 'Error de conexión al cargar registros de auditoría.', ok: false };
  }
}

export async function getCopilotAuditLogsApi(params: { adminId?: number; limit?: number; month?: string } = {}): Promise<{
  error?: string;
  logs?: CopilotAuditRecord[];
  ok: boolean;
}> {
  try {
    const res = await getApi(API_ROUTES.logs.copilot(params));
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.ok) {
      return { logs: data.logs, ok: true };
    }
    return { error: data.error || 'Error al obtener consultas de Copilot.', ok: false };
  } catch {
    return { error: 'Error de conexión al cargar consultas de Copilot.', ok: false };
  }
}

export async function getUserChatSessionsApi(params: { limit?: number; month?: string; userId?: number } = {}): Promise<{
  error?: string;
  ok: boolean;
  sessions?: UserChatSessionRecord[];
}> {
  try {
    const res = await getApi(API_ROUTES.logs.userChatSessions(params));
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.ok) {
      return { ok: true, sessions: data.sessions };
    }
    return { error: data.error || 'Error al obtener sesiones de chat.', ok: false };
  } catch {
    return { error: 'Error de conexión al cargar sesiones de chat.', ok: false };
  }
}

export async function getUserChatMessagesApi(sessionId: string): Promise<{
  error?: string;
  messages?: UserChatMessageRecord[];
  ok: boolean;
}> {
  try {
    const res = await getApi(API_ROUTES.logs.userChatMessages(sessionId));
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.ok) {
      return { messages: data.messages, ok: true };
    }
    return { error: data.error || 'Error al obtener mensajes de la conversación.', ok: false };
  } catch {
    return { error: 'Error de conexión al cargar mensajes de chat.', ok: false };
  }
}

export async function getDashboardStatsApi(): Promise<{
  error?: string;
  ok: boolean;
  stats?: DashboardStatsResponse;
}> {
  try {
    const res = await getApi(API_ROUTES.dashboard.stats);
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.ok) {
      return { ok: true, stats: data.stats };
    }
    return { error: data.error || 'Error al cargar estadísticas del dashboard.', ok: false };
  } catch {
    return { error: 'Error de conexión al cargar estadísticas del dashboard.', ok: false };
  }
}

export async function getAdvertisersApi(params: {
  limit?: number;
  page?: number;
  search?: string;
  status?: string;
  type?: string;
} = {}): Promise<{
  advertisers?: AdvertiserRowData[];
  error?: string;
  ok: boolean;
  pagination?: { limit: number; page: number; total: number; totalPages: number };
}> {
  try {
    const q = new URLSearchParams();
    if (params.page) q.set('page', String(params.page));
    if (params.limit) q.set('limit', String(params.limit));
    if (params.search) q.set('search', params.search);
    if (params.type && params.type !== 'all') q.set('type', params.type);
    if (params.status && params.status !== 'all') q.set('status', params.status);
    const qs = q.toString() ? `?${q.toString()}` : '';
    const res = await getApi(`${API_ROUTES.ads.advertisers}${qs}`);
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.ok) {
      return { advertisers: data.advertisers, ok: true, pagination: data.pagination };
    }
    return { error: data.error || 'Error al obtener anunciantes.', ok: false };
  } catch {
    return { error: 'Error de conexión al cargar anunciantes.', ok: false };
  }
}

export async function createAdvertiserApi(dto: {
  contact_email?: string | null;
  name: string;
  notes?: string | null;
  provider_name?: string | null;
  status?: string;
  type: string;
  website?: string | null;
}): Promise<{ advertiser?: AdvertiserRowData; error?: string; ok: boolean }> {
  try {
    const res = await postApi(API_ROUTES.ads.advertisers, dto);
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.ok) {
      return { advertiser: data.advertiser, ok: true };
    }
    return { error: data.error || 'Error al crear anunciante.', ok: false };
  } catch {
    return { error: 'Error de conexión al crear anunciante.', ok: false };
  }
}

export async function updateAdvertiserApi(id: number | string, dto: {
  contact_email?: string | null;
  name?: string;
  notes?: string | null;
  provider_name?: string | null;
  status?: string;
  type?: string;
  website?: string | null;
}): Promise<{ advertiser?: AdvertiserRowData; error?: string; ok: boolean }> {
  try {
    const res = await putApi(API_ROUTES.ads.advertiserById(id), dto);
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.ok) {
      return { advertiser: data.advertiser, ok: true };
    }
    return { error: data.error || 'Error al actualizar anunciante.', ok: false };
  } catch {
    return { error: 'Error de conexión al actualizar anunciante.', ok: false };
  }
}

export async function deleteAdvertiserApi(id: number | string): Promise<{ error?: string; ok: boolean }> {
  try {
    const res = await deleteApi(API_ROUTES.ads.advertiserById(id));
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.ok) {
      return { ok: true };
    }
    return { error: data.error || 'Error al eliminar anunciante.', ok: false };
  } catch {
    return { error: 'Error de conexión al eliminar anunciante.', ok: false };
  }
}

export async function getAdvertiserAdsApi(advertiserId: number | string): Promise<{
  ads?: AdRowData[];
  error?: string;
  ok: boolean;
}> {
  try {
    const res = await getApi(API_ROUTES.ads.advertiserAds(advertiserId));
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.ok) {
      return { ads: data.ads, ok: true };
    }
    return { error: data.error || 'Error al obtener anuncios del anunciante.', ok: false };
  } catch {
    return { error: 'Error de conexión al cargar anuncios.', ok: false };
  }
}

export async function createAdApi(advertiserId: number | string, dto: {
  badge_text?: string;
  description?: string | null;
  frequency?: number;
  image_url: string;
  placements?: string;
  priority?: string;
  status?: string;
  target_url: string;
  title: string;
}): Promise<{ ad?: AdRowData; error?: string; ok: boolean }> {
  try {
    const res = await postApi(API_ROUTES.ads.advertiserAds(advertiserId), dto);
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.ok) {
      return { ad: data.ad, ok: true };
    }
    return { error: data.error || 'Error al crear anuncio.', ok: false };
  } catch {
    return { error: 'Error de conexión al crear anuncio.', ok: false };
  }
}

export async function updateAdApi(id: number | string, dto: {
  badge_text?: string;
  description?: string | null;
  frequency?: number;
  image_url?: string;
  placements?: string;
  priority?: string;
  status?: string;
  target_url?: string;
  title?: string;
}): Promise<{ ad?: AdRowData; error?: string; ok: boolean }> {
  try {
    const res = await putApi(API_ROUTES.ads.itemById(id), dto);
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.ok) {
      return { ad: data.ad, ok: true };
    }
    return { error: data.error || 'Error al actualizar anuncio.', ok: false };
  } catch {
    return { error: 'Error de conexión al actualizar anuncio.', ok: false };
  }
}

export async function deleteAdApi(id: number | string): Promise<{ error?: string; ok: boolean }> {
  try {
    const res = await deleteApi(API_ROUTES.ads.itemById(id));
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.ok) {
      return { ok: true };
    }
    return { error: data.error || 'Error al eliminar anuncio.', ok: false };
  } catch {
    return { error: 'Error de conexión al eliminar anuncio.', ok: false };
  }
}

export async function toggleAdStatusApi(id: number | string, status?: string): Promise<{
  ad?: AdRowData;
  error?: string;
  ok: boolean;
}> {
  try {
    const res = await patchApi(API_ROUTES.ads.itemStatus(id), status ? { status } : {});
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.ok) {
      return { ad: data.ad, ok: true };
    }
    return { error: data.error || 'Error al cambiar estado del anuncio.', ok: false };
  } catch {
    return { error: 'Error de conexión al actualizar estado del anuncio.', ok: false };
  }
}

export async function getAnalyticsOverviewApi(): Promise<{ data?: any; error?: string; ok: boolean }> {
  try {
    const res = await getApi(API_ROUTES.analytics.overview);
    const data = await res.json();
    if (res.ok) return { data, ok: true };
    return { error: data.error || 'Error al cargar analíticas.', ok: false };
  } catch {
    return { error: 'Error de conexión al cargar analíticas.', ok: false };
  }
}

export async function getAnalyticsTrendsApi(range = '30d'): Promise<{ data?: any[]; error?: string; ok: boolean }> {
  try {
    const res = await getApi(API_ROUTES.analytics.trends(range));
    const data = await res.json();
    if (res.ok) return { data, ok: true };
    return { error: data.error || 'Error al cargar tendencias.', ok: false };
  } catch {
    return { error: 'Error de conexión al cargar tendencias.', ok: false };
  }
}

export async function getAnalyticsBreakdownApi(): Promise<{ data?: any; error?: string; ok: boolean }> {
  try {
    const res = await getApi(API_ROUTES.analytics.breakdown);
    const data = await res.json();
    if (res.ok) return { data, ok: true };
    return { error: data.error || 'Error al cargar desgloses.', ok: false };
  } catch {
    return { error: 'Error de conexión al cargar desgloses.', ok: false };
  }
}

export async function getAnalyticsFinancialsApi(): Promise<{ data?: any; error?: string; ok: boolean }> {
  try {
    const res = await getApi(API_ROUTES.analytics.financials);
    const data = await res.json();
    if (res.ok) return { data, ok: true };
    return { error: data.error || 'Error al cargar datos financieros.', ok: false };
  } catch {
    return { error: 'Error de conexión al cargar datos financieros.', ok: false };
  }
}

export async function getAnalyticsRankingsApi(): Promise<{ data?: any; error?: string; ok: boolean }> {
  try {
    const res = await getApi(API_ROUTES.analytics.rankings);
    const data = await res.json();
    if (res.ok) return { data, ok: true };
    return { error: data.error || 'Error al cargar rankings.', ok: false };
  } catch {
    return { error: 'Error de conexión al cargar rankings.', ok: false };
  }
}

export async function getDatabaseSchemaApi(): Promise<{ data?: any; error?: string; ok: boolean }> {
  try {
    const res = await getApi(API_ROUTES.analytics.schema);
    const data = await res.json();
    if (res.ok) return { data, ok: true };
    return { error: data.error || 'Error al cargar esquema de base de datos.', ok: false };
  } catch {
    return { error: 'Error de conexión al cargar esquema de base de datos.', ok: false };
  }
}

export async function executeSqlQueryApi(query: string): Promise<{ data?: any; error?: string; ok: boolean }> {
  try {
    const res = await postApi(API_ROUTES.analytics.query, { query });
    const data = await res.json();
    if (res.ok) return { data, ok: true };
    return { error: data.error || 'Error al ejecutar la consulta SQL.', ok: false };
  } catch {
    return { error: 'Error de conexión al ejecutar la consulta SQL.', ok: false };
  }
}

export async function getEmployeesApi(params: { department?: string; limit?: number; page?: number; role?: string; search?: string; status?: string } = {}): Promise<{ data?: EmployeesResponse; error?: string; ok: boolean }> {
  try {
    const qs = new URLSearchParams();
    if (params.page) qs.set('page', String(params.page));
    if (params.limit) qs.set('limit', String(params.limit));
    if (params.search) qs.set('search', params.search);
    if (params.department && params.department !== 'all') qs.set('department', params.department);
    if (params.status && params.status !== 'all') qs.set('status', params.status);
    if (params.role && params.role !== 'all') qs.set('role', params.role);

    const url = `${API_ROUTES.hr.base}${qs.toString() ? `?${qs.toString()}` : ''}`;
    const res = await getApi(url);
    const data = await res.json();
    if (res.ok) return { data, ok: true };
    return { error: data.error || 'Error al cargar colaboradores.', ok: false };
  } catch {
    return { error: 'Error de conexión al cargar colaboradores.', ok: false };
  }
}

export async function getEmployeeDetailsApi(id: number | string): Promise<{ data?: EmployeeDetailResponse; error?: string; ok: boolean }> {
  try {
    const res = await getApi(API_ROUTES.hr.byId(id));
    const data = await res.json();
    if (res.ok) return { data, ok: true };
    return { error: data.error || 'Error al cargar expediente del colaborador.', ok: false };
  } catch {
    return { error: 'Error de conexión al cargar expediente.', ok: false };
  }
}

export async function hireEmployeeApi(formData: FormData): Promise<{ data?: { employee: Employee; temporaryPassword?: string }; error?: string; ok: boolean }> {
  try {
    const res = await apiRequest(API_ROUTES.hr.hire, {
      body: formData,
      method: 'POST',
    });
    const data = await res.json();
    if (res.ok) return { data, ok: true };
    return { error: data.error || 'Error al procesar la contratación.', ok: false };
  } catch {
    return { error: 'Error de conexión al procesar la contratación.', ok: false };
  }
}

export async function updateEmployeeStatusApi(id: number | string, status: string): Promise<{ error?: string; ok: boolean }> {
  try {
    const res = await postApi(API_ROUTES.hr.status(id), { status });
    const data = await res.json();
    if (res.ok) return { ok: true };
    return { error: data.error || 'Error al actualizar estado laboral.', ok: false };
  } catch {
    return { error: 'Error de conexión al actualizar estado.', ok: false };
  }
}

export async function uploadEmployeeDocumentApi(id: number | string, formData: FormData): Promise<{ data?: any; error?: string; ok: boolean }> {
  try {
    const res = await apiRequest(API_ROUTES.hr.documents(id), {
      body: formData,
      method: 'POST',
    });
    const data = await res.json();
    if (res.ok) return { data, ok: true };
    return { error: data.error || 'Error al subir el documento.', ok: false };
  } catch {
    return { error: 'Error de conexión al subir el documento.', ok: false };
  }
}

export async function getOrgChartApi(): Promise<{ data?: { orgChart: OrgChartNode[] }; error?: string; ok: boolean }> {
  try {
    const res = await getApi(API_ROUTES.hr.orgChart);
    const data = await res.json();
    if (res.ok) return { data, ok: true };
    return { error: data.error || 'Error al cargar el organigrama.', ok: false };
  } catch {
    return { error: 'Error de conexión al cargar el organigrama.', ok: false };
  }
}

export async function promoteEmployeeApi(
  id: number | string,
  payload: {
    change_type: string;
    currency?: string;
    effective_date?: string;
    new_department?: string;
    new_job_title?: string;
    new_platform_role?: string;
    new_salary?: number;
    reason?: string;
  }
): Promise<{ data?: { historyRecord: CompensationHistoryItem }; error?: string; ok: boolean }> {
  try {
    const res = await postApi(API_ROUTES.hr.promotions(id), payload);
    const data = await res.json();
    if (res.ok) return { data, ok: true };
    return { error: data.error || 'Error al registrar promoción/ajuste.', ok: false };
  } catch {
    return { error: 'Error de conexión al registrar promoción.', ok: false };
  }
}

export async function getCareerHistoryApi(id: number | string): Promise<{ data?: { history: CompensationHistoryItem[] }; error?: string; ok: boolean }> {
  try {
    const res = await getApi(API_ROUTES.hr.careerHistory(id));
    const data = await res.json();
    if (res.ok) return { data, ok: true };
    return { error: data.error || 'Error al obtener historial.', ok: false };
  } catch {
    return { error: 'Error de conexión al obtener historial.', ok: false };
  }
}

export async function getTimeOffRequestsApi(params: { department?: string; limit?: number; page?: number; status?: string } = {}): Promise<{
  data?: { pagination: { limit: number; page: number; total: number; totalPages: number }; requests: TimeOffRequest[] };
  error?: string;
  ok: boolean;
}> {
  try {
    const qs = new URLSearchParams();
    if (params.page) qs.set('page', String(params.page));
    if (params.limit) qs.set('limit', String(params.limit));
    if (params.status && params.status !== 'all') qs.set('status', params.status);
    if (params.department && params.department !== 'all') qs.set('department', params.department);

    const url = `${API_ROUTES.hr.timeOff}${qs.toString() ? `?${qs.toString()}` : ''}`;
    const res = await getApi(url);
    const data = await res.json();
    if (res.ok) return { data, ok: true };
    return { error: data.error || 'Error al cargar solicitudes de vacaciones.', ok: false };
  } catch {
    return { error: 'Error de conexión al cargar solicitudes.', ok: false };
  }
}

export async function submitTimeOffRequestApi(payload: {
  employee_id: number;
  end_date: string;
  reason?: string;
  request_type: string;
  start_date: string;
  total_days?: number;
}): Promise<{ data?: { request: TimeOffRequest }; error?: string; ok: boolean }> {
  try {
    const res = await postApi(API_ROUTES.hr.timeOffRequest, payload);
    const data = await res.json();
    if (res.ok) return { data, ok: true };
    return { error: data.error || 'Error al registrar solicitud de vacaciones.', ok: false };
  } catch {
    return { error: 'Error de conexión al enviar solicitud.', ok: false };
  }
}

export async function reviewTimeOffRequestApi(
  id: number | string,
  payload: { rejection_reason?: string; status: 'approved' | 'rejected' }
): Promise<{ data?: { request: TimeOffRequest }; error?: string; ok: boolean }> {
  try {
    const res = await postApi(API_ROUTES.hr.timeOffReview(id), payload);
    const data = await res.json();
    if (res.ok) return { data, ok: true };
    return { error: data.error || 'Error al revisar solicitud.', ok: false };
  } catch {
    return { error: 'Error de conexión al procesar revisión.', ok: false };
  }
}

export async function getTimeOffCalendarApi(params: { month?: number; year?: number } = {}): Promise<{
  data?: { calendar: Array<{ department: string; employee_id: number; employee_name: string; end_date: string; id: number; request_type: string; start_date: string; total_days: number }> };
  error?: string;
  ok: boolean;
}> {
  try {
    const qs = new URLSearchParams();
    if (params.month) qs.set('month', String(params.month));
    if (params.year) qs.set('year', String(params.year));

    const url = `${API_ROUTES.hr.timeOffCalendar}${qs.toString() ? `?${qs.toString()}` : ''}`;
    const res = await getApi(url);
    const data = await res.json();
    if (res.ok) return { data, ok: true };
    return { error: data.error || 'Error al cargar calendario de ausencias.', ok: false };
  } catch {
    return { error: 'Error de conexión al cargar calendario.', ok: false };
  }
}

export async function firstLoginChangePasswordApi(payload: {
  newPassword: string;
  tempToken: string;
}): Promise<{ accounts?: SessionAccount[]; error?: string; message?: string; ok: boolean; user?: UserPayload }> {
  try {
    const res = await postApi(API_ROUTES.auth.firstChangePassword, payload);
    const data = await res.json();
    if (res.ok && data.ok) {
      return { accounts: data.accounts, message: data.message, ok: true, user: data.user };
    }
    return { error: data.error || 'Error al actualizar contraseña.', ok: false };
  } catch {
    return { error: 'Error al conectar con el servidor.', ok: false };
  }
}

export async function sendAiAssistantMessageApi(
  message: string,
  history: Array<{ content: string; role: 'assistant' | 'user' }> = [],
  pageContext: string = '/analytics'
): Promise<{ data?: { queriesExecuted: Array<{ executionTimeMs: number; rowsCount: number; sql: string }>; reply: string; success: boolean }; error?: string; ok: boolean }> {
  try {
    const res = await postApi(API_ROUTES.ai.chat, { history, message, pageContext });
    const data = await res.json();
    if (res.ok) return { data, ok: true };
    return { error: data.error || 'Error al comunicarse con el asistente.', ok: false };
  } catch {
    return { error: 'Error de conexión con el asistente.', ok: false };
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
