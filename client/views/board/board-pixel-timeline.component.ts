import { renderIcons } from '../../services/icon.service.js';
import { CarouselController, initCarouselScroll } from '../../utils/dom.util.js';
import { BoardPixelGridManager } from './board-pixel-grid.manager.js';
import { BoardPixelGridElement } from './board.types.js';

export interface PixelTimelineCallbacks {
  onChange: () => void;
  onRedraw: () => void;
}

export class BoardPixelTimelineComponent {
  private abortController: AbortController | null = null;
  private bottomLayersBtn: HTMLButtonElement | null = null;
  private callbacks: PixelTimelineCallbacks;
  private containerEl: HTMLElement | null = null;
  private currentGrid: BoardPixelGridElement | null = null;
  private draggedFrameId: string | null = null;
  private draggedLayerId: string | null = null;
  private frameDeleteBtn: HTMLButtonElement | null = null;
  private frameDuplicateBtn: HTMLButtonElement | null = null;
  private frameFpsBtn: HTMLButtonElement | null = null;
  private frameFpsTextEl: HTMLElement | null = null;
  private frameNextBtn: HTMLButtonElement | null = null;
  private frameOnionBtn: HTMLButtonElement | null = null;
  private framePlayBtn: HTMLButtonElement | null = null;
  private framePrevBtn: HTMLButtonElement | null = null;
  private framesCardsListEl: HTMLElement | null = null;
  private framesCardsWrapper: HTMLElement | null = null;
  private framesTrayCarouselController: CarouselController | null = null;
  private framesTrayEl: HTMLElement | null = null;
  private layersCardsListEl: HTMLElement | null = null;
  private layersCardsWrapper: HTMLElement | null = null;
  private layersTrayAddBtn: HTMLButtonElement | null = null;
  private layersTrayCarouselController: CarouselController | null = null;
  private layersTrayDeleteBtn: HTMLButtonElement | null = null;
  private layersTrayDownBtn: HTMLButtonElement | null = null;
  private layersTrayEl: HTMLElement | null = null;
  private layersTrayMergeBtn: HTMLButtonElement | null = null;
  private layersTrayUpBtn: HTMLButtonElement | null = null;
  private pixelGridManager: BoardPixelGridManager | null = null;

  constructor(callbacks: PixelTimelineCallbacks) {
    this.callbacks = callbacks;
  }

  public attach(containerEl: HTMLElement, grid: BoardPixelGridElement, pixelGridManager: BoardPixelGridManager): void {
    this.containerEl = containerEl;
    this.currentGrid = grid;
    this.pixelGridManager = pixelGridManager;

    this.queryDOMElements();
    this.bindEvents();
    this.sync(grid);
  }

  public sync(grid?: BoardPixelGridElement): void {
    if (grid) {
      this.currentGrid = grid;
    }
    if (!this.containerEl || !this.currentGrid || !this.pixelGridManager) return;

    const state = this.pixelGridManager.getState(this.currentGrid);
    this.updateControlsUI(state.isPlaying, state.fps, state.onionSkin);
    this.renderFramesCards();
    this.renderLayersCards();
    this.framesTrayCarouselController?.updateButtons();
    this.layersTrayCarouselController?.updateButtons();
  }

  public show(): void {
    this.showFramesTray();
  }

  public hide(): void {
    this.hideFramesTray();
    this.hideLayersTray();
    if (this.currentGrid && this.pixelGridManager) {
      this.pixelGridManager.stopPlayback(this.currentGrid);
    }
  }

  public showFramesTray(): void {
    if (this.framesTrayEl) {
      this.framesTrayEl.classList.remove('is-hidden');
    }
    this.sync();
  }

  public hideFramesTray(): void {
    if (this.framesTrayEl) {
      this.framesTrayEl.classList.add('is-hidden');
    }
    if (this.currentGrid && this.pixelGridManager) {
      this.pixelGridManager.stopPlayback(this.currentGrid);
    }
  }

  public toggleFramesTray(): void {
    if (this.isFramesVisible()) {
      this.hideFramesTray();
    } else {
      this.showFramesTray();
    }
  }

  public showLayersTray(): void {
    if (this.layersTrayEl) {
      this.layersTrayEl.classList.remove('is-hidden');
      this.bottomLayersBtn?.classList.add('is-active');
      this.renderLayersCards();
      this.layersTrayCarouselController?.updateButtons();
    }
  }

  public hideLayersTray(): void {
    if (this.layersTrayEl) {
      this.layersTrayEl.classList.add('is-hidden');
      this.bottomLayersBtn?.classList.remove('is-active');
    }
  }

  public toggleLayersTray(): void {
    if (this.isLayersVisible()) {
      this.hideLayersTray();
    } else {
      this.showLayersTray();
    }
  }

  public isVisible(): boolean {
    return this.isFramesVisible() || this.isLayersVisible();
  }

  public isFramesVisible(): boolean {
    return !!this.framesTrayEl && !this.framesTrayEl.classList.contains('is-hidden');
  }

  public isLayersVisible(): boolean {
    return !!this.layersTrayEl && !this.layersTrayEl.classList.contains('is-hidden');
  }

  public destroy(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    if (this.currentGrid && this.pixelGridManager) {
      this.pixelGridManager.stopPlayback(this.currentGrid);
    }
    this.containerEl = null;
    this.currentGrid = null;
    this.pixelGridManager = null;
  }

  private queryDOMElements(): void {
    if (!this.containerEl) return;

    this.framesTrayEl = this.containerEl.querySelector<HTMLElement>('[data-ref="design-frames-tray"]');
    this.framesCardsWrapper = this.containerEl.querySelector<HTMLElement>('[data-ref="frames-cards-wrapper"]');
    this.framesCardsListEl = this.containerEl.querySelector<HTMLElement>('[data-ref="frames-cards-list"]');
    this.framePlayBtn = this.containerEl.querySelector<HTMLButtonElement>('[data-ref="btn-frame-play"]');
    this.framePrevBtn = this.containerEl.querySelector<HTMLButtonElement>('[data-ref="btn-frame-prev"]');
    this.frameNextBtn = this.containerEl.querySelector<HTMLButtonElement>('[data-ref="btn-frame-next"]');
    this.frameDuplicateBtn = this.containerEl.querySelector<HTMLButtonElement>('[data-ref="btn-frame-duplicate"]');
    this.frameDeleteBtn = this.containerEl.querySelector<HTMLButtonElement>('[data-ref="btn-frame-delete"]');
    this.frameFpsBtn = this.containerEl.querySelector<HTMLButtonElement>('[data-ref="btn-frame-fps"]');
    this.frameFpsTextEl = this.containerEl.querySelector<HTMLElement>('[data-ref="frame-fps-text"]');
    this.frameOnionBtn = this.containerEl.querySelector<HTMLButtonElement>('[data-ref="btn-frame-onion"]');
    this.bottomLayersBtn = this.containerEl.querySelector<HTMLButtonElement>('[data-ref="btn-bottom-layers"]');

    this.layersTrayEl = this.containerEl.querySelector<HTMLElement>('[data-ref="design-layers-tray"]');
    this.layersCardsWrapper = this.containerEl.querySelector<HTMLElement>('[data-ref="layers-cards-wrapper"]');
    this.layersCardsListEl = this.containerEl.querySelector<HTMLElement>('[data-ref="layers-cards-list"]');
    this.layersTrayAddBtn = this.containerEl.querySelector<HTMLButtonElement>('[data-ref="btn-tray-add-layer"]');
    this.layersTrayUpBtn = this.containerEl.querySelector<HTMLButtonElement>('[data-ref="btn-tray-layer-up"]');
    this.layersTrayDownBtn = this.containerEl.querySelector<HTMLButtonElement>('[data-ref="btn-tray-layer-down"]');
    this.layersTrayMergeBtn = this.containerEl.querySelector<HTMLButtonElement>('[data-ref="btn-tray-merge-layer"]');
    this.layersTrayDeleteBtn = this.containerEl.querySelector<HTMLButtonElement>('[data-ref="btn-tray-delete-layer"]');
  }

  private bindEvents(): void {
    if (this.abortController) {
      this.abortController.abort();
    }
    this.abortController = new AbortController();
    const { signal } = this.abortController;

    if (this.framesCardsWrapper) {
      this.framesTrayCarouselController = initCarouselScroll(this.framesCardsWrapper, {
        carouselSelector: '[data-ref="frames-cards-list"]',
        leftBtnSelector: '[data-ref="btn-frames-tray-scroll-left"]',
        rightBtnSelector: '[data-ref="btn-frames-tray-scroll-right"]',
        step: 180,
      });
    }

    if (this.layersCardsWrapper) {
      this.layersTrayCarouselController = initCarouselScroll(this.layersCardsWrapper, {
        carouselSelector: '[data-ref="layers-cards-list"]',
        leftBtnSelector: '[data-ref="btn-layers-tray-scroll-left"]',
        rightBtnSelector: '[data-ref="btn-layers-tray-scroll-right"]',
        step: 180,
      });
    }

    this.framePlayBtn?.addEventListener('click', () => {
      if (!this.currentGrid || !this.pixelGridManager) return;
      const isPlaying = this.pixelGridManager.togglePlayback(this.currentGrid, () => {
        this.sync();
        this.callbacks.onRedraw();
      });
      const state = this.pixelGridManager.getState(this.currentGrid);
      this.updateControlsUI(isPlaying, state.fps, state.onionSkin);
      this.callbacks.onRedraw();
    }, { signal });

    this.framePrevBtn?.addEventListener('click', () => {
      if (!this.currentGrid || !this.pixelGridManager) return;
      this.pixelGridManager.prevFrame(this.currentGrid);
      this.sync();
      this.callbacks.onChange();
      this.callbacks.onRedraw();
    }, { signal });

    this.frameNextBtn?.addEventListener('click', () => {
      if (!this.currentGrid || !this.pixelGridManager) return;
      this.pixelGridManager.nextFrame(this.currentGrid);
      this.sync();
      this.callbacks.onChange();
      this.callbacks.onRedraw();
    }, { signal });

    this.frameDuplicateBtn?.addEventListener('click', () => {
      if (!this.currentGrid || !this.pixelGridManager) return;
      this.pixelGridManager.duplicateFrame(this.currentGrid);
      this.sync();
      this.callbacks.onChange();
      this.callbacks.onRedraw();
    }, { signal });

    this.frameDeleteBtn?.addEventListener('click', () => {
      if (!this.currentGrid || !this.pixelGridManager) return;
      const success = this.pixelGridManager.deleteFrame(this.currentGrid);
      if (success) {
        this.sync();
        this.callbacks.onChange();
        this.callbacks.onRedraw();
      }
    }, { signal });

    this.frameFpsBtn?.addEventListener('click', () => {
      if (!this.currentGrid || !this.pixelGridManager) return;
      const currentFps = this.pixelGridManager.getFps(this.currentGrid);
      const fpsOptions = [1, 2, 4, 8, 12, 16, 24, 30, 60];
      const curIndex = fpsOptions.indexOf(currentFps);
      const nextFps = curIndex >= 0 && curIndex < fpsOptions.length - 1 ? fpsOptions[curIndex + 1] : fpsOptions[0];
      this.pixelGridManager.setFps(this.currentGrid, nextFps);
      if (this.frameFpsTextEl) {
        this.frameFpsTextEl.textContent = `${nextFps} FPS`;
      }
      this.callbacks.onChange();
    }, { signal });

    this.frameOnionBtn?.addEventListener('click', () => {
      if (!this.currentGrid || !this.pixelGridManager) return;
      const enabled = this.pixelGridManager.toggleOnionSkin(this.currentGrid);
      this.frameOnionBtn?.classList.toggle('is-active', enabled);
      this.callbacks.onChange();
      this.callbacks.onRedraw();
    }, { signal });

    this.bottomLayersBtn?.addEventListener('click', () => {
      this.toggleLayersTray();
    }, { signal });

    this.layersTrayAddBtn?.addEventListener('click', () => {
      if (!this.currentGrid || !this.pixelGridManager) return;
      this.pixelGridManager.addLayer(this.currentGrid);
      this.sync();
      this.callbacks.onChange();
      this.callbacks.onRedraw();
    }, { signal });

    this.layersTrayUpBtn?.addEventListener('click', () => {
      if (!this.currentGrid || !this.pixelGridManager) return;
      const activeLayer = this.pixelGridManager.getActiveLayer(this.currentGrid);
      if (activeLayer) {
        this.pixelGridManager.moveLayer(this.currentGrid, activeLayer.id, 'up');
        this.sync();
        this.callbacks.onChange();
        this.callbacks.onRedraw();
      }
    }, { signal });

    this.layersTrayDownBtn?.addEventListener('click', () => {
      if (!this.currentGrid || !this.pixelGridManager) return;
      const activeLayer = this.pixelGridManager.getActiveLayer(this.currentGrid);
      if (activeLayer) {
        this.pixelGridManager.moveLayer(this.currentGrid, activeLayer.id, 'down');
        this.sync();
        this.callbacks.onChange();
        this.callbacks.onRedraw();
      }
    }, { signal });

    this.layersTrayMergeBtn?.addEventListener('click', () => {
      if (!this.currentGrid || !this.pixelGridManager) return;
      const activeLayer = this.pixelGridManager.getActiveLayer(this.currentGrid);
      if (activeLayer) {
        const merged = this.pixelGridManager.mergeLayerDown(this.currentGrid, activeLayer.id);
        if (merged) {
          this.sync();
          this.callbacks.onChange();
          this.callbacks.onRedraw();
        }
      }
    }, { signal });

    this.layersTrayDeleteBtn?.addEventListener('click', () => {
      if (!this.currentGrid || !this.pixelGridManager) return;
      const activeLayer = this.pixelGridManager.getActiveLayer(this.currentGrid);
      if (activeLayer) {
        const deleted = this.pixelGridManager.deleteLayer(this.currentGrid, activeLayer.id);
        if (deleted) {
          this.sync();
          this.callbacks.onChange();
          this.callbacks.onRedraw();
        }
      }
    }, { signal });
  }

  private updateControlsUI(isPlaying: boolean, fps: number, onionSkin: boolean): void {
    if (this.framePlayBtn) {
      this.framePlayBtn.innerHTML = '';
      const icon = document.createElement('span');
      icon.className = 'component-icon';
      icon.textContent = isPlaying ? 'pause' : 'play_arrow';
      this.framePlayBtn.appendChild(icon);
      renderIcons(this.framePlayBtn);
    }
    if (this.frameFpsTextEl) {
      this.frameFpsTextEl.textContent = `${fps} FPS`;
    }
    if (this.frameOnionBtn) {
      this.frameOnionBtn.classList.toggle('is-active', onionSkin);
    }
  }

  private renderFramesCards(): void {
    if (!this.framesCardsListEl || !this.currentGrid || !this.pixelGridManager) return;
    this.framesCardsListEl.innerHTML = '';

    const state = this.pixelGridManager.getState(this.currentGrid);
    const frames = state.frames;
    const activeFrameId = state.activeFrameId;

    for (let i = 0; i < frames.length; i++) {
      const frame = frames[i];
      const card = document.createElement('div');
      card.className = `design-frame-card ${frame.id === activeFrameId ? 'is-active' : ''}`;
      card.setAttribute('data-ref', `frame-card-${frame.id}`);
      card.setAttribute('draggable', 'true');

      const num = document.createElement('span');
      num.className = 'design-frame-card__num';
      num.textContent = `${i + 1}`;

      const sub = document.createElement('span');
      sub.className = 'design-frame-card__sub';
      sub.textContent = `${frame.layers.length} cap${frame.layers.length > 1 ? 'as' : 'a'}`;

      card.appendChild(num);
      card.appendChild(sub);

      if (frame.durationMs) {
        const dur = document.createElement('span');
        dur.className = 'design-frame-card__dur';
        dur.textContent = `${frame.durationMs}ms`;
        card.appendChild(dur);
      }

      card.addEventListener('click', () => {
        if (!this.currentGrid || !this.pixelGridManager) return;
        this.pixelGridManager.selectFrame(this.currentGrid, frame.id);
        this.sync();
        this.callbacks.onChange();
        this.callbacks.onRedraw();
      });

      card.addEventListener('dragstart', (e: DragEvent) => {
        this.draggedFrameId = frame.id;
        card.classList.add('is-dragging');
        if (e.dataTransfer) {
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('text/plain', frame.id);
        }
      });

      card.addEventListener('dragend', () => {
        this.draggedFrameId = null;
        card.classList.remove('is-dragging');
        this.containerEl?.querySelectorAll('.design-frame-card.is-drag-over').forEach((el) => el.classList.remove('is-drag-over'));
      });

      card.addEventListener('dragover', (e: DragEvent) => {
        e.preventDefault();
        if (e.dataTransfer) {
          e.dataTransfer.dropEffect = 'move';
        }
        if (this.draggedFrameId && this.draggedFrameId !== frame.id) {
          card.classList.add('is-drag-over');
        }
      });

      card.addEventListener('dragleave', () => {
        card.classList.remove('is-drag-over');
      });

      card.addEventListener('drop', (e: DragEvent) => {
        e.preventDefault();
        card.classList.remove('is-drag-over');
        const sourceId = this.draggedFrameId || e.dataTransfer?.getData('text/plain');
        if (sourceId && sourceId !== frame.id && this.currentGrid && this.pixelGridManager) {
          this.pixelGridManager.reorderFrames(this.currentGrid, sourceId, frame.id);
          this.sync();
          this.callbacks.onChange();
          this.callbacks.onRedraw();
        }
      });

      this.framesCardsListEl.appendChild(card);
    }

    const addCard = document.createElement('button');
    addCard.type = 'button';
    addCard.className = 'design-frame-card--add';
    addCard.setAttribute('data-ref', 'btn-add-frame');
    addCard.setAttribute('data-tooltip', 'Nuevo cuadro');
    addCard.setAttribute('aria-label', 'Nuevo cuadro');

    const addIcon = document.createElement('span');
    addIcon.className = 'component-icon';
    addIcon.textContent = 'add';
    addCard.appendChild(addIcon);

    addCard.addEventListener('click', () => {
      if (!this.currentGrid || !this.pixelGridManager) return;
      this.pixelGridManager.addFrame(this.currentGrid, false);
      this.sync();
      this.callbacks.onChange();
      this.callbacks.onRedraw();
    });

    this.framesCardsListEl.appendChild(addCard);
    renderIcons(this.framesCardsListEl);
  }

  private renderLayersCards(): void {
    if (!this.layersCardsListEl || !this.currentGrid || !this.pixelGridManager) return;
    this.layersCardsListEl.innerHTML = '';

    const frame = this.pixelGridManager.getActiveFrame(this.currentGrid);
    if (!frame) return;

    for (let i = frame.layers.length - 1; i >= 0; i--) {
      const layer = frame.layers[i];
      const card = document.createElement('div');
      card.className = `design-layer-card ${layer.id === frame.activeLayerId ? 'is-active' : ''}`;
      card.setAttribute('data-ref', `layer-card-${layer.id}`);
      card.setAttribute('draggable', 'true');

      const visBtn = document.createElement('button');
      visBtn.type = 'button';
      visBtn.className = `design-layer-card__vis-btn ${layer.visible ? '' : 'is-hidden-layer'}`;
      visBtn.setAttribute('data-ref', `btn-tray-vis-${layer.id}`);
      visBtn.setAttribute('data-tooltip', layer.visible ? 'Ocultar' : 'Mostrar');
      visBtn.setAttribute('aria-label', layer.visible ? 'Ocultar' : 'Mostrar');

      const iconSpan = document.createElement('span');
      iconSpan.className = 'component-icon';
      iconSpan.textContent = layer.visible ? 'visibility' : 'visibility_off';
      visBtn.appendChild(iconSpan);

      visBtn.addEventListener('click', (e: MouseEvent) => {
        e.stopPropagation();
        if (!this.currentGrid || !this.pixelGridManager) return;
        this.pixelGridManager.toggleLayerVisibility(this.currentGrid, layer.id, !layer.visible);
        this.sync();
        this.callbacks.onChange();
        this.callbacks.onRedraw();
      });

      const name = document.createElement('span');
      name.className = 'design-layer-card__name';
      name.textContent = layer.name;

      card.appendChild(visBtn);
      card.appendChild(name);

      card.addEventListener('click', () => {
        if (!this.currentGrid || !this.pixelGridManager) return;
        this.pixelGridManager.selectLayer(this.currentGrid, layer.id);
        this.sync();
        this.callbacks.onChange();
        this.callbacks.onRedraw();
      });

      card.addEventListener('dragstart', (e: DragEvent) => {
        this.draggedLayerId = layer.id;
        card.classList.add('is-dragging');
        if (e.dataTransfer) {
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('text/plain', layer.id);
        }
      });

      card.addEventListener('dragend', () => {
        this.draggedLayerId = null;
        card.classList.remove('is-dragging');
        this.containerEl?.querySelectorAll('.design-layer-card.is-drag-over').forEach((el) => el.classList.remove('is-drag-over'));
      });

      card.addEventListener('dragover', (e: DragEvent) => {
        e.preventDefault();
        if (e.dataTransfer) {
          e.dataTransfer.dropEffect = 'move';
        }
        if (this.draggedLayerId && this.draggedLayerId !== layer.id) {
          card.classList.add('is-drag-over');
        }
      });

      card.addEventListener('dragleave', () => {
        card.classList.remove('is-drag-over');
      });

      card.addEventListener('drop', (e: DragEvent) => {
        e.preventDefault();
        card.classList.remove('is-drag-over');
        const sourceId = this.draggedLayerId || e.dataTransfer?.getData('text/plain');
        if (sourceId && sourceId !== layer.id && this.currentGrid && this.pixelGridManager) {
          this.pixelGridManager.reorderLayers(this.currentGrid, sourceId, layer.id);
          this.sync();
          this.callbacks.onChange();
          this.callbacks.onRedraw();
        }
      });

      this.layersCardsListEl.appendChild(card);
    }

    const addCard = document.createElement('button');
    addCard.type = 'button';
    addCard.className = 'design-layer-card--add';
    addCard.setAttribute('data-ref', 'btn-add-layer');
    addCard.setAttribute('data-tooltip', 'Nueva capa');
    addCard.setAttribute('aria-label', 'Nueva capa');

    const addIcon = document.createElement('span');
    addIcon.className = 'component-icon';
    addIcon.textContent = 'add';
    addCard.appendChild(addIcon);

    addCard.addEventListener('click', () => {
      if (!this.currentGrid || !this.pixelGridManager) return;
      this.pixelGridManager.addLayer(this.currentGrid);
      this.sync();
      this.callbacks.onChange();
      this.callbacks.onRedraw();
    });

    this.layersCardsListEl.appendChild(addCard);
    renderIcons(this.layersCardsListEl);
  }
}
