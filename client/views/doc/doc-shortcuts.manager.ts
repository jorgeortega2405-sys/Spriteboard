import { showToast } from '../../services/toast.service.js';
import { setupDropdown } from '../../utils/dom.util.js';
import { exportDocHtml, exportDocJson, exportDocMarkdown, exportDocPdf, exportDocTxt, exportDocWord } from './doc-export.service.js';
import { DocHistoryManager } from './doc-history.manager.js';
import { DocPaginationManager } from './doc-pagination.manager.js';
import { DOC_PAPER_DIMENSIONS, DocProject } from './doc.types.js';

export interface DocShortcutsOptions {
  canvasTitle: () => string;
  canvasUuid: string;
  container: HTMLElement;
  historyManager: DocHistoryManager;
  onBroadcastDocUpdate: () => void;
  onRecordChange: () => void;
  onRenderDocument: () => void;
  onSaveNow: () => void;
  onScheduleAutosave: () => void;
  onSyncPages: () => void;
  paginationManager: DocPaginationManager;
  project: DocProject;
  setProject: (p: DocProject) => void;
  signal: AbortSignal;
}

export interface DocShortcutsController {
  bindExportMenu: () => void;
  bindFindAndReplace: () => void;
  bindKeyboardShortcuts: () => void;
  bindZoomControls: () => void;
  destroy: () => void;
  handleRedo: () => void;
  handleUndo: () => void;
  toggleVerticalToolbar: (forceState?: boolean) => boolean;
  updateStats: () => void;
  updateUndoRedoButtonsState: () => void;
  updateZoom: (nextZoom: number) => void;
  updateZoomUI: () => void;
}

export function setupDocShortcutsManager(options: DocShortcutsOptions): DocShortcutsController {
  const {
    container,
    project,
    setProject,
    historyManager,
    paginationManager,
    signal,
    canvasTitle,
    onSyncPages,
    onRenderDocument,
    onScheduleAutosave,
    onBroadcastDocUpdate,
    onSaveNow,
  } = options;

  let exportDropdownController: { close: () => void; destroy: () => void } | null = null;

  const updateZoomUI = (): void => {
    const lblZoom = container.querySelector<HTMLElement>('[data-ref="lbl-zoom-level"]');
    if (lblZoom) {
      lblZoom.textContent = `${Math.round(project.settings.zoom * 100)}%`;
    }
  };

  const updateZoom = (nextZoom: number): void => {
    project.settings.zoom = Math.max(0.5, Math.min(2.0, Math.round(nextZoom * 100) / 100));
    updateZoomUI();
    const pagesContainer = container.querySelector<HTMLElement>('[data-ref="doc-pages-container"]');
    if (pagesContainer) {
      pagesContainer.style.setProperty('--doc-zoom', `${project.settings.zoom}`);
    }
  };

  const bindExportMenu = (): void => {
    const wrapperExport = container.querySelector<HTMLElement>('[data-ref="dropdown-wrapper-export"]');
    if (wrapperExport) {
      exportDropdownController = setupDropdown(wrapperExport, { matchWidth: false });
    }

    const bindExp = (ref: string, fn: () => void) => {
      const btn = container.querySelector<HTMLElement>(`[data-ref="${ref}"]`);
      if (btn) {
        btn.addEventListener('click', () => {
          onSyncPages();
          fn();
        }, { signal });
      }
    };

    bindExp('btn-export-pdf', () => exportDocPdf(project, canvasTitle()));
    bindExp('btn-export-word', () => exportDocWord(project, canvasTitle()));
    bindExp('btn-export-markdown', () => exportDocMarkdown(project, canvasTitle()));
    bindExp('btn-export-txt', () => exportDocTxt(project, canvasTitle()));
    bindExp('btn-export-html', () => exportDocHtml(project, canvasTitle()));
    bindExp('btn-export-json', () => exportDocJson(project, canvasTitle()));
  };

  const bindFindAndReplace = (): void => {
    const btnToggleFind = container.querySelector<HTMLElement>('[data-ref="btn-toggle-find"]');
    const findTray = container.querySelector<HTMLElement>('[data-ref="doc-find-replace-tray"]');
    const btnCloseFind = container.querySelector<HTMLElement>('[data-ref="btn-close-find"]');
    const inputFind = container.querySelector<HTMLInputElement>('[data-ref="input-find-text"]');
    const inputReplace = container.querySelector<HTMLInputElement>('[data-ref="input-replace-text"]');
    const btnFindPrev = container.querySelector<HTMLElement>('[data-ref="btn-find-prev"]');
    const btnFindNext = container.querySelector<HTMLElement>('[data-ref="btn-find-next"]');
    const btnReplaceOne = container.querySelector<HTMLElement>('[data-ref="btn-replace-one"]');
    const btnReplaceAll = container.querySelector<HTMLElement>('[data-ref="btn-replace-all"]');
    const matchCount = container.querySelector<HTMLElement>('[data-ref="find-match-count"]');

    let currentMatchIndex = 0;
    let totalMatches = 0;

    const runFind = (direction: 'next' | 'none' | 'prev' = 'none') => {
      const q = inputFind?.value.trim() || '';
      if (!q) {
        currentMatchIndex = 0;
        totalMatches = 0;
        if (matchCount) matchCount.textContent = '0 de 0';
        return;
      }

      totalMatches = 0;
      const lowerQ = q.toLowerCase();
      container.querySelectorAll<HTMLElement>('.doc-page__content').forEach((pageEl) => {
        const text = pageEl.innerText.toLowerCase();
        let pos = text.indexOf(lowerQ);
        while (pos !== -1) {
          totalMatches++;
          pos = text.indexOf(lowerQ, pos + lowerQ.length);
        }
      });

      if (totalMatches === 0) {
        currentMatchIndex = 0;
        if (matchCount) matchCount.textContent = '0 de 0';
        return;
      }

      if (direction === 'next') {
        currentMatchIndex = currentMatchIndex >= totalMatches ? 1 : currentMatchIndex + 1;
        try {
          (window as any).find(q, false, false, true, false, false, false);
        } catch {}
      } else if (direction === 'prev') {
        currentMatchIndex = currentMatchIndex <= 1 ? totalMatches : currentMatchIndex - 1;
        try {
          (window as any).find(q, false, true, true, false, false, false);
        } catch {}
      } else {
        currentMatchIndex = 1;
        try {
          (window as any).find(q, false, false, true, false, false, false);
        } catch {}
      }

      if (matchCount) {
        matchCount.textContent = `${currentMatchIndex} de ${totalMatches}`;
      }
    };

    if (btnToggleFind && findTray && inputFind) {
      btnToggleFind.addEventListener('click', () => {
        findTray.classList.toggle('is-hidden');
        if (!findTray.classList.contains('is-hidden')) {
          inputFind.focus();
          inputFind.select();
          runFind('none');
        }
      }, { signal });
    }

    if (btnCloseFind && findTray) {
      btnCloseFind.addEventListener('click', () => {
        findTray.classList.add('is-hidden');
      }, { signal });
    }

    btnFindPrev?.addEventListener('click', () => runFind('prev'), { signal });
    btnFindNext?.addEventListener('click', () => runFind('next'), { signal });

    if (inputFind) {
      inputFind.addEventListener('input', () => runFind('none'), { signal });
      inputFind.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          runFind(e.shiftKey ? 'prev' : 'next');
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
        container.querySelectorAll<HTMLElement>('.doc-page__content').forEach((pageEl) => {
          pageEl.innerHTML = pageEl.innerHTML.replace(findVal, repVal);
        });
        onSyncPages();
        runFind('none');
      }, { signal });
    }

    if (btnReplaceAll && inputFind && inputReplace) {
      btnReplaceAll.addEventListener('click', () => {
        const findVal = inputFind.value;
        const repVal = inputReplace.value;
        if (!findVal) return;
        const reg = new RegExp(findVal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
        container.querySelectorAll<HTMLElement>('.doc-page__content').forEach((pageEl) => {
          pageEl.innerHTML = pageEl.innerHTML.replace(reg, repVal);
        });
        onSyncPages();
        runFind('none');
        showToast('Todas las coincidencias fueron reemplazadas', 'success');
      }, { signal });
    }
  };

  const bindZoomControls = (): void => {
    const btnZoomOut = container.querySelector<HTMLElement>('[data-ref="btn-zoom-out"]');
    const btnZoomIn = container.querySelector<HTMLElement>('[data-ref="btn-zoom-in"]');
    const btnZoomReset = container.querySelector<HTMLElement>('[data-ref="btn-zoom-reset"]');
    const btnZoomFit = container.querySelector<HTMLElement>('[data-ref="btn-zoom-fit"]');

    if (btnZoomOut) {
      btnZoomOut.addEventListener('click', () => updateZoom(project.settings.zoom - 0.1), { signal });
    }
    if (btnZoomIn) {
      btnZoomIn.addEventListener('click', () => updateZoom(project.settings.zoom + 0.1), { signal });
    }
    if (btnZoomReset) {
      btnZoomReset.addEventListener('click', () => updateZoom(1.0), { signal });
    }
    if (btnZoomFit) {
      btnZoomFit.addEventListener('click', () => {
        const viewport = container.querySelector<HTMLElement>('[data-ref="doc-viewport"]');
        const paper = (DOC_PAPER_DIMENSIONS[project.settings.paperSize || 'letter'] && DOC_PAPER_DIMENSIONS[project.settings.paperSize || 'letter'][project.settings.orientation || 'portrait']) || DOC_PAPER_DIMENSIONS.letter.portrait;
        if (viewport && paper && paper.widthPx > 0) {
          const availWidth = viewport.clientWidth - 80;
          const fitZoom = Math.max(0.5, Math.min(2.0, availWidth / paper.widthPx));
          updateZoom(fitZoom);
        }
      }, { signal });
    }

    const viewport = container.querySelector<HTMLElement>('[data-ref="doc-viewport"]');
    if (viewport) {
      viewport.addEventListener(
        'wheel',
        (e: WheelEvent) => {
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            const delta = e.deltaY < 0 ? 0.05 : -0.05;
            updateZoom(project.settings.zoom + delta);
          }
        },
        { passive: false, signal }
      );
    }
  };

  const updateUndoRedoButtonsState = (): void => {
    const btnUndo = container.querySelector<HTMLButtonElement>('[data-ref="btn-undo"]');
    const btnRedo = container.querySelector<HTMLButtonElement>('[data-ref="btn-redo"]');

    if (btnUndo) {
      btnUndo.disabled = !historyManager.canUndo();
      btnUndo.classList.toggle('is-disabled', !historyManager.canUndo());
    }
    if (btnRedo) {
      btnRedo.disabled = !historyManager.canRedo();
      btnRedo.classList.toggle('is-disabled', !historyManager.canRedo());
    }
  };

  const updateStats = (): void => {
    const stats = paginationManager.calculateStats(project);

    const lblPage = container.querySelector<HTMLElement>('[data-ref="status-page-count"]');
    const lblWord = container.querySelector<HTMLElement>('[data-ref="status-word-count"]');
    const lblChar = container.querySelector<HTMLElement>('[data-ref="status-char-count"]');
    const lblRead = container.querySelector<HTMLElement>('[data-ref="status-reading-time"]');

    if (lblPage) lblPage.textContent = `Página 1 de ${stats.pages}`;
    if (lblWord) lblWord.textContent = `${stats.words.toLocaleString()} palabra${stats.words === 1 ? '' : 's'}`;
    if (lblChar) lblChar.textContent = `${stats.characters.toLocaleString()} caracteres`;
    if (lblRead) lblRead.textContent = `${stats.readingTimeMinutes} min lectura`;
  };

  const handleUndo = (): void => {
    const prevState = historyManager.undo();
    if (prevState) {
      setProject(prevState);
      onRenderDocument();
      updateUndoRedoButtonsState();
      updateStats();
      onBroadcastDocUpdate();
      onScheduleAutosave();
    }
  };

  const handleRedo = (): void => {
    const nextState = historyManager.redo();
    if (nextState) {
      setProject(nextState);
      onRenderDocument();
      updateUndoRedoButtonsState();
      updateStats();
      onBroadcastDocUpdate();
      onScheduleAutosave();
    }
  };

  const bindKeyboardShortcuts = (): void => {
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      } else if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) {
        e.preventDefault();
        handleRedo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        onSyncPages();
        exportDocPdf(project, canvasTitle());
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        onSyncPages();
        onSaveNow();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        const findTray = container.querySelector<HTMLElement>('[data-ref="doc-find-replace-tray"]');
        const inputFind = container.querySelector<HTMLInputElement>('[data-ref="input-find-text"]');
        findTray?.classList.remove('is-hidden');
        inputFind?.focus();
        inputFind?.select();
      }
    }, { signal });
  };

  const toggleVerticalToolbar = (forceState?: boolean): boolean => {
    const vToolbar = container.querySelector<HTMLElement>('[data-ref="doc-vertical-toolbar-container"]');
    if (!vToolbar) return false;
    const isCurrentlyHidden = vToolbar.classList.contains('is-hidden');
    const shouldShow = typeof forceState === 'boolean' ? forceState : isCurrentlyHidden;
    vToolbar.classList.toggle('is-hidden', !shouldShow);
    const sidebar = document.querySelector<HTMLElement>('[data-ref="sidebar"]');
    if (sidebar) {
      const railItem = sidebar.querySelector<HTMLElement>('[data-ref="rail-item-canvas-tools"]');
      const railBtn = sidebar.querySelector<HTMLElement>('[data-ref="btn-rail-canvas-tools"]');
      railItem?.classList.toggle('is-active', shouldShow);
      railBtn?.classList.toggle('is-active', shouldShow);
    }
    return shouldShow;
  };

  const destroy = (): void => {
    exportDropdownController?.destroy();
    exportDropdownController = null;
  };

  return {
    bindExportMenu,
    bindFindAndReplace,
    bindKeyboardShortcuts,
    bindZoomControls,
    destroy,
    handleRedo,
    handleUndo,
    toggleVerticalToolbar,
    updateStats,
    updateUndoRedoButtonsState,
    updateZoom,
    updateZoomUI,
  };
}
