import 'dotenv/config';

export const config = {
  appName: process.env.APP_NAME || 'Spriteboard Admin',
  csrfSecret: process.env.CSRF_SECRET || 'spriteboard_csrf_secret_key_2026',
  db: {
    database: process.env.DB_NAME || 'db_identity',
    host: process.env.DB_HOST || 'localhost',
    password: process.env.DB_PASSWORD || 'sprite_password',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'sprite_user',
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
  trustProxy: 1,
} as const;
