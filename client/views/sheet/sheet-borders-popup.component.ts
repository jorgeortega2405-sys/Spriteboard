import { SheetBorderStyle } from './sheet.types.js';

export type SheetBorderType =
  | 'all'
  | 'bottom'
  | 'inner'
  | 'left'
  | 'middle-h'
  | 'middle-v'
  | 'outer'
  | 'right'
  | 'top';

export interface SheetBordersPopupOptions {
  initialColor?: string;
  initialShowGridLines?: boolean;
  initialStyle?: SheetBorderStyle;
  initialWidth?: number;
  onApplyBorder: (type: SheetBorderType, color: string, style: SheetBorderStyle, width: number) => void;
  onClearBorders: () => void;
  onToggleGridLines: (show: boolean) => void;
  trigger: HTMLElement;
}

const PRESET_BORDER_COLORS = [
  '#000000', '#1e293b', '#475569', '#64748b', '#94a3b8', '#cbd5e1', '#ffffff',
  '#ef4444', '#f97316', '#f59e0b', '#10b981', '#06b6d4', '#3b82f6', '#2563eb', '#ec4899'
];

export class SheetBordersPopupComponent {
  private abortController: AbortController = new AbortController();
  private currentColor: string;
  private currentStyle: SheetBorderStyle;
  private currentWidth: number;
  private isOpen: boolean = false;
  private options: SheetBordersPopupOptions;
  private popupEl: HTMLElement | null = null;
  private showGridLines: boolean;

  constructor(options: SheetBordersPopupOptions) {
    this.options = options;
    this.currentColor = options.initialColor || '#1e293b';
    this.currentStyle = options.initialStyle || 'solid';
    this.currentWidth = options.initialWidth || 1;
    this.showGridLines = options.initialShowGridLines ?? true;
  }

  public init(): void {
    this.createPopupElement();
    this.bindEvents();
  }

  public toggle(): void {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  public open(): void {
    if (!this.popupEl) return;
    this.isOpen = true;
    this.popupEl.classList.remove('is-hidden');
    this.updatePosition();
  }

  public close(): void {
    if (!this.popupEl) return;
    this.isOpen = false;
    this.popupEl.classList.add('is-hidden');
  }

  public setGridLinesState(show: boolean): void {
    this.showGridLines = show;
    if (!this.popupEl) return;
    const toggleEl = this.popupEl.querySelector<HTMLElement>('[data-ref="sheet-gridlines-toggle"]');
    if (toggleEl) {
      toggleEl.classList.toggle('is-checked', show);
    }
  }

  public destroy(): void {
    this.abortController.abort();
    if (this.popupEl && this.popupEl.parentNode) {
      this.popupEl.parentNode.removeChild(this.popupEl);
    }
    this.popupEl = null;
  }

  private createPopupElement(): void {
    const el = document.createElement('div');
    el.className = 'sheet-borders-popup is-hidden';
    el.setAttribute('data-ref', 'sheet-borders-popup');

    el.innerHTML = `
      <div class="sheet-borders-popup__main" data-ref="sheet-borders-main">
        <div class="sheet-borders-popup__grid" data-ref="sheet-borders-grid">
          <button type="button" class="sheet-border-btn" data-ref="btn-border-all" data-border-type="all" data-tooltip="Todos los bordes" aria-label="Todos los bordes">
            <svg class="sheet-border-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="3" y="3" width="18" height="18" rx="2" stroke-width="2"/><line x1="12" y1="3" x2="12" y2="21" stroke-width="2"/><line x1="3" y1="12" x2="21" y2="12" stroke-width="2"/></svg>
          </button>
          <button type="button" class="sheet-border-btn" data-ref="btn-border-outer" data-border-type="outer" data-tooltip="Bordes exteriores" aria-label="Bordes exteriores">
            <svg class="sheet-border-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="3" y="3" width="18" height="18" rx="2" stroke-width="2"/><line x1="12" y1="3" x2="12" y2="21" stroke-width="1" stroke-dasharray="2 2" opacity="0.4"/><line x1="3" y1="12" x2="21" y2="12" stroke-width="1" stroke-dasharray="2 2" opacity="0.4"/></svg>
          </button>
          <button type="button" class="sheet-border-btn" data-ref="btn-border-inner" data-border-type="inner" data-tooltip="Bordes interiores" aria-label="Bordes interiores">
            <svg class="sheet-border-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="3" y="3" width="18" height="18" rx="2" stroke-width="1" stroke-dasharray="2 2" opacity="0.4"/><line x1="12" y1="3" x2="12" y2="21" stroke-width="2"/><line x1="3" y1="12" x2="21" y2="12" stroke-width="2"/></svg>
          </button>

          <button type="button" class="sheet-border-btn" data-ref="btn-border-top" data-border-type="top" data-tooltip="Borde superior" aria-label="Borde superior">
            <svg class="sheet-border-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="3" y="3" width="18" height="18" rx="2" stroke-width="1" stroke-dasharray="2 2" opacity="0.3"/><line x1="3" y1="3" x2="21" y2="3" stroke-width="2.5"/></svg>
          </button>
          <button type="button" class="sheet-border-btn" data-ref="btn-border-middle-h" data-border-type="middle-h" data-tooltip="Borde horizontal interior" aria-label="Borde horizontal interior">
            <svg class="sheet-border-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="3" y="3" width="18" height="18" rx="2" stroke-width="1" stroke-dasharray="2 2" opacity="0.3"/><line x1="3" y1="12" x2="21" y2="12" stroke-width="2.5"/></svg>
          </button>
          <button type="button" class="sheet-border-btn" data-ref="btn-border-bottom" data-border-type="bottom" data-tooltip="Borde inferior" aria-label="Borde inferior">
            <svg class="sheet-border-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="3" y="3" width="18" height="18" rx="2" stroke-width="1" stroke-dasharray="2 2" opacity="0.3"/><line x1="3" y1="21" x2="21" y2="21" stroke-width="2.5"/></svg>
          </button>

          <button type="button" class="sheet-border-btn" data-ref="btn-border-left" data-border-type="left" data-tooltip="Borde izquierdo" aria-label="Borde izquierdo">
            <svg class="sheet-border-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="3" y="3" width="18" height="18" rx="2" stroke-width="1" stroke-dasharray="2 2" opacity="0.3"/><line x1="3" y1="3" x2="3" y2="21" stroke-width="2.5"/></svg>
          </button>
          <button type="button" class="sheet-border-btn" data-ref="btn-border-middle-v" data-border-type="middle-v" data-tooltip="Borde vertical interior" aria-label="Borde vertical interior">
            <svg class="sheet-border-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="3" y="3" width="18" height="18" rx="2" stroke-width="1" stroke-dasharray="2 2" opacity="0.3"/><line x1="12" y1="3" x2="12" y2="21" stroke-width="2.5"/></svg>
          </button>
          <button type="button" class="sheet-border-btn" data-ref="btn-border-right" data-border-type="right" data-tooltip="Borde derecho" aria-label="Borde derecho">
            <svg class="sheet-border-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="3" y="3" width="18" height="18" rx="2" stroke-width="1" stroke-dasharray="2 2" opacity="0.3"/><line x1="21" y1="3" x2="21" y2="21" stroke-width="2.5"/></svg>
          </button>
        </div>

        <div class="sheet-borders-popup__side" data-ref="sheet-borders-side">
          <button type="button" class="sheet-border-color-btn" data-ref="btn-border-color" data-tooltip="Color de borde" aria-label="Color de borde">
            <span class="sheet-border-color-swatch" data-ref="sheet-border-swatch" style="background-color: ${this.currentColor};"></span>
          </button>
          <button type="button" class="sheet-border-style-btn" data-ref="btn-border-style" data-tooltip="Estilo de línea" aria-label="Estilo de línea">
            <svg class="sheet-border-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor"><line x1="4" y1="7" x2="20" y2="7" stroke-width="1"/><line x1="4" y1="12" x2="20" y2="12" stroke-width="2"/><line x1="4" y1="17" x2="20" y2="17" stroke-width="3"/></svg>
          </button>
          <button type="button" class="sheet-border-reset-btn" data-ref="btn-border-clear" data-tooltip="Borrar bordes" aria-label="Borrar bordes">
            <svg class="sheet-border-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
          </button>
        </div>
      </div>

      <div class="sheet-border-color-palette is-hidden" data-ref="sheet-border-palette">
        ${PRESET_BORDER_COLORS.map((c) => `
          <button type="button" class="sheet-color-dot" data-ref="color-dot-${c.replace('#', '')}" data-color="${c}" style="background-color: ${c};" aria-label="${c}"></button>
        `).join('')}
      </div>

      <div class="sheet-border-style-drawer is-hidden" data-ref="sheet-border-styles">
        <button type="button" class="sheet-style-row" data-ref="btn-style-1px" data-width="1" data-style="solid">
          <span class="sheet-style-preview" style="border-top: 1px solid currentColor;"></span>
          <span class="sheet-style-label">Fino (1px)</span>
        </button>
        <button type="button" class="sheet-style-row" data-ref="btn-style-2px" data-width="2" data-style="solid">
          <span class="sheet-style-preview" style="border-top: 2px solid currentColor;"></span>
          <span class="sheet-style-label">Medio (2px)</span>
        </button>
        <button type="button" class="sheet-style-row" data-ref="btn-style-3px" data-width="3" data-style="solid">
          <span class="sheet-style-preview" style="border-top: 3px solid currentColor;"></span>
          <span class="sheet-style-label">Grueso (3px)</span>
        </button>
        <button type="button" class="sheet-style-row" data-ref="btn-style-dashed" data-width="1" data-style="dashed">
          <span class="sheet-style-preview" style="border-top: 1.5px dashed currentColor;"></span>
          <span class="sheet-style-label">Línea discontinua</span>
        </button>
      </div>

      <div class="sheet-borders-popup__footer" data-ref="sheet-borders-footer">
        <span class="sheet-borders-footer__text">Mostrar líneas de cuadrícula</span>
        <button type="button" class="sheet-toggle-switch ${this.showGridLines ? 'is-checked' : ''}" data-ref="sheet-gridlines-toggle" role="switch" aria-checked="${this.showGridLines}">
          <span class="sheet-toggle-switch__thumb">
            <svg class="sheet-toggle-check" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2"><polyline points="2 6 5 9 10 3"/></svg>
          </span>
        </button>
      </div>
    `;

    document.body.appendChild(el);
    this.popupEl = el;
  }

  private bindEvents(): void {
    if (!this.popupEl) return;
    const { signal } = this.abortController;

    const gridBtns = this.popupEl.querySelectorAll<HTMLButtonElement>('[data-border-type]');
    gridBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const type = btn.getAttribute('data-border-type') as SheetBorderType;
        if (type) {
          this.options.onApplyBorder(type, this.currentColor, this.currentStyle, this.currentWidth);
        }
      }, { signal });
    });

    const btnClear = this.popupEl.querySelector<HTMLButtonElement>('[data-ref="btn-border-clear"]');
    btnClear?.addEventListener('click', () => {
      this.options.onClearBorders();
    }, { signal });

    const btnColor = this.popupEl.querySelector<HTMLButtonElement>('[data-ref="btn-border-color"]');
    const paletteEl = this.popupEl.querySelector<HTMLElement>('[data-ref="sheet-border-palette"]');
    const stylesDrawerEl = this.popupEl.querySelector<HTMLElement>('[data-ref="sheet-border-styles"]');

    btnColor?.addEventListener('click', () => {
      if (stylesDrawerEl) stylesDrawerEl.classList.add('is-hidden');
      paletteEl?.classList.toggle('is-hidden');
    }, { signal });

    const colorDots = this.popupEl.querySelectorAll<HTMLButtonElement>('[data-color]');
    colorDots.forEach((dot) => {
      dot.addEventListener('click', () => {
        const col = dot.getAttribute('data-color');
        if (col) {
          this.currentColor = col;
          const swatch = this.popupEl?.querySelector<HTMLElement>('[data-ref="sheet-border-swatch"]');
          if (swatch) swatch.style.backgroundColor = col;
          paletteEl?.classList.add('is-hidden');
        }
      }, { signal });
    });

    const btnStyle = this.popupEl.querySelector<HTMLButtonElement>('[data-ref="btn-border-style"]');
    btnStyle?.addEventListener('click', () => {
      if (paletteEl) paletteEl.classList.add('is-hidden');
      stylesDrawerEl?.classList.toggle('is-hidden');
    }, { signal });

    const styleRows = this.popupEl.querySelectorAll<HTMLButtonElement>('[data-style]');
    styleRows.forEach((row) => {
      row.addEventListener('click', () => {
        const s = row.getAttribute('data-style') as SheetBorderStyle;
        const w = parseInt(row.getAttribute('data-width') || '1', 10);
        if (s) this.currentStyle = s;
        if (!isNaN(w)) this.currentWidth = w;
        stylesDrawerEl?.classList.add('is-hidden');
      }, { signal });
    });

    const toggleBtn = this.popupEl.querySelector<HTMLButtonElement>('[data-ref="sheet-gridlines-toggle"]');
    toggleBtn?.addEventListener('click', () => {
      this.showGridLines = !this.showGridLines;
      toggleBtn.classList.toggle('is-checked', this.showGridLines);
      toggleBtn.setAttribute('aria-checked', String(this.showGridLines));
      this.options.onToggleGridLines(this.showGridLines);
    }, { signal });

    window.addEventListener('pointerdown', (e) => {
      if (!this.isOpen) return;
      const target = e.target as Node;
      if (this.popupEl?.contains(target) || this.options.trigger.contains(target)) {
        return;
      }
      this.close();
    }, { signal });

    window.addEventListener('resize', () => {
      if (this.isOpen) this.updatePosition();
    }, { signal });

    window.addEventListener('scroll', () => {
      if (this.isOpen) this.updatePosition();
    }, { capture: true, passive: true, signal });
  }

  private updatePosition(): void {
    if (!this.popupEl) return;
    const rect = this.options.trigger.getBoundingClientRect();
    const popupWidth = 240;
    let left = rect.left;
    if (left + popupWidth > window.innerWidth - 12) {
      left = window.innerWidth - popupWidth - 12;
    }
    this.popupEl.style.top = `${rect.bottom + 6}px`;
    this.popupEl.style.left = `${Math.max(12, left)}px`;
  }
}
