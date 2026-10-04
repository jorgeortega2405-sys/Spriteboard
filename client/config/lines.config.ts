import { MarkerType, StrokeStyle } from '../engine-2d/types.js';

export interface LinePresetItem {
  arrowEnd: MarkerType;
  arrowStart: MarkerType;
  id: string;
  name: string;
  previewSvg: string;
  strokeStyle: StrokeStyle;
}

export const LINE_PRESETS: LinePresetItem[] = [
  {
    arrowEnd: 'none',
    arrowStart: 'none',
    id: 'line_solid',
    name: 'Línea sólida',
    previewSvg: '<line x1="4" y1="24" x2="44" y2="24" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" />',
    strokeStyle: 'solid',
  },
  {
    arrowEnd: 'none',
    arrowStart: 'none',
    id: 'line_dashed',
    name: 'Línea discontinua',
    previewSvg: '<line x1="4" y1="24" x2="44" y2="24" stroke="currentColor" stroke-width="2.5" stroke-dasharray="5 3.5" stroke-linecap="round" />',
    strokeStyle: 'dashed',
  },
  {
    arrowEnd: 'none',
    arrowStart: 'none',
    id: 'line_dotted',
    name: 'Línea punteada',
    previewSvg: '<line x1="4" y1="24" x2="44" y2="24" stroke="currentColor" stroke-width="2.5" stroke-dasharray="1 3.5" stroke-linecap="round" />',
    strokeStyle: 'dotted',
  },
  {
    arrowEnd: 'arrow-filled',
    arrowStart: 'none',
    id: 'line_arrow_solid',
    name: 'Flecha sólida',
    previewSvg: '<line x1="4" y1="24" x2="35" y2="24" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" /><polygon points="34,18 44,24 34,30" fill="currentColor" />',
    strokeStyle: 'solid',
  },
  {
    arrowEnd: 'arrow',
    arrowStart: 'none',
    id: 'line_arrow_open',
    name: 'Flecha abierta',
    previewSvg: '<line x1="4" y1="24" x2="41" y2="24" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" /><path d="M35 18L42 24L35 30" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />',
    strokeStyle: 'solid',
  },
  {
    arrowEnd: 'arrow',
    arrowStart: 'none',
    id: 'line_arrow_dotted',
    name: 'Flecha punteada',
    previewSvg: '<line x1="4" y1="24" x2="36" y2="24" stroke="currentColor" stroke-width="2.5" stroke-dasharray="1 3.5" stroke-linecap="round" /><path d="M36 18L43 24L36 30" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />',
    strokeStyle: 'dotted',
  },
  {
    arrowEnd: 'bar',
    arrowStart: 'bar',
    id: 'line_bar',
    name: 'Línea con topes',
    previewSvg: '<line x1="6" y1="24" x2="42" y2="24" stroke="currentColor" stroke-width="2.5" /><line x1="6" y1="16" x2="6" y2="32" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" /><line x1="42" y1="16" x2="42" y2="32" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" />',
    strokeStyle: 'solid',
  },
  {
    arrowEnd: 'arrow-filled',
    arrowStart: 'arrow-filled',
    id: 'line_double_arrow',
    name: 'Flecha bidireccional sólida',
    previewSvg: '<line x1="13" y1="24" x2="35" y2="24" stroke="currentColor" stroke-width="2.5" /><polygon points="14,18 4,24 14,30" fill="currentColor" /><polygon points="34,18 44,24 34,30" fill="currentColor" />',
    strokeStyle: 'solid',
  },
  {
    arrowEnd: 'arrow-filled',
    arrowStart: 'arrow-filled',
    id: 'line_double_arrow_dotted',
    name: 'Flecha bidireccional punteada',
    previewSvg: '<line x1="13" y1="24" x2="35" y2="24" stroke="currentColor" stroke-width="2.5" stroke-dasharray="1 3.5" stroke-linecap="round" /><polygon points="14,18 4,24 14,30" fill="currentColor" /><polygon points="34,18 44,24 34,30" fill="currentColor" />',
    strokeStyle: 'dotted',
  },
  {
    arrowEnd: 'square-filled',
    arrowStart: 'square-filled',
    id: 'line_square_filled',
    name: 'Línea con cuadrados rellenos',
    previewSvg: '<line x1="10" y1="24" x2="38" y2="24" stroke="currentColor" stroke-width="2.5" /><rect x="4" y="20" width="8" height="8" rx="1" fill="currentColor" /><rect x="36" y="20" width="8" height="8" rx="1" fill="currentColor" />',
    strokeStyle: 'solid',
  },
  {
    arrowEnd: 'circle-filled',
    arrowStart: 'circle-filled',
    id: 'line_circle_filled',
    name: 'Línea con círculos rellenos',
    previewSvg: '<line x1="9" y1="24" x2="39" y2="24" stroke="currentColor" stroke-width="2.5" /><circle cx="8" cy="24" r="4.5" fill="currentColor" /><circle cx="40" cy="24" r="4.5" fill="currentColor" />',
    strokeStyle: 'solid',
  },
  {
    arrowEnd: 'diamond-filled',
    arrowStart: 'diamond-filled',
    id: 'line_diamond_filled',
    name: 'Línea con rombos rellenos',
    previewSvg: '<line x1="10" y1="24" x2="38" y2="24" stroke="currentColor" stroke-width="2.5" /><polygon points="8,19 13,24 8,29 3,24" fill="currentColor" /><polygon points="40,19 45,24 40,29 35,24" fill="currentColor" />',
    strokeStyle: 'solid',
  },
  {
    arrowEnd: 'square',
    arrowStart: 'square',
    id: 'line_square_hollow',
    name: 'Línea con cuadrados huecos',
    previewSvg: '<line x1="12" y1="24" x2="36" y2="24" stroke="currentColor" stroke-width="2.5" /><rect x="4" y="20" width="8" height="8" rx="1" fill="none" stroke="currentColor" stroke-width="2" /><rect x="36" y="20" width="8" height="8" rx="1" fill="none" stroke="currentColor" stroke-width="2" />',
    strokeStyle: 'solid',
  },
  {
    arrowEnd: 'circle',
    arrowStart: 'circle',
    id: 'line_circle_hollow',
    name: 'Línea con círculos huecos',
    previewSvg: '<line x1="12" y1="24" x2="36" y2="24" stroke="currentColor" stroke-width="2.5" /><circle cx="8" cy="24" r="4" fill="none" stroke="currentColor" stroke-width="2" /><circle cx="40" cy="24" r="4" fill="none" stroke="currentColor" stroke-width="2" />',
    strokeStyle: 'solid',
  },
  {
    arrowEnd: 'diamond',
    arrowStart: 'diamond',
    id: 'line_diamond_hollow',
    name: 'Línea con rombos huecos',
    previewSvg: '<line x1="12" y1="24" x2="36" y2="24" stroke="currentColor" stroke-width="2.5" /><polygon points="8,19 13,24 8,29 3,24" fill="none" stroke="currentColor" stroke-width="2" /><polygon points="40,19 45,24 40,29 35,24" fill="none" stroke="currentColor" stroke-width="2" />',
    strokeStyle: 'solid',
  },
];
