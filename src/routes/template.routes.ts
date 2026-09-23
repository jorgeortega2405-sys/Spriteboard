import { deleteMyTemplateHandler, getMyTemplateMetricsHandler, getMyTemplatesHandler, getTemplateDetailsHandler, getTemplatesHandler, publishTemplateHandler, toggleTemplateVisibilityHandler } from '../controllers/template.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';
import { Router } from 'express';

const router = Router();

router.post('/templates/publish', requireAuth, publishTemplateHandler);
router.get('/templates/my', requireAuth, getMyTemplatesHandler);
router.get('/templates/my/metrics', requireAuth, getMyTemplateMetricsHandler);
router.patch('/templates/my/:id/visibility', requireAuth, toggleTemplateVisibilityHandler);
router.delete('/templates/my/:id', requireAuth, deleteMyTemplateHandler);
router.get('/templates', getTemplatesHandler);
router.get('/templates/:id', getTemplateDetailsHandler);

export default router;
