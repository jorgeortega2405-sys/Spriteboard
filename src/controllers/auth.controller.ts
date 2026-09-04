import crypto from 'crypto';
import { Request, Response } from 'express';
import {
  hashPassword,
  verifyPassword,
  setSessionCookie,
  clearSessionCookie,
} from '../services/auth.service.js';
import {
  getGoogleAuthUrl,
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
} from '../services/user.service.js';
import { getCurrentUser } from '../middlewares/auth.middleware.js';
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

    // Iniciar sesión automáticamente emitiendo la cookie de sesión
    setSessionCookie(res, newUser);

    logger.security.info('Cuenta creada y verificada exitosamente', { userId: newUser.id, email: newUser.email });

    sendCreated(res, {
      message: 'Cuenta creada y verificada exitosamente.',
      user: sanitizeUser(newUser),
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

    const user = sanitizeUser(userRow);

    setSessionCookie(res, user);

    logger.security.info('Inicio de sesión exitoso', { userId: user.id, email: user.email });

    sendSuccess(res, {
      message: 'Inicio de sesión exitoso.',
      user,
    });
  } catch (error) {
    sendInternalError(res, 'Error al iniciar sesión', error, 'Error interno del servidor al iniciar sesión.');
  }
}

// Cierre de sesión
export function logout(req: Request, res: Response): void {
  clearSessionCookie(res);
  logger.security.info('Sesión cerrada exitosamente');
  sendSuccess(res, { message: 'Sesión cerrada exitosamente.' });
}

// Usuario actual
export function me(req: Request, res: Response): void {
  const user = getCurrentUser(req);
  res.json({ user: user ? sanitizeUser(user) : null });
}

// Redirección a Google OAuth
export function redirectToGoogle(req: Request, res: Response): void {
  const url = getGoogleAuthUrl(req, res);
  res.redirect(url);
}

// Callback de Google OAuth
export async function googleCallback(req: Request, res: Response): Promise<void> {
  try {
    const { code, state, error } = req.query;

    if (error) {
      logger.security.warn('Google OAuth cancelado o con error', { error });
      res.redirect('/login?error=' + encodeURIComponent(String(error)));
      return;
    }

    if (!code || !state) {
      logger.security.warn('Google OAuth faltan parámetros requeridos');
      res.redirect('/login?error=missing_oauth_parameters');
      return;
    }

    const storedState = req.cookies[STATE_COOKIE_NAME];
    res.clearCookie(STATE_COOKIE_NAME);

    if (!storedState || storedState !== state) {
      logger.security.warn('Parámetro state de Google OAuth inválido o ausente');
      res.redirect('/login?error=invalid_oauth_state');
      return;
    }

    const userPayload = await processGoogleAuthCallback(String(code));
    setSessionCookie(res, userPayload);

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

    if (!user) {
      logger.security.warn('Recuperación de contraseña denegada: correo no registrado', {
        email: trimmedEmail,
        ip: req.ip,
      });
      sendNotFound(res, 'No encontramos ninguna cuenta asociada a este correo electrónico.');
      return;
    }

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

    sendSuccess(res, {
      message: 'Hemos enviado un enlace de recuperación a tu correo electrónico.',
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
 * Valida y consume el token atómicamente de Redis y actualiza el hash en MySQL
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
