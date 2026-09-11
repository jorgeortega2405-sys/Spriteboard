import { canvasPool, pool } from '../config/database.config.js';
import { logger } from './logger.service.js';
import fs from 'fs';
import mysql from 'mysql2/promise';
import path from 'path';

export interface StorageBreakdownItem {
  bytes: number;
  formatted: string;
  count?: number;
}

export interface UserStorageUsage {
  tier: string;
  tierName: string;
  usedBytes: number;
  limitBytes: number;
  usedFormatted: string;
  limitFormatted: string;
  remainingBytes: number;
  remainingFormatted: string;
  percentage: number;
  isNearLimit: boolean;
  isOverLimit: boolean;
  breakdown: {
    canvases: StorageBreakdownItem;
    snapshots: StorageBreakdownItem;
    trash: StorageBreakdownItem;
    uploads: StorageBreakdownItem;
  };
}

export const TIER_STORAGE_LIMITS: Record<string, number> = {
  free: 1024 * 1024 * 1024,
  pro: 10 * 1024 * 1024 * 1024,
  business: 1024 * 1024 * 1024 * 1024,
  negocios: 1024 * 1024 * 1024 * 1024,
};

const TIER_DISPLAY_NAMES: Record<string, string> = {
  free: 'Spriteboard Gratis',
  pro: 'Spriteboard Pro',
  business: 'Spriteboard Negocios',
  negocios: 'Spriteboard Negocios',
};

export function formatStorageBytes(bytes: number): string {
  if (bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  if (i === 0) return `${bytes} B`;
  const rawValue = bytes / Math.pow(1024, i);
  const formatted = rawValue % 1 === 0 ? rawValue.toString() : rawValue.toFixed(rawValue >= 100 || i >= 4 ? 1 : 2);
  return `${formatted} ${units[i]}`;
}

export async function getUserStorageUsage(userId: number): Promise<UserStorageUsage> {
  const [userRows] = await pool.query<mysql.RowDataPacket[]>(
    'SELECT subscription_tier, avatar_url FROM users WHERE id = ? LIMIT 1',
    [userId]
  );

  const rawTier = (userRows[0]?.subscription_tier || 'free').toLowerCase();
  const normalizedTier = rawTier === 'negocios' ? 'business' : rawTier;
  const tierName = TIER_DISPLAY_NAMES[normalizedTier] || 'Spriteboard Gratis';
  const limitBytes = TIER_STORAGE_LIMITS[normalizedTier] || TIER_STORAGE_LIMITS.free;

  const [activeCanvasRows] = await canvasPool.query<mysql.RowDataPacket[]>(
    'SELECT COALESCE(SUM(compressed_bytes), 0) AS total_bytes, COUNT(id) AS total_count FROM canvases WHERE user_id = ? AND deleted_at IS NULL',
    [userId]
  );
  const canvasesBytes = Number(activeCanvasRows[0]?.total_bytes || 0);
  const canvasesCount = Number(activeCanvasRows[0]?.total_count || 0);

  const [snapshotRows] = await canvasPool.query<mysql.RowDataPacket[]>(
    `SELECT COALESCE(SUM(s.compressed_bytes), 0) AS total_bytes, COUNT(s.id) AS total_count
     FROM db_canvas.canvas_snapshots s
     INNER JOIN db_canvas.canvases c ON c.id = s.canvas_id
     WHERE c.user_id = ?`,
    [userId]
  );
  const snapshotsBytes = Number(snapshotRows[0]?.total_bytes || 0);
  const snapshotsCount = Number(snapshotRows[0]?.total_count || 0);

  const [trashRows] = await canvasPool.query<mysql.RowDataPacket[]>(
    'SELECT COALESCE(SUM(compressed_bytes), 0) AS total_bytes, COUNT(id) AS total_count FROM canvases WHERE user_id = ? AND deleted_at IS NOT NULL',
    [userId]
  );
  const trashBytes = Number(trashRows[0]?.total_bytes || 0);
  const trashCount = Number(trashRows[0]?.total_count || 0);

  let uploadsBytes = 0;
  let uploadsCount = 0;
  const avatarUrl = userRows[0]?.avatar_url;
  if (avatarUrl && typeof avatarUrl === 'string' && avatarUrl.startsWith('/uploads/avatars/')) {
    const avatarFilename = path.basename(avatarUrl);
    const avatarPath = path.join(process.cwd(), 'public', 'uploads', 'avatars', avatarFilename);
    try {
      const stat = await fs.promises.stat(avatarPath);
      uploadsBytes = stat.size;
      uploadsCount = 1;
    } catch {}
  }

  const usedBytes = canvasesBytes + snapshotsBytes + trashBytes + uploadsBytes;
  const rawPercentage = limitBytes > 0 ? (usedBytes / limitBytes) * 100 : 0;
  const percentage = Math.min(100, Math.round(rawPercentage * 100) / 100);
  const remainingBytes = Math.max(0, limitBytes - usedBytes);

  return {
    tier: normalizedTier,
    tierName,
    usedBytes,
    limitBytes,
    usedFormatted: formatStorageBytes(usedBytes),
    limitFormatted: formatStorageBytes(limitBytes),
    remainingBytes,
    remainingFormatted: formatStorageBytes(remainingBytes),
    percentage,
    isNearLimit: percentage >= 80,
    isOverLimit: usedBytes >= limitBytes,
    breakdown: {
      canvases: {
        bytes: canvasesBytes,
        formatted: formatStorageBytes(canvasesBytes),
        count: canvasesCount,
      },
      snapshots: {
        bytes: snapshotsBytes,
        formatted: formatStorageBytes(snapshotsBytes),
        count: snapshotsCount,
      },
      trash: {
        bytes: trashBytes,
        formatted: formatStorageBytes(trashBytes),
        count: trashCount,
      },
      uploads: {
        bytes: uploadsBytes,
        formatted: formatStorageBytes(uploadsBytes),
        count: uploadsCount,
      },
    },
  };
}

export async function checkUserStorageQuota(
  userId: number,
  incomingBytes = 0
): Promise<{
  allowed: boolean;
  usedBytes: number;
  limitBytes: number;
  remainingBytes: number;
  limitFormatted: string;
}> {
  try {
    const usage = await getUserStorageUsage(userId);
    const allowed = usage.usedBytes + incomingBytes <= usage.limitBytes;
    return {
      allowed,
      usedBytes: usage.usedBytes,
      limitBytes: usage.limitBytes,
      remainingBytes: usage.remainingBytes,
      limitFormatted: usage.limitFormatted,
    };
  } catch (err) {
    logger.db.error(`Error al verificar cuota de almacenamiento para el usuario ${userId}`, err);
    return {
      allowed: true,
      usedBytes: 0,
      limitBytes: TIER_STORAGE_LIMITS.free,
      remainingBytes: TIER_STORAGE_LIMITS.free,
      limitFormatted: '1 GB',
    };
  }
}
