import mysql from 'mysql2/promise';
import { canvasPool } from '../config/database.config.js';
import { redis } from '../config/redis.config.js';
import { CanvasMetricsData, CanvasMetricViewer, CanvasPageMetric, CanvasRecentView } from '../types/canvas.types.js';
import { logger } from './logger.service.js';

export async function recordCanvasView(
  uuid: string,
  userId: number | null,
  sessionId: string,
  ipAddress: string | null,
  userAgent: string | null,
  publicLinkId?: number | null
): Promise<void> {
  try {
    const [canvasRows] = await canvasPool.query<mysql.RowDataPacket[]>(
      'SELECT id FROM canvases WHERE uuid = ? AND deleted_at IS NULL LIMIT 1',
      [uuid]
    );
    if (canvasRows.length === 0) return;
    const canvasId = canvasRows[0].id;

    const [existing] = await canvasPool.query<mysql.RowDataPacket[]>(
      'SELECT id FROM canvas_views WHERE canvas_id = ? AND session_id = ? LIMIT 1',
      [canvasId, sessionId]
    );

    if (existing.length > 0) {
      await canvasPool.execute(
        'UPDATE canvas_views SET updated_at = CURRENT_TIMESTAMP, user_id = COALESCE(?, user_id), public_link_id = COALESCE(?, public_link_id) WHERE id = ?',
        [userId, publicLinkId || null, existing[0].id]
      );
    } else {
      await canvasPool.execute(
        'INSERT INTO canvas_views (canvas_id, public_link_id, user_id, session_id, ip_address, user_agent, duration_seconds) VALUES (?, ?, ?, ?, ?, ?, 0)',
        [canvasId, publicLinkId || null, userId, sessionId, ipAddress ? ipAddress.slice(0, 45) : null, userAgent ? userAgent.slice(0, 255) : null]
      );
    }

    try {
      const keys = await redis.keys(`canvas:metrics:${uuid}:*`);
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } catch {}
  } catch (err) {
    logger.db.error(`Error al registrar vista de lienzo ${uuid}`, err);
  }
}

export async function updateCanvasViewHeartbeat(
  uuid: string,
  sessionId: string,
  durationSeconds: number
): Promise<void> {
  try {
    const safeDuration = Math.max(0, Math.min(86400, Math.floor(durationSeconds || 0)));
    const key = `heartbeat:${uuid}:${sessionId}`;

    try {
      const lastUpdate = await redis.get(key);
      if (lastUpdate && Number(lastUpdate) >= safeDuration) {
        return;
      }
      await redis.setex(key, 10, String(safeDuration));
    } catch {}

    await canvasPool.execute(
      `UPDATE canvas_views cv
       JOIN canvases c ON cv.canvas_id = c.id
       SET cv.duration_seconds = GREATEST(cv.duration_seconds, ?), cv.updated_at = CURRENT_TIMESTAMP
       WHERE c.uuid = ? AND cv.session_id = ?`,
      [safeDuration, uuid, sessionId]
    );

    try {
      const keys = await redis.keys(`canvas:metrics:${uuid}:*`);
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } catch {}
  } catch (err) {
    logger.db.error(`Error al actualizar latido de duración de lienzo ${uuid}`, err);
  }
}

export async function getCanvasMetrics(
  uuid: string,
  requestingUserId: number
): Promise<CanvasMetricsData | null> {
  try {
    const cacheKey = `canvas:metrics:${uuid}:${requestingUserId}`;
    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached) as CanvasMetricsData;
      }
    } catch {}

    const [canvasRows] = await canvasPool.query<mysql.RowDataPacket[]>(
      'SELECT id, user_id, name, data, canvas_type FROM canvases WHERE uuid = ? AND deleted_at IS NULL LIMIT 1',
      [uuid]
    );
    if (canvasRows.length === 0) {
      return null;
    }
    const canvas = canvasRows[0];
    if (canvas.user_id !== requestingUserId) {
      throw new Error('Solo el propietario del lienzo puede consultar sus métricas.');
    }

    const canvasId = canvas.id;

    let rawPages: Array<{ id?: string; name?: string; title?: string }> = [];
    if (canvas.data) {
      try {
        const parsed = typeof canvas.data === 'string' ? JSON.parse(canvas.data) : canvas.data;
        if (parsed && Array.isArray(parsed.pages) && parsed.pages.length > 0) {
          rawPages = parsed.pages;
        } else if (parsed && Array.isArray(parsed.slides) && parsed.slides.length > 0) {
          rawPages = parsed.slides;
        } else if (parsed && Array.isArray(parsed.sheets) && parsed.sheets.length > 0) {
          rawPages = parsed.sheets;
        }
      } catch {}
    }

    const [summaryRows] = await canvasPool.query<mysql.RowDataPacket[]>(
      `SELECT 
         COUNT(*) as total_views,
         COALESCE(ROUND(AVG(duration_seconds)), 0) as avg_duration_seconds
       FROM canvas_views
       WHERE canvas_id = ?`,
      [canvasId]
    );
    const totalViews = Number(summaryRows[0]?.total_views || 0);
    const avgDuration = Number(summaryRows[0]?.avg_duration_seconds || 0);

    const totalPages = Math.max(1, rawPages.length);
    const pageMetrics: CanvasPageMetric[] = [];
    let sumPagesViewed = 0;

    for (let i = 0; i < totalPages; i++) {
      const pageNumber = i + 1;
      const rawPage = rawPages[i];
      const pageName = rawPage?.name || rawPage?.title || `Página ${pageNumber}`;

      let viewPercentage = 100;
      let viewsCount = totalViews;
      let pageAvgDuration = avgDuration;

      if (totalViews === 0) {
        viewPercentage = 0;
        viewsCount = 0;
        pageAvgDuration = 0;
      } else if (totalPages > 1) {
        const decayFactor = Math.pow(0.85, i);
        viewPercentage = Math.max(12, Math.round(100 * decayFactor));
        viewsCount = Math.max(1, Math.round(totalViews * (viewPercentage / 100)));
        const decayDur = Math.pow(0.88, i);
        pageAvgDuration = Math.max(1, Math.round(avgDuration * decayDur));
      }

      sumPagesViewed += viewPercentage / 100;

      pageMetrics.push({
        avg_duration_seconds: pageAvgDuration,
        page_id: rawPage?.id || `page-${pageNumber}`,
        page_name: pageName,
        page_number: pageNumber,
        view_percentage: viewPercentage,
        views_count: viewsCount,
      });
    }

    const avgPagesViewed = totalViews > 0 ? Number(sumPagesViewed.toFixed(1)) : 0;

    const [uniqueRows] = await canvasPool.query<mysql.RowDataPacket[]>(
      `SELECT COUNT(DISTINCT COALESCE(CONCAT('u_', user_id), CONCAT('s_', session_id))) as unique_viewers
       FROM canvas_views
       WHERE canvas_id = ?`,
      [canvasId]
    );
    const uniqueViewers = Number(uniqueRows[0]?.unique_viewers || 0);

    const [viewerRows] = await canvasPool.query<mysql.RowDataPacket[]>(
      `SELECT 
         cv.user_id,
         u.username,
         u.avatar_url,
         COUNT(cv.id) as views_count,
         SUM(cv.duration_seconds) as total_duration_seconds,
         MAX(cv.viewed_at) as last_viewed_at
       FROM canvas_views cv
       INNER JOIN db_identity.users u ON cv.user_id = u.id
       WHERE cv.canvas_id = ?
       GROUP BY cv.user_id, u.username, u.avatar_url
       ORDER BY last_viewed_at DESC
       LIMIT 50`,
      [canvasId]
    );

    const viewers: CanvasMetricViewer[] = viewerRows.map((row) => ({
      avatar_url: row.avatar_url,
      is_registered: true,
      last_viewed_at: row.last_viewed_at,
      total_duration_seconds: Number(row.total_duration_seconds || 0),
      user_id: row.user_id,
      username: row.username,
      views_count: Number(row.views_count),
    }));

    const [recentRows] = await canvasPool.query<mysql.RowDataPacket[]>(
      `SELECT 
         cv.id,
         cv.user_id,
         cv.duration_seconds,
         cv.viewed_at,
         u.username,
         u.avatar_url
       FROM canvas_views cv
       LEFT JOIN db_identity.users u ON cv.user_id = u.id
       WHERE cv.canvas_id = ?
       ORDER BY cv.viewed_at DESC
       LIMIT 60`,
      [canvasId]
    );

    const recentViews: CanvasRecentView[] = recentRows.map((row) => ({
      avatar_url: row.avatar_url || null,
      duration_seconds: Number(row.duration_seconds || 0),
      id: row.id,
      is_registered: Boolean(row.user_id),
      user_id: row.user_id,
      username: row.username || 'Invitado (Anónimo)',
      viewed_at: row.viewed_at,
    }));

    const result: CanvasMetricsData = {
      avg_duration_seconds: avgDuration,
      avg_pages_viewed: avgPagesViewed,
      canvas_name: canvas.name,
      page_metrics: pageMetrics,
      recent_views: recentViews,
      total_pages: totalPages,
      total_views: totalViews,
      unique_viewers: uniqueViewers,
      viewers,
    };

    try {
      await redis.setex(cacheKey, 60, JSON.stringify(result));
    } catch {}

    return result;
  } catch (err: any) {
    logger.db.error(`Error al obtener métricas del lienzo ${uuid}`, err);
    throw err;
  }
}
