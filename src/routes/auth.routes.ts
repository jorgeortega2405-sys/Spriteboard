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
} from '../controllers/auth.controller.js';

const router = Router();

// Rutas de registro multi-etapa
router.post('/register/stage1-validate', validateStage1);
router.post('/register/send-code', sendRegistrationCode);
router.post('/register/verify-code', verifyRegistrationCode);
router.post('/register/resend-code', resendRegistrationCode);

// Sesión local y Google OAuth
router.post('/login', login);
router.post('/logout', logout);
router.get('/me', me);

router.get('/auth/google', redirectToGoogle);
router.get('/auth/google/callback', googleCallback);

export default router;
