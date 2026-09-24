import { createIconSvg } from '../../services/icon.service.js';
import { addRecentFontId, DOC_FONT_CATEGORIES, DOC_FONTS_CATALOG, DocFontFamily, DocFontVariant, ensureGoogleFontLoaded, findFontByFamily, findFontById, getRecentFontIds, preloadPopularFonts } from './doc-fonts.config.js';

export interface FontSelectEvent {
  fallback: string;
  family: string;
  fontId: string;
  style?: string;
  variantName?: string;
  weight?: number;
}

export class DocFontPickerComponent {
  private abortController: AbortController | null = null;
  private activeCategory: string = 'all';
  private activeFontFamily: string = 'Inter';
  private activeWeight: number = 400;
  private activeStyle: string = 'normal';
  private expandedFontIds: Set<string> = new Set<string>();
  private onSelectCallback: (event: FontSelectEvent) => void;
  private parentContainer: HTMLElement;
  private searchQuery: string = '';

  constructor(parentContainer: HTMLElement, onSelect: (event: FontSelectEvent) => void) {
    this.parentContainer = parentContainer;
    this.onSelectCallback = onSelect;
  }

  public init(currentFontFamily: string = 'Inter', currentWeight: number = 400, currentStyle: string = 'normal'): void {
    this.destroy();
    this.abortController = new AbortController();
    this.activeFontFamily = currentFontFamily.split(',')[0].replace(/['"]/g, '').trim();
    this.activeWeight = currentWeight;
    this.activeStyle = currentStyle;

    preloadPopularFonts();
    this.render();
    this.bindEvents();
  }

  public setActiveFont(family: string, weight: number = 400, style: string = 'normal'): void {
    this.activeFontFamily = family.split(',')[0].replace(/['"]/g, '').trim();
    this.activeWeight = weight;
    this.activeStyle = style;
    this.updateActiveIndicators();
  }

  public focusSearch(): void {
    setTimeout(() => {
      const input = this.parentContainer.querySelector<HTMLInputElement>('[data-ref="font-search-input"]');
      input?.focus();
    }, 50);
  }

  public destroy(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  private render(): void {
    const signal = this.abortController?.signal;
    this.parentContainer.innerHTML = `
      <div class="doc-font-picker" data-ref="doc-font-picker-panel">
        <div class="doc-font-picker__search-box">
          <svg class="component-icon doc-font-picker__search-icon" aria-hidden="true"><use href="/icons.svg#search"></use></svg>
          <input class="doc-font-picker__search-input" data-ref="font-search-input" type="text" placeholder="Buscar fuentes (ej. 'Playfair', 'Cursiva')..." autocomplete="off" spellcheck="false" value="${this.escapeHtml(this.searchQuery)}" />
          <button type="button" class="doc-font-picker__search-clear ${this.searchQuery ? 'is-visible' : ''}" data-ref="btn-clear-font-search" aria-label="Limpiar búsqueda">
            <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#close"></use></svg>
          </button>
        </div>

        <div class="doc-font-picker__chips" data-ref="font-category-chips">
          ${DOC_FONT_CATEGORIES.map((cat) => `
            <button type="button" class="component-badge component-badge--sm ${this.activeCategory === cat.id ? 'is-active' : ''}" data-ref="chip-category-${cat.id}" data-category="${cat.id}">
              ${cat.label}
            </button>
          `).join('')}
        </div>

        <div class="doc-font-picker__body" data-ref="font-picker-list-container">
          ${this.renderFontListsHtml()}
        </div>
      </div>
    `;

    this.bindListEvents(signal);
  }

  private renderFontListsHtml(): string {
    const query = this.searchQuery.trim().toLowerCase();
    const category = this.activeCategory;

    let filteredFonts = DOC_FONTS_CATALOG;

    if (category !== 'all') {
      filteredFonts = filteredFonts.filter((f) => f.category === category || f.tags.includes(category));
    }

    if (query) {
      filteredFonts = filteredFonts.filter((f) =>
        f.name.toLowerCase().includes(query) ||
        f.family.toLowerCase().includes(query) ||
        f.tags.some((t) => t.toLowerCase().includes(query)) ||
        f.category.toLowerCase().includes(query)
      );
    }

    if (query || category !== 'all') {
      if (filteredFonts.length === 0) {
        return `
          <div class="doc-font-picker__empty">
            <svg class="component-icon doc-font-picker__empty-icon" aria-hidden="true"><use href="/icons.svg#search_off"></use></svg>
            <p class="doc-font-picker__empty-text">No se encontraron fuentes para "${this.escapeHtml(query || category)}"</p>
          </div>
        `;
      }

      return `
        <div class="doc-font-section">
          <div class="doc-font-section__title">
            <svg class="component-icon doc-font-section__icon" aria-hidden="true"><use href="/icons.svg#filter_list"></use></svg>
            Resultados (${filteredFonts.length})
          </div>
          <div class="doc-font-section__items">
            ${filteredFonts.map((f) => this.renderFontFamilyRowHtml(f)).join('')}
          </div>
        </div>
      `;
    }

    const recentIds = getRecentFontIds();
    const recentFonts: DocFontFamily[] = [];
    recentIds.forEach((id) => {
      const found = findFontById(id);
      if (found) recentFonts.push(found);
    });

    const recommendedFonts = DOC_FONTS_CATALOG.filter((f) => f.isPopular);
    const allRemainingFonts = DOC_FONTS_CATALOG.slice().sort((a, b) => a.name.localeCompare(b.name));

    return `
      ${recentFonts.length > 0 ? `
        <div class="doc-font-section">
          <div class="doc-font-section__title">
            <svg class="component-icon doc-font-section__icon" aria-hidden="true"><use href="/icons.svg#history"></use></svg>
            Usadas recientemente
          </div>
          <div class="doc-font-section__items">
            ${recentFonts.map((f) => this.renderFontFamilyRowHtml(f)).join('')}
          </div>
        </div>
      ` : ''}

      <div class="doc-font-section">
        <div class="doc-font-section__title">
          <svg class="component-icon doc-font-section__icon" aria-hidden="true"><use href="/icons.svg#auto_awesome"></use></svg>
          Fuentes recomendadas
        </div>
        <div class="doc-font-section__items">
          ${recommendedFonts.map((f) => this.renderFontFamilyRowHtml(f)).join('')}
        </div>
      </div>

      <div class="doc-font-section">
        <div class="doc-font-section__title">
          <svg class="component-icon doc-font-section__icon" aria-hidden="true"><use href="/icons.svg#font_download"></use></svg>
          Todas las fuentes (${allRemainingFonts.length})
        </div>
        <div class="doc-font-section__items">
          ${allRemainingFonts.map((f) => this.renderFontFamilyRowHtml(f)).join('')}
        </div>
      </div>
    `;
  }

  private renderFontFamilyRowHtml(font: DocFontFamily): string {
    ensureGoogleFontLoaded(font.family);

    const isActive = this.activeFontFamily.toLowerCase() === font.family.toLowerCase();
    const isExpanded = this.expandedFontIds.has(font.id);
    const hasMultipleVariants = font.variants.length > 1;

    return `
      <div class="doc-font-family-group ${isExpanded ? 'is-expanded' : ''}" data-font-id="${font.id}">
        <div class="doc-font-family-row ${isActive ? 'is-active' : ''}" data-ref="font-row-${font.id}" data-family="${font.family}" data-fallback="${font.fallback}" data-font-id="${font.id}">
          ${hasMultipleVariants ? `
            <button type="button" class="doc-font-family-row__expand ${isExpanded ? 'is-expanded' : ''}" data-ref="btn-expand-${font.id}" data-font-id="${font.id}" aria-label="Ver variantes de ${font.name}" title="Ver variantes">
              <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#chevron_right"></use></svg>
            </button>
          ` : `
            <div class="doc-font-family-row__expand-spacer"></div>
          `}

          <button type="button" class="doc-font-family-row__main" data-ref="btn-select-family-${font.id}" data-family="${font.family}" data-fallback="${font.fallback}" data-font-id="${font.id}">
            <span class="doc-font-family-row__name" style="font-family: '${font.family}', ${font.fallback};">${font.name}</span>
            <span class="doc-font-family-row__sample" style="font-family: '${font.family}', ${font.fallback};">AaBbCc</span>
          </button>

          ${isActive ? `
            <svg class="component-icon doc-font-family-row__check" aria-hidden="true"><use href="/icons.svg#check"></use></svg>
          ` : ''}
        </div>

        ${hasMultipleVariants ? `
          <div class="doc-font-variants-accordion ${isExpanded ? 'is-open' : ''}" data-ref="accordion-${font.id}">
            <div class="doc-font-variants-list">
              ${font.variants.map((v) => {
                const isVariantActive = isActive && this.activeWeight === v.weight && this.activeStyle === v.style;
                return `
                  <button type="button" class="doc-font-variant-item ${isVariantActive ? 'is-active' : ''}" data-ref="btn-variant-${font.id}-${v.weight}-${v.style}" data-family="${font.family}" data-fallback="${font.fallback}" data-font-id="${font.id}" data-weight="${v.weight}" data-style="${v.style}" data-variant-name="${v.name}">
                    <span class="doc-font-variant-item__name" style="font-family: '${font.family}', ${font.fallback}; font-weight: ${v.weight}; font-style: ${v.style};">${v.name}</span>
                    ${isVariantActive ? `<svg class="component-icon doc-font-variant-item__check" aria-hidden="true"><use href="/icons.svg#check"></use></svg>` : ''}
                  </button>
                `;
              }).join('')}
            </div>
          </div>
        ` : ''}
      </div>
    `;
  }

  private bindEvents(): void {
    const signal = this.abortController?.signal;

    const searchInput = this.parentContainer.querySelector<HTMLInputElement>('[data-ref="font-search-input"]');
    const clearBtn = this.parentContainer.querySelector<HTMLElement>('[data-ref="btn-clear-font-search"]');

    if (searchInput) {
      searchInput.addEventListener('input', () => {
        this.searchQuery = searchInput.value;
        if (clearBtn) {
          clearBtn.classList.toggle('is-visible', Boolean(this.searchQuery));
        }
        this.updateListOnly();
      }, { signal });
    }

    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        this.searchQuery = '';
        if (searchInput) {
          searchInput.value = '';
          searchInput.focus();
        }
        clearBtn.classList.remove('is-visible');
        this.updateListOnly();
      }, { signal });
    }

    const chipsContainer = this.parentContainer.querySelector<HTMLElement>('[data-ref="font-category-chips"]');
    if (chipsContainer) {
      chipsContainer.addEventListener('click', (e) => {
        const target = (e.target as HTMLElement).closest<HTMLElement>('.component-badge');
        if (!target) return;
        const cat = target.getAttribute('data-category') || 'all';
        this.activeCategory = cat;

        chipsContainer.querySelectorAll('.component-badge').forEach((c) => {
          c.classList.toggle('is-active', c.getAttribute('data-category') === cat);
        });

        this.updateListOnly();
      }, { signal });
    }
  }

  private bindListEvents(signal?: AbortSignal): void {
    const bodyContainer = this.parentContainer.querySelector<HTMLElement>('[data-ref="font-picker-list-container"]');
    if (!bodyContainer) return;

    bodyContainer.addEventListener('click', (e) => {
      const expandBtn = (e.target as HTMLElement).closest<HTMLElement>('.doc-font-family-row__expand');
      if (expandBtn) {
        e.stopPropagation();
        e.preventDefault();
        const fontId = expandBtn.getAttribute('data-font-id');
        if (fontId) {
          this.toggleAccordion(fontId);
        }
        return;
      }

      const variantBtn = (e.target as HTMLElement).closest<HTMLElement>('.doc-font-variant-item');
      if (variantBtn) {
        e.stopPropagation();
        e.preventDefault();
        const family = variantBtn.getAttribute('data-family') || 'Inter';
        const fallback = variantBtn.getAttribute('data-fallback') || 'sans-serif';
        const fontId = variantBtn.getAttribute('data-font-id') || 'inter';
        const weight = parseInt(variantBtn.getAttribute('data-weight') || '400', 10);
        const style = variantBtn.getAttribute('data-style') || 'normal';
        const variantName = variantBtn.getAttribute('data-variant-name') || 'Normal';

        this.selectFont({
          fallback,
          family,
          fontId,
          style,
          variantName,
          weight,
        });
        return;
      }

      const familyMainBtn = (e.target as HTMLElement).closest<HTMLElement>('.doc-font-family-row__main');
      if (familyMainBtn) {
        e.stopPropagation();
        e.preventDefault();
        const family = familyMainBtn.getAttribute('data-family') || 'Inter';
        const fallback = familyMainBtn.getAttribute('data-fallback') || 'sans-serif';
        const fontId = familyMainBtn.getAttribute('data-font-id') || 'inter';

        this.selectFont({
          fallback,
          family,
          fontId,
          style: 'normal',
          variantName: 'Normal',
          weight: 400,
        });
        return;
      }
    }, { signal });
  }

  private toggleAccordion(fontId: string): void {
    if (this.expandedFontIds.has(fontId)) {
      this.expandedFontIds.delete(fontId);
    } else {
      this.expandedFontIds.add(fontId);
    }

    const group = this.parentContainer.querySelector<HTMLElement>(`.doc-font-family-group[data-font-id="${fontId}"]`);
    if (group) {
      const isExp = this.expandedFontIds.has(fontId);
      group.classList.toggle('is-expanded', isExp);
      const chevron = group.querySelector('.doc-font-family-row__expand');
      if (chevron) chevron.classList.toggle('is-expanded', isExp);
      const accordion = group.querySelector('.doc-font-variants-accordion');
      if (accordion) accordion.classList.toggle('is-open', isExp);
    }
  }

  private selectFont(event: FontSelectEvent): void {
    this.activeFontFamily = event.family;
    this.activeWeight = event.weight || 400;
    this.activeStyle = event.style || 'normal';

    addRecentFontId(event.fontId);
    ensureGoogleFontLoaded(event.family);

    this.updateActiveIndicators();
    this.onSelectCallback(event);
  }

  private updateListOnly(): void {
    const listContainer = this.parentContainer.querySelector<HTMLElement>('[data-ref="font-picker-list-container"]');
    if (listContainer) {
      listContainer.innerHTML = this.renderFontListsHtml();
    }
  }

  private updateActiveIndicators(): void {
    const listContainer = this.parentContainer.querySelector<HTMLElement>('[data-ref="font-picker-list-container"]');
    if (!listContainer) return;

    listContainer.querySelectorAll('.doc-font-family-row').forEach((row) => {
      const fam = row.getAttribute('data-family') || '';
      const isActive = fam.toLowerCase() === this.activeFontFamily.toLowerCase();
      row.classList.toggle('is-active', isActive);

      const check = row.querySelector('.doc-font-family-row__check');
      if (isActive && !check) {
        row.insertAdjacentHTML('beforeend', createIconSvg('check', 'doc-font-family-row__check'));
      } else if (!isActive && check) {
        check.remove();
      }
    });

    listContainer.querySelectorAll('.doc-font-variant-item').forEach((vBtn) => {
      const fam = vBtn.getAttribute('data-family') || '';
      const w = parseInt(vBtn.getAttribute('data-weight') || '400', 10);
      const s = vBtn.getAttribute('data-style') || 'normal';

      const isActive = fam.toLowerCase() === this.activeFontFamily.toLowerCase() &&
                       w === this.activeWeight &&
                       s === this.activeStyle;

      vBtn.classList.toggle('is-active', isActive);
      const check = vBtn.querySelector('.doc-font-variant-item__check');
      if (isActive && !check) {
        vBtn.insertAdjacentHTML('beforeend', createIconSvg('check', 'doc-font-variant-item__check'));
      } else if (!isActive && check) {
        check.remove();
      }
    });
  }

  private escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}

