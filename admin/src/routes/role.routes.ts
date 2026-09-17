import { handleGetAllRoles, handleGetRolesMatrix } from '../controllers/role.controller.js';
import { requireAuth, requirePermission } from '../middlewares/auth.middleware.js';
import { Router } from 'express';

const router = Router();

router.use(requireAuth);

router.get('/all', requirePermission('roles:read', 'roles:manage'), handleGetAllRoles);
router.get('/matrix', requirePermission('roles:read', 'roles:manage'), handleGetRolesMatrix);

export default router;
