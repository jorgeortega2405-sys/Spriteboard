import { MOCKUP_CATEGORIES, MOCKUP_TEMPLATES } from '../../config/mockups.config.js';
import { MockupCategory, MockupTemplate } from '../../types/mockups.types.js';

export interface MockupsPanelCallbacks {
  onClose: () => void;
  onSelectMockup: (mockup: MockupTemplate) => void;
}

export class BoardMockupsPanelComponent {
  private activeCategory: MockupCategory | 'all' = 'all';
  private callbacks: MockupsPanelCallbacks;
  private containerEl: HTMLElement | null = null;
  private panelEl: HTMLElement | null = null;
  private searchQuery = '';

  constructor(container: HTMLElement, callbacks: MockupsPanelCallbacks) {
    this.containerEl = container;
    this.callbacks = callbacks;
  }

  public init(): void {
    if (!this.containerEl) return;
    this.panelEl = this.containerEl.querySelector<HTMLElement>('[data-ref="board-mockups-drawer"]');
    if (!this.panelEl) return;

    this.bindEvents();
    this.renderCategoryTabs();
    this.renderMockupsList();
  }

  public open(): void {
    if (this.panelEl) {
      this.panelEl.classList.remove('is-hidden');
      const searchInput = this.panelEl.querySelector<HTMLInputElement>('[data-ref="mockup-search-input"]');
      searchInput?.focus();
    }
  }

  public close(): void {
    if (this.panelEl) {
      this.panelEl.classList.add('is-hidden');
    }
  }

  public isOpen(): boolean {
    return !!this.panelEl && !this.panelEl.classList.contains('is-hidden');
  }

  private bindEvents(): void {
    if (!this.panelEl) return;

    const btnClose = this.panelEl.querySelector<HTMLButtonElement>('[data-ref="btn-close-mockups-drawer"]');
    btnClose?.addEventListener('click', () => {
      this.close();
      this.callbacks.onClose();
    });

    const searchInput = this.panelEl.querySelector<HTMLInputElement>('[data-ref="mockup-search-input"]');
    searchInput?.addEventListener('input', () => {
      this.searchQuery = searchInput.value.toLowerCase().trim();
      this.renderMockupsList();
    });
  }

  private renderCategoryTabs(): void {
    if (!this.panelEl) return;
    const tabsContainer = this.panelEl.querySelector<HTMLElement>('[data-ref="mockup-category-tabs"]');
    if (!tabsContainer) return;

    tabsContainer.innerHTML = '';

    const allBtn = document.createElement('button');
    allBtn.type = 'button';
    allBtn.className = `mockup-category-pill ${this.activeCategory === 'all' ? 'is-active' : ''}`;
    allBtn.setAttribute('data-ref', 'mockup-cat-all');
    allBtn.textContent = 'Todos';
    allBtn.addEventListener('click', () => {
      this.activeCategory = 'all';
      this.updateCategoryTabsActive();
      this.renderMockupsList();
    });
    tabsContainer.appendChild(allBtn);

    for (const cat of MOCKUP_CATEGORIES) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `mockup-category-pill ${this.activeCategory === cat.id ? 'is-active' : ''}`;
      btn.setAttribute('data-ref', `mockup-cat-${cat.id}`);
      btn.textContent = cat.name;
      btn.addEventListener('click', () => {
        this.activeCategory = cat.id;
        this.updateCategoryTabsActive();
        this.renderMockupsList();
      });
      tabsContainer.appendChild(btn);
    }
  }

  private updateCategoryTabsActive(): void {
    if (!this.panelEl) return;
    const buttons = this.panelEl.querySelectorAll<HTMLButtonElement>('.mockup-category-pill');
    buttons.forEach((btn) => {
      const isAll = btn.getAttribute('data-ref') === 'mockup-cat-all' && this.activeCategory === 'all';
      const isCat = btn.getAttribute('data-ref') === `mockup-cat-${this.activeCategory}`;
      btn.classList.toggle('is-active', isAll || isCat);
    });
  }

  private renderMockupsList(): void {
    if (!this.panelEl) return;
    const gridEl = this.panelEl.querySelector<HTMLElement>('[data-ref="mockup-templates-grid"]');
    if (!gridEl) return;

    gridEl.innerHTML = '';

    let filtered = MOCKUP_TEMPLATES;
    if (this.activeCategory !== 'all') {
      filtered = filtered.filter((tpl) => tpl.category === this.activeCategory);
    }

    if (this.searchQuery) {
      filtered = filtered.filter((tpl) =>
        tpl.name.toLowerCase().includes(this.searchQuery) ||
        tpl.description.toLowerCase().includes(this.searchQuery) ||
        tpl.category.toLowerCase().includes(this.searchQuery)
      );
    }

    if (filtered.length === 0) {
      const emptyState = document.createElement('div');
      emptyState.className = 'mockup-empty-state';
      emptyState.textContent = 'No se encontraron mockups que coincidan con la búsqueda.';
      gridEl.appendChild(emptyState);
      return;
    }

    for (const tpl of filtered) {
      const card = document.createElement('div');
      card.className = 'mockup-template-card';
      card.setAttribute('data-ref', `mockup-card-${tpl.id}`);
      card.setAttribute('draggable', 'true');

      card.addEventListener('dragstart', (e: DragEvent) => {
        if (e.dataTransfer) {
          e.dataTransfer.setData('application/json', JSON.stringify({ mockupId: tpl.id, type: 'mockup-template' }));
          e.dataTransfer.effectAllowed = 'copy';
        }
      });

      const thumbBox = document.createElement('div');
      thumbBox.className = 'mockup-template-card__thumb';
      if (tpl.thumbnailSvg) {
        thumbBox.innerHTML = tpl.thumbnailSvg;
      }

      const infoBox = document.createElement('div');
      infoBox.className = 'mockup-template-card__info';

      const title = document.createElement('span');
      title.className = 'mockup-template-card__title';
      title.textContent = tpl.name;

      const desc = document.createElement('span');
      desc.className = 'mockup-template-card__desc';
      desc.textContent = tpl.description;

      infoBox.appendChild(title);
      infoBox.appendChild(desc);

      card.appendChild(thumbBox);
      card.appendChild(infoBox);

      card.addEventListener('click', () => {
        this.callbacks.onSelectMockup(tpl);
      });

      gridEl.appendChild(card);
    }
  }

  public destroy(): void {
    this.panelEl = null;
    this.containerEl = null;
  }
}
