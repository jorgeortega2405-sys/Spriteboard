import { handleGetBillingOverview, handleGetBillingTransactions, handleProcessRefund } from '../controllers/billing.controller.js';
import { requireAuth, requirePermission } from '../middlewares/auth.middleware.js';
import { Router } from 'express';

const router = Router();

router.use(requireAuth);

router.get('/overview', requirePermission('billing:read', 'billing:manage'), handleGetBillingOverview);
router.get('/transactions', requirePermission('billing:read', 'billing:manage'), handleGetBillingTransactions);
router.post('/transactions/:id/refund', requirePermission('billing:refund', 'billing:manage'), handleProcessRefund);

export default router;
