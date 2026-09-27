import { logger } from '../services/logger.service.js';
import { Request, Response, Router } from 'express';
import fs from 'fs';
import path from 'path';

const downloadRouter = Router();

downloadRouter.get('/windows', (_req: Request, res: Response): void => {
  const installerPath = path.resolve(process.cwd(), 'dist', 'installers', 'Spriteboard Setup 1.0.0.exe');

  if (!fs.existsSync(installerPath)) {
    logger.app.warn('Solicitud de descarga de Windows rechazada: El instalador no existe en dist/installers');
    res.status(404).json({
      error: 'El instalador no se encuentra disponible en este momento. Por favor intenta más tarde.',
    });
    return;
  }

  res.download(installerPath, 'Spriteboard-Setup.exe', (err) => {
    if (err && !res.headersSent) {
      logger.app.error('Error al transmitir el instalador de Windows', err);
      res.status(500).json({
        error: 'Ha ocurrido un error inesperado al procesar la descarga. Por favor intenta más tarde.',
      });
    }
  });
});

export default downloadRouter;
