import { downloadExportedVideoHandler, exportVideoHandler, generateSubtitlesHandler, getExportStatusHandler } from '../controllers/video.controller.js';
import { Router } from 'express';

const router = Router();

router.post('/video/export', exportVideoHandler);
router.get('/video/export/status/:jobId', getExportStatusHandler);
router.get('/video/export/download/:jobId', downloadExportedVideoHandler);
router.post('/video/subtitles/generate', generateSubtitlesHandler);

export default router;
