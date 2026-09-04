import { Router } from 'express';
import {
  validateStage1,
  sendRegistrationCode,
  verifyRegistrationCode,
  resendRegistrationCode,
  login,
  logout,
  me,
  redirectToGoogle,
  googleCallback,
  forgotPassword,
  validateResetToken,
  resetPassword,
} from '../controllers/auth.controller.js';
import {
  registerLimiter,
  sendCodeLimiter,
  verifyCodeLimiter,
  loginLimiter,
  forgotPasswordLimiter,
  resetPasswordLimiter,
} from '../middlewares/rate-limit.middleware.js';

const router = Router();

// Rutas de registro multi-etapa protegidas con Rate Limiting
router.post('/register/stage1-validate', registerLimiter, validateStage1);
router.post('/register/send-code', sendCodeLimiter, sendRegistrationCode);
router.post('/register/verify-code', verifyCodeLimiter, verifyRegistrationCode);
router.post('/register/resend-code', sendCodeLimiter, resendRegistrationCode);

// Sesión local y Google OAuth
router.post('/login', loginLimiter, login);
router.post('/logout', logout);
router.get('/me', me);

router.get('/auth/google', redirectToGoogle);
router.get('/auth/google/callback', googleCallback);

// Flujo de recuperación y restablecimiento de contraseña
router.post('/forgot-password', forgotPasswordLimiter, forgotPassword);
router.get('/reset-password/validate', validateResetToken);
router.post('/reset-password', resetPasswordLimiter, resetPassword);

export default router;
