import { API_ROUTES } from '../../config/api-routes.js';
import { BOARD_3D_SHAPES } from '../../config/board-3d-shapes.config.js';
import { DIAGRAM_COMPONENTS, DiagramComponentItem } from '../../config/diagram-components.data.js';
import { ALL_MOCKUP_ITEMS, FRAME_CATEGORIES, FRAME_TEMPLATES, GRID_TEMPLATES, MOCKUP_GENERAL_CATEGORIES, MOCKUP_TEMPLATES } from '../../config/mockups.config.js';
import { createStickyNoteSvg, DEFAULT_STICKY_COLOR, DEFAULT_STICKY_TEXT_COLOR, STICKY_NOTE_PRESETS } from '../../config/sticky-notes.config.js';
import { renderElementCategoryTilesHtml } from '../../graphics/element-category-tiles.graphics.js';
import { escapeHtml, getApi } from '../../services/api.service.js';
import { t } from '../../services/i18n.service.js';
import { renderIcons } from '../../services/icon.service.js';
import { showToast } from '../../services/toast.service.js';
import { ElementItem } from '../../types/element.types.js';
import { FrameCategory, MockupGeneralCategory, MockupTemplate } from '../../types/mockups.types.js';
import { PIXEL_SHAPES, PixelShape, ShapeCategory } from '../../utils/pixel-shapes.util.js';
import { CHART_GROUPS } from '../../views/board/board-charts-panel.component.js';
import { ChartType, Shape3DType, ShapeType } from '../../views/board/board.types.js';
import { getActiveCanvasController, getActiveCanvasType, toggleDrawer, updateCanvasRailActiveState } from '../layout.component.js';

let activeElementsCategory: 'root' | 'shapes' | 'stickers' | 'stickies' | 'diagrams' | 'tables' | 'charts' | 'frames' | 'grids' | 'mockups' | '3d' | 'pixel-grid' = 'root';
let activeShapeSection: string | null = null;
let activeFramesFilter: FrameCategory | 'all' = 'all';
let activeMockupsFilter: MockupGeneralCategory | 'all' = 'all';

const BOARD_3D_2D_SVGS: Partial<Record<Shape3DType, string>> = {};


interface TablePresetItem {
  borderColor: string;
  cellBg: string;
  cellText: string;
  cols: number;
  description: string;
  headerBg: string;
  headerText: string;
  id: string;
  name: string;
  previewSvg: string;
  rows: number;
}

const TABLE_THEMES = [
  { borderColor: '#52525b', headerBg: '#52525b', id: 'slate', name: 'Gris pizarra', tintBg: '#f4f4f5' },
  { borderColor: '#ef4444', headerBg: '#ef4444', id: 'red', name: 'Rojo coral', tintBg: '#fee2e2' },
  { borderColor: '#f59e0b', headerBg: '#f59e0b', id: 'amber', name: 'Ámbar', tintBg: '#fef3c7' },
  { borderColor: '#3b82f6', headerBg: '#3b82f6', id: 'blue', name: 'Azul', tintBg: '#dbeafe' },
  { borderColor: '#8b5cf6', headerBg: '#8b5cf6', id: 'purple', name: 'Púrpura', tintBg: '#ede9fe' },
];

function buildTablePreviewSvg(theme: typeof TABLE_THEMES[0], style: 'wireframe' | 'header' | 'filled'): string {
  if (style === 'wireframe') {
    return `<svg viewBox="0 0 38 46" fill="none" xmlns="http://www.w3.org/2000/svg" style="width: 22px; height: 28px;"><rect x="2" y="2" width="34" height="42" rx="2" fill="#ffffff" stroke="${theme.borderColor}" stroke-width="2" /><line x1="2" y1="12.5" x2="36" y2="12.5" stroke="${theme.borderColor}" stroke-width="1.5" /><line x1="2" y1="23" x2="36" y2="23" stroke="${theme.borderColor}" stroke-width="1.5" /><line x1="2" y1="33.5" x2="36" y2="33.5" stroke="${theme.borderColor}" stroke-width="1.5" /><line x1="13.3" y1="2" x2="13.3" y2="44" stroke="${theme.borderColor}" stroke-width="1.5" /><line x1="24.6" y1="2" x2="24.6" y2="44" stroke="${theme.borderColor}" stroke-width="1.5" /></svg>`;
  }
  if (style === 'header') {
    return `<svg viewBox="0 0 38 46" fill="none" xmlns="http://www.w3.org/2000/svg" style="width: 22px; height: 28px;"><rect x="2" y="2" width="34" height="42" rx="2" fill="#ffffff" stroke="${theme.borderColor}" stroke-width="2" /><path d="M2 4 C2 2.9 2.9 2 4 2 H34 C35.1 2 36 2.9 36 4 V12.5 H2 Z" fill="${theme.headerBg}" /><line x1="2" y1="12.5" x2="36" y2="12.5" stroke="${theme.borderColor}" stroke-width="1.5" /><line x1="2" y1="23" x2="36" y2="23" stroke="${theme.borderColor}" stroke-width="1.5" /><line x1="2" y1="33.5" x2="36" y2="33.5" stroke="${theme.borderColor}" stroke-width="1.5" /><line x1="13.3" y1="12.5" x2="13.3" y2="44" stroke="${theme.borderColor}" stroke-width="1.5" /><line x1="24.6" y1="12.5" x2="24.6" y2="44" stroke="${theme.borderColor}" stroke-width="1.5" /></svg>`;
  }
  return `<svg viewBox="0 0 38 46" fill="none" xmlns="http://www.w3.org/2000/svg" style="width: 22px; height: 28px;"><rect x="2" y="2" width="9.5" height="9" rx="1.5" fill="${theme.headerBg}" /><rect x="14.2" y="2" width="9.5" height="9" rx="1.5" fill="${theme.headerBg}" /><rect x="26.5" y="2" width="9.5" height="9" rx="1.5" fill="${theme.headerBg}" /><rect x="2" y="13.5" width="9.5" height="9" rx="1.5" fill="${theme.tintBg}" /><rect x="14.2" y="13.5" width="9.5" height="9" rx="1.5" fill="${theme.tintBg}" /><rect x="26.5" y="13.5" width="9.5" height="9" rx="1.5" fill="${theme.tintBg}" /><rect x="2" y="25" width="9.5" height="9" rx="1.5" fill="${theme.tintBg}" /><rect x="14.2" y="25" width="9.5" height="9" rx="1.5" fill="${theme.tintBg}" /><rect x="26.5" y="25" width="9.5" height="9" rx="1.5" fill="${theme.tintBg}" /><rect x="2" y="36.5" width="9.5" height="9" rx="1.5" fill="${theme.tintBg}" /><rect x="14.2" y="36.5" width="9.5" height="9" rx="1.5" fill="${theme.tintBg}" /><rect x="26.5" y="36.5" width="9.5" height="9" rx="1.5" fill="${theme.tintBg}" /></svg>`;
}

const TABLE_PRESETS: TablePresetItem[] = TABLE_THEMES.flatMap((theme) => [
  {
    borderColor: theme.borderColor,
    cellBg: '#ffffff',
    cellText: '#1e293b',
    cols: 3,
    description: `Tabla 3×3 ${theme.name} (Bordes)`,
    headerBg: '#ffffff',
    headerText: theme.borderColor,
    id: `table_${theme.id}_wireframe`,
    name: `${theme.name} - Bordes`,
    previewSvg: buildTablePreviewSvg(theme, 'wireframe'),
    rows: 4,
  },
  {
    borderColor: theme.borderColor,
    cellBg: '#ffffff',
    cellText: '#1e293b',
    cols: 3,
    description: `Tabla 3×3 ${theme.name} (Encabezado)`,
    headerBg: theme.headerBg,
    headerText: '#ffffff',
    id: `table_${theme.id}_header`,
    name: `${theme.name} - Encabezado`,
    previewSvg: buildTablePreviewSvg(theme, 'header'),
    rows: 4,
  },
  {
    borderColor: theme.borderColor,
    cellBg: theme.tintBg,
    cellText: '#1e293b',
    cols: 3,
    description: `Tabla 3×3 ${theme.name} (Celdas rellenas)`,
    headerBg: theme.headerBg,
    headerText: '#ffffff',
    id: `table_${theme.id}_filled`,
    name: `${theme.name} - Rellena`,
    previewSvg: buildTablePreviewSvg(theme, 'filled'),
    rows: 4,
  },
]);

interface PixelGridPresetItem {
  id: string;
  name: string;
  pixelSize: number;
  previewSvg: string;
  size: number;
}

const PIXEL_GRID_PRESETS: PixelGridPresetItem[] = [
  { id: 'px_8', name: '8 × 8 (Iconos miniatura)', pixelSize: 24, previewSvg: '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="26" height="26" rx="2"/><path d="M10 3v26M17 3v26M24 3v26M3 10h26M3 17h26M3 24h26" opacity="0.7"/></svg>', size: 8 },
  { id: 'px_16', name: '16 × 16 (Sprites clásicos)', pixelSize: 18, previewSvg: '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1"><rect x="3" y="3" width="26" height="26" rx="2"/><path d="M8 3v26M13 3v26M18 3v26M23 3v26M3 8h26M3 13h26M3 18h26M3 23h26" opacity="0.7"/></svg>', size: 16 },
  { id: 'px_24', name: '24 × 24 (Iconografía)', pixelSize: 14, previewSvg: '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="0.8"><rect x="3" y="3" width="26" height="26" rx="2"/><path d="M7 3v26M11 3v26M16 3v26M21 3v26M25 3v26M3 7h26M3 11h26M3 16h26M3 21h26M3 25h26" opacity="0.7"/></svg>', size: 24 },
  { id: 'px_32', name: '32 × 32 (Sprites estándar)', pixelSize: 12, previewSvg: '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="0.7"><rect x="3" y="3" width="26" height="26" rx="2"/><path d="M6 3v26M10 3v26M14 3v26M18 3v26M22 3v26M26 3v26M3 6h26M3 10h26M3 14h26M3 18h26M3 22h26M3 26h26" opacity="0.65"/></svg>', size: 32 },
  { id: 'px_48', name: '48 × 48 (Personajes y retratos)', pixelSize: 8, previewSvg: '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="0.6"><rect x="3" y="3" width="26" height="26" rx="2"/><path d="M6 3v26M9 3v26M12 3v26M15 3v26M18 3v26M21 3v26M24 3v26M27 3v26M3 6h26M3 9h26M3 12h26M3 15h26M3 18h26M3 21h26M3 24h26M3 27h26" opacity="0.6"/></svg>', size: 48 },
  { id: 'px_64', name: '64 × 64 (Escenas y texturas)', pixelSize: 6, previewSvg: '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="0.5"><rect x="3" y="3" width="26" height="26" rx="2"/><path d="M5 3v26M8 3v26M11 3v26M14 3v26M17 3v26M20 3v26M23 3v26M26 3v26M3 5h26M3 8h26M3 11h26M3 14h26M3 17h26M3 20h26M3 23h26M3 26h26" opacity="0.55"/></svg>', size: 64 },
  { id: 'px_96', name: '96 × 96 (Alta definición retro)', pixelSize: 5, previewSvg: '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="0.5"><rect x="3" y="3" width="26" height="26" rx="2"/><path d="M5 3v26M7.5 3v26M10 3v26M12.5 3v26M15 3v26M17.5 3v26M20 3v26M22.5 3v26M25 3v26M27 3v26M3 5h26M3 7.5h26M3 10h26M3 12.5h26M3 15h26M3 17.5h26M3 20h26M3 22.5h26M3 25h26M3 27h26" opacity="0.5"/></svg>', size: 96 },
  { id: 'px_128', name: '128 × 128 (Lienzo amplio)', pixelSize: 4, previewSvg: '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="0.4"><rect x="3" y="3" width="26" height="26" rx="2"/><path d="M5 3v26M7 3v26M9 3v26M11 3v26M13 3v26M15 3v26M17 3v26M19 3v26M21 3v26M23 3v26M25 3v26M27 3v26M3 5h26M3 7h26M3 9h26M3 11h26M3 13h26M3 15h26M3 17h26M3 19h26M3 21h26M3 23h26M3 25h26M3 27h26" opacity="0.45"/></svg>', size: 128 },
  { id: 'px_256', name: '256 × 256 (Máxima resolución)', pixelSize: 3, previewSvg: '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="0.35"><rect x="3" y="3" width="26" height="26" rx="2" fill="rgba(139,92,246,0.06)"/><path d="M4.5 3v26M6 3v26M7.5 3v26M9 3v26M10.5 3v26M12 3v26M13.5 3v26M15 3v26M16.5 3v26M18 3v26M19.5 3v26M21 3v26M22.5 3v26M24 3v26M25.5 3v26M27 3v26M3 4.5h26M3 6h26M3 7.5h26M3 9h26M3 10.5h26M3 12h26M3 13.5h26M3 15h26M3 16.5h26M3 18h26M3 19.5h26M3 21h26M3 22.5h26M3 24h26M3 25.5h26M3 27h26" opacity="0.4"/></svg>', size: 256 },
];

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

function handleApplyTable(
  rows: number,
  cols: number,
  canvasType: 'board' | 'doc' | 'presentation' | 'video',
  options?: {
    borderColor?: string;
    borderWidth?: number;
    cellBackgroundColor?: string;
    cellTextColor?: string;
    headerBackgroundColor?: string;
    headerTextColor?: string;
  }
): void {
  const controller = getActiveCanvasController();
  if (canvasType === 'video' && controller) {
    controller.insertTable?.(rows, cols, options);
    showToast(`Tabla de ${rows}×${cols} añadida al video`, 'success');
  } else if ((canvasType === 'board' || canvasType === 'presentation') && controller) {
    controller.insertTable?.(rows, cols, 450, 210, options);
    showToast(`Tabla de ${rows}×${cols} añadida al lienzo`, 'success');
  } else if (canvasType === 'doc' && controller) {
    controller.insertTable?.(rows, cols, options);
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

      if (matchingCharts.length > 0) {
        html += '<div class="elements-section-title">Gráficas</div>';
        html += matchingCharts.map((item) => `
          <button type="button" class="element-grid-item element-grid-item--diagram" data-ref="btn-chart-item-${item.id}" data-chart-type="${item.type}" data-tooltip="${escapeHtml(item.name)}" aria-label="${escapeHtml(item.name)}">
            ${item.svg}
          </button>
        `).join('');
      }

      if (matching3D.length > 0) {
        html += '<div class="elements-section-title">Elementos 3D</div>';
        html += matching3D.map((shape) => `
          <button type="button" class="element-grid-item element-grid-item--diagram" data-ref="btn-3d-item-${shape.id}" data-shape3d-id="${shape.id}" data-tooltip="${escapeHtml(shape.name)}" aria-label="${escapeHtml(shape.name)}">
            ${BOARD_3D_2D_SVGS[shape.id] || `<svg class="component-icon" aria-hidden="true"><use href="/icons.svg#category"></use></svg>`}
          </button>
        `).join('');
      }

      if (matchingTables.length > 0) {
        html += '<div class="elements-section-title">Tablas</div>';
        html += matchingTables.map((item) => `
          <button type="button" class="element-grid-item element-grid-item--diagram" data-ref="btn-table-item-${item.id}" data-table-id="${item.id}" data-tooltip="${escapeHtml(item.description)}" aria-label="${escapeHtml(item.name)}">
            ${item.previewSvg}
          </button>
        `).join('');
      }

      if (matchingPixel.length > 0) {
        html += '<div class="elements-section-title">Píxel Art</div>';
        html += matchingPixel.map((item) => `
          <button type="button" class="element-grid-item element-grid-item--diagram" data-ref="btn-pixel-preset-${item.id}" data-pixel-size="${item.size}" data-pixel-scale="${item.pixelSize}" data-tooltip="${escapeHtml(item.name)}" aria-label="${escapeHtml(item.name)}">
            ${item.previewSvg}
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
          </button>
        `).join('');
      }

      if (matchingDiagrams.length > 0) {
        html += '<div class="elements-section-title">Diagramas</div>';
        html += matchingDiagrams.map((item) => `
          <button type="button" class="element-grid-item element-grid-item--diagram" data-ref="btn-diagram-item-${item.id}" data-diagram-id="${item.id}" data-tooltip="${escapeHtml(item.description || item.name)}" aria-label="${escapeHtml(item.name)}">
            <svg viewBox="0 0 48 48" aria-hidden="true">${item.previewSvg}</svg>
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
          const cat = btn.getAttribute('data-category') as 'shapes' | 'stickers' | 'stickies' | 'diagrams' | 'tables' | 'charts' | 'frames' | 'grids' | 'mockups' | '3d' | 'pixel-grid';
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
      const vectorShapes = PIXEL_SHAPES.filter((s) => s.category === 'shapes' && s.type === 'vector');
      const assignedShapeIds = new Set<string>();

      if (activeShapeSection) {
        let matching: PixelShape[] = [];
        if (activeShapeSection === 'other') {
          SHAPE_SECTIONS.forEach((sec) => {
            vectorShapes.forEach((s) => {
              const rawKey = s.id.replace(/^shape_/, '');
              if (sec.prefixes.includes(rawKey) || sec.prefixes.some((p) => rawKey.startsWith(p))) {
                assignedShapeIds.add(s.id);
              }
            });
          });
          matching = vectorShapes.filter((s) => !assignedShapeIds.has(s.id));
        } else {
          const sec = SHAPE_SECTIONS.find((s) => s.key === activeShapeSection);
          if (sec) {
            matching = vectorShapes.filter((s) => {
              const rawKey = s.id.replace(/^shape_/, '');
              return sec.prefixes.includes(rawKey) || sec.prefixes.some((p) => rawKey.startsWith(p));
            });
          }
        }

        html += matching.map((item) => `
          <button type="button" class="element-grid-item" data-ref="btn-element-item-${item.id}" data-element-id="${item.id}" data-tooltip="${escapeHtml(item.name)}" aria-label="${escapeHtml(item.name)}">
            <svg viewBox="0 0 48 48" aria-hidden="true"><path d="${item.pathD || ''}" fill="currentColor" /></svg>
          </button>
        `).join('');
      } else {
        SHAPE_SECTIONS.forEach((sec) => {
          const matching = vectorShapes.filter((s) => {
            const rawKey = s.id.replace(/^shape_/, '');
            return sec.prefixes.includes(rawKey) || sec.prefixes.some((p) => rawKey.startsWith(p));
          });

          if (matching.length > 0) {
            matching.forEach((s) => assignedShapeIds.add(s.id));
            html += `
              <div class="elements-section-header" data-ref="section-header-${sec.key}">
                <span class="elements-section-title">${escapeHtml(sec.label)}</span>
                ${matching.length > 6 ? `
                  <button type="button" class="elements-section-header__action" data-ref="btn-see-all-${sec.key}" data-shape-section="${sec.key}">Ver todo</button>
                ` : ''}
              </div>
            `;
            html += matching.slice(0, 6).map((item) => `
              <button type="button" class="element-grid-item" data-ref="btn-element-item-${item.id}" data-element-id="${item.id}" data-tooltip="${escapeHtml(item.name)}" aria-label="${escapeHtml(item.name)}">
                <svg viewBox="0 0 48 48" aria-hidden="true"><path d="${item.pathD || ''}" fill="currentColor" /></svg>
              </button>
            `).join('');
          }
        });

        const remainingShapes = vectorShapes.filter((s) => !assignedShapeIds.has(s.id));
        if (remainingShapes.length > 0) {
          html += `
            <div class="elements-section-header" data-ref="section-header-other">
              <span class="elements-section-title">Otras formas</span>
              ${remainingShapes.length > 6 ? `
                <button type="button" class="elements-section-header__action" data-ref="btn-see-all-other" data-shape-section="other">Ver todo</button>
              ` : ''}
            </div>
          `;
          html += remainingShapes.slice(0, 6).map((item) => `
            <button type="button" class="element-grid-item" data-ref="btn-element-item-${item.id}" data-element-id="${item.id}" data-tooltip="${escapeHtml(item.name)}" aria-label="${escapeHtml(item.name)}">
              <svg viewBox="0 0 48 48" aria-hidden="true"><path d="${item.pathD || ''}" fill="currentColor" /></svg>
            </button>
          `).join('');
        }
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
          <div class="element-grid-item__sticky-preview" style="display: flex; align-items: center; justify-content: center; width: 44px; height: 44px; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.12));">
            ${createStickyNoteSvg(item.color, item.foldColor, 34)}
          </div>
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
          </button>
        `).join('');
      });
    } else if (activeElementsCategory === 'tables') {
      html += '<div class="elements-section-title">Tablas prediseñadas (3 × 3)</div>';
      html += TABLE_PRESETS.map((item) => `
        <button type="button" class="element-grid-item element-grid-item--diagram" data-ref="btn-table-item-${item.id}" data-table-id="${item.id}" data-tooltip="${escapeHtml(item.description)}" aria-label="${escapeHtml(item.name)}">
          ${item.previewSvg}
        </button>
      `).join('');
    } else if (activeElementsCategory === 'charts') {
      CHART_GROUPS.forEach((group) => {
        html += `<div class="elements-section-title">${escapeHtml(group.label)}</div>`;
        html += group.items.map((item) => `
          <button type="button" class="element-grid-item element-grid-item--diagram" data-ref="btn-chart-item-${item.id}" data-chart-type="${item.type}" data-tooltip="${escapeHtml(item.name)}" aria-label="${escapeHtml(item.name)}">
            ${item.svg}
          </button>
        `).join('');
      });
    } else if (activeElementsCategory === 'frames') {
      html += '<div class="elements-section-title">Marcos disponibles</div>';
      let filteredFrames = FRAME_TEMPLATES;
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
          </button>
        `).join('');
      }
    } else if (activeElementsCategory === 'mockups') {
      html += '<div class="elements-section-title">Maquetas disponibles</div>';
      let filteredMockups = MOCKUP_TEMPLATES;
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
          </button>
        `).join('');
      }
    } else if (activeElementsCategory === '3d') {
      html += '<div class="elements-section-title">Modelos e Ilustraciones 3D</div>';
      html += BOARD_3D_SHAPES.map((shape) => `
        <button type="button" class="element-grid-item element-grid-item--diagram" data-ref="btn-3d-item-${shape.id}" data-shape3d-id="${shape.id}" data-tooltip="${escapeHtml(shape.name)}" aria-label="${escapeHtml(shape.name)}">
          ${BOARD_3D_2D_SVGS[shape.id] || `<svg class="component-icon" aria-hidden="true"><use href="/icons.svg#category"></use></svg>`}
        </button>
      `).join('');
    } else if (activeElementsCategory === 'pixel-grid') {
      html += '<div class="elements-section-title">Lienzos de Píxel Art</div>';
      html += PIXEL_GRID_PRESETS.map((preset) => `
        <button type="button" class="element-grid-item element-grid-item--diagram" data-ref="btn-pixel-preset-${preset.id}" data-pixel-size="${preset.size}" data-pixel-scale="${preset.pixelSize}" data-tooltip="${escapeHtml(preset.name)}" aria-label="${escapeHtml(preset.name)}">
          ${preset.previewSvg}
        </button>
      `).join('');
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

