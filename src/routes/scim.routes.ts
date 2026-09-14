import { createScimUserHandler, deleteScimUserHandler, getResourceTypesHandler, getSchemasHandler, getScimUserHandler, getServiceProviderConfigHandler, listScimUsersHandler, patchScimUserHandler } from '../controllers/scim.controller.js';
import { requireScimAuth } from '../middlewares/scim.middleware.js';
import { Router } from 'express';

const router = Router();

router.get('/ServiceProviderConfig', getServiceProviderConfigHandler);
router.get('/ResourceTypes', getResourceTypesHandler);
router.get('/Schemas', getSchemasHandler);

router.use(requireScimAuth);

router.get('/Users', listScimUsersHandler);
router.post('/Users', createScimUserHandler);
router.get('/Users/:id', getScimUserHandler);
router.patch('/Users/:id', patchScimUserHandler);
router.put('/Users/:id', patchScimUserHandler);
router.delete('/Users/:id', deleteScimUserHandler);

export default router;
