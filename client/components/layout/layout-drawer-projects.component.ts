import { API_ROUTES } from '../../config/api-routes.js';
import { currentUser, escapeHtml, getApi } from '../../services/api.service.js';
import { getAllLocalCanvases, getLocalCanvasByUuid } from '../../services/canvas-storage.service.js';
import { t } from '../../services/i18n.service.js';
import { renderIcons } from '../../services/icon.service.js';
import { showToast } from '../../services/toast.service.js';
import { CanvasItem } from '../../types/canvas.types.js';
import { DocPage, DocProject } from '../../views/doc/doc.types.js';
import { getActiveCanvasController, getActiveCanvasType, toggleDrawer, updateCanvasRailActiveState } from '../layout.component.js';
import { openModal } from '../modal.component.js';

export function renderDocPageToDataUrl(page: DocPage, title = 'Documento'): Promise<string> {
  return new Promise((resolve) => {
    try {
      const width = 816;
      const height = 1056;
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(width * 1.5);
      canvas.height = Math.round(height * 1.5);
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve('');
        return;
      }

      ctx.scale(1.5, 1.5);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);

      const contentHtml = page.contentHtml || '<p>Página sin contenido</p>';
      const cleanHtml = contentHtml
        .replace(/&nbsp;/g, ' ')
        .replace(/<br>/g, '<br/>')
        .replace(/<img([^>]*?)(?<!\/)>/gi, '<img$1 />')
        .replace(/<hr([^>]*?)(?<!\/)>/gi, '<hr$1 />')
        .replace(/<input([^>]*?)(?<!\/)>/gi, '<input$1 />');

      const svgString = `
        <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
          <foreignObject width="100%" height="100%">
            <div xmlns="http://www.w3.org/1999/xhtml" style="box-sizing: border-box; width: ${width}px; height: ${height}px; padding: 48px 56px; background-color: #ffffff; color: #1e293b; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 14px; line-height: 1.6; word-break: break-word; overflow: hidden;">
              <style>
                p { margin: 0 0 10px 0; }
                h1 { font-size: 26px; font-weight: 700; margin: 0 0 16px 0; color: #0f172a; }
                h2 { font-size: 20px; font-weight: 600; margin: 16px 0 12px 0; color: #0f172a; }
                h3 { font-size: 16px; font-weight: 600; margin: 14px 0 8px 0; color: #0f172a; }
                ul, ol { margin: 0 0 12px 0; padding-left: 24px; }
                li { margin-bottom: 4px; }
                blockquote { border-left: 3px solid #3b82f6; padding-left: 12px; margin: 12px 0; color: #475569; font-style: italic; }
                table { width: 100%; border-collapse: collapse; margin: 12px 0; }
                th, td { border: 1px solid #cbd5e1; padding: 8px 12px; text-align: left; }
                th { background: #f8fafc; font-weight: 600; }
                img { max-width: 100%; height: auto; border-radius: 6px; }
                hr { border: none; border-top: 1px solid #e2e8f0; margin: 16px 0; }
              </style>
              ${cleanHtml}
            </div>
          </foreignObject>
        </svg>
      `;

      const img = new Image();
      const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
      const blobUrl = URL.createObjectURL(svgBlob);

      img.onload = () => {
        ctx.drawImage(img, 0, 0, width, height);
        URL.revokeObjectURL(blobUrl);
        resolve(canvas.toDataURL('image/png'));
      };

      img.onerror = () => {
        URL.revokeObjectURL(blobUrl);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(0, 0, width, 60);
        ctx.strokeStyle = '#e2e8f0';
        ctx.strokeRect(0, 0, width, height);
        ctx.fillStyle = '#0f172a';
        ctx.font = 'bold 20px sans-serif';
        ctx.fillText(title, 40, 38);
        ctx.fillStyle = '#64748b';
        ctx.font = '14px sans-serif';
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = page.contentHtml || '';
        const lines = (tempDiv.textContent || '').trim().split('\n').filter(Boolean);
        let y = 100;
        lines.slice(0, 25).forEach((line) => {
          ctx.fillText(line.slice(0, 80), 40, y);
          y += 24;
        });
        resolve(canvas.toDataURL('image/png'));
      };

      img.src = blobUrl;
    } catch {
      resolve('');
    }
  });
}

export function openDocPageSelectionModal(
  canvas: CanvasItem,
  docProject: DocProject,
  targetCanvasType: 'board' | 'doc' | 'presentation' | 'video'
): void {
  const pages = docProject.pages || [];
  if (pages.length === 0) {
    showToast('El documento no contiene páginas para insertar.', 'warning');
    return;
  }

  let selectedIndex = -1;

  const getPageSnippet = (html: string): string => {
    const temp = document.createElement('div');
    temp.innerHTML = html;
    const text = (temp.textContent || '').replace(/\s+/g, ' ').trim();
    return text.length > 90 ? `${text.slice(0, 90)}...` : (text || 'Página en blanco');
  };

  const modal = openModal({
    cancelText: 'Cancelar',
    confirmClass: 'component-button--black',
    confirmText: 'Insertar en el lienzo',
    description: `Este documento tiene ${pages.length} páginas. Selecciona cuál deseas colocar en tu lienzo:`,
    showCancel: true,
    showConfirm: true,
    size: 'lg',
    title: `Seleccionar página de «${canvas.name}»`,
    bodyHtml: `
      <div class="doc-page-picker" data-ref="doc-page-picker">
        <button type="button" class="doc-page-picker__item is-selected" data-ref="card-page-all">
          <div class="doc-page-picker__icon">
            <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#library_books"></use></svg>
          </div>
          <div class="doc-page-picker__info">
            <span class="doc-page-picker__title">Todas las páginas (${pages.length})</span>
            <span class="doc-page-picker__snippet">Inserta el documento entero con todas sus páginas de forma secuencial.</span>
          </div>
        </button>
        ${pages.map((p, idx) => `
          <button type="button" class="doc-page-picker__item" data-ref="card-page-${idx}" data-page-idx="${idx}">
            <div class="doc-page-picker__icon">
              <span class="doc-page-picker__page-num">${idx + 1}</span>
            </div>
            <div class="doc-page-picker__info">
              <span class="doc-page-picker__title">Página ${idx + 1}</span>
              <span class="doc-page-picker__snippet">${escapeHtml(getPageSnippet(p.contentHtml || ''))}</span>
            </div>
          </button>
        `).join('')}
      </div>
    `,
    onConfirm: async () => {
      modal.close();
      await handleApplyCanvasProject(canvas, targetCanvasType, selectedIndex, docProject);
    },
  });

  const pickerEl = modal.backdrop.querySelector<HTMLElement>('[data-ref="doc-page-picker"]');
  const allCard = pickerEl?.querySelector<HTMLElement>('[data-ref="card-page-all"]');
  const pageCards = pickerEl?.querySelectorAll<HTMLElement>('[data-page-idx]');

  const updateSelection = (idx: number) => {
    selectedIndex = idx;
    allCard?.classList.toggle('is-selected', selectedIndex === -1);
    pageCards?.forEach((c) => {
      const cardIdx = parseInt(c.getAttribute('data-page-idx') || '-99', 10);
      c.classList.toggle('is-selected', cardIdx === selectedIndex);
    });
  };

  allCard?.addEventListener('click', () => updateSelection(-1));
  pageCards?.forEach((c) => {
    c.addEventListener('click', () => {
      const idx = parseInt(c.getAttribute('data-page-idx') || '-1', 10);
      updateSelection(idx);
    });
  });

  renderIcons(modal.backdrop);
}

export async function handleApplyCanvasProject(
  canvas: CanvasItem,
  targetCanvasType: 'board' | 'doc' | 'presentation' | 'video',
  pageIndex = -1,
  loadedProjectData?: any
): Promise<void> {
  const controller = getActiveCanvasController();
  if (!controller) {
    showToast('No se encontró el controlador del lienzo activo', 'warning');
    return;
  }

  if (targetCanvasType === 'video') {
    showToast('Los elementos de proyectos se agregan desde el panel de subidos o herramientas', 'info');
    if (window.innerWidth <= 768) toggleDrawer(false);
    return;
  }

  let projectData = loadedProjectData;
  if (!projectData) {
    if (canvas.data) {
      try {
        projectData = typeof canvas.data === 'string' ? JSON.parse(canvas.data) : canvas.data;
      } catch {}
    }
    if (!projectData) {
      const fullCanvas = await getLocalCanvasByUuid(canvas.uuid);
      if (fullCanvas?.data) {
        try {
          projectData = typeof fullCanvas.data === 'string' ? JSON.parse(fullCanvas.data) : fullCanvas.data;
        } catch {}
      }
    }
    if (!projectData && currentUser && canvas.id) {
      try {
        const res = await getApi(API_ROUTES.canvases.byId(canvas.uuid));
        if (res.ok) {
          const resData = await res.json();
          if (resData?.canvas?.data) {
            projectData = typeof resData.canvas.data === 'string' ? JSON.parse(resData.canvas.data) : resData.canvas.data;
          }
        }
      } catch {}
    }
  }

  const sourceType = canvas.canvas_type || (canvas.unit === 'board' ? 'board' : (canvas.unit === 'diagram' ? 'diagram' : (canvas.unit === 'doc' ? 'doc' : (canvas.unit === 'presentation' ? 'presentation' : 'pixel'))));

  if (targetCanvasType === 'board') {
    if (sourceType === 'board' && projectData && Array.isArray(projectData.elements) && projectData.elements.length > 0) {
      if (typeof controller.insertBoardElements === 'function') {
        controller.insertBoardElements(projectData.elements);
        showToast(`Elementos de «${canvas.name}» insertados en el pizarrón`, 'success');
        if (window.innerWidth <= 768) toggleDrawer(false);
        return;
      }
    }

    if ((sourceType === 'doc' || sourceType === 'presentation') && projectData && Array.isArray(projectData.pages) && projectData.pages.length > 0) {
      const pagesToInsert: DocPage[] = pageIndex >= 0 && projectData.pages[pageIndex]
        ? [projectData.pages[pageIndex]]
        : projectData.pages;

      if (typeof controller.insertDocAsBoardElements === 'function') {
        controller.insertDocAsBoardElements(pagesToInsert, canvas.name);
        showToast(`«${canvas.name}» insertado como tarjetas y textos editables`, 'success');
        if (window.innerWidth <= 768) toggleDrawer(false);
        return;
      }
    }

    if (projectData && projectData.nodes) {
      if (typeof controller.insertDiagramAsBoardElements === 'function') {
        controller.insertDiagramAsBoardElements(projectData, canvas.name);
        showToast(`Diagrama «${canvas.name}» insertado como figuras y flechas editables`, 'success');
        if (window.innerWidth <= 768) toggleDrawer(false);
        return;
      }
    }

    if (sourceType === 'pixel' && canvas.preview_thumbnail) {
      if (typeof controller.insertPixelGridElement === 'function') {
        controller.insertPixelGridElement(canvas.preview_thumbnail, canvas.width || 32, canvas.height || 32, canvas.name);
        showToast(`Pixel art «${canvas.name}» insertado como grilla de píxeles editable`, 'success');
        if (window.innerWidth <= 768) toggleDrawer(false);
        return;
      }
    }

    const fallbackThumbnail = canvas.preview_thumbnail || '';
    if (fallbackThumbnail) {
      controller.insertImage(fallbackThumbnail, canvas.width || 320, canvas.height || 240, canvas.name);
      showToast(`«${canvas.name}» colocado en el pizarrón`, 'success');
      if (window.innerWidth <= 768) toggleDrawer(false);
      return;
    }

    showToast(`No se pudo obtener la información de «${canvas.name}»`, 'warning');
    return;
  }

  if (targetCanvasType === 'doc') {
    if (sourceType === 'doc' && projectData && Array.isArray(projectData.pages) && projectData.pages.length > 0) {
      const pagesToInsert: DocPage[] = pageIndex >= 0 && projectData.pages[pageIndex]
        ? [projectData.pages[pageIndex]]
        : projectData.pages;

      pagesToInsert.forEach((page) => {
        if (typeof controller.insertDocPage === 'function') {
          controller.insertDocPage(page, 'new_page');
        } else if (typeof controller.applyTemplateAsNewPage === 'function') {
          controller.applyTemplateAsNewPage({
            badge: '',
            description: '',
            icon: '',
            id: `doc_import_${Date.now()}`,
            initialPages: [page],
            name: canvas.name,
            settings: {},
          });
        }
      });
      showToast(`Página(s) de «${canvas.name}» insertadas en el documento`, 'success');
      if (window.innerWidth <= 768) toggleDrawer(false);
      return;
    }

    if (projectData && projectData.nodes) {
      if (typeof controller.insertDiagramAsDocOutline === 'function') {
        controller.insertDiagramAsDocOutline(projectData, canvas.name);
        showToast(`Esquema estructurado de «${canvas.name}» insertado en el documento`, 'success');
        if (window.innerWidth <= 768) toggleDrawer(false);
        return;
      }
    }

    if (sourceType === 'board' && projectData && Array.isArray(projectData.elements)) {
      if (typeof controller.insertBoardAsDocContent === 'function') {
        controller.insertBoardAsDocContent(projectData, canvas.name);
        showToast(`Notas y textos de «${canvas.name}» insertados en el documento`, 'success');
        if (window.innerWidth <= 768) toggleDrawer(false);
        return;
      }
    }

    const fallbackThumbnail = canvas.preview_thumbnail || '';
    if (fallbackThumbnail) {
      controller.insertImage(fallbackThumbnail, canvas.name, '400px');
      showToast(`«${canvas.name}» insertado en el documento`, 'success');
      if (window.innerWidth <= 768) toggleDrawer(false);
      return;
    }

    showToast(`No se pudo insertar «${canvas.name}» en el documento`, 'warning');
    return;
  }
}

export async function renderProjectsDrawerContent(drawer: HTMLElement, drawerBody: HTMLElement): Promise<void> {
  const sidebar = drawer.closest<HTMLElement>('[data-ref="sidebar"]') || document.querySelector<HTMLElement>('[data-ref="sidebar"]');
  const targetCanvasType = getActiveCanvasType();

  drawerBody.innerHTML = `
    <div class="canvas-panel-card" data-ref="canvas-panel-card">
      <div class="canvas-panel-card__header" data-ref="canvas-panel-header">
        <div class="canvas-panel-card__title-box" data-ref="canvas-panel-title-box">
          <svg class="component-icon canvas-panel-card__icon" aria-hidden="true"><use href="/icons.svg#folder"></use></svg>
          <span class="canvas-panel-card__title" data-ref="canvas-panel-title">${t('nav.projects') || 'Proyectos'}</span>
        </div>
        <button type="button" class="component-button component-button--h32 component-button--icon-only rail-btn canvas-panel-card__close" data-ref="btn-close-canvas-panel" data-tooltip="Cerrar panel" aria-label="Cerrar panel">
          <svg class="component-icon rail-btn__icon" aria-hidden="true"><use href="/icons.svg#close"></use></svg>
        </button>
      </div>
      <div class="canvas-panel-card__body canvas-projects-container" data-ref="canvas-panel-body">
        <div class="menu-panel__search" data-ref="canvas-projects-search">
          <svg class="component-icon menu-panel__search-icon" aria-hidden="true"><use href="/icons.svg#search"></use></svg>
          <input class="menu-panel__search-input" data-ref="canvas-projects-search-input" type="text" maxlength="50" autocomplete="off" placeholder="Buscar en tus proyectos..." />
        </div>

        <div class="canvas-panel-templates-grid canvas-panel-projects-grid" data-ref="canvas-projects-grid">
          <div class="skeleton" style="aspect-ratio: 16 / 10; border-radius: 12px;"></div>
          <div class="skeleton" style="aspect-ratio: 16 / 10; border-radius: 12px;"></div>
          <div class="skeleton" style="aspect-ratio: 16 / 10; border-radius: 12px;"></div>
          <div class="skeleton" style="aspect-ratio: 16 / 10; border-radius: 12px;"></div>
          <div class="skeleton" style="aspect-ratio: 16 / 10; border-radius: 12px;"></div>
          <div class="skeleton" style="aspect-ratio: 16 / 10; border-radius: 12px;"></div>
        </div>
      </div>
    </div>
  `;

  const btnClose = drawerBody.querySelector<HTMLElement>('[data-ref="btn-close-canvas-panel"]');
  btnClose?.addEventListener('click', (e) => {
    e.preventDefault();
    toggleDrawer(false);
  });

  const searchInput = drawerBody.querySelector<HTMLInputElement>('[data-ref="canvas-projects-search-input"]');
  const grid = drawerBody.querySelector<HTMLElement>('[data-ref="canvas-projects-grid"]');

  let projectItems: CanvasItem[] = [];

  const getCanvasTypeKey = (c: CanvasItem): 'board' | 'doc' | 'presentation' => {
    if (c.canvas_type === 'presentation' || c.unit === 'presentation') return 'presentation';
    if (c.canvas_type === 'doc' || c.unit === 'doc') return 'doc';
    return 'board';
  };

  const getTypeIcon = (typeKey: 'board' | 'doc' | 'presentation'): string => {
    if (typeKey === 'presentation') return 'slideshow';
    if (typeKey === 'doc') return 'description';
    return 'dashboard';
  };

  const renderGrid = (query = '') => {
    if (!grid) return;
    const cleanQ = query.trim().toLowerCase();

    let filtered = projectItems.filter((c) => !c.deleted_at);

    if (cleanQ) {
      filtered = filtered.filter((c) => (c.name || '').toLowerCase().includes(cleanQ));
    }

    if (filtered.length === 0) {
      if (projectItems.length === 0) {
        grid.innerHTML = `
          <div class="canvas-panel-card__empty" data-ref="canvas-projects-empty" style="grid-column: 1 / -1;">
            <div class="canvas-panel-card__empty-icon">
              <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#folder_open"></use></svg>
            </div>
            <span class="canvas-panel-card__empty-title">Aún no tienes proyectos</span>
            <p class="canvas-panel-card__empty-desc">Crea diseños, pizarrones o documentos para verlos aquí y colocarlos en tus lienzos.</p>
          </div>
        `;
      } else {
        grid.innerHTML = `
          <div class="canvas-panel-card__empty" data-ref="canvas-projects-no-results" style="grid-column: 1 / -1;">
            <span class="canvas-panel-card__empty-title">Sin resultados</span>
            <p class="canvas-panel-card__empty-desc">No encontramos proyectos que coincidan con «${escapeHtml(query)}»</p>
          </div>
        `;
      }
      renderIcons(grid);
      return;
    }

    grid.innerHTML = filtered.map((c) => {
      const typeKey = getCanvasTypeKey(c);
      const iconName = getTypeIcon(typeKey);
      const thumbHtml = c.preview_thumbnail
        ? `<img class="canvas-card__image image-lazy-fade" data-ref="img-proj-${c.uuid}" src="${c.preview_thumbnail}" alt="${escapeHtml(c.name || '')}" loading="lazy" decoding="async" onload="this.classList.add('image-loaded')" onerror="this.classList.add('image-loaded')" />`
        : `<svg class="component-icon" aria-hidden="true" style="position: absolute; inset: 0; margin: auto; width: 44px; height: 44px; color: var(--text-tertiary);"><use href="/icons.svg#${iconName}"></use></svg>`;

      return `
        <div class="canvas-card template-card" data-ref="canvas-project-card-${c.uuid}" data-project-uuid="${c.uuid}" data-tooltip="${escapeHtml(c.name || 'Diseño sin título')}">
          <div class="canvas-card__thumbnail template-card__thumbnail" data-ref="project-thumb-${c.uuid}">
            ${thumbHtml}
          </div>
        </div>
      `;
    }).join('');

    renderIcons(grid);

    grid.querySelectorAll<HTMLElement>('.template-card').forEach((card) => {
      card.addEventListener('click', async () => {
        const uuid = card.getAttribute('data-project-uuid');
        const found = projectItems.find((p) => p.uuid === uuid);
        if (!found) return;

        const typeKey = getCanvasTypeKey(found);

        if (typeKey === 'doc') {
          let docProj: DocProject | null = null;
          if (found.data) {
            try {
              docProj = typeof found.data === 'string' ? JSON.parse(found.data) : found.data;
            } catch {}
          }
          if (!docProj) {
            const localData = await getLocalCanvasByUuid(found.uuid);
            if (localData?.data) {
              try {
                docProj = typeof localData.data === 'string' ? JSON.parse(localData.data) : localData.data;
              } catch {}
            }
          }
          if (!docProj && currentUser && found.id) {
            try {
              const res = await getApi(API_ROUTES.canvases.byId(found.uuid));
              if (res.ok) {
                const resData = await res.json();
                if (resData?.canvas?.data) {
                  docProj = typeof resData.canvas.data === 'string' ? JSON.parse(resData.canvas.data) : resData.canvas.data;
                }
              }
            } catch {}
          }

          if (docProj && docProj.pages && docProj.pages.length > 1) {
            openDocPageSelectionModal(found, docProj, targetCanvasType);
            return;
          }
        }

        await handleApplyCanvasProject(found, targetCanvasType, -1);
      });
    });
  };

  searchInput?.addEventListener('input', () => {
    renderGrid(searchInput.value);
  });

  try {
    const localCanvases = await getAllLocalCanvases();
    if (currentUser) {
      try {
        const res = await getApi(API_ROUTES.canvases.base);
        if (res.ok) {
          const data = await res.json();
          if (data && Array.isArray(data.canvases)) {
            const cloudUuids = new Set(data.canvases.map((c: CanvasItem) => c.uuid));
            const unsynced = localCanvases.filter((c) => c.is_local && !cloudUuids.has(c.uuid) && !c.id && (!c.user_id || c.user_id === currentUser?.id));
            projectItems = [...unsynced, ...data.canvases];
          } else {
            projectItems = localCanvases;
          }
        } else {
          projectItems = localCanvases;
        }
      } catch {
        projectItems = localCanvases;
      }
    } else {
      projectItems = localCanvases.filter((c) => c.is_local && !c.user_id && !c.id);
    }
  } catch {
    projectItems = [];
  }

  projectItems.sort((a, b) => {
    const timeA = new Date(a.updated_at || a.created_at).getTime();
    const timeB = new Date(b.updated_at || b.created_at).getTime();
    return timeB - timeA;
  });

  renderGrid(searchInput?.value || '');

  const drawerFooter = drawer.querySelector<HTMLElement>('[data-ref="drawer-footer"]');
  if (drawerFooter) {
    drawerFooter.style.display = 'none';
  }

  if (sidebar) {
    updateCanvasRailActiveState(sidebar);
  }

  renderIcons(drawerBody);
}
