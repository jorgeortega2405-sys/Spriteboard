import { addTeamMemberHandler, createTeamHandler, deleteTeamHandler, getTeamCanvasesHandler, getTeamHandler, listTeamsHandler, removeTeamMemberHandler, updateTeamHandler } from '../controllers/team.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';
import { requireFeature } from '../middlewares/subscription.middleware.js';
import { Router } from 'express';

const router = Router();

router.get('/teams', requireAuth, requireFeature('teams'), listTeamsHandler);
router.post('/teams', requireAuth, requireFeature('teams'), createTeamHandler);
router.get('/teams/:uuid', requireAuth, requireFeature('teams'), getTeamHandler);
router.get('/teams/:uuid/canvases', requireAuth, requireFeature('teams'), getTeamCanvasesHandler);
router.patch('/teams/:uuid', requireAuth, requireFeature('teams'), updateTeamHandler);
router.delete('/teams/:uuid', requireAuth, requireFeature('teams'), deleteTeamHandler);
router.post('/teams/:uuid/members', requireAuth, requireFeature('teams'), addTeamMemberHandler);
router.delete('/teams/:uuid/members/:userId', requireAuth, requireFeature('teams'), removeTeamMemberHandler);

export default router;
