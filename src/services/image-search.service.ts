import { config } from '../config/env.config.js';
import { logger } from './logger.service.js';

export interface ImageSearchResult {
  alt?: string;
  author?: string;
  height?: number;
  url: string;
  width?: number;
}

const FALLBACK_CATEGORY_IMAGES: Record<string, string> = {
  architecture: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=1200&q=80',
  art: 'https://images.unsplash.com/photo-1513364776144-60967b0f800f?auto=format&fit=crop&w=1200&q=80',
  business: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1200&q=80',
  creative: 'https://images.unsplash.com/photo-1513364776144-60967b0f800f?auto=format&fit=crop&w=1200&q=80',
  default: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1200&q=80',
  education: 'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?auto=format&fit=crop&w=1200&q=80',
  finance: 'https://images.unsplash.com/photo-1559526324-4b87b5e36e44?auto=format&fit=crop&w=1200&q=80',
  health: 'https://images.unsplash.com/photo-1505751172876-fa1923c5c528?auto=format&fit=crop&w=1200&q=80',
  history: 'https://images.unsplash.com/photo-1461360370896-922624d12aa1?auto=format&fit=crop&w=1200&q=80',
  nature: 'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?auto=format&fit=crop&w=1200&q=80',
  people: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=1200&q=80',
  science: 'https://images.unsplash.com/photo-1507668077129-56e32842fceb?auto=format&fit=crop&w=1200&q=80',
  space: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1200&q=80',
  technology: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1200&q=80',
  war: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?auto=format&fit=crop&w=1200&q=80',
};

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
        } else {
          logger.app.warn(`ImageSearchService: Pexels API retornó status ${res.status} para query "${query}"`);
        }
      } catch (err: any) {
        logger.app.warn('ImageSearchService: Fallo al consultar Pexels API', { error: err.message });
      }
    }

    try {
      const wikiUrl = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(query)}&gsrlimit=3&gsrnamespace=6&prop=imageinfo&iiprop=url&format=json&origin=*`;
      const wikiRes = await fetch(wikiUrl, {
        headers: { 'User-Agent': 'SpriteboardApp/1.0 (https://spriteboard.com)' },
      });

      if (wikiRes.ok) {
        const data = (await wikiRes.json()) as any;
        const pages = data?.query?.pages;
        if (pages) {
          for (const k of Object.keys(pages)) {
            const imgInfo = pages[k]?.imageinfo?.[0];
            const url = imgInfo?.url;
            if (url && (url.endsWith('.jpg') || url.endsWith('.jpeg') || url.endsWith('.png') || url.endsWith('.webp'))) {
              this.cache.set(cleanQuery, url);
              return url;
            }
          }
        }
      }
    } catch {}

    const matchedKey = Object.keys(FALLBACK_CATEGORY_IMAGES).find((k) => cleanQuery.includes(k)) || 'default';
    const fallbackUrl = FALLBACK_CATEGORY_IMAGES[matchedKey] || FALLBACK_CATEGORY_IMAGES.default;
    this.cache.set(cleanQuery, fallbackUrl);
    return fallbackUrl;
  }
}
