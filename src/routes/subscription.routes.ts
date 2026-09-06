import { Router } from 'express';
import { getSubscriptions } from '../controllers/subscription.controller.js';

const router = Router();

router.get('/subscriptions', getSubscriptions);

export default router;
