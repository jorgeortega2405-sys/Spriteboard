import { pool } from '../config/database.config.js';
import { AdminDesignerApplicationFile, AdminDesignerApplicationItem, DesignerApplicationMetricsData } from '../types/designer.types.js';
import { logger } from './logger.service.js';
import { assignUserRole } from './role.service.js';
import mysql from 'mysql2/promise';

function parseJsonField<T>(val: any, fallback: T): T {
  if (!val) return fallback;
  if (typeof val === 'object') return val as T;
  try {
    return JSON.parse(val) as T;
  } catch {
    return fallback;
  }
}

export async function getDesignerApplicationMetrics(): Promise<DesignerApplicationMetricsData> {
  const [rows] = await pool.query<mysql.RowDataPacket[]>(`
    SELECT
      COUNT(*) as totalCount,
      SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pendingCount,
      SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approvedCount,
      SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejectedCount
    FROM designer_applications
  `);

  const r = rows[0] || {};
  return {
    approvedCount: Number(r.approvedCount || 0),
    pendingCount: Number(r.pendingCount || 0),
    rejectedCount: Number(r.rejectedCount || 0),
    totalCount: Number(r.totalCount || 0),
  };
}

export async function listDesignerApplications(options: {
  limit?: number;
  page?: number;
  search?: string;
  status?: string;
}): Promise<{ applications: AdminDesignerApplicationItem[]; total: number }> {
  const { limit = 15, page = 1, search, status } = options;
  const conditions: string[] = [];
  const params: any[] = [];

  if (status && status !== 'all') {
    conditions.push('da.status = ?');
    params.push(status);
  }

  if (search && search.trim()) {
    conditions.push('(da.full_name LIKE ? OR da.country LIKE ? OR u.username LIKE ? OR u.email LIKE ?)');
    const q = `%${search.trim()}%`;
    params.push(q, q, q, q);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const [countRows] = await pool.query<mysql.RowDataPacket[]>(
    `SELECT COUNT(*) as total 
     FROM designer_applications da 
     INNER JOIN users u ON da.user_id = u.id 
     ${whereClause}`,
    params
  );
  const total = Number(countRows[0]?.total || 0);

  const offset = Math.max(0, (page - 1) * limit);
  const [rows] = await pool.query<mysql.RowDataPacket[]>(
    `SELECT 
      da.id, da.uuid, da.user_id, da.full_name, da.country, da.specialties, da.bio, 
      da.portfolio_urls, da.files, da.status, da.rejection_reason, da.reviewed_by, 
      da.reviewed_at, da.created_at, da.updated_at,
      u.username AS applicant_username,
      u.email AS applicant_email,
      u.avatar_url AS applicant_avatar_url,
      rev.username AS reviewer_username
     FROM designer_applications da
     INNER JOIN users u ON da.user_id = u.id
     LEFT JOIN users rev ON da.reviewed_by = rev.id
     ${whereClause}
     ORDER BY CASE WHEN da.status = 'pending' THEN 0 ELSE 1 END, da.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, Number(limit), Number(offset)]
  );

  const applications: AdminDesignerApplicationItem[] = rows.map((r) => ({
    applicant_avatar_url: r.applicant_avatar_url || null,
    applicant_email: r.applicant_email || null,
    applicant_username: r.applicant_username || 'Usuario',
    bio: r.bio || null,
    country: String(r.country),
    created_at: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
    files: parseJsonField<AdminDesignerApplicationFile[] | null>(r.files, null),
    full_name: String(r.full_name),
    id: Number(r.id),
    portfolio_urls: parseJsonField<string[] | null>(r.portfolio_urls, null),
    rejection_reason: r.rejection_reason || null,
    reviewed_at: r.reviewed_at ? new Date(r.reviewed_at).toISOString() : null,
    reviewed_by: r.reviewed_by !== null ? Number(r.reviewed_by) : null,
    reviewer_username: r.reviewer_username || null,
    specialties: parseJsonField<string[] | null>(r.specialties, null),
    status: r.status,
    updated_at: r.updated_at ? new Date(r.updated_at).toISOString() : new Date().toISOString(),
    user_id: Number(r.user_id),
    uuid: String(r.uuid),
  }));

  return { applications, total };
}

export async function getDesignerApplicationDetails(id: string | number): Promise<AdminDesignerApplicationItem> {
  const [rows] = await pool.query<mysql.RowDataPacket[]>(
    `SELECT 
      da.id, da.uuid, da.user_id, da.full_name, da.country, da.specialties, da.bio, 
      da.portfolio_urls, da.files, da.status, da.rejection_reason, da.reviewed_by, 
      da.reviewed_at, da.created_at, da.updated_at,
      u.username AS applicant_username,
      u.email AS applicant_email,
      u.avatar_url AS applicant_avatar_url,
      rev.username AS reviewer_username
     FROM designer_applications da
     INNER JOIN users u ON da.user_id = u.id
     LEFT JOIN users rev ON da.reviewed_by = rev.id
     WHERE da.id = ? OR da.uuid = ?
     LIMIT 1`,
    [id, id]
  );

  if (rows.length === 0) {
    throw new Error('Application not found');
  }

  const r = rows[0];
  return {
    applicant_avatar_url: r.applicant_avatar_url || null,
    applicant_email: r.applicant_email || null,
    applicant_username: r.applicant_username || 'Usuario',
    bio: r.bio || null,
    country: String(r.country),
    created_at: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
    files: parseJsonField<AdminDesignerApplicationFile[] | null>(r.files, null),
    full_name: String(r.full_name),
    id: Number(r.id),
    portfolio_urls: parseJsonField<string[] | null>(r.portfolio_urls, null),
    rejection_reason: r.rejection_reason || null,
    reviewed_at: r.reviewed_at ? new Date(r.reviewed_at).toISOString() : null,
    reviewed_by: r.reviewed_by !== null ? Number(r.reviewed_by) : null,
    reviewer_username: r.reviewer_username || null,
    specialties: parseJsonField<string[] | null>(r.specialties, null),
    status: r.status,
    updated_at: r.updated_at ? new Date(r.updated_at).toISOString() : new Date().toISOString(),
    user_id: Number(r.user_id),
    uuid: String(r.uuid),
  };
}

export async function approveDesignerApplication(id: string | number, adminId: number): Promise<boolean> {
  const application = await getDesignerApplicationDetails(id);

  await pool.query(
    `UPDATE designer_applications 
     SET status = 'approved', rejection_reason = NULL, reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP 
     WHERE id = ? OR uuid = ?`,
    [adminId, id, id]
  );

  await assignUserRole(application.user_id, 'DESIGNER', adminId);

  logger.app.info('Solicitud de diseñador aprobada y rol otorgado desde Admin', {
    adminId,
    applicationId: id,
    targetUserId: application.user_id,
  });

  return true;
}

export async function rejectDesignerApplication(
  id: string | number,
  reason: string | null,
  adminId: number
): Promise<boolean> {
  const application = await getDesignerApplicationDetails(id);
  const finalReason = reason && reason.trim() ? reason.trim() : 'No cumple con las pautas de admisión para diseñadores.';

  await pool.query(
    `UPDATE designer_applications 
     SET status = 'rejected', rejection_reason = ?, reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP 
     WHERE id = ? OR uuid = ?`,
    [finalReason, adminId, id, id]
  );

  logger.app.info('Solicitud de diseñador rechazada desde Admin', {
    adminId,
    applicationId: id,
    reason: finalReason,
    targetUserId: application.user_id,
  });

  return true;
}
