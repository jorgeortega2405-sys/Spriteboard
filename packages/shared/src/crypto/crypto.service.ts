import crypto from 'crypto';

const PREFIX = 'v1:enc:';
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;

function getEncryptionKey(overrideKey?: string): Buffer {
  const rawKey = overrideKey || process.env.APP_ENCRYPTION_KEY || process.env.SESSION_SECRET || 'spriteboard_encryption_default_key_2026';
  if (/^[0-9a-fA-F]{64}$/.test(rawKey)) {
    return Buffer.from(rawKey, 'hex');
  }
  return crypto.createHash('sha256').update(rawKey).digest();
}

export function isEncrypted(value?: string | null): boolean {
  if (!value || typeof value !== 'string') return false;
  return value.startsWith(PREFIX);
}

export function encryptAtRest(plainText: string, secretKey?: string): string {
  if (!plainText || typeof plainText !== 'string') return plainText;
  if (isEncrypted(plainText)) return plainText;

  const key = getEncryptionKey(secretKey);
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plainText, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');

  return `${PREFIX}${iv.toString('hex')}:${authTag}:${encrypted}`;
}

export function decryptAtRest(cipherText?: string | null, secretKey?: string): string {
  if (!cipherText || typeof cipherText !== 'string') return '';
  if (!isEncrypted(cipherText)) return cipherText;

  try {
    const parts = cipherText.split(':');
    if (parts.length !== 5) return cipherText;

    const iv = Buffer.from(parts[2], 'hex');
    const authTag = Buffer.from(parts[3], 'hex');
    const encryptedHex = parts[4];
    const key = getEncryptionKey(secretKey);

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch {
    return cipherText;
  }
}
