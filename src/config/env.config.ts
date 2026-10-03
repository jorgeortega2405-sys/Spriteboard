import 'dotenv/config';

export const config = {
  port: Number(process.env.PORT) || 3000,
  appName: process.env.APP_NAME || 'Spriteboard',
  nodeEnv: process.env.NODE_ENV || 'development',
  trustProxy: process.env.TRUST_PROXY ? (Number(process.env.TRUST_PROXY) || process.env.TRUST_PROXY) : 1,
  sessionSecret: process.env.SESSION_SECRET || 'spriteboard_session_secret_key_2026',
  csrfSecret: process.env.CSRF_SECRET || process.env.SESSION_SECRET || 'spriteboard_csrf_secret_key_2026',
  appEncryptionKey: process.env.APP_ENCRYPTION_KEY || '',
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    callbackUrl: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3000/api/auth/google/callback',
  },
  redis: {
    host: process.env.REDIS_HOST || 'redis',
    port: Number(process.env.REDIS_PORT) || 6379,
  },
  db: {
    canvasName: process.env.DB_CANVAS_NAME || 'db_canvas',
    host: process.env.DB_HOST || 'localhost',
    identityName: process.env.DB_NAME || 'db_identity',
    password: process.env.DB_PASSWORD || '',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
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
  pexels: {
    apiKey: process.env.PEXELS_API_KEY || '',
  },
  websocket: {
    host: process.env.WEBSOCKET_HOST || 'websocket',
    port: Number(process.env.WEBSOCKET_PORT) || 3001,
  },
  baseUrl: process.env.BASE_URL || 'http://localhost:3000',
  appUrl: process.env.APP_URL || process.env.BASE_URL || 'http://localhost:3000',
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY || '',
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || '',
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
  },
  geoip: {
    cityDbPath: process.env.GEOIP_CITY_DB_PATH || '',
    asnDbPath: process.env.GEOIP_ASN_DB_PATH || '',
  },
  aws: {
    region: process.env.AWS_REGION || 'us-east-1',
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
    s3Bucket: process.env.AWS_S3_BUCKET || 'spriteboard-storage',
    s3Endpoint: process.env.AWS_S3_ENDPOINT || '',
    s3ForcePathStyle: process.env.AWS_S3_FORCE_PATH_STYLE === 'true',
    s3PublicUrl: process.env.AWS_S3_PUBLIC_URL || '',
  },
  photoroom: {
    apiKey: process.env.PHOTOROOM_API_KEY || '',
    endpoint: process.env.PHOTOROOM_ENDPOINT || 'https://sdk.photoroom.com/v1/segment',
  },
};

if (config.nodeEnv === 'production') {
  const missingSecrets: string[] = [];
  if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET === 'spriteboard_session_secret_key_2026') {
    missingSecrets.push('SESSION_SECRET');
  }
  if (!process.env.CSRF_SECRET || process.env.CSRF_SECRET === 'spriteboard_csrf_secret_key_2026') {
    missingSecrets.push('CSRF_SECRET');
  }
  if (!process.env.APP_ENCRYPTION_KEY) {
    missingSecrets.push('APP_ENCRYPTION_KEY');
  }
  if (missingSecrets.length > 0) {
    throw new Error(`CRITICAL CONFIGURATION ERROR: Missing or default secrets in production: ${missingSecrets.join(', ')}`);
  }
}



