import { openCanvasShareModal } from '../../components/canvas-share-modal.component.js';
import { openModal } from '../../components/modal.component.js';
import { API_ROUTES } from '../../config/api-routes.js';
import { currentUser, getApi, putApi } from '../../services/api.service.js';
import { getLocalCanvasByUuid, saveLocalCanvas } from '../../services/canvas-storage.service.js';
import { renderIcons } from '../../services/icon.service.js';
import { showToast } from '../../services/toast.service.js';
import { CanvasItem } from '../../types/canvas.types.js';
import { ViewController } from '../../types/common.types.js';
import { initCarouselScroll, setupDropdown } from '../../utils/dom.util.js';
import { exportDocHtml, exportDocJson, exportDocMarkdown, exportDocPdf, exportDocTxt, exportDocWord, generateDocThumbnail } from './doc-export.service.js';
import { DocFontPickerComponent, FontSelectEvent } from './doc-font-picker.component.js';
import { ensureGoogleFontLoaded } from './doc-fonts.config.js';
import { DocHistoryManager } from './doc-history.manager.js';
import { DocPaginationManager } from './doc-pagination.manager.js';
import { DOC_MARGIN_PRESETS, DOC_PAPER_DIMENSIONS, DocColumnsCount, DocImageRadius, DocImageShadow, DocImageWrapMode, DocMargins, DocOrientation, DocPage, DocPageBorder, DocPageColor, DocPaperSize, DocProject, DocWatermark } from './doc.types.js';

const PALETTE_COLORS = [
  '#000000', '#1e293b', '#475569', '#64748b', '#94a3b8', '#cbd5e1', '#ffffff',
  '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16', '#22c55e', '#10b981',
  '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#ec4899'
];

const SPECIAL_SYMBOLS = [
  '©', '®', '™', '§', '¶', '†', '‡', '•', '–', '—',
  '€', '$', '£', '¥', '₹', '¢', '°', '±', '×', '÷',
  '≠', '≤', '≥', '≈', '∞', '√', '∑', '∏', 'π', 'µ',
  'α', 'β', 'γ', 'δ', 'θ', 'λ', 'σ', 'ω', 'Δ', 'Ω',
  '←', '→', '↑', '↓', '↔', '⇒', '⇔', '✓', '✗', '★',
  '½', '⅓', '⅔', '¼', '¾', '⅛', '⅜', '⅝', '⅞', '‰'
];

export class DocController implements ViewController {
  private abortController: AbortController = new AbortController();
  private activeTable: HTMLTableElement | null = null;
  private activeTableCell: HTMLTableCellElement | null = null;
  private canvasTitle = 'Documento sin título';
  private canvasUuid: string;
  private container: HTMLElement;
  private currentColorTarget: 'highlight' | 'text' = 'text';
  private currentHighlightColor = '#fef08a';
  private currentTextColor = '#0f172a';
  private fontPicker: DocFontPickerComponent | null = null;
  private historyManager: DocHistoryManager = new DocHistoryManager();
  private isSaving = false;
  private paginationManager: DocPaginationManager = new DocPaginationManager();
  private project: DocProject = {
    pages: [
      {
        contentHtml: '<p><br></p>',
        id: 'page_1',
      },
    ],
    settings: {
      columnsCount: 1,
      firstPageDifferent: false,
      fontFamily: 'Inter, system-ui, sans-serif',
      fontSize: 11,
      letterSpacing: 0,
      lineHeight: 1.15,
      margins: { bottom: 96, left: 96, right: 96, top: 96 },
      orientation: 'portrait',
      pageBorder: 'none',
      pageColor: 'white',
      paperSize: 'letter',
      showPageNumbers: true,
      viewMode: 'paginated',
      watermark: { enabled: false, text: 'CONFIDENCIAL', type: 'text' },
      zoom: 1,
    },
    type: 'doc',
    version: 1,
  };
  private saveDebounceTimer: number | null = null;
  private selectedImageWrapper: HTMLElement | null = null;

  constructor(container: HTMLElement, canvasUuid: string) {
    this.container = container;
    this.canvasUuid = canvasUuid;
  }

  public async init(): Promise<boolean> {
    const loaded = await this.loadCanvasData();
    if (!loaded) return false;

    this.historyManager.pushState(this.project);
    ensureGoogleFontLoaded(this.project.settings.fontFamily);
    this.renderDocument();
    this.bindEvents();
    this.initSidePanelsUI();
    this.updateStats();
    this.updateUndoRedoButtonsState();
    this.updateZoomUI();
    renderIcons(this.container);
    return true;
  }

  public destroy(): void {
    this.abortController.abort();
    if (this.fontPicker) {
      this.fontPicker.destroy();
      this.fontPicker = null;
    }
    if (this.saveDebounceTimer) {
      clearTimeout(this.saveDebounceTimer);
    }
  }

  private async loadCanvasData(): Promise<boolean> {
    let rawData: any = null;

    if (currentUser) {
      try {
        const res = await getApi(API_ROUTES.canvases.byId(this.canvasUuid));
        if (res.ok) {
          const body = await res.json();
          if (body?.canvas) {
            this.canvasTitle = body.canvas.name || 'Documento sin título';
            rawData = body.canvas.data;
          }
        }
      } catch {}
    }

    if (!rawData) {
      const local = await getLocalCanvasByUuid(this.canvasUuid);
      if (local) {
        this.canvasTitle = local.name || 'Documento sin título';
        rawData = local.data;
      }
    }

    if (rawData) {
      try {
        const parsed = typeof rawData === 'string' ? JSON.parse(rawData) : rawData;
        if (parsed && Array.isArray(parsed.pages) && parsed.pages.length > 0) {
          this.project = {
            ...this.project,
            ...parsed,
            settings: {
              ...this.project.settings,
              ...(parsed.settings || {}),
            },
          };
        }
      } catch {}
    }

    const titleEl = this.container.querySelector<HTMLElement>('[data-ref="doc-title"]');
    if (titleEl) {
      titleEl.textContent = this.canvasTitle;
    }
    document.title = `${this.canvasTitle} - Spriteboard`;

    return true;
  }

  private renderDocument(): void {
    const pagesContainer = this.container.querySelector<HTMLElement>('[data-ref="doc-pages-container"]');
    if (!pagesContainer) return;

    pagesContainer.innerHTML = '';

    const paperSizeKey = this.project.settings.paperSize || 'letter';
    const orientationKey = this.project.settings.orientation || 'portrait';
    const paper = (DOC_PAPER_DIMENSIONS[paperSizeKey] && DOC_PAPER_DIMENSIONS[paperSizeKey][orientationKey])
      ? DOC_PAPER_DIMENSIONS[paperSizeKey][orientationKey]
      : DOC_PAPER_DIMENSIONS.letter.portrait;

    const rawMargins = this.project.settings.margins;
    const margins: DocMargins = {
      bottom: (rawMargins && typeof rawMargins.bottom === 'number' && rawMargins.bottom >= 24) ? rawMargins.bottom : 96,
      left: (rawMargins && typeof rawMargins.left === 'number' && rawMargins.left >= 24) ? rawMargins.left : 96,
      right: (rawMargins && typeof rawMargins.right === 'number' && rawMargins.right >= 24) ? rawMargins.right : 96,
      top: (rawMargins && typeof rawMargins.top === 'number' && rawMargins.top >= 24) ? rawMargins.top : 96,
    };
    this.project.settings.margins = margins;
    const zoom = (typeof this.project.settings.zoom === 'number' && this.project.settings.zoom > 0) ? this.project.settings.zoom : 1;

    pagesContainer.style.setProperty('--doc-paper-width', `${paper.widthPx > 0 ? paper.widthPx : 816}px`);
    pagesContainer.style.setProperty('--doc-paper-height', paper.heightPx > 0 ? `${paper.heightPx}px` : 'auto');
    pagesContainer.style.setProperty('--doc-margin-top', `${margins.top}px`);
    pagesContainer.style.setProperty('--doc-margin-bottom', `${margins.bottom}px`);
    pagesContainer.style.setProperty('--doc-margin-left', `${margins.left}px`);
    pagesContainer.style.setProperty('--doc-margin-right', `${margins.right}px`);
    pagesContainer.style.setProperty('--doc-zoom', `${zoom}`);

    const currentPaperLabel = this.container.querySelector<HTMLElement>('[data-ref="lbl-current-paper"]');
    if (currentPaperLabel) {
      const sizeName = this.project.settings.paperSize === 'digital'
        ? 'Digital'
        : (this.project.settings.paperSize === 'a4'
          ? 'A4'
          : (this.project.settings.paperSize === 'a3'
            ? 'A3'
            : (this.project.settings.paperSize === 'legal'
              ? 'Oficio'
              : 'Carta')));
      const orientName = this.project.settings.orientation === 'landscape' ? 'Horizontal' : 'Vertical';
      currentPaperLabel.textContent = this.project.settings.paperSize === 'digital' ? 'Digital (Automático)' : `${sizeName} • ${orientName}`;
    }

    const currentFontLabel = this.container.querySelector<HTMLElement>('[data-ref="lbl-current-font"]');
    if (currentFontLabel) {
      const font = this.project.settings.fontFamily.split(',')[0].replace(/['"]/g, '').trim();
      currentFontLabel.textContent = font;
    }

    const fontSizeBadge = this.container.querySelector<HTMLElement>('[data-ref="lbl-font-size"]');
    if (fontSizeBadge) {
      fontSizeBadge.textContent = `${this.project.settings.fontSize || 11}pt`;
    }

    const pageThemeClass = `doc-page--theme-${this.project.settings.pageColor || 'white'}`;
    const pageBorderClass = this.project.settings.pageBorder && this.project.settings.pageBorder !== 'none'
      ? `doc-page--border-${this.project.settings.pageBorder}`
      : '';
    const columnsClass = this.project.settings.columnsCount === 2
      ? 'doc-page--cols-2'
      : (this.project.settings.columnsCount === 3 ? 'doc-page--cols-3' : '');

    this.project.pages.forEach((page, index) => {
      const pageEl = document.createElement('div');
      pageEl.className = `doc-page ${pageThemeClass} ${pageBorderClass}`.trim();
      pageEl.setAttribute('data-ref', `doc-page-${page.id}`);
      pageEl.setAttribute('data-page-id', page.id);
      pageEl.setAttribute('data-page-index', String(index + 1));
      pageEl.style.paddingTop = `${margins.top}px`;
      pageEl.style.paddingRight = `${margins.right}px`;
      pageEl.style.paddingBottom = `${margins.bottom}px`;
      pageEl.style.paddingLeft = `${margins.left}px`;
      pageEl.style.width = `${paper.widthPx > 0 ? paper.widthPx : 816}px`;
      pageEl.style.minHeight = paper.heightPx > 0 ? `${paper.heightPx}px` : 'calc(100vh - 180px)';

      const isFirstPage = index === 0;
      const hideHeaderFooter = isFirstPage && this.project.settings.firstPageDifferent;

      let watermarkEl = '';
      if (this.project.settings.watermark?.enabled) {
        if (this.project.settings.watermark.type === 'image' && this.project.settings.watermark.imageUrl) {
          watermarkEl = `<div class="doc-page__watermark"><img src="${this.project.settings.watermark.imageUrl}" alt="Marca de agua" /></div>`;
        } else {
          watermarkEl = `<div class="doc-page__watermark"><span>${this.project.settings.watermark.text || 'CONFIDENCIAL'}</span></div>`;
        }
      }

      let headerInnerHtml = '';
      if (!hideHeaderFooter) {
        const headerLogo = this.project.settings.headerLogoUrl
          ? `<img class="doc-page__header-logo" src="${this.project.settings.headerLogoUrl}" alt="Logo" />`
          : '';
        const headerText = this.paginationManager.formatHeaderFooter(
          this.project.settings.headerText || '',
          index + 1,
          this.project.pages.length,
          this.canvasTitle
        );
        headerInnerHtml = this.project.settings.headerLogoPosition === 'right'
          ? `<span>${headerText}</span>${headerLogo}`
          : `${headerLogo}<span>${headerText}</span>`;
      }

      let footerInnerHtml = '';
      if (!hideHeaderFooter) {
        const footerLogo = this.project.settings.footerLogoUrl
          ? `<img class="doc-page__footer-logo" src="${this.project.settings.footerLogoUrl}" alt="Logo" />`
          : '';
        const footerText = this.project.settings.showPageNumbers
          ? `Página ${index + 1} de ${this.project.pages.length}`
          : this.paginationManager.formatHeaderFooter(
              this.project.settings.footerText || '',
              index + 1,
              this.project.pages.length,
              this.canvasTitle
            );
        footerInnerHtml = this.project.settings.footerLogoPosition === 'left'
          ? `${footerLogo}<span>${footerText}</span>`
          : `<span>${footerText}</span>${footerLogo}`;
      }

      const letterSpacingStyle = this.project.settings.letterSpacing ? `letter-spacing: ${this.project.settings.letterSpacing}px;` : '';

      pageEl.innerHTML = `
        ${watermarkEl}
        <div class="doc-page__header" data-ref="page-header-${page.id}" contenteditable="${hideHeaderFooter ? 'false' : 'true'}" spellcheck="false" placeholder="Encabezado">${headerInnerHtml}</div>
        <div class="doc-page__content ${columnsClass}" data-ref="page-content-${page.id}" contenteditable="true" spellcheck="true" style="font-family: ${this.project.settings.fontFamily}; font-size: ${this.project.settings.fontSize}pt; line-height: ${this.project.settings.lineHeight}; ${letterSpacingStyle}">${page.contentHtml || '<p><br></p>'}</div>
        <div class="doc-page__footer" data-ref="page-footer-${page.id}" contenteditable="${hideHeaderFooter ? 'false' : 'true'}" spellcheck="false" placeholder="Pie de página">${footerInnerHtml}</div>
        <div class="doc-page__badge">Página ${index + 1}</div>
        ${this.project.pages.length > 1 ? `<button type="button" class="doc-page__delete-btn" data-ref="btn-delete-page-${page.id}" data-page-id="${page.id}" data-tooltip="Eliminar página" aria-label="Eliminar página"><span class="component-icon">delete</span></button>` : ''}
      `;

      pagesContainer.appendChild(pageEl);
    });

    this.bindPageEvents();
    this.initExistingImages();
    renderIcons(pagesContainer);
  }

  private bindEvents(): void {
    const signal = this.abortController.signal;

    const titleEl = this.container.querySelector<HTMLElement>('[data-ref="doc-title"]');
    if (titleEl) {
      titleEl.addEventListener('click', () => {
        const current = this.canvasTitle;
        const newTitle = prompt('Nombre del documento:', current);
        if (newTitle && newTitle.trim() && newTitle !== current) {
          this.canvasTitle = newTitle.trim();
          titleEl.textContent = this.canvasTitle;
          document.title = `${this.canvasTitle} - Spriteboard`;
          this.scheduleAutosave();
        }
      }, { signal });
    }

    const topToolbarContainer = this.container.querySelector<HTMLElement>('[data-ref="doc-top-toolbar-container"]');
    if (topToolbarContainer) {
      initCarouselScroll(topToolbarContainer, {
        carouselSelector: '[data-ref="doc-top-toolbar"]',
        leftBtnSelector: '[data-ref="btn-top-toolbar-scroll-left"]',
        rightBtnSelector: '[data-ref="btn-top-toolbar-scroll-right"]',
        step: 220,
      });
    }

    const bottomToolbarWrapper = this.container.querySelector<HTMLElement>('[data-ref="doc-bottom-toolbar-wrapper"]');
    if (bottomToolbarWrapper) {
      initCarouselScroll(bottomToolbarWrapper, {
        carouselSelector: '[data-ref="doc-bottom-toolbar"]',
        leftBtnSelector: '[data-ref="btn-bottom-toolbar-scroll-left"]',
        rightBtnSelector: '[data-ref="btn-bottom-toolbar-scroll-right"]',
        step: 220,
      });
    }

    const btnUndo = this.container.querySelector<HTMLElement>('[data-ref="btn-undo"]');
    if (btnUndo) {
      btnUndo.addEventListener('click', () => this.handleUndo(), { signal });
    }

    const btnRedo = this.container.querySelector<HTMLElement>('[data-ref="btn-redo"]');
    if (btnRedo) {
      btnRedo.addEventListener('click', () => this.handleRedo(), { signal });
    }

    const btnPrint = this.container.querySelector<HTMLElement>('[data-ref="btn-print"]');
    if (btnPrint) {
      btnPrint.addEventListener('click', () => {
        this.syncPagesFromDOM();
        exportDocPdf(this.project, this.canvasTitle);
      }, { signal });
    }

    const btnPageSetup = this.container.querySelector<HTMLElement>('[data-ref="btn-page-setup"]');
    if (btnPageSetup) {
      btnPageSetup.addEventListener('click', () => this.openPageSetupModal(), { signal });
    }

    const lblCurrentPaper = this.container.querySelector<HTMLElement>('[data-ref="lbl-current-paper"]');
    if (lblCurrentPaper) {
      lblCurrentPaper.addEventListener('click', () => this.openPageSetupModal(), { signal });
    }

    const btnWatermark = this.container.querySelector<HTMLElement>('[data-ref="btn-watermark-setup"]');
    if (btnWatermark) {
      btnWatermark.addEventListener('click', () => this.openWatermarkModal(), { signal });
    }

    const btnPageDesign = this.container.querySelector<HTMLElement>('[data-ref="btn-page-design"]');
    if (btnPageDesign) {
      btnPageDesign.addEventListener('click', () => this.openPageDesignModal(), { signal });
    }

    const btnSymbol = this.container.querySelector<HTMLElement>('[data-ref="btn-insert-symbol"]');
    if (btnSymbol) {
      btnSymbol.addEventListener('click', () => this.openSymbolsModal(), { signal });
    }

    const btnLogo = this.container.querySelector<HTMLElement>('[data-ref="btn-insert-logo"]');
    if (btnLogo) {
      btnLogo.addEventListener('click', () => this.openLogoModal(), { signal });
    }

    const btnShare = this.container.querySelector<HTMLElement>('[data-ref="btn-share-doc"]');
    if (btnShare) {
      btnShare.addEventListener('click', () => {
        openCanvasShareModal({
          access_level: 'private',
          canvas_type: 'doc',
          created_at: new Date().toISOString(),
          id: undefined,
          name: this.canvasTitle,
          public_role: 'editor',
          unit: 'doc',
          updated_at: new Date().toISOString(),
          user_id: currentUser ? currentUser.id : undefined,
          uuid: this.canvasUuid,
        } as CanvasItem);
      }, { signal });
    }

    this.bindFormattingTools(signal);
    this.bindDropdowns(signal);
    this.bindInsertTools(signal);
    this.bindExportMenu(signal);
    this.bindFindAndReplace(signal);
    this.bindZoomControls(signal);
    this.bindKeyboardShortcuts(signal);
    this.bindSelectionBubble(signal);
    this.bindImageAndTableControls(signal);
    this.bindDragDropAndPaste(signal);
  }

  private bindFormattingTools(signal: AbortSignal): void {
    const bindCmd = (ref: string, command: string, value: string | undefined = undefined) => {
      const btn = this.container.querySelector<HTMLElement>(`[data-ref="${ref}"]`);
      if (btn) {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          document.execCommand(command, false, value);
          this.updateActiveFormattingButtons();
          this.recordChange();
        }, { signal });
      }
    };

    bindCmd('btn-bold', 'bold');
    bindCmd('btn-italic', 'italic');
    bindCmd('btn-underline', 'underline');
    bindCmd('btn-strike', 'strikeThrough');
    bindCmd('btn-superscript', 'superscript');
    bindCmd('btn-subscript', 'subscript');
    bindCmd('btn-align-left', 'justifyLeft');
    bindCmd('btn-align-center', 'justifyCenter');
    bindCmd('btn-align-right', 'justifyRight');
    bindCmd('btn-align-justify', 'justifyFull');
    bindCmd('btn-list-bullet', 'insertUnorderedList');
    bindCmd('btn-list-ordered', 'insertOrderedList');
    bindCmd('btn-outdent', 'outdent');
    bindCmd('btn-indent', 'indent');
    bindCmd('btn-insert-hr', 'insertHorizontalRule');

    const btnClearFormat = this.container.querySelector<HTMLElement>('[data-ref="btn-clear-format"]');
    if (btnClearFormat) {
      btnClearFormat.addEventListener('click', (e) => {
        e.preventDefault();
        document.execCommand('removeFormat', false, undefined);
        this.recordChange();
        showToast('Formato limpiado', 'success');
      }, { signal });
    }

    const btnFirstLineIndent = this.container.querySelector<HTMLElement>('[data-ref="btn-indent-first-line"]');
    if (btnFirstLineIndent) {
      btnFirstLineIndent.addEventListener('click', (e) => {
        e.preventDefault();
        const sel = window.getSelection();
        if (sel && sel.anchorNode) {
          const el = (sel.anchorNode instanceof HTMLElement ? sel.anchorNode : sel.anchorNode.parentElement)?.closest('p, div, h1, h2, h3, h4');
          if (el) {
            el.classList.toggle('doc-indent-first-line');
            this.recordChange();
          }
        }
      }, { signal });
    }

    const btnChecklist = this.container.querySelector<HTMLElement>('[data-ref="btn-list-checklist"]');
    if (btnChecklist) {
      btnChecklist.addEventListener('click', (e) => {
        e.preventDefault();
        const html = '<div class="doc-checklist-item" style="display: flex; align-items: flex-start; gap: 8px; margin: 4px 0;"><input type="checkbox" style="margin-top: 4px;" /><span>Tarea pendiente</span></div><p><br></p>';
        document.execCommand('insertHTML', false, html);
        this.recordChange();
      }, { signal });
    }

    const btnFontSizeMinus = this.container.querySelector<HTMLElement>('[data-ref="btn-font-size-minus"]');
    const btnFontSizePlus = this.container.querySelector<HTMLElement>('[data-ref="btn-font-size-plus"]');
    const btnFontSizeBadge = this.container.querySelector<HTMLElement>('[data-ref="btn-font-size-badge"]');

    if (btnFontSizeMinus) {
      btnFontSizeMinus.addEventListener('click', () => {
        const cur = Math.max(8, (this.project.settings.fontSize || 11) - 1);
        this.applyFontSizeToSelection(cur);
      }, { signal });
    }

    if (btnFontSizePlus) {
      btnFontSizePlus.addEventListener('click', () => {
        const cur = Math.min(72, (this.project.settings.fontSize || 11) + 1);
        this.applyFontSizeToSelection(cur);
      }, { signal });
    }

    if (btnFontSizeBadge) {
      btnFontSizeBadge.addEventListener('click', () => {
        const val = prompt('Tamaño de fuente (pt):', String(this.project.settings.fontSize || 11));
        const num = Number(val);
        if (num && num >= 6 && num <= 96) {
          this.applyFontSizeToSelection(num);
        }
      }, { signal });
    }

    document.addEventListener('selectionchange', () => {
      this.updateActiveFormattingButtons();
    }, { signal });
  }

  private updateActiveFormattingButtons(): void {
    const updateActive = (ref: string, state: boolean) => {
      const el = this.container.querySelector<HTMLElement>(`[data-ref="${ref}"]`);
      if (el) el.classList.toggle('is-active', state);
    };

    try {
      updateActive('btn-bold', document.queryCommandState('bold'));
      updateActive('btn-italic', document.queryCommandState('italic'));
      updateActive('btn-underline', document.queryCommandState('underline'));
      updateActive('btn-strike', document.queryCommandState('strikeThrough'));
      updateActive('btn-superscript', document.queryCommandState('superscript'));
      updateActive('btn-subscript', document.queryCommandState('subscript'));
      updateActive('btn-align-left', document.queryCommandState('justifyLeft'));
      updateActive('btn-align-center', document.queryCommandState('justifyCenter'));
      updateActive('btn-align-right', document.queryCommandState('justifyRight'));
      updateActive('btn-align-justify', document.queryCommandState('justifyFull'));
    } catch {}
  }

  private applyFontSizeToSelection(sizePt: number): void {
    this.project.settings.fontSize = sizePt;
    const fontSizeBadge = this.container.querySelector<HTMLElement>('[data-ref="lbl-font-size"]');
    if (fontSizeBadge) {
      fontSizeBadge.textContent = `${sizePt}pt`;
    }

    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) {
      this.renderDocument();
      this.recordChange();
      return;
    }

    const range = sel.getRangeAt(0);
    const span = document.createElement('span');
    span.style.fontSize = `${sizePt}pt`;
    span.appendChild(range.extractContents());
    range.insertNode(span);
    this.recordChange();
  }

  private applyFontToDocumentOrSelection(event: FontSelectEvent): void {
    const fullFamily = `'${event.family}', ${event.fallback}`;
    ensureGoogleFontLoaded(event.family);

    const lbl = this.container.querySelector<HTMLElement>('[data-ref="lbl-current-font"]');
    if (lbl) {
      lbl.textContent = event.family;
    }

    const sel = window.getSelection();
    let hasSelectionInDoc = false;

    if (sel && !sel.isCollapsed && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      const common = range.commonAncestorContainer;
      const element = common.nodeType === Node.ELEMENT_NODE ? (common as HTMLElement) : common.parentElement;

      if (element && element.closest('.doc-page__content')) {
        hasSelectionInDoc = true;
        const span = document.createElement('span');
        span.style.fontFamily = fullFamily;
        if (event.weight) {
          span.style.fontWeight = String(event.weight);
        }
        if (event.style) {
          span.style.fontStyle = event.style;
        }
        span.appendChild(range.extractContents());
        range.insertNode(span);

        sel.removeAllRanges();
        const newRange = document.createRange();
        newRange.selectNodeContents(span);
        sel.addRange(newRange);
      }
    }

    if (!hasSelectionInDoc) {
      this.project.settings.fontFamily = fullFamily;
      this.container.querySelectorAll<HTMLElement>('.doc-page__content').forEach((p) => {
        p.style.fontFamily = fullFamily;
      });
    }

    if (this.fontPicker) {
      this.fontPicker.setActiveFont(event.family, event.weight || 400, event.style || 'normal');
    }

    this.recordChange();
  }

  private initSidePanelsUI(): void {
    const signal = this.abortController.signal;

    const btnFontTrigger = this.container.querySelector<HTMLElement>('[data-ref="btn-trigger-font-family"]');
    const fontsPanel = this.container.querySelector<HTMLElement>('[data-ref="doc-fonts-panel"]');
    const btnCloseFonts = this.container.querySelector<HTMLElement>('[data-ref="btn-close-doc-fonts"]');
    const fontsBody = this.container.querySelector<HTMLElement>('[data-ref="doc-fonts-body"]');

    const btnTextColorTrigger = this.container.querySelector<HTMLElement>('[data-ref="btn-text-color-trigger"]');
    const btnBgColorTrigger = this.container.querySelector<HTMLElement>('[data-ref="btn-bg-color-trigger"]');
    const colorsPanel = this.container.querySelector<HTMLElement>('[data-ref="doc-colors-panel"]');
    const colorsTitle = this.container.querySelector<HTMLElement>('[data-ref="doc-colors-title"]');
    const btnCloseColors = this.container.querySelector<HTMLElement>('[data-ref="btn-close-doc-colors"]');
    const paletteGrid = this.container.querySelector<HTMLElement>('[data-ref="doc-palette-grid"]');
    const customColorInput = this.container.querySelector<HTMLInputElement>('[data-ref="input-custom-color"]');
    const customHexInput = this.container.querySelector<HTMLInputElement>('[data-ref="input-custom-hex"]');
    const customHexText = this.container.querySelector<HTMLElement>('[data-ref="doc-colors-hex-text"]');
    const colorActiveSwatch = this.container.querySelector<HTMLElement>('[data-ref="doc-color-active-swatch"]');

    if (fontsBody) {
      this.fontPicker = new DocFontPickerComponent(fontsBody, (event: FontSelectEvent) => {
        this.applyFontToDocumentOrSelection(event);
      });
      this.fontPicker.init(this.project.settings.fontFamily);
    }

    btnFontTrigger?.addEventListener('click', () => {
      if (fontsPanel?.classList.contains('is-hidden')) {
        colorsPanel?.classList.add('is-hidden');
        fontsPanel?.classList.remove('is-hidden');
        this.fontPicker?.focusSearch();
      } else {
        fontsPanel?.classList.add('is-hidden');
      }
    }, { signal });

    btnCloseFonts?.addEventListener('click', () => {
      fontsPanel?.classList.add('is-hidden');
    }, { signal });

    const updateColorPanelState = (target: 'highlight' | 'text') => {
      this.currentColorTarget = target;
      if (colorsTitle) {
        colorsTitle.textContent = target === 'text' ? 'Color de texto' : 'Color de resaltado';
      }
      const activeColor = target === 'text' ? this.currentTextColor : this.currentHighlightColor;
      if (customColorInput) customColorInput.value = activeColor;
      if (customHexInput) customHexInput.value = activeColor.toUpperCase();
      if (customHexText) customHexText.textContent = activeColor.toUpperCase();
      if (colorActiveSwatch) colorActiveSwatch.style.backgroundColor = activeColor;
    };

    btnTextColorTrigger?.addEventListener('click', () => {
      if (colorsPanel?.classList.contains('is-hidden') || this.currentColorTarget !== 'text') {
        fontsPanel?.classList.add('is-hidden');
        updateColorPanelState('text');
        colorsPanel?.classList.remove('is-hidden');
      } else {
        colorsPanel?.classList.add('is-hidden');
      }
    }, { signal });

    btnBgColorTrigger?.addEventListener('click', () => {
      if (colorsPanel?.classList.contains('is-hidden') || this.currentColorTarget !== 'highlight') {
        fontsPanel?.classList.add('is-hidden');
        updateColorPanelState('highlight');
        colorsPanel?.classList.remove('is-hidden');
      } else {
        colorsPanel?.classList.add('is-hidden');
      }
    }, { signal });

    btnCloseColors?.addEventListener('click', () => {
      colorsPanel?.classList.add('is-hidden');
    }, { signal });

    if (paletteGrid) {
      paletteGrid.innerHTML = PALETTE_COLORS.map((c) => `
        <button type="button" class="design-colors-palette-swatch" data-color="${c}" style="background-color: ${c};" aria-label="Color ${c}"></button>
      `).join('');

      paletteGrid.querySelectorAll<HTMLElement>('[data-color]').forEach((swatch) => {
        swatch.addEventListener('click', () => {
          const color = swatch.getAttribute('data-color');
          if (color) {
            this.applyColor(color);
          }
        }, { signal });
      });
    }

    customColorInput?.addEventListener('input', () => {
      const val = customColorInput.value;
      if (customHexInput) customHexInput.value = val.toUpperCase();
      if (customHexText) customHexText.textContent = val.toUpperCase();
      if (colorActiveSwatch) colorActiveSwatch.style.backgroundColor = val;
      this.applyColor(val);
    }, { signal });

    customHexInput?.addEventListener('change', () => {
      let val = customHexInput.value.trim();
      if (!val.startsWith('#')) val = '#' + val;
      if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
        if (customColorInput) customColorInput.value = val;
        if (customHexText) customHexText.textContent = val.toUpperCase();
        if (colorActiveSwatch) colorActiveSwatch.style.backgroundColor = val;
        this.applyColor(val);
      }
    }, { signal });

    const viewport = this.container.querySelector<HTMLElement>('[data-ref="doc-viewport"]');
    viewport?.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-ref="doc-fonts-panel"], [data-ref="doc-colors-panel"], [data-ref="btn-trigger-font-family"], [data-ref="btn-text-color-trigger"], [data-ref="btn-bg-color-trigger"]')) {
        fontsPanel?.classList.add('is-hidden');
        colorsPanel?.classList.add('is-hidden');
      }
    }, { signal });
  }

  private applyColor(color: string): void {
    if (this.currentColorTarget === 'text') {
      this.currentTextColor = color;
      const indicator = this.container.querySelector<HTMLElement>('[data-ref="indicator-text-color"]');
      if (indicator) indicator.style.backgroundColor = color;
      document.execCommand('foreColor', false, color);
    } else {
      this.currentHighlightColor = color;
      const indicator = this.container.querySelector<HTMLElement>('[data-ref="indicator-bg-color"]');
      if (indicator) indicator.style.backgroundColor = color;
      document.execCommand('hiliteColor', false, color);
    }

    const customColorInput = this.container.querySelector<HTMLInputElement>('[data-ref="input-custom-color"]');
    const customHexInput = this.container.querySelector<HTMLInputElement>('[data-ref="input-custom-hex"]');
    const customHexText = this.container.querySelector<HTMLElement>('[data-ref="doc-colors-hex-text"]');
    const colorActiveSwatch = this.container.querySelector<HTMLElement>('[data-ref="doc-color-active-swatch"]');

    if (customColorInput) customColorInput.value = color;
    if (customHexInput) customHexInput.value = color.toUpperCase();
    if (customHexText) customHexText.textContent = color.toUpperCase();
    if (colorActiveSwatch) colorActiveSwatch.style.backgroundColor = color;

    this.recordChange();
  }

  private bindDropdowns(signal: AbortSignal): void {
    const wrapperStyles = this.container.querySelector<HTMLElement>('[data-ref="dropdown-wrapper-styles"]');
    if (wrapperStyles) {
      setupDropdown(wrapperStyles, { matchWidth: true });
    }

    this.container.querySelectorAll<HTMLElement>('[data-ref^="opt-style-"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const cmd = btn.getAttribute('data-command') || 'formatBlock';
        const tag = btn.getAttribute('data-value') || 'p';

        if (cmd === 'customStyle') {
          if (tag === 'title') {
            document.execCommand('formatBlock', false, 'p');
            const sel = window.getSelection();
            const el = (sel?.anchorNode instanceof HTMLElement ? sel.anchorNode : sel?.anchorNode?.parentElement)?.closest('p');
            if (el) el.className = 'doc-title';
          } else if (tag === 'subtitle') {
            document.execCommand('formatBlock', false, 'p');
            const sel = window.getSelection();
            const el = (sel?.anchorNode instanceof HTMLElement ? sel.anchorNode : sel?.anchorNode?.parentElement)?.closest('p');
            if (el) el.className = 'doc-subtitle';
          }
        } else {
          document.execCommand('formatBlock', false, tag);
        }

        const lbl = this.container.querySelector<HTMLElement>('[data-ref="lbl-current-style"]');
        if (lbl) lbl.textContent = btn.querySelector('.menu-item__text')?.textContent?.trim() || btn.textContent?.trim() || 'Texto normal';
        this.recordChange();
      }, { signal });
    });

    const wrapperLetterSpacing = this.container.querySelector<HTMLElement>('[data-ref="dropdown-wrapper-letter-spacing"]');
    if (wrapperLetterSpacing) {
      setupDropdown(wrapperLetterSpacing, { matchWidth: false });
    }

    this.container.querySelectorAll<HTMLElement>('[data-ref^="opt-letter-spacing-"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const spacing = btn.getAttribute('data-letter-spacing') || '0px';
        const sel = window.getSelection();
        if (sel && !sel.isCollapsed && sel.rangeCount > 0) {
          const range = sel.getRangeAt(0);
          const span = document.createElement('span');
          span.style.letterSpacing = spacing;
          span.appendChild(range.extractContents());
          range.insertNode(span);
        } else {
          this.project.settings.letterSpacing = parseFloat(spacing) || 0;
          this.renderDocument();
        }
        this.recordChange();
      }, { signal });
    });

    const wrapperCase = this.container.querySelector<HTMLElement>('[data-ref="dropdown-wrapper-case"]');
    if (wrapperCase) {
      setupDropdown(wrapperCase, { matchWidth: false });
    }

    this.container.querySelector<HTMLElement>('[data-ref="opt-case-upper"]')?.addEventListener('click', () => {
      this.transformSelectedText((t) => t.toUpperCase());
    }, { signal });

    this.container.querySelector<HTMLElement>('[data-ref="opt-case-lower"]')?.addEventListener('click', () => {
      this.transformSelectedText((t) => t.toLowerCase());
    }, { signal });

    this.container.querySelector<HTMLElement>('[data-ref="opt-case-title"]')?.addEventListener('click', () => {
      this.transformSelectedText((t) => t.replace(/\b\w/g, (c) => c.toUpperCase()));
    }, { signal });

    const wrapperSpacing = this.container.querySelector<HTMLElement>('[data-ref="dropdown-wrapper-line-spacing"]');
    if (wrapperSpacing) {
      setupDropdown(wrapperSpacing, { matchWidth: false });
    }

    this.container.querySelectorAll<HTMLElement>('[data-ref^="opt-spacing-"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const spacing = Number(btn.getAttribute('data-spacing')) || 1.15;
        this.project.settings.lineHeight = spacing;
        this.renderDocument();
        this.recordChange();
      }, { signal });
    });

    this.container.querySelector<HTMLElement>('[data-ref="opt-para-space-add"]')?.addEventListener('click', () => {
      const sel = window.getSelection();
      const el = (sel?.anchorNode instanceof HTMLElement ? sel.anchorNode : sel?.anchorNode?.parentElement)?.closest('p, div, h1, h2, h3, h4');
      if (el) {
        (el as HTMLElement).style.marginBottom = '1.2em';
        this.recordChange();
        showToast('Espacio añadido después del párrafo', 'success');
      }
    }, { signal });

    this.container.querySelector<HTMLElement>('[data-ref="opt-para-space-remove"]')?.addEventListener('click', () => {
      const sel = window.getSelection();
      const el = (sel?.anchorNode instanceof HTMLElement ? sel.anchorNode : sel?.anchorNode?.parentElement)?.closest('p, div, h1, h2, h3, h4');
      if (el) {
        (el as HTMLElement).style.marginBottom = '0';
        this.recordChange();
        showToast('Espacio removido del párrafo', 'success');
      }
    }, { signal });
  }

  private transformSelectedText(fn: (text: string) => string): void {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    const content = range.extractContents();
    const walker = document.createTreeWalker(content, NodeFilter.SHOW_TEXT, null);
    let node: Node | null = walker.nextNode();
    while (node) {
      if (node.nodeValue) node.nodeValue = fn(node.nodeValue);
      node = walker.nextNode();
    }
    range.insertNode(content);
    this.recordChange();
  }

  private bindInsertTools(signal: AbortSignal): void {
    const btnInsertImg = this.container.querySelector<HTMLElement>('[data-ref="btn-insert-image"]');
    const fileInputImg = this.container.querySelector<HTMLInputElement>('[data-ref="input-file-image"]');
    const fileInputReplaceImg = this.container.querySelector<HTMLInputElement>('[data-ref="input-file-replace-img"]');

    if (btnInsertImg && fileInputImg) {
      btnInsertImg.addEventListener('click', () => fileInputImg.click(), { signal });
      fileInputImg.addEventListener('change', async () => {
        const file = fileInputImg.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
          const dataUrl = e.target?.result as string;
          if (dataUrl) {
            this.insertImageElement(dataUrl);
          }
        };
        reader.readAsDataURL(file);
        fileInputImg.value = '';
      }, { signal });
    }

    if (fileInputReplaceImg) {
      fileInputReplaceImg.addEventListener('change', () => {
        const file = fileInputReplaceImg.files?.[0];
        if (!file || !this.selectedImageWrapper) return;
        const img = this.selectedImageWrapper.querySelector('img');
        if (!img) return;
        const reader = new FileReader();
        reader.onload = (e) => {
          const dataUrl = e.target?.result as string;
          if (dataUrl) {
            img.src = dataUrl;
            this.recordChange();
            showToast('Imagen reemplazada con éxito', 'success');
          }
        };
        reader.readAsDataURL(file);
        fileInputReplaceImg.value = '';
      }, { signal });
    }

    const wrapperTable = this.container.querySelector<HTMLElement>('[data-ref="dropdown-wrapper-table"]');
    if (wrapperTable) {
      setupDropdown(wrapperTable, { matchWidth: false });
    }

    const tablePickerGrid = this.container.querySelector<HTMLElement>('[data-ref="table-picker-grid"]');
    const tablePickerLabel = this.container.querySelector<HTMLElement>('[data-ref="table-picker-label"]');

    if (tablePickerGrid) {
      tablePickerGrid.innerHTML = '';
      for (let r = 1; r <= 8; r++) {
        for (let c = 1; c <= 8; c++) {
          const cell = document.createElement('div');
          cell.className = 'doc-table-picker__cell';
          cell.setAttribute('data-r', String(r));
          cell.setAttribute('data-c', String(c));

          cell.addEventListener('mouseenter', () => {
            if (tablePickerLabel) tablePickerLabel.textContent = `Insertar tabla ${r} × ${c}`;
            tablePickerGrid.querySelectorAll<HTMLElement>('.doc-table-picker__cell').forEach((item) => {
              const ir = Number(item.getAttribute('data-r'));
              const ic = Number(item.getAttribute('data-c'));
              if (ir <= r && ic <= c) {
                item.classList.add('is-active');
              } else {
                item.classList.remove('is-active');
              }
            });
          }, { signal });

          cell.addEventListener('click', () => {
            this.insertTable(r, c);
            const backdrop = this.container.querySelector<HTMLElement>('[data-ref="backdrop-table"]');
            if (backdrop) backdrop.classList.remove('is-active');
          }, { signal });

          tablePickerGrid.appendChild(cell);
        }
      }
    }

    const wrapperCallout = this.container.querySelector<HTMLElement>('[data-ref="dropdown-wrapper-callout"]');
    if (wrapperCallout) {
      setupDropdown(wrapperCallout, { matchWidth: false });
    }

    this.container.querySelectorAll<HTMLElement>('[data-ref^="opt-callout-"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const type = btn.getAttribute('data-type') || 'info';
        const colors: Record<string, { bg: string; border: string; color: string; icon: string; title: string }> = {
          danger: { bg: '#fef2f2', border: '#ef4444', color: '#991b1b', icon: 'dangerous', title: 'Peligro' },
          info: { bg: '#eff6ff', border: '#3b82f6', color: '#1e3a8a', icon: 'info', title: 'Nota informativa' },
          success: { bg: '#f0fdf4', border: '#22c55e', color: '#14532d', icon: 'check_circle', title: 'Éxito' },
          tip: { bg: '#faf5ff', border: '#a855f7', color: '#581c87', icon: 'lightbulb', title: 'Consejo' },
          warning: { bg: '#fffbeb', border: '#f59e0b', color: '#78350f', icon: 'warning', title: 'Advertencia' },
        };
        const conf = colors[type] || colors.info;
        const html = `
          <div class="doc-callout doc-callout--${type}" style="background: ${conf.bg}; border-left: 4px solid ${conf.border}; padding: 12px 16px; border-radius: 6px; margin: 16px 0;">
            <div style="display: flex; align-items: center; gap: 8px; font-weight: 700; color: ${conf.border}; margin-bottom: 4px;">
              <span class="component-icon" style="font-size: 18px;">${conf.icon}</span> ${conf.title}
            </div>
            <p style="margin: 0; color: ${conf.color}; font-size: 10.5pt; line-height: 1.5;">Escribe aquí el contenido relevante de la nota o aviso.</p>
          </div>
          <p><br></p>
        `;
        document.execCommand('insertHTML', false, html);
        this.recordChange();
      }, { signal });
    });

    const btnInsertLink = this.container.querySelector<HTMLElement>('[data-ref="btn-insert-link"]');
    if (btnInsertLink) {
      btnInsertLink.addEventListener('click', () => {
        const url = prompt('Introduce la dirección URL del enlace:', 'https://');
        if (url) {
          document.execCommand('createLink', false, url);
          this.recordChange();
        }
      }, { signal });
    }

    const btnAddPage = this.container.querySelector<HTMLElement>('[data-ref="btn-add-page"]');
    if (btnAddPage) {
      btnAddPage.addEventListener('click', () => {
        this.paginationManager.addPage(this.project);
        this.renderDocument();
        this.recordChange();
        showToast('Nueva página añadida al documento', 'success');
      }, { signal });
    }

    const btnDocStats = this.container.querySelector<HTMLElement>('[data-ref="btn-doc-stats"]');
    if (btnDocStats) {
      btnDocStats.addEventListener('click', () => this.openStatsModal(), { signal });
    }
  }

  private insertImageElement(src: string): void {
    const wrapper = document.createElement('div');
    wrapper.className = 'doc-image-wrapper doc-img-wrap--left doc-img-radius--8 doc-img-shadow--sm';
    wrapper.style.width = '50%';
    wrapper.innerHTML = `<img src="${src}" alt="Imagen insertada" />`;

    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      range.deleteContents();
      range.insertNode(wrapper);
      const afterP = document.createElement('p');
      afterP.innerHTML = '<br>';
      wrapper.after(afterP);
    } else {
      const firstPage = this.container.querySelector('.doc-page__content');
      firstPage?.appendChild(wrapper);
    }

    this.initSingleImageWrapper(wrapper);
    this.selectImageWrapper(wrapper);
    this.recordChange();
    showToast('Imagen insertada con éxito', 'success');
  }

  private initExistingImages(): void {
    this.container.querySelectorAll<HTMLElement>('.doc-image-wrapper').forEach((wrapper) => {
      this.initSingleImageWrapper(wrapper);
    });
  }

  private initSingleImageWrapper(wrapper: HTMLElement): void {
    wrapper.addEventListener('click', (e) => {
      e.stopPropagation();
      this.selectImageWrapper(wrapper);
    });

    wrapper.addEventListener('mousedown', (e) => {
      if (wrapper.classList.contains('doc-img-wrap--free') && !(e.target as HTMLElement).classList.contains('doc-image-handle')) {
        this.startFreeDrag(wrapper, e);
      }
    });
  }

  private selectImageWrapper(wrapper: HTMLElement): void {
    this.deselectAllImages();
    this.selectedImageWrapper = wrapper;
    wrapper.classList.add('is-selected');
    this.attachImageResizeHandles(wrapper);

    const imageTray = this.container.querySelector<HTMLElement>('[data-ref="doc-image-tray"]');
    imageTray?.classList.remove('is-hidden');
  }

  private deselectAllImages(): void {
    this.container.querySelectorAll<HTMLElement>('.doc-image-wrapper').forEach((w) => {
      w.classList.remove('is-selected');
      w.querySelectorAll('.doc-image-handle').forEach((h) => h.remove());
    });
    this.selectedImageWrapper = null;
  }

  private attachImageResizeHandles(wrapper: HTMLElement): void {
    wrapper.querySelectorAll('.doc-image-handle').forEach((h) => h.remove());

    const positions = ['nw', 'ne', 'sw', 'se', 'n', 's', 'e', 'w'];
    positions.forEach((pos) => {
      const handle = document.createElement('div');
      handle.className = `doc-image-handle doc-image-handle--${pos}`;
      handle.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        e.preventDefault();
        this.startResizeDrag(wrapper, pos, e);
      });
      wrapper.appendChild(handle);
    });
  }

  private startResizeDrag(wrapper: HTMLElement, handlePos: string, startEvent: MouseEvent): void {
    const startX = startEvent.clientX;
    const startY = startEvent.clientY;
    const startRect = wrapper.getBoundingClientRect();
    const parentWidth = (wrapper.parentElement?.getBoundingClientRect().width) || 600;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;

      let newWidth = startRect.width;
      if (handlePos.includes('e')) newWidth = startRect.width + dx;
      if (handlePos.includes('w')) newWidth = startRect.width - dx;
      if (handlePos.includes('s') && !handlePos.includes('e') && !handlePos.includes('w')) {
        newWidth = startRect.width + dy * (startRect.width / startRect.height);
      }
      if (handlePos.includes('n') && !handlePos.includes('e') && !handlePos.includes('w')) {
        newWidth = startRect.width - dy * (startRect.width / startRect.height);
      }

      newWidth = Math.max(60, Math.min(parentWidth, newWidth));
      const pct = Math.round((newWidth / parentWidth) * 100);
      wrapper.style.width = `${pct}%`;
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      this.recordChange();
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }

  private startFreeDrag(wrapper: HTMLElement, startEvent: MouseEvent): void {
    startEvent.preventDefault();
    const page = wrapper.closest<HTMLElement>('.doc-page');
    if (!page) return;

    const pageRect = page.getBoundingClientRect();
    const startX = startEvent.clientX;
    const startY = startEvent.clientY;
    const startLeft = parseFloat(wrapper.style.left) || (wrapper.getBoundingClientRect().left - pageRect.left);
    const startTop = parseFloat(wrapper.style.top) || (wrapper.getBoundingClientRect().top - pageRect.top);

    const onMouseMove = (moveEvent: MouseEvent) => {
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;
      wrapper.style.left = `${Math.max(0, startLeft + dx)}px`;
      wrapper.style.top = `${Math.max(0, startTop + dy)}px`;
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      this.recordChange();
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }

  private bindImageAndTableControls(signal: AbortSignal): void {
    const imageTray = this.container.querySelector<HTMLElement>('[data-ref="doc-image-tray"]');
    const tableTray = this.container.querySelector<HTMLElement>('[data-ref="doc-table-tray"]');
    const btnCloseImage = this.container.querySelector<HTMLElement>('[data-ref="btn-close-image-options"]');
    const btnCloseTable = this.container.querySelector<HTMLElement>('[data-ref="btn-close-table-options"]');

    btnCloseImage?.addEventListener('click', () => {
      imageTray?.classList.add('is-hidden');
      this.deselectAllImages();
    }, { signal });

    btnCloseTable?.addEventListener('click', () => tableTray?.classList.add('is-hidden'), { signal });

    document.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;

      if (!target.closest('.doc-image-wrapper') && !target.closest('[data-ref="doc-image-tray"]')) {
        this.deselectAllImages();
        imageTray?.classList.add('is-hidden');
      }

      if (target.tagName === 'TD' || target.tagName === 'TH') {
        this.activeTableCell = target as HTMLTableCellElement;
        this.activeTable = target.closest('table');
        tableTray?.classList.remove('is-hidden');
      } else if (!target.closest('[data-ref="doc-table-tray"]')) {
        if (!target.closest('table')) {
          tableTray?.classList.add('is-hidden');
        }
      }
    }, { signal });

    const bindWrap = (ref: string, mode: DocImageWrapMode) => {
      const btn = this.container.querySelector<HTMLElement>(`[data-ref="${ref}"]`);
      btn?.addEventListener('click', () => {
        if (!this.selectedImageWrapper) return;
        this.selectedImageWrapper.classList.remove('doc-img-wrap--inline', 'doc-img-wrap--left', 'doc-img-wrap--right', 'doc-img-wrap--center', 'doc-img-wrap--free');
        this.selectedImageWrapper.classList.add(`doc-img-wrap--${mode}`);
        this.recordChange();
      }, { signal });
    };

    bindWrap('img-btn-wrap-inline', 'inline');
    bindWrap('img-btn-wrap-left', 'left');
    bindWrap('img-btn-wrap-right', 'right');
    bindWrap('img-btn-wrap-center', 'center');
    bindWrap('img-btn-wrap-free', 'free');

    const bindImgResize = (ref: string, widthPercent: string) => {
      const btn = this.container.querySelector<HTMLElement>(`[data-ref="${ref}"]`);
      if (btn) {
        btn.addEventListener('click', () => {
          if (this.selectedImageWrapper) {
            this.selectedImageWrapper.style.width = widthPercent;
            this.container.querySelectorAll<HTMLElement>('[data-ref^="img-btn-size-"]').forEach((b) => b.classList.remove('is-active'));
            btn.classList.add('is-active');
            this.recordChange();
          }
        }, { signal });
      }
    };

    bindImgResize('img-btn-size-25', '25%');
    bindImgResize('img-btn-size-50', '50%');
    bindImgResize('img-btn-size-75', '75%');
    bindImgResize('img-btn-size-100', '100%');

    const btnImgRadius = this.container.querySelector<HTMLElement>('[data-ref="img-btn-toggle-radius"]');
    btnImgRadius?.addEventListener('click', () => {
      if (!this.selectedImageWrapper) return;
      const classes: DocImageRadius[] = ['0', '8', '18', 'pill'];
      const cur = classes.find((c) => this.selectedImageWrapper?.classList.contains(`doc-img-radius--${c}`)) || '8';
      const next = classes[(classes.indexOf(cur) + 1) % classes.length];
      classes.forEach((c) => this.selectedImageWrapper?.classList.remove(`doc-img-radius--${c}`));
      this.selectedImageWrapper.classList.add(`doc-img-radius--${next}`);
      this.recordChange();
    }, { signal });

    const btnImgShadow = this.container.querySelector<HTMLElement>('[data-ref="img-btn-toggle-shadow"]');
    btnImgShadow?.addEventListener('click', () => {
      if (!this.selectedImageWrapper) return;
      const classes: DocImageShadow[] = ['none', 'sm', 'md', 'lg'];
      const cur = classes.find((c) => this.selectedImageWrapper?.classList.contains(`doc-img-shadow--${c}`)) || 'sm';
      const next = classes[(classes.indexOf(cur) + 1) % classes.length];
      classes.forEach((c) => this.selectedImageWrapper?.classList.remove(`doc-img-shadow--${c}`));
      this.selectedImageWrapper.classList.add(`doc-img-shadow--${next}`);
      this.recordChange();
    }, { signal });

    const btnImgCaption = this.container.querySelector<HTMLElement>('[data-ref="img-btn-caption"]');
    btnImgCaption?.addEventListener('click', () => {
      if (!this.selectedImageWrapper) return;
      const existing = this.selectedImageWrapper.querySelector('.doc-image-caption');
      if (existing) {
        existing.remove();
      } else {
        const caption = document.createElement('div');
        caption.className = 'doc-image-caption';
        caption.contentEditable = 'true';
        caption.textContent = 'Pie de foto descriptivo';
        this.selectedImageWrapper.appendChild(caption);
      }
      this.recordChange();
    }, { signal });

    const btnImgReplace = this.container.querySelector<HTMLElement>('[data-ref="img-btn-replace"]');
    const fileInputReplace = this.container.querySelector<HTMLInputElement>('[data-ref="input-file-replace-img"]');
    btnImgReplace?.addEventListener('click', () => fileInputReplace?.click(), { signal });

    const btnImgDel = this.container.querySelector<HTMLElement>('[data-ref="img-btn-delete"]');
    if (btnImgDel) {
      btnImgDel.addEventListener('click', () => {
        if (this.selectedImageWrapper) {
          this.selectedImageWrapper.remove();
          this.selectedImageWrapper = null;
          imageTray?.classList.add('is-hidden');
          this.recordChange();
        }
      }, { signal });
    }

    const btnTblAddRowAbove = this.container.querySelector<HTMLElement>('[data-ref="tbl-btn-add-row-above"]');
    btnTblAddRowAbove?.addEventListener('click', () => {
      if (this.activeTableCell && this.activeTable) {
        const row = this.activeTableCell.parentElement as HTMLTableRowElement;
        const newRow = this.activeTable.insertRow(row.rowIndex);
        for (let i = 0; i < row.cells.length; i++) {
          const newCell = newRow.insertCell(i);
          newCell.innerHTML = 'Celda';
          newCell.style.border = '1px solid #cbd5e1';
          newCell.style.padding = '8px 12px';
        }
        this.recordChange();
      }
    }, { signal });

    const btnTblAddRowBelow = this.container.querySelector<HTMLElement>('[data-ref="tbl-btn-add-row-below"]');
    btnTblAddRowBelow?.addEventListener('click', () => {
      if (this.activeTableCell && this.activeTable) {
        const row = this.activeTableCell.parentElement as HTMLTableRowElement;
        const newRow = this.activeTable.insertRow(row.rowIndex + 1);
        for (let i = 0; i < row.cells.length; i++) {
          const newCell = newRow.insertCell(i);
          newCell.innerHTML = 'Celda';
          newCell.style.border = '1px solid #cbd5e1';
          newCell.style.padding = '8px 12px';
        }
        this.recordChange();
      }
    }, { signal });

    const btnTblAddColLeft = this.container.querySelector<HTMLElement>('[data-ref="tbl-btn-add-col-left"]');
    btnTblAddColLeft?.addEventListener('click', () => {
      if (this.activeTableCell && this.activeTable) {
        const cellIndex = this.activeTableCell.cellIndex;
        for (let i = 0; i < this.activeTable.rows.length; i++) {
          const row = this.activeTable.rows[i];
          const newCell = row.insertCell(cellIndex);
          newCell.innerHTML = row.parentElement?.tagName === 'THEAD' ? 'Encabezado' : 'Celda';
          newCell.style.border = '1px solid #cbd5e1';
          newCell.style.padding = '8px 12px';
        }
        this.recordChange();
      }
    }, { signal });

    const btnTblAddColRight = this.container.querySelector<HTMLElement>('[data-ref="tbl-btn-add-col-right"]');
    btnTblAddColRight?.addEventListener('click', () => {
      if (this.activeTableCell && this.activeTable) {
        const cellIndex = this.activeTableCell.cellIndex + 1;
        for (let i = 0; i < this.activeTable.rows.length; i++) {
          const row = this.activeTable.rows[i];
          const newCell = row.insertCell(cellIndex);
          newCell.innerHTML = row.parentElement?.tagName === 'THEAD' ? 'Encabezado' : 'Celda';
          newCell.style.border = '1px solid #cbd5e1';
          newCell.style.padding = '8px 12px';
        }
        this.recordChange();
      }
    }, { signal });

    const btnTblDelRow = this.container.querySelector<HTMLElement>('[data-ref="tbl-btn-del-row"]');
    btnTblDelRow?.addEventListener('click', () => {
      if (this.activeTableCell && this.activeTable) {
        const row = this.activeTableCell.parentElement as HTMLTableRowElement;
        this.activeTable.deleteRow(row.rowIndex);
        this.recordChange();
      }
    }, { signal });

    const btnTblDelCol = this.container.querySelector<HTMLElement>('[data-ref="tbl-btn-del-col"]');
    btnTblDelCol?.addEventListener('click', () => {
      if (this.activeTableCell && this.activeTable) {
        const cellIndex = this.activeTableCell.cellIndex;
        for (let i = 0; i < this.activeTable.rows.length; i++) {
          this.activeTable.rows[i].deleteCell(cellIndex);
        }
        this.recordChange();
      }
    }, { signal });

    const btnTblDelTable = this.container.querySelector<HTMLElement>('[data-ref="tbl-btn-del-table"]');
    btnTblDelTable?.addEventListener('click', () => {
      if (this.activeTable) {
        this.activeTable.remove();
        this.activeTable = null;
        this.activeTableCell = null;
        tableTray?.classList.add('is-hidden');
        this.recordChange();
      }
    }, { signal });
  }

  private bindDragDropAndPaste(signal: AbortSignal): void {
    const viewport = this.container.querySelector<HTMLElement>('[data-ref="doc-viewport"]');
    if (!viewport) return;

    viewport.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.stopPropagation();
    }, { signal });

    viewport.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const files = e.dataTransfer?.files;
      if (files && files.length > 0) {
        const file = files[0];
        if (file.type.startsWith('image/')) {
          const reader = new FileReader();
          reader.onload = (ev) => {
            const dataUrl = ev.target?.result as string;
            if (dataUrl) this.insertImageElement(dataUrl);
          };
          reader.readAsDataURL(file);
        }
      }
    }, { signal });
  }

  private insertTable(rows: number, cols: number): void {
    let html = '<table class="doc-table" style="width: 100%; border-collapse: collapse; margin: 16px 0;"><thead><tr style="background: #f8fafc;">';
    for (let c = 0; c < cols; c++) {
      html += `<th style="border: 1px solid #cbd5e1; padding: 8px 12px; text-align: left; font-weight: 700; color: #334155;">Encabezado ${c + 1}</th>`;
    }
    html += '</tr></thead><tbody>';
    for (let r = 0; r < rows; r++) {
      html += '<tr>';
      for (let c = 0; c < cols; c++) {
        html += '<td style="border: 1px solid #cbd5e1; padding: 8px 12px; color: #1e293b;">Celda</td>';
      }
      html += '</tr>';
    }
    html += '</tbody></table><p><br></p>';
    document.execCommand('insertHTML', false, html);
    this.recordChange();
  }

  private bindExportMenu(signal: AbortSignal): void {
    const wrapperExport = this.container.querySelector<HTMLElement>('[data-ref="dropdown-wrapper-export"]');
    if (wrapperExport) {
      setupDropdown(wrapperExport, { matchWidth: false });
    }

    const bindExp = (ref: string, fn: () => void) => {
      const btn = this.container.querySelector<HTMLElement>(`[data-ref="${ref}"]`);
      if (btn) {
        btn.addEventListener('click', () => {
          this.syncPagesFromDOM();
          fn();
        }, { signal });
      }
    };

    bindExp('btn-export-pdf', () => exportDocPdf(this.project, this.canvasTitle));
    bindExp('btn-export-word', () => exportDocWord(this.project, this.canvasTitle));
    bindExp('btn-export-markdown', () => exportDocMarkdown(this.project, this.canvasTitle));
    bindExp('btn-export-txt', () => exportDocTxt(this.project, this.canvasTitle));
    bindExp('btn-export-html', () => exportDocHtml(this.project, this.canvasTitle));
    bindExp('btn-export-json', () => exportDocJson(this.project, this.canvasTitle));
  }

  private bindFindAndReplace(signal: AbortSignal): void {
    const btnToggleFind = this.container.querySelector<HTMLElement>('[data-ref="btn-toggle-find"]');
    const findTray = this.container.querySelector<HTMLElement>('[data-ref="doc-find-replace-tray"]');
    const btnCloseFind = this.container.querySelector<HTMLElement>('[data-ref="btn-close-find"]');
    const inputFind = this.container.querySelector<HTMLInputElement>('[data-ref="input-find-text"]');
    const inputReplace = this.container.querySelector<HTMLInputElement>('[data-ref="input-replace-text"]');
    const btnReplaceOne = this.container.querySelector<HTMLElement>('[data-ref="btn-replace-one"]');
    const btnReplaceAll = this.container.querySelector<HTMLElement>('[data-ref="btn-replace-all"]');
    const matchCount = this.container.querySelector<HTMLElement>('[data-ref="find-match-count"]');

    if (btnToggleFind && findTray && inputFind) {
      btnToggleFind.addEventListener('click', () => {
        findTray.classList.toggle('is-hidden');
        if (!findTray.classList.contains('is-hidden')) {
          inputFind.focus();
          inputFind.select();
        }
      }, { signal });
    }

    if (btnCloseFind && findTray) {
      btnCloseFind.addEventListener('click', () => {
        findTray.classList.add('is-hidden');
      }, { signal });
    }

    const runFind = () => {
      const q = inputFind?.value.trim().toLowerCase() || '';
      if (!q) {
        if (matchCount) matchCount.textContent = '0 de 0';
        return;
      }
      let totalFound = 0;
      this.container.querySelectorAll<HTMLElement>('.doc-page__content').forEach((pageEl) => {
        const text = pageEl.innerText.toLowerCase();
        let pos = text.indexOf(q);
        while (pos !== -1) {
          totalFound++;
          pos = text.indexOf(q, pos + q.length);
        }
      });
      if (matchCount) {
        matchCount.textContent = totalFound > 0 ? `1 de ${totalFound}` : '0 de 0';
      }
    };

    if (inputFind) {
      inputFind.addEventListener('input', runFind, { signal });
      inputFind.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          runFind();
        } else if (e.key === 'Escape') {
          findTray?.classList.add('is-hidden');
        }
      }, { signal });
    }

    if (btnReplaceOne && inputFind && inputReplace) {
      btnReplaceOne.addEventListener('click', () => {
        const findVal = inputFind.value;
        const repVal = inputReplace.value;
        if (!findVal) return;
        this.container.querySelectorAll<HTMLElement>('.doc-page__content').forEach((pageEl) => {
          pageEl.innerHTML = pageEl.innerHTML.replace(findVal, repVal);
        });
        this.recordChange();
      }, { signal });
    }

    if (btnReplaceAll && inputFind && inputReplace) {
      btnReplaceAll.addEventListener('click', () => {
        const findVal = inputFind.value;
        const repVal = inputReplace.value;
        if (!findVal) return;
        const reg = new RegExp(findVal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
        this.container.querySelectorAll<HTMLElement>('.doc-page__content').forEach((pageEl) => {
          pageEl.innerHTML = pageEl.innerHTML.replace(reg, repVal);
        });
        this.recordChange();
        showToast('Todas las coincidencias fueron reemplazadas', 'success');
      }, { signal });
    }
  }

  private bindZoomControls(signal: AbortSignal): void {
    const btnZoomOut = this.container.querySelector<HTMLElement>('[data-ref="btn-zoom-out"]');
    const btnZoomIn = this.container.querySelector<HTMLElement>('[data-ref="btn-zoom-in"]');
    const btnZoomReset = this.container.querySelector<HTMLElement>('[data-ref="btn-zoom-reset"]');
    const btnZoomFit = this.container.querySelector<HTMLElement>('[data-ref="btn-zoom-fit"]');

    if (btnZoomOut) {
      btnZoomOut.addEventListener('click', () => this.updateZoom(this.project.settings.zoom - 0.1), { signal });
    }
    if (btnZoomIn) {
      btnZoomIn.addEventListener('click', () => this.updateZoom(this.project.settings.zoom + 0.1), { signal });
    }
    if (btnZoomReset) {
      btnZoomReset.addEventListener('click', () => this.updateZoom(1.0), { signal });
    }
    if (btnZoomFit) {
      btnZoomFit.addEventListener('click', () => {
        const viewport = this.container.querySelector<HTMLElement>('[data-ref="doc-viewport"]');
        const paper = (DOC_PAPER_DIMENSIONS[this.project.settings.paperSize || 'letter'] && DOC_PAPER_DIMENSIONS[this.project.settings.paperSize || 'letter'][this.project.settings.orientation || 'portrait']) || DOC_PAPER_DIMENSIONS.letter.portrait;
        if (viewport && paper && paper.widthPx > 0) {
          const availWidth = viewport.clientWidth - 80;
          const fitZoom = Math.max(0.5, Math.min(2.0, availWidth / paper.widthPx));
          this.updateZoom(fitZoom);
        }
      }, { signal });
    }
  }

  private updateZoom(nextZoom: number): void {
    this.project.settings.zoom = Math.max(0.5, Math.min(2.0, Math.round(nextZoom * 100) / 100));
    this.updateZoomUI();
    const pagesContainer = this.container.querySelector<HTMLElement>('[data-ref="doc-pages-container"]');
    if (pagesContainer) {
      pagesContainer.style.setProperty('--doc-zoom', `${this.project.settings.zoom}`);
    }
  }

  private updateZoomUI(): void {
    const lblZoom = this.container.querySelector<HTMLElement>('[data-ref="lbl-zoom-level"]');
    if (lblZoom) {
      lblZoom.textContent = `${Math.round(this.project.settings.zoom * 100)}%`;
    }
  }

  private bindKeyboardShortcuts(signal: AbortSignal): void {
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        this.handleUndo();
      } else if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) {
        e.preventDefault();
        this.handleRedo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        this.syncPagesFromDOM();
        exportDocPdf(this.project, this.canvasTitle);
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        this.syncPagesFromDOM();
        this.saveNow();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        const findTray = this.container.querySelector<HTMLElement>('[data-ref="doc-find-replace-tray"]');
        const inputFind = this.container.querySelector<HTMLInputElement>('[data-ref="input-find-text"]');
        findTray?.classList.remove('is-hidden');
        inputFind?.focus();
        inputFind?.select();
      }
    }, { signal });
  }

  private bindSelectionBubble(signal: AbortSignal): void {
    const bubble = this.container.querySelector<HTMLElement>('[data-ref="doc-floating-bubble"]');
    if (!bubble) return;

    document.addEventListener('selectionchange', () => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || sel.rangeCount === 0) {
        bubble.classList.add('is-hidden');
        return;
      }
      const range = sel.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        bubble.style.top = `${window.scrollY + rect.top - 46}px`;
        bubble.style.left = `${window.scrollX + rect.left + rect.width / 2 - 100}px`;
        bubble.classList.remove('is-hidden');
      } else {
        bubble.classList.add('is-hidden');
      }
    }, { signal });

    const bindBubbleCmd = (ref: string, cmd: string, val: string | undefined = undefined) => {
      const btn = this.container.querySelector<HTMLElement>(`[data-ref="${ref}"]`);
      if (btn) {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          document.execCommand(cmd, false, val);
          this.recordChange();
        }, { signal });
      }
    };

    bindBubbleCmd('bubble-btn-bold', 'bold');
    bindBubbleCmd('bubble-btn-italic', 'italic');
    bindBubbleCmd('bubble-btn-underline', 'underline');
    bindBubbleCmd('bubble-btn-h2', 'formatBlock', 'h2');
    bindBubbleCmd('bubble-btn-quote', 'formatBlock', 'blockquote');

    const bubbleLink = this.container.querySelector<HTMLElement>('[data-ref="bubble-btn-link"]');
    if (bubbleLink) {
      bubbleLink.addEventListener('click', (e) => {
        e.preventDefault();
        const url = prompt('Introduce la dirección URL:', 'https://');
        if (url) {
          document.execCommand('createLink', false, url);
          this.recordChange();
        }
      }, { signal });
    }
  }

  private bindPageEvents(): void {
    const signal = this.abortController.signal;

    this.container.querySelectorAll<HTMLElement>('.doc-page__content').forEach((contentEl) => {
      contentEl.addEventListener('input', () => {
        this.recordChange();
      }, { signal });

      contentEl.addEventListener('paste', (e) => {
        const items = e.clipboardData?.items;
        if (items) {
          for (let i = 0; i < items.length; i++) {
            if (items[i].type.startsWith('image/')) {
              e.preventDefault();
              const blob = items[i].getAsFile();
              if (blob) {
                const reader = new FileReader();
                reader.onload = (ev) => {
                  const dataUrl = ev.target?.result as string;
                  if (dataUrl) this.insertImageElement(dataUrl);
                };
                reader.readAsDataURL(blob);
              }
              return;
            }
          }
        }
        e.preventDefault();
        const text = e.clipboardData?.getData('text/plain') || '';
        document.execCommand('insertText', false, text);
        this.recordChange();
      }, { signal });
    });

    this.container.querySelectorAll<HTMLElement>('.doc-page__header, .doc-page__footer').forEach((hfEl) => {
      hfEl.addEventListener('input', () => {
        this.recordChange();
      }, { signal });
    });

    this.container.querySelectorAll<HTMLElement>('[data-ref^="btn-delete-page-"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const pageId = btn.getAttribute('data-page-id');
        if (pageId && this.project.pages.length > 1) {
          if (confirm('¿Deseas eliminar esta página del documento?')) {
            this.paginationManager.deletePage(this.project, pageId);
            this.renderDocument();
            this.recordChange();
          }
        }
      }, { signal });
    });
  }

  private recordChange(): void {
    this.syncPagesFromDOM();
    this.historyManager.pushState(this.project);
    this.updateUndoRedoButtonsState();
    this.updateStats();
    this.scheduleAutosave();
  }

  private syncPagesFromDOM(): void {
    this.project.pages.forEach((page) => {
      const contentEl = this.container.querySelector<HTMLElement>(`[data-ref="page-content-${page.id}"]`);
      if (contentEl) {
        const clone = contentEl.cloneNode(true) as HTMLElement;
        clone.querySelectorAll('.doc-image-handle').forEach((h) => h.remove());
        clone.querySelectorAll('.doc-image-wrapper').forEach((w) => w.classList.remove('is-selected'));
        page.contentHtml = clone.innerHTML;
      }
    });
  }

  private handleUndo(): void {
    const prevState = this.historyManager.undo();
    if (prevState) {
      this.project = prevState;
      this.renderDocument();
      this.updateUndoRedoButtonsState();
      this.updateStats();
      this.scheduleAutosave();
    }
  }

  private handleRedo(): void {
    const nextState = this.historyManager.redo();
    if (nextState) {
      this.project = nextState;
      this.renderDocument();
      this.updateUndoRedoButtonsState();
      this.updateStats();
      this.scheduleAutosave();
    }
  }

  private updateUndoRedoButtonsState(): void {
    const btnUndo = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-undo"]');
    const btnRedo = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-redo"]');

    if (btnUndo) {
      btnUndo.disabled = !this.historyManager.canUndo();
      btnUndo.classList.toggle('is-disabled', !this.historyManager.canUndo());
    }
    if (btnRedo) {
      btnRedo.disabled = !this.historyManager.canRedo();
      btnRedo.classList.toggle('is-disabled', !this.historyManager.canRedo());
    }
  }

  private updateStats(): void {
    const stats = this.paginationManager.calculateStats(this.project);

    const lblPage = this.container.querySelector<HTMLElement>('[data-ref="status-page-count"]');
    const lblWord = this.container.querySelector<HTMLElement>('[data-ref="status-word-count"]');
    const lblChar = this.container.querySelector<HTMLElement>('[data-ref="status-char-count"]');
    const lblRead = this.container.querySelector<HTMLElement>('[data-ref="status-reading-time"]');

    if (lblPage) lblPage.textContent = `Página 1 de ${stats.pages}`;
    if (lblWord) lblWord.textContent = `${stats.words.toLocaleString()} palabra${stats.words === 1 ? '' : 's'}`;
    if (lblChar) lblChar.textContent = `${stats.characters.toLocaleString()} caracteres`;
    if (lblRead) lblRead.textContent = `${stats.readingTimeMinutes} min lectura`;
  }

  private scheduleAutosave(): void {
    if (this.saveDebounceTimer) {
      clearTimeout(this.saveDebounceTimer);
    }
    this.saveDebounceTimer = window.setTimeout(() => {
      this.saveNow();
    }, 1500);
  }

  private async saveNow(): Promise<void> {
    if (this.isSaving) return;
    this.isSaving = true;

    try {
      const dataStr = JSON.stringify(this.project);
      const thumbnail = generateDocThumbnail(this.project);

      await saveLocalCanvas({
        canvas_type: 'doc',
        created_at: new Date().toISOString(),
        data: dataStr,
        height: 1056,
        is_local: !currentUser,
        name: this.canvasTitle,
        preview_thumbnail: thumbnail,
        unit: 'doc',
        updated_at: new Date().toISOString(),
        uuid: this.canvasUuid,
        width: 816,
      });

      if (currentUser) {
        await putApi(API_ROUTES.canvases.sync, {
          canvas_type: 'doc',
          data: dataStr,
          height: 1056,
          name: this.canvasTitle,
          preview_thumbnail: thumbnail,
          unit: 'doc',
          uuid: this.canvasUuid,
          width: 816,
        });
      }
    } catch {
    } finally {
      this.isSaving = false;
    }
  }

  private openWatermarkModal(): void {
    const wm = this.project.settings.watermark || { enabled: false, text: 'CONFIDENCIAL', type: 'text' };
    openModal({
      bodyHtml: `
        <div class="settings-group">
          <div class="settings-item">
            <div class="settings-item__content">
              <div class="settings-item__text">
                <h3 class="settings-item__title">Activar marca de agua</h3>
                <p class="settings-item__desc">Muestra un texto o sello gráfico tenue en el fondo de cada página.</p>
              </div>
            </div>
            <div class="settings-item__actions">
              <input class="field__input" data-ref="modal-wm-enabled" type="checkbox" ${wm.enabled ? 'checked' : ''} style="width: 20px; height: 20px; accent-color: #3b82f6;" />
            </div>
          </div>
        </div>

        <div class="settings-group">
          <div class="settings-item">
            <div class="settings-item__content">
              <div class="settings-item__text">
                <h3 class="settings-item__title">Texto de la marca de agua</h3>
                <p class="settings-item__desc">Elige un texto predeterminado o escribe uno personalizado.</p>
              </div>
            </div>
            <div class="settings-item__actions" style="display: flex; flex-direction: column; gap: 8px;">
              <input class="design-options-text-input" data-ref="modal-wm-text" type="text" value="${wm.text || 'CONFIDENCIAL'}" placeholder="Ej. CONFIDENCIAL, BORRADOR..." style="width: 100%;" />
              <div style="display: flex; gap: 6px; flex-wrap: wrap;">
                <button type="button" class="component-button component-button--h28 component-button--secondary" data-ref="btn-wm-preset-confidential">CONFIDENCIAL</button>
                <button type="button" class="component-button component-button--h28 component-button--secondary" data-ref="btn-wm-preset-draft">BORRADOR</button>
                <button type="button" class="component-button component-button--h28 component-button--secondary" data-ref="btn-wm-preset-copy">COPIA</button>
                <button type="button" class="component-button component-button--h28 component-button--secondary" data-ref="btn-wm-preset-urgent">URGENTE</button>
              </div>
            </div>
          </div>
        </div>
      `,
      confirmText: 'Guardar marca de agua',
      onConfirm: () => {
        const modalEl = document.querySelector('.modal-card');
        if (!modalEl) return;
        const chkEnabled = modalEl.querySelector<HTMLInputElement>('[data-ref="modal-wm-enabled"]');
        const txtWatermark = modalEl.querySelector<HTMLInputElement>('[data-ref="modal-wm-text"]');

        this.project.settings.watermark = {
          enabled: Boolean(chkEnabled?.checked),
          text: txtWatermark?.value.trim().toUpperCase() || 'CONFIDENCIAL',
          type: 'text',
        };

        this.renderDocument();
        this.recordChange();
        showToast('Marca de agua actualizada', 'success');
      },
      title: 'Marca de Agua del Documento',
    });

    setTimeout(() => {
      const modalEl = document.querySelector('.modal-card');
      if (!modalEl) return;
      const txt = modalEl.querySelector<HTMLInputElement>('[data-ref="modal-wm-text"]');
      modalEl.querySelectorAll<HTMLElement>('[data-ref^="btn-wm-preset-"]').forEach((btn) => {
        btn.addEventListener('click', () => {
          if (txt) txt.value = btn.textContent?.trim() || '';
        });
      });
    }, 100);
  }

  private openPageDesignModal(): void {
    const curTheme = this.project.settings.pageColor || 'white';
    const curBorder = this.project.settings.pageBorder || 'none';
    const curCols = this.project.settings.columnsCount || 1;

    openModal({
      bodyHtml: `
        <div class="settings-group">
          <div class="settings-item">
            <div class="settings-item__content">
              <div class="settings-item__text">
                <h3 class="settings-item__title">Tono de papel</h3>
                <p class="settings-item__desc">Color de fondo estético para lectura y edición.</p>
              </div>
            </div>
            <div class="settings-item__actions">
              <select class="settings-dropdown-wrapper" data-ref="modal-select-theme" style="padding: 8px 12px; border-radius: 6px; border: 1px solid #cbd5e1; background: transparent; color: inherit;">
                <option value="white" ${curTheme === 'white' ? 'selected' : ''}>Blanco puro</option>
                <option value="cream" ${curTheme === 'cream' ? 'selected' : ''}>Marfil / Crema suave</option>
                <option value="sepia" ${curTheme === 'sepia' ? 'selected' : ''}>Sepia cálido</option>
                <option value="editorial" ${curTheme === 'editorial' ? 'selected' : ''}>Gris editorial (#f8fafc)</option>
              </select>
            </div>
          </div>
        </div>

        <div class="settings-group">
          <div class="settings-item">
            <div class="settings-item__content">
              <div class="settings-item__text">
                <h3 class="settings-item__title">Borde de página</h3>
                <p class="settings-item__desc">Enmarcado perimetral del documento.</p>
              </div>
            </div>
            <div class="settings-item__actions">
              <select class="settings-dropdown-wrapper" data-ref="modal-select-border" style="padding: 8px 12px; border-radius: 6px; border: 1px solid #cbd5e1; background: transparent; color: inherit;">
                <option value="none" ${curBorder === 'none' ? 'selected' : ''}>Sin borde</option>
                <option value="thin" ${curBorder === 'thin' ? 'selected' : ''}>Borde fino (1.5px)</option>
                <option value="double" ${curBorder === 'double' ? 'selected' : ''}>Borde doble clásico</option>
                <option value="dashed" ${curBorder === 'dashed' ? 'selected' : ''}>Borde punteado</option>
              </select>
            </div>
          </div>
        </div>

        <div class="settings-group">
          <div class="settings-item">
            <div class="settings-item__content">
              <div class="settings-item__text">
                <h3 class="settings-item__title">Distribución en columnas</h3>
                <p class="settings-item__desc">Divide el flujo del texto tipo periódico o boletín.</p>
              </div>
            </div>
            <div class="settings-item__actions" style="display: flex; gap: 8px;">
              <button type="button" class="component-button component-button--h32 ${curCols === 1 ? 'component-button--black' : 'component-button--secondary'}" data-ref="modal-btn-col-1">1 Columna</button>
              <button type="button" class="component-button component-button--h32 ${curCols === 2 ? 'component-button--black' : 'component-button--secondary'}" data-ref="modal-btn-col-2">2 Columnas</button>
              <button type="button" class="component-button component-button--h32 ${curCols === 3 ? 'component-button--black' : 'component-button--secondary'}" data-ref="modal-btn-col-3">3 Columnas</button>
            </div>
          </div>
        </div>
      `,
      confirmText: 'Aplicar diseño',
      onConfirm: () => {
        const modalEl = document.querySelector('.modal-card');
        if (!modalEl) return;
        const selTheme = modalEl.querySelector<HTMLSelectElement>('[data-ref="modal-select-theme"]');
        const selBorder = modalEl.querySelector<HTMLSelectElement>('[data-ref="modal-select-border"]');
        let cols: DocColumnsCount = 1;
        if (modalEl.querySelector('[data-ref="modal-btn-col-2"]')?.classList.contains('component-button--black')) cols = 2;
        if (modalEl.querySelector('[data-ref="modal-btn-col-3"]')?.classList.contains('component-button--black')) cols = 3;

        if (selTheme) this.project.settings.pageColor = selTheme.value as DocPageColor;
        if (selBorder) this.project.settings.pageBorder = selBorder.value as DocPageBorder;
        this.project.settings.columnsCount = cols;

        this.renderDocument();
        this.recordChange();
        showToast('Diseño de hoja actualizado', 'success');
      },
      title: 'Diseño y Formato de Hoja',
    });

    setTimeout(() => {
      const modalEl = document.querySelector('.modal-card');
      if (!modalEl) return;
      const b1 = modalEl.querySelector<HTMLElement>('[data-ref="modal-btn-col-1"]');
      const b2 = modalEl.querySelector<HTMLElement>('[data-ref="modal-btn-col-2"]');
      const b3 = modalEl.querySelector<HTMLElement>('[data-ref="modal-btn-col-3"]');

      const setCols = (active: number) => {
        b1?.setAttribute('class', `component-button component-button--h32 ${active === 1 ? 'component-button--black' : 'component-button--secondary'}`);
        b2?.setAttribute('class', `component-button component-button--h32 ${active === 2 ? 'component-button--black' : 'component-button--secondary'}`);
        b3?.setAttribute('class', `component-button component-button--h32 ${active === 3 ? 'component-button--black' : 'component-button--secondary'}`);
      };

      b1?.addEventListener('click', () => setCols(1));
      b2?.addEventListener('click', () => setCols(2));
      b3?.addEventListener('click', () => setCols(3));
    }, 100);
  }

  private openSymbolsModal(): void {
    const symbolsHtml = SPECIAL_SYMBOLS.map((s) => `
      <button type="button" class="component-button component-button--h40 component-button--secondary" data-symbol="${s}" style="font-size: 16px; font-weight: 700;">${s}</button>
    `).join('');

    openModal({
      bodyHtml: `
        <p style="margin-top: 0; color: #64748b; font-size: 10pt;">Haz clic en cualquier carácter o símbolo para insertarlo en la posición actual del cursor:</p>
        <div style="display: grid; grid-template-columns: repeat(8, 1fr); gap: 8px; margin: 16px 0;">
          ${symbolsHtml}
        </div>
      `,
      confirmText: 'Cerrar',
      title: 'Símbolos y Caracteres Especiales',
    });

    setTimeout(() => {
      const modalEl = document.querySelector('.modal-card');
      if (!modalEl) return;
      modalEl.querySelectorAll<HTMLElement>('[data-symbol]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const sym = btn.getAttribute('data-symbol');
          if (sym) {
            document.execCommand('insertText', false, sym);
            this.recordChange();
            showToast(`Símbolo ${sym} insertado`, 'success');
          }
        });
      });
    }, 100);
  }

  private openLogoModal(): void {
    const fileInputLogo = this.container.querySelector<HTMLInputElement>('[data-ref="input-file-logo"]');
    if (!fileInputLogo) return;

    openModal({
      bodyHtml: `
        <div class="settings-group">
          <div class="settings-item">
            <div class="settings-item__content">
              <div class="settings-item__text">
                <h3 class="settings-item__title">Logo del encabezado</h3>
                <p class="settings-item__desc">Sube la insignia o logo corporativo que se reflejará en todas las páginas.</p>
              </div>
            </div>
            <div class="settings-item__actions" style="display: flex; gap: 8px;">
              <button type="button" class="component-button component-button--h32 component-button--black" data-ref="btn-modal-upload-logo">Seleccionar imagen</button>
              ${this.project.settings.headerLogoUrl ? `<button type="button" class="component-button component-button--h32 component-button--danger" data-ref="btn-modal-remove-logo">Quitar logo</button>` : ''}
            </div>
          </div>
        </div>

        <div class="settings-group">
          <div class="settings-item">
            <div class="settings-item__content">
              <div class="settings-item__text">
                <h3 class="settings-item__title">Posición del logo</h3>
                <p class="settings-item__desc">Alineación del logo en el encabezado.</p>
              </div>
            </div>
            <div class="settings-item__actions" style="display: flex; gap: 8px;">
              <button type="button" class="component-button component-button--h32 ${this.project.settings.headerLogoPosition !== 'right' ? 'component-button--black' : 'component-button--secondary'}" data-ref="modal-btn-logo-left">Izquierda</button>
              <button type="button" class="component-button component-button--h32 ${this.project.settings.headerLogoPosition === 'right' ? 'component-button--black' : 'component-button--secondary'}" data-ref="modal-btn-logo-right">Derecha</button>
            </div>
          </div>
        </div>
      `,
      confirmText: 'Aceptar',
      title: 'Logo del Encabezado',
    });

    setTimeout(() => {
      const modalEl = document.querySelector('.modal-card');
      if (!modalEl) return;

      const btnUpload = modalEl.querySelector<HTMLElement>('[data-ref="btn-modal-upload-logo"]');
      const btnRemove = modalEl.querySelector<HTMLElement>('[data-ref="btn-modal-remove-logo"]');
      const btnLeft = modalEl.querySelector<HTMLElement>('[data-ref="modal-btn-logo-left"]');
      const btnRight = modalEl.querySelector<HTMLElement>('[data-ref="modal-btn-logo-right"]');

      btnUpload?.addEventListener('click', () => {
        fileInputLogo.onchange = () => {
          const file = fileInputLogo.files?.[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = (e) => {
            const dataUrl = e.target?.result as string;
            if (dataUrl) {
              this.project.settings.headerLogoUrl = dataUrl;
              this.renderDocument();
              this.recordChange();
              showToast('Logo de encabezado actualizado', 'success');
            }
          };
          reader.readAsDataURL(file);
          fileInputLogo.value = '';
        };
        fileInputLogo.click();
      });

      btnRemove?.addEventListener('click', () => {
        this.project.settings.headerLogoUrl = undefined;
        this.renderDocument();
        this.recordChange();
        showToast('Logo removido', 'success');
      });

      btnLeft?.addEventListener('click', () => {
        this.project.settings.headerLogoPosition = 'left';
        btnLeft.className = 'component-button component-button--h32 component-button--black';
        if (btnRight) btnRight.className = 'component-button component-button--h32 component-button--secondary';
        this.renderDocument();
        this.recordChange();
      });

      btnRight?.addEventListener('click', () => {
        this.project.settings.headerLogoPosition = 'right';
        btnRight.className = 'component-button component-button--h32 component-button--black';
        if (btnLeft) btnLeft.className = 'component-button component-button--h32 component-button--secondary';
        this.renderDocument();
        this.recordChange();
      });
    }, 100);
  }

  private openPageSetupModal(): void {
    openModal({
      bodyHtml: `
        <div class="settings-group">
          <div class="settings-item">
            <div class="settings-item__content">
              <div class="settings-item__text">
                <h3 class="settings-item__title">Tamaño de papel</h3>
                <p class="settings-item__desc">Dimensiones físicas normalizadas para impresión y vista.</p>
              </div>
            </div>
            <div class="settings-item__actions">
              <select class="settings-dropdown-wrapper" data-ref="modal-select-paper" style="padding: 8px 12px; border-radius: 6px; border: 1px solid #cbd5e1; background: transparent; color: inherit;">
                <option value="digital" ${this.project.settings.paperSize === 'digital' ? 'selected' : ''}>Digital (Tamaño automático)</option>
                <option value="a4" ${this.project.settings.paperSize === 'a4' ? 'selected' : ''}>A4 (21 × 29.7 cm)</option>
                <option value="a3" ${this.project.settings.paperSize === 'a3' ? 'selected' : ''}>A3 (29.7 × 42 cm)</option>
                <option value="letter" ${this.project.settings.paperSize === 'letter' ? 'selected' : ''}>Carta (8.5 × 11 in)</option>
                <option value="legal" ${this.project.settings.paperSize === 'legal' ? 'selected' : ''}>Oficio (8.5 × 14 in)</option>
              </select>
            </div>
          </div>
        </div>

        <div class="settings-group">
          <div class="settings-item">
            <div class="settings-item__content">
              <div class="settings-item__text">
                <h3 class="settings-item__title">Orientación</h3>
                <p class="settings-item__desc">Disposición vertical u horizontal de las páginas.</p>
              </div>
            </div>
            <div class="settings-item__actions" style="display: flex; gap: 8px;">
              <button type="button" class="component-button component-button--h32 ${this.project.settings.orientation === 'portrait' ? 'component-button--black' : 'component-button--secondary'}" data-ref="modal-btn-portrait">Vertical</button>
              <button type="button" class="component-button component-button--h32 ${this.project.settings.orientation === 'landscape' ? 'component-button--black' : 'component-button--secondary'}" data-ref="modal-btn-landscape">Horizontal</button>
            </div>
          </div>
        </div>

        <div class="settings-group">
          <div class="settings-item">
            <div class="settings-item__content">
              <div class="settings-item__text">
                <h3 class="settings-item__title">Márgenes</h3>
                <p class="settings-item__desc">Espaciado perimetral del contenido.</p>
              </div>
            </div>
            <div class="settings-item__actions">
              <select class="settings-dropdown-wrapper" data-ref="modal-select-margins" style="padding: 8px 12px; border-radius: 6px; border: 1px solid #cbd5e1; background: transparent; color: inherit;">
                <option value="normal" ${this.project.settings.margins.top === 96 && this.project.settings.margins.left === 96 ? 'selected' : ''}>Normal (2.54 cm / 1 pulgada)</option>
                <option value="narrow" ${this.project.settings.margins.top === 48 ? 'selected' : ''}>Estrecho (1.27 cm / 0.5 pulgada)</option>
                <option value="wide" ${this.project.settings.margins.left === 192 ? 'selected' : ''}>Ancho (5.08 cm / 2 pulgadas)</option>
              </select>
            </div>
          </div>
        </div>

        <div class="settings-group">
          <div class="settings-item">
            <div class="settings-item__content">
              <div class="settings-item__text">
                <h3 class="settings-item__title">Primera página diferente</h3>
                <p class="settings-item__desc">Oculta encabezado y pie de página en la portada o primera hoja.</p>
              </div>
            </div>
            <div class="settings-item__actions">
              <input class="field__input" data-ref="modal-first-page-diff" type="checkbox" ${this.project.settings.firstPageDifferent ? 'checked' : ''} style="width: 20px; height: 20px; accent-color: #3b82f6;" />
            </div>
          </div>
        </div>
      `,
      confirmText: 'Aplicar cambios',
      onConfirm: () => {
        const modalEl = document.querySelector('.modal-card');
        if (!modalEl) return;
        const selPaper = modalEl.querySelector<HTMLSelectElement>('[data-ref="modal-select-paper"]');
        const selMargins = modalEl.querySelector<HTMLSelectElement>('[data-ref="modal-select-margins"]');
        const chkDiff = modalEl.querySelector<HTMLInputElement>('[data-ref="modal-first-page-diff"]');
        const isLandscape = modalEl.querySelector('[data-ref="modal-btn-landscape"]')?.classList.contains('component-button--black');

        if (selPaper) {
          this.project.settings.paperSize = selPaper.value as DocPaperSize;
        }
        this.project.settings.orientation = isLandscape ? 'landscape' : 'portrait';
        this.project.settings.firstPageDifferent = Boolean(chkDiff?.checked);

        if (selMargins) {
          const mKey = selMargins.value;
          this.project.settings.margins = DOC_MARGIN_PRESETS[mKey]?.margins || DOC_MARGIN_PRESETS.normal.margins;
        }

        this.renderDocument();
        this.recordChange();
        showToast('Configuración de página actualizada', 'success');
      },
      title: 'Configuración de Página',
    });

    setTimeout(() => {
      const modalEl = document.querySelector('.modal-card');
      if (!modalEl) return;
      const btnP = modalEl.querySelector<HTMLElement>('[data-ref="modal-btn-portrait"]');
      const btnL = modalEl.querySelector<HTMLElement>('[data-ref="modal-btn-landscape"]');
      if (btnP && btnL) {
        btnP.addEventListener('click', () => {
          btnP.className = 'component-button component-button--h32 component-button--black';
          btnL.className = 'component-button component-button--h32 component-button--secondary';
        });
        btnL.addEventListener('click', () => {
          btnL.className = 'component-button component-button--h32 component-button--black';
          btnP.className = 'component-button component-button--h32 component-button--secondary';
        });
      }
    }, 100);
  }

  private openStatsModal(): void {
    const stats = this.paginationManager.calculateStats(this.project);
    openModal({
      bodyHtml: `
        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; margin: 10px 0;">
          <div style="background: var(--color-bg-secondary, #f8fafc); padding: 16px; border-radius: 8px; text-align: center;">
            <div style="font-size: 24pt; font-weight: 800; color: #3b82f6;">${stats.words.toLocaleString()}</div>
            <div style="font-size: 10pt; color: #64748b;">Palabras</div>
          </div>
          <div style="background: var(--color-bg-secondary, #f8fafc); padding: 16px; border-radius: 8px; text-align: center;">
            <div style="font-size: 24pt; font-weight: 800; color: #10b981;">${stats.pages}</div>
            <div style="font-size: 10pt; color: #64748b;">Páginas</div>
          </div>
          <div style="background: var(--color-bg-secondary, #f8fafc); padding: 16px; border-radius: 8px; text-align: center;">
            <div style="font-size: 24pt; font-weight: 800; color: #6366f1;">${stats.characters.toLocaleString()}</div>
            <div style="font-size: 10pt; color: #64748b;">Caracteres (con espacios)</div>
          </div>
          <div style="background: var(--color-bg-secondary, #f8fafc); padding: 16px; border-radius: 8px; text-align: center;">
            <div style="font-size: 24pt; font-weight: 800; color: #f59e0b;">${stats.readingTimeMinutes} min</div>
            <div style="font-size: 10pt; color: #64748b;">Tiempo estimado de lectura</div>
          </div>
        </div>
      `,
      confirmText: 'Aceptar',
      title: 'Estadísticas del Documento',
    });
  }
}

