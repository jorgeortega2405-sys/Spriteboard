import { DOC_FONTS_EXTENDED_CATALOG } from './doc-fonts-extended.config.js';

export interface DocFontVariant {
  name: string;
  style: 'italic' | 'normal';
  weight: number;
}

export interface DocFontFamily {
  category: 'bold' | 'display' | 'elegant' | 'handwriting' | 'modern' | 'monospace' | 'sans-serif' | 'serif';
  fallback: string;
  family: string;
  googleFont?: string;
  id: string;
  isPopular?: boolean;
  name: string;
  tags: string[];
  variants: DocFontVariant[];
}

export const DOC_FONT_CATEGORIES = [
  { id: 'all', label: 'Todas' },
  { id: 'sans-serif', label: 'Sans Serif' },
  { id: 'serif', label: 'Serif' },
  { id: 'display', label: 'Letrero' },
  { id: 'handwriting', label: 'Cursiva' },
  { id: 'bold', label: 'Negrita' },
  { id: 'elegant', label: 'Elegante' },
  { id: 'modern', label: 'Moderna' },
  { id: 'monospace', label: 'Monospace' },
] as const;

export const DOC_FONTS_CATALOG: DocFontFamily[] = [
  {
    category: 'sans-serif',
    fallback: 'system-ui, sans-serif',
    family: 'Inter',
    googleFont: 'Inter:wght@100..900',
    id: 'inter',
    isPopular: true,
    name: 'Inter',
    tags: ['sans', 'moderna', 'interfaz', 'limpia', 'ui', 'default'],
    variants: [
      { name: 'Ultradelgada', style: 'normal', weight: 100 },
      { name: 'Muy delgada', style: 'normal', weight: 200 },
      { name: 'Delgada', style: 'normal', weight: 300 },
      { name: 'Normal', style: 'normal', weight: 400 },
      { name: 'Media', style: 'normal', weight: 500 },
      { name: 'Seminegrita', style: 'normal', weight: 600 },
      { name: 'Negrita', style: 'normal', weight: 700 },
      { name: 'Extranegrita', style: 'normal', weight: 800 },
      { name: 'Ultragruesa', style: 'normal', weight: 900 },
      { name: 'Cursiva Normal', style: 'italic', weight: 400 },
      { name: 'Cursiva Negrita', style: 'italic', weight: 700 },
    ],
  },
  {
    category: 'sans-serif',
    fallback: 'system-ui, sans-serif',
    family: 'Roboto',
    googleFont: 'Roboto:ital,wght@0,100;0,300;0,400;0,500;0,700;0,900;1,400;1,700',
    id: 'roboto',
    isPopular: true,
    name: 'Roboto',
    tags: ['sans', 'google', 'moderna', 'lectura', 'neutra'],
    variants: [
      { name: 'Ultradelgada', style: 'normal', weight: 100 },
      { name: 'Delgada', style: 'normal', weight: 300 },
      { name: 'Normal', style: 'normal', weight: 400 },
      { name: 'Media', style: 'normal', weight: 500 },
      { name: 'Negrita', style: 'normal', weight: 700 },
      { name: 'Ultragruesa', style: 'normal', weight: 900 },
      { name: 'Cursiva', style: 'italic', weight: 400 },
      { name: 'Negrita Cursiva', style: 'italic', weight: 700 },
    ],
  },
  {
    category: 'sans-serif',
    fallback: 'system-ui, sans-serif',
    family: 'Montserrat',
    googleFont: 'Montserrat:ital,wght@0,100..900;1,100..900',
    id: 'montserrat',
    isPopular: true,
    name: 'Montserrat',
    tags: ['sans', 'geometrica', 'titular', 'moderna', 'elegante', 'cartel'],
    variants: [
      { name: 'Ultradelgada', style: 'normal', weight: 100 },
      { name: 'Muy delgada', style: 'normal', weight: 200 },
      { name: 'Delgada', style: 'normal', weight: 300 },
      { name: 'Normal', style: 'normal', weight: 400 },
      { name: 'Media', style: 'normal', weight: 500 },
      { name: 'Seminegrita', style: 'normal', weight: 600 },
      { name: 'Negrita', style: 'normal', weight: 700 },
      { name: 'Extranegrita', style: 'normal', weight: 800 },
      { name: 'Ultragruesa', style: 'normal', weight: 900 },
      { name: 'Cursiva', style: 'italic', weight: 400 },
      { name: 'Negrita Cursiva', style: 'italic', weight: 700 },
    ],
  },
  {
    category: 'sans-serif',
    fallback: 'sans-serif',
    family: 'Poppins',
    googleFont: 'Poppins:ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,400;1,700',
    id: 'poppins',
    isPopular: true,
    name: 'Poppins',
    tags: ['sans', 'geometrica', 'redondeada', 'moderna', 'fresca', 'diseño'],
    variants: [
      { name: 'Ultradelgada', style: 'normal', weight: 100 },
      { name: 'Muy delgada', style: 'normal', weight: 200 },
      { name: 'Delgada', style: 'normal', weight: 300 },
      { name: 'Normal', style: 'normal', weight: 400 },
      { name: 'Media', style: 'normal', weight: 500 },
      { name: 'Seminegrita', style: 'normal', weight: 600 },
      { name: 'Negrita', style: 'normal', weight: 700 },
      { name: 'Extranegrita', style: 'normal', weight: 800 },
      { name: 'Ultragruesa', style: 'normal', weight: 900 },
      { name: 'Cursiva', style: 'italic', weight: 400 },
      { name: 'Negrita Cursiva', style: 'italic', weight: 700 },
    ],
  },
  {
    category: 'sans-serif',
    fallback: 'sans-serif',
    family: 'Open Sans',
    googleFont: 'Open+Sans:ital,wght@0,300..800;1,300..800',
    id: 'open-sans',
    isPopular: true,
    name: 'Open Sans',
    tags: ['sans', 'lectura', 'parrafo', 'editorial', 'neutra'],
    variants: [
      { name: 'Delgada', style: 'normal', weight: 300 },
      { name: 'Normal', style: 'normal', weight: 400 },
      { name: 'Media', style: 'normal', weight: 500 },
      { name: 'Seminegrita', style: 'normal', weight: 600 },
      { name: 'Negrita', style: 'normal', weight: 700 },
      { name: 'Extranegrita', style: 'normal', weight: 800 },
      { name: 'Cursiva', style: 'italic', weight: 400 },
    ],
  },
  {
    category: 'sans-serif',
    fallback: 'sans-serif',
    family: 'Lato',
    googleFont: 'Lato:ital,wght@0,100;0,300;0,400;0,700;0,900;1,400;1,700',
    id: 'lato',
    isPopular: true,
    name: 'Lato',
    tags: ['sans', 'calida', 'corporativa', 'lectura'],
    variants: [
      { name: 'Ultradelgada', style: 'normal', weight: 100 },
      { name: 'Delgada', style: 'normal', weight: 300 },
      { name: 'Normal', style: 'normal', weight: 400 },
      { name: 'Negrita', style: 'normal', weight: 700 },
      { name: 'Ultragruesa', style: 'normal', weight: 900 },
      { name: 'Cursiva', style: 'italic', weight: 400 },
    ],
  },
  {
    category: 'bold',
    fallback: 'sans-serif',
    family: 'Oswald',
    googleFont: 'Oswald:wght@200..700',
    id: 'oswald',
    isPopular: true,
    name: 'Oswald',
    tags: ['bold', 'display', 'condensada', 'letrero', 'titular', 'impacto', 'negrita'],
    variants: [
      { name: 'Muy delgada', style: 'normal', weight: 200 },
      { name: 'Delgada', style: 'normal', weight: 300 },
      { name: 'Normal', style: 'normal', weight: 400 },
      { name: 'Media', style: 'normal', weight: 500 },
      { name: 'Seminegrita', style: 'normal', weight: 600 },
      { name: 'Negrita', style: 'normal', weight: 700 },
    ],
  },
  {
    category: 'bold',
    fallback: 'sans-serif',
    family: 'League Spartan',
    googleFont: 'League+Spartan:wght@100..900',
    id: 'league-spartan',
    isPopular: true,
    name: 'League Spartan',
    tags: ['bold', 'display', 'geometrica', 'titular', 'fuerte', 'negrita', 'canva'],
    variants: [
      { name: 'Ultradelgada', style: 'normal', weight: 100 },
      { name: 'Delgada', style: 'normal', weight: 300 },
      { name: 'Normal', style: 'normal', weight: 400 },
      { name: 'Seminegrita', style: 'normal', weight: 600 },
      { name: 'Negrita', style: 'normal', weight: 700 },
      { name: 'Ultragruesa', style: 'normal', weight: 900 },
    ],
  },
  {
    category: 'bold',
    fallback: 'sans-serif',
    family: 'Bebas Neue',
    googleFont: 'Bebas+Neue',
    id: 'bebas-neue',
    isPopular: true,
    name: 'Bebas Neue',
    tags: ['bold', 'display', 'condensada', 'poster', 'titular', 'impacto', 'mayusculas'],
    variants: [
      { name: 'Regular (Titular)', style: 'normal', weight: 400 },
    ],
  },
  {
    category: 'bold',
    fallback: 'sans-serif',
    family: 'Anton',
    googleFont: 'Anton',
    id: 'anton',
    isPopular: false,
    name: 'Anton',
    tags: ['bold', 'display', 'impacto', 'titular', 'pesada', 'negrita'],
    variants: [
      { name: 'Regular', style: 'normal', weight: 400 },
    ],
  },
  {
    category: 'serif',
    fallback: 'serif',
    family: 'Playfair Display',
    googleFont: 'Playfair+Display:ital,wght@0,400..900;1,400..900',
    id: 'playfair-display',
    isPopular: true,
    name: 'Playfair Display',
    tags: ['serif', 'elegante', 'editorial', 'moda', 'titular', 'revista', 'lujo'],
    variants: [
      { name: 'Normal', style: 'normal', weight: 400 },
      { name: 'Media', style: 'normal', weight: 500 },
      { name: 'Seminegrita', style: 'normal', weight: 600 },
      { name: 'Negrita', style: 'normal', weight: 700 },
      { name: 'Extranegrita', style: 'normal', weight: 800 },
      { name: 'Ultragruesa', style: 'normal', weight: 900 },
      { name: 'Cursiva', style: 'italic', weight: 400 },
      { name: 'Negrita Cursiva', style: 'italic', weight: 700 },
    ],
  },
  {
    category: 'serif',
    fallback: 'serif',
    family: 'Merriweather',
    googleFont: 'Merriweather:ital,wght@0,300;0,400;0,700;0,900;1,300;1,400;1,700',
    id: 'merriweather',
    isPopular: true,
    name: 'Merriweather',
    tags: ['serif', 'lectura', 'libro', 'clasica', 'editorial', 'comoda'],
    variants: [
      { name: 'Delgada', style: 'normal', weight: 300 },
      { name: 'Normal', style: 'normal', weight: 400 },
      { name: 'Negrita', style: 'normal', weight: 700 },
      { name: 'Ultragruesa', style: 'normal', weight: 900 },
      { name: 'Cursiva', style: 'italic', weight: 400 },
      { name: 'Negrita Cursiva', style: 'italic', weight: 700 },
    ],
  },
  {
    category: 'serif',
    fallback: 'serif',
    family: 'Lora',
    googleFont: 'Lora:ital,wght@0,400..700;1,400..700',
    id: 'lora',
    isPopular: true,
    name: 'Lora',
    tags: ['serif', 'elegante', 'caligrafica', 'literaria', 'parrafo'],
    variants: [
      { name: 'Normal', style: 'normal', weight: 400 },
      { name: 'Media', style: 'normal', weight: 500 },
      { name: 'Seminegrita', style: 'normal', weight: 600 },
      { name: 'Negrita', style: 'normal', weight: 700 },
      { name: 'Cursiva', style: 'italic', weight: 400 },
      { name: 'Negrita Cursiva', style: 'italic', weight: 700 },
    ],
  },
  {
    category: 'serif',
    fallback: 'serif',
    family: 'Cinzel',
    googleFont: 'Cinzel:wght@400..900',
    id: 'cinzel',
    isPopular: true,
    name: 'Cinzel',
    tags: ['serif', 'elegante', 'romana', 'monumental', 'titular', 'clasica', 'lujo'],
    variants: [
      { name: 'Normal', style: 'normal', weight: 400 },
      { name: 'Media', style: 'normal', weight: 500 },
      { name: 'Seminegrita', style: 'normal', weight: 600 },
      { name: 'Negrita', style: 'normal', weight: 700 },
      { name: 'Extranegrita', style: 'normal', weight: 800 },
      { name: 'Ultragruesa', style: 'normal', weight: 900 },
    ],
  },
  {
    category: 'serif',
    fallback: 'serif',
    family: 'Cormorant Garamond',
    googleFont: 'Cormorant+Garamond:ital,wght@0,300..700;1,300..700',
    id: 'cormorant-garamond',
    isPopular: false,
    name: 'Cormorant Garamond',
    tags: ['serif', 'elegante', 'tradicional', 'fina', 'literaria', 'antigua'],
    variants: [
      { name: 'Delgada', style: 'normal', weight: 300 },
      { name: 'Normal', style: 'normal', weight: 400 },
      { name: 'Media', style: 'normal', weight: 500 },
      { name: 'Seminegrita', style: 'normal', weight: 600 },
      { name: 'Negrita', style: 'normal', weight: 700 },
      { name: 'Cursiva', style: 'italic', weight: 400 },
      { name: 'Negrita Cursiva', style: 'italic', weight: 700 },
    ],
  },
  {
    category: 'serif',
    fallback: 'serif',
    family: 'Bree Serif',
    googleFont: 'Bree+Serif',
    id: 'bree-serif',
    isPopular: true,
    name: 'Bree Serif',
    tags: ['serif', 'amigable', 'titular', 'redondeada', 'canva'],
    variants: [
      { name: 'Regular', style: 'normal', weight: 400 },
    ],
  },
  {
    category: 'serif',
    fallback: 'serif',
    family: 'Bitter',
    googleFont: 'Bitter:ital,wght@0,100..900;1,100..900',
    id: 'bitter',
    isPopular: false,
    name: 'Bitter',
    tags: ['serif', 'slab', 'pantalla', 'lectura', 'solida'],
    variants: [
      { name: 'Delgada', style: 'normal', weight: 300 },
      { name: 'Normal', style: 'normal', weight: 400 },
      { name: 'Seminegrita', style: 'normal', weight: 600 },
      { name: 'Negrita', style: 'normal', weight: 700 },
      { name: 'Extranegrita', style: 'normal', weight: 800 },
      { name: 'Cursiva', style: 'italic', weight: 400 },
    ],
  },
  {
    category: 'handwriting',
    fallback: 'cursive',
    family: 'Dancing Script',
    googleFont: 'Dancing+Script:wght@400..700',
    id: 'dancing-script',
    isPopular: true,
    name: 'Dancing Script',
    tags: ['handwriting', 'cursiva', 'caligrafia', 'manuscrita', 'fluida', 'boda', 'fiesta'],
    variants: [
      { name: 'Normal', style: 'normal', weight: 400 },
      { name: 'Media', style: 'normal', weight: 500 },
      { name: 'Seminegrita', style: 'normal', weight: 600 },
      { name: 'Negrita', style: 'normal', weight: 700 },
    ],
  },
  {
    category: 'handwriting',
    fallback: 'cursive',
    family: 'Pacifico',
    googleFont: 'Pacifico',
    id: 'pacifico',
    isPopular: true,
    name: 'Pacifico',
    tags: ['handwriting', 'cursiva', 'verano', 'surf', 'vintage', 'caligrafia', 'retro'],
    variants: [
      { name: 'Regular', style: 'normal', weight: 400 },
    ],
  },
  {
    category: 'handwriting',
    fallback: 'cursive',
    family: 'Caveat',
    googleFont: 'Caveat:wght@400..700',
    id: 'caveat',
    isPopular: true,
    name: 'Caveat',
    tags: ['handwriting', 'cursiva', 'manuscrita', 'natural', 'apuntes', 'desenfadada'],
    variants: [
      { name: 'Normal', style: 'normal', weight: 400 },
      { name: 'Media', style: 'normal', weight: 500 },
      { name: 'Seminegrita', style: 'normal', weight: 600 },
      { name: 'Negrita', style: 'normal', weight: 700 },
    ],
  },
  {
    category: 'handwriting',
    fallback: 'cursive',
    family: 'Great Vibes',
    googleFont: 'Great+Vibes',
    id: 'great-vibes',
    isPopular: true,
    name: 'Great Vibes',
    tags: ['handwriting', 'cursiva', 'elegante', 'caligrafica', 'invitacion', 'boda', 'lujo'],
    variants: [
      { name: 'Regular (Caligráfica)', style: 'normal', weight: 400 },
    ],
  },
  ...DOC_FONTS_EXTENDED_CATALOG,
];

const loadedGoogleFonts = new Set<string>();
const RECENT_FONTS_KEY = 'spriteboard_doc_recent_fonts';

export function ensureGoogleFontLoaded(family: string): void {
  const clean = family.split(',')[0].replace(/['"]/g, '').trim().toLowerCase();
  const fontObj = DOC_FONTS_CATALOG.find((f) => f.family.toLowerCase() === clean || f.id === clean);
  if (!fontObj || !fontObj.googleFont) return;
  if (loadedGoogleFonts.has(fontObj.id)) return;

  loadedGoogleFonts.add(fontObj.id);

  const existingLink = document.querySelector(`link[data-font-id="${fontObj.id}"]`);
  if (existingLink) return;

  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${fontObj.googleFont}&display=swap`;
  link.setAttribute('data-font-id', fontObj.id);
  document.head.appendChild(link);
}

export function preloadPopularFonts(): void {
  const popularFonts = DOC_FONTS_CATALOG.filter((f) => f.isPopular && f.googleFont);
  if (popularFonts.length === 0) return;

  const familiesParam = popularFonts.map((f) => `family=${f.googleFont}`).join('&');
  const previewHref = `https://fonts.googleapis.com/css2?${familiesParam}&display=swap`;

  const existing = document.querySelector('link[data-ref="google-fonts-catalog-preload"]');
  if (!existing) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = previewHref;
    link.setAttribute('data-ref', 'google-fonts-catalog-preload');
    document.head.appendChild(link);
  }

  popularFonts.forEach((f) => loadedGoogleFonts.add(f.id));
}

export function getLoadedGoogleFontsStylesheets(): string[] {
  const links: string[] = [];
  const linkElements = document.querySelectorAll<HTMLLinkElement>('link[data-font-id], link[data-ref="google-fonts-catalog-preload"]');
  linkElements.forEach((el) => {
    if (el.href) {
      links.push(el.href);
    }
  });
  return links;
}

export function getRecentFontIds(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_FONTS_KEY);
    if (!raw) return ['inter', 'roboto', 'montserrat', 'playfair-display', 'dancing-script'];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return ['inter', 'roboto', 'montserrat', 'playfair-display', 'dancing-script'];
  }
}

export function addRecentFontId(fontId: string): void {
  try {
    const recents = getRecentFontIds().filter((id) => id !== fontId);
    recents.unshift(fontId);
    const limited = recents.slice(0, 8);
    localStorage.setItem(RECENT_FONTS_KEY, JSON.stringify(limited));
  } catch {
    // Ignore storage quota
  }
}

export function findFontById(id: string): DocFontFamily | undefined {
  return DOC_FONTS_CATALOG.find((f) => f.id === id);
}

export function findFontByFamily(family: string): DocFontFamily | undefined {
  const clean = family.split(',')[0].replace(/['"]/g, '').trim().toLowerCase();
  return DOC_FONTS_CATALOG.find((f) => f.family.toLowerCase() === clean);
}
