import { pool } from '../config/database.config.js';
import { logger } from './logger.service.js';
import { AcademicRole, UniversityCampus, UniversityFaculty, UniversityMember, UniversityOverviewDto } from '../types/education.types.js';
import mysql from 'mysql2/promise';

export async function getUniversityTenantForUser(userId: number): Promise<any | null> {
  try {
    const [ownerRows] = await pool.query<mysql.RowDataPacket[]>(
      "SELECT * FROM enterprise_tenants WHERE owner_id = ? AND tenant_type = 'university' LIMIT 1",
      [userId]
    );
    if (ownerRows.length > 0) {
      return ownerRows[0];
    }

    const [memberRows] = await pool.query<mysql.RowDataPacket[]>(
      `SELECT et.* FROM university_members um
       INNER JOIN enterprise_tenants et ON et.id = um.tenant_id
       WHERE um.user_id = ? AND um.status = 'active' LIMIT 1`,
      [userId]
    );
    if (memberRows.length > 0) {
      return memberRows[0];
    }

    const [userRows] = await pool.query<mysql.RowDataPacket[]>(
      'SELECT email, subscription_tier FROM users WHERE id = ? LIMIT 1',
      [userId]
    );
    if (userRows.length > 0) {
      const email = (userRows[0].email || '').toLowerCase();
      const domain = email.includes('@') ? email.split('@')[1] : '';
      if (domain) {
        const [domainRows] = await pool.query<mysql.RowDataPacket[]>(
          "SELECT * FROM enterprise_tenants WHERE domain = ? AND tenant_type = 'university' LIMIT 1",
          [domain]
        );
        if (domainRows.length > 0) {
          return domainRows[0];
        }
      }
    }

    return null;
  } catch (err: any) {
    logger.db.error(`Error al buscar tenant universitario para usuario ${userId}`, err);
    throw new Error('Error al consultar datos universitarios.');
  }
}

export async function getUniversityOverview(userId: number): Promise<UniversityOverviewDto | null> {
  try {
    const tenant = await getUniversityTenantForUser(userId);
    if (!tenant) {
      return null;
    }

    const [campusRows] = await pool.query<mysql.RowDataPacket[]>(
      `SELECT uc.*,
              (SELECT COUNT(id) FROM university_faculties WHERE campus_id = uc.id) AS faculties_count,
              (SELECT COUNT(id) FROM university_members WHERE campus_id = uc.id AND status = 'active') AS members_count
       FROM university_campuses uc
       WHERE uc.tenant_id = ?
       ORDER BY uc.created_at ASC`,
      [tenant.id]
    );

    const campuses: UniversityCampus[] = campusRows.map((c) => ({
      id: c.id,
      tenant_id: c.tenant_id,
      name: c.name,
      code: c.code,
      city: c.city,
      faculties_count: Number(c.faculties_count) || 0,
      members_count: Number(c.members_count) || 0,
      created_at: c.created_at,
      updated_at: c.updated_at,
    }));

    const [facultyRows] = await pool.query<mysql.RowDataPacket[]>(
      `SELECT uf.*, uc.name AS campus_name, u.username AS dean_username,
              (SELECT COUNT(id) FROM university_members WHERE faculty_id = uf.id AND status = 'active') AS members_count
       FROM university_faculties uf
       INNER JOIN university_campuses uc ON uc.id = uf.campus_id
       LEFT JOIN users u ON u.id = uf.dean_user_id
       WHERE uf.tenant_id = ?
       ORDER BY uf.created_at ASC`,
      [tenant.id]
    );

    const faculties: UniversityFaculty[] = facultyRows.map((f) => ({
      id: f.id,
      campus_id: f.campus_id,
      tenant_id: f.tenant_id,
      name: f.name,
      code: f.code,
      dean_user_id: f.dean_user_id,
      dean_username: f.dean_username,
      campus_name: f.campus_name,
      members_count: Number(f.members_count) || 0,
      created_at: f.created_at,
      updated_at: f.updated_at,
    }));

    const [countRows] = await pool.query<mysql.RowDataPacket[]>(
      `SELECT
         SUM(CASE WHEN academic_role = 'student' THEN 1 ELSE 0 END) AS students_count,
         SUM(CASE WHEN academic_role IN ('professor', 'faculty_admin', 'campus_admin', 'dean') THEN 1 ELSE 0 END) AS professors_count
       FROM university_members
       WHERE tenant_id = ? AND status = 'active'`,
      [tenant.id]
    );

    const total_students = Number(countRows[0]?.students_count) || 0;
    const total_professors = Number(countRows[0]?.professors_count) || 0;

    return {
      tenant: {
        id: tenant.id,
        uuid: tenant.uuid,
        name: tenant.name,
        domain: tenant.domain,
        sso_enabled: Boolean(tenant.sso_enabled),
        scim_enabled: Boolean(tenant.scim_enabled),
      },
      campuses,
      faculties,
      total_students,
      total_professors,
      total_campuses: campuses.length,
      total_faculties: faculties.length,
      is_admin: tenant.owner_id === userId,
    };
  } catch (err: any) {
    logger.db.error(`Error al obtener resumen universitario para usuario ${userId}`, err);
    throw new Error('Error al obtener el resumen universitario.');
  }
}

export async function createUniversityCampus(
  adminId: number,
  dto: { name: string; code?: string; city?: string }
): Promise<UniversityCampus> {
  try {
    const tenant = await getUniversityTenantForUser(adminId);
    if (!tenant || tenant.owner_id !== adminId) {
      throw new Error('Solo el administrador de la institución universitaria puede crear sedes o campus.');
    }

    const cleanName = (dto.name || '').trim();
    if (!cleanName) {
      throw new Error('El nombre de la sede o campus es obligatorio.');
    }

    const [res] = await pool.execute<mysql.ResultSetHeader>(
      'INSERT INTO university_campuses (tenant_id, name, code, city) VALUES (?, ?, ?, ?)',
      [tenant.id, cleanName, dto.code?.trim() || null, dto.city?.trim() || null]
    );

    logger.db.info(`Campus creado: ${cleanName} (ID: ${res.insertId}) por admin ${adminId}`);

    return {
      id: res.insertId,
      tenant_id: tenant.id,
      name: cleanName,
      code: dto.code?.trim() || null,
      city: dto.city?.trim() || null,
      faculties_count: 0,
      members_count: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  } catch (err: any) {
    logger.db.error(`Error al crear campus para admin ${adminId}`, err);
    throw err;
  }
}

export async function updateUniversityCampus(
  adminId: number,
  campusId: number,
  dto: { name?: string; code?: string; city?: string }
): Promise<boolean> {
  try {
    const tenant = await getUniversityTenantForUser(adminId);
    if (!tenant || tenant.owner_id !== adminId) {
      throw new Error('Solo el administrador universitario puede modificar una sede.');
    }

    const cleanName = (dto.name || '').trim();
    if (!cleanName) {
      throw new Error('El nombre de la sede no puede estar vacío.');
    }

    await pool.execute(
      'UPDATE university_campuses SET name = ?, code = ?, city = ? WHERE id = ? AND tenant_id = ?',
      [cleanName, dto.code?.trim() || null, dto.city?.trim() || null, campusId, tenant.id]
    );

    logger.db.info(`Campus ${campusId} actualizado por admin ${adminId}`);
    return true;
  } catch (err: any) {
    logger.db.error(`Error al actualizar campus ${campusId}`, err);
    throw err;
  }
}

export async function deleteUniversityCampus(adminId: number, campusId: number): Promise<boolean> {
  try {
    const tenant = await getUniversityTenantForUser(adminId);
    if (!tenant || tenant.owner_id !== adminId) {
      throw new Error('Solo el administrador universitario puede eliminar una sede.');
    }

    await pool.execute(
      'DELETE FROM university_campuses WHERE id = ? AND tenant_id = ?',
      [campusId, tenant.id]
    );

    logger.db.info(`Campus ${campusId} eliminado por admin ${adminId}`);
    return true;
  } catch (err: any) {
    logger.db.error(`Error al eliminar campus ${campusId}`, err);
    throw err;
  }
}

export async function createUniversityFaculty(
  adminId: number,
  dto: { campusId: number; name: string; code?: string; deanUserId?: number | null }
): Promise<UniversityFaculty> {
  try {
    const tenant = await getUniversityTenantForUser(adminId);
    if (!tenant || tenant.owner_id !== adminId) {
      throw new Error('Solo el administrador universitario puede registrar facultades.');
    }

    const cleanName = (dto.name || '').trim();
    if (!cleanName) {
      throw new Error('El nombre de la facultad es obligatorio.');
    }

    const [res] = await pool.execute<mysql.ResultSetHeader>(
      'INSERT INTO university_faculties (campus_id, tenant_id, name, code, dean_user_id) VALUES (?, ?, ?, ?, ?)',
      [dto.campusId, tenant.id, cleanName, dto.code?.trim() || null, dto.deanUserId || null]
    );

    logger.db.info(`Facultad creada: ${cleanName} en campus ${dto.campusId} por admin ${adminId}`);

    return {
      id: res.insertId,
      campus_id: dto.campusId,
      tenant_id: tenant.id,
      name: cleanName,
      code: dto.code?.trim() || null,
      dean_user_id: dto.deanUserId || null,
      members_count: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  } catch (err: any) {
    logger.db.error(`Error al crear facultad en campus ${dto.campusId}`, err);
    throw err;
  }
}

export async function deleteUniversityFaculty(adminId: number, facultyId: number): Promise<boolean> {
  try {
    const tenant = await getUniversityTenantForUser(adminId);
    if (!tenant || tenant.owner_id !== adminId) {
      throw new Error('Solo el administrador universitario puede eliminar una facultad.');
    }

    await pool.execute(
      'DELETE FROM university_faculties WHERE id = ? AND tenant_id = ?',
      [facultyId, tenant.id]
    );

    logger.db.info(`Facultad ${facultyId} eliminada por admin ${adminId}`);
    return true;
  } catch (err: any) {
    logger.db.error(`Error al eliminar facultad ${facultyId}`, err);
    throw err;
  }
}

export async function listUniversityMembers(
  userId: number,
  filters: { campusId?: number; facultyId?: number; role?: AcademicRole; search?: string } = {}
): Promise<UniversityMember[]> {
  try {
    const tenant = await getUniversityTenantForUser(userId);
    if (!tenant) {
      return [];
    }

    let query = `
      SELECT um.*, u.username, u.email, u.avatar_url, u.subscription_tier,
             uc.name AS campus_name, uf.name AS faculty_name
      FROM university_members um
      INNER JOIN users u ON u.id = um.user_id
      LEFT JOIN university_campuses uc ON uc.id = um.campus_id
      LEFT JOIN university_faculties uf ON uf.id = um.faculty_id
      WHERE um.tenant_id = ? AND um.status = 'active'
    `;
    const params: any[] = [tenant.id];

    if (filters.campusId) {
      query += ' AND um.campus_id = ?';
      params.push(filters.campusId);
    }
    if (filters.facultyId) {
      query += ' AND um.faculty_id = ?';
      params.push(filters.facultyId);
    }
    if (filters.role) {
      query += ' AND um.academic_role = ?';
      params.push(filters.role);
    }
    if (filters.search) {
      query += ' AND (LOWER(u.username) LIKE ? OR LOWER(u.email) LIKE ? OR LOWER(um.student_code) LIKE ?)';
      const term = `%${filters.search.trim().toLowerCase()}%`;
      params.push(term, term, term);
    }

    query += ' ORDER BY um.created_at DESC LIMIT 500';

    const [rows] = await pool.query<mysql.RowDataPacket[]>(query, params);

    return rows.map((r) => ({
      id: r.id,
      tenant_id: r.tenant_id,
      campus_id: r.campus_id,
      faculty_id: r.faculty_id,
      user_id: r.user_id,
      academic_role: r.academic_role,
      student_code: r.student_code,
      status: r.status,
      username: r.username,
      email: r.email,
      avatar_url: r.avatar_url,
      subscription_tier: r.subscription_tier,
      campus_name: r.campus_name,
      faculty_name: r.faculty_name,
      created_at: r.created_at,
      updated_at: r.updated_at,
    }));
  } catch (err: any) {
    logger.db.error(`Error al listar miembros universitarios para usuario ${userId}`, err);
    throw new Error('Error al consultar la lista de miembros universitarios.');
  }
}

export async function assignUniversityMember(
  adminId: number,
  dto: {
    targetUserId: number;
    campusId?: number | null;
    facultyId?: number | null;
    academicRole: AcademicRole;
    studentCode?: string | null;
  }
): Promise<UniversityMember> {
  try {
    const tenant = await getUniversityTenantForUser(adminId);
    if (!tenant || tenant.owner_id !== adminId) {
      throw new Error('Solo el administrador universitario puede asignar integrantes a la institución.');
    }

    const assignedTier = (dto.academicRole === 'student' || dto.academicRole === 'ta') ? 'pro' : 'universidades';

    await pool.execute(
      'UPDATE users SET subscription_tier = ? WHERE id = ?',
      [assignedTier, dto.targetUserId]
    );

    await pool.execute(
      `INSERT INTO university_members (tenant_id, campus_id, faculty_id, user_id, academic_role, student_code, status)
       VALUES (?, ?, ?, ?, ?, ?, 'active')
       ON DUPLICATE KEY UPDATE
         campus_id = VALUES(campus_id),
         faculty_id = VALUES(faculty_id),
         academic_role = VALUES(academic_role),
         student_code = VALUES(student_code),
         status = 'active'`,
      [
        tenant.id,
        dto.campusId || null,
        dto.facultyId || null,
        dto.targetUserId,
        dto.academicRole,
        dto.studentCode || null,
      ]
    );

    logger.db.info(
      `Usuario ${dto.targetUserId} asignado a universidad ${tenant.id} con rol ${dto.academicRole} y plan ${assignedTier}`
    );

    const [rows] = await pool.query<mysql.RowDataPacket[]>(
      `SELECT um.*, u.username, u.email, u.avatar_url, u.subscription_tier,
              uc.name AS campus_name, uf.name AS faculty_name
       FROM university_members um
       INNER JOIN users u ON u.id = um.user_id
       LEFT JOIN university_campuses uc ON uc.id = um.campus_id
       LEFT JOIN university_faculties uf ON uf.id = um.faculty_id
       WHERE um.tenant_id = ? AND um.user_id = ? LIMIT 1`,
      [tenant.id, dto.targetUserId]
    );

    const r = rows[0];
    return {
      id: r.id,
      tenant_id: r.tenant_id,
      campus_id: r.campus_id,
      faculty_id: r.faculty_id,
      user_id: r.user_id,
      academic_role: r.academic_role,
      student_code: r.student_code,
      status: r.status,
      username: r.username,
      email: r.email,
      avatar_url: r.avatar_url,
      subscription_tier: r.subscription_tier,
      campus_name: r.campus_name,
      faculty_name: r.faculty_name,
      created_at: r.created_at,
      updated_at: r.updated_at,
    };
  } catch (err: any) {
    logger.db.error(`Error al asignar integrante a la universidad por admin ${adminId}`, err);
    throw err;
  }
}

export async function removeUniversityMember(adminId: number, memberId: number): Promise<boolean> {
  try {
    const tenant = await getUniversityTenantForUser(adminId);
    if (!tenant || tenant.owner_id !== adminId) {
      throw new Error('Solo el administrador universitario puede remover integrantes.');
    }

    const [rows] = await pool.query<mysql.RowDataPacket[]>(
      'SELECT user_id FROM university_members WHERE id = ? AND tenant_id = ? LIMIT 1',
      [memberId, tenant.id]
    );
    if (rows.length === 0) {
      throw new Error('El miembro no existe en esta institución.');
    }

    const targetUserId = rows[0].user_id;

    await pool.execute('DELETE FROM university_members WHERE id = ? AND tenant_id = ?', [memberId, tenant.id]);

    await pool.execute(
      "UPDATE users SET subscription_tier = 'free' WHERE id = ? AND subscription_tier IN ('pro', 'universidades', 'docentes')",
      [targetUserId]
    );

    logger.db.info(`Miembro universitario ${memberId} (usuario ${targetUserId}) removido por admin ${adminId}`);
    return true;
  } catch (err: any) {
    logger.db.error(`Error al remover miembro universitario ${memberId}`, err);
    throw err;
  }
}
