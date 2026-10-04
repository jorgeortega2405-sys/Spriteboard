import { FrameCategory, GridCategory, MockupCategory, MockupGeneralCategory, MockupSectionGroup, MockupTemplate } from '../types/mockups.types.js';

export const DEFAULT_MOCKUP_PLACEHOLDER_SVG: string = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600" width="100%" height="100%">
  <defs>
    <linearGradient id="skyGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="%237bc9ff"/>
      <stop offset="60%" stop-color="%23b8e4ff"/>
      <stop offset="100%" stop-color="%23dff2fe"/>
    </linearGradient>
    <linearGradient id="hillBack" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="%237db828"/>
      <stop offset="100%" stop-color="%23568812"/>
    </linearGradient>
    <linearGradient id="hillFront" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="%2393c834"/>
      <stop offset="100%" stop-color="%23679c16"/>
    </linearGradient>
    <filter id="cloudShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="8" stdDeviation="6" flood-color="%23000000" flood-opacity="0.08"/>
    </filter>
  </defs>
  <rect width="600" height="600" fill="url(%23skyGrad)"/>
  <g filter="url(%23cloudShadow)">
    <path d="M260 210 A 32 32 0 0 1 310 185 A 46 46 0 0 1 385 200 A 30 30 0 0 1 410 230 A 28 28 0 0 1 390 265 L 240 265 A 25 25 0 0 1 230 220 A 30 30 0 0 1 260 210 Z" fill="%23ffffff" opacity="0.95"/>
  </g>
  <path d="M-50 650 L-50 420 Q 150 320 380 440 T 650 380 L650 650 Z" fill="url(%23hillBack)"/>
  <path d="M-50 650 L-50 480 Q 200 370 450 490 T 650 450 L650 650 Z" fill="url(%23hillFront)"/>
</svg>`;

export const FRAME_CATEGORIES: Array<{ icon: string; id: FrameCategory; name: string }> = [
  { icon: 'shapes', id: 'basic_shapes', name: 'Formas básicas' },
  { icon: 'photo_camera', id: 'film_photo', name: 'Película y foto' },
  { icon: 'devices', id: 'devices', name: 'Dispositivos' },
  { icon: 'description', id: 'paper', name: 'Papel' },
  { icon: 'local_florist', id: 'flowers', name: 'Flores' },
  { icon: 'water_drop', id: 'blob', name: 'Blob' },
  { icon: 'tv', id: 'retro', name: 'Retro' },
  { icon: 'font_download', id: 'letters', name: 'Cartas' },
  { icon: 'pin', id: 'numbers', name: 'Números' },
];

export const GRID_CATEGORIES: Array<{ icon: string; id: GridCategory; name: string }> = [
  { icon: 'grid_view', id: 'collages', name: 'Cuadrículas' },
];

export const MOCKUP_GENERAL_CATEGORIES: Array<{ icon: string; id: MockupGeneralCategory; name: string }> = [
  { icon: 'crop_portrait', id: 'frames', name: 'Marcos' },
  { icon: 'smartphone', id: 'smartphones', name: 'Smartphones' },
  { icon: 'checkroom', id: 'apparel', name: 'Vestuario' },
  { icon: 'laptop_mac', id: 'computers', name: 'Computadoras' },
  { icon: 'cottage', id: 'home', name: 'Vida en el hogar' },
  { icon: 'inventory_2', id: 'packaging', name: 'Empaque' },
  { icon: 'tv', id: 'tablets_tv', name: 'Tablets y televisión' },
];

export const MOCKUP_CATEGORIES: Array<{ icon: string; id: MockupCategory; name: string }> = [
  ...MOCKUP_GENERAL_CATEGORIES,
];

export const FRAME_TEMPLATES: MockupTemplate[] = [];

export const GRID_TEMPLATES: MockupTemplate[] = [];

export const MOCKUP_TEMPLATES: MockupTemplate[] = [];

export const ALL_MOCKUP_ITEMS: MockupTemplate[] = [
  ...FRAME_TEMPLATES,
  ...GRID_TEMPLATES,
  ...MOCKUP_TEMPLATES,
];

export function getMockupTemplateById(id: string): MockupTemplate | undefined {
  return ALL_MOCKUP_ITEMS.find((tpl) => tpl.id === id);
}

export function getFramesByCategory(category: FrameCategory | 'all'): MockupTemplate[] {
  if (category === 'all') return FRAME_TEMPLATES;
  return FRAME_TEMPLATES.filter((tpl) => tpl.category === category);
}

export function getGridsByCategory(category: GridCategory | 'all'): MockupTemplate[] {
  if (category === 'all') return GRID_TEMPLATES;
  return GRID_TEMPLATES.filter((tpl) => tpl.category === category);
}

export function getMockupsByGeneralCategory(category: MockupGeneralCategory | 'all'): MockupTemplate[] {
  if (category === 'all') return MOCKUP_TEMPLATES;
  return MOCKUP_TEMPLATES.filter((tpl) => tpl.category === category);
}

export function getMockupsByGroup(group: MockupSectionGroup): MockupTemplate[] {
  if (group === 'frames') return FRAME_TEMPLATES;
  if (group === 'grids') return GRID_TEMPLATES;
  return MOCKUP_TEMPLATES;
}

export function getMockupsByCategory(category: MockupCategory): MockupTemplate[] {
  return ALL_MOCKUP_ITEMS.filter((tpl) => tpl.category === category);
}
