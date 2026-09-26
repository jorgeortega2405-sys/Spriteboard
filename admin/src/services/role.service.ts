import { pool } from '../config/database.config.js';
import { RoleCategory, UserRole } from '../types/auth.types.js';
import { logger } from './logger.service.js';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';

export interface PermissionDefinition {
  description: string;
  display_name: string;
  module: string;
  name: string;
}

export interface RoleRecord extends RowDataPacket {
  category: RoleCategory;
  created_at?: Date;
  description: string | null;
  display_name: string;
  id: number;
  name: UserRole;
  updated_at?: Date;
  user_count?: number;
}

export interface RoleMatrixItem {
  category: RoleCategory;
  description: string;
  display_name: string;
  id: number;
  name: UserRole;
  permissions: string[];
  user_count: number;
}

export const PLATFORM_PERMISSIONS: readonly PermissionDefinition[] = [
  { description: 'Acceso al panel principal y métricas globales', display_name: 'Ver Dashboard', module: 'dashboard', name: 'dashboard:read' },
  { description: 'Consultar listado y perfiles de usuarios', display_name: 'Ver Usuarios', module: 'users', name: 'users:read' },
  { description: 'Modificar cuentas, correos, nombres y preferencias', display_name: 'Gestionar Usuarios', module: 'users', name: 'users:manage' },
  { description: 'Aplicar y revocar bloqueos, mutes y advertencias', display_name: 'Sancionar Usuarios', module: 'users', name: 'users:sanctions' },
  { description: 'Consultar campañas publicitarias y métricas', display_name: 'Ver Anuncios', module: 'ads', name: 'ads:read' },
  { description: 'Crear, editar y pausar campañas publicitarias', display_name: 'Gestionar Anuncios', module: 'ads', name: 'ads:manage' },
  { description: 'Consultar tickets de soporte de usuarios', display_name: 'Ver Soporte', module: 'support', name: 'support:read' },
  { description: 'Enviar respuestas a tickets de soporte', display_name: 'Responder Soporte', module: 'support', name: 'support:reply' },
  { description: 'Asignar, reabrir, transferir y cerrar tickets', display_name: 'Gestionar Soporte', module: 'support', name: 'support:manage' },
  { description: 'Ver tickets internos y solicitudes IT', display_name: 'Ver Mesa Interna', module: 'internal_tickets', name: 'internal_tickets:read' },
  { description: 'Crear solicitudes e incidencias internas', display_name: 'Crear Ticket Interno', module: 'internal_tickets', name: 'internal_tickets:create' },
  { description: 'Asignar, resolver y gestionar tickets internos', display_name: 'Gestionar Mesa Interna', module: 'internal_tickets', name: 'internal_tickets:manage' },
  { description: 'Listar copias de seguridad de la base de datos', display_name: 'Ver Backups', module: 'backups', name: 'backups:read' },
  { description: 'Crear, descargar y restaurar copias de seguridad', display_name: 'Gestionar Backups', module: 'backups', name: 'backups:manage' },
  { description: 'Consultar logs del sistema (app, bd, seguridad)', display_name: 'Ver Registros', module: 'logs', name: 'logs:read' },
  { description: 'Consultar pagos, transacciones y balances', display_name: 'Ver Facturación', module: 'billing', name: 'billing:read' },
  { description: 'Exportar reportes contables y financieros', display_name: 'Exportar Facturación', module: 'billing', name: 'billing:export' },
  { description: 'Procesar devoluciones y cancelaciones', display_name: 'Emitir Reembolsos', module: 'billing', name: 'billing:refund' },
  { description: 'Configurar pasarelas y planes de suscripción', display_name: 'Gestionar Facturación', module: 'billing', name: 'billing:manage' },
  { description: 'Consultar métricas de uso y rendimiento', display_name: 'Ver Analítica', module: 'analytics', name: 'analytics:read' },
  { description: 'Descargar datos y reportes de analítica', display_name: 'Exportar Analítica', module: 'analytics', name: 'analytics:export' },
  { description: 'Consultar solicitudes ARCO y retención de datos', display_name: 'Ver Privacidad', module: 'compliance', name: 'compliance:read' },
  { description: 'Procesar bajas de datos y auditorías GDPR', display_name: 'Gestionar Privacidad', module: 'compliance', name: 'compliance:manage' },
  { description: 'Consultar estado de tareas y automatizaciones', display_name: 'Ver Flujos', module: 'workflows', name: 'workflows:read' },
  { description: 'Ejecutar y configurar tareas programadas', display_name: 'Gestionar Flujos', module: 'workflows', name: 'workflows:manage' },
  { description: 'Consultar listado y expedientes de colaboradores', display_name: 'Ver RRHH', module: 'hr', name: 'hr:read' },
  { description: 'Modificar expedientes y estados de colaboradores', display_name: 'Gestionar RRHH', module: 'hr', name: 'hr:manage' },
  { description: 'Dar de alta y contratar nuevos colaboradores', display_name: 'Contratar Personal', module: 'hr', name: 'hr:hire' },
  { description: 'Subir, visualizar y descargar contratos y NDAs', display_name: 'Gestionar Contratos', module: 'hr', name: 'hr:contracts' },
  { description: 'Consultar datos de salarios y compensación', display_name: 'Ver Salarios', module: 'hr', name: 'hr:salary_view' },
  { description: 'Consultar catálogo de roles y permisos', display_name: 'Ver Roles', module: 'roles', name: 'roles:read' },
  { description: 'Configurar permisos y matriz RBAC', display_name: 'Gestionar Roles', module: 'roles', name: 'roles:manage' },
  { description: 'Consultar estado del servidor y configuración', display_name: 'Ver Sistema', module: 'system', name: 'system:read' },
  { description: 'Modificar configuración y modo de mantenimiento', display_name: 'Gestionar Sistema', module: 'system', name: 'system:manage' },
  { description: 'Consultar eventos y métricas de telemetría', display_name: 'Ver Telemetría', module: 'telemetry', name: 'telemetry:read' },
  { description: 'Administrar configuración corporativa SSO y SCIM', display_name: 'Gestionar Tenants', module: 'tenants', name: 'tenants:manage' },
  { description: 'Consultar catálogo público de plantillas', display_name: 'Ver Plantillas', module: 'templates', name: 'templates:read' },
  { description: 'Crear y guardar plantillas personalizadas', display_name: 'Crear Plantillas', module: 'templates', name: 'templates:create' },
  { description: 'Publicar lienzos en la galería comunitaria de plantillas', display_name: 'Publicar Plantillas', module: 'templates', name: 'templates:publish' },
  { description: 'Publicar plantillas oficiales del sistema Spriteboard', display_name: 'Publicar Plantillas Oficiales', module: 'templates', name: 'templates:official_publish' },
  { description: 'Modificar, ocultar o eliminar cualquier plantilla del sistema', display_name: 'Gestionar Todas las Plantillas', module: 'templates', name: 'templates:manage_all' },
  { description: 'Completar perfil de diseñador y handle público', display_name: 'Onboarding Diseñador', module: 'designer', name: 'designer:onboard' },
  { description: 'Acceso a métricas y panel de diseñador', display_name: 'Panel Diseñador', module: 'designer', name: 'designer:dashboard' },
  { description: 'Configurar cobros y solicitar transferencias del Creator Pool', display_name: 'Gestionar Cobros Diseñador', module: 'designer', name: 'designer:payouts' },
  { description: 'Acceso a la creación y gestión de equipos colaborativos', display_name: 'Función Equipos', module: 'subscription', name: 'subscription:feature:teams' },
  { description: 'Acceso a la creación de kits de marca', display_name: 'Función Kits de Marca', module: 'subscription', name: 'subscription:feature:brand_kits' },
  { description: 'Acceso a generación de imágenes y funciones IA avanzadas', display_name: 'Función Herramientas IA', module: 'subscription', name: 'subscription:feature:ai_tools' },
  { description: 'Acceso a configuración de SSO SAML y SCIM institucional', display_name: 'Función SSO Corporativo', module: 'subscription', name: 'subscription:feature:enterprise_sso' },
  { description: 'Subida y uso de tipografías personalizadas', display_name: 'Función Fuentes Personalizadas', module: 'subscription', name: 'subscription:feature:custom_fonts' },
  { description: 'Atención preferencial en mesa de ayuda', display_name: 'Función Soporte Prioritario', module: 'subscription', name: 'subscription:feature:priority_support' },
  { description: 'Capacidad extendida de subida de archivos', display_name: 'Función Almacenamiento Ilimitado', module: 'subscription', name: 'subscription:feature:unlimited_storage' },
  { description: 'Acceso irrestricto a todas las características premium', display_name: 'Todas las Funciones de Suscripción', module: 'subscription', name: 'subscription:feature:all' },
  { description: 'Modificar identificadores (@handle y username)', display_name: 'Editar Identificadores', module: 'account', name: 'account:edit_identifiers' },
  { description: 'Modificar credenciales de seguridad (email, password, 2FA)', display_name: 'Editar Seguridad de Cuenta', module: 'account', name: 'account:edit_security' },
  { description: 'Modificar datos de perfil (avatar, portada, biografía, enlaces)', display_name: 'Editar Perfil', module: 'account', name: 'account:edit_profile' },
  { description: 'Eliminar permanentemente la cuenta y datos asociados', display_name: 'Eliminar Cuenta', module: 'account', name: 'account:delete' },
  { description: 'Permitir reclamar handles reservados del sistema', display_name: 'Reclamar Handle Reservado', module: 'system', name: 'system:reserved_handle_claim' },
];

export const DEFAULT_ROLE_PERMISSIONS: Record<string, string[]> = {
  AUDITOR: ['dashboard:read', 'users:read', 'ads:read', 'support:read', 'internal_tickets:read', 'backups:read', 'logs:read', 'billing:read', 'analytics:read', 'compliance:read', 'workflows:read', 'roles:read', 'system:read', 'hr:read', 'account:edit_identifiers', 'account:edit_security', 'account:edit_profile', 'account:delete'],
  BILLING_AGENT: ['billing:read', 'users:read', 'account:edit_identifiers', 'account:edit_security', 'account:edit_profile', 'account:delete'],
  BILLING_MANAGER: ['dashboard:read', 'billing:read', 'billing:export', 'users:read', 'ads:read', 'analytics:read', 'account:edit_identifiers', 'account:edit_security', 'account:edit_profile', 'account:delete'],
  COMPLIANCE_ADMIN: ['dashboard:read', 'users:read', 'compliance:read', 'compliance:manage', 'logs:read', 'account:edit_identifiers', 'account:edit_security', 'account:edit_profile', 'account:delete'],
  CUSTOMER_SUCCESS: ['dashboard:read', 'users:read', 'support:read', 'billing:read', 'account:edit_identifiers', 'account:edit_security', 'account:edit_profile', 'account:delete'],
  DATA_ADMIN: ['analytics:read', 'analytics:export', 'backups:read', 'backups:manage', 'logs:read', 'system:read', 'account:edit_identifiers', 'account:edit_security', 'account:edit_profile', 'account:delete'],
  DATA_ANALYST: ['dashboard:read', 'analytics:read', 'analytics:export', 'account:edit_identifiers', 'account:edit_security', 'account:edit_profile', 'account:delete'],
  DATA_AUDITOR: ['analytics:read', 'logs:read', 'users:read', 'compliance:read', 'account:edit_identifiers', 'account:edit_security', 'account:edit_profile', 'account:delete'],
  DATA_ENGINEER: ['analytics:read', 'analytics:export', 'backups:read', 'logs:read', 'workflows:read', 'workflows:manage', 'account:edit_identifiers', 'account:edit_security', 'account:edit_profile', 'account:delete'],
  DESIGNER: ['templates:create', 'templates:publish', 'templates:read', 'designer:dashboard', 'designer:onboard', 'designer:payouts', 'account:edit_identifiers', 'account:edit_security', 'account:edit_profile', 'account:delete'],
  DEVOPS: ['dashboard:read', 'internal_tickets:read', 'internal_tickets:create', 'internal_tickets:manage', 'backups:read', 'backups:manage', 'logs:read', 'workflows:read', 'workflows:manage', 'system:read', 'system:manage', 'account:edit_identifiers', 'account:edit_security', 'account:edit_profile', 'account:delete'],
  ENGINEER: ['internal_tickets:read', 'internal_tickets:create', 'internal_tickets:manage', 'logs:read', 'account:edit_identifiers', 'account:edit_security', 'account:edit_profile', 'account:delete'],
  FINANCE_ADMIN: ['dashboard:read', 'billing:read', 'billing:export', 'billing:manage', 'ads:read', 'ads:manage', 'users:read', 'system:read', 'hr:salary_view', 'account:edit_identifiers', 'account:edit_security', 'account:edit_profile', 'account:delete'],
  HR_MANAGER: ['dashboard:read', 'hr:read', 'hr:manage', 'hr:hire', 'hr:contracts', 'hr:salary_view', 'users:read', 'internal_tickets:create', 'account:edit_identifiers', 'account:edit_security', 'account:edit_profile', 'account:delete'],
  HR_RECRUITER: ['dashboard:read', 'hr:read', 'hr:hire', 'hr:contracts', 'users:read', 'internal_tickets:create', 'account:edit_identifiers', 'account:edit_security', 'account:edit_profile', 'account:delete'],
  IAM_ADMIN: ['dashboard:read', 'users:read', 'users:manage', 'roles:read', 'roles:manage', 'logs:read', 'account:edit_identifiers', 'account:edit_security', 'account:edit_profile', 'account:delete'],
  INCIDENT_MANAGER: ['dashboard:read', 'internal_tickets:read', 'internal_tickets:create', 'internal_tickets:manage', 'support:read', 'logs:read', 'system:read', 'account:edit_identifiers', 'account:edit_security', 'account:edit_profile', 'account:delete'],
  OPERATIONS_AGENT: ['ads:read', 'ads:manage', 'support:read', 'support:reply', 'internal_tickets:read', 'internal_tickets:create', 'account:edit_identifiers', 'account:edit_security', 'account:edit_profile', 'account:delete'],
  OPERATIONS_MANAGER: ['dashboard:read', 'ads:read', 'ads:manage', 'users:read', 'support:read', 'support:manage', 'internal_tickets:read', 'internal_tickets:create', 'internal_tickets:manage', 'workflows:read', 'hr:read', 'account:edit_identifiers', 'account:edit_security', 'account:edit_profile', 'account:delete'],
  PLATFORM_ADMIN: ['*'],
  PRIVACY_ADMIN: ['users:read', 'compliance:read', 'compliance:manage', 'logs:read', 'account:edit_identifiers', 'account:edit_security', 'account:edit_profile', 'account:delete'],
  READ_ONLY_ADMIN: ['dashboard:read', 'users:read', 'internal_tickets:read', 'logs:read', 'backups:read', 'system:read', 'account:edit_identifiers', 'account:edit_security', 'account:edit_profile', 'account:delete'],
  REFUNDS_ADMIN: ['billing:read', 'billing:refund', 'users:read', 'support:read', 'account:edit_identifiers', 'account:edit_security', 'account:edit_profile', 'account:delete'],
  RELEASE_MANAGER: ['dashboard:read', 'internal_tickets:read', 'internal_tickets:create', 'internal_tickets:manage', 'workflows:read', 'workflows:manage', 'system:read', 'system:manage', 'logs:read', 'account:edit_identifiers', 'account:edit_security', 'account:edit_profile', 'account:delete'],
  SECURITY_ADMIN: ['dashboard:read', 'users:read', 'users:manage', 'users:sanctions', 'roles:read', 'roles:manage', 'logs:read', 'system:read', 'system:manage', 'internal_tickets:create', 'account:edit_identifiers', 'account:edit_security', 'account:edit_profile', 'account:delete'],
  SENIOR_ENGINEER: ['internal_tickets:read', 'internal_tickets:create', 'internal_tickets:manage', 'logs:read', 'backups:read', 'workflows:read', 'account:edit_identifiers', 'account:edit_security', 'account:edit_profile', 'account:delete'],
  SRE: ['dashboard:read', 'internal_tickets:read', 'internal_tickets:create', 'internal_tickets:manage', 'logs:read', 'backups:read', 'workflows:read', 'workflows:manage', 'system:read', 'system:manage', 'account:edit_identifiers', 'account:edit_security', 'account:edit_profile', 'account:delete'],
  SUPER_ADMIN: ['*'],
  SUPPORT_L1: ['support:read', 'support:reply', 'users:read', 'internal_tickets:create', 'account:edit_identifiers', 'account:edit_security', 'account:edit_profile', 'account:delete'],
  SUPPORT_L2: ['support:read', 'support:reply', 'support:manage', 'users:read', 'users:sanctions', 'internal_tickets:read', 'internal_tickets:create', 'account:edit_identifiers', 'account:edit_security', 'account:edit_profile', 'account:delete'],
  SUPPORT_L3: ['support:read', 'support:reply', 'support:manage', 'users:read', 'users:manage', 'users:sanctions', 'internal_tickets:read', 'internal_tickets:create', 'internal_tickets:manage', 'logs:read', 'account:edit_identifiers', 'account:edit_security', 'account:edit_profile', 'account:delete'],
  SUPPORT_MANAGER: ['dashboard:read', 'support:read', 'support:reply', 'support:manage', 'users:read', 'internal_tickets:read', 'internal_tickets:create', 'internal_tickets:manage', 'analytics:read', 'account:edit_identifiers', 'account:edit_security', 'account:edit_profile', 'account:delete'],
  SYSTEM_ACCOUNT: ['templates:read', 'templates:official_publish', 'system:reserved_handle_claim', 'dashboard:read'],
  SYSTEM_OPERATOR: ['system:read', 'system:manage', 'backups:read', 'backups:manage', 'logs:read', 'workflows:read', 'workflows:manage', 'internal_tickets:read', 'internal_tickets:create', 'account:edit_identifiers', 'account:edit_security', 'account:edit_profile', 'account:delete'],
  USER: ['templates:read', 'account:edit_identifiers', 'account:edit_security', 'account:edit_profile', 'account:delete'],
  WORKFLOW_ADMIN: ['workflows:read', 'workflows:manage', 'logs:read', 'system:read', 'account:edit_identifiers', 'account:edit_security', 'account:edit_profile', 'account:delete'],
};

export async function ensureRolePermissions(): Promise<void> {
  try {
    for (const perm of PLATFORM_PERMISSIONS) {
      await pool.query(
        `INSERT INTO permissions (name, display_name, description, module)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           display_name = VALUES(display_name),
           description = VALUES(description),
           module = VALUES(module)`,
        [perm.name, perm.display_name, perm.description, perm.module]
      );
    }

    const [allRoles] = await pool.query<RowDataPacket[]>('SELECT id, name FROM roles');
    const [allPerms] = await pool.query<RowDataPacket[]>('SELECT id, name FROM permissions');

    const roleMap = new Map<string, number>();
    for (const r of allRoles) {
      roleMap.set(String(r.name), Number(r.id));
    }

    const permMap = new Map<string, number>();
    for (const p of allPerms) {
      permMap.set(String(p.name), Number(p.id));
    }

    for (const [roleName, perms] of Object.entries(DEFAULT_ROLE_PERMISSIONS)) {
      const roleId = roleMap.get(roleName);
      if (!roleId) continue;

      const targetPerms = perms.includes('*')
        ? Array.from(permMap.keys())
        : perms;

      for (const permName of targetPerms) {
        const permId = permMap.get(permName);
        if (!permId) continue;

        await pool.query(
          `INSERT IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?)`,
          [roleId, permId]
        );
      }
    }

    logger.db.info('Permisos y asignaciones RBAC verificados y sincronizados correctamente en base de datos.');
  } catch (error) {
    logger.db.error('Error al sincronizar permisos y asignaciones RBAC en la base de datos', error);
  }
}

export async function getUserEffectivePermissions(
  userId: number,
  role?: string,
  roles?: string[]
): Promise<string[]> {
  const activeRoles: string[] = [];
  if (Array.isArray(roles) && roles.length > 0) {
    activeRoles.push(...roles);
  } else if (role) {
    activeRoles.push(role);
  }

  if (userId > 0) {
    const dbRoles = await getUserRoles(userId);
    for (const r of dbRoles) {
      if (!activeRoles.includes(r)) {
        activeRoles.push(r);
      }
    }
  }

  if (activeRoles.includes('SYSTEM_ACCOUNT')) {
    return Array.from(new Set(DEFAULT_ROLE_PERMISSIONS.SYSTEM_ACCOUNT || []));
  }

  if (activeRoles.includes('SUPER_ADMIN') || activeRoles.includes('PLATFORM_ADMIN')) {
    const all = PLATFORM_PERMISSIONS.map((p) => p.name);
    return Array.from(new Set(['*', ...all]));
  }

  const permissionSet = new Set<string>();

  for (const r of activeRoles) {
    const defPerms = DEFAULT_ROLE_PERMISSIONS[r] || [];
    for (const p of defPerms) {
      if (p === '*') {
        return Array.from(new Set(['*', ...PLATFORM_PERMISSIONS.map((x) => x.name)]));
      }
      permissionSet.add(p);
    }
  }

  if (userId > 0) {
    try {
      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT DISTINCT p.name
         FROM user_roles ur
         JOIN role_permissions rp ON ur.role_id = rp.role_id
         JOIN permissions p ON rp.permission_id = p.id
         WHERE ur.user_id = ?`,
        [userId]
      );
      for (const row of rows) {
        permissionSet.add(String(row.name));
      }
    } catch (error) {
      logger.db.error('Error al consultar permisos desde la base de datos', { error, userId });
    }
  }

  return Array.from(permissionSet);
}

export async function getAllRoles(): Promise<RoleRecord[]> {
  try {
    const [rows] = await pool.query<RoleRecord[]>(
      'SELECT id, name, display_name, description, category, created_at, updated_at FROM roles ORDER BY category ASC, id ASC'
    );
    return rows;
  } catch (error) {
    logger.db.error('Error al obtener todos los roles desde Admin', error);
    return [];
  }
}

export async function getRolesMatrix(): Promise<RoleMatrixItem[]> {
  try {
    const [roles] = await pool.query<RowDataPacket[]>(`
      SELECT 
        r.id, 
        r.name, 
        r.display_name, 
        r.description, 
        r.category,
        (SELECT COUNT(*) FROM user_roles ur WHERE ur.role_id = r.id) AS user_count
      FROM roles r
      ORDER BY r.category ASC, r.id ASC
    `);

    return roles.map((r) => {
      const roleName = String(r.name);
      return {
        category: r.category as RoleCategory,
        description: String(r.description || ''),
        display_name: String(r.display_name || r.name),
        id: Number(r.id),
        name: r.name as UserRole,
        permissions: DEFAULT_ROLE_PERMISSIONS[roleName] || ['dashboard:read'],
        user_count: Number(r.user_count || 0),
      };
    });
  } catch (error) {
    logger.db.error('Error al obtener matriz de roles y permisos', error);
    throw error;
  }
}

export async function getRoleByName(name: string): Promise<RoleRecord | null> {
  try {
    const [rows] = await pool.query<RoleRecord[]>(
      'SELECT id, name, display_name, description, category, created_at, updated_at FROM roles WHERE name = ? LIMIT 1',
      [name]
    );
    return rows.length > 0 ? rows[0] : null;
  } catch (error) {
    logger.db.error('Error al obtener rol por nombre desde Admin', { error, name });
    return null;
  }
}

export async function getUserRoles(userId: number): Promise<UserRole[]> {
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT r.name 
       FROM user_roles ur 
       INNER JOIN roles r ON ur.role_id = r.id 
       WHERE ur.user_id = ? 
       ORDER BY r.id ASC`,
      [userId]
    );
    return rows.map((row) => row.name as UserRole);
  } catch (error) {
    logger.db.error('Error al obtener roles del usuario desde Admin', { error, userId });
    return [];
  }
}

export async function userHasRole(userId: number, ...roleNames: UserRole[]): Promise<boolean> {
  try {
    if (roleNames.length === 0) return false;
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT 1 
       FROM user_roles ur 
       INNER JOIN roles r ON ur.role_id = r.id 
       WHERE ur.user_id = ? AND r.name IN (?) 
       LIMIT 1`,
      [userId, roleNames]
    );
    return rows.length > 0;
  } catch (error) {
    logger.db.error('Error al verificar roles de usuario desde Admin', { error, roleNames, userId });
    return false;
  }
}

export async function assignUserRole(
  userId: number,
  roleName: UserRole,
  assignedBy?: number
): Promise<boolean> {
  try {
    const role = await getRoleByName(roleName);
    if (!role) {
      logger.db.warn('No se puede asignar rol inexistente desde Admin', { roleName, userId });
      return false;
    }

    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO user_roles (user_id, role_id, assigned_by) 
       VALUES (?, ?, ?) 
       ON DUPLICATE KEY UPDATE assigned_by = VALUES(assigned_by)`,
      [userId, role.id, assignedBy || null]
    );

    await pool.query(
      `UPDATE users SET role = ? WHERE id = ? AND (role = 'USER' OR role IS NULL)`,
      [roleName, userId]
    );

    return result.affectedRows > 0;
  } catch (error) {
    logger.db.error('Error al asignar rol a usuario desde Admin', { error, roleName, userId });
    return false;
  }
}
