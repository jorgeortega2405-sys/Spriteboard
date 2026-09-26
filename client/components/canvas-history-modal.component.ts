import { API_ROUTES } from '../config/api-routes.js';
import { currentUser, deleteApi, escapeHtml, getApi, postApi } from '../services/api.service.js';
import { renderIcons } from '../services/icon.service.js';
import { showToast } from '../services/toast.service.js';
import { CanvasSnapshotItem } from '../types/canvas-snapshot.types.js';
import { CanvasType } from '../types/canvas.types.js';

export interface CanvasHistoryModalOptions {
  canvasTitle?: string;
  canvasType?: CanvasType;
  canvasUuid: string;
  generateThumbnail?: () => string | Promise<string>;
  getCurrentProjectData?: () => any;
  isOwner?: boolean;
  onExitPreview?: () => void;
  onPreviewSnapshot?: (snapshotUuid: string, projectData: any) => void;
  onRestoreSnapshot?: (snapshotUuid: string, restoredProjectData: any) => void | Promise<void>;
  signal?: AbortSignal;
  trigger?: HTMLElement;
  wrapper?: HTMLElement;
}

export interface CanvasHistoryModalController {
  close: () => void;
  destroy: () => void;
  isOpen: () => boolean;
  open: () => void;
  reloadSnapshots: () => Promise<void>;
  toggle: () => void;
  update: () => void;
}

function formatSnapshotDate(iso: string): string {
  try {
    const d = new Date(iso);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();

    const timeStr = d.toLocaleTimeString('es-ES', { hour: 'numeric', minute: '2-digit', hour12: true });

    if (isToday) {
      return `${timeStr}, hoy`;
    }

    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) {
      return `${timeStr}, ayer`;
    }

    const dateStr = d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
    return `${dateStr}, ${timeStr}`;
  } catch {
    return iso;
  }
}

export function openCanvasHistoryModal(options: CanvasHistoryModalOptions): CanvasHistoryModalController {
  const { canvasTitle = 'Lienzo', canvasType = 'board', canvasUuid, generateThumbnail, getCurrentProjectData, isOwner, onExitPreview, onPreviewSnapshot, onRestoreSnapshot, signal } = options;

  let modalEl = document.querySelector<HTMLElement>('[data-ref="canvas-history-modal"]');
  if (modalEl) {
    modalEl.remove();
  }

  const modalHtml = `
    <div class="canvas-history-modal is-hidden" data-ref="canvas-history-modal" role="dialog" aria-modal="true" aria-label="Historial de versiones">
      <header class="canvas-history-modal__topbar" data-ref="history-modal-topbar">
        <div class="canvas-history-modal__top-left">
          <button type="button" class="component-button canvas-history-modal__exit-btn" data-ref="btn-history-exit" aria-label="Salir">
            <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#arrow_back"></use></svg>
            <span>Salir</span>
          </button>
          <span class="canvas-history-modal__title" data-ref="history-modal-title">${escapeHtml(canvasTitle)}</span>
        </div>
        <div class="canvas-history-modal__top-right">
          <button type="button" class="component-button component-button--h36 component-button--outline canvas-history-modal__btn-fork" data-ref="btn-history-fork" aria-label="Crear una copia">
            <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#content_copy"></use></svg>
            <span>Crear una copia</span>
          </button>
          <button type="button" class="component-button component-button--h36 component-button--black canvas-history-modal__btn-restore" data-ref="btn-history-restore" aria-label="Restaurar versión">
            <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#history"></use></svg>
            <span>Restaurar</span>
          </button>
        </div>
      </header>

      <div class="canvas-history-modal__body">
        <div class="canvas-history-modal__preview-area" data-ref="history-preview-area">
          <div class="canvas-history-modal__preview-viewport" data-ref="history-preview-viewport">
            <div class="canvas-history-modal__preview-content" data-ref="history-preview-content"></div>
          </div>
          <div class="canvas-history-modal__pages-tray is-hidden" data-ref="history-pages-tray">
            <div class="canvas-history-modal__pages-list" data-ref="history-pages-list" style="display: flex; gap: 8px;"></div>
          </div>
        </div>

        <aside class="canvas-history-modal__sidebar" data-ref="history-sidebar">
          <div class="canvas-history-modal__sidebar-header">
            <h2 class="canvas-history-modal__sidebar-title">Historial de versiones</h2>
            <button type="button" class="component-button component-button--h32 component-button--outline" data-ref="btn-toggle-create-snapshot" aria-label="Nuevo hito" data-tooltip="Guardar punto de control">
              <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#add"></use></svg>
              <span>Nuevo hito</span>
            </button>
          </div>

          <div class="canvas-history-modal__create-form is-hidden" data-ref="history-create-form">
            <div class="canvas-history-modal__create-box">
              <span class="canvas-history-modal__create-title">Crear punto de control</span>
              <label class="field field--sm" data-ref="field-snapshot-name">
                <input class="field__input" data-ref="input-snapshot-name" type="text" placeholder=" " maxlength="255" autocomplete="off" />
                <span class="field__label">Nombre del hito</span>
              </label>
              <label class="field field--sm" data-ref="field-snapshot-description">
                <textarea class="field__input field__textarea" data-ref="input-snapshot-description" placeholder=" " rows="2"></textarea>
                <span class="field__label">Nota opcional</span>
              </label>
              <div class="canvas-history-modal__create-actions">
                <button type="button" class="component-button component-button--h32 component-button--black" data-ref="btn-submit-create-snapshot">
                  <span>Guardar</span>
                </button>
                <button type="button" class="component-button component-button--h32 component-button--outline" data-ref="btn-cancel-create-snapshot">
                  <span>Cancelar</span>
                </button>
              </div>
              <div class="banner banner--danger is-hidden" data-ref="history-create-error"></div>
            </div>
          </div>

          <div class="canvas-history-modal__timeline-container" data-ref="history-timeline-container">
            <div class="canvas-history-modal__timeline-line"></div>
            <div class="canvas-history-modal__loader is-hidden" data-ref="history-loader">
              <div class="skeleton" style="height: 52px; border-radius: 8px; width: 100%;"></div>
              <div class="skeleton" style="height: 52px; border-radius: 8px; width: 100%;"></div>
              <div class="skeleton" style="height: 52px; border-radius: 8px; width: 100%;"></div>
            </div>
            <div class="canvas-history-modal__empty is-hidden" data-ref="history-empty">
              <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#history_toggle_off"></use></svg>
              <span>No hay versiones registradas aún</span>
            </div>
            <div class="canvas-history-modal__timeline-list" data-ref="history-timeline-list"></div>
          </div>

          <div class="canvas-history-modal__sidebar-footer">
            <label class="canvas-history-modal__toggle-label">
              <span>Resaltar los cambios</span>
              <input type="checkbox" class="component-switch" checked data-ref="toggle-highlight-changes" />
            </label>
          </div>
        </aside>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHtml);
  modalEl = document.querySelector<HTMLElement>('[data-ref="canvas-history-modal"]')!;
  renderIcons(modalEl);

  const btnExit = modalEl.querySelector<HTMLButtonElement>('[data-ref="btn-history-exit"]');
  const btnFork = modalEl.querySelector<HTMLButtonElement>('[data-ref="btn-history-fork"]');
  const btnRestore = modalEl.querySelector<HTMLButtonElement>('[data-ref="btn-history-restore"]');
  const btnToggleCreate = modalEl.querySelector<HTMLButtonElement>('[data-ref="btn-toggle-create-snapshot"]');
  const btnSubmitCreate = modalEl.querySelector<HTMLButtonElement>('[data-ref="btn-submit-create-snapshot"]');
  const btnCancelCreate = modalEl.querySelector<HTMLButtonElement>('[data-ref="btn-cancel-create-snapshot"]');
  const createFormEl = modalEl.querySelector<HTMLElement>('[data-ref="history-create-form"]');
  const inputNameEl = modalEl.querySelector<HTMLInputElement>('[data-ref="input-snapshot-name"]');
  const inputDescEl = modalEl.querySelector<HTMLTextAreaElement>('[data-ref="input-snapshot-description"]');
  const createErrorEl = modalEl.querySelector<HTMLElement>('[data-ref="history-create-error"]');
  const timelineListEl = modalEl.querySelector<HTMLElement>('[data-ref="history-timeline-list"]');
  const loaderEl = modalEl.querySelector<HTMLElement>('[data-ref="history-loader"]');
  const emptyEl = modalEl.querySelector<HTMLElement>('[data-ref="history-empty"]');
  const previewContentEl = modalEl.querySelector<HTMLElement>('[data-ref="history-preview-content"]');
  const pagesTrayEl = modalEl.querySelector<HTMLElement>('[data-ref="history-pages-tray"]');
  const pagesListEl = modalEl.querySelector<HTMLElement>('[data-ref="history-pages-list"]');

  let snapshots: CanvasSnapshotItem[] = [];
  let selectedSnapshotUuid: string | 'current' = 'current';
  let currentLiveProjectData: any = null;
  let activePreviewProjectData: any = null;
  let activePreviewPageIndex = 0;
  let isCreateFormOpen = false;
  let isModalVisible = false;

  const setCreateFormVisible = (visible: boolean) => {
    isCreateFormOpen = visible;
    createFormEl?.classList.toggle('is-hidden', !visible);
    if (createErrorEl) createErrorEl.classList.add('is-hidden');
    if (visible) {
      inputNameEl?.focus();
    } else {
      if (inputNameEl) inputNameEl.value = '';
      if (inputDescEl) inputDescEl.value = '';
    }
  };

  const getAuthorInitials = (name?: string | null): string => {
    if (!name) return 'U';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  const renderTimeline = () => {
    if (!timelineListEl) return;

    const currentUserName = currentUser ? (currentUser.username || 'Tú') : 'Usuario';
    const currentUserAvatar = currentUser?.avatar_url;
    const isCurrentActive = selectedSnapshotUuid === 'current';

    const currentCardHtml = `
      <div class="canvas-history-modal__timeline-node ${isCurrentActive ? 'is-active' : ''}" data-ref="snapshot-node-current" data-uuid="current">
        <div class="canvas-history-modal__bullet"></div>
        <div class="canvas-history-modal__card">
          <div class="canvas-history-modal__card-left">
            <span class="canvas-history-modal__card-title">versión actual</span>
            <div class="canvas-history-modal__card-author">
              ${currentUserAvatar
                ? `<img class="canvas-history-modal__card-avatar" src="${currentUserAvatar}" alt="${escapeHtml(currentUserName)}" />`
                : `<div class="canvas-history-modal__card-avatar">${getAuthorInitials(currentUserName)}</div>`
              }
              <span>${escapeHtml(currentUserName)}</span>
            </div>
          </div>
        </div>
      </div>
    `;

    const snapshotCardsHtml = snapshots.map((s) => {
      const isSelected = selectedSnapshotUuid === s.uuid;
      const dateText = formatSnapshotDate(s.created_at);
      const title = s.name && s.is_manual ? escapeHtml(s.name) : dateText;
      const authorName = s.user_name || 'Usuario';
      const authorAvatar = s.user_avatar;

      const deleteBtn = isOwner
        ? `<button type="button" class="component-button component-button--h24 component-button--icon-only canvas-history-modal__card-delete" data-action="delete" data-snap-uuid="${s.uuid}" aria-label="Eliminar versión" data-tooltip="Eliminar versión">
            <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#delete_outline"></use></svg>
          </button>`
        : '';

      return `
        <div class="canvas-history-modal__timeline-node ${isSelected ? 'is-active' : ''}" data-ref="snapshot-node-${s.uuid}" data-uuid="${s.uuid}">
          <div class="canvas-history-modal__bullet"></div>
          <div class="canvas-history-modal__card">
            <div class="canvas-history-modal__card-left">
              <span class="canvas-history-modal__card-title" title="${escapeHtml(s.name || dateText)}">${title}</span>
              <div class="canvas-history-modal__card-author">
                ${authorAvatar
                  ? `<img class="canvas-history-modal__card-avatar" src="${authorAvatar}" alt="${escapeHtml(authorName)}" />`
                  : `<div class="canvas-history-modal__card-avatar">${getAuthorInitials(authorName)}</div>`
                }
                <span>${escapeHtml(authorName)}</span>
              </div>
            </div>
            ${deleteBtn}
          </div>
        </div>
      `;
    }).join('');

    timelineListEl.innerHTML = currentCardHtml + snapshotCardsHtml;
    renderIcons(timelineListEl);

    if (btnRestore) {
      btnRestore.disabled = isCurrentActive;
    }
  };

  const renderPreview = () => {
    if (!previewContentEl) return;
    const project = activePreviewProjectData || currentLiveProjectData;
    if (!project) {
      previewContentEl.innerHTML = '<div style="color: #94a3b8; font-size: 14px;">Sin datos para previsualizar</div>';
      return;
    }

    if (canvasType === 'doc') {
      const pages = Array.isArray(project.pages) && project.pages.length > 0
        ? project.pages
        : [{ id: 'p1', html: project.html || project.content || '<p></p>' }];

      const totalPages = pages.length;
      if (activePreviewPageIndex >= totalPages) {
        activePreviewPageIndex = 0;
      }
      const activePage = pages[activePreviewPageIndex] || pages[0];

      const paperSizeKey = project.settings?.paperSize || 'letter';
      const widthPx = paperSizeKey === 'a4' ? 794 : paperSizeKey === 'a3' ? 1123 : paperSizeKey === 'legal' ? 816 : 816;
      const heightPx = paperSizeKey === 'a4' ? 1123 : paperSizeKey === 'a3' ? 1587 : paperSizeKey === 'legal' ? 1344 : 1056;

      const pageHtml = activePage.html || activePage.content || '<p style="color: #94a3b8;">(Página vacía)</p>';

      previewContentEl.innerHTML = `
        <div class="canvas-history-modal__doc-sheet" style="--doc-paper-width: ${widthPx}px; --doc-paper-height: ${heightPx}px; transform: scale(0.85); transform-origin: top center;">
          ${pageHtml}
        </div>
      `;

      if (totalPages > 1 && pagesTrayEl && pagesListEl) {
        pagesTrayEl.classList.remove('is-hidden');
        pagesListEl.innerHTML = pages.map((_p: any, idx: number) => {
          const isAct = idx === activePreviewPageIndex;
          return `
            <button type="button" class="canvas-history-modal__page-thumb-btn ${isAct ? 'is-active' : ''}" data-page-index="${idx}" aria-label="Página ${idx + 1}">
              <div style="font-size: 8px; color: #94a3b8; padding: 2px;">Doc</div>
              <span class="canvas-history-modal__page-thumb-num">${idx + 1}</span>
            </button>
          `;
        }).join('');
      } else if (pagesTrayEl) {
        pagesTrayEl.classList.add('is-hidden');
      }
    } else if (canvasType === 'presentation') {
      const slides = Array.isArray(project.slides) && project.slides.length > 0
        ? project.slides
        : [{ id: 's1', elements: project.elements || [] }];

      const totalSlides = slides.length;
      if (activePreviewPageIndex >= totalSlides) {
        activePreviewPageIndex = 0;
      }
      const activeSlide = slides[activePreviewPageIndex] || slides[0];

      const canvas = document.createElement('canvas');
      canvas.width = 1280;
      canvas.height = 720;
      canvas.className = 'canvas-history-modal__board-canvas';
      canvas.style.maxWidth = '90vw';
      canvas.style.maxHeight = '75vh';
      canvas.style.aspectRatio = '16 / 9';

      const ctx = canvas.getContext('2d');
      if (ctx) {
        const bg = activeSlide.background || { color: '#ffffff', type: 'solid' };
        ctx.fillStyle = bg.color || '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const elements = Array.isArray(activeSlide.elements) ? activeSlide.elements : [];
        for (const el of elements) {
          if (el.type === 'text' && el.text) {
            ctx.fillStyle = el.style?.fill || '#000000';
            ctx.font = `${el.style?.fontSize || 24}px sans-serif`;
            ctx.fillText(el.text, el.x || 50, (el.y || 50) + (el.style?.fontSize || 24));
          } else if (el.type === 'rect' || el.type === 'shape') {
            ctx.fillStyle = el.style?.fill || '#3b82f6';
            ctx.fillRect(el.x || 0, el.y || 0, el.width || 100, el.height || 100);
          }
        }
      }

      previewContentEl.innerHTML = '';
      previewContentEl.appendChild(canvas);

      if (totalSlides > 1 && pagesTrayEl && pagesListEl) {
        pagesTrayEl.classList.remove('is-hidden');
        pagesListEl.innerHTML = slides.map((_s: any, idx: number) => {
          const isAct = idx === activePreviewPageIndex;
          return `
            <button type="button" class="canvas-history-modal__page-thumb-btn ${isAct ? 'is-active' : ''}" data-page-index="${idx}" aria-label="Diapositiva ${idx + 1}">
              <div style="font-size: 8px; color: #94a3b8; padding: 2px;">16:9</div>
              <span class="canvas-history-modal__page-thumb-num">${idx + 1}</span>
            </button>
          `;
        }).join('');
      } else if (pagesTrayEl) {
        pagesTrayEl.classList.add('is-hidden');
      }
    } else {
      const pages = Array.isArray(project.pages) && project.pages.length > 0
        ? project.pages
        : [{ id: 'p1', elements: project.elements || [], background: project.background }];

      const totalPages = pages.length;
      if (activePreviewPageIndex >= totalPages) {
        activePreviewPageIndex = 0;
      }
      const activePage = pages[activePreviewPageIndex] || pages[0];

      const canvas = document.createElement('canvas');
      canvas.width = 1200;
      canvas.height = 800;
      canvas.className = 'canvas-history-modal__board-canvas';
      canvas.style.maxWidth = '90vw';
      canvas.style.maxHeight = '75vh';

      const ctx = canvas.getContext('2d');
      if (ctx) {
        const bg = activePage.background || project.background || { color: '#ffffff' };
        ctx.fillStyle = bg.color || '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        if (bg.type === 'dots') {
          ctx.fillStyle = bg.dotColor || '#e2e8f0';
          for (let x = 10; x < canvas.width; x += 24) {
            for (let y = 10; y < canvas.height; y += 24) {
              ctx.beginPath();
              ctx.arc(x, y, 1.5, 0, Math.PI * 2);
              ctx.fill();
            }
          }
        }

        const elements = Array.isArray(activePage.elements) ? activePage.elements : [];
        for (const el of elements) {
          if (el.type === 'sticky') {
            ctx.fillStyle = el.style?.fill || '#fef08a';
            ctx.fillRect(el.x || 0, el.y || 0, el.width || 120, el.height || 120);
            if (el.text) {
              ctx.fillStyle = '#1e293b';
              ctx.font = '14px sans-serif';
              ctx.fillText(el.text, (el.x || 0) + 10, (el.y || 0) + 24);
            }
          } else if (el.type === 'text' && el.text) {
            ctx.fillStyle = el.style?.fill || '#0f172a';
            ctx.font = `${el.style?.fontSize || 20}px sans-serif`;
            ctx.fillText(el.text, el.x || 0, (el.y || 0) + (el.style?.fontSize || 20));
          } else if (el.type === 'draw' && Array.isArray(el.points) && el.points.length > 1) {
            ctx.strokeStyle = el.style?.stroke || '#000000';
            ctx.lineWidth = el.style?.strokeWidth || 3;
            ctx.beginPath();
            ctx.moveTo(el.points[0].x, el.points[0].y);
            for (let i = 1; i < el.points.length; i++) {
              ctx.lineTo(el.points[i].x, el.points[i].y);
            }
            ctx.stroke();
          } else {
            ctx.fillStyle = el.style?.fill || '#3b82f6';
            ctx.fillRect(el.x || 0, el.y || 0, el.width || 80, el.height || 80);
          }
        }
      }

      previewContentEl.innerHTML = '';
      previewContentEl.appendChild(canvas);

      if (totalPages > 1 && pagesTrayEl && pagesListEl) {
        pagesTrayEl.classList.remove('is-hidden');
        pagesListEl.innerHTML = pages.map((_p: any, idx: number) => {
          const isAct = idx === activePreviewPageIndex;
          return `
            <button type="button" class="canvas-history-modal__page-thumb-btn ${isAct ? 'is-active' : ''}" data-page-index="${idx}" aria-label="Página ${idx + 1}">
              <div style="font-size: 8px; color: #94a3b8; padding: 2px;">Pizarrón</div>
              <span class="canvas-history-modal__page-thumb-num">${idx + 1}</span>
            </button>
          `;
        }).join('');
      } else if (pagesTrayEl) {
        pagesTrayEl.classList.add('is-hidden');
      }
    }
  };

  const selectSnapshot = async (uuid: string | 'current') => {
    selectedSnapshotUuid = uuid;
    activePreviewPageIndex = 0;
    renderTimeline();

    if (uuid === 'current') {
      activePreviewProjectData = currentLiveProjectData;
      renderPreview();
      if (onExitPreview) onExitPreview();
      return;
    }

    try {
      const res = await getApi(API_ROUTES.canvases.snapshotById(canvasUuid, uuid));
      if (!res.ok) throw new Error('No se pudo cargar la versión.');
      const resData = await res.json();
      const rawData = resData.data;
      const projectData = typeof rawData === 'string' ? JSON.parse(rawData) : rawData;
      activePreviewProjectData = projectData;
      renderPreview();

      if (onPreviewSnapshot) {
        onPreviewSnapshot(uuid, projectData);
      }
    } catch {
      showToast('Error al cargar la versión.', 'error');
    }
  };

  const loadSnapshots = async (): Promise<void> => {
    loaderEl?.classList.remove('is-hidden');
    emptyEl?.classList.add('is-hidden');

    try {
      const res = await getApi(API_ROUTES.canvases.snapshots(canvasUuid));
      if (res.ok) {
        const data = await res.json();
        snapshots = Array.isArray(data.snapshots) ? data.snapshots : [];
      } else {
        snapshots = [];
      }
    } catch {
      snapshots = [];
    } finally {
      loaderEl?.classList.add('is-hidden');
      renderTimeline();
    }
  };

  timelineListEl?.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const deleteBtn = target.closest<HTMLButtonElement>('button[data-action="delete"]');
    if (deleteBtn) {
      e.stopPropagation();
      const snapUuid = deleteBtn.getAttribute('data-snap-uuid');
      if (snapUuid) {
        void (async () => {
          if (!isOwner) {
            showToast('Solo el propietario puede eliminar versiones.', 'error');
            return;
          }
          try {
            const res = await deleteApi(API_ROUTES.canvases.snapshotById(canvasUuid, snapUuid));
            if (!res.ok) throw new Error('Error al eliminar la versión.');
            snapshots = snapshots.filter((s) => s.uuid !== snapUuid);
            if (selectedSnapshotUuid === snapUuid) {
              void selectSnapshot('current');
            } else {
              renderTimeline();
            }
            showToast('Versión eliminada correctamente.', 'success');
          } catch (err: any) {
            showToast(err.message || 'No se pudo eliminar la versión.', 'error');
          }
        })();
      }
      return;
    }

    const node = target.closest<HTMLElement>('.canvas-history-modal__timeline-node');
    if (!node) return;
    const uuid = node.getAttribute('data-uuid');
    if (uuid) {
      void selectSnapshot(uuid);
    }
  });

  pagesListEl?.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('.canvas-history-modal__page-thumb-btn');
    if (!btn) return;
    const idxStr = btn.getAttribute('data-page-index');
    if (idxStr !== null) {
      activePreviewPageIndex = parseInt(idxStr, 10) || 0;
      renderPreview();
    }
  });

  btnToggleCreate?.addEventListener('click', () => {
    setCreateFormVisible(!isCreateFormOpen);
  });

  btnCancelCreate?.addEventListener('click', () => {
    setCreateFormVisible(false);
  });

  btnSubmitCreate?.addEventListener('click', async () => {
    if (!currentUser) {
      showToast('Debes iniciar sesión para guardar versiones.', 'error');
      return;
    }
    const name = inputNameEl?.value.trim() || 'Hito manual';
    const description = inputDescEl?.value.trim() || undefined;

    try {
      const projectData = getCurrentProjectData ? getCurrentProjectData() : currentLiveProjectData;
      let thumbnail: string | undefined;
      if (generateThumbnail) {
        thumbnail = await generateThumbnail();
      }

      const res = await postApi(API_ROUTES.canvases.snapshots(canvasUuid), {
        data: typeof projectData === 'string' ? projectData : JSON.stringify(projectData),
        description,
        is_manual: true,
        name,
        preview_thumbnail: thumbnail,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Error al guardar la versión.');
      }

      setCreateFormVisible(false);
      showToast('Punto de control guardado correctamente.', 'success');
      await loadSnapshots();
    } catch (err: any) {
      if (createErrorEl) {
        createErrorEl.textContent = err.message || 'Error al crear la versión.';
        createErrorEl.classList.remove('is-hidden');
      } else {
        showToast(err.message || 'Error al crear la versión.', 'error');
      }
    }
  });

  btnRestore?.addEventListener('click', async () => {
    if (selectedSnapshotUuid === 'current') return;
    if (!currentUser) {
      showToast('Debes iniciar sesión para restaurar versiones.', 'error');
      return;
    }

    try {
      const res = await postApi(API_ROUTES.canvases.snapshotRestore(canvasUuid, selectedSnapshotUuid), {});
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Error al restaurar la versión.');
      }
      const data = await res.json();
      const restored = typeof data.restoredData === 'string' ? JSON.parse(data.restoredData) : data.restoredData;

      if (onRestoreSnapshot) {
        await onRestoreSnapshot(selectedSnapshotUuid, restored);
      }
      showToast('Versión restaurada correctamente.', 'success');
      closeModal();
    } catch (err: any) {
      showToast(err.message || 'No se pudo restaurar la versión.', 'error');
    }
  });

  btnFork?.addEventListener('click', async () => {
    if (!currentUser) {
      showToast('Debes iniciar sesión para duplicar versiones.', 'error');
      return;
    }

    try {
      if (selectedSnapshotUuid === 'current') {
        showToast('Creando copia del lienzo actual...', 'info');
        const projectData = getCurrentProjectData ? getCurrentProjectData() : currentLiveProjectData;
        const res = await postApi(API_ROUTES.canvases.base, {
          access_level: 'private',
          canvas_type: canvasType,
          data: typeof projectData === 'string' ? projectData : JSON.stringify(projectData),
          name: `${canvasTitle} - Copia`,
        });
        if (!res.ok) throw new Error('Error al crear la copia.');
        const data = await res.json();
        showToast('Copia creada correctamente.', 'success');
        if (data.canvas?.uuid) {
          const route = canvasType === 'doc' ? `/doc/${data.canvas.uuid}` : canvasType === 'presentation' ? `/presentation/${data.canvas.uuid}` : `/board/${data.canvas.uuid}`;
          window.location.href = route;
        }
        return;
      }

      const res = await postApi(API_ROUTES.canvases.snapshotFork(canvasUuid, selectedSnapshotUuid), {});
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Error al crear la copia.');
      }
      const data = await res.json();
      showToast('Copia creada a partir de la versión seleccionada.', 'success');
      if (data.canvas?.uuid) {
        const route = canvasType === 'doc' ? `/doc/${data.canvas.uuid}` : canvasType === 'presentation' ? `/presentation/${data.canvas.uuid}` : `/board/${data.canvas.uuid}`;
        window.location.href = route;
      }
    } catch (err: any) {
      showToast(err.message || 'No se pudo duplicar la versión.', 'error');
    }
  });

  const closeModal = () => {
    if (!isModalVisible) return;
    isModalVisible = false;
    modalEl?.classList.add('is-hidden');
    document.body.style.overflow = '';
    if (onExitPreview) {
      onExitPreview();
    }
  };

  const openModal = () => {
    isModalVisible = true;
    if (getCurrentProjectData) {
      currentLiveProjectData = getCurrentProjectData();
    }
    activePreviewProjectData = currentLiveProjectData;
    selectedSnapshotUuid = 'current';
    activePreviewPageIndex = 0;
    modalEl?.classList.remove('is-hidden');
    document.body.style.overflow = 'hidden';
    setCreateFormVisible(false);
    renderTimeline();
    renderPreview();
    void loadSnapshots();
  };

  btnExit?.addEventListener('click', () => {
    closeModal();
  });

  if (options.trigger) {
    options.trigger.addEventListener('click', () => {
      openModal();
    });
  }

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && isModalVisible) {
      closeModal();
    }
  };
  window.addEventListener('keydown', handleKeyDown);

  if (signal) {
    signal.addEventListener('abort', () => {
      window.removeEventListener('keydown', handleKeyDown);
      modalEl?.remove();
    });
  }

  return {
    close: closeModal,
    destroy: () => {
      window.removeEventListener('keydown', handleKeyDown);
      modalEl?.remove();
    },
    isOpen: () => isModalVisible,
    open: openModal,
    reloadSnapshots: loadSnapshots,
    toggle: () => (isModalVisible ? closeModal() : openModal()),
    update: () => {
      renderTimeline();
      renderPreview();
    },
  };
}
