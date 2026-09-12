import crypto from 'crypto';
import mysql from 'mysql2/promise';
import { canvasPool, pool } from '../config/database.config.js';
import { Classroom, ClassroomAssignment, ClassroomSubmission, CreateAssignmentDto, CreateClassroomDto, SchoolOrganization, SchoolTeacher } from '../types/education.types.js';
import { generateShortCode } from './canvas.service.js';
import { hasCanvasBlob, readCanvasBlobDecompressed, saveCanvasBlob } from './canvas-storage-blob.service.js';
import { logger } from './logger.service.js';
import { checkUserStorageQuota } from './storage.service.js';

function generateRandomClassCode(): string {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `SP-${code}`;
}

export async function createClassroom(
  teacherId: number,
  dto: CreateClassroomDto
): Promise<Classroom> {
  try {
    const [userRows] = await pool.query<mysql.RowDataPacket[]>(
      'SELECT subscription_tier FROM users WHERE id = ? LIMIT 1',
      [teacherId]
    );

    const rawTier = (userRows[0]?.subscription_tier || 'free').toLowerCase();
    const canCreate = ['docentes', 'escuelas', 'education', 'business', 'negocios', 'pro'].includes(rawTier);

    if (!canCreate) {
      throw new Error('La creación de aulas requiere una suscripción de Docente, Institución o Negocios.');
    }

    let joinCode = generateRandomClassCode();
    let isUnique = false;
    let attempts = 0;

    while (!isUnique && attempts < 10) {
      const [existing] = await pool.query<mysql.RowDataPacket[]>(
        'SELECT id FROM teams WHERE join_code = ? LIMIT 1',
        [joinCode]
      );
      if (existing.length === 0) {
        isUnique = true;
      } else {
        joinCode = generateRandomClassCode();
        attempts++;
      }
    }

    const uuid = crypto.randomUUID();
    const name = (dto.name || 'Nueva aula escolar').trim();
    const description = (dto.description || '').trim() || null;
    const color = dto.color || '#4f46e5';
    const schoolId = dto.schoolId || null;

    const [result] = await pool.execute<mysql.ResultSetHeader>(
      `INSERT INTO teams (uuid, owner_id, name, description, color, team_type, join_code, school_id)
       VALUES (?, ?, ?, ?, ?, 'classroom', ?, ?)`,
      [uuid, teacherId, name, description, color, joinCode, schoolId]
    );

    const teamId = result.insertId;

    await pool.execute(
      "INSERT INTO team_members (team_id, user_id, role) VALUES (?, ?, 'admin')",
      [teamId, teacherId]
    );

    logger.db.info(`Aula escolar creada con éxito: ${uuid} (Código: ${joinCode}) por docente ${teacherId}`);

    return {
      id: teamId,
      uuid,
      owner_id: teacherId,
      name,
      description,
      color,
      team_type: 'classroom',
      join_code: joinCode,
      school_id: schoolId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      member_count: 1,
      user_role: 'owner',
    };
  } catch (err: any) {
    logger.db.error(`Error al crear aula escolar para docente ${teacherId}`, err);
    throw err;
  }
}

export async function joinClassroomByCode(
  userId: number,
  inputCode: string
): Promise<{ classroom: Classroom; isNewMember: boolean }> {
  try {
    const cleanCode = (inputCode || '').trim().toUpperCase();
    if (!cleanCode) {
      throw new Error('Debes ingresar un código de clase válido.');
    }

    const [teamRows] = await pool.query<mysql.RowDataPacket[]>(
      `SELECT t.*, u.username as owner_username, u.avatar_url as owner_avatar
       FROM teams t
       INNER JOIN users u ON u.id = t.owner_id
       WHERE t.join_code = ? AND t.team_type = 'classroom' LIMIT 1`,
      [cleanCode]
    );

    if (teamRows.length === 0) {
      throw new Error('No se encontró ningún aula con ese código. Verifica el código e intenta de nuevo.');
    }

    const team = teamRows[0];
    const isOwner = team.owner_id === userId;

    const [memberRows] = await pool.query<mysql.RowDataPacket[]>(
      'SELECT id, role FROM team_members WHERE team_id = ? AND user_id = ? LIMIT 1',
      [team.id, userId]
    );

    let isNewMember = false;
    let userRole: 'owner' | 'admin' | 'member' = isOwner ? 'owner' : 'member';

    if (!isOwner && memberRows.length === 0) {
      await pool.execute(
        "INSERT INTO team_members (team_id, user_id, role) VALUES (?, ?, 'member')",
        [team.id, userId]
      );
      isNewMember = true;
      logger.db.info(`Usuario ${userId} se unió al aula ${team.uuid} con código ${cleanCode}`);
    } else if (memberRows.length > 0) {
      userRole = memberRows[0].role as any;
    }

    const [countRows] = await pool.query<mysql.RowDataPacket[]>(
      'SELECT COUNT(id) AS total FROM team_members WHERE team_id = ?',
      [team.id]
    );
    const memberCount = Number(countRows[0]?.total || 1);

    const classroom: Classroom = {
      id: team.id,
      uuid: team.uuid,
      owner_id: team.owner_id,
      name: team.name,
      description: team.description,
      color: team.color,
      team_type: 'classroom',
      join_code: isOwner || userRole === 'admin' ? team.join_code : null,
      school_id: team.school_id,
      created_at: team.created_at,
      updated_at: team.updated_at,
      member_count: memberCount,
      user_role: userRole,
      owner_username: team.owner_username,
      owner_avatar: team.owner_avatar,
    };

    return { classroom, isNewMember };
  } catch (err: any) {
    logger.db.error(`Error al unirse al aula con código ${inputCode} por usuario ${userId}`, err);
    throw err;
  }
}

export async function regenerateClassroomCode(
  classroomUuid: string,
  teacherId: number
): Promise<string> {
  try {
    const [teamRows] = await pool.query<mysql.RowDataPacket[]>(
      'SELECT id, owner_id FROM teams WHERE uuid = ? AND team_type = \'classroom\' LIMIT 1',
      [classroomUuid]
    );

    if (teamRows.length === 0) {
      throw new Error('El aula no existe.');
    }

    const team = teamRows[0];
    if (team.owner_id !== teacherId) {
      const [adminRows] = await pool.query<mysql.RowDataPacket[]>(
        "SELECT id FROM team_members WHERE team_id = ? AND user_id = ? AND role = 'admin' LIMIT 1",
        [team.id, teacherId]
      );
      if (adminRows.length === 0) {
        throw new Error('Solo el docente titular o administradores pueden renovar el código del aula.');
      }
    }

    let newCode = generateRandomClassCode();
    let isUnique = false;
    let attempts = 0;

    while (!isUnique && attempts < 10) {
      const [existing] = await pool.query<mysql.RowDataPacket[]>(
        'SELECT id FROM teams WHERE join_code = ? LIMIT 1',
        [newCode]
      );
      if (existing.length === 0) {
        isUnique = true;
      } else {
        newCode = generateRandomClassCode();
        attempts++;
      }
    }

    await pool.execute('UPDATE teams SET join_code = ? WHERE id = ?', [newCode, team.id]);
    logger.db.info(`Código de aula ${classroomUuid} actualizado a ${newCode}`);

    return newCode;
  } catch (err: any) {
    logger.db.error(`Error al regenerar código de aula ${classroomUuid}`, err);
    throw err;
  }
}

export async function getUserClassrooms(userId: number): Promise<Classroom[]> {
  try {
    const [rows] = await pool.query<mysql.RowDataPacket[]>(
      `SELECT t.*,
              CASE WHEN t.owner_id = ? THEN 'owner' ELSE tm.role END AS user_role,
              (SELECT COUNT(id) FROM team_members WHERE team_id = t.id) AS member_count,
              u.username AS owner_username,
              u.avatar_url AS owner_avatar
       FROM teams t
       LEFT JOIN team_members tm ON tm.team_id = t.id AND tm.user_id = ?
       INNER JOIN users u ON u.id = t.owner_id
       WHERE t.team_type = 'classroom'
         AND (t.owner_id = ? OR tm.user_id = ?)
       ORDER BY t.created_at DESC`,
      [userId, userId, userId, userId]
    );

    return rows.map((r) => ({
      id: r.id,
      uuid: r.uuid,
      owner_id: r.owner_id,
      name: r.name,
      description: r.description,
      color: r.color,
      team_type: 'classroom',
      join_code: r.user_role === 'owner' || r.user_role === 'admin' ? r.join_code : null,
      school_id: r.school_id,
      created_at: r.created_at,
      updated_at: r.updated_at,
      member_count: Number(r.member_count) || 1,
      user_role: r.user_role,
      owner_username: r.owner_username,
      owner_avatar: r.owner_avatar,
    }));
  } catch (err: any) {
    logger.db.error(`Error al listar aulas del usuario ${userId}`, err);
    throw new Error('No se pudieron obtener las aulas del usuario.');
  }
}

export async function createAssignment(
  teacherId: number,
  classroomUuid: string,
  dto: CreateAssignmentDto
): Promise<ClassroomAssignment> {
  try {
    const [teamRows] = await pool.query<mysql.RowDataPacket[]>(
      'SELECT id, owner_id FROM teams WHERE uuid = ? AND team_type = \'classroom\' LIMIT 1',
      [classroomUuid]
    );

    if (teamRows.length === 0) {
      throw new Error('El aula no existe.');
    }

    const team = teamRows[0];
    if (team.owner_id !== teacherId) {
      const [adminRows] = await pool.query<mysql.RowDataPacket[]>(
        "SELECT id FROM team_members WHERE team_id = ? AND user_id = ? AND role = 'admin' LIMIT 1",
        [team.id, teacherId]
      );
      if (adminRows.length === 0) {
        throw new Error('Solo el docente titular o administradores pueden crear tareas en el aula.');
      }
    }

    let templateId: number | null = null;
    let templateName: string | null = null;
    let templateUuid: string | null = null;

    if (dto.templateUuid) {
      const [canvasRows] = await canvasPool.query<mysql.RowDataPacket[]>(
        'SELECT id, uuid, name FROM canvases WHERE uuid = ? AND deleted_at IS NULL LIMIT 1',
        [dto.templateUuid]
      );
      if (canvasRows.length > 0) {
        templateId = canvasRows[0].id;
        templateUuid = canvasRows[0].uuid;
        templateName = canvasRows[0].name;
      }
    }

    const uuid = crypto.randomUUID();
    const title = (dto.title || 'Nueva tarea').trim();
    const description = (dto.description || '').trim() || null;
    const dueDate = dto.dueDate ? new Date(dto.dueDate) : null;

    const [result] = await canvasPool.execute<mysql.ResultSetHeader>(
      `INSERT INTO db_canvas.classroom_assignments
       (uuid, classroom_id, teacher_id, canvas_template_id, title, description, due_date)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [uuid, team.id, teacherId, templateId, title, description, dueDate]
    );

    logger.db.info(`Tarea ${uuid} ("${title}") creada en aula ${classroomUuid} por docente ${teacherId}`);

    return {
      id: result.insertId,
      uuid,
      classroom_id: team.id,
      classroom_uuid: classroomUuid,
      teacher_id: teacherId,
      canvas_template_id: templateId,
      template_uuid: templateUuid,
      template_name: templateName,
      title,
      description,
      due_date: dueDate ? dueDate.toISOString() : null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      submission_count: 0,
    };
  } catch (err: any) {
    logger.db.error(`Error al crear tarea en aula ${classroomUuid}`, err);
    throw err;
  }
}

export async function getClassroomAssignments(
  userId: number,
  classroomUuid: string
): Promise<ClassroomAssignment[]> {
  try {
    const [teamRows] = await pool.query<mysql.RowDataPacket[]>(
      `SELECT t.id, t.owner_id, tm.role AS user_role
       FROM teams t
       LEFT JOIN team_members tm ON tm.team_id = t.id AND tm.user_id = ?
       WHERE t.uuid = ? AND t.team_type = 'classroom' LIMIT 1`,
      [userId, classroomUuid]
    );

    if (teamRows.length === 0) {
      throw new Error('El aula no existe o no tienes acceso.');
    }

    const team = teamRows[0];
    const isMember = team.owner_id === userId || Boolean(team.user_role);
    if (!isMember) {
      throw new Error('No tienes acceso a esta aula.');
    }

    const [assignmentRows] = await canvasPool.query<mysql.RowDataPacket[]>(
      `SELECT a.*,
              c.uuid AS template_uuid,
              c.name AS template_name,
              u.username AS teacher_username,
              (SELECT COUNT(id) FROM db_canvas.classroom_submissions WHERE assignment_id = a.id) AS submission_count
       FROM db_canvas.classroom_assignments a
       LEFT JOIN db_canvas.canvases c ON c.id = a.canvas_template_id
       LEFT JOIN db_identity.users u ON u.id = a.teacher_id
       WHERE a.classroom_id = ?
       ORDER BY a.created_at DESC`,
      [team.id]
    );

    const assignments: ClassroomAssignment[] = [];

    for (const r of assignmentRows) {
      let mySubmission: ClassroomSubmission | null = null;

      const [subRows] = await canvasPool.query<mysql.RowDataPacket[]>(
        `SELECT s.*, c.uuid AS canvas_uuid, c.name AS canvas_name, c.preview_thumbnail AS canvas_thumbnail
         FROM db_canvas.classroom_submissions s
         INNER JOIN db_canvas.canvases c ON c.id = s.canvas_id
         WHERE s.assignment_id = ? AND s.student_id = ? LIMIT 1`,
        [r.id, userId]
      );

      if (subRows.length > 0) {
        const sub = subRows[0];
        mySubmission = {
          id: sub.id,
          assignment_id: sub.assignment_id,
          student_id: sub.student_id,
          canvas_id: sub.canvas_id,
          canvas_uuid: sub.canvas_uuid,
          canvas_name: sub.canvas_name,
          canvas_thumbnail: sub.canvas_thumbnail,
          status: sub.status,
          feedback: sub.feedback,
          grade: sub.grade,
          submitted_at: sub.submitted_at,
          created_at: sub.created_at,
        };
      }

      assignments.push({
        id: r.id,
        uuid: r.uuid,
        classroom_id: r.classroom_id,
        classroom_uuid: classroomUuid,
        teacher_id: r.teacher_id,
        teacher_username: r.teacher_username,
        canvas_template_id: r.canvas_template_id,
        template_uuid: r.template_uuid,
        template_name: r.template_name,
        title: r.title,
        description: r.description,
        due_date: r.due_date,
        created_at: r.created_at,
        updated_at: r.updated_at,
        submission_count: Number(r.submission_count) || 0,
        my_submission: mySubmission,
      });
    }

    return assignments;
  } catch (err: any) {
    logger.db.error(`Error al listar tareas de aula ${classroomUuid}`, err);
    throw err;
  }
}

export async function startAssignmentSubmission(
  studentId: number,
  assignmentUuid: string
): Promise<ClassroomSubmission> {
  try {
    const [assignmentRows] = await canvasPool.query<mysql.RowDataPacket[]>(
      `SELECT a.*, t.id AS team_id, t.uuid AS team_uuid, t.owner_id AS teacher_owner_id
       FROM db_canvas.classroom_assignments a
       INNER JOIN db_identity.teams t ON t.id = a.classroom_id
       WHERE a.uuid = ? LIMIT 1`,
      [assignmentUuid]
    );

    if (assignmentRows.length === 0) {
      throw new Error('La tarea no existe.');
    }

    const assignment = assignmentRows[0];

    const [existingSub] = await canvasPool.query<mysql.RowDataPacket[]>(
      `SELECT s.*, c.uuid AS canvas_uuid, c.name AS canvas_name, c.preview_thumbnail AS canvas_thumbnail
       FROM db_canvas.classroom_submissions s
       INNER JOIN db_canvas.canvases c ON c.id = s.canvas_id
       WHERE s.assignment_id = ? AND s.student_id = ? LIMIT 1`,
      [assignment.id, studentId]
    );

    if (existingSub.length > 0) {
      const sub = existingSub[0];
      return {
        id: sub.id,
        assignment_id: sub.assignment_id,
        student_id: sub.student_id,
        canvas_id: sub.canvas_id,
        canvas_uuid: sub.canvas_uuid,
        canvas_name: sub.canvas_name,
        canvas_thumbnail: sub.canvas_thumbnail,
        status: sub.status,
        feedback: sub.feedback,
        grade: sub.grade,
        submitted_at: sub.submitted_at,
        created_at: sub.created_at,
      };
    }

    const [studentRows] = await pool.query<mysql.RowDataPacket[]>(
      'SELECT username FROM users WHERE id = ? LIMIT 1',
      [studentId]
    );
    const studentUsername = studentRows[0]?.username || 'Estudiante';

    let width = 1920;
    let height = 1080;
    let unit = 'px';
    let fullData: string | null = null;
    let previewThumbnail: string | null = null;

    if (assignment.canvas_template_id) {
      const [templateRows] = await canvasPool.query<mysql.RowDataPacket[]>(
        'SELECT * FROM canvases WHERE id = ? LIMIT 1',
        [assignment.canvas_template_id]
      );
      if (templateRows.length > 0) {
        const tmpl = templateRows[0];
        width = tmpl.width;
        height = tmpl.height;
        unit = tmpl.unit;
        previewThumbnail = tmpl.preview_thumbnail;

        if (await hasCanvasBlob(tmpl.uuid)) {
          fullData = await readCanvasBlobDecompressed(tmpl.uuid);
        } else if (tmpl.data) {
          fullData = typeof tmpl.data === 'string' ? tmpl.data : JSON.stringify(tmpl.data);
        }
      }
    }

    const approxBytes = fullData ? Buffer.byteLength(fullData, 'utf-8') : 1024;
    await checkUserStorageQuota(assignment.teacher_owner_id, approxBytes);

    const newCanvasUuid = crypto.randomUUID();
    const canvasName = `${assignment.title} - ${studentUsername}`.slice(0, 255);
    const newShortCode = generateShortCode();

    let sizeBytes = 0;
    let compressedBytes = 0;
    if (fullData) {
      try {
        const blobResult = await saveCanvasBlob(newCanvasUuid, fullData);
        sizeBytes = blobResult.sizeBytes;
        compressedBytes = blobResult.compressedBytes;
      } catch (blobErr) {
        logger.db.error(`Error guardando blob para entrega ${newCanvasUuid}`, blobErr);
      }
    }

    const dbData = fullData && fullData.length > 65536
      ? JSON.stringify({ storage: 'blob', version: 2 })
      : fullData;

    const [canvasResult] = await canvasPool.execute<mysql.ResultSetHeader>(
      `INSERT INTO canvases (uuid, user_id, name, width, height, unit, size_bytes, compressed_bytes, access_level, short_code, data, preview_thumbnail)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'private', ?, ?, ?)`,
      [newCanvasUuid, studentId, canvasName, width, height, unit, sizeBytes, compressedBytes, newShortCode, dbData, previewThumbnail]
    );

    const createdCanvasId = canvasResult.insertId;

    await canvasPool.execute(
      `INSERT INTO canvas_teams (canvas_id, team_id, role)
       VALUES (?, ?, 'editor')
       ON DUPLICATE KEY UPDATE role = 'editor'`,
      [createdCanvasId, assignment.team_id]
    );

    const [subResult] = await canvasPool.execute<mysql.ResultSetHeader>(
      `INSERT INTO db_canvas.classroom_submissions
       (assignment_id, student_id, canvas_id, status)
       VALUES (?, ?, ?, 'draft')`,
      [assignment.id, studentId, createdCanvasId]
    );

    logger.db.info(`Entrega iniciada por estudiante ${studentId} para tarea ${assignmentUuid} (Lienzo: ${newCanvasUuid})`);

    return {
      id: subResult.insertId,
      assignment_id: assignment.id,
      student_id: studentId,
      canvas_id: createdCanvasId,
      canvas_uuid: newCanvasUuid,
      canvas_name: canvasName,
      canvas_thumbnail: previewThumbnail,
      status: 'draft',
      created_at: new Date().toISOString(),
    };
  } catch (err: any) {
    logger.db.error(`Error al iniciar entrega de tarea ${assignmentUuid}`, err);
    throw err;
  }
}

export async function submitAssignment(
  studentId: number,
  assignmentUuid: string
): Promise<void> {
  try {
    const [assignmentRows] = await canvasPool.query<mysql.RowDataPacket[]>(
      'SELECT id FROM db_canvas.classroom_assignments WHERE uuid = ? LIMIT 1',
      [assignmentUuid]
    );
    if (assignmentRows.length === 0) {
      throw new Error('La tarea no existe.');
    }

    const assignment = assignmentRows[0];
    const [result] = await canvasPool.execute<mysql.ResultSetHeader>(
      `UPDATE db_canvas.classroom_submissions
       SET status = 'submitted', submitted_at = NOW()
       WHERE assignment_id = ? AND student_id = ?`,
      [assignment.id, studentId]
    );

    if (result.affectedRows === 0) {
      throw new Error('No se encontró un borrador previo para esta tarea.');
    }

    logger.db.info(`Tarea ${assignmentUuid} enviada por estudiante ${studentId}`);
  } catch (err: any) {
    logger.db.error(`Error al enviar tarea ${assignmentUuid}`, err);
    throw err;
  }
}

export async function getSchoolOrganization(adminId: number): Promise<SchoolOrganization | null> {
  try {
    const [rows] = await pool.query<mysql.RowDataPacket[]>(
      `SELECT s.*,
              (SELECT COUNT(id) FROM school_teachers WHERE school_id = s.id AND status = 'active') AS teachers_count,
              (SELECT COUNT(id) FROM teams WHERE school_id = s.id AND team_type = 'classroom') AS classrooms_count
       FROM school_organizations s
       WHERE s.admin_id = ? LIMIT 1`,
      [adminId]
    );

    if (rows.length === 0) {
      return null;
    }

    const r = rows[0];
    return {
      id: r.id,
      uuid: r.uuid,
      admin_id: r.admin_id,
      name: r.name,
      domain: r.domain,
      max_teachers: r.max_teachers,
      created_at: r.created_at,
      updated_at: r.updated_at,
      teachers_count: Number(r.teachers_count) || 0,
      classrooms_count: Number(r.classrooms_count) || 0,
    };
  } catch (err: any) {
    logger.db.error(`Error al consultar organización escolar para usuario ${adminId}`, err);
    throw new Error('No se pudo obtener la organización escolar.');
  }
}

export async function addSchoolTeacher(
  adminId: number,
  targetEmailOrUsername: string
): Promise<SchoolTeacher> {
  try {
    const school = await getSchoolOrganization(adminId);
    if (!school) {
      throw new Error('No posees una organización escolar activa.');
    }

    const query = (targetEmailOrUsername || '').trim().toLowerCase();
    const [userRows] = await pool.query<mysql.RowDataPacket[]>(
      'SELECT id, username, email, avatar_url FROM users WHERE LOWER(username) = ? OR LOWER(email) = ? LIMIT 1',
      [query, query]
    );

    if (userRows.length === 0) {
      throw new Error('No se encontró ningún usuario con ese nombre o correo.');
    }

    const targetUser = userRows[0];

    const [existingTeacher] = await pool.query<mysql.RowDataPacket[]>(
      'SELECT id, status FROM school_teachers WHERE school_id = ? AND user_id = ? LIMIT 1',
      [school.id, targetUser.id]
    );

    if (existingTeacher.length > 0 && existingTeacher[0].status === 'active') {
      throw new Error('Este usuario ya es docente activo de la institución.');
    }

    if (existingTeacher.length > 0) {
      await pool.execute(
        "UPDATE school_teachers SET status = 'active' WHERE id = ?",
        [existingTeacher[0].id]
      );
    } else {
      await pool.execute(
        "INSERT INTO school_teachers (school_id, user_id, status) VALUES (?, ?, 'active')",
        [school.id, targetUser.id]
      );
    }

    await pool.execute(
      "UPDATE users SET subscription_tier = 'docentes' WHERE id = ? AND subscription_tier = 'free'",
      [targetUser.id]
    );

    logger.db.info(`Docente ${targetUser.id} agregado a la escuela ${school.uuid} por admin ${adminId}`);

    return {
      id: targetUser.id,
      school_id: school.id,
      user_id: targetUser.id,
      status: 'active',
      created_at: new Date().toISOString(),
      username: targetUser.username,
      email: targetUser.email,
      avatar_url: targetUser.avatar_url,
    };
  } catch (err: any) {
    logger.db.error(`Error al agregar docente a la escuela por admin ${adminId}`, err);
    throw err;
  }
}
