import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { requireAuth } from '../middlewares/auth.middleware.js';
import {
  handleUpdateAvatar,
  handleDeleteAvatar,
  handleUpdateUsername,
  handleRequestEmailChangeCode,
  handleVerifyEmailChangeCode,
  handleUpdateEmail,
  handleGetPreferences,
  handleUpdatePreferences,
} from '../controllers/settings.controller.js';

const router = Router();

// Configurar multer en memoria para validar tamaño y mimetype de forma segura
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 2 * 1024 * 1024, // 2MB máximo
  },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Formato de imagen no compatible. Usa PNG, JPG o WEBP.'));
    }
  },
});

// Wrapper para capturar errores de multer (como archivo > 2MB)
function uploadAvatarMiddleware(req: Request, res: Response, next: NextFunction) {
  upload.single('avatar')(req, res, (err: any) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        res.status(400).json({ error: 'La imagen supera el límite permitido de 2 MB.' });
        return;
      }
      res.status(400).json({ error: 'Error al procesar el archivo.' });
      return;
    } else if (err) {
      res.status(400).json({ error: err.message || 'Archivo inválido.' });
      return;
    }
    next();
  });
}

import {
  avatarLimiter,
  emailCodeLimiter,
  verifyEmailCodeLimiter,
  updateUsernameLimiter,
} from '../middlewares/rate-limit.middleware.js';

// Todas las rutas de configuración requieren autenticación activa
router.use('/settings', requireAuth);

// Rutas de Avatar protegidas con Rate Limiting
router.post('/settings/avatar', avatarLimiter, uploadAvatarMiddleware, handleUpdateAvatar);
router.delete('/settings/avatar', avatarLimiter, handleDeleteAvatar);
router.post('/settings/avatar/delete', avatarLimiter, handleDeleteAvatar);

// Rutas de Credenciales protegidas con Rate Limiting
router.post('/settings/username', updateUsernameLimiter, handleUpdateUsername);
router.post('/settings/email/request-code', emailCodeLimiter, handleRequestEmailChangeCode);
router.post('/settings/email/verify-code', verifyEmailCodeLimiter, handleVerifyEmailChangeCode);
router.post('/settings/email', verifyEmailCodeLimiter, handleUpdateEmail);

// Rutas de Preferencias
router.get('/settings/preferences', handleGetPreferences);
router.post('/settings/preferences', handleUpdatePreferences);

export default router;
