export type UserRole =
  | 'AUDITOR'
  | 'BILLING_AGENT'
  | 'BILLING_MANAGER'
  | 'COMPLIANCE_ADMIN'
  | 'CUSTOMER_SUCCESS'
  | 'DATA_ADMIN'
  | 'DATA_ANALYST'
  | 'DATA_AUDITOR'
  | 'DATA_ENGINEER'
  | 'DEVOPS'
  | 'ENGINEER'
  | 'FINANCE_ADMIN'
  | 'IAM_ADMIN'
  | 'INCIDENT_MANAGER'
  | 'OPERATIONS_AGENT'
  | 'OPERATIONS_MANAGER'
  | 'PLATFORM_ADMIN'
  | 'PRIVACY_ADMIN'
  | 'READ_ONLY_ADMIN'
  | 'REFUNDS_ADMIN'
  | 'RELEASE_MANAGER'
  | 'SECURITY_ADMIN'
  | 'SENIOR_ENGINEER'
  | 'SRE'
  | 'SUPER_ADMIN'
  | 'SUPPORT_L1'
  | 'SUPPORT_L2'
  | 'SUPPORT_L3'
  | 'SUPPORT_MANAGER'
  | 'SYSTEM_OPERATOR'
  | 'USER'
  | 'WORKFLOW_ADMIN';

export type RoleCategory = 'data' | 'engineering' | 'finance' | 'general' | 'operations' | 'platform' | 'support';

export interface RoleDefinition {
  category: RoleCategory;
  description: string;
  display_name: string;
  name: UserRole;
}

export const PLATFORM_ROLES: readonly RoleDefinition[] = [
  { category: 'platform', description: 'Acceso excepcional a toda la plataforma.', display_name: 'Super Admin', name: 'SUPER_ADMIN' },
  { category: 'platform', description: 'Administración general de la plataforma.', display_name: 'Platform Admin', name: 'PLATFORM_ADMIN' },
  { category: 'platform', description: 'IAM, MFA, SSO, sesiones, políticas de seguridad.', display_name: 'Security Admin', name: 'SECURITY_ADMIN' },
  { category: 'platform', description: 'Usuarios, grupos, roles, permisos y provisioning.', display_name: 'IAM Admin', name: 'IAM_ADMIN' },
  { category: 'platform', description: 'Compliance, retención, controles regulatorios.', display_name: 'Compliance Admin', name: 'COMPLIANCE_ADMIN' },
  { category: 'platform', description: 'Acceso prácticamente global de solo lectura.', display_name: 'Auditor', name: 'AUDITOR' },
  { category: 'platform', description: 'Administración/diagnóstico de solo lectura.', display_name: 'Read-Only Admin', name: 'READ_ONLY_ADMIN' },
  { category: 'support', description: 'Soporte básico y resolución de incidencias comunes.', display_name: 'Support L1', name: 'SUPPORT_L1' },
  { category: 'support', description: 'Soporte técnico avanzado.', display_name: 'Support L2', name: 'SUPPORT_L2' },
  { category: 'support', description: 'Soporte técnico/infraestructura avanzado.', display_name: 'Support L3', name: 'SUPPORT_L3' },
  { category: 'support', description: 'Supervisión del equipo de soporte.', display_name: 'Support Manager', name: 'SUPPORT_MANAGER' },
  { category: 'support', description: 'Gestión de clientes, cuentas y adopción.', display_name: 'Customer Success', name: 'CUSTOMER_SUCCESS' },
  { category: 'support', description: 'Coordinación de incidentes críticos.', display_name: 'Incident Manager', name: 'INCIDENT_MANAGER' },
  { category: 'engineering', description: 'Herramientas técnicas y diagnóstico.', display_name: 'Engineer', name: 'ENGINEER' },
  { category: 'engineering', description: 'Acceso técnico más amplio.', display_name: 'Senior Engineer', name: 'SENIOR_ENGINEER' },
  { category: 'engineering', description: 'Infraestructura, deployments y servicios.', display_name: 'DevOps', name: 'DEVOPS' },
  { category: 'engineering', description: 'Observabilidad, disponibilidad y operaciones de producción.', display_name: 'SRE', name: 'SRE' },
  { category: 'engineering', description: 'Releases y deployments controlados.', display_name: 'Release Manager', name: 'RELEASE_MANAGER' },
  { category: 'data', description: 'Analytics y reportes.', display_name: 'Data Analyst', name: 'DATA_ANALYST' },
  { category: 'data', description: 'Pipelines y procesamiento de datos.', display_name: 'Data Engineer', name: 'DATA_ENGINEER' },
  { category: 'data', description: 'Administración de datasets/recursos de datos.', display_name: 'Data Admin', name: 'DATA_ADMIN' },
  { category: 'data', description: 'Privacidad, solicitudes de datos y políticas.', display_name: 'Privacy Admin', name: 'PRIVACY_ADMIN' },
  { category: 'data', description: 'Auditoría de acceso y uso de datos.', display_name: 'Data Auditor', name: 'DATA_AUDITOR' },
  { category: 'finance', description: 'Consultas y operaciones de billing.', display_name: 'Billing Agent', name: 'BILLING_AGENT' },
  { category: 'finance', description: 'Gestión financiera avanzada.', display_name: 'Billing Manager', name: 'BILLING_MANAGER' },
  { category: 'finance', description: 'Configuración financiera.', display_name: 'Finance Admin', name: 'FINANCE_ADMIN' },
  { category: 'finance', description: 'Refunds/credits con permisos específicos.', display_name: 'Refunds Admin', name: 'REFUNDS_ADMIN' },
  { category: 'operations', description: 'Operaciones diarias.', display_name: 'Operations Agent', name: 'OPERATIONS_AGENT' },
  { category: 'operations', description: 'Supervisión operacional.', display_name: 'Operations Manager', name: 'OPERATIONS_MANAGER' },
  { category: 'operations', description: 'Workflows, jobs y procesos.', display_name: 'Workflow Admin', name: 'WORKFLOW_ADMIN' },
  { category: 'operations', description: 'Operaciones sensibles sobre sistemas.', display_name: 'System Operator', name: 'SYSTEM_OPERATOR' },
  { category: 'general', description: 'Usuario estándar de la plataforma.', display_name: 'Usuario', name: 'USER' },
] as const;

export interface UserPayload {
  avatar_url?: string | null;
  email: string;
  google_id?: string | null;
  id: number;
  language?: string;
  role?: UserRole;
  roles?: UserRole[];
  subscription_tier?: string;
  subscription_tier_color?: string;
  two_factor_enabled?: boolean;
  username: string;
  uuid?: string;
}

export interface SessionAccount {
  avatar_url?: string | null;
  email: string;
  google_id?: string | null;
  id: number;
  language?: string;
  last_accessed?: number;
  role?: UserRole;
  roles?: UserRole[];
  sessionId?: string;
  subscription_tier?: string;
  subscription_tier_color?: string;
  two_factor_enabled?: boolean;
  username: string;
  uuid?: string;
}

export interface MultiAccountSessionPayload {
  accounts: SessionAccount[];
  activeId: number;
  exp?: number;
  iat?: number;
  sessionId?: string;
}

export interface Pending2FALoginData {
  email: string;
  userId: number;
}

export interface GoogleTokenResponse {
  access_token: string;
  error?: string;
  error_description?: string;
  expires_in: number;
  id_token?: string;
  refresh_token?: string;
  scope: string;
  token_type: string;
}

export interface GoogleUserInfo {
  email: string;
  family_name?: string;
  given_name?: string;
  id: string;
  name: string;
  picture?: string;
  verified_email?: boolean;
}

export function isUserAdmin(role?: string, roles?: string[]): boolean {
  if (roles && Array.isArray(roles) && roles.length > 0) {
    return roles.some((r) => r !== 'USER');
  }
  return Boolean(role && role !== 'USER');
}

