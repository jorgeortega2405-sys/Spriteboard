import { handleAdminDeleteUserAvatar, handleAdminRevokeUserSessions, handleAdminUpdateUserAvatar, handleAdminUpdateUserEmail, handleAdminUpdateUserPreferences, handleAdminUpdateUserUsername, handleApplyUserSanction, handleGetAllRoles, handleGetUserById, handleGetUserManagementData, handleGetUserSanctions, handleGetUsers, handleRevokeUserSanction, handleUpdateUserAccount, handleUpdateUserRoles } from '../controllers/user.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';
import { Router } from 'express';

const router = Router();

router.use(requireAuth);

router.get('/', handleGetUsers);
router.get('/roles/all', handleGetAllRoles);
router.get('/:id/manage', handleGetUserManagementData);
router.get('/:id/sanctions', handleGetUserSanctions);
router.get('/:id', handleGetUserById);
router.put('/:id/roles', handleUpdateUserRoles);
router.put('/:id/account', handleUpdateUserAccount);
router.patch('/:id/username', handleAdminUpdateUserUsername);
router.patch('/:id/email', handleAdminUpdateUserEmail);
router.post('/:id/avatar', handleAdminUpdateUserAvatar);
router.delete('/:id/avatar', handleAdminDeleteUserAvatar);
router.patch('/:id/preferences', handleAdminUpdateUserPreferences);
router.post('/:id/revoke-sessions', handleAdminRevokeUserSessions);
router.post('/:id/sanctions', handleApplyUserSanction);
router.delete('/:id/sanctions/:sanctionId', handleRevokeUserSanction);

export default router;


