import { SubscriptionTierId } from './subscription.types.js';

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
  | 'DESIGNER'
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
  { category: 'general', description: 'Diseñador con permisos de publicación de plantillas.', display_name: 'Diseñador', name: 'DESIGNER' },
  { category: 'general', description: 'Usuario estándar de la plataforma.', display_name: 'Usuario', name: 'USER' },
] as const;

export const USER_ROLES = PLATFORM_ROLES.map((r) => r.name) as readonly UserRole[];

export const DEFAULT_USER_ROLE: UserRole = 'USER';

export interface PermissionDefinition {
  description: string;
  display_name: string;
  module: string;
  name: string;
}

export interface UserPayload {
  id: number;
  username: string;
  email: string;
  avatar_url?: string | null;
  banner_url?: string | null;
  bio?: string | null;
  country?: string | null;
  website_url?: string | null;
  social_links?: Record<string, string> | null;
  designer_handle?: string | null;
  designer_handle_changed_at?: string | null;
  designer_onboarded?: boolean;
  role?: UserRole;
  roles?: UserRole[];
  permissions?: string[];
  google_id?: string | null;
  subscription_tier?: SubscriptionTierId;
  subscription_tier_color?: string;
  two_factor_enabled?: boolean;
  is_protected?: boolean;
}

export interface SessionAccount {
  id: number;
  username: string;
  email: string;
  avatar_url?: string | null;
  banner_url?: string | null;
  bio?: string | null;
  country?: string | null;
  website_url?: string | null;
  social_links?: Record<string, string> | null;
  designer_handle?: string | null;
  designer_handle_changed_at?: string | null;
  designer_onboarded?: boolean;
  role?: UserRole;
  roles?: UserRole[];
  permissions?: string[];
  google_id?: string | null;
  subscription_tier?: SubscriptionTierId;
  subscription_tier_color?: string;
  two_factor_enabled?: boolean;
  is_protected?: boolean;
  sessionId?: string;
  last_accessed?: number;
}

export interface MultiAccountSessionPayload {
  activeId: number;
  sessionId?: string;
  accounts: SessionAccount[];
  iat?: number;
  exp?: number;
}

export interface ActiveSessionData {
  sessionId: string;
  userId: number;
  ip?: string;
  userAgent?: string;
  countryCode?: string | null;
  countryName?: string | null;
  city?: string | null;
  asn?: string | null;
  isp?: string | null;
  createdAt: number;
  lastActiveAt: number;
}

export interface GoogleTokenResponse {
  access_token: string;
  expires_in: number;
  scope: string;
  token_type: string;
  id_token?: string;
  refresh_token?: string;
  error?: string;
  error_description?: string;
}

export interface GoogleUserInfo {
  id: string;
  email: string;
  verified_email?: boolean;
  name: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
}
