import fs from 'fs';
import mysql, { RowDataPacket } from 'mysql2/promise';
import path from 'path';
import { canvasPool, pool } from '../config/database.config.js';
import { redis } from '../config/redis.config.js';
import { PublicUserProfile, ToggleFollowResult, UserTemplatesResponse } from '../types/user-profile.types.js';
import { sanitizeBanner } from './image-sanitizer.service.js';
import { logger } from './logger.service.js';
import { deleteObject, getPublicUrl, putObject } from './s3.service.js';
import { logUserAudit } from './settings.service.js';

const BANNERS_DIR = path.resolve(process.cwd(), 'public', 'uploads', 'banners');

async function safeUnlink(filePath: string): Promise<void> {
  try {
    await fs.promises.unlink(filePath);
  } catch {}
}

const OFFICIAL_SYSTEM_TEMPLATES = [
  {
    author_avatar: null,
    author_username: 'Spriteboard Oficial',
    canvas_data: null,
    canvas_id: null,
    canvas_type: 'board',
    category: 'board',
    created_at: '2024-01-01T00:00:00.000Z',
    description: 'Tablero para retrospectivas ágiles con dinámicas de equipo y notas adhesivas.',
    id: 1001,
    is_official: true,
    is_premium: false,
    preview_thumbnail: '/assets/templates/boards/retro.svg',
    status: 'approved',
    tags: ['retro', 'retrospective', 'agile', 'scrum', 'whiteboard'],
    title: 'Agile Sprint Retrospective',
    updated_at: '2024-01-01T00:00:00.000Z',
    uses_count: 2450,
    user_id: -1,
    uuid: 'tmpl-board-retro',
  },
  {
    author_avatar: null,
    author_username: 'Spriteboard Oficial',
    canvas_data: null,
    canvas_id: null,
    canvas_type: 'board',
    category: 'board',
    created_at: '2024-01-01T00:00:00.000Z',
    description: 'Hoja de ruta trimestral y seguimiento de objetivos de producto.',
    id: 1002,
    is_official: true,
    is_premium: true,
    preview_thumbnail: '/assets/templates/boards/roadmap.svg',
    status: 'approved',
    tags: ['roadmap', 'product', 'milestones', 'strategy'],
    title: 'Product Roadmap & Milestones',
    updated_at: '2024-01-01T00:00:00.000Z',
    uses_count: 1890,
    user_id: -1,
    uuid: 'tmpl-board-roadmap',
  },
  {
    author_avatar: null,
    author_username: 'Spriteboard Oficial',
    canvas_data: null,
    canvas_id: null,
    canvas_type: 'board',
    category: 'board',
    created_at: '2024-01-01T00:00:00.000Z',
    description: 'Mapa de viaje y empatía del usuario para investigación de experiencia (UX).',
    id: 1003,
    is_official: true,
    is_premium: false,
    preview_thumbnail: '/assets/templates/boards/journey.svg',
    status: 'approved',
    tags: ['journey', 'customer', 'ux', 'research'],
    title: 'Customer Experience Journey Map',
    updated_at: '2024-01-01T00:00:00.000Z',
    uses_count: 1320,
    user_id: -1,
    uuid: 'tmpl-board-journey',
  },
  {
    author_avatar: null,
    author_username: 'Spriteboard Oficial',
    canvas_data: null,
    canvas_id: null,
    canvas_type: 'presentation',
    category: 'presentation',
    created_at: '2024-01-01T00:00:00.000Z',
    description: 'Presentación de diapositivas optimizada para rondas de inversión y startups.',
    id: 1004,
    is_official: true,
    is_premium: false,
    preview_thumbnail: '/assets/templates/presentations/pitch.svg',
    status: 'approved',
    tags: ['pitch', 'deck', 'startup', 'slides'],
    title: 'Startup Investor Pitch Deck',
    updated_at: '2024-01-01T00:00:00.000Z',
    uses_count: 3120,
    user_id: -1,
    uuid: 'tmpl-pres-pitch',
  },
  {
    author_avatar: null,
    author_username: 'Spriteboard Oficial',
    canvas_data: null,
    canvas_id: null,
    canvas_type: 'presentation',
    category: 'presentation',
    created_at: '2024-01-01T00:00:00.000Z',
    description: 'Revisión ejecutiva trimestral de métricas, rendimiento y metas de negocio.',
    id: 1005,
    is_official: true,
    is_premium: true,
    preview_thumbnail: '/assets/templates/presentations/qbr.svg',
    status: 'approved',
    tags: ['qbr', 'business', 'metrics', 'slides'],
    title: 'Quarterly Business Review (QBR)',
    updated_at: '2024-01-01T00:00:00.000Z',
    uses_count: 1540,
    user_id: -1,
    uuid: 'tmpl-pres-qbr',
  },
  {
    author_avatar: null,
    author_username: 'Spriteboard Oficial',
    canvas_data: null,
    canvas_id: null,
    canvas_type: 'presentation',
    category: 'presentation',
    created_at: '2024-01-01T00:00:00.000Z',
    description: 'Plantilla de lanzamiento de nuevas funcionalidades y productos.',
    id: 1006,
    is_official: true,
    is_premium: true,
    preview_thumbnail: '/assets/templates/presentations/launch.svg',
    status: 'approved',
    tags: ['launch', 'product', 'slides'],
    title: 'Product Feature Launch',
    updated_at: '2024-01-01T00:00:00.000Z',
    uses_count: 980,
    user_id: -1,
    uuid: 'tmpl-pres-launch',
  },
  {
    author_avatar: null,
    author_username: 'Spriteboard Oficial',
    canvas_data: null,
    canvas_id: null,
    canvas_type: 'doc',
    category: 'doc',
    created_at: '2024-01-01T00:00:00.000Z',
    description: 'Propuesta ejecutiva de proyecto con objetivos, presupuesto y cronograma.',
    id: 1007,
    is_official: true,
    is_premium: false,
    preview_thumbnail: '/assets/templates/docs/proposal.svg',
    status: 'approved',
    tags: ['proposal', 'executive', 'document'],
    title: 'Executive Project Proposal',
    updated_at: '2024-01-01T00:00:00.000Z',
    uses_count: 2110,
    user_id: -1,
    uuid: 'tmpl-doc-proposal',
  },
  {
    author_avatar: null,
    author_username: 'Spriteboard Oficial',
    canvas_data: null,
    canvas_id: null,
    canvas_type: 'doc',
    category: 'doc',
    created_at: '2024-01-01T00:00:00.000Z',
    description: 'Documento de especificación técnica y arquitectura de software.',
    id: 1008,
    is_official: true,
    is_premium: true,
    preview_thumbnail: '/assets/templates/docs/rfc.svg',
    status: 'approved',
    tags: ['rfc', 'architecture', 'engineering'],
    title: 'Technical Architecture RFC',
    updated_at: '2024-01-01T00:00:00.000Z',
    uses_count: 870,
    user_id: -1,
    uuid: 'tmpl-doc-rfc',
  },
  {
    author_avatar: null,
    author_username: 'Spriteboard Oficial',
    canvas_data: null,
    canvas_id: null,
    canvas_type: 'doc',
    category: 'doc',
    created_at: '2024-01-01T00:00:00.000Z',
    description: 'Registro de minutas, decisiones clave y puntos de acción en sprint planning.',
    id: 1009,
    is_official: true,
    is_premium: false,
    preview_thumbnail: '/assets/templates/docs/meeting.svg',
    status: 'approved',
    tags: ['meeting', 'decisions', 'sprint'],
    title: 'Sprint Planning & Decision Log',
    updated_at: '2024-01-01T00:00:00.000Z',
    uses_count: 1650,
    user_id: -1,
    uuid: 'tmpl-doc-meeting',
  },
];

export async function getUserPublicProfile(
  username: string,
  currentUserId?: number
): Promise<PublicUserProfile | null> {
  const cleanUsername = username.trim().replace(/^@+/, '').toLowerCase();
  if (!cleanUsername) return null;

  const isSpriteboardOfficial = cleanUsername === 'spriteboard' || cleanUsername === 'spriteboard-oficial' || cleanUsername === 'spriteboard oficial';

  const [userRows] = await pool.query<RowDataPacket[]>(
    `SELECT id, uuid, username, designer_handle, designer_handle_changed_at, designer_onboarded, avatar_url, banner_url, bio, country, website_url, social_links, role, subscription_tier, created_at 
     FROM users 
     WHERE LOWER(username) = LOWER(?) OR LOWER(designer_handle) = LOWER(?) 
     LIMIT 1`,
    [cleanUsername, cleanUsername]
  );

  if (userRows.length === 0) {
    if (isSpriteboardOfficial) {
      return {
        avatar_url: null,
        banner_url: null,
        bio: 'Plantillas y recursos oficiales diseñados por el equipo de Spriteboard para ayudarte a crear presentaciones, documentos y lienzos profesionales.',
        country: 'Global',
        created_at: '2024-01-01T00:00:00.000Z',
        designer_handle: 'spriteboard',
        designer_handle_changed_at: null,
        designer_onboarded: true,
        followers_count: 3280,
        following_count: 0,
        id: -1,
        is_designer: true,
        is_following: false,
        is_me: false,
        role: 'ADMIN',
        roles: ['ADMIN', 'DESIGNER'],
        social_links: {
          facebook: 'https://facebook.com/spriteboard',
          instagram: 'spriteboard',
          pinterest: 'spriteboard',
          tiktok: 'spriteboard',
          website: 'https://spriteboard.com',
          x: 'spriteboard',
          youtube: 'spriteboard',
        },
        subscription_tier: 'enterprise',
        templates_count: OFFICIAL_SYSTEM_TEMPLATES.length,
        username: 'Spriteboard Oficial',
        uuid: 'official-spriteboard',
        website_url: 'https://spriteboard.com',
      };
    }
    return null;
  }

  const u = userRows[0];
  const targetUserId = Number(u.id);

  const [roleRows] = await pool.query<RowDataPacket[]>(
    `SELECT r.name 
     FROM user_roles ur 
     INNER JOIN roles r ON ur.role_id = r.id 
     WHERE ur.user_id = ? 
     UNION 
     SELECT role AS name FROM users WHERE id = ? AND role IS NOT NULL`,
    [targetUserId, targetUserId]
  );

  const roles = roleRows.map((r) => String(r.name));
  if (roles.length === 0) roles.push(u.role || 'USER');

  const isDesigner = roles.includes('DESIGNER') || roles.includes('SUPER_ADMIN') || roles.includes('PLATFORM_ADMIN');

  const [followerCountRows] = await pool.query<RowDataPacket[]>(
    'SELECT COUNT(*) as total FROM user_follows WHERE following_id = ?',
    [targetUserId]
  );
  const followersCount = Number(followerCountRows[0]?.total || 0);

  const [followingCountRows] = await pool.query<RowDataPacket[]>(
    'SELECT COUNT(*) as total FROM user_follows WHERE follower_id = ?',
    [targetUserId]
  );
  const followingCount = Number(followingCountRows[0]?.total || 0);

  let isFollowing = false;
  if (currentUserId && currentUserId > 0 && currentUserId !== targetUserId) {
    const [followRows] = await pool.query<RowDataPacket[]>(
      'SELECT 1 FROM user_follows WHERE follower_id = ? AND following_id = ? LIMIT 1',
      [currentUserId, targetUserId]
    );
    isFollowing = followRows.length > 0;
  }

  let templatesCount = 0;
  try {
    const [tplCountRows] = await canvasPool.query<RowDataPacket[]>(
      'SELECT COUNT(*) as total FROM templates WHERE user_id = ? AND status = "approved"',
      [targetUserId]
    );
    templatesCount = Number(tplCountRows[0]?.total || 0);
  } catch {}

  const isMe = Boolean(currentUserId && currentUserId === targetUserId);

  let parsedSocialLinks: Record<string, string> | null = null;
  if (u.social_links) {
    parsedSocialLinks = typeof u.social_links === 'string' ? JSON.parse(u.social_links) : u.social_links;
  }

  return {
    avatar_url: u.avatar_url || null,
    banner_url: u.banner_url || null,
    bio: u.bio || null,
    country: u.country || null,
    created_at: u.created_at ? new Date(u.created_at).toISOString() : new Date().toISOString(),
    designer_handle: u.designer_handle || null,
    designer_handle_changed_at: u.designer_handle_changed_at ? new Date(u.designer_handle_changed_at).toISOString() : null,
    designer_onboarded: Boolean(u.designer_onboarded),
    followers_count: followersCount,
    following_count: followingCount,
    id: targetUserId,
    is_designer: isDesigner,
    is_following: isFollowing,
    is_me: isMe,
    role: u.role || 'USER',
    roles,
    social_links: parsedSocialLinks,
    subscription_tier: u.subscription_tier || 'free',
    templates_count: templatesCount,
    username: String(u.username),
    uuid: String(u.uuid || ''),
    website_url: u.website_url || null,
  };
}

export async function getUserPublishedTemplates(
  userId: number,
  options?: { limit?: number; offset?: number }
): Promise<UserTemplatesResponse> {
  if (userId === -1) {
    return {
      templates: OFFICIAL_SYSTEM_TEMPLATES,
      total: OFFICIAL_SYSTEM_TEMPLATES.length,
    };
  }

  const limit = Math.min(100, Math.max(1, options?.limit || 50));
  const offset = Math.max(0, options?.offset || 0);

  const [countRows] = await canvasPool.query<RowDataPacket[]>(
    'SELECT COUNT(*) as total FROM templates WHERE user_id = ? AND status = "approved"',
    [userId]
  );
  const total = Number(countRows[0]?.total || 0);

  const [rows] = await canvasPool.query<RowDataPacket[]>(
    `SELECT t.*, u.username AS author_username, u.avatar_url AS author_avatar
     FROM templates t
     INNER JOIN db_identity.users u ON t.user_id = u.id
     WHERE t.user_id = ? AND t.status = "approved"
     ORDER BY t.created_at DESC
     LIMIT ? OFFSET ?`,
    [userId, limit, offset]
  );

  const templates = rows.map((r) => ({
    author_avatar: r.author_avatar || null,
    author_username: r.author_username || 'Diseñador',
    canvas_data: typeof r.canvas_data === 'string' ? JSON.parse(r.canvas_data) : r.canvas_data,
    canvas_id: r.canvas_id ? Number(r.canvas_id) : null,
    canvas_type: r.canvas_type,
    category: r.category,
    created_at: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
    description: r.description || null,
    id: Number(r.id),
    is_official: Boolean(r.is_official),
    is_premium: Boolean(r.is_premium),
    preview_thumbnail: r.preview_thumbnail || null,
    status: r.status,
    tags: typeof r.tags === 'string' ? JSON.parse(r.tags) : (Array.isArray(r.tags) ? r.tags : []),
    title: r.title,
    updated_at: r.updated_at ? new Date(r.updated_at).toISOString() : new Date().toISOString(),
    uses_count: Number(r.uses_count || 0),
    user_id: Number(r.user_id),
    uuid: String(r.uuid),
  }));

  return { templates, total };
}

export async function toggleFollowUser(
  followerId: number,
  targetUsername: string
): Promise<ToggleFollowResult> {
  const cleanTarget = targetUsername.trim().replace(/^@+/, '').toLowerCase();
  const [targetRows] = await pool.query<RowDataPacket[]>(
    'SELECT id, username FROM users WHERE LOWER(username) = LOWER(?) OR LOWER(designer_handle) = LOWER(?) LIMIT 1',
    [cleanTarget, cleanTarget]
  );

  if (targetRows.length === 0) {
    throw new Error('USER_NOT_FOUND');
  }

  const targetUserId = Number(targetRows[0].id);
  if (followerId === targetUserId) {
    throw new Error('CANNOT_FOLLOW_SELF');
  }

  const [existing] = await pool.query<RowDataPacket[]>(
    'SELECT id FROM user_follows WHERE follower_id = ? AND following_id = ? LIMIT 1',
    [followerId, targetUserId]
  );

  let following = false;
  if (existing.length > 0) {
    await pool.query('DELETE FROM user_follows WHERE follower_id = ? AND following_id = ?', [followerId, targetUserId]);
    following = false;
  } else {
    await pool.query('INSERT INTO user_follows (follower_id, following_id) VALUES (?, ?)', [followerId, targetUserId]);
    following = true;
  }

  const [countRows] = await pool.query<RowDataPacket[]>(
    'SELECT COUNT(*) as total FROM user_follows WHERE following_id = ?',
    [targetUserId]
  );
  const followersCount = Number(countRows[0]?.total || 0);

  logger.app.info('Estado de seguimiento de usuario actualizado', {
    followerId,
    following,
    targetUserId,
  });

  return {
    followers_count: followersCount,
    following,
    success: true,
  };
}

export async function updateUserBanner(
  userId: number,
  file: Express.Multer.File,
  ip?: string | null,
  ua?: string | null
): Promise<{ banner_url?: string; error?: string; success: boolean }> {
  let imageBuffer: Buffer | null = file.buffer;

  if (!imageBuffer && file.path) {
    try {
      imageBuffer = await fs.promises.readFile(file.path);
      await safeUnlink(file.path);
    } catch (err) {
      logger.app.error('Error al leer archivo temporal de banner', err);
    }
  }

  if (!imageBuffer) {
    return { error: 'No se pudo leer el contenido de la imagen de portada.', success: false };
  }

  let sanitized;
  try {
    sanitized = await sanitizeBanner(imageBuffer);
  } catch (err: any) {
    logger.security.warn('Rechazo de sanitización de banner de perfil', {
      error: err?.message,
      userId,
    });
    return {
      error: err?.message || 'La imagen de portada no pudo ser procesada o tiene un formato no válido.',
      success: false,
    };
  }

  const [rows] = await pool.query<RowDataPacket[]>(
    'SELECT id, banner_url, is_protected FROM users WHERE id = ? LIMIT 1',
    [userId]
  );

  if (rows.length === 0) {
    return { error: 'Usuario no encontrado.', success: false };
  }

  if (rows[0].is_protected) {
    return { error: 'Esta cuenta está protegida por el sistema y sus datos no pueden ser modificados.', success: false };
  }

  const oldBannerUrl = rows[0].banner_url;

  if (oldBannerUrl && oldBannerUrl.startsWith('/uploads/banners/')) {
    const oldFileName = path.basename(oldBannerUrl);
    const oldS3Key = `uploads/banners/${oldFileName}`;
    await deleteObject(oldS3Key);
    const oldFilePath = path.join(BANNERS_DIR, oldFileName);
    await safeUnlink(oldFilePath);
  }

  const newFileName = `banner_${userId}_${Date.now()}.${sanitized.extension}`;
  const s3Key = `uploads/banners/${newFileName}`;

  try {
    await putObject(s3Key, sanitized.buffer, sanitized.mimeType);
  } catch (err) {
    logger.app.error('Error al persistir el banner en almacenamiento', err);
    return { error: 'Error al guardar la imagen en el servidor.', success: false };
  }

  const newBannerUrl = getPublicUrl(s3Key);

  await pool.query('UPDATE users SET banner_url = ? WHERE id = ?', [newBannerUrl, userId]);
  try {
    await redis.del(`user:profile:${userId}`);
  } catch {}
  await logUserAudit(userId, 'update_banner', oldBannerUrl, newBannerUrl, ip, ua);

  logger.app.info('Banner de usuario actualizado exitosamente', { newBannerUrl, userId });

  return { banner_url: newBannerUrl, success: true };
}

export async function deleteUserBanner(
  userId: number,
  ip?: string | null,
  ua?: string | null
): Promise<{ error?: string; success: boolean }> {
  const [rows] = await pool.query<RowDataPacket[]>(
    'SELECT id, banner_url, is_protected FROM users WHERE id = ? LIMIT 1',
    [userId]
  );

  if (rows.length === 0) {
    return { error: 'Usuario no encontrado.', success: false };
  }

  if (rows[0].is_protected) {
    return { error: 'Esta cuenta está protegida por el sistema y sus datos no pueden ser modificados.', success: false };
  }

  const oldBannerUrl = rows[0].banner_url;

  if (oldBannerUrl && oldBannerUrl.startsWith('/uploads/banners/')) {
    const oldFileName = path.basename(oldBannerUrl);
    const oldS3Key = `uploads/banners/${oldFileName}`;
    await deleteObject(oldS3Key);
    const oldFilePath = path.join(BANNERS_DIR, oldFileName);
    await safeUnlink(oldFilePath);
  }

  await pool.query('UPDATE users SET banner_url = NULL WHERE id = ?', [userId]);
  try {
    await redis.del(`user:profile:${userId}`);
  } catch {}
  await logUserAudit(userId, 'delete_banner', oldBannerUrl, null, ip, ua);

  logger.app.info('Banner de usuario eliminado exitosamente', { userId });

  return { success: true };
}
