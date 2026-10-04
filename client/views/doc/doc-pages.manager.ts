import { CanvasPageViewMode } from '../../components/canvas-file-menu.component.js';
import { CanvasGridViewModalController, openCanvasGridView } from '../../components/canvas-grid-view.component.js';
import { showConfirmModal } from '../../components/modal.component.js';
import { escapeHtml } from '../../services/api.service.js';
import { renderIcons } from '../../services/icon.service.js';
import { showToast } from '../../services/toast.service.js';
import { validateAndSanitizeFile } from '../../utils/validators.util.js';
import { DocPaginationManager } from './doc-pagination.manager.js';
import { DOC_PAPER_DIMENSIONS, DocMargins, DocPage, DocProject } from './doc.types.js';

export interface DocPagesOptions {
  container: HTMLElement;
  getActiveInspiringQuote: () => string;
  getFileMenuController: () => { setPageViewMode: (mode: CanvasPageViewMode) => void } | null;
  initExistingImages: () => void;
  insertImageElement: (src: string) => void;
  isDocumentEmpty: () => boolean;
  onBroadcastDocUpdate: () => void;
  onPushHistoryState: () => void;
  onRecordChange: () => void;
  onScheduleAutosave: () => void;
  onUpdateStats: () => void;
  onUpdateUndoRedoButtonsState: () => void;
  paginationManager: DocPaginationManager;
  project: DocProject;
  signal: AbortSignal;
}

export interface DocPagesController {
  addNewDocPage: (afterIndex?: number) => void;
  applySinglePageView: () => void;
  deleteDocPages: (indices: number[]) => void;
  destroy: () => void;
  duplicateDocPages: (indices: number[]) => void;
  getActiveDocPageIndex: () => number;
  getLastActivePageId: () => string | null;
  getPageViewMode: () => CanvasPageViewMode;
  hideDocPagesTray: () => void;
  initDocPagesTray: () => void;
  initDocPageViewMode: () => void;
  openDocGridView: () => void;
  refreshGridView: () => void;
  renderDocument: () => void;
  scrollToPage: (pageIndex: number) => void;
  setActiveDocPageIndex: (idx: number) => void;
  setLastActivePageId: (id: string | null) => void;
  setPageViewMode: (mode: CanvasPageViewMode) => void;
  syncPagesFromDOM: () => void;
  syncSinglePageFromDOM: (pageId: string, contentEl: HTMLElement) => void;
  toggleDocPagesTray: () => void;
  updateDocThumbnailsTray: () => void;
  updateEmptyPlaceholder: () => void;
}

export function setupDocPagesManager(options: DocPagesOptions): DocPagesController {
  const {
    container,
    project,
    paginationManager,
    signal,
    getActiveInspiringQuote,
    isDocumentEmpty,
    onRecordChange,
    onScheduleAutosave,
    onUpdateStats,
    onUpdateUndoRedoButtonsState,
    onBroadcastDocUpdate,
    onPushHistoryState,
    insertImageElement,
    initExistingImages,
    getFileMenuController,
  } = options;

  let activeDocPageIndex = 0;
  let lastActivePageId: string | null = null;
  let lastWheelSwitchTime = 0;
  let pageViewMode: CanvasPageViewMode = 'scroll';
  let docPagesTrayEl: HTMLElement | null = null;
  let gridViewModal: CanvasGridViewModalController | null = null;
  let statsDebounceTimer: number | null = null;
  let typingDebounceTimer: number | null = null;

  const updateEmptyPlaceholder = (): void => {
    const placeholderEl = container.querySelector<HTMLElement>('[data-ref="doc-empty-placeholder"]');
    if (!placeholderEl) return;
    const empty = isDocumentEmpty();
    placeholderEl.style.display = empty ? 'block' : 'none';
  };

  const syncSinglePageFromDOM = (pageId: string, contentEl: HTMLElement): void => {
    const targetPage = project.pages.find((p) => p.id === pageId);
    if (!targetPage) return;
    const clone = contentEl.cloneNode(true) as HTMLElement;
    clone.querySelectorAll('.doc-image-handle').forEach((h) => h.remove());
    clone.querySelectorAll('.doc-image-wrapper').forEach((w) => w.classList.remove('is-selected'));
    targetPage.contentHtml = clone.innerHTML;
  };

  const syncPagesFromDOM = (): void => {
    project.pages.forEach((page) => {
      const contentEl = container.querySelector<HTMLElement>(`[data-ref="page-content-${page.id}"]`);
      if (contentEl) {
        const clone = contentEl.cloneNode(true) as HTMLElement;
        clone.querySelectorAll('.doc-image-handle').forEach((h) => h.remove());
        clone.querySelectorAll('.doc-image-wrapper').forEach((w) => w.classList.remove('is-selected'));
        page.contentHtml = clone.innerHTML;
      }
    });
  };

  const handlePageInput = (contentEl: HTMLElement): void => {
    const pageEl = contentEl.closest('[data-page-id]');
    const pageId = pageEl?.getAttribute('data-page-id');
    if (pageId) {
      lastActivePageId = pageId;
      syncSinglePageFromDOM(pageId, contentEl);
    }
    updateEmptyPlaceholder();

    if (statsDebounceTimer) {
      clearTimeout(statsDebounceTimer);
    }
    statsDebounceTimer = window.setTimeout(() => {
      onUpdateStats();
    }, 250);

    if (typingDebounceTimer) {
      clearTimeout(typingDebounceTimer);
    }
    typingDebounceTimer = window.setTimeout(() => {
      onPushHistoryState();
      onUpdateUndoRedoButtonsState();
      onBroadcastDocUpdate();
    }, 400);

    onScheduleAutosave();
  };

  const bindPageEvents = (): void => {
    container.querySelectorAll<HTMLElement>('.doc-page__content').forEach((contentEl) => {
      contentEl.addEventListener('focus', () => {
        const pageEl = contentEl.closest('[data-page-id]');
        if (pageEl) {
          lastActivePageId = pageEl.getAttribute('data-page-id');
        }
      }, { signal });

      contentEl.addEventListener('click', () => {
        const pageEl = contentEl.closest('[data-page-id]');
        if (pageEl) {
          lastActivePageId = pageEl.getAttribute('data-page-id');
        }
      }, { signal });

      contentEl.addEventListener('input', () => {
        handlePageInput(contentEl);
      }, { signal });

      contentEl.addEventListener('keyup', () => {
        updateEmptyPlaceholder();
      }, { signal });

      contentEl.addEventListener('paste', (e) => {
        const items = e.clipboardData?.items;
        if (items) {
          for (let i = 0; i < items.length; i++) {
            if (items[i].type.startsWith('image/')) {
              e.preventDefault();
              const blob = items[i].getAsFile();
              if (blob) {
                const validation = validateAndSanitizeFile(blob, { maxMb: 10 });
                if (!validation.valid || !validation.file) {
                  showToast(validation.error || 'Archivo de imagen no válido.', 'error');
                  return;
                }
                const reader = new FileReader();
                reader.onload = (ev) => {
                  const dataUrl = ev.target?.result as string;
                  if (dataUrl) insertImageElement(dataUrl);
                };
                reader.readAsDataURL(validation.file);
              }
              return;
            }
          }
        }
        e.preventDefault();
        const text = e.clipboardData?.getData('text/plain') || '';
        document.execCommand('insertText', false, text);
        updateEmptyPlaceholder();
        onRecordChange();
      }, { signal });
    });

    container.querySelectorAll<HTMLElement>('.doc-page__action-btn[data-action="move-up"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const pageId = btn.getAttribute('data-page-id');
        if (!pageId) return;
        const idx = project.pages.findIndex((p) => p.id === pageId);
        if (idx > 0) {
          const temp = project.pages[idx];
          project.pages[idx] = project.pages[idx - 1];
          project.pages[idx - 1] = temp;
          renderDocument();
          onRecordChange();
        }
      }, { signal });
    });

    container.querySelectorAll<HTMLElement>('.doc-page__action-btn[data-action="move-down"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const pageId = btn.getAttribute('data-page-id');
        if (!pageId) return;
        const idx = project.pages.findIndex((p) => p.id === pageId);
        if (idx >= 0 && idx < project.pages.length - 1) {
          const temp = project.pages[idx];
          project.pages[idx] = project.pages[idx + 1];
          project.pages[idx + 1] = temp;
          renderDocument();
          onRecordChange();
        }
      }, { signal });
    });

    container.querySelectorAll<HTMLElement>('[data-ref^="btn-delete-page-"]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const pageId = btn.getAttribute('data-page-id');
        if (pageId && project.pages.length > 1) {
          const confirmed = await showConfirmModal({
            confirmClass: 'component-button--danger',
            title: '¿Deseas eliminar esta página del documento?',
          });
          if (confirmed) {
            paginationManager.deletePage(project, pageId);
            renderDocument();
            onRecordChange();
          }
        }
      }, { signal });
    });
  };

  const renderDocument = (): void => {
    const pagesContainer = container.querySelector<HTMLElement>('[data-ref="doc-pages-container"]');
    if (!pagesContainer) return;

    pagesContainer.innerHTML = '';

    const paperSizeKey = project.settings.paperSize || 'letter';
    const orientationKey = project.settings.orientation || 'portrait';
    const paper = (DOC_PAPER_DIMENSIONS[paperSizeKey] && DOC_PAPER_DIMENSIONS[paperSizeKey][orientationKey])
      ? DOC_PAPER_DIMENSIONS[paperSizeKey][orientationKey]
      : DOC_PAPER_DIMENSIONS.letter.portrait;

    const rawMargins = project.settings.margins;
    const margins: DocMargins = {
      bottom: (rawMargins && typeof rawMargins.bottom === 'number' && rawMargins.bottom >= 24) ? rawMargins.bottom : 96,
      left: (rawMargins && typeof rawMargins.left === 'number' && rawMargins.left >= 24) ? rawMargins.left : 96,
      right: (rawMargins && typeof rawMargins.right === 'number' && rawMargins.right >= 24) ? rawMargins.right : 96,
      top: (rawMargins && typeof rawMargins.top === 'number' && rawMargins.top >= 24) ? rawMargins.top : 96,
    };
    project.settings.margins = margins;
    const zoom = (typeof project.settings.zoom === 'number' && project.settings.zoom > 0) ? project.settings.zoom : 1;

    pagesContainer.style.setProperty('--doc-paper-width', `${paper.widthPx > 0 ? paper.widthPx : 816}px`);
    pagesContainer.style.setProperty('--doc-paper-height', paper.heightPx > 0 ? `${paper.heightPx}px` : 'auto');
    pagesContainer.style.setProperty('--doc-margin-top', `${margins.top}px`);
    pagesContainer.style.setProperty('--doc-margin-bottom', `${margins.bottom}px`);
    pagesContainer.style.setProperty('--doc-margin-left', `${margins.left}px`);
    pagesContainer.style.setProperty('--doc-margin-right', `${margins.right}px`);
    pagesContainer.style.setProperty('--doc-zoom', `${zoom}`);

    const currentPaperLabel = container.querySelector<HTMLElement>('[data-ref="lbl-current-paper"]');
    if (currentPaperLabel) {
      const sizeName = project.settings.paperSize === 'digital'
        ? 'Digital'
        : (project.settings.paperSize === 'a4'
          ? 'A4'
          : (project.settings.paperSize === 'a3'
            ? 'A3'
            : (project.settings.paperSize === 'legal'
              ? 'Oficio'
              : (project.settings.paperSize === 'a5'
                ? 'A5'
                : (project.settings.paperSize === 'tabloid'
                  ? 'Tabloide'
                  : 'Carta')))));
      const orientName = project.settings.orientation === 'landscape' ? 'Horizontal' : 'Vertical';
      currentPaperLabel.textContent = project.settings.paperSize === 'digital' ? 'Digital (Automático)' : `${sizeName} • ${orientName}`;
    }

    const currentFontLabel = container.querySelector<HTMLElement>('[data-ref="lbl-current-font"]');
    if (currentFontLabel) {
      const font = project.settings.fontFamily.split(',')[0].replace(/['"]/g, '').trim();
      currentFontLabel.textContent = font;
    }

    const fontSizeBadge = container.querySelector<HTMLElement>('[data-ref="lbl-font-size"]');
    if (fontSizeBadge) {
      fontSizeBadge.textContent = `${project.settings.fontSize || 11}pt`;
    }

    const pageThemeClass = `doc-page--theme-${project.settings.pageColor || 'white'}`;
    const pageBorderClass = project.settings.pageBorder && project.settings.pageBorder !== 'none'
      ? `doc-page--border-${project.settings.pageBorder}`
      : '';
    const columnsClass = project.settings.columnsCount === 2
      ? 'doc-page--cols-2'
      : (project.settings.columnsCount === 3 ? 'doc-page--cols-3' : '');

    project.pages.forEach((page, index) => {
      const pageEl = document.createElement('div');
      pageEl.className = `doc-page ${pageThemeClass} ${pageBorderClass}`.trim();
      pageEl.setAttribute('data-ref', `doc-page-${page.id}`);
      pageEl.setAttribute('data-page-id', page.id);
      pageEl.setAttribute('data-page-index', String(index + 1));
      pageEl.style.paddingTop = `${margins.top}px`;
      pageEl.style.paddingRight = `${margins.right}px`;
      pageEl.style.paddingBottom = `${margins.bottom}px`;
      pageEl.style.paddingLeft = `${margins.left}px`;

      const pageWidth = paper.widthPx > 0 ? paper.widthPx : 816;
      const minPageHeight = paper.heightPx > 0 ? paper.heightPx : 1056;

      pageEl.style.width = `${pageWidth}px`;
      pageEl.style.minHeight = `${minPageHeight}px`;

      const isFirstPage = index === 0;

      let watermarkEl = '';
      if (project.settings.watermark?.enabled) {
        if (project.settings.watermark.type === 'image' && project.settings.watermark.imageUrl) {
          watermarkEl = `<div class="doc-page__watermark"><img src="${project.settings.watermark.imageUrl}" alt="Marca de agua" /></div>`;
        } else {
          watermarkEl = `<div class="doc-page__watermark"><span>${project.settings.watermark.text || 'CONFIDENCIAL'}</span></div>`;
        }
      }

      const letterSpacingStyle = project.settings.letterSpacing ? `letter-spacing: ${project.settings.letterSpacing}px;` : '';
      const emptyDoc = isDocumentEmpty();

      pageEl.innerHTML = `
        ${watermarkEl}
        ${isFirstPage ? `<div class="doc-empty-placeholder" data-ref="doc-empty-placeholder" style="top: ${margins.top}px; left: ${margins.left}px; right: ${margins.right}px; display: ${emptyDoc ? 'block' : 'none'};">${escapeHtml(getActiveInspiringQuote())}</div>` : ''}
        <div class="doc-page__content ${columnsClass}" data-ref="page-content-${page.id}" contenteditable="true" spellcheck="true" style="font-family: ${project.settings.fontFamily}; font-size: ${project.settings.fontSize}pt; line-height: ${project.settings.lineHeight}; ${letterSpacingStyle}">${page.contentHtml || '<p><br></p>'}</div>
        <div class="doc-page__badge">Página ${index + 1}</div>
        ${project.pages.length > 1 ? `<button type="button" class="doc-page__delete-btn" data-ref="btn-delete-page-${page.id}" data-page-id="${page.id}" data-tooltip="Eliminar página" aria-label="Eliminar página"><span class="component-icon">delete</span></button>` : ''}
      `;

      pagesContainer.appendChild(pageEl);
    });

    const addPageWrapper = document.createElement('div');
    addPageWrapper.className = 'doc-add-page-wrapper';
    addPageWrapper.setAttribute('data-ref', 'doc-add-page-wrapper');
    addPageWrapper.style.width = '100%';
    addPageWrapper.style.maxWidth = `${paper.widthPx > 0 ? paper.widthPx : 816}px`;
    addPageWrapper.innerHTML = `
      <button type="button" class="component-button component-button--h44 component-button--secondary" data-ref="btn-doc-bottom-add-page" style="width: 100%; justify-content: center; gap: 8px; border-style: dashed; border-radius: 8px;">
        <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#add"></use></svg>
        <span>Agregar una página</span>
      </button>
    `;

    const btnBottomAdd = addPageWrapper.querySelector<HTMLButtonElement>('[data-ref="btn-doc-bottom-add-page"]');
    btnBottomAdd?.addEventListener('click', (e) => {
      e.stopPropagation();
      addNewDocPage();
    });

    pagesContainer.appendChild(addPageWrapper);

    bindPageEvents();
    initExistingImages();
    if (pageViewMode === 'single-page') {
      applySinglePageView();
    }
    updateDocThumbnailsTray();
    renderIcons(pagesContainer);
  };

  const applySinglePageView = (): void => {
    const viewport = container.querySelector<HTMLElement>('[data-ref="doc-viewport"]');
    if (pageViewMode === 'single-page') {
      viewport?.classList.add('is-single-page');
    }
    const pages = project.pages;
    if (activeDocPageIndex < 0) activeDocPageIndex = 0;
    if (activeDocPageIndex >= pages.length) activeDocPageIndex = pages.length - 1;

    const activePage = pages[activeDocPageIndex];
    container.querySelectorAll<HTMLElement>('.doc-page').forEach((pageEl) => {
      const pageId = pageEl.getAttribute('data-page-id');
      if (pageId === activePage?.id) {
        pageEl.classList.remove('is-page-hidden');
      } else {
        pageEl.classList.add('is-page-hidden');
      }
    });

    if (viewport) {
      viewport.scrollTop = 0;
    }
    updateDocThumbnailsTray();
    onUpdateStats();
  };

  const scrollToPage = (pageIndex: number): void => {
    if (pageIndex < 0 || pageIndex >= project.pages.length) return;
    activeDocPageIndex = pageIndex;
    if (pageViewMode === 'single-page') {
      applySinglePageView();
      return;
    }
    const page = project.pages[pageIndex];
    if (page) {
      const pageEl = container.querySelector<HTMLElement>(`[data-ref="doc-page-${page.id}"]`);
      pageEl?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    updateDocThumbnailsTray();
  };

  const setPageViewMode = (mode: CanvasPageViewMode): void => {
    pageViewMode = mode;
    getFileMenuController()?.setPageViewMode(mode);
    const viewport = container.querySelector<HTMLElement>('[data-ref="doc-viewport"]');

    if (mode === 'scroll') {
      viewport?.classList.remove('is-single-page');
      container.querySelectorAll<HTMLElement>('.doc-page').forEach((el) => {
        el.classList.remove('is-page-hidden');
      });
      hideDocPagesTray();
      scrollToPage(activeDocPageIndex);
    } else if (mode === 'single-page') {
      viewport?.classList.add('is-single-page');
      applySinglePageView();
      hideDocPagesTray();
    } else if (mode === 'thumbnails') {
      viewport?.classList.remove('is-single-page');
      container.querySelectorAll<HTMLElement>('.doc-page').forEach((el) => {
        el.classList.remove('is-page-hidden');
      });
      toggleDocPagesTray();
    } else if (mode === 'grid') {
      openDocGridView();
    }
  };

  const initDocPageViewMode = (): void => {
    const viewport = container.querySelector<HTMLElement>('[data-ref="doc-viewport"]');
    if (!viewport) return;

    viewport.addEventListener('wheel', (e: WheelEvent) => {
      if (pageViewMode !== 'single-page') return;
      if (Math.abs(e.deltaY) < 25) return;

      const now = Date.now();
      if (now - lastWheelSwitchTime < 350) return;

      if (e.deltaY > 0) {
        if (activeDocPageIndex < project.pages.length - 1) {
          lastWheelSwitchTime = now;
          activeDocPageIndex++;
          applySinglePageView();
        }
      } else {
        if (activeDocPageIndex > 0) {
          lastWheelSwitchTime = now;
          activeDocPageIndex--;
          applySinglePageView();
        }
      }
    }, { passive: true, signal });
  };

  const openDocGridView = (): void => {
    syncPagesFromDOM();
    const gridPages = project.pages.map((p, idx) => ({
      contentHtml: p.contentHtml,
      id: p.id,
      index: idx,
      name: `Página ${idx + 1}`,
    }));

    gridViewModal?.destroy();
    gridViewModal = openCanvasGridView({
      activePageIndex: activeDocPageIndex,
      canvasType: 'doc',
      containerEl: container.querySelector<HTMLElement>('.component-bottom') || container,
      onAddPage: () => {
        addNewDocPage();
        refreshGridView();
      },
      onClose: (selectedPageIndex) => {
        if (typeof selectedPageIndex === 'number') {
          scrollToPage(selectedPageIndex);
        }
      },
      onDeletePages: (indices) => {
        deleteDocPages(indices);
        refreshGridView();
      },
      onDuplicatePages: (indices) => {
        duplicateDocPages(indices);
        refreshGridView();
      },
      onSelectPage: (idx) => {
        activeDocPageIndex = idx;
      },
      pages: gridPages,
      signal,
    });
    gridViewModal.open();
  };

  const refreshGridView = (): void => {
    syncPagesFromDOM();
    const gridPages = project.pages.map((p, idx) => ({
      contentHtml: p.contentHtml,
      id: p.id,
      index: idx,
      name: `Página ${idx + 1}`,
    }));
    gridViewModal?.setPages(gridPages, activeDocPageIndex);
  };

  const addNewDocPage = (afterIndex?: number): void => {
    const targetIdx = afterIndex ?? activeDocPageIndex;
    const newPage = paginationManager.addPage(project, targetIdx);
    activeDocPageIndex = project.pages.findIndex((p) => p.id === newPage.id);
    renderDocument();
    onRecordChange();
    updateDocThumbnailsTray();
    if (pageViewMode === 'single-page') {
      applySinglePageView();
    }
    showToast('Página añadida', 'success');
    const newPageEl = container.querySelector<HTMLElement>(`[data-ref="doc-page-${newPage.id}"]`);
    newPageEl?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const duplicateDocPages = (indices: number[]): void => {
    const sorted = [...indices].sort((a, b) => b - a);
    for (const idx of sorted) {
      const original = project.pages[idx];
      if (original) {
        const copy: DocPage = {
          contentHtml: original.contentHtml,
          id: `page_${crypto.randomUUID().slice(0, 8)}`,
        };
        project.pages.splice(idx + 1, 0, copy);
      }
    }
    renderDocument();
    onRecordChange();
    updateDocThumbnailsTray();
    if (pageViewMode === 'single-page') {
      applySinglePageView();
    }
    showToast('Páginas duplicadas', 'success');
  };

  const deleteDocPages = (indices: number[]): void => {
    if (project.pages.length <= indices.length) {
      showToast('No puedes eliminar todas las páginas del documento', 'info');
      return;
    }
    const set = new Set(indices);
    project.pages = project.pages.filter((_, idx) => !set.has(idx));
    if (project.pages.length === 0) {
      paginationManager.addPage(project);
    }
    activeDocPageIndex = Math.min(activeDocPageIndex, project.pages.length - 1);
    renderDocument();
    onRecordChange();
    updateDocThumbnailsTray();
    if (pageViewMode === 'single-page') {
      applySinglePageView();
    }
    showToast('Páginas eliminadas', 'success');
  };

  const initDocPagesTray = (): void => {
    let tray = container.querySelector<HTMLElement>('[data-ref="doc-pages-tray"]');
    if (!tray) {
      tray = document.createElement('div');
      tray.className = 'doc-pages-tray is-hidden';
      tray.setAttribute('data-ref', 'doc-pages-tray');
      const viewportWrapper = container.querySelector<HTMLElement>('[data-ref="doc-viewport-wrapper"]') || container;
      viewportWrapper.appendChild(tray);
    }
    docPagesTrayEl = tray;
    updateDocThumbnailsTray();
  };

  const toggleDocPagesTray = (): void => {
    if (!docPagesTrayEl) {
      initDocPagesTray();
    }
    docPagesTrayEl?.classList.toggle('is-hidden');
    if (!docPagesTrayEl?.classList.contains('is-hidden')) {
      updateDocThumbnailsTray();
    }
  };

  const hideDocPagesTray = (): void => {
    docPagesTrayEl?.classList.add('is-hidden');
  };

  const updateDocThumbnailsTray = (): void => {
    if (!docPagesTrayEl) return;
    const pages = project.pages;

    docPagesTrayEl.innerHTML = `
      <div class="doc-pages-tray__cards" data-ref="doc-pages-tray-cards">
        ${pages.map((p, idx) => {
          const isActive = idx === activeDocPageIndex;
          const temp = document.createElement('div');
          temp.innerHTML = p.contentHtml || '';
          const previewText = (temp.textContent || temp.innerText || '').trim().slice(0, 100);
          return `
            <div class="doc-page-thumb-card${isActive ? ' is-active' : ''}" data-ref="doc-thumb-${p.id}" data-index="${idx}">
              <div class="doc-page-thumb-card__preview">
                ${escapeHtml(previewText || 'Página ' + (idx + 1))}
              </div>
              <span class="doc-page-thumb-card__badge">${idx + 1}</span>
            </div>
          `;
        }).join('')}
        <div class="doc-page-thumb-card doc-page-thumb-card--add" data-ref="doc-thumb-add" data-tooltip="Añadir página">
          <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#add"></use></svg>
        </div>
      </div>
    `;
    renderIcons(docPagesTrayEl);

    docPagesTrayEl.querySelectorAll<HTMLElement>('.doc-page-thumb-card:not(.doc-page-thumb-card--add)').forEach((card) => {
      const idxStr = card.getAttribute('data-index');
      if (idxStr !== null) {
        const idx = parseInt(idxStr, 10);
        card.addEventListener('click', () => {
          scrollToPage(idx);
        });
      }
    });

    const addCard = docPagesTrayEl.querySelector<HTMLElement>('[data-ref="doc-thumb-add"]');
    addCard?.addEventListener('click', () => {
      addNewDocPage();
    });
  };

  const destroy = (): void => {
    if (statsDebounceTimer) clearTimeout(statsDebounceTimer);
    if (typingDebounceTimer) clearTimeout(typingDebounceTimer);
    gridViewModal?.destroy();
    gridViewModal = null;
    docPagesTrayEl?.remove();
    docPagesTrayEl = null;
  };

  return {
    addNewDocPage,
    applySinglePageView,
    deleteDocPages,
    destroy,
    duplicateDocPages,
    getActiveDocPageIndex: () => activeDocPageIndex,
    getLastActivePageId: () => lastActivePageId,
    getPageViewMode: () => pageViewMode,
    hideDocPagesTray,
    initDocPagesTray,
    initDocPageViewMode,
    openDocGridView,
    refreshGridView,
    renderDocument,
    scrollToPage,
    setActiveDocPageIndex: (idx: number) => { activeDocPageIndex = idx; },
    setLastActivePageId: (id: string | null) => { lastActivePageId = id; },
    setPageViewMode,
    syncPagesFromDOM,
    syncSinglePageFromDOM,
    toggleDocPagesTray,
    updateDocThumbnailsTray,
    updateEmptyPlaceholder,
  };
}
