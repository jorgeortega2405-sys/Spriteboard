import { AiController } from '../controllers/ai.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';
import { aiChatLimiter, uploadLimiter } from '../middlewares/rate-limit.middleware.js';
import { requireFeature } from '../middlewares/subscription.middleware.js';
import { NextFunction, Request, Response, Router } from 'express';
import multer from 'multer';

const aiRouter = Router();

const upload = multer({
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif', 'image/avif'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Formato de imagen no compatible. Usa PNG, JPG, WEBP, GIF o AVIF.'));
    }
  },
  limits: {
    fileSize: 20 * 1024 * 1024,
    files: 1,
  },
  storage: multer.memoryStorage(),
});

function singleImageUploadMiddleware(req: Request, res: Response, next: NextFunction) {
  upload.single('image')(req, res, (err: any) => {
    if (err) {
      res.status(400).json({ error: 'No se pudo procesar la imagen enviada.', success: false });
      return;
    }
    next();
  });
}

aiRouter.post('/chat', aiChatLimiter, AiController.chat);
aiRouter.post('/ai/chat', aiChatLimiter, AiController.chat);
aiRouter.post('/chat/feedback', aiChatLimiter, AiController.feedback);
aiRouter.post('/ai/chat/feedback', aiChatLimiter, AiController.feedback);
aiRouter.post('/mindmap', requireAuth, aiChatLimiter, AiController.generateMindMap);
aiRouter.post('/ai/mindmap', requireAuth, aiChatLimiter, AiController.generateMindMap);
aiRouter.post('/board', requireAuth, aiChatLimiter, AiController.generateBoard);
aiRouter.post('/ai/board', requireAuth, aiChatLimiter, AiController.generateBoard);
aiRouter.post('/presentation', requireAuth, aiChatLimiter, AiController.generatePresentation);
aiRouter.post('/ai/presentation', requireAuth, aiChatLimiter, AiController.generatePresentation);
aiRouter.post('/remove-background', requireAuth, requireFeature('ai_bg_removal'), uploadLimiter, singleImageUploadMiddleware, AiController.removeBackground);
aiRouter.post('/ai/remove-background', requireAuth, requireFeature('ai_bg_removal'), uploadLimiter, singleImageUploadMiddleware, AiController.removeBackground);
aiRouter.post('/studio-chat', requireAuth, aiChatLimiter, AiController.studioChat);
aiRouter.post('/ai/studio-chat', requireAuth, aiChatLimiter, AiController.studioChat);
aiRouter.get('/studio-sessions', requireAuth, AiController.listStudioSessions);
aiRouter.get('/ai/studio-sessions', requireAuth, AiController.listStudioSessions);
aiRouter.get('/studio-sessions/:uuid', requireAuth, AiController.getStudioSession);
aiRouter.get('/ai/studio-sessions/:uuid', requireAuth, AiController.getStudioSession);
aiRouter.post('/studio-sessions', requireAuth, AiController.saveStudioSession);
aiRouter.post('/ai/studio-sessions', requireAuth, AiController.saveStudioSession);
aiRouter.delete('/studio-sessions/:uuid', requireAuth, AiController.deleteStudioSession);
aiRouter.delete('/ai/studio-sessions/:uuid', requireAuth, AiController.deleteStudioSession);
aiRouter.get('/quota', requireAuth, AiController.getQuota);
aiRouter.get('/ai/quota', requireAuth, AiController.getQuota);

export default aiRouter;


