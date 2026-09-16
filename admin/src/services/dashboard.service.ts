import { pool } from '../config/database.config.js';
import { logger } from './logger.service.js';
import { DashboardStatsResponse, DashboardSummary, DashboardTierDistribution, DashboardTimeSeriesPoint, DashboardTicketsByStatus } from '../types/dashboard.types.js';
import { RowDataPacket } from 'mysql2';

function formatDayLabel(dateStr: string): string {
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  const monthIndex = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  const monthName = monthNames[monthIndex] || parts[1];
  return `${day} ${monthName}`;
}

export async function getDashboardStats(): Promise<DashboardStatsResponse> {
  try {
    const [summaryRows] = await pool.query<RowDataPacket[]>(`
      SELECT
        (SELECT COUNT(*) FROM users WHERE DATE(created_at) = CURDATE()) AS accountsToday,
        (SELECT COUNT(*) FROM users WHERE DATE(created_at) = SUBDATE(CURDATE(), 1)) AS accountsYesterday,
        (SELECT COUNT(*) FROM users) AS accountsTotal,
        (SELECT COUNT(*) FROM db_canvas.canvases WHERE deleted_at IS NULL AND DATE(created_at) = CURDATE()) AS canvasesToday,
        (SELECT COUNT(*) FROM db_canvas.canvases WHERE deleted_at IS NULL AND DATE(created_at) = SUBDATE(CURDATE(), 1)) AS canvasesYesterday,
        (SELECT COUNT(*) FROM db_canvas.canvases WHERE deleted_at IS NULL) AS canvasesTotal,
        (SELECT COUNT(*) FROM support_tickets WHERE status IN ('queued', 'in_progress', 'escalated')) AS ticketsActive,
        (SELECT COUNT(*) FROM support_tickets WHERE status IN ('resolved', 'closed')) AS ticketsResolved,
        (SELECT COUNT(*) FROM support_tickets) AS ticketsTotal,
        (SELECT COUNT(*) FROM users WHERE subscription_tier IN ('pro', 'business')) AS activeSubscribers,
        (SELECT COUNT(*) FROM users WHERE subscription_tier != 'free') AS totalSubscribers
    `);

    const s = summaryRows[0] || {};
    const summary: DashboardSummary = {
      accountsToday: Number(s.accountsToday || 0),
      accountsTotal: Number(s.accountsTotal || 0),
      accountsYesterday: Number(s.accountsYesterday || 0),
      activeSubscribers: Number(s.activeSubscribers || 0),
      canvasesToday: Number(s.canvasesToday || 0),
      canvasesTotal: Number(s.canvasesTotal || 0),
      canvasesYesterday: Number(s.canvasesYesterday || 0),
      ticketsActive: Number(s.ticketsActive || 0),
      ticketsResolved: Number(s.ticketsResolved || 0),
      ticketsTotal: Number(s.ticketsTotal || 0),
      totalSubscribers: Number(s.totalSubscribers || 0),
    };

    const [userTrendRows] = await pool.query<RowDataPacket[]>(`
      SELECT DATE_FORMAT(created_at, '%Y-%m-%d') AS date, COUNT(*) AS count
      FROM users
      WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 13 DAY)
      GROUP BY DATE_FORMAT(created_at, '%Y-%m-%d')
    `);

    const [canvasTrendRows] = await pool.query<RowDataPacket[]>(`
      SELECT DATE_FORMAT(created_at, '%Y-%m-%d') AS date, COUNT(*) AS count
      FROM db_canvas.canvases
      WHERE deleted_at IS NULL AND created_at >= DATE_SUB(CURDATE(), INTERVAL 13 DAY)
      GROUP BY DATE_FORMAT(created_at, '%Y-%m-%d')
    `);

    const userMap = new Map<string, number>();
    userTrendRows.forEach((r) => {
      userMap.set(String(r.date), Number(r.count || 0));
    });

    const canvasMap = new Map<string, number>();
    canvasTrendRows.forEach((r) => {
      canvasMap.set(String(r.date), Number(r.count || 0));
    });

    const trends: DashboardTimeSeriesPoint[] = [];
    const now = new Date();
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;
      trends.push({
        accounts: userMap.get(dateStr) || 0,
        canvases: canvasMap.get(dateStr) || 0,
        date: dateStr,
        label: formatDayLabel(dateStr),
      });
    }

    const [tierRows] = await pool.query<RowDataPacket[]>(`
      SELECT LOWER(subscription_tier) AS tier, COUNT(*) AS count
      FROM users
      GROUP BY LOWER(subscription_tier)
    `);

    const tiers: DashboardTierDistribution = {
      business: 0,
      free: 0,
      pro: 0,
    };

    tierRows.forEach((r) => {
      const tierKey = String(r.tier || '').toLowerCase();
      const count = Number(r.count || 0);
      if (tierKey === 'pro') tiers.pro = count;
      else if (tierKey === 'business') tiers.business = count;
      else tiers.free += count;
    });

    const [ticketRows] = await pool.query<RowDataPacket[]>(`
      SELECT LOWER(status) AS status, COUNT(*) AS count
      FROM support_tickets
      GROUP BY LOWER(status)
    `);

    const tickets: DashboardTicketsByStatus = {
      closed: 0,
      escalated: 0,
      in_progress: 0,
      queued: 0,
      resolved: 0,
    };

    ticketRows.forEach((r) => {
      const st = String(r.status || '').toLowerCase();
      const count = Number(r.count || 0);
      if (st === 'queued') tickets.queued = count;
      else if (st === 'in_progress') tickets.in_progress = count;
      else if (st === 'escalated') tickets.escalated = count;
      else if (st === 'resolved') tickets.resolved = count;
      else if (st === 'closed') tickets.closed = count;
    });

    return { summary, tiers, tickets, trends };
  } catch (error) {
    logger.db.error('Error al calcular estadísticas del dashboard', error);
    throw error;
  }
}
