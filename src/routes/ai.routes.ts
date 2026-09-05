import { Router } from 'express';
import { AiController } from '../controllers/ai.controller.js';

const aiRouter = Router();

// Endpoint de mensajería con el Asistente de IA
aiRouter.post('/chat', AiController.chat);
aiRouter.post('/ai/chat', AiController.chat);

export default aiRouter;
