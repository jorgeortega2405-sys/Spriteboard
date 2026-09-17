import { createAdController, createAdvertiserController, deleteAdController, deleteAdvertiserController, getAdByIdController, getAdsByAdvertiserController, getAdvertiserByIdController, getAdvertisersController, getPublicAdsController, toggleAdStatusController, updateAdController, updateAdvertiserController } from '../controllers/ad.controller.js';
import { requireAuth, requirePermission } from '../middlewares/auth.middleware.js';
import { Router } from 'express';

const router = Router();

router.get('/public', getPublicAdsController);

router.use(requireAuth);

router.get('/advertisers', requirePermission('ads:read', 'ads:manage'), getAdvertisersController);
router.post('/advertisers', requirePermission('ads:manage'), createAdvertiserController);
router.get('/advertisers/:id', requirePermission('ads:read', 'ads:manage'), getAdvertiserByIdController);
router.put('/advertisers/:id', requirePermission('ads:manage'), updateAdvertiserController);
router.delete('/advertisers/:id', requirePermission('ads:manage'), deleteAdvertiserController);

router.get('/advertisers/:id/ads', requirePermission('ads:read', 'ads:manage'), getAdsByAdvertiserController);
router.post('/advertisers/:id/ads', requirePermission('ads:manage'), createAdController);

router.get('/items/:id', requirePermission('ads:read', 'ads:manage'), getAdByIdController);
router.put('/items/:id', requirePermission('ads:manage'), updateAdController);
router.delete('/items/:id', requirePermission('ads:manage'), deleteAdController);
router.patch('/items/:id/status', requirePermission('ads:manage'), toggleAdStatusController);

export default router;
