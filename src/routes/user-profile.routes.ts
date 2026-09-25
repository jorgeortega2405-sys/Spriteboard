import { deleteBannerHandler, getPublicProfileHandler, getUserTemplatesHandler, toggleFollowUserHandler, updateBannerHandler } from '../controllers/user-profile.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';
import { avatarLimiter } from '../middlewares/rate-limit.middleware.js';
import { NextFunction, Request, Response, Router } from 'express';
import multer from 'multer';

const router = Router();

const storage = multer.memoryStorage();
const upload = multer({
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Formato de imagen no compatible. Usa PNG, JPG, WEBP o GIF.'));
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
  storage,
});

function uploadBannerMiddleware(req: Request, res: Response, next: NextFunction) {
  upload.single('banner')(req, res, (err: any) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        res.status(400).json({ error: 'La imagen de portada supera el límite permitido de 5 MB.' });
        return;
      }
      res.status(400).json({ error: 'Error al procesar el archivo de portada.' });
      return;
    } else if (err) {
      res.status(400).json({ error: 'El archivo enviado no es válido o no cumple con los requisitos.' });
      return;
    }
    next();
  });
}

router.get('/users/p/:username', getPublicProfileHandler);
router.get('/users/p/:username/templates', getUserTemplatesHandler);
router.post('/users/p/:username/follow', requireAuth, toggleFollowUserHandler);

router.post('/users/banner', requireAuth, avatarLimiter, uploadBannerMiddleware, updateBannerHandler);
router.delete('/users/banner', requireAuth, avatarLimiter, deleteBannerHandler);
router.post('/users/banner/delete', requireAuth, avatarLimiter, deleteBannerHandler);

export default router;
