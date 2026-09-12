import { getCurrentUser } from '../middlewares/auth.middleware.js';
import { getUserFavorites, toggleFavorite } from '../services/favorite.service.js';
import { logger } from '../services/logger.service.js';
import { FavoriteItemType } from '../types/favorite.types.js';
import { Request, Response } from 'express';

export async function toggleFavoriteHandler(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      res.status(401).json({ error: 'No autorizado.' });
      return;
    }

    const itemId = req.body.itemId || req.body.item_id;
    const itemType = req.body.itemType || req.body.item_type;
    if (!itemType || (itemType !== 'canvas' && itemType !== 'template')) {
      res.status(400).json({ error: 'Tipo de elemento no válido.' });
      return;
    }

    if (!itemId || typeof itemId !== 'string' || itemId.trim().length === 0 || itemId.trim().length > 64) {
      res.status(400).json({ error: 'Identificador de elemento no válido.' });
      return;
    }

    const result = await toggleFavorite(user.id, itemType as FavoriteItemType, itemId);
    res.json({ isFavorite: result.isFavorite, success: true });
  } catch (err) {
    logger.app.error('Error al alternar favorito en favorite controller', err);
    res.status(500).json({ error: 'Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde.' });
  }
}

export async function getUserFavoritesHandler(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      res.status(401).json({ error: 'No autorizado.' });
      return;
    }

    const typeQuery = req.query.type as string | undefined;
    const itemType = (typeQuery === 'canvas' || typeQuery === 'template') ? (typeQuery as FavoriteItemType) : undefined;
    const favorites = await getUserFavorites(user.id, itemType);
    res.json({ favorites });
  } catch (err) {
    logger.app.error('Error al obtener favoritos en favorite controller', err);
    res.status(500).json({ error: 'Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde.' });
  }
}
