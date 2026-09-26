import { canvasPool, pool } from '../config/database.config.js';
import { getTierLimits, hasFeatureAccess } from '../config/plans.config.js';
import { sanitizeImage } from './image-sanitizer.service.js';
import { logger } from './logger.service.js';
import { deleteObject, getPublicUrl, putObject } from './s3.service.js';
import { checkUserStorageQuota, invalidateUserStorageCache } from './storage.service.js';
import { sanitizeSvg } from './svg-sanitizer.service.js';
import { AddBrandChartDto, AddBrandColorDto, AddBrandTemplateDto, BrandAssetType, BrandColorType, BrandFontRole, BrandKit, BrandKitAsset, BrandKitChart, BrandKitColor, BrandKitDetail, BrandKitFont, BrandKitTemplate, CreateBrandKitDto, SetBrandFontDto, UpdateBrandKitDto } from '../types/brand.types.js';
import crypto from 'crypto';
import fs from 'fs';
import mysql from 'mysql2/promise';
import path from 'path';

const BRAND_UPLOADS_DIR = path.resolve(process.cwd(), 'public', 'uploads', 'brand');

async function ensureBrandMediaDir(): Promise<void> {
  try {
    await fs.promises.mkdir(BRAND_UPLOADS_DIR, { recursive: true });
  } catch {}
}

async function safeUnlink(filePath: string): Promise<void> {
  try {
    await fs.promises.unlink(filePath);
  } catch {}
}

export async function getUserBrandKits(userId: number): Promise<BrandKit[]> {
  const [rows] = await canvasPool.query<mysql.RowDataPacket[]>(
    'SELECT id, uuid, user_id, team_id, name, description, color, icon, is_default, brand_voice, brand_guidelines, created_at, updated_at FROM brand_kits WHERE user_id = ? ORDER BY is_default DESC, created_at DESC',
    [userId]
  );

  return rows.map((r) => ({
    brand_guidelines: typeof r.brand_guidelines === 'string' ? JSON.parse(r.brand_guidelines) : (r.brand_guidelines || null),
    brand_voice: r.brand_voice ? String(r.brand_voice) : null,
    color: String(r.color || '#6366f1'),
    created_at: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
    description: r.description ? String(r.description) : null,
    icon: r.icon ? String(r.icon) : 'workspace_premium',
    id: Number(r.id),
    is_default: Boolean(r.is_default),
    name: String(r.name),
    team_id: r.team_id !== null ? Number(r.team_id) : null,
    updated_at: r.updated_at ? new Date(r.updated_at).toISOString() : new Date().toISOString(),
    user_id: Number(r.user_id),
    uuid: String(r.uuid),
  }));
}

export async function getBrandKitDetail(uuid: string, userId: number): Promise<BrandKitDetail | null> {
  const [kitRows] = await canvasPool.query<mysql.RowDataPacket[]>(
    'SELECT id, uuid, user_id, team_id, name, description, color, icon, is_default, brand_voice, brand_guidelines, created_at, updated_at FROM brand_kits WHERE uuid = ? AND user_id = ? LIMIT 1',
    [uuid, userId]
  );

  if (kitRows.length === 0) {
    return null;
  }

  const kitRow = kitRows[0];
  const kitId = Number(kitRow.id);

  const [colorRows] = await canvasPool.query<mysql.RowDataPacket[]>(
    'SELECT id, uuid, brand_kit_id, palette_name, name, hex, color_type, gradient_data, sort_order, created_at FROM brand_kit_colors WHERE brand_kit_id = ? ORDER BY palette_name ASC, sort_order ASC, id ASC',
    [kitId]
  );

  const [fontRows] = await canvasPool.query<mysql.RowDataPacket[]>(
    'SELECT id, uuid, brand_kit_id, role, font_family, font_weight, font_style, font_size, line_height, letter_spacing, font_url, created_at FROM brand_kit_fonts WHERE brand_kit_id = ? ORDER BY id ASC',
    [kitId]
  );

  const [assetRows] = await canvasPool.query<mysql.RowDataPacket[]>(
    'SELECT id, uuid, brand_kit_id, asset_type, category, name, file_path, preview_url, mime_type, size_bytes, width, height, tags, sort_order, created_at FROM brand_kit_assets WHERE brand_kit_id = ? ORDER BY sort_order ASC, created_at DESC',
    [kitId]
  );

  const [chartRows] = await canvasPool.query<mysql.RowDataPacket[]>(
    'SELECT id, uuid, brand_kit_id, name, chart_type, palette, config, sample_data, sort_order, created_at FROM brand_kit_charts WHERE brand_kit_id = ? ORDER BY sort_order ASC, id ASC',
    [kitId]
  );

  const [templateRows] = await canvasPool.query<mysql.RowDataPacket[]>(
    'SELECT id, uuid, brand_kit_id, canvas_id, name, description, canvas_type, preview_thumbnail, canvas_data, sort_order, created_at FROM brand_kit_templates WHERE brand_kit_id = ? ORDER BY sort_order ASC, created_at DESC',
    [kitId]
  );

  const colors: BrandKitColor[] = colorRows.map((r) => ({
    brand_kit_id: Number(r.brand_kit_id),
    color_type: r.color_type as BrandColorType,
    created_at: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
    gradient_data: typeof r.gradient_data === 'string' ? JSON.parse(r.gradient_data) : (r.gradient_data || null),
    hex: String(r.hex),
    id: Number(r.id),
    name: String(r.name),
    palette_name: String(r.palette_name || 'Paleta principal'),
    sort_order: Number(r.sort_order || 0),
    uuid: String(r.uuid),
  }));

  const fonts: BrandKitFont[] = fontRows.map((r) => ({
    brand_kit_id: Number(r.brand_kit_id),
    created_at: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
    font_family: String(r.font_family),
    font_size: r.font_size !== null ? Number(r.font_size) : null,
    font_style: String(r.font_style || 'normal'),
    font_url: r.font_url ? String(r.font_url) : null,
    font_weight: String(r.font_weight || '400'),
    id: Number(r.id),
    letter_spacing: r.letter_spacing ? String(r.letter_spacing) : null,
    line_height: r.line_height !== null ? Number(r.line_height) : null,
    role: r.role as BrandFontRole,
    uuid: String(r.uuid),
  }));

  const allAssets: BrandKitAsset[] = assetRows.map((r) => ({
    asset_type: r.asset_type as BrandAssetType,
    brand_kit_id: Number(r.brand_kit_id),
    category: String(r.category || 'general'),
    created_at: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
    file_path: String(r.file_path),
    height: r.height !== null ? Number(r.height) : null,
    id: Number(r.id),
    mime_type: String(r.mime_type),
    name: String(r.name),
    preview_url: r.preview_url ? String(r.preview_url) : null,
    size_bytes: Number(r.size_bytes || 0),
    sort_order: Number(r.sort_order || 0),
    tags: typeof r.tags === 'string' ? JSON.parse(r.tags) : (r.tags || null),
    url: String(r.file_path).startsWith('http') ? String(r.file_path) : getPublicUrl(String(r.file_path)),
    uuid: String(r.uuid),
    width: r.width !== null ? Number(r.width) : null,
  }));

  const logos = allAssets.filter((a) => a.asset_type === 'logo');
  const photos = allAssets.filter((a) => a.asset_type === 'photo');
  const elements = allAssets.filter((a) => a.asset_type === 'element' || a.asset_type === 'graphic' || a.asset_type === 'icon');
  const customFonts = allAssets.filter((a) => a.asset_type === 'font');

  const charts: BrandKitChart[] = chartRows.map((r) => ({
    brand_kit_id: Number(r.brand_kit_id),
    chart_type: String(r.chart_type || 'bar'),
    config: typeof r.config === 'string' ? JSON.parse(r.config) : (r.config || null),
    created_at: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
    id: Number(r.id),
    name: String(r.name),
    palette: typeof r.palette === 'string' ? JSON.parse(r.palette) : (Array.isArray(r.palette) ? r.palette : []),
    sample_data: typeof r.sample_data === 'string' ? JSON.parse(r.sample_data) : (r.sample_data || null),
    sort_order: Number(r.sort_order || 0),
    uuid: String(r.uuid),
  }));

  const templates: BrandKitTemplate[] = templateRows.map((r) => ({
    brand_kit_id: Number(r.brand_kit_id),
    canvas_data: typeof r.canvas_data === 'string' ? JSON.parse(r.canvas_data) : (r.canvas_data || null),
    canvas_id: r.canvas_id !== null ? Number(r.canvas_id) : null,
    canvas_type: (r.canvas_type || 'board') as 'board' | 'presentation' | 'doc',
    created_at: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
    description: r.description ? String(r.description) : null,
    id: Number(r.id),
    name: String(r.name),
    preview_thumbnail: r.preview_thumbnail ? String(r.preview_thumbnail) : null,
    sort_order: Number(r.sort_order || 0),
    uuid: String(r.uuid),
  }));

  return {
    brand_guidelines: typeof kitRow.brand_guidelines === 'string' ? JSON.parse(kitRow.brand_guidelines) : (kitRow.brand_guidelines || null),
    brand_voice: kitRow.brand_voice ? String(kitRow.brand_voice) : null,
    charts,
    color: String(kitRow.color || '#6366f1'),
    colors,
    created_at: kitRow.created_at ? new Date(kitRow.created_at).toISOString() : new Date().toISOString(),
    custom_fonts: customFonts,
    description: kitRow.description ? String(kitRow.description) : null,
    elements,
    fonts,
    icon: kitRow.icon ? String(kitRow.icon) : 'workspace_premium',
    id: kitId,
    is_default: Boolean(kitRow.is_default),
    logos,
    name: String(kitRow.name),
    photos,
    team_id: kitRow.team_id !== null ? Number(kitRow.team_id) : null,
    templates,
    updated_at: kitRow.updated_at ? new Date(kitRow.updated_at).toISOString() : new Date().toISOString(),
    user_id: Number(kitRow.user_id),
    uuid: String(kitRow.uuid),
  };
}

export async function createBrandKit(userId: number, dto: CreateBrandKitDto): Promise<BrandKitDetail> {
  const [uRows] = await pool.query<mysql.RowDataPacket[]>(
    'SELECT subscription_tier FROM users WHERE id = ? LIMIT 1',
    [userId]
  );
  const userTier = uRows[0]?.subscription_tier || 'free';

  if (!hasFeatureAccess(userTier, 'brand_kits')) {
    throw new Error('La creación de kits de marca es exclusiva del plan Spriteboard Negocios.');
  }

  const tierLimits = getTierLimits(userTier);
  const maxKits = tierLimits.maxBrandKits || 500;

  const [countRows] = await canvasPool.query<mysql.RowDataPacket[]>(
    'SELECT COUNT(id) AS total FROM brand_kits WHERE user_id = ?',
    [userId]
  );
  const totalExisting = Number(countRows[0]?.total || 0);

  if (totalExisting >= maxKits) {
    throw new Error(`Has alcanzado el límite máximo de kits de marca (${maxKits}).`);
  }

  const uuid = crypto.randomUUID();
  const name = dto.name.trim().slice(0, 100);
  const description = dto.description?.trim().slice(0, 255) || null;
  const color = dto.color?.trim().slice(0, 20) || '#6366f1';
  const icon = dto.icon?.trim().slice(0, 50) || 'workspace_premium';
  const isDefault = totalExisting === 0 || Boolean(dto.is_default);
  const brandVoice = dto.brand_voice?.trim() || null;
  const brandGuidelines = dto.brand_guidelines ? JSON.stringify(dto.brand_guidelines) : null;
  const teamId = dto.team_id !== undefined ? dto.team_id : null;

  if (isDefault && totalExisting > 0) {
    await canvasPool.query('UPDATE brand_kits SET is_default = FALSE WHERE user_id = ?', [userId]);
  }

  const [insertRes] = await canvasPool.execute<mysql.ResultSetHeader>(
    'INSERT INTO brand_kits (uuid, user_id, team_id, name, description, color, icon, is_default, brand_voice, brand_guidelines) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [uuid, userId, teamId, name, description, color, icon, isDefault, brandVoice, brandGuidelines]
  );

  const newKitId = insertRes.insertId;

  const defaultPalettes = [
    { color_type: 'primary', hex: '#6366f1', name: 'Primario', palette_name: 'Paleta principal', sort_order: 1 },
    { color_type: 'secondary', hex: '#8b5cf6', name: 'Secundario', palette_name: 'Paleta principal', sort_order: 2 },
    { color_type: 'accent', hex: '#ec4899', name: 'Acento', palette_name: 'Paleta principal', sort_order: 3 },
    { color_type: 'neutral', hex: '#0f172a', name: 'Oscuro', palette_name: 'Paleta principal', sort_order: 4 },
    { color_type: 'background', hex: '#ffffff', name: 'Claro', palette_name: 'Paleta principal', sort_order: 5 },
  ];

  for (const p of defaultPalettes) {
    await canvasPool.execute(
      'INSERT INTO brand_kit_colors (uuid, brand_kit_id, palette_name, name, hex, color_type, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [crypto.randomUUID(), newKitId, p.palette_name, p.name, p.hex, p.color_type, p.sort_order]
    );
  }

  const defaultFonts = [
    { font_family: 'Inter', font_size: 48, font_style: 'normal', font_weight: '700', line_height: 1.2, role: 'title' },
    { font_family: 'Inter', font_size: 28, font_style: 'normal', font_weight: '600', line_height: 1.3, role: 'subtitle' },
    { font_family: 'Inter', font_size: 20, font_style: 'normal', font_weight: '600', line_height: 1.4, role: 'heading_2' },
    { font_family: 'Inter', font_size: 14, font_style: 'normal', font_weight: '400', line_height: 1.5, role: 'body' },
    { font_family: 'Inter', font_size: 11, font_style: 'normal', font_weight: '400', line_height: 1.4, role: 'caption' },
  ];

  for (const f of defaultFonts) {
    await canvasPool.execute(
      'INSERT INTO brand_kit_fonts (uuid, brand_kit_id, role, font_family, font_weight, font_style, font_size, line_height) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [crypto.randomUUID(), newKitId, f.role, f.font_family, f.font_weight, f.font_style, f.font_size, f.line_height]
    );
  }

  const defaultChartPalette = JSON.stringify(['#6366f1', '#8b5cf6', '#ec4899', '#3b82f6', '#10b981', '#f59e0b']);
  await canvasPool.execute(
    'INSERT INTO brand_kit_charts (uuid, brand_kit_id, name, chart_type, palette, config) VALUES (?, ?, ?, ?, ?, ?)',
    [crypto.randomUUID(), newKitId, 'Estilo estándar de la marca', 'bar', defaultChartPalette, JSON.stringify({ borderRadius: 6, showGrid: true })]
  );

  logger.db.info(`Kit de marca creado: "${name}" (${uuid}) para usuario ${userId}`);

  const detail = await getBrandKitDetail(uuid, userId);
  return detail!;
}

export async function updateBrandKit(uuid: string, userId: number, dto: UpdateBrandKitDto): Promise<BrandKitDetail> {
  const [rows] = await canvasPool.query<mysql.RowDataPacket[]>(
    'SELECT id, is_default FROM brand_kits WHERE uuid = ? AND user_id = ? LIMIT 1',
    [uuid, userId]
  );

  if (rows.length === 0) {
    throw new Error('Kit de marca no encontrado.');
  }

  const kitId = Number(rows[0].id);
  const updates: string[] = [];
  const params: any[] = [];

  if (dto.name !== undefined) {
    updates.push('name = ?');
    params.push(dto.name.trim().slice(0, 100));
  }
  if (dto.description !== undefined) {
    updates.push('description = ?');
    params.push(dto.description ? dto.description.trim().slice(0, 255) : null);
  }
  if (dto.color !== undefined) {
    updates.push('color = ?');
    params.push(dto.color.trim().slice(0, 20));
  }
  if (dto.icon !== undefined) {
    updates.push('icon = ?');
    params.push(dto.icon.trim().slice(0, 50));
  }
  if (dto.brand_voice !== undefined) {
    updates.push('brand_voice = ?');
    params.push(dto.brand_voice ? dto.brand_voice.trim() : null);
  }
  if (dto.brand_guidelines !== undefined) {
    updates.push('brand_guidelines = ?');
    params.push(dto.brand_guidelines ? JSON.stringify(dto.brand_guidelines) : null);
  }
  if (dto.is_default !== undefined) {
    if (dto.is_default) {
      await canvasPool.query('UPDATE brand_kits SET is_default = FALSE WHERE user_id = ?', [userId]);
    }
    updates.push('is_default = ?');
    params.push(Boolean(dto.is_default));
  }

  if (updates.length > 0) {
    params.push(kitId);
    await canvasPool.query(`UPDATE brand_kits SET ${updates.join(', ')} WHERE id = ?`, params);
  }

  const detail = await getBrandKitDetail(uuid, userId);
  return detail!;
}

export async function deleteBrandKit(uuid: string, userId: number): Promise<boolean> {
  const [rows] = await canvasPool.query<mysql.RowDataPacket[]>(
    'SELECT id, is_default FROM brand_kits WHERE uuid = ? AND user_id = ? LIMIT 1',
    [uuid, userId]
  );

  if (rows.length === 0) {
    throw new Error('Kit de marca no encontrado.');
  }

  const kitId = Number(rows[0].id);
  const wasDefault = Boolean(rows[0].is_default);

  const [assets] = await canvasPool.query<mysql.RowDataPacket[]>(
    'SELECT file_path FROM brand_kit_assets WHERE brand_kit_id = ?',
    [kitId]
  );

  for (const a of assets) {
    const filePath = String(a.file_path);
    const fileName = path.basename(filePath);
    const s3Key = `uploads/brand/${fileName}`;
    try {
      await deleteObject(s3Key);
    } catch {}
    const localPath = path.join(BRAND_UPLOADS_DIR, fileName);
    await safeUnlink(localPath);
  }

  await canvasPool.query('DELETE FROM brand_kits WHERE id = ?', [kitId]);

  if (wasDefault) {
    const [remaining] = await canvasPool.query<mysql.RowDataPacket[]>(
      'SELECT id FROM brand_kits WHERE user_id = ? ORDER BY created_at DESC LIMIT 1',
      [userId]
    );
    if (remaining.length > 0) {
      await canvasPool.query('UPDATE brand_kits SET is_default = TRUE WHERE id = ?', [remaining[0].id]);
    }
  }

  logger.db.info(`Kit de marca eliminado: ${uuid} por usuario ${userId}`);
  return true;
}

export async function duplicateBrandKit(uuid: string, userId: number): Promise<BrandKitDetail> {
  const original = await getBrandKitDetail(uuid, userId);
  if (!original) {
    throw new Error('Kit de marca no encontrado.');
  }

  const [uRows] = await pool.query<mysql.RowDataPacket[]>(
    'SELECT subscription_tier FROM users WHERE id = ? LIMIT 1',
    [userId]
  );
  const userTier = uRows[0]?.subscription_tier || 'free';
  const tierLimits = getTierLimits(userTier);
  const maxKits = tierLimits.maxBrandKits || 500;

  const [countRows] = await canvasPool.query<mysql.RowDataPacket[]>(
    'SELECT COUNT(id) AS total FROM brand_kits WHERE user_id = ?',
    [userId]
  );
  const totalExisting = Number(countRows[0]?.total || 0);

  if (totalExisting >= maxKits) {
    throw new Error(`Has alcanzado el límite máximo de kits de marca (${maxKits}).`);
  }

  const newUuid = crypto.randomUUID();
  const newName = `${original.name} (Copia)`.slice(0, 100);

  const [insertRes] = await canvasPool.execute<mysql.ResultSetHeader>(
    'INSERT INTO brand_kits (uuid, user_id, team_id, name, description, color, icon, is_default, brand_voice, brand_guidelines) VALUES (?, ?, ?, ?, ?, ?, ?, FALSE, ?, ?)',
    [
      newUuid,
      userId,
      original.team_id,
      newName,
      original.description,
      original.color,
      original.icon,
      original.brand_voice,
      original.brand_guidelines ? JSON.stringify(original.brand_guidelines) : null,
    ]
  );

  const newKitId = insertRes.insertId;

  for (const c of original.colors) {
    await canvasPool.execute(
      'INSERT INTO brand_kit_colors (uuid, brand_kit_id, palette_name, name, hex, color_type, gradient_data, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [crypto.randomUUID(), newKitId, c.palette_name, c.name, c.hex, c.color_type, c.gradient_data ? JSON.stringify(c.gradient_data) : null, c.sort_order]
    );
  }

  for (const f of original.fonts) {
    await canvasPool.execute(
      'INSERT INTO brand_kit_fonts (uuid, brand_kit_id, role, font_family, font_weight, font_style, font_size, line_height, letter_spacing, font_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [crypto.randomUUID(), newKitId, f.role, f.font_family, f.font_weight, f.font_style, f.font_size, f.line_height, f.letter_spacing, f.font_url]
    );
  }

  const allAssets = [...original.logos, ...original.photos, ...original.elements];
  for (const a of allAssets) {
    await canvasPool.execute(
      'INSERT INTO brand_kit_assets (uuid, brand_kit_id, asset_type, category, name, file_path, preview_url, mime_type, size_bytes, width, height, tags, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [crypto.randomUUID(), newKitId, a.asset_type, a.category, a.name, a.file_path, a.preview_url, a.mime_type, a.size_bytes, a.width, a.height, a.tags ? JSON.stringify(a.tags) : null, a.sort_order]
    );
  }

  for (const ch of original.charts) {
    await canvasPool.execute(
      'INSERT INTO brand_kit_charts (uuid, brand_kit_id, name, chart_type, palette, config, sample_data, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [crypto.randomUUID(), newKitId, ch.name, ch.chart_type, JSON.stringify(ch.palette), ch.config ? JSON.stringify(ch.config) : null, ch.sample_data ? JSON.stringify(ch.sample_data) : null, ch.sort_order]
    );
  }

  for (const t of original.templates) {
    await canvasPool.execute(
      'INSERT INTO brand_kit_templates (uuid, brand_kit_id, canvas_id, name, description, canvas_type, preview_thumbnail, canvas_data, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [crypto.randomUUID(), newKitId, t.canvas_id, t.name, t.description, t.canvas_type, t.preview_thumbnail, t.canvas_data ? JSON.stringify(t.canvas_data) : null, t.sort_order]
    );
  }

  logger.db.info(`Kit de marca duplicado: "${newName}" (${newUuid}) a partir de ${uuid}`);

  const detail = await getBrandKitDetail(newUuid, userId);
  return detail!;
}

export async function setDefaultBrandKit(uuid: string, userId: number): Promise<boolean> {
  const [rows] = await canvasPool.query<mysql.RowDataPacket[]>(
    'SELECT id FROM brand_kits WHERE uuid = ? AND user_id = ? LIMIT 1',
    [uuid, userId]
  );

  if (rows.length === 0) {
    throw new Error('Kit de marca no encontrado.');
  }

  await canvasPool.query('UPDATE brand_kits SET is_default = FALSE WHERE user_id = ?', [userId]);
  await canvasPool.query('UPDATE brand_kits SET is_default = TRUE WHERE uuid = ? AND user_id = ?', [uuid, userId]);

  return true;
}

export async function addBrandColor(kitUuid: string, userId: number, dto: AddBrandColorDto): Promise<BrandKitColor> {
  const [kitRows] = await canvasPool.query<mysql.RowDataPacket[]>(
    'SELECT id FROM brand_kits WHERE uuid = ? AND user_id = ? LIMIT 1',
    [kitUuid, userId]
  );

  if (kitRows.length === 0) {
    throw new Error('Kit de marca no encontrado.');
  }

  const kitId = Number(kitRows[0].id);
  const colorUuid = crypto.randomUUID();
  const paletteName = dto.palette_name?.trim() || 'Paleta principal';
  const name = dto.name.trim().slice(0, 100);
  const hex = dto.hex.trim().slice(0, 20);
  const colorType = dto.color_type || 'primary';
  const gradientData = dto.gradient_data ? JSON.stringify(dto.gradient_data) : null;
  const sortOrder = Number(dto.sort_order || 0);

  const [insertRes] = await canvasPool.execute<mysql.ResultSetHeader>(
    'INSERT INTO brand_kit_colors (uuid, brand_kit_id, palette_name, name, hex, color_type, gradient_data, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [colorUuid, kitId, paletteName, name, hex, colorType, gradientData, sortOrder]
  );

  return {
    brand_kit_id: kitId,
    color_type: colorType,
    created_at: new Date().toISOString(),
    gradient_data: dto.gradient_data || null,
    hex,
    id: insertRes.insertId,
    name,
    palette_name: paletteName,
    sort_order: sortOrder,
    uuid: colorUuid,
  };
}

export async function deleteBrandColor(kitUuid: string, colorUuid: string, userId: number): Promise<boolean> {
  const [kitRows] = await canvasPool.query<mysql.RowDataPacket[]>(
    'SELECT id FROM brand_kits WHERE uuid = ? AND user_id = ? LIMIT 1',
    [kitUuid, userId]
  );

  if (kitRows.length === 0) {
    throw new Error('Kit de marca no encontrado.');
  }

  const kitId = Number(kitRows[0].id);
  await canvasPool.query('DELETE FROM brand_kit_colors WHERE uuid = ? AND brand_kit_id = ?', [colorUuid, kitId]);
  return true;
}

export async function deleteBrandFont(kitUuid: string, fontUuid: string, userId: number): Promise<boolean> {
  const [kitRows] = await canvasPool.query<mysql.RowDataPacket[]>(
    'SELECT id FROM brand_kits WHERE uuid = ? AND user_id = ? LIMIT 1',
    [kitUuid, userId]
  );

  if (kitRows.length === 0) {
    throw new Error('Kit de marca no encontrado.');
  }

  const kitId = Number(kitRows[0].id);
  await canvasPool.query('DELETE FROM brand_kit_fonts WHERE uuid = ? AND brand_kit_id = ?', [fontUuid, kitId]);
  return true;
}

export async function setBrandFonts(kitUuid: string, userId: number, fontDtos: SetBrandFontDto[]): Promise<BrandKitFont[]> {
  const [kitRows] = await canvasPool.query<mysql.RowDataPacket[]>(
    'SELECT id FROM brand_kits WHERE uuid = ? AND user_id = ? LIMIT 1',
    [kitUuid, userId]
  );

  if (kitRows.length === 0) {
    throw new Error('Kit de marca no encontrado.');
  }

  const kitId = Number(kitRows[0].id);

  for (const f of fontDtos) {
    const fontUuid = crypto.randomUUID();
    const fontFamily = f.font_family.trim().slice(0, 100);
    const fontWeight = (f.font_weight || '400').slice(0, 20);
    const fontStyle = (f.font_style || 'normal').slice(0, 20);
    const fontSize = f.font_size !== undefined ? f.font_size : null;
    const lineHeight = f.line_height !== undefined ? f.line_height : null;
    const letterSpacing = f.letter_spacing !== undefined ? f.letter_spacing : null;
    const fontUrl = f.font_url ? f.font_url.trim().slice(0, 512) : null;

    await canvasPool.execute(
      `INSERT INTO brand_kit_fonts (uuid, brand_kit_id, role, font_family, font_weight, font_style, font_size, line_height, letter_spacing, font_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         font_family = VALUES(font_family),
         font_weight = VALUES(font_weight),
         font_style = VALUES(font_style),
         font_size = VALUES(font_size),
         line_height = VALUES(line_height),
         letter_spacing = VALUES(letter_spacing),
         font_url = VALUES(font_url)`,
      [fontUuid, kitId, f.role, fontFamily, fontWeight, fontStyle, fontSize, lineHeight, letterSpacing, fontUrl]
    );
  }

  const [fontRows] = await canvasPool.query<mysql.RowDataPacket[]>(
    'SELECT id, uuid, brand_kit_id, role, font_family, font_weight, font_style, font_size, line_height, letter_spacing, font_url, created_at FROM brand_kit_fonts WHERE brand_kit_id = ? ORDER BY id ASC',
    [kitId]
  );

  return fontRows.map((r) => ({
    brand_kit_id: Number(r.brand_kit_id),
    created_at: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
    font_family: String(r.font_family),
    font_size: r.font_size !== null ? Number(r.font_size) : null,
    font_style: String(r.font_style || 'normal'),
    font_url: r.font_url ? String(r.font_url) : null,
    font_weight: String(r.font_weight || '400'),
    id: Number(r.id),
    letter_spacing: r.letter_spacing ? String(r.letter_spacing) : null,
    line_height: r.line_height !== null ? Number(r.line_height) : null,
    role: r.role as BrandFontRole,
    uuid: String(r.uuid),
  }));
}

export async function saveBrandAsset(
  kitUuid: string,
  userId: number,
  assetType: BrandAssetType,
  category: string,
  name: string,
  file: Express.Multer.File,
  tags?: string[]
): Promise<BrandKitAsset> {
  const [kitRows] = await canvasPool.query<mysql.RowDataPacket[]>(
    'SELECT id FROM brand_kits WHERE uuid = ? AND user_id = ? LIMIT 1',
    [kitUuid, userId]
  );

  if (kitRows.length === 0) {
    throw new Error('Kit de marca no encontrado.');
  }

  const kitId = Number(kitRows[0].id);

  if (!file) {
    throw new Error('No se ha proporcionado ningún archivo.');
  }

  const quota = await checkUserStorageQuota(userId, file.size || (file.buffer ? file.buffer.length : 0));
  if (!quota.allowed) {
    if (file.path) await safeUnlink(file.path);
    throw new Error(`Has superado el límite de almacenamiento (${quota.limitFormatted}).`);
  }

  let buffer: Buffer | null = null;
  if (file.buffer) {
    buffer = file.buffer;
  } else if (file.path) {
    try {
      buffer = await fs.promises.readFile(file.path);
      await safeUnlink(file.path);
    } catch (err) {
      logger.app.error('Error al leer archivo temporal para kit de marca', err);
    }
  }

  if (!buffer || buffer.length === 0) {
    throw new Error('El archivo está vacío o no se pudo procesar.');
  }

  const originalExt = path.extname(file.originalname || '').toLowerCase().replace('.', '');
  const isFont = assetType === 'font' || ['ttf', 'otf', 'woff', 'woff2', 'eot'].includes(originalExt);
  const isSvg = (file.mimetype && file.mimetype.includes('svg')) || (file.originalname && file.originalname.toLowerCase().endsWith('.svg'));
  let finalBuffer = buffer;
  let finalMime = file.mimetype || 'image/png';
  let finalWidth: number | null = null;
  let finalHeight: number | null = null;
  let extension = isSvg ? 'svg' : (isFont ? (originalExt || 'woff2') : 'png');
  let finalAssetType = isFont ? 'font' as BrandAssetType : assetType;

  if (isFont) {
    if (extension === 'woff2') finalMime = 'font/woff2';
    else if (extension === 'woff') finalMime = 'font/woff';
    else if (extension === 'ttf') finalMime = 'font/ttf';
    else if (extension === 'otf') finalMime = 'font/otf';
    else if (extension === 'eot') finalMime = 'application/vnd.ms-fontobject';
    else finalMime = 'application/octet-stream';
  } else if (isSvg) {
    try {
      const sanitized = sanitizeSvg(buffer);
      finalBuffer = sanitized.buffer;
      finalMime = sanitized.mimeType;
      finalWidth = sanitized.width;
      finalHeight = sanitized.height;
      extension = sanitized.extension;
    } catch (err: any) {
      throw new Error('El archivo SVG no es válido, está corrupto o contiene contenido no autorizado.');
    }
  } else {
    try {
      const sanitized = await sanitizeImage(buffer, {
        format: 'original',
        maxHeight: 4096,
        maxPixels: 16 * 1024 * 1024,
        maxWidth: 4096,
        quality: 90,
      });
      finalBuffer = sanitized.buffer;
      finalMime = sanitized.mimeType;
      finalWidth = sanitized.width || null;
      finalHeight = sanitized.height || null;
      extension = sanitized.extension;
    } catch (err: any) {
      throw new Error('El archivo no es una imagen válida o compatible (PNG, JPG, SVG, WEBP).');
    }
  }

  await ensureBrandMediaDir();

  const assetUuid = crypto.randomUUID();
  const defaultBaseName = isFont ? (path.parse(file.originalname || 'Fuente').name || 'Fuente') : (file.originalname || 'recurso');
  const rawOriginalName = (name || defaultBaseName).replace(/[^\w.-]/gi, '_');
  const safeName = rawOriginalName.slice(0, 140) || (isFont ? 'Fuente' : 'recurso');
  const newFileName = `brand_${kitId}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}.${extension}`;
  const s3Key = `uploads/brand/${newFileName}`;
  const localFilePath = path.join(BRAND_UPLOADS_DIR, newFileName);

  try {
    await fs.promises.writeFile(localFilePath, finalBuffer);
  } catch (err) {
    logger.app.error('Error al guardar archivo de marca en disco local', err);
  }

  try {
    await putObject(s3Key, finalBuffer, finalMime);
  } catch (err) {
    logger.app.error('Error al guardar archivo de marca en S3', err);
  }

  const publicUrl = getPublicUrl(s3Key);

  const [insertRes] = await canvasPool.execute<mysql.ResultSetHeader>(
    'INSERT INTO brand_kit_assets (uuid, brand_kit_id, asset_type, category, name, file_path, preview_url, mime_type, size_bytes, width, height, tags) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [
      assetUuid,
      kitId,
      finalAssetType,
      category.slice(0, 50),
      safeName,
      publicUrl,
      publicUrl,
      finalMime,
      finalBuffer.length,
      finalWidth,
      finalHeight,
      tags ? JSON.stringify(tags) : null,
    ]
  );

  await invalidateUserStorageCache(userId);

  return {
    asset_type: finalAssetType,
    brand_kit_id: kitId,
    category,
    created_at: new Date().toISOString(),
    file_path: publicUrl,
    height: finalHeight,
    id: insertRes.insertId,
    mime_type: finalMime,
    name: safeName,
    preview_url: publicUrl,
    size_bytes: finalBuffer.length,
    sort_order: 0,
    tags: tags || null,
    url: publicUrl,
    uuid: assetUuid,
    width: finalWidth,
  };
}

export async function deleteBrandAsset(kitUuid: string, assetUuid: string, userId: number): Promise<boolean> {
  const [kitRows] = await canvasPool.query<mysql.RowDataPacket[]>(
    'SELECT id FROM brand_kits WHERE uuid = ? AND user_id = ? LIMIT 1',
    [kitUuid, userId]
  );

  if (kitRows.length === 0) {
    throw new Error('Kit de marca no encontrado.');
  }

  const kitId = Number(kitRows[0].id);

  const [assetRows] = await canvasPool.query<mysql.RowDataPacket[]>(
    'SELECT id, file_path FROM brand_kit_assets WHERE uuid = ? AND brand_kit_id = ? LIMIT 1',
    [assetUuid, kitId]
  );

  if (assetRows.length === 0) {
    throw new Error('Recurso no encontrado.');
  }

  const filePath = String(assetRows[0].file_path);
  const fileName = path.basename(filePath);
  const s3Key = `uploads/brand/${fileName}`;

  try {
    await deleteObject(s3Key);
  } catch {}

  const localPath = path.join(BRAND_UPLOADS_DIR, fileName);
  await safeUnlink(localPath);

  await canvasPool.query('DELETE FROM brand_kit_assets WHERE id = ?', [assetRows[0].id]);
  await invalidateUserStorageCache(userId);

  return true;
}

export async function addBrandChart(kitUuid: string, userId: number, dto: AddBrandChartDto): Promise<BrandKitChart> {
  const [kitRows] = await canvasPool.query<mysql.RowDataPacket[]>(
    'SELECT id FROM brand_kits WHERE uuid = ? AND user_id = ? LIMIT 1',
    [kitUuid, userId]
  );

  if (kitRows.length === 0) {
    throw new Error('Kit de marca no encontrado.');
  }

  const kitId = Number(kitRows[0].id);
  const chartUuid = crypto.randomUUID();
  const name = dto.name.trim().slice(0, 100);
  const chartType = (dto.chart_type || 'bar').slice(0, 50);
  const palette = JSON.stringify(Array.isArray(dto.palette) ? dto.palette : ['#6366f1', '#8b5cf6', '#ec4899']);
  const config = dto.config ? JSON.stringify(dto.config) : null;
  const sampleData = dto.sample_data ? JSON.stringify(dto.sample_data) : null;

  const [insertRes] = await canvasPool.execute<mysql.ResultSetHeader>(
    'INSERT INTO brand_kit_charts (uuid, brand_kit_id, name, chart_type, palette, config, sample_data) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [chartUuid, kitId, name, chartType, palette, config, sampleData]
  );

  return {
    brand_kit_id: kitId,
    chart_type: chartType,
    config: dto.config || null,
    created_at: new Date().toISOString(),
    id: insertRes.insertId,
    name,
    palette: Array.isArray(dto.palette) ? dto.palette : [],
    sample_data: dto.sample_data || null,
    sort_order: 0,
    uuid: chartUuid,
  };
}

export async function deleteBrandChart(kitUuid: string, chartUuid: string, userId: number): Promise<boolean> {
  const [kitRows] = await canvasPool.query<mysql.RowDataPacket[]>(
    'SELECT id FROM brand_kits WHERE uuid = ? AND user_id = ? LIMIT 1',
    [kitUuid, userId]
  );

  if (kitRows.length === 0) {
    throw new Error('Kit de marca no encontrado.');
  }

  const kitId = Number(kitRows[0].id);
  await canvasPool.query('DELETE FROM brand_kit_charts WHERE uuid = ? AND brand_kit_id = ?', [chartUuid, kitId]);
  return true;
}

export async function addBrandTemplate(kitUuid: string, userId: number, dto: AddBrandTemplateDto): Promise<BrandKitTemplate> {
  const [kitRows] = await canvasPool.query<mysql.RowDataPacket[]>(
    'SELECT id FROM brand_kits WHERE uuid = ? AND user_id = ? LIMIT 1',
    [kitUuid, userId]
  );

  if (kitRows.length === 0) {
    throw new Error('Kit de marca no encontrado.');
  }

  const kitId = Number(kitRows[0].id);
  const tplUuid = crypto.randomUUID();
  const name = dto.name.trim().slice(0, 150);
  const description = dto.description ? dto.description.trim() : null;

  let canvasId: number | null = null;
  let canvasType: 'board' | 'presentation' | 'doc' = dto.canvas_type || 'board';
  let canvasData = dto.canvas_data || null;
  let previewThumb = dto.preview_thumbnail || null;

  if (dto.canvas_uuid) {
    const [cRows] = await canvasPool.query<mysql.RowDataPacket[]>(
      'SELECT id, canvas_type, data, preview_thumbnail FROM canvases WHERE uuid = ? AND user_id = ? LIMIT 1',
      [dto.canvas_uuid, userId]
    );
    if (cRows.length > 0) {
      canvasId = Number(cRows[0].id);
      canvasType = cRows[0].canvas_type as 'board' | 'presentation' | 'doc';
      if (!canvasData && cRows[0].data) {
        canvasData = typeof cRows[0].data === 'string' ? JSON.parse(cRows[0].data) : cRows[0].data;
      }
      if (!previewThumb && cRows[0].preview_thumbnail) {
        previewThumb = String(cRows[0].preview_thumbnail);
      }
    }
  }

  const [insertRes] = await canvasPool.execute<mysql.ResultSetHeader>(
    'INSERT INTO brand_kit_templates (uuid, brand_kit_id, canvas_id, name, description, canvas_type, preview_thumbnail, canvas_data) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [
      tplUuid,
      kitId,
      canvasId,
      name,
      description,
      canvasType,
      previewThumb,
      canvasData ? JSON.stringify(canvasData) : null,
    ]
  );

  return {
    brand_kit_id: kitId,
    canvas_data: canvasData,
    canvas_id: canvasId,
    canvas_type: canvasType,
    created_at: new Date().toISOString(),
    description,
    id: insertRes.insertId,
    name,
    preview_thumbnail: previewThumb,
    sort_order: 0,
    uuid: tplUuid,
  };
}

export async function deleteBrandTemplate(kitUuid: string, templateUuid: string, userId: number): Promise<boolean> {
  const [kitRows] = await canvasPool.query<mysql.RowDataPacket[]>(
    'SELECT id FROM brand_kits WHERE uuid = ? AND user_id = ? LIMIT 1',
    [kitUuid, userId]
  );

  if (kitRows.length === 0) {
    throw new Error('Kit de marca no encontrado.');
  }

  const kitId = Number(kitRows[0].id);
  await canvasPool.query('DELETE FROM brand_kit_templates WHERE uuid = ? AND brand_kit_id = ?', [templateUuid, kitId]);
  return true;
}
