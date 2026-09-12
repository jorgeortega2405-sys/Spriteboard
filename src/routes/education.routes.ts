import { addSchoolTeacherHandler, createAssignmentHandler, createClassroomHandler, getSchoolHandler, joinClassroomHandler, listAssignmentsHandler, listClassroomsHandler, regenerateClassroomCodeHandler, startAssignmentHandler, submitAssignmentHandler } from '../controllers/education.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';
import { Router } from 'express';

const router = Router();

router.post('/education/classrooms', requireAuth, createClassroomHandler);
router.get('/education/classrooms', requireAuth, listClassroomsHandler);
router.post('/education/join', requireAuth, joinClassroomHandler);
router.post('/education/classrooms/:uuid/code', requireAuth, regenerateClassroomCodeHandler);
router.post('/education/classrooms/:uuid/assignments', requireAuth, createAssignmentHandler);
router.get('/education/classrooms/:uuid/assignments', requireAuth, listAssignmentsHandler);
router.post('/education/assignments/:uuid/start', requireAuth, startAssignmentHandler);
router.post('/education/assignments/:uuid/submit', requireAuth, submitAssignmentHandler);
router.get('/education/school', requireAuth, getSchoolHandler);
router.post('/education/school/teachers', requireAuth, addSchoolTeacherHandler);

export default router;
