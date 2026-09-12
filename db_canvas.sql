CREATE DATABASE IF NOT EXISTS db_canvas;
USE db_canvas;

CREATE TABLE IF NOT EXISTS folders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    uuid VARCHAR(36) NOT NULL UNIQUE,
    user_id INT NOT NULL,
    name VARCHAR(100) NOT NULL,
    color VARCHAR(20) NULL DEFAULT '#6366f1',
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at TIMESTAMP NULL DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_folders_user (user_id),
    INDEX idx_folders_uuid (uuid),
    INDEX idx_folders_deleted_at (deleted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS canvases (
    id INT AUTO_INCREMENT PRIMARY KEY,
    uuid VARCHAR(36) NOT NULL UNIQUE,
    user_id INT NOT NULL,
    folder_id INT NULL DEFAULT NULL,
    name VARCHAR(255) NOT NULL DEFAULT 'Lienzo sin título',
    width INT NOT NULL DEFAULT 1920,
    height INT NOT NULL DEFAULT 1080,
    unit VARCHAR(20) NOT NULL DEFAULT 'px',
    size_bytes INT NOT NULL DEFAULT 0,
    compressed_bytes INT NOT NULL DEFAULT 0,
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
    INDEX idx_canvases_folder (folder_id),
    INDEX idx_canvases_uuid (uuid),
    INDEX idx_canvases_short_code (short_code),
    INDEX idx_canvases_custom_slug (custom_slug),
    INDEX idx_canvases_deleted_at (deleted_at),
    INDEX idx_canvases_user_deleted (user_id, deleted_at, updated_at),
    FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE SET NULL
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

CREATE TABLE IF NOT EXISTS canvas_comments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    uuid VARCHAR(36) NOT NULL UNIQUE,
    canvas_id INT NOT NULL,
    user_id INT NOT NULL,
    parent_id INT NULL,
    pos_x FLOAT NULL,
    pos_y FLOAT NULL,
    frame_index INT NOT NULL DEFAULT 0,
    content TEXT NOT NULL,
    status ENUM('open', 'resolved') NOT NULL DEFAULT 'open',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_comments_canvas (canvas_id),
    INDEX idx_comments_user (user_id),
    INDEX idx_comments_parent (parent_id),
    INDEX idx_comments_status (status),
    INDEX idx_comments_frame (canvas_id, frame_index),
    FOREIGN KEY (canvas_id) REFERENCES canvases(id) ON DELETE CASCADE,
    FOREIGN KEY (parent_id) REFERENCES canvas_comments(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS canvas_snapshots (
    id INT AUTO_INCREMENT PRIMARY KEY,
    uuid VARCHAR(36) NOT NULL UNIQUE,
    canvas_id INT NOT NULL,
    user_id INT NULL,
    name VARCHAR(255) NULL,
    description TEXT NULL,
    is_manual BOOLEAN NOT NULL DEFAULT FALSE,
    preview_thumbnail MEDIUMTEXT NULL,
    size_bytes INT NOT NULL DEFAULT 0,
    compressed_bytes INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_snapshots_canvas_created (canvas_id, created_at DESC),
    INDEX idx_snapshots_user (user_id),
    FOREIGN KEY (canvas_id) REFERENCES canvases(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

GRANT ALL PRIVILEGES ON db_canvas.* TO 'sprite_user'@'%';
FLUSH PRIVILEGES;
