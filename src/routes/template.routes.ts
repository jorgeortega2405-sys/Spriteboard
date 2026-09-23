import { getTemplatesHandler, publishTemplateHandler } from '../controllers/template.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';
import { Router } from 'express';

const router = Router();

router.post('/templates/publish', requireAuth, publishTemplateHandler);
router.get('/templates', getTemplatesHandler);

export default router;
