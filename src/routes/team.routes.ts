import { addTeamMemberHandler, createTeamHandler, deleteTeamHandler, getTeamHandler, listTeamsHandler, removeTeamMemberHandler, updateTeamHandler } from '../controllers/team.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';
import { Router } from 'express';

const router = Router();

router.get('/teams', requireAuth, listTeamsHandler);
router.post('/teams', requireAuth, createTeamHandler);
router.get('/teams/:uuid', requireAuth, getTeamHandler);
router.patch('/teams/:uuid', requireAuth, updateTeamHandler);
router.delete('/teams/:uuid', requireAuth, deleteTeamHandler);
router.post('/teams/:uuid/members', requireAuth, addTeamMemberHandler);
router.delete('/teams/:uuid/members/:userId', requireAuth, removeTeamMemberHandler);

export default router;
