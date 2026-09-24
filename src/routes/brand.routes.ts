import { addBrandChartHandler, addBrandColorHandler, addBrandTemplateHandler, createBrandKitHandler, deleteBrandAssetHandler, deleteBrandChartHandler, deleteBrandColorHandler, deleteBrandFontHandler, deleteBrandKitHandler, deleteBrandTemplateHandler, duplicateBrandKitHandler, getBrandKitDetailHandler, getBrandKitsHandler, setBrandFontsHandler, setDefaultBrandKitHandler, updateBrandKitHandler, uploadBrandAssetHandler } from '../controllers/brand.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';
import { uploadLimiter } from '../middlewares/rate-limit.middleware.js';
import { requireFeature } from '../middlewares/subscription.middleware.js';
import { NextFunction, Request, Response, Router } from 'express';
import multer from 'multer';

const router = Router();

const storage = multer.memoryStorage();
const upload = multer({
  fileFilter: (_req, file, cb) => {
    const allowed = [
      'image/png',
      'image/jpeg',
      'image/jpg',
      'image/webp',
      'image/gif',
      'image/svg+xml',
      'image/avif',
      'font/woff2',
      'font/woff',
      'font/ttf',
      'font/otf',
      'application/font-woff',
      'application/font-woff2',
      'application/x-font-woff',
      'application/x-font-ttf',
      'application/x-font-truetype',
      'application/x-font-opentype',
      'application/vnd.ms-fontobject',
      'application/octet-stream',
    ];
    const ext = (file.originalname || '').toLowerCase();
    const isFont = /\.(ttf|otf|woff|woff2|eot)$/i.test(ext);
    if (allowed.includes(file.mimetype) || ext.endsWith('.svg') || isFont) {
      cb(null, true);
    } else {
      cb(new Error('Formato no compatible. Usa PNG, JPG, WEBP, SVG o fuentes WOFF2/TTF/OTF.'));
    }
  },
  limits: {
    fileSize: 20 * 1024 * 1024,
    files: 1,
  },
  storage,
});

function brandUploadMiddleware(req: Request, res: Response, next: NextFunction) {
  upload.single('file')(req, res, (err: any) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        res.status(400).json({ error: 'El archivo supera el límite permitido de 20 MB.' });
        return;
      }
      res.status(400).json({ error: 'Error al procesar el archivo enviado.' });
      return;
    } else if (err) {
      res.status(400).json({ error: err.message || 'El archivo enviado no es válido.' });
      return;
    }
    next();
  });
}

router.use('/brand-kits', requireAuth, requireFeature('brand_kits'));

router.get('/brand-kits', getBrandKitsHandler);
router.post('/brand-kits', createBrandKitHandler);

router.get('/brand-kits/:uuid', getBrandKitDetailHandler);
router.patch('/brand-kits/:uuid', updateBrandKitHandler);
router.delete('/brand-kits/:uuid', deleteBrandKitHandler);

router.post('/brand-kits/:uuid/duplicate', duplicateBrandKitHandler);
router.post('/brand-kits/:uuid/default', setDefaultBrandKitHandler);

router.post('/brand-kits/:uuid/colors', addBrandColorHandler);
router.delete('/brand-kits/:uuid/colors/:colorUuid', deleteBrandColorHandler);

router.post('/brand-kits/:uuid/fonts', setBrandFontsHandler);
router.delete('/brand-kits/:uuid/fonts/:fontUuid', deleteBrandFontHandler);

router.post('/brand-kits/:uuid/assets', uploadLimiter, brandUploadMiddleware, uploadBrandAssetHandler);
router.delete('/brand-kits/:uuid/assets/:assetUuid', deleteBrandAssetHandler);

router.post('/brand-kits/:uuid/charts', addBrandChartHandler);
router.delete('/brand-kits/:uuid/charts/:chartUuid', deleteBrandChartHandler);

router.post('/brand-kits/:uuid/templates', addBrandTemplateHandler);
router.delete('/brand-kits/:uuid/templates/:templateUuid', deleteBrandTemplateHandler);

export default router;
