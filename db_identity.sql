CREATE DATABASE IF NOT EXISTS db_identity;
USE db_identity;

CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NULL,
    google_id VARCHAR(255) NULL UNIQUE,
    avatar_url VARCHAR(512) NULL,
    role ENUM('user', 'moderator', 'administrator', 'superadministrator') NOT NULL DEFAULT 'user',
    subscription_tier VARCHAR(20) NOT NULL DEFAULT 'free',
    stripe_customer_id VARCHAR(255) NULL,
    stripe_subscription_id VARCHAR(255) NULL,
    subscription_status VARCHAR(50) NOT NULL DEFAULT 'active',
    subscription_period_end TIMESTAMP NULL,
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
    color VARCHAR(20) NOT NULL DEFAULT '#6366f1',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_teams_owner (owner_id),
    FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS team_members (
    id INT AUTO_INCREMENT PRIMARY KEY,
    team_id INT NOT NULL,
    user_id INT NOT NULL,
    role ENUM('admin', 'member') NOT NULL DEFAULT 'member',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_team_user (team_id, user_id),
    INDEX idx_team_members_user (user_id),
    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE DATABASE IF NOT EXISTS db_canvas;
USE db_canvas;

CREATE TABLE IF NOT EXISTS canvases (
    id INT AUTO_INCREMENT PRIMARY KEY,
    uuid VARCHAR(36) NOT NULL UNIQUE,
    user_id INT NOT NULL,
    name VARCHAR(255) NOT NULL DEFAULT 'Lienzo sin título',
    width INT NOT NULL DEFAULT 1920,
    height INT NOT NULL DEFAULT 1080,
    unit VARCHAR(20) NOT NULL DEFAULT 'px',
    data JSON NULL,
    preview_thumbnail MEDIUMTEXT NULL,
    access_level ENUM('private', 'public') NOT NULL DEFAULT 'private',
    public_role ENUM('viewer', 'editor') NOT NULL DEFAULT 'editor',
    short_code VARCHAR(32) NULL UNIQUE,
    custom_slug VARCHAR(100) NULL UNIQUE,
    deleted_at TIMESTAMP NULL DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_canvases_user (user_id),
    INDEX idx_canvases_uuid (uuid),
    INDEX idx_canvases_short_code (short_code),
    INDEX idx_canvases_custom_slug (custom_slug),
    INDEX idx_canvases_deleted_at (deleted_at),
    INDEX idx_canvases_user_deleted (user_id, deleted_at, updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS canvas_members (
    id INT AUTO_INCREMENT PRIMARY KEY,
    canvas_id INT NOT NULL,
    user_id INT NOT NULL,
    role ENUM('editor', 'viewer') NOT NULL DEFAULT 'editor',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_canvas_member (canvas_id, user_id),
    INDEX idx_canvas_members_user (user_id),
    FOREIGN KEY (canvas_id) REFERENCES canvases(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS canvas_teams (
    id INT AUTO_INCREMENT PRIMARY KEY,
    canvas_id INT NOT NULL,
    team_id INT NOT NULL,
    role ENUM('editor', 'viewer') NOT NULL DEFAULT 'editor',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_canvas_team (canvas_id, team_id),
    INDEX idx_canvas_teams_team (team_id),
    FOREIGN KEY (canvas_id) REFERENCES canvases(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS canvas_views (
    id INT AUTO_INCREMENT PRIMARY KEY,
    canvas_id INT NOT NULL,
    user_id INT NULL,
    session_id VARCHAR(100) NOT NULL,
    ip_address VARCHAR(45) NULL,
    user_agent VARCHAR(255) NULL,
    duration_seconds INT NOT NULL DEFAULT 0,
    viewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_canvas_views_canvas (canvas_id),
    INDEX idx_canvas_views_user (user_id),
    INDEX idx_canvas_views_session (session_id),
    INDEX idx_canvas_views_viewed_at (viewed_at),
    FOREIGN KEY (canvas_id) REFERENCES canvases(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

