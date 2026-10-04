import { API_ROUTES } from '../../config/api-routes.js';
import { ALL_PRESETS, PresetItem } from '../../config/templates.config.js';
import { currentUser, escapeHtml, getApi } from '../../services/api.service.js';
import { getAllLocalCanvases } from '../../services/canvas-storage.service.js';
import { t } from '../../services/i18n.service.js';
import { renderIcons } from '../../services/icon.service.js';
import { showToast } from '../../services/toast.service.js';
import { CanvasItem } from '../../types/canvas.types.js';
import { DOC_TEMPLATES, getDocTemplateById } from '../../views/doc/doc-templates.config.js';
import { openCreateCanvasModal } from '../create-canvas-modal.component.js';
import { getActiveCanvasController, getActiveCanvasType, toggleDrawer, updateCanvasRailActiveState } from '../layout.component.js';
import { openModal } from '../modal.component.js';

export function createDrawerSkeletonRow(): HTMLElement {
  const row = document.createElement('div');
  row.className = 'drawer-canvas-item is-skeleton';
  row.setAttribute('data-ref', 'drawer-canvas-skeleton');
  row.style.pointerEvents = 'none';
  row.innerHTML = `
    <div class="drawer-canvas-item__thumb skeleton" style="border: none;"></div>
    <div class="skeleton skeleton--text" style="width: 65%; height: 12px; border-radius: 4px; margin-left: 2px;"></div>
  `;
  return row;
}

export function createDrawerCanvasRow(canvas: CanvasItem): HTMLElement {
  const item = document.createElement('button');
  item.type = 'button';
  item.className = 'drawer-canvas-item';
  item.setAttribute('data-ref', `drawer-canvas-${canvas.uuid}`);
  const isPresentation = canvas.canvas_type === 'presentation' || canvas.unit === 'presentation';
  const isDoc = canvas.canvas_type === 'doc' || canvas.unit === 'doc';
  const targetUrl = `/design/${canvas.uuid}`;
  const iconName = isPresentation ? 'slideshow' : (isDoc ? 'description' : 'dashboard');

  const thumbHtml = canvas.preview_thumbnail
    ? `<img class="drawer-canvas-item__thumb-img" src="${canvas.preview_thumbnail}" alt="" />`
    : `<svg class="component-icon drawer-canvas-item__thumb-icon" aria-hidden="true"><use href="/icons.svg#${iconName}"></use></svg>`;

  item.innerHTML = `
    <div class="drawer-canvas-item__thumb">
      ${thumbHtml}
    </div>
    <span class="drawer-canvas-item__title">${escapeHtml(canvas.name || 'Diseño sin título')}</span>
  `;

  item.addEventListener('click', (e) => {
    e.preventDefault();
    if (window.innerWidth <= 768) {
      toggleDrawer(false);
    }
    window.open(targetUrl, '_blank');
  });

  return item;
}

export async function renderHomeDrawerContent(drawerBody: HTMLElement): Promise<void> {
  const favoritesSectionHtml = currentUser ? `
    <div class="drawer-section" data-ref="drawer-section-favorites">
      <div class="drawer-section__header" data-ref="drawer-header-favorites">
        <span class="drawer-section__title">Favoritos</span>
        <button type="button" class="drawer-section__action" data-ref="btn-drawer-add-favorite" data-tooltip="Crear diseño" aria-label="Crear diseño">
          <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#add"></use></svg>
        </button>
      </div>
      <div class="drawer-items-list" data-ref="drawer-favorites-list">
        <div class="drawer-canvas-item is-skeleton" style="pointer-events: none;">
          <div class="drawer-canvas-item__thumb skeleton" style="border: none;"></div>
          <div class="skeleton skeleton--text" style="width: 60%; height: 12px; border-radius: 4px;"></div>
        </div>
        <div class="drawer-canvas-item is-skeleton" style="pointer-events: none;">
          <div class="drawer-canvas-item__thumb skeleton" style="border: none;"></div>
          <div class="skeleton skeleton--text" style="width: 75%; height: 12px; border-radius: 4px;"></div>
        </div>
      </div>
    </div>
  ` : `
    <div class="drawer-section" data-ref="drawer-section-favorites" style="display: none;">
      <div class="drawer-section__header" data-ref="drawer-header-favorites">
        <span class="drawer-section__title">Favoritos</span>
      </div>
      <div class="drawer-items-list" data-ref="drawer-favorites-list"></div>
    </div>
  `;

  drawerBody.innerHTML = `
    ${favoritesSectionHtml}

    <div class="drawer-section" data-ref="drawer-section-recents">
      <div class="drawer-section__header" data-ref="drawer-header-recents">
        <span class="drawer-section__title">Diseños recientes</span>
      </div>
      <div class="drawer-items-list" data-ref="drawer-recents-list">
        <div class="drawer-canvas-item is-skeleton" style="pointer-events: none;">
          <div class="drawer-canvas-item__thumb skeleton" style="border: none;"></div>
          <div class="skeleton skeleton--text" style="width: 70%; height: 12px; border-radius: 4px;"></div>
        </div>
        <div class="drawer-canvas-item is-skeleton" style="pointer-events: none;">
          <div class="drawer-canvas-item__thumb skeleton" style="border: none;"></div>
          <div class="skeleton skeleton--text" style="width: 50%; height: 12px; border-radius: 4px;"></div>
        </div>
        <div class="drawer-canvas-item is-skeleton" style="pointer-events: none;">
          <div class="drawer-canvas-item__thumb skeleton" style="border: none;"></div>
          <div class="skeleton skeleton--text" style="width: 65%; height: 12px; border-radius: 4px;"></div>
        </div>
      </div>
      <button type="button" class="drawer-link-btn" data-ref="btn-drawer-view-all" style="display: none;">Ver todo</button>
    </div>
  `;

  const sectionFavorites = drawerBody.querySelector<HTMLElement>('[data-ref="drawer-section-favorites"]');
  const favoritesList = drawerBody.querySelector<HTMLElement>('[data-ref="drawer-favorites-list"]');
  const recentsList = drawerBody.querySelector<HTMLElement>('[data-ref="drawer-recents-list"]');
  const btnAddFav = drawerBody.querySelector<HTMLElement>('[data-ref="btn-drawer-add-favorite"]');
  const btnViewAll = drawerBody.querySelector<HTMLElement>('[data-ref="btn-drawer-view-all"]');

  btnAddFav?.addEventListener('click', (e) => {
    e.preventDefault();
    openCreateCanvasModal();
  });

  const INITIAL_RECENTS_LIMIT = 8;
  const BATCH_LIMIT = 10;
  const renderedUuids = new Set<string>();
  let currentBatchPage = 1;
  let hasMoreBatches = false;
  let isLoadingBatch = false;
  let isBatchScrollActive = false;

  try {
    let items: CanvasItem[] = [];
    const localCanvases = await getAllLocalCanvases();

    if (currentUser) {
      try {
        const res = await getApi(API_ROUTES.canvases.base);
        if (res.ok) {
          const data = await res.json();
          if (data && Array.isArray(data.canvases)) {
            const cloudUuids = new Set(data.canvases.map((c: CanvasItem) => c.uuid));
            const unsynced = localCanvases.filter((c) => c.is_local && !cloudUuids.has(c.uuid) && !c.id && (!c.user_id || c.user_id === currentUser?.id));
            items = [...unsynced, ...data.canvases];
          } else {
            items = localCanvases;
          }
        } else {
          items = localCanvases;
        }
      } catch {
        items = localCanvases;
      }
    } else {
      items = localCanvases.filter((c) => c.is_local && !c.user_id && !c.id);
    }

    const nonDeleted = items.filter((c) => !c.deleted_at);

    const favorites = nonDeleted.filter((c) => c.is_favorite);
    if (sectionFavorites && favoritesList) {
      if (!currentUser || favorites.length === 0) {
        sectionFavorites.style.display = 'none';
        favoritesList.innerHTML = '';
      } else {
        sectionFavorites.style.display = '';
        favoritesList.innerHTML = '';
        favorites.slice(0, 6).forEach((c) => {
          favoritesList.appendChild(createDrawerCanvasRow(c));
        });
      }
    }

    const sortedRecents = [...nonDeleted].sort((a, b) => {
      const timeA = new Date(a.updated_at || a.created_at).getTime();
      const timeB = new Date(b.updated_at || b.created_at).getTime();
      return timeB - timeA;
    });

    if (recentsList) {
      recentsList.innerHTML = '';
      if (sortedRecents.length === 0) {
        recentsList.innerHTML = `
          <div class="drawer-empty-card" data-ref="drawer-empty-card-recents">
            <div class="drawer-empty-card__title">Diseños recientes</div>
            <div class="drawer-empty-card__desc">Aquí aparecerán los últimos diseños que hayas creado o abierto.</div>
          </div>
        `;
      } else {
        const initialSlice = sortedRecents.slice(0, INITIAL_RECENTS_LIMIT);
        initialSlice.forEach((c) => {
          renderedUuids.add(c.uuid);
          recentsList.appendChild(createDrawerCanvasRow(c));
        });
      }
    }

    if (sortedRecents.length > INITIAL_RECENTS_LIMIT) {
      if (btnViewAll) {
        btnViewAll.style.display = 'block';
      }
      hasMoreBatches = true;
    } else {
      if (btnViewAll) {
        btnViewAll.style.display = 'none';
      }
      hasMoreBatches = false;
    }

    const loadNextBatch = async () => {
      if (isLoadingBatch || !hasMoreBatches || !recentsList) return;
      isLoadingBatch = true;
      currentBatchPage++;

      const skeletons = [createDrawerSkeletonRow(), createDrawerSkeletonRow(), createDrawerSkeletonRow()];
      skeletons.forEach((s) => recentsList.appendChild(s));

      try {
        if (currentUser) {
          const res = await getApi(`${API_ROUTES.canvases.base}?page=${currentBatchPage}&limit=${BATCH_LIMIT}&sort=activity`);
          skeletons.forEach((s) => s.remove());
          if (res.ok) {
            const data = await res.json();
            if (data && Array.isArray(data.canvases) && data.canvases.length > 0) {
              let addedCount = 0;
              data.canvases.forEach((c: CanvasItem) => {
                if (!renderedUuids.has(c.uuid) && !c.deleted_at) {
                  renderedUuids.add(c.uuid);
                  recentsList.appendChild(createDrawerCanvasRow(c));
                  addedCount++;
                }
              });
              hasMoreBatches = Boolean(data.hasMore);
              if (!hasMoreBatches && addedCount === 0) {
                hasMoreBatches = false;
              }
            } else {
              hasMoreBatches = false;
            }
          } else {
            hasMoreBatches = false;
          }
        } else {
          await new Promise((resolve) => setTimeout(resolve, 180));
          skeletons.forEach((s) => s.remove());
          const startIdx = (currentBatchPage - 1) * BATCH_LIMIT;
          const localSlice = sortedRecents.slice(startIdx, startIdx + BATCH_LIMIT);
          localSlice.forEach((c) => {
            if (!renderedUuids.has(c.uuid)) {
              renderedUuids.add(c.uuid);
              recentsList.appendChild(createDrawerCanvasRow(c));
            }
          });
          hasMoreBatches = startIdx + BATCH_LIMIT < sortedRecents.length;
        }
      } catch {
        skeletons.forEach((s) => s.remove());
        hasMoreBatches = false;
      } finally {
        isLoadingBatch = false;
      }
    };

    btnViewAll?.addEventListener('click', async (e) => {
      e.preventDefault();
      if (btnViewAll) {
        btnViewAll.style.display = 'none';
      }
      await loadNextBatch();

      if (!isBatchScrollActive) {
        isBatchScrollActive = true;
        drawerBody.addEventListener(
          'scroll',
          () => {
            if (!hasMoreBatches || isLoadingBatch) return;
            const scrollRemaining = drawerBody.scrollHeight - drawerBody.scrollTop - drawerBody.clientHeight;
            if (scrollRemaining < 80) {
              void loadNextBatch();
            }
          },
          { passive: true }
        );
      }
    });
  } catch {
    if (sectionFavorites) {
      sectionFavorites.style.display = 'none';
    }
    if (favoritesList) {
      favoritesList.innerHTML = '';
    }
    if (recentsList) {
      recentsList.innerHTML = `
        <div class="drawer-empty-card" data-ref="drawer-empty-card-recents">
          <div class="drawer-empty-card__title">Diseños recientes</div>
          <div class="drawer-empty-card__desc">Aquí aparecerán los últimos diseños que hayas creado o abierto.</div>
        </div>
      `;
    }
  }
}

export function handleApplyCanvasTemplate(preset: PresetItem, canvasType: 'board' | 'doc' | 'presentation' | 'video'): void {
  const controller = getActiveCanvasController();

  if (canvasType === 'video') {
    showToast('Las plantillas de video se configuran al crear un nuevo video', 'info');
    if (window.innerWidth <= 768) {
      toggleDrawer(false);
    }
    return;
  }

  if (canvasType === 'presentation') {
    if (!controller) {
      showToast('No se encontró el controlador de la presentación', 'warning');
      return;
    }
    const templateId = preset.boardTemplateId || preset.id;
    controller.applyTemplate?.(templateId, 'insert');
    showToast(`Plantilla «${preset.name}» añadida a la presentación`, 'success');
    if (window.innerWidth <= 768) {
      toggleDrawer(false);
    }
    return;
  }

  if (canvasType === 'doc') {
    const docPreset = getDocTemplateById(preset.docTemplateId || preset.id) || DOC_TEMPLATES.find((p) => p.id === preset.docTemplateId) || DOC_TEMPLATES[0];
    if (!controller) {
      showToast('No se encontró el controlador del documento', 'warning');
      return;
    }

    if (typeof controller.isDocumentEmpty === 'function' && controller.isDocumentEmpty()) {
      controller.applyTemplateToDocument(docPreset);
      showToast(`Plantilla «${preset.name}» aplicada`, 'success');
      if (window.innerWidth <= 768) {
        toggleDrawer(false);
      }
      return;
    }

    const modal = openModal({
      cancelText: 'Cancelar',
      description: `¿Cómo deseas aplicar «${preset.name}» en tu documento actual?`,
      showCancel: true,
      showConfirm: false,
      title: 'Aplicar plantilla en el documento',
      bodyHtml: `
        <div class="template-choice-options" data-ref="template-choice-options">
          <button type="button" class="template-choice-card" data-ref="btn-choice-new-page">
            <div class="template-choice-card__icon">
              <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#note_add"></use></svg>
            </div>
            <div class="template-choice-card__content">
              <span class="template-choice-card__title">Añadir como nueva página</span>
              <span class="template-choice-card__desc">Inserta el contenido de la plantilla en una página nueva al final.</span>
            </div>
          </button>

          <button type="button" class="template-choice-card" data-ref="btn-choice-current-page">
            <div class="template-choice-card__icon">
              <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#find_replace"></use></svg>
            </div>
            <div class="template-choice-card__content">
              <span class="template-choice-card__title">Reemplazar página actual</span>
              <span class="template-choice-card__desc">Sobrescribe el contenido de la página actual con esta plantilla.</span>
            </div>
          </button>

          <button type="button" class="template-choice-card template-choice-card--danger" data-ref="btn-choice-replace-doc">
            <div class="template-choice-card__icon">
              <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#refresh"></use></svg>
            </div>
            <div class="template-choice-card__content">
              <span class="template-choice-card__title">Reemplazar todo el documento</span>
              <span class="template-choice-card__desc">Elimina las páginas existentes y aplica la plantilla completa.</span>
            </div>
          </button>
        </div>
      `,
    });

    const btnNewPage = modal.card?.querySelector<HTMLElement>('[data-ref="btn-choice-new-page"]');
    const btnCurrentPage = modal.card?.querySelector<HTMLElement>('[data-ref="btn-choice-current-page"]');
    const btnReplaceDoc = modal.card?.querySelector<HTMLElement>('[data-ref="btn-choice-replace-doc"]');

    btnNewPage?.addEventListener('click', () => {
      controller.applyTemplateAsNewPage(docPreset);
      modal.close();
      showToast(`Plantilla «${preset.name}» añadida como nueva página`, 'success');
      if (window.innerWidth <= 768) {
        toggleDrawer(false);
      }
    });

    btnCurrentPage?.addEventListener('click', () => {
      controller.applyTemplateToCurrentPage(docPreset);
      modal.close();
      showToast(`Página actual actualizada con «${preset.name}»`, 'success');
      if (window.innerWidth <= 768) {
        toggleDrawer(false);
      }
    });

    btnReplaceDoc?.addEventListener('click', () => {
      controller.applyTemplateToDocument(docPreset);
      modal.close();
      showToast(`Documento reemplazado con «${preset.name}»`, 'success');
      if (window.innerWidth <= 768) {
        toggleDrawer(false);
      }
    });
    return;
  }

  if (canvasType === 'board') {
    if (!controller) {
      showToast('No se encontró el controlador del pizarrón', 'warning');
      return;
    }

    const templateId = preset.boardTemplateId || preset.id;

    if (typeof controller.isBoardEmpty === 'function' && controller.isBoardEmpty()) {
      controller.applyTemplate(templateId, 'replace');
      showToast(`Plantilla «${preset.name}» cargada en el pizarrón`, 'success');
      if (window.innerWidth <= 768) {
        toggleDrawer(false);
      }
      return;
    }

    const modal = openModal({
      cancelText: 'Cancelar',
      description: `¿Cómo deseas insertar «${preset.name}» en tu pizarrón?`,
      showCancel: true,
      showConfirm: false,
      title: 'Insertar plantilla en el pizarrón',
      bodyHtml: `
        <div class="template-choice-options" data-ref="template-choice-options">
          <button type="button" class="template-choice-card" data-ref="btn-choice-insert-board">
            <div class="template-choice-card__icon">
              <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#add_circle"></use></svg>
            </div>
            <div class="template-choice-card__content">
              <span class="template-choice-card__title">Añadir al pizarrón</span>
              <span class="template-choice-card__desc">Inserta los elementos de la plantilla sin borrar tus elementos actuales.</span>
            </div>
          </button>

          <button type="button" class="template-choice-card template-choice-card--danger" data-ref="btn-choice-replace-board">
            <div class="template-choice-card__icon">
              <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#refresh"></use></svg>
            </div>
            <div class="template-choice-card__content">
              <span class="template-choice-card__title">Reemplazar todo el pizarrón</span>
              <span class="template-choice-card__desc">Limpia el pizarrón actual y coloca únicamente la plantilla seleccionada.</span>
            </div>
          </button>
        </div>
      `,
    });

    const btnInsertBoard = modal.card?.querySelector<HTMLElement>('[data-ref="btn-choice-insert-board"]');
    const btnReplaceBoard = modal.card?.querySelector<HTMLElement>('[data-ref="btn-choice-replace-board"]');

    btnInsertBoard?.addEventListener('click', () => {
      controller.applyTemplate(templateId, 'insert');
      modal.close();
      showToast(`Plantilla «${preset.name}» añadida al pizarrón`, 'success');
      if (window.innerWidth <= 768) {
        toggleDrawer(false);
      }
    });

    btnReplaceBoard?.addEventListener('click', () => {
      controller.applyTemplate(templateId, 'replace');
      modal.close();
      showToast(`Pizarrón reemplazado con «${preset.name}»`, 'success');
      if (window.innerWidth <= 768) {
        toggleDrawer(false);
      }
    });
    return;
  }
}

export function renderTemplatesDrawerContent(drawer: HTMLElement, drawerBody: HTMLElement): void {
  const sidebar = drawer.closest<HTMLElement>('[data-ref="sidebar"]') || document.querySelector<HTMLElement>('[data-ref="sidebar"]');
  const canvasType = getActiveCanvasType();
  const presets = ALL_PRESETS.filter((item) => {
    if (canvasType === 'doc') return item.canvasType === 'doc';
    return item.canvasType === 'board';
  });

  drawerBody.innerHTML = `
    <div class="canvas-panel-card" data-ref="canvas-panel-card">
      <div class="canvas-panel-card__header" data-ref="canvas-panel-header">
        <div class="canvas-panel-card__title-box" data-ref="canvas-panel-title-box">
          <svg class="component-icon canvas-panel-card__icon" aria-hidden="true"><use href="/icons.svg#space_dashboard"></use></svg>
          <span class="canvas-panel-card__title" data-ref="canvas-panel-title">${t('nav.templates') || 'Plantillas'}</span>
        </div>
        <button type="button" class="component-button component-button--h32 component-button--icon-only rail-btn canvas-panel-card__close" data-ref="btn-close-canvas-panel" data-tooltip="Cerrar panel" aria-label="Cerrar panel">
          <svg class="component-icon rail-btn__icon" aria-hidden="true"><use href="/icons.svg#close"></use></svg>
        </button>
      </div>
      <div class="canvas-panel-card__body" data-ref="canvas-panel-body">
        <div class="menu-panel__search" data-ref="canvas-templates-search">
          <svg class="component-icon menu-panel__search-icon" aria-hidden="true"><use href="/icons.svg#search"></use></svg>
          <input class="menu-panel__search-input" data-ref="canvas-templates-search-input" type="text" maxlength="50" autocomplete="off" placeholder="${t('templates.search_placeholder') || 'Buscar plantillas...'}" />
        </div>
        <div class="canvas-panel-templates-grid" data-ref="canvas-templates-list"></div>
      </div>
    </div>
  `;

  const searchInput = drawerBody.querySelector<HTMLInputElement>('[data-ref="canvas-templates-search-input"]');
  const templatesList = drawerBody.querySelector<HTMLElement>('[data-ref="canvas-templates-list"]');
  const btnClose = drawerBody.querySelector<HTMLElement>('[data-ref="btn-close-canvas-panel"]');

  btnClose?.addEventListener('click', (e) => {
    e.preventDefault();
    toggleDrawer(false);
  });

  const renderList = (query = '') => {
    if (!templatesList) return;
    const cleanQ = query.trim().toLowerCase();
    const filtered = cleanQ
      ? presets.filter((p) => p.name.toLowerCase().includes(cleanQ) || p.categoryName?.toLowerCase().includes(cleanQ) || (p.tags && p.tags.some((tag) => tag.toLowerCase().includes(cleanQ))))
      : presets;

    if (filtered.length === 0) {
      if (cleanQ) {
        templatesList.innerHTML = `
          <div class="canvas-panel-card__empty" data-ref="canvas-panel-empty">
            <span class="canvas-panel-card__empty-title">Sin resultados</span>
            <p class="canvas-panel-card__empty-desc">No encontramos plantillas que coincidan con «${escapeHtml(query)}»</p>
          </div>
        `;
      } else {
        templatesList.innerHTML = `
          <div class="canvas-panel-card__empty" data-ref="canvas-panel-empty">
            <div class="canvas-panel-card__empty-icon" data-ref="templates-empty-icon">
              <svg class="component-icon" data-ref="templates-empty-svg" viewBox="0 0 56 56" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" style="width: 52px; height: 52px; color: var(--text-tertiary);">
                <rect x="8" y="8" width="40" height="40" rx="8" stroke-width="1.8" />
                <line x1="8" y1="20" x2="48" y2="20" stroke-width="1.8" />
                <line x1="22" y1="20" x2="22" y2="48" stroke-width="1.8" />
                <rect x="28" y="26" width="14" height="8" rx="2" stroke-width="1.5" stroke-dasharray="2 2" />
                <rect x="28" y="38" width="14" height="3" rx="1.5" stroke-width="1.5" />
              </svg>
            </div>
            <span class="canvas-panel-card__empty-title">Aquí habrá plantillas</span>
            <p class="canvas-panel-card__empty-desc">Aún no hay plantillas disponibles para este formato. Pronto encontrarás diseños listos para usar.</p>
          </div>
        `;
      }
      return;
    }

    templatesList.innerHTML = filtered.map((item) => `
      <div class="canvas-card template-card" data-ref="canvas-template-card-${item.id}" data-template-id="${item.id}" data-tooltip="${escapeHtml(item.name)}">
        <div class="canvas-card__thumbnail template-card__thumbnail" data-ref="template-thumb-${item.id}">
          <img class="canvas-card__image image-lazy-fade" data-ref="template-img-${item.id}" src="${item.imagePath}" alt="${escapeHtml(item.name)}" loading="lazy" decoding="async" onload="this.classList.add('image-loaded')" onerror="this.classList.add('image-loaded')" />
        </div>
      </div>
    `).join('');

    templatesList.querySelectorAll<HTMLElement>('.template-card').forEach((card) => {
      card.addEventListener('click', () => {
        const tmplId = card.getAttribute('data-template-id');
        const found = presets.find((p) => p.id === tmplId);
        if (found) {
          handleApplyCanvasTemplate(found, canvasType);
        }
      });
    });
  };

  searchInput?.addEventListener('input', () => {
    renderList(searchInput.value);
  });

  renderList();

  const drawerFooter = drawer.querySelector<HTMLElement>('[data-ref="drawer-footer"]');
  if (drawerFooter) {
    drawerFooter.style.display = 'none';
  }

  if (sidebar) {
    updateCanvasRailActiveState(sidebar);
  }

  renderIcons(drawerBody);
}
