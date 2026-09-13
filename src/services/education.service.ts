import crypto from 'crypto';
import mysql from 'mysql2/promise';
import { pool } from '../config/database.config.js';
import { Classroom, CreateClassroomDto, SchoolOrganization, SchoolTeacher } from '../types/education.types.js';
import { logger } from './logger.service.js';

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
    let schoolId = dto.schoolId || null;

    if (!schoolId) {
      const [adminOrg] = await pool.query<mysql.RowDataPacket[]>(
        'SELECT id FROM school_organizations WHERE admin_id = ? LIMIT 1',
        [teacherId]
      );
      if (adminOrg.length > 0) {
        schoolId = adminOrg[0].id;
      } else {
        const [teacherOrg] = await pool.query<mysql.RowDataPacket[]>(
          "SELECT school_id FROM school_teachers WHERE user_id = ? AND status = 'active' LIMIT 1",
          [teacherId]
        );
        if (teacherOrg.length > 0) {
          schoolId = teacherOrg[0].school_id;
        }
      }
    }

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

export async function getSchoolOrganization(userId: number): Promise<SchoolOrganization | null> {
  try {
    let [rows] = await pool.query<mysql.RowDataPacket[]>(
      `SELECT s.*,
              (SELECT COUNT(id) FROM school_teachers WHERE school_id = s.id AND status = 'active') AS teachers_count,
              (SELECT COUNT(id) FROM teams WHERE school_id = s.id AND team_type = 'classroom') AS classrooms_count
       FROM school_organizations s
       WHERE s.admin_id = ? LIMIT 1`,
      [userId]
    );

    let orgRecord: any = rows[0];

    if (!orgRecord) {
      const [teacherOrg] = await pool.query<mysql.RowDataPacket[]>(
        "SELECT school_id FROM school_teachers WHERE user_id = ? AND status = 'active' LIMIT 1",
        [userId]
      );
      if (teacherOrg.length > 0) {
        const [sRows] = await pool.query<mysql.RowDataPacket[]>(
          `SELECT s.*,
                  (SELECT COUNT(id) FROM school_teachers WHERE school_id = s.id AND status = 'active') AS teachers_count,
                  (SELECT COUNT(id) FROM teams WHERE school_id = s.id AND team_type = 'classroom') AS classrooms_count
           FROM school_organizations s
           WHERE s.id = ? LIMIT 1`,
          [teacherOrg[0].school_id]
        );
        orgRecord = sRows[0];
      }
    }

    if (!orgRecord) {
      const [uRows] = await pool.query<mysql.RowDataPacket[]>(
        'SELECT username, subscription_tier FROM users WHERE id = ? LIMIT 1',
        [userId]
      );
      const tier = (uRows[0]?.subscription_tier || '').toLowerCase();
      if (['escuelas', 'instituciones', 'education_institution', 'schools', 'docentes'].includes(tier)) {
        const uuid = crypto.randomUUID();
        const defaultName = `Institución de ${uRows[0]?.username || 'Educación'}`;
        const [insertRes] = await pool.execute<mysql.ResultSetHeader>(
          'INSERT INTO school_organizations (uuid, admin_id, name, max_teachers) VALUES (?, ?, ?, 50)',
          [uuid, userId, defaultName]
        );
        orgRecord = {
          id: insertRes.insertId,
          uuid,
          admin_id: userId,
          name: defaultName,
          domain: null,
          max_teachers: 50,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          teachers_count: 0,
          classrooms_count: 0,
        };
      } else {
        return null;
      }
    }

    const [teacherRows] = await pool.query<mysql.RowDataPacket[]>(
      `SELECT st.id, st.school_id, st.user_id, st.status, st.created_at, u.username, u.email, u.avatar_url
       FROM school_teachers st
       INNER JOIN users u ON u.id = st.user_id
       WHERE st.school_id = ? AND st.status = 'active'
       ORDER BY st.created_at DESC`,
      [orgRecord.id]
    );

    const teachers: SchoolTeacher[] = teacherRows.map((t) => ({
      id: t.id,
      school_id: t.school_id,
      user_id: t.user_id,
      status: t.status,
      created_at: t.created_at,
      username: t.username,
      email: t.email,
      avatar_url: t.avatar_url,
    }));

    return {
      id: orgRecord.id,
      uuid: orgRecord.uuid,
      admin_id: orgRecord.admin_id,
      name: orgRecord.name,
      domain: orgRecord.domain,
      max_teachers: orgRecord.max_teachers,
      created_at: orgRecord.created_at,
      updated_at: orgRecord.updated_at,
      teachers_count: Number(orgRecord.teachers_count) || teachers.length,
      classrooms_count: Number(orgRecord.classrooms_count) || 0,
      teachers,
      is_admin: orgRecord.admin_id === userId,
    };
  } catch (err: any) {
    logger.db.error(`Error al consultar organización escolar para usuario ${userId}`, err);
    throw new Error('No se pudo obtener la organización escolar.');
  }
}

export async function updateSchoolOrganization(
  adminId: number,
  dto: { name?: string; domain?: string }
): Promise<SchoolOrganization> {
  try {
    const school = await getSchoolOrganization(adminId);
    if (!school) {
      throw new Error('No posees una organización escolar activa.');
    }
    if (!school.is_admin) {
      throw new Error('Solo el administrador escolar puede modificar los datos de la institución.');
    }

    const cleanName = (dto.name || '').trim();
    if (!cleanName) {
      throw new Error('El nombre de la institución no puede estar vacío.');
    }

    let cleanDomain = (dto.domain || '').trim().toLowerCase();
    if (cleanDomain) {
      cleanDomain = cleanDomain.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/^@/, '');
    }

    await pool.execute(
      'UPDATE school_organizations SET name = ?, domain = ? WHERE id = ?',
      [cleanName, cleanDomain || null, school.id]
    );

    logger.db.info(`Organización escolar ${school.id} actualizada por admin ${adminId}: ${cleanName}`);
    const updated = await getSchoolOrganization(adminId);
    return updated!;
  } catch (err: any) {
    logger.db.error(`Error al actualizar organización escolar para admin ${adminId}`, err);
    throw err;
  }
}

export async function removeSchoolTeacher(
  adminId: number,
  targetUserId: number
): Promise<boolean> {
  try {
    const school = await getSchoolOrganization(adminId);
    if (!school) {
      throw new Error('No posees una organización escolar activa.');
    }

    await pool.execute(
      "UPDATE school_teachers SET status = 'revoked' WHERE school_id = ? AND user_id = ?",
      [school.id, targetUserId]
    );

    await pool.execute(
      "UPDATE users SET subscription_tier = 'free' WHERE id = ? AND subscription_tier IN ('docentes', 'escuelas')",
      [targetUserId]
    );

    logger.db.info(`Docente ${targetUserId} revocado de la escuela ${school.uuid} por admin ${adminId}`);
    return true;
  } catch (err: any) {
    logger.db.error(`Error al revocar docente ${targetUserId} de la escuela por admin ${adminId}`, err);
    throw err;
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
      "UPDATE users SET subscription_tier = 'escuelas' WHERE id = ? AND subscription_tier = 'free'",
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
