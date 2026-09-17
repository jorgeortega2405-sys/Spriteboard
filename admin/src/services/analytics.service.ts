import { pool } from '../config/database.config.js';
import { logger } from './logger.service.js';
import type { RowDataPacket } from 'mysql2';

export interface AnalyticsOverview {
  activeCanvases30d: number;
  aiFeedbackDislikes: number;
  aiFeedbackLikes: number;
  aiFeedbackTotal: number;
  aiSatisfactionPercent: number;
  arrEstimated: number;
  avgCanvasSizeBytes: number;
  avgDurationSeconds: number;
  avgOrderValue: number;
  canvasCommentsTotal: number;
  canvasViewsTotal: number;
  canvasesTotal: number;
  classroomsTotal: number;
  compressedStorageBytes: number;
  compressionSavingsPercent: number;
  conversionRatePercent: number;
  dau: number;
  foldersTotal: number;
  googleAuthPercent: number;
  mau: number;
  mrrEstimated: number;
  newUsers30d: number;
  privateCanvasesTotal: number;
  publicCanvasesTotal: number;
  purchasesCount: number;
  rawStorageBytes: number;
  schoolsTotal: number;
  snapshotsTotal: number;
  stickinessRatio: number;
  teamMembersTotal: number;
  teamsTotal: number;
  tierDistribution: { business: number; free: number; pro: number };
  totalRevenue: number;
  twoFactorAdoptionPercent: number;
  usersTotal: number;
  wau: number;
}

export interface AnalyticsTrendPoint {
  canvases: number;
  date: string;
  label: string;
  rawStorageMb: number;
  revenue: number;
  storageMb: number;
  users: number;
  views: number;
}

export interface AnalyticsBreakdownData {
  activityByDay: { count: number; day: string }[];
  activityByHour: { count: number; hour: number }[];
  authDistribution: { googleAuth: number; passwordOnly: number; twoFactorEnabled: number };
  formats: { count: number; label: string }[];
  geoDistribution: { code: string; count: number; country: string }[];
  preferences: { languages: { count: number; label: string }[]; themes: { count: number; label: string }[] };
  resolutions: { count: number; label: string }[];
  tiers: { business: number; free: number; pro: number };
}

export interface AnalyticsFinancialsAndTeamsData {
  aiHealth: {
    dislikes: number;
    likes: number;
    satisfactionPercent: number;
    total: number;
  };
  purchasesByPlan: { count: number; planId: string; revenue: number }[];
  recentPurchases: {
    amount: number;
    billingPeriod: string;
    createdAt: string;
    currency: string;
    id: number;
    planId: string;
    status: string;
    userEmail: string;
    username: string;
  }[];
  revenueByPeriod: { billingPeriod: string; count: number; revenue: number }[];
  teamsOverview: {
    avgMembersPerTeam: number;
    classroomsCount: number;
    schoolsCount: number;
    teamsCount: number;
    totalMembers: number;
  };
}

export interface AnalyticsRankingsData {
  topCanvases: {
    accessLevel: string;
    commentsCount: number;
    creatorUsername: string;
    height: number;
    id: number;
    name: string;
    sizeBytes: number;
    updatedAt: string;
    uuid: string;
    viewsCount: number;
    width: number;
  }[];
  topCreators: {
    avatarUrl: string | null;
    canvasCount: number;
    tier: string;
    totalBytes: number;
    totalComments: number;
    totalViews: number;
    userId: number;
    username: string;
  }[];
}

export async function getAnalyticsOverview(): Promise<AnalyticsOverview> {
  try {
    const [userRows] = await pool.query<RowDataPacket[]>(`
      SELECT
        COUNT(*) AS usersTotal,
        COUNT(CASE WHEN COALESCE(last_login_at, created_at) >= DATE_SUB(NOW(), INTERVAL 1 DAY) THEN 1 END) AS dau,
        COUNT(CASE WHEN COALESCE(last_login_at, created_at) >= DATE_SUB(NOW(), INTERVAL 7 DAY) THEN 1 END) AS wau,
        COUNT(CASE WHEN COALESCE(last_login_at, created_at) >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 END) AS mau,
        COUNT(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 END) AS newUsers30d,
        COUNT(CASE WHEN subscription_tier = 'free' OR subscription_tier IS NULL THEN 1 END) AS tierFree,
        COUNT(CASE WHEN subscription_tier = 'pro' THEN 1 END) AS tierPro,
        COUNT(CASE WHEN subscription_tier = 'business' THEN 1 END) AS tierBusiness,
        COUNT(CASE WHEN two_factor_enabled = 1 THEN 1 END) AS twoFactorCount,
        COUNT(CASE WHEN google_id IS NOT NULL THEN 1 END) AS googleCount
      FROM users
    `);

    const [canvasRows] = await pool.query<RowDataPacket[]>(`
      SELECT
        COUNT(*) AS canvasesTotal,
        COUNT(CASE WHEN updated_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 END) AS activeCanvases30d,
        COUNT(CASE WHEN access_level = 'public' THEN 1 END) AS publicCanvasesTotal,
        COUNT(CASE WHEN access_level = 'private' OR access_level IS NULL THEN 1 END) AS privateCanvasesTotal,
        COALESCE(SUM(size_bytes), 0) AS rawStorageBytes,
        COALESCE(SUM(compressed_bytes), 0) AS compressedStorageBytes,
        COALESCE(AVG(size_bytes), 0) AS avgCanvasSizeBytes
      FROM db_canvas.canvases
      WHERE deleted_at IS NULL
    `);

    const [commentRows] = await pool.query<RowDataPacket[]>(`
      SELECT
        (SELECT COUNT(*) FROM db_canvas.canvas_comments) AS canvasCommentsTotal,
        (SELECT COUNT(*) FROM db_canvas.folders WHERE deleted_at IS NULL) AS foldersTotal,
        (SELECT COUNT(*) FROM db_canvas.canvas_views) AS canvasViewsTotal,
        (SELECT COUNT(*) FROM db_canvas.canvas_snapshots) AS snapshotsTotal,
        (SELECT COALESCE(AVG(duration_seconds), 0) FROM db_canvas.canvas_views WHERE duration_seconds > 0) AS avgDurationSeconds
    `);

    let purchasesStats = { avgOrderValue: 0, count: 0, totalRevenue: 0 };
    try {
      const [pRows] = await pool.query<RowDataPacket[]>(`
        SELECT
          COUNT(*) AS count,
          COALESCE(SUM(amount_total), 0) AS totalRevenue,
          COALESCE(AVG(amount_total), 0) AS avgOrderValue
        FROM purchases
        WHERE status = 'paid' OR status = 'completed' OR status = 'active'
      `);
      if (pRows.length > 0) {
        purchasesStats = {
          avgOrderValue: Number(Number(pRows[0].avgOrderValue || 0).toFixed(2)),
          count: Number(pRows[0].count || 0),
          totalRevenue: Number(Number(pRows[0].totalRevenue || 0).toFixed(2)),
        };
      }
    } catch {}

    let teamsStats = { classroomsTotal: 0, schoolsTotal: 0, teamMembersTotal: 0, teamsTotal: 0 };
    try {
      const [tRows] = await pool.query<RowDataPacket[]>(`
        SELECT
          COUNT(*) AS teamsTotal,
          COUNT(CASE WHEN team_type = 'classroom' THEN 1 END) AS classroomsTotal,
          (SELECT COUNT(*) FROM team_members) AS teamMembersTotal,
          (SELECT COUNT(*) FROM school_organizations) AS schoolsTotal
        FROM teams
      `);
      if (tRows.length > 0) {
        teamsStats = {
          classroomsTotal: Number(tRows[0].classroomsTotal || 0),
          schoolsTotal: Number(tRows[0].schoolsTotal || 0),
          teamMembersTotal: Number(tRows[0].teamMembersTotal || 0),
          teamsTotal: Number(tRows[0].teamsTotal || 0),
        };
      }
    } catch {}

    let aiStats = { dislikes: 0, likes: 0, satisfaction: 100, total: 0 };
    try {
      const [aiRows] = await pool.query<RowDataPacket[]>(`
        SELECT
          COUNT(*) AS total,
          COUNT(CASE WHEN rating = 'like' THEN 1 END) AS likes,
          COUNT(CASE WHEN rating = 'dislike' THEN 1 END) AS dislikes
        FROM ai_chat_feedback
      `);
      if (aiRows.length > 0) {
        const tot = Number(aiRows[0].total || 0);
        const lk = Number(aiRows[0].likes || 0);
        const dlk = Number(aiRows[0].dislikes || 0);
        const sat = tot > 0 ? Number(((lk / tot) * 100).toFixed(1)) : 100;
        aiStats = { dislikes: dlk, likes: lk, satisfaction: sat, total: tot };
      }
    } catch {}

    const u = userRows[0] || {};
    const c = canvasRows[0] || {};
    const cm = commentRows[0] || {};

    const usersTotal = Number(u.usersTotal || 0);
    const dau = Math.max(1, Number(u.dau || 0));
    const mau = Math.max(1, Number(u.mau || 0));
    const rawBytes = Number(c.rawStorageBytes || 0);
    const compressedBytes = Number(c.compressedStorageBytes || 0);

    const savingsPercent = rawBytes > 0
      ? Math.max(0, Number((((rawBytes - compressedBytes) / rawBytes) * 100).toFixed(1)))
      : 0;

    const proUsers = Number(u.tierPro || 0);
    const businessUsers = Number(u.tierBusiness || 0);
    const paidUsers = proUsers + businessUsers;
    const conversionRatePercent = usersTotal > 0
      ? Number(((paidUsers / usersTotal) * 100).toFixed(2))
      : 0;

    const stickinessRatio = mau > 0
      ? Number(((dau / mau) * 100).toFixed(1))
      : 0;

    const mrrEstimated = Math.round(proUsers * 9.99 + businessUsers * 29.99);
    const arrEstimated = mrrEstimated * 12;

    const twoFactorAdoptionPercent = usersTotal > 0
      ? Number(((Number(u.twoFactorCount || 0) / usersTotal) * 100).toFixed(1))
      : 0;
    const googleAuthPercent = usersTotal > 0
      ? Number(((Number(u.googleCount || 0) / usersTotal) * 100).toFixed(1))
      : 0;

    return {
      activeCanvases30d: Number(c.activeCanvases30d || 0),
      aiFeedbackDislikes: aiStats.dislikes,
      aiFeedbackLikes: aiStats.likes,
      aiFeedbackTotal: aiStats.total,
      aiSatisfactionPercent: aiStats.satisfaction,
      arrEstimated,
      avgCanvasSizeBytes: Math.round(Number(c.avgCanvasSizeBytes || 0)),
      avgDurationSeconds: Math.round(Number(cm.avgDurationSeconds || 0)),
      avgOrderValue: purchasesStats.avgOrderValue,
      canvasCommentsTotal: Number(cm.canvasCommentsTotal || 0),
      canvasViewsTotal: Number(cm.canvasViewsTotal || 0),
      canvasesTotal: Number(c.canvasesTotal || 0),
      classroomsTotal: teamsStats.classroomsTotal,
      compressedStorageBytes: compressedBytes,
      compressionSavingsPercent: savingsPercent,
      conversionRatePercent,
      dau,
      foldersTotal: Number(cm.foldersTotal || 0),
      googleAuthPercent,
      mau,
      mrrEstimated,
      newUsers30d: Number(u.newUsers30d || 0),
      privateCanvasesTotal: Number(c.privateCanvasesTotal || 0),
      publicCanvasesTotal: Number(c.publicCanvasesTotal || 0),
      purchasesCount: purchasesStats.count,
      rawStorageBytes: rawBytes,
      schoolsTotal: teamsStats.schoolsTotal,
      snapshotsTotal: Number(cm.snapshotsTotal || 0),
      stickinessRatio,
      teamMembersTotal: teamsStats.teamMembersTotal,
      teamsTotal: teamsStats.teamsTotal,
      tierDistribution: {
        business: businessUsers,
        free: Number(u.tierFree || 0),
        pro: proUsers,
      },
      totalRevenue: purchasesStats.totalRevenue,
      twoFactorAdoptionPercent,
      usersTotal,
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
        COALESCE(SUM(compressed_bytes), 0) AS bytes,
        COALESCE(SUM(size_bytes), 0) AS rawBytes
      FROM db_canvas.canvases
      WHERE deleted_at IS NULL AND created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
      GROUP BY DATE_FORMAT(created_at, '%Y-%m-%d')
    `, [days]);

    let viewRows: RowDataPacket[] = [];
    try {
      const [vRows] = await pool.query<RowDataPacket[]>(`
        SELECT DATE_FORMAT(viewed_at, '%Y-%m-%d') AS date, COUNT(*) AS count
        FROM db_canvas.canvas_views
        WHERE viewed_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
        GROUP BY DATE_FORMAT(viewed_at, '%Y-%m-%d')
      `, [days]);
      viewRows = vRows;
    } catch {}

    let purchaseRows: RowDataPacket[] = [];
    try {
      const [pRows] = await pool.query<RowDataPacket[]>(`
        SELECT DATE_FORMAT(created_at, '%Y-%m-%d') AS date, COALESCE(SUM(amount_total), 0) AS revenue
        FROM purchases
        WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
        GROUP BY DATE_FORMAT(created_at, '%Y-%m-%d')
      `, [days]);
      purchaseRows = pRows;
    } catch {}

    const userMap = new Map<string, number>();
    userRows.forEach((r) => userMap.set(String(r.date), Number(r.count || 0)));

    const canvasMap = new Map<string, { bytes: number; count: number; rawBytes: number }>();
    canvasRows.forEach((r) => canvasMap.set(String(r.date), {
      bytes: Number(r.bytes || 0),
      count: Number(r.count || 0),
      rawBytes: Number(r.rawBytes || 0),
    }));

    const viewMap = new Map<string, number>();
    viewRows.forEach((r) => viewMap.set(String(r.date), Number(r.count || 0)));

    const revenueMap = new Map<string, number>();
    purchaseRows.forEach((r) => revenueMap.set(String(r.date), Number(r.revenue || 0)));

    const result: AnalyticsTrendPoint[] = [];
    const now = new Date();

    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;

      const cData = canvasMap.get(dateStr) || { bytes: 0, count: 0, rawBytes: 0 };
      const storageMb = Number((cData.bytes / (1024 * 1024)).toFixed(2));
      const rawStorageMb = Number((cData.rawBytes / (1024 * 1024)).toFixed(2));

      result.push({
        canvases: cData.count,
        date: dateStr,
        label: `${day}/${month}`,
        rawStorageMb,
        revenue: Number(Number(revenueMap.get(dateStr) || 0).toFixed(2)),
        storageMb,
        users: userMap.get(dateStr) || 0,
        views: viewMap.get(dateStr) || 0,
      });
    }

    return result;
  } catch (error) {
    logger.db.error('Error al calcular tendencias analíticas', { error, range });
    throw error;
  }
}

export async function getAnalyticsBreakdowns(): Promise<AnalyticsBreakdownData> {
  try {
    const [resRows] = await pool.query<RowDataPacket[]>(`
      SELECT
        COUNT(CASE WHEN width <= 64 AND height <= 64 THEN 1 END) AS microResolution,
        COUNT(CASE WHEN (width > 64 OR height > 64) AND width <= 128 AND height <= 128 THEN 1 END) AS spriteResolution,
        COUNT(CASE WHEN (width > 128 OR height > 128) AND width <= 512 AND height <= 512 THEN 1 END) AS standardResolution,
        COUNT(CASE WHEN width > 512 OR height > 512 THEN 1 END) AS hdLargeResolution,
        COUNT(CASE WHEN canvas_type = 'pixel' OR canvas_type IS NULL THEN 1 END) AS typePixel,
        COUNT(CASE WHEN canvas_type = 'vector' THEN 1 END) AS typeVector,
        COUNT(CASE WHEN canvas_type NOT IN ('pixel', 'vector') AND canvas_type IS NOT NULL THEN 1 END) AS typeOther
      FROM db_canvas.canvases
      WHERE deleted_at IS NULL
    `);

    const [dowRows] = await pool.query<RowDataPacket[]>(`
      SELECT DAYOFWEEK(created_at) AS dow, COUNT(*) AS count
      FROM db_canvas.canvases
      WHERE deleted_at IS NULL AND created_at >= DATE_SUB(CURDATE(), INTERVAL 90 DAY)
      GROUP BY DAYOFWEEK(created_at)
    `);

    const [hourRows] = await pool.query<RowDataPacket[]>(`
      SELECT HOUR(created_at) AS hr, COUNT(*) AS count
      FROM db_canvas.canvases
      WHERE deleted_at IS NULL AND created_at >= DATE_SUB(CURDATE(), INTERVAL 90 DAY)
      GROUP BY HOUR(created_at)
      ORDER BY hr ASC
    `);

    const [userStats] = await pool.query<RowDataPacket[]>(`
      SELECT
        COUNT(CASE WHEN subscription_tier = 'free' OR subscription_tier IS NULL THEN 1 END) AS freeCount,
        COUNT(CASE WHEN subscription_tier = 'pro' THEN 1 END) AS proCount,
        COUNT(CASE WHEN subscription_tier = 'business' THEN 1 END) AS bizCount,
        COUNT(CASE WHEN google_id IS NOT NULL THEN 1 END) AS googleCount,
        COUNT(CASE WHEN google_id IS NULL THEN 1 END) AS passwordCount,
        COUNT(CASE WHEN two_factor_enabled = 1 THEN 1 END) AS twoFactorCount
      FROM users
    `);

    const [prefRows] = await pool.query<RowDataPacket[]>(`
      SELECT
        COALESCE(theme, 'system') AS theme,
        COALESCE(language, 'es-419') AS language,
        COUNT(*) AS count
      FROM user_preferences
      GROUP BY theme, language
    `);

    const [geoRows] = await pool.query<RowDataPacket[]>(`
      SELECT
        COALESCE(registration_country_name, 'Desconocido') AS country,
        COALESCE(registration_country_code, 'UN') AS code,
        COUNT(*) AS count
      FROM users
      GROUP BY registration_country_name, registration_country_code
      ORDER BY count DESC
      LIMIT 10
    `);

    const r = resRows[0] || {};
    const u = userStats[0] || {};

    const dowMap = new Map<number, number>();
    dowRows.forEach((row) => dowMap.set(Number(row.dow), Number(row.count || 0)));

    const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const activityByDay = dayNames.map((name, index) => ({
      count: dowMap.get(index + 1) || 0,
      day: name,
    }));

    const hourMap = new Map<number, number>();
    hourRows.forEach((row) => hourMap.set(Number(row.hr), Number(row.count || 0)));

    const activityByHour: { count: number; hour: number }[] = [];
    for (let h = 0; h < 24; h++) {
      activityByHour.push({ count: hourMap.get(h) || 0, hour: h });
    }

    const themeMap = new Map<string, number>();
    const langMap = new Map<string, number>();

    prefRows.forEach((row) => {
      const t = String(row.theme);
      const l = String(row.language);
      const cnt = Number(row.count || 0);
      themeMap.set(t, (themeMap.get(t) || 0) + cnt);
      langMap.set(l, (langMap.get(l) || 0) + cnt);
    });

    const themes = Array.from(themeMap.entries()).map(([label, count]) => ({ count, label }));
    const languages = Array.from(langMap.entries()).map(([label, count]) => ({ count, label }));

    const geoDistribution = geoRows.map((row) => ({
      code: String(row.code || 'UN'),
      count: Number(row.count || 0),
      country: String(row.country || 'Desconocido'),
    }));

    return {
      activityByDay,
      activityByHour,
      authDistribution: {
        googleAuth: Number(u.googleCount || 0),
        passwordOnly: Number(u.passwordCount || 0),
        twoFactorEnabled: Number(u.twoFactorCount || 0),
      },
      formats: [
        { count: Number(r.typePixel || 0), label: 'Pixel Art' },
        { count: Number(r.typeVector || 0), label: 'Vectorial' },
        { count: Number(r.typeOther || 0), label: 'Otros Formatos' },
      ],
      geoDistribution,
      preferences: { languages, themes },
      resolutions: [
        { count: Number(r.microResolution || 0), label: 'Micro Sprite (≤64×64)' },
        { count: Number(r.spriteResolution || 0), label: 'Icono / Sprite (≤128×128)' },
        { count: Number(r.standardResolution || 0), label: 'Estándar (≤512×512)' },
        { count: Number(r.hdLargeResolution || 0), label: 'HD / Gran Formato (>512px)' },
      ],
      tiers: {
        business: Number(u.bizCount || 0),
        free: Number(u.freeCount || 0),
        pro: Number(u.proCount || 0),
      },
    };
  } catch (error) {
    logger.db.error('Error al calcular desgloses analíticos de la plataforma', error);
    throw error;
  }
}

export async function getAnalyticsFinancialsAndTeams(): Promise<AnalyticsFinancialsAndTeamsData> {
  try {
    let purchasesByPlan: { count: number; planId: string; revenue: number }[] = [];
    let revenueByPeriod: { billingPeriod: string; count: number; revenue: number }[] = [];
    let recentPurchases: any[] = [];

    try {
      const [planRows] = await pool.query<RowDataPacket[]>(`
        SELECT
          plan_id AS planId,
          COUNT(*) AS count,
          COALESCE(SUM(amount_total), 0) AS revenue
        FROM purchases
        WHERE status IN ('paid', 'completed', 'active')
        GROUP BY plan_id
      `);
      purchasesByPlan = planRows.map((r) => ({
        count: Number(r.count || 0),
        planId: String(r.planId || 'free'),
        revenue: Number(Number(r.revenue || 0).toFixed(2)),
      }));

      const [periodRows] = await pool.query<RowDataPacket[]>(`
        SELECT
          COALESCE(billing_period, 'monthly') AS billingPeriod,
          COUNT(*) AS count,
          COALESCE(SUM(amount_total), 0) AS revenue
        FROM purchases
        WHERE status IN ('paid', 'completed', 'active')
        GROUP BY billing_period
      `);
      revenueByPeriod = periodRows.map((r) => ({
        billingPeriod: String(r.billingPeriod || 'monthly'),
        count: Number(r.count || 0),
        revenue: Number(Number(r.revenue || 0).toFixed(2)),
      }));

      const [recRows] = await pool.query<RowDataPacket[]>(`
        SELECT
          p.id,
          p.plan_id AS planId,
          p.billing_period AS billingPeriod,
          p.amount_total AS amount,
          p.currency,
          p.status,
          DATE_FORMAT(p.created_at, '%Y-%m-%d %H:%i') AS createdAt,
          u.username,
          u.email AS userEmail
        FROM purchases p
        LEFT JOIN users u ON p.user_id = u.id
        ORDER BY p.created_at DESC
        LIMIT 10
      `);
      recentPurchases = recRows.map((r) => ({
        amount: Number(r.amount || 0),
        billingPeriod: String(r.billingPeriod || 'monthly'),
        createdAt: String(r.createdAt || ''),
        currency: String(r.currency || 'USD'),
        id: Number(r.id),
        planId: String(r.planId || 'pro'),
        status: String(r.status || 'paid'),
        userEmail: String(r.userEmail || 'desconocido@correo.com'),
        username: String(r.username || 'Usuario'),
      }));
    } catch {}

    let teamsOverview = {
      avgMembersPerTeam: 0,
      classroomsCount: 0,
      schoolsCount: 0,
      teamsCount: 0,
      totalMembers: 0,
    };
    try {
      const [tRows] = await pool.query<RowDataPacket[]>(`
        SELECT
          COUNT(*) AS teamsCount,
          COUNT(CASE WHEN team_type = 'classroom' THEN 1 END) AS classroomsCount,
          (SELECT COUNT(*) FROM team_members) AS totalMembers,
          (SELECT COUNT(*) FROM school_organizations) AS schoolsCount
        FROM teams
      `);
      if (tRows.length > 0) {
        const tc = Number(tRows[0].teamsCount || 0);
        const tm = Number(tRows[0].totalMembers || 0);
        teamsOverview = {
          avgMembersPerTeam: tc > 0 ? Number((tm / tc).toFixed(1)) : 0,
          classroomsCount: Number(tRows[0].classroomsCount || 0),
          schoolsCount: Number(tRows[0].schoolsCount || 0),
          teamsCount: tc,
          totalMembers: tm,
        };
      }
    } catch {}

    let aiHealth = { dislikes: 0, likes: 0, satisfactionPercent: 100, total: 0 };
    try {
      const [aiRows] = await pool.query<RowDataPacket[]>(`
        SELECT
          COUNT(*) AS total,
          COUNT(CASE WHEN rating = 'like' THEN 1 END) AS likes,
          COUNT(CASE WHEN rating = 'dislike' THEN 1 END) AS dislikes
        FROM ai_chat_feedback
      `);
      if (aiRows.length > 0) {
        const total = Number(aiRows[0].total || 0);
        const likes = Number(aiRows[0].likes || 0);
        const dislikes = Number(aiRows[0].dislikes || 0);
        const satisfactionPercent = total > 0 ? Number(((likes / total) * 100).toFixed(1)) : 100;
        aiHealth = { dislikes, likes, satisfactionPercent, total };
      }
    } catch {}

    return {
      aiHealth,
      purchasesByPlan,
      recentPurchases,
      revenueByPeriod,
      teamsOverview,
    };
  } catch (error) {
    logger.db.error('Error al obtener finanzas y métricas B2B de analítica', error);
    throw error;
  }
}

export async function getAnalyticsRankings(): Promise<AnalyticsRankingsData> {
  try {
    const [creatorRows] = await pool.query<RowDataPacket[]>(`
      SELECT
        u.id AS userId,
        u.username,
        u.avatar_url AS avatarUrl,
        COALESCE(u.subscription_tier, 'free') AS tier,
        COUNT(c.id) AS canvasCount,
        COALESCE(SUM(c.compressed_bytes), 0) AS totalBytes,
        (
          SELECT COUNT(*)
          FROM db_canvas.canvas_comments cm
          JOIN db_canvas.canvases c2 ON cm.canvas_id = c2.id
          WHERE c2.user_id = u.id
        ) AS totalComments,
        (
          SELECT COUNT(*)
          FROM db_canvas.canvas_views cv
          JOIN db_canvas.canvases c3 ON cv.canvas_id = c3.id
          WHERE c3.user_id = u.id
        ) AS totalViews
      FROM users u
      JOIN db_canvas.canvases c ON u.id = c.user_id
      WHERE c.deleted_at IS NULL
      GROUP BY u.id, u.username, u.avatar_url, u.subscription_tier
      ORDER BY canvasCount DESC, totalBytes DESC
      LIMIT 10
    `);

    const [canvasRows] = await pool.query<RowDataPacket[]>(`
      SELECT
        c.id,
        c.uuid,
        c.name,
        c.width,
        c.height,
        COALESCE(c.access_level, 'private') AS accessLevel,
        c.size_bytes AS sizeBytes,
        c.updated_at AS updatedAt,
        u.username AS creatorUsername,
        (SELECT COUNT(*) FROM db_canvas.canvas_views cv WHERE cv.canvas_id = c.id) AS viewsCount,
        (SELECT COUNT(*) FROM db_canvas.canvas_comments cc WHERE cc.canvas_id = c.id) AS commentsCount
      FROM db_canvas.canvases c
      JOIN users u ON c.user_id = u.id
      WHERE c.deleted_at IS NULL
      ORDER BY viewsCount DESC, commentsCount DESC, c.updated_at DESC
      LIMIT 10
    `);

    const topCreators = creatorRows.map((r) => ({
      avatarUrl: r.avatarUrl ? String(r.avatarUrl) : null,
      canvasCount: Number(r.canvasCount || 0),
      tier: String(r.tier || 'free'),
      totalBytes: Number(r.totalBytes || 0),
      totalComments: Number(r.totalComments || 0),
      totalViews: Number(r.totalViews || 0),
      userId: Number(r.userId),
      username: String(r.username),
    }));

    const topCanvases = canvasRows.map((r) => ({
      accessLevel: String(r.accessLevel || 'private'),
      commentsCount: Number(r.commentsCount || 0),
      creatorUsername: String(r.creatorUsername),
      height: Number(r.height || 1080),
      id: Number(r.id),
      name: String(r.name || 'Sin título'),
      sizeBytes: Number(r.sizeBytes || 0),
      updatedAt: String(r.updatedAt || ''),
      uuid: String(r.uuid),
      viewsCount: Number(r.viewsCount || 0),
      width: Number(r.width || 1920),
    }));

    return { topCanvases, topCreators };
  } catch (error) {
    logger.db.error('Error al obtener rankings analíticos de la plataforma', error);
    throw error;
  }
}

export async function getAnalyticsExportCsv(range = '30d'): Promise<string> {
  const trends = await getAnalyticsTrends(range);
  const rows = [
    ['Fecha', 'Nuevos_Usuarios', 'Lienzos_Creados', 'Vistas_Lienzo', 'Almacenamiento_Comprimido_MB', 'Almacenamiento_Bruto_MB', 'Ingresos_Estimados_USD'].join(','),
  ];

  trends.forEach((t) => {
    rows.push([
      t.date,
      t.users,
      t.canvases,
      t.views,
      t.storageMb,
      t.rawStorageMb,
      t.revenue,
    ].join(','));
  });

  return rows.join('\n');
}
