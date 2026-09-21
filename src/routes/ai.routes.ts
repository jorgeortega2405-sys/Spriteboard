import { AiController } from '../controllers/ai.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';
import { aiChatLimiter } from '../middlewares/rate-limit.middleware.js';
import { Router } from 'express';

const aiRouter = Router();

aiRouter.post('/chat', aiChatLimiter, AiController.chat);
aiRouter.post('/ai/chat', aiChatLimiter, AiController.chat);
aiRouter.post('/chat/feedback', aiChatLimiter, AiController.feedback);
aiRouter.post('/ai/chat/feedback', aiChatLimiter, AiController.feedback);
aiRouter.post('/mindmap', requireAuth, aiChatLimiter, AiController.generateMindMap);
aiRouter.post('/ai/mindmap', requireAuth, aiChatLimiter, AiController.generateMindMap);
aiRouter.post('/doc', requireAuth, aiChatLimiter, AiController.generateDoc);
aiRouter.post('/ai/doc', requireAuth, aiChatLimiter, AiController.generateDoc);
aiRouter.post('/board', requireAuth, aiChatLimiter, AiController.generateBoard);
aiRouter.post('/ai/board', requireAuth, aiChatLimiter, AiController.generateBoard);
aiRouter.post('/presentation', requireAuth, aiChatLimiter, AiController.generatePresentation);
aiRouter.post('/ai/presentation', requireAuth, aiChatLimiter, AiController.generatePresentation);

export default aiRouter;


