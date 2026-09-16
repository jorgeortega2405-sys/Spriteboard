import { createBackup, deleteBackupHandler, downloadBackup, getBackupById, getBackups, getBackupTargets, getSchedule, saveSchedule, triggerSchedule } from '../controllers/backup.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';
import { Router } from 'express';

const router = Router();

router.use(requireAuth);

router.get('/', getBackups);
router.get('/schedule', getSchedule);
router.get('/targets', getBackupTargets);
router.post('/', createBackup);
router.post('/schedule', saveSchedule);
router.post('/schedule/trigger', triggerSchedule);
router.get('/:id/download', downloadBackup);
router.get('/:id', getBackupById);
router.delete('/:id', deleteBackupHandler);

export default router;
