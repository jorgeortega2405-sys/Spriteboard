export const config = {
  port: Number(process.env.PORT) || 3000,
  appName: process.env.APP_NAME || 'Spriteboard',
  nodeEnv: process.env.NODE_ENV || 'development',
  trustProxy: process.env.TRUST_PROXY ? (Number(process.env.TRUST_PROXY) || process.env.TRUST_PROXY) : 1,
  sessionSecret: process.env.SESSION_SECRET || 'spriteboard_session_secret_key_2026',
  csrfSecret: process.env.CSRF_SECRET || process.env.SESSION_SECRET || 'spriteboard_csrf_secret_key_2026',
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    callbackUrl: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3000/api/auth/google/callback',
  },
  redis: {
    host: process.env.REDIS_HOST || 'redis',
    port: Number(process.env.REDIS_PORT) || 6379,
  },
  smtp: {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT) || 465,
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    fromEmail: process.env.SMTP_FROM_EMAIL || '',
    fromName: process.env.SMTP_FROM_NAME || 'Spriteboard',
  },
  cassandra: {
    contactPoints: (process.env.CASSANDRA_CONTACT_POINTS || 'cassandra').split(',').map((s) => s.trim()),
    port: Number(process.env.CASSANDRA_PORT) || 9042,
    keyspace: process.env.CASSANDRA_KEYSPACE || 'spriteboard_telemetry',
    localDataCenter: process.env.CASSANDRA_LOCAL_DC || 'datacenter1',
  },
  gemini: {
    apiKey: process.env.GEMINI_API_KEY || '',
    model: process.env.GEMINI_MODEL || 'gemini-flash-latest',
  },
};


