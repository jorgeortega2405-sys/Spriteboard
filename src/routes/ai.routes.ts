import { AiController } from '../controllers/ai.controller.js';
import { aiChatLimiter } from '../middlewares/rate-limit.middleware.js';
import { Router } from 'express';

const aiRouter = Router();

aiRouter.post('/chat', aiChatLimiter, AiController.chat);
aiRouter.post('/ai/chat', aiChatLimiter, AiController.chat);

export default aiRouter;
