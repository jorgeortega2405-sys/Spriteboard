import { createBackup, deleteBackupHandler, downloadBackup, getBackupById, getBackups, getBackupTargets, getSchedule, saveSchedule, triggerSchedule } from '../controllers/backup.controller.js';
import { requireAuth, requirePermission } from '../middlewares/auth.middleware.js';
import { Router } from 'express';

const router = Router();

router.use(requireAuth);

router.get('/', requirePermission('backups:read', 'backups:manage'), getBackups);
router.get('/schedule', requirePermission('backups:read', 'backups:manage'), getSchedule);
router.get('/targets', requirePermission('backups:read', 'backups:manage'), getBackupTargets);
router.post('/', requirePermission('backups:manage'), createBackup);
router.post('/schedule', requirePermission('backups:manage'), saveSchedule);
router.post('/schedule/trigger', requirePermission('backups:manage'), triggerSchedule);
router.get('/:id/download', requirePermission('backups:manage'), downloadBackup);
router.get('/:id', requirePermission('backups:read', 'backups:manage'), getBackupById);
router.delete('/:id', requirePermission('backups:manage'), deleteBackupHandler);

export default router;
