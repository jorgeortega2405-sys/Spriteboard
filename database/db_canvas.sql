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
    INDEX idx_folders_deleted_at (deleted_at),
    INDEX idx_folders_user_deleted (user_id, deleted_at, created_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS canvases (
    id INT AUTO_INCREMENT PRIMARY KEY,
    uuid VARCHAR(36) NOT NULL UNIQUE,
    user_id INT NOT NULL,
    folder_id INT NULL DEFAULT NULL,
    name VARCHAR(255) NOT NULL DEFAULT 'Lienzo sin título',
    width INT NOT NULL DEFAULT 1920,
    height INT NOT NULL DEFAULT 1080,
    unit VARCHAR(30) NOT NULL DEFAULT 'px',
    canvas_type VARCHAR(30) NOT NULL DEFAULT 'board',
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
    INDEX idx_canvases_user_deleted_created (user_id, deleted_at, created_at DESC),
    INDEX idx_canvases_user_folder (user_id, folder_id, deleted_at),
    INDEX idx_canvases_user_deleted_name (user_id, deleted_at, name),
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

CREATE TABLE IF NOT EXISTS canvas_public_links (
    id INT AUTO_INCREMENT PRIMARY KEY,
    uuid VARCHAR(36) NOT NULL UNIQUE,
    canvas_id INT NOT NULL,
    user_id INT NOT NULL,
    name VARCHAR(255) NOT NULL DEFAULT 'Enlace de visualización pública',
    slug VARCHAR(100) NOT NULL UNIQUE,
    short_code VARCHAR(32) NULL UNIQUE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_public_links_canvas (canvas_id),
    INDEX idx_public_links_user (user_id),
    INDEX idx_public_links_slug (slug),
    INDEX idx_public_links_uuid (uuid),
    INDEX idx_public_links_created (canvas_id, created_at DESC),
    FOREIGN KEY (canvas_id) REFERENCES canvases(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS canvas_views (
    id INT AUTO_INCREMENT PRIMARY KEY,
    canvas_id INT NOT NULL,
    public_link_id INT NULL DEFAULT NULL,
    user_id INT NULL,
    session_id VARCHAR(100) NOT NULL,
    ip_address VARCHAR(45) NULL,
    user_agent VARCHAR(255) NULL,
    duration_seconds INT NOT NULL DEFAULT 0,
    viewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_canvas_views_canvas (canvas_id),
    INDEX idx_canvas_views_link (public_link_id),
    INDEX idx_canvas_views_user (user_id),
    INDEX idx_canvas_views_session (session_id),
    INDEX idx_canvas_views_viewed_at (viewed_at),
    INDEX idx_views_canvas_viewed (canvas_id, viewed_at DESC),
    INDEX idx_views_canvas_session (canvas_id, session_id),
    FOREIGN KEY (canvas_id) REFERENCES canvases(id) ON DELETE CASCADE,
    FOREIGN KEY (public_link_id) REFERENCES canvas_public_links(id) ON DELETE SET NULL
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

CREATE TABLE IF NOT EXISTS templates (
    id INT AUTO_INCREMENT PRIMARY KEY,
    uuid VARCHAR(36) NOT NULL UNIQUE,
    canvas_id INT NULL,
    user_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT NULL,
    canvas_type ENUM('board', 'presentation', 'doc', 'social', 'sheet', 'video') NOT NULL DEFAULT 'board',
    category VARCHAR(50) NOT NULL DEFAULT 'general',
    tags JSON NULL,
    canvas_data JSON NULL,
    preview_thumbnail MEDIUMTEXT NULL,
    status ENUM('draft', 'pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
    rejection_reason TEXT NULL,
    is_official BOOLEAN NOT NULL DEFAULT FALSE,
    is_premium BOOLEAN NOT NULL DEFAULT FALSE,
    uses_count INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_templates_status (status),
    INDEX idx_templates_canvas_type (canvas_type),
    INDEX idx_templates_user (user_id),
    INDEX idx_templates_official (is_official),
    INDEX idx_templates_premium (is_premium),
    FOREIGN KEY (canvas_id) REFERENCES canvases(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS brand_kits (
    id INT AUTO_INCREMENT PRIMARY KEY,
    uuid VARCHAR(36) NOT NULL UNIQUE,
    user_id INT NOT NULL,
    team_id INT NULL DEFAULT NULL,
    name VARCHAR(100) NOT NULL,
    description VARCHAR(255) NULL,
    color VARCHAR(20) NOT NULL DEFAULT '#6366f1',
    icon VARCHAR(50) NULL DEFAULT 'workspace_premium',
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    brand_voice TEXT NULL,
    brand_guidelines JSON NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_brand_kits_user (user_id),
    INDEX idx_brand_kits_team (team_id),
    INDEX idx_brand_kits_uuid (uuid),
    INDEX idx_brand_kits_user_created (user_id, created_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS brand_kit_colors (
    id INT AUTO_INCREMENT PRIMARY KEY,
    uuid VARCHAR(36) NOT NULL UNIQUE,
    brand_kit_id INT NOT NULL,
    palette_name VARCHAR(100) NOT NULL DEFAULT 'Paleta principal',
    name VARCHAR(100) NOT NULL,
    hex VARCHAR(20) NOT NULL,
    color_type ENUM('primary', 'secondary', 'accent', 'neutral', 'background', 'text', 'gradient') NOT NULL DEFAULT 'primary',
    gradient_data JSON NULL,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_bkc_kit (brand_kit_id),
    INDEX idx_bkc_kit_order (brand_kit_id, sort_order ASC),
    FOREIGN KEY (brand_kit_id) REFERENCES brand_kits(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS brand_kit_fonts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    uuid VARCHAR(36) NOT NULL UNIQUE,
    brand_kit_id INT NOT NULL,
    role VARCHAR(50) NOT NULL,
    font_family VARCHAR(100) NOT NULL,
    font_weight VARCHAR(20) NOT NULL DEFAULT '400',
    font_style VARCHAR(20) NOT NULL DEFAULT 'normal',
    font_size INT NULL,
    line_height FLOAT NULL,
    letter_spacing VARCHAR(20) NULL,
    font_url VARCHAR(512) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_brand_font_role (brand_kit_id, role),
    INDEX idx_bkf_kit (brand_kit_id),
    FOREIGN KEY (brand_kit_id) REFERENCES brand_kits(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS brand_kit_assets (
    id INT AUTO_INCREMENT PRIMARY KEY,
    uuid VARCHAR(36) NOT NULL UNIQUE,
    brand_kit_id INT NOT NULL,
    asset_type ENUM('logo', 'photo', 'element', 'graphic', 'icon', 'font') NOT NULL,
    category VARCHAR(50) NOT NULL DEFAULT 'general',
    name VARCHAR(150) NOT NULL,
    file_path VARCHAR(512) NOT NULL,
    preview_url VARCHAR(512) NULL,
    mime_type VARCHAR(100) NOT NULL DEFAULT 'image/png',
    size_bytes INT NOT NULL DEFAULT 0,
    width INT NULL,
    height INT NULL,
    tags JSON NULL,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_bka_kit_type (brand_kit_id, asset_type),
    INDEX idx_bka_kit_order (brand_kit_id, asset_type, sort_order ASC),
    FOREIGN KEY (brand_kit_id) REFERENCES brand_kits(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS brand_kit_charts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    uuid VARCHAR(36) NOT NULL UNIQUE,
    brand_kit_id INT NOT NULL,
    name VARCHAR(100) NOT NULL,
    chart_type VARCHAR(50) NOT NULL DEFAULT 'bar',
    palette JSON NOT NULL,
    config JSON NULL,
    sample_data JSON NULL,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_bkc_kit_chart (brand_kit_id),
    FOREIGN KEY (brand_kit_id) REFERENCES brand_kits(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS brand_kit_templates (
    id INT AUTO_INCREMENT PRIMARY KEY,
    uuid VARCHAR(36) NOT NULL UNIQUE,
    brand_kit_id INT NOT NULL,
    canvas_id INT NULL DEFAULT NULL,
    name VARCHAR(150) NOT NULL,
    description TEXT NULL,
    canvas_type ENUM('board', 'presentation', 'doc', 'social', 'sheet', 'video') NOT NULL DEFAULT 'board',
    preview_thumbnail MEDIUMTEXT NULL,
    canvas_data JSON NULL,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_bkt_kit (brand_kit_id),
    FOREIGN KEY (brand_kit_id) REFERENCES brand_kits(id) ON DELETE CASCADE,
    FOREIGN KEY (canvas_id) REFERENCES canvases(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS elements (
    id INT AUTO_INCREMENT PRIMARY KEY,
    uuid VARCHAR(36) NOT NULL UNIQUE,
    user_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    element_type ENUM('graphic', 'icon', 'sticker', 'photo', 'illustration') NOT NULL DEFAULT 'graphic',
    category VARCHAR(50) NOT NULL DEFAULT 'general',
    tags JSON NULL,
    file_url VARCHAR(512) NOT NULL,
    svg_content MEDIUMTEXT NULL,
    thumbnail_url VARCHAR(512) NULL,
    width INT NOT NULL DEFAULT 200,
    height INT NOT NULL DEFAULT 200,
    size_bytes INT NOT NULL DEFAULT 0,
    mime_type VARCHAR(100) NOT NULL DEFAULT 'image/svg+xml',
    status ENUM('draft', 'pending', 'approved', 'rejected') NOT NULL DEFAULT 'approved',
    rejection_reason TEXT NULL,
    is_official BOOLEAN NOT NULL DEFAULT FALSE,
    is_premium BOOLEAN NOT NULL DEFAULT FALSE,
    uses_count INT NOT NULL DEFAULT 0,
    deleted_at TIMESTAMP NULL DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_elements_status (status),
    INDEX idx_elements_type (element_type),
    INDEX idx_elements_category (category),
    INDEX idx_elements_user (user_id),
    INDEX idx_elements_official (is_official),
    INDEX idx_elements_premium (is_premium),
    INDEX idx_elements_uses (uses_count DESC),
    INDEX idx_elements_deleted_at (deleted_at),
    INDEX idx_elements_created_at (created_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO elements (uuid, user_id, title, element_type, category, tags, file_url, svg_content, width, height, is_official, is_premium, uses_count, status) VALUES
('elem-bulb-001', 1, 'Foco de Ideas Creativas', 'icon', 'technology', '["foco", "bombilla", "luz", "idea", "creatividad", "bulb", "light", "energia", "solucion"]', '/assets/elements/lightbulb.svg', '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18h6"/><path d="M10 22h4"/><path d="M12 2a7 7 0 0 0-7 7c0 2.38 1.19 4.47 3 5.74V17a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-2.26c1.81-1.27 3-3.36 3-5.74a7 7 0 0 0-7-7z"/></svg>', 200, 200, TRUE, FALSE, 142, 'approved'),
('elem-house-001', 1, 'Casa Moderna y Hogar', 'icon', 'architecture', '["casa", "hogar", "house", "home", "arquitectura", "inmobiliaria", "vivienda", "construccion", "edificio"]', '/assets/elements/house.svg', '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>', 200, 200, TRUE, FALSE, 98, 'approved'),
('elem-star-001', 1, 'Estrella de Calificación', 'graphic', 'general', '["estrella", "star", "favorito", "destacado", "premio", "calificacion", "rating", "resena"]', '/assets/elements/star.svg', '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>', 200, 200, TRUE, FALSE, 310, 'approved'),
('elem-rocket-001', 1, 'Cohete de Lanzamiento Startup', 'illustration', 'business', '["cohete", "rocket", "lanzamiento", "startup", "innovacion", "impulso", "espacio", "crecimiento"]', '/assets/elements/rocket.svg', '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/></svg>', 200, 200, TRUE, FALSE, 215, 'approved'),
('elem-heart-001', 1, 'Corazón de Pasión y Salud', 'graphic', 'general', '["corazon", "heart", "amor", "like", "salud", "me gusta", "medicina", "vitalidad"]', '/assets/elements/heart.svg', '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>', 200, 200, TRUE, FALSE, 184, 'approved'),
('elem-chart-001', 1, 'Gráfico de Crecimiento Financiero', 'icon', 'business', '["grafico", "grafica", "chart", "analytics", "finanzas", "crecimiento", "reporte", "ventas", "metricas"]', '/assets/elements/chart.svg', '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>', 200, 200, TRUE, FALSE, 87, 'approved'),
('elem-laptop-001', 1, 'Computadora Portátil Laptop', 'icon', 'technology', '["computadora", "laptop", "pc", "ordenador", "tecnologia", "pantalla", "software", "desarrollo"]', '/assets/elements/laptop.svg', '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="2" y1="20" x2="22" y2="20"/></svg>', 200, 200, TRUE, FALSE, 120, 'approved'),
('elem-shield-001', 1, 'Escudo de Seguridad y Protección', 'icon', 'technology', '["escudo", "shield", "seguridad", "proteccion", "privacidad", "candado", "defensa", "verificado"]', '/assets/elements/shield.svg', '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>', 200, 200, TRUE, FALSE, 65, 'approved'),
('elem-flame-001', 1, 'Fuego de Tendencia y Energía', 'graphic', 'nature', '["fuego", "flame", "fire", "tendencia", "calor", "energia", "popular", "trending", "llama"]', '/assets/elements/flame.svg', '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg>', 200, 200, TRUE, FALSE, 150, 'approved')
ON DUPLICATE KEY UPDATE
    title = VALUES(title),
    tags = VALUES(tags),
    svg_content = VALUES(svg_content);

CREATE TABLE IF NOT EXISTS ai_chat_sessions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    uuid VARCHAR(36) NOT NULL UNIQUE,
    user_id INT NOT NULL,
    title VARCHAR(255) NOT NULL DEFAULT 'Nueva conversación',
    canvas_uuid VARCHAR(36) NULL DEFAULT NULL,
    messages JSON NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_ai_chat_user (user_id),
    INDEX idx_ai_chat_uuid (uuid),
    INDEX idx_ai_chat_updated (user_id, updated_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

GRANT ALL PRIVILEGES ON db_canvas.* TO 'sprite_user'@'%';
FLUSH PRIVILEGES;

