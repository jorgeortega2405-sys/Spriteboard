import { validateCsrf } from '../middlewares/csrf.middleware.js';
import aiRoutes from './ai.routes.js';
import authRoutes from './auth.routes.js';
import avatarRoutes from './avatar.routes.js';
import configRoutes from './config.routes.js';
import settingsRoutes from './settings.routes.js';
import subscriptionRoutes from './subscription.routes.js';
import telemetryRoutes from './telemetry.routes.js';
import { Router } from 'express';

const apiRouter = Router();

apiRouter.use(validateCsrf);

apiRouter.use('/', configRoutes);
apiRouter.use('/', authRoutes);
apiRouter.use('/', avatarRoutes);
apiRouter.use('/', settingsRoutes);
apiRouter.use('/', telemetryRoutes);
apiRouter.use('/', aiRoutes);
apiRouter.use('/', subscriptionRoutes);

export default apiRouter;
