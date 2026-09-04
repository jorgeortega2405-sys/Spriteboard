/**
 * Servicio de Estado de Registro Multi-Etapa
 * Persiste datos temporales entre etapas usando sessionStorage
 */

const REG_STORAGE_KEY = 'sprite_reg_flow';

export function getRegistrationState() {
  try {
    const raw = sessionStorage.getItem(REG_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveStage1Data(email, password) {
  const current = getRegistrationState();
  const updated = {
    ...current,
    email: email.trim().toLowerCase(),
    password: String(password),
    step: 2,
  };
  sessionStorage.setItem(REG_STORAGE_KEY, JSON.stringify(updated));
}

export function saveStage2Data(username) {
  const current = getRegistrationState();
  const updated = {
    ...current,
    username: username.trim(),
    step: 3,
  };
  sessionStorage.setItem(REG_STORAGE_KEY, JSON.stringify(updated));
}

export function clearRegistrationState() {
  sessionStorage.removeItem(REG_STORAGE_KEY);
}

export function hasStage1Data() {
  const state = getRegistrationState();
  return Boolean(state.email && state.password);
}

export function hasStage2Data() {
  const state = getRegistrationState();
  return Boolean(state.email && state.password && state.username);
}
