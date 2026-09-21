import { API_ROUTES } from '../config/api-routes.js';
import { currentUser, escapeHtml, getApi } from '../services/api.service.js';
import { getLocalCanvasByUuid } from '../services/canvas-storage.service.js';
import { t, translateElement } from '../services/i18n.service.js';
import { renderIcons } from '../services/icon.service.js';
import { showToast } from '../services/toast.service.js';
import { CanvasItem } from '../types/canvas.types.js';
import { setupDropdown } from '../utils/dom.util.js';
import { computeElementsBoundingBox } from '../views/board/board-elements.manager.js';
import { exportSvg } from '../views/board/board-export.service.js';
import { drawConnector, drawShape, drawSticky, drawStroke, drawText } from '../views/board/board-renderer.js';
import { BoardElement, BoardProject } from '../views/board/board.types.js';
import { exportDocHtml, exportDocJson, exportDocMarkdown, exportDocPdf, exportDocTxt, exportDocWord } from '../views/doc/doc-export.service.js';
import { DocProject } from '../views/doc/doc.types.js';

export type DownloadCanvasKind = 'board' | 'doc';

interface ExportFormatOption {
  icon: string;
  id: string;
  label: string;
}

function getCanvasKind(canvas: CanvasItem): DownloadCanvasKind {
  if (canvas.canvas_type === 'doc' || canvas.unit === 'doc' || canvas.canvas_type === 'presentation' || canvas.unit === 'presentation') {
    return 'doc';
  }
  return 'board';
}

function getFormatOptionsForKind(kind: DownloadCanvasKind): ExportFormatOption[] {
  if (kind === 'doc') {
    return [
      { icon: 'picture_as_pdf', id: 'pdf', label: t('download.type_pdf') || 'Documento PDF (.pdf)' },
      { icon: 'article', id: 'word', label: t('download.type_word') || 'Documento Word (.doc)' },
      { icon: 'markdown', id: 'markdown', label: t('download.type_markdown') || 'Documento Markdown (.md)' },
      { icon: 'text_snippet', id: 'txt', label: t('download.type_txt') || 'Texto sin formato (.txt)' },
      { icon: 'code', id: 'html', label: t('download.type_html') || 'Página web (.html)' },
      { icon: 'data_object', id: 'project-json', label: t('download.type_project_json') || 'Proyecto Spriteboard (.json)' },
    ];
  }
  return [
    { icon: 'image', id: 'png', label: t('download.type_png') || 'Imagen PNG (.png)' },
    { icon: 'polyline', id: 'svg', label: t('download.type_svg') || 'Vectorial SVG (.svg)' },
    { icon: 'data_object', id: 'project-json', label: t('download.type_project_json') || 'Proyecto Spriteboard (.json)' },
  ];
}

let activeDownloadModal: { close: () => void } | null = null;

export function openCanvasDownloadModal(canvas: CanvasItem): void {
  if (activeDownloadModal) {
    activeDownloadModal.close();
  }

  const isPresentation = canvas.canvas_type === 'presentation' || canvas.unit === 'presentation';
  const kind = getCanvasKind(canvas);
  const formatOptions = getFormatOptionsForKind(kind);
  let selectedType = formatOptions[0]?.id || (kind === 'doc' ? 'pdf' : 'png');

  const baseW = canvas.width || 800;
  const baseH = canvas.height || 600;

  let headerSubtitle = '';
  if (isPresentation) {
    headerSubtitle = `${escapeHtml(canvas.name)} • Presentación`;
  } else if (kind === 'doc') {
    headerSubtitle = `${escapeHtml(canvas.name)} • Documento Doc`;
  } else {
    headerSubtitle = `${escapeHtml(canvas.name)} • Pizarrón Infinito`;
  }

  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.setAttribute('data-ref', 'modal-download-backdrop');

  const menuItemsHtml = formatOptions.map((opt, index) => `
    <button type="button" class="menu-item${index === 0 ? ' is-active' : ''}" data-ref="btn-download-type-${opt.id}" data-value="${opt.id}">
      <span class="material-symbols-rounded menu-item__icon">${opt.icon}</span>
      <span class="menu-item__text">${escapeHtml(opt.label)}</span>
    </button>
  `).join('');

  const firstOption = formatOptions[0] || { icon: 'image', id: 'png', label: 'PNG' };

  backdrop.innerHTML = `
    <div class="modal-container" data-ref="modal-download-container">
      <button type="button" class="modal-close-btn" data-ref="btn-modal-close" aria-label="Cerrar ventana">
        <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#close"></use></svg>
      </button>
      <div class="modal-card modal-card--w-480" data-ref="modal-card-download">
        <div class="modal-card__drag-zone" data-ref="modal-drag-zone" aria-hidden="true">
          <div class="modal-card__drag-handle"></div>
        </div>
        <div class="modal-card__header" data-ref="modal-download-header">
          <h2 class="modal-card__title">Descargar diseño</h2>
          <p class="modal-card__desc">${headerSubtitle}</p>
        </div>
        <div class="modal-card__body" data-ref="modal-download-body">
          <div class="design-share-menu__content">
            <div class="design-share-section" data-ref="section-download-type">
              <span class="design-share-section__label">Tipo de archivo</span>
              <div class="settings-dropdown-wrapper" data-ref="dropdown-wrapper-download-type">
                <button type="button" class="dropdown-trigger" data-ref="btn-trigger-download-type" aria-label="Tipo de archivo">
                  <div class="dropdown-trigger__left">
                    <span class="material-symbols-rounded dropdown-trigger__icon" data-ref="download-type-selected-icon">${firstOption.icon}</span>
                    <span class="dropdown-trigger__text" data-ref="download-type-selected-text">${escapeHtml(firstOption.label)}</span>
                  </div>
                  <span class="material-symbols-rounded dropdown-trigger__chevron">expand_more</span>
                </button>
                <div class="dropdown-backdrop" data-ref="dropdown-backdrop-download-type">
                  <div class="menu-panel menu-panel--dropdown menu-panel--w-full menu-panel--h-auto" data-ref="dropdown-menu-download-type">
                    <div class="menu-panel__drag-zone" data-ref="download-type-drag-zone" aria-hidden="true">
                      <div class="menu-panel__drag-handle"></div>
                    </div>
                    <div class="menu-panel__list" data-ref="list-download-type">
                      ${menuItemsHtml}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div class="design-share-link-row">
              <button type="button" class="component-button component-button--h40 component-button--black component-button--w-full" data-ref="btn-confirm-download">
                <span class="material-symbols-rounded">download</span>
                <span data-ref="btn-confirm-download-text">Descargar</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(backdrop);
  document.body.classList.add('modal-open');
  translateElement(backdrop);
  renderIcons(backdrop);

  requestAnimationFrame(() => {
    backdrop.classList.add('is-visible');
  });

  const closeBtn = backdrop.querySelector<HTMLButtonElement>('[data-ref="btn-modal-close"]');
  const card = backdrop.querySelector<HTMLElement>('[data-ref="modal-card-download"]');
  const btnConfirm = backdrop.querySelector<HTMLButtonElement>('[data-ref="btn-confirm-download"]');
  const btnConfirmText = backdrop.querySelector<HTMLElement>('[data-ref="btn-confirm-download-text"]');

  const dropdownWrapperType = backdrop.querySelector<HTMLElement>('[data-ref="dropdown-wrapper-download-type"]');

  let typeCtrl: ReturnType<typeof setupDropdown> | null = null;

  let isClosing = false;
  const closeModal = () => {
    if (isClosing) return;
    isClosing = true;
    typeCtrl?.destroy();
    backdrop.classList.remove('is-visible');
    document.removeEventListener('keydown', onKeyDown);
    setTimeout(() => {
      backdrop.remove();
      document.body.classList.remove('modal-open');
      if (activeDownloadModal?.close === closeModal) {
        activeDownloadModal = null;
      }
    }, 200);
  };

  activeDownloadModal = { close: closeModal };

  closeBtn?.addEventListener('click', closeModal);
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) closeModal();
  });
  card?.addEventListener('click', (e) => {
    e.stopPropagation();
  });

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      closeModal();
      document.removeEventListener('keydown', onKeyDown);
    }
  };
  document.addEventListener('keydown', onKeyDown);

  const updateUI = () => {
    if (!btnConfirmText) return;

    if (kind === 'doc') {
      if (selectedType === 'pdf') {
        btnConfirmText.textContent = 'Descargar PDF';
      } else if (selectedType === 'word') {
        btnConfirmText.textContent = 'Descargar Documento Word (.doc)';
      } else if (selectedType === 'markdown') {
        btnConfirmText.textContent = 'Descargar Markdown (.md)';
      } else if (selectedType === 'txt') {
        btnConfirmText.textContent = 'Descargar Texto (.txt)';
      } else if (selectedType === 'html') {
        btnConfirmText.textContent = 'Descargar HTML (.html)';
      } else {
        btnConfirmText.textContent = 'Descargar Proyecto (.json)';
      }
      return;
    }

    if (selectedType === 'png') {
      btnConfirmText.textContent = 'Descargar Imagen PNG';
    } else if (selectedType === 'svg') {
      btnConfirmText.textContent = 'Descargar Vectorial SVG';
    } else {
      btnConfirmText.textContent = 'Descargar Proyecto (.json)';
    }
  };

  updateUI();

  typeCtrl = setupDropdown(dropdownWrapperType, {
    onSelect: (val) => {
      selectedType = val || (kind === 'doc' ? 'pdf' : 'png');
      updateUI();
    },
  });

  const triggerBlobDownload = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  btnConfirm?.addEventListener('click', async () => {
    if (!btnConfirm) return;
    btnConfirm.disabled = true;
    const prevText = btnConfirmText ? btnConfirmText.textContent : '';
    if (btnConfirmText) btnConfirmText.textContent = 'Preparando descarga...';

    const cleanName = (canvas.name || 'lienzo')
      .trim()
      .replace(/[/\\?%*:|"<>]/g, '_')
      .replace(/\s+/g, '_');

    try {
      let fullCanvas: CanvasItem | null = null;
      if (canvas.is_local) {
        fullCanvas = await getLocalCanvasByUuid(canvas.uuid);
      } else {
        const res = await getApi(API_ROUTES.canvases.byId(canvas.uuid));
        if (res.ok) {
          const data = await res.json();
          if (data?.canvas) fullCanvas = data.canvas;
        }
      }
      if (!fullCanvas) fullCanvas = canvas;

      if (kind === 'doc') {
        let docProject: DocProject | null = null;
        if (fullCanvas.data) {
          try {
            const parsed = typeof fullCanvas.data === 'string' ? JSON.parse(fullCanvas.data) : fullCanvas.data;
            if (parsed && Array.isArray(parsed.pages)) {
              docProject = parsed as DocProject;
            }
          } catch {}
        }
        if (!docProject) {
          docProject = {
            pages: [{ contentHtml: '<p></p>', id: 'page-1' }],
            settings: {
              columnsCount: 1,
              fontFamily: 'Inter',
              fontSize: 11,
              lineHeight: 1.5,
              margins: { bottom: 96, left: 96, right: 96, top: 96 },
              orientation: 'portrait',
              paperSize: 'letter',
              showPageNumbers: true,
              viewMode: 'paginated',
              zoom: 1,
            },
            type: 'doc',
            version: 1,
          };
        }

        if (selectedType === 'pdf') {
          exportDocPdf(docProject, fullCanvas.name);
        } else if (selectedType === 'word') {
          exportDocWord(docProject, fullCanvas.name);
        } else if (selectedType === 'markdown') {
          exportDocMarkdown(docProject, fullCanvas.name);
        } else if (selectedType === 'txt') {
          exportDocTxt(docProject, fullCanvas.name);
        } else if (selectedType === 'html') {
          exportDocHtml(docProject, fullCanvas.name);
        } else if (selectedType === 'project-json') {
          exportDocJson(docProject, fullCanvas.name);
        }
        showToast(t('canvas.download_success'));
        closeModal();
        return;
      }

      if (kind === 'board') {
        let boardProject: BoardProject | null = null;
        if (fullCanvas.data) {
          try {
            const parsed = typeof fullCanvas.data === 'string' ? JSON.parse(fullCanvas.data) : fullCanvas.data;
            if (parsed && (Array.isArray(parsed.elements) || Array.isArray(parsed.pages))) {
              boardProject = parsed as BoardProject;
            }
          } catch {}
        }
        if (!boardProject) {
          boardProject = {
            background: { color: '#ffffff', dotColor: '#cbd5e1', type: 'dots' },
            camera: { x: 0, y: 0, zoom: 1 },
            elements: [],
            type: 'board',
            version: 1,
          };
        }

        const activePage = Array.isArray(boardProject.pages) && boardProject.pages.length > 0
          ? (boardProject.pages.find((p) => p.id === boardProject?.activePageId) || boardProject.pages[0])
          : null;
        const elements = activePage?.elements || boardProject.elements || [];
        const background = activePage?.background || boardProject.background || { color: '#ffffff', type: 'dots' };

        if (selectedType === 'project-json') {
          const jsonBlob = new Blob([JSON.stringify(boardProject, null, 2)], { type: 'application/json;charset=utf-8' });
          triggerBlobDownload(jsonBlob, `${cleanName}_project.json`);
          showToast(t('canvas.download_success'));
          closeModal();
          return;
        }

        if (selectedType === 'svg') {
          exportSvg(elements, background, cleanName, (el) => {
            const c = document.createElement('canvas');
            c.width = el.gridWidth;
            c.height = el.gridHeight;
            const ctx = c.getContext('2d')!;
            if (el.data) {
              const img = new Image();
              img.src = el.data;
              ctx.drawImage(img, 0, 0);
            }
            return { canvas: c, ctx };
          });
          showToast(t('canvas.download_success'));
          closeModal();
          return;
        }

        const bbox = computeElementsBoundingBox(elements);
        const pad = 60;
        const exportW = bbox ? Math.ceil(bbox.width + pad * 2) : 1200;
        const exportH = bbox ? Math.ceil(bbox.height + pad * 2) : 800;

        const exportCanvas = document.createElement('canvas');
        exportCanvas.width = Math.min(8192, exportW);
        exportCanvas.height = Math.min(8192, exportH);
        const ectx = exportCanvas.getContext('2d');
        if (ectx) {
          ectx.fillStyle = background.color || '#ffffff';
          ectx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);

          if (bbox) {
            ectx.save();
            ectx.translate(pad - bbox.x, pad - bbox.y);
            for (const el of elements) {
              if (el.type === 'stroke') {
                drawStroke(ectx, el);
              } else if (el.type === 'shape') {
                drawShape(ectx, el);
              } else if (el.type === 'connector') {
                drawConnector(ectx, el, elements);
              } else if (el.type === 'sticky') {
                drawSticky(ectx, el);
              } else if (el.type === 'text') {
                drawText(ectx, el);
              } else if (el.type === 'pixel-grid' && el.data) {
                const img = new Image();
                await new Promise<void>((r) => {
                  img.onload = () => r();
                  img.onerror = () => r();
                  img.src = el.data!;
                });
                ectx.drawImage(img, el.x, el.y, el.width, el.height);
              }
            }
            ectx.restore();
          } else if (fullCanvas.preview_thumbnail) {
            const img = new Image();
            await new Promise<void>((r) => {
              img.onload = () => r();
              img.onerror = () => r();
              img.src = fullCanvas.preview_thumbnail!;
            });
            ectx.drawImage(img, 0, 0, exportCanvas.width, exportCanvas.height);
          }

          const blob = await new Promise<Blob | null>((resolve) => exportCanvas.toBlob(resolve, 'image/png'));
          if (blob) {
            triggerBlobDownload(blob, `${cleanName}.png`);
            showToast(t('canvas.download_success'));
            closeModal();
            return;
          }
        }
        showToast(t('canvas.download_error'), 'danger');
        return;
      }
    } catch {
      showToast(t('canvas.download_error'), 'danger');
    } finally {
      if (btnConfirm) btnConfirm.disabled = false;
      if (btnConfirmText && prevText) btnConfirmText.textContent = prevText;
    }
  });
}

