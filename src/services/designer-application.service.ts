import { pool } from '../config/database.config.js';
import { logger } from './logger.service.js';
import { getUserEffectivePermissions, hasPermission } from './permission.service.js';
import crypto from 'crypto';
import fs from 'fs';
import mysql from 'mysql2/promise';
import path from 'path';

export interface DesignerApplicationFile {
  file_path: string;
  mime_type: string;
  original_name: string;
  size_bytes: number;
  stored_filename: string;
  url: string;
}

export interface DesignerApplicationRecord {
  bio: string | null;
  country: string;
  created_at: string;
  files: DesignerApplicationFile[] | null;
  full_name: string;
  id: number;
  portfolio_urls: string[] | null;
  rejection_reason: string | null;
  reviewed_at: string | null;
  reviewed_by: number | null;
  specialties: string[] | null;
  status: 'pending' | 'approved' | 'rejected';
  updated_at: string;
  user_id: number;
  uuid: string;
}

function parseJsonField<T>(val: any, fallback: T): T {
  if (!val) return fallback;
  if (typeof val === 'object') return val as T;
  try {
    return JSON.parse(val) as T;
  } catch {
    return fallback;
  }
}

export async function getLatestUserApplication(userId: number): Promise<DesignerApplicationRecord | null> {
  const [rows] = await pool.query<mysql.RowDataPacket[]>(
    'SELECT * FROM designer_applications WHERE user_id = ? ORDER BY created_at DESC LIMIT 1',
    [userId]
  );

  if (rows.length === 0) return null;
  const r = rows[0];

  return {
    bio: r.bio || null,
    country: String(r.country),
    created_at: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
    files: parseJsonField<DesignerApplicationFile[] | null>(r.files, null),
    full_name: String(r.full_name),
    id: Number(r.id),
    portfolio_urls: parseJsonField<string[] | null>(r.portfolio_urls, null),
    rejection_reason: r.rejection_reason || null,
    reviewed_at: r.reviewed_at ? new Date(r.reviewed_at).toISOString() : null,
    reviewed_by: r.reviewed_by !== null ? Number(r.reviewed_by) : null,
    specialties: parseJsonField<string[] | null>(r.specialties, null),
    status: r.status as 'pending' | 'approved' | 'rejected',
    updated_at: r.updated_at ? new Date(r.updated_at).toISOString() : new Date().toISOString(),
    user_id: Number(r.user_id),
    uuid: String(r.uuid),
  };
}

export async function createDesignerApplication(
  userId: number,
  data: {
    bio?: string;
    country: string;
    full_name: string;
    portfolio_urls?: string[];
    specialties?: string[];
  },
  uploadedFiles: Express.Multer.File[] = []
): Promise<DesignerApplicationRecord> {
  const userPermissions = await getUserEffectivePermissions(userId);
  if (hasPermission(userPermissions, 'designer:dashboard') || hasPermission(userPermissions, 'templates:publish')) {
    throw new Error('USER_ALREADY_DESIGNER');
  }

  const existingPending = await getLatestUserApplication(userId);
  if (existingPending && existingPending.status === 'pending') {
    throw new Error('APPLICATION_ALREADY_PENDING');
  }

  const appUuid = crypto.randomUUID();
  const baseUploadsDir = path.resolve(process.cwd(), 'public', 'uploads', 'designer-applications', appUuid);
  await fs.promises.mkdir(baseUploadsDir, { recursive: true });

  const savedFiles: DesignerApplicationFile[] = [];

  for (const file of uploadedFiles) {
    const rawName = path.basename(file.originalname).replace(/[^a-zA-Z0-9._-]/g, '_');
    const safeName = `${Date.now()}_${crypto.randomBytes(4).toString('hex')}_${rawName}`;
    const destination = path.join(baseUploadsDir, safeName);

    await fs.promises.writeFile(destination, file.buffer);

    savedFiles.push({
      file_path: destination,
      mime_type: file.mimetype,
      original_name: file.originalname,
      size_bytes: file.size,
      stored_filename: safeName,
      url: `/uploads/designer-applications/${appUuid}/${safeName}`,
    });
  }

  const cleanPortfolio = (data.portfolio_urls || [])
    .map((u) => String(u).trim())
    .filter((u) => u.length > 0);

  const cleanSpecialties = (data.specialties || [])
    .map((s) => String(s).trim())
    .filter((s) => s.length > 0);

  await pool.query(
    `INSERT INTO designer_applications 
      (uuid, user_id, full_name, country, specialties, bio, portfolio_urls, files, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
    [
      appUuid,
      userId,
      data.full_name.trim(),
      data.country.trim(),
      cleanSpecialties.length > 0 ? JSON.stringify(cleanSpecialties) : null,
      data.bio ? data.bio.trim() : null,
      cleanPortfolio.length > 0 ? JSON.stringify(cleanPortfolio) : null,
      savedFiles.length > 0 ? JSON.stringify(savedFiles) : null,
    ]
  );

  logger.app.info('Solicitud de diseñador registrada exitosamente', {
    appUuid,
    filesCount: savedFiles.length,
    userId,
  });

  const latest = await getLatestUserApplication(userId);
  if (!latest) {
    throw new Error('APPLICATION_CREATION_FAILED');
  }

  return latest;
}
