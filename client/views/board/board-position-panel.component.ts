import { renderIcons } from '../../services/icon.service.js';
import { BoardElement } from './board.types.js';

export interface BoardPositionPanelCallbacks {
  onAlign: (alignType: 'bottom' | 'center' | 'left' | 'middle' | 'right' | 'top') => void;
  onClose: () => void;
  onReorder: (action: 'back' | 'backward' | 'forward' | 'front') => void;
  onReorderLayers: (fromIndex: number, toIndex: number) => void;
  onSelectElement: (elementId: string) => void;
  onToggleLock: (elementId: string) => void;
  onToggleVisibility: (elementId: string) => void;
  onUpdateTransform: (updates: { aspectRatioLocked?: boolean; height?: number; rotation?: number; width?: number; x?: number; y?: number }) => void;
}

export class BoardPositionPanelComponent {
  private abortController: AbortController | null = null;
  private activeTab: 'arrange' | 'layers' = 'arrange';
  private callbacks: BoardPositionPanelCallbacks;
  private containerEl: HTMLElement | null = null;
  private draggedLayerIndex: number | null = null;
  private elements: BoardElement[] = [];
  private layersSubtab: 'all' | 'overlap' = 'all';
  private panelEl: HTMLElement | null = null;
  private selectedElement: BoardElement | null = null;

  constructor(container: HTMLElement, callbacks: BoardPositionPanelCallbacks) {
    this.containerEl = container;
    this.callbacks = callbacks;
  }

  public init(): void {
    if (!this.containerEl) return;
    this.panelEl = this.containerEl.querySelector<HTMLElement>('[data-ref="board-position-drawer"]');
    if (!this.panelEl) return;

    this.bindEvents();
    this.renderTabs();
    this.renderContent();
  }

  public attach(panelEl: HTMLElement): void {
    this.panelEl = panelEl;
    this.bindEvents();
    this.renderTabs();
    this.renderContent();
  }

  public open(selectedElement?: BoardElement | null, allElements: BoardElement[] = []): void {
    if (!this.panelEl) return;
    this.panelEl.classList.remove('is-hidden');
    this.sync(selectedElement || null, allElements);
  }

  public close(): void {
    if (this.panelEl) {
      this.panelEl.classList.add('is-hidden');
    }
  }

  public isOpen(): boolean {
    return !!this.panelEl && !this.panelEl.classList.contains('is-hidden');
  }

  public toggle(selectedElement?: BoardElement | null, allElements: BoardElement[] = []): void {
    if (this.isOpen()) {
      this.close();
    } else {
      this.open(selectedElement, allElements);
    }
  }

  public sync(selectedElement: BoardElement | null, allElements: BoardElement[] = []): void {
    this.selectedElement = selectedElement;
    this.elements = allElements;

    this.renderContent();
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

    const btnClose = this.panelEl?.querySelector<HTMLButtonElement>('[data-ref="btn-close-position-drawer"], [data-ref="btn-close-canvas-panel"]');
    btnClose?.addEventListener('click', () => {
      this.close();
      this.callbacks.onClose();
    }, { signal });
  }

  private renderTabs(): void {
    if (!this.panelEl) return;
    const tabArrange = this.panelEl.querySelector<HTMLButtonElement>('[data-ref="pos-tab-arrange"]');
    const tabLayers = this.panelEl.querySelector<HTMLButtonElement>('[data-ref="pos-tab-layers"]');

    tabArrange?.addEventListener('click', () => {
      this.activeTab = 'arrange';
      tabArrange.classList.add('is-active');
      tabLayers?.classList.remove('is-active');
      this.renderContent();
    });

    tabLayers?.addEventListener('click', () => {
      this.activeTab = 'layers';
      tabLayers.classList.add('is-active');
      tabArrange?.classList.remove('is-active');
      this.renderContent();
    });
  }

  private renderContent(): void {
    if (!this.panelEl) return;
    const arrangeView = this.panelEl.querySelector<HTMLElement>('[data-ref="pos-view-arrange"]');
    const layersView = this.panelEl.querySelector<HTMLElement>('[data-ref="pos-view-layers"]');

    if (arrangeView && layersView) {
      if (this.activeTab === 'arrange') {
        arrangeView.classList.remove('is-hidden');
        layersView.classList.add('is-hidden');
        this.renderArrangeTab(arrangeView);
      } else {
        arrangeView.classList.add('is-hidden');
        layersView.classList.remove('is-hidden');
        this.renderLayersTab(layersView);
      }
    }
  }

  private renderArrangeTab(container: HTMLElement): void {
    container.innerHTML = '';

    const sectionZ = document.createElement('div');
    sectionZ.className = 'board-pos-section canva-pos-section';
    const titleZ = document.createElement('div');
    titleZ.className = 'elements-section-title canva-drawer-section-title';
    titleZ.textContent = 'Adelante / Atrás';
    sectionZ.appendChild(titleZ);

    const zGrid = document.createElement('div');
    zGrid.className = 'board-pos-actions-grid canva-pos-actions-grid';

    const zActions: Array<{ action: 'back' | 'backward' | 'forward' | 'front'; icon: string; name: string }> = [
      { action: 'forward', icon: 'arrow_upward', name: 'Delante' },
      { action: 'backward', icon: 'arrow_downward', name: 'Detrás' },
      { action: 'front', icon: 'flip_to_front', name: 'Al frente' },
      { action: 'back', icon: 'flip_to_back', name: 'Al fondo' },
    ];

    for (const item of zActions) {
      const btn = document.createElement('button');
      btn.setAttribute('type', 'button');
      btn.className = 'board-pos-grid-btn canva-pos-grid-btn';
      btn.setAttribute('data-ref', `btn-pos-${item.action}`);
      btn.innerHTML = `<span class="component-icon">${item.icon}</span><span>${item.name}</span>`;
      btn.addEventListener('click', () => {
        this.callbacks.onReorder(item.action);
      });
      zGrid.appendChild(btn);
    }
    sectionZ.appendChild(zGrid);
    container.appendChild(sectionZ);

    const sectionAlign = document.createElement('div');
    sectionAlign.className = 'board-pos-section canva-pos-section';
    const titleAlign = document.createElement('div');
    titleAlign.className = 'elements-section-title canva-drawer-section-title';
    titleAlign.textContent = 'Alinear a la página';
    sectionAlign.appendChild(titleAlign);

    const alignGrid = document.createElement('div');
    alignGrid.className = 'board-pos-actions-grid board-pos-actions-grid--3cols canva-pos-actions-grid canva-pos-actions-grid--3cols';

    const alignActions: Array<{ align: 'bottom' | 'center' | 'left' | 'middle' | 'right' | 'top'; icon: string; name: string }> = [
      { align: 'top', icon: 'vertical_align_top', name: 'Arriba' },
      { align: 'left', icon: 'align_horizontal_left', name: 'Izquierda' },
      { align: 'middle', icon: 'vertical_align_center', name: 'En medio' },
      { align: 'center', icon: 'align_horizontal_center', name: 'Centro' },
      { align: 'bottom', icon: 'vertical_align_bottom', name: 'Abajo' },
      { align: 'right', icon: 'align_horizontal_right', name: 'Derecha' },
    ];

    for (const item of alignActions) {
      const btn = document.createElement('button');
      btn.setAttribute('type', 'button');
      btn.className = 'board-pos-grid-btn canva-pos-grid-btn';
      btn.setAttribute('data-ref', `btn-align-${item.align}`);
      btn.innerHTML = `<span class="component-icon">${item.icon}</span><span>${item.name}</span>`;
      btn.addEventListener('click', () => {
        this.callbacks.onAlign(item.align);
      });
      alignGrid.appendChild(btn);
    }
    sectionAlign.appendChild(alignGrid);
    container.appendChild(sectionAlign);

    const sectionAdv = document.createElement('div');
    sectionAdv.className = 'board-pos-section canva-pos-section';
    const titleAdv = document.createElement('div');
    titleAdv.className = 'elements-section-title canva-drawer-section-title';
    titleAdv.textContent = 'Avanzados';
    sectionAdv.appendChild(titleAdv);

    const el = this.selectedElement;
    const hasDimensions = el && 'width' in el && 'height' in el;
    const hasCoords = el && 'x' in el && 'y' in el;

    const widthVal = hasDimensions ? Math.round(Number((el as any).width) || 0) : 0;
    const heightVal = hasDimensions ? Math.round(Number((el as any).height) || 0) : 0;
    const xVal = hasCoords ? Math.round(Number((el as any).x) || 0) : 0;
    const yVal = hasCoords ? Math.round(Number((el as any).y) || 0) : 0;
    const rotVal = el && (el as any).rotation !== undefined ? Math.round(Number((el as any).rotation) || 0) : 0;
    const isAspectLocked = el && (el as any).aspectRatioLocked === true;

    const dimsRow = document.createElement('div');
    dimsRow.className = 'board-pos-dim-row canva-pos-dim-row';

    const widthCol = this.createNumericField('Ancho px', widthVal, !hasDimensions, (val) => {
      this.callbacks.onUpdateTransform({ width: Math.max(10, val) });
    });

    const lockBtn = document.createElement('button');
    lockBtn.setAttribute('type', 'button');
    lockBtn.className = `board-aspect-lock-btn canva-aspect-lock-btn${isAspectLocked ? ' is-active' : ''}`;
    lockBtn.setAttribute('data-tooltip', isAspectLocked ? 'Bloqueo de proporción activado' : 'Bloquear relación de aspecto');
    lockBtn.innerHTML = `<span class="component-icon">${isAspectLocked ? 'lock' : 'lock_open'}</span>`;
    lockBtn.addEventListener('click', () => {
      const nextLock = !isAspectLocked;
      this.callbacks.onUpdateTransform({ aspectRatioLocked: nextLock });
      this.renderArrangeTab(container);
    });

    const heightCol = this.createNumericField('Alto px', heightVal, !hasDimensions, (val) => {
      this.callbacks.onUpdateTransform({ height: Math.max(10, val) });
    });

    dimsRow.appendChild(widthCol);
    dimsRow.appendChild(lockBtn);
    dimsRow.appendChild(heightCol);
    sectionAdv.appendChild(dimsRow);

    const coordsRow = document.createElement('div');
    coordsRow.className = 'board-pos-dim-row canva-pos-dim-row';

    const xCol = this.createNumericField('X px', xVal, !hasCoords, (val) => {
      this.callbacks.onUpdateTransform({ x: val });
    });

    const yCol = this.createNumericField('Y px', yVal, !hasCoords, (val) => {
      this.callbacks.onUpdateTransform({ y: val });
    });

    coordsRow.appendChild(xCol);
    coordsRow.appendChild(yCol);
    sectionAdv.appendChild(coordsRow);

    const rotRow = document.createElement('div');
    rotRow.className = 'board-pos-dim-row canva-pos-dim-row';
    const rotCol = this.createNumericField('Rotar °', rotVal, false, (val) => {
      this.callbacks.onUpdateTransform({ rotation: val });
    });
    rotRow.appendChild(rotCol);
    sectionAdv.appendChild(rotRow);

    container.appendChild(sectionAdv);
    renderIcons(container);
  }

  private renderLayersTab(container: HTMLElement): void {
    container.innerHTML = '';

    const subtabsRow = document.createElement('div');
    subtabsRow.className = 'board-layers-subtabs canva-layers-subtabs';

    const btnAll = document.createElement('button');
    btnAll.setAttribute('type', 'button');
    btnAll.className = `board-layers-subtab canva-layers-subtab${this.layersSubtab === 'all' ? ' is-active' : ''}`;
    btnAll.textContent = 'Todas';
    btnAll.addEventListener('click', () => {
      this.layersSubtab = 'all';
      this.renderLayersTab(container);
    });

    const btnOverlap = document.createElement('button');
    btnOverlap.setAttribute('type', 'button');
    btnOverlap.className = `board-layers-subtab canva-layers-subtab${this.layersSubtab === 'overlap' ? ' is-active' : ''}`;
    btnOverlap.textContent = 'Superposición';
    btnOverlap.addEventListener('click', () => {
      this.layersSubtab = 'overlap';
      this.renderLayersTab(container);
    });

    subtabsRow.appendChild(btnAll);
    subtabsRow.appendChild(btnOverlap);
    container.appendChild(subtabsRow);

    const listEl = document.createElement('div');
    listEl.className = 'board-layers-list canva-layers-list';

    const displayElements = [...this.elements].reverse();

    if (displayElements.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'board-layers-empty canva-layers-empty';
      empty.textContent = 'No hay capas en esta diapositiva';
      listEl.appendChild(empty);
    } else {
      displayElements.forEach((el, revIndex) => {
        const originalIndex = this.elements.length - 1 - revIndex;
        const isSelected = this.selectedElement?.id === el.id;
        const isHidden = (el as any).hidden === true;
        const isLocked = (el as any).isLocked === true;

        const card = document.createElement('div');
        card.className = `board-layer-card canva-layer-card${isSelected ? ' is-active' : ''}${isHidden ? ' is-hidden-layer' : ''}`;
        card.setAttribute('draggable', 'true');
        card.setAttribute('data-ref', `layer-item-${el.id}`);

        const dragHandle = document.createElement('span');
        dragHandle.className = 'board-layer-drag-handle canva-layer-drag-handle component-icon';
        dragHandle.textContent = 'drag_indicator';
        card.appendChild(dragHandle);

        const iconSpan = document.createElement('span');
        iconSpan.className = 'board-layer-icon canva-layer-icon component-icon';
        iconSpan.textContent = this.getElementIcon(el);
        card.appendChild(iconSpan);

        const label = document.createElement('span');
        label.className = 'board-layer-name canva-layer-name';
        label.textContent = this.getElementLabel(el);
        card.appendChild(label);

        const actions = document.createElement('div');
        actions.className = 'board-layer-actions canva-layer-actions';

        const btnVis = document.createElement('button');
        btnVis.setAttribute('type', 'button');
        btnVis.className = 'board-layer-action-btn canva-layer-action-btn';
        btnVis.setAttribute('data-tooltip', isHidden ? 'Mostrar elemento' : 'Ocultar elemento');
        btnVis.innerHTML = `<span class="component-icon">${isHidden ? 'visibility_off' : 'visibility'}</span>`;
        btnVis.addEventListener('click', (e) => {
          e.stopPropagation();
          this.callbacks.onToggleVisibility(el.id);
        });
        actions.appendChild(btnVis);

        const btnLock = document.createElement('button');
        btnLock.setAttribute('type', 'button');
        btnLock.className = 'board-layer-action-btn canva-layer-action-btn';
        btnLock.setAttribute('data-tooltip', isLocked ? 'Desbloquear elemento' : 'Bloquear elemento');
        btnLock.innerHTML = `<span class="component-icon">${isLocked ? 'lock' : 'lock_open'}</span>`;
        btnLock.addEventListener('click', (e) => {
          e.stopPropagation();
          this.callbacks.onToggleLock(el.id);
        });
        actions.appendChild(btnLock);

        card.appendChild(actions);

        card.addEventListener('click', () => {
          this.callbacks.onSelectElement(el.id);
        });

        card.addEventListener('dragstart', (e: DragEvent) => {
          this.draggedLayerIndex = originalIndex;
          card.classList.add('is-dragging');
          if (e.dataTransfer) {
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', `${originalIndex}`);
          }
        });

        card.addEventListener('dragend', () => {
          card.classList.remove('is-dragging');
          this.draggedLayerIndex = null;
          listEl.querySelectorAll('.canva-layer-card, .board-layer-card').forEach((c) => c.classList.remove('is-drag-over'));
        });

        card.addEventListener('dragover', (e: DragEvent) => {
          e.preventDefault();
          if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
          if (this.draggedLayerIndex !== null && this.draggedLayerIndex !== originalIndex) {
            card.classList.add('is-drag-over');
          }
        });

        card.addEventListener('dragleave', () => {
          card.classList.remove('is-drag-over');
        });

        card.addEventListener('drop', (e: DragEvent) => {
          e.preventDefault();
          card.classList.remove('is-drag-over');
          if (this.draggedLayerIndex !== null && this.draggedLayerIndex !== originalIndex) {
            this.callbacks.onReorderLayers(this.draggedLayerIndex, originalIndex);
          }
        });

        listEl.appendChild(card);
      });
    }

    container.appendChild(listEl);
    renderIcons(container);
  }

  private createNumericField(labelText: string, val: number, disabled: boolean, onChange: (val: number) => void): HTMLElement {
    const col = document.createElement('div');
    col.className = 'board-pos-dim-col canva-pos-dim-col';

    const label = document.createElement('span');
    label.className = 'board-pos-dim-label canva-pos-dim-label';
    label.textContent = labelText;

    const input = document.createElement('input');
    input.className = 'board-pos-dim-input canva-pos-dim-input';
    input.setAttribute('type', 'number');
    input.value = `${val}`;
    if (disabled) input.disabled = true;

    input.addEventListener('change', () => {
      const n = Number(input.value);
      if (!Number.isNaN(n)) {
        onChange(n);
      }
    });

    col.appendChild(label);
    col.appendChild(input);
    return col;
  }

  private getElementIcon(el: BoardElement): string {
    switch (el.type) {
      case 'text':
        return 'text_fields';
      case 'shape':
        if (el.shapeType === 'circle') return 'circle';
        if (el.shapeType === 'triangle') return 'change_history';
        if (el.shapeType === 'star') return 'star';
        if (el.shapeType === 'line' || el.shapeType === 'arrow') return 'horizontal_rule';
        return 'crop_square';
      case 'sticky':
        return 'sticky_note_2';
      case 'stroke':
        return 'draw';
      case 'pixel-grid':
        return 'grid_on';
      case 'image':
        return 'image';
      case 'connector':
        return 'polyline';
      case 'table':
        return 'table_chart';
      case 'chart':
        return 'bar_chart';
      case 'shape-3d':
        return 'view_in_ar';
      case 'mockup':
        return 'devices';
      case 'section':
        return 'grid_view';
      default:
        return 'widgets';
    }
  }

  private getElementLabel(el: BoardElement): string {
    if (el.type === 'text' && el.text) {
      const snippet = el.text.trim().substring(0, 18);
      return snippet ? `"${snippet}${el.text.length > 18 ? '...' : ''}"` : 'Texto';
    }
    if (el.type === 'sticky' && el.text) {
      const snippet = el.text.trim().substring(0, 18);
      return snippet ? `Nota: "${snippet}"` : 'Nota adhesiva';
    }
    if (el.type === 'shape') {
      const names: Record<string, string> = {
        arrow: 'Flecha',
        circle: 'Círculo',
        cloud: 'Nube',
        cylinder: 'Cilindro',
        diamond: 'Rombo',
        document: 'Documento',
        line: 'Línea',
        parallelogram: 'Paralelogramo',
        pill: 'Píldora',
        rect: 'Rectángulo',
        'round-rect': 'Rectángulo redondeado',
        star: 'Estrella',
        triangle: 'Triángulo',
      };
      return names[el.shapeType] || 'Forma';
    }
    if (el.type === 'stroke') return 'Trazo';
    if (el.type === 'pixel-grid') return 'Sprite Pixel';
    if (el.type === 'image') return 'Imagen';
    if (el.type === 'connector') return 'Conector';
    if (el.type === 'table') return 'Tabla';
    if (el.type === 'chart') return 'Gráfica';
    if (el.type === 'shape-3d') return 'Objeto 3D';
    if (el.type === 'mockup') return 'Mockup';
    if (el.type === 'section') return el.title || 'Sección';
    return 'Elemento';
  }
}
