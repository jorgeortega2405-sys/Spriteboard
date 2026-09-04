import 'dotenv/config';
import express, { Request, Response } from 'express';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';
import pool, { checkDbConnection } from './db.js';
import { generateCsrfToken, validateCsrf } from './csrf.js';
import {
  hashPassword,
  verifyPassword,
  setSessionCookie,
  clearSessionCookie,
  getCurrentUser,
  UserPayload,
} from './auth.js';
import { handleAvatarRequest } from './avatar.js';
import { getGoogleAuthUrl, handleGoogleCallback } from './google-auth.js';
import type { RowDataPacket, ResultSetHeader } from 'mysql2';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// Middlewares
app.use(express.json());
app.use(cookieParser());

// Servir archivos estáticos desde la carpeta public
app.use(express.static(path.join(__dirname, '../public')));

// Middleware de verificación CSRF en mutaciones POST/PUT/DELETE
app.use('/api', validateCsrf);

// ==========================================
// Rutas de API
// ==========================================

// Endpoint de configuración pública
app.get('/api/config', (req: Request, res: Response) => {
  res.json({
    appName: process.env.APP_NAME || 'Spriteboard',
  });
});

// Google OAuth 2.0
app.get('/api/auth/google', (req: Request, res: Response) => {
  const url = getGoogleAuthUrl(req, res);
  res.redirect(url);
});

app.get('/api/auth/google/callback', handleGoogleCallback);

// Endpoint para generar avatar dinámico SVG (estilo UI Avatars)
app.get('/api/avatar', handleAvatarRequest);

// Endpoint para obtener / regenerar token CSRF
app.get('/api/csrf-token', (req: Request, res: Response) => {
  const token = generateCsrfToken(req, res);
  res.json({ csrfToken: token });
});

// Endpoint de estado de sesión actual
app.get('/api/me', (req: Request, res: Response) => {
  const user = getCurrentUser(req);
  res.json({ user });
});

// Registro de usuarios
app.post('/api/register', async (req: Request, res: Response): Promise<void> => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      res.status(400).json({ error: 'Todos los campos son obligatorios.' });
      return;
    }

    const trimmedUsername = String(username).trim();
    const trimmedEmail = String(email).trim().toLowerCase();

    if (trimmedUsername.length < 3) {
      res.status(400).json({ error: 'El nombre de usuario debe tener al menos 3 caracteres.' });
      return;
    }

    if (String(password).length < 6) {
      res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres.' });
      return;
    }

    // Verificar si ya existe usuario o correo
    const [existing] = await pool.query<RowDataPacket[]>(
      'SELECT id, username, email FROM users WHERE username = ? OR email = ? LIMIT 1',
      [trimmedUsername, trimmedEmail]
    );

    if (existing.length > 0) {
      const match = existing[0];
      if (match.username === trimmedUsername) {
        res.status(409).json({ error: 'El nombre de usuario ya está en uso.' });
        return;
      }
      res.status(409).json({ error: 'El correo electrónico ya está registrado.' });
      return;
    }

    // Hashear contraseña y guardar usuario
    const passwordHash = await hashPassword(String(password));
    const [result] = await pool.query<ResultSetHeader>(
      'INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)',
      [trimmedUsername, trimmedEmail, passwordHash]
    );

    const newUser: UserPayload = {
      id: result.insertId,
      username: trimmedUsername,
      email: trimmedEmail,
    };

    // Iniciar sesión automáticamente
    setSessionCookie(res, newUser);

    res.status(201).json({
      message: 'Cuenta creada exitosamente.',
      user: newUser,
    });
  } catch (error) {
    console.error('Error al registrar usuario:', error);
    res.status(500).json({ error: 'Error interno del servidor al crear la cuenta.' });
  }
});

// Inicio de sesión
app.post('/api/login', async (req: Request, res: Response): Promise<void> => {
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

    // Iniciar sesión
    setSessionCookie(res, user);

    res.json({
      message: 'Inicio de sesión exitoso.',
      user,
    });
  } catch (error) {
    console.error('Error al iniciar sesión:', error);
    res.status(500).json({ error: 'Error interno del servidor al iniciar sesión.' });
  }
});

// Cierre de sesión
app.post('/api/logout', (req: Request, res: Response) => {
  clearSessionCookie(res);
  res.json({ message: 'Sesión cerrada exitosamente.' });
});

// Endpoint de salud
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({ status: 'ok', uptime: process.uptime() });
});

// Soporte SPA: Cualquier ruta que no sea de API sirve index.html
app.get('*', (req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Inicialización de la base de datos y arranque del servidor
async function startServer() {
  try {
    await checkDbConnection();
    app.listen(PORT, () => {
      console.log(`🚀 Servidor TypeScript corriendo en http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('❌ Error crítico al inicializar la base de datos:', error);
    process.exit(1);
  }
}

startServer();
