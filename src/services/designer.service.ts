import mysql, { RowDataPacket } from 'mysql2/promise';
import { canvasPool, pool } from '../config/database.config.js';
import { redis } from '../config/redis.config.js';
import { DesignerOnboardPayload, DesignerOnboardingStatusResponse, DesignerPayoutProfile, FeaturedCreator } from '../types/designer.types.js';
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

export async function getFeaturedCreators(limit = 4): Promise<FeaturedCreator[]> {
  try {
    const candidateUserIds: number[] = [];
    const templateStatsMap = new Map<number, { templates_count: number; total_uses: number }>();

    try {
      const [templateAggRows] = await canvasPool.query<RowDataPacket[]>(
        `SELECT user_id, COUNT(id) AS templates_count, COALESCE(SUM(uses_count), 0) AS total_uses
         FROM templates
         WHERE status = 'approved' AND user_id IS NOT NULL AND user_id > 0
         GROUP BY user_id
         ORDER BY total_uses DESC, templates_count DESC
         LIMIT ?`,
        [limit]
      );

      for (const row of templateAggRows) {
        const uid = Number(row.user_id);
        if (uid > 0) {
          candidateUserIds.push(uid);
          templateStatsMap.set(uid, {
            templates_count: Number(row.templates_count || 0),
            total_uses: Number(row.total_uses || 0),
          });
        }
      }
    } catch (err) {
      logger.db.warn('Error al consultar templates para creadores destacados', err);
    }

    const remaining = limit - candidateUserIds.length;
    if (remaining > 0) {
      let excludeClause = '';
      const params: any[] = [];
      if (candidateUserIds.length > 0) {
        excludeClause = `AND id NOT IN (${candidateUserIds.map(() => '?').join(',')})`;
        params.push(...candidateUserIds);
      }
      params.push(remaining);

      const [extraUsers] = await pool.query<RowDataPacket[]>(
        `SELECT id FROM users
         WHERE (designer_onboarded = 1 OR designer_handle IS NOT NULL)
         ${excludeClause}
         ORDER BY id ASC
         LIMIT ?`,
        params
      );

      for (const u of extraUsers) {
        const uid = Number(u.id);
        if (!candidateUserIds.includes(uid)) {
          candidateUserIds.push(uid);
        }
      }
    }

    if (candidateUserIds.length === 0) {
      return [];
    }

    const [userRows] = await pool.query<RowDataPacket[]>(
      `SELECT id, username, designer_handle, avatar_url, bio, country
       FROM users
       WHERE id IN (${candidateUserIds.map(() => '?').join(',')})`,
      candidateUserIds
    );

    const [followerRows] = await pool.query<RowDataPacket[]>(
      `SELECT following_id, COUNT(*) AS followers_count
       FROM user_follows
       WHERE following_id IN (${candidateUserIds.map(() => '?').join(',')})
       GROUP BY following_id`,
      candidateUserIds
    );

    const followerMap = new Map<number, number>();
    for (const f of followerRows) {
      followerMap.set(Number(f.following_id), Number(f.followers_count || 0));
    }

    for (const uid of candidateUserIds) {
      if (!templateStatsMap.has(uid)) {
        try {
          const [singleAgg] = await canvasPool.query<RowDataPacket[]>(
            `SELECT COUNT(id) AS templates_count, COALESCE(SUM(uses_count), 0) AS total_uses
             FROM templates
             WHERE user_id = ? AND status = 'approved'`,
            [uid]
          );
          templateStatsMap.set(uid, {
            templates_count: Number(singleAgg[0]?.templates_count || 0),
            total_uses: Number(singleAgg[0]?.total_uses || 0),
          });
        } catch {
          templateStatsMap.set(uid, { templates_count: 0, total_uses: 0 });
        }
      }
    }

    const creators: FeaturedCreator[] = userRows.map((u) => {
      const uid = Number(u.id);
      const tStats = templateStatsMap.get(uid) || { templates_count: 0, total_uses: 0 };
      const rawHandle = u.designer_handle ? String(u.designer_handle).trim().replace(/^@+/, '') : String(u.username);
      return {
        avatar_url: u.avatar_url || null,
        bio: u.bio || null,
        country: u.country || null,
        designer_handle: `@${rawHandle}`,
        followers_count: followerMap.get(uid) || 0,
        id: uid,
        templates_count: tStats.templates_count,
        total_uses: tStats.total_uses,
        username: String(u.username),
      };
    });

    creators.sort((a, b) => {
      if (b.total_uses !== a.total_uses) return b.total_uses - a.total_uses;
      if (b.templates_count !== a.templates_count) return b.templates_count - a.templates_count;
      return b.followers_count - a.followers_count;
    });

    return creators.slice(0, limit);
  } catch (error) {
    logger.app.error('Error al obtener creadores destacados', error);
    return [];
  }
}

