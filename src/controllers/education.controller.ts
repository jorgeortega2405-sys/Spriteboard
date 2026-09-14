import { getCurrentUser } from '../middlewares/auth.middleware.js';
import { addSchoolTeacher, createClassroom, getSchoolOrganization, getSchoolStudents, getUserClassrooms, joinClassroomByCode, regenerateClassroomCode, removeSchoolTeacher, updateSchoolOrganization } from '../services/education.service.js';
import { logger } from '../services/logger.service.js';
import { Request, Response } from 'express';

export async function createClassroomHandler(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      res.status(401).json({ error: 'No autorizado.' });
      return;
    }

    const { name, description, color, schoolId } = req.body;
    if (!name || typeof name !== 'string' || !name.trim()) {
      res.status(400).json({ error: 'El nombre del aula es obligatorio.' });
      return;
    }

    const classroom = await createClassroom(user.id, {
      name: name.trim(),
      description,
      color,
      schoolId: schoolId ? Number(schoolId) : undefined,
    });

    res.status(201).json({ ok: true, classroom });
  } catch (err: any) {
    logger.app.error('Error al crear aula escolar', err);
    res.status(400).json({
      error: 'Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde.',
    });
  }
}

export async function joinClassroomHandler(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      res.status(401).json({ error: 'No autorizado.' });
      return;
    }

    const { code } = req.body;
    if (!code || typeof code !== 'string' || !code.trim()) {
      res.status(400).json({ error: 'Debes ingresar un código de clase válido.' });
      return;
    }

    const result = await joinClassroomByCode(user.id, code.trim());
    res.json({ ok: true, ...result });
  } catch (err: any) {
    logger.app.error('Error al unirse al aula por código', err);
    res.status(400).json({
      error: 'Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde.',
    });
  }
}

export async function regenerateClassroomCodeHandler(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      res.status(401).json({ error: 'No autorizado.' });
      return;
    }

    const { uuid } = req.params;
    const newCode = await regenerateClassroomCode(uuid, user.id);
    res.json({ ok: true, joinCode: newCode });
  } catch (err: any) {
    logger.app.error('Error al regenerar código de aula', err);
    res.status(400).json({
      error: 'Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde.',
    });
  }
}

export async function listClassroomsHandler(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      res.status(401).json({ error: 'No autorizado.' });
      return;
    }

    const classrooms = await getUserClassrooms(user.id);
    res.json({ ok: true, classrooms });
  } catch (err: any) {
    logger.app.error('Error al listar aulas del usuario', err);
    res.status(500).json({
      error: 'Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde.',
    });
  }
}

export async function getSchoolHandler(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      res.status(401).json({ error: 'No autorizado.' });
      return;
    }

    const school = await getSchoolOrganization(user.id);
    res.json({ ok: true, school });
  } catch (err: any) {
    logger.app.error('Error al consultar organización escolar', err);
    res.status(500).json({
      error: 'Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde.',
    });
  }
}

export async function updateSchoolHandler(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      res.status(401).json({ error: 'No autorizado.' });
      return;
    }

    const { name, domain } = req.body;
    if (!name || typeof name !== 'string' || !name.trim()) {
      res.status(400).json({ error: 'El nombre de la institución es obligatorio.' });
      return;
    }

    const school = await updateSchoolOrganization(user.id, {
      name: name.trim(),
      domain: typeof domain === 'string' ? domain.trim() : undefined,
    });

    res.json({ ok: true, school });
  } catch (err: any) {
    logger.app.error('Error al actualizar organización escolar', err);
    res.status(400).json({
      error: 'Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde.',
    });
  }
}

export async function addSchoolTeacherHandler(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      res.status(401).json({ error: 'No autorizado.' });
      return;
    }

    const { emailOrUsername } = req.body;
    if (!emailOrUsername || typeof emailOrUsername !== 'string') {
      res.status(400).json({ error: 'Debes indicar el correo o nombre de usuario del docente.' });
      return;
    }

    const teacher = await addSchoolTeacher(user.id, emailOrUsername.trim());
    res.status(201).json({ ok: true, teacher });
  } catch (err: any) {
    logger.app.error('Error al agregar docente a la escuela', err);
    res.status(400).json({
      error: 'Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde.',
    });
  }
}

export async function removeSchoolTeacherHandler(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      res.status(401).json({ error: 'No autorizado.' });
      return;
    }

    const { targetUserId } = req.params;
    const uid = Number(targetUserId);
    if (!uid || isNaN(uid)) {
      res.status(400).json({ error: 'Identificador de docente inválido.' });
      return;
    }

    await removeSchoolTeacher(user.id, uid);
    res.json({ ok: true });
  } catch (err: any) {
    logger.app.error('Error al revocar docente de la escuela', err);
    res.status(400).json({
      error: 'Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde.',
    });
  }
}

export async function getSchoolStudentsHandler(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      res.status(401).json({ error: 'No autorizado.' });
      return;
    }

    const students = await getSchoolStudents(user.id);
    res.json({ ok: true, students });
  } catch (err: any) {
    logger.app.error('Error al consultar estudiantes de la escuela', err);
    res.status(500).json({
      error: 'Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde.',
    });
  }
}
