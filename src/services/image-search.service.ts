import { logger } from './logger.service.js';
import { config } from '../config/env.config.js';

export interface ImageSearchResult {
  alt?: string;
  author?: string;
  height?: number;
  url: string;
  width?: number;
}

const FALLBACK_CATEGORY_IMAGES: Record<string, string> = {
  ai: 'https://images.unsplash.com/photo-1620712943543-bcc4688e7485?auto=format&fit=crop&w=1200&q=80',
  animals: 'https://images.unsplash.com/photo-1474511320723-9a56873867b5?auto=format&fit=crop&w=1200&q=80',
  architecture: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=1200&q=80',
  art: 'https://images.unsplash.com/photo-1513364776144-60967b0f800f?auto=format&fit=crop&w=1200&q=80',
  business: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1200&q=80',
  city: 'https://images.unsplash.com/photo-1449824913935-59a10b8d2000?auto=format&fit=crop&w=1200&q=80',
  coding: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=1200&q=80',
  creative: 'https://images.unsplash.com/photo-1513364776144-60967b0f800f?auto=format&fit=crop&w=1200&q=80',
  default: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1200&q=80',
  education: 'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?auto=format&fit=crop&w=1200&q=80',
  finance: 'https://images.unsplash.com/photo-1559526324-4b87b5e36e44?auto=format&fit=crop&w=1200&q=80',
  food: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1200&q=80',
  health: 'https://images.unsplash.com/photo-1505751172876-fa1923c5c528?auto=format&fit=crop&w=1200&q=80',
  history: 'https://images.unsplash.com/photo-1461360370896-922624d12aa1?auto=format&fit=crop&w=1200&q=80',
  military: 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&w=1200&q=80',
  music: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=1200&q=80',
  nature: 'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?auto=format&fit=crop&w=1200&q=80',
  ocean: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80',
  people: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=1200&q=80',
  science: 'https://images.unsplash.com/photo-1507668077129-56e32842fceb?auto=format&fit=crop&w=1200&q=80',
  space: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1200&q=80',
  sports: 'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?auto=format&fit=crop&w=1200&q=80',
  technology: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1200&q=80',
  travel: 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&w=1200&q=80',
  war: 'https://images.unsplash.com/photo-1580130775562-0ef92da028de?auto=format&fit=crop&w=1200&q=80',
};

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  ai: ['ai', 'artificial intelligence', 'inteligencia artificial', 'robot', 'robotics', 'neural', 'machine learning'],
  animals: ['animal', 'animals', 'animales', 'wildlife', 'dog', 'cat', 'fauna', 'pet', 'perro', 'gato'],
  architecture: ['architecture', 'arquitectura', 'building', 'edificio', 'construccion', 'construction'],
  art: ['art', 'arte', 'design', 'diseño', 'creative', 'creatividad', 'painting', 'pintura', 'illustration', 'dibujo'],
  business: ['business', 'negocios', 'empresa', 'corporate', 'office', 'oficina', 'meeting', 'reunion', 'startup', 'strategy', 'estrategia', 'executive', 'ejecutivo'],
  city: ['city', 'ciudad', 'urban', 'urbano', 'skyline', 'metropolis', 'calle', 'street'],
  coding: ['code', 'coding', 'codigo', 'software', 'programming', 'programacion', 'developer', 'desarrollo', 'javascript', 'python', 'cybersecurity', 'ciberseguridad'],
  education: ['education', 'educacion', 'learning', 'aprendizaje', 'school', 'escuela', 'student', 'estudiante', 'university', 'universidad', 'book', 'libro', 'study', 'estudio'],
  finance: ['finance', 'finanzas', 'money', 'dinero', 'economy', 'economia', 'investment', 'inversion', 'market', 'mercado', 'crypto', 'banking', 'banco'],
  food: ['food', 'comida', 'gastronomia', 'restaurant', 'restaurante', 'cooking', 'cocina', 'recipe', 'receta', 'culinary'],
  health: ['health', 'salud', 'medical', 'medicina', 'doctor', 'medico', 'wellness', 'bienestar', 'fitness', 'hospital', 'nurse'],
  history: ['history', 'historia', 'historical', 'historico', 'antique', 'antiguo', 'ancient', 'heritage', 'patrimonio', 'century', 'siglo', 'medieval'],
  military: ['military', 'militar', 'army', 'ejercito', 'soldier', 'soldado', 'navy', 'fuerzas armadas'],
  music: ['music', 'musica', 'audio', 'sound', 'sonido', 'concert', 'concierto', 'song', 'cancion', 'band', 'instrument'],
  nature: ['nature', 'naturaleza', 'forest', 'bosque', 'mountain', 'montaña', 'landscape', 'paisaje', 'environment', 'medio ambiente', 'green', 'tree', 'arbol', 'ecologia'],
  ocean: ['ocean', 'oceano', 'sea', 'mar', 'water', 'agua', 'beach', 'playa', 'marine', 'marino'],
  people: ['people', 'personas', 'gente', 'team', 'equipo', 'community', 'comunidad', 'group', 'leadership', 'liderazgo'],
  science: ['science', 'ciencia', 'physics', 'fisica', 'chemistry', 'quimica', 'biology', 'biologia', 'laboratory', 'laboratorio', 'research', 'investigacion'],
  space: ['space', 'espacio', 'universe', 'universo', 'galaxy', 'galaxia', 'astronomy', 'astronomia', 'planet', 'planeta', 'cosmos', 'star', 'estrella', 'nasa'],
  sports: ['sport', 'sports', 'deporte', 'deportes', 'football', 'soccer', 'futbol', 'basketball', 'baloncesto', 'athlete', 'atleta', 'game', 'juego'],
  technology: ['technology', 'tecnologia', 'tech', 'digital', 'computer', 'computadora', 'device', 'gadget', 'hardware', 'telecom'],
  travel: ['travel', 'viaje', 'viajes', 'tourism', 'turismo', 'vacation', 'vacaciones', 'flight', 'vuelo', 'hotel', 'adventure', 'aventura'],
  war: ['war', 'guerra', 'battle', 'batalla', 'conflict', 'conflicto', 'ww2', 'wwii', 'segunda guerra', 'primera guerra', 'world war'],
};

function matchCategory(text: string): string {
  const clean = (text || '').toLowerCase();
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    for (const kw of keywords) {
      if (clean.includes(kw)) {
        return category;
      }
    }
  }
  return 'default';
}

export class ImageSearchService {
  private static cache = new Map<string, string>();

  public static async searchImage(query: string): Promise<string> {
    const cleanQuery = (query || '').trim().toLowerCase();
    if (!cleanQuery) {
      return FALLBACK_CATEGORY_IMAGES.default;
    }

    if (this.cache.has(cleanQuery)) {
      return this.cache.get(cleanQuery)!;
    }

    const pexelsKey = config.pexels?.apiKey || process.env.PEXELS_API_KEY;
    if (pexelsKey) {
      try {
        const pexelsUrl = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=1&orientation=landscape`;
        const res = await fetch(pexelsUrl, {
          headers: { Authorization: pexelsKey },
          signal: AbortSignal.timeout(3500),
        });

        if (res.ok) {
          const data = (await res.json()) as any;
          if (Array.isArray(data.photos) && data.photos.length > 0) {
            const photo = data.photos[0];
            const url = photo.src?.large2x || photo.src?.large || photo.src?.landscape || photo.src?.medium;
            if (url) {
              this.cache.set(cleanQuery, url);
              return url;
            }
          }
        }
      } catch {}
    }

    try {
      const wikiQuery = cleanQuery.replace(/[^\w\s\u00C0-\u024F]/gi, ' ').trim();
      const wikiUrl = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(wikiQuery)}&gsrlimit=5&gsrnamespace=6&prop=imageinfo&iiprop=url&iiurlwidth=800&format=json&origin=*`;
      const wikiRes = await fetch(wikiUrl, {
        headers: { 'User-Agent': 'SpriteboardApp/1.0 (https://spriteboard.com)' },
        signal: AbortSignal.timeout(3500),
      });

      if (wikiRes.ok) {
        const data = (await wikiRes.json()) as any;
        const pages = data?.query?.pages;
        if (pages) {
          for (const k of Object.keys(pages)) {
            const imgInfo = pages[k]?.imageinfo?.[0];
            const url = imgInfo?.thumburl || imgInfo?.url;
            if (url && /\.(jpe?g|png|webp)($|\?)/i.test(url)) {
              this.cache.set(cleanQuery, url);
              return url;
            }
          }
        }
      }
    } catch {}

    const matchedKey = matchCategory(cleanQuery);
    const fallbackUrl = FALLBACK_CATEGORY_IMAGES[matchedKey] || FALLBACK_CATEGORY_IMAGES.default;
    this.cache.set(cleanQuery, fallbackUrl);
    return fallbackUrl;
  }
}
