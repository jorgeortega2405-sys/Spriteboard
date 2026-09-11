import { Router } from 'express';
import { deleteNotificationHandler, listNotificationsHandler, markAllReadHandler, markReadHandler } from '../controllers/notification.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';

const router = Router();

router.get('/notifications', requireAuth, listNotificationsHandler);
router.patch('/notifications/:id/read', requireAuth, markReadHandler);
router.post('/notifications/mark-all-read', requireAuth, markAllReadHandler);
router.delete('/notifications/:id', requireAuth, deleteNotificationHandler);

export default router;
