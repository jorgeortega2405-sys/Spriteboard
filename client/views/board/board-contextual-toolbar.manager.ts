import { isAnimationDrawerOpen, isEffectsDrawerOpen, isPositionDrawerOpen, openAnimationInDrawer, openEffectsInDrawer, openPositionInDrawer, toggleDrawer } from '../../components/layout.component.js';
import { openUpgradeModal } from '../../components/upgrade-modal.component.js';
import { BoardChartElement, BoardElement, BoardImageElement, BoardPixelGridElement, computeElementsBoundingBox, MarkerType, StrokeStyle, worldToScreen } from '../../core/canvas-engine.js';
import { currentUser } from '../../services/api.service.js';
import { removeImageBackground } from '../../services/image-ai.service.js';
import { showToast } from '../../services/toast.service.js';
import { withButtonLoading } from '../../utils/dom.util.js';

export interface BoardContextualToolbarHost {
  activePopover: HTMLElement | null;
  camera: { x: number; y: number; zoom: number };
  canvasElement: HTMLCanvasElement | null;
  chartsPanel: any;
  collaborationManager: any;
  container: HTMLElement;
  deleteSelected(): void;
  duplicateSelected(): void;
  effectsPanel: any;
  animationPanel: any;
  elements: BoardElement[];
  getSelectedElements(): BoardElement[];
  getSelectedPixelGrid(): BoardPixelGridElement | null;
  hideColorsPanel(): void;
  hideFontsPanel(): void;
  pixelGrid: any;
  pixelPanel: any;
  pixelTimeline: any;
  popoverConnStyleEl: HTMLElement | null;
  popoverCornersEl: HTMLElement | null;
  popoverMarkerEndEl: HTMLElement | null;
  popoverMarkerStartEl: HTMLElement | null;
  popoverOpacityEl: HTMLElement | null;
  popoverPositionEl: HTMLElement | null;
  popoverStrokeEl: HTMLElement | null;
  positionPanel: any;
  processingBgRemovalId: string | null;
  pushHistoryState(): void;
  reorderSelected(front: boolean): void;
  requestRedraw(): void;
  scheduleAutoSave(): void;
  selectedElementId: string | null;
  selectedElementIds: string[];
  selectionActionsManager: any;
  toggleColorsPanel(target: 'fill' | 'stroke' | 'text'): void;
  toggleFontsPanel(): void;
  topFillSwatchEl: HTMLElement | null;
  topFontFamilyLabelEl: HTMLElement | null;
  topFontSizeLabelEl: HTMLElement | null;
  topSelectionSectionEl: HTMLElement | null;
  topStrokeSwatchEl: HTMLElement | null;
  topTextSwatchEl: HTMLElement | null;
  topToolbarContainerEl: HTMLElement | null;
}

export class BoardContextualToolbarManager {
  private host: BoardContextualToolbarHost;

  constructor(host: BoardContextualToolbarHost) {
    this.host = host;
  }

  public updateSelectionToolbar(): void {
    this.updateContextualToolbar();

    const toolbar = this.host.container.querySelector<HTMLElement>('[data-ref="board-selection-toolbar"]');
    const selectedEls = this.host.getSelectedElements();
    if (!toolbar || selectedEls.length === 0 || !this.host.canvasElement) {
      toolbar?.classList.add('is-hidden');
      this.host.pixelTimeline?.hide();
      return;
    }

    const isSingle = selectedEls.length === 1;
    const isPixel = isSingle && selectedEls[0].type === 'pixel-grid';
    const isMockup = isSingle && selectedEls[0].type === 'mockup';
    const isChart = isSingle && selectedEls[0].type === 'chart';
    const isEmbed = isSingle && selectedEls[0].type === 'embed';

    const btnEdit = this.host.container.querySelector<HTMLElement>('[data-ref="btn-sel-edit-pixels"]');
    const btnGrid = this.host.container.querySelector<HTMLElement>('[data-ref="btn-sel-toggle-grid"]');
    const btnPixelAnim = this.host.container.querySelector<HTMLElement>('[data-ref="btn-sel-pixel-anim"]');
    const btnPixelLayers = this.host.container.querySelector<HTMLElement>('[data-ref="btn-sel-pixel-layers"]');
    const btnExport = this.host.container.querySelector<HTMLElement>('[data-ref="btn-sel-export-sprite"]');
    const divider = this.host.container.querySelector<HTMLElement>('[data-ref="sel-pixel-divider"]');
    const groupMockups = this.host.container.querySelector<HTMLElement>('[data-ref="board-sel-group-mockups"]');
    const groupCharts = this.host.container.querySelector<HTMLElement>('[data-ref="board-sel-group-charts"]');
    const groupEmbeds = this.host.container.querySelector<HTMLElement>('[data-ref="board-sel-group-embeds"]');

    btnEdit?.classList.toggle('is-hidden', !isPixel);
    btnGrid?.classList.toggle('is-hidden', !isPixel);
    btnPixelAnim?.classList.toggle('is-hidden', !isPixel);
    btnPixelLayers?.classList.toggle('is-hidden', !isPixel);
    btnExport?.classList.toggle('is-hidden', !isPixel);
    divider?.classList.toggle('is-hidden', !isPixel);
    groupMockups?.classList.toggle('is-hidden', !isMockup);
    groupCharts?.classList.toggle('is-hidden', !isChart);
    groupEmbeds?.classList.toggle('is-hidden', !isEmbed);

    if (isPixel) {
      const pixelGridEl = selectedEls[0] as BoardPixelGridElement;
      this.host.pixelTimeline?.attach(this.host.container, pixelGridEl, this.host.pixelGrid);
      this.host.pixelTimeline?.show();
      if (this.host.pixelPanel?.isOpen()) {
        this.host.pixelPanel.sync(pixelGridEl);
      }
    } else {
      this.host.pixelTimeline?.hide();
    }

    if (isChart && this.host.chartsPanel?.isOpen()) {
      this.host.chartsPanel.syncChart(selectedEls[0] as BoardChartElement);
    }

    const bbox = computeElementsBoundingBox(selectedEls);
    if (!bbox) {
      toolbar.classList.add('is-hidden');
      return;
    }
    const screenTopCenter = worldToScreen(bbox.x + bbox.width / 2, bbox.y, this.host.canvasElement, this.host.camera);
    toolbar.style.left = `${Math.max(10, screenTopCenter.x)}px`;
    toolbar.style.top = `${Math.max(60, screenTopCenter.y - 48)}px`;
    toolbar.classList.remove('is-hidden');
  }

  public updateContextualToolbar(): void {
    if (!this.host.topSelectionSectionEl) {
      this.host.topToolbarContainerEl = this.host.container.querySelector<HTMLElement>('[data-ref="board-top-toolbar-container"]');
      this.host.topSelectionSectionEl = this.host.container.querySelector<HTMLElement>('[data-ref="board-top-selection-section"]');
      this.host.topFillSwatchEl = this.host.container.querySelector<HTMLElement>('[data-ref="top-fill-swatch"]');
      this.host.topStrokeSwatchEl = this.host.container.querySelector<HTMLElement>('[data-ref="top-stroke-swatch"]');
      this.host.topTextSwatchEl = this.host.container.querySelector<HTMLElement>('[data-ref="top-text-swatch"]');
      this.host.topFontSizeLabelEl = this.host.container.querySelector<HTMLElement>('[data-ref="top-font-size-label"]');
    }

    const selectedEls = this.host.getSelectedElements();
    if (selectedEls.length === 0) {
      this.host.topToolbarContainerEl?.classList.add('is-hidden');
      this.host.topSelectionSectionEl?.classList.add('is-hidden');
      if (isEffectsDrawerOpen() || isAnimationDrawerOpen()) {
        toggleDrawer(false);
      }
      this.host.effectsPanel?.close();
      this.host.animationPanel?.close();
      this.host.positionPanel?.sync(null, this.host.elements);
      this.closeAllPopovers();
      return;
    }

    this.host.topToolbarContainerEl?.classList.remove('is-hidden');
    this.host.topSelectionSectionEl?.classList.remove('is-hidden');

    this.host.effectsPanel?.sync(selectedEls[0] || null);
    this.host.animationPanel?.sync(selectedEls[0] || null);
    this.host.positionPanel?.sync(selectedEls[0] || null, this.host.elements);

    const groupFill = this.host.container.querySelector<HTMLElement>('[data-ref="board-top-group-fill"]');
    const groupStrokeColor = this.host.container.querySelector<HTMLElement>('[data-ref="board-top-group-stroke-color"]');
    const groupStrokeStyle = this.host.container.querySelector<HTMLElement>('[data-ref="board-top-group-stroke-style"]');
    const groupCorners = this.host.container.querySelector<HTMLElement>('[data-ref="board-top-group-corners"]');
    const groupMarkers = this.host.container.querySelector<HTMLElement>('[data-ref="board-top-group-markers"]');
    const groupText = this.host.container.querySelector<HTMLElement>('[data-ref="board-top-group-text-props"]');
    const groupPixelProps = this.host.container.querySelector<HTMLElement>('[data-ref="board-top-group-pixel-props"]');
    const groupImage = this.host.container.querySelector<HTMLElement>('[data-ref="board-top-group-image"]');

    if (selectedEls.length === 1) {
      const el = selectedEls[0];
      const isShape = el.type === 'shape';
      const is3D = el.type === 'shape-3d';
      const isConnector = el.type === 'connector';
      const isSticky = el.type === 'sticky';
      const isText = el.type === 'text';
      const isStroke = el.type === 'stroke';
      const isPixel = el.type === 'pixel-grid';
      const isImage = el.type === 'image';
      const isSvgImage = isImage && !!(el.isSvg || el.svgContent || el.url?.includes('.svg') || el.url?.startsWith('data:image/svg+xml'));
      const isLineShape = isShape && (el.shapeType === 'line' || el.shapeType === 'arrow');

      if (groupImage) groupImage.classList.toggle('is-hidden', !isImage || isSvgImage);
      if (groupPixelProps) groupPixelProps.classList.toggle('is-hidden', !isPixel);

      if (groupFill) {
        const showFill = (isShape && !isLineShape) || isSticky || is3D || isSvgImage;
        groupFill.classList.toggle('is-hidden', !showFill);
        if (showFill && this.host.topFillSwatchEl) {
          const fillColor = isShape ? el.fillColor : (isSticky ? el.color : (is3D ? el.fillColor : (isSvgImage ? (el.fillColor || '#1e293b') : '#000000')));
          if (fillColor === 'transparent') {
            this.host.topFillSwatchEl.classList.add('is-transparent');
            this.host.topFillSwatchEl.style.backgroundColor = 'transparent';
          } else {
            this.host.topFillSwatchEl.classList.remove('is-transparent');
            this.host.topFillSwatchEl.style.backgroundColor = fillColor;
          }
        }
      }

      if (groupStrokeColor) {
        const showStroke = isLineShape || isConnector || isStroke || is3D || isSvgImage || (isShape && el.strokeWidth > 0);
        groupStrokeColor.classList.toggle('is-hidden', !showStroke);
        if (showStroke && this.host.topStrokeSwatchEl) {
          const strokeColor = isShape ? (el.strokeColor || '#1e293b') : (is3D ? (el.strokeColor || '#1e293b') : (isConnector ? (el.color || '#475569') : (isStroke ? el.color : (isSvgImage ? (el.strokeColor || '#1e293b') : '#1e293b'))));
          if (strokeColor === 'transparent') {
            this.host.topStrokeSwatchEl.classList.add('is-transparent');
            this.host.topStrokeSwatchEl.style.backgroundColor = 'transparent';
          } else {
            this.host.topStrokeSwatchEl.classList.remove('is-transparent');
            this.host.topStrokeSwatchEl.style.backgroundColor = strokeColor;
          }
        }
      }

      if (groupStrokeStyle) {
        const showStrokeStyle = isShape || isConnector || isStroke || is3D || isSvgImage;
        groupStrokeStyle.classList.toggle('is-hidden', !showStrokeStyle);
      }

      if (groupCorners) {
        const showCorners = (isShape && !isLineShape) || isImage;
        groupCorners.classList.toggle('is-hidden', !showCorners);
      }

      if (groupMarkers) {
        groupMarkers.classList.toggle('is-hidden', !isConnector);
      }

      if (groupText) {
        const showText = isText || isSticky || (isShape && !!el.text) || (isConnector && !!el.label);
        groupText.classList.toggle('is-hidden', !showText);
        if (showText) {
          const textColor = isText ? el.color : (isSticky ? el.textColor : (isShape ? (el.textColor || '#1e293b') : '#334155'));
          const fontSize = isText ? el.fontSize : (isSticky ? el.fontSize : (isShape ? (el.fontSize || 14) : 12));
          const rawFamily = (isText || isSticky || isShape) && (el as any).fontFamily ? (el as any).fontFamily : 'Inter';
          const fontFamilyName = rawFamily.split(',')[0].replace(/['"]/g, '').trim();
          if (this.host.topTextSwatchEl) this.host.topTextSwatchEl.style.backgroundColor = textColor;
          if (this.host.topFontSizeLabelEl) this.host.topFontSizeLabelEl.textContent = `${fontSize}`;
          if (this.host.topFontFamilyLabelEl) this.host.topFontFamilyLabelEl.textContent = fontFamilyName;

          const btnBold = this.host.container.querySelector<HTMLButtonElement>('[data-ref="top-btn-bold"]');
          const btnItalic = this.host.container.querySelector<HTMLButtonElement>('[data-ref="top-btn-italic"]');
          const btnUnderline = this.host.container.querySelector<HTMLButtonElement>('[data-ref="top-btn-underline"]');
          const btnStrikethrough = this.host.container.querySelector<HTMLButtonElement>('[data-ref="top-btn-strikethrough"]');
          const iconTextAlign = this.host.container.querySelector<HTMLElement>('[data-ref="top-icon-text-align"]');

          const isBold = (el as any).fontWeight === 700 || (el as any).fontWeight === 'bold';
          const isItalic = (el as any).fontStyle === 'italic';
          const isUnderline = (el as any).textDecoration === 'underline';
          const isStrikethrough = (el as any).textDecoration === 'line-through';
          const currentAlign = (el as any).textAlign || 'left';

          btnBold?.classList.toggle('is-active', isBold);
          btnItalic?.classList.toggle('is-active', isItalic);
          btnUnderline?.classList.toggle('is-active', isUnderline);
          btnStrikethrough?.classList.toggle('is-active', isStrikethrough);
          if (iconTextAlign) {
            iconTextAlign.textContent = currentAlign === 'center' ? 'format_align_center' : (currentAlign === 'right' ? 'format_align_right' : 'format_align_left');
          }
        }
      }

      this.syncPopoversWithElement(el);
    } else {
      const hasFillable = selectedEls.some((el) => (el.type === 'shape' && el.shapeType !== 'line' && el.shapeType !== 'arrow') || el.type === 'sticky' || el.type === 'shape-3d' || (el.type === 'image' && (el.isSvg || el.svgContent || el.url?.includes('.svg') || el.url?.startsWith('data:image/svg+xml'))));
      const hasStrokeable = selectedEls.some((el) => el.type === 'stroke' || el.type === 'connector' || el.type === 'shape' || el.type === 'shape-3d' || el.type === 'image');
      const hasTextual = selectedEls.some((el) => el.type === 'text' || el.type === 'sticky' || (el.type === 'shape' && !!el.text));

      if (groupImage) groupImage.classList.add('is-hidden');
      if (groupPixelProps) groupPixelProps.classList.add('is-hidden');
      if (groupFill) groupFill.classList.toggle('is-hidden', !hasFillable);
      if (groupStrokeColor) groupStrokeColor.classList.toggle('is-hidden', !hasStrokeable);
      if (groupStrokeStyle) groupStrokeStyle.classList.toggle('is-hidden', !hasStrokeable);
      if (groupCorners) groupCorners.classList.toggle('is-hidden', !selectedEls.some((el) => el.type === 'shape' || el.type === 'image'));
      if (groupMarkers) groupMarkers.classList.add('is-hidden');
      if (groupText) groupText.classList.toggle('is-hidden', !hasTextual);
    }
  }

  public syncPopoversWithElement(el: BoardElement): void {
    const isShape = el.type === 'shape';
    const is3D = el.type === 'shape-3d';
    const isConnector = el.type === 'connector';
    const isStroke = el.type === 'stroke';
    const isImage = el.type === 'image';

    const inputStrokeW = this.host.container.querySelector<HTMLInputElement>('[data-ref="input-popover-stroke-width"]');
    const labelStrokeW = this.host.container.querySelector<HTMLElement>('[data-ref="label-popover-stroke-width"]');
    const currentW = isShape ? el.strokeWidth : (is3D ? el.strokeWidth : (isConnector ? el.strokeWidth : (isStroke ? el.size : (isImage ? (el.strokeWidth || 0) : 0))));
    if (inputStrokeW) inputStrokeW.value = `${currentW}`;
    if (labelStrokeW) labelStrokeW.textContent = `${currentW}`;

    const currentPreset = (el as any).strokeStyle || (currentW === 0 ? 'none' : 'solid');
    this.host.container.querySelectorAll<HTMLButtonElement>('[data-stroke-preset]').forEach((btn) => {
      btn.classList.toggle('is-active', btn.getAttribute('data-stroke-preset') === currentPreset);
    });

    const inputCorners = this.host.container.querySelector<HTMLInputElement>('[data-ref="input-popover-corner-radius"]');
    const labelCorners = this.host.container.querySelector<HTMLElement>('[data-ref="label-popover-corner-radius"]');
    const currentR = (isShape || isImage) ? (el.borderRadius || (el as any).cornerRadius || 0) : 0;
    if (inputCorners) inputCorners.value = `${currentR}`;
    if (labelCorners) labelCorners.textContent = `${currentR}`;

    const sidesContainer = this.host.container.querySelector<HTMLElement>('[data-ref="popover-sides-container"]');
    const inputSides = this.host.container.querySelector<HTMLInputElement>('[data-ref="input-popover-sides"]');
    const labelSides = this.host.container.querySelector<HTMLElement>('[data-ref="label-popover-sides"]');
    const hasSides = isShape && (el.shapeType === 'star' || (el.sides !== undefined && el.sides > 0));
    if (sidesContainer) sidesContainer.classList.toggle('is-hidden', !hasSides);
    if (hasSides && inputSides && labelSides) {
      const currentSides = isShape && el.sides ? el.sides : 5;
      inputSides.value = `${currentSides}`;
      labelSides.textContent = `${currentSides}`;
    }

    const inputOpacity = this.host.container.querySelector<HTMLInputElement>('[data-ref="input-popover-opacity"]');
    const labelOpacity = this.host.container.querySelector<HTMLElement>('[data-ref="label-popover-opacity"]');
    const currentOp = Math.round(((el as any).opacity !== undefined ? (el as any).opacity : 1) * 100);
    if (inputOpacity) inputOpacity.value = `${currentOp}`;
    if (labelOpacity) labelOpacity.textContent = `${currentOp}`;

    if (isConnector) {
      const startMarker = el.arrowStart === true ? 'arrow-filled' : (el.arrowStart || 'none');
      const endMarker = el.arrowEnd === true || el.arrowEnd === undefined ? 'arrow-filled' : (el.arrowEnd === false ? 'none' : el.arrowEnd);
      this.host.container.querySelectorAll<HTMLButtonElement>('[data-ref="grid-marker-start"] [data-marker]').forEach((btn) => {
        btn.classList.toggle('is-active', btn.getAttribute('data-marker') === startMarker);
      });
      this.host.container.querySelectorAll<HTMLButtonElement>('[data-ref="grid-marker-end"] [data-marker]').forEach((btn) => {
        btn.classList.toggle('is-active', btn.getAttribute('data-marker') === endMarker);
      });
      this.host.container.querySelectorAll<HTMLButtonElement>('[data-conn-style]').forEach((btn) => {
        btn.classList.toggle('is-active', btn.getAttribute('data-conn-style') === el.style);
      });
    }
  }

  public togglePopover(popover: HTMLElement, anchorBtn: HTMLElement): void {
    if (!popover.classList.contains('is-hidden')) {
      popover.classList.add('is-hidden');
      this.host.activePopover = null;
      return;
    }

    this.closeAllPopovers();
    this.host.hideColorsPanel();
    this.host.hideFontsPanel();

    const rect = anchorBtn.getBoundingClientRect();
    const containerRect = this.host.container.querySelector<HTMLElement>('[data-ref="board-viewport"]')?.getBoundingClientRect();
    if (containerRect) {
      const left = Math.max(8, Math.min(rect.left - containerRect.left, containerRect.width - 280));
      popover.style.left = `${left}px`;
      popover.style.top = `${rect.bottom - containerRect.top + 6}px`;
    }

    popover.classList.remove('is-hidden');
    this.host.activePopover = popover;
  }

  public closeAllPopovers(): void {
    this.host.container.querySelectorAll<HTMLElement>('.board-context-popover').forEach((p) => {
      p.classList.add('is-hidden');
    });
    this.host.activePopover = null;
  }

  public bindContextualToolbar(signal: AbortSignal): void {
    this.host.topToolbarContainerEl = this.host.container.querySelector<HTMLElement>('[data-ref="board-top-toolbar-container"]');
    this.host.topSelectionSectionEl = this.host.container.querySelector<HTMLElement>('[data-ref="board-top-selection-section"]');
    this.host.topFillSwatchEl = this.host.container.querySelector<HTMLElement>('[data-ref="top-fill-swatch"]');
    this.host.topStrokeSwatchEl = this.host.container.querySelector<HTMLElement>('[data-ref="top-stroke-swatch"]');
    this.host.topTextSwatchEl = this.host.container.querySelector<HTMLElement>('[data-ref="top-text-swatch"]');
    this.host.topFontSizeLabelEl = this.host.container.querySelector<HTMLElement>('[data-ref="top-font-size-label"]');
    this.host.topFontFamilyLabelEl = this.host.container.querySelector<HTMLElement>('[data-ref="top-font-family-label"]');

    this.host.popoverStrokeEl = this.host.container.querySelector<HTMLElement>('[data-ref="popover-stroke"]');
    this.host.popoverCornersEl = this.host.container.querySelector<HTMLElement>('[data-ref="popover-corners"]');
    this.host.popoverOpacityEl = this.host.container.querySelector<HTMLElement>('[data-ref="popover-opacity"]');
    this.host.popoverMarkerStartEl = this.host.container.querySelector<HTMLElement>('[data-ref="popover-marker-start"]');
    this.host.popoverMarkerEndEl = this.host.container.querySelector<HTMLElement>('[data-ref="popover-marker-end"]');
    this.host.popoverConnStyleEl = this.host.container.querySelector<HTMLElement>('[data-ref="popover-connector-style"]');
    this.host.popoverPositionEl = this.host.container.querySelector<HTMLElement>('[data-ref="popover-position"]');

    const btnFontFamily = this.host.container.querySelector<HTMLButtonElement>('[data-ref="top-btn-font-family"]');
    btnFontFamily?.addEventListener('click', () => {
      this.host.toggleFontsPanel();
    }, { signal });

    const btnTopPixelAnim = this.host.container.querySelector<HTMLButtonElement>('[data-ref="top-btn-pixel-anim"]');
    btnTopPixelAnim?.addEventListener('click', () => {
      const grid = this.host.getSelectedPixelGrid();
      if (grid) {
        this.host.pixelTimeline?.attach(this.host.container, grid, this.host.pixelGrid);
        this.host.pixelTimeline?.toggleFramesTray();
      }
    }, { signal });

    const btnTopPixelLayers = this.host.container.querySelector<HTMLButtonElement>('[data-ref="top-btn-pixel-layers"]');
    btnTopPixelLayers?.addEventListener('click', () => {
      const grid = this.host.getSelectedPixelGrid();
      if (grid) {
        this.host.pixelTimeline?.attach(this.host.container, grid, this.host.pixelGrid);
        this.host.pixelTimeline?.toggleLayersTray();
      }
    }, { signal });

    const btnFill = this.host.container.querySelector<HTMLButtonElement>('[data-ref="top-btn-fill"]');
    btnFill?.addEventListener('click', () => this.host.toggleColorsPanel('fill'), { signal });

    const btnStrokeColor = this.host.container.querySelector<HTMLButtonElement>('[data-ref="top-btn-stroke-color"]');
    btnStrokeColor?.addEventListener('click', () => this.host.toggleColorsPanel('stroke'), { signal });

    const btnStrokeStyle = this.host.container.querySelector<HTMLButtonElement>('[data-ref="top-btn-stroke-style"]');
    btnStrokeStyle?.addEventListener('click', () => {
      if (this.host.popoverStrokeEl && btnStrokeStyle) this.togglePopover(this.host.popoverStrokeEl, btnStrokeStyle);
    }, { signal });

    const btnCorners = this.host.container.querySelector<HTMLButtonElement>('[data-ref="top-btn-corners"]');
    btnCorners?.addEventListener('click', () => {
      if (this.host.popoverCornersEl && btnCorners) this.togglePopover(this.host.popoverCornersEl, btnCorners);
    }, { signal });

    const btnMarkerStart = this.host.container.querySelector<HTMLButtonElement>('[data-ref="top-btn-marker-start"]');
    btnMarkerStart?.addEventListener('click', () => {
      if (this.host.popoverMarkerStartEl && btnMarkerStart) this.togglePopover(this.host.popoverMarkerStartEl, btnMarkerStart);
    }, { signal });

    const btnSwapMarkers = this.host.container.querySelector<HTMLButtonElement>('[data-ref="top-btn-swap-markers"]');
    btnSwapMarkers?.addEventListener('click', () => {
      if (!this.host.selectedElementId) return;
      const el = this.host.elements.find((item) => item.id === this.host.selectedElementId);
      if (el && el.type === 'connector') {
        this.host.pushHistoryState();
        const prevStart = el.arrowStart;
        el.arrowStart = el.arrowEnd;
        el.arrowEnd = prevStart;
        if (!el.fromId && !el.toId && el.startPoint && el.endPoint) {
          const ptStart = { ...el.startPoint };
          el.startPoint = { ...el.endPoint };
          el.endPoint = ptStart;
        }
        this.host.collaborationManager.broadcastUpdateElement(el);
        this.host.requestRedraw();
        this.host.scheduleAutoSave();
        this.updateContextualToolbar();
      }
    }, { signal });

    const btnMarkerEnd = this.host.container.querySelector<HTMLButtonElement>('[data-ref="top-btn-marker-end"]');
    btnMarkerEnd?.addEventListener('click', () => {
      if (this.host.popoverMarkerEndEl && btnMarkerEnd) this.togglePopover(this.host.popoverMarkerEndEl, btnMarkerEnd);
    }, { signal });

    const btnConnStyle = this.host.container.querySelector<HTMLButtonElement>('[data-ref="top-btn-connector-style"]');
    btnConnStyle?.addEventListener('click', () => {
      if (this.host.popoverConnStyleEl && btnConnStyle) this.togglePopover(this.host.popoverConnStyleEl, btnConnStyle);
    }, { signal });

    const btnTextColor = this.host.container.querySelector<HTMLButtonElement>('[data-ref="top-btn-text-color"]');
    btnTextColor?.addEventListener('click', () => this.host.toggleColorsPanel('text'), { signal });

    const btnFontDec = this.host.container.querySelector<HTMLButtonElement>('[data-ref="top-btn-font-dec"]');
    btnFontDec?.addEventListener('click', () => this.host.selectionActionsManager?.adjustSelectedFontSize(-2), { signal });

    const btnFontInc = this.host.container.querySelector<HTMLButtonElement>('[data-ref="top-btn-font-inc"]');
    btnFontInc?.addEventListener('click', () => this.host.selectionActionsManager?.adjustSelectedFontSize(2), { signal });

    const btnBold = this.host.container.querySelector<HTMLButtonElement>('[data-ref="top-btn-bold"]');
    btnBold?.addEventListener('click', () => this.toggleSelectedBold(), { signal });

    const btnItalic = this.host.container.querySelector<HTMLButtonElement>('[data-ref="top-btn-italic"]');
    btnItalic?.addEventListener('click', () => this.toggleSelectedItalic(), { signal });

    const btnUnderline = this.host.container.querySelector<HTMLButtonElement>('[data-ref="top-btn-underline"]');
    btnUnderline?.addEventListener('click', () => this.toggleSelectedUnderline(), { signal });

    const btnStrikethrough = this.host.container.querySelector<HTMLButtonElement>('[data-ref="top-btn-strikethrough"]');
    btnStrikethrough?.addEventListener('click', () => this.toggleSelectedStrikethrough(), { signal });

    const btnTextAlign = this.host.container.querySelector<HTMLButtonElement>('[data-ref="top-btn-text-align"]');
    btnTextAlign?.addEventListener('click', () => this.cycleSelectedTextAlign(), { signal });

    const btnOpacity = this.host.container.querySelector<HTMLButtonElement>('[data-ref="top-btn-opacity"]');
    btnOpacity?.addEventListener('click', () => {
      if (this.host.popoverOpacityEl && btnOpacity) this.togglePopover(this.host.popoverOpacityEl, btnOpacity);
    }, { signal });

    const btnEffects = this.host.container.querySelector<HTMLButtonElement>('[data-ref="top-btn-effects"]');
    btnEffects?.addEventListener('click', () => {
      if (isEffectsDrawerOpen()) {
        toggleDrawer(false);
      } else {
        openEffectsInDrawer();
      }
    }, { signal });

    const btnAnimate = this.host.container.querySelector<HTMLButtonElement>('[data-ref="top-btn-animate"]');
    btnAnimate?.addEventListener('click', () => {
      if (isAnimationDrawerOpen()) {
        toggleDrawer(false);
      } else {
        openAnimationInDrawer();
      }
    }, { signal });

    const btnPosition = this.host.container.querySelector<HTMLButtonElement>('[data-ref="top-btn-position"]');
    btnPosition?.addEventListener('click', () => {
      if (isPositionDrawerOpen()) {
        toggleDrawer(false);
      } else {
        openPositionInDrawer();
      }
    }, { signal });

    const btnDuplicate = this.host.container.querySelector<HTMLButtonElement>('[data-ref="top-btn-duplicate"]');
    btnDuplicate?.addEventListener('click', () => this.host.duplicateSelected(), { signal });

    const btnDelete = this.host.container.querySelector<HTMLButtonElement>('[data-ref="top-btn-delete"]');
    btnDelete?.addEventListener('click', () => this.host.deleteSelected(), { signal });

    const btnRemoveBg = this.host.container.querySelector<HTMLButtonElement>('[data-ref="top-btn-remove-bg"]');
    if (btnRemoveBg) {
      btnRemoveBg.addEventListener('click', async () => {
        const userPermissions: string[] = (currentUser as any)?.permissions || [];
        const hasAiBgRemoval = userPermissions.includes('*') ||
          userPermissions.includes('subscription:feature:ai_bg_removal') ||
          userPermissions.includes('subscription:feature:all');
        if (!hasAiBgRemoval) {
          openUpgradeModal('pro');
          showToast('La eliminación de fondo con IA está disponible para planes Pro y Negocios', 'info');
          return;
        }

        const selectedEls = this.host.getSelectedElements();
        if (selectedEls.length !== 1 || selectedEls[0].type !== 'image') {
          showToast('Selecciona una imagen para eliminar su fondo', 'info');
          return;
        }
        const imageEl = selectedEls[0] as BoardImageElement;
        if (!imageEl.url) {
          showToast('La imagen seleccionada no tiene una fuente válida', 'warning');
          return;
        }

        await withButtonLoading(btnRemoveBg, async () => {
          showToast('Eliminando fondo con IA...', 'info');
          this.host.processingBgRemovalId = imageEl.id;
          const animTimer = window.setInterval(() => {
            this.host.requestRedraw();
          }, 1000 / 60);

          try {
            const result = await removeImageBackground(imageEl.url);
            if (result.success && result.url) {
              this.host.pushHistoryState();
              imageEl.url = result.url;
              this.host.collaborationManager.broadcastUpdateElement(imageEl);
              this.host.requestRedraw();
              this.host.scheduleAutoSave();
              showToast('Fondo eliminado exitosamente', 'success');
            } else {
              if ((result as any).upgradeRequired) {
                openUpgradeModal('pro');
              }
              showToast(result.error || 'No se pudo eliminar el fondo de la imagen', 'error');
            }
          } finally {
            window.clearInterval(animTimer);
            this.host.processingBgRemovalId = null;
            this.host.requestRedraw();
          }
        });
      }, { signal });
    }

    const btnPosFront = this.host.container.querySelector<HTMLButtonElement>('[data-ref="btn-pos-front"]');
    btnPosFront?.addEventListener('click', () => {
      this.host.reorderSelected(true);
      this.closeAllPopovers();
    }, { signal });

    const btnPosBack = this.host.container.querySelector<HTMLButtonElement>('[data-ref="btn-pos-back"]');
    btnPosBack?.addEventListener('click', () => {
      this.host.reorderSelected(false);
      this.closeAllPopovers();
    }, { signal });

    this.host.container.querySelectorAll<HTMLButtonElement>('[data-stroke-preset]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const preset = btn.getAttribute('data-stroke-preset') as StrokeStyle | 'none';
        if (!this.host.selectedElementId) return;
        const el = this.host.elements.find((item) => item.id === this.host.selectedElementId);
        if (!el) return;
        this.host.pushHistoryState();
        if (preset === 'none') {
          if (el.type === 'shape') el.strokeWidth = 0;
          if (el.type === 'stroke') el.size = 0;
          if (el.type === 'connector') el.strokeWidth = 0;
          if (el.type === 'image') el.strokeWidth = 0;
        } else {
          if (el.type === 'shape') {
            el.strokeStyle = preset;
            if (el.strokeWidth === 0) el.strokeWidth = 2;
            if (el.strokeColor === 'transparent') el.strokeColor = '#1e293b';
          }
          if (el.type === 'stroke') {
            el.strokeStyle = preset;
            if (el.size === 0) el.size = 2;
          }
          if (el.type === 'connector') {
            el.strokeStyle = preset;
            if (el.strokeWidth === 0) el.strokeWidth = 2;
          }
          if (el.type === 'image') {
            el.strokeStyle = preset;
            if ((el.strokeWidth || 0) === 0) el.strokeWidth = 2;
            if (!el.strokeColor || el.strokeColor === 'transparent') el.strokeColor = '#1e293b';
          }
        }
        this.host.collaborationManager.broadcastUpdateElement(el);
        this.host.requestRedraw();
        this.host.scheduleAutoSave();
        this.updateContextualToolbar();
      }, { signal });
    });

    const inputStrokeW = this.host.container.querySelector<HTMLInputElement>('[data-ref="input-popover-stroke-width"]');
    const labelStrokeW = this.host.container.querySelector<HTMLElement>('[data-ref="label-popover-stroke-width"]');
    inputStrokeW?.addEventListener('input', () => {
      const val = parseInt(inputStrokeW.value, 10) || 0;
      if (labelStrokeW) labelStrokeW.textContent = `${val}`;
      if (!this.host.selectedElementId) return;
      const el = this.host.elements.find((item) => item.id === this.host.selectedElementId);
      if (!el) return;
      if (el.type === 'shape') {
        el.strokeWidth = val;
        if (val > 0 && el.strokeColor === 'transparent') el.strokeColor = '#1e293b';
      }
      if (el.type === 'image') {
        el.strokeWidth = val;
        if (val > 0 && (!el.strokeColor || el.strokeColor === 'transparent')) el.strokeColor = '#1e293b';
      }
      if (el.type === 'stroke') el.size = Math.max(1, val);
      if (el.type === 'connector') el.strokeWidth = Math.max(1, val);
      this.host.requestRedraw();
    }, { signal });
    inputStrokeW?.addEventListener('change', () => {
      if (!this.host.selectedElementId) return;
      const el = this.host.elements.find((item) => item.id === this.host.selectedElementId);
      if (el) {
        this.host.pushHistoryState();
        this.host.collaborationManager.broadcastUpdateElement(el);
        this.host.scheduleAutoSave();
        this.updateContextualToolbar();
      }
    }, { signal });

    const inputCorners = this.host.container.querySelector<HTMLInputElement>('[data-ref="input-popover-corner-radius"]');
    const labelCorners = this.host.container.querySelector<HTMLElement>('[data-ref="label-popover-corner-radius"]');
    inputCorners?.addEventListener('input', () => {
      const val = parseInt(inputCorners.value, 10) || 0;
      if (labelCorners) labelCorners.textContent = `${val}`;
      if (!this.host.selectedElementId) return;
      const el = this.host.elements.find((item) => item.id === this.host.selectedElementId);
      if (el && (el.type === 'shape' || el.type === 'image')) {
        el.borderRadius = val;
        (el as any).cornerRadius = val;
        this.host.requestRedraw();
      }
    }, { signal });
    inputCorners?.addEventListener('change', () => {
      if (!this.host.selectedElementId) return;
      const el = this.host.elements.find((item) => item.id === this.host.selectedElementId);
      if (el && (el.type === 'shape' || el.type === 'image')) {
        this.host.pushHistoryState();
        this.host.collaborationManager.broadcastUpdateElement(el);
        this.host.scheduleAutoSave();
      }
    }, { signal });

    const inputSides = this.host.container.querySelector<HTMLInputElement>('[data-ref="input-popover-sides"]');
    const labelSides = this.host.container.querySelector<HTMLElement>('[data-ref="label-popover-sides"]');
    inputSides?.addEventListener('input', () => {
      const val = parseInt(inputSides.value, 10) || 5;
      if (labelSides) labelSides.textContent = `${val}`;
      if (!this.host.selectedElementId) return;
      const el = this.host.elements.find((item) => item.id === this.host.selectedElementId);
      if (el && el.type === 'shape') {
        el.sides = val;
        this.host.requestRedraw();
      }
    }, { signal });
    inputSides?.addEventListener('change', () => {
      if (!this.host.selectedElementId) return;
      const el = this.host.elements.find((item) => item.id === this.host.selectedElementId);
      if (el && el.type === 'shape') {
        this.host.pushHistoryState();
        this.host.collaborationManager.broadcastUpdateElement(el);
        this.host.scheduleAutoSave();
      }
    }, { signal });

    const inputOpacity = this.host.container.querySelector<HTMLInputElement>('[data-ref="input-popover-opacity"]');
    const labelOpacity = this.host.container.querySelector<HTMLElement>('[data-ref="label-popover-opacity"]');
    inputOpacity?.addEventListener('input', () => {
      const val = parseInt(inputOpacity.value, 10) || 0;
      if (labelOpacity) labelOpacity.textContent = `${val}`;
      if (!this.host.selectedElementId) return;
      const el = this.host.elements.find((item) => item.id === this.host.selectedElementId);
      if (el) {
        (el as any).opacity = val / 100;
        this.host.requestRedraw();
      }
    }, { signal });
    inputOpacity?.addEventListener('change', () => {
      if (!this.host.selectedElementId) return;
      const el = this.host.elements.find((item) => item.id === this.host.selectedElementId);
      if (el) {
        this.host.pushHistoryState();
        this.host.collaborationManager.broadcastUpdateElement(el);
        this.host.scheduleAutoSave();
      }
    }, { signal });

    this.host.container.querySelectorAll<HTMLButtonElement>('[data-ref="grid-marker-start"] [data-marker]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const marker = btn.getAttribute('data-marker') as MarkerType;
        if (!this.host.selectedElementId) return;
        const el = this.host.elements.find((item) => item.id === this.host.selectedElementId);
        if (el && el.type === 'connector') {
          this.host.pushHistoryState();
          el.arrowStart = marker === 'none' ? false : marker;
          this.host.collaborationManager.broadcastUpdateElement(el);
          this.host.requestRedraw();
          this.host.scheduleAutoSave();
          this.updateContextualToolbar();
        }
      }, { signal });
    });

    this.host.container.querySelectorAll<HTMLButtonElement>('[data-ref="grid-marker-end"] [data-marker]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const marker = btn.getAttribute('data-marker') as MarkerType;
        if (!this.host.selectedElementId) return;
        const el = this.host.elements.find((item) => item.id === this.host.selectedElementId);
        if (el && el.type === 'connector') {
          this.host.pushHistoryState();
          el.arrowEnd = marker === 'none' ? false : marker;
          this.host.collaborationManager.broadcastUpdateElement(el);
          this.host.requestRedraw();
          this.host.scheduleAutoSave();
          this.updateContextualToolbar();
        }
      }, { signal });
    });

    this.host.container.querySelectorAll<HTMLButtonElement>('[data-conn-style]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const style = btn.getAttribute('data-conn-style') as 'curved' | 'orthogonal' | 'straight';
        if (!this.host.selectedElementId) return;
        const el = this.host.elements.find((item) => item.id === this.host.selectedElementId);
        if (el && el.type === 'connector') {
          this.host.pushHistoryState();
          el.style = style;
          this.host.collaborationManager.broadcastUpdateElement(el);
          this.host.requestRedraw();
          this.host.scheduleAutoSave();
          this.updateContextualToolbar();
        }
      }, { signal });
    });
  }

  public toggleSelectedBold(): void { this.host.selectionActionsManager?.toggleSelectedBold(); }
  public toggleSelectedItalic(): void { this.host.selectionActionsManager?.toggleSelectedItalic(); }
  public toggleSelectedUnderline(): void { this.host.selectionActionsManager?.toggleSelectedUnderline(); }
  public toggleSelectedStrikethrough(): void { this.host.selectionActionsManager?.toggleSelectedStrikethrough(); }
  public cycleSelectedTextAlign(): void { this.host.selectionActionsManager?.cycleSelectedTextAlign(); }
}
