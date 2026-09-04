/**
 * Plantillas de Skeletons con estructura semántica e idéntica a las vistas reales
 * CERO IDs - Uso exclusivo de data-ref="..." y orden estricto de atributos
 */

export const SKELETON_TEMPLATES = {
  // Skeleton para pantallas de autenticación (Login, Registro Etapas 1, 2, 3, Forgot Password)
  'auth-card': `
    <div class="layout-content" data-ref="skeleton-auth-view">
      <div class="login-container" data-ref="skeleton-auth-wrapper">
        <div class="skeleton skeleton--logo skeleton--circle" data-ref="skeleton-auth-logo"></div>
        <div class="card card--w-400 skeleton--card" data-ref="skeleton-auth-card">
          <div class="card__header" data-ref="skeleton-auth-header">
            <div class="skeleton skeleton--badge" data-ref="skeleton-badge"></div>
            <div class="skeleton skeleton--title" data-ref="skeleton-title"></div>
            <div class="skeleton skeleton--subtitle" data-ref="skeleton-subtitle"></div>
          </div>
          <div class="card__body" data-ref="skeleton-auth-body">
            <div class="skeleton skeleton--input" data-ref="skeleton-input-1"></div>
            <div class="skeleton skeleton--input" data-ref="skeleton-input-2"></div>
            <div class="skeleton skeleton--btn" data-ref="skeleton-btn-submit"></div>
            <div class="skeleton skeleton--btn" data-ref="skeleton-btn-secondary"></div>
            <div class="skeleton skeleton--text skeleton--w-50 skeleton--mx-auto" data-ref="skeleton-footer-note" style="margin-top: 16px;"></div>
          </div>
        </div>
      </div>
    </div>
  `,

  // Skeleton para la vista principal (Home / Dashboard)
  'home': `
    <div class="skeleton-view" data-ref="skeleton-home-view">
      <!-- TopBar Skeleton -->
      <header class="skeleton-topbar" data-ref="skeleton-topbar">
        <div class="topbar-left" data-ref="skeleton-topbar-left" style="display: flex; align-items: center; gap: 12px;">
          <div class="skeleton skeleton--btn-sm" data-ref="skeleton-menu-btn" style="width: 40px; height: 40px; border-radius: 8px;"></div>
          <div class="skeleton skeleton--title" data-ref="skeleton-brand" style="width: 130px; height: 24px; margin-bottom: 0;"></div>
        </div>
        <div class="topbar-right" data-ref="skeleton-topbar-right" style="display: flex; align-items: center; gap: 16px;">
          <div class="skeleton skeleton--btn-sm" data-ref="skeleton-action-btn" style="width: 100px; height: 36px; border-radius: 8px;"></div>
          <div class="skeleton skeleton--avatar" data-ref="skeleton-avatar"></div>
        </div>
      </header>

      <!-- Main Layout Skeleton -->
      <main class="main-layout" data-ref="skeleton-main-layout" style="padding: 32px 40px;">
        <div class="section-header" data-ref="skeleton-section-header" style="margin-bottom: 28px;">
          <div class="skeleton skeleton--title" data-ref="skeleton-page-title" style="width: 220px; height: 32px;"></div>
          <div class="skeleton skeleton--subtitle" data-ref="skeleton-page-subtitle" style="width: 380px;"></div>
        </div>

        <div class="action-bar" data-ref="skeleton-action-bar" style="display: flex; gap: 12px; margin-bottom: 28px;">
          <div class="skeleton skeleton--input" data-ref="skeleton-search" style="max-width: 320px; height: 44px; margin-bottom: 0;"></div>
          <div class="skeleton skeleton--btn-sm" data-ref="skeleton-filter-1" style="height: 44px; width: 110px;"></div>
          <div class="skeleton skeleton--btn-sm" data-ref="skeleton-filter-2" style="height: 44px; width: 110px;"></div>
        </div>

        <!-- Grid de Proyectos / Boards -->
        <div class="skeleton-grid" data-ref="skeleton-projects-grid">
          <div class="skeleton--project-card" data-ref="skeleton-card-1">
            <div class="skeleton skeleton--project-preview"></div>
            <div class="skeleton--project-meta">
              <div class="skeleton skeleton--title" style="width: 70%; height: 20px;"></div>
              <div class="skeleton skeleton--text" style="width: 90%;"></div>
              <div class="skeleton skeleton--text" style="width: 40%; margin-top: 12px;"></div>
            </div>
          </div>
          <div class="skeleton--project-card" data-ref="skeleton-card-2">
            <div class="skeleton skeleton--project-preview"></div>
            <div class="skeleton--project-meta">
              <div class="skeleton skeleton--title" style="width: 65%; height: 20px;"></div>
              <div class="skeleton skeleton--text" style="width: 85%;"></div>
              <div class="skeleton skeleton--text" style="width: 45%; margin-top: 12px;"></div>
            </div>
          </div>
          <div class="skeleton--project-card" data-ref="skeleton-card-3">
            <div class="skeleton skeleton--project-preview"></div>
            <div class="skeleton--project-meta">
              <div class="skeleton skeleton--title" style="width: 80%; height: 20px;"></div>
              <div class="skeleton skeleton--text" style="width: 75%;"></div>
              <div class="skeleton skeleton--text" style="width: 35%; margin-top: 12px;"></div>
            </div>
          </div>
        </div>
      </main>
    </div>
  `,

  // Skeleton para la papelera de reciclaje (Trash)
  'trash': `
    <div class="skeleton-view" data-ref="skeleton-trash-view">
      <!-- TopBar Skeleton -->
      <header class="skeleton-topbar" data-ref="skeleton-trash-topbar">
        <div class="topbar-left" style="display: flex; align-items: center; gap: 12px;">
          <div class="skeleton skeleton--btn-sm" style="width: 40px; height: 40px; border-radius: 8px;"></div>
          <div class="skeleton skeleton--title" style="width: 130px; height: 24px; margin-bottom: 0;"></div>
        </div>
        <div class="topbar-right" style="display: flex; align-items: center; gap: 16px;">
          <div class="skeleton skeleton--avatar"></div>
        </div>
      </header>

      <main class="main-layout" data-ref="skeleton-trash-layout" style="padding: 32px 40px;">
        <div class="section-header" style="margin-bottom: 28px;">
          <div class="skeleton skeleton--title" style="width: 180px; height: 32px;"></div>
          <div class="skeleton skeleton--subtitle" style="width: 320px;"></div>
        </div>

        <div class="action-bar" style="display: flex; justify-content: space-between; margin-bottom: 28px;">
          <div class="skeleton skeleton--input" style="max-width: 280px; height: 44px; margin-bottom: 0;"></div>
          <div class="skeleton skeleton--btn-sm" style="height: 44px; width: 140px;"></div>
        </div>

        <div class="skeleton-grid" data-ref="skeleton-trash-grid">
          <div class="skeleton--project-card">
            <div class="skeleton skeleton--project-preview"></div>
            <div class="skeleton--project-meta">
              <div class="skeleton skeleton--title" style="width: 60%; height: 20px;"></div>
              <div class="skeleton skeleton--text" style="width: 80%;"></div>
            </div>
          </div>
          <div class="skeleton--project-card">
            <div class="skeleton skeleton--project-preview"></div>
            <div class="skeleton--project-meta">
              <div class="skeleton skeleton--title" style="width: 75%; height: 20px;"></div>
              <div class="skeleton skeleton--text" style="width: 65%;"></div>
            </div>
          </div>
        </div>
      </main>
    </div>
  `,

  // Skeleton de respaldo / fallback para rutas desconocidas o genéricas
  'fallback': `
    <div class="layout-content" data-ref="skeleton-fallback-view" style="padding: 40px; display: flex; justify-content: center; align-items: center; min-height: 80vh;">
      <div class="card card--w-400 skeleton--card" data-ref="skeleton-fallback-card">
        <div class="skeleton skeleton--title skeleton--w-70" style="margin-bottom: 16px;"></div>
        <div class="skeleton skeleton--subtitle skeleton--w-90" style="margin-bottom: 24px;"></div>
        <div class="skeleton skeleton--text skeleton--w-full"></div>
        <div class="skeleton skeleton--text skeleton--w-75"></div>
        <div class="skeleton skeleton--btn skeleton--w-full" style="margin-top: 24px;"></div>
      </div>
    </div>
  `,
};

/**
 * Obtiene la plantilla HTML de un skeleton según su nombre
 * @param {string} name - Nombre de la plantilla
 * @returns {string} Código HTML del skeleton
 */
export function getSkeletonTemplate(name) {
  return SKELETON_TEMPLATES[name] || SKELETON_TEMPLATES['fallback'];
}
