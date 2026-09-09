import { getUserFavoritesHandler, toggleFavoriteHandler } from '../controllers/favorite.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';
import { Router } from 'express';

const router = Router();

router.get('/favorites', requireAuth, getUserFavoritesHandler);
router.post('/favorites/toggle', requireAuth, toggleFavoriteHandler);

export default router;
