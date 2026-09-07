import { createCanvasHandler, getCanvasHandler, listCanvases, syncCanvasHandler } from '../controllers/canvas.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';
import { Router } from 'express';

const router = Router();

router.get('/canvases', requireAuth, listCanvases);
router.post('/canvases', requireAuth, createCanvasHandler);
router.post('/canvases/sync', requireAuth, syncCanvasHandler);
router.get('/canvases/:uuid', getCanvasHandler);

export default router;
