import { currentUser, deleteUploadApi, escapeHtml, getUploadsApi, uploadFilesApi } from '../../services/api.service.js';
import { t } from '../../services/i18n.service.js';
import { renderIcons } from '../../services/icon.service.js';
import { showToast } from '../../services/toast.service.js';
import { UserUploadItem } from '../../types/upload.types.js';
import { formatVideoDuration, validateAndSanitizeFiles } from '../../utils/validators.util.js';
import { getActiveCanvasController, getActiveCanvasType, toggleDrawer, updateCanvasRailActiveState } from '../layout.component.js';
import { openModal } from '../modal.component.js';

export function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  if (i === 0) return `${bytes} B`;
  const rawValue = bytes / Math.pow(1024, i);
  const formatted = rawValue % 1 === 0 ? rawValue.toString() : rawValue.toFixed(rawValue >= 100 || i >= 3 ? 1 : 2);
  return `${formatted} ${units[i]}`;
}

export function handleApplyCanvasUpload(item: UserUploadItem, canvasType: 'board' | 'doc' | 'presentation' | 'video'): void {
  const controller = getActiveCanvasController();

  if (canvasType === 'video') {
    if (!controller) {
      showToast('No se encontró el controlador del video', 'warning');
      return;
    }

    if (item.media_type === 'video') {
      controller.insertVideo?.({
        duration: item.duration_seconds || 5,
        height: item.height || undefined,
        thumbnailUrl: item.thumbnail_url || '',
        title: item.original_filename,
        url: item.url,
        width: item.width || undefined,
      });
      showToast(`Video «${item.original_filename}» añadido al proyecto`, 'success');
    } else if (item.mime_type && item.mime_type.startsWith('audio/')) {
      controller.insertAudio?.({
        duration: item.duration_seconds || 10,
        title: item.original_filename,
        url: item.url,
      });
      showToast(`Audio «${item.original_filename}» añadido a la pista de audio`, 'success');
    } else {
      controller.insertImage?.({
        height: item.height || undefined,
        title: item.original_filename,
        url: item.url,
        width: item.width || undefined,
      });
      showToast(`Imagen «${item.original_filename}» añadida al video`, 'success');
    }
    if (window.innerWidth <= 768) {
      toggleDrawer(false);
    }
    return;
  }

  if (item.media_type === 'video') {
    if (canvasType === 'doc') {
      if (!controller) {
        showToast('No se encontró el controlador del documento', 'warning');
        return;
      }

      controller.insertVideo?.(item.url, item.original_filename, item.thumbnail_url || '');
      showToast(`Video «${item.original_filename}» insertado en el documento`, 'success');
      if (window.innerWidth <= 768) {
        toggleDrawer(false);
      }
      return;
    }

    if (canvasType === 'board' || canvasType === 'presentation') {
      if (!controller) {
        showToast('No se encontró el controlador del lienzo', 'warning');
        return;
      }

      controller.insertVideo?.({
        duration: item.duration_seconds || undefined,
        height: item.height || undefined,
        thumbnailUrl: item.thumbnail_url || '',
        title: item.original_filename,
        url: item.url,
        width: item.width || undefined,
      });
      if (window.innerWidth <= 768) {
        toggleDrawer(false);
      }
      return;
    }
    return;
  }

  if (canvasType === 'doc') {
    if (!controller) {
      showToast('No se encontró el controlador del documento', 'warning');
      return;
    }

    controller.insertImage(item.url, item.original_filename);
    showToast(`«${item.original_filename}» insertada en el documento`, 'success');
    if (window.innerWidth <= 768) {
      toggleDrawer(false);
    }
    return;
  }

  if (canvasType === 'board' || canvasType === 'presentation') {
    if (!controller) {
      showToast('No se encontró el controlador del lienzo', 'warning');
      return;
    }

    controller.insertImage?.(item.url, item.width || undefined, item.height || undefined, item.original_filename);
    showToast(`«${item.original_filename}» añadida al lienzo`, 'success');
    if (window.innerWidth <= 768) {
      toggleDrawer(false);
    }
    return;
  }
}

export function renderUploadsDrawerContent(drawer: HTMLElement, drawerBody: HTMLElement): void {
  const sidebar = drawer.closest<HTMLElement>('[data-ref="sidebar"]') || document.querySelector<HTMLElement>('[data-ref="sidebar"]');
  const canvasType = getActiveCanvasType();

  drawerBody.innerHTML = `
    <div class="canvas-panel-card" data-ref="canvas-panel-card">
      <div class="canvas-panel-card__header" data-ref="canvas-panel-header">
        <div class="canvas-panel-card__title-box" data-ref="canvas-panel-title-box">
          <svg class="component-icon canvas-panel-card__icon" aria-hidden="true"><use href="/icons.svg#cloud_upload"></use></svg>
          <span class="canvas-panel-card__title" data-ref="canvas-panel-title">${t('nav.uploads') || 'Subidos'}</span>
        </div>
        <div style="display: flex; align-items: center; gap: 4px;">
          <button type="button" class="component-button component-button--h32 component-button--icon-only rail-btn" data-ref="btn-upload-file-trigger" data-tooltip="Subir fotos o videos" aria-label="Subir fotos o videos">
            <svg class="component-icon rail-btn__icon" aria-hidden="true"><use href="/icons.svg#add"></use></svg>
          </button>
          <button type="button" class="component-button component-button--h32 component-button--icon-only rail-btn canvas-panel-card__close" data-ref="btn-close-canvas-panel" data-tooltip="Cerrar panel" aria-label="Cerrar panel">
            <svg class="component-icon rail-btn__icon" aria-hidden="true"><use href="/icons.svg#close"></use></svg>
          </button>
        </div>
      </div>
      <div class="canvas-uploads-filter-bar" data-ref="canvas-uploads-tabs" style="display: flex; gap: 4px; padding: 4px 12px 8px 12px; border-bottom: 1px solid var(--border-color, rgba(255,255,255,0.08));">
        <button type="button" class="component-button component-button--h28 component-button--ghost is-active" data-ref="tab-filter-all" data-tab-filter="all" style="font-size: 12px; padding: 0 10px; border-radius: 6px;">Todos</button>
        <button type="button" class="component-button component-button--h28 component-button--ghost" data-ref="tab-filter-images" data-tab-filter="image" style="font-size: 12px; padding: 0 10px; border-radius: 6px;">Imágenes</button>
        <button type="button" class="component-button component-button--h28 component-button--ghost" data-ref="tab-filter-videos" data-tab-filter="video" style="font-size: 12px; padding: 0 10px; border-radius: 6px;">Videos</button>
      </div>
      <div class="canvas-panel-card__body" data-ref="canvas-panel-body">
        <input class="canvas-upload-file-input" data-ref="canvas-upload-file-input" type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/avif,image/svg+xml,video/mp4,video/webm,video/quicktime,video/x-m4v,video/ogg" multiple style="display: none;" />

        <div class="menu-panel__search" data-ref="canvas-uploads-search">
          <svg class="component-icon menu-panel__search-icon" aria-hidden="true"><use href="/icons.svg#search"></use></svg>
          <input class="menu-panel__search-input" data-ref="canvas-uploads-search-input" type="text" maxlength="50" autocomplete="off" placeholder="Buscar fotos y videos..." />
        </div>

        <div class="elements-grid" data-ref="canvas-uploads-grid">
          <div class="skeleton" style="aspect-ratio: 1 / 1; border-radius: 8px;"></div>
          <div class="skeleton" style="aspect-ratio: 1 / 1; border-radius: 8px;"></div>
          <div class="skeleton" style="aspect-ratio: 1 / 1; border-radius: 8px;"></div>
          <div class="skeleton" style="aspect-ratio: 1 / 1; border-radius: 8px;"></div>
          <div class="skeleton" style="aspect-ratio: 1 / 1; border-radius: 8px;"></div>
          <div class="skeleton" style="aspect-ratio: 1 / 1; border-radius: 8px;"></div>
        </div>
      </div>
    </div>
  `;

  const btnClose = drawerBody.querySelector<HTMLElement>('[data-ref="btn-close-canvas-panel"]');
  btnClose?.addEventListener('click', (e) => {
    e.preventDefault();
    toggleDrawer(false);
  });

  const btnUploadTrigger = drawerBody.querySelector<HTMLButtonElement>('[data-ref="btn-upload-file-trigger"]');
  const fileInput = drawerBody.querySelector<HTMLInputElement>('[data-ref="canvas-upload-file-input"]');
  const searchInput = drawerBody.querySelector<HTMLInputElement>('[data-ref="canvas-uploads-search-input"]');
  const grid = drawerBody.querySelector<HTMLElement>('[data-ref="canvas-uploads-grid"]');
  const tabFilterBtns = drawerBody.querySelectorAll<HTMLButtonElement>('[data-tab-filter]');

  let uploads: UserUploadItem[] = [];
  let currentFilter: 'all' | 'image' | 'video' = 'all';
  let isUploading = false;

  const renderGrid = (query = '') => {
    if (!grid) return;
    const cleanQ = query.trim().toLowerCase();

    let filtered = uploads;
    if (currentFilter === 'image') {
      filtered = filtered.filter((u) => u.media_type === 'image');
    } else if (currentFilter === 'video') {
      filtered = filtered.filter((u) => u.media_type === 'video');
    }

    if (cleanQ) {
      filtered = filtered.filter((u) => u.original_filename.toLowerCase().includes(cleanQ));
    }

    if (filtered.length === 0) {
      if (uploads.length === 0) {
        grid.innerHTML = `
          <div class="canvas-panel-card__empty" data-ref="canvas-uploads-empty" style="grid-column: 1 / -1;">
            <div class="canvas-panel-card__empty-icon">
              <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#cloud_upload"></use></svg>
            </div>
            <span class="canvas-panel-card__empty-title">Aún no tienes archivos subidos</span>
            <p class="canvas-panel-card__empty-desc">Sube fotos o videos para colocarlos e interactuar en tus lienzos.</p>
            <button type="button" class="component-button component-button--h36 component-button--black" data-ref="btn-upload-empty-trigger" style="margin-top: 8px;">
              <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#add"></use></svg>
              <span>Subir fotos y videos</span>
            </button>
          </div>
        `;
        const btnEmptyUpload = grid.querySelector<HTMLButtonElement>('[data-ref="btn-upload-empty-trigger"]');
        btnEmptyUpload?.addEventListener('click', () => {
          fileInput?.click();
        });
      } else {
        grid.innerHTML = `
          <div class="canvas-panel-card__empty" data-ref="canvas-uploads-no-results" style="grid-column: 1 / -1;">
            <span class="canvas-panel-card__empty-title">Sin resultados</span>
            <p class="canvas-panel-card__empty-desc">No se encontraron archivos en «${currentFilter === 'video' ? 'Videos' : currentFilter === 'image' ? 'Imágenes' : 'Todos'}» que coincidan con «${escapeHtml(query)}»</p>
          </div>
        `;
      }
      renderIcons(grid);
      return;
    }

    grid.innerHTML = filtered.map((item) => {
      const isVideo = item.media_type === 'video';
      const previewSrc = isVideo ? (item.thumbnail_url || item.url) : item.url;
      const durationBadge = isVideo && item.duration_seconds
        ? `<div class="canvas-upload-badge canvas-upload-badge--video" style="position: absolute; bottom: 6px; right: 6px; display: flex; align-items: center; gap: 3px; background: rgba(0,0,0,0.75); color: #ffffff; padding: 2px 6px; border-radius: 4px; font-size: 11px; font-weight: 600; pointer-events: none; backdrop-filter: blur(4px);"><svg class="component-icon" style="width: 12px; height: 12px;" aria-hidden="true"><use href="/icons.svg#play_arrow"></use></svg><span>${formatVideoDuration(item.duration_seconds)}</span></div>`
        : isVideo
        ? `<div class="canvas-upload-badge canvas-upload-badge--video" style="position: absolute; bottom: 6px; right: 6px; display: flex; align-items: center; gap: 3px; background: rgba(0,0,0,0.75); color: #ffffff; padding: 2px 6px; border-radius: 4px; font-size: 11px; font-weight: 600; pointer-events: none; backdrop-filter: blur(4px);"><svg class="component-icon" style="width: 12px; height: 12px;" aria-hidden="true"><use href="/icons.svg#movie"></use></svg></div>`
        : '';

      return `
        <button type="button" class="element-grid-item" data-ref="btn-upload-item-${item.uuid}" data-upload-uuid="${item.uuid}" draggable="true" data-tooltip="${escapeHtml(item.original_filename)}" aria-label="${escapeHtml(item.original_filename)}" style="position: relative; cursor: grab;">
          <img class="canvas-upload-img image-lazy-fade" data-ref="img-upload-${item.uuid}" src="${escapeHtml(previewSrc)}" alt="${escapeHtml(item.original_filename)}" loading="lazy" decoding="async" draggable="false" style="pointer-events: none;" onload="this.classList.add('image-loaded')" onerror="this.classList.add('image-loaded')" />
          ${durationBadge}
          <button type="button" class="canvas-upload-card__delete" data-ref="btn-delete-upload-${item.uuid}" data-delete-uuid="${item.uuid}" data-tooltip="Eliminar ${isVideo ? 'video' : 'imagen'}" aria-label="Eliminar ${isVideo ? 'video' : 'imagen'}">
            <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#delete"></use></svg>
          </button>
        </button>
      `;
    }).join('');

    renderIcons(grid);

    grid.querySelectorAll<HTMLElement>('.element-grid-item').forEach((card) => {
      card.addEventListener('dragstart', (e) => {
        const uuid = card.getAttribute('data-upload-uuid');
        const found = uploads.find((u) => u.uuid === uuid);
        if (!found) return;

        const isVid = found.media_type === 'video';
        const isAud = (found as any).media_type === 'audio' || Boolean(found.mime_type && found.mime_type.startsWith('audio/'));
        const mediaType = isVid ? 'video' : (isAud ? 'audio' : 'image');
        const dur = Math.max(1, found.duration_seconds || (isVid ? 5 : (isAud ? 10 : 4)));

        const clipData = {
          assetUrl: found.url,
          duration: dur,
          mediaType,
          name: found.original_filename || (isVid ? 'Video' : (isAud ? 'Audio' : 'Foto')),
          sourceDuration: dur,
          thumbnailUrl: found.thumbnail_url || (isVid ? found.url : ''),
          trimEnd: dur,
          trimStart: 0,
        };

        if (e.dataTransfer) {
          e.dataTransfer.setData('application/json', JSON.stringify(clipData));
          e.dataTransfer.setData('spriteboard/clip-data', JSON.stringify(clipData));
          e.dataTransfer.setData('spriteboard/internal-upload', uuid || '');
          e.dataTransfer.setData('text/plain', found.url);
          e.dataTransfer.setData('text/uri-list', found.url);
          e.dataTransfer.effectAllowed = 'copy';
        }
      });

      card.addEventListener('click', (e) => {
        const target = e.target as HTMLElement | null;
        if (target?.closest('[data-delete-uuid]')) return;
        const uuid = card.getAttribute('data-upload-uuid');
        const found = uploads.find((u) => u.uuid === uuid);
        if (found) {
          handleApplyCanvasUpload(found, canvasType);
        }
      });
    });

    grid.querySelectorAll<HTMLButtonElement>('[data-delete-uuid]').forEach((btnDel) => {
      btnDel.addEventListener('click', (e) => {
        e.stopPropagation();
        const uuid = btnDel.getAttribute('data-delete-uuid');
        const found = uploads.find((u) => u.uuid === uuid);
        if (!found) return;

        openModal({
          cancelText: 'Cancelar',
          confirmClass: 'component-button--danger',
          confirmText: 'Eliminar',
          description: `¿Estás seguro de que deseas eliminar «${found.original_filename}»? Esta acción liberará espacio de tu cuenta.`,
          showCancel: true,
          showConfirm: true,
          title: `Eliminar ${found.media_type === 'video' ? 'video' : 'imagen'}`,
          onConfirm: async () => {
            const res = await deleteUploadApi(found.uuid);
            if (res.success) {
              showToast('Archivo eliminado con éxito', 'success');
              uploads = uploads.filter((u) => u.uuid !== found.uuid);
              renderGrid(searchInput?.value || '');
            } else {
              showToast(res.message || 'Error al eliminar el archivo.', 'danger');
            }
          },
        });
      });
    });
  };

  tabFilterBtns.forEach((tabBtn) => {
    tabBtn.addEventListener('click', () => {
      tabFilterBtns.forEach((b) => b.classList.remove('is-active'));
      tabBtn.classList.add('is-active');
      currentFilter = (tabBtn.getAttribute('data-tab-filter') as 'all' | 'image' | 'video') || 'all';
      renderGrid(searchInput?.value || '');
    });
  });

  const handleFiles = async (files: FileList | File[]) => {
    if (!currentUser) {
      showToast('Debes iniciar sesión para subir fotos y videos.', 'warning');
      return;
    }
    const validation = validateAndSanitizeFiles(files, { maxMb: 1024 });
    if (!validation.valid) {
      showToast(validation.error || 'Por favor selecciona archivos compatibles (PNG, JPG, WEBP, GIF, SVG, MP4, WebM, MOV).', 'warning');
      return;
    }

    if (isUploading) return;
    isUploading = true;
    showToast('Subiendo archivo(s)...', 'info');

    const railUploadBtns = document.querySelectorAll<HTMLElement>('[data-ref="btn-rail-canvas-uploads"]');
    railUploadBtns.forEach((b) => b.classList.add('is-uploading'));
    if (btnUploadTrigger) {
      btnUploadTrigger.disabled = true;
    }

    if (grid && uploads.length > 0) {
      const placeholder = document.createElement('div');
      placeholder.className = 'element-grid-item';
      placeholder.setAttribute('data-ref', 'upload-item-placeholder');
      placeholder.innerHTML = `
        <div class="skeleton" style="width: 100%; height: 100%; border-radius: 6px; display: flex; align-items: center; justify-content: center;">
          <svg class="component-icon" style="width: 18px; height: 18px; animation: railBtnUploadSpin 0.75s linear infinite; color: var(--accent-pink);" aria-hidden="true"><use href="/icons.svg#sync"></use></svg>
        </div>
      `;
      grid.prepend(placeholder);
    }

    try {
      const res = await uploadFilesApi(validation.files);
      if (res.success) {
        showToast(res.message || 'Archivos subidos correctamente.', 'success');
        if (res.uploads && res.uploads.length > 0) {
          uploads = [...res.uploads, ...uploads];
        }
        renderGrid(searchInput?.value || '');
      } else {
        showToast(res.message || 'Error al subir los archivos.', 'danger');
        renderGrid(searchInput?.value || '');
      }
    } catch {
      showToast('Error al subir los archivos.', 'danger');
      renderGrid(searchInput?.value || '');
    } finally {
      isUploading = false;
      railUploadBtns.forEach((b) => b.classList.remove('is-uploading'));
      if (btnUploadTrigger) {
        btnUploadTrigger.disabled = false;
      }
    }
  };

  btnUploadTrigger?.addEventListener('click', () => {
    fileInput?.click();
  });

  fileInput?.addEventListener('change', () => {
    if (fileInput.files && fileInput.files.length > 0) {
      void handleFiles(fileInput.files);
      fileInput.value = '';
    }
  });

  drawerBody.addEventListener('dragover', (e) => {
    e.preventDefault();
  });

  drawerBody.addEventListener('drop', (e) => {
    e.preventDefault();
    if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
      void handleFiles(e.dataTransfer.files);
    }
  });

  searchInput?.addEventListener('input', () => {
    renderGrid(searchInput.value);
  });

  const handleExternalUploads = (e: Event) => {
    const customEvent = e as CustomEvent<UserUploadItem[]>;
    if (customEvent.detail && Array.isArray(customEvent.detail) && customEvent.detail.length > 0) {
      uploads = [...customEvent.detail, ...uploads];
      renderGrid(searchInput?.value || '');
    }
  };
  window.addEventListener('spriteboard:uploads-updated', handleExternalUploads);

  if (!currentUser) {
    uploads = [];
    renderGrid();
  } else {
    void getUploadsApi().then((res) => {
      if (res.success) {
        uploads = res.uploads || [];
      } else {
        uploads = [];
      }
      renderGrid(searchInput?.value || '');
    });
  }

  const drawerFooter = drawer.querySelector<HTMLElement>('[data-ref="drawer-footer"]');
  if (drawerFooter) {
    drawerFooter.style.display = 'none';
  }

  if (sidebar) {
    updateCanvasRailActiveState(sidebar);
  }

  renderIcons(drawerBody);
}
