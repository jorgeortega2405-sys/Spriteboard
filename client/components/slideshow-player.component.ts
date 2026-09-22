import { escapeHtml } from '../services/api.service.js';
import { PresentationSlideItem } from '../types/presentation.types.js';
import { BoardElement, BoardSectionElement } from '../views/board/board.types.js';

export interface SlideshowPlayerOptions {
  activePageId?: string;
  drawElementOn: (ctx: CanvasRenderingContext2D, el: BoardElement, elapsedMs?: number, index?: number, slideDurationMs?: number) => void;
  onSlideChange?: (pageId: string, index: number) => void;
  pages: PresentationSlideItem[];
  slideHeight?: number;
  slideWidth?: number;
  title: string;
}

export class SlideshowPlayerComponent {
  private activePageId: string;
  private autoPlay = false;
  private currentIndex = 0;
  private drawElementOn: (ctx: CanvasRenderingContext2D, el: BoardElement, elapsedMs?: number, index?: number, slideDurationMs?: number) => void;
  private isActive = false;
  private onSlideChange?: (pageId: string, index: number) => void;
  private overlay: HTMLElement | null = null;
  private pages: PresentationSlideItem[];
  private progressRaf: number | null = null;
  private slideHeight: number;
  private slideStartTime = 0;
  private slideWidth: number;
  private title: string;

  constructor(options: SlideshowPlayerOptions) {
    this.pages = options.pages || [];
    this.activePageId = options.activePageId || (this.pages[0]?.id || '');
    this.title = options.title || 'Presentación';
    this.slideWidth = options.slideWidth || 1280;
    this.slideHeight = options.slideHeight || 720;
    this.drawElementOn = options.drawElementOn;
    this.onSlideChange = options.onSlideChange;
  }

  public start(): void {
    if (this.isActive || this.pages.length === 0) return;
    this.isActive = true;

    this.currentIndex = this.pages.findIndex((p) => p.id === this.activePageId);
    if (this.currentIndex === -1) this.currentIndex = 0;

    const totalSlides = this.pages.length;
    const overlay = document.createElement('div');
    this.overlay = overlay;
    overlay.className = 'doc-slideshow-overlay';
    overlay.setAttribute('data-ref', 'board-slideshow-overlay');

    overlay.innerHTML = `
      <div class="doc-slideshow__bar" data-ref="slideshow-bar">
        <div class="doc-slideshow__bar-left">
          <span class="doc-slideshow__title">${escapeHtml(this.title)}</span>
        </div>
        <div class="doc-slideshow__bar-center">
          <button type="button" class="doc-slideshow__nav-btn" data-ref="btn-slideshow-prev" data-tooltip="Anterior (←)" aria-label="Diapositiva anterior">
            <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#arrow_back"></use></svg>
          </button>
          <span class="doc-slideshow__counter" data-ref="slideshow-counter">${this.currentIndex + 1} / ${totalSlides}</span>
          <button type="button" class="doc-slideshow__nav-btn" data-ref="btn-slideshow-next" data-tooltip="Siguiente (→)" aria-label="Siguiente diapositiva">
            <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#arrow_forward"></use></svg>
          </button>
          <div style="width: 1px; height: 16px; background: rgba(255,255,255,0.15); margin: 0 4px;"></div>
          <button type="button" class="doc-slideshow__nav-btn" data-ref="btn-slideshow-play" data-tooltip="Reproducir automáticamente" aria-label="Reproducción automática">
            <svg class="component-icon icon-play" aria-hidden="true"><use href="/icons.svg#play_arrow"></use></svg>
            <svg class="component-icon icon-pause is-hidden" aria-hidden="true"><use href="/icons.svg#pause"></use></svg>
          </button>
        </div>
        <div class="doc-slideshow__bar-right">
          <button type="button" class="doc-slideshow__nav-btn" data-ref="btn-slideshow-fullscreen" data-tooltip="Pantalla completa (F)" aria-label="Pantalla completa">
            <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#fullscreen"></use></svg>
          </button>
          <button type="button" class="doc-slideshow__nav-btn doc-slideshow__nav-btn--close" data-ref="btn-slideshow-close" data-tooltip="Salir (Esc)" aria-label="Salir de presentación">
            <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#close"></use></svg>
          </button>
        </div>
      </div>
      <div class="doc-slideshow__progress-track" style="position: absolute; top: 56px; left: 0; right: 0; height: 3px; background: rgba(255, 255, 255, 0.08); z-index: 20;">
        <div class="doc-slideshow__progress-fill" data-ref="slideshow-progress-fill" style="width: 0%; height: 100%; background: #38bdf8; transition: width 0.05s linear;"></div>
      </div>
      <div class="doc-slideshow__stage" data-ref="slideshow-stage">
        <div class="doc-slideshow__viewport" data-ref="slideshow-viewport">
          <canvas class="board-slideshow__canvas" data-ref="slideshow-canvas" width="${this.slideWidth}" height="${this.slideHeight}"></canvas>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    document.body.classList.add('slideshow-active');

    const counterEl = overlay.querySelector<HTMLElement>('[data-ref="slideshow-counter"]');
    const slideCanvas = overlay.querySelector<HTMLCanvasElement>('[data-ref="slideshow-canvas"]');
    const viewportEl = overlay.querySelector<HTMLElement>('[data-ref="slideshow-viewport"]');
    const stageEl = overlay.querySelector<HTMLElement>('[data-ref="slideshow-stage"]');
    const btnPrev = overlay.querySelector<HTMLElement>('[data-ref="btn-slideshow-prev"]');
    const btnNext = overlay.querySelector<HTMLElement>('[data-ref="btn-slideshow-next"]');
    const btnPlay = overlay.querySelector<HTMLElement>('[data-ref="btn-slideshow-play"]');
    const iconPlay = overlay.querySelector<HTMLElement>('.icon-play');
    const iconPause = overlay.querySelector<HTMLElement>('.icon-pause');
    const progressFillEl = overlay.querySelector<HTMLElement>('[data-ref="slideshow-progress-fill"]');
    const btnFullscreen = overlay.querySelector<HTMLElement>('[data-ref="btn-slideshow-fullscreen"]');
    const btnClose = overlay.querySelector<HTMLElement>('[data-ref="btn-slideshow-close"]');

    this.autoPlay = false;
    this.slideStartTime = performance.now();

    const updatePlayPauseIcons = () => {
      iconPlay?.classList.toggle('is-hidden', this.autoPlay);
      iconPause?.classList.toggle('is-hidden', !this.autoPlay);
    };

    const renderSlide = (index: number, elapsedMs = 0, slideDurationMs = 5000) => {
      if (!slideCanvas) return;
      const sctx = slideCanvas.getContext('2d');
      if (!sctx) return;

      const page = this.pages[index];
      if (!page) return;

      if (counterEl) {
        counterEl.textContent = `${index + 1} / ${this.pages.length}`;
      }
      if (btnPrev) btnPrev.classList.toggle('is-disabled', index === 0);
      if (btnNext) btnNext.classList.toggle('is-disabled', index === this.pages.length - 1);

      sctx.clearRect(0, 0, this.slideWidth, this.slideHeight);

      sctx.fillStyle = page.background?.color || '#ffffff';
      sctx.fillRect(0, 0, this.slideWidth, this.slideHeight);

      sctx.save();
      sctx.translate(this.slideWidth / 2, this.slideHeight / 2);

      const elements = page.elements || [];
      const sections = elements.filter((e) => e.type === 'section') as BoardSectionElement[];

      for (let i = 0; i < elements.length; i++) {
        const el = elements[i];
        if (el.type !== 'section') continue;
        this.drawElementOn(sctx, el, elapsedMs, i, slideDurationMs);
      }

      for (let i = 0; i < elements.length; i++) {
        const el = elements[i];
        if (el.type === 'section') continue;

        const elX = 'x' in el ? (el as any).x : 0;
        const elY = 'y' in el ? (el as any).y : 0;
        const elW = 'width' in el ? (el as any).width : 0;
        const elH = 'height' in el ? (el as any).height : 0;
        const parentSection = el.type !== 'stroke' ? sections.find(
          (s) =>
            elX >= s.x &&
            elY >= s.y &&
            elX + elW <= s.x + s.width &&
            elY + elH <= s.y + s.height
        ) : undefined;

        if (parentSection) {
          sctx.save();
          sctx.beginPath();
          sctx.rect(parentSection.x, parentSection.y, parentSection.width, parentSection.height);
          sctx.clip();
          this.drawElementOn(sctx, el, elapsedMs, i, slideDurationMs);
          sctx.restore();
        } else {
          this.drawElementOn(sctx, el, elapsedMs, i, slideDurationMs);
        }
      }

      sctx.restore();
      if (this.onSlideChange && page.id) {
        this.onSlideChange(page.id, index);
      }
    };

    const runSlideshowLoop = () => {
      if (!this.isActive) return;
      const now = performance.now();
      const currentPage = this.pages[this.currentIndex];
      const durationSec = currentPage && currentPage.duration !== undefined ? currentPage.duration : 5.0;
      const durationMs = Math.max(500, durationSec * 1000);

      const elapsed = now - this.slideStartTime;

      if (this.autoPlay) {
        const progressPct = Math.min(100, (elapsed / durationMs) * 100);
        if (progressFillEl) {
          progressFillEl.style.width = `${progressPct}%`;
        }

        if (elapsed >= durationMs) {
          if (this.currentIndex < this.pages.length - 1) {
            this.currentIndex++;
            this.slideStartTime = performance.now();
          } else {
            this.currentIndex = 0;
            this.slideStartTime = performance.now();
          }
        }
      }

      renderSlide(this.currentIndex, elapsed, durationMs);
      this.progressRaf = requestAnimationFrame(runSlideshowLoop);
    };

    const togglePlay = () => {
      this.autoPlay = !this.autoPlay;
      updatePlayPauseIcons();
      if (!this.autoPlay && progressFillEl) {
        progressFillEl.style.width = '0%';
      }
      this.slideStartTime = performance.now();
    };

    btnPlay?.addEventListener('click', (e) => {
      e.stopPropagation();
      togglePlay();
    });

    const updateScale = () => {
      if (!viewportEl) return;
      const stageW = window.innerWidth;
      const stageH = window.innerHeight - 56;
      const availW = Math.max(100, stageW - 48);
      const availH = Math.max(100, stageH - 48);
      const scaleX = availW / this.slideWidth;
      const scaleY = availH / this.slideHeight;
      const fitScale = Math.min(scaleX, scaleY, 1.5);
      viewportEl.style.transform = `scale(${fitScale})`;
      viewportEl.style.transformOrigin = 'center center';
    };

    updateScale();
    this.progressRaf = requestAnimationFrame(runSlideshowLoop);

    const handleResize = () => updateScale();
    window.addEventListener('resize', handleResize);

    const closeSlideshow = () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('keydown', handleKey);
      if (this.progressRaf) {
        cancelAnimationFrame(this.progressRaf);
        this.progressRaf = null;
      }
      if (document.fullscreenElement) {
        document.exitFullscreen?.().catch(() => {});
      }
      this.autoPlay = false;
      overlay.remove();
      this.overlay = null;
      this.isActive = false;
      document.body.classList.remove('slideshow-active');
    };

    const nextSlide = () => {
      if (this.currentIndex < this.pages.length - 1) {
        this.currentIndex++;
        this.slideStartTime = performance.now();
        if (!this.autoPlay && progressFillEl) progressFillEl.style.width = '0%';
      }
    };

    const prevSlide = () => {
      if (this.currentIndex > 0) {
        this.currentIndex--;
        this.slideStartTime = performance.now();
        if (!this.autoPlay && progressFillEl) progressFillEl.style.width = '0%';
      }
    };

    btnNext?.addEventListener('click', (e) => {
      e.stopPropagation();
      nextSlide();
    });
    btnPrev?.addEventListener('click', (e) => {
      e.stopPropagation();
      prevSlide();
    });

    stageEl?.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (target.closest('button')) return;
      const clickX = e.clientX;
      if (clickX < window.innerWidth * 0.3) {
        prevSlide();
      } else {
        nextSlide();
      }
    });

    btnFullscreen?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!document.fullscreenElement) {
        overlay.requestFullscreen?.().catch(() => {});
      } else {
        document.exitFullscreen?.().catch(() => {});
      }
    });

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeSlideshow();
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === 'PageDown') {
        e.preventDefault();
        nextSlide();
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp' || e.key === 'PageUp') {
        e.preventDefault();
        prevSlide();
      } else if (e.key === ' ') {
        e.preventDefault();
        togglePlay();
      } else if (e.key === 'Home') {
        e.preventDefault();
        this.currentIndex = 0;
        this.slideStartTime = performance.now();
      } else if (e.key === 'End') {
        e.preventDefault();
        this.currentIndex = this.pages.length - 1;
        this.slideStartTime = performance.now();
      } else if (e.key.toLowerCase() === 'f') {
        if (!document.fullscreenElement) {
          overlay.requestFullscreen?.().catch(() => {});
        } else {
          document.exitFullscreen?.().catch(() => {});
        }
      }
    };

    btnClose?.addEventListener('click', closeSlideshow);
    window.addEventListener('keydown', handleKey);
  }

  public close(): void {
    if (!this.isActive || !this.overlay) return;
    if (this.progressRaf) {
      cancelAnimationFrame(this.progressRaf);
      this.progressRaf = null;
    }
    if (document.fullscreenElement) {
      document.exitFullscreen?.().catch(() => {});
    }
    this.autoPlay = false;
    this.overlay.remove();
    this.overlay = null;
    this.isActive = false;
    document.body.classList.remove('slideshow-active');
  }

  public destroy(): void {
    this.close();
  }
}
