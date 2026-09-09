import { Router } from 'express';
import { searchHandler } from '../controllers/search.controller.js';

const router = Router();

router.get('/search', searchHandler);

export default router;
