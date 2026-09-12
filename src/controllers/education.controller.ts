import { addSchoolTeacher, createAssignment, createClassroom, getClassroomAssignments, getSchoolOrganization, getUserClassrooms, joinClassroomByCode, regenerateClassroomCode, startAssignmentSubmission, submitAssignment } from '../services/education.service.js';
import { getCurrentUser } from '../middlewares/auth.middleware.js';
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
      error: err.message || 'Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde.',
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
      error: err.message || 'Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde.',
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
      error: err.message || 'Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde.',
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

export async function createAssignmentHandler(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      res.status(401).json({ error: 'No autorizado.' });
      return;
    }

    const { uuid } = req.params;
    const { title, description, templateUuid, dueDate } = req.body;

    if (!title || typeof title !== 'string' || !title.trim()) {
      res.status(400).json({ error: 'El título de la tarea es obligatorio.' });
      return;
    }

    const assignment = await createAssignment(user.id, uuid, {
      title: title.trim(),
      description,
      templateUuid,
      dueDate,
    });

    res.status(201).json({ ok: true, assignment });
  } catch (err: any) {
    logger.app.error('Error al crear tarea de aula', err);
    res.status(400).json({
      error: err.message || 'Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde.',
    });
  }
}

export async function listAssignmentsHandler(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      res.status(401).json({ error: 'No autorizado.' });
      return;
    }

    const { uuid } = req.params;
    const assignments = await getClassroomAssignments(user.id, uuid);
    res.json({ ok: true, assignments });
  } catch (err: any) {
    logger.app.error('Error al listar tareas de aula', err);
    res.status(400).json({
      error: err.message || 'Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde.',
    });
  }
}

export async function startAssignmentHandler(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      res.status(401).json({ error: 'No autorizado.' });
      return;
    }

    const { uuid } = req.params;
    const submission = await startAssignmentSubmission(user.id, uuid);
    res.json({ ok: true, submission });
  } catch (err: any) {
    logger.app.error('Error al iniciar entrega de tarea', err);
    res.status(400).json({
      error: err.message || 'Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde.',
    });
  }
}

export async function submitAssignmentHandler(req: Request, res: Response): Promise<void> {
  try {
    const user = getCurrentUser(req);
    if (!user) {
      res.status(401).json({ error: 'No autorizado.' });
      return;
    }

    const { uuid } = req.params;
    await submitAssignment(user.id, uuid);
    res.json({ ok: true, success: true });
  } catch (err: any) {
    logger.app.error('Error al entregar tarea', err);
    res.status(400).json({
      error: err.message || 'Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde.',
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
      error: err.message || 'Ha ocurrido un error inesperado al procesar la solicitud. Por favor intenta más tarde.',
    });
  }
}
