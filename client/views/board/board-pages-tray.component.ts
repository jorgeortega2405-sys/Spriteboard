import { generateThumbnail } from '../../engine-2d/export.service.js';
import { escapeHtml } from '../../services/api.service.js';
import { renderIcons } from '../../services/icon.service.js';
import { CanvasPageType } from '../../types/stage.types.js';
import { CarouselController, initCarouselScroll } from '../../utils/dom.util.js';
import { BoardPageItem } from './board.types.js';

export interface BoardPagesTrayCallbacks {
  onAddPage: () => void;
  onAddPageWithType?: (type: CanvasPageType) => void;
  onDeletePage?: () => void;
  onDrawElement?: (ctx: CanvasRenderingContext2D, el: any) => void;
  onDuplicatePage?: () => void;
  onNextPage?: () => void;
  onPrevPage?: () => void;
  onReorderPages: (fromIndex: number, toIndex: number) => void;
  onSelectPage: (pageId: string) => void;
}

export const MAX_BOARD_PAGES = 50;

export class BoardPagesTrayComponent {
  private abortController: AbortController | null = null;
  private activePageId = '';
  private callbacks: BoardPagesTrayCallbacks;
  private carouselController: CarouselController | null = null;
  private containerEl: HTMLElement | null = null;
  private draggedPageId: string | null = null;
  private pages: BoardPageItem[] = [];
  private pagesCardsListEl: HTMLElement | null = null;
  private pagesCardsWrapper: HTMLElement | null = null;
  private trayEl: HTMLElement | null = null;

  constructor(callbacks: BoardPagesTrayCallbacks) {
    this.callbacks = callbacks;
  }

  public attach(containerEl: HTMLElement, pages: BoardPageItem[], activePageId: string): void {
    this.containerEl = containerEl;
    this.pages = pages;
    this.activePageId = activePageId;

    this.queryDOMElements();
    this.bindEvents();
    this.sync(pages, activePageId);
  }

  public sync(pages: BoardPageItem[], activePageId: string): void {
    this.pages = pages;
    this.activePageId = activePageId;

    if (!this.containerEl) return;

    this.updateControlsUI();
    this.renderPagesCards();
    this.carouselController?.updateButtons();
  }

  public show(): void {
    if (this.trayEl) {
      this.trayEl.classList.remove('is-hidden');
    }
    this.sync(this.pages, this.activePageId);
  }

  public hide(): void {
    if (this.trayEl) {
      this.trayEl.classList.add('is-hidden');
    }
  }

  public toggle(): void {
    if (this.isVisible()) {
      this.hide();
    } else {
      this.show();
    }
  }

  public isVisible(): boolean {
    return !!this.trayEl && !this.trayEl.classList.contains('is-hidden');
  }

  public destroy(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    this.containerEl = null;
    this.pages = [];
    this.activePageId = '';
  }

  private queryDOMElements(): void {
    if (!this.containerEl) return;

    this.trayEl = this.containerEl.querySelector<HTMLElement>('[data-ref="design-pages-tray"]');
    this.pagesCardsWrapper = this.containerEl.querySelector<HTMLElement>('[data-ref="pages-cards-wrapper"]');
    this.pagesCardsListEl = this.containerEl.querySelector<HTMLElement>('[data-ref="pages-cards-list"]');

    if (this.pagesCardsWrapper) {
      this.carouselController = initCarouselScroll(this.pagesCardsWrapper, {
        carouselSelector: '[data-ref="pages-cards-list"]',
        leftBtnSelector: '[data-ref="btn-pages-tray-scroll-left"]',
        rightBtnSelector: '[data-ref="btn-pages-tray-scroll-right"]',
        step: 180,
      });
    }
  }

  private bindEvents(): void {
    if (this.abortController) {
      this.abortController.abort();
    }
    this.abortController = new AbortController();
  }

  private updateControlsUI(): void {
    const pagesText = this.containerEl?.querySelector<HTMLElement>('[data-ref="bottom-pages-text"]');
    const activeIdx = this.pages.findIndex((p) => p.id === this.activePageId);
    if (pagesText) {
      pagesText.textContent = `${activeIdx >= 0 ? activeIdx + 1 : 1} / ${this.pages.length}`;
    }
  }

  private renderPagesCards(): void {
    if (!this.pagesCardsListEl) return;
    this.pagesCardsListEl.innerHTML = '';

    const totalPages = this.pages.length;

    this.pages.forEach((page, index) => {
      const defaultName = `Página ${index + 1}`;
      const card = document.createElement('div');
      card.className = `canva-page-card${page.id === this.activePageId ? ' is-active' : ''}`;
      card.setAttribute('data-ref', `page-card-${page.id}`);
      card.setAttribute('draggable', 'true');
      card.setAttribute('data-tooltip', page.name || defaultName);

      const thumbUrl = generateThumbnail(page.elements || [], page.background || { color: '#ffffff', type: 'solid' }, this.callbacks.onDrawElement);

      card.innerHTML = `
        <div class="canva-page-card__preview" data-ref="page-preview-${page.id}">
          <img src="${thumbUrl}" alt="${escapeHtml(page.name || defaultName)}" loading="lazy" />
        </div>
        <div class="canva-page-card__footer">
          <span class="canva-page-card__num">${index + 1}</span>
        </div>
      `;

      card.addEventListener('click', () => {
        if (page.id !== this.activePageId) {
          this.callbacks.onSelectPage(page.id);
        }
      });

      card.addEventListener('dragstart', (e: DragEvent) => {
        this.draggedPageId = page.id;
        card.classList.add('is-dragging');
        if (e.dataTransfer) {
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('text/plain', page.id);
        }
      });

      card.addEventListener('dragend', () => {
        card.classList.remove('is-dragging');
        this.draggedPageId = null;
        this.containerEl?.querySelectorAll('.canva-page-card').forEach((el) => {
          el.classList.remove('is-drag-over');
        });
      });

      card.addEventListener('dragover', (e: DragEvent) => {
        e.preventDefault();
        if (e.dataTransfer) {
          e.dataTransfer.dropEffect = 'move';
        }
        if (this.draggedPageId && this.draggedPageId !== page.id) {
          card.classList.add('is-drag-over');
        }
      });

      card.addEventListener('dragleave', () => {
        card.classList.remove('is-drag-over');
      });

      card.addEventListener('drop', (e: DragEvent) => {
        e.preventDefault();
        card.classList.remove('is-drag-over');
        if (!this.draggedPageId || this.draggedPageId === page.id) return;

        const fromIndex = this.pages.findIndex((p) => p.id === this.draggedPageId);
        const toIndex = this.pages.findIndex((p) => p.id === page.id);

        if (fromIndex !== -1 && toIndex !== -1 && fromIndex !== toIndex) {
          this.callbacks.onReorderPages(fromIndex, toIndex);
        }
      });

      this.pagesCardsListEl?.appendChild(card);
    });

    const isLimitReached = totalPages >= MAX_BOARD_PAGES;
    const addCardContainer = document.createElement('div');
    addCardContainer.className = 'canva-page-card--add-container';
    addCardContainer.setAttribute('data-ref', 'tray-add-page-container');

    addCardContainer.innerHTML = `
      <div class="canva-page-card--add" data-ref="btn-tray-add-page">
        <button type="button" class="canva-page-card--add-btn${isLimitReached ? ' is-disabled' : ''}" data-ref="btn-tray-add-page-main" data-tooltip="${isLimitReached ? `Límite máximo de ${MAX_BOARD_PAGES} páginas` : 'Añadir página'}" aria-label="Añadir página">
          <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#add"></use></svg>
        </button>
        <button type="button" class="canva-page-card--add-dropdown${isLimitReached ? ' is-disabled' : ''}" data-ref="btn-tray-add-page-dropdown" data-tooltip="Tipos de lienzo" aria-label="Tipos de lienzo">
          <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#expand_more"></use></svg>
        </button>
      </div>
      <div class="canvas-page-types-popup is-hidden" data-ref="tray-board-page-types-popup">
        <div class="canvas-page-types-grid" data-ref="tray-board-page-types-grid">
          <button type="button" class="canvas-page-type-card" data-ref="tray-btn-type-board" data-type="board">
            <span class="canvas-page-type-card__icon canvas-page-type-card__icon--board">
              <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#draw"></use></svg>
            </span>
            <span class="canvas-page-type-card__label">Pizarrón online</span>
          </button>
          <button type="button" class="canvas-page-type-card" data-ref="tray-btn-type-doc" data-type="doc">
            <span class="canvas-page-type-card__icon canvas-page-type-card__icon--doc">
              <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#article"></use></svg>
            </span>
            <span class="canvas-page-type-card__label">Doc</span>
          </button>
          <button type="button" class="canvas-page-type-card" data-ref="tray-btn-type-sheet" data-type="sheet">
            <span class="canvas-page-type-card__icon canvas-page-type-card__icon--sheet">
              <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#table_chart"></use></svg>
            </span>
            <span class="canvas-page-type-card__label">Hoja de cálculo</span>
          </button>
          <button type="button" class="canvas-page-type-card" data-ref="tray-btn-type-presentation" data-type="presentation">
            <span class="canvas-page-type-card__icon canvas-page-type-card__icon--presentation">
              <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#slideshow"></use></svg>
            </span>
            <span class="canvas-page-type-card__label">Presentación</span>
          </button>
          <button type="button" class="canvas-page-type-card" data-ref="tray-btn-type-social" data-type="social">
            <span class="canvas-page-type-card__icon canvas-page-type-card__icon--social">
              <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#favorite"></use></svg>
            </span>
            <span class="canvas-page-type-card__label">Redes sociales</span>
          </button>
          <button type="button" class="canvas-page-type-card" data-ref="tray-btn-type-video" data-type="video">
            <span class="canvas-page-type-card__icon canvas-page-type-card__icon--video">
              <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#videocam"></use></svg>
            </span>
            <span class="canvas-page-type-card__label">Video</span>
          </button>
        </div>
      </div>
    `;

    const btnMain = addCardContainer.querySelector<HTMLButtonElement>('[data-ref="btn-tray-add-page-main"]');
    const btnDropdown = addCardContainer.querySelector<HTMLButtonElement>('[data-ref="btn-tray-add-page-dropdown"]');
    const popup = addCardContainer.querySelector<HTMLElement>('[data-ref="tray-board-page-types-popup"]');

    const closeTrayPopup = () => {
      popup?.classList.add('is-hidden');
      btnDropdown?.classList.remove('is-active');
    };

    btnMain?.addEventListener('click', (e) => {
      e.stopPropagation();
      closeTrayPopup();
      if (!isLimitReached) {
        this.callbacks.onAddPage();
      }
    });

    btnDropdown?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (isLimitReached) return;
      const isHidden = popup?.classList.contains('is-hidden');
      if (isHidden) {
        popup?.classList.remove('is-hidden');
        btnDropdown.classList.add('is-active');
      } else {
        closeTrayPopup();
      }
    });

    const typeCards = addCardContainer.querySelectorAll<HTMLButtonElement>('.canvas-page-type-card');
    typeCards.forEach((card) => {
      card.addEventListener('click', (e) => {
        e.stopPropagation();
        closeTrayPopup();
        if (isLimitReached) return;
        const pageType = card.getAttribute('data-type') as CanvasPageType;
        if (pageType) {
          if (this.callbacks.onAddPageWithType) {
            this.callbacks.onAddPageWithType(pageType);
          } else {
            this.callbacks.onAddPage();
          }
        }
      });
    });

    document.addEventListener('click', (e) => {
      if (!addCardContainer.contains(e.target as Node)) {
        closeTrayPopup();
      }
    });

    this.pagesCardsListEl.appendChild(addCardContainer);
    renderIcons(this.pagesCardsListEl);
  }
}
