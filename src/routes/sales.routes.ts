import { submitSalesInquiryHandler } from '../controllers/sales.controller.js';
import { createRateLimiter, getUserOrIpKey } from '../middlewares/rate-limit.middleware.js';
import { Router } from 'express';

const salesInquiryLimiter = createRateLimiter({
  keyGenerator: getUserOrIpKey,
  max: 10,
  message: 'Has enviado demasiadas solicitudes de contacto. Por favor intenta más tarde.',
  prefix: 'sales-inquiry',
  windowMs: 15 * 60 * 1000,
});

const router = Router();

router.post('/sales/inquiry', salesInquiryLimiter, submitSalesInquiryHandler);

export default router;
