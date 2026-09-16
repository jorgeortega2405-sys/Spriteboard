import crypto from 'crypto';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import { pool } from '../config/database.config.js';
import { Ad, Advertiser, CreateAdDto, CreateAdvertiserDto } from '../types/ad.types.js';
import { logger } from './logger.service.js';

let tablesInitialized = false;

export async function initAdsTables(): Promise<void> {
  if (tablesInitialized) return;
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS advertisers (
        id INT AUTO_INCREMENT PRIMARY KEY,
        uuid VARCHAR(36) NOT NULL UNIQUE,
        name VARCHAR(150) NOT NULL,
        type ENUM('direct', 'provider') NOT NULL DEFAULT 'direct',
        provider_name VARCHAR(100) DEFAULT NULL,
        website VARCHAR(255) DEFAULT NULL,
        contact_email VARCHAR(150) DEFAULT NULL,
        status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
        notes TEXT DEFAULT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_advertiser_status (status),
        INDEX idx_advertiser_type (type)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS ads (
        id INT AUTO_INCREMENT PRIMARY KEY,
        uuid VARCHAR(36) NOT NULL UNIQUE,
        advertiser_id INT NOT NULL,
        title VARCHAR(200) NOT NULL,
        description TEXT DEFAULT NULL,
        image_url VARCHAR(500) NOT NULL,
        target_url VARCHAR(500) NOT NULL,
        badge_text VARCHAR(50) DEFAULT 'AD',
        placements VARCHAR(100) NOT NULL DEFAULT 'home,templates',
        frequency INT NOT NULL DEFAULT 8,
        priority ENUM('low', 'normal', 'high') NOT NULL DEFAULT 'normal',
        status ENUM('active', 'paused') NOT NULL DEFAULT 'active',
        impressions_count INT UNSIGNED DEFAULT 0,
        clicks_count INT UNSIGNED DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_ads_advertiser (advertiser_id),
        INDEX idx_ads_status (status),
        INDEX idx_ads_placements (placements),
        CONSTRAINT fk_ads_advertiser FOREIGN KEY (advertiser_id) REFERENCES advertisers(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    tablesInitialized = true;
  } catch (error) {
    logger.db.error('Error al inicializar tablas de anuncios y anunciantes', error);
  }
}

export async function getAdvertisers(options: {
  limit?: number;
  page?: number;
  search?: string;
  status?: string;
  type?: string;
}): Promise<{
  advertisers: Advertiser[];
  pagination: { limit: number; page: number; total: number; totalPages: number };
}> {
  await initAdsTables();
  const page = Math.max(1, Number(options.page) || 1);
  const limit = Math.max(1, Math.min(100, Number(options.limit) || 20));
  const offset = (page - 1) * limit;

  const whereClauses: string[] = [];
  const params: unknown[] = [];

  if (options.search) {
    whereClauses.push('(adv.name LIKE ? OR adv.website LIKE ? OR adv.contact_email LIKE ?)');
    const term = `%${options.search}%`;
    params.push(term, term, term);
  }

  if (options.type && options.type !== 'all') {
    whereClauses.push('adv.type = ?');
    params.push(options.type);
  }

  if (options.status && options.status !== 'all') {
    whereClauses.push('adv.status = ?');
    params.push(options.status);
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  const [countRows] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) as total FROM advertisers adv ${whereSql}`,
    params
  );
  const total = Number(countRows[0]?.total || 0);
  const totalPages = Math.max(1, Math.ceil(total / limit));

  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT adv.*, COUNT(a.id) as ads_count
     FROM advertisers adv
     LEFT JOIN ads a ON a.advertiser_id = adv.id
     ${whereSql}
     GROUP BY adv.id
     ORDER BY adv.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  const advertisers: Advertiser[] = rows.map((r) => ({
    ads_count: Number(r.ads_count || 0),
    contact_email: r.contact_email || null,
    created_at: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
    id: Number(r.id),
    name: String(r.name),
    notes: r.notes || null,
    provider_name: r.provider_name || null,
    status: r.status as Advertiser['status'],
    type: r.type as Advertiser['type'],
    updated_at: r.updated_at ? new Date(r.updated_at).toISOString() : new Date().toISOString(),
    uuid: String(r.uuid),
    website: r.website || null,
  }));

  return {
    advertisers,
    pagination: { limit, page, total, totalPages },
  };
}

export async function getAdvertiserById(id: number): Promise<Advertiser | null> {
  await initAdsTables();
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT adv.*, COUNT(a.id) as ads_count
     FROM advertisers adv
     LEFT JOIN ads a ON a.advertiser_id = adv.id
     WHERE adv.id = ?
     GROUP BY adv.id
     LIMIT 1`,
    [id]
  );
  if (rows.length === 0) return null;
  const r = rows[0];
  return {
    ads_count: Number(r.ads_count || 0),
    contact_email: r.contact_email || null,
    created_at: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
    id: Number(r.id),
    name: String(r.name),
    notes: r.notes || null,
    provider_name: r.provider_name || null,
    status: r.status as Advertiser['status'],
    type: r.type as Advertiser['type'],
    updated_at: r.updated_at ? new Date(r.updated_at).toISOString() : new Date().toISOString(),
    uuid: String(r.uuid),
    website: r.website || null,
  };
}

export async function createAdvertiser(dto: CreateAdvertiserDto): Promise<Advertiser> {
  await initAdsTables();
  const uuid = crypto.randomUUID();
  const name = dto.name.trim();
  const type = dto.type === 'provider' ? 'provider' : 'direct';
  const providerName = type === 'provider' ? (dto.provider_name?.trim() || null) : null;
  const website = dto.website?.trim() || null;
  const contactEmail = dto.contact_email?.trim() || null;
  const status = dto.status === 'inactive' ? 'inactive' : 'active';
  const notes = dto.notes?.trim() || null;

  const [res] = await pool.query<ResultSetHeader>(
    `INSERT INTO advertisers (uuid, name, type, provider_name, website, contact_email, status, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [uuid, name, type, providerName, website, contactEmail, status, notes]
  );

  const created = await getAdvertiserById(res.insertId);
  if (!created) {
    throw new Error('Error al recuperar anunciante recién creado');
  }
  return created;
}

export async function updateAdvertiser(id: number, dto: Partial<CreateAdvertiserDto>): Promise<Advertiser | null> {
  await initAdsTables();
  const current = await getAdvertiserById(id);
  if (!current) return null;

  const name = dto.name !== undefined ? dto.name.trim() : current.name;
  const type = dto.type !== undefined ? (dto.type === 'provider' ? 'provider' : 'direct') : current.type;
  const providerName = type === 'provider' ? (dto.provider_name !== undefined ? (dto.provider_name?.trim() || null) : current.provider_name) : null;
  const website = dto.website !== undefined ? (dto.website?.trim() || null) : current.website;
  const contactEmail = dto.contact_email !== undefined ? (dto.contact_email?.trim() || null) : current.contact_email;
  const status = dto.status !== undefined ? (dto.status === 'inactive' ? 'inactive' : 'active') : current.status;
  const notes = dto.notes !== undefined ? (dto.notes?.trim() || null) : current.notes;

  await pool.query(
    `UPDATE advertisers
     SET name = ?, type = ?, provider_name = ?, website = ?, contact_email = ?, status = ?, notes = ?
     WHERE id = ?`,
    [name, type, providerName, website, contactEmail, status, notes, id]
  );

  return getAdvertiserById(id);
}

export async function deleteAdvertiser(id: number): Promise<boolean> {
  await initAdsTables();
  const [res] = await pool.query<ResultSetHeader>('DELETE FROM advertisers WHERE id = ?', [id]);
  return res.affectedRows > 0;
}

export async function getAdsByAdvertiserId(advertiserId: number): Promise<Ad[]> {
  await initAdsTables();
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT a.*, adv.name as advertiser_name
     FROM ads a
     JOIN advertisers adv ON adv.id = a.advertiser_id
     WHERE a.advertiser_id = ?
     ORDER BY a.created_at DESC`,
    [advertiserId]
  );

  return rows.map((r) => ({
    advertiser_id: Number(r.advertiser_id),
    advertiser_name: String(r.advertiser_name),
    badge_text: String(r.badge_text || 'AD'),
    clicks_count: Number(r.clicks_count || 0),
    created_at: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
    description: r.description || null,
    frequency: Number(r.frequency || 8),
    id: Number(r.id),
    image_url: String(r.image_url),
    impressions_count: Number(r.impressions_count || 0),
    placements: String(r.placements || 'home,templates'),
    priority: r.priority as Ad['priority'],
    status: r.status as Ad['status'],
    target_url: String(r.target_url),
    title: String(r.title),
    updated_at: r.updated_at ? new Date(r.updated_at).toISOString() : new Date().toISOString(),
    uuid: String(r.uuid),
  }));
}

export async function getAdById(id: number): Promise<Ad | null> {
  await initAdsTables();
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT a.*, adv.name as advertiser_name
     FROM ads a
     JOIN advertisers adv ON adv.id = a.advertiser_id
     WHERE a.id = ?
     LIMIT 1`,
    [id]
  );
  if (rows.length === 0) return null;
  const r = rows[0];
  return {
    advertiser_id: Number(r.advertiser_id),
    advertiser_name: String(r.advertiser_name),
    badge_text: String(r.badge_text || 'AD'),
    clicks_count: Number(r.clicks_count || 0),
    created_at: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
    description: r.description || null,
    frequency: Number(r.frequency || 8),
    id: Number(r.id),
    image_url: String(r.image_url),
    impressions_count: Number(r.impressions_count || 0),
    placements: String(r.placements || 'home,templates'),
    priority: r.priority as Ad['priority'],
    status: r.status as Ad['status'],
    target_url: String(r.target_url),
    title: String(r.title),
    updated_at: r.updated_at ? new Date(r.updated_at).toISOString() : new Date().toISOString(),
    uuid: String(r.uuid),
  };
}

export async function createAd(advertiserId: number, dto: CreateAdDto): Promise<Ad> {
  await initAdsTables();
  const uuid = crypto.randomUUID();
  const title = dto.title.trim();
  const description = dto.description?.trim() || null;
  const imageUrl = dto.image_url.trim();
  const targetUrl = dto.target_url.trim();
  const badgeText = dto.badge_text?.trim() || 'AD';
  const placements = dto.placements?.trim() || 'home,templates';
  const frequency = Math.max(1, Number(dto.frequency) || 8);
  const priority = dto.priority === 'high' || dto.priority === 'low' ? dto.priority : 'normal';
  const status = dto.status === 'paused' ? 'paused' : 'active';

  const [res] = await pool.query<ResultSetHeader>(
    `INSERT INTO ads (uuid, advertiser_id, title, description, image_url, target_url, badge_text, placements, frequency, priority, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [uuid, advertiserId, title, description, imageUrl, targetUrl, badgeText, placements, frequency, priority, status]
  );

  const created = await getAdById(res.insertId);
  if (!created) {
    throw new Error('Error al recuperar anuncio recién creado');
  }
  return created;
}

export async function updateAd(id: number, dto: Partial<CreateAdDto>): Promise<Ad | null> {
  await initAdsTables();
  const current = await getAdById(id);
  if (!current) return null;

  const title = dto.title !== undefined ? dto.title.trim() : current.title;
  const description = dto.description !== undefined ? (dto.description?.trim() || null) : current.description;
  const imageUrl = dto.image_url !== undefined ? dto.image_url.trim() : current.image_url;
  const targetUrl = dto.target_url !== undefined ? dto.target_url.trim() : current.target_url;
  const badgeText = dto.badge_text !== undefined ? (dto.badge_text?.trim() || 'AD') : current.badge_text;
  const placements = dto.placements !== undefined ? (dto.placements?.trim() || 'home,templates') : current.placements;
  const frequency = dto.frequency !== undefined ? Math.max(1, Number(dto.frequency) || 8) : current.frequency;
  const priority = dto.priority !== undefined ? (dto.priority === 'high' || dto.priority === 'low' ? dto.priority : 'normal') : current.priority;
  const status = dto.status !== undefined ? (dto.status === 'paused' ? 'paused' : 'active') : current.status;

  await pool.query(
    `UPDATE ads
     SET title = ?, description = ?, image_url = ?, target_url = ?, badge_text = ?, placements = ?, frequency = ?, priority = ?, status = ?
     WHERE id = ?`,
    [title, description, imageUrl, targetUrl, badgeText, placements, frequency, priority, status, id]
  );

  return getAdById(id);
}

export async function deleteAd(id: number): Promise<boolean> {
  await initAdsTables();
  const [res] = await pool.query<ResultSetHeader>('DELETE FROM ads WHERE id = ?', [id]);
  return res.affectedRows > 0;
}

export async function toggleAdStatus(id: number, forcedStatus?: Ad['status']): Promise<Ad | null> {
  await initAdsTables();
  const current = await getAdById(id);
  if (!current) return null;

  const nextStatus = forcedStatus !== undefined ? forcedStatus : (current.status === 'active' ? 'paused' : 'active');
  await pool.query('UPDATE ads SET status = ? WHERE id = ?', [nextStatus, id]);
  return getAdById(id);
}

export async function getActiveAdsByPlacement(placement: string): Promise<Ad[]> {
  await initAdsTables();
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT a.*, adv.name as advertiser_name
     FROM ads a
     JOIN advertisers adv ON adv.id = a.advertiser_id
     WHERE a.status = 'active'
       AND adv.status = 'active'
       AND (a.placements LIKE ? OR a.placements = 'all')
     ORDER BY 
       CASE 
         WHEN a.priority = 'high' THEN 1
         WHEN a.priority = 'normal' THEN 2
         ELSE 3
       END, a.created_at DESC`,
    [`%${placement}%`]
  );

  return rows.map((r) => ({
    advertiser_id: Number(r.advertiser_id),
    advertiser_name: String(r.advertiser_name),
    badge_text: String(r.badge_text || 'AD'),
    clicks_count: Number(r.clicks_count || 0),
    created_at: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
    description: r.description || null,
    frequency: Number(r.frequency || 8),
    id: Number(r.id),
    image_url: String(r.image_url),
    impressions_count: Number(r.impressions_count || 0),
    placements: String(r.placements || 'home,templates'),
    priority: r.priority as Ad['priority'],
    status: r.status as Ad['status'],
    target_url: String(r.target_url),
    title: String(r.title),
    updated_at: r.updated_at ? new Date(r.updated_at).toISOString() : new Date().toISOString(),
    uuid: String(r.uuid),
  }));
}
