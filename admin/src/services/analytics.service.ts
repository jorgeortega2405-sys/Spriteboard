import { pool } from '../config/database.config.js';
import { logger } from './logger.service.js';
import type { RowDataPacket } from 'mysql2';

export interface AnalyticsOverview {
  activeCanvases30d: number;
  canvasCommentsTotal: number;
  canvasesTotal: number;
  compressedStorageBytes: number;
  dau: number;
  foldersTotal: number;
  mau: number;
  rawStorageBytes: number;
  usersTotal: number;
  wau: number;
}

export interface AnalyticsTrendPoint {
  canvases: number;
  date: string;
  label: string;
  storageMb: number;
  users: number;
}

export async function getAnalyticsOverview(): Promise<AnalyticsOverview> {
  try {
    const [userRows] = await pool.query<RowDataPacket[]>(`
      SELECT
        COUNT(*) AS usersTotal,
        COUNT(CASE WHEN COALESCE(last_login_at, created_at) >= DATE_SUB(NOW(), INTERVAL 1 DAY) THEN 1 END) AS dau,
        COUNT(CASE WHEN COALESCE(last_login_at, created_at) >= DATE_SUB(NOW(), INTERVAL 7 DAY) THEN 1 END) AS wau,
        COUNT(CASE WHEN COALESCE(last_login_at, created_at) >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 END) AS mau
      FROM users
    `);

    const [canvasRows] = await pool.query<RowDataPacket[]>(`
      SELECT
        COUNT(*) AS canvasesTotal,
        COUNT(CASE WHEN updated_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 END) AS activeCanvases30d,
        COALESCE(SUM(size_bytes), 0) AS rawStorageBytes,
        COALESCE(SUM(compressed_bytes), 0) AS compressedStorageBytes
      FROM db_canvas.canvases
      WHERE deleted_at IS NULL
    `);

    const [commentRows] = await pool.query<RowDataPacket[]>(`
      SELECT
        (SELECT COUNT(*) FROM db_canvas.canvas_comments) AS canvasCommentsTotal,
        (SELECT COUNT(*) FROM db_canvas.folders WHERE deleted_at IS NULL) AS foldersTotal
    `);

    const u = userRows[0] || {};
    const c = canvasRows[0] || {};
    const cm = commentRows[0] || {};

    return {
      activeCanvases30d: Number(c.activeCanvases30d || 0),
      canvasCommentsTotal: Number(cm.canvasCommentsTotal || 0),
      canvasesTotal: Number(c.canvasesTotal || 0),
      compressedStorageBytes: Number(c.compressedStorageBytes || 0),
      dau: Math.max(1, Number(u.dau || 0)),
      foldersTotal: Number(cm.foldersTotal || 0),
      mau: Math.max(1, Number(u.mau || 0)),
      rawStorageBytes: Number(c.rawStorageBytes || 0),
      usersTotal: Number(u.usersTotal || 0),
      wau: Math.max(1, Number(u.wau || 0)),
    };
  } catch (error) {
    logger.db.error('Error al obtener métricas analíticas de la plataforma', error);
    throw error;
  }
}

export async function getAnalyticsTrends(range = '30d'): Promise<AnalyticsTrendPoint[]> {
  try {
    let days = 30;
    if (range === '7d') days = 7;
    else if (range === '90d') days = 90;
    else if (range === '1y') days = 365;

    const [userRows] = await pool.query<RowDataPacket[]>(`
      SELECT DATE_FORMAT(created_at, '%Y-%m-%d') AS date, COUNT(*) AS count
      FROM users
      WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
      GROUP BY DATE_FORMAT(created_at, '%Y-%m-%d')
    `, [days]);

    const [canvasRows] = await pool.query<RowDataPacket[]>(`
      SELECT 
        DATE_FORMAT(created_at, '%Y-%m-%d') AS date, 
        COUNT(*) AS count,
        COALESCE(SUM(compressed_bytes), 0) AS bytes
      FROM db_canvas.canvases
      WHERE deleted_at IS NULL AND created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
      GROUP BY DATE_FORMAT(created_at, '%Y-%m-%d')
    `, [days]);

    const userMap = new Map<string, number>();
    userRows.forEach((r) => userMap.set(String(r.date), Number(r.count || 0)));

    const canvasMap = new Map<string, { bytes: number; count: number }>();
    canvasRows.forEach((r) => canvasMap.set(String(r.date), {
      bytes: Number(r.bytes || 0),
      count: Number(r.count || 0),
    }));

    const result: AnalyticsTrendPoint[] = [];
    const now = new Date();

    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;

      const cData = canvasMap.get(dateStr) || { bytes: 0, count: 0 };
      const storageMb = Number((cData.bytes / (1024 * 1024)).toFixed(2));

      result.push({
        canvases: cData.count,
        date: dateStr,
        label: `${day}/${month}`,
        storageMb,
        users: userMap.get(dateStr) || 0,
      });
    }

    return result;
  } catch (error) {
    logger.db.error('Error al calcular tendencias analíticas', { error, range });
    throw error;
  }
}
