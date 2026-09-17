import { handleGetWorkflowJobHistory, handleGetWorkflowJobs, handleGetWorkflowOverview, handleTriggerWorkflowJob } from '../controllers/workflow.controller.js';
import { requireAuth, requirePermission } from '../middlewares/auth.middleware.js';
import { Router } from 'express';

const router = Router();

router.use(requireAuth);

router.get('/overview', requirePermission('workflows:read', 'workflows:manage'), handleGetWorkflowOverview);
router.get('/jobs', requirePermission('workflows:read', 'workflows:manage'), handleGetWorkflowJobs);
router.get('/jobs/:id/history', requirePermission('workflows:read', 'workflows:manage'), handleGetWorkflowJobHistory);
router.post('/jobs/:id/trigger', requirePermission('workflows:manage'), handleTriggerWorkflowJob);

export default router;
