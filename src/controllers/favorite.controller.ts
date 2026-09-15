import { getCurrentUser } from '../middlewares/auth.middleware.js';
import { getUserFavorites, toggleFavorite } from '../services/favorite.service.js';
import { FavoriteItemType } from '../types/favorite.types.js';
import { sendBadRequest, sendInternalError, sendSuccess, sendUnauthorized } from '../utils/http.util.js';
import { Request, Response } from 'express';

export async function toggleFavoriteHandler(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      sendUnauthorized(res, 'No autorizado.');
      return;
    }

    const itemId = req.body.itemId || req.body.item_id;
    const itemType = req.body.itemType || req.body.item_type;
    if (!itemType || (itemType !== 'canvas' && itemType !== 'template')) {
      sendBadRequest(res, 'Tipo de elemento no válido.');
      return;
    }

    if (!itemId || typeof itemId !== 'string' || itemId.trim().length === 0 || itemId.trim().length > 64) {
      sendBadRequest(res, 'Identificador de elemento no válido.');
      return;
    }

    const result = await toggleFavorite(user.id, itemType as FavoriteItemType, itemId);
    sendSuccess(res, { isFavorite: result.isFavorite, success: true });
  } catch (err) {
    sendInternalError(res, 'Error al alternar favorito en favorite controller', err);
  }
}

export async function getUserFavoritesHandler(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      sendUnauthorized(res, 'No autorizado.');
      return;
    }

    const typeQuery = req.query.type as string | undefined;
    const itemType = (typeQuery === 'canvas' || typeQuery === 'template') ? (typeQuery as FavoriteItemType) : undefined;
    const favorites = await getUserFavorites(user.id, itemType);
    sendSuccess(res, { favorites });
  } catch (err) {
    sendInternalError(res, 'Error al obtener favoritos en favorite controller', err);
  }
}
