import { createBackup, deleteBackupHandler, downloadBackup, getBackupById, getBackups, getBackupTargets } from '../controllers/backup.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';
import { Router } from 'express';

const router = Router();

router.use(requireAuth);

router.get('/', getBackups);
router.get('/targets', getBackupTargets);
router.get('/:id/download', downloadBackup);
router.get('/:id', getBackupById);
router.post('/', createBackup);
router.delete('/:id', deleteBackupHandler);

export default router;
