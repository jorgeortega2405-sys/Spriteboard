import { Router } from 'express';
import { AiController } from '../controllers/ai.controller.js';
import { aiChatLimiter } from '../middlewares/rate-limit.middleware.js';

const aiRouter = Router();

// Endpoint de mensajería con el Asistente de IA protegido con Rate Limiting
aiRouter.post('/chat', aiChatLimiter, AiController.chat);
aiRouter.post('/ai/chat', aiChatLimiter, AiController.chat);

export default aiRouter;
