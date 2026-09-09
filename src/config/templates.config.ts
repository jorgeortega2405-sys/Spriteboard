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
  tags?: string[];
  variants?: PresetVariant[];
}

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
  aspectType: 'wide' | 'tall' | 'square' | 'standard' | 'large' | 'compact' = 'standard',
  tags: string[] = []
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
    tags,
    variants: NATURE_RESOLUTIONS.map((res) => ({
      label: res.label,
      width: res.width,
      height: res.height,
      imagePath: `/assets/templates/nature/${fileBase}_${res.width}x${res.height}.png`,
    })),
  };
}

export const ALL_PRESETS: PresetItem[] = [
  makeNatureTemplateItem('tmpl-nat-forest', 'Bosque de Pinos Místico', 'forest', 'wide', [
    'bosque', 'forest', 'woods', 'pinos', 'mistico', 'arboles', 'niebla', 'selva fria', 'arboleda', 'woodland', 'flora', 'naturaleza'
  ]),
  makeNatureTemplateItem('tmpl-nat-waterfall', 'Cascada Tropical', 'waterfall', 'standard', [
    'selva', 'jungla', 'jungle', 'rainforest', 'cascada', 'waterfall', 'rio', 'tropical', 'catarata', 'agua', 'floresta', 'bosque tropical', 'exotico', 'naturaleza'
  ]),
  makeNatureTemplateItem('tmpl-nat-mountain', 'Picos Nevados al Crepúsculo', 'mountain', 'wide', [
    'montana', 'mountain', 'picos', 'nieve', 'snow', 'crepusculo', 'atardecer', 'alpes', 'cordillera', 'frio', 'invierno', 'naturaleza'
  ]),
  makeNatureTemplateItem('tmpl-nat-beach', 'Playa Paradisíaca', 'beach', 'standard', [
    'playa', 'beach', 'mar', 'oceano', 'costa', 'arena', 'palmeras', 'tropical', 'isla', 'paraiso', 'verano', 'olas', 'bahia', 'naturaleza'
  ]),
  makeNatureTemplateItem('tmpl-nat-lake', 'Lago al Atardecer', 'lake', 'wide', [
    'lago', 'lake', 'atardecer', 'sunset', 'agua', 'reflejo', 'calma', 'muelle', 'laguna', 'estanque', 'paisaje', 'naturaleza'
  ]),
  makeNatureTemplateItem('tmpl-nat-desert', 'Desierto de Dunas Estrellado', 'desert', 'standard', [
    'desierto', 'desert', 'dunas', 'dunes', 'arena', 'sand', 'estrellas', 'noche', 'sahara', 'oasis', 'calor', 'piramides', 'naturaleza'
  ]),
  makeNatureTemplateItem('tmpl-nat-swamp', 'Pantano Encantado', 'swamp', 'standard', [
    'pantano', 'swamp', 'cienaga', 'marsh', 'humedal', 'manglar', 'jungla', 'selva pantanosa', 'niebla', 'fantasmal', 'verde', 'naturaleza'
  ]),
  makeNatureTemplateItem('tmpl-nat-canyon', 'Cañón de Roca Roja', 'canyon', 'standard', [
    'cañon', 'canyon', 'roca roja', 'desfiladero', 'valle', 'quebrada', 'colorado', 'arido', 'montana seca', 'naturaleza'
  ]),
  makeNatureTemplateItem('tmpl-nat-volcano', 'Volcán Activo con Lava', 'volcano', 'wide', [
    'volcan', 'volcano', 'lava', 'magma', 'fuego', 'erupcion', 'montana de fuego', 'ceniza', 'calor', 'crater', 'naturaleza'
  ]),
  makeNatureTemplateItem('tmpl-nat-meadow', 'Pradera Silvestre en Flor', 'meadow', 'standard', [
    'pradera', 'meadow', 'flores', 'flowers', 'campo', 'pasto', 'verde', 'primavera', 'pastizal', 'llano', 'colina', 'naturaleza'
  ]),
];
