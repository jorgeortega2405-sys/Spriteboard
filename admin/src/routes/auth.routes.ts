import { Router } from 'express';
import { googleAuth, googleAuthCallback, login, logout, logoutAll, me, switchAccount, verify2FALogin } from '../controllers/auth.controller.js';
import { loginLimiter } from '../middlewares/rate-limit.middleware.js';

const router = Router();

router.post('/login', loginLimiter, login);
router.post('/login/verify-2fa', loginLimiter, verify2FALogin);
router.get('/auth/google', googleAuth);
router.get('/auth/google/callback', googleAuthCallback);
router.post('/logout', logout);
router.post('/logout-all', logoutAll);
router.post('/auth/logout-all', logoutAll);
router.post('/switch-account', switchAccount);
router.post('/auth/switch-account', switchAccount);
router.get('/me', me);

export default router;
