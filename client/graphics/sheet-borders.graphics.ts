export interface SheetBorderBtnDef {
  dataRef: string;
  iconSvg: string;
  tooltip: string;
  type: string;
}

export const SHEET_BORDER_BUTTONS: SheetBorderBtnDef[] = [
  {
    dataRef: 'btn-border-all',
    iconSvg: '<svg class="sheet-border-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="3" y="3" width="18" height="18" rx="2" stroke-width="2"/><line x1="12" y1="3" x2="12" y2="21" stroke-width="2"/><line x1="3" y1="12" x2="21" y2="12" stroke-width="2"/></svg>',
    tooltip: 'Todos los bordes',
    type: 'all',
  },
  {
    dataRef: 'btn-border-outer',
    iconSvg: '<svg class="sheet-border-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="3" y="3" width="18" height="18" rx="2" stroke-width="2"/><line x1="12" y1="3" x2="12" y2="21" stroke-width="1" stroke-dasharray="2 2" opacity="0.4"/><line x1="3" y1="12" x2="21" y2="12" stroke-width="1" stroke-dasharray="2 2" opacity="0.4"/></svg>',
    tooltip: 'Bordes exteriores',
    type: 'outer',
  },
  {
    dataRef: 'btn-border-inner',
    iconSvg: '<svg class="sheet-border-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="3" y="3" width="18" height="18" rx="2" stroke-width="1" stroke-dasharray="2 2" opacity="0.4"/><line x1="12" y1="3" x2="12" y2="21" stroke-width="2"/><line x1="3" y1="12" x2="21" y2="12" stroke-width="2"/></svg>',
    tooltip: 'Bordes interiores',
    type: 'inner',
  },
  {
    dataRef: 'btn-border-top',
    iconSvg: '<svg class="sheet-border-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="3" y="3" width="18" height="18" rx="2" stroke-width="1" stroke-dasharray="2 2" opacity="0.3"/><line x1="3" y1="3" x2="21" y2="3" stroke-width="2.5"/></svg>',
    tooltip: 'Borde superior',
    type: 'top',
  },
  {
    dataRef: 'btn-border-middle-h',
    iconSvg: '<svg class="sheet-border-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="3" y="3" width="18" height="18" rx="2" stroke-width="1" stroke-dasharray="2 2" opacity="0.3"/><line x1="3" y1="12" x2="21" y2="12" stroke-width="2.5"/></svg>',
    tooltip: 'Borde horizontal interior',
    type: 'middle-h',
  },
  {
    dataRef: 'btn-border-bottom',
    iconSvg: '<svg class="sheet-border-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="3" y="3" width="18" height="18" rx="2" stroke-width="1" stroke-dasharray="2 2" opacity="0.3"/><line x1="3" y1="21" x2="21" y2="21" stroke-width="2.5"/></svg>',
    tooltip: 'Borde inferior',
    type: 'bottom',
  },
  {
    dataRef: 'btn-border-left',
    iconSvg: '<svg class="sheet-border-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="3" y="3" width="18" height="18" rx="2" stroke-width="1" stroke-dasharray="2 2" opacity="0.3"/><line x1="3" y1="3" x2="3" y2="21" stroke-width="2.5"/></svg>',
    tooltip: 'Borde izquierdo',
    type: 'left',
  },
  {
    dataRef: 'btn-border-middle-v',
    iconSvg: '<svg class="sheet-border-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="3" y="3" width="18" height="18" rx="2" stroke-width="1" stroke-dasharray="2 2" opacity="0.3"/><line x1="12" y1="3" x2="12" y2="21" stroke-width="2.5"/></svg>',
    tooltip: 'Borde vertical interior',
    type: 'middle-v',
  },
  {
    dataRef: 'btn-border-right',
    iconSvg: '<svg class="sheet-border-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="3" y="3" width="18" height="18" rx="2" stroke-width="1" stroke-dasharray="2 2" opacity="0.3"/><line x1="21" y1="3" x2="21" y2="21" stroke-width="2.5"/></svg>',
    tooltip: 'Borde derecho',
    type: 'right',
  },
];

export const SHEET_BORDER_STYLE_ICON = '<svg class="sheet-border-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor"><line x1="4" y1="7" x2="20" y2="7" stroke-width="1"/><line x1="4" y1="12" x2="20" y2="12" stroke-width="2"/><line x1="4" y1="17" x2="20" y2="17" stroke-width="3"/></svg>';

export const SHEET_BORDER_CLEAR_ICON = '<svg class="sheet-border-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>';

export function renderSheetBorderButtonsHtml(): string {
  return SHEET_BORDER_BUTTONS.map((b) => `
    <button type="button" class="sheet-border-btn" data-ref="${b.dataRef}" data-border-type="${b.type}" data-tooltip="${b.tooltip}" aria-label="${b.tooltip}">
      ${b.iconSvg}
    </button>
  `).join('\n');
}
