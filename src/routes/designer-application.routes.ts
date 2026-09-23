import { getMyApplicationStatusHandler, submitDesignerApplicationHandler } from '../controllers/designer-application.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';
import { uploadLimiter } from '../middlewares/rate-limit.middleware.js';
import { NextFunction, Request, Response, Router } from 'express';
import multer from 'multer';

const router = Router();

const storage = multer.memoryStorage();
const upload = multer({
  fileFilter: (_req, file, cb) => {
    const allowedPrefixes = ['image/', 'application/pdf', 'application/zip', 'application/x-zip-compressed'];
    const isAllowed = allowedPrefixes.some((p) => file.mimetype.startsWith(p)) ||
      file.originalname.endsWith('.zip') ||
      file.originalname.endsWith('.svg');
    if (isAllowed) {
      cb(null, true);
    } else {
      cb(new Error('Formato de archivo no admitido. Usa imágenes (PNG, JPG, WEBP, GIF, SVG), archivos ZIP o PDF.'));
    }
  },
  limits: {
    fileSize: 25 * 1024 * 1024,
    files: 30,
  },
  storage,
});

function uploadApplicationFilesMiddleware(req: Request, res: Response, next: NextFunction): void {
  upload.array('files', 30)(req, res, (err: any) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        res.status(400).json({ error: 'Uno o más archivos superan el límite de 25 MB por archivo.' });
        return;
      }
      if (err.code === 'LIMIT_FILE_COUNT') {
        res.status(400).json({ error: 'Se permite subir un máximo de 30 archivos por postulación.' });
        return;
      }
      res.status(400).json({ error: 'Error al procesar los archivos enviados.' });
      return;
    } else if (err) {
      res.status(400).json({ error: err.message || 'Error en los archivos adjuntos.' });
      return;
    }
    next();
  });
}

router.get('/designer-applications/my-status', requireAuth, getMyApplicationStatusHandler);
router.post('/designer-applications', requireAuth, uploadLimiter, uploadApplicationFilesMiddleware, submitDesignerApplicationHandler);

export default router;
