import { renderIcons } from '../../services/icon.service.js';
import { BoardEffectType, BoardElement, BoardElementEffect } from './board.types.js';

export interface BoardEffectsPanelCallbacks {
  onApplyEffect: (effect: BoardElementEffect) => void;
  onClose: () => void;
}

interface EffectPresetItem {
  description: string;
  icon: string;
  id: BoardEffectType;
  name: string;
}

const BASIC_EFFECTS: EffectPresetItem[] = [
  { description: 'Sin efectos aplicados', icon: 'block', id: 'none', name: 'Ninguno' },
  { description: 'Sombra paralela suave', icon: 'filter_drama', id: 'shadow', name: 'Soltar' },
  { description: 'Resplandor envolvente', icon: 'flare', id: 'glow', name: 'Brillo' },
  { description: 'Efecto de doble contorno', icon: 'burst_mode', id: 'echo', name: 'Eco' },
  { description: 'Desplazamiento cromático', icon: 'broken_image', id: 'glitch', name: 'Distorsión' },
  { description: 'Luz de neón intensa', icon: 'lightbulb', id: 'neon', name: 'Neón' },
];

const ADVANCED_EFFECTS: EffectPresetItem[] = [
  { description: 'Verde radiactivo intenso', icon: 'science', id: 'radioactive', name: 'Radioactivo' },
  { description: 'Tono sepia y cálido vintage', icon: 'photo_camera_back', id: 'retro', name: 'Retro' },
  { description: 'Azul nocturno profundo', icon: 'bedtime', id: 'midnight', name: 'Medianoche' },
  { description: 'Cian y turquesa tropical', icon: 'waves', id: 'malibu', name: 'Malibú' },
  { description: 'Separación RGB cromática', icon: 'palette', id: 'chroma', name: 'Chroma' },
  { description: 'Verde matrix digital', icon: 'terminal', id: 'digital', name: 'Digital' },
  { description: 'Aura pastel suave', icon: 'blur_on', id: 'aura', name: 'Aura' },
  { description: 'Líneas y ruido de videocasete', icon: 'videocam', id: 'vhs', name: 'VHS' },
  { description: 'Degradado atardecer magenta', icon: 'wb_twilight', id: 'sunset', name: 'Atardecer' },
];

const EFFECT_COLORS = ['#000000', '#ffffff', '#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899'];

export class BoardEffectsPanelComponent {
  private abortController: AbortController | null = null;
  private activeEffect: BoardElementEffect = { type: 'none' };
  private callbacks: BoardEffectsPanelCallbacks;
  private containerEl: HTMLElement | null = null;
  private panelEl: HTMLElement | null = null;

  constructor(container: HTMLElement, callbacks: BoardEffectsPanelCallbacks) {
    this.containerEl = container;
    this.callbacks = callbacks;
  }

  public init(): void {
    if (!this.containerEl) return;
    this.panelEl = this.containerEl.querySelector<HTMLElement>('[data-ref="board-effects-drawer"]');
    if (!this.panelEl) return;

    this.bindEvents();
    this.renderPresets();
  }

  public attach(panelEl: HTMLElement): void {
    this.panelEl = panelEl;
    this.bindEvents();
    this.renderPresets();
  }

  public open(currentElement?: BoardElement | null): void {
    if (!this.panelEl) return;
    this.panelEl.classList.remove('is-hidden');
    this.sync(currentElement || null);
  }

  public close(): void {
    if (this.panelEl) {
      this.panelEl.classList.add('is-hidden');
    }
  }

  public isOpen(): boolean {
    return !!this.panelEl && !this.panelEl.classList.contains('is-hidden');
  }

  public toggle(currentElement?: BoardElement | null): void {
    if (this.isOpen()) {
      this.close();
    } else {
      this.open(currentElement);
    }
  }

  public sync(element: BoardElement | null): void {
    if (!element) {
      this.activeEffect = { type: 'none' };
    } else if (element.effect) {
      this.activeEffect = { ...element.effect };
    } else {
      this.activeEffect = { type: 'none' };
    }

    this.updateActivePresetHighlight();
    this.renderEffectSubcontrols();
  }

  public destroy(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    this.panelEl = null;
    this.containerEl = null;
  }

  private bindEvents(): void {
    if (this.abortController) {
      this.abortController.abort();
    }
    this.abortController = new AbortController();
    const { signal } = this.abortController;

    const btnClose = this.panelEl?.querySelector<HTMLButtonElement>('[data-ref="btn-close-effects-drawer"], [data-ref="btn-close-canvas-panel"]');
    btnClose?.addEventListener('click', () => {
      this.close();
      this.callbacks.onClose();
    }, { signal });
  }

  private renderPresets(): void {
    if (!this.panelEl) return;

    const basicContainer = this.panelEl.querySelector<HTMLElement>('[data-ref="effects-basic-grid"]');
    if (basicContainer) {
      basicContainer.innerHTML = '';
      for (const item of BASIC_EFFECTS) {
        const btn = document.createElement('button');
        btn.setAttribute('type', 'button');
        btn.className = `board-effect-card canva-effect-card${this.activeEffect.type === item.id ? ' is-active' : ''}`;
        btn.setAttribute('data-ref', `effect-card-${item.id}`);
        btn.setAttribute('data-tooltip', item.description);

        const iconWrap = document.createElement('div');
        iconWrap.className = 'board-effect-card__preview canva-effect-card__preview';
        const iconSpan = document.createElement('span');
        iconSpan.className = 'component-icon';
        iconSpan.textContent = item.icon;
        iconWrap.appendChild(iconSpan);

        const label = document.createElement('span');
        label.className = 'board-effect-card__label canva-effect-card__label';
        label.textContent = item.name;

        btn.appendChild(iconWrap);
        btn.appendChild(label);

        btn.addEventListener('click', () => {
          this.selectEffectType(item.id);
        });

        basicContainer.appendChild(btn);
      }
    }

    const advancedContainer = this.panelEl.querySelector<HTMLElement>('[data-ref="effects-advanced-grid"]');
    if (advancedContainer) {
      advancedContainer.innerHTML = '';
      for (const item of ADVANCED_EFFECTS) {
        const btn = document.createElement('button');
        btn.setAttribute('type', 'button');
        btn.className = `board-effect-card canva-effect-card${this.activeEffect.type === item.id ? ' is-active' : ''}`;
        btn.setAttribute('data-ref', `effect-card-${item.id}`);
        btn.setAttribute('data-tooltip', item.description);

        const iconWrap = document.createElement('div');
        iconWrap.className = 'board-effect-card__preview canva-effect-card__preview board-effect-card__preview--filter canva-effect-card__preview--filter';
        const iconSpan = document.createElement('span');
        iconSpan.className = 'component-icon';
        iconSpan.textContent = item.icon;
        iconWrap.appendChild(iconSpan);

        const label = document.createElement('span');
        label.className = 'board-effect-card__label canva-effect-card__label';
        label.textContent = item.name;

        btn.appendChild(iconWrap);
        btn.appendChild(label);

        btn.addEventListener('click', () => {
          this.selectEffectType(item.id);
        });

        advancedContainer.appendChild(btn);
      }
    }

    if (this.panelEl) {
      renderIcons(this.panelEl);
    }
  }

  private selectEffectType(type: BoardEffectType): void {
    if (type === 'none') {
      this.activeEffect = { type: 'none' };
    } else if (type === 'shadow') {
      this.activeEffect = {
        blur: this.activeEffect.blur !== undefined ? this.activeEffect.blur : 16,
        color: this.activeEffect.color || 'rgba(0, 0, 0, 0.45)',
        direction: this.activeEffect.direction !== undefined ? this.activeEffect.direction : 45,
        offset: this.activeEffect.offset !== undefined ? this.activeEffect.offset : 20,
        opacity: this.activeEffect.opacity !== undefined ? this.activeEffect.opacity : 60,
        type: 'shadow',
      };
    } else if (type === 'glow') {
      this.activeEffect = {
        blur: this.activeEffect.blur !== undefined ? this.activeEffect.blur : 24,
        color: this.activeEffect.color || '#3b82f6',
        intensity: this.activeEffect.intensity !== undefined ? this.activeEffect.intensity : 75,
        type: 'glow',
      };
    } else if (type === 'echo') {
      this.activeEffect = {
        color: this.activeEffect.color || '#6366f1',
        direction: this.activeEffect.direction !== undefined ? this.activeEffect.direction : 30,
        offset: this.activeEffect.offset !== undefined ? this.activeEffect.offset : 12,
        type: 'echo',
      };
    } else if (type === 'glitch') {
      this.activeEffect = {
        direction: this.activeEffect.direction !== undefined ? this.activeEffect.direction : 0,
        offset: this.activeEffect.offset !== undefined ? this.activeEffect.offset : 8,
        type: 'glitch',
      };
    } else if (type === 'neon') {
      this.activeEffect = {
        blur: this.activeEffect.blur !== undefined ? this.activeEffect.blur : 32,
        color: this.activeEffect.color || '#ec4899',
        intensity: this.activeEffect.intensity !== undefined ? this.activeEffect.intensity : 85,
        type: 'neon',
      };
    } else {
      this.activeEffect = {
        intensity: 80,
        type,
      };
    }

    this.updateActivePresetHighlight();
    this.renderEffectSubcontrols();
    this.callbacks.onApplyEffect({ ...this.activeEffect });
  }

  private updateActivePresetHighlight(): void {
    if (!this.panelEl) return;
    this.panelEl.querySelectorAll<HTMLButtonElement>('.board-effect-card, .canva-effect-card').forEach((btn) => {
      const isCurrent = btn.getAttribute('data-ref') === `effect-card-${this.activeEffect.type}`;
      btn.classList.toggle('is-active', isCurrent);
    });
  }

  private renderEffectSubcontrols(): void {
    if (!this.panelEl) return;
    const subcontrolsContainer = this.panelEl.querySelector<HTMLElement>('[data-ref="effects-subcontrols-container"]');
    if (!subcontrolsContainer) return;

    if (this.activeEffect.type === 'none') {
      subcontrolsContainer.innerHTML = '';
      subcontrolsContainer.classList.add('is-hidden');
      return;
    }

    subcontrolsContainer.classList.remove('is-hidden');
    subcontrolsContainer.innerHTML = '';

    const titleEl = document.createElement('div');
    titleEl.className = 'elements-section-title canva-drawer-section-title';
    titleEl.textContent = 'Ajustes del efecto';
    subcontrolsContainer.appendChild(titleEl);

    if (this.activeEffect.offset !== undefined) {
      this.createSliderControl(subcontrolsContainer, 'Desplazamiento', 0, 100, this.activeEffect.offset, (val) => {
        this.activeEffect.offset = val;
        this.callbacks.onApplyEffect({ ...this.activeEffect });
      });
    }

    if (this.activeEffect.direction !== undefined) {
      this.createSliderControl(subcontrolsContainer, 'Dirección (°)', -180, 180, this.activeEffect.direction, (val) => {
        this.activeEffect.direction = val;
        this.callbacks.onApplyEffect({ ...this.activeEffect });
      });
    }

    if (this.activeEffect.blur !== undefined) {
      this.createSliderControl(subcontrolsContainer, 'Desenfoque', 0, 100, this.activeEffect.blur, (val) => {
        this.activeEffect.blur = val;
        this.callbacks.onApplyEffect({ ...this.activeEffect });
      });
    }

    if (this.activeEffect.opacity !== undefined) {
      this.createSliderControl(subcontrolsContainer, 'Transparencia', 0, 100, this.activeEffect.opacity, (val) => {
        this.activeEffect.opacity = val;
        this.callbacks.onApplyEffect({ ...this.activeEffect });
      });
    }

    if (this.activeEffect.intensity !== undefined) {
      this.createSliderControl(subcontrolsContainer, 'Intensidad', 0, 100, this.activeEffect.intensity, (val) => {
        this.activeEffect.intensity = val;
        this.callbacks.onApplyEffect({ ...this.activeEffect });
      });
    }

    if (['echo', 'glow', 'neon', 'shadow'].includes(this.activeEffect.type)) {
      this.createColorPickerControl(subcontrolsContainer, this.activeEffect.color || '#000000', (col) => {
        this.activeEffect.color = col;
        this.callbacks.onApplyEffect({ ...this.activeEffect });
      });
    }
  }

  private createSliderControl(parent: HTMLElement, labelText: string, min: number, max: number, value: number, onChange: (val: number) => void): void {
    const row = document.createElement('div');
    row.className = 'board-drawer-slider-group canva-drawer-slider-group';

    const header = document.createElement('div');
    header.className = 'board-drawer-slider-header canva-drawer-slider-header';

    const label = document.createElement('span');
    label.className = 'board-drawer-slider-label canva-drawer-slider-label';
    label.textContent = labelText;

    const valBadge = document.createElement('span');
    valBadge.className = 'board-drawer-slider-val canva-drawer-slider-val';
    valBadge.textContent = `${value}`;

    header.appendChild(label);
    header.appendChild(valBadge);

    const slider = document.createElement('input');
    slider.className = 'board-popover-slider';
    slider.setAttribute('type', 'range');
    slider.setAttribute('min', `${min}`);
    slider.setAttribute('max', `${max}`);
    slider.setAttribute('value', `${value}`);
    slider.setAttribute('aria-label', labelText);

    slider.addEventListener('input', () => {
      const num = Number(slider.value);
      valBadge.textContent = `${num}`;
      onChange(num);
    });

    row.appendChild(header);
    row.appendChild(slider);
    parent.appendChild(row);
  }

  private createColorPickerControl(parent: HTMLElement, currentColor: string, onChange: (color: string) => void): void {
    const group = document.createElement('div');
    group.className = 'board-drawer-color-group canva-drawer-color-group';

    const label = document.createElement('span');
    label.className = 'board-drawer-slider-label canva-drawer-slider-label';
    label.textContent = 'Color del efecto';
    group.appendChild(label);

    const paletteRow = document.createElement('div');
    paletteRow.className = 'board-drawer-swatches-row canva-drawer-swatches-row';

    for (const hex of EFFECT_COLORS) {
      const swatch = document.createElement('button');
      swatch.setAttribute('type', 'button');
      swatch.className = `board-color-swatch-btn canva-color-swatch-btn${currentColor === hex ? ' is-active' : ''}`;
      swatch.style.backgroundColor = hex;
      swatch.setAttribute('data-tooltip', hex);
      swatch.setAttribute('aria-label', hex);

      swatch.addEventListener('click', () => {
        paletteRow.querySelectorAll('.canva-color-swatch-btn, .board-color-swatch-btn').forEach((b) => b.classList.remove('is-active'));
        swatch.classList.add('is-active');
        onChange(hex);
      });

      paletteRow.appendChild(swatch);
    }

    const nativeInput = document.createElement('input');
    nativeInput.className = 'board-color-native-input canva-color-native-input';
    nativeInput.setAttribute('type', 'color');
    nativeInput.setAttribute('value', currentColor.startsWith('#') && currentColor.length === 7 ? currentColor : '#3b82f6');
    nativeInput.setAttribute('aria-label', 'Selector de color personalizado');

    nativeInput.addEventListener('input', () => {
      paletteRow.querySelectorAll('.canva-color-swatch-btn, .board-color-swatch-btn').forEach((b) => b.classList.remove('is-active'));
      onChange(nativeInput.value);
    });

    paletteRow.appendChild(nativeInput);
    group.appendChild(paletteRow);
    parent.appendChild(group);
  }
}
