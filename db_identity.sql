CREATE DATABASE IF NOT EXISTS db_identity;
USE db_identity;

CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    uuid VARCHAR(36) NULL UNIQUE,
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NULL,
    google_id VARCHAR(255) NULL UNIQUE,
    avatar_url VARCHAR(512) NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'USER',
    subscription_tier VARCHAR(20) NOT NULL DEFAULT 'free', -- 'free', 'pro', 'business'
    stripe_customer_id VARCHAR(255) NULL,
    stripe_subscription_id VARCHAR(255) NULL,
    subscription_status VARCHAR(50) NOT NULL DEFAULT 'active',
    subscription_period_end TIMESTAMP NULL,
    force_password_change TINYINT(1) NOT NULL DEFAULT 0,
    two_factor_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    two_factor_secret VARCHAR(255) NULL,
    two_factor_recovery_codes TEXT NULL,
    registration_ip VARCHAR(45) NULL,
    registration_country_code VARCHAR(10) NULL,
    registration_country_name VARCHAR(100) NULL,
    registration_region VARCHAR(100) NULL,
    registration_city VARCHAR(100) NULL,
    registration_asn VARCHAR(50) NULL,
    registration_isp VARCHAR(255) NULL,
    last_login_ip VARCHAR(45) NULL,
    last_login_country VARCHAR(100) NULL,
    last_login_city VARCHAR(100) NULL,
    last_login_asn VARCHAR(50) NULL,
    last_login_isp VARCHAR(255) NULL,
    last_login_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    username_changed_at TIMESTAMP NULL,
    email_changed_at TIMESTAMP NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_preferences (
    user_id INT PRIMARY KEY,
    theme VARCHAR(20) NOT NULL DEFAULT 'system',
    language VARCHAR(50) NOT NULL DEFAULT 'en-US',
    open_links_new_tab BOOLEAN NOT NULL DEFAULT TRUE,
    telemetry BOOLEAN NOT NULL DEFAULT FALSE,
    reduce_motion BOOLEAN NOT NULL DEFAULT FALSE,
    high_contrast BOOLEAN NOT NULL DEFAULT FALSE,
    extended_alerts BOOLEAN NOT NULL DEFAULT FALSE,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_audit_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    action VARCHAR(50) NOT NULL,
    old_value TEXT NULL,
    new_value TEXT NULL,
    ip_address VARCHAR(45) NULL,
    user_agent VARCHAR(255) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_audit_user_created (user_id, created_at),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_favorites (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    item_type ENUM('canvas', 'template') NOT NULL,
    item_id VARCHAR(64) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_user_favorite (user_id, item_type, item_id),
    INDEX idx_user_fav_lookup (user_id, item_type),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS purchases (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    stripe_session_id VARCHAR(255) NOT NULL UNIQUE,
    stripe_payment_intent_id VARCHAR(255) NULL,
    stripe_subscription_id VARCHAR(255) NULL,
    stripe_customer_id VARCHAR(255) NULL,
    plan_id VARCHAR(50) NOT NULL,
    billing_period VARCHAR(20) NOT NULL,
    amount_total DECIMAL(10, 2) NOT NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'USD',
    status VARCHAR(50) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_purchases_user (user_id),
    INDEX idx_purchases_session (stripe_session_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS teams (
    id INT AUTO_INCREMENT PRIMARY KEY,
    uuid VARCHAR(36) NOT NULL UNIQUE,
    owner_id INT NOT NULL,
    name VARCHAR(100) NOT NULL,
    description VARCHAR(255) NULL,
    team_type ENUM('team', 'classroom') NOT NULL DEFAULT 'team',
    join_code VARCHAR(16) NULL UNIQUE,
    school_id INT NULL,
    color VARCHAR(20) NOT NULL DEFAULT '#6366f1',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_teams_owner (owner_id),
    INDEX idx_teams_school (school_id),
    INDEX idx_teams_type (team_type),
    FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS school_organizations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    uuid VARCHAR(36) NOT NULL UNIQUE,
    admin_id INT NOT NULL,
    name VARCHAR(150) NOT NULL,
    domain VARCHAR(100) NULL,
    max_teachers INT NOT NULL DEFAULT 50,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_school_admin (admin_id),
    FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS school_teachers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    school_id INT NOT NULL,
    user_id INT NOT NULL,
    status ENUM('invited', 'active', 'revoked') NOT NULL DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_school_teacher (school_id, user_id),
    INDEX idx_school_teachers_user (user_id),
    FOREIGN KEY (school_id) REFERENCES school_organizations(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS team_members (
    id INT AUTO_INCREMENT PRIMARY KEY,
    team_id INT NOT NULL,
    user_id INT NOT NULL,
    role ENUM('admin', 'member') NOT NULL DEFAULT 'member',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_team_user (team_id, user_id),
    INDEX idx_team_members_user (user_id),
    INDEX idx_team_members_team_role (team_id, role),
    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS notifications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    link_url VARCHAR(512) NULL,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    read_at TIMESTAMP NULL DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_notif_user_read (user_id, is_read, created_at DESC),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ai_chat_feedback (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NULL,
    message_text TEXT NOT NULL,
    rating ENUM('like', 'dislike') NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_ai_feedback_user (user_id),
    INDEX idx_ai_feedback_rating (rating),
    INDEX idx_ai_feedback_created_at (created_at),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS enterprise_tenants (
    id INT AUTO_INCREMENT PRIMARY KEY,
    uuid VARCHAR(36) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    domain VARCHAR(255) NOT NULL UNIQUE,
    idp_entity_id VARCHAR(512) NULL,
    idp_sso_url VARCHAR(512) NULL,
    idp_certificate TEXT NULL,
    scim_token_hash VARCHAR(255) NULL,
    scim_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    sso_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    enforce_sso BOOLEAN NOT NULL DEFAULT FALSE,
    default_role VARCHAR(50) NOT NULL DEFAULT 'USER',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_tenant_domain (domain)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_federated_identities (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    tenant_id INT NOT NULL,
    external_id VARCHAR(255) NOT NULL,
    provider_type ENUM('saml', 'scim') NOT NULL DEFAULT 'saml',
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_tenant_external (tenant_id, external_id),
    UNIQUE KEY uq_user_tenant (user_id, tenant_id),
    INDEX idx_fed_user (user_id),
    INDEX idx_fed_tenant_active (tenant_id, active),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (tenant_id) REFERENCES enterprise_tenants(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS roles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    display_name VARCHAR(100) NOT NULL,
    description VARCHAR(255) NULL,
    category VARCHAR(50) NOT NULL DEFAULT 'general',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_roles_name (name),
    INDEX idx_roles_category (category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_roles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    role_id INT NOT NULL,
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    assigned_by INT NULL,
    UNIQUE KEY uq_user_role (user_id, role_id),
    INDEX idx_user_roles_user (user_id),
    INDEX idx_user_roles_role (role_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS permissions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    display_name VARCHAR(150) NOT NULL,
    description VARCHAR(255) NULL,
    module VARCHAR(50) NOT NULL DEFAULT 'general',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_permissions_name (name),
    INDEX idx_permissions_module (module)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS role_permissions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    role_id INT NOT NULL,
    permission_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_role_permission (role_id, permission_id),
    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
    FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO roles (name, display_name, description, category) VALUES
('SUPER_ADMIN', 'Super Admin', 'Acceso excepcional a toda la plataforma.', 'platform'),
('PLATFORM_ADMIN', 'Platform Admin', 'Administración general de la plataforma.', 'platform'),
('SECURITY_ADMIN', 'Security Admin', 'IAM, MFA, SSO, sesiones, políticas de seguridad.', 'platform'),
('IAM_ADMIN', 'IAM Admin', 'Usuarios, grupos, roles, permisos y provisioning.', 'platform'),
('COMPLIANCE_ADMIN', 'Compliance Admin', 'Compliance, retención, controles regulatorios.', 'platform'),
('AUDITOR', 'Auditor', 'Acceso prácticamente global de solo lectura.', 'platform'),
('READ_ONLY_ADMIN', 'Read-Only Admin', 'Administración/diagnóstico de solo lectura.', 'platform'),
('SUPPORT_L1', 'Support L1', 'Soporte básico y resolución de incidencias comunes.', 'support'),
('SUPPORT_L2', 'Support L2', 'Soporte técnico avanzado.', 'support'),
('SUPPORT_L3', 'Support L3', 'Soporte técnico/infraestructura avanzado.', 'support'),
('SUPPORT_MANAGER', 'Support Manager', 'Supervisión del equipo de soporte.', 'support'),
('CUSTOMER_SUCCESS', 'Customer Success', 'Gestión de clientes, cuentas y adopción.', 'support'),
('INCIDENT_MANAGER', 'Incident Manager', 'Coordinación de incidentes críticos.', 'support'),
('ENGINEER', 'Engineer', 'Herramientas técnicas y diagnóstico.', 'engineering'),
('SENIOR_ENGINEER', 'Senior Engineer', 'Acceso técnico más amplio.', 'engineering'),
('DEVOPS', 'DevOps', 'Infraestructura, deployments y servicios.', 'engineering'),
('SRE', 'SRE', 'Observabilidad, disponibilidad y operaciones de producción.', 'engineering'),
('RELEASE_MANAGER', 'Release Manager', 'Releases y deployments controlados.', 'engineering'),
('DATA_ANALYST', 'Data Analyst', 'Analytics y reportes.', 'data'),
('DATA_ENGINEER', 'Data Engineer', 'Pipelines y procesamiento de datos.', 'data'),
('DATA_ADMIN', 'Data Admin', 'Administración de datasets/recursos de datos.', 'data'),
('PRIVACY_ADMIN', 'Privacy Admin', 'Privacidad, solicitudes de datos y políticas.', 'data'),
('DATA_AUDITOR', 'Data Auditor', 'Auditoría de acceso y uso de datos.', 'data'),
('BILLING_AGENT', 'Billing Agent', 'Consultas y operaciones de billing.', 'finance'),
('BILLING_MANAGER', 'Billing Manager', 'Gestión financiera avanzada.', 'finance'),
('FINANCE_ADMIN', 'Finance Admin', 'Configuración financiera.', 'finance'),
('REFUNDS_ADMIN', 'Refunds Admin', 'Refunds/credits con permisos específicos.', 'finance'),
('OPERATIONS_AGENT', 'Operations Agent', 'Operaciones diarias.', 'operations'),
('OPERATIONS_MANAGER', 'Operations Manager', 'Supervisión operacional.', 'operations'),
('WORKFLOW_ADMIN', 'Workflow Admin', 'Workflows, jobs y procesos.', 'operations'),
('SYSTEM_OPERATOR', 'System Operator', 'Operaciones sensibles sobre sistemas.', 'operations'),
('HR_MANAGER', 'HR Manager', 'Gestión de recursos humanos, contrataciones y compensación.', 'operations'),
('HR_RECRUITER', 'HR Recruiter', 'Reclutamiento y altas de personal.', 'operations'),
('DESIGNER', 'Diseñador', 'Diseñador con permisos de publicación de plantillas.', 'general'),
('USER', 'Usuario', 'Usuario estándar de la plataforma.', 'general')
ON DUPLICATE KEY UPDATE
    display_name = VALUES(display_name),
    description = VALUES(description),
    category = VALUES(category);

CREATE TABLE IF NOT EXISTS server_config (
    `key` VARCHAR(100) PRIMARY KEY,
    `value` TEXT NOT NULL,
    `category` VARCHAR(50) NOT NULL DEFAULT 'general',
    `type` ENUM('string', 'number', 'boolean', 'json') NOT NULL DEFAULT 'string',
    `description` VARCHAR(255) NULL,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_server_config_category (category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO server_config (`key`, `value`, `category`, `type`, `description`) VALUES
('password_min_length', '8', 'security', 'number', 'Longitud mínima para contraseñas de usuarios'),
('password_max_length', '128', 'security', 'number', 'Longitud máxima para contraseñas de usuarios'),
('password_require_uppercase', 'false', 'security', 'boolean', 'Requerir al menos una letra mayúscula en contraseñas'),
('password_require_lowercase', 'false', 'security', 'boolean', 'Requerir al menos una letra minúscula en contraseñas'),
('password_require_number', 'false', 'security', 'boolean', 'Requerir al menos un número en contraseñas'),
('password_require_special', 'false', 'security', 'boolean', 'Requerir al menos un carácter especial en contraseñas'),
('session_ttl_days', '7', 'security', 'number', 'Duración en días de las sesiones de usuario'),
('max_concurrent_accounts', '5', 'security', 'number', 'Máximo de cuentas simultáneas vinculadas en el selector de cuentas'),
('username_min_length', '3', 'users', 'number', 'Longitud mínima para nombres de usuario'),
('username_max_length', '30', 'users', 'number', 'Longitud máxima para nombres de usuario'),
('allowed_email_domains', '["gmail.com","outlook.com","icloud.com","hotmail.com","yahoo.com"]', 'users', 'json', 'Dominios de correo permitidos para registro'),
('enforce_allowed_email_domains', 'true', 'users', 'boolean', 'Restringir registro estrictamente a la lista de dominios permitidos'),
('allow_registration', 'true', 'users', 'boolean', 'Habilitar nuevos registros de usuarios en la plataforma'),
('allow_google_login', 'true', 'users', 'boolean', 'Permitir autenticación e inicio de sesión con Google'),
('username_change_cooldown_days', '12', 'cooldowns', 'number', 'Días de espera entre cambios de nombre de usuario'),
('email_change_cooldown_days', '30', 'cooldowns', 'number', 'Días de espera entre cambios de correo electrónico'),
('verification_code_ttl_minutes', '15', 'cooldowns', 'number', 'Minutos de validez para códigos de verificación de 6 dígitos'),
('verification_code_max_attempts', '5', 'cooldowns', 'number', 'Intentos fallidos máximos antes de invalidar código de verificación'),
('password_reset_ttl_minutes', '15', 'cooldowns', 'number', 'Minutos de validez para enlaces de recuperación de contraseña'),
('auth_action_window_minutes', '5', 'cooldowns', 'number', 'Minutos de ventana para autorizaciones sensibles tras verificar identidad'),
('avatar_max_size_mb', '2', 'uploads', 'number', 'Tamaño máximo en MB para fotos de perfil y avatares'),
('avatar_allowed_formats', '["image/png","image/jpeg","image/jpg","image/webp"]', 'uploads', 'json', 'Formatos MIME de imagen permitidos para fotos de perfil'),
('app_name', 'Spriteboard', 'system', 'string', 'Nombre de la aplicación y plataforma'),
('support_email', 'support@spriteboard.app', 'system', 'string', 'Correo electrónico de soporte y contacto técnico'),
('maintenance_mode', 'false', 'system', 'boolean', 'Activar modo mantenimiento en toda la aplicación'),
('maintenance_message', 'El sistema se encuentra en mantenimiento programado. Volveremos pronto.', 'system', 'string', 'Mensaje descriptivo mostrado durante el modo mantenimiento'),
('rate_limit_login_max', '5', 'rate_limits', 'number', 'Máximo de intentos de inicio de sesión permitidos cada 5 minutos'),
('rate_limit_register_max', '5', 'rate_limits', 'number', 'Máximo de intentos de registro permitidos cada 15 minutos'),
('rate_limit_ai_chat_max', '20', 'rate_limits', 'number', 'Máximo de mensajes al asistente de IA permitidos por minuto')
ON DUPLICATE KEY UPDATE
    description = VALUES(description);

CREATE TABLE IF NOT EXISTS support_tickets (
    id INT AUTO_INCREMENT PRIMARY KEY,
    uuid VARCHAR(36) NOT NULL UNIQUE,
    ticket_number VARCHAR(32) NOT NULL UNIQUE,
    user_id INT NOT NULL,
    subject VARCHAR(255) NOT NULL,
    description TEXT NULL,
    status ENUM('queued', 'in_progress', 'escalated', 'resolved', 'closed') NOT NULL DEFAULT 'queued',
    priority ENUM('low', 'medium', 'high', 'urgent') NOT NULL DEFAULT 'medium',
    assigned_agent_id INT NULL,
    assigned_role VARCHAR(50) NOT NULL DEFAULT 'SUPPORT_L1',
    escalation_level ENUM('SUPPORT_L1', 'SUPPORT_L2', 'SUPPORT_L3', 'SUPPORT_MANAGER') NOT NULL DEFAULT 'SUPPORT_L1',
    escalation_note TEXT NULL,
    metadata JSON NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    closed_at TIMESTAMP NULL DEFAULT NULL,
    closed_by INT NULL,
    INDEX idx_support_user (user_id),
    INDEX idx_support_status (status),
    INDEX idx_support_agent (assigned_agent_id),
    INDEX idx_support_created (created_at DESC),
    INDEX idx_support_escalation (escalation_level),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (assigned_agent_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (closed_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS support_messages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    ticket_id INT NOT NULL,
    sender_type ENUM('user', 'agent', 'system', 'bot') NOT NULL,
    sender_id INT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_sup_msg_ticket_created (ticket_id, created_at ASC),
    FOREIGN KEY (ticket_id) REFERENCES support_tickets(id) ON DELETE CASCADE,
    FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS internal_tickets (
    id INT AUTO_INCREMENT PRIMARY KEY,
    uuid VARCHAR(36) NOT NULL UNIQUE,
    ticket_number VARCHAR(32) NOT NULL UNIQUE,
    creator_id INT NOT NULL,
    assigned_agent_id INT NULL,
    category ENUM('hardware', 'software', 'network', 'facilities', 'access', 'other') NOT NULL DEFAULT 'hardware',
    priority ENUM('low', 'medium', 'high', 'urgent') NOT NULL DEFAULT 'medium',
    status ENUM('open', 'in_progress', 'waiting_third_party', 'resolved', 'closed') NOT NULL DEFAULT 'open',
    location VARCHAR(100) NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    resolution_note TEXT NULL,
    resolved_by INT NULL,
    resolved_at TIMESTAMP NULL DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_int_ticket_creator (creator_id),
    INDEX idx_int_ticket_agent (assigned_agent_id),
    INDEX idx_int_ticket_status (status),
    INDEX idx_int_ticket_category (category),
    INDEX idx_int_ticket_priority (priority),
    INDEX idx_int_ticket_created (created_at DESC),
    FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (assigned_agent_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (resolved_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS internal_ticket_messages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    ticket_id INT NOT NULL,
    user_id INT NOT NULL,
    message TEXT NOT NULL,
    is_internal_note BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_int_msg_ticket_created (ticket_id, created_at ASC),
    FOREIGN KEY (ticket_id) REFERENCES internal_tickets(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS employees (
    id INT AUTO_INCREMENT PRIMARY KEY,
    uuid VARCHAR(36) NOT NULL UNIQUE,
    user_id INT NOT NULL UNIQUE,
    first_name VARCHAR(80) NOT NULL,
    last_name VARCHAR(80) NOT NULL,
    document_id VARCHAR(50) NOT NULL,
    personal_email VARCHAR(100) NOT NULL,
    work_email VARCHAR(100) NOT NULL UNIQUE,
    phone VARCHAR(30) NULL,
    job_title VARCHAR(100) NOT NULL,
    department VARCHAR(100) NOT NULL,
    manager_id INT NULL,
    contract_type VARCHAR(50) NOT NULL DEFAULT 'full_time',
    work_mode VARCHAR(50) NOT NULL DEFAULT 'remote',
    salary DECIMAL(12, 2) NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'USD',
    hire_date DATE NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'active',
    emergency_contact_name VARCHAR(100) NULL,
    emergency_contact_phone VARCHAR(30) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_emp_user (user_id),
    INDEX idx_emp_dept (department),
    INDEX idx_emp_status (status),
    INDEX idx_emp_manager (manager_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (manager_id) REFERENCES employees(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS employee_documents (
    id INT AUTO_INCREMENT PRIMARY KEY,
    uuid VARCHAR(36) NOT NULL UNIQUE,
    employee_id INT NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_size_bytes BIGINT NOT NULL,
    mime_type VARCHAR(100) NOT NULL DEFAULT 'application/pdf',
    document_type VARCHAR(50) NOT NULL DEFAULT 'contract',
    uploaded_by INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_doc_emp (employee_id),
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
    FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS employee_compensation_history (
    id INT AUTO_INCREMENT PRIMARY KEY,
    uuid VARCHAR(36) NOT NULL UNIQUE,
    employee_id INT NOT NULL,
    change_type VARCHAR(50) NOT NULL,
    previous_job_title VARCHAR(100) NULL,
    new_job_title VARCHAR(100) NOT NULL,
    previous_department VARCHAR(100) NULL,
    new_department VARCHAR(100) NOT NULL,
    previous_salary DECIMAL(12, 2) NULL,
    new_salary DECIMAL(12, 2) NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'USD',
    effective_date DATE NOT NULL,
    reason TEXT NULL,
    approved_by_user_id INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_comp_emp (employee_id),
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
    FOREIGN KEY (approved_by_user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS employee_time_off_balances (
    id INT AUTO_INCREMENT PRIMARY KEY,
    employee_id INT NOT NULL,
    year INT NOT NULL,
    vacation_days_total INT NOT NULL DEFAULT 15,
    vacation_days_used INT NOT NULL DEFAULT 0,
    sick_days_used INT NOT NULL DEFAULT 0,
    personal_days_used INT NOT NULL DEFAULT 0,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_emp_year (employee_id, year),
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS employee_time_off_requests (
    id INT AUTO_INCREMENT PRIMARY KEY,
    uuid VARCHAR(36) NOT NULL UNIQUE,
    employee_id INT NOT NULL,
    request_type VARCHAR(50) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    total_days INT NOT NULL,
    reason TEXT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    reviewed_by_user_id INT NULL,
    rejection_reason TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_pto_emp (employee_id),
    INDEX idx_pto_status (status),
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
    FOREIGN KEY (reviewed_by_user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_uploads (
    id INT AUTO_INCREMENT PRIMARY KEY,
    uuid VARCHAR(36) NOT NULL UNIQUE,
    user_id INT NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    file_path VARCHAR(512) NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    size_bytes INT NOT NULL,
    width INT NULL,
    height INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_user_uploads_user (user_id),
    INDEX idx_user_uploads_uuid (uuid),
    INDEX idx_user_uploads_user_created (user_id, created_at DESC),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO users (
    id, uuid, username, email, password_hash, role, subscription_tier, avatar_url, created_at
) VALUES (
    1,
    '00000000-0000-0000-0000-000000000001',
    'spriteboard',
    'official@spriteboard.internal',
    '$2a$10$7EqJtq98hPqEX7fNZaFWoO5L95D9X5u6Fz9d9a4p6u3m7w8y1z0q2',
    'ADMIN',
    'business',
    '/assets/brand/spriteboard-avatar.png',
    NOW()
) ON DUPLICATE KEY UPDATE username='spriteboard', role='ADMIN';

INSERT INTO user_preferences (user_id, theme, language)
VALUES (1, 'system', 'en-US')
ON DUPLICATE KEY UPDATE user_id = user_id;

GRANT ALL PRIVILEGES ON db_identity.* TO 'sprite_user'@'%';
FLUSH PRIVILEGES;
