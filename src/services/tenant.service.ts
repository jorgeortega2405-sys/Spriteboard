import { pool } from '../config/database.config.js';
import { config } from '../config/env.config.js';
import { EnterpriseTenant, EnterpriseTenantType } from '../types/enterprise.types.js';
import { logger } from './logger.service.js';
import crypto from 'crypto';
import mysql from 'mysql2/promise';

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token.trim()).digest('hex');
}

const DISALLOWED_DOMAINS = new Set([
  'aol.com',
  'gmail.com',
  'gmx.com',
  'googlemail.com',
  'hotmail.com',
  'icloud.com',
  'live.com',
  'mac.com',
  'mail.com',
  'me.com',
  'msn.com',
  'outlook.com',
  'proton.me',
  'protonmail.com',
  'yandex.com',
  'yandex.ru',
  'yahoo.com',
  'ymail.com',
  'zoho.com',
]);

export function cleanDomain(rawDomain: string): string {
  const clean = rawDomain
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/^@/, '')
    .split('/')[0]
    .split(':')[0];

  if (!clean || !clean.includes('.') || clean.startsWith('.') || clean.endsWith('.')) {
    throw new Error('El formato del dominio no es válido.');
  }

  if (DISALLOWED_DOMAINS.has(clean)) {
    throw new Error('No se permite el uso de dominios de correo electrónico público o gratuito.');
  }

  return clean;
}

export async function getTenantById(id: number): Promise<EnterpriseTenant | null> {
  try {
    const [rows] = await pool.query<mysql.RowDataPacket[]>(
      `SELECT t.*,
              (SELECT COUNT(id) FROM user_federated_identities WHERE tenant_id = t.id AND active = TRUE) AS users_count
       FROM enterprise_tenants t
       WHERE t.id = ?
       LIMIT 1`,
      [id]
    );

    if (rows.length === 0) {
      return null;
    }

    const r = rows[0];
    return {
      id: r.id,
      uuid: r.uuid,
      owner_id: r.owner_id,
      tenant_type: r.tenant_type,
      name: r.name,
      domain: r.domain,
      sso_enabled: Boolean(r.sso_enabled),
      idp_entity_id: r.idp_entity_id,
      idp_sso_url: r.idp_sso_url,
      idp_certificate: r.idp_certificate,
      scim_enabled: Boolean(r.scim_enabled),
      scim_token_hash: r.scim_token_hash,
      target_team_id: r.target_team_id,
      created_at: r.created_at,
      updated_at: r.updated_at,
      users_count: Number(r.users_count) || 0,
    };
  } catch (err) {
    logger.db.error('Error al consultar tenant por id', err);
    throw err;
  }
}

export async function getTenantByOwner(
  ownerId: number,
  tenantType?: EnterpriseTenantType
): Promise<EnterpriseTenant | null> {
  try {
    let rows: mysql.RowDataPacket[] = [];
    if (tenantType) {
      const [specific] = await pool.query<mysql.RowDataPacket[]>(
        `SELECT t.*,
                (SELECT COUNT(id) FROM user_federated_identities WHERE tenant_id = t.id AND active = TRUE) AS users_count
         FROM enterprise_tenants t
         WHERE t.owner_id = ? AND t.tenant_type = ?
         LIMIT 1`,
        [ownerId, tenantType]
      );
      rows = specific;
    }

    if (rows.length === 0) {
      const [fallback] = await pool.query<mysql.RowDataPacket[]>(
        `SELECT t.*,
                (SELECT COUNT(id) FROM user_federated_identities WHERE tenant_id = t.id AND active = TRUE) AS users_count
         FROM enterprise_tenants t
         WHERE t.owner_id = ?
         ORDER BY t.id DESC
         LIMIT 1`,
        [ownerId]
      );
      rows = fallback;
    }

    if (rows.length === 0) {
      return null;
    }

    const r = rows[0];
    return {
      id: r.id,
      uuid: r.uuid,
      owner_id: r.owner_id,
      tenant_type: r.tenant_type,
      name: r.name,
      domain: r.domain,
      sso_enabled: Boolean(r.sso_enabled),
      idp_entity_id: r.idp_entity_id,
      idp_sso_url: r.idp_sso_url,
      idp_certificate: r.idp_certificate,
      scim_enabled: Boolean(r.scim_enabled),
      scim_token_hash: r.scim_token_hash,
      target_team_id: r.target_team_id,
      created_at: r.created_at,
      updated_at: r.updated_at,
      users_count: Number(r.users_count) || 0,
    };
  } catch (err) {
    logger.db.error('Error al consultar tenant por owner', err);
    throw err;
  }
}

export async function getTenantByDomain(domain: string): Promise<EnterpriseTenant | null> {
  try {
    const clean = cleanDomain(domain);
    if (!clean) return null;

    const [rows] = await pool.query<mysql.RowDataPacket[]>(
      `SELECT * FROM enterprise_tenants WHERE domain = ? LIMIT 1`,
      [clean]
    );

    if (rows.length === 0) return null;

    const r = rows[0];
    return {
      id: r.id,
      uuid: r.uuid,
      owner_id: r.owner_id,
      tenant_type: r.tenant_type,
      name: r.name,
      domain: r.domain,
      sso_enabled: Boolean(r.sso_enabled),
      idp_entity_id: r.idp_entity_id,
      idp_sso_url: r.idp_sso_url,
      idp_certificate: r.idp_certificate,
      scim_enabled: Boolean(r.scim_enabled),
      scim_token_hash: r.scim_token_hash,
      target_team_id: r.target_team_id,
      created_at: r.created_at,
      updated_at: r.updated_at,
    };
  } catch (err) {
    logger.db.error('Error al consultar tenant por dominio', err);
    throw err;
  }
}

export async function getTenantByUuid(uuid: string): Promise<EnterpriseTenant | null> {
  try {
    const [rows] = await pool.query<mysql.RowDataPacket[]>(
      `SELECT * FROM enterprise_tenants WHERE uuid = ? LIMIT 1`,
      [uuid]
    );

    if (rows.length === 0) return null;

    const r = rows[0];
    return {
      id: r.id,
      uuid: r.uuid,
      owner_id: r.owner_id,
      tenant_type: r.tenant_type,
      name: r.name,
      domain: r.domain,
      sso_enabled: Boolean(r.sso_enabled),
      idp_entity_id: r.idp_entity_id,
      idp_sso_url: r.idp_sso_url,
      idp_certificate: r.idp_certificate,
      scim_enabled: Boolean(r.scim_enabled),
      scim_token_hash: r.scim_token_hash,
      target_team_id: r.target_team_id,
      created_at: r.created_at,
      updated_at: r.updated_at,
    };
  } catch (err) {
    logger.db.error('Error al consultar tenant por UUID', err);
    throw err;
  }
}

export async function getTenantByScimToken(rawToken: string): Promise<EnterpriseTenant | null> {
  try {
    const hash = hashToken(rawToken);
    const [rows] = await pool.query<mysql.RowDataPacket[]>(
      `SELECT * FROM enterprise_tenants WHERE scim_token_hash = ? AND scim_enabled = TRUE LIMIT 1`,
      [hash]
    );

    if (rows.length === 0) return null;

    const r = rows[0];
    return {
      id: r.id,
      uuid: r.uuid,
      owner_id: r.owner_id,
      tenant_type: r.tenant_type,
      name: r.name,
      domain: r.domain,
      sso_enabled: Boolean(r.sso_enabled),
      idp_entity_id: r.idp_entity_id,
      idp_sso_url: r.idp_sso_url,
      idp_certificate: r.idp_certificate,
      scim_enabled: Boolean(r.scim_enabled),
      scim_token_hash: r.scim_token_hash,
      target_team_id: r.target_team_id,
      created_at: r.created_at,
      updated_at: r.updated_at,
    };
  } catch (err) {
    logger.db.error('Error al consultar tenant por token SCIM', err);
    throw err;
  }
}

export async function upsertTenant(
  ownerId: number,
  dto: {
    tenant_type?: EnterpriseTenantType;
    name?: string;
    domain: string;
    sso_enabled?: boolean;
    idp_entity_id?: string;
    idp_sso_url?: string;
    idp_certificate?: string;
    scim_enabled?: boolean;
    target_team_id?: number | null;
  }
): Promise<EnterpriseTenant> {
  try {
    const clean = cleanDomain(dto.domain);
    if (!clean) {
      throw new Error('El dominio corporativo es obligatorio.');
    }

    const type = dto.tenant_type || 'business';
    const name = (dto.name || `Organización ${clean}`).trim();

    const [domainRows] = await pool.query<mysql.RowDataPacket[]>(
      'SELECT id, owner_id FROM enterprise_tenants WHERE domain = ? LIMIT 1',
      [clean]
    );

    if (domainRows.length > 0 && domainRows[0].owner_id !== ownerId) {
      throw new Error('Este dominio ya se encuentra registrado por otra organización.');
    }

    const existing = await getTenantByOwner(ownerId, type);

    if (existing) {
      await pool.execute(
        `UPDATE enterprise_tenants
         SET name = ?,
             domain = ?,
             sso_enabled = COALESCE(?, sso_enabled),
             idp_entity_id = COALESCE(?, idp_entity_id),
             idp_sso_url = COALESCE(?, idp_sso_url),
             idp_certificate = COALESCE(?, idp_certificate),
             scim_enabled = COALESCE(?, scim_enabled),
             target_team_id = COALESCE(?, target_team_id)
         WHERE id = ?`,
        [
          name,
          clean,
          dto.sso_enabled !== undefined ? dto.sso_enabled : null,
          dto.idp_entity_id !== undefined ? dto.idp_entity_id : null,
          dto.idp_sso_url !== undefined ? dto.idp_sso_url : null,
          dto.idp_certificate !== undefined ? dto.idp_certificate : null,
          dto.scim_enabled !== undefined ? dto.scim_enabled : null,
          dto.target_team_id !== undefined ? dto.target_team_id : null,
          existing.id,
        ]
      );
      logger.security.info('Configuración de Enterprise Tenant actualizada', { tenantId: existing.id, domain: clean });
      return (await getTenantByOwner(ownerId, type))!;
    }

    const uuid = crypto.randomUUID();
    const [result] = await pool.execute<mysql.ResultSetHeader>(
      `INSERT INTO enterprise_tenants
       (uuid, owner_id, tenant_type, name, domain, sso_enabled, idp_entity_id, idp_sso_url, idp_certificate, scim_enabled, target_team_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        uuid,
        ownerId,
        type,
        name,
        clean,
        dto.sso_enabled || false,
        dto.idp_entity_id || null,
        dto.idp_sso_url || null,
        dto.idp_certificate || null,
        dto.scim_enabled || false,
        dto.target_team_id || null,
      ]
    );

    logger.security.info('Enterprise Tenant creado con éxito', { tenantId: result.insertId, domain: clean });
    return (await getTenantByOwner(ownerId, type))!;
  } catch (err) {
    logger.db.error('Error al guardar Enterprise Tenant', err);
    throw err;
  }
}

export async function generateScimToken(
  tenantId: number
): Promise<{ token: string; scimUrl: string }> {
  try {
    const rawToken = `sp_scim_${crypto.randomBytes(32).toString('hex')}`;
    const hash = hashToken(rawToken);

    await pool.execute(
      `UPDATE enterprise_tenants SET scim_token_hash = ?, scim_enabled = TRUE WHERE id = ?`,
      [hash, tenantId]
    );

    const baseUrl = config.appUrl || 'http://localhost:3000';
    const scimUrl = `${baseUrl.replace(/\/+$/, '')}/api/scim/v2`;

    logger.security.info('Nuevo token SCIM generado para tenant', { tenantId });

    return {
      token: rawToken,
      scimUrl,
    };
  } catch (err) {
    logger.db.error('Error al generar token SCIM', err);
    throw err;
  }
}

export async function revokeScimToken(tenantId: number): Promise<void> {
  try {
    await pool.execute(
      `UPDATE enterprise_tenants SET scim_token_hash = NULL, scim_enabled = FALSE WHERE id = ?`,
      [tenantId]
    );
    logger.security.info('Token SCIM revocado para tenant', { tenantId });
  } catch (err) {
    logger.db.error('Error al revocar token SCIM', err);
    throw err;
  }
}
