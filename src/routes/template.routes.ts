import { getTemplateDetailsHandler, getTemplatesHandler, publishTemplateHandler } from '../controllers/template.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';
import { Router } from 'express';

const router = Router();

router.post('/templates/publish', requireAuth, publishTemplateHandler);
router.get('/templates', getTemplatesHandler);
router.get('/templates/:id', getTemplateDetailsHandler);

export default router;
