import { checkDesignerHandleHandler, completeDesignerOnboardingHandler, createStripeConnectLinkHandler, getDesignerOnboardingStatusHandler, getDesignerPoolSummaryHandler, requestDesignerPayoutHandler, syncStripeStatusHandler } from '../controllers/designer.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';
import { Router } from 'express';

const router = Router();

router.get('/designer/onboarding-status', requireAuth, getDesignerOnboardingStatusHandler);
router.get('/designer/check-handle', requireAuth, checkDesignerHandleHandler);
router.post('/designer/onboard', requireAuth, completeDesignerOnboardingHandler);
router.get('/designer/pool/summary', requireAuth, getDesignerPoolSummaryHandler);
router.post('/designer/stripe-connect/link', requireAuth, createStripeConnectLinkHandler);
router.get('/designer/stripe-connect/status', requireAuth, syncStripeStatusHandler);
router.post('/designer/payouts/request', requireAuth, requestDesignerPayoutHandler);

export default router;
