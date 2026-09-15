import { handleAvatarRequest } from '../controllers/avatar.controller.js';
import { Router } from 'express';

const router = Router();

router.get('/avatar', handleAvatarRequest);

export default router;
