import pool from '../config/database.config.js';
import { logger } from './logger.service.js';
import mysql from 'mysql2/promise';

export interface PurchaseRecord {
  id?: number;
  user_id: number;
  stripe_session_id: string;
  stripe_payment_intent_id?: string | null;
  stripe_subscription_id?: string | null;
  stripe_customer_id?: string | null;
  plan_id: string;
  billing_period: 'monthly' | 'yearly';
  amount_total: number;
  currency: string;
  status: string;
  created_at?: Date;
  updated_at?: Date;
}

export class PurchaseService {
  private static instance: PurchaseService;

  private constructor() {}

  public static getInstance(): PurchaseService {
    if (!PurchaseService.instance) {
      PurchaseService.instance = new PurchaseService();
    }
    return PurchaseService.instance;
  }

  /**
   * Registrar o actualizar una compra en la base de datos MySQL
   */
  public async recordPurchase(purchase: PurchaseRecord): Promise<void> {
    const conn = await pool.getConnection();
    try {
      await conn.query(
        `
        INSERT INTO purchases (
          user_id,
          stripe_session_id,
          stripe_payment_intent_id,
          stripe_subscription_id,
          stripe_customer_id,
          plan_id,
          billing_period,
          amount_total,
          currency,
          status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          stripe_payment_intent_id = VALUES(stripe_payment_intent_id),
          stripe_subscription_id = VALUES(stripe_subscription_id),
          stripe_customer_id = VALUES(stripe_customer_id),
          status = VALUES(status),
          updated_at = CURRENT_TIMESTAMP
        `,
        [
          purchase.user_id,
          purchase.stripe_session_id,
          purchase.stripe_payment_intent_id || null,
          purchase.stripe_subscription_id || null,
          purchase.stripe_customer_id || null,
          purchase.plan_id,
          purchase.billing_period,
          purchase.amount_total,
          purchase.currency.toUpperCase(),
          purchase.status,
        ]
      );
      logger.db.info('Compra registrada en base de datos', {
        userId: purchase.user_id,
        plan: purchase.plan_id,
        period: purchase.billing_period,
        status: purchase.status,
      });
    } catch (error) {
      logger.db.error('Error al registrar compra en MySQL', error);
      throw error;
    } finally {
      conn.release();
    }
  }

  /**
   * Actualizar el tier y metadatos de suscripción de un usuario en MySQL
   */
  public async updateUserSubscription(
    userId: number,
    tier: string,
    customerId?: string | null,
    subscriptionId?: string | null,
    status: string = 'active',
    periodEnd?: Date | null
  ): Promise<void> {
    const conn = await pool.getConnection();
    try {
      await conn.query(
        `
        UPDATE users
        SET
          subscription_tier = ?,
          stripe_customer_id = COALESCE(?, stripe_customer_id),
          stripe_subscription_id = COALESCE(?, stripe_subscription_id),
          subscription_status = ?,
          subscription_period_end = COALESCE(?, subscription_period_end)
        WHERE id = ?
        `,
        [tier, customerId || null, subscriptionId || null, status, periodEnd || null, userId]
      );
      logger.db.info('Suscripción de usuario actualizada en MySQL', { userId, tier, status });
    } catch (error) {
      logger.db.error('Error al actualizar suscripción de usuario en MySQL', error);
      throw error;
    } finally {
      conn.release();
    }
  }

  /**
   * Obtener compras asociadas a un usuario
   */
  public async getPurchasesByUserId(userId: number): Promise<PurchaseRecord[]> {
    const [rows] = await pool.query<mysql.RowDataPacket[]>(
      'SELECT * FROM purchases WHERE user_id = ? ORDER BY created_at DESC',
      [userId]
    );
    return rows as PurchaseRecord[];
  }

  /**
   * Buscar compra por ID de sesión de Stripe
   */
  public async getPurchaseBySessionId(sessionId: string): Promise<PurchaseRecord | null> {
    const [rows] = await pool.query<mysql.RowDataPacket[]>(
      'SELECT * FROM purchases WHERE stripe_session_id = ? LIMIT 1',
      [sessionId]
    );
    if (!rows.length) return null;
    return rows[0] as PurchaseRecord;
  }

  /**
   * Obtener información de facturación y Stripe de un usuario
   */
  public async getUserBillingInfo(userId: number): Promise<{
    id: number;
    email: string;
    username: string;
    subscription_tier: string;
    stripe_customer_id: string | null;
    stripe_subscription_id: string | null;
    subscription_status: string;
    subscription_period_end: Date | null;
  } | null> {
    const [rows] = await pool.query<mysql.RowDataPacket[]>(
      'SELECT id, email, username, subscription_tier, stripe_customer_id, stripe_subscription_id, subscription_status, subscription_period_end FROM users WHERE id = ? LIMIT 1',
      [userId]
    );
    if (!rows.length) return null;
    return rows[0] as any;
  }

  /**
   * Actualizar el ID de cliente de Stripe de un usuario
   */
  public async updateUserCustomerId(userId: number, customerId: string): Promise<void> {
    await pool.query('UPDATE users SET stripe_customer_id = ? WHERE id = ?', [customerId, userId]);
  }
}

export const purchaseService = PurchaseService.getInstance();
