import { addSchoolTeacherHandler, createClassroomHandler, getSchoolHandler, joinClassroomHandler, listClassroomsHandler, regenerateClassroomCodeHandler, removeSchoolTeacherHandler, updateSchoolHandler } from '../controllers/education.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';
import { Router } from 'express';

const router = Router();

router.post('/education/classrooms', requireAuth, createClassroomHandler);
router.get('/education/classrooms', requireAuth, listClassroomsHandler);
router.post('/education/join', requireAuth, joinClassroomHandler);
router.post('/education/classrooms/:uuid/code', requireAuth, regenerateClassroomCodeHandler);
router.get('/education/school', requireAuth, getSchoolHandler);
router.put('/education/school', requireAuth, updateSchoolHandler);
router.post('/education/school/teachers', requireAuth, addSchoolTeacherHandler);
router.delete('/education/school/teachers/:targetUserId', requireAuth, removeSchoolTeacherHandler);

export default router;
