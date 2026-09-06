/**
 * Servicio de Estado Temporal de Verificación Adicional 2FA para Login
 * Persiste el token temporal y email entre /login y /login/verification-aditional
 */

const TWO_FACTOR_STORAGE_KEY = 'sprite_2fa_login_flow';

function getCookie(name) {
  try {
    if (typeof document === 'undefined' || !document.cookie) return null;
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) {
      return decodeURIComponent(parts.pop().split(';').shift().trim());
    }
    return null;
  } catch {
    return null;
  }
}

export function getTwoFactorState() {
  try {
    const raw = sessionStorage.getItem(TWO_FACTOR_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    if (parsed.tempToken && parsed.email) {
      return parsed;
    }
  } catch (_) {}

  // Fallback 1: Cookies temporales establecidas por la redirección de Google OAuth
  const cookieToken = getCookie('2fa_temp_token');
  const cookieEmail = getCookie('2fa_temp_email');
  if (cookieToken && cookieEmail) {
    saveTwoFactorLoginState(cookieToken, cookieEmail);
    return { tempToken: cookieToken, email: cookieEmail };
  }

  // Fallback 2: Parámetros de consulta en la URL actual
  try {
    if (typeof window !== 'undefined' && window.location && window.location.search) {
      const params = new URLSearchParams(window.location.search);
      const urlToken = params.get('token');
      const urlEmail = params.get('email');
      if (urlToken && urlEmail) {
        saveTwoFactorLoginState(urlToken, urlEmail);
        return { tempToken: urlToken, email: urlEmail };
      }
    }
  } catch (_) {}

  return {};
}

export function saveTwoFactorLoginState(tempToken, email) {
  const data = {
    tempToken: String(tempToken).trim(),
    email: String(email).trim().toLowerCase(),
    timestamp: Date.now(),
  };
  try {
    sessionStorage.setItem(TWO_FACTOR_STORAGE_KEY, JSON.stringify(data));
  } catch (_) {}
}

export function clearTwoFactorState() {
  try {
    sessionStorage.removeItem(TWO_FACTOR_STORAGE_KEY);
  } catch (_) {}
  try {
    document.cookie = '2fa_temp_token=; Max-Age=0; path=/;';
    document.cookie = '2fa_temp_email=; Max-Age=0; path=/;';
  } catch (_) {}
}

export function hasTwoFactorLoginData() {
  const state = getTwoFactorState();
  return Boolean(state.tempToken && state.email);
}
