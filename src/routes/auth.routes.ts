import { forgotPassword, googleCallback, login, logout, logoutAll, me, redirectToGoogle, redirectToGoogleLink, redirectToGoogleVerify, resetPassword, resendRegistrationCode, sendRegistrationCode, switchAccount, validateResetToken, validateStage1, verify2FALogin, verifyRegistrationCode } from '../controllers/auth.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';
import { forgotPasswordLimiter, loginLimiter, registerLimiter, resetPasswordLimiter, sendCodeLimiter, verifyCodeLimiter } from '../middlewares/rate-limit.middleware.js';
import { Router } from 'express';

const router = Router();

router.post('/register/stage1-validate', registerLimiter, validateStage1);
router.post('/register/send-code', sendCodeLimiter, sendRegistrationCode);
router.post('/register/verify-code', verifyCodeLimiter, verifyRegistrationCode);
router.post('/register/resend-code', sendCodeLimiter, resendRegistrationCode);

router.post('/login', loginLimiter, login);
router.post('/login/verify-2fa', loginLimiter, verify2FALogin);
router.post('/logout', logout);
router.post('/logout-all', logoutAll);
router.post('/auth/logout-all', logoutAll);
router.post('/auth/switch-account', switchAccount);
router.post('/switch-account', switchAccount);
router.get('/me', me);

router.get('/auth/google', redirectToGoogle);
router.get('/auth/google/link', requireAuth, redirectToGoogleLink);
router.get('/auth/google/verify', requireAuth, redirectToGoogleVerify);
router.get('/auth/google/callback', googleCallback);

router.post('/forgot-password', forgotPasswordLimiter, forgotPassword);
router.get('/reset-password/validate', validateResetToken);
router.post('/reset-password', resetPasswordLimiter, resetPassword);

export default router;
