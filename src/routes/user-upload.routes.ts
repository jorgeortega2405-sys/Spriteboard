import { deleteUploadHandler, listUploadsHandler, uploadFilesHandler } from '../controllers/upload.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';
import { uploadLimiter } from '../middlewares/rate-limit.middleware.js';
import { NextFunction, Request, Response, Router } from 'express';
import multer from 'multer';

const router = Router();

const ALLOWED_MIME_TYPES = new Set([
  'image/avif',
  'image/gif',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/svg+xml',
  'image/webp',
  'video/mp4',
  'video/ogg',
  'video/quicktime',
  'video/webm',
  'video/x-m4v',
  'video/x-matroska',
]);

const storage = multer.memoryStorage();
const upload = multer({
  fileFilter: (_req, file, cb) => {
    const mime = (file.mimetype || '').toLowerCase().split(';')[0].trim();
    if (ALLOWED_MIME_TYPES.has(mime)) {
      cb(null, true);
    } else {
      cb(new Error('Formato de archivo no compatible. Formatos admitidos: PNG, JPG, WEBP, GIF, AVIF, SVG, MP4, WebM, MOV.'));
    }
  },
  limits: {
    fileSize: 1024 * 1024 * 1024,
    files: 50,
  },
  storage,
});

function uploadFilesMiddleware(req: Request, res: Response, next: NextFunction) {
  upload.array('files', 50)(req, res, (err: any) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        res.status(400).json({ error: 'El archivo supera el tamaño máximo permitido por el servidor.' });
        return;
      }
      if (err.code === 'LIMIT_FILE_COUNT') {
        res.status(400).json({ error: 'Puedes subir un máximo de 50 archivos a la vez en lote.' });
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
