import { API_ROUTES } from '../../config/api-routes.js';
import { BOARD_3D_SHAPES } from '../../config/board-3d-shapes.config.js';
import { DIAGRAM_COMPONENTS, DiagramComponentItem } from '../../config/diagram-components.data.js';
import { ALL_MOCKUP_ITEMS } from '../../config/mockups.config.js';
import { createStickyNoteSvg, DEFAULT_STICKY_COLOR, STICKY_NOTE_PRESETS } from '../../config/sticky-notes.config.js';
import { renderElementCategoryTilesHtml } from '../../graphics/element-category-tiles.graphics.js';
import { escapeHtml, getApi } from '../../services/api.service.js';
import { t } from '../../services/i18n.service.js';
import { renderIcons } from '../../services/icon.service.js';
import { showToast } from '../../services/toast.service.js';
import { ElementItem } from '../../types/element.types.js';
import { PIXEL_SHAPES, PixelShape, ShapeCategory } from '../../utils/pixel-shapes.util.js';
import { CHART_GROUPS } from '../../views/board/board-charts-panel.component.js';
import { ChartType, Shape3DType, ShapeType } from '../../views/board/board.types.js';
import { getActiveCanvasController, getActiveCanvasType, toggleDrawer, updateCanvasRailActiveState } from '../layout.component.js';
import { BOARD_3D_2D_SVGS, handleApply3DShape, handleApplyMockup, handleApplyTable, PIXEL_GRID_PRESETS, renderGalleryCategoryHtml, renderSearchMatchesGalleryHtml, TABLE_PRESETS } from './layout-drawer-elements-gallery.component.js';

let activeElementsCategory: 'root' | 'shapes' | 'stickies' | 'diagrams' | 'tables' | 'charts' | 'frames' | 'grids' | 'mockups' | '3d' | 'pixel-grid' = 'root';
let activeShapeSection: string | null = null;

const ALL_CHART_ITEMS = CHART_GROUPS.flatMap((g) => g.items);

interface RecentElementItem {
  category?: ShapeCategory;
  diagramCategory?: string;
  file?: string;
  fillColor?: string;
  id: string;
  name: string;
  pathD?: string;
  previewSvg?: string;
  shapeType?: ShapeType;
  strokeColor?: string;
  text?: string;
  textColor?: string;
  type: 'vector' | 'sticker' | 'diagram' | 'sticky';
}

function getRecentElements(): RecentElementItem[] {
  try {
    const raw = localStorage.getItem('spriteboard_recent_elements');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return [];
}

function addRecentElement(item: RecentElementItem): void {
  try {
    const current = getRecentElements().filter((r) => r.id !== item.id);
    current.unshift(item);
    localStorage.setItem('spriteboard_recent_elements', JSON.stringify(current.slice(0, 16)));
  } catch {}
}

const SHAPE_SECTIONS: Array<{ key: 'lines' | 'basic' | 'polygons' | 'stars' | 'arrows' | 'callouts' | 'clouds' | 'hearts' | 'banners' | 'tears' | 'gears' | 'asterisks' | 'organic' | 'abstract'; label: string }> = [
  { key: 'lines', label: 'Líneas' },
  { key: 'basic', label: 'Formas básicas' },
  { key: 'polygons', label: 'Polígonos' },
  { key: 'stars', label: 'Estrellas y destellos' },
  { key: 'arrows', label: 'Flechas' },
  { key: 'callouts', label: 'Globos de diálogo' },
  { key: 'clouds', label: 'Nubes' },
  { key: 'hearts', label: 'Corazones' },
  { key: 'banners', label: 'Banners' },
  { key: 'tears', label: 'Lágrimas' },
  { key: 'gears', label: 'Engranajes' },
  { key: 'asterisks', label: 'Asteriscos' },
  { key: 'organic', label: 'Formas orgánicas' },
  { key: 'abstract', label: 'Formas abstractas' },
];

function handleApplyDiagramComponent(item: DiagramComponentItem, canvasType: 'board' | 'doc' | 'presentation' | 'video'): void {
  const controller = getActiveCanvasController();

  addRecentElement({
    diagramCategory: item.category,
    fillColor: item.fillColor,
    id: item.id,
    name: item.name,
    previewSvg: item.previewSvg,
    shapeType: item.shapeType,
    strokeColor: item.strokeColor,
    text: item.text,
    textColor: item.textColor,
    type: 'diagram',
  });

  if (canvasType === 'video') {
    if (!controller) {
      showToast('No se encontró el controlador del video', 'warning');
      return;
    }
    controller.insertDiagramComponent?.(item);
    showToast(`«${item.name}» añadido al video`, 'success');
    if (window.innerWidth <= 768) {
      toggleDrawer(false);
    }
    return;
  }

  if (canvasType === 'doc') {
    if (!controller) {
      showToast('No se encontró el controlador del documento', 'warning');
      return;
    }

    if (item.type === 'shape' && item.shapeType) {
      controller.insertShapeSvg?.(item.previewSvg, item.name, item.strokeColor || '#1e293b');
      showToast(`«${item.name}» insertado en el documento`, 'success');
    } else {
      showToast(`Elemento de diagrama «${item.name}» optimizado para Pizarrón`, 'info');
    }
    if (window.innerWidth <= 768) {
      toggleDrawer(false);
    }
    return;
  }

  if (canvasType === 'board' || canvasType === 'presentation') {
    if (!controller) {
      showToast('No se encontró el controlador del lienzo', 'warning');
      return;
    }

    if (item.type === 'shape' && item.shapeType) {
      controller.insertDiagramNode?.({
        fillColor: item.fillColor,
        height: item.height,
        isMindMapNode: item.isMindMapNode,
        shapeType: item.shapeType,
        strokeColor: item.strokeColor,
        text: item.text,
        textColor: item.textColor,
        width: item.width,
      });
      showToast(`«${item.name}» añadido al lienzo`, 'success');
    } else if (item.type === 'sticky') {
      controller.insertStickyNote?.(item.fillColor || DEFAULT_STICKY_COLOR, item.text);
      showToast(`Nota «${item.name}» añadida al lienzo`, 'success');
    } else if (item.type === 'connector') {
      controller.activateConnectorTool?.(item.connectorStyle);
      showToast(`Herramienta ${item.name} activada: arrastra entre nodos`, 'info');
    }

    if (window.innerWidth <= 768) {
      toggleDrawer(false);
    }
  }
}

function handleApplyCanvasElement(shape: PixelShape, canvasType: 'board' | 'doc' | 'presentation' | 'video'): void {
  const controller = getActiveCanvasController();

  addRecentElement({
    category: shape.category,
    file: shape.file,
    fillColor: '#000000',
    id: shape.id,
    name: shape.name,
    pathD: shape.pathD,
    previewSvg: shape.previewSvg,
    strokeColor: '#000000',
    type: 'vector',
  });

  if (canvasType === 'video') {
    if (!controller) {
      showToast('No se encontró el controlador del video', 'warning');
      return;
    }
    controller.insertShapeOrSticker?.(shape);
    showToast(`«${shape.name}» añadido al video`, 'success');
    if (window.innerWidth <= 768) {
      toggleDrawer(false);
    }
    return;
  }

  if (canvasType === 'doc') {
    if (!controller) {
      showToast('No se encontró el controlador del documento', 'warning');
      return;
    }

    if (shape.isLine && shape.previewSvg) {
      const lineSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="160" height="40" style="color: #000000;">${shape.previewSvg}</svg>`;
      const dataUrl = `data:image/svg+xml;utf8,${encodeURIComponent(lineSvg)}`;
      controller.insertImageElement?.(dataUrl, '160px', shape.name);
    } else if (shape.type === 'vector' && shape.pathD) {
      controller.insertShapeSvg(shape.pathD, shape.name, '#000000');
    } else if (shape.type === 'sticker' && shape.file) {
      controller.insertImage(`/assets/img/stickers/${shape.file}`, shape.name);
    }
    showToast(`«${shape.name}» insertado en el documento`, 'success');
    if (window.innerWidth <= 768) {
      toggleDrawer(false);
    }
    return;
  }

  if (canvasType === 'board' || canvasType === 'presentation') {
    if (!controller) {
      showToast('No se encontró el controlador del lienzo', 'warning');
      return;
    }

    controller.insertShapeOrSticker?.(shape);
    showToast(`«${shape.name}» añadido al lienzo`, 'success');
    if (window.innerWidth <= 768) {
      toggleDrawer(false);
    }
    return;
  }
}

function handleApplyLibraryElement(item: ElementItem, canvasType: 'board' | 'doc' | 'presentation' | 'video'): void {
  const controller = getActiveCanvasController();
  if (!controller) {
    showToast('No se encontró el controlador del lienzo activo', 'warning');
    return;
  }

  addRecentElement({
    file: item.file_url,
    id: item.uuid,
    name: item.title,
    previewSvg: item.svg_content || undefined,
    type: item.svg_content ? 'vector' : 'sticker',
  });

  if (controller.insertElementFromLibrary) {
    controller.insertElementFromLibrary(item);
  } else if (controller.insertShapeOrSticker && item.svg_content) {
    controller.insertShapeOrSticker({
      category: 'shapes',
      height: item.height || 180,
      id: item.uuid,
      name: item.title,
      pathD: item.svg_content,
      type: 'vector',
      width: item.width || 180,
    });
  } else if (controller.insertImage) {
    controller.insertImage(item.file_url, item.title);
  }

  showToast(`«${item.title}» añadido al lienzo`, 'success');
  if (window.innerWidth <= 768) {
    toggleDrawer(false);
  }
}

function handleApplyStickyPreset(item: { color: string; id: string; name: string; stroke: string; text?: string; textColor?: string }, canvasType: 'board' | 'doc' | 'presentation' | 'video'): void {
  const controller = getActiveCanvasController();
  const noteText = item.text || 'Nota';

  addRecentElement({
    fillColor: item.color,
    id: item.id,
    name: item.name,
    strokeColor: item.stroke,
    text: noteText,
    type: 'sticky',
  });

  if (canvasType === 'video' && controller) {
    controller.insertStickyPreset?.(item.color, noteText);
    showToast(`Nota «${item.name}» añadida al video`, 'success');
  } else if ((canvasType === 'board' || canvasType === 'presentation') && controller) {
    controller.insertStickyNote?.(item.color, noteText);
    showToast(`Nota «${item.name}» añadida al lienzo`, 'success');
  } else if (canvasType === 'doc' && controller) {
    showToast('Las notas adhesivas están optimizadas para el pizarrón', 'info');
  }

  if (window.innerWidth <= 768) {
    toggleDrawer(false);
  }
}

function handleApplyRecentElement(item: RecentElementItem, canvasType: 'board' | 'doc' | 'presentation' | 'video'): void {
  if (item.type === 'sticky') {
    handleApplyStickyPreset({
      color: item.fillColor || DEFAULT_STICKY_COLOR,
      id: item.id,
      name: item.name,
      stroke: item.strokeColor || '#f59e0b',
      text: item.text || 'Nota',
    }, canvasType);
    return;
  }
  if (item.type === 'diagram') {
    const diag = DIAGRAM_COMPONENTS.find((d) => d.id === item.id);
    if (diag) {
      handleApplyDiagramComponent(diag, canvasType);
    } else {
      handleApplyDiagramComponent({
        category: (item.diagramCategory as any) || 'flowchart',
        categoryLabel: 'Diagramas',
        description: item.name,
        fillColor: item.fillColor,
        id: item.id,
        name: item.name,
        previewSvg: item.previewSvg || '',
        shapeType: item.shapeType,
        strokeColor: item.strokeColor,
        text: item.text,
        textColor: item.textColor,
        type: 'shape',
      }, canvasType);
    }
    return;
  }
  const shape = PIXEL_SHAPES.find((s) => s.id === item.id);
  if (shape) {
    handleApplyCanvasElement(shape, canvasType);
  } else {
    handleApplyCanvasElement({
      category: item.category || 'shapes',
      file: item.file,
      height: 60,
      id: item.id,
      name: item.name,
      pathD: item.pathD,
      type: item.type as 'vector' | 'sticker',
      width: 60,
    }, canvasType);
  }
}

export function handleApplyChart(chartType: ChartType, canvasType: 'board' | 'doc' | 'presentation' | 'video'): void {
  const controller = getActiveCanvasController();
  if (canvasType === 'video' && controller) {
    controller.insertChart?.(chartType);
    showToast('Gráfica añadida al video', 'success');
  } else if ((canvasType === 'board' || canvasType === 'presentation') && controller) {
    controller.insertChart?.(chartType);
    showToast('Gráfica añadida al lienzo', 'success');
  } else if (canvasType === 'doc' && controller) {
    showToast('Las gráficas interactivas están disponibles en el pizarrón', 'info');
  }
  if (window.innerWidth <= 768) {
    toggleDrawer(false);
  }
}

export function renderElementsDrawerContent(drawer: HTMLElement, drawerBody: HTMLElement): void {
  const sidebar = drawer.closest<HTMLElement>('[data-ref="sidebar"]') || document.querySelector<HTMLElement>('[data-ref="sidebar"]');
  const canvasType = getActiveCanvasType();
  let currentLibraryElements: ElementItem[] = [];
  let searchDebounceTimer: any = null;

  drawerBody.innerHTML = `
    <div class="canvas-panel-card" data-ref="canvas-panel-card">
      <div class="canvas-panel-card__header" data-ref="canvas-panel-header">
        <div class="canvas-panel-card__title-box" data-ref="canvas-panel-title-box">
          <button type="button" class="component-button component-button--h32 component-button--icon-only rail-btn canvas-panel-card__back" data-ref="btn-elements-header-back" data-tooltip="Volver" aria-label="Volver" style="display: none; margin-right: 4px;">
            <svg class="component-icon rail-btn__icon" aria-hidden="true"><use href="/icons.svg#arrow_back"></use></svg>
          </button>
          <svg class="component-icon canvas-panel-card__icon" data-ref="canvas-panel-icon" aria-hidden="true"><use href="/icons.svg#category"></use></svg>
          <span class="canvas-panel-card__title" data-ref="canvas-panel-title">${t('nav.elements') || 'Elementos'}</span>
        </div>
        <button type="button" class="component-button component-button--h32 component-button--icon-only rail-btn canvas-panel-card__close" data-ref="btn-close-canvas-panel" data-tooltip="Cerrar panel" aria-label="Cerrar panel">
          <svg class="component-icon rail-btn__icon" aria-hidden="true"><use href="/icons.svg#close"></use></svg>
        </button>
      </div>
      <div class="canvas-panel-card__body" data-ref="canvas-panel-body">
        <div class="menu-panel__search" data-ref="canvas-elements-search" style="margin-bottom: 8px;">
          <svg class="component-icon menu-panel__search-icon" aria-hidden="true"><use href="/icons.svg#search"></use></svg>
          <input class="menu-panel__search-input" data-ref="canvas-elements-search-input" type="text" maxlength="50" autocomplete="off" placeholder="Buscar foco, casa, estrella, formas..." />
        </div>

        <div class="elements-drawer-content" data-ref="elements-drawer-content"></div>
      </div>
    </div>
  `;

  const btnClose = drawerBody.querySelector<HTMLElement>('[data-ref="btn-close-canvas-panel"]');
  const btnHeaderBack = drawerBody.querySelector<HTMLButtonElement>('[data-ref="btn-elements-header-back"]');
  const panelTitle = drawerBody.querySelector<HTMLElement>('[data-ref="canvas-panel-title"]');
  const panelIcon = drawerBody.querySelector<HTMLElement>('[data-ref="canvas-panel-icon"]');

  btnClose?.addEventListener('click', (e) => {
    e.preventDefault();
    toggleDrawer(false);
  });

  btnHeaderBack?.addEventListener('click', () => {
    if (activeShapeSection !== null) {
      activeShapeSection = null;
      renderContent('');
      return;
    }
    activeElementsCategory = 'root';
    renderContent('');
  });

  const searchInput = drawerBody.querySelector<HTMLInputElement>('[data-ref="canvas-elements-search-input"]');
  const contentContainer = drawerBody.querySelector<HTMLElement>('[data-ref="elements-drawer-content"]');

  const fetchApiElements = async (query: string): Promise<ElementItem[]> => {
    try {
      const res = await getApi(API_ROUTES.elements.search({ limit: 40, q: query }));
      if (res.ok) {
        const body = await res.json();
        return body?.elements || [];
      }
    } catch {}
    return [];
  };

  const renderContent = async (query = '') => {
    if (!contentContainer) return;
    const cleanQ = query.trim().toLowerCase();

    if (cleanQ) {
      if (btnHeaderBack) btnHeaderBack.style.display = 'none';
      if (panelIcon) panelIcon.style.display = 'inline-block';
      if (panelTitle) panelTitle.textContent = t('nav.elements') || 'Elementos';

      const matchingDiagrams = DIAGRAM_COMPONENTS.filter((d) => d.name.toLowerCase().includes(cleanQ) || d.description.toLowerCase().includes(cleanQ) || d.categoryLabel.toLowerCase().includes(cleanQ));
      const matchingShapes = PIXEL_SHAPES.filter((s) => s.name.toLowerCase().includes(cleanQ) || s.id.toLowerCase().includes(cleanQ));
      const matchingCharts = ALL_CHART_ITEMS.filter((c) => c.name.toLowerCase().includes(cleanQ) || c.description.toLowerCase().includes(cleanQ) || 'gráficas'.includes(cleanQ) || 'graficas'.includes(cleanQ) || 'charts'.includes(cleanQ));
      const matching3D = BOARD_3D_SHAPES.filter((s) => s.name.toLowerCase().includes(cleanQ) || s.id.toLowerCase().includes(cleanQ) || '3d'.includes(cleanQ));
      const matchingMockups = ALL_MOCKUP_ITEMS.filter((m) => m.name.toLowerCase().includes(cleanQ) || m.description.toLowerCase().includes(cleanQ) || 'mockup'.includes(cleanQ) || 'maqueta'.includes(cleanQ) || 'marco'.includes(cleanQ) || 'cuadricula'.includes(cleanQ) || 'collage'.includes(cleanQ));
      const matchingTables = (cleanQ.includes('tabl') || cleanQ.includes('table') || cleanQ.includes('cuad')) ? TABLE_PRESETS : [];
      const matchingPixel = (cleanQ.includes('pixel') || cleanQ.includes('píxel') || cleanQ.includes('grid') || cleanQ.includes('matriz') || cleanQ.includes('retro')) ? PIXEL_GRID_PRESETS : [];

      const apiElements = await fetchApiElements(cleanQ);
      currentLibraryElements = apiElements;

      if (matchingDiagrams.length === 0 && matchingShapes.length === 0 && matchingCharts.length === 0 && matching3D.length === 0 && matchingMockups.length === 0 && matchingTables.length === 0 && matchingPixel.length === 0 && apiElements.length === 0) {
        contentContainer.innerHTML = `
          <div class="canvas-panel-card__empty" data-ref="elements-empty">
            <span class="canvas-panel-card__empty-title">Sin resultados</span>
            <p class="canvas-panel-card__empty-desc">No se encontraron elementos para «${escapeHtml(query)}»</p>
          </div>
        `;
        return;
      }

      let html = '<div class="elements-grid" data-ref="elements-grid">';

      if (apiElements.length > 0) {
        html += '<div class="elements-section-title">Gráficos e Iconos comunitarios</div>';
        html += apiElements.map((elem) => {
          let preview = '';
          if (elem.svg_content) {
            preview = `<div style="width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; color: var(--text-primary);">${elem.svg_content}</div>`;
          } else if (elem.file_url) {
            preview = `<img src="${escapeHtml(elem.file_url)}" alt="${escapeHtml(elem.title)}" style="max-width: 34px; max-height: 34px; object-fit: contain;" loading="lazy" />`;
          } else {
            preview = `<svg class="component-icon" aria-hidden="true"><use href="/icons.svg#category"></use></svg>`;
          }
          return `
            <button type="button" class="element-grid-item" data-ref="btn-library-item-${elem.uuid}" data-library-uuid="${elem.uuid}" data-tooltip="${escapeHtml(elem.title)} (${elem.is_official ? 'Oficial' : escapeHtml(elem.designer_name || 'Diseñador')})" aria-label="${escapeHtml(elem.title)}" style="position: relative;">
              ${elem.is_premium ? '<span class="component-badge component-badge--warning" style="position: absolute; top: 3px; right: 3px; font-size: 8px; padding: 1px 4px; font-weight: 700; border-radius: 4px; line-height: 1;">PRO</span>' : ''}
              ${preview}
            </button>
          `;
        }).join('');
      }

      html += renderSearchMatchesGalleryHtml({
        matching3D,
        matchingCharts,
        matchingDiagrams,
        matchingMockups,
        matchingPixel,
        matchingShapes,
        matchingTables,
      });

      html += '</div>';
      contentContainer.innerHTML = html;
      bindItemClicks(contentContainer);
      renderIcons(contentContainer);
      return;
    }

    if (activeElementsCategory === 'root') {
      const recents = getRecentElements().slice(0, 6);
      const recentsHtml = recents.length > 0 ? `
        <div class="elements-recents-section" data-ref="elements-recents-section" style="margin-bottom: 14px;">
          <span class="elements-categories-heading">Usados recientemente</span>
          <div class="elements-grid elements-recents-grid" data-ref="elements-recents-grid">
            ${recents.map((item) => {
              let preview = '';
              if (item.previewSvg) {
                preview = `<svg viewBox="0 0 48 48" aria-hidden="true" style="width: 24px; height: 24px;">${item.previewSvg}</svg>`;
              } else if (item.type === 'vector' && item.pathD) {
                preview = `<svg viewBox="0 0 48 48" aria-hidden="true" style="width: 24px; height: 24px;"><path d="${item.pathD}" fill="currentColor" /></svg>`;
              } else if (item.type === 'diagram' && item.previewSvg) {
                preview = `<svg viewBox="0 0 48 48" aria-hidden="true" style="width: 24px; height: 24px;">${item.previewSvg}</svg>`;
              } else if (item.type === 'sticky') {
                preview = createStickyNoteSvg(item.fillColor || DEFAULT_STICKY_COLOR, undefined, 24);
              } else {
                preview = `<svg class="component-icon" aria-hidden="true"><use href="/icons.svg#category"></use></svg>`;
              }
              return `
                <button type="button" class="element-grid-item" data-ref="btn-recent-item-${item.id}" data-recent-id="${item.id}" data-tooltip="${escapeHtml(item.name)}" aria-label="${escapeHtml(item.name)}">
                  ${preview}
                </button>
              `;
            }).join('')}
          </div>
        </div>
      ` : '';

      contentContainer.innerHTML = `
        <div class="elements-categories-menu" data-ref="elements-categories-menu">
          ${recentsHtml}
          <span class="elements-categories-heading">Explora las categorías</span>
          <div class="elements-categories-grid" data-ref="elements-categories-grid">
            ${renderElementCategoryTilesHtml()}
          </div>
        </div>
      `;

      contentContainer.querySelectorAll<HTMLButtonElement>('[data-category]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const cat = btn.getAttribute('data-category') as 'shapes' | 'stickies' | 'diagrams' | 'tables' | 'charts' | 'frames' | 'grids' | 'mockups' | '3d' | 'pixel-grid';
          if (cat) {
            activeElementsCategory = cat;
            renderContent('');
          }
        });
      });

      bindItemClicks(contentContainer);
      renderIcons(contentContainer);
      return;
    }

    let backTitle = 'Formas';
    if (activeElementsCategory === 'stickies') backTitle = 'Notas adhesivas';
    if (activeElementsCategory === 'diagrams') backTitle = 'Diagramas';
    if (activeElementsCategory === 'tables') backTitle = 'Tablas';
    if (activeElementsCategory === 'charts') backTitle = 'Gráficas';
    if (activeElementsCategory === 'frames') backTitle = 'Marcos';
    if (activeElementsCategory === 'grids') backTitle = 'Cuadrícula';
    if (activeElementsCategory === 'mockups') backTitle = 'Mockups';
    if (activeElementsCategory === '3d') backTitle = 'Elementos 3D';
    if (activeElementsCategory === 'pixel-grid') backTitle = 'Píxel Art';

    if (btnHeaderBack) btnHeaderBack.style.display = 'inline-flex';
    if (panelIcon) panelIcon.style.display = 'none';
    if (activeElementsCategory === 'shapes' && activeShapeSection) {
      const activeSecObj = SHAPE_SECTIONS.find((s) => s.key === activeShapeSection);
      if (panelTitle) panelTitle.textContent = activeSecObj ? activeSecObj.label : (activeShapeSection === 'other' ? 'Otras formas' : 'Formas');
    } else {
      if (panelTitle) panelTitle.textContent = backTitle;
    }

    let html = '<div class="elements-grid" data-ref="elements-grid">';

    if (activeElementsCategory === 'shapes') {
      if (activeShapeSection) {
        const matching = PIXEL_SHAPES.filter((s) => s.section === activeShapeSection);
        html += matching.map((item) => `
          <button type="button" class="element-grid-item" data-ref="btn-element-item-${item.id}" data-element-id="${item.id}" data-tooltip="${escapeHtml(item.name)}" aria-label="${escapeHtml(item.name)}">
            <svg viewBox="0 0 48 48" aria-hidden="true">${item.previewSvg || `<path d="${item.pathD || ''}" fill="currentColor" />`}</svg>
          </button>
        `).join('');
      } else {
        SHAPE_SECTIONS.forEach((sec) => {
          const matching = PIXEL_SHAPES.filter((s) => s.section === sec.key);
          if (matching.length > 0) {
            html += `
              <div class="elements-section-header" data-ref="section-header-${sec.key}">
                <span class="elements-section-title">${escapeHtml(sec.label)}</span>
                <button type="button" class="elements-section-header__action" data-ref="btn-see-all-${sec.key}" data-shape-section="${sec.key}">Ver todo</button>
              </div>
            `;
            html += matching.map((item) => `
              <button type="button" class="element-grid-item" data-ref="btn-element-item-${item.id}" data-element-id="${item.id}" data-tooltip="${escapeHtml(item.name)}" aria-label="${escapeHtml(item.name)}">
                <svg viewBox="0 0 48 48" aria-hidden="true">${item.previewSvg || `<path d="${item.pathD || ''}" fill="currentColor" />`}</svg>
              </button>
            `).join('');
          }
        });
      }
    } else {
      html += renderGalleryCategoryHtml(activeElementsCategory, cleanQ);
    }

    html += '</div>';
    contentContainer.innerHTML = html;

    bindItemClicks(contentContainer);
    renderIcons(contentContainer);
  };

  const bindItemClicks = (container: HTMLElement) => {
    container.querySelectorAll<HTMLButtonElement>('[data-shape-section]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const sec = btn.getAttribute('data-shape-section');
        if (sec) {
          activeShapeSection = sec;
          renderContent('');
        }
      });
    });

    container.querySelectorAll<HTMLButtonElement>('[data-element-id]').forEach((itemBtn) => {
      itemBtn.addEventListener('click', () => {
        const elId = itemBtn.getAttribute('data-element-id');
        const found = PIXEL_SHAPES.find((s) => s.id === elId);
        if (found) {
          handleApplyCanvasElement(found, canvasType);
        }
      });
    });

    container.querySelectorAll<HTMLButtonElement>('[data-diagram-id]').forEach((itemBtn) => {
      itemBtn.addEventListener('click', () => {
        const diagId = itemBtn.getAttribute('data-diagram-id');
        const found = DIAGRAM_COMPONENTS.find((d) => d.id === diagId);
        if (found) {
          handleApplyDiagramComponent(found, canvasType);
        }
      });
    });

    container.querySelectorAll<HTMLButtonElement>('[data-sticky-id]').forEach((itemBtn) => {
      itemBtn.addEventListener('click', () => {
        const stkId = itemBtn.getAttribute('data-sticky-id');
        const found = STICKY_NOTE_PRESETS.find((s) => s.id === stkId);
        if (found) {
          handleApplyStickyPreset(found, canvasType);
        }
      });
    });

    container.querySelectorAll<HTMLButtonElement>('[data-recent-id]').forEach((itemBtn) => {
      itemBtn.addEventListener('click', () => {
        const recId = itemBtn.getAttribute('data-recent-id');
        const recents = getRecentElements();
        const found = recents.find((r) => r.id === recId);
        if (found) {
          handleApplyRecentElement(found, canvasType);
        }
      });
    });

    container.querySelectorAll<HTMLButtonElement>('[data-chart-type]').forEach((itemBtn) => {
      itemBtn.addEventListener('click', () => {
        const chartType = itemBtn.getAttribute('data-chart-type') as ChartType;
        if (chartType) {
          handleApplyChart(chartType, canvasType);
        }
      });
    });

    container.querySelectorAll<HTMLButtonElement>('[data-shape3d-id]').forEach((itemBtn) => {
      itemBtn.addEventListener('click', () => {
        const shapeId = itemBtn.getAttribute('data-shape3d-id') as Shape3DType;
        if (shapeId) {
          handleApply3DShape(shapeId, canvasType);
        }
      });
    });

    container.querySelectorAll<HTMLButtonElement>('[data-mockup-id]').forEach((itemBtn) => {
      itemBtn.addEventListener('click', () => {
        const mockupId = itemBtn.getAttribute('data-mockup-id');
        const tpl = ALL_MOCKUP_ITEMS.find((m) => m.id === mockupId);
        if (tpl) {
          handleApplyMockup(tpl, canvasType);
        }
      });
    });

    container.querySelectorAll<HTMLButtonElement>('[data-table-id]').forEach((itemBtn) => {
      itemBtn.addEventListener('click', () => {
        const tableId = itemBtn.getAttribute('data-table-id');
        const preset = TABLE_PRESETS.find((p) => p.id === tableId);
        if (preset) {
          handleApplyTable(preset.rows, preset.cols, canvasType, {
            borderColor: preset.borderColor,
            cellBackgroundColor: preset.cellBg,
            cellTextColor: preset.cellText,
            headerBackgroundColor: preset.headerBg,
            headerTextColor: preset.headerText,
          });
        }
      });
    });

    container.querySelectorAll<HTMLButtonElement>('[data-pixel-size]').forEach((itemBtn) => {
      itemBtn.addEventListener('click', () => {
        const size = parseInt(itemBtn.getAttribute('data-pixel-size') || '16', 10);
        const pixelScale = parseInt(itemBtn.getAttribute('data-pixel-scale') || '16', 10);
        const controller = getActiveCanvasController();
        controller?.insertPixelGrid?.({
          backgroundColor: '#ffffff',
          gridHeight: size,
          gridWidth: size,
          pixelSize: pixelScale,
        });
        showToast(`Lienzo de Pixel Art ${size}×${size} añadido`, 'success');
        if (window.innerWidth <= 768) {
          toggleDrawer(false);
        }
      });
    });

    container.querySelectorAll<HTMLButtonElement>('[data-library-uuid]').forEach((itemBtn) => {
      itemBtn.addEventListener('click', () => {
        const uuid = itemBtn.getAttribute('data-library-uuid');
        const found = currentLibraryElements.find((e) => e.uuid === uuid);
        if (found) {
          handleApplyLibraryElement(found, canvasType);
        }
      });
    });
  };

  searchInput?.addEventListener('input', () => {
    if (searchDebounceTimer) {
      clearTimeout(searchDebounceTimer);
    }
    searchDebounceTimer = setTimeout(() => {
      renderContent(searchInput.value);
    }, 200);
  });

  renderContent();

  const drawerFooter = drawer.querySelector<HTMLElement>('[data-ref="drawer-footer"]');
  if (drawerFooter) {
    drawerFooter.style.display = 'none';
  }

  if (sidebar) {
    updateCanvasRailActiveState(sidebar);
  }

  renderIcons(drawerBody);
}
