import { deleteUploadHandler, listUploadsHandler, uploadFilesHandler } from '../controllers/upload.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';
import { uploadLimiter } from '../middlewares/rate-limit.middleware.js';
import { NextFunction, Request, Response, Router } from 'express';
import multer from 'multer';

const router = Router();

const storage = multer.memoryStorage();
const upload = multer({
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif', 'image/avif'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Formato de imagen no compatible. Usa PNG, JPG, WEBP, GIF o AVIF.'));
    }
  },
  limits: {
    fileSize: 15 * 1024 * 1024,
    files: 10,
  },
  storage,
});

function uploadFilesMiddleware(req: Request, res: Response, next: NextFunction) {
  upload.array('files', 10)(req, res, (err: any) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        res.status(400).json({ error: 'La imagen supera el límite permitido de 15 MB por archivo.' });
        return;
      }
      if (err.code === 'LIMIT_FILE_COUNT') {
        res.status(400).json({ error: 'Puedes subir un máximo de 10 imágenes a la vez.' });
        return;
      }
      res.status(400).json({ error: 'Error al procesar los archivos enviados.' });
      return;
    } else if (err) {
      res.status(400).json({ error: err.message || 'El archivo enviado no es válido o no cumple con los requisitos.' });
      return;
    }
    next();
  });
}

router.use('/uploads', requireAuth);

router.get('/uploads', listUploadsHandler);
router.post('/uploads', uploadLimiter, uploadFilesMiddleware, uploadFilesHandler);
router.delete('/uploads/:uuid', deleteUploadHandler);

export default router;
