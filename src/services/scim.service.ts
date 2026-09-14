import { pool } from '../config/database.config.js';
import { config } from '../config/env.config.js';
import { EnterpriseTenant, ScimListResponse, ScimPatchRequest, ScimUserResource } from '../types/enterprise.types.js';
import { hashPassword, revokeAllUserSessions } from './auth.service.js';
import { logger } from './logger.service.js';
import crypto from 'crypto';
import mysql from 'mysql2/promise';

function formatScimUser(
  user: {
    id: number;
    username: string;
    email: string;
    created_at: string;
    updated_at: string;
  },
  externalId: string,
  active: boolean
): ScimUserResource {
  const baseUrl = (config.appUrl || 'http://localhost:3000').replace(/\/+$/, '');
  return {
    schemas: ['urn:ietf:params:scim:schemas:core:2.0:User'],
    id: String(user.id),
    externalId: externalId || String(user.id),
    userName: user.email,
    displayName: user.username,
    name: {
      formatted: user.username,
      givenName: user.username.split(' ')[0] || user.username,
      familyName: user.username.split(' ').slice(1).join(' ') || '',
    },
    emails: [
      {
        value: user.email,
        primary: true,
        type: 'work',
      },
    ],
    active: Boolean(active),
    meta: {
      resourceType: 'User',
      created: new Date(user.created_at).toISOString(),
      lastModified: new Date(user.updated_at).toISOString(),
      location: `${baseUrl}/api/scim/v2/Users/${user.id}`,
    },
  };
}

export function getServiceProviderConfig(): any {
  return {
    schemas: ['urn:ietf:params:scim:schemas:core:2.0:ServiceProviderConfig'],
    documentationUri: 'https://spriteboard.com/docs/scim',
    patch: { supported: true },
    bulk: { supported: false, maxOperations: 0, maxPayloadSize: 0 },
    filter: { supported: true, maxResults: 200 },
    changePassword: { supported: false },
    sort: { supported: false },
    etag: { supported: false },
    authenticationSchemes: [
      {
        name: 'OAuth Bearer Token',
        description: 'Authentication scheme using the OAuth Bearer Token Standard RFC 6750',
        specUri: 'http://www.rfc-editor.org/info/rfc6750',
        type: 'oauthbearertoken',
        primary: true,
      },
    ],
    meta: {
      resourceType: 'ServiceProviderConfig',
      created: '2026-01-01T00:00:00.000Z',
      lastModified: '2026-01-01T00:00:00.000Z',
    },
  };
}

export function getResourceTypes(): any {
  return {
    schemas: ['urn:ietf:params:scim:api:messages:2.0:ListResponse'],
    totalResults: 1,
    startIndex: 1,
    itemsPerPage: 1,
    Resources: [
      {
        schemas: ['urn:ietf:params:scim:schemas:core:2.0:ResourceType'],
        id: 'User',
        name: 'User',
        endpoint: '/Users',
        description: 'User Account in Spriteboard',
        schema: 'urn:ietf:params:scim:schemas:core:2.0:User',
        meta: {
          resourceType: 'ResourceType',
          location: '/api/scim/v2/ResourceTypes/User',
        },
      },
    ],
  };
}

export function getSchemas(): any {
  return {
    schemas: ['urn:ietf:params:scim:api:messages:2.0:ListResponse'],
    totalResults: 1,
    startIndex: 1,
    itemsPerPage: 1,
    Resources: [
      {
        id: 'urn:ietf:params:scim:schemas:core:2.0:User',
        name: 'User',
        description: 'Core User Schema',
        attributes: [
          { name: 'userName', type: 'string', multiValued: false, required: true },
          { name: 'name', type: 'complex', multiValued: false, required: false },
          { name: 'emails', type: 'complex', multiValued: true, required: true },
          { name: 'active', type: 'boolean', multiValued: false, required: false },
        ],
      },
    ],
  };
}

export async function listScimUsers(
  tenant: EnterpriseTenant,
  options: { startIndex?: number; count?: number; filter?: string }
): Promise<ScimListResponse<ScimUserResource>> {
  try {
    const startIndex = Math.max(1, Number(options.startIndex) || 1);
    const count = Math.min(100, Math.max(1, Number(options.count) || 100));
    const offset = startIndex - 1;

    let filterEmail = '';
    let filterExternalId = '';

    if (options.filter) {
      const emailMatch = options.filter.match(/userName\s+eq\s+["']([^"']+)["']/i) ||
                         options.filter.match(/emails(\[type\s+eq\s+["']work["']\])?\.value\s+eq\s+["']([^"']+)["']/i);
      if (emailMatch) {
        filterEmail = (emailMatch[1] || emailMatch[2]).trim().toLowerCase();
      }

      const externalMatch = options.filter.match(/externalId\s+eq\s+["']([^"']+)["']/i);
      if (externalMatch) {
        filterExternalId = externalMatch[1].trim();
      }
    }

    let whereClause = 'WHERE ufi.tenant_id = ?';
    const params: any[] = [tenant.id];

    if (filterEmail) {
      whereClause += ' AND LOWER(u.email) = ?';
      params.push(filterEmail);
    }
    if (filterExternalId) {
      whereClause += ' AND ufi.external_id = ?';
      params.push(filterExternalId);
    }

    const [totalRows] = await pool.query<mysql.RowDataPacket[]>(
      `SELECT COUNT(ufi.id) AS total
       FROM user_federated_identities ufi
       INNER JOIN users u ON u.id = ufi.user_id
       ${whereClause}`,
      params
    );
    const totalResults = Number(totalRows[0]?.total) || 0;

    const [rows] = await pool.query<mysql.RowDataPacket[]>(
      `SELECT u.id, u.username, u.email, u.created_at, u.updated_at, ufi.external_id, ufi.active
       FROM user_federated_identities ufi
       INNER JOIN users u ON u.id = ufi.user_id
       ${whereClause}
       ORDER BY u.id ASC
       LIMIT ? OFFSET ?`,
      [...params, count, offset]
    );

    const resources = rows.map((r) =>
      formatScimUser(
        {
          id: r.id,
          username: r.username,
          email: r.email,
          created_at: r.created_at,
          updated_at: r.updated_at,
        },
        r.external_id,
        Boolean(r.active)
      )
    );

    return {
      schemas: ['urn:ietf:params:scim:api:messages:2.0:ListResponse'],
      totalResults,
      startIndex,
      itemsPerPage: resources.length,
      Resources: resources,
    };
  } catch (err) {
    logger.db.error('Error al listar usuarios SCIM', err);
    throw err;
  }
}

export async function getScimUserById(
  tenant: EnterpriseTenant,
  scimId: string
): Promise<ScimUserResource | null> {
  try {
    const [rows] = await pool.query<mysql.RowDataPacket[]>(
      `SELECT u.id, u.username, u.email, u.created_at, u.updated_at, ufi.external_id, ufi.active
       FROM user_federated_identities ufi
       INNER JOIN users u ON u.id = ufi.user_id
       WHERE ufi.tenant_id = ? AND (ufi.user_id = ? OR ufi.external_id = ?)
       LIMIT 1`,
      [tenant.id, scimId, scimId]
    );

    if (rows.length === 0) return null;

    const r = rows[0];
    return formatScimUser(
      {
        id: r.id,
        username: r.username,
        email: r.email,
        created_at: r.created_at,
        updated_at: r.updated_at,
      },
      r.external_id,
      Boolean(r.active)
    );
  } catch (err) {
    logger.db.error('Error al obtener usuario SCIM por ID', err);
    throw err;
  }
}

export async function createScimUser(
  tenant: EnterpriseTenant,
  body: any
): Promise<ScimUserResource> {
  try {
    const rawEmail =
      body.userName ||
      (Array.isArray(body.emails) && body.emails[0]?.value) ||
      '';
    const email = String(rawEmail).trim().toLowerCase();

    if (!email) {
      throw new Error('El atributo userName / email es requerido.');
    }

    const externalId = String(body.externalId || body.id || email).trim();
    const isActive = body.active !== undefined ? Boolean(body.active) : true;

    let displayName = (
      body.displayName ||
      (body.name ? `${body.name.givenName || ''} ${body.name.familyName || ''}`.trim() : '') ||
      email.split('@')[0]
    ).trim();

    if (!displayName) displayName = email.split('@')[0];

    const [existingFed] = await pool.query<mysql.RowDataPacket[]>(
      `SELECT ufi.*, u.username, u.email, u.created_at, u.updated_at
       FROM user_federated_identities ufi
       INNER JOIN users u ON u.id = ufi.user_id
       WHERE ufi.tenant_id = ? AND (ufi.external_id = ? OR LOWER(u.email) = ?)
       LIMIT 1`,
      [tenant.id, externalId, email]
    );

    let userId: number;
    let userRow: any;

    if (existingFed.length > 0) {
      userRow = existingFed[0];
      userId = userRow.user_id;

      await pool.execute(
        `UPDATE user_federated_identities SET external_id = ?, active = ?, updated_at = NOW() WHERE id = ?`,
        [externalId, isActive, userRow.id]
      );
    } else {
      const [existingUser] = await pool.query<mysql.RowDataPacket[]>(
        'SELECT * FROM users WHERE LOWER(email) = ? LIMIT 1',
        [email]
      );

      const targetTier = tenant.tenant_type === 'university'
        ? 'pro'
        : (tenant.tenant_type === 'school' ? 'escuelas' : 'business');

      if (existingUser.length > 0) {
        userId = existingUser[0].id;
        userRow = existingUser[0];

        await pool.execute(
          `UPDATE users SET subscription_tier = ? WHERE id = ?`,
          [targetTier, userId]
        );
      } else {
        const randomPassword = crypto.randomBytes(24).toString('hex');
        const passHash = await hashPassword(randomPassword);

        let uniqueUsername = displayName.replace(/[^a-zA-Z0-9_-]/g, '');
        if (uniqueUsername.length < 3) uniqueUsername = `user_${crypto.randomBytes(3).toString('hex')}`;
        if (uniqueUsername.length > 30) uniqueUsername = uniqueUsername.substring(0, 30);

        const [dupeRows] = await pool.query<mysql.RowDataPacket[]>(
          'SELECT id FROM users WHERE username = ? LIMIT 1',
          [uniqueUsername]
        );
        if (dupeRows.length > 0) {
          uniqueUsername = `${uniqueUsername.substring(0, 24)}_${Math.floor(1000 + Math.random() * 9000)}`;
        }

        const [insertUser] = await pool.execute<mysql.ResultSetHeader>(
          `INSERT INTO users (username, email, password_hash, subscription_tier)
           VALUES (?, ?, ?, ?)`,
          [uniqueUsername, email, passHash, targetTier]
        );

        userId = insertUser.insertId;
        userRow = {
          id: userId,
          username: uniqueUsername,
          email,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
      }

      await pool.execute(
        `INSERT INTO user_federated_identities (tenant_id, user_id, external_id, active)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE external_id = VALUES(external_id), active = VALUES(active)`,
        [tenant.id, userId, externalId, isActive]
      );

      if (tenant.tenant_type === 'university') {
        await pool.execute(
          `INSERT INTO university_members (tenant_id, user_id, academic_role, status)
           VALUES (?, ?, 'student', ?)
           ON DUPLICATE KEY UPDATE status = VALUES(status)`,
          [tenant.id, userId, isActive ? 'active' : 'suspended']
        );
      }
    }

    if (tenant.target_team_id) {
      await pool.execute(
        `INSERT IGNORE INTO team_members (team_id, user_id, role) VALUES (?, ?, 'member')`,
        [tenant.target_team_id, userId]
      );
    }

    logger.security.info('Usuario SCIM aprovisionado exitosamente', {
      tenantId: tenant.id,
      userId,
      email,
      externalId,
    });

    return formatScimUser(
      {
        id: userId,
        username: userRow.username,
        email: userRow.email,
        created_at: userRow.created_at,
        updated_at: userRow.updated_at,
      },
      externalId,
      isActive
    );
  } catch (err) {
    logger.security.error('Error al aprovisionar usuario SCIM', err);
    throw err;
  }
}

export async function patchScimUser(
  tenant: EnterpriseTenant,
  scimId: string,
  patchReq: ScimPatchRequest
): Promise<ScimUserResource> {
  try {
    const [rows] = await pool.query<mysql.RowDataPacket[]>(
      `SELECT u.id, u.username, u.email, u.created_at, u.updated_at, ufi.id AS fed_id, ufi.external_id, ufi.active
       FROM user_federated_identities ufi
       INNER JOIN users u ON u.id = ufi.user_id
       WHERE ufi.tenant_id = ? AND (ufi.user_id = ? OR ufi.external_id = ?)
       LIMIT 1`,
      [tenant.id, scimId, scimId]
    );

    if (rows.length === 0) {
      throw new Error('Usuario SCIM no encontrado.');
    }

    const r = rows[0];
    let newActive = Boolean(r.active);

    const operations = Array.isArray(patchReq.Operations) ? patchReq.Operations : [];

    for (const op of operations) {
      const opType = (op.op || '').toLowerCase();
      const path = (op.path || '').toLowerCase();
      const val = op.value;

      if (opType === 'replace' || opType === 'add') {
        if (path === 'active') {
          newActive = Boolean(val);
        } else if (typeof val === 'object' && val !== null && val.active !== undefined) {
          newActive = Boolean(val.active);
        }
      }
    }

    if (newActive !== Boolean(r.active)) {
      await pool.execute(
        `UPDATE user_federated_identities SET active = ?, updated_at = NOW() WHERE id = ?`,
        [newActive, r.fed_id]
      );

      if (!newActive) {
        await revokeAllUserSessions(r.id);
        logger.security.info('Usuario SCIM suspendido y sesiones revocadas', {
          tenantId: tenant.id,
          userId: r.id,
        });
      } else {
        logger.security.info('Usuario SCIM reactivado', {
          tenantId: tenant.id,
          userId: r.id,
        });
      }
    }

    return formatScimUser(
      {
        id: r.id,
        username: r.username,
        email: r.email,
        created_at: r.created_at,
        updated_at: new Date().toISOString(),
      },
      r.external_id,
      newActive
    );
  } catch (err) {
    logger.security.error('Error al ejecutar PATCH en usuario SCIM', err);
    throw err;
  }
}

export async function deleteScimUser(
  tenant: EnterpriseTenant,
  scimId: string
): Promise<void> {
  try {
    const [rows] = await pool.query<mysql.RowDataPacket[]>(
      `SELECT ufi.id, ufi.user_id
       FROM user_federated_identities ufi
       WHERE ufi.tenant_id = ? AND (ufi.user_id = ? OR ufi.external_id = ?)
       LIMIT 1`,
      [tenant.id, scimId, scimId]
    );

    if (rows.length === 0) return;

    const fedId = rows[0].id;
    const userId = rows[0].user_id;

    await pool.execute(
      `UPDATE user_federated_identities SET active = FALSE WHERE id = ?`,
      [fedId]
    );

    await revokeAllUserSessions(userId);

    if (tenant.target_team_id) {
      await pool.execute(
        `DELETE FROM team_members WHERE team_id = ? AND user_id = ?`,
        [tenant.target_team_id, userId]
      );
    }

    logger.security.info('Usuario SCIM desasociado y suspendido', {
      tenantId: tenant.id,
      userId,
    });
  } catch (err) {
    logger.security.error('Error al eliminar usuario SCIM', err);
    throw err;
  }
}
