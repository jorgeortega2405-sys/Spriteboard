import { openUpgradeModal } from '../../components/upgrade-modal.component.js';
import { currentUser } from '../../services/api.service.js';
import { removeImageBackground } from '../../services/image-ai.service.js';
import { showToast } from '../../services/toast.service.js';
import { PresentationSlideItem } from '../../types/stage.types.js';
import { initCarouselScroll, withButtonLoading } from '../../utils/dom.util.js';
import { computeElementsBoundingBox, measureTextElementSize } from '../board/board-elements.manager.js';
import { BoardConnectorElement, BoardElement, BoardImageElement, ConnectorStyle, MarkerType, StrokeStyle } from '../board/board.types.js';

export interface StageToolbarHost {
  activeSlideId: string;
  addSlide(): void;
  collaborationManager: any;
  container: HTMLElement;
  currentConnectorStyle: ConnectorStyle;
  currentFillColor: string;
  currentOpacity: number;
  currentStrokeColor: string;
  currentStrokeStyle: StrokeStyle;
  currentStrokeWidth: number;
  deleteSelectedElements(): void;
  deleteSlide(): void;
  duplicateSelectedElements(): void;
  duplicateSlide(): void;
  getActiveSlide(): PresentationSlideItem;
  getActiveSlideIndex(): number;
  processingBgRemovalId: string | null;
  render(): void;
  renderSlidesTray(): void;
  reorderSelected(toFront: boolean): void;
  saveHistoryState(): void;
  scheduleAutoSave(): void;
  selectedElementIds: Set<string>;
  selectSlide(id: string): void;
  slideDuration: number;
  slideHeight: number;
  slides: PresentationSlideItem[];
  slidesManager: any;
  slideWidth: number;
  syncPanels(): void;
  toggleAnimationPanel(): void;
  toggleColorsPanel(target: 'fill' | 'slide-bg' | 'stroke' | 'text'): void;
  toggleEffectsPanel(): void;
  toggleFontsPanel(): void;
  togglePositionPanel(): void;
  updateSelectionToolbar(): void;
  updateSlideDurationUI(): void;
}

export class StageToolbarManager {
  private host: StageToolbarHost;

  constructor(host: StageToolbarHost) {
    this.host = host;
  }

  public bindTrayEvents(signal: AbortSignal): void {
    const btnBottomPages = this.host.container.querySelector<HTMLButtonElement>('[data-ref="btn-bottom-pages"]');
    const tray = this.host.container.querySelector<HTMLElement>('[data-ref="design-pages-tray"]');
    btnBottomPages?.addEventListener('click', () => {
      const isHidden = tray?.classList.contains('is-hidden');
      if (isHidden) {
        this.host.slidesManager.setPageViewMode('thumbnails');
      } else {
        this.host.slidesManager.setPageViewMode('scroll');
      }
    }, { signal });

    const pagesCardsWrapper = this.host.container.querySelector<HTMLElement>('[data-ref="pages-cards-wrapper"]');
    if (pagesCardsWrapper) {
      initCarouselScroll(pagesCardsWrapper, {
        carouselSelector: '[data-ref="pages-cards-list"]',
        leftBtnSelector: '[data-ref="btn-pages-tray-scroll-left"]',
        rightBtnSelector: '[data-ref="btn-pages-tray-scroll-right"]',
        step: 180,
      });
    }

    const btnPagePrev = this.host.container.querySelector<HTMLButtonElement>('[data-ref="btn-page-prev"]');
    btnPagePrev?.addEventListener('click', () => {
      const idx = this.host.getActiveSlideIndex();
      if (idx > 0) {
        this.host.selectSlide(this.host.slides[idx - 1].id);
      }
    }, { signal });

    const btnPageNext = this.host.container.querySelector<HTMLButtonElement>('[data-ref="btn-page-next"]');
    btnPageNext?.addEventListener('click', () => {
      const idx = this.host.getActiveSlideIndex();
      if (idx < this.host.slides.length - 1) {
        this.host.selectSlide(this.host.slides[idx + 1].id);
      }
    }, { signal });

    const btnPageAdd = this.host.container.querySelector<HTMLButtonElement>('[data-ref="btn-page-add"]');
    btnPageAdd?.addEventListener('click', () => this.host.addSlide(), { signal });

    const btnPageDuplicate = this.host.container.querySelector<HTMLButtonElement>('[data-ref="btn-page-duplicate"]');
    btnPageDuplicate?.addEventListener('click', () => this.host.duplicateSlide(), { signal });

    const btnPageDelete = this.host.container.querySelector<HTMLButtonElement>('[data-ref="btn-page-delete"]');
    btnPageDelete?.addEventListener('click', () => this.host.deleteSlide(), { signal });
  }

  public bindDurationEvents(signal: AbortSignal): void {
    const btnDuration = this.host.container.querySelector<HTMLButtonElement>('[data-ref="btn-slide-duration"]');
    btnDuration?.addEventListener('click', () => {
      this.togglePopover('slide-duration');
    }, { signal });

    const slider = this.host.container.querySelector<HTMLInputElement>('[data-ref="input-popover-slide-duration"]');
    slider?.addEventListener('input', () => {
      const val = parseFloat(slider.value) || 5.0;
      this.host.slideDuration = val;
      const current = this.host.getActiveSlide();
      current.duration = val;
      this.host.updateSlideDurationUI();
      this.host.renderSlidesTray();
      this.host.scheduleAutoSave();
      this.host.collaborationManager.broadcastSlideDuration(current.id, val);
    }, { signal });

    const presetChips = this.host.container.querySelectorAll<HTMLButtonElement>('[data-ref="slide-duration-presets"] [data-duration]');
    presetChips.forEach((chip) => {
      chip.addEventListener('click', () => {
        const val = parseFloat(chip.getAttribute('data-duration') || '5.0');
        this.host.slideDuration = val;
        const current = this.host.getActiveSlide();
        current.duration = val;
        this.host.updateSlideDurationUI();
        this.host.renderSlidesTray();
        this.host.scheduleAutoSave();
        this.host.collaborationManager.broadcastSlideDuration(current.id, val);
      }, { signal });
    });

    const btnApplyAll = this.host.container.querySelector<HTMLButtonElement>('[data-ref="btn-apply-duration-all"]');
    const popover = this.host.container.querySelector<HTMLElement>('[data-ref="popover-slide-duration"]');
    btnApplyAll?.addEventListener('click', () => {
      this.host.slides.forEach((s) => {
        s.duration = this.host.slideDuration;
        this.host.collaborationManager.broadcastSlideDuration(s.id, this.host.slideDuration);
      });
      this.host.renderSlidesTray();
      this.host.scheduleAutoSave();
      showToast('Duración aplicada a todas las diapositivas', 'success');
      popover?.classList.add('is-hidden');
    }, { signal });
  }

  public bindTopPropertiesToolbar(signal: AbortSignal): void {
    const btnSlideBg = this.host.container.querySelector<HTMLButtonElement>('[data-ref="top-btn-slide-bg"]');
    btnSlideBg?.addEventListener('click', () => this.host.toggleColorsPanel('slide-bg'), { signal });

    const btnSlideAnimate = this.host.container.querySelector<HTMLButtonElement>('[data-ref="top-btn-slide-animate"]');
    btnSlideAnimate?.addEventListener('click', () => this.host.toggleAnimationPanel(), { signal });

    const btnSlideDurationHeader = this.host.container.querySelector<HTMLButtonElement>('[data-ref="top-btn-slide-duration-header"]');
    btnSlideDurationHeader?.addEventListener('click', () => {
      if (btnSlideDurationHeader) this.togglePopover('slide-duration', btnSlideDurationHeader);
    }, { signal });

    const btnDup = this.host.container.querySelector<HTMLButtonElement>('[data-ref="top-btn-duplicate"]');
    btnDup?.addEventListener('click', () => this.host.duplicateSelectedElements(), { signal });

    const btnDel = this.host.container.querySelector<HTMLButtonElement>('[data-ref="top-btn-delete"]');
    btnDel?.addEventListener('click', () => this.host.deleteSelectedElements(), { signal });

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

        const elements = this.host.getActiveSlide().elements;
        const selected = elements.filter((e) => this.host.selectedElementIds.has(e.id));
        if (selected.length !== 1 || selected[0].type !== 'image') {
          showToast('Selecciona una imagen para eliminar su fondo', 'info');
          return;
        }
        const imageEl = selected[0] as BoardImageElement;
        if (!imageEl.url) {
          showToast('La imagen seleccionada no tiene una fuente válida', 'warning');
          return;
        }

        await withButtonLoading(btnRemoveBg, async () => {
          showToast('Eliminando fondo con IA...', 'info');
          this.host.processingBgRemovalId = imageEl.id;
          const animTimer = window.setInterval(() => {
            this.host.render();
          }, 1000 / 60);

          try {
            const result = await removeImageBackground(imageEl.url);
            if (result.success && result.url) {
              this.host.saveHistoryState();
              imageEl.url = result.url;
              this.host.collaborationManager.broadcastUpdateElement(imageEl, this.host.activeSlideId);
              this.host.render();
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
            this.host.render();
          }
        });
      }, { signal });
    }

    const btnFontInc = this.host.container.querySelector<HTMLButtonElement>('[data-ref="top-btn-font-inc"]');
    btnFontInc?.addEventListener('click', () => this.changeSelectedFontSize(2), { signal });

    const btnFontDec = this.host.container.querySelector<HTMLButtonElement>('[data-ref="top-btn-font-dec"]');
    btnFontDec?.addEventListener('click', () => this.changeSelectedFontSize(-2), { signal });

    const btnFontFamily = this.host.container.querySelector<HTMLButtonElement>('[data-ref="top-btn-font-family"]');
    btnFontFamily?.addEventListener('click', () => this.host.toggleFontsPanel(), { signal });

    const btnBold = this.host.container.querySelector<HTMLButtonElement>('[data-ref="top-btn-bold"]');
    btnBold?.addEventListener('click', () => this.toggleBold(), { signal });

    const btnItalic = this.host.container.querySelector<HTMLButtonElement>('[data-ref="top-btn-italic"]');
    btnItalic?.addEventListener('click', () => this.toggleItalic(), { signal });

    const btnUnderline = this.host.container.querySelector<HTMLButtonElement>('[data-ref="top-btn-underline"]');
    btnUnderline?.addEventListener('click', () => this.toggleUnderline(), { signal });

    const btnStrikethrough = this.host.container.querySelector<HTMLButtonElement>('[data-ref="top-btn-strikethrough"]');
    btnStrikethrough?.addEventListener('click', () => this.toggleStrikethrough(), { signal });

    const btnTextAlign = this.host.container.querySelector<HTMLButtonElement>('[data-ref="top-btn-text-align"]');
    btnTextAlign?.addEventListener('click', () => this.cycleTextAlign(), { signal });

    const btnFill = this.host.container.querySelector<HTMLButtonElement>('[data-ref="top-btn-fill"]');
    btnFill?.addEventListener('click', () => this.host.toggleColorsPanel('fill'), { signal });

    const btnStrokeColor = this.host.container.querySelector<HTMLButtonElement>('[data-ref="top-btn-stroke-color"]');
    btnStrokeColor?.addEventListener('click', () => this.host.toggleColorsPanel('stroke'), { signal });

    const btnTextColor = this.host.container.querySelector<HTMLButtonElement>('[data-ref="top-btn-text-color"]');
    btnTextColor?.addEventListener('click', () => this.host.toggleColorsPanel('text'), { signal });

    const btnStrokeStyle = this.host.container.querySelector<HTMLButtonElement>('[data-ref="top-btn-stroke-style"]');
    btnStrokeStyle?.addEventListener('click', () => {
      if (btnStrokeStyle) this.togglePopover('stroke', btnStrokeStyle);
    }, { signal });

    const btnCorners = this.host.container.querySelector<HTMLButtonElement>('[data-ref="top-btn-corners"]');
    btnCorners?.addEventListener('click', () => {
      if (btnCorners) this.togglePopover('corners', btnCorners);
    }, { signal });

    const btnOpacity = this.host.container.querySelector<HTMLButtonElement>('[data-ref="top-btn-opacity"]');
    btnOpacity?.addEventListener('click', () => {
      if (btnOpacity) this.togglePopover('opacity', btnOpacity);
    }, { signal });

    const btnEffects = this.host.container.querySelector<HTMLButtonElement>('[data-ref="top-btn-effects"]');
    btnEffects?.addEventListener('click', () => this.host.toggleEffectsPanel(), { signal });

    const btnAnimate = this.host.container.querySelector<HTMLButtonElement>('[data-ref="top-btn-animate"]');
    btnAnimate?.addEventListener('click', () => this.host.toggleAnimationPanel(), { signal });

    const btnPosition = this.host.container.querySelector<HTMLButtonElement>('[data-ref="top-btn-position"]');
    btnPosition?.addEventListener('click', () => this.host.togglePositionPanel(), { signal });

    const btnMarkerStart = this.host.container.querySelector<HTMLButtonElement>('[data-ref="top-btn-marker-start"]');
    btnMarkerStart?.addEventListener('click', () => {
      if (btnMarkerStart) this.togglePopover('marker-start', btnMarkerStart);
    }, { signal });

    const btnMarkerEnd = this.host.container.querySelector<HTMLButtonElement>('[data-ref="top-btn-marker-end"]');
    btnMarkerEnd?.addEventListener('click', () => {
      if (btnMarkerEnd) this.togglePopover('marker-end', btnMarkerEnd);
    }, { signal });

    const btnSwapMarkers = this.host.container.querySelector<HTMLButtonElement>('[data-ref="top-btn-swap-markers"]');
    btnSwapMarkers?.addEventListener('click', () => this.swapConnectorMarkers(), { signal });

    const btnConnectorStyle = this.host.container.querySelector<HTMLButtonElement>('[data-ref="top-btn-connector-style"]');
    btnConnectorStyle?.addEventListener('click', () => {
      if (btnConnectorStyle) this.togglePopover('connector-style', btnConnectorStyle);
    }, { signal });

    const btnPosFront = this.host.container.querySelector<HTMLButtonElement>('[data-ref="btn-pos-front"]');
    btnPosFront?.addEventListener('click', () => this.host.reorderSelected(true), { signal });

    const btnPosBack = this.host.container.querySelector<HTMLButtonElement>('[data-ref="btn-pos-back"]');
    btnPosBack?.addEventListener('click', () => this.host.reorderSelected(false), { signal });
  }

  public bindPopoversEvents(signal: AbortSignal): void {
    const strokePresets = this.host.container.querySelectorAll<HTMLButtonElement>('[data-stroke-preset]');
    strokePresets.forEach((btn) => {
      btn.addEventListener('click', () => {
        strokePresets.forEach((b) => b.classList.remove('is-active'));
        btn.classList.add('is-active');
        const preset = btn.getAttribute('data-stroke-preset') || 'solid';
        if (preset === 'none') {
          this.host.currentStrokeWidth = 0;
          this.applySelectedProperty('strokeWidth', 0);
        } else {
          this.host.currentStrokeStyle = preset as StrokeStyle;
          if (this.host.currentStrokeWidth === 0) this.host.currentStrokeWidth = 2;
          this.applySelectedProperty('strokeStyle', preset);
          this.applySelectedProperty('strokeWidth', this.host.currentStrokeWidth);
        }
      }, { signal });
    });

    const inputStrokeWidth = this.host.container.querySelector<HTMLInputElement>('[data-ref="input-popover-stroke-width"]');
    const labelStrokeWidth = this.host.container.querySelector<HTMLElement>('[data-ref="label-popover-stroke-width"]');
    inputStrokeWidth?.addEventListener('input', () => {
      const val = parseInt(inputStrokeWidth.value, 10) || 0;
      this.host.currentStrokeWidth = val;
      if (labelStrokeWidth) labelStrokeWidth.textContent = String(val);
      this.applySelectedProperty('strokeWidth', val);
    }, { signal });

    const inputCornerRadius = this.host.container.querySelector<HTMLInputElement>('[data-ref="input-popover-corner-radius"]');
    const labelCornerRadius = this.host.container.querySelector<HTMLElement>('[data-ref="label-popover-corner-radius"]');
    inputCornerRadius?.addEventListener('input', () => {
      const val = parseInt(inputCornerRadius.value, 10) || 0;
      if (labelCornerRadius) labelCornerRadius.textContent = String(val);
      this.applySelectedProperty('borderRadius', val);
      this.applySelectedProperty('cornerRadius', val);
    }, { signal });

    const inputSides = this.host.container.querySelector<HTMLInputElement>('[data-ref="input-popover-sides"]');
    const labelSides = this.host.container.querySelector<HTMLElement>('[data-ref="label-popover-sides"]');
    inputSides?.addEventListener('input', () => {
      const val = parseInt(inputSides.value, 10) || 5;
      if (labelSides) labelSides.textContent = String(val);
      this.applySelectedProperty('sides', val);
    }, { signal });

    const inputOpacity = this.host.container.querySelector<HTMLInputElement>('[data-ref="input-popover-opacity"]');
    const labelOpacity = this.host.container.querySelector<HTMLElement>('[data-ref="label-popover-opacity"]');
    inputOpacity?.addEventListener('input', () => {
      const val = parseInt(inputOpacity.value, 10) || 100;
      this.host.currentOpacity = val;
      if (labelOpacity) labelOpacity.textContent = String(val);
      this.applySelectedProperty('opacity', val / 100);
    }, { signal });

    const startMarkers = this.host.container.querySelectorAll<HTMLButtonElement>('[data-ref="grid-marker-start"] [data-marker]');
    startMarkers.forEach((btn) => {
      btn.addEventListener('click', () => {
        startMarkers.forEach((b) => b.classList.remove('is-active'));
        btn.classList.add('is-active');
        const marker = btn.getAttribute('data-marker') as MarkerType;
        this.applySelectedProperty('startMarker', marker);
      }, { signal });
    });

    const endMarkers = this.host.container.querySelectorAll<HTMLButtonElement>('[data-ref="grid-marker-end"] [data-marker]');
    endMarkers.forEach((btn) => {
      btn.addEventListener('click', () => {
        endMarkers.forEach((b) => b.classList.remove('is-active'));
        btn.classList.add('is-active');
        const marker = btn.getAttribute('data-marker') as MarkerType;
        this.applySelectedProperty('endMarker', marker);
      }, { signal });
    });

    const connPresets = this.host.container.querySelectorAll<HTMLButtonElement>('[data-ref^="popover-conn-"]');
    connPresets.forEach((btn) => {
      btn.addEventListener('click', () => {
        connPresets.forEach((b) => b.classList.remove('is-active'));
        btn.classList.add('is-active');
        const style = btn.getAttribute('data-conn-style') as ConnectorStyle;
        if (style) {
          this.host.currentConnectorStyle = style;
          this.applySelectedProperty('connectorStyle', style);
        }
      }, { signal });
    });
  }

  public closeAllPopovers(): void {
    const popovers = this.host.container.querySelectorAll<HTMLElement>('.board-context-popover');
    popovers.forEach((p) => p.classList.add('is-hidden'));
  }

  public togglePopover(name: 'connector-style' | 'corners' | 'marker-end' | 'marker-start' | 'opacity' | 'position' | 'slide-duration' | 'stroke', anchorBtn?: HTMLElement): void {
    const popover = this.host.container.querySelector<HTMLElement>(`[data-ref="popover-${name}"]`);
    if (!popover) return;
    const isHidden = popover.classList.contains('is-hidden');
    this.closeAllPopovers();
    if (isHidden) {
      if (anchorBtn) {
        const rect = anchorBtn.getBoundingClientRect();
        const containerRect = this.host.container.querySelector<HTMLElement>('[data-ref="presentation-viewport"]')?.getBoundingClientRect();
        if (containerRect) {
          const left = Math.max(8, Math.min(rect.left - containerRect.left, containerRect.width - 280));
          popover.style.left = `${left}px`;
          popover.style.top = `${rect.bottom - containerRect.top + 6}px`;
        }
      }
      popover.classList.remove('is-hidden');
      this.syncPopoverValues(name);
    }
  }

  public syncPopoverValues(name: string): void {
    const selected = this.getFirstSelectedElement();
    if (name === 'stroke') {
      const w = selected && 'strokeWidth' in selected && typeof (selected as any).strokeWidth === 'number' ? (selected as any).strokeWidth : this.host.currentStrokeWidth;
      const input = this.host.container.querySelector<HTMLInputElement>('[data-ref="input-popover-stroke-width"]');
      const label = this.host.container.querySelector<HTMLElement>('[data-ref="label-popover-stroke-width"]');
      if (input) input.value = String(w);
      if (label) label.textContent = String(w);
    } else if (name === 'corners') {
      const r = selected && ('borderRadius' in selected || 'cornerRadius' in selected)
        ? ((selected as any).borderRadius !== undefined ? (selected as any).borderRadius : (selected as any).cornerRadius || 0)
        : 0;
      const input = this.host.container.querySelector<HTMLInputElement>('[data-ref="input-popover-corner-radius"]');
      const label = this.host.container.querySelector<HTMLElement>('[data-ref="label-popover-corner-radius"]');
      if (input) input.value = String(r);
      if (label) label.textContent = String(r);

      const sidesContainer = this.host.container.querySelector<HTMLElement>('[data-ref="popover-sides-container"]');
      const isPolygonOrStar = selected && selected.type === 'shape' && (selected.shapeType === 'star' || (selected as any).shapeType === 'polygon');
      if (sidesContainer) {
        sidesContainer.classList.toggle('is-hidden', !isPolygonOrStar);
      }
      if (isPolygonOrStar) {
        const sides = (selected as any).sides || 5;
        const inputSides = this.host.container.querySelector<HTMLInputElement>('[data-ref="input-popover-sides"]');
        const labelSides = this.host.container.querySelector<HTMLElement>('[data-ref="label-popover-sides"]');
        if (inputSides) inputSides.value = String(sides);
        if (labelSides) labelSides.textContent = String(sides);
      }
    } else if (name === 'opacity') {
      const op = selected && 'opacity' in selected && typeof (selected as any).opacity === 'number' ? Math.round((selected as any).opacity * 100) : 100;
      const input = this.host.container.querySelector<HTMLInputElement>('[data-ref="input-popover-opacity"]');
      const label = this.host.container.querySelector<HTMLElement>('[data-ref="label-popover-opacity"]');
      if (input) input.value = String(op);
      if (label) label.textContent = String(op);
    } else if (name === 'marker-start') {
      const startMarker = selected && selected.type === 'connector' ? ((selected as any).startMarker || ((selected as any).arrowStart === true ? 'arrow-filled' : (selected as any).arrowStart || 'none')) : 'none';
      this.host.container.querySelectorAll<HTMLButtonElement>('[data-ref="grid-marker-start"] [data-marker]').forEach((btn) => {
        btn.classList.toggle('is-active', btn.getAttribute('data-marker') === startMarker);
      });
    } else if (name === 'marker-end') {
      const endMarker = selected && selected.type === 'connector' ? ((selected as any).endMarker || ((selected as any).arrowEnd === true ? 'arrow-filled' : (selected as any).arrowEnd || 'none')) : 'none';
      this.host.container.querySelectorAll<HTMLButtonElement>('[data-ref="grid-marker-end"] [data-marker]').forEach((btn) => {
        btn.classList.toggle('is-active', btn.getAttribute('data-marker') === endMarker);
      });
    } else if (name === 'connector-style') {
      const style = selected && selected.type === 'connector' ? ((selected as any).style || (selected as any).connectorStyle || 'curved') : this.host.currentConnectorStyle;
      this.host.container.querySelectorAll<HTMLButtonElement>('[data-ref^="popover-conn-"]').forEach((btn) => {
        btn.classList.toggle('is-active', btn.getAttribute('data-conn-style') === style);
      });
    }
  }

  public toggleBold(): void {
    const selected = this.getSelectedElements();
    if (selected.length === 0) return;
    this.host.saveHistoryState();
    const first = selected[0];
    const currentWeight = first && 'fontWeight' in first ? (first as any).fontWeight : 400;
    const newWeight = (currentWeight === 700 || currentWeight === 'bold') ? 400 : 700;
    selected.forEach((el) => {
      (el as any).fontWeight = newWeight;
      if (el.type === 'text') {
        const sz = measureTextElementSize((el as any).text || '', (el as any).fontSize || 20, newWeight, (el as any).fontFamily || 'Inter, sans-serif');
        (el as any).width = sz.width;
        (el as any).height = sz.height;
      }
    });
    this.host.render();
    this.host.scheduleAutoSave();
    this.host.updateSelectionToolbar();
  }

  public toggleItalic(): void {
    const selected = this.getSelectedElements();
    if (selected.length === 0) return;
    this.host.saveHistoryState();
    const first = selected[0];
    const currentStyle = first && 'fontStyle' in first ? (first as any).fontStyle : 'normal';
    const newStyle = currentStyle === 'italic' ? 'normal' : 'italic';
    selected.forEach((el) => {
      (el as any).fontStyle = newStyle;
    });
    this.host.render();
    this.host.scheduleAutoSave();
    this.host.updateSelectionToolbar();
  }

  public toggleUnderline(): void {
    const selected = this.getSelectedElements();
    if (selected.length === 0) return;
    this.host.saveHistoryState();
    const first = selected[0];
    const currentDeco = first && 'textDecoration' in first ? (first as any).textDecoration : 'none';
    const newDeco = currentDeco === 'underline' ? 'none' : 'underline';
    selected.forEach((el) => {
      (el as any).textDecoration = newDeco;
    });
    this.host.render();
    this.host.scheduleAutoSave();
    this.host.updateSelectionToolbar();
  }

  public toggleStrikethrough(): void {
    const selected = this.getSelectedElements();
    if (selected.length === 0) return;
    this.host.saveHistoryState();
    const first = selected[0];
    const currentDeco = first && 'textDecoration' in first ? (first as any).textDecoration : 'none';
    const newDeco = currentDeco === 'line-through' ? 'none' : 'line-through';
    selected.forEach((el) => {
      (el as any).textDecoration = newDeco;
    });
    this.host.render();
    this.host.scheduleAutoSave();
    this.host.updateSelectionToolbar();
  }

  public cycleTextAlign(): void {
    const selected = this.getSelectedElements();
    if (selected.length === 0) return;
    this.host.saveHistoryState();
    const first = selected[0];
    const currentAlign = first && 'textAlign' in first ? (first as any).textAlign : 'left';
    const alignOrder: Array<'center' | 'left' | 'right'> = ['left', 'center', 'right'];
    const nextIdx = (alignOrder.indexOf(currentAlign) + 1) % alignOrder.length;
    const newAlign = alignOrder[nextIdx];
    selected.forEach((el) => {
      (el as any).textAlign = newAlign;
    });
    this.host.render();
    this.host.scheduleAutoSave();
    this.host.updateSelectionToolbar();
  }

  public alignSelectedElements(alignType: 'bottom' | 'center' | 'left' | 'middle' | 'right' | 'top'): void {
    if (this.host.selectedElementIds.size === 0) return;
    this.host.saveHistoryState();
    const elements = this.host.getActiveSlide().elements;
    const selected = elements.filter((el) => this.host.selectedElementIds.has(el.id));
    if (selected.length === 0) return;

    const bbox = computeElementsBoundingBox(selected);
    const halfW = this.host.slideWidth / 2;
    const halfH = this.host.slideHeight / 2;

    selected.forEach((el) => {
      if (!('x' in el) || !('y' in el)) return;
      const elW = (el as any).width || 0;
      const elH = (el as any).height || 0;

      if (selected.length === 1) {
        if (alignType === 'left') (el as any).x = -halfW;
        else if (alignType === 'center') (el as any).x = -elW / 2;
        else if (alignType === 'right') (el as any).x = halfW - elW;
        else if (alignType === 'top') (el as any).y = -halfH;
        else if (alignType === 'middle') (el as any).y = -elH / 2;
        else if (alignType === 'bottom') (el as any).y = halfH - elH;
      } else if (bbox) {
        if (alignType === 'left') (el as any).x = bbox.x;
        else if (alignType === 'center') (el as any).x = bbox.x + (bbox.width - elW) / 2;
        else if (alignType === 'right') (el as any).x = bbox.x + bbox.width - elW;
        else if (alignType === 'top') (el as any).y = bbox.y;
        else if (alignType === 'middle') (el as any).y = bbox.y + (bbox.height - elH) / 2;
        else if (alignType === 'bottom') (el as any).y = bbox.y + bbox.height - elH;
      }
    });

    this.host.render();
    this.host.scheduleAutoSave();
  }

  public reorderSelectedAction(action: 'back' | 'backward' | 'forward' | 'front'): void {
    if (this.host.selectedElementIds.size === 0) return;
    this.host.saveHistoryState();
    const slide = this.host.getActiveSlide();
    const selectedIds = Array.from(this.host.selectedElementIds);

    if (action === 'front') {
      this.host.reorderSelected(true);
      return;
    }
    if (action === 'back') {
      this.host.reorderSelected(false);
      return;
    }

    if (action === 'forward') {
      for (let i = slide.elements.length - 2; i >= 0; i--) {
        if (selectedIds.includes(slide.elements[i].id) && !selectedIds.includes(slide.elements[i + 1].id)) {
          const temp = slide.elements[i];
          slide.elements[i] = slide.elements[i + 1];
          slide.elements[i + 1] = temp;
        }
      }
    } else if (action === 'backward') {
      for (let i = 1; i < slide.elements.length; i++) {
        if (selectedIds.includes(slide.elements[i].id) && !selectedIds.includes(slide.elements[i - 1].id)) {
          const temp = slide.elements[i];
          slide.elements[i] = slide.elements[i - 1];
          slide.elements[i - 1] = temp;
        }
      }
    }

    this.host.syncPanels();
    this.host.render();
    this.host.scheduleAutoSave();
  }

  public reorderLayers(fromIndex: number, toIndex: number): void {
    const slide = this.host.getActiveSlide();
    if (fromIndex < 0 || fromIndex >= slide.elements.length || toIndex < 0 || toIndex >= slide.elements.length) return;
    this.host.saveHistoryState();
    const [moved] = slide.elements.splice(fromIndex, 1);
    slide.elements.splice(toIndex, 0, moved);
    this.host.syncPanels();
    this.host.render();
    this.host.scheduleAutoSave();
  }

  public updateSelectedTransform(updates: { aspectRatioLocked?: boolean; height?: number; rotation?: number; width?: number; x?: number; y?: number }): void {
    const firstSelected = this.getFirstSelectedElement();
    if (!firstSelected) return;
    this.host.saveHistoryState();
    Object.assign(firstSelected, updates);
    this.host.render();
    this.host.scheduleAutoSave();
  }

  public swapConnectorMarkers(): void {
    const selected = this.getFirstSelectedElement();
    if (!selected || selected.type !== 'connector') return;
    this.host.saveHistoryState();
    const conn = selected as BoardConnectorElement;
    const start = conn.arrowStart || 'none';
    conn.arrowStart = conn.arrowEnd || 'none';
    conn.arrowEnd = start;
    this.host.render();
    this.host.scheduleAutoSave();
  }

  public applySelectedProperty(key: string, value: any): void {
    if (this.host.selectedElementIds.size === 0) return;
    this.host.saveHistoryState();
    const elements = this.host.getActiveSlide().elements;
    elements.forEach((el) => {
      if (this.host.selectedElementIds.has(el.id)) {
        (el as any)[key] = value;
        if (key === 'borderRadius') {
          (el as any).cornerRadius = value;
        }
        if (key === 'cornerRadius') {
          (el as any).borderRadius = value;
        }
        if (key === 'strokeWidth' && el.type === 'image' && value > 0 && (!(el as any).strokeColor || (el as any).strokeColor === 'transparent')) {
          (el as any).strokeColor = '#1e293b';
        }
        if (key === 'strokeStyle' && el.type === 'image' && (!(el as any).strokeWidth || (el as any).strokeWidth === 0)) {
          (el as any).strokeWidth = 2;
          if (!(el as any).strokeColor || (el as any).strokeColor === 'transparent') (el as any).strokeColor = '#1e293b';
        }
        if (key === 'startMarker' && el.type === 'connector') {
          (el as any).arrowStart = value === 'none' ? false : value;
        }
        if (key === 'endMarker' && el.type === 'connector') {
          (el as any).arrowEnd = value === 'none' ? false : value;
        }
        if (key === 'connectorStyle' && el.type === 'connector') {
          (el as any).style = value;
        }
        if (key === 'fontSize' && el.type === 'text') {
          const measured = measureTextElementSize((el as any).text || '', value, (el as any).fontWeight || 600, (el as any).fontFamily || 'Inter, sans-serif');
          (el as any).width = measured.width;
          (el as any).height = measured.height;
        }
        this.host.collaborationManager.broadcastUpdateElement(el, this.host.activeSlideId);
      }
    });
    this.host.render();
    this.host.scheduleAutoSave();
    this.host.updateSelectionToolbar();
  }

  public changeSelectedFontSize(delta: number): void {
    if (this.host.selectedElementIds.size === 0) return;
    this.host.saveHistoryState();
    const elements = this.host.getActiveSlide().elements;
    elements.forEach((el) => {
      if (this.host.selectedElementIds.has(el.id)) {
        if ('fontSize' in el && typeof (el as any).fontSize === 'number') {
          (el as any).fontSize = Math.max(10, Math.min(160, (el as any).fontSize + delta));
          if (el.type === 'text') {
            const measured = measureTextElementSize((el as any).text, (el as any).fontSize, (el as any).fontWeight || 600, (el as any).fontFamily || 'sans-serif');
            (el as any).width = measured.width;
            (el as any).height = measured.height;
          }
          this.host.collaborationManager.broadcastUpdateElement(el, this.host.activeSlideId);
        }
      }
    });
    this.host.updateSelectionToolbar();
    this.host.render();
    this.host.scheduleAutoSave();
  }

  private getSelectedElements(): BoardElement[] {
    if (this.host.selectedElementIds.size === 0) return [];
    return this.host.getActiveSlide().elements.filter((el) => this.host.selectedElementIds.has(el.id));
  }

  private getFirstSelectedElement(): BoardElement | null {
    if (this.host.selectedElementIds.size === 0) return null;
    const firstId = Array.from(this.host.selectedElementIds)[0];
    return this.host.getActiveSlide().elements.find((el) => el.id === firstId) || null;
  }
}
