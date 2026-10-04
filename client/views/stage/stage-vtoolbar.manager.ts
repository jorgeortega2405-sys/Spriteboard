import { DEFAULT_STICKY_COLOR } from '../../config/sticky-notes.config.js';
import { showToast } from '../../services/toast.service.js';
import { ConnectorStyle, ShapeType } from '../board/board.types.js';

export interface StageVToolbarHost {
  applySelectedProperty(key: string, value: any): void;
  broadcastMyCursor: boolean;
  canvas: HTMLCanvasElement | null;
  container: HTMLElement;
  currentConnectorStyle: ConnectorStyle;
  currentShapeType: ShapeType;
  drawSubtool: 'eraser' | 'highlighter' | 'marker' | 'pen';
  fitSlide(): void;
  insertStickyNote(color?: string): void;
  isSnappingEnabled: boolean;
  render(): void;
  selectedElementIds: Set<string>;
  setTool(tool: any): void;
  showCollaboratorCursors: boolean;
  toggleColorsPanel(target: 'fill' | 'slide-bg' | 'stroke' | 'text'): void;
  togglePopover(name: any): void;
  updateZoomUI(): void;
  zoom: number;
}

export class StageVToolbarManager {
  private host: StageVToolbarHost;

  constructor(host: StageVToolbarHost) {
    this.host = host;
  }

  public bindToolbarEvents(signal: AbortSignal): void {
    const btnZoomIn = this.host.container.querySelector<HTMLButtonElement>('[data-ref="btn-zoom-in"]');
    const btnZoomOut = this.host.container.querySelector<HTMLButtonElement>('[data-ref="btn-zoom-out"]');
    const btnZoomReset = this.host.container.querySelector<HTMLButtonElement>('[data-ref="btn-zoom-reset"]');
    const btnZoomFit = this.host.container.querySelector<HTMLButtonElement>('[data-ref="btn-zoom-fit"]');

    btnZoomIn?.addEventListener('click', () => {
      this.host.zoom = Math.min(3, this.host.zoom + 0.1);
      this.host.updateZoomUI();
      this.host.render();
    }, { signal });

    btnZoomOut?.addEventListener('click', () => {
      this.host.zoom = Math.max(0.2, this.host.zoom - 0.1);
      this.host.updateZoomUI();
      this.host.render();
    }, { signal });

    btnZoomReset?.addEventListener('click', () => {
      this.host.zoom = 1;
      this.host.updateZoomUI();
      this.host.render();
    }, { signal });

    btnZoomFit?.addEventListener('click', () => {
      this.host.fitSlide();
    }, { signal });

    const btnSnapping = this.host.container.querySelector<HTMLButtonElement>('[data-ref="btn-toggle-snapping"]');
    btnSnapping?.addEventListener('click', () => {
      this.host.isSnappingEnabled = !this.host.isSnappingEnabled;
      btnSnapping.classList.toggle('is-active', this.host.isSnappingEnabled);
      showToast(this.host.isSnappingEnabled ? 'Ajuste magnético activado' : 'Ajuste magnético desactivado', 'info');
    }, { signal });
  }

  public bindVerticalToolbarEvents(signal: AbortSignal): void {
    const toolButtons = this.host.container.querySelectorAll<HTMLButtonElement>('[data-vtool]');
    toolButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const tool = btn.getAttribute('data-vtool') as any;
        if (tool) {
          this.host.setTool(tool);
          this.showVerticalSubtoolbar(tool);
        }
      }, { signal });
    });

    const btnClose = this.host.container.querySelector<HTMLButtonElement>('[data-ref="btn-close-vertical-toolbar"]');
    btnClose?.addEventListener('click', () => {
      this.toggleVerticalToolbar(false);
    }, { signal });

    const drawSubtools = this.host.container.querySelectorAll<HTMLButtonElement>('[data-subtool]');
    drawSubtools.forEach((btn) => {
      btn.addEventListener('click', () => {
        drawSubtools.forEach((b) => b.classList.remove('is-active'));
        btn.classList.add('is-active');
        this.host.drawSubtool = (btn.getAttribute('data-subtool') || 'pen') as any;
      }, { signal });
    });

    const btnDrawColor = this.host.container.querySelector<HTMLButtonElement>('[data-ref="vdraw-btn-color"]');
    btnDrawColor?.addEventListener('click', () => {
      this.host.toggleColorsPanel('stroke');
    }, { signal });

    const btnDrawWidth = this.host.container.querySelector<HTMLButtonElement>('[data-ref="vdraw-btn-width"]');
    btnDrawWidth?.addEventListener('click', () => {
      this.host.togglePopover('stroke');
    }, { signal });

    const shapeButtons = this.host.container.querySelectorAll<HTMLButtonElement>('[data-shape]');
    shapeButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        shapeButtons.forEach((b) => b.classList.remove('is-active'));
        btn.classList.add('is-active');
        this.host.currentShapeType = (btn.getAttribute('data-shape') || 'rect') as ShapeType;
        if (this.host.selectedElementIds.size > 0) {
          this.host.applySelectedProperty('shapeType', this.host.currentShapeType);
        }
      }, { signal });
    });

    const lineButtons = this.host.container.querySelectorAll<HTMLButtonElement>('[data-conn-style]');
    lineButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        lineButtons.forEach((b) => b.classList.remove('is-active'));
        btn.classList.add('is-active');
        this.host.currentConnectorStyle = (btn.getAttribute('data-conn-style') || 'curved') as ConnectorStyle;
        if (this.host.selectedElementIds.size > 0) {
          this.host.applySelectedProperty('connectorStyle', this.host.currentConnectorStyle);
        }
      }, { signal });
    });

    const stickyButtons = this.host.container.querySelectorAll<HTMLButtonElement>('[data-ref^="vsticky-color-"]');
    stickyButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        stickyButtons.forEach((b) => b.classList.remove('is-active'));
        btn.classList.add('is-active');
        const color = btn.getAttribute('data-color') || DEFAULT_STICKY_COLOR;
        if (this.host.selectedElementIds.size > 0) {
          this.host.applySelectedProperty('color', color);
        } else {
          this.host.insertStickyNote(color);
        }
      }, { signal });
    });

    const vcursorBtnToggleOthers = this.host.container.querySelector<HTMLButtonElement>('[data-ref="vcursor-btn-toggle-others"]');
    vcursorBtnToggleOthers?.addEventListener('click', () => {
      this.host.showCollaboratorCursors = !this.host.showCollaboratorCursors;
      vcursorBtnToggleOthers.classList.toggle('is-active', this.host.showCollaboratorCursors);
      const iconUse = vcursorBtnToggleOthers.querySelector('use');
      if (iconUse) {
        iconUse.setAttribute('href', this.host.showCollaboratorCursors ? '/icons.svg#visibility' : '/icons.svg#visibility_off');
      }
      this.host.render();
      showToast(this.host.showCollaboratorCursors ? 'Cursores de colaboradores visibles' : 'Cursores de colaboradores ocultos', 'info');
    }, { signal });

    const vcursorBtnToggleBroadcast = this.host.container.querySelector<HTMLButtonElement>('[data-ref="vcursor-btn-toggle-broadcast"]');
    vcursorBtnToggleBroadcast?.addEventListener('click', () => {
      this.host.broadcastMyCursor = !this.host.broadcastMyCursor;
      vcursorBtnToggleBroadcast.classList.toggle('is-active', this.host.broadcastMyCursor);
      showToast(this.host.broadcastMyCursor ? 'Transmisión de mi cursor activada' : 'Transmisión de mi cursor desactivada', 'info');
    }, { signal });

    const btnLaser = this.host.container.querySelector<HTMLButtonElement>('[data-ref="vcursor-btn-laser"]');
    btnLaser?.addEventListener('click', () => {
      this.host.setTool('laser');
    }, { signal });
  }

  public toggleVerticalToolbar(show?: boolean): boolean {
    const container = this.host.container.querySelector<HTMLElement>('[data-ref="presentation-vertical-toolbar-container"]');
    if (!container) return false;
    const isCurrentlyHidden = container.classList.contains('is-hidden');
    const shouldShow = typeof show === 'boolean' ? show : isCurrentlyHidden;
    container.classList.toggle('is-hidden', !shouldShow);
    if (!shouldShow) {
      const subtoolbars = this.host.container.querySelectorAll<HTMLElement>('.design-vsubtoolbar');
      subtoolbars.forEach((st) => st.classList.add('is-hidden'));
    }
    const sidebar = document.querySelector<HTMLElement>('[data-ref="sidebar"]');
    if (sidebar) {
      const railItem = sidebar.querySelector<HTMLElement>('[data-ref="rail-item-canvas-tools"]');
      const railBtn = sidebar.querySelector<HTMLElement>('[data-ref="btn-rail-canvas-tools"]');
      railItem?.classList.toggle('is-active', shouldShow);
      railBtn?.classList.toggle('is-active', shouldShow);
    }
    return shouldShow;
  }

  public showVerticalSubtoolbar(tool: string): void {
    const subtoolbars = this.host.container.querySelectorAll<HTMLElement>('.design-vsubtoolbar');
    subtoolbars.forEach((st) => st.classList.add('is-hidden'));

    const targetMap: Record<string, string> = {
      cursors: 'vsubtoolbar-cursors',
      draw: 'vsubtoolbar-draw',
      lines: 'vsubtoolbar-lines',
      shapes: 'vsubtoolbar-shapes',
      stickies: 'vsubtoolbar-stickies',
    };

    const ref = targetMap[tool];
    if (ref) {
      const activeSub = this.host.container.querySelector<HTMLElement>(`[data-ref="${ref}"]`);
      activeSub?.classList.remove('is-hidden');
    }
  }
}
