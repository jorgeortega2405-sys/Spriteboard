import { canvasPool } from '../config/database.config.js';
import { ALL_PRESETS, PresetItem } from '../config/templates.config.js';
import { getCurrentUser } from '../middlewares/auth.middleware.js';
import { AiSearchService, SemanticQueryResult } from '../services/ai-search.service.js';
import { logger } from '../services/logger.service.js';
import { Request, Response } from 'express';
import mysql from 'mysql2/promise';

interface ScoredTemplate {
  template: PresetItem;
  score: number;
}

export async function searchHandler(req: Request, res: Response): Promise<void> {
  try {
    const rawQuery = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    if (!rawQuery) {
      res.json({
        query: '',
        semantic: { category: 'all', intent: '', keywords: [] },
        canvases: [],
        templates: [],
      });
      return;
    }

    const semantic: SemanticQueryResult = await AiSearchService.understandQuery(rawQuery);
    const queryLower = rawQuery.toLowerCase();
    const searchTerms = Array.from(new Set([queryLower, ...(semantic.keywords || []).map((k) => k.toLowerCase())]));

    let matchedCanvases: any[] = [];
    const user = getCurrentUser(req);

    if (user) {
      const terms = searchTerms.slice(0, 5);
      const conditions = terms.map(() => 'c.name LIKE ?').join(' OR ');
      const likeParams = terms.map((term) => `%${term}%`);

      const [rows] = await canvasPool.query<mysql.RowDataPacket[]>(
        `SELECT c.id, c.uuid, c.user_id, c.name, c.width, c.height, c.unit, c.preview_thumbnail,
                c.access_level, c.public_role, c.short_code, c.custom_slug, c.created_at, c.updated_at,
                (uf.id IS NOT NULL) AS is_favorite
         FROM canvases c
         LEFT JOIN db_identity.user_favorites uf
           ON uf.user_id = ? AND uf.item_type = 'canvas' AND uf.item_id = c.uuid
         WHERE c.user_id = ? AND c.deleted_at IS NULL AND (${conditions})
         ORDER BY c.updated_at DESC
         LIMIT 24`,
        [user.id, user.id, ...likeParams]
      );

      matchedCanvases = (rows || [])
        .map((r) => {
          const nameLower = (r.name || '').toLowerCase();
          let score = 0;
          if (nameLower.includes(queryLower)) {
            score += 100;
          }
          for (const term of searchTerms) {
            if (term !== queryLower && nameLower.includes(term)) {
              score += 40;
            }
          }
          return {
            ...r,
            is_favorite: Boolean(r.is_favorite),
            _score: score,
          };
        })
        .filter((c) => c._score > 0)
        .sort((a, b) => b._score - a._score)
        .map(({ _score, ...canvas }) => canvas);
    }

    const scoredTemplates: ScoredTemplate[] = [];

    for (const tmpl of ALL_PRESETS) {
      const nameLower = tmpl.name.toLowerCase();
      const tags = (tmpl.tags || []).map((t) => t.toLowerCase());
      let score = 0;

      if (nameLower.includes(queryLower)) {
        score += 100;
      }

      for (const term of searchTerms) {
        if (tags.some((tag) => tag.includes(term) || term.includes(tag))) {
          score += 60;
        } else if (nameLower.includes(term)) {
          score += 35;
        }
      }

      if (semantic.category !== 'all' && tmpl.categoryKey === semantic.category) {
        score += 20;
      }

      if (score > 0) {
        scoredTemplates.push({ template: tmpl, score });
      }
    }

    scoredTemplates.sort((a, b) => b.score - a.score);
    const matchedTemplates = scoredTemplates.map((item) => item.template);

    res.json({
      query: rawQuery,
      semantic,
      canvases: matchedCanvases,
      templates: matchedTemplates,
    });
  } catch (err) {
    logger.app.error('Error procesando búsqueda unificada', err);
    res.status(500).json({ error: 'Ha ocurrido un error al procesar la búsqueda. Por favor intenta más tarde.' });
  }
}
