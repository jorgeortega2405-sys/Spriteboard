import { API_ROUTES } from '../config/api-routes.js';
import { currentUser, escapeHtml, getApi } from '../services/api.service.js';
import { getLocalCanvasByUuid } from '../services/canvas-storage.service.js';
import { t, translateElement } from '../services/i18n.service.js';
import { renderIcons } from '../services/icon.service.js';
import { showToast } from '../services/toast.service.js';
import { CanvasItem } from '../types/canvas.types.js';
import { setupDropdown } from '../utils/dom.util.js';
import { encodeFramesToGif } from '../utils/gif-encoder.util.js';
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
  if (canvas.canvas_type === 'doc' || canvas.unit === 'doc') {
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

  const kind = getCanvasKind(canvas);
  const formatOptions = getFormatOptionsForKind(kind);
  let selectedType = formatOptions[0]?.id || 'png-current';
  let selectedScale = 1;
  let selectedBg: 'solid' | 'transparent' = 'transparent';

  const baseW = canvas.width || 800;
  const baseH = canvas.height || 600;

  let headerSubtitle = '';
  if (kind === 'doc') {
    headerSubtitle = `${escapeHtml(canvas.name)} • Documento Doc`;
  } else if (kind === 'board') {
    headerSubtitle = `${escapeHtml(canvas.name)} • Pizarrón Infinito`;
  } else if (kind === 'diagram') {
    const label = canvas.canvas_type === 'mindmap' ? 'Mapa Mental' : 'Diagrama';
    headerSubtitle = `${escapeHtml(canvas.name)} • ${label}`;
  } else {
    headerSubtitle = `${escapeHtml(canvas.name)} (${baseW} × ${baseH} px)`;
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

            <div class="design-share-section${kind === 'pixel' ? '' : ' is-hidden'}" data-ref="section-download-scale">
              <span class="design-share-section__label">Resolución y escala</span>
              <div class="settings-dropdown-wrapper" data-ref="dropdown-wrapper-download-scale">
                <button type="button" class="dropdown-trigger" data-ref="btn-trigger-download-scale" aria-label="Resolución y escala">
                  <div class="dropdown-trigger__left">
                    <span class="material-symbols-rounded dropdown-trigger__icon">aspect_ratio</span>
                    <span class="dropdown-trigger__text" data-ref="download-scale-selected-text">1x (Original - ${baseW} × ${baseH} px)</span>
                  </div>
                  <span class="material-symbols-rounded dropdown-trigger__chevron">expand_more</span>
                </button>
                <div class="dropdown-backdrop" data-ref="dropdown-backdrop-download-scale">
                  <div class="menu-panel menu-panel--dropdown menu-panel--w-full menu-panel--h-auto" data-ref="dropdown-menu-download-scale">
                    <div class="menu-panel__drag-zone" data-ref="download-scale-drag-zone" aria-hidden="true">
                      <div class="menu-panel__drag-handle"></div>
                    </div>
                    <div class="menu-panel__list" data-ref="list-download-scale">
                      <button type="button" class="menu-item is-active" data-ref="btn-scale-1" data-value="1">
                        <span class="menu-item__text">1x (Original - ${baseW} × ${baseH} px)</span>
                      </button>
                      <button type="button" class="menu-item" data-ref="btn-scale-2" data-value="2">
                        <span class="menu-item__text">2x (${baseW * 2} × ${baseH * 2} px)</span>
                      </button>
                      <button type="button" class="menu-item" data-ref="btn-scale-4" data-value="4">
                        <span class="menu-item__text">4x (${baseW * 4} × ${baseH * 4} px)</span>
                      </button>
                      <button type="button" class="menu-item" data-ref="btn-scale-8" data-value="8">
                        <span class="menu-item__text">8x (${baseW * 8} × ${baseH * 8} px)</span>
                      </button>
                      <button type="button" class="menu-item" data-ref="btn-scale-16" data-value="16">
                        <span class="menu-item__text">16x (${baseW * 16} × ${baseH * 16} px)</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div class="design-share-section${kind === 'pixel' ? '' : ' is-hidden'}" data-ref="section-download-bg">
              <span class="design-share-section__label">Fondo</span>
              <div class="settings-dropdown-wrapper" data-ref="dropdown-wrapper-download-bg">
                <button type="button" class="dropdown-trigger" data-ref="btn-trigger-download-bg" aria-label="Fondo">
                  <div class="dropdown-trigger__left">
                    <span class="material-symbols-rounded dropdown-trigger__icon" data-ref="download-bg-selected-icon">opacity</span>
                    <span class="dropdown-trigger__text" data-ref="download-bg-selected-text">Transparente</span>
                  </div>
                  <span class="material-symbols-rounded dropdown-trigger__chevron">expand_more</span>
                </button>
                <div class="dropdown-backdrop" data-ref="dropdown-backdrop-download-bg">
                  <div class="menu-panel menu-panel--dropdown menu-panel--w-full menu-panel--h-auto" data-ref="dropdown-menu-download-bg">
                    <div class="menu-panel__drag-zone" data-ref="download-bg-drag-zone" aria-hidden="true">
                      <div class="menu-panel__drag-handle"></div>
                    </div>
                    <div class="menu-panel__list" data-ref="list-download-bg">
                      <button type="button" class="menu-item is-active" data-ref="btn-download-bg-transparent" data-value="transparent">
                        <span class="material-symbols-rounded menu-item__icon">opacity</span>
                        <span class="menu-item__text">Transparente</span>
                      </button>
                      <button type="button" class="menu-item" data-ref="btn-download-bg-solid" data-value="solid">
                        <span class="material-symbols-rounded menu-item__icon">format_color_fill</span>
                        <span class="menu-item__text">Color del lienzo</span>
                      </button>
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

  const sectionScale = backdrop.querySelector<HTMLElement>('[data-ref="section-download-scale"]');
  const sectionBg = backdrop.querySelector<HTMLElement>('[data-ref="section-download-bg"]');

  const dropdownWrapperType = backdrop.querySelector<HTMLElement>('[data-ref="dropdown-wrapper-download-type"]');
  const dropdownWrapperScale = backdrop.querySelector<HTMLElement>('[data-ref="dropdown-wrapper-download-scale"]');
  const dropdownWrapperBg = backdrop.querySelector<HTMLElement>('[data-ref="dropdown-wrapper-download-bg"]');

  let typeCtrl: ReturnType<typeof setupDropdown> | null = null;
  let scaleCtrl: ReturnType<typeof setupDropdown> | null = null;
  let bgCtrl: ReturnType<typeof setupDropdown> | null = null;

  let isClosing = false;
  const closeModal = () => {
    if (isClosing) return;
    isClosing = true;
    typeCtrl?.destroy();
    scaleCtrl?.destroy();
    bgCtrl?.destroy();
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
      if (sectionScale) sectionScale.classList.add('is-hidden');
      if (sectionBg) sectionBg.classList.add('is-hidden');
      return;
    }

    if (kind === 'board') {
      if (selectedType === 'png') {
        btnConfirmText.textContent = 'Descargar Imagen PNG';
      } else if (selectedType === 'svg') {
        btnConfirmText.textContent = 'Descargar Vectorial SVG';
      } else {
        btnConfirmText.textContent = 'Descargar Proyecto (.json)';
      }
      if (sectionScale) sectionScale.classList.add('is-hidden');
      if (sectionBg) sectionBg.classList.add('is-hidden');
      return;
    }

    if (kind === 'diagram') {
      if (selectedType === 'png') {
        btnConfirmText.textContent = 'Descargar Imagen PNG';
      } else if (selectedType === 'svg') {
        btnConfirmText.textContent = 'Descargar Vectorial SVG';
      } else if (selectedType === 'markdown') {
        btnConfirmText.textContent = 'Descargar Esquema Markdown (.md)';
      } else {
        btnConfirmText.textContent = 'Descargar Proyecto (.json)';
      }
      if (sectionScale) sectionScale.classList.add('is-hidden');
      if (sectionBg) sectionBg.classList.add('is-hidden');
      return;
    }

    const w = baseW * selectedScale;
    const h = baseH * selectedScale;
    if (selectedType === 'png-current') {
      btnConfirmText.textContent = `Descargar PNG (${w} × ${h} px)`;
    } else if (selectedType === 'spritesheet') {
      btnConfirmText.textContent = `Descargar Hoja de sprites (${w} × ${h} px)`;
    } else if (selectedType === 'spritesheet-atlas') {
      btnConfirmText.textContent = 'Descargar Atlas (PNG + JSON)';
    } else if (selectedType === 'gif') {
      btnConfirmText.textContent = `Descargar GIF animado (${w} × ${h} px)`;
    } else {
      btnConfirmText.textContent = 'Descargar Proyecto (.json)';
    }

    const isJson = selectedType === 'project-json';
    if (sectionScale) sectionScale.classList.toggle('is-hidden', isJson);
    if (sectionBg) sectionBg.classList.toggle('is-hidden', isJson);
  };

  updateUI();

  typeCtrl = setupDropdown(dropdownWrapperType, {
    onSelect: (val) => {
      selectedType = val || 'png-current';
      updateUI();
    },
  });

  scaleCtrl = setupDropdown(dropdownWrapperScale, {
    onSelect: (val) => {
      selectedScale = parseInt(val || '1', 10);
      updateUI();
    },
  });

  bgCtrl = setupDropdown(dropdownWrapperBg, {
    onSelect: (val) => {
      selectedBg = (val as typeof selectedBg) || 'transparent';
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
            if (parsed && Array.isArray(parsed.elements)) {
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

        if (selectedType === 'project-json') {
          const jsonBlob = new Blob([JSON.stringify(boardProject, null, 2)], { type: 'application/json;charset=utf-8' });
          triggerBlobDownload(jsonBlob, `${cleanName}_project.json`);
          showToast(t('canvas.download_success'));
          closeModal();
          return;
        }

        if (selectedType === 'svg') {
          exportSvg(boardProject.elements, boardProject.background || { color: '#ffffff', type: 'dots' }, cleanName, (el) => {
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

        const elements = boardProject.elements || [];
        const bbox = computeElementsBoundingBox(elements);
        const pad = 60;
        const exportW = bbox ? Math.ceil(bbox.width + pad * 2) : 1200;
        const exportH = bbox ? Math.ceil(bbox.height + pad * 2) : 800;

        const exportCanvas = document.createElement('canvas');
        exportCanvas.width = Math.min(8192, exportW);
        exportCanvas.height = Math.min(8192, exportH);
        const ectx = exportCanvas.getContext('2d');
        if (ectx) {
          ectx.fillStyle = boardProject.background?.color || '#ffffff';
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
      }

      if (selectedType === 'project-json') {
        let projectJson = fullCanvas.data;
        if (!projectJson) {
          projectJson = JSON.stringify({
            created_at: fullCanvas.created_at,
            height: baseH,
            name: fullCanvas.name,
            unit: fullCanvas.unit || 'px',
            version: 1,
            width: baseW,
          }, null, 2);
        } else if (typeof projectJson !== 'string') {
          projectJson = JSON.stringify(projectJson, null, 2);
        }
        const blob = new Blob([projectJson], { type: 'application/json;charset=utf-8' });
        triggerBlobDownload(blob, `${cleanName}_project.json`);
        showToast(t('canvas.download_success'));
        closeModal();
        return;
      }

      let parsedData: any = null;
      if (fullCanvas.data) {
        try {
          parsedData = typeof fullCanvas.data === 'string' ? JSON.parse(fullCanvas.data) : fullCanvas.data;
        } catch {}
      }

      const frames = Array.isArray(parsedData?.frames) && parsedData.frames.length > 0 ? parsedData.frames : null;
      const targetScale = selectedScale;
      const isTransparent = selectedBg === 'transparent';

      if ((selectedType === 'spritesheet' || selectedType === 'spritesheet-atlas') && frames && frames.length > 0) {
        const framesCount = frames.length;
        const frameW = baseW * targetScale;
        const frameH = baseH * targetScale;
        const sheetCanvas = document.createElement('canvas');
        sheetCanvas.width = frameW * framesCount;
        sheetCanvas.height = frameH;
        const sheetCtx = sheetCanvas.getContext('2d');

        if (sheetCtx) {
          sheetCtx.imageSmoothingEnabled = false;
          if (!isTransparent) {
            sheetCtx.fillStyle = '#ffffff';
            sheetCtx.fillRect(0, 0, sheetCanvas.width, sheetCanvas.height);
          }

          const atlasFrames: any[] = [];
          const defaultFps = parsedData?.fps || 8;
          const defaultDelay = Math.round(1000 / defaultFps);

          for (let i = 0; i < framesCount; i++) {
            const frame = frames[i];
            const fCanvas = document.createElement('canvas');
            fCanvas.width = baseW;
            fCanvas.height = baseH;
            const fCtx = fCanvas.getContext('2d');
            if (fCtx && Array.isArray(frame.layers)) {
              for (const layer of frame.layers) {
                if (layer.visible !== false && layer.data) {
                  const img = new Image();
                  await new Promise<void>((r) => {
                    img.onload = () => r();
                    img.onerror = () => r();
                    img.src = layer.data;
                  });
                  fCtx.globalAlpha = typeof layer.opacity === 'number' ? layer.opacity : 1;
                  fCtx.drawImage(img, 0, 0);
                }
              }
            }
            sheetCtx.drawImage(fCanvas, i * frameW, 0, frameW, frameH);

            if (selectedType === 'spritesheet-atlas') {
              atlasFrames.push({
                duration: frame.durationMs || defaultDelay,
                filename: `frame_${i}.png`,
                frame: { h: frameH, w: frameW, x: i * frameW, y: 0 },
                rotated: false,
                sourceSize: { h: frameH, w: frameW },
                spriteSourceSize: { h: frameH, w: frameW, x: 0, y: 0 },
                trimmed: false,
              });
            }
          }

          const blob = await new Promise<Blob | null>((resolve) => sheetCanvas.toBlob(resolve, 'image/png'));
          if (blob) {
            triggerBlobDownload(blob, `${cleanName}_spritesheet_${targetScale}x.png`);

            if (selectedType === 'spritesheet-atlas') {
              const atlasJson = {
                frames: atlasFrames,
                meta: {
                  app: 'Spriteboard',
                  format: 'RGBA8888',
                  image: `${cleanName}_spritesheet_${targetScale}x.png`,
                  scale: `${targetScale}`,
                  size: { h: frameH, w: frameW * framesCount },
                  version: '1.0',
                },
              };
              const jsonBlob = new Blob([JSON.stringify(atlasJson, null, 2)], { type: 'application/json;charset=utf-8' });
              triggerBlobDownload(jsonBlob, `${cleanName}_atlas_${targetScale}x.json`);
            }

            showToast(t('canvas.download_success'));
            closeModal();
            return;
          }
        }
      }

      if (selectedType === 'gif') {
        const activeFrames = frames && frames.length > 0 ? frames : [{ layers: frames?.[0]?.layers || [] }];
        const framesCount = activeFrames.length;
        const frameW = baseW * targetScale;
        const frameH = baseH * targetScale;
        const gifFrames: Array<{ canvas: HTMLCanvasElement; delayMs: number }> = [];
        const defaultFps = parsedData?.fps || 8;
        const defaultDelay = Math.round(1000 / defaultFps);

        for (let i = 0; i < framesCount; i++) {
          const frame = activeFrames[i];
          const fCanvas = document.createElement('canvas');
          fCanvas.width = frameW;
          fCanvas.height = frameH;
          const fCtx = fCanvas.getContext('2d');
          if (fCtx) {
            fCtx.imageSmoothingEnabled = false;
            if (!isTransparent) {
              fCtx.fillStyle = '#ffffff';
              fCtx.fillRect(0, 0, frameW, frameH);
            }
            if (Array.isArray(frame.layers)) {
              for (const layer of frame.layers) {
                if (layer.visible !== false && layer.data) {
                  const img = new Image();
                  await new Promise<void>((r) => {
                    img.onload = () => r();
                    img.onerror = () => r();
                    img.src = layer.data;
                  });
                  fCtx.globalAlpha = typeof layer.opacity === 'number' ? layer.opacity : 1;
                  fCtx.drawImage(img, 0, 0, frameW, frameH);
                }
              }
            } else if (fullCanvas.preview_thumbnail) {
              const img = new Image();
              await new Promise<void>((r) => {
                img.onload = () => r();
                img.onerror = () => r();
                img.src = fullCanvas.preview_thumbnail!;
              });
              fCtx.drawImage(img, 0, 0, frameW, frameH);
            }
          }

          gifFrames.push({
            canvas: fCanvas,
            delayMs: (frame as any).durationMs || defaultDelay,
          });
        }

        const gifBlob = await encodeFramesToGif(gifFrames);
        triggerBlobDownload(gifBlob, `${cleanName}_${targetScale}x.gif`);
        showToast(t('canvas.download_success'));
        closeModal();
        return;
      }

      const outCanvas = document.createElement('canvas');
      outCanvas.width = baseW * targetScale;
      outCanvas.height = baseH * targetScale;
      const outCtx = outCanvas.getContext('2d');

      if (outCtx) {
        outCtx.imageSmoothingEnabled = false;
        if (!isTransparent) {
          outCtx.fillStyle = '#ffffff';
          outCtx.fillRect(0, 0, outCanvas.width, outCanvas.height);
        }

        let renderedFromLayers = false;
        if (frames && frames[0] && Array.isArray(frames[0].layers)) {
          const fCanvas = document.createElement('canvas');
          fCanvas.width = baseW;
          fCanvas.height = baseH;
          const fCtx = fCanvas.getContext('2d');
          if (fCtx) {
            for (const layer of frames[0].layers) {
              if (layer.visible !== false && layer.data) {
                const img = new Image();
                await new Promise<void>((r) => {
                  img.onload = () => r();
                  img.onerror = () => r();
                  img.src = layer.data;
                });
                fCtx.globalAlpha = typeof layer.opacity === 'number' ? layer.opacity : 1;
                fCtx.drawImage(img, 0, 0);
              }
            }
            outCtx.drawImage(fCanvas, 0, 0, outCanvas.width, outCanvas.height);
            renderedFromLayers = true;
          }
        }

        if (!renderedFromLayers) {
          const thumb = fullCanvas.preview_thumbnail || canvas.preview_thumbnail;
          if (thumb) {
            const img = new Image();
            await new Promise<void>((r) => {
              img.onload = () => r();
              img.onerror = () => r();
              img.src = thumb;
            });
            outCtx.drawImage(img, 0, 0, outCanvas.width, outCanvas.height);
          }
        }

        const blob = await new Promise<Blob | null>((resolve) => outCanvas.toBlob(resolve, 'image/png'));
        if (blob) {
          triggerBlobDownload(blob, `${cleanName}_${targetScale}x.png`);
          showToast(t('canvas.download_success'));
          closeModal();
          return;
        }
      }

      showToast(t('canvas.download_error'), 'danger');
    } catch {
      showToast(t('canvas.download_error'), 'danger');
    } finally {
      if (btnConfirm) btnConfirm.disabled = false;
      if (btnConfirmText && prevText) btnConfirmText.textContent = prevText;
    }
  });
}

