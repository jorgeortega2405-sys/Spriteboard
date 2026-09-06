import { getAppConfig, getCsrfToken, getHealth } from '../controllers/config.controller.js';
import { Router } from 'express';

const router = Router();

router.get('/config', getAppConfig);
router.get('/csrf-token', getCsrfToken);
router.get('/health', getHealth);

export default router;
