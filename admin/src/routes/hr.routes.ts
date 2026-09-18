import crypto from 'crypto';
import fs from 'fs';
import multer from 'multer';
import path from 'path';
import { Router } from 'express';
import { handleDownloadDocument, handleGetCareerHistory, handleGetEmployeeDetails, handleGetOrgChart, handleGetTimeOffCalendar, handleHireEmployee, handleListEmployees, handleListTimeOffRequests, handlePromoteEmployee, handleReviewTimeOffRequest, handleSubmitTimeOffRequest, handleUpdateEmployeeStatus, handleUploadDocument } from '../controllers/hr.controller.js';
import { requireAuth, requirePermission } from '../middlewares/auth.middleware.js';

const contractsDir = path.resolve(process.cwd(), 'admin/data/contracts');
if (!fs.existsSync(contractsDir)) {
  fs.mkdirSync(contractsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, contractsDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safeExt = ext || '.pdf';
    const uniqueSuffix = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
    cb(null, `doc-${uniqueSuffix}${safeExt}`);
  },
});

const upload = multer({
  fileFilter: (_req, file, cb) => {
    const allowedMimes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Formato de archivo no soportado. Debe ser un PDF o imagen.'));
    }
  },
  limits: {
    fileSize: 25 * 1024 * 1024,
  },
  storage,
});

const router = Router();

router.use(requireAuth);

router.get('/employees', requirePermission('hr:read', 'hr:manage', 'hr:hire'), handleListEmployees);
router.get('/employees/:id', requirePermission('hr:read', 'hr:manage'), handleGetEmployeeDetails);
router.post('/hire', requirePermission('hr:hire', 'hr:manage'), upload.single('contract_file'), handleHireEmployee);
router.post('/employees/:id/status', requirePermission('hr:manage'), handleUpdateEmployeeStatus);
router.post('/employees/:id/documents', requirePermission('hr:contracts', 'hr:manage'), upload.single('document_file'), handleUploadDocument);
router.get('/documents/:docUuid/download', requirePermission('hr:contracts', 'hr:read'), handleDownloadDocument);

router.get('/org-chart', requirePermission('hr:read', 'hr:manage'), handleGetOrgChart);
router.post('/employees/:id/promotions', requirePermission('hr:manage'), handlePromoteEmployee);
router.get('/employees/:id/career-history', requirePermission('hr:read', 'hr:manage'), handleGetCareerHistory);

router.get('/time-off', requirePermission('hr:read', 'hr:manage'), handleListTimeOffRequests);
router.post('/time-off/request', requirePermission('hr:read', 'hr:manage'), handleSubmitTimeOffRequest);
router.post('/time-off/:id/review', requirePermission('hr:manage'), handleReviewTimeOffRequest);
router.get('/time-off/calendar', requirePermission('hr:read', 'hr:manage'), handleGetTimeOffCalendar);

export default router;
