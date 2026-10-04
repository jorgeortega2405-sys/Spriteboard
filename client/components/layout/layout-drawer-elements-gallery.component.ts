import { BOARD_3D_SHAPES } from '../../config/board-3d-shapes.config.js';
import { createStickyNoteSvg, STICKY_NOTE_PRESETS } from '../../config/sticky-notes.config.js';
import { DIAGRAM_COMPONENTS } from '../../config/diagram-components.data.js';
import { escapeHtml } from '../../services/api.service.js';
import { FRAME_TEMPLATES, GRID_TEMPLATES, MOCKUP_TEMPLATES } from '../../config/mockups.config.js';
import { getActiveCanvasController, toggleDrawer } from '../layout.component.js';
import { MockupTemplate } from '../../types/mockups.types.js';
import { Shape3DType } from '../../views/board/board.types.js';
import { showToast } from '../../services/toast.service.js';
import { CHART_GROUPS } from '../../views/board/board-charts-panel.component.js';

export interface TablePresetItem {
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

export const TABLE_THEMES = [
  { borderColor: '#f59e0b', headerBg: '#fccb07', headerTextColor: '#202229', id: 'yellow', name: 'Amarillo', tintBg: '#fef9c3' },
  { borderColor: '#ea580c', headerBg: '#f9a850', headerTextColor: '#202229', id: 'orange', name: 'Naranja', tintBg: '#ffedd5' },
  { borderColor: '#f43f5e', headerBg: '#fc778c', headerTextColor: '#ffffff', id: 'pink', name: 'Rosa', tintBg: '#ffe4e6' },
];

export function buildTablePreviewSvg(theme: typeof TABLE_THEMES[0], style: 'wireframe' | 'header' | 'filled'): string {
  if (style === 'wireframe') {
    return `<svg viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg" style="width: 32px; height: 32px;"><rect x="4" y="4" width="36" height="36" rx="4" fill="#ffffff" stroke="${theme.borderColor}" stroke-width="2" /><line x1="4" y1="16" x2="40" y2="16" stroke="${theme.borderColor}" stroke-width="1.5" /><line x1="4" y1="28" x2="40" y2="28" stroke="${theme.borderColor}" stroke-width="1.5" /><line x1="16" y1="4" x2="16" y2="40" stroke="${theme.borderColor}" stroke-width="1.5" /><line x1="28" y1="4" x2="28" y2="40" stroke="${theme.borderColor}" stroke-width="1.5" /></svg>`;
  }
  if (style === 'header') {
    return `<svg viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg" style="width: 32px; height: 32px;"><rect x="4" y="4" width="36" height="36" rx="4" fill="#ffffff" stroke="${theme.borderColor}" stroke-width="2" /><path d="M4 8 C4 5.8 5.8 4 8 4 H36 C38.2 4 40 5.8 40 8 V16 H4 Z" fill="${theme.headerBg}" /><line x1="4" y1="16" x2="40" y2="16" stroke="${theme.borderColor}" stroke-width="1.5" /><line x1="4" y1="28" x2="40" y2="28" stroke="${theme.borderColor}" stroke-width="1.5" /><line x1="16" y1="4" x2="16" y2="40" stroke="${theme.borderColor}" stroke-width="1.5" /><line x1="28" y1="4" x2="28" y2="40" stroke="${theme.borderColor}" stroke-width="1.5" /></svg>`;
  }
  return `<svg viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg" style="width: 32px; height: 32px;"><rect x="4" y="4" width="10.5" height="10.5" rx="2" fill="${theme.headerBg}" /><rect x="16.75" y="4" width="10.5" height="10.5" rx="2" fill="${theme.headerBg}" /><rect x="29.5" y="4" width="10.5" height="10.5" rx="2" fill="${theme.headerBg}" /><rect x="4" y="16.75" width="10.5" height="10.5" rx="2" fill="${theme.tintBg}" stroke="${theme.borderColor}" stroke-width="0.8" /><rect x="16.75" y="16.75" width="10.5" height="10.5" rx="2" fill="${theme.tintBg}" stroke="${theme.borderColor}" stroke-width="0.8" /><rect x="29.5" y="16.75" width="10.5" height="10.5" rx="2" fill="${theme.tintBg}" stroke="${theme.borderColor}" stroke-width="0.8" /><rect x="4" y="29.5" width="10.5" height="10.5" rx="2" fill="${theme.tintBg}" stroke="${theme.borderColor}" stroke-width="0.8" /><rect x="16.75" y="29.5" width="10.5" height="10.5" rx="2" fill="${theme.tintBg}" stroke="${theme.borderColor}" stroke-width="0.8" /><rect x="29.5" y="29.5" width="10.5" height="10.5" rx="2" fill="${theme.tintBg}" stroke="${theme.borderColor}" stroke-width="0.8" /></svg>`;
}

export const TABLE_PRESETS: TablePresetItem[] = TABLE_THEMES.flatMap((theme) => [
  {
    borderColor: theme.borderColor,
    cellBg: '#ffffff',
    cellText: '#202229',
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
    cellText: '#202229',
    cols: 3,
    description: `Tabla 3×3 ${theme.name} (Encabezado)`,
    headerBg: theme.headerBg,
    headerText: theme.headerTextColor,
    id: `table_${theme.id}_header`,
    name: `${theme.name} - Encabezado`,
    previewSvg: buildTablePreviewSvg(theme, 'header'),
    rows: 4,
  },
  {
    borderColor: theme.borderColor,
    cellBg: theme.tintBg,
    cellText: '#202229',
    cols: 3,
    description: `Tabla 3×3 ${theme.name} (Celdas rellenas)`,
    headerBg: theme.headerBg,
    headerText: theme.headerTextColor,
    id: `table_${theme.id}_filled`,
    name: `${theme.name} - Rellena`,
    previewSvg: buildTablePreviewSvg(theme, 'filled'),
    rows: 4,
  },
]);

export interface PixelGridPresetItem {
  id: string;
  name: string;
  pixelSize: number;
  previewSvg: string;
  size: number;
}

export const PIXEL_GRID_PRESETS: PixelGridPresetItem[] = [
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

export const BOARD_3D_2D_SVGS: Partial<Record<Shape3DType, string>> = {};

export function handleApplyMockup(tpl: MockupTemplate, canvasType: 'board' | 'doc' | 'presentation' | 'video'): void {
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

export function handleApply3DShape(shapeId: Shape3DType, canvasType: 'board' | 'doc' | 'presentation' | 'video'): void {
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

export function handleApplyTable(
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

export function renderGalleryCategoryHtml(
  category: 'stickies' | 'diagrams' | 'tables' | 'charts' | 'frames' | 'grids' | 'mockups' | '3d' | 'pixel-grid',
  cleanQ = ''
): string {
  let html = '';
  if (category === 'stickies') {
    html += STICKY_NOTE_PRESETS.map((item) => `
      <button type="button" class="element-grid-item element-grid-item--diagram" data-ref="btn-sticky-item-${item.id}" data-sticky-id="${item.id}" data-tooltip="${escapeHtml(item.name)}" aria-label="${escapeHtml(item.name)}">
        <div class="element-grid-item__sticky-preview" style="display: flex; align-items: center; justify-content: center; width: 44px; height: 44px; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.12));">
          ${createStickyNoteSvg(item.color, item.foldColor, 34)}
        </div>
      </button>
    `).join('');
  } else if (category === 'diagrams') {
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
  } else if (category === 'tables') {
    html += '<div class="elements-section-title">Tablas prediseñadas (3 × 3)</div>';
    html += TABLE_PRESETS.map((item) => `
      <button type="button" class="element-grid-item element-grid-item--diagram" data-ref="btn-table-item-${item.id}" data-table-id="${item.id}" data-tooltip="${escapeHtml(item.description)}" aria-label="${escapeHtml(item.name)}">
        ${item.previewSvg}
      </button>
    `).join('');
  } else if (category === 'charts') {
    CHART_GROUPS.forEach((group) => {
      html += `<div class="elements-section-title">${escapeHtml(group.label)}</div>`;
      html += group.items.map((item) => `
        <button type="button" class="element-grid-item element-grid-item--diagram" data-ref="btn-chart-item-${item.id}" data-chart-type="${item.type}" data-tooltip="${escapeHtml(item.name)}" aria-label="${escapeHtml(item.name)}">
          ${item.svg}
        </button>
      `).join('');
    });
  } else if (category === 'frames') {
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
  } else if (category === 'grids') {
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
  } else if (category === 'mockups') {
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
  } else if (category === '3d') {
    html += '<div class="elements-section-title">Modelos e Ilustraciones 3D</div>';
    html += BOARD_3D_SHAPES.map((shape) => `
      <button type="button" class="element-grid-item element-grid-item--diagram" data-ref="btn-3d-item-${shape.id}" data-shape3d-id="${shape.id}" data-tooltip="${escapeHtml(shape.name)}" aria-label="${escapeHtml(shape.name)}">
        ${BOARD_3D_2D_SVGS[shape.id] || `<svg class="component-icon" aria-hidden="true"><use href="/icons.svg#category"></use></svg>`}
      </button>
    `).join('');
  } else if (category === 'pixel-grid') {
    html += '<div class="elements-section-title">Lienzos de Píxel Art</div>';
    html += PIXEL_GRID_PRESETS.map((preset) => `
      <button type="button" class="element-grid-item element-grid-item--diagram" data-ref="btn-pixel-preset-${preset.id}" data-pixel-size="${preset.size}" data-pixel-scale="${preset.pixelSize}" data-tooltip="${escapeHtml(preset.name)}" aria-label="${escapeHtml(preset.name)}">
        ${preset.previewSvg}
      </button>
    `).join('');
  }
  return html;
}

export function renderSearchMatchesGalleryHtml(options: {
  matching3D: any[];
  matchingCharts: any[];
  matchingDiagrams: any[];
  matchingMockups: any[];
  matchingPixel: any[];
  matchingShapes: any[];
  matchingTables: any[];
}): string {
  let html = '';
  const { matching3D, matchingCharts, matchingDiagrams, matchingMockups, matchingPixel, matchingShapes, matchingTables } = options;

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
        ${BOARD_3D_2D_SVGS[shape.id as Shape3DType] || `<svg class="component-icon" aria-hidden="true"><use href="/icons.svg#category"></use></svg>`}
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
    html += '<div class="elements-section-title">Formas</div>';
    html += matchingShapes.map((item) => `
      <button type="button" class="element-grid-item" data-ref="btn-element-item-${item.id}" data-element-id="${item.id}" data-tooltip="${escapeHtml(item.name)}" aria-label="${escapeHtml(item.name)}">
        <svg viewBox="0 0 48 48" aria-hidden="true">${item.previewSvg || `<path d="${item.pathD || ''}" fill="currentColor" />`}</svg>
      </button>
    `).join('');
  }

  return html;
}
