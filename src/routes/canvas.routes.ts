import { createCommentHandler, deleteCommentHandler, listCommentsHandler, updateCommentHandler } from '../controllers/canvas-comment.controller.js';
import { createSnapshotHandler, deleteSnapshotHandler, forkSnapshotHandler, getSnapshotDataHandler, listSnapshotsHandler, restoreSnapshotHandler, updateSnapshotHandler } from '../controllers/canvas-snapshot.controller.js';
import { addCanvasMemberHandler, addCanvasTeamHandler, createCanvasHandler, deleteCanvasHandler, duplicateCanvasHandler, emptyTrashHandler, getCanvasHandler, getCanvasMembersHandler, getCanvasMetricsHandler, getCanvasTeamsHandler, getCanvasTokenHandler, heartbeatCanvasViewHandler, listCanvases, listSharedCanvases, listTrashCanvases, permanentlyDeleteCanvasHandler, recordCanvasViewHandler, removeCanvasMemberHandler, removeCanvasTeamHandler, resolveCanvasSlugHandler, restoreCanvasHandler, searchUsersHandler, syncCanvasHandler, updateCanvasAccessHandler, updateCanvasSlugHandler } from '../controllers/canvas.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';
import { canvasHeartbeatLimiter, canvasViewLimiter } from '../middlewares/rate-limit.middleware.js';
import { Router } from 'express';

const router = Router();

router.get('/canvases', requireAuth, listCanvases);
router.get('/canvases/shared', requireAuth, listSharedCanvases);
router.post('/canvases', requireAuth, createCanvasHandler);
router.post('/canvases/sync', syncCanvasHandler);
router.patch('/canvases/:uuid/access', requireAuth, updateCanvasAccessHandler);
router.patch('/canvases/:uuid/slug', requireAuth, updateCanvasSlugHandler);
router.get('/canvases/resolve-slug/:slug', resolveCanvasSlugHandler);
router.get('/canvases/:uuid/members', getCanvasMembersHandler);
router.post('/canvases/:uuid/members', requireAuth, addCanvasMemberHandler);
router.delete('/canvases/:uuid/members/:userId', requireAuth, removeCanvasMemberHandler);
router.get('/canvases/:uuid/teams', getCanvasTeamsHandler);
router.post('/canvases/:uuid/teams', requireAuth, addCanvasTeamHandler);
router.delete('/canvases/:uuid/teams/:teamId', requireAuth, removeCanvasTeamHandler);
router.get('/users/search', requireAuth, searchUsersHandler);
router.delete('/canvases/:uuid', requireAuth, deleteCanvasHandler);
router.post('/canvases/:uuid/duplicate', requireAuth, duplicateCanvasHandler);
router.get('/trash', requireAuth, listTrashCanvases);
router.post('/trash/:uuid/restore', requireAuth, restoreCanvasHandler);
router.delete('/trash/empty', requireAuth, emptyTrashHandler);
router.delete('/trash/:uuid', requireAuth, permanentlyDeleteCanvasHandler);
router.get('/canvases/:uuid/metrics', requireAuth, getCanvasMetricsHandler);
router.post('/canvases/:uuid/views', canvasViewLimiter, recordCanvasViewHandler);
router.post('/canvases/:uuid/views/heartbeat', canvasHeartbeatLimiter, heartbeatCanvasViewHandler);
router.get('/canvases/:uuid/token', getCanvasTokenHandler);
router.get('/canvases/:uuid/snapshots', listSnapshotsHandler);
router.post('/canvases/:uuid/snapshots', createSnapshotHandler);
router.get('/canvases/:uuid/snapshots/:snapshotUuid', getSnapshotDataHandler);
router.post('/canvases/:uuid/snapshots/:snapshotUuid/restore', requireAuth, restoreSnapshotHandler);
router.post('/canvases/:uuid/snapshots/:snapshotUuid/fork', requireAuth, forkSnapshotHandler);
router.patch('/canvases/:uuid/snapshots/:snapshotUuid', requireAuth, updateSnapshotHandler);
router.delete('/canvases/:uuid/snapshots/:snapshotUuid', requireAuth, deleteSnapshotHandler);
router.get('/canvases/:uuid/comments', listCommentsHandler);
router.post('/canvases/:uuid/comments', requireAuth, createCommentHandler);
router.patch('/canvases/:uuid/comments/:commentUuid', requireAuth, updateCommentHandler);
router.delete('/canvases/:uuid/comments/:commentUuid', requireAuth, deleteCommentHandler);
router.get('/canvases/:uuid', getCanvasHandler);

export default router;


