import { getCurrentUser } from '../middlewares/auth.middleware.js';
import { logger } from '../services/logger.service.js';
import { assignUniversityMember, createUniversityCampus, createUniversityFaculty, deleteUniversityCampus, deleteUniversityFaculty, getUniversityOverview, listUniversityMembers, removeUniversityMember, updateUniversityCampus } from '../services/university.service.js';
import { Request, Response } from 'express';

export async function getUniversityOverviewHandler(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      res.status(401).json({ error: 'No autorizado.' });
      return;
    }

    const overview = await getUniversityOverview(user.id);
    if (!overview) {
      res.status(404).json({ error: 'No se encontró ninguna institución universitaria vinculada.' });
      return;
    }

    res.json({ ok: true, ...overview });
  } catch (err: any) {
    logger.app.error('Error al consultar estructura universitaria', err);
    res.status(500).json({ error: 'Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde.' });
  }
}

export async function createCampusHandler(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      res.status(401).json({ error: 'No autorizado.' });
      return;
    }

    const { name, code, city } = req.body;
    if (!name || typeof name !== 'string' || !name.trim()) {
      res.status(400).json({ error: 'El nombre de la sede o campus es obligatorio.' });
      return;
    }

    const campus = await createUniversityCampus(user.id, { name: name.trim(), code, city });
    res.status(201).json({ ok: true, campus });
  } catch (err: any) {
    logger.app.error('Error al crear campus universitario', err);
    res.status(400).json({ error: 'Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde.' });
  }
}

export async function updateCampusHandler(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      res.status(401).json({ error: 'No autorizado.' });
      return;
    }

    const campusId = Number(req.params.id);
    const { name, code, city } = req.body;

    await updateUniversityCampus(user.id, campusId, { name, code, city });
    res.json({ ok: true, message: 'Campus actualizado correctamente.' });
  } catch (err: any) {
    logger.app.error('Error al actualizar campus universitario', err);
    res.status(400).json({ error: 'Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde.' });
  }
}

export async function deleteCampusHandler(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      res.status(401).json({ error: 'No autorizado.' });
      return;
    }

    const campusId = Number(req.params.id);
    await deleteUniversityCampus(user.id, campusId);
    res.json({ ok: true, message: 'Campus eliminado correctamente.' });
  } catch (err: any) {
    logger.app.error('Error al eliminar campus universitario', err);
    res.status(400).json({ error: 'Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde.' });
  }
}

export async function createFacultyHandler(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      res.status(401).json({ error: 'No autorizado.' });
      return;
    }

    const { campusId, name, code, deanUserId } = req.body;
    if (!campusId || !name || typeof name !== 'string' || !name.trim()) {
      res.status(400).json({ error: 'El campus y nombre de la facultad son obligatorios.' });
      return;
    }

    const faculty = await createUniversityFaculty(user.id, {
      campusId: Number(campusId),
      name: name.trim(),
      code,
      deanUserId: deanUserId ? Number(deanUserId) : null,
    });

    res.status(201).json({ ok: true, faculty });
  } catch (err: any) {
    logger.app.error('Error al crear facultad universitaria', err);
    res.status(400).json({ error: 'Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde.' });
  }
}

export async function deleteFacultyHandler(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      res.status(401).json({ error: 'No autorizado.' });
      return;
    }

    const facultyId = Number(req.params.id);
    await deleteUniversityFaculty(user.id, facultyId);
    res.json({ ok: true, message: 'Facultad eliminada correctamente.' });
  } catch (err: any) {
    logger.app.error('Error al eliminar facultad universitaria', err);
    res.status(400).json({ error: 'Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde.' });
  }
}

export async function listUniversityMembersHandler(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      res.status(401).json({ error: 'No autorizado.' });
      return;
    }

    const campusId = req.query.campusId ? Number(req.query.campusId) : undefined;
    const facultyId = req.query.facultyId ? Number(req.query.facultyId) : undefined;
    const role = req.query.role as any;
    const search = req.query.search as string;

    const members = await listUniversityMembers(user.id, { campusId, facultyId, role, search });
    res.json({ ok: true, members });
  } catch (err: any) {
    logger.app.error('Error al listar miembros universitarios', err);
    res.status(500).json({ error: 'Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde.' });
  }
}

export async function assignMemberHandler(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      res.status(401).json({ error: 'No autorizado.' });
      return;
    }

    const { targetUserId, campusId, facultyId, academicRole, studentCode } = req.body;
    if (!targetUserId || !academicRole) {
      res.status(400).json({ error: 'El usuario y rol académico son requeridos.' });
      return;
    }

    const member = await assignUniversityMember(user.id, {
      targetUserId: Number(targetUserId),
      campusId: campusId ? Number(campusId) : null,
      facultyId: facultyId ? Number(facultyId) : null,
      academicRole,
      studentCode,
    });

    res.status(201).json({ ok: true, member });
  } catch (err: any) {
    logger.app.error('Error al asignar miembro universitario', err);
    res.status(400).json({ error: 'Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde.' });
  }
}

export async function removeMemberHandler(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      res.status(401).json({ error: 'No autorizado.' });
      return;
    }

    const memberId = Number(req.params.id);
    await removeUniversityMember(user.id, memberId);
    res.json({ ok: true, message: 'Miembro removido de la institución universitaria.' });
  } catch (err: any) {
    logger.app.error('Error al remover miembro universitario', err);
    res.status(400).json({ error: 'Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde.' });
  }
}
