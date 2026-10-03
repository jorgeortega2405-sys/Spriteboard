import { generateThumbnail } from '../../engine-2d/export.service.js';
import { escapeHtml } from '../../services/api.service.js';
import { renderIcons } from '../../services/icon.service.js';
import { CarouselController, initCarouselScroll } from '../../utils/dom.util.js';
import { BoardPageItem } from './board.types.js';

export interface BoardPagesTrayCallbacks {
  onAddPage: () => void;
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
    const addCard = document.createElement('div');
    addCard.className = `canva-page-card canva-page-card--add${isLimitReached ? ' is-disabled' : ''}`;
    addCard.setAttribute('data-ref', 'btn-tray-add-page');
    addCard.setAttribute('data-tooltip', isLimitReached ? `Límite máximo de ${MAX_BOARD_PAGES} páginas` : 'Añadir página');
    addCard.setAttribute('aria-label', 'Añadir página');
    addCard.innerHTML = `
      <div class="canva-page-card__preview">
        <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#add"></use></svg>
      </div>
    `;

    addCard.addEventListener('click', () => {
      if (!isLimitReached) {
        this.callbacks.onAddPage();
      }
    });

    this.pagesCardsListEl.appendChild(addCard);
    renderIcons(this.pagesCardsListEl);
  }
}
