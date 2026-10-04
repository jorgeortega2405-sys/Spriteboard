import { openInsertPixelGridModal } from '../../components/insert-pixel-grid-modal.component.js';
import { isColorsDrawerOpen, isFontsDrawerOpen, isPixelAnimationDrawerOpen, openColorsInDrawer, openFontsInDrawer, openPixelAnimationInDrawer, toggleDrawer } from '../../components/layout.component.js';
import { DEFAULT_STICKY_COLOR } from '../../config/sticky-notes.config.js';
import { BoardElement, BoardPixelGridElement, DEFAULT_CLASSIC_PALETTE, measureTextElementSize, ShapeType } from '../../core/canvas-engine.js';
import { renderIcons } from '../../services/icon.service.js';
import { showToast } from '../../services/toast.service.js';
import { generateShadingRamp } from '../../utils/color.util.js';
import { DocFontPickerComponent, FontSelectEvent } from '../doc/doc-font-picker.component.js';
import { ensureGoogleFontLoaded } from '../doc/doc-fonts.config.js';
import { BoardPixelPanelComponent } from './board-pixel-panel.component.js';

export interface BoardColorsFontsHost {
  abortController: AbortController;
  btnColorEyedropper: HTMLButtonElement | null;
  closeAllPopovers(): void;
  collaborationManager: any;
  colorPanelTarget: 'stroke' | 'fill' | 'text';
  colorsCustomInputEl: HTMLInputElement | null;
  colorsHexTextEl: HTMLElement | null;
  colorsPaletteGridEl: HTMLElement | null;
  colorsPanelEl: HTMLElement | null;
  colorsRampGridEl: HTMLElement | null;
  colorsRecentGridEl: HTMLElement | null;
  colorsTitleEl: HTMLElement | null;
  connectorStyle: 'curved' | 'orthogonal' | 'straight';
  container: HTMLElement;
  currentColor: string;
  currentFillColor: string;
  currentShape: ShapeType;
  currentStrokeWidth: number;
  elements: BoardElement[];
  eyedropperScreenPos: any;
  fontPicker: DocFontPickerComponent | null;
  getSelectedElements(): BoardElement[];
  insertPixelGrid(cfg: any): void;
  isEyedropperActive: boolean;
  markElementsDirty(): void;
  pixelGrid: any;
  pixelPanel: BoardPixelPanelComponent | null;
  pushHistoryState(): void;
  recentColors: string[];
  requestRedraw(): void;
  scheduleAutoSave(): void;
  selectedElementId: string | null;
  selectedElementIds: string[];
  stickyDefaultColor: string;
  topToggleColorsBtn: HTMLButtonElement | null;
  updateCanvasCursor(): void;
  updateContextualToolbar(): void;
  updateSelectionToolbar(): void;
}

export class BoardColorsFontsManager {
  private host: BoardColorsFontsHost;

  constructor(host: BoardColorsFontsHost) {
    this.host = host;
  }

  public bindPropertiesControls(signal: AbortSignal): void {
    const btnColorProp = this.host.container.querySelector<HTMLButtonElement>('[data-ref="btn-color-prop"]');
    btnColorProp?.addEventListener(
      'click',
      (e) => {
        e.stopPropagation();
        this.toggleColorsPanel('stroke');
      },
      { signal }
    );

    const btnFillProp = this.host.container.querySelector<HTMLButtonElement>('[data-ref="btn-fill-prop"]');
    btnFillProp?.addEventListener(
      'click',
      (e) => {
        e.stopPropagation();
        this.toggleColorsPanel('fill');
      },
      { signal }
    );

    this.host.topToggleColorsBtn = this.host.container.querySelector<HTMLButtonElement>('[data-ref="btn-top-toggle-colors"]');
    this.host.topToggleColorsBtn?.addEventListener(
      'click',
      (e) => {
        e.stopPropagation();
        this.toggleColorsPanel('stroke');
      },
      { signal }
    );

    const widthBadges = this.host.container.querySelectorAll<HTMLButtonElement>('[data-width]');
    widthBadges.forEach((opt) => {
      opt.addEventListener(
        'click',
        () => {
          const w = parseInt(opt.getAttribute('data-width') || '4', 10);
          this.setStrokeWidth(w);
        },
        { signal }
      );
    });

    const shapeBadges = this.host.container.querySelectorAll<HTMLButtonElement>('[data-shape]');
    shapeBadges.forEach((opt) => {
      opt.addEventListener(
        'click',
        () => {
          shapeBadges.forEach((s) => s.classList.remove('is-active'));
          opt.classList.add('is-active');
          this.host.currentShape = (opt.getAttribute('data-shape') as ShapeType) || 'rect';
        },
        { signal }
      );
    });

    const stickySwatches = this.host.container.querySelectorAll<HTMLButtonElement>('.board-sticky-color-swatch');
    stickySwatches.forEach((swatch) => {
      swatch.addEventListener(
        'click',
        () => {
          stickySwatches.forEach((s) => s.classList.remove('is-active'));
          swatch.classList.add('is-active');
          const color = swatch.getAttribute('data-color') || DEFAULT_STICKY_COLOR;
          this.host.stickyDefaultColor = color;
          const selectedEls = this.host.getSelectedElements();
          if (selectedEls.length > 0 && selectedEls.some((el) => el.type === 'sticky')) {
            this.host.pushHistoryState();
            for (const el of selectedEls) {
              if (el.type === 'sticky') {
                el.color = color;
                this.host.collaborationManager.broadcastUpdateElement(el);
              }
            }
            this.host.updateSelectionToolbar();
            this.host.requestRedraw();
            this.host.scheduleAutoSave();
          }
        },
        { signal }
      );
    });

    const connectorBadges = this.host.container.querySelectorAll<HTMLButtonElement>('[data-connector-style]');
    connectorBadges.forEach((opt) => {
      opt.addEventListener(
        'click',
        () => {
          connectorBadges.forEach((s) => s.classList.remove('is-active'));
          opt.classList.add('is-active');
          this.host.connectorStyle = (opt.getAttribute('data-connector-style') as 'curved' | 'orthogonal' | 'straight') || 'curved';
        },
        { signal }
      );
    });

    document.addEventListener(
      'click',
      (e: MouseEvent) => {
        const target = e.target as HTMLElement | null;
        if (!target?.closest('[data-ref="board-colors-panel"], [data-ref="btn-color-prop"], [data-ref="btn-fill-prop"], [data-ref="btn-top-toggle-colors"], [data-ref="top-btn-fill"], [data-ref="top-btn-stroke-color"], [data-ref="top-btn-text-color"]')) {
          this.hideColorsPanel();
        }
        if (!target?.closest('.board-context-popover, [data-ref="board-top-selection-section"]')) {
          this.host.closeAllPopovers();
        }
      },
      { signal }
    );
  }

  public loadRecentColors(): void {
    try {
      const stored = localStorage.getItem('spriteboard_recent_colors');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          this.host.recentColors = parsed.filter((c: unknown): c is string => typeof c === 'string' && /^#[0-9A-Fa-f]{6}$/.test(c)).slice(0, 12);
        }
      }
    } catch {}

    if (this.host.recentColors.length === 0) {
      this.host.recentColors = ['#000000', '#FFFFFF', '#FF0000', '#00FF00', '#0000FF', '#FFFF00'];
    }
  }

  public saveRecentColors(): void {
    try {
      localStorage.setItem('spriteboard_recent_colors', JSON.stringify(this.host.recentColors.slice(0, 12)));
    } catch {}
  }

  public initColorsUI(): void {
    this.loadRecentColors();
  }

  public attachColorsUI(drawerBody: HTMLElement, target?: 'stroke' | 'fill' | 'text'): void {
    this.host.colorsPanelEl = drawerBody;
    this.host.colorsTitleEl = drawerBody.closest('.layout-drawer')?.querySelector<HTMLElement>('[data-ref="board-colors-title"]') || drawerBody.querySelector<HTMLElement>('[data-ref="board-colors-title"]');
    this.host.colorsPaletteGridEl = drawerBody.querySelector<HTMLElement>('[data-ref="board-palette-grid"]');
    this.host.colorsRecentGridEl = drawerBody.querySelector<HTMLElement>('[data-ref="board-colors-recent-grid"]');
    this.host.colorsRampGridEl = drawerBody.querySelector<HTMLElement>('[data-ref="board-colors-ramp-grid"]');
    this.host.colorsHexTextEl = drawerBody.querySelector<HTMLElement>('[data-ref="board-colors-hex-text"]');
    this.host.colorsCustomInputEl = drawerBody.querySelector<HTMLInputElement>('[data-ref="input-custom-color"]');
    this.host.btnColorEyedropper = drawerBody.querySelector<HTMLButtonElement>('[data-ref="btn-color-eyedropper"]');

    if (target) {
      this.host.colorPanelTarget = target;
    }
    if (this.host.colorsTitleEl) {
      this.host.colorsTitleEl.textContent = this.host.colorPanelTarget === 'stroke' ? 'Color de trazo o borde' : (this.host.colorPanelTarget === 'fill' ? 'Color de relleno' : 'Color de texto');
    }

    this.host.btnColorEyedropper?.addEventListener('click', () => {
      this.toggleEyedropper();
    }, { signal: this.host.abortController.signal });

    this.host.colorsCustomInputEl?.addEventListener('input', (e) => {
      const val = (e.target as HTMLInputElement).value;
      if (val) this.handleColorPicked(val);
    }, { signal: this.host.abortController.signal });

    const transparentSwatch = drawerBody.querySelector<HTMLButtonElement>('[data-ref="color-swatch-transparent"]');
    transparentSwatch?.addEventListener('click', () => {
      this.handleColorPicked('transparent');
    }, { signal: this.host.abortController.signal });

    this.loadRecentColors();
    this.renderDefaultPalette();
    this.renderRecentColors();

    let currentVal = this.host.currentColor;
    if (this.host.colorPanelTarget === 'fill') currentVal = this.host.currentFillColor;
    if (this.host.colorPanelTarget === 'text' && this.host.selectedElementId) {
      const el = this.host.elements.find((item) => item.id === this.host.selectedElementId);
      if (el) {
        if (el.type === 'text') currentVal = el.color;
        else if (el.type === 'sticky') currentVal = el.textColor;
        else if (el.type === 'shape' && el.textColor) currentVal = el.textColor;
      }
    }
    this.updateColorPanelUI(currentVal);
  }

  public toggleEyedropper(active?: boolean): void {
    this.host.isEyedropperActive = active !== undefined ? active : !this.host.isEyedropperActive;
    if (this.host.btnColorEyedropper) {
      this.host.btnColorEyedropper.classList.toggle('is-active', this.host.isEyedropperActive);
    }
    this.host.updateCanvasCursor();
    if (this.host.isEyedropperActive) {
      showToast('Cuentagotas activo: haz clic en cualquier pixel del lienzo para copiar su color');
    } else {
      this.host.eyedropperScreenPos = null;
    }
    this.host.requestRedraw();
  }

  public renderDefaultPalette(): void {
    if (!this.host.colorsPaletteGridEl) return;
    this.host.colorsPaletteGridEl.innerHTML = '';

    const currentActiveColor = (this.host.colorPanelTarget === 'fill' ? this.host.currentFillColor : this.host.currentColor).toUpperCase();

    for (const color of DEFAULT_CLASSIC_PALETTE) {
      const swatch = document.createElement('button');
      swatch.type = 'button';
      swatch.className = `design-color-swatch-btn ${color.toUpperCase() === currentActiveColor ? 'is-active' : ''}`;
      swatch.setAttribute('data-ref', `color-swatch-${color.replace('#', '')}`);
      swatch.setAttribute('data-color', color);
      swatch.setAttribute('data-tooltip', color);
      swatch.setAttribute('aria-label', `Color ${color}`);
      swatch.style.backgroundColor = color;

      swatch.addEventListener('click', () => {
        this.handleColorPicked(color);
      }, { signal: this.host.abortController.signal });

      this.host.colorsPaletteGridEl.appendChild(swatch);
    }
  }

  public renderShadingRamps(): void {
    if (!this.host.colorsRampGridEl) return;
    this.host.colorsRampGridEl.innerHTML = '';

    const currentVal = this.host.colorPanelTarget === 'fill' ? this.host.currentFillColor : this.host.currentColor;
    if (currentVal === 'transparent' || !/^#[0-9A-Fa-f]{6}$/.test(currentVal)) {
      return;
    }

    const ramp = generateShadingRamp(currentVal);
    const labels = ['Sombra muy profunda', 'Sombra profunda', 'Sombra suave', 'Base', 'Brillo', 'Brillo intenso'];

    ramp.forEach((color, idx) => {
      const swatch = document.createElement('button');
      swatch.type = 'button';
      swatch.className = `design-color-swatch-btn ${idx === 3 ? 'is-base' : ''} ${color.toUpperCase() === currentVal.toUpperCase() ? 'is-active' : ''}`;
      swatch.setAttribute('data-ref', `color-ramp-${idx}`);
      swatch.setAttribute('data-color', color);
      swatch.setAttribute('data-tooltip', `${labels[idx]} (${color})`);
      swatch.setAttribute('aria-label', `${labels[idx]} ${color}`);
      swatch.style.backgroundColor = color;

      swatch.addEventListener('click', () => {
        this.handleColorPicked(color);
      }, { signal: this.host.abortController.signal });

      this.host.colorsRampGridEl?.appendChild(swatch);
    });
  }

  public renderRecentColors(): void {
    if (!this.host.colorsRecentGridEl) return;
    this.host.colorsRecentGridEl.innerHTML = '';

    const currentVal = (this.host.colorPanelTarget === 'fill' ? this.host.currentFillColor : this.host.currentColor).toUpperCase();

    for (const color of this.host.recentColors) {
      const swatch = document.createElement('button');
      swatch.type = 'button';
      swatch.className = `design-color-swatch-btn ${color.toUpperCase() === currentVal ? 'is-active' : ''}`;
      swatch.setAttribute('data-ref', `color-recent-${color.replace('#', '')}`);
      swatch.setAttribute('data-color', color);
      swatch.setAttribute('data-tooltip', color);
      swatch.setAttribute('aria-label', `Color reciente ${color}`);
      swatch.style.backgroundColor = color;

      swatch.addEventListener('click', () => {
        this.handleColorPicked(color);
      }, { signal: this.host.abortController.signal });

      this.host.colorsRecentGridEl.appendChild(swatch);
    }
  }

  public handleColorPicked(color: string): void {
    const selectedEls = this.host.getSelectedElements();
    if (selectedEls.length === 1 && selectedEls[0].type === 'sticky' && this.host.colorPanelTarget !== 'text') {
      this.setFill(color, true);
    } else if (this.host.colorPanelTarget === 'fill') {
      this.setFill(color, true);
    } else if (this.host.colorPanelTarget === 'text') {
      this.setTextColor(color, true);
    } else {
      this.setColor(color, true);
    }
    this.updateColorPanelUI(color);
  }

  public toggleColorsPanel(target: 'stroke' | 'fill' | 'text'): void {
    if (isColorsDrawerOpen() && this.host.colorPanelTarget === target) {
      toggleDrawer(false);
      return;
    }

    this.host.closeAllPopovers();
    this.hideFontsPanel();
    this.host.colorPanelTarget = target;
    openColorsInDrawer(target);
  }

  public hideColorsPanel(): void {
    if (isColorsDrawerOpen()) {
      toggleDrawer(false);
    }
  }

  public attachFontsUI(fontsContainer: HTMLElement): void {
    if (this.host.fontPicker) {
      this.host.fontPicker.destroy();
    }
    this.host.fontPicker = new DocFontPickerComponent(fontsContainer, (event: FontSelectEvent) => {
      this.applyFontToSelection(event);
    });

    const selectedEls = this.host.getSelectedElements();
    const firstWithFont = selectedEls.find((el) => 'fontFamily' in el && (el as any).fontFamily);
    const family = firstWithFont && (firstWithFont as any).fontFamily
      ? (firstWithFont as any).fontFamily.split(',')[0].replace(/['"]/g, '').trim()
      : 'Inter';
    const weight = firstWithFont && (firstWithFont as any).fontWeight ? (firstWithFont as any).fontWeight : 600;
    const style = firstWithFont && (firstWithFont as any).fontStyle ? (firstWithFont as any).fontStyle : 'normal';

    this.host.fontPicker.init(family);
    this.host.fontPicker.setActiveFont(family, weight, style);
  }

  public toggleFontsPanel(): void {
    if (isFontsDrawerOpen()) {
      toggleDrawer(false);
    } else {
      this.openFontsPanel();
    }
  }

  public openFontsPanel(): void {
    this.host.closeAllPopovers();
    openFontsInDrawer();
  }

  public hideFontsPanel(): void {
    if (isFontsDrawerOpen()) {
      toggleDrawer(false);
    }
  }

  public attachPixelAnimationUI(container: HTMLElement): void {
    if (this.host.pixelPanel) {
      this.host.pixelPanel.destroy();
    }
    this.host.pixelPanel = new BoardPixelPanelComponent({
      onChange: () => {
        const grid = this.getSelectedPixelGrid();
        if (grid) {
          this.host.pixelGrid.serializeElementState(grid);
          this.host.requestRedraw();
          this.host.collaborationManager.broadcastUpdateElement(grid);
          this.host.scheduleAutoSave();
        }
      },
    });

    let grid = this.getSelectedPixelGrid();
    if (!grid) {
      grid = this.host.elements.find((el): el is BoardPixelGridElement => el.type === 'pixel-grid') || null;
      if (grid) {
        this.host.selectedElementId = grid.id;
        this.host.selectedElementIds = [grid.id];
        this.host.updateSelectionToolbar();
      }
    }

    if (!grid) {
      container.innerHTML = `
        <div class="pixel-panel-container">
          <div class="pixel-panel-section">
            <div class="pixel-panel-header">
              <span class="pixel-panel-title">Capas y Animación</span>
            </div>
            <p style="font-size: 12px; color: var(--text-secondary, #64748b); line-height: 1.4; margin: 8px 0;">Selecciona una cuadrícula de píxeles en el lienzo o inserta una nueva para gestionar sus capas y fotogramas.</p>
            <button type="button" class="component-button component-button--h36 component-button--primary" data-ref="btn-panel-insert-pixel">
              <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#add_box"></use></svg>
              <span>Insertar cuadrícula de píxel</span>
            </button>
          </div>
        </div>
      `;
      renderIcons(container);
      const btnInsert = container.querySelector<HTMLButtonElement>('[data-ref="btn-panel-insert-pixel"]');
      btnInsert?.addEventListener('click', () => {
        openInsertPixelGridModal({
          onInsert: (cfg) => {
            this.host.insertPixelGrid(cfg);
            setTimeout(() => {
              if (isPixelAnimationDrawerOpen()) {
                this.attachPixelAnimationUI(container);
              }
            }, 50);
          },
        });
      }, { signal: this.host.abortController.signal });
      return;
    }

    this.host.pixelPanel.attach(container, grid, this.host.pixelGrid);
  }

  public getSelectedPixelGrid(): BoardPixelGridElement | null {
    const selectedEls = this.host.getSelectedElements();
    if (selectedEls.length === 1 && selectedEls[0].type === 'pixel-grid') {
      return selectedEls[0] as BoardPixelGridElement;
    }
    return null;
  }

  public togglePixelAnimationPanel(): void {
    if (isPixelAnimationDrawerOpen()) {
      toggleDrawer(false);
    } else {
      this.openPixelAnimationPanel();
    }
  }

  public openPixelAnimationPanel(): void {
    this.host.closeAllPopovers();
    this.hideFontsPanel();
    this.hideColorsPanel();
    openPixelAnimationInDrawer();
  }

  public hidePixelAnimationPanel(): void {
    if (isPixelAnimationDrawerOpen()) {
      toggleDrawer(false);
    }
  }

  public applyFontToSelection(event: FontSelectEvent): void {
    const selectedEls = this.host.getSelectedElements();
    if (selectedEls.length === 0) return;

    const fullFamily = `${event.family}, ${event.fallback}`;
    ensureGoogleFontLoaded(fullFamily);

    this.host.pushHistoryState();
    let hasChanged = false;

    selectedEls.forEach((el) => {
      if (el.type === 'text' || el.type === 'sticky' || el.type === 'shape') {
        el.fontFamily = fullFamily;
        if (event.weight) el.fontWeight = event.weight;
        if (event.style === 'italic' || event.style === 'normal') el.fontStyle = event.style;
        if (el.type === 'text') {
          const sz = measureTextElementSize(el.text, el.fontSize, el.fontWeight || 600, el.fontFamily);
          el.width = sz.width;
          el.height = sz.height;
        }
        this.host.collaborationManager.broadcastUpdateElement(el);
        hasChanged = true;
      }
    });

    if (hasChanged) {
      this.host.requestRedraw();
      this.host.scheduleAutoSave();
      this.host.updateContextualToolbar();
    }

    if (this.host.fontPicker) {
      this.host.fontPicker.setActiveFont(event.family, event.weight || 600, event.style || 'normal');
    }
  }

  public updateColorPanelUI(color: string): void {
    const normalized = color.toLowerCase() === 'transparent' ? 'transparent' : color.toUpperCase();
    const displayColor = normalized === 'transparent' ? 'TRANSPARENTE' : normalized;

    if (this.host.colorsHexTextEl) this.host.colorsHexTextEl.textContent = displayColor;
    if (this.host.colorsCustomInputEl) {
      if (normalized !== 'transparent' && /^#[0-9A-Fa-f]{6}$/.test(normalized)) {
        this.host.colorsCustomInputEl.value = normalized;
      }
    }

    const vdrawSwatch = this.host.container.querySelector<HTMLElement>('[data-ref="vdraw-color-swatch"]');
    if (vdrawSwatch) {
      vdrawSwatch.style.backgroundColor = normalized === 'transparent' ? '#1e293b' : normalized;
    }

    this.renderShadingRamps();
    this.updateActiveColorSwatches(normalized);
  }

  public updateActiveColorSwatches(activeColor: string): void {
    const active = activeColor.toUpperCase();
    if (!this.host.colorsPanelEl) return;
    this.host.colorsPanelEl.querySelectorAll<HTMLButtonElement>('.design-color-swatch-btn').forEach((btn) => {
      const color = btn.getAttribute('data-color')?.toUpperCase();
      btn.classList.toggle('is-active', color === active);
    });
  }

  public setColor(color: string, recordRecent = true): void {
    const normalized = color.toLowerCase() === 'transparent' ? 'transparent' : color.toUpperCase();
    this.host.currentColor = normalized;
    const swatchCircle = this.host.container.querySelector<HTMLElement>('[data-ref="color-swatch-circle"]');
    if (swatchCircle) {
      if (normalized === 'transparent') {
        swatchCircle.style.background = 'linear-gradient(45deg, #ef4444 45%, transparent 45%, transparent 55%, #ef4444 55%)';
      } else {
        swatchCircle.style.background = normalized;
      }
    }
    if (recordRecent && normalized !== 'transparent' && /^#[0-9A-Fa-f]{6}$/.test(normalized)) {
      this.host.recentColors = [normalized, ...this.host.recentColors.filter((c) => c.toUpperCase() !== normalized)].slice(0, 12);
      this.saveRecentColors();
      this.renderRecentColors();
    }
    const selectedEls = this.host.getSelectedElements();
    if (selectedEls.length > 0) {
      this.host.pushHistoryState();
      for (const el of selectedEls) {
        if (el.type === 'stroke') el.color = normalized;
        if (el.type === 'shape') {
          el.strokeColor = normalized;
          if (el.strokeWidth === 0) el.strokeWidth = 2;
        }
        if (el.type === 'image') {
          el.strokeColor = normalized;
          if (!el.strokeWidth || el.strokeWidth === 0) el.strokeWidth = 2;
        }
        if (el.type === 'shape-3d') {
          el.strokeColor = normalized;
          if (el.strokeWidth === 0) el.strokeWidth = 1.5;
        }
        if (el.type === 'connector') el.color = normalized;
        if (el.type === 'text') el.color = normalized;
        if (el.type === 'sticky') el.color = normalized;
        this.host.collaborationManager.broadcastUpdateElement(el);
      }
      this.host.requestRedraw();
      this.host.scheduleAutoSave();
      this.host.updateContextualToolbar();
    }
  }

  public setFill(color: string, recordRecent = true): void {
    const normalized = color.toLowerCase() === 'transparent' ? 'transparent' : color.toUpperCase();
    this.host.currentFillColor = normalized;
    const swatchCircle = this.host.container.querySelector<HTMLElement>('[data-ref="fill-swatch-circle"]');
    if (swatchCircle) {
      if (normalized === 'transparent') {
        swatchCircle.style.background = 'linear-gradient(45deg, #ef4444 45%, transparent 45%, transparent 55%, #ef4444 55%)';
      } else {
        swatchCircle.style.background = normalized;
      }
    }
    if (recordRecent && normalized !== 'transparent' && /^#[0-9A-Fa-f]{6}$/.test(normalized)) {
      this.host.recentColors = [normalized, ...this.host.recentColors.filter((c) => c.toUpperCase() !== normalized)].slice(0, 12);
      this.saveRecentColors();
      this.renderRecentColors();
    }
    const selectedEls = this.host.getSelectedElements();
    if (selectedEls.length > 0) {
      this.host.pushHistoryState();
      for (const el of selectedEls) {
        if (el.type === 'shape') {
          el.fillColor = normalized;
        } else if (el.type === 'shape-3d') {
          el.fillColor = normalized;
        } else if (el.type === 'sticky') {
          el.color = normalized;
        } else if (el.type === 'image') {
          el.fillColor = normalized;
        }
        this.host.collaborationManager.broadcastUpdateElement(el);
      }
      this.host.requestRedraw();
      this.host.scheduleAutoSave();
      this.host.updateContextualToolbar();
    }
  }

  public setTextColor(color: string, recordRecent = true): void {
    const normalized = color.toLowerCase() === 'transparent' ? 'transparent' : color.toUpperCase();
    if (recordRecent && normalized !== 'transparent' && /^#[0-9A-Fa-f]{6}$/.test(normalized)) {
      this.host.recentColors = [normalized, ...this.host.recentColors.filter((c) => c.toUpperCase() !== normalized)].slice(0, 12);
      this.saveRecentColors();
      this.renderRecentColors();
    }
    const selectedEls = this.host.getSelectedElements();
    if (selectedEls.length > 0) {
      this.host.pushHistoryState();
      for (const el of selectedEls) {
        if (el.type === 'text') el.color = normalized;
        if (el.type === 'sticky') el.textColor = normalized;
        if (el.type === 'shape') el.textColor = normalized;
        if (el.type === 'connector') el.color = normalized;
        this.host.collaborationManager.broadcastUpdateElement(el);
      }
      this.host.requestRedraw();
      this.host.scheduleAutoSave();
      this.host.updateContextualToolbar();
    }
  }

  public setStrokeWidth(w: number): void {
    this.host.currentStrokeWidth = w;
    const label = this.host.container.querySelector<HTMLElement>('[data-ref="width-label"]');
    const dot = this.host.container.querySelector<HTMLElement>('[data-ref="width-dot-indicator"]');
    if (label) label.textContent = `${w}px`;
    if (dot) {
      dot.style.width = `${Math.min(14, Math.max(3, w))}px`;
      dot.style.height = `${Math.min(14, Math.max(3, w))}px`;
    }
    this.host.container.querySelectorAll('[data-width]').forEach((opt) => {
      opt.classList.toggle('is-active', parseInt(opt.getAttribute('data-width') || '0', 10) === w);
    });

    const selectedEls = this.host.getSelectedElements();
    if (selectedEls.length > 0) {
      this.host.pushHistoryState();
      for (const el of selectedEls) {
        if (el.type === 'stroke') el.size = w;
        if (el.type === 'shape') el.strokeWidth = w;
        if (el.type === 'shape-3d') el.strokeWidth = w;
        if (el.type === 'connector') el.strokeWidth = w;
        this.host.collaborationManager.broadcastUpdateElement(el);
      }
      this.host.requestRedraw();
      this.host.scheduleAutoSave();
    }
  }
}
