import { downloadLog, getLogContent, getLogFiles } from '../controllers/log.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';
import { Router } from 'express';

const router = Router();

router.use(requireAuth);

router.get('/', getLogFiles);
router.post('/content', getLogContent);
router.get('/download', downloadLog);

export default router;
