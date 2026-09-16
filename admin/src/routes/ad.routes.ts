import { Router } from 'express';
import { createAdController, createAdvertiserController, deleteAdController, deleteAdvertiserController, getAdByIdController, getAdsByAdvertiserController, getAdvertiserByIdController, getAdvertisersController, getPublicAdsController, toggleAdStatusController, updateAdController, updateAdvertiserController } from '../controllers/ad.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';

const router = Router();

router.get('/public', getPublicAdsController);

router.use(requireAuth);

router.get('/advertisers', getAdvertisersController);
router.post('/advertisers', createAdvertiserController);
router.get('/advertisers/:id', getAdvertiserByIdController);
router.put('/advertisers/:id', updateAdvertiserController);
router.delete('/advertisers/:id', deleteAdvertiserController);

router.get('/advertisers/:id/ads', getAdsByAdvertiserController);
router.post('/advertisers/:id/ads', createAdController);

router.get('/items/:id', getAdByIdController);
router.put('/items/:id', updateAdController);
router.delete('/items/:id', deleteAdController);
router.patch('/items/:id/status', toggleAdStatusController);

export default router;
