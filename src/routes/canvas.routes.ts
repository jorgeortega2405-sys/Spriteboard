import { addCanvasMemberHandler, addCanvasTeamHandler, createCanvasHandler, getCanvasHandler, getCanvasMembersHandler, getCanvasTeamsHandler, listCanvases, removeCanvasMemberHandler, removeCanvasTeamHandler, searchUsersHandler, syncCanvasHandler, updateCanvasAccessHandler } from '../controllers/canvas.controller.js';
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
router.get('/canvases/:uuid/teams', getCanvasTeamsHandler);
router.post('/canvases/:uuid/teams', requireAuth, addCanvasTeamHandler);
router.delete('/canvases/:uuid/teams/:teamId', requireAuth, removeCanvasTeamHandler);
router.get('/users/search', requireAuth, searchUsersHandler);
router.get('/canvases/:uuid', getCanvasHandler);

export default router;

