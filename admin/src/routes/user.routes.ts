import { handleAdminDeleteUserAvatar, handleAdminRevokeUserSessions, handleAdminUpdateUserAvatar, handleAdminUpdateUserEmail, handleAdminUpdateUserPreferences, handleAdminUpdateUserUsername, handleApplyUserSanction, handleGetAllRoles, handleGetUserById, handleGetUserManagementData, handleGetUserSanctions, handleGetUsers, handleRevokeUserSanction, handleUpdateUserAccount, handleUpdateUserRoles } from '../controllers/user.controller.js';
import { requireAuth, requirePermission } from '../middlewares/auth.middleware.js';
import { Router } from 'express';

const router = Router();

router.use(requireAuth);

router.get('/', requirePermission('users:read'), handleGetUsers);
router.get('/roles/all', requirePermission('users:read', 'roles:read'), handleGetAllRoles);
router.get('/:id/manage', requirePermission('users:read'), handleGetUserManagementData);
router.get('/:id/sanctions', requirePermission('users:read', 'users:sanctions'), handleGetUserSanctions);
router.get('/:id', requirePermission('users:read'), handleGetUserById);
router.put('/:id/roles', requirePermission('roles:manage', 'users:manage'), handleUpdateUserRoles);
router.put('/:id/account', requirePermission('users:manage'), handleUpdateUserAccount);
router.patch('/:id/username', requirePermission('users:manage'), handleAdminUpdateUserUsername);
router.patch('/:id/email', requirePermission('users:manage'), handleAdminUpdateUserEmail);
router.post('/:id/avatar', requirePermission('users:manage'), handleAdminUpdateUserAvatar);
router.delete('/:id/avatar', requirePermission('users:manage'), handleAdminDeleteUserAvatar);
router.patch('/:id/preferences', requirePermission('users:manage'), handleAdminUpdateUserPreferences);
router.post('/:id/revoke-sessions', requirePermission('users:manage'), handleAdminRevokeUserSessions);
router.post('/:id/sanctions', requirePermission('users:sanctions'), handleApplyUserSanction);
router.delete('/:id/sanctions/:sanctionId', requirePermission('users:sanctions'), handleRevokeUserSanction);

export default router;


