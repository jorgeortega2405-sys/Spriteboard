/**
 * Plantillas Genéricas de Skeletons con estructura semántica e idéntica a las vistas reales
 * CERO IDs - Uso exclusivo de data-ref="..." y orden estricto de atributos
 *
 * Se definen 2 plantillas genéricas:
 * 1. 'grouped-layout': Layout centrado de 700px para contenido en tarjetas agrupadas e ítems (paneles, listas, etc.).
 * 2. 'centered-form': Layout de formulario centrado de 400px para flujos de autenticación e ingreso de datos.
 */

export const SKELETON_TEMPLATES = {
  // 1. Plantilla genérica de formulario centrado (Auth, Onboarding, Recuperación)
  'centered-form': `
    <div class="layout-content" data-ref="skeleton-centered-form-view">
      <div class="login-container" data-ref="skeleton-centered-form-container">
        <div class="login-header-logo" data-ref="skeleton-centered-form-logo" style="pointer-events: none;">
          <div class="skeleton skeleton--circle" style="width: 38px; height: 38px;"></div>
        </div>

        <div class="card card--w-400" data-ref="skeleton-centered-form-card">
          <div class="card__header" data-ref="skeleton-centered-form-header">
            <div class="skeleton skeleton--title" style="width: 200px; height: 28px; margin: 0;"></div>
            <div class="skeleton skeleton--subtitle" style="width: 320px; max-width: 100%; height: 16px; margin: 0;"></div>
          </div>

          <div class="card__body" data-ref="skeleton-centered-form-body">
            <div class="skeleton skeleton--input" style="height: 55px; border-radius: var(--radius-md); margin: 0;"></div>
            <div class="skeleton skeleton--input" style="height: 55px; border-radius: var(--radius-md); margin: 0;"></div>
            <div class="skeleton skeleton--btn" style="height: 55px; border-radius: var(--radius-md); margin: 0;"></div>
            <div class="skeleton skeleton--btn" style="height: 55px; border-radius: var(--radius-md); margin: 0;"></div>
            <div class="skeleton skeleton--text skeleton--w-50 skeleton--mx-auto" style="height: 14px; margin: 4px auto 0 auto;"></div>
          </div>
        </div>
      </div>
    </div>
  `,

  // 2. Plantilla genérica de contenido agrupado (Paneles, listas de ítems, tarjetas agrupadas de 700px)
  'grouped-layout': `
    <div class="layout-root" data-ref="skeleton-grouped-view" style="width: 100%; height: 100%; display: flex; flex-direction: column;">
      <!-- TopBar Placeholder -->
      <header class="general-content-top layout-header" data-ref="skeleton-topbar">
        <div class="top-left layout-header__left">
          <div class="skeleton" style="width: 38px; height: 38px; border-radius: var(--radius-md); margin-right: 12px;"></div>
          <div class="skeleton skeleton--title" style="width: 120px; height: 24px; margin: 0;"></div>
        </div>
        <div class="top-center layout-header__center">
          <div class="skeleton" style="width: 425px; max-width: 100%; height: 40px; border-radius: var(--radius-md);"></div>
        </div>
        <div class="top-right layout-header__right">
          <div class="skeleton skeleton--avatar" style="width: 40px; height: 40px; border-radius: 50%;"></div>
        </div>
      </header>

      <!-- Contenido en formato agrupado de 700px centrado -->
      <div class="layout-content" data-ref="skeleton-content-area">
        <div class="layout-body layout-body--scrollable layout-scrollable" data-ref="skeleton-body-area">
          <div class="grouped-flow-layout" data-ref="skeleton-grouped-layout">
            <!-- Tarjeta de Encabezado -->
            <div class="grouped-header-card" data-ref="skeleton-grouped-header">
              <div class="skeleton skeleton--title" style="width: 220px; height: 24px; margin: 0 auto;"></div>
              <div class="skeleton skeleton--subtitle" style="width: 380px; max-width: 90%; height: 14px; margin: 8px auto 0 auto;"></div>
            </div>

            <!-- Grupo 1: Ítem apilado con control de selección / trigger -->
            <div class="grouped-items-card" data-ref="skeleton-grouped-card-1">
              <div class="grouped-row-item--stacked" data-ref="skeleton-grouped-item-1">
                <div style="display: flex; flex-direction: column; gap: 6px; width: 100%;">
                  <div class="skeleton skeleton--title" style="width: 160px; height: 18px; margin: 0;"></div>
                  <div class="skeleton skeleton--text" style="width: 320px; max-width: 90%; height: 13px; margin: 0;"></div>
                </div>
                <div class="skeleton" style="width: 100%; max-width: 265px; height: 42px; border-radius: var(--radius-md); margin-top: 4px;"></div>
              </div>
            </div>

            <!-- Grupo 2: Lista de opciones interactivas con interruptores -->
            <div class="grouped-items-card" data-ref="skeleton-grouped-card-2">
              <div class="grouped-row-item" data-ref="skeleton-grouped-item-2">
                <div style="display: flex; flex-direction: column; gap: 6px; flex: 1;">
                  <div class="skeleton skeleton--title" style="width: 180px; height: 18px; margin: 0;"></div>
                  <div class="skeleton skeleton--text" style="width: 300px; max-width: 90%; height: 13px; margin: 0;"></div>
                </div>
                <div class="skeleton" style="width: 44px; height: 24px; border-radius: 24px; flex-shrink: 0;"></div>
              </div>

              <div class="menu-divider"></div>

              <div class="grouped-row-item" data-ref="skeleton-grouped-item-3">
                <div style="display: flex; flex-direction: column; gap: 6px; flex: 1;">
                  <div class="skeleton skeleton--title" style="width: 150px; height: 18px; margin: 0;"></div>
                  <div class="skeleton skeleton--text" style="width: 280px; max-width: 90%; height: 13px; margin: 0;"></div>
                </div>
                <div class="skeleton" style="width: 44px; height: 24px; border-radius: 24px; flex-shrink: 0;"></div>
              </div>

              <div class="menu-divider"></div>

              <div class="grouped-row-item" data-ref="skeleton-grouped-item-4">
                <div style="display: flex; flex-direction: column; gap: 6px; flex: 1;">
                  <div class="skeleton skeleton--title" style="width: 190px; height: 18px; margin: 0;"></div>
                  <div class="skeleton skeleton--text" style="width: 260px; max-width: 90%; height: 13px; margin: 0;"></div>
                </div>
                <div class="skeleton" style="width: 44px; height: 24px; border-radius: 24px; flex-shrink: 0;"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,

  // 3. Plantilla genérica de contenido agrupado inferior (para navegación SPA con TopBar persistente)
  'grouped-layout-bottom': `
    <div class="layout-content skeleton-container" data-ref="skeleton-content-area">
      <div class="layout-body layout-body--scrollable layout-scrollable" data-ref="skeleton-body-area">
        <div class="grouped-flow-layout" data-ref="skeleton-grouped-layout">
          <!-- Tarjeta de Encabezado -->
          <div class="grouped-header-card" data-ref="skeleton-grouped-header">
            <div class="skeleton skeleton--title" style="width: 220px; height: 24px; margin: 0 auto;"></div>
            <div class="skeleton skeleton--subtitle" style="width: 380px; max-width: 90%; height: 14px; margin: 8px auto 0 auto;"></div>
          </div>

          <!-- Grupo 1: Ítem apilado con control de selección / trigger -->
          <div class="grouped-items-card" data-ref="skeleton-grouped-card-1">
            <div class="grouped-row-item--stacked" data-ref="skeleton-grouped-item-1">
              <div style="display: flex; flex-direction: column; gap: 6px; width: 100%;">
                <div class="skeleton skeleton--title" style="width: 160px; height: 18px; margin: 0;"></div>
                <div class="skeleton skeleton--text" style="width: 320px; max-width: 90%; height: 13px; margin: 0;"></div>
              </div>
              <div class="skeleton" style="width: 100%; max-width: 265px; height: 42px; border-radius: var(--radius-md); margin-top: 4px;"></div>
            </div>
          </div>

          <!-- Grupo 2: Lista de opciones interactivas con interruptores -->
          <div class="grouped-items-card" data-ref="skeleton-grouped-card-2">
            <div class="grouped-row-item" data-ref="skeleton-grouped-item-2">
              <div style="display: flex; flex-direction: column; gap: 6px; flex: 1;">
                <div class="skeleton skeleton--title" style="width: 180px; height: 18px; margin: 0;"></div>
                <div class="skeleton skeleton--text" style="width: 300px; max-width: 90%; height: 13px; margin: 0;"></div>
              </div>
              <div class="skeleton" style="width: 44px; height: 24px; border-radius: 24px; flex-shrink: 0;"></div>
            </div>

            <div class="menu-divider"></div>

            <div class="grouped-row-item" data-ref="skeleton-grouped-item-3">
              <div style="display: flex; flex-direction: column; gap: 6px; flex: 1;">
                <div class="skeleton skeleton--title" style="width: 150px; height: 18px; margin: 0;"></div>
                <div class="skeleton skeleton--text" style="width: 280px; max-width: 90%; height: 13px; margin: 0;"></div>
              </div>
              <div class="skeleton" style="width: 44px; height: 24px; border-radius: 24px; flex-shrink: 0;"></div>
            </div>

            <div class="menu-divider"></div>

            <div class="grouped-row-item" data-ref="skeleton-grouped-item-4">
              <div style="display: flex; flex-direction: column; gap: 6px; flex: 1;">
                <div class="skeleton skeleton--title" style="width: 190px; height: 18px; margin: 0;"></div>
                <div class="skeleton skeleton--text" style="width: 260px; max-width: 90%; height: 13px; margin: 0;"></div>
              </div>
              <div class="skeleton" style="width: 44px; height: 24px; border-radius: 24px; flex-shrink: 0;"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
};

/**
 * Obtiene la plantilla HTML de un skeleton según su nombre genérico
 * @param {'centered-form' | 'grouped-layout' | 'grouped-layout-bottom'} name - Nombre de la plantilla genérica
 * @returns {string} Código HTML del skeleton
 */
export function getSkeletonTemplate(name) {
  return SKELETON_TEMPLATES[name] || SKELETON_TEMPLATES['grouped-layout'];
}

export default SKELETON_TEMPLATES;

