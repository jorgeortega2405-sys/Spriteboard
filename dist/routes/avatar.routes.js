import { Router } from 'express';
import { handleAvatarRequest } from '../controllers/avatar.controller.js';
const router = Router();
router.get('/avatar', handleAvatarRequest);
export default router;
