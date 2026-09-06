import { Router } from 'express';
import {
  getSubscriptions,
  createCheckout,
  verifySession,
  handleWebhook,
  getPurchaseHistory,
  getBillingDetails,
  updateAutoRenewal,
  cancelSubscriptionImmediate,
  getPaymentMethods,
  createSetupIntent,
  setDefaultPaymentMethod,
  deletePaymentMethod,
} from '../controllers/subscription.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';

const router = Router();

// Catálogo de suscripciones
router.get('/subscriptions', getSubscriptions);

// Stripe Checkout y verificación
router.post('/subscriptions/checkout', requireAuth, createCheckout);
router.get('/subscriptions/verify-session', requireAuth, verifySession);
router.get('/subscriptions/history', requireAuth, getPurchaseHistory);

// Gestión de facturación, renovación y cancelación
router.get('/subscriptions/details', requireAuth, getBillingDetails);
router.post('/subscriptions/auto-renewal', requireAuth, updateAutoRenewal);
router.post('/subscriptions/cancel-immediate', requireAuth, cancelSubscriptionImmediate);

// Gestión de métodos de pago
router.get('/subscriptions/payment-methods', requireAuth, getPaymentMethods);
router.post('/subscriptions/setup-intent', requireAuth, createSetupIntent);
router.post('/subscriptions/payment-methods/:id/default', requireAuth, setDefaultPaymentMethod);
router.delete('/subscriptions/payment-methods/:id', requireAuth, deletePaymentMethod);

// Stripe Webhook (Firma HMAC verificada en el controlador)
router.post('/subscriptions/webhook', handleWebhook);

export default router;
