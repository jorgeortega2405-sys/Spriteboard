import { pool } from '../config/database.config.js';
import { logger } from './logger.service.js';
import type { RowDataPacket } from 'mysql2';

export interface BillingOverview {
  activeSubscribers: number;
  arr: number;
  mrr: number;
  planBreakdown: {
    business: number;
    free: number;
    pro: number;
  };
  refundsCount: number;
  refundsTotal: number;
  totalRevenue: number;
  totalTransactions: number;
}

export interface BillingTransaction {
  amount_total: number;
  avatar_url: string | null;
  billing_period: string;
  created_at: string;
  currency: string;
  email: string;
  id: number;
  plan_id: string;
  status: string;
  stripe_customer_id: string | null;
  stripe_payment_intent_id: string | null;
  stripe_session_id: string;
  stripe_subscription_id: string | null;
  user_id: number;
  username: string;
}

export async function getBillingOverview(): Promise<BillingOverview> {
  try {
    const [subRows] = await pool.query<RowDataPacket[]>(`
      SELECT LOWER(subscription_tier) AS tier, COUNT(*) AS count
      FROM users
      GROUP BY LOWER(subscription_tier)
    `);

    const planBreakdown = { business: 0, free: 0, pro: 0 };
    let proCount = 0;
    let businessCount = 0;

    subRows.forEach((r) => {
      const t = String(r.tier || '').toLowerCase();
      const count = Number(r.count || 0);
      if (t === 'pro') {
        planBreakdown.pro = count;
        proCount = count;
      } else if (t === 'business') {
        planBreakdown.business = count;
        businessCount = count;
      } else {
        planBreakdown.free += count;
      }
    });

    const [purchaseRows] = await pool.query<RowDataPacket[]>(`
      SELECT
        COUNT(*) AS totalTransactions,
        COALESCE(SUM(CASE WHEN status = 'succeeded' OR status = 'completed' OR status = 'paid' THEN amount_total ELSE 0 END), 0) AS totalRevenue,
        COALESCE(SUM(CASE WHEN status = 'refunded' THEN amount_total ELSE 0 END), 0) AS refundsTotal,
        COUNT(CASE WHEN status = 'refunded' THEN 1 END) AS refundsCount
      FROM purchases
    `);

    const p = purchaseRows[0] || {};
    const proMonthlyPrice = 12.00;
    const businessMonthlyPrice = 39.00;
    const mrr = (proCount * proMonthlyPrice) + (businessCount * businessMonthlyPrice);
    const arr = mrr * 12;

    return {
      activeSubscribers: proCount + businessCount,
      arr,
      mrr,
      planBreakdown,
      refundsCount: Number(p.refundsCount || 0),
      refundsTotal: Number(p.refundsTotal || 0),
      totalRevenue: Number(p.totalRevenue || 0),
      totalTransactions: Number(p.totalTransactions || 0),
    };
  } catch (error) {
    logger.db.error('Error al obtener métricas financieras de facturación', error);
    throw error;
  }
}

export async function getBillingTransactions(
  search = '',
  status = 'all',
  page = 1,
  limit = 20
): Promise<{ page: number; total: number; totalPages: number; transactions: BillingTransaction[] }> {
  try {
    const offset = Math.max(0, (page - 1) * limit);
    const params: unknown[] = [];
    const whereClauses: string[] = [];

    if (search.trim()) {
      whereClauses.push('(u.username LIKE ? OR u.email LIKE ? OR p.stripe_session_id LIKE ? OR p.plan_id LIKE ?)');
      const pattern = `%${search.trim()}%`;
      params.push(pattern, pattern, pattern, pattern);
    }

    if (status !== 'all') {
      whereClauses.push('p.status = ?');
      params.push(status);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const [countRows] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS total
       FROM purchases p
       LEFT JOIN users u ON p.user_id = u.id
       ${whereSql}`,
      params
    );
    const total = Number(countRows[0]?.total || 0);

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT 
        p.id,
        p.user_id,
        p.stripe_session_id,
        p.stripe_payment_intent_id,
        p.stripe_subscription_id,
        p.stripe_customer_id,
        p.plan_id,
        p.billing_period,
        p.amount_total,
        p.currency,
        p.status,
        DATE_FORMAT(p.created_at, '%Y-%m-%d %H:%i:%s') AS created_at,
        u.username,
        u.email,
        u.avatar_url
       FROM purchases p
       LEFT JOIN users u ON p.user_id = u.id
       ${whereSql}
       ORDER BY p.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    const transactions: BillingTransaction[] = rows.map((r) => ({
      amount_total: Number(r.amount_total || 0),
      avatar_url: r.avatar_url ?? null,
      billing_period: String(r.billing_period || 'monthly'),
      created_at: String(r.created_at || ''),
      currency: String(r.currency || 'USD'),
      email: String(r.email || 'desconocido@correo.com'),
      id: Number(r.id),
      plan_id: String(r.plan_id || 'pro'),
      status: String(r.status || 'succeeded'),
      stripe_customer_id: r.stripe_customer_id ?? null,
      stripe_payment_intent_id: r.stripe_payment_intent_id ?? null,
      stripe_session_id: String(r.stripe_session_id || ''),
      stripe_subscription_id: r.stripe_subscription_id ?? null,
      user_id: Number(r.user_id),
      username: String(r.username || 'Usuario'),
    }));

    return {
      page,
      total,
      totalPages: Math.ceil(total / limit) || 1,
      transactions,
    };
  } catch (error) {
    logger.db.error('Error al listar transacciones de facturación', error);
    throw error;
  }
}

export async function processRefundTransaction(
  purchaseId: number,
  reason: string,
  adminUserId: number,
  adminIp: string
): Promise<{ success: boolean }> {
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT id, user_id, amount_total, status FROM purchases WHERE id = ?',
      [purchaseId]
    );

    if (rows.length === 0) {
      throw new Error('Transacción no encontrada');
    }

    const purchase = rows[0];
    if (purchase.status === 'refunded') {
      throw new Error('La transacción ya se encuentra reembolsada');
    }

    await pool.query(
      'UPDATE purchases SET status = ? WHERE id = ?',
      ['refunded', purchaseId]
    );

    await pool.query(
      'INSERT INTO user_audit_logs (user_id, action, old_value, new_value, ip_address) VALUES (?, ?, ?, ?, ?)',
      [
        adminUserId,
        `billing_refund:purchase_${purchaseId}`,
        JSON.stringify({ amount: purchase.amount_total, status: purchase.status }),
        JSON.stringify({ amount: purchase.amount_total, reason, status: 'refunded' }),
        adminIp,
      ]
    );

    logger.security.info('Reembolso procesado por administrador', {
      adminUserId,
      amount: purchase.amount_total,
      purchaseId,
      reason,
      targetUserId: purchase.user_id,
    });

    return { success: true };
  } catch (error) {
    logger.db.error('Error al procesar reembolso en facturación', { error, purchaseId });
    throw error;
  }
}
