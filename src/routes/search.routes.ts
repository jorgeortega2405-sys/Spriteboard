import { searchHandler } from '../controllers/search.controller.js';
import { Router } from 'express';

const router = Router();

router.get('/search', searchHandler);

export default router;
