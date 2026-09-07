import { addCanvasMemberHandler, createCanvasHandler, getCanvasHandler, getCanvasMembersHandler, listCanvases, removeCanvasMemberHandler, searchUsersHandler, syncCanvasHandler, updateCanvasAccessHandler } from '../controllers/canvas.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';
import { Router } from 'express';

const router = Router();

router.get('/canvases', requireAuth, listCanvases);
router.post('/canvases', requireAuth, createCanvasHandler);
router.post('/canvases/sync', syncCanvasHandler);
router.patch('/canvases/:uuid/access', requireAuth, updateCanvasAccessHandler);
router.get('/canvases/:uuid/members', getCanvasMembersHandler);
router.post('/canvases/:uuid/members', requireAuth, addCanvasMemberHandler);
router.delete('/canvases/:uuid/members/:userId', requireAuth, removeCanvasMemberHandler);
router.get('/users/search', requireAuth, searchUsersHandler);
router.get('/canvases/:uuid', getCanvasHandler);

export default router;

