import { escapeHtml } from '../../services/api.service.js';
import { renderIcons } from '../../services/icon.service.js';
import { showToast } from '../../services/toast.service.js';
import { BoardPixelGridManager, MemoryPixelFrame, MemoryPixelLayer } from './board-pixel-grid.manager.js';
import { BoardPixelGridElement } from './board.types.js';

export interface PixelPanelCallbacks {
  onChange: () => void;
  onClose?: () => void;
}

export class BoardPixelPanelComponent {
  private callbacks: PixelPanelCallbacks;
  private containerEl: HTMLElement | null = null;
  private currentGrid: BoardPixelGridElement | null = null;
  private exportScale = 8;
  private pixelGridManager: BoardPixelGridManager | null = null;

  constructor(callbacks: PixelPanelCallbacks) {
    this.callbacks = callbacks;
  }

  public attach(containerEl: HTMLElement, grid: BoardPixelGridElement, pixelGridManager: BoardPixelGridManager): void {
    this.containerEl = containerEl;
    this.currentGrid = grid;
    this.pixelGridManager = pixelGridManager;
    this.render();
  }

  public sync(grid?: BoardPixelGridElement): void {
    if (grid) {
      this.currentGrid = grid;
    }
    if (!this.containerEl || !this.currentGrid || !this.pixelGridManager) return;
    this.render();
  }

  public isOpen(): boolean {
    return !!this.containerEl && this.containerEl.isConnected;
  }

  public destroy(): void {
    this.containerEl = null;
    this.currentGrid = null;
    this.pixelGridManager = null;
  }

  private render(): void {
    if (!this.containerEl || !this.currentGrid || !this.pixelGridManager) return;
    const grid = this.currentGrid;
    const mgr = this.pixelGridManager;
    const state = mgr.getState(grid);
    const activeFrame = mgr.getActiveFrame(grid);
    const activeLayer = mgr.getActiveLayer(grid);
    const frames = mgr.getFrames(grid);
    const layers = mgr.getLayers(grid);
    const fps = mgr.getFps(grid);
    const isPlaying = state.isPlaying;
    const onionSkin = state.onionSkin;

    this.containerEl.innerHTML = `
      <div class="pixel-panel-container" data-ref="pixel-panel-root">
        <div class="pixel-panel-section" data-ref="pixel-section-info">
          <div class="pixel-panel-header">
            <span class="pixel-panel-title">Cuadrícula</span>
            <span class="pixel-panel-badge">${grid.gridWidth} × ${grid.gridHeight} px</span>
          </div>
        </div>

        <div class="pixel-panel-section" data-ref="pixel-section-timeline">
          <div class="pixel-panel-header">
            <div class="pixel-panel-title-group">
              <span class="pixel-panel-title">Animación (${frames.length} ${frames.length === 1 ? 'fotograma' : 'fotogramas'})</span>
            </div>
            <div class="pixel-panel-actions">
              <button type="button" class="component-button component-button--h28 component-button--secondary component-button--icon-only ${onionSkin ? 'is-active' : ''}" data-ref="btn-toggle-onion-skin" data-tooltip="Papel cebolla (Onion Skin)" aria-label="Papel cebolla">
                <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#layers"></use></svg>
              </button>
            </div>
          </div>

          <div class="pixel-timeline-controls">
            <button type="button" class="component-button component-button--h32 ${isPlaying ? 'component-button--black' : 'component-button--primary'}" data-ref="btn-playback-toggle">
              <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#${isPlaying ? 'pause' : 'play_arrow'}"></use></svg>
              <span>${isPlaying ? 'Pausar' : 'Reproducir'}</span>
            </button>
            <button type="button" class="component-button component-button--h32 component-button--secondary component-button--icon-only" data-ref="btn-playback-step" data-tooltip="Siguiente fotograma" aria-label="Siguiente fotograma">
              <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#skip_next"></use></svg>
            </button>
            <div class="pixel-fps-control">
              <span class="pixel-fps-label">FPS:</span>
              <input class="component-input pixel-fps-input" data-ref="input-fps" type="number" min="1" max="24" value="${fps}" aria-label="Fotogramas por segundo" />
            </div>
          </div>

          <div class="pixel-frames-strip" data-ref="pixel-frames-list"></div>

          <div class="pixel-timeline-actions">
            <button type="button" class="component-button component-button--h28 component-button--secondary" data-ref="btn-add-frame">
              <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#add"></use></svg>
              <span>Nuevo</span>
            </button>
            <button type="button" class="component-button component-button--h28 component-button--secondary" data-ref="btn-duplicate-frame" data-tooltip="Duplicar fotograma activo" aria-label="Duplicar fotograma">
              <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#content_copy"></use></svg>
              <span>Duplicar</span>
            </button>
            <button type="button" class="component-button component-button--h28 component-button--danger" data-ref="btn-delete-frame" ${frames.length <= 1 ? 'disabled' : ''} data-tooltip="Eliminar fotograma" aria-label="Eliminar fotograma">
              <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#delete"></use></svg>
              <span>Eliminar</span>
            </button>
          </div>
        </div>

        <div class="pixel-panel-section" data-ref="pixel-section-layers">
          <div class="pixel-panel-header">
            <span class="pixel-panel-title">Capas (${layers.length})</span>
            <div class="pixel-panel-actions">
              <button type="button" class="component-button component-button--h28 component-button--secondary" data-ref="btn-add-layer">
                <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#add"></use></svg>
                <span>Nueva capa</span>
              </button>
            </div>
          </div>

          <div class="pixel-layers-list" data-ref="pixel-layers-list"></div>

          <div class="pixel-layers-actions">
            <button type="button" class="component-button component-button--h28 component-button--secondary" data-ref="btn-merge-down" ${layers.length <= 1 ? 'disabled' : ''} data-tooltip="Combinar hacia abajo" aria-label="Combinar hacia abajo">
              <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#call_merge"></use></svg>
              <span>Combinar abajo</span>
            </button>
            <button type="button" class="component-button component-button--h28 component-button--danger" data-ref="btn-delete-layer" ${layers.length <= 1 ? 'disabled' : ''} data-tooltip="Eliminar capa" aria-label="Eliminar capa">
              <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#delete"></use></svg>
              <span>Eliminar</span>
            </button>
          </div>
        </div>

        <div class="pixel-panel-section" data-ref="pixel-section-export">
          <div class="pixel-panel-header">
            <span class="pixel-panel-title">Exportar sprite</span>
          </div>

          <div class="pixel-export-scale-row">
            <span class="pixel-export-scale-label">Escala:</span>
            <div class="pixel-scale-pills" data-ref="pixel-scale-pills">
              <button type="button" class="pixel-scale-pill ${this.exportScale === 1 ? 'is-active' : ''}" data-scale="1">1x</button>
              <button type="button" class="pixel-scale-pill ${this.exportScale === 2 ? 'is-active' : ''}" data-scale="2">2x</button>
              <button type="button" class="pixel-scale-pill ${this.exportScale === 4 ? 'is-active' : ''}" data-scale="4">4x</button>
              <button type="button" class="pixel-scale-pill ${this.exportScale === 8 ? 'is-active' : ''}" data-scale="8">8x</button>
              <button type="button" class="pixel-scale-pill ${this.exportScale === 16 ? 'is-active' : ''}" data-scale="16">16x</button>
            </div>
          </div>

          <div class="pixel-export-buttons">
            <button type="button" class="component-button component-button--h36 component-button--primary pixel-export-btn" data-ref="btn-export-gif">
              <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#gif"></use></svg>
              <span>Exportar GIF animado</span>
            </button>
            <button type="button" class="component-button component-button--h36 component-button--secondary pixel-export-btn" data-ref="btn-export-spritesheet">
              <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#view_timeline"></use></svg>
              <span>Exportar Sprite Sheet (PNG)</span>
            </button>
            <button type="button" class="component-button component-button--h36 component-button--secondary pixel-export-btn" data-ref="btn-export-frame-png">
              <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#image"></use></svg>
              <span>Exportar fotograma actual (PNG)</span>
            </button>
          </div>
        </div>
      </div>
    `;

    renderIcons(this.containerEl);
    this.renderFramesList(frames, activeFrame?.id);
    this.renderLayersList(layers, activeLayer?.id);
    this.bindEvents();
  }

  private renderFramesList(frames: MemoryPixelFrame[], activeFrameId?: string): void {
    if (!this.containerEl || !this.currentGrid || !this.pixelGridManager) return;
    const listEl = this.containerEl.querySelector<HTMLElement>('[data-ref="pixel-frames-list"]');
    if (!listEl) return;
    listEl.innerHTML = '';

    frames.forEach((frame, idx) => {
      const isSelected = frame.id === activeFrameId;
      const card = document.createElement('div');
      card.className = `pixel-frame-card ${isSelected ? 'is-active' : ''}`;
      card.setAttribute('data-ref', `pixel-frame-card-${frame.id}`);

      const thumbBox = document.createElement('div');
      thumbBox.className = 'pixel-frame-card__thumb';

      const thumbCanvas = document.createElement('canvas');
      thumbCanvas.className = 'pixel-frame-card__thumb-canvas';
      thumbCanvas.width = this.currentGrid!.gridWidth;
      thumbCanvas.height = this.currentGrid!.gridHeight;
      const thumbCtx = thumbCanvas.getContext('2d');
      if (thumbCtx) {
        const comp = this.pixelGridManager!.compositeFrame(this.currentGrid!, frame);
        thumbCtx.drawImage(comp, 0, 0);
      }
      thumbBox.appendChild(thumbCanvas);
      card.appendChild(thumbBox);

      const badge = document.createElement('span');
      badge.className = 'pixel-frame-card__badge';
      badge.textContent = `${idx + 1}`;
      card.appendChild(badge);

      card.addEventListener('click', () => {
        if (this.pixelGridManager && this.currentGrid) {
          this.pixelGridManager.selectFrame(this.currentGrid, frame.id);
          this.callbacks.onChange();
          this.sync();
        }
      });

      listEl.appendChild(card);
    });
  }

  private renderLayersList(layers: MemoryPixelLayer[], activeLayerId?: string): void {
    if (!this.containerEl || !this.currentGrid || !this.pixelGridManager) return;
    const listEl = this.containerEl.querySelector<HTMLElement>('[data-ref="pixel-layers-list"]');
    if (!listEl) return;
    listEl.innerHTML = '';

    const reversed = [...layers].reverse();

    reversed.forEach((layer) => {
      const realIdx = layers.indexOf(layer);
      const isSelected = layer.id === activeLayerId;
      const item = document.createElement('div');
      item.className = `pixel-layer-item ${isSelected ? 'is-active' : ''}`;
      item.setAttribute('data-ref', `pixel-layer-item-${layer.id}`);

      item.innerHTML = `
        <button type="button" class="pixel-layer-item__vis-btn ${layer.visible ? 'is-visible' : 'is-hidden-layer'}" data-ref="btn-vis-${layer.id}" data-tooltip="${layer.visible ? 'Ocultar capa' : 'Mostrar capa'}" aria-label="Visibilidad de capa">
          <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#${layer.visible ? 'visibility' : 'visibility_off'}"></use></svg>
        </button>

        <span class="pixel-layer-item__name" data-ref="layer-name-${layer.id}">${escapeHtml(layer.name)}</span>

        <div class="pixel-layer-item__opacity-box">
          <span class="pixel-layer-opacity-label">${Math.round(layer.opacity * 100)}%</span>
          <input class="pixel-layer-opacity-slider" data-ref="slider-opacity-${layer.id}" type="range" min="0" max="100" value="${Math.round(layer.opacity * 100)}" aria-label="Opacidad de capa" />
        </div>

        <div class="pixel-layer-item__reorder">
          <button type="button" class="pixel-layer-btn-order" data-ref="btn-layer-up-${layer.id}" ${realIdx === layers.length - 1 ? 'disabled' : ''} data-tooltip="Subir capa" aria-label="Subir capa">
            <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#arrow_upward"></use></svg>
          </button>
          <button type="button" class="pixel-layer-btn-order" data-ref="btn-layer-down-${layer.id}" ${realIdx === 0 ? 'disabled' : ''} data-tooltip="Bajar capa" aria-label="Bajar capa">
            <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#arrow_downward"></use></svg>
          </button>
        </div>
      `;

      item.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        if (target.closest('.pixel-layer-item__vis-btn') || target.closest('.pixel-layer-opacity-slider') || target.closest('.pixel-layer-btn-order')) {
          return;
        }
        if (this.pixelGridManager && this.currentGrid) {
          this.pixelGridManager.selectLayer(this.currentGrid, layer.id);
          this.callbacks.onChange();
          this.sync();
        }
      });

      const visBtn = item.querySelector<HTMLButtonElement>(`[data-ref="btn-vis-${layer.id}"]`);
      visBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.pixelGridManager && this.currentGrid) {
          this.pixelGridManager.toggleLayerVisibility(this.currentGrid, layer.id);
          this.callbacks.onChange();
          this.sync();
        }
      });

      const opacitySlider = item.querySelector<HTMLInputElement>(`[data-ref="slider-opacity-${layer.id}"]`);
      opacitySlider?.addEventListener('input', (e) => {
        e.stopPropagation();
        const val = parseInt((e.target as HTMLInputElement).value, 10) / 100;
        if (this.pixelGridManager && this.currentGrid) {
          this.pixelGridManager.setLayerOpacity(this.currentGrid, layer.id, val);
          const label = item.querySelector<HTMLElement>('.pixel-layer-opacity-label');
          if (label) label.textContent = `${Math.round(val * 100)}%`;
          this.callbacks.onChange();
        }
      });

      const btnUp = item.querySelector<HTMLButtonElement>(`[data-ref="btn-layer-up-${layer.id}"]`);
      btnUp?.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.pixelGridManager && this.currentGrid) {
          this.pixelGridManager.moveLayer(this.currentGrid, layer.id, 'up');
          this.callbacks.onChange();
          this.sync();
        }
      });

      const btnDown = item.querySelector<HTMLButtonElement>(`[data-ref="btn-layer-down-${layer.id}"]`);
      btnDown?.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.pixelGridManager && this.currentGrid) {
          this.pixelGridManager.moveLayer(this.currentGrid, layer.id, 'down');
          this.callbacks.onChange();
          this.sync();
        }
      });

      renderIcons(item);
      listEl.appendChild(item);
    });
  }

  private bindEvents(): void {
    if (!this.containerEl || !this.currentGrid || !this.pixelGridManager) return;
    const grid = this.currentGrid;
    const mgr = this.pixelGridManager;

    const btnOnion = this.containerEl.querySelector<HTMLButtonElement>('[data-ref="btn-toggle-onion-skin"]');
    btnOnion?.addEventListener('click', () => {
      mgr.toggleOnionSkin(grid);
      this.callbacks.onChange();
      this.sync();
    });

    const btnPlayback = this.containerEl.querySelector<HTMLButtonElement>('[data-ref="btn-playback-toggle"]');
    btnPlayback?.addEventListener('click', () => {
      mgr.togglePlayback(grid, () => {
        this.callbacks.onChange();
        this.sync();
      });
      this.sync();
    });

    const btnStep = this.containerEl.querySelector<HTMLButtonElement>('[data-ref="btn-playback-step"]');
    btnStep?.addEventListener('click', () => {
      mgr.stepPlayback(grid);
      this.callbacks.onChange();
      this.sync();
    });

    const inputFps = this.containerEl.querySelector<HTMLInputElement>('[data-ref="input-fps"]');
    inputFps?.addEventListener('change', (e) => {
      const val = parseInt((e.target as HTMLInputElement).value, 10) || 8;
      mgr.setFps(grid, Math.max(1, Math.min(24, val)));
      this.callbacks.onChange();
    });

    const btnAddFrame = this.containerEl.querySelector<HTMLButtonElement>('[data-ref="btn-add-frame"]');
    btnAddFrame?.addEventListener('click', () => {
      mgr.addFrame(grid, false);
      this.callbacks.onChange();
      this.sync();
    });

    const btnDupFrame = this.containerEl.querySelector<HTMLButtonElement>('[data-ref="btn-duplicate-frame"]');
    btnDupFrame?.addEventListener('click', () => {
      mgr.duplicateFrame(grid);
      this.callbacks.onChange();
      this.sync();
    });

    const btnDelFrame = this.containerEl.querySelector<HTMLButtonElement>('[data-ref="btn-delete-frame"]');
    btnDelFrame?.addEventListener('click', () => {
      const success = mgr.deleteFrame(grid);
      if (success) {
        this.callbacks.onChange();
        this.sync();
      }
    });

    const btnAddLayer = this.containerEl.querySelector<HTMLButtonElement>('[data-ref="btn-add-layer"]');
    btnAddLayer?.addEventListener('click', () => {
      mgr.addLayer(grid);
      this.callbacks.onChange();
      this.sync();
    });

    const btnMergeDown = this.containerEl.querySelector<HTMLButtonElement>('[data-ref="btn-merge-down"]');
    btnMergeDown?.addEventListener('click', () => {
      const success = mgr.mergeLayerDown(grid);
      if (success) {
        this.callbacks.onChange();
        this.sync();
      }
    });

    const btnDelLayer = this.containerEl.querySelector<HTMLButtonElement>('[data-ref="btn-delete-layer"]');
    btnDelLayer?.addEventListener('click', () => {
      const success = mgr.deleteLayer(grid);
      if (success) {
        this.callbacks.onChange();
        this.sync();
      }
    });

    this.containerEl.querySelectorAll<HTMLButtonElement>('[data-scale]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const sc = parseInt(btn.getAttribute('data-scale') || '8', 10);
        this.exportScale = sc;
        this.containerEl?.querySelectorAll('.pixel-scale-pill').forEach((p) => {
          p.classList.toggle('is-active', p.getAttribute('data-scale') === String(sc));
        });
      });
    });

    const btnExportGif = this.containerEl.querySelector<HTMLButtonElement>('[data-ref="btn-export-gif"]');
    btnExportGif?.addEventListener('click', async () => {
      btnExportGif.disabled = true;
      try {
        await mgr.exportGif(grid, this.exportScale);
      } catch {
        showToast('Error al generar el archivo GIF');
      } finally {
        btnExportGif.disabled = false;
      }
    });

    const btnExportSheet = this.containerEl.querySelector<HTMLButtonElement>('[data-ref="btn-export-spritesheet"]');
    btnExportSheet?.addEventListener('click', () => {
      mgr.exportSpriteSheet(grid, this.exportScale);
    });

    const btnExportPng = this.containerEl.querySelector<HTMLButtonElement>('[data-ref="btn-export-frame-png"]');
    btnExportPng?.addEventListener('click', () => {
      mgr.exportCurrentFramePng(grid, this.exportScale);
    });
  }
}
