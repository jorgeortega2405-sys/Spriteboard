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
  {
    category: 'handwriting',
    fallback: 'cursive',
    family: 'Sacramento',
    googleFont: 'Sacramento',
    id: 'sacramento',
    isPopular: false,
    name: 'Sacramento',
    tags: ['handwriting', 'cursiva', 'delicada', 'caligrafica', 'femenina', 'suave'],
    variants: [
      { name: 'Regular', style: 'normal', weight: 400 },
    ],
  },
  {
    category: 'handwriting',
    fallback: 'cursive',
    family: 'Satisfy',
    googleFont: 'Satisfy',
    id: 'satisfy',
    isPopular: false,
    name: 'Satisfy',
    tags: ['handwriting', 'cursiva', 'brush', 'pincel', 'casual'],
    variants: [
      { name: 'Regular', style: 'normal', weight: 400 },
    ],
  },
  {
    category: 'handwriting',
    fallback: 'cursive',
    family: 'Alex Brush',
    googleFont: 'Alex+Brush',
    id: 'alex-brush',
    isPopular: false,
    name: 'Alex Brush',
    tags: ['handwriting', 'cursiva', 'caligrafica', 'elegante', 'clasica'],
    variants: [
      { name: 'Regular', style: 'normal', weight: 400 },
    ],
  },
  {
    category: 'display',
    fallback: 'cursive, sans-serif',
    family: 'Lobster',
    googleFont: 'Lobster',
    id: 'lobster',
    isPopular: true,
    name: 'Lobster',
    tags: ['display', 'letrero', 'vintage', 'retro', 'titular', 'cursiva', 'restaurante'],
    variants: [
      { name: 'Regular', style: 'normal', weight: 400 },
    ],
  },
  {
    category: 'display',
    fallback: 'serif',
    family: 'Abril Fatface',
    googleFont: 'Abril+Fatface',
    id: 'abril-fatface',
    isPopular: true,
    name: 'Abril Fatface',
    tags: ['display', 'letrero', 'titular', 'didone', 'moda', 'elegante', 'impacto'],
    variants: [
      { name: 'Regular', style: 'normal', weight: 400 },
    ],
  },
  {
    category: 'display',
    fallback: 'sans-serif',
    family: 'Righteous',
    googleFont: 'Righteous',
    id: 'righteous',
    isPopular: false,
    name: 'Righteous',
    tags: ['display', 'letrero', 'retro', 'moderna', 'futurista', 'poster'],
    variants: [
      { name: 'Regular', style: 'normal', weight: 400 },
    ],
  },
  {
    category: 'display',
    fallback: 'sans-serif',
    family: 'Bungee',
    googleFont: 'Bungee',
    id: 'bungee',
    isPopular: false,
    name: 'Bungee',
    tags: ['display', 'letrero', 'urbana', 'bloque', 'impacto', 'cartel'],
    variants: [
      { name: 'Regular', style: 'normal', weight: 400 },
    ],
  },
  {
    category: 'modern',
    fallback: 'sans-serif',
    family: 'Raleway',
    googleFont: 'Raleway:ital,wght@0,100..900;1,100..900',
    id: 'raleway',
    isPopular: true,
    name: 'Raleway',
    tags: ['modern', 'sans', 'elegante', 'fina', 'diseno', 'canva'],
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
    ],
  },
  {
    category: 'modern',
    fallback: 'sans-serif',
    family: 'Plus Jakarta Sans',
    googleFont: 'Plus+Jakarta+Sans:ital,wght@0,200..800;1,200..800',
    id: 'plus-jakarta-sans',
    isPopular: true,
    name: 'Plus Jakarta Sans',
    tags: ['modern', 'sans', 'tech', 'startup', 'futurista', 'limpia'],
    variants: [
      { name: 'Muy delgada', style: 'normal', weight: 200 },
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
    category: 'modern',
    fallback: 'sans-serif',
    family: 'DM Sans',
    googleFont: 'DM+Sans:ital,opsz,wght@0,9..40,100..1000;1,9..40,100..1000',
    id: 'dm-sans',
    isPopular: true,
    name: 'DM Sans',
    tags: ['modern', 'sans', 'geometrica', 'editorial', 'canva'],
    variants: [
      { name: 'Ultradelgada', style: 'normal', weight: 100 },
      { name: 'Delgada', style: 'normal', weight: 300 },
      { name: 'Normal', style: 'normal', weight: 400 },
      { name: 'Media', style: 'normal', weight: 500 },
      { name: 'Seminegrita', style: 'normal', weight: 600 },
      { name: 'Negrita', style: 'normal', weight: 700 },
      { name: 'Ultragruesa', style: 'normal', weight: 900 },
    ],
  },
  {
    category: 'modern',
    fallback: 'sans-serif',
    family: 'Outfit',
    googleFont: 'Outfit:wght@100..900',
    id: 'outfit',
    isPopular: false,
    name: 'Outfit',
    tags: ['modern', 'sans', 'geometrica', 'fresca', 'brillante'],
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
    category: 'modern',
    fallback: 'sans-serif',
    family: 'Space Grotesk',
    googleFont: 'Space+Grotesk:wght@300..700',
    id: 'space-grotesk',
    isPopular: false,
    name: 'Space Grotesk',
    tags: ['modern', 'sans', 'tech', 'brutalismo', 'espacio', 'mono-inspired'],
    variants: [
      { name: 'Delgada', style: 'normal', weight: 300 },
      { name: 'Normal', style: 'normal', weight: 400 },
      { name: 'Media', style: 'normal', weight: 500 },
      { name: 'Seminegrita', style: 'normal', weight: 600 },
      { name: 'Negrita', style: 'normal', weight: 700 },
    ],
  },
  {
    category: 'modern',
    fallback: 'sans-serif',
    family: 'Quicksand',
    googleFont: 'Quicksand:wght@300..700',
    id: 'quicksand',
    isPopular: true,
    name: 'Quicksand',
    tags: ['modern', 'sans', 'redondeada', 'suave', 'amigable', 'infantil'],
    variants: [
      { name: 'Delgada', style: 'normal', weight: 300 },
      { name: 'Normal', style: 'normal', weight: 400 },
      { name: 'Media', style: 'normal', weight: 500 },
      { name: 'Seminegrita', style: 'normal', weight: 600 },
      { name: 'Negrita', style: 'normal', weight: 700 },
    ],
  },
  {
    category: 'modern',
    fallback: 'sans-serif',
    family: 'Comfortaa',
    googleFont: 'Comfortaa:wght@300..700',
    id: 'comfortaa',
    isPopular: false,
    name: 'Comfortaa',
    tags: ['modern', 'sans', 'redondeada', 'curva', 'diseño', 'logo'],
    variants: [
      { name: 'Delgada', style: 'normal', weight: 300 },
      { name: 'Normal', style: 'normal', weight: 400 },
      { name: 'Seminegrita', style: 'normal', weight: 600 },
      { name: 'Negrita', style: 'normal', weight: 700 },
    ],
  },
  {
    category: 'modern',
    fallback: 'sans-serif',
    family: 'Rubik',
    googleFont: 'Rubik:ital,wght@0,300..900;1,300..900',
    id: 'rubik',
    isPopular: false,
    name: 'Rubik',
    tags: ['modern', 'sans', 'suave', 'esquinas-redondeadas', 'ui'],
    variants: [
      { name: 'Delgada', style: 'normal', weight: 300 },
      { name: 'Normal', style: 'normal', weight: 400 },
      { name: 'Media', style: 'normal', weight: 500 },
      { name: 'Seminegrita', style: 'normal', weight: 600 },
      { name: 'Negrita', style: 'normal', weight: 700 },
      { name: 'Extranegrita', style: 'normal', weight: 800 },
      { name: 'Ultragruesa', style: 'normal', weight: 900 },
    ],
  },
  {
    category: 'monospace',
    fallback: 'monospace',
    family: 'Fira Code',
    googleFont: 'Fira+Code:wght@300..700',
    id: 'fira-code',
    isPopular: true,
    name: 'Fira Code',
    tags: ['monospace', 'codigo', 'programacion', 'terminal', 'ligaduras'],
    variants: [
      { name: 'Delgada', style: 'normal', weight: 300 },
      { name: 'Normal', style: 'normal', weight: 400 },
      { name: 'Media', style: 'normal', weight: 500 },
      { name: 'Seminegrita', style: 'normal', weight: 600 },
      { name: 'Negrita', style: 'normal', weight: 700 },
    ],
  },
  {
    category: 'monospace',
    fallback: 'monospace',
    family: 'JetBrains Mono',
    googleFont: 'JetBrains+Mono:ital,wght@0,100..800;1,100..800',
    id: 'jetbrains-mono',
    isPopular: true,
    name: 'JetBrains Mono',
    tags: ['monospace', 'codigo', 'desarrollador', 'legible'],
    variants: [
      { name: 'Ultradelgada', style: 'normal', weight: 100 },
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
    category: 'monospace',
    fallback: 'monospace',
    family: 'Inconsolata',
    googleFont: 'Inconsolata:wght@200..900',
    id: 'inconsolata',
    isPopular: false,
    name: 'Inconsolata',
    tags: ['monospace', 'consola', 'limpia', 'codigo'],
    variants: [
      { name: 'Delgada', style: 'normal', weight: 300 },
      { name: 'Normal', style: 'normal', weight: 400 },
      { name: 'Negrita', style: 'normal', weight: 700 },
      { name: 'Ultragruesa', style: 'normal', weight: 900 },
    ],
  },
  {
    category: 'sans-serif',
    fallback: 'Helvetica, Arial, sans-serif',
    family: 'Arial',
    id: 'arial',
    isPopular: true,
    name: 'Arial',
    tags: ['sans', 'sistema', 'estandar', 'universal', 'office'],
    variants: [
      { name: 'Normal', style: 'normal', weight: 400 },
      { name: 'Negrita', style: 'normal', weight: 700 },
      { name: 'Cursiva', style: 'italic', weight: 400 },
      { name: 'Negrita Cursiva', style: 'italic', weight: 700 },
    ],
  },
  {
    category: 'serif',
    fallback: 'Times, serif',
    family: 'Times New Roman',
    id: 'times-new-roman',
    isPopular: true,
    name: 'Times New Roman',
    tags: ['serif', 'sistema', 'academico', 'oficial', 'formal', 'documento'],
    variants: [
      { name: 'Normal', style: 'normal', weight: 400 },
      { name: 'Negrita', style: 'normal', weight: 700 },
      { name: 'Cursiva', style: 'italic', weight: 400 },
      { name: 'Negrita Cursiva', style: 'italic', weight: 700 },
    ],
  },
  {
    category: 'serif',
    fallback: 'serif',
    family: 'Georgia',
    id: 'georgia',
    isPopular: true,
    name: 'Georgia',
    tags: ['serif', 'sistema', 'editorial', 'lectura-web', 'elegante'],
    variants: [
      { name: 'Normal', style: 'normal', weight: 400 },
      { name: 'Negrita', style: 'normal', weight: 700 },
      { name: 'Cursiva', style: 'italic', weight: 400 },
      { name: 'Negrita Cursiva', style: 'italic', weight: 700 },
    ],
  },
  {
    category: 'monospace',
    fallback: 'Courier, monospace',
    family: 'Courier New',
    id: 'courier-new',
    isPopular: false,
    name: 'Courier New',
    tags: ['monospace', 'sistema', 'maquina-escribir', 'antigua'],
    variants: [
      { name: 'Normal', style: 'normal', weight: 400 },
      { name: 'Negrita', style: 'normal', weight: 700 },
      { name: 'Cursiva', style: 'italic', weight: 400 },
    ],
  },
  {
    category: 'sans-serif',
    fallback: 'sans-serif',
    family: 'Verdana',
    id: 'verdana',
    isPopular: false,
    name: 'Verdana',
    tags: ['sans', 'sistema', 'ancha', 'legible'],
    variants: [
      { name: 'Normal', style: 'normal', weight: 400 },
      { name: 'Negrita', style: 'normal', weight: 700 },
      { name: 'Cursiva', style: 'italic', weight: 400 },
    ],
  },
  {
    category: 'bold',
    fallback: 'sans-serif',
    family: 'Impact',
    id: 'impact',
    isPopular: false,
    name: 'Impact',
    tags: ['bold', 'display', 'sistema', 'impacto', 'gruesa', 'meme'],
    variants: [
      { name: 'Regular (Ultra Negrita)', style: 'normal', weight: 700 },
    ],
  },
  {
    category: 'handwriting',
    fallback: 'cursive, sans-serif',
    family: 'Comic Sans MS',
    id: 'comic-sans-ms',
    isPopular: false,
    name: 'Comic Sans MS',
    tags: ['handwriting', 'sistema', 'casual', 'infantil', 'comic'],
    variants: [
      { name: 'Normal', style: 'normal', weight: 400 },
      { name: 'Negrita', style: 'normal', weight: 700 },
    ],
  },
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
