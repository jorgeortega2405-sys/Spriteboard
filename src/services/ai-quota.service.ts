import { pool } from '../config/database.config.js';
import { getTierLimits } from '../config/plans.config.js';
import { redis } from '../config/redis.config.js';
import { logger } from './logger.service.js';
import mysql from 'mysql2/promise';

export interface UserAiQuotaState {
  cycleResetAt: string | null;
  cycleStartedAt: string | null;
  isIdle: boolean;
  isOverLimit: boolean;
  lastGenerationAt: string | null;
  percentage: number;
  remainingTokens: number;
  resetSecondsRemaining: number;
  secondsRemaining: number;
  tier: string;
  tierName: string;
  tokensLimit: number;
  tokensLimitFormatted: string;
  tokensRemaining: number;
  tokensRemainingFormatted: string;
  tokensUsed: number;
  tokensUsedFormatted: string;
}

export interface FeatureUsageBreakdown {
  board: { count: number; tokens: number };
  doc: { count: number; tokens: number };
  mindmap: { count: number; tokens: number };
  presentation: { count: number; tokens: number };
  totalGenerations: number;
}

const CYCLE_DURATION_HOURS = 12;
const CYCLE_DURATION_MS = CYCLE_DURATION_HOURS * 60 * 60 * 1000;

export class AiQuotaService {
  private static getCacheKey(userId: number): string {
    return `ai_quota:user:${userId}`;
  }

  private static buildQuotaState(
    userTier: string,
    tierLimit: number,
    tokensUsed: number,
    cycleStartedAt: Date | null,
    cycleResetAt: Date | null,
    lastGen: string | null,
    resetSecondsRemaining: number,
    isIdle: boolean
  ): UserAiQuotaState {
    const isOverLimit = tokensUsed >= tierLimit;
    const remainingTokens = Math.max(0, tierLimit - tokensUsed);
    const percentage = Math.min(100, Math.round((tokensUsed / tierLimit) * 100));

    return {
      cycleResetAt: cycleResetAt ? cycleResetAt.toISOString() : null,
      cycleStartedAt: cycleStartedAt ? cycleStartedAt.toISOString() : null,
      isIdle,
      isOverLimit,
      lastGenerationAt: lastGen,
      percentage,
      remainingTokens,
      resetSecondsRemaining,
      secondsRemaining: resetSecondsRemaining,
      tier: userTier,
      tierName: userTier.toUpperCase(),
      tokensLimit: tierLimit,
      tokensLimitFormatted: tierLimit.toLocaleString(),
      tokensRemaining: remainingTokens,
      tokensRemainingFormatted: remainingTokens.toLocaleString(),
      tokensUsed,
      tokensUsedFormatted: tokensUsed.toLocaleString(),
    };
  }

  static async getUserQuota(userId: number, userTier = 'free'): Promise<UserAiQuotaState> {
    const limits = getTierLimits(userTier);
    const tierLimit = limits.maxAiTokensPerCycle || 50000;
    const cacheKey = this.getCacheKey(userId);

    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached) as UserAiQuotaState;
        const now = Date.now();
        if (parsed.cycleResetAt) {
          const resetTime = new Date(parsed.cycleResetAt).getTime();
          if (now < resetTime) {
            const secs = Math.max(0, Math.floor((resetTime - now) / 1000));
            parsed.resetSecondsRemaining = secs;
            parsed.secondsRemaining = secs;
            parsed.tokensLimit = tierLimit;
            parsed.tokensLimitFormatted = tierLimit.toLocaleString();
            parsed.tokensUsed = parsed.tokensUsed || 0;
            parsed.tokensUsedFormatted = (parsed.tokensUsed || 0).toLocaleString();
            parsed.remainingTokens = Math.max(0, tierLimit - parsed.tokensUsed);
            parsed.tokensRemaining = parsed.remainingTokens;
            parsed.tokensRemainingFormatted = parsed.remainingTokens.toLocaleString();
            parsed.percentage = Math.min(100, Math.round((parsed.tokensUsed / tierLimit) * 100));
            parsed.isOverLimit = parsed.tokensUsed >= tierLimit;
            parsed.isIdle = false;
            parsed.tier = userTier;
            parsed.tierName = userTier.toUpperCase();
            return parsed;
          }
        } else {
          parsed.tokensLimit = tierLimit;
          parsed.tokensLimitFormatted = tierLimit.toLocaleString();
          parsed.tokensUsed = parsed.tokensUsed || 0;
          parsed.tokensUsedFormatted = (parsed.tokensUsed || 0).toLocaleString();
          parsed.remainingTokens = Math.max(0, tierLimit - parsed.tokensUsed);
          parsed.tokensRemaining = parsed.remainingTokens;
          parsed.tokensRemainingFormatted = parsed.remainingTokens.toLocaleString();
          parsed.percentage = Math.min(100, Math.round((parsed.tokensUsed / tierLimit) * 100));
          parsed.isOverLimit = parsed.tokensUsed >= tierLimit;
          parsed.isIdle = true;
          parsed.resetSecondsRemaining = 0;
          parsed.secondsRemaining = 0;
          parsed.tier = userTier;
          parsed.tierName = userTier.toUpperCase();
          return parsed;
        }
      }
    } catch (err) {
      logger.db.warn('AiQuotaService: Error al consultar caché Redis', err);
    }

    const [rows] = await pool.query<mysql.RowDataPacket[]>(
      'SELECT tokens_used, tokens_limit, cycle_started_at, cycle_reset_at, last_generation_at FROM user_ai_quotas WHERE user_id = ? LIMIT 1',
      [userId]
    );

    const now = new Date();

    if (rows.length === 0) {
      await pool.query(
        'INSERT IGNORE INTO user_ai_quotas (user_id, tokens_used, tokens_limit, cycle_started_at, cycle_reset_at) VALUES (?, 0, ?, NULL, NULL)',
        [userId, tierLimit]
      );

      const state = this.buildQuotaState(userTier, tierLimit, 0, null, null, null, 0, true);

      await this.saveCache(userId, state, 300);
      return state;
    }

    const row = rows[0];
    let tokensUsed = Number(row.tokens_used) || 0;
    let cycleStartedAt = row.cycle_started_at ? new Date(row.cycle_started_at) : null;
    let cycleResetAt = row.cycle_reset_at ? new Date(row.cycle_reset_at) : null;
    const lastGen = row.last_generation_at ? new Date(row.last_generation_at).toISOString() : null;

    if (cycleResetAt && now.getTime() >= cycleResetAt.getTime()) {
      await pool.query(
        'UPDATE user_ai_quotas SET tokens_used = 0, tokens_limit = ?, cycle_started_at = NULL, cycle_reset_at = NULL WHERE user_id = ?',
        [tierLimit, userId]
      );
      tokensUsed = 0;
      cycleStartedAt = null;
      cycleResetAt = null;
    } else if (Number(row.tokens_limit) !== tierLimit) {
      await pool.query(
        'UPDATE user_ai_quotas SET tokens_limit = ? WHERE user_id = ?',
        [tierLimit, userId]
      );
    }

    const isIdle = !cycleResetAt;
    const resetSecondsRemaining = cycleResetAt ? Math.max(0, Math.floor((cycleResetAt.getTime() - now.getTime()) / 1000)) : 0;

    const state = this.buildQuotaState(
      userTier,
      tierLimit,
      tokensUsed,
      cycleStartedAt,
      cycleResetAt,
      lastGen,
      resetSecondsRemaining,
      isIdle
    );

    const ttl = isIdle ? 300 : Math.max(60, resetSecondsRemaining);
    await this.saveCache(userId, state, ttl);

    return state;
  }

  static async checkQuotaAvailable(
    userId: number,
    userTier = 'free'
  ): Promise<{ allowed: boolean; quota: UserAiQuotaState; reason?: string }> {
    const quota = await this.getUserQuota(userId, userTier);

    if (quota.isOverLimit || quota.remainingTokens <= 0) {
      const hours = Math.floor(quota.resetSecondsRemaining / 3600);
      const minutes = Math.floor((quota.resetSecondsRemaining % 3600) / 60);
      const timeMsg = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;

      return {
        allowed: false,
        quota,
        reason: `Has alcanzado el límite de tu cuota de tokens de IA para este período de 12 horas. Tu cuota se reiniciará en ${timeMsg}. Puedes mejorar tu plan para obtener mayor capacidad.`,
      };
    }

    return {
      allowed: true,
      quota,
    };
  }

  static async recordConsumption(
    userId: number,
    userTier = 'free',
    featureType: 'board' | 'doc' | 'mindmap' | 'presentation',
    promptTokens: number,
    completionTokens: number,
    totalTokens: number,
    modelName = 'gemini-flash-lite-latest'
  ): Promise<UserAiQuotaState> {
    const limits = getTierLimits(userTier);
    const tierLimit = limits.maxAiTokensPerCycle || 50000;
    const safeTotal = Math.max(1, totalTokens || (promptTokens + completionTokens));

    const currentQuota = await this.getUserQuota(userId, userTier);
    const now = new Date();

    let newCycleStarted = currentQuota.cycleStartedAt ? new Date(currentQuota.cycleStartedAt) : null;
    let newCycleReset = currentQuota.cycleResetAt ? new Date(currentQuota.cycleResetAt) : null;

    if (!newCycleStarted || !newCycleReset || now.getTime() >= newCycleReset.getTime()) {
      newCycleStarted = now;
      newCycleReset = new Date(now.getTime() + CYCLE_DURATION_MS);
    }

    const newTokensUsed = currentQuota.tokensUsed + safeTotal;

    await pool.query(
      `INSERT INTO user_ai_quotas (user_id, tokens_used, tokens_limit, cycle_started_at, cycle_reset_at, last_generation_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         tokens_used = ?,
         tokens_limit = ?,
         cycle_started_at = ?,
         cycle_reset_at = ?,
         last_generation_at = ?`,
      [
        userId,
        newTokensUsed,
        tierLimit,
        newCycleStarted,
        newCycleReset,
        now,
        newTokensUsed,
        tierLimit,
        newCycleStarted,
        newCycleReset,
        now,
      ]
    );

    await pool.query(
      `INSERT INTO ai_generation_logs (user_id, feature_type, prompt_tokens, completion_tokens, total_tokens, model_name, status)
       VALUES (?, ?, ?, ?, ?, ?, 'success')`,
      [userId, featureType, promptTokens, completionTokens, safeTotal, modelName]
    );

    const resetSecondsRemaining = Math.max(0, Math.floor((newCycleReset.getTime() - now.getTime()) / 1000));

    const updatedState = this.buildQuotaState(
      userTier,
      tierLimit,
      newTokensUsed,
      newCycleStarted,
      newCycleReset,
      now.toISOString(),
      resetSecondsRemaining,
      false
    );

    await this.saveCache(userId, updatedState, Math.max(60, resetSecondsRemaining));
    logger.db.info(`AiQuotaService: Tokens consumidos por usuario ${userId}: +${safeTotal} tokens (Total ciclo: ${newTokensUsed}/${tierLimit})`);

    return updatedState;
  }

  static async getBreakdown(userId: number): Promise<FeatureUsageBreakdown> {
    const [rows] = await pool.query<mysql.RowDataPacket[]>(
      `SELECT feature_type, COUNT(*) as count, COALESCE(SUM(total_tokens), 0) as tokens
       FROM ai_generation_logs
       WHERE user_id = ?
       GROUP BY feature_type`,
      [userId]
    );

    const breakdown: FeatureUsageBreakdown = {
      board: { count: 0, tokens: 0 },
      doc: { count: 0, tokens: 0 },
      mindmap: { count: 0, tokens: 0 },
      presentation: { count: 0, tokens: 0 },
      totalGenerations: 0,
    };

    for (const r of rows) {
      const type = String(r.feature_type) as 'board' | 'doc' | 'mindmap' | 'presentation';
      if (breakdown[type]) {
        breakdown[type].count = Number(r.count) || 0;
        breakdown[type].tokens = Number(r.tokens) || 0;
        breakdown.totalGenerations += Number(r.count) || 0;
      }
    }

    return breakdown;
  }

  static async resetExpiredCycles(): Promise<number> {
    try {
      const [result] = await pool.query<mysql.ResultSetHeader>(
        `UPDATE user_ai_quotas
         SET tokens_used = 0,
             cycle_started_at = NULL,
             cycle_reset_at = NULL
         WHERE cycle_reset_at IS NOT NULL
           AND cycle_reset_at <= NOW()`
      );

      const affected = result.affectedRows || 0;
      if (affected > 0) {
        logger.db.info(`AiQuotaService: Se reiniciaron ${affected} ciclos de cuota IA expirados.`);
      }
      return affected;
    } catch (err) {
      logger.db.error('AiQuotaService: Error al reiniciar ciclos expirados', err);
      return 0;
    }
  }

  private static async saveCache(userId: number, state: UserAiQuotaState, ttlSeconds: number): Promise<void> {
    try {
      const key = this.getCacheKey(userId);
      await redis.set(key, JSON.stringify(state), 'EX', Math.max(30, ttlSeconds));
    } catch (err) {
      logger.db.warn('AiQuotaService: Error al guardar estado en Redis', err);
    }
  }
}

export default AiQuotaService;
