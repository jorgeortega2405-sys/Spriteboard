import { handleAiAssistantChat } from '../controllers/ai-assistant.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';
import { Router } from 'express';

const router = Router();

router.use(requireAuth);

router.post('/chat', handleAiAssistantChat);

export default router;
