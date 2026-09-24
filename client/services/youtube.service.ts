import { escapeHtml } from './api.service.js';
import { renderIcons } from './icon.service.js';
import { showToast } from './toast.service.js';

export const YOUTUBE_API_KEY = 'AIzaSyBO-93FVTgkW4mUKE03-_zsjerzoX0GXTA';

export interface YouTubeVideoItem {
  channelTitle: string;
  description: string;
  id: string;
  publishedAt: string;
  thumbnailUrl: string;
  title: string;
  url: string;
}

function decodeHtmlEntities(text: string): string {
  if (!text) return '';
  const doc = new DOMParser().parseFromString(text, 'text/html');
  return doc.documentElement.textContent || text;
}

export async function searchYouTubeVideos(query: string, maxResults = 16): Promise<YouTubeVideoItem[]> {
  const cleanQ = query.trim();
  if (!cleanQ) return [];

  const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=${maxResults}&q=${encodeURIComponent(cleanQ)}&key=${YOUTUBE_API_KEY}`;

  try {
    const res = await fetch(url);
    if (!res.ok) {
      showToast('Error al buscar videos en YouTube. Verifica tu conexión.', 'danger');
      return [];
    }

    const data = await res.json();
    if (!data?.items || !Array.isArray(data.items)) {
      return [];
    }

    return data.items
      .filter((item: any) => item?.id?.videoId)
      .map((item: any) => {
        const videoId = item.id.videoId;
        const snip = item.snippet || {};
        const thumb =
          snip.thumbnails?.high?.url ||
          snip.thumbnails?.medium?.url ||
          snip.thumbnails?.default?.url ||
          `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

        return {
          channelTitle: decodeHtmlEntities(snip.channelTitle || 'YouTube'),
          description: decodeHtmlEntities(snip.description || ''),
          id: videoId,
          publishedAt: snip.publishedAt || '',
          thumbnailUrl: thumb,
          title: decodeHtmlEntities(snip.title || 'Video de YouTube'),
          url: `https://www.youtube.com/watch?v=${videoId}`,
        };
      });
  } catch {
    showToast('Error de red al consultar la API de YouTube', 'danger');
    return [];
  }
}

export function getYouTubeEmbedUrl(videoId: string, autoplay = true): string {
  return `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=${autoplay ? 1 : 0}&rel=0&modestbranding=1`;
}

export function openYouTubePlayerModal(videoId: string, title = 'Video de YouTube'): void {
  const embedUrl = getYouTubeEmbedUrl(videoId, true);

  const existingBackdrop = document.querySelector<HTMLElement>('[data-ref="youtube-player-backdrop"]');
  existingBackdrop?.remove();

  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop is-visible';
  backdrop.setAttribute('data-ref', 'youtube-player-backdrop');
  backdrop.style.zIndex = '99999';

  backdrop.innerHTML = `
    <div class="modal-container modal-container--video" data-ref="youtube-player-container" style="max-width: 840px; width: 92%; position: relative;">
      <button type="button" class="modal-close-btn" data-ref="btn-close-youtube-player" aria-label="Cerrar reproductor">
        <svg class="component-icon" aria-hidden="true" style="width: 20px; height: 20px;"><use href="/icons.svg#close"></use></svg>
      </button>
      <div class="modal-card" data-ref="youtube-player-card" style="padding: 0; overflow: hidden; background: #0f172a; border-radius: 16px; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7); width: 100%;">
        <div style="padding: 14px 18px; display: flex; align-items: center; justify-content: space-between; background: #020617; border-bottom: 1px solid rgba(255, 255, 255, 0.08);">
          <div style="display: flex; align-items: center; gap: 10px; overflow: hidden;">
            <svg viewBox="0 0 24 24" aria-hidden="true" style="width: 22px; height: 22px; fill: #ef4444; flex-shrink: 0;"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
            <span style="font-size: 13.5px; font-weight: 600; color: #f8fafc; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(title)}</span>
          </div>
        </div>
        <div style="position: relative; width: 100%; padding-bottom: 56.25%; height: 0; background: #000000;">
          <iframe
            src="${embedUrl}"
            title="${escapeHtml(title)}"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowfullscreen
            style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: 0;"
          ></iframe>
        </div>
      </div>
    </div>
  `;

  const close = () => {
    backdrop.remove();
    document.removeEventListener('keydown', handleEsc);
  };

  const handleEsc = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      close();
    }
  };

  document.addEventListener('keydown', handleEsc);

  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) {
      close();
    }
  });

  const btnClose = backdrop.querySelector<HTMLButtonElement>('[data-ref="btn-close-youtube-player"]');
  btnClose?.addEventListener('click', (e) => {
    e.stopPropagation();
    close();
  });

  renderIcons(backdrop);
  document.body.appendChild(backdrop);
}
