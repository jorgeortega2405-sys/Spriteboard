import { createFolderHandler, deleteFolderHandler, getFolderHandler, listFolderCanvasesHandler, listFoldersHandler, moveCanvasHandler, updateFolderHandler } from '../controllers/folder.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';
import { Router } from 'express';

const router = Router();

router.get('/folders', requireAuth, listFoldersHandler);
router.post('/folders', requireAuth, createFolderHandler);
router.get('/folders/:uuid', requireAuth, getFolderHandler);
router.patch('/folders/:uuid', requireAuth, updateFolderHandler);
router.delete('/folders/:uuid', requireAuth, deleteFolderHandler);
router.get('/folders/:uuid/canvases', requireAuth, listFolderCanvasesHandler);
router.put('/canvases/:uuid/move', requireAuth, moveCanvasHandler);
router.patch('/canvases/:uuid/move', requireAuth, moveCanvasHandler);

export default router;
