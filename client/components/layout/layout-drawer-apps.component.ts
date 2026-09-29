import { APP_CATEGORIES, getAppById, searchApps } from '../../config/apps.config.js';
import { pluginRegistry } from '../../plugins/index.js';
import { escapeHtml } from '../../services/api.service.js';
import { renderIcons } from '../../services/icon.service.js';
import { showToast } from '../../services/toast.service.js';
import { AppCategory } from '../../types/apps.types.js';
import { toggleDrawer, updateCanvasRailActiveState } from '../layout.component.js';

let activeAppId: string | null = null;
let activeAppCategory: AppCategory = 'all';

export function getActiveAppId(): string | null {
  return activeAppId;
}

export function setActiveAppId(id: string | null): void {
  activeAppId = id;
}

export function renderAppsDrawerContent(drawer: HTMLElement, drawerBody: HTMLElement): void {
  const sidebar = drawer.closest<HTMLElement>('[data-ref="sidebar"]') || document.querySelector<HTMLElement>('[data-ref="sidebar"]');

  if (activeAppId) {
    const plugin = pluginRegistry.get(activeAppId);
    if (plugin) {
      plugin.render({
        drawer,
        drawerBody,
        onBack: () => {
          activeAppId = null;
          renderAppsDrawerContent(drawer, drawerBody);
        },
        onClose: () => {
          toggleDrawer(false);
        },
      });
      return;
    }
  }

  drawerBody.innerHTML = `
    <div class="canvas-panel-card" data-ref="canvas-panel-card">
      <div class="canvas-panel-card__header" data-ref="canvas-panel-header">
        <div class="canvas-panel-card__title-box" data-ref="canvas-panel-title-box">
          <svg class="component-icon canvas-panel-card__icon" aria-hidden="true"><use href="/icons.svg#apps"></use></svg>
          <span class="canvas-panel-card__title" data-ref="canvas-panel-title">Apps</span>
        </div>
        <button type="button" class="component-button component-button--h32 component-button--icon-only rail-btn canvas-panel-card__close" data-ref="btn-close-canvas-panel" data-tooltip="Cerrar panel" aria-label="Cerrar panel">
          <svg class="component-icon rail-btn__icon" aria-hidden="true"><use href="/icons.svg#close"></use></svg>
        </button>
      </div>
      <div class="canvas-panel-card__body apps-drawer-body" data-ref="canvas-panel-body">
        <div class="menu-panel__search" data-ref="canvas-apps-search">
          <svg class="component-icon menu-panel__search-icon" aria-hidden="true"><use href="/icons.svg#search"></use></svg>
          <input class="menu-panel__search-input" data-ref="canvas-apps-search-input" type="text" maxlength="50" autocomplete="off" placeholder="Buscar aplicaciones..." />
        </div>

        <div class="mockup-category-tabs" data-ref="apps-category-tabs" style="margin-bottom: 10px;">
          ${APP_CATEGORIES.map((cat) => `
            <button type="button" class="mockup-category-pill ${activeAppCategory === cat.id ? 'is-active' : ''}" data-ref="app-cat-pill-${cat.id}" data-app-cat="${cat.id}">
              ${escapeHtml(cat.name)}
            </button>
          `).join('')}
        </div>

        <div class="elements-section-title" data-ref="apps-section-title">Aplicaciones e integraciones</div>
        <div class="apps-grid" data-ref="apps-grid"></div>
      </div>
    </div>
  `;

  const btnClose = drawerBody.querySelector<HTMLElement>('[data-ref="btn-close-canvas-panel"]');
  btnClose?.addEventListener('click', (e) => {
    e.preventDefault();
    toggleDrawer(false);
  });

  const searchInput = drawerBody.querySelector<HTMLInputElement>('[data-ref="canvas-apps-search-input"]');
  const appsGrid = drawerBody.querySelector<HTMLElement>('[data-ref="apps-grid"]');

  const renderAppsList = (query = '') => {
    if (!appsGrid) return;
    const filtered = searchApps(query, activeAppCategory);

    if (filtered.length === 0) {
      appsGrid.innerHTML = `
        <div class="mockup-empty-state" data-ref="apps-empty">
          No se encontraron aplicaciones que coincidan con la búsqueda.
        </div>
      `;
      return;
    }

    appsGrid.innerHTML = filtered.map((app) => `
      <button type="button" class="app-card" data-ref="btn-app-card-${app.id}" data-app-id="${app.id}" data-tooltip="${escapeHtml(app.description)}" aria-label="${escapeHtml(app.name)}">
        <div class="app-card__thumb" data-ref="app-card-thumb-${app.id}">
          ${app.iconSvg || `<svg class="component-icon" aria-hidden="true" style="width: 36px; height: 36px;"><use href="/icons.svg#${app.icon}"></use></svg>`}
          ${app.badge ? `<span class="app-card__badge app-card__badge--${app.status}" data-ref="app-badge-${app.id}">${escapeHtml(app.badge)}</span>` : ''}
        </div>
        <div class="app-card__info" data-ref="app-card-info-${app.id}">
          <span class="app-card__title" data-ref="app-card-title-${app.id}">${escapeHtml(app.name)}</span>
          <span class="app-card__author" data-ref="app-card-author-${app.id}">${escapeHtml(app.author)}</span>
          <span class="app-card__desc" data-ref="app-card-desc-${app.id}">${escapeHtml(app.description)}</span>
        </div>
      </button>
    `).join('');

    appsGrid.querySelectorAll<HTMLButtonElement>('[data-app-id]').forEach((card) => {
      card.addEventListener('click', () => {
        const appId = card.getAttribute('data-app-id');
        const found = getAppById(appId || '');
        if (!found) return;

        if (pluginRegistry.has(found.id)) {
          activeAppId = found.id;
          renderAppsDrawerContent(drawer, drawerBody);
          return;
        }

        if (found.status === 'coming_soon') {
          showToast(`La integración con ${found.name} estará disponible próximamente`, 'info');
        }
      });
    });

    renderIcons(appsGrid);
  };

  searchInput?.addEventListener('input', () => {
    renderAppsList(searchInput.value);
  });

  drawerBody.querySelectorAll<HTMLButtonElement>('[data-app-cat]').forEach((pill) => {
    pill.addEventListener('click', () => {
      const cat = pill.getAttribute('data-app-cat') as AppCategory;
      if (cat) {
        activeAppCategory = cat;
        drawerBody.querySelectorAll<HTMLButtonElement>('[data-app-cat]').forEach((p) => {
          p.classList.toggle('is-active', p.getAttribute('data-app-cat') === cat);
        });
        renderAppsList(searchInput?.value || '');
      }
    });
  });

  renderAppsList(searchInput?.value || '');

  if (sidebar) {
    updateCanvasRailActiveState(sidebar);
  }
  renderIcons(drawerBody);
}
