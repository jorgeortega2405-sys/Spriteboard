import { getActiveCanvasController, getActiveCanvasType, toggleDrawer, updateCanvasRailActiveState } from '../../components/layout.component.js';
import { escapeHtml } from '../../services/api.service.js';
import { renderIcons } from '../../services/icon.service.js';
import { showToast } from '../../services/toast.service.js';
import { openYouTubePlayerModal, searchYouTubeVideos } from '../../services/youtube.service.js';
import { AppPlugin, AppPluginContext } from '../plugin.types.js';

export class YouTubePlugin implements AppPlugin {
  public readonly id = 'youtube';

  public render(ctx: AppPluginContext): void {
    const { drawer, drawerBody, onBack, onClose } = ctx;
    const sidebar = drawer.closest<HTMLElement>('[data-ref="sidebar"]') || document.querySelector<HTMLElement>('[data-ref="sidebar"]');

    drawerBody.innerHTML = `
      <div class="canvas-panel-card" data-ref="canvas-panel-card">
        <div class="canvas-panel-card__header" data-ref="canvas-panel-header">
          <div class="canvas-panel-card__title-box" data-ref="canvas-panel-title-box">
            <svg class="component-icon canvas-panel-card__icon" aria-hidden="true"><use href="/icons.svg#youtube_colored"></use></svg>
            <span class="canvas-panel-card__title" data-ref="canvas-panel-title">YouTube Embed</span>
          </div>
          <button type="button" class="component-button component-button--h32 component-button--icon-only rail-btn canvas-panel-card__close" data-ref="btn-close-canvas-panel" data-tooltip="Cerrar panel" aria-label="Cerrar panel">
            <svg class="component-icon rail-btn__icon" aria-hidden="true"><use href="/icons.svg#close"></use></svg>
          </button>
        </div>
        <div class="canvas-panel-card__body youtube-drawer-body" data-ref="canvas-panel-body">
          <button type="button" class="elements-back-btn" data-ref="btn-apps-back" style="margin-bottom: 12px;">
            <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#arrow_back"></use></svg>
            <span>Volver a Apps</span>
          </button>

          <div class="menu-panel__search" data-ref="youtube-search-wrapper">
            <svg class="component-icon menu-panel__search-icon" aria-hidden="true"><use href="/icons.svg#search"></use></svg>
            <input class="menu-panel__search-input" data-ref="youtube-search-input" type="text" maxlength="80" autocomplete="off" placeholder="Buscar en YouTube..." />
          </div>

          <div class="youtube-chips-row" data-ref="youtube-chips">
            <button type="button" class="mockup-category-pill" data-ref="chip-yt-spriteboard" data-query="Spriteboard">Spriteboard</button>
            <button type="button" class="mockup-category-pill" data-ref="chip-yt-tutorial" data-query="Diseño tutorial">Tutorial</button>
            <button type="button" class="mockup-category-pill" data-ref="chip-yt-music" data-query="Musica lofi">Música</button>
            <button type="button" class="mockup-category-pill" data-ref="chip-yt-pixel" data-query="Pixel art speedpaint">Pixel Art</button>
            <button type="button" class="mockup-category-pill" data-ref="chip-yt-animation" data-query="2D Animation">Animación</button>
          </div>

          <div class="youtube-results-container" data-ref="youtube-results-container">
            <div class="youtube-initial-state" data-ref="youtube-initial-state">
              <div class="youtube-initial-icon" data-ref="youtube-initial-icon">
                <svg class="component-icon" aria-hidden="true" style="width: 44px; height: 44px;"><use href="/icons.svg#youtube_colored"></use></svg>
              </div>
              <span class="youtube-initial-title" data-ref="youtube-initial-title">Busca videos en YouTube</span>
              <span class="youtube-initial-desc" data-ref="youtube-initial-desc">Escribe en el buscador o pulsa una sugerencia para encontrar e insertar videos en tu lienzo.</span>
            </div>
          </div>
        </div>
      </div>
    `;

    const btnBack = drawerBody.querySelector<HTMLButtonElement>('[data-ref="btn-apps-back"]');
    btnBack?.addEventListener('click', () => {
      onBack();
    });

    const btnClose = drawerBody.querySelector<HTMLElement>('[data-ref="btn-close-canvas-panel"]');
    btnClose?.addEventListener('click', (e) => {
      e.preventDefault();
      onClose();
    });

    const searchInput = drawerBody.querySelector<HTMLInputElement>('[data-ref="youtube-search-input"]');
    const resultsContainer = drawerBody.querySelector<HTMLElement>('[data-ref="youtube-results-container"]');

    let debounceTimer: number | null = null;

    const performSearch = async (query: string) => {
      if (!resultsContainer) return;
      const cleanQ = query.trim();
      if (!cleanQ) {
        resultsContainer.innerHTML = `
          <div class="youtube-initial-state" data-ref="youtube-initial-state">
            <div class="youtube-initial-icon" data-ref="youtube-initial-icon">
              <svg class="component-icon" aria-hidden="true" style="width: 44px; height: 44px;"><use href="/icons.svg#youtube_colored"></use></svg>
            </div>
            <span class="youtube-initial-title" data-ref="youtube-initial-title">Busca videos en YouTube</span>
            <span class="youtube-initial-desc" data-ref="youtube-initial-desc">Escribe en el buscador o pulsa una sugerencia para encontrar e insertar videos en tu lienzo.</span>
          </div>
        `;
        return;
      }

      resultsContainer.innerHTML = `
        <div class="youtube-loading-state" data-ref="youtube-loading-state">
          <div class="component-spinner" style="width: 28px; height: 28px; border-width: 3px; border-color: #ef4444; border-top-color: transparent;"></div>
          <span style="font-size: 13px; color: var(--text-secondary);">Buscando en YouTube...</span>
        </div>
      `;

      const videos = await searchYouTubeVideos(cleanQ);

      if (videos.length === 0) {
        resultsContainer.innerHTML = `
          <div class="mockup-empty-state" data-ref="youtube-empty">
            No se encontraron videos para «${escapeHtml(cleanQ)}». Intenta con otra búsqueda.
          </div>
        `;
        return;
      }

      resultsContainer.innerHTML = `
        <div class="youtube-results-grid" data-ref="youtube-results-grid">
          ${videos.map((v) => `
            <div class="youtube-video-card" data-ref="youtube-video-card-${v.id}" data-video-id="${v.id}">
              <div class="youtube-video-card__thumb-box" data-ref="youtube-thumb-box-${v.id}">
                <img class="youtube-video-card__img" data-ref="youtube-img-${v.id}" src="${v.thumbnailUrl}" alt="${escapeHtml(v.title)}" loading="lazy" />
                <div class="youtube-video-card__overlay" data-ref="youtube-overlay-${v.id}">
                  <button type="button" class="youtube-video-card__play-btn" data-ref="btn-preview-yt-${v.id}" data-tooltip="Previsualizar video" aria-label="Previsualizar">
                    <svg class="component-icon" aria-hidden="true" style="width: 20px; height: 20px;"><use href="/icons.svg#play_arrow"></use></svg>
                  </button>
                </div>
              </div>
              <div class="youtube-video-card__info" data-ref="youtube-info-${v.id}">
                <span class="youtube-video-card__title" data-ref="youtube-title-${v.id}" title="${escapeHtml(v.title)}">${escapeHtml(v.title)}</span>
                <span class="youtube-video-card__channel" data-ref="youtube-channel-${v.id}">${escapeHtml(v.channelTitle)}</span>
              </div>
            </div>
          `).join('')}
        </div>
      `;

      resultsContainer.querySelectorAll<HTMLElement>('.youtube-video-card').forEach((card) => {
        const vidId = card.getAttribute('data-video-id');
        const item = videos.find((v) => v.id === vidId);
        if (!item) return;

        const previewBtn = card.querySelector<HTMLButtonElement>(`[data-ref="btn-preview-yt-${item.id}"]`);
        previewBtn?.addEventListener('click', (e) => {
          e.stopPropagation();
          openYouTubePlayerModal(item.id, item.title);
        });

        card.addEventListener('click', () => {
          const canvasType = getActiveCanvasType();
          const controller = getActiveCanvasController();

          if (canvasType === 'doc') {
            if (!controller) {
              showToast('No se encontró el controlador del documento', 'warning');
              return;
            }
            if (typeof controller.insertYouTubeEmbed === 'function') {
              controller.insertYouTubeEmbed(item.id, item.title);
            } else {
              showToast('No se pudo insertar el video en el documento', 'warning');
            }
          } else if (canvasType === 'presentation') {
            if (!controller) {
              showToast('No se encontró el controlador de la presentación', 'warning');
              return;
            }
            if (typeof controller.insertYouTube === 'function') {
              controller.insertYouTube(item);
            }
          } else {
            if (!controller) {
              showToast('No se encontró el controlador del lienzo', 'warning');
              return;
            }
            if (typeof controller.insertYouTube === 'function') {
              controller.insertYouTube(item);
            }
          }

          if (window.innerWidth <= 768) {
            toggleDrawer(false);
          }
        });
      });

      renderIcons(resultsContainer);
    };

    searchInput?.addEventListener('input', () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = window.setTimeout(() => {
        void performSearch(searchInput.value);
      }, 450);
    });

    drawerBody.querySelectorAll<HTMLButtonElement>('[data-query]').forEach((chip) => {
      chip.addEventListener('click', () => {
        const q = chip.getAttribute('data-query');
        if (q && searchInput) {
          searchInput.value = q;
          void performSearch(q);
        }
      });
    });

    if (sidebar) {
      updateCanvasRailActiveState(sidebar);
    }
    renderIcons(drawerBody);
  }
}

export const youtubePlugin = new YouTubePlugin();
