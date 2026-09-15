import { handleDeleteAvatar, handleDisable2FA, handleEnable2FA, handleGenerate2FA, handleGet2FAStatus, handleGetActiveSessions, handleGetPreferences, handleRevokeSession, handleUnlinkGoogle, handleUpdateAvatar, handleUpdateEmail, handleUpdatePassword, handleUpdatePreferences, handleUpdateUsername, handleVerifyCurrentPassword } from '../controllers/settings.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';
import { Router } from 'express';

const router = Router();

router.use('/settings', requireAuth);

router.get('/settings/preferences', handleGetPreferences);
router.post('/settings/preferences', handleUpdatePreferences);

router.post('/settings/username', handleUpdateUsername);
router.post('/settings/email', handleUpdateEmail);
router.post('/settings/google/unlink', handleUnlinkGoogle);

router.post('/settings/password/verify', handleVerifyCurrentPassword);
router.post('/settings/password', handleUpdatePassword);

router.get('/settings/2fa/status', handleGet2FAStatus);
router.post('/settings/2fa/generate', handleGenerate2FA);
router.post('/settings/2fa/enable', handleEnable2FA);
router.post('/settings/2fa/disable', handleDisable2FA);

router.post('/settings/avatar', handleUpdateAvatar);
router.delete('/settings/avatar', handleDeleteAvatar);

router.get('/settings/sessions', handleGetActiveSessions);
router.post('/settings/sessions/revoke', handleRevokeSession);

export default router;
