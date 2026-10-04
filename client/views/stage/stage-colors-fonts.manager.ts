import { isColorsDrawerOpen, isFontsDrawerOpen, openColorsInDrawer, openFontsInDrawer, toggleDrawer } from '../../components/layout.component.js';
import { showToast } from '../../services/toast.service.js';
import { PresentationSlideItem } from '../../types/stage.types.js';
import { DEFAULT_CLASSIC_PALETTE, generateShadingRamp } from '../../utils/color.util.js';
import { measureTextElementSize } from '../board/board-elements.manager.js';
import { BoardElement } from '../board/board.types.js';
import { DocFontPickerComponent, FontSelectEvent } from '../doc/doc-font-picker.component.js';

export interface StageColorsFontsHost {
  activeSlideId: string;
  btnColorEyedropper: HTMLButtonElement | null;
  canvas: HTMLCanvasElement | null;
  closeAllPopovers(): void;
  collaborationManager: any;
  colorPanelTarget: 'fill' | 'slide-bg' | 'stroke' | 'text';
  colorsCustomInputEl: HTMLInputElement | null;
  colorsHexTextEl: HTMLElement | null;
  colorsPaletteGridEl: HTMLElement | null;
  colorsPanelEl: HTMLElement | null;
  colorsRampGridEl: HTMLElement | null;
  colorsRecentGridEl: HTMLElement | null;
  colorsTitleEl: HTMLElement | null;
  container: HTMLElement;
  currentFillColor: string;
  currentStrokeColor: string;
  fontPicker: DocFontPickerComponent | null;
  getActiveSlide(): PresentationSlideItem;
  getFirstSelectedElement(): BoardElement | null;
  isEyedropperActive: boolean;
  recentColors: string[];
  render(): void;
  renderSlidesTray(): void;
  saveHistoryState(): void;
  scheduleAutoSave(): void;
  selectedElementIds: Set<string>;
  updateSelectionToolbar(): void;
}

export class StageColorsFontsManager {
  private host: StageColorsFontsHost;

  constructor(host: StageColorsFontsHost) {
    this.host = host;
  }

  public attachColorsUI(drawerBody: HTMLElement, target?: 'fill' | 'slide-bg' | 'stroke' | 'text'): void {
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
      if (this.host.colorPanelTarget === 'slide-bg') {
        this.host.colorsTitleEl.textContent = 'Color de fondo de la diapositiva';
      } else if (this.host.colorPanelTarget === 'stroke') {
        this.host.colorsTitleEl.textContent = 'Color de trazo o borde';
      } else if (this.host.colorPanelTarget === 'text') {
        this.host.colorsTitleEl.textContent = 'Color de texto';
      } else {
        this.host.colorsTitleEl.textContent = 'Color de relleno';
      }
    }

    this.host.btnColorEyedropper?.addEventListener('click', () => {
      this.toggleEyedropper();
    });

    this.host.colorsCustomInputEl?.addEventListener('input', (e) => {
      const val = (e.target as HTMLInputElement).value;
      if (val) {
        this.handleColorPicked(val);
      }
    });

    const transparentSwatch = drawerBody.querySelector<HTMLButtonElement>('[data-ref="color-swatch-transparent"]');
    transparentSwatch?.addEventListener('click', () => {
      this.handleColorPicked('transparent');
    });

    this.loadRecentColors();
    this.renderDefaultPalette();
    this.renderRecentColors();

    let currentVal = this.host.currentFillColor;
    if (this.host.colorPanelTarget === 'slide-bg') {
      currentVal = this.host.getActiveSlide().background?.color || '#ffffff';
    } else if (this.host.colorPanelTarget === 'stroke') {
      currentVal = this.host.currentStrokeColor;
    }
    const firstSelected = this.host.getFirstSelectedElement();
    if (firstSelected && this.host.colorPanelTarget !== 'slide-bg') {
      if (this.host.colorPanelTarget === 'fill' && 'fillColor' in firstSelected) currentVal = (firstSelected as any).fillColor;
      else if (this.host.colorPanelTarget === 'stroke' && 'strokeColor' in firstSelected) currentVal = (firstSelected as any).strokeColor;
      else if (this.host.colorPanelTarget === 'text' && ('color' in firstSelected || 'textColor' in firstSelected)) currentVal = (firstSelected as any).color || (firstSelected as any).textColor;
    }
    this.updateColorPanelUI(currentVal);
  }

  public attachFontsUI(fontsContainer: HTMLElement): void {
    if (this.host.fontPicker) {
      this.host.fontPicker.destroy();
    }
    this.host.fontPicker = new DocFontPickerComponent(fontsContainer, (event: FontSelectEvent) => {
      this.applyFontToSelection(event);
    });

    const firstSelected = this.host.getFirstSelectedElement();
    const family = firstSelected && 'fontFamily' in firstSelected && (firstSelected as any).fontFamily ? (firstSelected as any).fontFamily.split(',')[0].replace(/['"]/g, '').trim() : 'Inter';
    const weight = firstSelected && 'fontWeight' in firstSelected ? (firstSelected as any).fontWeight : 600;
    const style = firstSelected && 'fontStyle' in firstSelected ? (firstSelected as any).fontStyle : 'normal';

    this.host.fontPicker.init(family);
    this.host.fontPicker.setActiveFont(family, weight, style);
  }

  public applyFontToSelection(event: FontSelectEvent): void {
    if (this.host.selectedElementIds.size === 0) return;
    this.host.saveHistoryState();
    const elements = this.host.getActiveSlide().elements;
    elements.forEach((el) => {
      if (this.host.selectedElementIds.has(el.id)) {
        if ('fontFamily' in el) (el as any).fontFamily = event.family;
        if ('fontWeight' in el) (el as any).fontWeight = event.weight;
        if ('fontStyle' in el) (el as any).fontStyle = event.style;
        if (el.type === 'text') {
          const measured = measureTextElementSize((el as any).text, (el as any).fontSize || 20, (el as any).fontWeight || 600, event.family);
          (el as any).width = measured.width;
          (el as any).height = measured.height;
        }
        this.host.collaborationManager.broadcastUpdateElement(el, this.host.activeSlideId);
      }
    });

    const fontLabel = this.host.container.querySelector<HTMLElement>('[data-ref="top-font-family-label"]');
    if (fontLabel) fontLabel.textContent = event.variantName || event.family;

    this.host.render();
    this.host.scheduleAutoSave();
  }

  public setColor(color: string, saveHistory = true): void {
    this.host.currentStrokeColor = color;
    if (saveHistory) this.host.saveHistoryState();
    const elements = this.host.getActiveSlide().elements;
    elements.forEach((el) => {
      if (this.host.selectedElementIds.has(el.id)) {
        if ('strokeColor' in el) (el as any).strokeColor = color;
        if (el.type === 'stroke') (el as any).color = color;
        if (el.type === 'image') {
          (el as any).strokeColor = color;
          if (!(el as any).strokeWidth) (el as any).strokeWidth = 2;
        }
        this.host.collaborationManager.broadcastUpdateElement(el, this.host.activeSlideId);
      }
    });
    this.host.updateSelectionToolbar();
    this.host.render();
    this.host.scheduleAutoSave();
  }

  public setFill(color: string, saveHistory = true): void {
    this.host.currentFillColor = color;
    if (saveHistory) this.host.saveHistoryState();
    const elements = this.host.getActiveSlide().elements;
    elements.forEach((el) => {
      if (this.host.selectedElementIds.has(el.id)) {
        if ('fillColor' in el) (el as any).fillColor = color;
        if ('color' in el && el.type === 'sticky') (el as any).color = color;
        if (el.type === 'image') {
          (el as any).fillColor = color;
          (el as any).isSvg = true;
        }
        this.host.collaborationManager.broadcastUpdateElement(el, this.host.activeSlideId);
      }
    });
    this.host.updateSelectionToolbar();
    this.host.render();
    this.host.scheduleAutoSave();
  }

  public setSlideBackground(color: string, saveHistory = true): void {
    if (saveHistory) this.host.saveHistoryState();
    const currentSlide = this.host.getActiveSlide();
    if (!currentSlide.background) {
      currentSlide.background = { color, dotColor: '#cbd5e1', type: 'solid' };
    } else {
      currentSlide.background.color = color;
    }
    const bgSwatch = this.host.container.querySelector<HTMLElement>('[data-ref="top-slide-bg-swatch"]');
    if (bgSwatch) {
      bgSwatch.style.backgroundColor = color;
    }
    this.host.render();
    this.host.renderSlidesTray();
    this.host.scheduleAutoSave();
    this.host.collaborationManager.broadcastUpdateBackground(currentSlide.background, this.host.activeSlideId);
  }

  public setTextColor(color: string, saveHistory = true): void {
    if (saveHistory) this.host.saveHistoryState();
    const elements = this.host.getActiveSlide().elements;
    elements.forEach((el) => {
      if (this.host.selectedElementIds.has(el.id)) {
        if ('color' in el && el.type === 'text') (el as any).color = color;
        if ('textColor' in el) (el as any).textColor = color;
        this.host.collaborationManager.broadcastUpdateElement(el, this.host.activeSlideId);
      }
    });
    this.host.updateSelectionToolbar();
    this.host.render();
    this.host.scheduleAutoSave();
  }

  public toggleColorsPanel(target: 'fill' | 'slide-bg' | 'stroke' | 'text'): void {
    if (isColorsDrawerOpen() && this.host.colorPanelTarget === target) {
      toggleDrawer(false);
      return;
    }
    this.host.closeAllPopovers();
    this.host.colorPanelTarget = target;
    openColorsInDrawer(target);
  }

  public toggleFontsPanel(): void {
    if (isFontsDrawerOpen()) {
      toggleDrawer(false);
    } else {
      this.host.closeAllPopovers();
      openFontsInDrawer();
    }
  }

  public handleColorPicked(color: string): void {
    if (this.host.colorPanelTarget === 'slide-bg') {
      this.setSlideBackground(color, true);
    } else if (this.host.colorPanelTarget === 'fill') {
      this.setFill(color, true);
    } else if (this.host.colorPanelTarget === 'text') {
      this.setTextColor(color, true);
    } else {
      this.setColor(color, true);
    }
    this.addRecentColor(color);
    this.updateColorPanelUI(color);
  }

  public updateColorPanelUI(color: string): void {
    if (this.host.colorsHexTextEl) {
      this.host.colorsHexTextEl.textContent = color.toUpperCase();
    }
    if (this.host.colorsCustomInputEl && color.startsWith('#')) {
      this.host.colorsCustomInputEl.value = color;
    }
    this.renderShadingRamps();
  }

  public renderDefaultPalette(): void {
    if (!this.host.colorsPaletteGridEl) return;
    this.host.colorsPaletteGridEl.innerHTML = '';
    const currentActiveColor = (this.host.colorPanelTarget === 'slide-bg' ? (this.host.getActiveSlide().background?.color || '#ffffff') : (this.host.colorPanelTarget === 'fill' ? this.host.currentFillColor : this.host.currentStrokeColor)).toUpperCase();

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
      });

      this.host.colorsPaletteGridEl.appendChild(swatch);
    }
  }

  public renderShadingRamps(): void {
    if (!this.host.colorsRampGridEl) return;
    this.host.colorsRampGridEl.innerHTML = '';
    const currentVal = this.host.colorPanelTarget === 'slide-bg' ? (this.host.getActiveSlide().background?.color || '#ffffff') : (this.host.colorPanelTarget === 'fill' ? this.host.currentFillColor : this.host.currentStrokeColor);
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
      });

      this.host.colorsRampGridEl?.appendChild(swatch);
    });
  }

  public renderRecentColors(): void {
    if (!this.host.colorsRecentGridEl) return;
    this.host.colorsRecentGridEl.innerHTML = '';
    const currentVal = (this.host.colorPanelTarget === 'slide-bg' ? (this.host.getActiveSlide().background?.color || '#ffffff') : (this.host.colorPanelTarget === 'fill' ? this.host.currentFillColor : this.host.currentStrokeColor)).toUpperCase();

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
      });

      this.host.colorsRecentGridEl.appendChild(swatch);
    }
  }

  public addRecentColor(color: string): void {
    if (!color || color === 'transparent') return;
    const clean = color.toUpperCase();
    this.host.recentColors = [clean, ...this.host.recentColors.filter((c) => c.toUpperCase() !== clean)].slice(0, 16);
    this.saveRecentColors();
    this.renderRecentColors();
  }

  public loadRecentColors(): void {
    try {
      const saved = localStorage.getItem('spriteboard_recent_colors');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          this.host.recentColors = parsed;
        }
      }
    } catch {}
  }

  public saveRecentColors(): void {
    try {
      localStorage.setItem('spriteboard_recent_colors', JSON.stringify(this.host.recentColors.slice(0, 16)));
    } catch {}
  }

  public toggleEyedropper(active?: boolean): void {
    this.host.isEyedropperActive = active !== undefined ? active : !this.host.isEyedropperActive;
    if (this.host.btnColorEyedropper) {
      this.host.btnColorEyedropper.classList.toggle('is-active', this.host.isEyedropperActive);
    }
    if (this.host.canvas) {
      this.host.canvas.style.cursor = this.host.isEyedropperActive ? 'crosshair' : 'default';
    }
    if (this.host.isEyedropperActive) {
      showToast('Cuentagotas activo: haz clic en cualquier elemento del lienzo para copiar su color', 'info');
    }
  }
}
