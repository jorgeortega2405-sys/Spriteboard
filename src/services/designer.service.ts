import mysql, { RowDataPacket } from 'mysql2/promise';
import { pool } from '../config/database.config.js';
import { redis } from '../config/redis.config.js';
import { DesignerOnboardPayload, DesignerOnboardingStatusResponse, DesignerPayoutProfile } from '../types/designer.types.js';
import { logger } from './logger.service.js';
import { getUserEffectivePermissions, hasPermission } from './permission.service.js';

const RESERVED_HANDLES = new Set([
  'admin',
  'api',
  'app',
  'auth',
  'board',
  'brand',
  'designer',
  'designers',
  'docs',
  'enterprise',
  'error',
  'explore',
  'help',
  'home',
  'login',
  'logout',
  'null',
  'official',
  'p',
  'presentation',
  'privacy',
  'profile',
  'register',
  'security',
  'settings',
  'spriteboard',
  'support',
  'teams',
  'templates',
  'terms',
  'trash',
  'undefined',
  'upgrade',
  'user',
  'users',
]);

export function sanitizeHandle(raw: string): string {
  return String(raw || '')
    .trim()
    .replace(/^@+/, '')
    .toLowerCase();
}

export async function getDesignerOnboardingStatus(userId: number): Promise<DesignerOnboardingStatusResponse> {
  const [userRows] = await pool.query<RowDataPacket[]>(
    `SELECT u.id, u.username, u.role, u.designer_handle, u.designer_onboarded 
     FROM users u 
     WHERE u.id = ? 
     LIMIT 1`,
    [userId]
  );

  if (userRows.length === 0) {
    throw new Error('USER_NOT_FOUND');
  }

  const u = userRows[0];
  const userPermissions = await getUserEffectivePermissions(userId);
  const isDesigner = hasPermission(userPermissions, 'designer:onboard') || hasPermission(userPermissions, 'designer:dashboard') || hasPermission(userPermissions, 'templates:publish');

  let payoutProfile: DesignerPayoutProfile | null = null;
  const [payoutRows] = await pool.query<RowDataPacket[]>(
    'SELECT * FROM designer_payout_profiles WHERE user_id = ? LIMIT 1',
    [userId]
  );

  if (payoutRows.length > 0) {
    const p = payoutRows[0];
    payoutProfile = {
      created_at: p.created_at ? new Date(p.created_at).toISOString() : new Date().toISOString(),
      id: Number(p.id),
      is_verified: Boolean(p.is_verified),
      payout_card_brand: p.payout_card_brand ? String(p.payout_card_brand) : null,
      payout_card_last4: p.payout_card_last4 ? String(p.payout_card_last4) : null,
      payout_country: String(p.payout_country || 'MX'),
      payout_currency: String(p.payout_currency || 'USD'),
      payout_email: p.payout_email ? String(p.payout_email) : null,
      payout_type: p.payout_type || 'stripe_connect',
      stripe_account_id: p.stripe_account_id ? String(p.stripe_account_id) : null,
      updated_at: p.updated_at ? new Date(p.updated_at).toISOString() : new Date().toISOString(),
      user_id: Number(p.user_id),
    };
  }

  return {
    designer_handle: u.designer_handle || null,
    designer_onboarded: Boolean(u.designer_onboarded),
    is_designer: isDesigner,
    ok: true,
    payout_profile: payoutProfile,
    username: String(u.username),
  };
}

export async function checkDesignerHandleAvailability(
  rawHandle: string,
  currentUserId?: number,
  userPermissions?: string[]
): Promise<{ available: boolean; cleanHandle: string; reason?: string }> {
  const clean = sanitizeHandle(rawHandle);

  if (!clean) {
    return { available: false, cleanHandle: clean, reason: 'El identificador no puede estar vacío.' };
  }

  if (clean.length < 3 || clean.length > 30) {
    return { available: false, cleanHandle: clean, reason: 'El identificador debe tener entre 3 y 30 caracteres.' };
  }

  if (!/^[a-z0-9_]+$/.test(clean)) {
    return { available: false, cleanHandle: clean, reason: 'Solo se permiten letras minúsculas, números y guiones bajos.' };
  }

  if (RESERVED_HANDLES.has(clean) && !hasPermission(userPermissions, 'system:reserved_handle_claim')) {
    return { available: false, cleanHandle: clean, reason: 'Este identificador está reservado por el sistema.' };
  }

  let query = 'SELECT id FROM users WHERE (LOWER(username) = ? OR LOWER(designer_handle) = ?)';
  const params: any[] = [clean, clean];

  if (currentUserId && currentUserId > 0) {
    query += ' AND id != ?';
    params.push(currentUserId);
  }
  query += ' LIMIT 1';

  const [rows] = await pool.query<RowDataPacket[]>(query, params);

  if (rows.length > 0) {
    return { available: false, cleanHandle: clean, reason: 'Este identificador ya está en uso.' };
  }

  return { available: true, cleanHandle: clean };
}

export async function completeDesignerOnboarding(
  userId: number,
  payload: DesignerOnboardPayload
): Promise<{
  designer_handle: string;
  designer_onboarded: boolean;
  success: boolean;
  user: any;
}> {
  const status = await getDesignerOnboardingStatus(userId);
  if (!status.is_designer) {
    throw new Error('USER_NOT_DESIGNER');
  }

  const userPermissions = await getUserEffectivePermissions(userId);
  const check = await checkDesignerHandleAvailability(payload.handle, userId, userPermissions);
  if (!check.available) {
    throw new Error(check.reason || 'HANDLE_UNAVAILABLE');
  }

  const cleanHandle = check.cleanHandle;
  const payoutType = payload.payout_type || 'stripe_connect';
  const payoutCountry = (payload.payout_country || 'MX').toUpperCase().slice(0, 5);
  const payoutCurrency = (payload.payout_currency || 'USD').toUpperCase().slice(0, 5);
  const payoutEmail = payload.payout_email ? payload.payout_email.trim().toLowerCase() : null;
  const payoutCardToken = payload.payout_card_token ? payload.payout_card_token.trim() : null;

  await pool.query(
    `UPDATE users 
     SET designer_handle = ?, designer_onboarded = TRUE, designer_onboarded_at = CURRENT_TIMESTAMP 
     WHERE id = ?`,
    [cleanHandle, userId]
  );

  await pool.query(
    `INSERT INTO designer_payout_profiles 
      (user_id, payout_type, payout_country, payout_currency, payout_email, payout_card_token)
     VALUES (?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
      payout_type = VALUES(payout_type),
      payout_country = VALUES(payout_country),
      payout_currency = VALUES(payout_currency),
      payout_email = VALUES(payout_email),
      payout_card_token = VALUES(payout_card_token),
      updated_at = CURRENT_TIMESTAMP`,
    [userId, payoutType, payoutCountry, payoutCurrency, payoutEmail, payoutCardToken]
  );

  try {
    await redis.del(`user:profile:${userId}`);
  } catch {}

  const [updatedUserRows] = await pool.query<RowDataPacket[]>(
    'SELECT id, username, email, avatar_url, role, designer_handle, designer_onboarded, subscription_tier FROM users WHERE id = ? LIMIT 1',
    [userId]
  );

  const updatedUser = updatedUserRows[0];

  logger.app.info('Onboarding de diseñador completado con éxito', {
    cleanHandle,
    payoutCountry,
    payoutType,
    userId,
  });

  return {
    designer_handle: cleanHandle,
    designer_onboarded: true,
    success: true,
    user: {
      avatar_url: updatedUser.avatar_url || null,
      designer_handle: updatedUser.designer_handle || null,
      designer_onboarded: Boolean(updatedUser.designer_onboarded),
      email: updatedUser.email,
      id: updatedUser.id,
      role: updatedUser.role,
      subscription_tier: updatedUser.subscription_tier,
      username: updatedUser.username,
    },
  };
}
