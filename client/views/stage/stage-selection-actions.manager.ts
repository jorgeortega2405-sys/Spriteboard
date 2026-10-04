import { isAnimationDrawerOpen, isEffectsDrawerOpen, isPositionDrawerOpen, openAnimationInDrawer, openEffectsInDrawer, openPositionInDrawer, toggleDrawer } from '../../components/layout.component.js';
import { CanvasClipboardData, copyCanvasElements, getCanvasClipboardData, preparePastedCanvasElements } from '../../services/canvas-clipboard.service.js';
import { showToast } from '../../services/toast.service.js';
import { PresentationFormatConfig, PresentationSlideItem } from '../../types/stage.types.js';
import { computeElementsBoundingBox } from '../board/board-elements.manager.js';
import { worldToScreen } from '../board/board-renderer.js';
import { BoardElement, BoardElementAnimation, BoardElementEffect, BoardEmbedElement } from '../board/board.types.js';

export interface StageSelectionActionsHost {
  activeSlideId: string;
  canvas: HTMLCanvasElement | null;
  collaborationManager: any;
  consecutivePasteCount: number;
  container: HTMLElement;
  currentFillColor: string;
  currentStrokeColor: string;
  effectsPanel: any;
  animationPanel: any;
  positionPanel: any;
  getActiveSlide(): PresentationSlideItem;
  getActiveSlideCy(): number;
  panOffset: { x: number; y: number };
  playEmbedInline(embed: BoardEmbedElement): void;
  render(): void;
  saveHistoryState(): void;
  scheduleAutoSave(): void;
  selectedElementIds: Set<string>;
  selectedSlideId: string | null;
  slideFormat: PresentationFormatConfig;
  updateSelectionToolbar(): void;
  zoom: number;
}

export class StageSelectionActionsManager {
  private host: StageSelectionActionsHost;

  constructor(host: StageSelectionActionsHost) {
    this.host = host;
  }

  public bindFloatingToolbarEvents(signal: AbortSignal): void {
    const btnDup = this.host.container.querySelector<HTMLButtonElement>('[data-ref="btn-sel-duplicate"]');
    btnDup?.addEventListener('click', () => this.duplicateSelectedElements(), { signal });

    const btnFront = this.host.container.querySelector<HTMLButtonElement>('[data-ref="btn-sel-bring-forward"]');
    btnFront?.addEventListener('click', () => this.reorderSelected(true), { signal });

    const btnBack = this.host.container.querySelector<HTMLButtonElement>('[data-ref="btn-sel-send-backward"]');
    btnBack?.addEventListener('click', () => this.reorderSelected(false), { signal });

    const btnDel = this.host.container.querySelector<HTMLButtonElement>('[data-ref="btn-sel-delete"]');
    btnDel?.addEventListener('click', () => this.deleteSelectedElements(), { signal });

    const btnPlayEmbed = this.host.container.querySelector<HTMLButtonElement>('[data-ref="btn-sel-play-embed"]');
    btnPlayEmbed?.addEventListener(
      'click',
      () => {
        const elements = this.host.getActiveSlide().elements;
        const selectedEls = elements.filter((el) => this.host.selectedElementIds.has(el.id));
        if (selectedEls.length === 1 && selectedEls[0].type === 'embed') {
          const embed = selectedEls[0] as BoardEmbedElement;
          const videoId = embed.videoId;
          if (embed.embedType === 'youtube' && videoId) {
            this.host.playEmbedInline(embed);
          }
        }
      },
      { signal }
    );
  }

  public updateSelectionToolbar(): void {
    const topSlideSec = this.host.container.querySelector<HTMLElement>('[data-ref="presentation-top-slide-section"]');
    const topSelectionSec = this.host.container.querySelector<HTMLElement>('[data-ref="presentation-top-selection-section"]');
    const topToolbarCont = this.host.container.querySelector<HTMLElement>('[data-ref="presentation-top-toolbar-container"]');
    const groupText = this.host.container.querySelector<HTMLElement>('[data-ref="presentation-top-group-text-props"]');
    const groupFill = this.host.container.querySelector<HTMLElement>('[data-ref="presentation-top-group-fill"]');
    const groupStroke = this.host.container.querySelector<HTMLElement>('[data-ref="presentation-top-group-stroke-color"]');
    const groupStrokeStyle = this.host.container.querySelector<HTMLElement>('[data-ref="presentation-top-group-stroke-style"]');
    const groupCorners = this.host.container.querySelector<HTMLElement>('[data-ref="presentation-top-group-corners"]');
    const groupMarkers = this.host.container.querySelector<HTMLElement>('[data-ref="presentation-top-group-markers"]');
    const groupImage = this.host.container.querySelector<HTMLElement>('[data-ref="presentation-top-group-image"]');
    const fillSwatch = this.host.container.querySelector<HTMLElement>('[data-ref="top-fill-swatch"]');
    const strokeSwatch = this.host.container.querySelector<HTMLElement>('[data-ref="top-stroke-swatch"]');
    const textSwatch = this.host.container.querySelector<HTMLElement>('[data-ref="top-text-swatch"]');
    const slideBgSwatch = this.host.container.querySelector<HTMLElement>('[data-ref="top-slide-bg-swatch"]');
    const slideDurationLabel = this.host.container.querySelector<HTMLElement>('[data-ref="top-slide-duration-label"]');
    const fontSizeLabel = this.host.container.querySelector<HTMLElement>('[data-ref="top-font-size-label"]');
    const fontFamilyLabel = this.host.container.querySelector<HTMLElement>('[data-ref="top-font-family-label"]');
    const btnBold = this.host.container.querySelector<HTMLButtonElement>('[data-ref="top-btn-bold"]');
    const btnItalic = this.host.container.querySelector<HTMLButtonElement>('[data-ref="top-btn-italic"]');
    const btnUnderline = this.host.container.querySelector<HTMLButtonElement>('[data-ref="top-btn-underline"]');
    const btnStrikethrough = this.host.container.querySelector<HTMLButtonElement>('[data-ref="top-btn-strikethrough"]');
    const iconTextAlign = this.host.container.querySelector<HTMLElement>('[data-ref="top-icon-text-align"]');

    if (this.host.selectedElementIds.size > 0) {
      topToolbarCont?.classList.remove('is-hidden');
      topSlideSec?.classList.add('is-hidden');
      topSelectionSec?.classList.remove('is-hidden');

      const elements = this.host.getActiveSlide().elements;
      const selected = elements.filter((e) => this.host.selectedElementIds.has(e.id));
      const isSingleImage = selected.length === 1 && selected[0].type === 'image';
      const isSvgImage = selected.some((el) => el.type === 'image' && !!(el.isSvg || el.svgContent || el.url?.includes('.svg') || el.url?.startsWith('data:image/svg+xml')));
      const hasText = selected.some((el) => el.type === 'text' || el.type === 'sticky' || (el as any).text !== undefined);
      const hasConnector = selected.some((el) => el.type === 'connector');
      const hasShape = selected.some((el) => el.type === 'shape' || el.type === 'sticky' || el.type === 'section');
      const hasCorners = selected.some((el) => el.type === 'shape' || el.type === 'image');
      const hasFillable = selected.some((el) => (el.type === 'shape' && el.shapeType !== 'line' && el.shapeType !== 'arrow') || el.type === 'sticky' || el.type === 'section' || (el.type === 'image' && !!(el.isSvg || el.svgContent || el.url?.includes('.svg') || el.url?.startsWith('data:image/svg+xml'))));
      const hasStrokeable = selected.some((el) => el.type === 'shape' || el.type === 'stroke' || el.type === 'connector' || el.type === 'image');

      if (groupImage) groupImage.classList.toggle('is-hidden', !isSingleImage || isSvgImage);
      if (groupText) groupText.classList.toggle('is-hidden', !hasText);
      if (groupMarkers) groupMarkers.classList.toggle('is-hidden', !hasConnector);
      if (groupFill) groupFill.classList.toggle('is-hidden', !hasFillable && !hasText);
      if (groupStroke) groupStroke.classList.toggle('is-hidden', !hasStrokeable && hasConnector);
      if (groupStrokeStyle) groupStrokeStyle.classList.toggle('is-hidden', !hasStrokeable && hasConnector);
      if (groupCorners) groupCorners.classList.toggle('is-hidden', !hasCorners);

      const first = selected[0];
      if (first) {
        if (fillSwatch && ('fillColor' in first || 'color' in first)) {
          fillSwatch.style.backgroundColor = (first as any).fillColor || (first as any).color || this.host.currentFillColor;
        }
        if (strokeSwatch && 'strokeColor' in first) {
          strokeSwatch.style.backgroundColor = (first as any).strokeColor || this.host.currentStrokeColor;
        }
        if (textSwatch && ('color' in first || 'textColor' in first)) {
          textSwatch.style.backgroundColor = (first as any).color || (first as any).textColor || '#1e293b';
        }
        if (fontSizeLabel && 'fontSize' in first) {
          fontSizeLabel.textContent = String((first as any).fontSize || 20);
        }
        if (fontFamilyLabel && 'fontFamily' in first && (first as any).fontFamily) {
          fontFamilyLabel.textContent = (first as any).fontFamily.split(',')[0].replace(/['"]/g, '').trim();
        }

        const isBold = (first as any).fontWeight === 700 || (first as any).fontWeight === 'bold';
        const isItalic = (first as any).fontStyle === 'italic';
        const isUnderline = (first as any).textDecoration === 'underline';
        const isStrikethrough = (first as any).textDecoration === 'line-through';
        const textAlign = (first as any).textAlign || 'left';

        btnBold?.classList.toggle('is-active', isBold);
        btnItalic?.classList.toggle('is-active', isItalic);
        btnUnderline?.classList.toggle('is-active', isUnderline);
        btnStrikethrough?.classList.toggle('is-active', isStrikethrough);

        if (iconTextAlign) {
          const alignIconMap: Record<string, string> = {
            center: 'format_align_center',
            left: 'format_align_left',
            right: 'format_align_right',
          };
          iconTextAlign.textContent = alignIconMap[textAlign] || 'format_align_left';
        }
      }
    } else if (this.host.selectedSlideId !== null) {
      if (groupImage) groupImage.classList.add('is-hidden');
      topToolbarCont?.classList.remove('is-hidden');
      topSelectionSec?.classList.add('is-hidden');
      topSlideSec?.classList.remove('is-hidden');

      const currentSlide = this.host.getActiveSlide();
      if (slideBgSwatch) {
        slideBgSwatch.style.backgroundColor = currentSlide.background?.color || '#ffffff';
      }
      if (slideDurationLabel) {
        slideDurationLabel.textContent = `${(currentSlide.duration || 5.0).toFixed(1)}s`;
      }
    } else {
      if (groupImage) groupImage.classList.add('is-hidden');
      topToolbarCont?.classList.add('is-hidden');
      topSelectionSec?.classList.add('is-hidden');
      topSlideSec?.classList.add('is-hidden');
    }

    this.updateFloatingToolbarPosition();
  }

  public updateFloatingToolbarPosition(): void {
    const floatingToolbar = this.host.container.querySelector<HTMLElement>('[data-ref="presentation-selection-toolbar"]');
    if (!floatingToolbar || !this.host.canvas) return;

    if (this.host.selectedElementIds.size === 0) {
      floatingToolbar.classList.add('is-hidden');
      return;
    }

    const elements = this.host.getActiveSlide().elements;
    const selectedEls = elements.filter((el) => this.host.selectedElementIds.has(el.id));
    if (selectedEls.length === 0) {
      floatingToolbar.classList.add('is-hidden');
      return;
    }

    const groupEmbeds = this.host.container.querySelector<HTMLElement>('[data-ref="presentation-sel-group-embeds"]');
    const isEmbed = selectedEls.length === 1 && selectedEls[0].type === 'embed';
    groupEmbeds?.classList.toggle('is-hidden', !isEmbed);

    const bbox = computeElementsBoundingBox(selectedEls);
    if (!bbox) {
      floatingToolbar.classList.add('is-hidden');
      return;
    }
    const activeCy = this.host.getActiveSlideCy();
    const camera = { x: this.host.panOffset.x, y: this.host.panOffset.y, zoom: this.host.zoom };
    const topLeftScreen = worldToScreen(bbox.x, bbox.y + activeCy, this.host.canvas, camera);
    const bottomRightScreen = worldToScreen(bbox.x + bbox.width, bbox.y + bbox.height + activeCy, this.host.canvas, camera);

    const toolbarWidth = floatingToolbar.offsetWidth || 180;
    const toolbarHeight = floatingToolbar.offsetHeight || 40;
    const centerX = (topLeftScreen.x + bottomRightScreen.x) / 2;
    const targetTop = topLeftScreen.y - toolbarHeight - 12;

    const finalTop = targetTop < 10 ? bottomRightScreen.y + 12 : targetTop;
    const finalLeft = Math.max(10, centerX - toolbarWidth / 2);

    floatingToolbar.style.transform = `translate(${finalLeft}px, ${finalTop}px)`;
    floatingToolbar.classList.remove('is-hidden');
  }

  public toggleEffectsPanel(): void {
    if (isEffectsDrawerOpen()) {
      toggleDrawer(false);
    } else {
      openEffectsInDrawer();
    }
  }

  public toggleAnimationPanel(): void {
    if (isAnimationDrawerOpen()) {
      toggleDrawer(false);
    } else {
      openAnimationInDrawer();
    }
  }

  public togglePositionPanel(): void {
    if (isPositionDrawerOpen()) {
      toggleDrawer(false);
    } else {
      openPositionInDrawer();
    }
  }

  public syncPanels(): void {
    const firstSelected = this.getFirstSelectedElement();
    if (this.host.selectedElementIds.size === 0 && (isEffectsDrawerOpen() || isAnimationDrawerOpen())) {
      toggleDrawer(false);
    }
    this.host.effectsPanel?.sync(firstSelected);
    this.host.animationPanel?.sync(firstSelected);
    this.host.positionPanel?.sync(firstSelected, this.host.getActiveSlide().elements);
  }

  public applySelectedEffect(effect: BoardElementEffect): void {
    if (this.host.selectedElementIds.size === 0) return;
    this.host.saveHistoryState();
    const elements = this.host.getActiveSlide().elements;
    elements.forEach((el) => {
      if (this.host.selectedElementIds.has(el.id)) {
        el.effect = effect;
      }
    });
    this.host.render();
    this.host.scheduleAutoSave();
  }

  public applySelectedAnimation(animation: BoardElementAnimation): void {
    if (this.host.selectedElementIds.size === 0) return;
    this.host.saveHistoryState();
    const elements = this.host.getActiveSlide().elements;
    elements.forEach((el) => {
      if (this.host.selectedElementIds.has(el.id)) {
        el.animation = animation;
      }
    });
    this.host.render();
    this.host.scheduleAutoSave();
  }

  public deleteSelectedElements(): void {
    if (this.host.selectedElementIds.size === 0) return;
    const deletedIds = Array.from(this.host.selectedElementIds);
    this.host.saveHistoryState();
    const slide = this.host.getActiveSlide();
    slide.elements = slide.elements.filter((el) => !this.host.selectedElementIds.has(el.id));
    deletedIds.forEach((id) => {
      this.host.collaborationManager.broadcastDeleteElement(id, this.host.activeSlideId);
    });
    this.host.selectedElementIds.clear();
    this.syncPanels();
    this.updateSelectionToolbar();
    this.host.render();
    this.host.scheduleAutoSave();
    showToast('Elementos eliminados', 'info');
  }

  public reorderSelected(toFront: boolean): void {
    if (this.host.selectedElementIds.size === 0) return;
    this.host.saveHistoryState();
    const slide = this.host.getActiveSlide();
    const selected: BoardElement[] = [];
    const others: BoardElement[] = [];

    slide.elements.forEach((el) => {
      if (this.host.selectedElementIds.has(el.id)) {
        selected.push(el);
      } else {
        others.push(el);
      }
    });

    if (toFront) {
      slide.elements = [...others, ...selected];
    } else {
      slide.elements = [...selected, ...others];
    }

    this.host.collaborationManager.broadcastReorderElements(slide.elements, this.host.activeSlideId);
    this.syncPanels();
    this.host.render();
    this.host.scheduleAutoSave();
  }

  public duplicateSelectedElements(): void {
    if (this.host.selectedElementIds.size === 0) return;
    const elements = this.host.getActiveSlide().elements;
    const toDuplicate = elements.filter((el) => this.host.selectedElementIds.has(el.id));
    if (toDuplicate.length === 0) return;

    this.host.saveHistoryState();
    const bounds = computeElementsBoundingBox(toDuplicate) || { height: 0, width: 0, x: 0, y: 0 };
    const clipData: CanvasClipboardData = {
      bounds,
      elements: toDuplicate,
      source: 'presentation',
      timestamp: Date.now(),
      version: 1,
    };
    const target = {
      x: bounds.x + bounds.width / 2 + 24,
      y: bounds.y + bounds.height / 2 + 24,
    };
    const { elements: newElements, newIds } = preparePastedCanvasElements(clipData, target);
    elements.push(...newElements);
    newElements.forEach((copy) => {
      this.host.collaborationManager.broadcastAddElement(copy, this.host.activeSlideId);
    });
    this.host.selectedElementIds = new Set(newIds);
    this.syncPanels();
    this.updateSelectionToolbar();
    this.host.render();
    this.host.scheduleAutoSave();
    showToast(newIds.length > 1 ? `${newIds.length} elementos duplicados` : 'Elemento duplicado');
  }

  public copySelectedElements(): void {
    if (this.host.selectedElementIds.size === 0) return;
    const elements = this.host.getActiveSlide().elements;
    const toCopy = elements.filter((el) => this.host.selectedElementIds.has(el.id));
    if (toCopy.length === 0) return;
    copyCanvasElements(toCopy, 'presentation', elements);
    this.host.consecutivePasteCount = 0;
    showToast(toCopy.length > 1 ? `${toCopy.length} elementos copiados` : 'Elemento copiado', 'info');
  }

  public cutSelectedElements(): void {
    if (this.host.selectedElementIds.size === 0) return;
    const elements = this.host.getActiveSlide().elements;
    const toCut = elements.filter((el) => this.host.selectedElementIds.has(el.id));
    if (toCut.length === 0) return;
    copyCanvasElements(toCut, 'presentation', elements);
    this.host.consecutivePasteCount = 0;
    this.deleteSelectedElements();
    showToast(toCut.length > 1 ? `${toCut.length} elementos cortados` : 'Elemento cortado', 'info');
  }

  public pasteElements(targetPos?: { x: number; y: number }): void {
    const clipboardData = getCanvasClipboardData();
    if (!clipboardData || !clipboardData.elements || clipboardData.elements.length === 0) return;

    this.host.saveHistoryState();
    let target = targetPos;
    if (!target) {
      this.host.consecutivePasteCount = (this.host.consecutivePasteCount || 0) + 1;
      const offset = 24 * this.host.consecutivePasteCount;
      target = {
        x: clipboardData.bounds.x + offset + clipboardData.bounds.width / 2,
        y: clipboardData.bounds.y + offset + clipboardData.bounds.height / 2,
      };
      const fmt = this.host.slideFormat;
      if (target.x < 0 || target.x > fmt.width || target.y < 0 || target.y > fmt.height) {
        target = { x: Math.round(fmt.width / 2), y: Math.round(fmt.height / 2) };
      }
    } else {
      this.host.consecutivePasteCount = 0;
    }

    const { elements: newElements, newIds } = preparePastedCanvasElements(clipboardData, target);
    const elements = this.host.getActiveSlide().elements;
    elements.push(...newElements);
    newElements.forEach((copy) => {
      this.host.collaborationManager.broadcastAddElement(copy, this.host.activeSlideId);
    });
    this.host.selectedElementIds = new Set(newIds);
    this.syncPanels();
    this.updateSelectionToolbar();
    this.host.render();
    this.host.scheduleAutoSave();
    showToast(newIds.length > 1 ? `${newIds.length} elementos pegados` : 'Elemento pegado', 'success');
  }

  public getSelectedElements(): BoardElement[] {
    if (this.host.selectedElementIds.size === 0) return [];
    return this.host.getActiveSlide().elements.filter((el) => this.host.selectedElementIds.has(el.id));
  }

  public getFirstSelectedElement(): BoardElement | null {
    if (this.host.selectedElementIds.size === 0) return null;
    const firstId = Array.from(this.host.selectedElementIds)[0];
    return this.host.getActiveSlide().elements.find((el) => el.id === firstId) || null;
  }
}
