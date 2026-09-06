import crypto from 'crypto';
import { Request, Response } from 'express';
import {
  hashPassword,
  verifyPassword,
  setSessionCookie,
  clearSessionCookie,
  addAccountToSession,
  switchAccountInSession,
  removeAccountFromSession,
  revokeAllUserSessions,
  isSessionRevoked,
  getMultiAccountSession,
} from '../services/auth.service.js';
import { getClientIp } from '../middlewares/rate-limit.middleware.js';
import {
  getGoogleAuthUrl,
  getGoogleVerifyAuthUrl,
  processGoogleAuthCallback,
  STATE_COOKIE_NAME,
} from '../services/google.service.js';
import {
  generateSixDigitCode,
  savePendingRegistration,
  getPendingRegistration,
  verifyAndConsumeCode,
  savePasswordResetToken,
  verifyPasswordResetToken,
  consumePasswordResetToken,
  savePasswordChangeAuth,
} from '../services/verification.service.js';
import {
  sendVerificationCodeEmail,
  sendPasswordResetEmail,
} from '../services/mail.service.js';
import {
  findUserByEmail,
  findUserDuplicates,
  createUser,
  updateUserPassword,
  updateUserGoogleId,
  findUserById,
  verifyAndConsumeBackupCode,
} from '../services/user.service.js';
import {
  savePending2FALogin,
  getPending2FALogin,
  consumePending2FALogin,
  verifyTotpCode,
} from '../services/two-factor.service.js';
import { getCurrentUser, getLinkedAccounts } from '../middlewares/auth.middleware.js';
import { logger } from '../services/logger.service.js';
import {
  validateEmail,
  validatePassword,
  validateUsername,
  validateVerificationCode,
} from '../utils/validators.js';
import {
  sendSuccess,
  sendCreated,
  sendBadRequest,
  sendUnauthorized,
  sendNotFound,
  sendConflict,
  sendInternalError,
  sanitizeUser,
} from '../utils/http.js';

// Etapa 1: Validar correo y contraseña
export async function validateStage1(req: Request, res: Response): Promise<void> {
  try {
    const { email, password } = req.body;

    const emailValidation = validateEmail(email);
    if (!emailValidation.valid) {
      sendBadRequest(res, emailValidation.error!);
      return;
    }

    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      sendBadRequest(res, passwordValidation.error!);
      return;
    }

    const trimmedEmail = String(email).trim().toLowerCase();

    // Verificar si el correo ya existe en MySQL
    const existing = await findUserByEmail(trimmedEmail);
    if (existing) {
      sendConflict(res, 'El correo electrónico ya está registrado.');
      return;
    }

    sendSuccess(res, { message: 'Datos válidos para continuar a la etapa 2.' });
  } catch (error) {
    sendInternalError(res, 'Error al validar etapa 1 de registro', error, 'Error interno del servidor al validar datos.');
  }
}

// Etapa 2: Validar nombre de usuario, generar código de 6 dígitos, guardar en Redis y enviar correo SMTP
export async function sendRegistrationCode(req: Request, res: Response): Promise<void> {
  try {
    const { email, password, username } = req.body;

    const emailValidation = validateEmail(email);
    if (!emailValidation.valid) {
      sendBadRequest(res, emailValidation.error!);
      return;
    }

    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      sendBadRequest(res, passwordValidation.error!);
      return;
    }

    const usernameValidation = validateUsername(username);
    if (!usernameValidation.valid) {
      sendBadRequest(res, usernameValidation.error!);
      return;
    }

    const trimmedEmail = String(email).trim().toLowerCase();
    const trimmedUsername = String(username).trim();

    // Verificar disponibilidad de usuario o correo en la base de datos
    const { emailExists, usernameExists } = await findUserDuplicates(trimmedEmail, trimmedUsername);

    if (usernameExists) {
      logger.security.warn('Intento de registro con nombre de usuario existente', { username: trimmedUsername });
      sendConflict(res, 'El nombre de usuario ya está en uso.');
      return;
    }

    if (emailExists) {
      logger.security.warn('Intento de registro con correo electrónico ya existente', { email: trimmedEmail });
      sendConflict(res, 'El correo electrónico ya está registrado.');
      return;
    }

    // Generar código de 6 dígitos y hashear contraseña
    const code = generateSixDigitCode();
    const passwordHash = await hashPassword(String(password));

    // Guardar temporalmente en Redis por 15 minutos (900s)
    await savePendingRegistration(trimmedEmail, {
      username: trimmedUsername,
      passwordHash,
      code,
    });

    // Enviar código por correo mediante SMTP
    await sendVerificationCodeEmail(trimmedEmail, trimmedUsername, code);

    logger.security.info('Código de verificación enviado exitosamente', { email: trimmedEmail, username: trimmedUsername });

    sendSuccess(res, {
      message: `Código de verificación enviado exitosamente a ${trimmedEmail}.`,
    });
  } catch (error) {
    sendInternalError(res, 'Error al enviar código de registro', error, 'No se pudo enviar el correo de verificación. Inténtalo de nuevo.');
  }
}

// Etapa 3: Verificar código de 6 dígitos en Redis y crear la cuenta en MySQL
export async function verifyRegistrationCode(req: Request, res: Response): Promise<void> {
  try {
    const { email, code } = req.body;

    const emailValidation = validateEmail(email);
    if (!emailValidation.valid) {
      sendBadRequest(res, emailValidation.error!);
      return;
    }

    const codeValidation = validateVerificationCode(code);
    if (!codeValidation.valid) {
      sendBadRequest(res, codeValidation.error!);
      return;
    }

    const trimmedEmail = String(email).trim().toLowerCase();
    const cleanCode = String(code).trim();

    const verificationResult = await verifyAndConsumeCode(trimmedEmail, cleanCode);

    if (!verificationResult.success || !verificationResult.data) {
      logger.security.warn('Fallo en verificación de código de registro', { email: trimmedEmail, error: verificationResult.error });
      sendBadRequest(res, verificationResult.error || 'Código incorrecto o expirado.');
      return;
    }

    const pending = verificationResult.data;

    // Crear el usuario en la base de datos MySQL
    const newUser = await createUser({
      username: pending.username,
      email: pending.email,
      passwordHash: pending.passwordHash,
    });

    // Iniciar sesión agregando la nueva cuenta a la sesión multicuentas
    const session = await addAccountToSession(res, req, newUser);

    logger.security.info('Cuenta creada y verificada exitosamente', { userId: newUser.id, email: newUser.email });

    sendCreated(res, {
      message: 'Cuenta creada y verificada exitosamente.',
      user: sanitizeUser(newUser),
      accounts: session.accounts.map(sanitizeUser),
    });
  } catch (error) {
    sendInternalError(res, 'Error al verificar código de registro', error, 'Error interno del servidor al crear la cuenta.');
  }
}

// Reenviar código de verificación
export async function resendRegistrationCode(req: Request, res: Response): Promise<void> {
  try {
    const { email } = req.body;

    const emailValidation = validateEmail(email);
    if (!emailValidation.valid) {
      sendBadRequest(res, emailValidation.error!);
      return;
    }

    const trimmedEmail = String(email).trim().toLowerCase();
    const pending = await getPendingRegistration(trimmedEmail);

    if (!pending) {
      logger.security.warn('Intento de reenvío con sesión de registro expirada', { email: trimmedEmail });
      sendBadRequest(res, 'La sesión de registro ha expirado. Debes iniciar desde el principio.');
      return;
    }

    const newCode = generateSixDigitCode();
    await savePendingRegistration(trimmedEmail, {
      username: pending.username,
      passwordHash: pending.passwordHash,
      code: newCode,
    });

    await sendVerificationCodeEmail(trimmedEmail, pending.username, newCode);

    logger.security.info('Nuevo código de verificación enviado', { email: trimmedEmail });

    sendSuccess(res, { message: 'Nuevo código enviado exitosamente.' });
  } catch (error) {
    sendInternalError(res, 'Error al reenviar código', error, 'No se pudo reenviar el código. Inténtalo de nuevo.');
  }
}

// Inicio de sesión
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
      logger.security.warn('Intento de inicio de sesión fallido: correo no encontrado', { email: trimmedEmail });
      sendUnauthorized(res, 'Credenciales inválidas.');
      return;
    }

    const isMatch = await verifyPassword(String(password), userRow.password_hash);

    if (!isMatch) {
      logger.security.warn('Intento de inicio de sesión fallido: contraseña incorrecta', { email: trimmedEmail });
      sendUnauthorized(res, 'Credenciales inválidas.');
      return;
    }

    // Comprobar si el usuario tiene autenticación en dos pasos (2FA) activada
    if (userRow.two_factor_enabled) {
      const tempToken = crypto.randomBytes(32).toString('hex');
      await savePending2FALogin(tempToken, { userId: userRow.id, email: userRow.email }, 300);
      logger.security.info('Inicio de sesión requiere segundo factor de autenticación', {
        userId: userRow.id,
        email: userRow.email,
      });

      sendSuccess(res, {
        requires2FA: true,
        tempToken,
        email: userRow.email,
      });
      return;
    }

    const user = sanitizeUser(userRow);

    const session = await addAccountToSession(res, req, user);

    logger.security.info('Inicio de sesión exitoso', { userId: user.id, email: user.email });

    sendSuccess(res, {
      message: 'Inicio de sesión exitoso.',
      user,
      accounts: session.accounts.map(sanitizeUser),
    });
  } catch (error) {
    sendInternalError(res, 'Error al iniciar sesión', error, 'Error interno del servidor al iniciar sesión.');
  }
}

// Verificación de segundo factor (2FA) durante el inicio de sesión
export async function verify2FALogin(req: Request, res: Response): Promise<void> {
  try {
    const { tempToken, code } = req.body;

    if (!tempToken || typeof tempToken !== 'string' || !code || typeof code !== 'string') {
      sendBadRequest(res, 'Faltan parámetros requeridos.');
      return;
    }

    const pending = await getPending2FALogin(tempToken.trim());
    if (!pending) {
      logger.security.warn('Intento de verificación 2FA con token temporal inválido o expirado');
      sendUnauthorized(res, 'La sesión de verificación ha expirado. Inicia sesión nuevamente.');
      return;
    }

    const userRow = await findUserById(pending.userId);
    if (!userRow || !userRow.two_factor_enabled) {
      sendBadRequest(res, 'El usuario no tiene 2FA habilitado o no existe.');
      return;
    }

    const cleanCode = code.trim();
    let verified = false;

    // 1. Probar como código TOTP de 6 dígitos (con tolerancia de deriva ±60s)
    if (/^\d{6}$/.test(cleanCode) && userRow.two_factor_secret) {
      verified = verifyTotpCode(cleanCode, userRow.two_factor_secret, 2);
    }

    // 2. Si no fue válido como TOTP, verificar si corresponde a un código de respaldo
    if (!verified) {
      const consumed = await verifyAndConsumeBackupCode(userRow.id, cleanCode);
      if (consumed) {
        verified = true;
        logger.security.info('Código de respaldo utilizado en login 2FA', { userId: userRow.id });
      }
    }

    if (!verified) {
      logger.security.warn('Código 2FA incorrecto al iniciar sesión', { userId: userRow.id });
      sendBadRequest(res, 'El código ingresado es incorrecto o ha expirado.');
      return;
    }

    // Consumir el token temporal en Redis para evitar reutilización
    await consumePending2FALogin(tempToken.trim());

    const user = sanitizeUser(userRow);
    const session = await addAccountToSession(res, req, user);

    res.clearCookie('2fa_temp_token', { path: '/' });
    res.clearCookie('2fa_temp_email', { path: '/' });

    sendSuccess(res, {
      message: 'Inicio de sesión exitoso.',
      user,
      accounts: session.accounts.map(sanitizeUser),
    });
  } catch (error) {
    sendInternalError(
      res,
      'Error al verificar segundo factor de autenticación',
      error,
      'Error al procesar la verificación.'
    );
  }
}

// Cierre de sesión de la cuenta activa (conmuta a la siguiente si existen más)
export async function logout(req: Request, res: Response): Promise<void> {
  const result = await removeAccountFromSession(res, req);
  logger.security.info('Cierre de sesión de cuenta activa', { remainingAccounts: result.remainingCount });
  sendSuccess(res, {
    message: 'Sesión cerrada exitosamente.',
    switched: result.remainingCount > 0,
    user: result.activeUser ? sanitizeUser(result.activeUser) : null,
    accounts: result.accounts.map(sanitizeUser),
  });
}

// Cierre de todas las sesiones simultáneas con revocación en servidor y en vivo por WebSocket
export async function logoutAll(req: Request, res: Response): Promise<void> {
  const user = getCurrentUser(req);
  if (user) {
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip;
    const userAgent = req.headers['user-agent'];
    await revokeAllUserSessions(user.id, ip, userAgent);
  }
  clearSessionCookie(res);
  logger.security.info('Todas las sesiones fueron cerradas exitosamente', { userId: user?.id });
  sendSuccess(res, { message: 'Todas las sesiones fueron cerradas exitosamente.' });
}

// Conmutar entre cuentas vinculadas
export function switchAccount(req: Request, res: Response): void {
  const { user_id } = req.body;
  const targetId = Number(user_id);

  if (!targetId || isNaN(targetId)) {
    sendBadRequest(res, 'ID de cuenta inválido.');
    return;
  }

  const result = switchAccountInSession(res, req, targetId);
  if (!result.success || !result.activeUser) {
    sendBadRequest(res, 'La cuenta especificada no pertenece a las cuentas vinculadas.');
    return;
  }

  logger.security.info('Cambio de cuenta activa exitoso', { targetUserId: targetId });
  sendSuccess(res, {
    message: 'Cuenta cambiada exitosamente.',
    user: sanitizeUser(result.activeUser),
    accounts: result.accounts.map(sanitizeUser),
  });
}

// Usuario actual y cuentas vinculadas comprobando validez y revocación
export async function me(req: Request, res: Response): Promise<void> {
  const user = getCurrentUser(req);
  if (!user) {
    res.json({ user: null, accounts: [] });
    return;
  }

  const session = getMultiAccountSession(req);
  if (session) {
    const activeAccount = session.accounts.find((a) => a.id === user.id);
    const sid = activeAccount?.sessionId || session.sessionId;
    const revoked = await isSessionRevoked(user.id, session.iat, sid);
    if (revoked) {
      clearSessionCookie(res);
      res.json({ user: null, accounts: [] });
      return;
    }
  }

  const accounts = getLinkedAccounts(req);
  res.json({
    user: sanitizeUser(user),
    accounts: accounts.map(sanitizeUser),
  });
}

// Redirección a Google OAuth
export function redirectToGoogle(req: Request, res: Response): void {
  const url = getGoogleAuthUrl(req, res);
  res.redirect(url);
}

// Redirección a Google OAuth para verificación de identidad (cambio de contraseña)
export function redirectToGoogleVerify(req: Request, res: Response): void {
  const url = getGoogleVerifyAuthUrl(req, res);
  res.redirect(url);
}

// Callback de Google OAuth
export async function googleCallback(req: Request, res: Response): Promise<void> {
  try {
    const { code, state, error } = req.query;
    const storedState = req.cookies[STATE_COOKIE_NAME];
    res.clearCookie(STATE_COOKIE_NAME);

    const isVerifyFlow =
      (storedState && storedState.startsWith('verify_pwd_')) ||
      (state && String(state).startsWith('verify_pwd_'));

    if (error) {
      logger.security.warn('Google OAuth cancelado o con error', { error, isVerifyFlow });
      if (isVerifyFlow) {
        res.send(`<!DOCTYPE html><html><body><script>if (window.opener) { window.opener.postMessage({ type: 'GOOGLE_VERIFY_CANCELLED' }, window.location.origin); window.close(); } else { window.location.href = '/settings/security'; }</script></body></html>`);
        return;
      }
      res.redirect('/login?error=' + encodeURIComponent(String(error)));
      return;
    }

    if (!code || !state) {
      logger.security.warn('Google OAuth faltan parámetros requeridos');
      if (isVerifyFlow) {
        res.send(`<!DOCTYPE html><html><body><script>if (window.opener) { window.opener.postMessage({ type: 'GOOGLE_VERIFY_ERROR', error: 'Faltan parámetros de verificación.' }, window.location.origin); window.close(); } else { window.location.href = '/settings/security?error=missing_oauth_parameters'; }</script></body></html>`);
        return;
      }
      res.redirect('/login?error=missing_oauth_parameters');
      return;
    }

    if (!storedState || storedState !== state) {
      logger.security.warn('Parámetro state de Google OAuth inválido o ausente');
      if (isVerifyFlow) {
        res.send(`<!DOCTYPE html><html><body><script>if (window.opener) { window.opener.postMessage({ type: 'GOOGLE_VERIFY_ERROR', error: 'Estado de seguridad inválido o expirado.' }, window.location.origin); window.close(); } else { window.location.href = '/settings/security?error=invalid_oauth_state'; }</script></body></html>`);
        return;
      }
      res.redirect('/login?error=invalid_oauth_state');
      return;
    }

    const userPayload = await processGoogleAuthCallback(String(code));

    // Si es flujo de verificación de identidad para cambio de contraseña
    if (isVerifyFlow) {
      const currentUser = getCurrentUser(req);
      const isMatch =
        currentUser &&
        (userPayload.id === currentUser.id ||
          userPayload.google_id === currentUser.google_id ||
          userPayload.email.toLowerCase() === currentUser.email.toLowerCase());

      if (isMatch) {
        if (currentUser && !currentUser.google_id && userPayload.google_id) {
          await updateUserGoogleId(currentUser.id, userPayload.google_id);
        }
        await savePasswordChangeAuth(currentUser.id, 300);
        logger.security.info('Identidad verificada exitosamente con Google para cambio de contraseña', {
          userId: currentUser.id,
        });

        res.send(`<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Verificación Exitosa</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #0f172a; color: #fff; text-align: center; }
    .box { padding: 24px; max-width: 380px; }
    h2 { margin: 0 0 8px; font-size: 20px; font-weight: 600; color: #22c55e; }
    p { margin: 0 0 16px; color: #94a3b8; font-size: 14px; }
    button { background: #334155; color: #fff; border: 1px solid #475569; padding: 8px 18px; border-radius: 8px; font-size: 14px; cursor: pointer; }
    button:hover { background: #475569; }
  </style>
</head>
<body>
  <div class="box">
    <h2>✓ Identidad verificada</h2>
    <p>Regresando a Spriteboard...</p>
    <button type="button" onclick="window.close()">Cerrar ventana</button>
  </div>
  <script>
    const payload = { type: 'GOOGLE_VERIFY_SUCCESS' };

    // 1. BroadcastChannel (comunicación segura entre pestañas/ventanas con COOP)
    try {
      const ch = new BroadcastChannel('google_verify_channel');
      ch.postMessage(payload);
      ch.close();
    } catch (_) {}

    // 2. localStorage event (comunicación inter-pestañas del mismo origen)
    try {
      localStorage.setItem('google_verify_event', JSON.stringify({ ...payload, ts: Date.now() }));
    } catch (_) {}

    // 3. postMessage directo a opener si no fue desconectado por el navegador
    if (window.opener) {
      try {
        window.opener.postMessage(payload, window.location.origin);
      } catch (_) {}
    }

    // Intentar cerrar automáticamente la ventana
    setTimeout(() => {
      window.close();
    }, 400);
  </script>
</body>
</html>`);
        return;
      } else {
        logger.security.warn('Verificación con Google rechazada: la cuenta no coincide con el usuario activo', {
          activeUserId: currentUser?.id,
          googleEmail: userPayload.email,
        });

        res.send(`<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Error de Verificación</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #0f172a; color: #fff; text-align: center; }
    .box { padding: 24px; max-width: 380px; }
    h2 { margin: 0 0 8px; font-size: 20px; font-weight: 600; color: #ef4444; }
    p { margin: 0 0 16px; color: #94a3b8; font-size: 14px; }
    button { background: #334155; color: #fff; border: 1px solid #475569; padding: 8px 18px; border-radius: 8px; font-size: 14px; cursor: pointer; }
    button:hover { background: #475569; }
  </style>
</head>
<body>
  <div class="box">
    <h2>✕ Error de verificación</h2>
    <p>La cuenta de Google seleccionada no coincide con tu usuario activo en Spriteboard.</p>
    <button type="button" onclick="window.close()">Cerrar ventana</button>
  </div>
  <script>
    const payload = { type: 'GOOGLE_VERIFY_ERROR', error: 'La cuenta de Google seleccionada no coincide con tu usuario activo en Spriteboard.' };

    try {
      const ch = new BroadcastChannel('google_verify_channel');
      ch.postMessage(payload);
      ch.close();
    } catch (_) {}

    try {
      localStorage.setItem('google_verify_event', JSON.stringify({ ...payload, ts: Date.now() }));
    } catch (_) {}

    if (window.opener) {
      try {
        window.opener.postMessage(payload, window.location.origin);
      } catch (_) {}
    }

    setTimeout(() => {
      window.close();
    }, 2500);
  </script>
</body>
</html>`);
        return;
      }
    }

    // Si el usuario tiene autenticación en dos pasos (2FA) activada, redirigir al flujo de verificación
    if (userPayload.two_factor_enabled) {
      const tempToken = crypto.randomBytes(32).toString('hex');
      await savePending2FALogin(tempToken, { userId: userPayload.id, email: userPayload.email }, 300);
      logger.security.info('Inicio de sesión con Google requiere segundo factor de autenticación', {
        userId: userPayload.id,
        email: userPayload.email,
      });

      res.cookie('2fa_temp_token', tempToken, {
        httpOnly: false,
        sameSite: 'lax',
        maxAge: 300 * 1000,
        path: '/',
      });
      res.cookie('2fa_temp_email', userPayload.email, {
        httpOnly: false,
        sameSite: 'lax',
        maxAge: 300 * 1000,
        path: '/',
      });

      res.redirect(`/login/verification-aditional?token=${tempToken}&email=${encodeURIComponent(userPayload.email)}`);
      return;
    }

    await addAccountToSession(res, req, userPayload);

    logger.security.info('Inicio de sesión exitoso con Google OAuth', { userId: userPayload.id, email: userPayload.email });

    res.redirect('/');
  } catch (err) {
    logger.app.error('Error no controlado en Google OAuth callback', err);
    res.redirect('/login?error=server_error');
  }
}

/**
 * Solicitud de recuperación de contraseña:
 * Valida que el correo exista en la base de datos, genera token en Redis y despacha correo
 */
export async function forgotPassword(req: Request, res: Response): Promise<void> {
  try {
    const { email } = req.body;

    const emailValidation = validateEmail(email);
    if (!emailValidation.valid) {
      sendBadRequest(res, emailValidation.error!);
      return;
    }

    const trimmedEmail = String(email).trim().toLowerCase();

    // 1. Verificar si el correo existe en la base de datos
    const user = await findUserByEmail(trimmedEmail);

    if (user) {
      // 2. Generar token criptográfico seguro de 32 bytes (64 caracteres hex)
      const resetToken = crypto.randomBytes(32).toString('hex');

      // 3. Guardar en Redis con TTL de 15 minutos (900 seg)
      await savePasswordResetToken(user.email, user.id, resetToken, 900);

      // 4. Construir URL dinámica de restablecimiento
      const origin = req.get('origin') || `${req.protocol}://${req.get('host')}`;
      const resetUrl = `${origin}/reset-password?token=${resetToken}`;

      // 5. Enviar correo SMTP
      await sendPasswordResetEmail(user.email, user.username, resetUrl, 15);

      logger.security.info('Enlace de recuperación de contraseña generado y enviado', {
        userId: user.id,
        email: user.email,
      });
    } else {
      logger.security.info('Solicitud de recuperación para correo no registrado (protección anti-enumeración)', {
        email: trimmedEmail,
        ip: getClientIp(req),
      });
    }

    // Respuesta genérica para prevenir recolección y enumeración de usuarios (OWASP)
    sendSuccess(res, {
      message: 'Si el correo electrónico está registrado, recibirás un enlace de recuperación.',
    });
  } catch (error) {
    sendInternalError(
      res,
      'Error al procesar solicitud de recuperación de contraseña',
      error,
      'Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde.'
    );
  }
}

/**
 * Pre-validación del token de recuperación para la vista del frontend
 */
export async function validateResetToken(req: Request, res: Response): Promise<void> {
  try {
    const token = String(req.query.token || '').trim();
    const result = await verifyPasswordResetToken(token);

    if (!result.valid) {
      sendBadRequest(res, result.error || 'Token inválido.');
      return;
    }

    sendSuccess(res, { valid: true, email: result.email });
  } catch (error) {
    sendInternalError(res, 'Error al verificar token de restablecimiento', error, 'Error al verificar token de recuperación.');
  }
}

/**
 * Restablecimiento definitivo de la contraseña:
 * Valida y consume el token atómicamente de Redis, actualiza el hash en MySQL y revoca sesiones previas
 */
export async function resetPassword(req: Request, res: Response): Promise<void> {
  try {
    const { token, password } = req.body;

    if (!token || typeof token !== 'string' || !token.trim()) {
      sendBadRequest(res, 'Token de recuperación no válido o ausente.');
      return;
    }

    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      sendBadRequest(res, passwordValidation.error!);
      return;
    }

    // 1. Consumir atómicamente el token de Redis (evita que se use dos veces)
    const tokenResult = await consumePasswordResetToken(token);
    if (!tokenResult.success || !tokenResult.userId) {
      logger.security.warn('Intento fallido de restablecimiento: token inválido o expirado');
      sendBadRequest(
        res,
        tokenResult.error || 'El enlace de recuperación ha expirado o ya ha sido utilizado.'
      );
      return;
    }

    // 2. Hashear la nueva contraseña
    const newHash = await hashPassword(String(password));

    // 3. Actualizar la contraseña en la base de datos MySQL
    await updateUserPassword(tokenResult.userId, newHash);

    // 4. Revocar de inmediato todas las sesiones activas del usuario en otros navegadores/dispositivos
    await revokeAllUserSessions(tokenResult.userId);

    logger.security.info('Contraseña restablecida exitosamente', {
      userId: tokenResult.userId,
      email: tokenResult.email,
    });

    sendSuccess(res, {
      message: 'Tu contraseña ha sido restablecida exitosamente. Ya puedes iniciar sesión.',
    });
  } catch (error) {
    sendInternalError(
      res,
      'Error al restablecer la contraseña',
      error,
      'Ha ocurrido un error inesperado al actualizar tu contraseña. Por favor intenta más tarde.'
    );
  }
}
