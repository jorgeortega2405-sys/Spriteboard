import { renderIcons } from '../../services/icon.service.js';
import { BoardAnimationType, BoardElement, BoardElementAnimation } from './board.types.js';

export interface BoardAnimationPanelCallbacks {
  onApplyAnimation: (animation: BoardElementAnimation) => void;
  onClose: () => void;
  onPreviewAnimation?: (animation: BoardElementAnimation) => void;
}

interface AnimationPresetItem {
  description: string;
  icon: string;
  id: BoardAnimationType;
  name: string;
}

const ANIMATION_PRESETS: AnimationPresetItem[] = [
  { description: 'Sin animación', icon: 'block', id: 'none', name: 'Ninguno' },
  { description: 'Deslizar hacia arriba con suavidad', icon: 'arrow_upward', id: 'rise', name: 'Subir' },
  { description: 'Desplazamiento horizontal fluido', icon: 'swap_horiz', id: 'pan', name: 'Paneo' },
  { description: 'Aparición gradual de opacidad', icon: 'gradient', id: 'fade', name: 'Fundir' },
  { description: 'Escalado rápido y rebote elástico', icon: 'aspect_ratio', id: 'pop', name: 'Pop' },
  { description: 'Desplazamiento en ángulo diagonal', icon: 'north_east', id: 'diagonal', name: 'Diagonal' },
  { description: 'Desenfoque óptico a enfocado', icon: 'blur_on', id: 'blur', name: 'Desenfoque' },
  { description: 'Aparición en secuencia rítmica', icon: 'reorder', id: 'sequence', name: 'Secuencia' },
  { description: 'Aparición tipo barrido lateral', icon: 'auto_awesome_motion', id: 'wipe', name: 'Aparecer' },
  { description: 'Efecto de telón o cortina', icon: 'vertical_split', id: 'curtain', name: 'Cortina' },
  { description: 'Flotación suave y constante', icon: 'air', id: 'drift', name: 'Deriva' },
  { description: 'Vibración y choque tectónico', icon: 'vibration', id: 'tectonic', name: 'Tectónico' },
  { description: 'Giro dinámico de 360 grados', icon: 'refresh', id: 'roll', name: 'Rodar' },
  { description: 'Parpadeo brillante y destello', icon: 'bolt', id: 'neon', name: 'Neón' },
  { description: 'Efecto de sello y recorte', icon: 'content_cut', id: 'scrapbook', name: 'Recortes' },
  { description: 'Caída de impacto y peso', icon: 'south', id: 'stomp', name: 'Sello' },
];

export class BoardAnimationPanelComponent {
  private abortController: AbortController | null = null;
  private activeAnimation: BoardElementAnimation = { speed: 'medium', trigger: 'enter', type: 'none' };
  private callbacks: BoardAnimationPanelCallbacks;
  private containerEl: HTMLElement | null = null;
  private panelEl: HTMLElement | null = null;

  constructor(container: HTMLElement, callbacks: BoardAnimationPanelCallbacks) {
    this.containerEl = container;
    this.callbacks = callbacks;
  }

  public init(): void {
    if (!this.containerEl) return;
    this.panelEl = this.containerEl.querySelector<HTMLElement>('[data-ref="board-animation-drawer"]');
    if (!this.panelEl) return;

    this.bindEvents();
    this.renderPresets();
    this.renderConfigControls();
  }

  public attach(panelEl: HTMLElement): void {
    this.panelEl = panelEl;
    this.bindEvents();
    this.renderPresets();
    this.renderConfigControls();
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
    if (!element || !element.animation) {
      this.activeAnimation = { speed: 'medium', trigger: 'enter', type: 'none' };
    } else {
      this.activeAnimation = {
        duration: element.animation.duration,
        speed: element.animation.speed || 'medium',
        trigger: element.animation.trigger || 'enter',
        type: element.animation.type || 'none',
      };
    }

    this.updateActivePresetHighlight();
    this.renderConfigControls();
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

    const btnClose = this.panelEl?.querySelector<HTMLButtonElement>('[data-ref="btn-close-animation-drawer"]');
    btnClose?.addEventListener('click', () => {
      this.close();
      this.callbacks.onClose();
    }, { signal });
  }

  private renderPresets(): void {
    if (!this.panelEl) return;
    const presetsGrid = this.panelEl.querySelector<HTMLElement>('[data-ref="animation-presets-grid"]');
    if (!presetsGrid) return;

    presetsGrid.innerHTML = '';

    for (const item of ANIMATION_PRESETS) {
      const btn = document.createElement('button');
      btn.setAttribute('type', 'button');
      btn.className = `canva-effect-card${this.activeAnimation.type === item.id ? ' is-active' : ''}`;
      btn.setAttribute('data-ref', `anim-card-${item.id}`);
      btn.setAttribute('data-tooltip', item.description);

      const iconWrap = document.createElement('div');
      iconWrap.className = 'canva-effect-card__preview';
      const iconSpan = document.createElement('span');
      iconSpan.className = 'component-icon';
      iconSpan.textContent = item.icon;
      iconWrap.appendChild(iconSpan);

      const label = document.createElement('span');
      label.className = 'canva-effect-card__label';
      label.textContent = item.name;

      btn.appendChild(iconWrap);
      btn.appendChild(label);

      btn.addEventListener('click', () => {
        this.selectAnimationType(item.id);
      });

      btn.addEventListener('mouseenter', () => {
        if (item.id !== 'none' && this.callbacks.onPreviewAnimation) {
          this.callbacks.onPreviewAnimation({
            speed: this.activeAnimation.speed,
            trigger: this.activeAnimation.trigger,
            type: item.id,
          });
        }
      });

      presetsGrid.appendChild(btn);
    }

    renderIcons(presetsGrid);
  }

  private selectAnimationType(type: BoardAnimationType): void {
    this.activeAnimation.type = type;
    this.updateActivePresetHighlight();
    this.renderConfigControls();
    this.callbacks.onApplyAnimation({ ...this.activeAnimation });

    if (type !== 'none' && this.callbacks.onPreviewAnimation) {
      this.callbacks.onPreviewAnimation({ ...this.activeAnimation });
    }
  }

  private updateActivePresetHighlight(): void {
    if (!this.panelEl) return;
    this.panelEl.querySelectorAll<HTMLButtonElement>('.canva-effect-card').forEach((btn) => {
      const isCurrent = btn.getAttribute('data-ref') === `anim-card-${this.activeAnimation.type}`;
      btn.classList.toggle('is-active', isCurrent);
    });
  }

  private renderConfigControls(): void {
    if (!this.panelEl) return;
    const configContainer = this.panelEl.querySelector<HTMLElement>('[data-ref="animation-config-container"]');
    if (!configContainer) return;

    if (this.activeAnimation.type === 'none') {
      configContainer.innerHTML = '';
      configContainer.classList.add('is-hidden');
      return;
    }

    configContainer.classList.remove('is-hidden');
    configContainer.innerHTML = '';

    const titleEl = document.createElement('div');
    titleEl.className = 'canva-drawer-section-title';
    titleEl.textContent = 'Opciones de animación';
    configContainer.appendChild(titleEl);

    const triggerGroup = document.createElement('div');
    triggerGroup.className = 'canva-drawer-field-group';

    const triggerLabel = document.createElement('span');
    triggerLabel.className = 'canva-drawer-slider-label';
    triggerLabel.textContent = 'Momento de la animación';
    triggerGroup.appendChild(triggerLabel);

    const triggerPills = document.createElement('div');
    triggerPills.className = 'canva-trigger-pills';

    const triggers: Array<{ id: 'both' | 'enter' | 'exit'; name: string }> = [
      { id: 'enter', name: 'Al entrar' },
      { id: 'exit', name: 'Al salir' },
      { id: 'both', name: 'Ambos' },
    ];

    for (const trig of triggers) {
      const pill = document.createElement('button');
      pill.setAttribute('type', 'button');
      pill.className = `canva-trigger-pill${this.activeAnimation.trigger === trig.id ? ' is-active' : ''}`;
      pill.textContent = trig.name;
      pill.addEventListener('click', () => {
        this.activeAnimation.trigger = trig.id;
        triggerPills.querySelectorAll('.canva-trigger-pill').forEach((p) => p.classList.remove('is-active'));
        pill.classList.add('is-active');
        this.callbacks.onApplyAnimation({ ...this.activeAnimation });
      });
      triggerPills.appendChild(pill);
    }
    triggerGroup.appendChild(triggerPills);
    configContainer.appendChild(triggerGroup);

    const speedGroup = document.createElement('div');
    speedGroup.className = 'canva-drawer-field-group';

    const speedLabel = document.createElement('span');
    speedLabel.className = 'canva-drawer-slider-label';
    speedLabel.textContent = 'Velocidad';
    speedGroup.appendChild(speedLabel);

    const speedPills = document.createElement('div');
    speedPills.className = 'canva-trigger-pills';

    const speeds: Array<{ id: 'fast' | 'medium' | 'slow'; name: string }> = [
      { id: 'slow', name: 'Lento' },
      { id: 'medium', name: 'Medio' },
      { id: 'fast', name: 'Rápido' },
    ];

    for (const spd of speeds) {
      const pill = document.createElement('button');
      pill.setAttribute('type', 'button');
      pill.className = `canva-trigger-pill${this.activeAnimation.speed === spd.id ? ' is-active' : ''}`;
      pill.textContent = spd.name;
      pill.addEventListener('click', () => {
        this.activeAnimation.speed = spd.id;
        speedPills.querySelectorAll('.canva-trigger-pill').forEach((p) => p.classList.remove('is-active'));
        pill.classList.add('is-active');
        this.callbacks.onApplyAnimation({ ...this.activeAnimation });
        if (this.callbacks.onPreviewAnimation) {
          this.callbacks.onPreviewAnimation({ ...this.activeAnimation });
        }
      });
      speedPills.appendChild(pill);
    }
    speedGroup.appendChild(speedPills);
    configContainer.appendChild(speedGroup);
  }
}
