import { createDesignerElementHandler, deleteDesignerElementHandler, getDesignerElementMetricsHandler, getDesignerElementsHandler, getElementByUuidHandler, getElementCategoriesHandler, getElementsHandler, updateDesignerElementHandler, useElementHandler } from '../controllers/element.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';
import { Router } from 'express';
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
]);

const storage = multer.memoryStorage();
const upload = multer({
  fileFilter: (_req, file, cb) => {
    const mime = (file.mimetype || '').toLowerCase().split(';')[0].trim();
    if (ALLOWED_MIME_TYPES.has(mime)) {
      cb(null, true);
    } else {
      cb(new Error('Formato de archivo no compatible. Formatos admitidos: SVG, PNG, WEBP, JPG, GIF, AVIF.'));
    }
  },
  limits: {
    fileSize: 25 * 1024 * 1024,
    files: 1,
  },
  storage,
});

router.get('/elements', getElementsHandler);
router.get('/elements/categories', getElementCategoriesHandler);
router.get('/elements/:uuid', getElementByUuidHandler);
router.post('/elements/:uuid/use', useElementHandler);

router.get('/designer/elements', requireAuth, getDesignerElementsHandler);
router.get('/designer/elements/metrics', requireAuth, getDesignerElementMetricsHandler);
router.post('/designer/elements', requireAuth, upload.single('file'), createDesignerElementHandler);
router.put('/designer/elements/:uuid', requireAuth, updateDesignerElementHandler);
router.delete('/designer/elements/:uuid', requireAuth, deleteDesignerElementHandler);

export default router;
