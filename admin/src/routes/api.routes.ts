import authRoutes from './auth.routes.js';
import avatarRoutes from './avatar.routes.js';
import backupRoutes from './backup.routes.js';
import configRoutes from './config.routes.js';
import settingsRoutes from './settings.routes.js';
import userRoutes from './user.routes.js';
import { Router } from 'express';
import { validateCsrf } from '../middlewares/csrf.middleware.js';

const apiRouter = Router();

apiRouter.use(validateCsrf);

apiRouter.use('/', configRoutes);
apiRouter.use('/', authRoutes);
apiRouter.use('/', avatarRoutes);
apiRouter.use('/', settingsRoutes);
apiRouter.use('/backups', backupRoutes);
apiRouter.use('/users', userRoutes);

export default apiRouter;
