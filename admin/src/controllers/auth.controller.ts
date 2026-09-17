import crypto from 'crypto';
import { Request, Response } from 'express';
import { getCurrentUser, getLinkedAccounts } from '../middlewares/auth.middleware.js';
import { getClientIp } from '../middlewares/rate-limit.middleware.js';
import { addAccountToSession, clearSessionCookie, removeAccountFromSession, revokeAllUserSessions, switchAccountInSession, verifyPassword } from '../services/auth.service.js';
import { getGoogleAuthUrl, processAdminGoogleAuthCallback, STATE_COOKIE_NAME } from '../services/google.service.js';
import { logger } from '../services/logger.service.js';
import { getUserEffectivePermissions } from '../services/role.service.js';
import { consumePending2FALogin, savePending2FALogin, verifyTotpCode } from '../services/two-factor.service.js';
import { findUserByEmail, findUserById, getActiveUserSanction, getUser2FASecret, updateUserLastLoginGeo, verifyAndConsumeBackupCode } from '../services/user.service.js';
import { isUserAdmin } from '../types/auth.types.js';
import { sanitizeUser, sendBadRequest, sendForbidden, sendInternalError, sendSuccess, sendUnauthorized } from '../utils/http.util.js';

export async function login(req: Request, res: Response): Promise<void> {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      sendBadRequest(res, 'Ingresa correo y contraseña.');
      return;
    }

    const trimmedEmail = String(email).trim().toLowerCase();
    const userRow = await findUserByEmail(trimmedEmail);

    if (!userRow || !userRow.password_hash) {
      logger.security.warn('Intento de inicio de sesión fallido en Admin: correo no encontrado', { email: trimmedEmail });
      sendUnauthorized(res, 'Credenciales inválidas.');
      return;
    }

    const isMatch = await verifyPassword(String(password), userRow.password_hash);

    if (!isMatch) {
      logger.security.warn('Intento de inicio de sesión fallido en Admin: contraseña incorrecta', { email: trimmedEmail });
      sendUnauthorized(res, 'Credenciales inválidas.');
      return;
    }

    if (!isUserAdmin(userRow.role, userRow.roles)) {
      logger.security.warn('Acceso denegado a Admin: usuario sin rol administrativo', { email: trimmedEmail, roles: userRow.roles });
      sendForbidden(res, 'Acceso denegado. No tienes permisos de administrador para acceder a este panel.');
      return;
    }

    const activeSanction = await getActiveUserSanction(userRow.id);
    if (activeSanction) {
      logger.security.warn('Intento de inicio de sesión de usuario sancionado en Admin', { sanctionType: activeSanction.type, userId: userRow.id });
      sendForbidden(res, 'Tu cuenta se encuentra suspendida o bloqueada.');
      return;
    }

    if (userRow.two_factor_enabled) {
      const tempToken = crypto.randomBytes(32).toString('hex');
      await savePending2FALogin(tempToken, { email: userRow.email, userId: userRow.id }, 300);
      logger.security.info('Inicio de sesión en Admin requiere segundo factor 2FA', {
        email: userRow.email,
        userId: userRow.id,
      });

      sendSuccess(res, {
        email: userRow.email,
        requires2FA: true,
        tempToken,
      });
      return;
    }

    userRow.permissions = await getUserEffectivePermissions(userRow.id, userRow.role, userRow.roles);
    const user = sanitizeUser(userRow);
    const clientIp = getClientIp(req);
    void updateUserLastLoginGeo(user.id, { ip: clientIp });

    const session = await addAccountToSession(res, req, user);

    logger.security.info('Inicio de sesión exitoso en Admin', {
      email: user.email,
      userId: user.id,
    });

    sendSuccess(res, {
      accounts: session.accounts.map(sanitizeUser),
      message: 'Inicio de sesión exitoso.',
      user,
    });
  } catch (error) {
    sendInternalError(res, 'Error al iniciar sesión en Admin', error, 'Error al iniciar sesión. Por favor intenta más tarde.');
  }
}

export async function verify2FALogin(req: Request, res: Response): Promise<void> {
  try {
    const { code, tempToken } = req.body;

    if (!tempToken || !code) {
      sendBadRequest(res, 'Token temporal y código son requeridos.');
      return;
    }

    const pending = await consumePending2FALogin(String(tempToken));
    if (!pending) {
      sendUnauthorized(res, 'La sesión de verificación ha expirado. Inicia sesión nuevamente.');
      return;
    }

    const secret = await getUser2FASecret(pending.userId);
    let isValid = false;

    if (secret) {
      isValid = verifyTotpCode(String(code), secret);
    }

    if (!isValid) {
      isValid = await verifyAndConsumeBackupCode(pending.userId, String(code));
    }

    if (!isValid) {
      logger.security.warn('Código 2FA incorrecto en Admin', { userId: pending.userId });
      sendUnauthorized(res, 'Código 2FA incorrecto.');
      return;
    }

    const userRow = await findUserById(pending.userId);
    if (!userRow) {
      sendUnauthorized(res, 'Usuario no encontrado.');
      return;
    }

    if (!isUserAdmin(userRow.role, userRow.roles)) {
      logger.security.warn('Acceso denegado a Admin en 2FA: usuario sin rol administrativo', { roles: userRow.roles, userId: pending.userId });
      sendForbidden(res, 'Acceso denegado. No tienes permisos de administrador para acceder a este panel.');
      return;
    }

    const activeSanction = await getActiveUserSanction(userRow.id);
    if (activeSanction) {
      logger.security.warn('Intento de verificación 2FA de usuario sancionado en Admin', { sanctionType: activeSanction.type, userId: userRow.id });
      sendForbidden(res, 'Tu cuenta se encuentra suspendida o bloqueada.');
      return;
    }

    userRow.permissions = await getUserEffectivePermissions(userRow.id, userRow.role, userRow.roles);
    const user = sanitizeUser(userRow);
    const clientIp = getClientIp(req);
    void updateUserLastLoginGeo(user.id, { ip: clientIp });

    const session = await addAccountToSession(res, req, user);

    logger.security.info('Autenticación 2FA exitosa en Admin', { userId: user.id });

    sendSuccess(res, {
      accounts: session.accounts.map(sanitizeUser),
      message: 'Autenticación 2FA exitosa.',
      user,
    });
  } catch (error) {
    sendInternalError(res, 'Error al verificar 2FA en Admin', error, 'Error al procesar la verificación 2FA.');
  }
}

export async function me(req: Request, res: Response): Promise<void> {
  try {
    const currentUser = getCurrentUser(req);
    const linkedAccounts = getLinkedAccounts(req);

    if (!currentUser) {
      sendSuccess(res, { accounts: [], user: null });
      return;
    }

    const freshUser = await findUserById(currentUser.id);
    if (!freshUser || !isUserAdmin(freshUser.role, freshUser.roles)) {
      clearSessionCookie(res);
      sendSuccess(res, { accounts: [], user: null });
      return;
    }

    const activeSanction = await getActiveUserSanction(freshUser.id);
    if (activeSanction) {
      clearSessionCookie(res);
      sendSuccess(res, { accounts: [], user: null });
      return;
    }

    freshUser.permissions = await getUserEffectivePermissions(freshUser.id, freshUser.role, freshUser.roles);
    const sanitized = sanitizeUser(freshUser);
    const enrichedAccounts = await Promise.all(
      linkedAccounts.map(async (acc) => {
        const perms = await getUserEffectivePermissions(acc.id, acc.role, acc.roles);
        return sanitizeUser({ ...acc, permissions: perms });
      })
    );

    sendSuccess(res, {
      accounts: enrichedAccounts,
      user: sanitized,
    });
  } catch (error) {
    sendInternalError(res, 'Error al obtener sesión en Admin', error);
  }
}

export async function logout(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.body?.userId ? Number(req.body.userId) : undefined;
    const result = await removeAccountFromSession(res, req, userId);

    sendSuccess(res, {
      accounts: result.accounts.map(sanitizeUser),
      activeUser: result.activeUser ? sanitizeUser(result.activeUser) : null,
      message: 'Sesión cerrada exitosamente.',
      remainingCount: result.remainingCount,
    });
  } catch (error) {
    sendInternalError(res, 'Error al cerrar sesión en Admin', error);
  }
}

export async function logoutAll(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (user) {
      await revokeAllUserSessions(user.id);
    }
    clearSessionCookie(res);
    sendSuccess(res, { message: 'Todas las sesiones han sido cerradas.' });
  } catch (error) {
    sendInternalError(res, 'Error al cerrar todas las sesiones en Admin', error);
  }
}

export async function switchAccount(req: Request, res: Response): Promise<void> {
  try {
    const { userId } = req.body;
    if (!userId || typeof userId !== 'number') {
      sendBadRequest(res, 'ID de usuario inválido.');
      return;
    }

    const freshUser = await findUserById(userId);
    if (!freshUser || !isUserAdmin(freshUser.role, freshUser.roles)) {
      sendForbidden(res, 'La cuenta seleccionada no tiene permisos de administrador.');
      return;
    }

    const activeSanction = await getActiveUserSanction(freshUser.id);
    if (activeSanction) {
      sendForbidden(res, 'La cuenta seleccionada se encuentra suspendida o bloqueada.');
      return;
    }

    const result = switchAccountInSession(res, req, userId);
    if (!result.success || !result.activeUser) {
      sendUnauthorized(res, 'No se pudo cambiar a la cuenta especificada.');
      return;
    }

    freshUser.permissions = await getUserEffectivePermissions(freshUser.id, freshUser.role, freshUser.roles);
    const sanitized = sanitizeUser(freshUser);
    const enrichedAccounts = await Promise.all(
      result.accounts.map(async (acc) => {
        const perms = await getUserEffectivePermissions(acc.id, acc.role, acc.roles);
        return sanitizeUser({ ...acc, permissions: perms });
      })
    );

    sendSuccess(res, {
      accounts: enrichedAccounts,
      message: 'Cuenta cambiada exitosamente.',
      user: sanitized,
    });
  } catch (error) {
    sendInternalError(res, 'Error al cambiar de cuenta en Admin', error);
  }
}

export function googleAuth(req: Request, res: Response): void {
  try {
    const url = getGoogleAuthUrl(req, res);
    res.redirect(url);
  } catch (error) {
    sendInternalError(res, 'Error al iniciar flujo Google OAuth en Admin', error);
  }
}

export async function googleAuthCallback(req: Request, res: Response): Promise<void> {
  const { code, error, state } = req.query;
  const storedState = req.cookies?.[STATE_COOKIE_NAME];
  res.clearCookie(STATE_COOKIE_NAME);

  if (error || !code) {
    logger.security.warn('Callback de Google OAuth en Admin con error o sin código', { error });
    res.redirect('/login?error=oauth_failed');
    return;
  }

  if (!storedState || storedState !== state) {
    logger.security.warn('Callback de Google OAuth en Admin con state inválido o expirado');
    res.redirect('/login?error=invalid_state');
    return;
  }

  try {
    const clientIp = getClientIp(req);
    const user = await processAdminGoogleAuthCallback(String(code), clientIp);

    const activeSanction = await getActiveUserSanction(user.id);
    if (activeSanction) {
      logger.security.warn('Intento de login con Google en Admin de usuario sancionado', { sanctionType: activeSanction.type, userId: user.id });
      res.redirect('/login?error=account_suspended');
      return;
    }

    if (user.two_factor_enabled) {
      const tempToken = crypto.randomBytes(32).toString('hex');
      await savePending2FALogin(tempToken, { email: user.email, userId: user.id }, 300);
      logger.security.info('Login con Google en Admin requiere segundo factor 2FA', { email: user.email, userId: user.id });
      res.redirect(`/login?step=2fa&tempToken=${encodeURIComponent(tempToken)}`);
      return;
    }

    await addAccountToSession(res, req, user);

    logger.security.info('Inicio de sesión con Google exitoso en Admin', {
      email: user.email,
      userId: user.id,
    });

    res.redirect('/');
  } catch (err: any) {
    if (err.message === 'NO_ADMIN_ACCOUNT') {
      res.redirect('/login?error=no_admin_account');
      return;
    }
    if (err.message === 'FORBIDDEN_NOT_ADMIN') {
      res.redirect('/login?error=forbidden');
      return;
    }
    if (err.message === 'GOOGLE_EMAIL_NOT_VERIFIED') {
      res.redirect('/login?error=email_not_verified');
      return;
    }

    logger.security.error('Error al procesar callback de Google en Admin', err);
    res.redirect('/login?error=oauth_failed');
  }
}
