import { pool } from '../config/database.config.js';
import { config } from '../config/env.config.js';
import { hashPassword, updateUserSubscriptionInSessions } from './auth.service.js';
import { logger } from './logger.service.js';
import { resolveHigherTier } from './subscription.service.js';
import { cleanDomain, getTenantByDomain, getTenantByUuid } from './tenant.service.js';
import { EnterpriseTenant } from '../types/enterprise.types.js';
import { UserPayload, UserRole } from '../types/auth.types.js';
import crypto from 'crypto';
import mysql from 'mysql2/promise';

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export async function checkDomainSso(rawDomain: string): Promise<{
  ssoEnabled: boolean;
  tenantName?: string;
  tenantUuid?: string;
  loginUrl?: string;
}> {
  try {
    const domain = cleanDomain(rawDomain);
    if (!domain) {
      return { ssoEnabled: false };
    }

    const tenant = await getTenantByDomain(domain);
    if (!tenant || !tenant.sso_enabled) {
      return { ssoEnabled: false };
    }

    const baseUrl = (config.appUrl || 'http://localhost:3000').replace(/\/+$/, '');
    const loginUrl = `${baseUrl}/api/auth/sso/saml/login/${tenant.uuid}`;

    return {
      ssoEnabled: true,
      tenantName: tenant.name,
      tenantUuid: tenant.uuid,
      loginUrl,
    };
  } catch (err) {
    logger.db.error('Error al verificar SSO por dominio', err);
    return { ssoEnabled: false };
  }
}

export async function getSpMetadataXml(tenantUuid: string): Promise<string> {
  const tenant = await getTenantByUuid(tenantUuid);
  if (!tenant) {
    throw new Error('Organización no encontrada.');
  }

  const baseUrl = (config.appUrl || 'http://localhost:3000').replace(/\/+$/, '');
  const entityId = `${baseUrl}/api/auth/sso/saml/metadata/${tenant.uuid}`;
  const acsUrl = `${baseUrl}/api/auth/sso/saml/callback`;
  const safeName = escapeXml(tenant.name);

  return `<?xml version="1.0" encoding="UTF-8"?>
<md:EntityDescriptor xmlns:md="urn:oasis:names:tc:SAML:2.0:metadata" entityID="${entityId}">
  <md:SPSSODescriptor AuthnRequestsSigned="false" WantAssertionsSigned="true" protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">
    <md:NameIDFormat>urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress</md:NameIDFormat>
    <md:AssertionConsumerService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST" Location="${acsUrl}" index="1" isDefault="true"/>
  </md:SPSSODescriptor>
  <md:Organization>
    <md:OrganizationName xml:lang="es">${safeName}</md:OrganizationName>
    <md:OrganizationDisplayName xml:lang="es">${safeName} en Spriteboard</md:OrganizationDisplayName>
    <md:OrganizationURL xml:lang="es">${baseUrl}</md:OrganizationURL>
  </md:Organization>
</md:EntityDescriptor>`;
}

export async function resolveOrProvisionFederatedUser(
  tenant: EnterpriseTenant,
  email: string,
  externalId?: string,
  displayName?: string
): Promise<UserPayload> {
  try {
    const cleanEmail = email.trim().toLowerCase();
    const cleanExtId = (externalId || cleanEmail).trim();
    const emailDomain = cleanEmail.split('@')[1] || '';

    if (emailDomain.toLowerCase() !== tenant.domain.toLowerCase()) {
      logger.security.warn('Rechazado intento de federación SSO con dominio incompatible', {
        tenantDomain: tenant.domain,
        userEmail: cleanEmail,
      });
      throw new Error('El dominio del correo no coincide con la organización.');
    }

    const [userRows] = await pool.query<mysql.RowDataPacket[]>(
      `SELECT * FROM users WHERE LOWER(email) = ? LIMIT 1`,
      [cleanEmail]
    );

    let userId: number;
    let username: string;
    let role: UserRole = 'user';
    let avatarUrl: string | null = null;
    let targetTier = 'business';

    if (userRows.length > 0) {
      userId = userRows[0].id;
      username = userRows[0].username;
      role = (userRows[0].role as UserRole) || 'user';
      avatarUrl = userRows[0].avatar_url || null;

      const existingTier = (userRows[0].subscription_tier || 'free').toLowerCase();
      const effectiveTier = resolveHigherTier(existingTier, targetTier);

      await pool.execute(
        `UPDATE users SET subscription_tier = ? WHERE id = ?`,
        [effectiveTier, userId]
      );
      await updateUserSubscriptionInSessions(userId, effectiveTier);
    } else {
      let uniqueUsername = (displayName || cleanEmail.split('@')[0])
        .replace(/[^a-zA-Z0-9_-]/g, '')
        .trim();
      if (uniqueUsername.length < 3) uniqueUsername = `user_${crypto.randomBytes(3).toString('hex')}`;
      if (uniqueUsername.length > 30) uniqueUsername = uniqueUsername.substring(0, 30);

      const [dupes] = await pool.query<mysql.RowDataPacket[]>(
        `SELECT id FROM users WHERE username = ? LIMIT 1`,
        [uniqueUsername]
      );
      if (dupes.length > 0) {
        uniqueUsername = `${uniqueUsername.substring(0, 24)}_${Math.floor(1000 + Math.random() * 9000)}`;
      }

      const randomPass = crypto.randomBytes(24).toString('hex');
      const passHash = await hashPassword(randomPass);

      const [insertRes] = await pool.execute<mysql.ResultSetHeader>(
        `INSERT INTO users (username, email, password_hash, subscription_tier) VALUES (?, ?, ?, ?)`,
        [uniqueUsername, cleanEmail, passHash, targetTier]
      );

      userId = insertRes.insertId;
      username = uniqueUsername;
    }

    await pool.execute(
      `INSERT INTO user_federated_identities (tenant_id, user_id, external_id, active)
       VALUES (?, ?, ?, TRUE)
       ON DUPLICATE KEY UPDATE active = TRUE, external_id = VALUES(external_id)`,
      [tenant.id, userId, cleanExtId]
    );

    if (tenant.target_team_id) {
      await pool.execute(
        `INSERT IGNORE INTO team_members (team_id, user_id, role) VALUES (?, ?, 'member')`,
        [tenant.target_team_id, userId]
      );
    }

    logger.security.info('Usuario autenticado vía SSO institucional', {
      tenantId: tenant.id,
      userId,
      email: cleanEmail,
    });

    return {
      id: userId,
      username,
      email: cleanEmail,
      avatar_url: avatarUrl,
      role,
      subscription_tier: targetTier as any,
    };
  } catch (err) {
    logger.security.error('Error al aprovisionar usuario federado en SSO', err);
    throw err;
  }
}
