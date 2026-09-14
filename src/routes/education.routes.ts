import { addSchoolTeacherHandler, createClassroomHandler, getSchoolHandler, getSchoolStudentsHandler, joinClassroomHandler, listClassroomsHandler, regenerateClassroomCodeHandler, removeSchoolTeacherHandler, updateSchoolHandler } from '../controllers/education.controller.js';
import { assignMemberHandler, createCampusHandler, createFacultyHandler, deleteCampusHandler, deleteFacultyHandler, getUniversityOverviewHandler, listUniversityMembersHandler, removeMemberHandler, updateCampusHandler } from '../controllers/university.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';
import { Router } from 'express';

const router = Router();

router.post('/education/classrooms', requireAuth, createClassroomHandler);
router.get('/education/classrooms', requireAuth, listClassroomsHandler);
router.post('/education/join', requireAuth, joinClassroomHandler);
router.post('/education/classrooms/:uuid/code', requireAuth, regenerateClassroomCodeHandler);
router.get('/education/school', requireAuth, getSchoolHandler);
router.get('/education/school/students', requireAuth, getSchoolStudentsHandler);
router.put('/education/school', requireAuth, updateSchoolHandler);
router.post('/education/school/teachers', requireAuth, addSchoolTeacherHandler);
router.delete('/education/school/teachers/:targetUserId', requireAuth, removeSchoolTeacherHandler);

router.get('/education/university', requireAuth, getUniversityOverviewHandler);
router.post('/education/university/campuses', requireAuth, createCampusHandler);
router.put('/education/university/campuses/:id', requireAuth, updateCampusHandler);
router.delete('/education/university/campuses/:id', requireAuth, deleteCampusHandler);
router.post('/education/university/faculties', requireAuth, createFacultyHandler);
router.delete('/education/university/faculties/:id', requireAuth, deleteFacultyHandler);
router.get('/education/university/members', requireAuth, listUniversityMembersHandler);
router.post('/education/university/members', requireAuth, assignMemberHandler);
router.delete('/education/university/members/:id', requireAuth, removeMemberHandler);

export default router;
