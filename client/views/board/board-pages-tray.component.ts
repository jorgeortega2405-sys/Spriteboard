import { renderIcons } from '../../services/icon.service.js';
import { CarouselController, initCarouselScroll } from '../../utils/dom.util.js';
import { BoardPageItem } from './board.types.js';

export interface BoardPagesTrayCallbacks {
  onAddPage: () => void;
  onDeletePage: () => void;
  onDuplicatePage: () => void;
  onNextPage: () => void;
  onPrevPage: () => void;
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
  private isPresentation = false;
  private pageDeleteBtn: HTMLButtonElement | null = null;
  private pageDuplicateBtn: HTMLButtonElement | null = null;
  private pageNextBtn: HTMLButtonElement | null = null;
  private pagePrevBtn: HTMLButtonElement | null = null;
  private pages: BoardPageItem[] = [];
  private pagesCardsListEl: HTMLElement | null = null;
  private pagesCardsWrapper: HTMLElement | null = null;
  private trayEl: HTMLElement | null = null;

  constructor(callbacks: BoardPagesTrayCallbacks, isPresentation = false) {
    this.callbacks = callbacks;
    this.isPresentation = isPresentation;
  }

  public attach(containerEl: HTMLElement, pages: BoardPageItem[], activePageId: string, isPresentation = false): void {
    this.containerEl = containerEl;
    this.pages = pages;
    this.activePageId = activePageId;
    this.isPresentation = isPresentation;

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
    this.pagePrevBtn = this.containerEl.querySelector<HTMLButtonElement>('[data-ref="btn-page-prev"]');
    this.pageNextBtn = this.containerEl.querySelector<HTMLButtonElement>('[data-ref="btn-page-next"]');
    this.pageDuplicateBtn = this.containerEl.querySelector<HTMLButtonElement>('[data-ref="btn-page-duplicate"]');
    this.pageDeleteBtn = this.containerEl.querySelector<HTMLButtonElement>('[data-ref="btn-page-delete"]');

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
    const { signal } = this.abortController;

    this.pagePrevBtn?.addEventListener('click', () => {
      this.callbacks.onPrevPage();
    }, { signal });

    this.pageNextBtn?.addEventListener('click', () => {
      this.callbacks.onNextPage();
    }, { signal });

    this.pageDuplicateBtn?.addEventListener('click', () => {
      this.callbacks.onDuplicatePage();
    }, { signal });

    this.pageDeleteBtn?.addEventListener('click', () => {
      this.callbacks.onDeletePage();
    }, { signal });
  }

  private updateControlsUI(): void {
    const activeIndex = this.pages.findIndex((p) => p.id === this.activePageId);
    const totalPages = this.pages.length;

    if (this.pagePrevBtn) {
      this.pagePrevBtn.classList.toggle('is-disabled', activeIndex <= 0);
    }
    if (this.pageNextBtn) {
      this.pageNextBtn.classList.toggle('is-disabled', activeIndex >= totalPages - 1);
    }
    if (this.pageDeleteBtn) {
      this.pageDeleteBtn.classList.toggle('is-disabled', totalPages <= 1);
    }
    if (this.pageDuplicateBtn) {
      this.pageDuplicateBtn.classList.toggle('is-disabled', totalPages >= MAX_BOARD_PAGES);
    }
  }

  private renderPagesCards(): void {
    if (!this.pagesCardsListEl) return;
    this.pagesCardsListEl.innerHTML = '';

    const totalPages = this.pages.length;

    this.pages.forEach((page, index) => {
      const defaultName = this.isPresentation ? `Diapositiva ${index + 1}` : `Página ${index + 1}`;
      const prefix = this.isPresentation ? 'Diap.' : 'Pág.';
      const card = document.createElement('div');
      card.className = `design-page-card${page.id === this.activePageId ? ' is-active' : ''}`;
      card.setAttribute('data-ref', `page-card-${page.id}`);
      card.setAttribute('draggable', 'true');
      card.setAttribute('data-tooltip', page.name || defaultName);

      const numSpan = document.createElement('span');
      numSpan.className = 'design-page-card__num';
      numSpan.textContent = `${prefix} ${index + 1}`;

      const subSpan = document.createElement('span');
      subSpan.className = 'design-page-card__sub';
      const elCount = page.elements ? page.elements.length : 0;
      if (this.isPresentation) {
        const durationSec = page.duration !== undefined ? page.duration : 5.0;
        subSpan.textContent = `${durationSec}s · ${elCount} obj.`;
      } else {
        subSpan.textContent = `${elCount} obj.`;
      }

      card.appendChild(numSpan);
      card.appendChild(subSpan);

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
        this.containerEl?.querySelectorAll('.design-page-card').forEach((el) => {
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
    const itemNoun = this.isPresentation ? 'diapositivas' : 'páginas';
    const singleNoun = this.isPresentation ? 'diapositiva' : 'página';
    const addCard = document.createElement('button');
    addCard.setAttribute('type', 'button');
    addCard.className = `design-page-card--add${isLimitReached ? ' is-disabled' : ''}`;
    addCard.setAttribute('data-ref', 'btn-add-page-card');
    addCard.setAttribute('data-tooltip', isLimitReached ? `Límite máximo de ${MAX_BOARD_PAGES} ${itemNoun}` : `Añadir nueva ${singleNoun}`);
    addCard.setAttribute('aria-label', `Añadir nueva ${singleNoun}`);

    const addIcon = document.createElement('span');
    addIcon.className = 'component-icon';
    addIcon.textContent = 'add';
    addCard.appendChild(addIcon);

    addCard.addEventListener('click', () => {
      if (!isLimitReached) {
        this.callbacks.onAddPage();
      }
    });

    this.pagesCardsListEl.appendChild(addCard);
    renderIcons(this.pagesCardsListEl);
  }
}
