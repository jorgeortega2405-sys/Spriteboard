export interface PresetVariant {
  label: string;
  width: number;
  height: number;
  imagePath?: string;
}

export interface PresetItem {
  id: string;
  name: string;
  width: number;
  height: number;
  imagePath: string;
  masterPath?: string;
  isTemplate: boolean;
  categoryKey: string;
  categoryName: string;
  aspectType: 'wide' | 'tall' | 'square' | 'standard' | 'large' | 'compact';
  variants?: PresetVariant[];
}

export interface TemplateCategory {
  id: string;
  nameKey: string;
  defaultName: string;
  iconName: string;
}

export const TEMPLATE_CATEGORIES: TemplateCategory[] = [
  { id: 'all', nameKey: 'templates.all_categories', defaultName: 'Todas las categorías', iconName: 'grid_view' },
  { id: 'nature', nameKey: 'canvas.tab_nature', defaultName: 'Naturaleza', iconName: 'eco' },
  { id: 'cities', nameKey: 'canvas.tab_cities', defaultName: 'Ciudades', iconName: 'apartment' },
  { id: 'fantasy', nameKey: 'canvas.tab_fantasy', defaultName: 'Fantasía', iconName: 'shield' },
  { id: 'scifi', nameKey: 'canvas.tab_scifi', defaultName: 'Espacio', iconName: 'stars' },
  { id: 'characters', nameKey: 'canvas.tab_characters', defaultName: 'Personajes', iconName: 'person' },
  { id: 'items', nameKey: 'canvas.tab_items', defaultName: 'Objetos', iconName: 'category' },
];

export const NATURE_RESOLUTIONS: { width: number; height: number; label: string }[] = [
  { width: 256, height: 128, label: '256 × 128 px (Retro 8-bit)' },
  { width: 320, height: 160, label: '320 × 160 px (Retro 16-bit)' },
  { width: 512, height: 256, label: '512 × 256 px' },
  { width: 640, height: 320, label: '640 × 320 px (Retro HD)' },
  { width: 1024, height: 512, label: '1024 × 512 px' },
  { width: 1280, height: 640, label: '1280 × 640 px' },
  { width: 1536, height: 768, label: '1536 × 768 px' },
  { width: 1920, height: 960, label: '1920 × 960 px (Recomendado)' },
  { width: 2560, height: 1280, label: '2560 × 1280 px (2K QHD)' },
  { width: 3840, height: 1920, label: '3840 × 1920 px (4K Ultra)' },
];

export function makeNatureTemplateItem(
  id: string,
  name: string,
  fileBase: string,
  aspectType: 'wide' | 'tall' | 'square' | 'standard' | 'large' | 'compact' = 'standard'
): PresetItem {
  return {
    id,
    name,
    width: 1920,
    height: 960,
    imagePath: `/assets/templates/nature/${fileBase}_1920x960.png`,
    masterPath: `/assets/templates/nature/masters/${fileBase}_master.png`,
    isTemplate: true,
    categoryKey: 'nature',
    categoryName: 'Naturaleza',
    aspectType,
    variants: NATURE_RESOLUTIONS.map((res) => ({
      label: res.label,
      width: res.width,
      height: res.height,
      imagePath: `/assets/templates/nature/${fileBase}_${res.width}x${res.height}.png`,
    })),
  };
}

export const ALL_PRESETS: PresetItem[] = [
  makeNatureTemplateItem('tmpl-nat-forest', 'Bosque de Pinos Místico', 'forest', 'wide'),
  makeNatureTemplateItem('tmpl-nat-waterfall', 'Cascada Tropical', 'waterfall', 'standard'),
  makeNatureTemplateItem('tmpl-nat-mountain', 'Picos Nevados al Crepúsculo', 'mountain', 'wide'),
  makeNatureTemplateItem('tmpl-nat-beach', 'Playa Paradisíaca', 'beach', 'standard'),
  makeNatureTemplateItem('tmpl-nat-lake', 'Lago al Atardecer', 'lake', 'wide'),
  makeNatureTemplateItem('tmpl-nat-desert', 'Desierto de Dunas Estrellado', 'desert', 'standard'),
  makeNatureTemplateItem('tmpl-nat-swamp', 'Pantano Encantado', 'swamp', 'standard'),
  makeNatureTemplateItem('tmpl-nat-canyon', 'Cañón de Roca Roja', 'canyon', 'standard'),
  makeNatureTemplateItem('tmpl-nat-volcano', 'Volcán Activo con Lava', 'volcano', 'wide'),
  makeNatureTemplateItem('tmpl-nat-meadow', 'Pradera Silvestre en Flor', 'meadow', 'standard'),
];
