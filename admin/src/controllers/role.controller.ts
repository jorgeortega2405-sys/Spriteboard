import { Request, Response } from 'express';
import { getAllRoles, getRolesMatrix } from '../services/role.service.js';
import { logger } from '../services/logger.service.js';

export async function handleGetAllRoles(req: Request, res: Response): Promise<void> {
  try {
    const roles = await getAllRoles();
    res.json(roles);
  } catch (error) {
    logger.app.error('Error al responder lista de roles', error);
    res.status(500).json({ error: 'Ha ocurrido un error al cargar los roles.' });
  }
}

export async function handleGetRolesMatrix(req: Request, res: Response): Promise<void> {
  try {
    const matrix = await getRolesMatrix();
    res.json(matrix);
  } catch (error) {
    logger.app.error('Error al responder matriz de roles y permisos', error);
    res.status(500).json({ error: 'Ha ocurrido un error al cargar la matriz de roles y permisos.' });
  }
}
