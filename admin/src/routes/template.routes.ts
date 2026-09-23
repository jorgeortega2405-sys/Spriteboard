import { approveTemplateHandler, deleteTemplateHandler, getTemplateDetailsHandler, getTemplateMetricsHandler, listTemplatesHandler, rejectTemplateHandler } from '../controllers/template.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';
import { Router } from 'express';

const router = Router();

router.use(requireAuth);

router.get('/', listTemplatesHandler);
router.get('/metrics', getTemplateMetricsHandler);
router.get('/:id', getTemplateDetailsHandler);
router.patch('/:id/approve', approveTemplateHandler);
router.patch('/:id/reject', rejectTemplateHandler);
router.delete('/:id', deleteTemplateHandler);

export default router;
