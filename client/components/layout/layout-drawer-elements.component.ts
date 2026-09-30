import { API_ROUTES } from '../../config/api-routes.js';
import { BOARD_3D_SHAPES } from '../../config/board-3d-shapes.config.js';
import { DIAGRAM_COMPONENTS, DiagramComponentItem } from '../../config/diagram-components.data.js';
import { ALL_MOCKUP_ITEMS, FRAME_CATEGORIES, FRAME_TEMPLATES, GRID_TEMPLATES, MOCKUP_GENERAL_CATEGORIES, MOCKUP_TEMPLATES } from '../../config/mockups.config.js';
import { STICKY_NOTE_PRESETS } from '../../config/sticky-notes.config.js';
import { renderElementCategoryTilesHtml } from '../../graphics/element-category-tiles.graphics.js';
import { escapeHtml, getApi } from '../../services/api.service.js';
import { t } from '../../services/i18n.service.js';
import { renderIcons } from '../../services/icon.service.js';
import { showToast } from '../../services/toast.service.js';
import { ElementItem } from '../../types/element.types.js';
import { FrameCategory, MockupGeneralCategory, MockupTemplate } from '../../types/mockups.types.js';
import { PIXEL_SHAPES, PixelShape, ShapeCategory } from '../../utils/pixel-shapes.util.js';
import { CHART_CATALOG } from '../../views/board/board-charts-panel.component.js';
import { ChartType, Shape3DType, ShapeType } from '../../views/board/board.types.js';
import { openInsertPixelGridModal } from '../insert-pixel-grid-modal.component.js';
import { getActiveCanvasController, getActiveCanvasType, openChartInspectorInDrawer, toggleDrawer, updateCanvasRailActiveState } from '../layout.component.js';

let activeElementsCategory: 'root' | 'shapes' | 'stickers' | 'stickies' | 'diagrams' | 'tables' | 'charts' | 'frames' | 'grids' | 'mockups' | '3d' = 'root';
let activeFramesFilter: FrameCategory | 'all' = 'all';
let activeMockupsFilter: MockupGeneralCategory | 'all' = 'all';

interface TablePresetItem {
  cols: number;
  description: string;
  id: string;
  name: string;
  rows: number;
}

const TABLE_PRESETS: TablePresetItem[] = [
  { cols: 3, description: 'Tabla clásica de 3 filas por 3 columnas', id: 'table_3x3', name: 'Tabla 3 × 3', rows: 3 },
  { cols: 4, description: 'Tabla mediana de 4 filas por 4 columnas', id: 'table_4x4', name: 'Tabla 4 × 4', rows: 4 },
  { cols: 3, description: 'Tabla vertical de 5 filas por 3 columnas', id: 'table_5x3', name: 'Tabla 5 × 3', rows: 5 },
  { cols: 4, description: 'Tabla horizontal de 2 filas por 4 columnas', id: 'table_2x4', name: 'Tabla 2 × 4', rows: 2 },
  { cols: 6, description: 'Cuadrícula amplia de 6 filas por 6 columnas', id: 'table_6x6', name: 'Tabla 6 × 6', rows: 6 },
];

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

const SHAPE_SECTIONS: Array<{ key: string; label: string; prefixes: string[] }> = [
  {
    key: 'basic',
    label: 'Formas básicas',
    prefixes: [
      'square', 'rounded_rectangle', 'chamfer_square', 'circle', 'semi_circle',
      'quarter_circle', 'quadrant_ring', 'semi_ring', 'diamond', 'triangle_up',
      'triangle_down', 'triangle_right_angle', 'trapezoid_up', 'trapezoid_down',
      'parallelogram_left', 'parallelogram_right'
    ],
  },
  {
    key: 'polygons',
    label: 'Polígonos',
    prefixes: ['pentagon', 'hexagon_flat', 'hexagon_pointy', 'heptagon', 'octagon', 'decagon'],
  },
  {
    key: 'stars',
    label: 'Estrellas y Destellos',
    prefixes: [
      'star_4_sparkle', 'star_5', 'star_6', 'star_7', 'star_8', 'sparkle_8',
      'sparkle_12', 'sunburst_16', 'burst_10', 'burst_12', 'burst_16', 'burst_20', 'burst_24', 'seal_scallop_32'
    ],
  },
  {
    key: 'arrows',
    label: 'Flechas y Líneas',
    prefixes: [
      'arrow_right', 'arrow_left', 'arrow_up', 'arrow_down', 'arrow_double_horizontal',
      'arrow_double_vertical', 'arrow_pointed_double', 'arrow_pointed_left', 'arrow_ribbon',
      'chevron_right', 'wave_multi_ribbon', 'wave_s_curve'
    ],
  },
  {
    key: 'callouts',
    label: 'Llamadas y Nubes',
    prefixes: [
      'callout_rectangular', 'callout_rounded_rect', 'callout_oval', 'callout_cloud',
      'callout_curved_tail', 'cloud_fluffy_soft', 'cloud_flat_base_multi', 'cloud_flat_base_triple',
      'cloud_round_dome', 'cloud_puffy_full'
    ],
  },
  {
    key: 'banners',
    label: 'Banners y Cintas',
    prefixes: [
      'banner_horizontal_ribbon', 'banner_rounded_notch', 'banner_rounded_point',
      'banner_vertical_notch', 'banner_vertical_point'
    ],
  },
  {
    key: 'flow',
    label: 'Símbolos de Flujo',
    prefixes: [
      'flow_process', 'flow_decision', 'flow_data', 'flow_document', 'flow_terminator',
      'flow_preparation', 'flow_delay', 'flow_manual', 'flow_merge', 'flow_offpage', 'flow_shield'
    ],
  },
  {
    key: 'symbols',
    label: 'Símbolos y Naturaleza',
    prefixes: [
      'heart_classic', 'heart_rounded', 'heart_narrow', 'heart_wide', 'heart_playful',
      'cross', 'leaf_curved', 'clover_4_leaves', 'flower_4_petals_cross', 'flower_6_petals_center_hole',
      'flower_6_petals_drop', 'flower_8_petals_round', 'flower_8_petals_sharp', 'shield_u', 'ticket',
      'arch', 'barrel', 'gear_12_teeth_large_hole', 'gear_12_teeth_pointed', 'gear_12_teeth_small_hole',
      'gear_14_teeth_pointed', 'gear_16_teeth_large_hole', 'gear_16_teeth_pointed', 'tear_curved_flame',
      'tear_narrow', 'tear_straight', 'tear_tilted', 'tear_wide'
    ],
  },
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
      controller.insertStickyNote?.(item.fillColor || '#fef08a', item.text);
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
    id: shape.id,
    name: shape.name,
    pathD: shape.pathD,
    type: shape.type,
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

    if (shape.type === 'vector' && shape.pathD) {
      controller.insertShapeSvg(shape.pathD, shape.name, '#1e293b');
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
      color: item.fillColor || '#fef08a',
      id: item.id,
      name: item.name,
      stroke: item.strokeColor || '#fde047',
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

function handleApplyMockup(tpl: MockupTemplate, canvasType: 'board' | 'doc' | 'presentation' | 'video'): void {
  const controller = getActiveCanvasController();
  if (canvasType === 'video' && controller) {
    controller.insertMockup?.(tpl);
    showToast(`Mockup «${tpl.name}» añadido al video`, 'success');
  } else if ((canvasType === 'board' || canvasType === 'presentation') && controller) {
    controller.insertMockup?.(tpl);
    showToast(`Mockup «${tpl.name}» añadido al lienzo`, 'success');
  } else if (canvasType === 'doc' && controller) {
    showToast('Los mockups están disponibles en el pizarrón', 'info');
  }
  if (window.innerWidth <= 768) {
    toggleDrawer(false);
  }
}

function handleApply3DShape(shapeId: Shape3DType, canvasType: 'board' | 'doc' | 'presentation' | 'video'): void {
  const controller = getActiveCanvasController();
  if (canvasType === 'video' && controller) {
    controller.insert3DShape?.(shapeId);
    showToast('Figura 3D añadida al video', 'success');
  } else if ((canvasType === 'board' || canvasType === 'presentation') && controller) {
    controller.insert3DShape?.(shapeId);
    showToast('Figura 3D añadida al lienzo', 'success');
  } else if (canvasType === 'doc' && controller) {
    showToast('Los elementos 3D están disponibles en el pizarrón', 'info');
  }
  if (window.innerWidth <= 768) {
    toggleDrawer(false);
  }
}

function handleApplyTable(rows: number, cols: number, canvasType: 'board' | 'doc' | 'presentation' | 'video'): void {
  const controller = getActiveCanvasController();
  if (canvasType === 'video' && controller) {
    controller.insertTable?.(rows, cols);
    showToast(`Tabla de ${rows}×${cols} añadida al video`, 'success');
  } else if ((canvasType === 'board' || canvasType === 'presentation') && controller) {
    controller.insertTable?.(rows, cols);
    showToast(`Tabla de ${rows}×${cols} añadida al lienzo`, 'success');
  } else if (canvasType === 'doc' && controller) {
    controller.insertTable?.(rows, cols);
    showToast(`Tabla de ${rows}×${cols} añadida al documento`, 'success');
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
          <svg class="component-icon canvas-panel-card__icon" aria-hidden="true"><use href="/icons.svg#category"></use></svg>
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

        <div class="elements-quick-tags-row" data-ref="elements-quick-tags-row" style="display: flex; gap: 6px; overflow-x: auto; padding: 0 0 10px 0; scrollbar-width: none;">
          <button type="button" class="component-badge component-badge--neutral component-badge--interactive" data-ref="quick-search-foco" data-quick-search="foco" style="cursor: pointer; font-size: 11px; white-space: nowrap; padding: 4px 9px;">💡 Foco</button>
          <button type="button" class="component-badge component-badge--neutral component-badge--interactive" data-ref="quick-search-casa" data-quick-search="casa" style="cursor: pointer; font-size: 11px; white-space: nowrap; padding: 4px 9px;">🏠 Casa</button>
          <button type="button" class="component-badge component-badge--neutral component-badge--interactive" data-ref="quick-search-estrella" data-quick-search="estrella" style="cursor: pointer; font-size: 11px; white-space: nowrap; padding: 4px 9px;">⭐ Estrella</button>
          <button type="button" class="component-badge component-badge--neutral component-badge--interactive" data-ref="quick-search-cohete" data-quick-search="cohete" style="cursor: pointer; font-size: 11px; white-space: nowrap; padding: 4px 9px;">🚀 Cohete</button>
          <button type="button" class="component-badge component-badge--neutral component-badge--interactive" data-ref="quick-search-flecha" data-quick-search="flecha" style="cursor: pointer; font-size: 11px; white-space: nowrap; padding: 4px 9px;">➡️ Flecha</button>
          <button type="button" class="component-badge component-badge--neutral component-badge--interactive" data-ref="quick-search-grafico" data-quick-search="grafico" style="cursor: pointer; font-size: 11px; white-space: nowrap; padding: 4px 9px;">📊 Gráfico</button>
          <button type="button" class="component-badge component-badge--neutral component-badge--interactive" data-ref="quick-search-laptop" data-quick-search="computadora" style="cursor: pointer; font-size: 11px; white-space: nowrap; padding: 4px 9px;">💻 Laptop</button>
          <button type="button" class="component-badge component-badge--neutral component-badge--interactive" data-ref="quick-search-fuego" data-quick-search="fuego" style="cursor: pointer; font-size: 11px; white-space: nowrap; padding: 4px 9px;">🔥 Fuego</button>
        </div>

        <div class="elements-drawer-content" data-ref="elements-drawer-content"></div>
      </div>
    </div>
  `;

  const btnClose = drawerBody.querySelector<HTMLElement>('[data-ref="btn-close-canvas-panel"]');
  btnClose?.addEventListener('click', (e) => {
    e.preventDefault();
    toggleDrawer(false);
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
      const matchingDiagrams = DIAGRAM_COMPONENTS.filter((d) => d.name.toLowerCase().includes(cleanQ) || d.description.toLowerCase().includes(cleanQ) || d.categoryLabel.toLowerCase().includes(cleanQ));
      const matchingShapes = PIXEL_SHAPES.filter((s) => s.name.toLowerCase().includes(cleanQ) || s.id.toLowerCase().includes(cleanQ));
      const matchingCharts = CHART_CATALOG.filter((c) => c.name.toLowerCase().includes(cleanQ) || c.description.toLowerCase().includes(cleanQ) || 'gráficas'.includes(cleanQ) || 'graficas'.includes(cleanQ) || 'charts'.includes(cleanQ));
      const matching3D = BOARD_3D_SHAPES.filter((s) => s.name.toLowerCase().includes(cleanQ) || s.id.toLowerCase().includes(cleanQ) || '3d'.includes(cleanQ));
      const matchingMockups = ALL_MOCKUP_ITEMS.filter((m) => m.name.toLowerCase().includes(cleanQ) || m.description.toLowerCase().includes(cleanQ) || 'mockup'.includes(cleanQ) || 'maqueta'.includes(cleanQ) || 'marco'.includes(cleanQ) || 'cuadricula'.includes(cleanQ) || 'collage'.includes(cleanQ));
      const matchingTables = (cleanQ.includes('tabl') || cleanQ.includes('table') || cleanQ.includes('cuad')) ? TABLE_PRESETS : [];

      const apiElements = await fetchApiElements(cleanQ);
      currentLibraryElements = apiElements;

      if (matchingDiagrams.length === 0 && matchingShapes.length === 0 && matchingCharts.length === 0 && matching3D.length === 0 && matchingMockups.length === 0 && matchingTables.length === 0 && apiElements.length === 0) {
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
              <span class="element-grid-item__label" style="margin-top: 4px; font-size: 10px; max-width: 58px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(elem.title)}</span>
            </button>
          `;
        }).join('');
      }

      if (matchingCharts.length > 0) {
        html += '<div class="elements-section-title">Gráficas</div>';
        html += matchingCharts.map((item) => `
          <button type="button" class="element-grid-item element-grid-item--diagram" data-ref="btn-chart-item-${item.type}" data-chart-type="${item.type}" data-tooltip="${escapeHtml(item.description)}" aria-label="${escapeHtml(item.name)}">
            <div style="width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; pointer-events: none;">
              ${item.iconSvg}
            </div>
            <span class="element-grid-item__label">${escapeHtml(item.name)}</span>
          </button>
        `).join('');
      }

      if (matching3D.length > 0) {
        html += '<div class="elements-section-title">Elementos 3D</div>';
        html += matching3D.map((shape) => `
          <button type="button" class="element-grid-item element-grid-item--diagram" data-ref="btn-3d-item-${shape.id}" data-shape3d-id="${shape.id}" data-tooltip="${escapeHtml(shape.name)}" aria-label="${escapeHtml(shape.name)}">
            <div style="width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; background: rgba(99, 102, 241, 0.08); border-radius: 8px; color: #6366f1; pointer-events: none;">
              <svg class="component-icon" aria-hidden="true" style="width: 22px; height: 22px;"><use href="/icons.svg#${shape.icon}"></use></svg>
            </div>
            <span class="element-grid-item__label">${escapeHtml(shape.name)}</span>
          </button>
        `).join('');
      }

      if (matchingTables.length > 0) {
        html += '<div class="elements-section-title">Tablas</div>';
        html += matchingTables.map((item) => `
          <button type="button" class="element-grid-item element-grid-item--diagram" data-ref="btn-table-item-${item.id}" data-table-rows="${item.rows}" data-table-cols="${item.cols}" data-tooltip="${escapeHtml(item.description)}" aria-label="${escapeHtml(item.name)}">
            <svg viewBox="0 0 48 48" aria-hidden="true" style="width: 32px; height: 32px;">
              <rect x="6" y="8" width="36" height="32" rx="4" fill="none" stroke="#0284c7" stroke-width="2" />
              <rect x="6" y="8" width="36" height="10" rx="4" fill="#38bdf8" fill-opacity="0.3" stroke="#0284c7" stroke-width="1.5" />
              <line x1="6" y1="28" x2="42" y2="28" stroke="#cbd5e1" stroke-width="1.5" />
              <line x1="18" y1="8" x2="18" y2="40" stroke="#cbd5e1" stroke-width="1.5" />
              <line x1="30" y1="8" x2="30" y2="40" stroke="#cbd5e1" stroke-width="1.5" />
            </svg>
            <span class="element-grid-item__label">${escapeHtml(item.name)}</span>
          </button>
        `).join('');
      }

      if (matchingMockups.length > 0) {
        html += '<div class="elements-section-title">Mockups</div>';
        html += matchingMockups.map((tpl) => `
          <button type="button" class="element-grid-item element-grid-item--diagram" data-ref="btn-mockup-item-${tpl.id}" data-mockup-id="${tpl.id}" data-tooltip="${escapeHtml(tpl.description || tpl.name)}" aria-label="${escapeHtml(tpl.name)}">
            <div style="width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; overflow: hidden; pointer-events: none;">
              ${tpl.thumbnailSvg}
            </div>
            <span class="element-grid-item__label">${escapeHtml(tpl.name)}</span>
          </button>
        `).join('');
      }

      if (matchingDiagrams.length > 0) {
        html += '<div class="elements-section-title">Diagramas</div>';
        html += matchingDiagrams.map((item) => `
          <button type="button" class="element-grid-item element-grid-item--diagram" data-ref="btn-diagram-item-${item.id}" data-diagram-id="${item.id}" data-tooltip="${escapeHtml(item.description || item.name)}" aria-label="${escapeHtml(item.name)}">
            <svg viewBox="0 0 48 48" aria-hidden="true">${item.previewSvg}</svg>
            <span class="element-grid-item__label">${escapeHtml(item.name)}</span>
          </button>
        `).join('');
      }

      if (matchingShapes.length > 0) {
        html += '<div class="elements-section-title">Figuras y Formas</div>';
        html += matchingShapes.map((item) => {
          let previewHtml = '';
          if (item.type === 'vector' && item.pathD) {
            previewHtml = `<svg viewBox="0 0 48 48" aria-hidden="true"><path d="${item.pathD}" fill="currentColor" /></svg>`;
          } else if (item.type === 'sticker' && item.file) {
            previewHtml = `<img src="/assets/img/stickers/${item.file}" alt="${escapeHtml(item.name)}" loading="lazy" />`;
          }
          return `
            <button type="button" class="element-grid-item" data-ref="btn-element-item-${item.id}" data-element-id="${item.id}" data-tooltip="${escapeHtml(item.name)}" aria-label="${escapeHtml(item.name)}">
              ${previewHtml}
            </button>
          `;
        }).join('');
      }

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
              if (item.type === 'vector' && item.pathD) {
                preview = `<svg viewBox="0 0 48 48" aria-hidden="true" style="width: 24px; height: 24px;"><path d="${item.pathD}" fill="currentColor" /></svg>`;
              } else if (item.type === 'sticker' && item.file) {
                preview = `<img src="/assets/img/stickers/${item.file}" alt="${escapeHtml(item.name)}" loading="lazy" style="width: 26px; height: 26px; object-fit: contain;" />`;
              } else if (item.type === 'diagram' && item.previewSvg) {
                preview = `<svg viewBox="0 0 48 48" aria-hidden="true" style="width: 24px; height: 24px;">${item.previewSvg}</svg>`;
              } else if (item.type === 'sticky') {
                preview = `<div style="background-color: ${item.fillColor || '#fef08a'}; border: 1.5px solid ${item.strokeColor || '#fde047'}; border-radius: 4px; width: 24px; height: 24px;"></div>`;
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
          const cat = btn.getAttribute('data-category') as 'shapes' | 'stickers' | 'stickies' | 'diagrams' | 'tables' | 'charts' | 'frames' | 'grids' | 'mockups' | '3d' | 'pixel-grid';
          if (cat === 'charts') {
            openChartInspectorInDrawer();
            return;
          }
          if (cat === 'pixel-grid') {
            const controller = getActiveCanvasController();
            openInsertPixelGridModal({
              onInsert: (cfg) => {
                controller?.insertPixelGrid?.(cfg);
              },
            });
            return;
          }
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
    if (activeElementsCategory === 'stickers') backTitle = 'Figuras';
    if (activeElementsCategory === 'stickies') backTitle = 'Notas adhesivas';
    if (activeElementsCategory === 'diagrams') backTitle = 'Diagramas';
    if (activeElementsCategory === 'tables') backTitle = 'Tablas';
    if (activeElementsCategory === 'charts') backTitle = 'Gráficas';
    if (activeElementsCategory === 'frames') backTitle = 'Marcos';
    if (activeElementsCategory === 'grids') backTitle = 'Cuadrícula';
    if (activeElementsCategory === 'mockups') backTitle = 'Mockups';
    if (activeElementsCategory === '3d') backTitle = 'Elementos 3D';

    let html = `
      <button type="button" class="elements-back-btn" data-ref="btn-elements-back">
        <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#arrow_back"></use></svg>
        <span>Volver a categorías (${escapeHtml(backTitle)})</span>
      </button>
      <div class="elements-grid" data-ref="elements-grid">
    `;

    if (activeElementsCategory === 'shapes') {
      const vectorShapes = PIXEL_SHAPES.filter((s) => s.category === 'shapes' && s.type === 'vector');
      const assignedShapeIds = new Set<string>();

      SHAPE_SECTIONS.forEach((sec) => {
        const matching = vectorShapes.filter((s) => {
          const rawKey = s.id.replace(/^shape_/, '');
          return sec.prefixes.includes(rawKey) || sec.prefixes.some((p) => rawKey.startsWith(p));
        });

        if (matching.length > 0) {
          matching.forEach((s) => assignedShapeIds.add(s.id));
          html += `<div class="elements-section-title">${escapeHtml(sec.label)}</div>`;
          html += matching.map((item) => `
            <button type="button" class="element-grid-item" data-ref="btn-element-item-${item.id}" data-element-id="${item.id}" data-tooltip="${escapeHtml(item.name)}" aria-label="${escapeHtml(item.name)}">
              <svg viewBox="0 0 48 48" aria-hidden="true"><path d="${item.pathD || ''}" fill="currentColor" /></svg>
            </button>
          `).join('');
        }
      });

      const remainingShapes = vectorShapes.filter((s) => !assignedShapeIds.has(s.id));
      if (remainingShapes.length > 0) {
        html += '<div class="elements-section-title">Otras formas</div>';
        html += remainingShapes.map((item) => `
          <button type="button" class="element-grid-item" data-ref="btn-element-item-${item.id}" data-element-id="${item.id}" data-tooltip="${escapeHtml(item.name)}" aria-label="${escapeHtml(item.name)}">
            <svg viewBox="0 0 48 48" aria-hidden="true"><path d="${item.pathD || ''}" fill="currentColor" /></svg>
          </button>
        `).join('');
      }
    } else if (activeElementsCategory === 'stickers') {
      const stickers = PIXEL_SHAPES.filter((s) => s.type === 'sticker');
      html += stickers.map((item) => `
        <button type="button" class="element-grid-item" data-ref="btn-element-item-${item.id}" data-element-id="${item.id}" data-tooltip="${escapeHtml(item.name)}" aria-label="${escapeHtml(item.name)}">
          <img src="/assets/img/stickers/${item.file}" alt="${escapeHtml(item.name)}" loading="lazy" />
        </button>
      `).join('');
    } else if (activeElementsCategory === 'stickies') {
      html += STICKY_NOTE_PRESETS.map((item) => `
        <button type="button" class="element-grid-item element-grid-item--diagram" data-ref="btn-sticky-item-${item.id}" data-sticky-id="${item.id}" data-tooltip="${escapeHtml(item.name)}" aria-label="${escapeHtml(item.name)}">
          <div style="background-color: ${item.color}; border: 1.5px solid ${item.stroke}; border-radius: 6px; width: 34px; height: 34px; box-shadow: 0 2px 6px rgba(0,0,0,0.1); display: flex; align-items: center; justify-content: center;">
            <span style="font-size: 9px; font-weight: 700; color: #1e293b;">Aa</span>
          </div>
          <span class="element-grid-item__label">${escapeHtml(item.name)}</span>
        </button>
      `).join('');
    } else if (activeElementsCategory === 'diagrams') {
      const categories: Array<{ key: string; label: string }> = [
        { key: 'flowchart', label: 'Diagramas de Flujo' },
        { key: 'mindmap', label: 'Mapas Mentales & Conceptuales' },
        { key: 'cloud_data', label: 'Arquitectura Cloud & Infra' },
        { key: 'structure', label: 'Estructura & Organización' },
        { key: 'connectors', label: 'Conectores & Flechas' },
        { key: 'stickies', label: 'Notas Adhesivas' },
      ];

      categories.forEach((cat) => {
        const catItems = DIAGRAM_COMPONENTS.filter((item) => item.category === cat.key);
        if (catItems.length === 0) return;
        html += `<div class="elements-section-title">${escapeHtml(cat.label)}</div>`;
        html += catItems.map((item) => `
          <button type="button" class="element-grid-item element-grid-item--diagram" data-ref="btn-diagram-item-${item.id}" data-diagram-id="${item.id}" data-tooltip="${escapeHtml(item.description || item.name)}" aria-label="${escapeHtml(item.name)}">
            <svg viewBox="0 0 48 48" aria-hidden="true">${item.previewSvg}</svg>
            <span class="element-grid-item__label">${escapeHtml(item.name)}</span>
          </button>
        `).join('');
      });
    } else if (activeElementsCategory === 'tables') {
      html += '<div class="elements-section-title">Tablas predeterminadas</div>';
      html += TABLE_PRESETS.map((item) => `
        <button type="button" class="element-grid-item element-grid-item--diagram" data-ref="btn-table-item-${item.id}" data-table-rows="${item.rows}" data-table-cols="${item.cols}" data-tooltip="${escapeHtml(item.description)}" aria-label="${escapeHtml(item.name)}">
          <svg viewBox="0 0 48 48" aria-hidden="true" style="width: 32px; height: 32px;">
            <rect x="6" y="8" width="36" height="32" rx="4" fill="none" stroke="#0284c7" stroke-width="2" />
            <rect x="6" y="8" width="36" height="10" rx="4" fill="#38bdf8" fill-opacity="0.3" stroke="#0284c7" stroke-width="1.5" />
            <line x1="6" y1="28" x2="42" y2="28" stroke="#cbd5e1" stroke-width="1.5" />
            <line x1="18" y1="8" x2="18" y2="40" stroke="#cbd5e1" stroke-width="1.5" />
            <line x1="30" y1="8" x2="30" y2="40" stroke="#cbd5e1" stroke-width="1.5" />
          </svg>
          <span class="element-grid-item__label">${escapeHtml(item.name)}</span>
        </button>
      `).join('');

      html += `
        <div class="elements-section-title" style="margin-top: 16px;">Tabla personalizada</div>
        <div style="grid-column: 1 / -1; display: flex; flex-direction: column; gap: 8px; padding: 4px 2px;">
          <div style="display: flex; gap: 8px;">
            <label class="field" style="flex: 1;">
              <span class="field__label">Filas</span>
              <input class="field__input" data-ref="input-custom-table-rows" type="number" min="1" max="15" value="3" />
            </label>
            <label class="field" style="flex: 1;">
              <span class="field__label">Columnas</span>
              <input class="field__input" data-ref="input-custom-table-cols" type="number" min="1" max="10" value="3" />
            </label>
          </div>
          <button type="button" class="component-button component-button--h36 component-button--black component-button--w-full" data-ref="btn-insert-custom-table">
            <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#add"></use></svg>
            <span>Insertar tabla</span>
          </button>
        </div>
      `;
    } else if (activeElementsCategory === 'charts') {
      html += '<div class="elements-section-title">Tipos de gráficas</div>';
      html += CHART_CATALOG.map((item) => `
        <button type="button" class="element-grid-item element-grid-item--diagram" data-ref="btn-chart-item-${item.type}" data-chart-type="${item.type}" data-tooltip="${escapeHtml(item.description)}" aria-label="${escapeHtml(item.name)}">
          <div style="width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; pointer-events: none;">
            ${item.iconSvg}
          </div>
          <span class="element-grid-item__label">${escapeHtml(item.name)}</span>
        </button>
      `).join('');
    } else if (activeElementsCategory === 'frames') {
      html += `
        <div class="mockup-category-tabs" style="grid-column: 1 / -1; margin-bottom: 6px;">
          <button type="button" class="mockup-category-pill ${activeFramesFilter === 'all' ? 'is-active' : ''}" data-ref="frame-cat-pill-all" data-frame-cat="all">Todos</button>
          ${FRAME_CATEGORIES.map((c) => `
            <button type="button" class="mockup-category-pill ${activeFramesFilter === c.id ? 'is-active' : ''}" data-ref="frame-cat-pill-${c.id}" data-frame-cat="${c.id}">${escapeHtml(c.name)}</button>
          `).join('')}
        </div>
        <div class="elements-section-title">Marcos disponibles</div>
      `;
      let filteredFrames = FRAME_TEMPLATES;
      if (activeFramesFilter !== 'all') {
        filteredFrames = filteredFrames.filter((f) => f.category === activeFramesFilter);
      }
      if (cleanQ) {
        filteredFrames = filteredFrames.filter((f) => f.name.toLowerCase().includes(cleanQ) || f.description.toLowerCase().includes(cleanQ));
      }
      if (filteredFrames.length === 0) {
        html += '<div class="mockup-empty-state">No se encontraron marcos.</div>';
      } else {
        html += filteredFrames.map((tpl) => `
          <button type="button" class="element-grid-item element-grid-item--diagram" data-ref="btn-mockup-item-${tpl.id}" data-mockup-id="${tpl.id}" data-tooltip="${escapeHtml(tpl.description || tpl.name)}" aria-label="${escapeHtml(tpl.name)}">
            <div style="width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; overflow: hidden; pointer-events: none;">
              ${tpl.thumbnailSvg}
            </div>
            <span class="element-grid-item__label">${escapeHtml(tpl.name)}</span>
          </button>
        `).join('');
      }
    } else if (activeElementsCategory === 'grids') {
      html += '<div class="elements-section-title">Distribuciones y collages</div>';
      let filteredGrids = GRID_TEMPLATES;
      if (cleanQ) {
        filteredGrids = filteredGrids.filter((g) => g.name.toLowerCase().includes(cleanQ) || g.description.toLowerCase().includes(cleanQ));
      }
      if (filteredGrids.length === 0) {
        html += '<div class="mockup-empty-state">No se encontraron cuadrículas.</div>';
      } else {
        html += filteredGrids.map((tpl) => `
          <button type="button" class="element-grid-item element-grid-item--diagram" data-ref="btn-mockup-item-${tpl.id}" data-mockup-id="${tpl.id}" data-tooltip="${escapeHtml(tpl.description || tpl.name)}" aria-label="${escapeHtml(tpl.name)}">
            <div style="width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; overflow: hidden; pointer-events: none;">
              ${tpl.thumbnailSvg}
            </div>
            <span class="element-grid-item__label">${escapeHtml(tpl.name)}</span>
          </button>
        `).join('');
      }
    } else if (activeElementsCategory === 'mockups') {
      html += `
        <div style="grid-column: 1 / -1; margin-bottom: 4px;">
          <button type="button" class="component-button component-button--h36 component-button--secondary component-button--w-full" data-ref="btn-elements-open-mockups-panel">
            <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#devices"></use></svg>
            <span>Explorar catálogo de mockups</span>
          </button>
        </div>
        <div class="mockup-category-tabs" style="grid-column: 1 / -1; margin-bottom: 6px;">
          <button type="button" class="mockup-category-pill ${activeMockupsFilter === 'all' ? 'is-active' : ''}" data-ref="mockup-cat-pill-all" data-mockup-general-cat="all">Todos</button>
          ${MOCKUP_GENERAL_CATEGORIES.map((c) => `
            <button type="button" class="mockup-category-pill ${activeMockupsFilter === c.id ? 'is-active' : ''}" data-ref="mockup-cat-pill-${c.id}" data-mockup-general-cat="${c.id}">${escapeHtml(c.name)}</button>
          `).join('')}
        </div>
        <div class="elements-section-title">Maquetas disponibles</div>
      `;
      let filteredMockups = MOCKUP_TEMPLATES;
      if (activeMockupsFilter !== 'all') {
        filteredMockups = filteredMockups.filter((m) => m.category === activeMockupsFilter);
      }
      if (cleanQ) {
        filteredMockups = filteredMockups.filter((m) => m.name.toLowerCase().includes(cleanQ) || m.description.toLowerCase().includes(cleanQ));
      }
      if (filteredMockups.length === 0) {
        html += '<div class="mockup-empty-state">No se encontraron mockups.</div>';
      } else {
        html += filteredMockups.map((tpl) => `
          <button type="button" class="element-grid-item element-grid-item--diagram" data-ref="btn-mockup-item-${tpl.id}" data-mockup-id="${tpl.id}" data-tooltip="${escapeHtml(tpl.description || tpl.name)}" aria-label="${escapeHtml(tpl.name)}">
            <div style="width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; overflow: hidden; pointer-events: none;">
              ${tpl.thumbnailSvg}
            </div>
            <span class="element-grid-item__label">${escapeHtml(tpl.name)}</span>
          </button>
        `).join('');
      }
    } else if (activeElementsCategory === '3d') {
      html += '<div class="elements-section-title">Modelos e Ilustraciones 3D</div>';
      html += BOARD_3D_SHAPES.map((shape) => `
        <button type="button" class="element-grid-item element-grid-item--diagram" data-ref="btn-3d-item-${shape.id}" data-shape3d-id="${shape.id}" data-tooltip="${escapeHtml(shape.name)}" aria-label="${escapeHtml(shape.name)}">
          <div style="width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; background: rgba(99, 102, 241, 0.08); border-radius: 8px; color: #6366f1; pointer-events: none;">
            <svg class="component-icon" aria-hidden="true" style="width: 22px; height: 22px;"><use href="/icons.svg#${shape.icon}"></use></svg>
          </div>
          <span class="element-grid-item__label">${escapeHtml(shape.name)}</span>
        </button>
      `).join('');
    }

    html += '</div>';
    contentContainer.innerHTML = html;

    const btnBack = contentContainer.querySelector<HTMLButtonElement>('[data-ref="btn-elements-back"]');
    btnBack?.addEventListener('click', () => {
      activeElementsCategory = 'root';
      renderContent('');
    });

    bindItemClicks(contentContainer);
    renderIcons(contentContainer);
  };

  const bindItemClicks = (container: HTMLElement) => {
    container.querySelectorAll<HTMLButtonElement>('[data-frame-cat]').forEach((pill) => {
      pill.addEventListener('click', () => {
        activeFramesFilter = pill.getAttribute('data-frame-cat') as FrameCategory | 'all';
        renderContent(searchInput?.value || '');
      });
    });

    container.querySelectorAll<HTMLButtonElement>('[data-mockup-general-cat]').forEach((pill) => {
      pill.addEventListener('click', () => {
        activeMockupsFilter = pill.getAttribute('data-mockup-general-cat') as MockupGeneralCategory | 'all';
        renderContent(searchInput?.value || '');
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

    container.querySelectorAll<HTMLButtonElement>('[data-table-rows]').forEach((itemBtn) => {
      itemBtn.addEventListener('click', () => {
        const rows = parseInt(itemBtn.getAttribute('data-table-rows') || '3', 10);
        const cols = parseInt(itemBtn.getAttribute('data-table-cols') || '3', 10);
        handleApplyTable(rows, cols, canvasType);
      });
    });

    const btnCustomTable = container.querySelector<HTMLButtonElement>('[data-ref="btn-insert-custom-table"]');
    btnCustomTable?.addEventListener('click', () => {
      const inputRows = container.querySelector<HTMLInputElement>('[data-ref="input-custom-table-rows"]');
      const inputCols = container.querySelector<HTMLInputElement>('[data-ref="input-custom-table-cols"]');
      const rows = Math.min(15, Math.max(1, parseInt(inputRows?.value || '3', 10) || 3));
      const cols = Math.min(10, Math.max(1, parseInt(inputCols?.value || '3', 10) || 3));
      handleApplyTable(rows, cols, canvasType);
    });

    const btnOpenMockups = container.querySelector<HTMLButtonElement>('[data-ref="btn-elements-open-mockups-panel"]');
    btnOpenMockups?.addEventListener('click', () => {
      const controller = getActiveCanvasController();
      controller?.openMockupsPanel?.();
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

  drawerBody.querySelectorAll<HTMLButtonElement>('[data-quick-search]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const tag = btn.getAttribute('data-quick-search') || '';
      if (searchInput) {
        searchInput.value = tag;
      }
      renderContent(tag);
    });
  });

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

