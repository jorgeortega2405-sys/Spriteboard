import { searchHandler } from '../controllers/search.controller.js';
import { searchLimiter } from '../middlewares/rate-limit.middleware.js';
import { Router } from 'express';

const router = Router();

router.get('/search', searchLimiter, searchHandler);

export default router;
