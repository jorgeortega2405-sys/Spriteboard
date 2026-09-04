import { Router } from 'express';
import authRoutes from './auth.routes.js';
import avatarRoutes from './avatar.routes.js';
import configRoutes from './config.routes.js';
import settingsRoutes from './settings.routes.js';
import telemetryRoutes from './telemetry.routes.js';
import { validateCsrf } from '../middlewares/csrf.middleware.js';

const apiRouter = Router();

// Middleware CSRF para mutaciones en /api
apiRouter.use(validateCsrf);

// Montar subrutas de la API
apiRouter.use('/', configRoutes);
apiRouter.use('/', authRoutes);
apiRouter.use('/', avatarRoutes);
apiRouter.use('/', settingsRoutes);
apiRouter.use('/', telemetryRoutes);

export default apiRouter;

