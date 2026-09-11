import { validateCsrf } from '../middlewares/csrf.middleware.js';
import aiRoutes from './ai.routes.js';
import authRoutes from './auth.routes.js';
import avatarRoutes from './avatar.routes.js';
import canvasRoutes from './canvas.routes.js';
import configRoutes from './config.routes.js';
import favoriteRoutes from './favorite.routes.js';
import folderRoutes from './folder.routes.js';
import notificationRoutes from './notification.routes.js';
import searchRoutes from './search.routes.js';
import settingsRoutes from './settings.routes.js';
import subscriptionRoutes from './subscription.routes.js';
import teamRoutes from './team.routes.js';
import telemetryRoutes from './telemetry.routes.js';
import { Router } from 'express';

const apiRouter = Router();

apiRouter.use(validateCsrf);

apiRouter.use('/', configRoutes);
apiRouter.use('/', authRoutes);
apiRouter.use('/', avatarRoutes);
apiRouter.use('/', canvasRoutes);
apiRouter.use('/', favoriteRoutes);
apiRouter.use('/', folderRoutes);
apiRouter.use('/', notificationRoutes);
apiRouter.use('/', searchRoutes);
apiRouter.use('/', settingsRoutes);
apiRouter.use('/', teamRoutes);
apiRouter.use('/', telemetryRoutes);
apiRouter.use('/', aiRoutes);
apiRouter.use('/', subscriptionRoutes);

export default apiRouter;
