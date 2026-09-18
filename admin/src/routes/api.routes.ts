import { Router } from 'express';
import { validateCsrf } from '../middlewares/csrf.middleware.js';
import adRoutes from './ad.routes.js';
import aiRoutes from './ai-assistant.routes.js';
import analyticsRoutes from './analytics.routes.js';
import authRoutes from './auth.routes.js';
import avatarRoutes from './avatar.routes.js';
import backupRoutes from './backup.routes.js';
import billingRoutes from './billing.routes.js';
import complianceRoutes from './compliance.routes.js';
import configRoutes from './config.routes.js';
import dashboardRoutes from './dashboard.routes.js';
import internalTicketRoutes from './internal-ticket.routes.js';
import logRoutes from './log.routes.js';
import roleRoutes from './role.routes.js';
import settingsRoutes from './settings.routes.js';
import supportRoutes from './support.routes.js';
import userRoutes from './user.routes.js';
import workflowRoutes from './workflow.routes.js';

const apiRouter = Router();

apiRouter.use(validateCsrf);

apiRouter.use('/', configRoutes);
apiRouter.use('/', authRoutes);
apiRouter.use('/', avatarRoutes);
apiRouter.use('/', settingsRoutes);
apiRouter.use('/ads', adRoutes);
apiRouter.use('/ai', aiRoutes);
apiRouter.use('/analytics', analyticsRoutes);
apiRouter.use('/backups', backupRoutes);
apiRouter.use('/billing', billingRoutes);
apiRouter.use('/compliance', complianceRoutes);
apiRouter.use('/dashboard', dashboardRoutes);
apiRouter.use('/internal-tickets', internalTicketRoutes);
apiRouter.use('/logs', logRoutes);
apiRouter.use('/roles', roleRoutes);
apiRouter.use('/support', supportRoutes);
apiRouter.use('/users', userRoutes);
apiRouter.use('/workflows', workflowRoutes);

export default apiRouter;
