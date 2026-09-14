import { pool } from '../config/database.config.js';
import { getFeatureRequiredTier, hasFeatureAccess, normalizeTierKey, type PlanFeatureKey } from '../config/plans.config.js';
import { getCurrentUser } from './auth.middleware.js';
import type { NextFunction, Request, Response } from 'express';
import mysql from 'mysql2/promise';

export function requireFeature(feature: PlanFeatureKey) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const user = getCurrentUser(req);
    if (!user) {
      res.status(401).json({ error: 'No autorizado.' });
      return;
    }

    const userTier = normalizeTierKey(user.subscription_tier);
    if (hasFeatureAccess(userTier, feature)) {
      next();
      return;
    }

    if (feature === 'teams') {
      try {
        const [memberRows] = await pool.query<mysql.RowDataPacket[]>(
          'SELECT tm.id FROM team_members tm INNER JOIN teams t ON tm.team_id = t.id WHERE tm.user_id = ? AND t.team_type = ? LIMIT 1',
          [user.id, 'team']
        );
        if (memberRows.length > 0) {
          next();
          return;
        }
      } catch {}
    }

    const requiredTier = getFeatureRequiredTier(feature);
    res.status(403).json({
      error: 'Esta función requiere un plan superior.',
      requiredTier,
      upgradeRequired: true,
    });
  };
}
