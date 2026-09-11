import crypto from 'crypto';
import mysql from 'mysql2/promise';
import { canvasPool, pool } from '../config/database.config.js';
import { CreateTeamDto, Team, TeamMember, UpdateTeamDto } from '../types/team.types.js';
import { logger } from './logger.service.js';
import { createNotification } from './notification.service.js';
import { getTierLimits } from './subscription.service.js';

export async function createTeam(ownerId: number, dto: CreateTeamDto): Promise<Team> {
  const uuid = crypto.randomUUID();
  const name = dto.name.trim().slice(0, 100);
  const description = dto.description && dto.description.trim() ? dto.description.trim().slice(0, 255) : null;
  const color = dto.color && dto.color.trim() ? dto.color.trim().slice(0, 20) : '#6366f1';

  const [uRows] = await pool.query<mysql.RowDataPacket[]>(
    'SELECT subscription_tier FROM users WHERE id = ? LIMIT 1',
    [ownerId]
  );
  const userTier = uRows[0]?.subscription_tier || 'free';
  const tierLimits = getTierLimits(userTier);

  if (tierLimits.maxTeams <= 0) {
    throw new Error('La creación de equipos requiere una suscripción Pro o Negocios.');
  }

  const [existingTeams] = await pool.query<mysql.RowDataPacket[]>(
    'SELECT COUNT(id) AS total FROM teams WHERE owner_id = ?',
    [ownerId]
  );
  const ownedCount = Number(existingTeams[0]?.total || 0);
  if (ownedCount >= tierLimits.maxTeams) {
    throw new Error(`El plan Pro permite un máximo de ${tierLimits.maxTeams} equipo. Mejora a Negocios para crear equipos ilimitados.`);
  }

  try {
    const [result] = await pool.execute<mysql.ResultSetHeader>(
      'INSERT INTO teams (uuid, owner_id, name, description, color) VALUES (?, ?, ?, ?, ?)',
      [uuid, ownerId, name, description, color]
    );

    const teamId = result.insertId;

    await pool.execute(
      'INSERT INTO team_members (team_id, user_id, role) VALUES (?, ?, ?)',
      [teamId, ownerId, 'admin']
    );

    logger.db.info(`Equipo "${name}" (${uuid}) creado exitosamente por usuario ${ownerId}`);

    const [rows] = await pool.query<mysql.RowDataPacket[]>(
      `SELECT t.id, t.uuid, t.owner_id, t.name, t.description, t.color, t.created_at, t.updated_at,
              1 AS member_count, 'owner' AS user_role
       FROM teams t
       WHERE t.id = ? LIMIT 1`,
      [teamId]
    );

    return rows[0] as Team;
  } catch (err) {
    logger.db.error('Error al crear equipo en base de datos', err);
    throw new Error('No se pudo crear el equipo.');
  }
}

export async function getUserTeams(userId: number): Promise<Team[]> {
  try {
    const [rows] = await pool.query<mysql.RowDataPacket[]>(
      `SELECT DISTINCT t.id, t.uuid, t.owner_id, t.name, t.description, t.color, t.created_at, t.updated_at,
              (SELECT COUNT(*) FROM team_members WHERE team_id = t.id) AS member_count,
              CASE WHEN t.owner_id = ? THEN 'owner' ELSE tm.role END AS user_role
       FROM teams t
       INNER JOIN team_members tm ON tm.team_id = t.id
       WHERE tm.user_id = ? OR t.owner_id = ?
       ORDER BY t.updated_at DESC`,
      [userId, userId, userId]
    );

    return rows as Team[];
  } catch (err) {
    logger.db.error(`Error al listar equipos para el usuario ${userId}`, err);
    throw new Error('No se pudieron obtener los equipos.');
  }
}

export async function getTeamByUuid(uuid: string, currentUserId: number): Promise<{ team: Team; members: TeamMember[] } | null> {
  try {
    const [teamRows] = await pool.query<mysql.RowDataPacket[]>(
      `SELECT t.id, t.uuid, t.owner_id, t.name, t.description, t.color, t.created_at, t.updated_at,
              (SELECT COUNT(*) FROM team_members WHERE team_id = t.id) AS member_count,
              CASE WHEN t.owner_id = ? THEN 'owner' ELSE tm.role END AS user_role
       FROM teams t
       LEFT JOIN team_members tm ON tm.team_id = t.id AND tm.user_id = ?
       WHERE t.uuid = ? LIMIT 1`,
      [currentUserId, currentUserId, uuid]
    );

    if (teamRows.length === 0) {
      return null;
    }

    const team = teamRows[0] as Team;

    const [isMember] = await pool.query<mysql.RowDataPacket[]>(
      'SELECT id FROM team_members WHERE team_id = ? AND user_id = ? LIMIT 1',
      [team.id, currentUserId]
    );

    if (team.owner_id !== currentUserId && isMember.length === 0) {
      throw new Error('No tienes acceso a este equipo.');
    }

    const [members] = await pool.query<mysql.RowDataPacket[]>(
      `SELECT tm.id, tm.team_id, tm.user_id, tm.role, tm.created_at,
              u.username, u.email, u.avatar_url
       FROM team_members tm
       INNER JOIN users u ON tm.user_id = u.id
       WHERE tm.team_id = ?
       ORDER BY CASE WHEN tm.role = 'admin' THEN 0 ELSE 1 END, tm.created_at ASC`,
      [team.id]
    );

    return {
      team,
      members: members as TeamMember[],
    };
  } catch (err: any) {
    logger.db.error(`Error al obtener detalle del equipo ${uuid}`, err);
    throw err;
  }
}

export async function updateTeam(uuid: string, currentUserId: number, dto: UpdateTeamDto): Promise<Team> {
  try {
    const [teamRows] = await pool.query<mysql.RowDataPacket[]>(
      'SELECT id, owner_id FROM teams WHERE uuid = ? LIMIT 1',
      [uuid]
    );

    if (teamRows.length === 0) {
      throw new Error('El equipo no existe.');
    }

    const team = teamRows[0];

    const [adminRows] = await pool.query<mysql.RowDataPacket[]>(
      "SELECT id FROM team_members WHERE team_id = ? AND user_id = ? AND role = 'admin' LIMIT 1",
      [team.id, currentUserId]
    );

    if (team.owner_id !== currentUserId && adminRows.length === 0) {
      throw new Error('Solo los administradores del equipo pueden modificarlo.');
    }

    const updates: string[] = [];
    const params: any[] = [];

    if (dto.name !== undefined && dto.name.trim()) {
      updates.push('name = ?');
      params.push(dto.name.trim().slice(0, 100));
    }

    if (dto.description !== undefined) {
      updates.push('description = ?');
      params.push(dto.description ? dto.description.trim().slice(0, 255) : null);
    }

    if (dto.color !== undefined && dto.color.trim()) {
      updates.push('color = ?');
      params.push(dto.color.trim().slice(0, 20));
    }

    if (updates.length > 0) {
      params.push(uuid);
      await pool.execute(`UPDATE teams SET ${updates.join(', ')} WHERE uuid = ?`, params);
      logger.db.info(`Equipo ${uuid} actualizado por usuario ${currentUserId}`);
    }

    const [updated] = await pool.query<mysql.RowDataPacket[]>(
      `SELECT t.id, t.uuid, t.owner_id, t.name, t.description, t.color, t.created_at, t.updated_at,
              (SELECT COUNT(*) FROM team_members WHERE team_id = t.id) AS member_count,
              CASE WHEN t.owner_id = ? THEN 'owner' ELSE 'admin' END AS user_role
       FROM teams t WHERE t.uuid = ? LIMIT 1`,
      [currentUserId, uuid]
    );

    return updated[0] as Team;
  } catch (err: any) {
    logger.db.error(`Error al actualizar equipo ${uuid}`, err);
    throw err;
  }
}

export async function deleteTeam(uuid: string, currentUserId: number): Promise<boolean> {
  try {
    const [teamRows] = await pool.query<mysql.RowDataPacket[]>(
      'SELECT id, owner_id FROM teams WHERE uuid = ? LIMIT 1',
      [uuid]
    );

    if (teamRows.length === 0) {
      throw new Error('El equipo no existe.');
    }

    const team = teamRows[0];
    if (team.owner_id !== currentUserId) {
      throw new Error('Solo el propietario puede eliminar el equipo.');
    }

    await canvasPool.execute('DELETE FROM canvas_teams WHERE team_id = ?', [team.id]);
    await pool.execute('DELETE FROM teams WHERE id = ?', [team.id]);

    logger.db.info(`Equipo ${uuid} eliminado permanentemente por usuario ${currentUserId}`);
    return true;
  } catch (err: any) {
    logger.db.error(`Error al eliminar equipo ${uuid}`, err);
    throw err;
  }
}

export async function addTeamMember(
  uuid: string,
  currentUserId: number,
  targetUserId: number,
  role: 'admin' | 'member' = 'member'
): Promise<TeamMember> {
  try {
    const [teamRows] = await pool.query<mysql.RowDataPacket[]>(
      'SELECT id, owner_id, name FROM teams WHERE uuid = ? LIMIT 1',
      [uuid]
    );

    if (teamRows.length === 0) {
      throw new Error('El equipo no existe.');
    }

    const team = teamRows[0];

    const [adminRows] = await pool.query<mysql.RowDataPacket[]>(
      "SELECT id FROM team_members WHERE team_id = ? AND user_id = ? AND role = 'admin' LIMIT 1",
      [team.id, currentUserId]
    );

    if (team.owner_id !== currentUserId && adminRows.length === 0) {
      throw new Error('Solo administradores pueden invitar miembros al equipo.');
    }

    const [ownerRows] = await pool.query<mysql.RowDataPacket[]>(
      'SELECT subscription_tier FROM users WHERE id = ? LIMIT 1',
      [team.owner_id]
    );
    const ownerTier = ownerRows[0]?.subscription_tier || 'free';
    const tierLimits = getTierLimits(ownerTier);

    const [memberCountRows] = await pool.query<mysql.RowDataPacket[]>(
      'SELECT COUNT(id) AS total FROM team_members WHERE team_id = ?',
      [team.id]
    );
    const memberCount = Number(memberCountRows[0]?.total || 0);

    const [alreadyMember] = await pool.query<mysql.RowDataPacket[]>(
      'SELECT id FROM team_members WHERE team_id = ? AND user_id = ? LIMIT 1',
      [team.id, targetUserId]
    );
    if (alreadyMember.length === 0 && memberCount >= tierLimits.maxTeamMembers) {
      throw new Error(`El plan Pro permite un máximo de ${tierLimits.maxTeamMembers} miembros por equipo. Mejora a Negocios para miembros ilimitados.`);
    }

    const [userRows] = await pool.query<mysql.RowDataPacket[]>(
      'SELECT id, username, email, avatar_url FROM users WHERE id = ? LIMIT 1',
      [targetUserId]
    );

    if (userRows.length === 0) {
      throw new Error('El usuario seleccionado no existe.');
    }

    await pool.execute(
      `INSERT INTO team_members (team_id, user_id, role)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE role = VALUES(role)`,
      [team.id, targetUserId, role]
    );

    logger.db.info(`Usuario ${targetUserId} añadido al equipo ${uuid} con rol ${role}`);

    try {
      const [inviterRows] = await pool.query<mysql.RowDataPacket[]>(
        'SELECT username FROM users WHERE id = ? LIMIT 1',
        [currentUserId]
      );
      const inviterName = inviterRows[0]?.username || 'Un usuario';
      const roleText = role === 'admin' ? 'Administrador' : 'Miembro';
      await createNotification({
        userId: targetUserId,
        type: 'team_invite',
        title: 'Nuevo equipo',
        message: `${inviterName} te ha añadido al equipo "${team.name}" como ${roleText}.`,
        linkUrl: '/teams',
      });
    } catch (notifErr) {
      logger.app.warn('Error al enviar notificación de equipo', notifErr);
    }

    const [memberRows] = await pool.query<mysql.RowDataPacket[]>(
      `SELECT tm.id, tm.team_id, tm.user_id, tm.role, tm.created_at,
              u.username, u.email, u.avatar_url
       FROM team_members tm
       INNER JOIN users u ON tm.user_id = u.id
       WHERE tm.team_id = ? AND tm.user_id = ? LIMIT 1`,
      [team.id, targetUserId]
    );

    return memberRows[0] as TeamMember;
  } catch (err: any) {
    logger.db.error(`Error al añadir miembro a equipo ${uuid}`, err);
    throw err;
  }
}

export async function removeTeamMember(uuid: string, currentUserId: number, targetUserId: number): Promise<boolean> {
  try {
    const [teamRows] = await pool.query<mysql.RowDataPacket[]>(
      'SELECT id, owner_id FROM teams WHERE uuid = ? LIMIT 1',
      [uuid]
    );

    if (teamRows.length === 0) {
      throw new Error('El equipo no existe.');
    }

    const team = teamRows[0];

    if (targetUserId === team.owner_id) {
      throw new Error('No es posible remover al propietario del equipo.');
    }

    const isSelf = currentUserId === targetUserId;

    if (!isSelf) {
      const [adminRows] = await pool.query<mysql.RowDataPacket[]>(
        "SELECT id FROM team_members WHERE team_id = ? AND user_id = ? AND role = 'admin' LIMIT 1",
        [team.id, currentUserId]
      );

      if (team.owner_id !== currentUserId && adminRows.length === 0) {
        throw new Error('Solo administradores pueden remover miembros del equipo.');
      }
    }

    await pool.execute('DELETE FROM team_members WHERE team_id = ? AND user_id = ?', [team.id, targetUserId]);

    logger.db.info(`Usuario ${targetUserId} removido del equipo ${uuid} por usuario ${currentUserId}`);
    return true;
  } catch (err: any) {
    logger.db.error(`Error al remover miembro del equipo ${uuid}`, err);
    throw err;
  }
}
