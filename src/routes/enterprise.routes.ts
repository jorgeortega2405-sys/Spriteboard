import { checkDomainSsoHandler, getSpMetadataHandler, initiateSamlLoginHandler, samlCallbackHandler } from '../controllers/sso.controller.js';
import { generateScimTokenHandler, getTenantConfigHandler, revokeScimTokenHandler, updateTenantConfigHandler } from '../controllers/tenant.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';
import { Router } from 'express';

const router = Router();

router.get('/auth/sso/check-domain', checkDomainSsoHandler);
router.get('/auth/sso/login', initiateSamlLoginHandler);
router.get('/auth/sso/saml/login/:tenantUuid', initiateSamlLoginHandler);
router.post('/auth/sso/saml/callback', samlCallbackHandler);
router.get('/auth/sso/saml/metadata/:tenantUuid', getSpMetadataHandler);

router.get('/enterprise/config', requireAuth, getTenantConfigHandler);
router.post('/enterprise/config', requireAuth, updateTenantConfigHandler);
router.post('/enterprise/scim/token', requireAuth, generateScimTokenHandler);
router.delete('/enterprise/scim/token', requireAuth, revokeScimTokenHandler);

export default router;
