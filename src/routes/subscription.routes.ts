import { cancelSubscriptionImmediate, createCheckout, createSetupIntent, deletePaymentMethod, getBillingDetails, getPaymentMethods, getPurchaseHistory, getSubscriptions, handleWebhook, setDefaultPaymentMethod, updateAutoRenewal, verifySession } from '../controllers/subscription.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';
import { Router } from 'express';

const router = Router();

router.get('/subscriptions', getSubscriptions);

router.post('/subscriptions/checkout', requireAuth, createCheckout);
router.get('/subscriptions/verify-session', requireAuth, verifySession);
router.get('/subscriptions/history', requireAuth, getPurchaseHistory);

router.get('/subscriptions/details', requireAuth, getBillingDetails);
router.post('/subscriptions/auto-renewal', requireAuth, updateAutoRenewal);
router.post('/subscriptions/cancel-immediate', requireAuth, cancelSubscriptionImmediate);

router.get('/subscriptions/payment-methods', requireAuth, getPaymentMethods);
router.post('/subscriptions/setup-intent', requireAuth, createSetupIntent);
router.post('/subscriptions/payment-methods/:id/default', requireAuth, setDefaultPaymentMethod);
router.delete('/subscriptions/payment-methods/:id', requireAuth, deletePaymentMethod);

router.post('/subscriptions/webhook', handleWebhook);

export default router;
