import { approveDesignerApplicationHandler, getDesignerApplicationDetailsHandler, getDesignerApplicationMetricsHandler, listDesignerApplicationsHandler, rejectDesignerApplicationHandler } from '../controllers/designer-application.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';
import { Router } from 'express';

const router = Router();

router.use(requireAuth);

router.get('/', listDesignerApplicationsHandler);
router.get('/metrics', getDesignerApplicationMetricsHandler);
router.get('/:id', getDesignerApplicationDetailsHandler);
router.patch('/:id/approve', approveDesignerApplicationHandler);
router.patch('/:id/reject', rejectDesignerApplicationHandler);

export default router;
