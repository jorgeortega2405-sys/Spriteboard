import { renderIcons } from '../../services/icon.service.js';
import { getYouTubeEmbedUrl, openYouTubePlayerModal } from '../../services/youtube.service.js';
import { PresentationSlideItem } from '../../types/stage.types.js';
import { worldToScreen } from '../board/board-renderer.js';
import { BoardEmbedElement } from '../board/board.types.js';

export interface StageEmbedHost {
  activeInlineVideoEl: HTMLElement | null;
  activeInlineVideoId: string | null;
  canvas: HTMLCanvasElement | null;
  container: HTMLElement;
  escapeHtml(str: string): string;
  getActiveSlideIndex(): number;
  getSlideCy(idx: number): number;
  panOffset: { x: number; y: number };
  slides: PresentationSlideItem[];
  zoom: number;
}

export class StageEmbedManager {
  private host: StageEmbedHost;

  constructor(host: StageEmbedHost) {
    this.host = host;
  }

  public playEmbedInline(embed: BoardEmbedElement): void {
    if (this.host.activeInlineVideoId === embed.id && this.host.activeInlineVideoEl) {
      return;
    }
    this.closeInlineVideo();

    if (!embed.videoId || embed.embedType !== 'youtube') {
      return;
    }

    const viewport = this.host.container.querySelector<HTMLElement>('[data-ref="presentation-viewport"]');
    if (!viewport || !this.host.canvas) return;

    const overlay = document.createElement('div');
    overlay.className = 'canvas-inline-video-overlay';
    overlay.setAttribute('data-ref', 'canvas-inline-video-overlay');
    overlay.style.position = 'absolute';
    overlay.style.zIndex = '90';
    overlay.style.borderRadius = '12px';
    overlay.style.overflow = 'hidden';
    overlay.style.boxShadow = '0 12px 32px rgba(0, 0, 0, 0.5)';
    overlay.style.background = '#000000';
    overlay.style.pointerEvents = 'auto';
    overlay.style.border = '2px solid #3b82f6';

    const embedUrl = getYouTubeEmbedUrl(embed.videoId, true);

    overlay.innerHTML = `
      <div style="position: absolute; top: 8px; right: 8px; z-index: 10; display: flex; align-items: center; gap: 6px;">
        <button type="button" class="component-button component-button--icon-only" data-ref="btn-inline-video-maximize" style="width: 28px; height: 28px; min-width: 28px; border-radius: 6px; background: rgba(0, 0, 0, 0.75); color: #fff; border: 1px solid rgba(255, 255, 255, 0.2); cursor: pointer; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(4px);" data-tooltip="Abrir en modal" aria-label="Abrir en modal">
          <svg class="component-icon" aria-hidden="true" style="width: 16px; height: 16px;"><use href="/icons.svg#open_in_full"></use></svg>
        </button>
        <button type="button" class="component-button component-button--icon-only" data-ref="btn-inline-video-close" style="width: 28px; height: 28px; min-width: 28px; border-radius: 6px; background: rgba(0, 0, 0, 0.75); color: #fff; border: 1px solid rgba(255, 255, 255, 0.2); cursor: pointer; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(4px);" data-tooltip="Cerrar reproductor" aria-label="Cerrar reproductor">
          <svg class="component-icon" aria-hidden="true" style="width: 16px; height: 16px;"><use href="/icons.svg#close"></use></svg>
        </button>
      </div>
      <iframe
        src="${embedUrl}"
        title="${this.host.escapeHtml(embed.title || 'Video de YouTube')}"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowfullscreen
        referrerpolicy="strict-origin-when-cross-origin"
        style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: 0;"
      ></iframe>
    `;

    const btnClose = overlay.querySelector<HTMLButtonElement>('[data-ref="btn-inline-video-close"]');
    btnClose?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.closeInlineVideo();
    });

    const btnMaximize = overlay.querySelector<HTMLButtonElement>('[data-ref="btn-inline-video-maximize"]');
    btnMaximize?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.closeInlineVideo();
      openYouTubePlayerModal(embed.videoId!, embed.title);
    });

    viewport.appendChild(overlay);
    this.host.activeInlineVideoEl = overlay;
    this.host.activeInlineVideoId = embed.id;
    this.syncInlineVideoPosition();
    renderIcons(overlay);
  }

  public closeInlineVideo(): void {
    if (this.host.activeInlineVideoEl) {
      this.host.activeInlineVideoEl.remove();
      this.host.activeInlineVideoEl = null;
    }
    this.host.activeInlineVideoId = null;
  }

  public syncInlineVideoPosition(): void {
    if (!this.host.activeInlineVideoEl || !this.host.activeInlineVideoId || !this.host.canvas) {
      return;
    }

    const slideIdx = this.host.getActiveSlideIndex();
    const slide = this.host.slides[slideIdx];
    if (!slide) {
      this.closeInlineVideo();
      return;
    }

    const embed = slide.elements.find((el) => el.id === this.host.activeInlineVideoId) as BoardEmbedElement | undefined;
    if (!embed || embed.type !== 'embed') {
      this.closeInlineVideo();
      return;
    }

    const cy = this.host.getSlideCy(slideIdx);
    const camera = { x: this.host.panOffset.x, y: this.host.panOffset.y, zoom: this.host.zoom };
    const screenPos = worldToScreen(embed.x, embed.y + cy, this.host.canvas, camera);
    const screenWidth = Math.round(embed.width * this.host.zoom);
    const screenHeight = Math.round(embed.height * this.host.zoom);

    this.host.activeInlineVideoEl.style.left = `${Math.round(screenPos.x)}px`;
    this.host.activeInlineVideoEl.style.top = `${Math.round(screenPos.y)}px`;
    this.host.activeInlineVideoEl.style.width = `${screenWidth}px`;
    this.host.activeInlineVideoEl.style.height = `${screenHeight}px`;
    if (embed.rotation) {
      this.host.activeInlineVideoEl.style.transform = `rotate(${embed.rotation}deg)`;
      this.host.activeInlineVideoEl.style.transformOrigin = 'center center';
    } else {
      this.host.activeInlineVideoEl.style.transform = '';
    }
  }
}
