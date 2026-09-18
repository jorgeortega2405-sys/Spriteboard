import 'dotenv/config';

export const config = {
  appName: process.env.APP_NAME || 'Spriteboard Admin',
  appUrl: process.env.APP_URL || 'http://localhost:3000',
  adminUrl: process.env.ADMIN_URL || 'http://localhost:3002',
  cassandra: {
    contactPoints: (process.env.CASSANDRA_CONTACT_POINTS || 'localhost').split(',').map((s) => s.trim()),
    localDataCenter: process.env.CASSANDRA_LOCAL_DC || 'datacenter1',
    port: Number(process.env.CASSANDRA_PORT) || 9042,
  },
  csrfSecret: process.env.CSRF_SECRET || 'spriteboard_csrf_secret_key_2026',
  db: {
    database: process.env.DB_NAME || 'db_identity',
    host: process.env.DB_HOST || 'localhost',
    password: process.env.DB_PASSWORD || 'sprite_password',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'sprite_user',
  },
  gemini: {
    apiKey: process.env.GEMINI_API_KEY || '',
    model: process.env.GEMINI_MODEL || 'gemini-flash-lite-latest',
  },
  google: {
    callbackUrl: process.env.ADMIN_GOOGLE_CALLBACK_URL || 'http://localhost:3002/api/auth/google/callback',
    clientId: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
  },
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.ADMIN_PORT || process.env.PORT || 3002),
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    password: process.env.REDIS_PASSWORD || undefined,
    port: Number(process.env.REDIS_PORT) || 6379,
  },
  sessionSecret: process.env.SESSION_SECRET || 'spriteboard_session_secret_key_2026',
  smtp: {
    fromEmail: process.env.SMTP_FROM_EMAIL || 'no-reply@spriteboard.com',
    fromName: process.env.SMTP_FROM_NAME || 'Spriteboard Recursos Humanos',
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    pass: process.env.SMTP_PASS || '',
    port: Number(process.env.SMTP_PORT) || 465,
    user: process.env.SMTP_USER || '',
  },
  trustProxy: 1,
  websocket: {
    host: process.env.WEBSOCKET_HOST || 'websocket',
    port: Number(process.env.WEBSOCKET_PORT) || 3001,
  },
} as const;
