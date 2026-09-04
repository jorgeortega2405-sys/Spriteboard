import { Request, Response } from 'express';
import { pool } from '../config/database.js';
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
} from '../services/verification.service.js';
import { sendVerificationCodeEmail } from '../services/mail.service.js';
import { getCurrentUser } from '../middlewares/auth.middleware.js';
import {
  validateEmail,
  validatePassword,
  validateUsername,
  validateVerificationCode,
} from '../utils/validators.js';
import { UserPayload } from '../types/auth.types.js';
import type { RowDataPacket, ResultSetHeader } from 'mysql2';

// Etapa 1: Validar correo y contraseña
export async function validateStage1(req: Request, res: Response): Promise<void> {
  try {
    const { email, password } = req.body;

    const emailValidation = validateEmail(email);
    if (!emailValidation.valid) {
      res.status(400).json({ error: emailValidation.error });
      return;
    }

    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      res.status(400).json({ error: passwordValidation.error });
      return;
    }

    const trimmedEmail = String(email).trim().toLowerCase();

    // Verificar si el correo ya existe en MySQL
    const [existing] = await pool.query<RowDataPacket[]>(
      'SELECT id FROM users WHERE email = ? LIMIT 1',
      [trimmedEmail]
    );

    if (existing.length > 0) {
      res.status(409).json({ error: 'El correo electrónico ya está registrado.' });
      return;
    }

    res.json({ ok: true, message: 'Datos válidos para continuar a la etapa 2.' });
  } catch (error) {
    console.error('Error al validar etapa 1 de registro:', error);
    res.status(500).json({ error: 'Error interno del servidor al validar datos.' });
  }
}

// Etapa 2: Validar nombre de usuario, generar código de 6 dígitos, guardar en Redis y enviar correo SMTP
export async function sendRegistrationCode(req: Request, res: Response): Promise<void> {
  try {
    const { email, password, username } = req.body;

    const emailValidation = validateEmail(email);
    if (!emailValidation.valid) {
      res.status(400).json({ error: emailValidation.error });
      return;
    }

    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      res.status(400).json({ error: passwordValidation.error });
      return;
    }

    const usernameValidation = validateUsername(username);
    if (!usernameValidation.valid) {
      res.status(400).json({ error: usernameValidation.error });
      return;
    }

    const trimmedEmail = String(email).trim().toLowerCase();
    const trimmedUsername = String(username).trim();

    // Verificar disponibilidad de usuario o correo en la base de datos
    const [existing] = await pool.query<RowDataPacket[]>(
      'SELECT id, username, email FROM users WHERE username = ? OR email = ? LIMIT 1',
      [trimmedUsername, trimmedEmail]
    );

    if (existing.length > 0) {
      const match = existing[0];
      if (match.username.toLowerCase() === trimmedUsername.toLowerCase()) {
        res.status(409).json({ error: 'El nombre de usuario ya está en uso.' });
        return;
      }
      res.status(409).json({ error: 'El correo electrónico ya está registrado.' });
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

    res.json({
      ok: true,
      message: `Código de verificación enviado exitosamente a ${trimmedEmail}.`,
    });
  } catch (error) {
    console.error('Error al enviar código de registro:', error);
    res.status(500).json({ error: 'No se pudo enviar el correo de verificación. Inténtalo de nuevo.' });
  }
}

// Etapa 3: Verificar código de 6 dígitos en Redis y crear la cuenta en MySQL
export async function verifyRegistrationCode(req: Request, res: Response): Promise<void> {
  try {
    const { email, code } = req.body;

    const emailValidation = validateEmail(email);
    if (!emailValidation.valid) {
      res.status(400).json({ error: emailValidation.error });
      return;
    }

    const codeValidation = validateVerificationCode(code);
    if (!codeValidation.valid) {
      res.status(400).json({ error: codeValidation.error });
      return;
    }

    const trimmedEmail = String(email).trim().toLowerCase();
    const cleanCode = String(code).trim();

    const verificationResult = await verifyAndConsumeCode(trimmedEmail, cleanCode);

    if (!verificationResult.success || !verificationResult.data) {
      res.status(400).json({ error: verificationResult.error || 'Código incorrecto o expirado.' });
      return;
    }

    const pending = verificationResult.data;

    // Crear el usuario en la base de datos MySQL
    const [result] = await pool.query<ResultSetHeader>(
      'INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)',
      [pending.username, pending.email, pending.passwordHash]
    );

    const newUser: UserPayload = {
      id: result.insertId,
      username: pending.username,
      email: pending.email,
    };

    // Iniciar sesión automáticamente emitiendo la cookie de sesión
    setSessionCookie(res, newUser);

    res.status(201).json({
      message: 'Cuenta creada y verificada exitosamente.',
      user: newUser,
    });
  } catch (error) {
    console.error('Error al verificar código de registro:', error);
    res.status(500).json({ error: 'Error interno del servidor al crear la cuenta.' });
  }
}

// Reenviar código de verificación
export async function resendRegistrationCode(req: Request, res: Response): Promise<void> {
  try {
    const { email } = req.body;

    const emailValidation = validateEmail(email);
    if (!emailValidation.valid) {
      res.status(400).json({ error: emailValidation.error });
      return;
    }

    const trimmedEmail = String(email).trim().toLowerCase();
    const pending = await getPendingRegistration(trimmedEmail);

    if (!pending) {
      res.status(400).json({ error: 'La sesión de registro ha expirado. Debes iniciar desde el principio.' });
      return;
    }

    const newCode = generateSixDigitCode();
    await savePendingRegistration(trimmedEmail, {
      username: pending.username,
      passwordHash: pending.passwordHash,
      code: newCode,
    });

    await sendVerificationCodeEmail(trimmedEmail, pending.username, newCode);

    res.json({ ok: true, message: 'Nuevo código enviado exitosamente.' });
  } catch (error) {
    console.error('Error al reenviar código:', error);
    res.status(500).json({ error: 'No se pudo reenviar el código. Inténtalo de nuevo.' });
  }
}

// Inicio de sesión
export async function login(req: Request, res: Response): Promise<void> {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: 'Ingresa correo y contraseña.' });
      return;
    }

    const trimmedEmail = String(email).trim().toLowerCase();

    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT id, username, email, password_hash, avatar_url, google_id FROM users WHERE email = ? LIMIT 1',
      [trimmedEmail]
    );

    if (rows.length === 0) {
      res.status(401).json({ error: 'Credenciales inválidas.' });
      return;
    }

    const userRow = rows[0];
    const isMatch = await verifyPassword(String(password), userRow.password_hash);

    if (!isMatch) {
      res.status(401).json({ error: 'Credenciales inválidas.' });
      return;
    }

    const user: UserPayload = {
      id: userRow.id,
      username: userRow.username,
      email: userRow.email,
      avatar_url: userRow.avatar_url,
      google_id: userRow.google_id,
    };

    setSessionCookie(res, user);

    res.json({
      message: 'Inicio de sesión exitoso.',
      user,
    });
  } catch (error) {
    console.error('Error al iniciar sesión:', error);
    res.status(500).json({ error: 'Error interno del servidor al iniciar sesión.' });
  }
}

// Cierre de sesión
export function logout(req: Request, res: Response): void {
  clearSessionCookie(res);
  res.json({ message: 'Sesión cerrada exitosamente.' });
}

// Usuario actual
export function me(req: Request, res: Response): void {
  const user = getCurrentUser(req);
  res.json({ user });
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
      console.warn('Google OAuth cancelado o con error:', error);
      res.redirect('/login?error=' + encodeURIComponent(String(error)));
      return;
    }

    if (!code || !state) {
      res.redirect('/login?error=missing_oauth_parameters');
      return;
    }

    const storedState = req.cookies[STATE_COOKIE_NAME];
    res.clearCookie(STATE_COOKIE_NAME);

    if (!storedState || storedState !== state) {
      console.error('Invalid OAuth state parameter');
      res.redirect('/login?error=invalid_oauth_state');
      return;
    }

    const userPayload = await processGoogleAuthCallback(String(code));
    setSessionCookie(res, userPayload);
    res.redirect('/');
  } catch (err) {
    console.error('Error no controlado en Google OAuth callback:', err);
    res.redirect('/login?error=server_error');
  }
}
