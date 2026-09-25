import { config } from '../config/env.config.js';
import { pool } from '../config/database.config.js';
import { logger } from './logger.service.js';
import { stripeService } from './stripe.service.js';
import mysql, { RowDataPacket } from 'mysql2/promise';
import Stripe from 'stripe';

export interface CreatorPoolSummary {
  available_balance_usd: number;
  designer_estimated_usd: number;
  designer_pro_uses: number;
  designer_share_pct: number;
  details_submitted: boolean;
  payouts_enabled: boolean;
  period_key: string;
  pool_amount_usd: number;
  pool_percentage: number;
  recent_shares: Array<{
    earned_usd: number;
    period_key: string;
    pro_uses: number;
    share_pct: number;
    status: string;
  }>;
  stripe_account_id: string | null;
  stripe_connected: boolean;
  total_platform_pro_uses: number;
  total_withdrawn_usd: number;
}

export function getCurrentPeriodKey(): string {
  const d = new Date();
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

export async function getOrCreateCurrentPoolCycle(): Promise<{
  id: number;
  period_key: string;
  pool_amount_cents: number;
  pool_percentage: number;
  total_pro_uses: number;
  total_subscription_revenue_cents: number;
}> {
  const periodKey = getCurrentPeriodKey();

  const [revRows] = await pool.query<RowDataPacket[]>(
    `SELECT COALESCE(SUM(amount_total), 0) as total_rev 
     FROM purchases 
     WHERE status = 'completed' 
       AND created_at >= DATE_FORMAT(NOW() ,'%Y-%m-01')`,
    []
  );

  const totalRevUsd = Number(revRows[0]?.total_rev || 0);
  const totalRevCents = Math.round(totalRevUsd * 100);
  const poolPercentage = 25.0;
  const poolAmountCents = Math.round(totalRevCents * (poolPercentage / 100));

  const [existing] = await pool.query<RowDataPacket[]>(
    'SELECT * FROM creator_pool_cycles WHERE period_key = ? LIMIT 1',
    [periodKey]
  );

  if (existing.length > 0) {
    const cycle = existing[0];
    if (totalRevCents !== Number(cycle.total_subscription_revenue_cents)) {
      await pool.query(
        `UPDATE creator_pool_cycles 
         SET total_subscription_revenue_cents = ?, pool_amount_cents = ? 
         WHERE id = ?`,
        [totalRevCents, poolAmountCents, cycle.id]
      );
    }
    return {
      id: Number(cycle.id),
      period_key: periodKey,
      pool_amount_cents: poolAmountCents,
      pool_percentage: poolPercentage,
      total_pro_uses: Number(cycle.total_pro_uses || 0),
      total_subscription_revenue_cents: totalRevCents,
    };
  }

  const [result] = await pool.query<mysql.ResultSetHeader>(
    `INSERT INTO creator_pool_cycles 
      (period_key, total_subscription_revenue_cents, pool_percentage, pool_amount_cents, total_pro_uses, status)
     VALUES (?, ?, ?, ?, 0, 'active')`,
    [periodKey, totalRevCents, poolPercentage, poolAmountCents]
  );

  return {
    id: result.insertId,
    period_key: periodKey,
    pool_amount_cents: poolAmountCents,
    pool_percentage: poolPercentage,
    total_pro_uses: 0,
    total_subscription_revenue_cents: totalRevCents,
  };
}

export async function trackProTemplateUsage(templateId: number, designerId: number): Promise<void> {
  try {
    const cycle = await getOrCreateCurrentPoolCycle();

    await pool.query(
      'UPDATE creator_pool_cycles SET total_pro_uses = total_pro_uses + 1 WHERE id = ?',
      [cycle.id]
    );

    await pool.query(
      `INSERT INTO creator_pool_shares 
        (cycle_id, designer_id, period_key, pro_uses, share_percentage, earned_amount_cents, currency, status)
       VALUES (?, ?, ?, 1, 0, 0, 'USD', 'estimated')
       ON DUPLICATE KEY UPDATE 
        pro_uses = pro_uses + 1,
        updated_at = CURRENT_TIMESTAMP`,
      [cycle.id, designerId, cycle.period_key]
    );

    const [totalUsesRow] = await pool.query<RowDataPacket[]>(
      'SELECT total_pro_uses, pool_amount_cents FROM creator_pool_cycles WHERE id = ?',
      [cycle.id]
    );

    const totalProUses = Number(totalUsesRow[0]?.total_pro_uses || 1);
    const poolAmountCents = Number(totalUsesRow[0]?.pool_amount_cents || 0);

    const [shares] = await pool.query<RowDataPacket[]>(
      'SELECT id, pro_uses FROM creator_pool_shares WHERE cycle_id = ?',
      [cycle.id]
    );

    for (const s of shares) {
      const uses = Number(s.pro_uses || 0);
      const sharePct = totalProUses > 0 ? (uses / totalProUses) * 100 : 0;
      const earnedCents = Math.round(poolAmountCents * (sharePct / 100));

      await pool.query(
        'UPDATE creator_pool_shares SET share_percentage = ?, earned_amount_cents = ? WHERE id = ?',
        [sharePct, earnedCents, s.id]
      );
    }
  } catch (error) {
    logger.app.warn('Advertencia al registrar uso de plantilla PRO en Creator Pool', { designerId, templateId, error });
  }
}

export async function getDesignerPoolSummary(userId: number): Promise<CreatorPoolSummary> {
  const cycle = await getOrCreateCurrentPoolCycle();

  const [shareRows] = await pool.query<RowDataPacket[]>(
    'SELECT pro_uses, share_percentage, earned_amount_cents FROM creator_pool_shares WHERE cycle_id = ? AND designer_id = ? LIMIT 1',
    [cycle.id, userId]
  );

  const [payoutRows] = await pool.query<RowDataPacket[]>(
    'SELECT * FROM designer_payout_profiles WHERE user_id = ? LIMIT 1',
    [userId]
  );

  const pProfile = payoutRows[0] || null;
  const designerProUses = Number(shareRows[0]?.pro_uses || 0);
  const totalPlatformUses = Number(cycle.total_pro_uses || 0);
  const sharePct = totalPlatformUses > 0 ? (designerProUses / totalPlatformUses) * 100 : 0;
  const estimatedEarnedCents = Math.round(cycle.pool_amount_cents * (sharePct / 100));

  const [historyRows] = await pool.query<RowDataPacket[]>(
    `SELECT period_key, pro_uses, share_percentage, earned_amount_cents, status 
     FROM creator_pool_shares 
     WHERE designer_id = ? AND cycle_id != ? 
     ORDER BY created_at DESC 
     LIMIT 6`,
    [userId, cycle.id]
  );

  const recentShares = historyRows.map((h) => ({
    earned_usd: Number(h.earned_amount_cents || 0) / 100,
    period_key: String(h.period_key),
    pro_uses: Number(h.pro_uses || 0),
    share_pct: Number(h.share_percentage || 0),
    status: String(h.status),
  }));

  const availableBalanceCents = Number(pProfile?.available_balance_cents || 0);
  const totalWithdrawnCents = Number(pProfile?.total_withdrawn_cents || 0);

  return {
    available_balance_usd: availableBalanceCents / 100,
    designer_estimated_usd: estimatedEarnedCents / 100,
    designer_pro_uses: designerProUses,
    designer_share_pct: Number(sharePct.toFixed(2)),
    details_submitted: Boolean(pProfile?.details_submitted),
    payouts_enabled: Boolean(pProfile?.payouts_enabled),
    period_key: cycle.period_key,
    pool_amount_usd: cycle.pool_amount_cents / 100,
    pool_percentage: cycle.pool_percentage,
    recent_shares: recentShares,
    stripe_account_id: pProfile?.stripe_account_id || null,
    stripe_connected: Boolean(pProfile?.stripe_account_id && pProfile?.details_submitted),
    total_platform_pro_uses: totalPlatformUses,
    total_withdrawn_usd: totalWithdrawnCents / 100,
  };
}

export async function createStripeConnectAccountLink(
  userId: number,
  baseUrl: string
): Promise<{ url: string }> {
  const [userRows] = await pool.query<RowDataPacket[]>(
    'SELECT id, username, email, designer_handle, website_url FROM users WHERE id = ? LIMIT 1',
    [userId]
  );

  if (userRows.length === 0) {
    throw new Error('USER_NOT_FOUND');
  }

  const user = userRows[0];

  const [pRows] = await pool.query<RowDataPacket[]>(
    'SELECT stripe_account_id, payout_country FROM designer_payout_profiles WHERE user_id = ? LIMIT 1',
    [userId]
  );

  let stripeAccountId = pRows[0]?.stripe_account_id || null;
  const payoutCountry = pRows[0]?.payout_country || 'US';

  const stripe = new Stripe(config.stripe.secretKey, {
    apiVersion: '2025-02-24.acacia' as any,
  });

  const profileHandle = user.designer_handle ? user.designer_handle.replace(/^@/, '') : user.username;
  const designerUrl = `${baseUrl.replace(/\/$/, '')}/@${profileHandle}`;

  if (!stripeAccountId) {
    const account = await stripe.accounts.create({
      type: 'express',
      country: payoutCountry === 'OTHER' ? 'US' : payoutCountry,
      email: user.email,
      capabilities: {
        transfers: { requested: true },
      },
      business_type: 'individual',
      business_profile: {
        url: designerUrl,
        mcc: '5817',
        product_description: 'Creador y diseñador de plantillas gráficas en Spriteboard',
      },
      individual: {
        email: user.email,
      },
      metadata: {
        userId: String(userId),
        username: user.username,
        designerHandle: user.designer_handle || `@${user.username}`,
      },
    });

    stripeAccountId = account.id;

    await pool.query(
      `INSERT INTO designer_payout_profiles 
        (user_id, stripe_account_id, payout_type, payout_country, payout_currency)
       VALUES (?, ?, 'stripe_connect', ?, 'USD')
       ON DUPLICATE KEY UPDATE 
        stripe_account_id = VALUES(stripe_account_id),
        payout_type = 'stripe_connect',
        updated_at = CURRENT_TIMESTAMP`,
      [userId, stripeAccountId, payoutCountry]
    );

    logger.app.info('Cuenta Stripe Connect Express creada', { stripeAccountId, userId });
  }

  const returnUrl = `${baseUrl}/designer?stripe_connect=success`;
  const refreshUrl = `${baseUrl}/designer?stripe_connect=refresh`;

  const accountLink = await stripe.accountLinks.create({
    account: stripeAccountId,
    refresh_url: refreshUrl,
    return_url: returnUrl,
    type: 'account_onboarding',
  });

  return { url: accountLink.url };
}

export async function syncStripeAccountStatus(userId: number): Promise<{
  details_submitted: boolean;
  payouts_enabled: boolean;
  stripe_account_id: string | null;
}> {
  const [pRows] = await pool.query<RowDataPacket[]>(
    'SELECT stripe_account_id FROM designer_payout_profiles WHERE user_id = ? LIMIT 1',
    [userId]
  );

  const stripeAccountId = pRows[0]?.stripe_account_id || null;
  if (!stripeAccountId) {
    return { details_submitted: false, payouts_enabled: false, stripe_account_id: null };
  }

  try {
    const stripe = new Stripe(config.stripe.secretKey, {
      apiVersion: '2025-02-24.acacia' as any,
    });

    const account = await stripe.accounts.retrieve(stripeAccountId);
    const payoutsEnabled = Boolean(account.payouts_enabled);
    const detailsSubmitted = Boolean(account.details_submitted);

    await pool.query(
      `UPDATE designer_payout_profiles 
       SET payouts_enabled = ?, details_submitted = ? 
       WHERE user_id = ?`,
      [payoutsEnabled, detailsSubmitted, userId]
    );

    return {
      details_submitted: detailsSubmitted,
      payouts_enabled: payoutsEnabled,
      stripe_account_id: stripeAccountId,
    };
  } catch (error) {
    logger.app.warn('Aviso al sincronizar estado de cuenta Stripe Connect', { error, userId });
    return { details_submitted: false, payouts_enabled: false, stripe_account_id: stripeAccountId };
  }
}

export async function requestDesignerPayoutTransfer(userId: number): Promise<{
  amount_usd: number;
  success: boolean;
  transfer_id?: string;
}> {
  const summary = await getDesignerPoolSummary(userId);

  if (!summary.stripe_account_id || !summary.payouts_enabled) {
    throw new Error('STRIPE_NOT_CONFIGURED');
  }

  if (summary.available_balance_usd < 100.0) {
    throw new Error('MINIMUM_PAYOUT_NOT_MET');
  }

  const transferCents = Math.round(summary.available_balance_usd * 100);

  const stripe = new Stripe(config.stripe.secretKey, {
    apiVersion: '2025-02-24.acacia' as any,
  });

  const platformAccount = await stripe.accounts.retrieve();
  const platformCurrency = (platformAccount.default_currency || 'usd').toLowerCase();

  let transferAmount = transferCents;
  let transferCurrency = 'usd';

  if (platformCurrency !== 'usd') {
    const fxRate = platformCurrency === 'mxn' ? 20.0 : 1.0;
    transferAmount = Math.round(transferCents * fxRate);
    transferCurrency = platformCurrency;
  }

  const transfer = await stripe.transfers.create({
    amount: transferAmount,
    currency: transferCurrency,
    destination: summary.stripe_account_id,
    metadata: {
      amountUsd: String(summary.available_balance_usd),
      userId: String(userId),
    },
  });

  await pool.query(
    `UPDATE designer_payout_profiles 
     SET available_balance_cents = available_balance_cents - ?,
         total_withdrawn_cents = total_withdrawn_cents + ? 
     WHERE user_id = ?`,
    [transferCents, transferCents, userId]
  );

  await pool.query(
    `INSERT INTO designer_payout_transfers 
      (designer_id, amount_cents, currency, stripe_transfer_id, status)
     VALUES (?, ?, 'USD', ?, 'completed')`,
    [userId, transferCents, transfer.id]
  );

  logger.app.info('Transferencia de fondos de diseñador ejecutada exitosamente', {
    amountCents: transferCents,
    transferId: transfer.id,
    userId,
  });

  return {
    amount_usd: summary.available_balance_usd,
    success: true,
    transfer_id: transfer.id,
  };
}
