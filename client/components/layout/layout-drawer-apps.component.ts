import { APP_CATEGORIES, getAppById, searchApps } from '../../config/apps.config.js';
import { AppCategory } from '../../types/apps.types.js';
import { GoogleDriveFile, connectGoogleDrive, disconnectGoogleDrive, fetchGoogleDriveFileBlob, formatFileSize, getGoogleDriveUser, isGoogleDriveConnected, listGoogleDriveFiles, openGooglePicker, uploadCanvasExportToDrive } from '../../services/google-drive.service.js';
import { GooglePhotoItem, connectGooglePhotos, disconnectGooglePhotos, fetchPhotoBlob, getGooglePhotosUser, isGooglePhotosConnected, listGooglePhotos, listGooglePhotosAlbums, openGooglePhotosPicker } from '../../services/google-photos.service.js';
import { MAP_PRESET_LOCATIONS, MapStyleOption, MapTypeOption, buildStaticMapUrl, fetchMapImageBlob, getGoogleMapsExternalUrl } from '../../services/google-maps.service.js';
import { escapeHtml } from '../../services/api.service.js';
import { getActiveCanvasController, getActiveCanvasType, toggleDrawer, updateCanvasRailActiveState } from '../layout.component.js';
import { openYouTubePlayerModal, searchYouTubeVideos } from '../../services/youtube.service.js';
import { renderIcons } from '../../services/icon.service.js';
import { showToast } from '../../services/toast.service.js';

let activeAppId: string | null = null;
let activeAppCategory: AppCategory = 'all';

export function getActiveAppId(): string | null {
  return activeAppId;
}

export function setActiveAppId(id: string | null): void {
  activeAppId = id;
}

function renderYouTubeAppContent(drawer: HTMLElement, drawerBody: HTMLElement): void {
  const sidebar = drawer.closest<HTMLElement>('[data-ref="sidebar"]') || document.querySelector<HTMLElement>('[data-ref="sidebar"]');

  drawerBody.innerHTML = `
    <div class="canvas-panel-card" data-ref="canvas-panel-card">
      <div class="canvas-panel-card__header" data-ref="canvas-panel-header">
        <div class="canvas-panel-card__title-box" data-ref="canvas-panel-title-box">
          <svg class="canvas-panel-card__icon" viewBox="0 0 24 24" aria-hidden="true" style="fill: #ef4444;"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
          <span class="canvas-panel-card__title" data-ref="canvas-panel-title">YouTube</span>
        </div>
        <button type="button" class="component-button component-button--h32 component-button--icon-only rail-btn canvas-panel-card__close" data-ref="btn-close-canvas-panel" data-tooltip="Cerrar panel" aria-label="Cerrar panel">
          <svg class="component-icon rail-btn__icon" aria-hidden="true"><use href="/icons.svg#close"></use></svg>
        </button>
      </div>
      <div class="canvas-panel-card__body youtube-drawer-body" data-ref="canvas-panel-body">
        <button type="button" class="elements-back-btn" data-ref="btn-apps-back" style="margin-bottom: 12px;">
          <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#arrow_back"></use></svg>
          <span>Volver a Apps</span>
        </button>

        <div class="menu-panel__search" data-ref="youtube-search-wrapper">
          <svg class="component-icon menu-panel__search-icon" aria-hidden="true"><use href="/icons.svg#search"></use></svg>
          <input class="menu-panel__search-input" data-ref="youtube-search-input" type="text" maxlength="80" autocomplete="off" placeholder="Buscar en YouTube..." />
        </div>

        <div class="youtube-chips-row" data-ref="youtube-chips">
          <button type="button" class="mockup-category-pill" data-ref="chip-yt-spriteboard" data-query="Spriteboard">Spriteboard</button>
          <button type="button" class="mockup-category-pill" data-ref="chip-yt-tutorial" data-query="Diseño tutorial">Tutorial</button>
          <button type="button" class="mockup-category-pill" data-ref="chip-yt-music" data-query="Musica lofi">Música</button>
          <button type="button" class="mockup-category-pill" data-ref="chip-yt-pixel" data-query="Pixel art speedpaint">Pixel Art</button>
          <button type="button" class="mockup-category-pill" data-ref="chip-yt-animation" data-query="2D Animation">Animación</button>
        </div>

        <div class="youtube-results-container" data-ref="youtube-results-container">
          <div class="youtube-initial-state" data-ref="youtube-initial-state">
            <div class="youtube-initial-icon" data-ref="youtube-initial-icon">
              <svg viewBox="0 0 24 24" aria-hidden="true" style="width: 44px; height: 44px; fill: #ef4444;"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
            </div>
            <span class="youtube-initial-title" data-ref="youtube-initial-title">Busca videos en YouTube</span>
            <span class="youtube-initial-desc" data-ref="youtube-initial-desc">Escribe en el buscador o pulsa una sugerencia para encontrar e insertar videos en tu lienzo.</span>
          </div>
        </div>
      </div>
    </div>
  `;

  const btnBack = drawerBody.querySelector<HTMLButtonElement>('[data-ref="btn-apps-back"]');
  btnBack?.addEventListener('click', () => {
    activeAppId = null;
    renderAppsDrawerContent(drawer, drawerBody);
  });

  const btnClose = drawerBody.querySelector<HTMLElement>('[data-ref="btn-close-canvas-panel"]');
  btnClose?.addEventListener('click', (e) => {
    e.preventDefault();
    toggleDrawer(false);
  });

  const searchInput = drawerBody.querySelector<HTMLInputElement>('[data-ref="youtube-search-input"]');
  const resultsContainer = drawerBody.querySelector<HTMLElement>('[data-ref="youtube-results-container"]');

  let debounceTimer: number | null = null;

  const performSearch = async (query: string) => {
    if (!resultsContainer) return;
    const cleanQ = query.trim();
    if (!cleanQ) {
      resultsContainer.innerHTML = `
        <div class="youtube-initial-state" data-ref="youtube-initial-state">
          <div class="youtube-initial-icon" data-ref="youtube-initial-icon">
            <svg viewBox="0 0 24 24" aria-hidden="true" style="width: 44px; height: 44px; fill: #ef4444;"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
          </div>
          <span class="youtube-initial-title" data-ref="youtube-initial-title">Busca videos en YouTube</span>
          <span class="youtube-initial-desc" data-ref="youtube-initial-desc">Escribe en el buscador o pulsa una sugerencia para encontrar e insertar videos en tu lienzo.</span>
        </div>
      `;
      return;
    }

    resultsContainer.innerHTML = `
      <div class="youtube-loading-state" data-ref="youtube-loading-state">
        <div class="component-spinner" style="width: 28px; height: 28px; border-width: 3px; border-color: #ef4444; border-top-color: transparent;"></div>
        <span style="font-size: 13px; color: var(--text-secondary);">Buscando en YouTube...</span>
      </div>
    `;

    const videos = await searchYouTubeVideos(cleanQ);

    if (videos.length === 0) {
      resultsContainer.innerHTML = `
        <div class="mockup-empty-state" data-ref="youtube-empty">
          No se encontraron videos para «${escapeHtml(cleanQ)}». Intenta con otra búsqueda.
        </div>
      `;
      return;
    }

    resultsContainer.innerHTML = `
      <div class="youtube-results-grid" data-ref="youtube-results-grid">
        ${videos.map((v) => `
          <div class="youtube-video-card" data-ref="youtube-video-card-${v.id}" data-video-id="${v.id}">
            <div class="youtube-video-card__thumb-box" data-ref="youtube-thumb-box-${v.id}">
              <img class="youtube-video-card__img" data-ref="youtube-img-${v.id}" src="${v.thumbnailUrl}" alt="${escapeHtml(v.title)}" loading="lazy" />
              <div class="youtube-video-card__overlay" data-ref="youtube-overlay-${v.id}">
                <button type="button" class="youtube-video-card__play-btn" data-ref="btn-preview-yt-${v.id}" data-tooltip="Previsualizar video" aria-label="Previsualizar">
                  <svg viewBox="0 0 24 24" aria-hidden="true" style="width: 20px; height: 20px; fill: #ffffff;"><path d="M8 5v14l11-7z"/></svg>
                </button>
              </div>
            </div>
            <div class="youtube-video-card__info" data-ref="youtube-info-${v.id}">
              <span class="youtube-video-card__title" data-ref="youtube-title-${v.id}" title="${escapeHtml(v.title)}">${escapeHtml(v.title)}</span>
              <span class="youtube-video-card__channel" data-ref="youtube-channel-${v.id}">${escapeHtml(v.channelTitle)}</span>
            </div>
          </div>
        `).join('')}
      </div>
    `;

    resultsContainer.querySelectorAll<HTMLElement>('.youtube-video-card').forEach((card) => {
      const vidId = card.getAttribute('data-video-id');
      const item = videos.find((v) => v.id === vidId);
      if (!item) return;

      const previewBtn = card.querySelector<HTMLButtonElement>(`[data-ref="btn-preview-yt-${item.id}"]`);
      previewBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        openYouTubePlayerModal(item.id, item.title);
      });

      card.addEventListener('click', () => {
        const canvasType = getActiveCanvasType();
        const controller = getActiveCanvasController();

        if (canvasType === 'doc') {
          if (!controller) {
            showToast('No se encontró el controlador del documento', 'warning');
            return;
          }
          if (typeof controller.insertYouTubeEmbed === 'function') {
            controller.insertYouTubeEmbed(item.id, item.title);
          } else {
            showToast('No se pudo insertar el video en el documento', 'warning');
          }
        } else if (canvasType === 'presentation') {
          if (!controller) {
            showToast('No se encontró el controlador de la presentación', 'warning');
            return;
          }
          if (typeof controller.insertYouTube === 'function') {
            controller.insertYouTube(item);
          }
        } else {
          if (!controller) {
            showToast('No se encontró el controlador del lienzo', 'warning');
            return;
          }
          if (typeof controller.insertYouTube === 'function') {
            controller.insertYouTube(item);
          }
        }

        if (window.innerWidth <= 768) {
          toggleDrawer(false);
        }
      });
    });

    renderIcons(resultsContainer);
  };

  searchInput?.addEventListener('input', () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = window.setTimeout(() => {
      void performSearch(searchInput.value);
    }, 450);
  });

  drawerBody.querySelectorAll<HTMLButtonElement>('[data-query]').forEach((chip) => {
    chip.addEventListener('click', () => {
      const q = chip.getAttribute('data-query');
      if (q && searchInput) {
        searchInput.value = q;
        void performSearch(q);
      }
    });
  });

  if (sidebar) {
    updateCanvasRailActiveState(sidebar);
  }
  renderIcons(drawerBody);
}

let driveFolderStack: Array<{ id: string; name: string }> = [{ id: 'root', name: 'Mi unidad' }];
let driveActiveFilter: 'all' | 'documents' | 'folders' | 'images' = 'all';
let driveSearchQuery = '';

async function handleInsertDriveFile(file: GoogleDriveFile): Promise<void> {
  const canvasType = getActiveCanvasType();
  const controller = getActiveCanvasController();

  if (!controller) {
    showToast('No se encontró el controlador del lienzo activo', 'warning');
    return;
  }

  if (file.isImage) {
    showToast(`Cargando «${file.name}» desde Drive...`, 'info');
    try {
      const result = await fetchGoogleDriveFileBlob(file.id);
      if (canvasType === 'doc') {
        controller.insertImage(result.dataUrl, file.name, '60%');
      } else {
        controller.insertImage?.(result.dataUrl, undefined, undefined, file.name);
      }
      showToast(`«${file.name}» insertada en el lienzo`, 'success');
      if (window.innerWidth <= 768) {
        toggleDrawer(false);
      }
    } catch {
      showToast('Error al descargar la imagen desde Google Drive', 'danger');
    }
    return;
  }

  if (file.isPdf || file.isDoc) {
    if (file.thumbnailLink) {
      showToast(`Insertando vista previa de «${file.name}»...`, 'info');
      try {
        const result = await fetchGoogleDriveFileBlob(file.id);
        if (canvasType === 'doc') {
          controller.insertImage(result.dataUrl, file.name, '60%');
        } else {
          controller.insertImage?.(result.dataUrl, undefined, undefined, file.name);
        }
        showToast(`«${file.name}» insertado en el lienzo`, 'success');
        if (window.innerWidth <= 768) {
          toggleDrawer(false);
        }
        return;
      } catch {}
    }

    if (canvasType === 'doc' && typeof controller.insertLink === 'function') {
      controller.insertLink(file.webViewLink || '#', file.name);
      showToast(`Enlace a «${file.name}» insertado`, 'success');
    } else {
      window.open(file.webViewLink || `https://drive.google.com/file/d/${file.id}/view`, '_blank');
      showToast(`Abriendo «${file.name}» en Google Drive`, 'info');
    }
  }
}

function renderGoogleDriveAppContent(drawer: HTMLElement, drawerBody: HTMLElement): void {
  const sidebar = drawer.closest<HTMLElement>('[data-ref="sidebar"]') || document.querySelector<HTMLElement>('[data-ref="sidebar"]');

  if (!isGoogleDriveConnected()) {
    drawerBody.innerHTML = `
      <div class="canvas-panel-card" data-ref="canvas-panel-card">
        <div class="canvas-panel-card__header" data-ref="canvas-panel-header">
          <div class="canvas-panel-card__title-box" data-ref="canvas-panel-title-box">
            <svg class="canvas-panel-card__icon" viewBox="0 0 64 64" fill="none" aria-hidden="true" style="width: 22px; height: 22px;"><rect width="64" height="64" rx="14" fill="#0284c7"/><path d="M23 44L14 28L25 10H39L30 26L23 44Z" fill="#22c55e"/><path d="M50 44H23L30 32H57L50 44Z" fill="#eab308"/><path d="M39 10L57 40L50 52L32 22L39 10Z" fill="#3b82f6"/></svg>
            <span class="canvas-panel-card__title" data-ref="canvas-panel-title">Google Drive</span>
          </div>
          <button type="button" class="component-button component-button--h32 component-button--icon-only rail-btn canvas-panel-card__close" data-ref="btn-close-canvas-panel" data-tooltip="Cerrar panel" aria-label="Cerrar panel">
            <svg class="component-icon rail-btn__icon" aria-hidden="true"><use href="/icons.svg#close"></use></svg>
          </button>
        </div>
        <div class="canvas-panel-card__body drive-drawer-body" data-ref="canvas-panel-body">
          <button type="button" class="elements-back-btn" data-ref="btn-apps-back" style="margin-bottom: 12px;">
            <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#arrow_back"></use></svg>
            <span>Volver a Apps</span>
          </button>

          <div class="drive-connect-card" data-ref="drive-connect-card">
            <div class="drive-connect-icon" data-ref="drive-connect-icon">
              <svg viewBox="0 0 64 64" fill="none" aria-hidden="true"><rect width="64" height="64" rx="14" fill="#0284c7"/><path d="M23 44L14 28L25 10H39L30 26L23 44Z" fill="#22c55e"/><path d="M50 44H23L30 32H57L50 44Z" fill="#eab308"/><path d="M39 10L57 40L50 52L32 22L39 10Z" fill="#3b82f6"/></svg>
            </div>
            <span class="drive-connect-title" data-ref="drive-connect-title">Conecta con Google Drive</span>
            <span class="drive-connect-desc" data-ref="drive-connect-desc">Accede a tus fotos, ilustraciones, carpetas y documentos de Google Drive sin salir de Spriteboard.</span>

            <div class="drive-connect-features" data-ref="drive-connect-features">
              <div class="drive-connect-feature-item" data-ref="drive-feat-1">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
                <span>Explora todas tus carpetas y archivos en la nube</span>
              </div>
              <div class="drive-connect-feature-item" data-ref="drive-feat-2">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
                <span>Inserta imágenes en alta resolución con un solo clic</span>
              </div>
              <div class="drive-connect-feature-item" data-ref="drive-feat-3">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
                <span>Exporta y guarda tus diseños en tu Drive</span>
              </div>
            </div>

            <button type="button" class="component-button component-button--h44 component-button--black component-button--w-full" data-ref="btn-connect-google-drive">
              <svg class="component-icon" aria-hidden="true" style="width: 20px; height: 20px;"><use href="/icons.svg#add_to_drive"></use></svg>
              <span>Conectar con Google Drive</span>
            </button>
          </div>
        </div>
      </div>
    `;

    const btnBack = drawerBody.querySelector<HTMLButtonElement>('[data-ref="btn-apps-back"]');
    btnBack?.addEventListener('click', () => {
      activeAppId = null;
      renderAppsDrawerContent(drawer, drawerBody);
    });

    const btnClose = drawerBody.querySelector<HTMLElement>('[data-ref="btn-close-canvas-panel"]');
    btnClose?.addEventListener('click', (e) => {
      e.preventDefault();
      toggleDrawer(false);
    });

    const btnConnect = drawerBody.querySelector<HTMLButtonElement>('[data-ref="btn-connect-google-drive"]');
    btnConnect?.addEventListener('click', async () => {
      if (!btnConnect) return;
      btnConnect.disabled = true;
      btnConnect.innerHTML = `
        <div class="component-spinner" style="width: 18px; height: 18px; border-width: 2px;"></div>
        <span>Conectando con Google...</span>
      `;
      const res = await connectGoogleDrive();
      if (res.success) {
        showToast('Google Drive conectado exitosamente', 'success');
        driveFolderStack = [{ id: 'root', name: 'Mi unidad' }];
        driveSearchQuery = '';
        renderGoogleDriveAppContent(drawer, drawerBody);
      } else {
        btnConnect.disabled = false;
        btnConnect.innerHTML = `
          <svg class="component-icon" aria-hidden="true" style="width: 20px; height: 20px;"><use href="/icons.svg#add_to_drive"></use></svg>
          <span>Conectar con Google Drive</span>
        `;
        renderIcons(btnConnect);
        if (res.error) {
          showToast(res.error, 'warning');
        }
      }
    });

    if (sidebar) {
      updateCanvasRailActiveState(sidebar);
    }
    renderIcons(drawerBody);
    return;
  }

  const user = getGoogleDriveUser();

  drawerBody.innerHTML = `
    <div class="canvas-panel-card" data-ref="canvas-panel-card">
      <div class="canvas-panel-card__header" data-ref="canvas-panel-header">
        <div class="canvas-panel-card__title-box" data-ref="canvas-panel-title-box">
          <svg class="canvas-panel-card__icon" viewBox="0 0 64 64" fill="none" aria-hidden="true" style="width: 22px; height: 22px;"><rect width="64" height="64" rx="14" fill="#0284c7"/><path d="M23 44L14 28L25 10H39L30 26L23 44Z" fill="#22c55e"/><path d="M50 44H23L30 32H57L50 44Z" fill="#eab308"/><path d="M39 10L57 40L50 52L32 22L39 10Z" fill="#3b82f6"/></svg>
          <span class="canvas-panel-card__title" data-ref="canvas-panel-title">Google Drive</span>
        </div>
        <button type="button" class="component-button component-button--h32 component-button--icon-only rail-btn canvas-panel-card__close" data-ref="btn-close-canvas-panel" data-tooltip="Cerrar panel" aria-label="Cerrar panel">
          <svg class="component-icon rail-btn__icon" aria-hidden="true"><use href="/icons.svg#close"></use></svg>
        </button>
      </div>
      <div class="canvas-panel-card__body drive-drawer-body" data-ref="canvas-panel-body">
        <div style="display: flex; align-items: center; justify-content: space-between;">
          <button type="button" class="elements-back-btn" data-ref="btn-apps-back" style="margin-bottom: 0;">
            <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#arrow_back"></use></svg>
            <span>Volver a Apps</span>
          </button>
          <button type="button" class="component-button component-button--h28 component-button--ghost" data-ref="btn-disconnect-drive" data-tooltip="Desconectar cuenta" aria-label="Desconectar">
            <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#logout"></use></svg>
            <span style="font-size: 11px;">Desconectar</span>
          </button>
        </div>

        <div class="drive-user-bar" data-ref="drive-user-bar">
          <div class="drive-user-profile" data-ref="drive-user-profile">
            ${user?.photoLink ? `<img class="drive-user-avatar" data-ref="drive-user-avatar-img" src="${user.photoLink}" alt="Avatar" />` : `<div class="drive-user-avatar" data-ref="drive-user-avatar-initial">${escapeHtml((user?.displayName || 'G').charAt(0).toUpperCase())}</div>`}
            <div class="drive-user-details" data-ref="drive-user-details">
              <span class="drive-user-name" data-ref="drive-user-name">${escapeHtml(user?.displayName || 'Cuenta de Google')}</span>
              <span class="drive-user-email" data-ref="drive-user-email">${escapeHtml(user?.emailAddress || 'Conectado')}</span>
            </div>
          </div>
        </div>

        <div class="drive-quick-actions" data-ref="drive-quick-actions">
          <button type="button" class="component-button component-button--h32 component-button--subtle" data-ref="btn-open-google-picker" style="flex: 1;" data-tooltip="Abrir selector modal oficial de Google Drive" aria-label="Selector de Google">
            <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#open_in_new"></use></svg>
            <span style="font-size: 11px;">Abrir Picker</span>
          </button>
          <button type="button" class="component-button component-button--h32 component-button--subtle" data-ref="btn-export-to-drive" style="flex: 1;" data-tooltip="Guardar captura del lienzo actual en Drive" aria-label="Guardar en Drive">
            <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#cloud_upload"></use></svg>
            <span style="font-size: 11px;">Guardar en Drive</span>
          </button>
        </div>

        <div class="menu-panel__search" data-ref="drive-search-wrapper">
          <svg class="component-icon menu-panel__search-icon" aria-hidden="true"><use href="/icons.svg#search"></use></svg>
          <input class="menu-panel__search-input" data-ref="drive-search-input" type="text" maxlength="80" autocomplete="off" placeholder="Buscar en Google Drive..." />
        </div>

        <div class="drive-breadcrumbs" data-ref="drive-breadcrumbs"></div>

        <div class="mockup-category-tabs" data-ref="drive-category-tabs" style="margin-bottom: 2px;">
          <button type="button" class="mockup-category-pill ${driveActiveFilter === 'all' ? 'is-active' : ''}" data-ref="drive-filter-all" data-drive-filter="all">Todos</button>
          <button type="button" class="mockup-category-pill ${driveActiveFilter === 'images' ? 'is-active' : ''}" data-ref="drive-filter-images" data-drive-filter="images">Imágenes</button>
          <button type="button" class="mockup-category-pill ${driveActiveFilter === 'folders' ? 'is-active' : ''}" data-ref="drive-filter-folders" data-drive-filter="folders">Carpetas</button>
          <button type="button" class="mockup-category-pill ${driveActiveFilter === 'documents' ? 'is-active' : ''}" data-ref="drive-filter-documents" data-drive-filter="documents">Documentos</button>
        </div>

        <div class="drive-results-container" data-ref="drive-results-container"></div>
      </div>
    </div>
  `;

  const btnBack = drawerBody.querySelector<HTMLButtonElement>('[data-ref="btn-apps-back"]');
  btnBack?.addEventListener('click', () => {
    activeAppId = null;
    renderAppsDrawerContent(drawer, drawerBody);
  });

  const btnClose = drawerBody.querySelector<HTMLElement>('[data-ref="btn-close-canvas-panel"]');
  btnClose?.addEventListener('click', (e) => {
    e.preventDefault();
    toggleDrawer(false);
  });

  const btnDisconnect = drawerBody.querySelector<HTMLButtonElement>('[data-ref="btn-disconnect-drive"]');
  btnDisconnect?.addEventListener('click', () => {
    disconnectGoogleDrive();
    showToast('Cuenta de Google Drive desconectada', 'info');
    renderGoogleDriveAppContent(drawer, drawerBody);
  });

  const breadcrumbsEl = drawerBody.querySelector<HTMLElement>('[data-ref="drive-breadcrumbs"]');
  const resultsContainer = drawerBody.querySelector<HTMLElement>('[data-ref="drive-results-container"]');
  const searchInput = drawerBody.querySelector<HTMLInputElement>('[data-ref="drive-search-input"]');

  const updateBreadcrumbs = () => {
    if (!breadcrumbsEl) return;
    breadcrumbsEl.innerHTML = driveFolderStack
      .map((crumb, idx) => `
        <button type="button" class="drive-breadcrumb-pill ${idx === driveFolderStack.length - 1 ? 'is-active' : ''}" data-ref="btn-drive-crumb-${crumb.id}" data-folder-id="${crumb.id}">
          <svg class="component-icon" aria-hidden="true" style="width: 13px; height: 13px;"><use href="/icons.svg#folder"></use></svg>
          <span>${escapeHtml(crumb.name)}</span>
        </button>
        ${idx < driveFolderStack.length - 1 ? '<span class="drive-breadcrumb-sep">/</span>' : ''}
      `)
      .join('');

    breadcrumbsEl.querySelectorAll<HTMLButtonElement>('[data-folder-id]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const targetId = btn.getAttribute('data-folder-id');
        if (!targetId) return;
        const targetIdx = driveFolderStack.findIndex((c) => c.id === targetId);
        if (targetIdx !== -1) {
          driveFolderStack = driveFolderStack.slice(0, targetIdx + 1);
          driveSearchQuery = '';
          if (searchInput) searchInput.value = '';
          void loadAndRenderFiles();
        }
      });
    });
    renderIcons(breadcrumbsEl);
  };

  const loadAndRenderFiles = async () => {
    if (!resultsContainer) return;
    updateBreadcrumbs();

    resultsContainer.innerHTML = `
      <div class="drive-loading-state" data-ref="drive-loading-state">
        <div class="component-spinner" style="width: 28px; height: 28px; border-width: 3px; border-color: #0284c7; border-top-color: transparent;"></div>
        <span style="font-size: 13px; color: var(--text-secondary);">Cargando Google Drive...</span>
      </div>
    `;

    const currentFolder = driveFolderStack[driveFolderStack.length - 1];
    const folderId = driveSearchQuery ? undefined : currentFolder?.id || 'root';

    try {
      const resp = await listGoogleDriveFiles({
        filterType: driveActiveFilter,
        folderId,
        query: driveSearchQuery,
      });

      if (resp.files.length === 0) {
        resultsContainer.innerHTML = `
          <div class="drive-empty-state" data-ref="drive-empty">
            <svg class="component-icon" aria-hidden="true" style="width: 38px; height: 38px; opacity: 0.4;"><use href="/icons.svg#folder_open"></use></svg>
            <span>${driveSearchQuery ? `No se encontraron archivos para «${escapeHtml(driveSearchQuery)}»` : 'Esta carpeta está vacía'}</span>
          </div>
        `;
        renderIcons(resultsContainer);
        return;
      }

      const folders = resp.files.filter((f) => f.isFolder);
      const files = resp.files.filter((f) => !f.isFolder);

      let html = '';

      if (folders.length > 0) {
        html += `
          <div class="elements-section-title" data-ref="drive-folders-title" style="margin-top: 4px; margin-bottom: 6px;">Carpetas</div>
          <div class="drive-grid" data-ref="drive-folders-grid" style="margin-bottom: 12px;">
            ${folders.map((folder) => `
              <button type="button" class="drive-folder-card" data-ref="drive-folder-${folder.id}" data-folder-id="${folder.id}" data-folder-name="${escapeHtml(folder.name)}" data-tooltip="Abrir carpeta ${escapeHtml(folder.name)}">
                <svg class="component-icon drive-folder-card__icon" aria-hidden="true"><use href="/icons.svg#folder"></use></svg>
                <span class="drive-folder-card__name" data-ref="drive-folder-name-${folder.id}">${escapeHtml(folder.name)}</span>
              </button>
            `).join('')}
          </div>
        `;
      }

      if (files.length > 0) {
        html += `
          <div class="elements-section-title" data-ref="drive-files-title" style="margin-top: 4px; margin-bottom: 6px;">Archivos e imágenes</div>
          <div class="drive-grid" data-ref="drive-files-grid">
            ${files.map((file) => {
              let thumbSrc = file.thumbnailLink || '';
              if (thumbSrc && thumbSrc.includes('=s220')) {
                thumbSrc = thumbSrc.replace(/=s220.*/, '=s400');
              }
              const iconName = file.isPdf ? 'picture_as_pdf' : file.isDoc ? 'description' : 'image';
              const iconColor = file.isPdf ? '#ef4444' : file.isDoc ? '#2563eb' : '#0284c7';

              return `
                <div class="drive-file-card" data-ref="drive-file-${file.id}" data-file-id="${file.id}">
                  <div class="drive-file-card__thumb-box" data-ref="drive-thumb-box-${file.id}">
                    ${thumbSrc ? `<img class="drive-file-card__thumb-img" data-ref="drive-img-${file.id}" src="${thumbSrc}" alt="${escapeHtml(file.name)}" loading="lazy" />` : `<svg class="component-icon drive-file-card__thumb-icon" aria-hidden="true" style="fill: ${iconColor};"><use href="/icons.svg#${iconName}"></use></svg>`}
                    <div class="drive-file-card__overlay" data-ref="drive-overlay-${file.id}">
                      <button type="button" class="drive-file-card__insert-btn" data-ref="btn-insert-drive-${file.id}">Insertar</button>
                    </div>
                  </div>
                  <div class="drive-file-card__info" data-ref="drive-info-${file.id}">
                    <span class="drive-file-card__title" data-ref="drive-title-${file.id}" title="${escapeHtml(file.name)}">${escapeHtml(file.name)}</span>
                    <span class="drive-file-card__meta" data-ref="drive-meta-${file.id}">
                      <span>${file.isImage ? 'Imagen' : file.isPdf ? 'PDF' : 'Archivo'}</span>
                      ${file.size ? `<span>${formatFileSize(file.size)}</span>` : ''}
                    </span>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        `;
      }

      resultsContainer.innerHTML = html;

      resultsContainer.querySelectorAll<HTMLButtonElement>('.drive-folder-card').forEach((card) => {
        card.addEventListener('click', () => {
          const fid = card.getAttribute('data-folder-id');
          const fname = card.getAttribute('data-folder-name') || 'Carpeta';
          if (fid) {
            driveFolderStack.push({ id: fid, name: fname });
            driveSearchQuery = '';
            if (searchInput) searchInput.value = '';
            void loadAndRenderFiles();
          }
        });
      });

      resultsContainer.querySelectorAll<HTMLElement>('.drive-file-card').forEach((card) => {
        const fid = card.getAttribute('data-file-id');
        const file = resp.files.find((f) => f.id === fid);
        if (!file) return;

        card.addEventListener('click', () => {
          void handleInsertDriveFile(file);
        });
      });

      renderIcons(resultsContainer);
    } catch (err: any) {
      resultsContainer.innerHTML = `
        <div class="drive-empty-state" data-ref="drive-error" style="color: #ef4444;">
          <svg class="component-icon" aria-hidden="true" style="width: 32px; height: 32px;"><use href="/icons.svg#error"></use></svg>
          <span>${escapeHtml(err?.message || 'Error al conectar con Google Drive')}</span>
          <button type="button" class="component-button component-button--h32 component-button--subtle" data-ref="btn-retry-drive" style="margin-top: 8px;">
            <span>Reintentar</span>
          </button>
        </div>
      `;
      const btnRetry = resultsContainer.querySelector<HTMLButtonElement>('[data-ref="btn-retry-drive"]');
      btnRetry?.addEventListener('click', () => void loadAndRenderFiles());
      renderIcons(resultsContainer);
    }
  };

  let debounceTimer: number | null = null;
  searchInput?.addEventListener('input', () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = window.setTimeout(() => {
      driveSearchQuery = searchInput.value.trim();
      void loadAndRenderFiles();
    }, 450);
  });

  drawerBody.querySelectorAll<HTMLButtonElement>('[data-drive-filter]').forEach((pill) => {
    pill.addEventListener('click', () => {
      const filter = pill.getAttribute('data-drive-filter') as any;
      if (filter) {
        driveActiveFilter = filter;
        drawerBody.querySelectorAll<HTMLButtonElement>('[data-drive-filter]').forEach((p) => {
          p.classList.toggle('is-active', p.getAttribute('data-drive-filter') === filter);
        });
        void loadAndRenderFiles();
      }
    });
  });

  const btnPicker = drawerBody.querySelector<HTMLButtonElement>('[data-ref="btn-open-google-picker"]');
  btnPicker?.addEventListener('click', async () => {
    await openGooglePicker((picked) => {
      void handleInsertDriveFile(picked);
    });
  });

  const btnExport = drawerBody.querySelector<HTMLButtonElement>('[data-ref="btn-export-to-drive"]');
  btnExport?.addEventListener('click', async () => {
    const controller = getActiveCanvasController();
    const canvasType = getActiveCanvasType();
    const nowStr = new Date().toISOString().slice(0, 10);
    const boardName = controller?.boardName || controller?.canvasRecord?.name || 'Spriteboard_Diseno';
    const cleanFilename = `${boardName.replace(/[^a-zA-Z0-9_-]/g, '_')}_${nowStr}.png`;

    showToast('Preparando captura para Google Drive...', 'info');

    let blob: Blob | null = null;
    const canvasEl = controller?.canvasElement || controller?.canvas || document.querySelector<HTMLCanvasElement>('canvas');

    if (canvasEl && canvasType !== 'doc') {
      blob = await new Promise<Blob | null>((resolve) => {
        canvasEl.toBlob((b: Blob | null) => resolve(b), 'image/png');
      });
    } else if (canvasType === 'doc') {
      const docEl = document.querySelector<HTMLElement>('[data-ref="doc-editor-content"], .doc-page, .doc-editor');
      const text = docEl?.innerText || 'Documento Spriteboard';
      blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    }

    if (!blob) {
      showToast('No se pudo generar la captura del lienzo para guardar', 'warning');
      return;
    }

    try {
      const currentFolder = driveFolderStack[driveFolderStack.length - 1];
      const folderId = currentFolder?.id !== 'root' ? currentFolder?.id : undefined;
      const uploaded = await uploadCanvasExportToDrive(blob, cleanFilename, folderId);
      showToast(`«${uploaded.name}» guardado con éxito en Google Drive`, 'success');
      void loadAndRenderFiles();
    } catch {
      showToast('Error al guardar el archivo en Google Drive', 'danger');
    }
  });

  void loadAndRenderFiles();

  if (sidebar) {
    updateCanvasRailActiveState(sidebar);
  }
  renderIcons(drawerBody);
}

let photosActiveTab: 'albums' | 'recent' = 'recent';
let photosActiveAlbumId: string | null = null;
let photosActiveAlbumTitle: string | null = null;

async function handleInsertPhoto(photo: GooglePhotoItem): Promise<void> {
  const canvasType = getActiveCanvasType();
  const controller = getActiveCanvasController();

  if (!controller) {
    showToast('No se encontró el controlador del lienzo activo', 'warning');
    return;
  }

  showToast(`Cargando foto «${photo.filename}»...`, 'info');
  try {
    const result = await fetchPhotoBlob(photo.baseUrl);
    if (canvasType === 'doc') {
      controller.insertImage(result.dataUrl, photo.filename, '60%');
    } else {
      controller.insertImage?.(result.dataUrl, photo.width || undefined, photo.height || undefined, photo.filename);
    }
    showToast(`«${photo.filename}» añadida al diseño`, 'success');
    if (window.innerWidth <= 768) {
      toggleDrawer(false);
    }
  } catch {
    showToast('Error al descargar la foto desde Google Fotos', 'danger');
  }
}

function renderGooglePhotosAppContent(drawer: HTMLElement, drawerBody: HTMLElement): void {
  const sidebar = drawer.closest<HTMLElement>('[data-ref="sidebar"]') || document.querySelector<HTMLElement>('[data-ref="sidebar"]');

  if (!isGooglePhotosConnected()) {
    drawerBody.innerHTML = `
      <div class="canvas-panel-card" data-ref="canvas-panel-card">
        <div class="canvas-panel-card__header" data-ref="canvas-panel-header">
          <div class="canvas-panel-card__title-box" data-ref="canvas-panel-title-box">
            <svg class="canvas-panel-card__icon" viewBox="0 0 64 64" fill="none" aria-hidden="true" style="width: 22px; height: 22px;"><rect width="64" height="64" rx="14" fill="#ffffff" stroke="#e2e8f0" stroke-width="1.5"/><path d="M32 14C32 14 32 24 32 24H22C22 18.48 26.48 14 32 14Z" fill="#ea4335"/><path d="M50 32C50 32 40 32 40 32V22C45.52 22 50 26.48 50 32Z" fill="#fbbc05"/><path d="M32 50C32 50 32 40 32 40H42C42 45.52 37.52 50 32 50Z" fill="#34a853"/><path d="M14 32C14 32 24 32 24 32V42C18.48 42 14 37.52 14 32Z" fill="#4285f4"/></svg>
            <span class="canvas-panel-card__title" data-ref="canvas-panel-title">Google Fotos</span>
          </div>
          <button type="button" class="component-button component-button--h32 component-button--icon-only rail-btn canvas-panel-card__close" data-ref="btn-close-canvas-panel" data-tooltip="Cerrar panel" aria-label="Cerrar panel">
            <svg class="component-icon rail-btn__icon" aria-hidden="true"><use href="/icons.svg#close"></use></svg>
          </button>
        </div>
        <div class="canvas-panel-card__body photos-drawer-body" data-ref="canvas-panel-body">
          <button type="button" class="elements-back-btn" data-ref="btn-apps-back" style="margin-bottom: 12px;">
            <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#arrow_back"></use></svg>
            <span>Volver a Apps</span>
          </button>

          <div class="drive-connect-card" data-ref="photos-connect-card">
            <div class="drive-connect-icon" data-ref="photos-connect-icon">
              <svg viewBox="0 0 64 64" fill="none" aria-hidden="true"><rect width="64" height="64" rx="14" fill="#ffffff" stroke="#e2e8f0" stroke-width="1.5"/><path d="M32 14C32 14 32 24 32 24H22C22 18.48 26.48 14 32 14Z" fill="#ea4335"/><path d="M50 32C50 32 40 32 40 32V22C45.52 22 50 26.48 50 32Z" fill="#fbbc05"/><path d="M32 50C32 50 32 40 32 40H42C42 45.52 37.52 50 32 50Z" fill="#34a853"/><path d="M14 32C14 32 24 32 24 32V42C18.48 42 14 37.52 14 32Z" fill="#4285f4"/></svg>
            </div>
            <span class="drive-connect-title" data-ref="photos-connect-title">Conecta con Google Fotos</span>
            <span class="drive-connect-desc" data-ref="photos-connect-desc">Accede a tus fotografías, ilustraciones y álbumes personales para agregarlos directamente a tu diseño.</span>

            <div class="drive-connect-features" data-ref="photos-connect-features">
              <div class="drive-connect-feature-item" data-ref="photos-feat-1">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
                <span>Accede a tus fotos y álbumes de Google</span>
              </div>
              <div class="drive-connect-feature-item" data-ref="photos-feat-2">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
                <span>Inserta imágenes en alta calidad en un solo clic</span>
              </div>
              <div class="drive-connect-feature-item" data-ref="photos-feat-3">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
                <span>Selección rápida con Google Photos Picker</span>
              </div>
            </div>

            <button type="button" class="component-button component-button--h44 component-button--black component-button--w-full" data-ref="btn-connect-google-photos">
              <svg class="component-icon" aria-hidden="true" style="width: 20px; height: 20px;"><use href="/icons.svg#photo_library"></use></svg>
              <span>Conectar con Google Fotos</span>
            </button>
          </div>
        </div>
      </div>
    `;

    const btnBack = drawerBody.querySelector<HTMLButtonElement>('[data-ref="btn-apps-back"]');
    btnBack?.addEventListener('click', () => {
      activeAppId = null;
      renderAppsDrawerContent(drawer, drawerBody);
    });

    const btnClose = drawerBody.querySelector<HTMLElement>('[data-ref="btn-close-canvas-panel"]');
    btnClose?.addEventListener('click', (e) => {
      e.preventDefault();
      toggleDrawer(false);
    });

    const btnConnect = drawerBody.querySelector<HTMLButtonElement>('[data-ref="btn-connect-google-photos"]');
    btnConnect?.addEventListener('click', async () => {
      if (!btnConnect) return;
      btnConnect.disabled = true;
      btnConnect.innerHTML = `
        <div class="component-spinner" style="width: 18px; height: 18px; border-width: 2px;"></div>
        <span>Conectando con Google...</span>
      `;
      const res = await connectGooglePhotos();
      if (res.success) {
        showToast('Google Fotos conectado exitosamente', 'success');
        photosActiveTab = 'recent';
        photosActiveAlbumId = null;
        renderGooglePhotosAppContent(drawer, drawerBody);
      } else {
        btnConnect.disabled = false;
        btnConnect.innerHTML = `
          <svg class="component-icon" aria-hidden="true" style="width: 20px; height: 20px;"><use href="/icons.svg#photo_library"></use></svg>
          <span>Conectar con Google Fotos</span>
        `;
        renderIcons(btnConnect);
        if (res.error) {
          showToast(res.error, 'warning');
        }
      }
    });

    if (sidebar) {
      updateCanvasRailActiveState(sidebar);
    }
    renderIcons(drawerBody);
    return;
  }

  const user = getGooglePhotosUser();

  drawerBody.innerHTML = `
    <div class="canvas-panel-card" data-ref="canvas-panel-card">
      <div class="canvas-panel-card__header" data-ref="canvas-panel-header">
        <div class="canvas-panel-card__title-box" data-ref="canvas-panel-title-box">
          <svg class="canvas-panel-card__icon" viewBox="0 0 64 64" fill="none" aria-hidden="true" style="width: 22px; height: 22px;"><rect width="64" height="64" rx="14" fill="#ffffff" stroke="#e2e8f0" stroke-width="1.5"/><path d="M32 14C32 14 32 24 32 24H22C22 18.48 26.48 14 32 14Z" fill="#ea4335"/><path d="M50 32C50 32 40 32 40 32V22C45.52 22 50 26.48 50 32Z" fill="#fbbc05"/><path d="M32 50C32 50 32 40 32 40H42C42 45.52 37.52 50 32 50Z" fill="#34a853"/><path d="M14 32C14 32 24 32 24 32V42C18.48 42 14 37.52 14 32Z" fill="#4285f4"/></svg>
          <span class="canvas-panel-card__title" data-ref="canvas-panel-title">Google Fotos</span>
        </div>
        <button type="button" class="component-button component-button--h32 component-button--icon-only rail-btn canvas-panel-card__close" data-ref="btn-close-canvas-panel" data-tooltip="Cerrar panel" aria-label="Cerrar panel">
          <svg class="component-icon rail-btn__icon" aria-hidden="true"><use href="/icons.svg#close"></use></svg>
        </button>
      </div>
      <div class="canvas-panel-card__body photos-drawer-body" data-ref="canvas-panel-body">
        <div style="display: flex; align-items: center; justify-content: space-between;">
          <button type="button" class="elements-back-btn" data-ref="btn-apps-back" style="margin-bottom: 0;">
            <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#arrow_back"></use></svg>
            <span>Volver a Apps</span>
          </button>
          <button type="button" class="component-button component-button--h28 component-button--ghost" data-ref="btn-disconnect-photos" data-tooltip="Desconectar cuenta" aria-label="Desconectar">
            <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#logout"></use></svg>
            <span style="font-size: 11px;">Desconectar</span>
          </button>
        </div>

        <div class="drive-user-bar" data-ref="photos-user-bar">
          <div class="drive-user-profile" data-ref="photos-user-profile">
            ${user?.photoLink ? `<img class="drive-user-avatar" data-ref="photos-user-avatar-img" src="${user.photoLink}" alt="Avatar" />` : `<div class="drive-user-avatar" data-ref="photos-user-avatar-initial" style="background: #ea4335;">${escapeHtml((user?.displayName || 'P').charAt(0).toUpperCase())}</div>`}
            <div class="drive-user-details" data-ref="photos-user-details">
              <span class="drive-user-name" data-ref="photos-user-name">${escapeHtml(user?.displayName || 'Cuenta de Google')}</span>
              <span class="drive-user-email" data-ref="photos-user-email">${escapeHtml(user?.emailAddress || 'Conectado')}</span>
            </div>
          </div>
        </div>

        <button type="button" class="component-button component-button--h32 component-button--subtle component-button--w-full" data-ref="btn-open-photos-picker" data-tooltip="Abrir selector modal oficial de Google Fotos" aria-label="Selector de Fotos">
          <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#open_in_new"></use></svg>
          <span style="font-size: 11px;">Abrir Google Photos Picker</span>
        </button>

        <div class="mockup-category-tabs" data-ref="photos-tabs" style="margin-bottom: 2px;">
          <button type="button" class="mockup-category-pill ${photosActiveTab === 'recent' ? 'is-active' : ''}" data-ref="photos-tab-recent" data-photos-tab="recent">Fotos recientes</button>
          <button type="button" class="mockup-category-pill ${photosActiveTab === 'albums' ? 'is-active' : ''}" data-ref="photos-tab-albums" data-photos-tab="albums">Álbumes</button>
        </div>

        ${photosActiveAlbumId ? `
          <div style="display: flex; align-items: center; gap: 6px; padding: 4px 0;">
            <button type="button" class="elements-back-btn" data-ref="btn-back-to-albums" style="margin-bottom: 0; padding: 2px 6px; font-size: 11px;">
              <svg class="component-icon" aria-hidden="true" style="width: 14px; height: 14px;"><use href="/icons.svg#arrow_back"></use></svg>
              <span>Todos los álbumes</span>
            </button>
            <span style="font-size: 11.5px; font-weight: 600; color: var(--text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(photosActiveAlbumTitle || '')}</span>
          </div>
        ` : ''}

        <div class="photos-results-container" data-ref="photos-results-container"></div>
      </div>
    </div>
  `;

  const btnBack = drawerBody.querySelector<HTMLButtonElement>('[data-ref="btn-apps-back"]');
  btnBack?.addEventListener('click', () => {
    activeAppId = null;
    renderAppsDrawerContent(drawer, drawerBody);
  });

  const btnClose = drawerBody.querySelector<HTMLElement>('[data-ref="btn-close-canvas-panel"]');
  btnClose?.addEventListener('click', (e) => {
    e.preventDefault();
    toggleDrawer(false);
  });

  const btnDisconnect = drawerBody.querySelector<HTMLButtonElement>('[data-ref="btn-disconnect-photos"]');
  btnDisconnect?.addEventListener('click', () => {
    disconnectGooglePhotos();
    showToast('Cuenta de Google Fotos desconectada', 'info');
    renderGooglePhotosAppContent(drawer, drawerBody);
  });

  const btnBackToAlbums = drawerBody.querySelector<HTMLButtonElement>('[data-ref="btn-back-to-albums"]');
  btnBackToAlbums?.addEventListener('click', () => {
    photosActiveAlbumId = null;
    photosActiveAlbumTitle = null;
    renderGooglePhotosAppContent(drawer, drawerBody);
  });

  const resultsContainer = drawerBody.querySelector<HTMLElement>('[data-ref="photos-results-container"]');

  const loadAndRenderPhotos = async () => {
    if (!resultsContainer) return;
    resultsContainer.innerHTML = `
      <div class="drive-loading-state" data-ref="photos-loading-state">
        <div class="component-spinner" style="width: 28px; height: 28px; border-width: 3px; border-color: #ea4335; border-top-color: transparent;"></div>
        <span style="font-size: 13px; color: var(--text-secondary);">Cargando fotos...</span>
      </div>
    `;

    try {
      if (photosActiveTab === 'albums' && !photosActiveAlbumId) {
        const resp = await listGooglePhotosAlbums(30);
        if (resp.albums.length === 0) {
          resultsContainer.innerHTML = `
            <div class="drive-empty-state" data-ref="photos-empty">
              <svg class="component-icon" aria-hidden="true" style="width: 38px; height: 38px; opacity: 0.4;"><use href="/icons.svg#photo_library"></use></svg>
              <span>No se encontraron álbumes en tu cuenta</span>
            </div>
          `;
          renderIcons(resultsContainer);
          return;
        }

        resultsContainer.innerHTML = `
          <div class="photos-grid" data-ref="photos-albums-grid">
            ${resp.albums.map((alb) => `
              <div class="photos-album-card" data-ref="album-${alb.id}" data-album-id="${alb.id}" data-album-title="${escapeHtml(alb.title)}">
                <div class="photos-album-card__cover" data-ref="album-cover-${alb.id}">
                  ${alb.coverPhotoBaseUrl ? `<img src="${alb.coverPhotoBaseUrl}" alt="${escapeHtml(alb.title)}" loading="lazy" />` : `<svg class="component-icon" aria-hidden="true" style="width: 32px; height: 32px; opacity: 0.5;"><use href="/icons.svg#photo_library"></use></svg>`}
                </div>
                <div class="photos-album-card__info" data-ref="album-info-${alb.id}">
                  <span class="photos-album-card__title" data-ref="album-title-${alb.id}">${escapeHtml(alb.title)}</span>
                  ${alb.mediaItemsCount !== undefined ? `<span class="photos-album-card__count" data-ref="album-count-${alb.id}">${alb.mediaItemsCount} elementos</span>` : ''}
                </div>
              </div>
            `).join('')}
          </div>
        `;

        resultsContainer.querySelectorAll<HTMLElement>('.photos-album-card').forEach((card) => {
          card.addEventListener('click', () => {
            const albId = card.getAttribute('data-album-id');
            const albTitle = card.getAttribute('data-album-title');
            if (albId) {
              photosActiveAlbumId = albId;
              photosActiveAlbumTitle = albTitle || 'Álbum';
              renderGooglePhotosAppContent(drawer, drawerBody);
            }
          });
        });

        renderIcons(resultsContainer);
        return;
      }

      const resp = await listGooglePhotos({
        albumId: photosActiveAlbumId || undefined,
        pageSize: 40,
      });

      if (resp.mediaItems.length === 0) {
        resultsContainer.innerHTML = `
          <div class="drive-empty-state" data-ref="photos-empty">
            <svg class="component-icon" aria-hidden="true" style="width: 38px; height: 38px; opacity: 0.4;"><use href="/icons.svg#image"></use></svg>
            <span>No se encontraron fotos en esta sección</span>
          </div>
        `;
        renderIcons(resultsContainer);
        return;
      }

      resultsContainer.innerHTML = `
        <div class="photos-grid" data-ref="photos-grid">
          ${resp.mediaItems.map((item) => `
            <div class="photos-card" data-ref="photo-${item.id}" data-photo-id="${item.id}">
              <div class="photos-card__thumb-box" data-ref="photo-thumb-box-${item.id}">
                <img class="photos-card__img" data-ref="photo-img-${item.id}" src="${item.thumbnailUrl}" alt="${escapeHtml(item.filename)}" loading="lazy" />
                <div class="photos-card__overlay" data-ref="photo-overlay-${item.id}">
                  <button type="button" class="photos-card__insert-btn" data-ref="btn-insert-photo-${item.id}">Insertar</button>
                </div>
              </div>
              <div class="photos-card__info" data-ref="photo-info-${item.id}">
                <span class="photos-card__name" data-ref="photo-name-${item.id}" title="${escapeHtml(item.filename)}">${escapeHtml(item.filename)}</span>
              </div>
            </div>
          `).join('')}
        </div>
      `;

      resultsContainer.querySelectorAll<HTMLElement>('.photos-card').forEach((card) => {
        const pid = card.getAttribute('data-photo-id');
        const photo = resp.mediaItems.find((p) => p.id === pid);
        if (!photo) return;
        card.addEventListener('click', () => {
          void handleInsertPhoto(photo);
        });
      });

      renderIcons(resultsContainer);
    } catch (err: any) {
      const isScopeErr = String(err?.message || '').toLowerCase().includes('permiso') || String(err?.message || '').toLowerCase().includes('scope');
      resultsContainer.innerHTML = `
        <div class="drive-empty-state" data-ref="photos-error" style="color: var(--text-secondary); text-align: center; padding: 20px 12px;">
          <svg class="component-icon" aria-hidden="true" style="width: 34px; height: 34px; color: #ef4444; margin-bottom: 6px;"><use href="/icons.svg#error"></use></svg>
          <div style="font-size: 13px; font-weight: 600; color: var(--text-primary); margin-bottom: 4px;">
            ${isScopeErr ? 'Permisos insuficientes' : 'Error al cargar fotos'}
          </div>
          <span style="font-size: 11.5px; color: var(--text-tertiary); line-height: 1.45; margin-bottom: 12px; display: block;">
            ${escapeHtml(err?.message || 'Error al conectar con Google Fotos')}
          </span>
          <div style="display: flex; flex-direction: column; gap: 8px; width: 100%; max-width: 230px; margin: 0 auto;">
            <button type="button" class="component-button component-button--h32 component-button--black component-button--w-full" data-ref="btn-reconnect-photos">
              <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#refresh"></use></svg>
              <span>Reconectar y autorizar</span>
            </button>
            <button type="button" class="component-button component-button--h32 component-button--subtle component-button--w-full" data-ref="btn-picker-from-error">
              <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#open_in_new"></use></svg>
              <span>Abrir Google Photos Picker</span>
            </button>
          </div>
        </div>
      `;

      const btnReconnect = resultsContainer.querySelector<HTMLButtonElement>('[data-ref="btn-reconnect-photos"]');
      btnReconnect?.addEventListener('click', async () => {
        disconnectGooglePhotos();
        const res = await connectGooglePhotos();
        if (res.success) {
          renderGooglePhotosAppContent(drawer, drawerBody);
        } else if (res.error) {
          showToast(res.error, 'warning');
        }
      });

      const btnPickerFromError = resultsContainer.querySelector<HTMLButtonElement>('[data-ref="btn-picker-from-error"]');
      btnPickerFromError?.addEventListener('click', async () => {
        await openGooglePhotosPicker((picked) => {
          void handleInsertPhoto(picked);
        });
      });

      renderIcons(resultsContainer);
    }
  };

  drawerBody.querySelectorAll<HTMLButtonElement>('[data-photos-tab]').forEach((tabBtn) => {
    tabBtn.addEventListener('click', () => {
      const tab = tabBtn.getAttribute('data-photos-tab') as any;
      if (tab) {
        photosActiveTab = tab;
        photosActiveAlbumId = null;
        photosActiveAlbumTitle = null;
        drawerBody.querySelectorAll<HTMLButtonElement>('[data-photos-tab]').forEach((b) => {
          b.classList.toggle('is-active', b.getAttribute('data-photos-tab') === tab);
        });
        void loadAndRenderPhotos();
      }
    });
  });

  const btnPicker = drawerBody.querySelector<HTMLButtonElement>('[data-ref="btn-open-photos-picker"]');
  btnPicker?.addEventListener('click', async () => {
    await openGooglePhotosPicker((picked) => {
      void handleInsertPhoto(picked);
    });
  });

  void loadAndRenderPhotos();

  if (sidebar) {
    updateCanvasRailActiveState(sidebar);
  }
  renderIcons(drawerBody);
}

let mapsAddress = 'Madrid, España';
let mapsZoom = 14;
let mapsType: MapTypeOption = 'roadmap';
let mapsStyle: MapStyleOption = 'standard';
let mapsShowMarker = true;

function renderGoogleMapsAppContent(drawer: HTMLElement, drawerBody: HTMLElement): void {
  const sidebar = drawer.closest<HTMLElement>('[data-ref="sidebar"]') || document.querySelector<HTMLElement>('[data-ref="sidebar"]');

  drawerBody.innerHTML = `
    <div class="canvas-panel-card" data-ref="canvas-panel-card">
      <div class="canvas-panel-card__header" data-ref="canvas-panel-header">
        <div class="canvas-panel-card__title-box" data-ref="canvas-panel-title-box">
          <svg class="canvas-panel-card__icon" viewBox="0 0 64 64" fill="none" aria-hidden="true" style="width: 22px; height: 22px;"><rect width="64" height="64" rx="14" fill="#10b981"/><path d="M32 14C23.7 14 17 20.7 17 29C17 39.5 32 50 32 50C32 50 47 39.5 47 29C47 20.7 40.3 14 32 14ZM32 35C28.7 35 26 32.3 26 29C26 25.7 28.7 23 32 23C35.3 23 38 25.7 38 29C38 32.3 35.3 35 32 35Z" fill="#ffffff"/></svg>
          <span class="canvas-panel-card__title" data-ref="canvas-panel-title">Google Maps</span>
        </div>
        <button type="button" class="component-button component-button--h32 component-button--icon-only rail-btn canvas-panel-card__close" data-ref="btn-close-canvas-panel" data-tooltip="Cerrar panel" aria-label="Cerrar panel">
          <svg class="component-icon rail-btn__icon" aria-hidden="true"><use href="/icons.svg#close"></use></svg>
        </button>
      </div>
      <div class="canvas-panel-card__body maps-drawer-body" data-ref="canvas-panel-body">
        <button type="button" class="elements-back-btn" data-ref="btn-apps-back" style="margin-bottom: 2px;">
          <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#arrow_back"></use></svg>
          <span>Volver a Apps</span>
        </button>

        <div class="menu-panel__search" data-ref="maps-search-wrapper">
          <svg class="component-icon menu-panel__search-icon" aria-hidden="true"><use href="/icons.svg#search"></use></svg>
          <input class="menu-panel__search-input" data-ref="maps-search-input" type="text" maxlength="120" autocomplete="off" placeholder="Buscar dirección o ciudad..." value="${escapeHtml(mapsAddress)}" />
        </div>

        <div class="maps-chips-row" data-ref="maps-presets-row">
          ${MAP_PRESET_LOCATIONS.map((loc) => `
            <button type="button" class="mockup-category-pill" data-ref="chip-map-${loc.name}" data-map-loc="${escapeHtml(loc.address)}">
              ${escapeHtml(loc.name)}
            </button>
          `).join('')}
        </div>

        <div class="maps-preview-card" data-ref="maps-preview-card">
          <div class="maps-preview-box" data-ref="maps-preview-box">
            <img class="maps-preview-img" data-ref="maps-preview-img" src="${buildStaticMapUrl({ address: mapsAddress, mapType: mapsType, showMarker: mapsShowMarker, styleTheme: mapsStyle, zoom: mapsZoom })}" alt="Vista previa del mapa" />
          </div>
        </div>

        <div class="maps-controls-section" data-ref="maps-controls-style">
          <span class="maps-controls-label" data-ref="label-maps-style">Estilo de mapa</span>
          <div class="maps-style-grid" data-ref="maps-style-grid">
            <button type="button" class="maps-style-btn ${mapsType === 'roadmap' && mapsStyle === 'standard' ? 'is-active' : ''}" data-ref="btn-map-roadmap" data-map-type="roadmap" data-map-style="standard">Estándar</button>
            <button type="button" class="maps-style-btn ${mapsType === 'satellite' ? 'is-active' : ''}" data-ref="btn-map-satellite" data-map-type="satellite" data-map-style="standard">Satélite</button>
            <button type="button" class="maps-style-btn ${mapsType === 'hybrid' ? 'is-active' : ''}" data-ref="btn-map-hybrid" data-map-type="hybrid" data-map-style="standard">Híbrido</button>
            <button type="button" class="maps-style-btn ${mapsStyle === 'dark' ? 'is-active' : ''}" data-ref="btn-map-dark" data-map-type="roadmap" data-map-style="dark">Oscuro</button>
          </div>
        </div>

        <div class="maps-controls-section" data-ref="maps-controls-zoom">
          <div style="display: flex; align-items: center; justify-content: space-between;">
            <span class="maps-controls-label" data-ref="label-maps-zoom">Zoom</span>
            <span style="font-size: 11px; color: var(--text-tertiary);" data-ref="label-maps-zoom-val">${mapsZoom}</span>
          </div>
          <input class="qr-range-slider" data-ref="slider-maps-zoom" type="range" min="3" max="18" step="1" value="${mapsZoom}" aria-label="Nivel de zoom del mapa" />
        </div>

        <div style="display: flex; align-items: center; justify-content: space-between; padding: 2px 0;">
          <label style="display: flex; align-items: center; gap: 8px; font-size: 11.5px; color: var(--text-secondary); cursor: pointer;" data-ref="label-marker-toggle">
            <input data-ref="check-maps-marker" type="checkbox" ${mapsShowMarker ? 'checked' : ''} />
            <span>Marcador de ubicación</span>
          </label>
          <a class="link" data-ref="link-open-gmaps" href="${getGoogleMapsExternalUrl(mapsAddress)}" target="_blank" rel="noopener noreferrer" style="font-size: 11px; display: flex; align-items: center; gap: 4px;">
            <span>Abrir Maps</span>
            <svg class="component-icon" aria-hidden="true" style="width: 12px; height: 12px;"><use href="/icons.svg#open_in_new"></use></svg>
          </a>
        </div>

        <button type="button" class="component-button component-button--h44 component-button--black component-button--w-full" data-ref="btn-insert-map-canvas">
          <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#add"></use></svg>
          <span>Insertar mapa en el diseño</span>
        </button>
      </div>
    </div>
  `;

  const btnBack = drawerBody.querySelector<HTMLButtonElement>('[data-ref="btn-apps-back"]');
  btnBack?.addEventListener('click', () => {
    activeAppId = null;
    renderAppsDrawerContent(drawer, drawerBody);
  });

  const btnClose = drawerBody.querySelector<HTMLElement>('[data-ref="btn-close-canvas-panel"]');
  btnClose?.addEventListener('click', (e) => {
    e.preventDefault();
    toggleDrawer(false);
  });

  const searchInput = drawerBody.querySelector<HTMLInputElement>('[data-ref="maps-search-input"]');
  const previewImg = drawerBody.querySelector<HTMLImageElement>('[data-ref="maps-preview-img"]');
  const zoomSlider = drawerBody.querySelector<HTMLInputElement>('[data-ref="slider-maps-zoom"]');
  const zoomValLabel = drawerBody.querySelector<HTMLElement>('[data-ref="label-maps-zoom-val"]');
  const markerCheck = drawerBody.querySelector<HTMLInputElement>('[data-ref="check-maps-marker"]');
  const linkOpen = drawerBody.querySelector<HTMLAnchorElement>('[data-ref="link-open-gmaps"]');
  const btnInsert = drawerBody.querySelector<HTMLButtonElement>('[data-ref="btn-insert-map-canvas"]');

  const updateMapPreview = () => {
    const url = buildStaticMapUrl({
      address: mapsAddress,
      mapType: mapsType,
      showMarker: mapsShowMarker,
      styleTheme: mapsStyle,
      zoom: mapsZoom,
    });
    if (previewImg) previewImg.src = url;
    if (linkOpen) linkOpen.href = getGoogleMapsExternalUrl(mapsAddress);
    if (zoomValLabel) zoomValLabel.textContent = String(mapsZoom);
  };

  let debounceTimer: number | null = null;
  searchInput?.addEventListener('input', () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = window.setTimeout(() => {
      const q = searchInput.value.trim();
      if (q) {
        mapsAddress = q;
        updateMapPreview();
      }
    }, 500);
  });

  drawerBody.querySelectorAll<HTMLButtonElement>('[data-map-loc]').forEach((chip) => {
    chip.addEventListener('click', () => {
      const loc = chip.getAttribute('data-map-loc');
      if (loc && searchInput) {
        mapsAddress = loc;
        searchInput.value = loc;
        updateMapPreview();
      }
    });
  });

  drawerBody.querySelectorAll<HTMLButtonElement>('[data-map-type]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const mType = btn.getAttribute('data-map-type') as MapTypeOption;
      const mStyle = btn.getAttribute('data-map-style') as MapStyleOption;
      if (mType) {
        mapsType = mType;
        mapsStyle = mStyle || 'standard';
        drawerBody.querySelectorAll<HTMLButtonElement>('[data-map-type]').forEach((b) => b.classList.remove('is-active'));
        btn.classList.add('is-active');
        updateMapPreview();
      }
    });
  });

  zoomSlider?.addEventListener('input', () => {
    mapsZoom = Number(zoomSlider.value);
    updateMapPreview();
  });

  markerCheck?.addEventListener('change', () => {
    mapsShowMarker = markerCheck.checked;
    updateMapPreview();
  });

  btnInsert?.addEventListener('click', async () => {
    const controller = getActiveCanvasController();
    const canvasType = getActiveCanvasType();
    if (!controller) {
      showToast('No se encontró el controlador del lienzo activo', 'warning');
      return;
    }

    const mapUrl = buildStaticMapUrl({
      address: mapsAddress,
      height: 480,
      mapType: mapsType,
      showMarker: mapsShowMarker,
      styleTheme: mapsStyle,
      width: 640,
      zoom: mapsZoom,
    });

    showToast(`Generando mapa de «${mapsAddress}»...`, 'info');

    try {
      const res = await fetchMapImageBlob(mapUrl);
      if (canvasType === 'doc') {
        controller.insertImage(res.dataUrl, `Mapa: ${mapsAddress}`, '75%');
      } else {
        controller.insertImage?.(res.dataUrl, 640, 480, `Mapa: ${mapsAddress}`);
      }
      showToast(`Mapa de «${mapsAddress}» insertado en el lienzo`, 'success');
      if (window.innerWidth <= 768) {
        toggleDrawer(false);
      }
    } catch {
      if (canvasType === 'doc') {
        controller.insertImage(mapUrl, `Mapa: ${mapsAddress}`, '75%');
      } else {
        controller.insertImage?.(mapUrl, 640, 480, `Mapa: ${mapsAddress}`);
      }
      showToast(`Mapa de «${mapsAddress}» insertado`, 'success');
      if (window.innerWidth <= 768) {
        toggleDrawer(false);
      }
    }
  });

  if (sidebar) {
    updateCanvasRailActiveState(sidebar);
  }
  renderIcons(drawerBody);
}

export function renderAppsDrawerContent(drawer: HTMLElement, drawerBody: HTMLElement): void {
  const sidebar = drawer.closest<HTMLElement>('[data-ref="sidebar"]') || document.querySelector<HTMLElement>('[data-ref="sidebar"]');

  if (activeAppId === 'google-photos') {
    renderGooglePhotosAppContent(drawer, drawerBody);
    return;
  }

  if (activeAppId === 'google-maps') {
    renderGoogleMapsAppContent(drawer, drawerBody);
    return;
  }

  if (activeAppId === 'google-drive') {
    renderGoogleDriveAppContent(drawer, drawerBody);
    return;
  }

  if (activeAppId === 'youtube') {
    renderYouTubeAppContent(drawer, drawerBody);
    return;
  }

  if (activeAppId === 'qr-code') {
    void import('qr-code-styling').then(({ default: QRCodeStyling }) => {
      drawerBody.innerHTML = `
      <div class="canvas-panel-card" data-ref="canvas-panel-card">
        <div class="canvas-panel-card__header" data-ref="canvas-panel-header">
          <div class="canvas-panel-card__title-box" data-ref="canvas-panel-title-box">
            <svg class="component-icon canvas-panel-card__icon" aria-hidden="true"><use href="/icons.svg#qr_code"></use></svg>
            <span class="canvas-panel-card__title" data-ref="canvas-panel-title">Código QR</span>
          </div>
          <button type="button" class="component-button component-button--h32 component-button--icon-only rail-btn canvas-panel-card__close" data-ref="btn-close-canvas-panel" data-tooltip="Cerrar panel" aria-label="Cerrar panel">
            <svg class="component-icon rail-btn__icon" aria-hidden="true"><use href="/icons.svg#close"></use></svg>
          </button>
        </div>
        <div class="canvas-panel-card__body qr-drawer-body" data-ref="canvas-panel-body">
          <button type="button" class="elements-back-btn" data-ref="btn-apps-back" style="margin-bottom: 12px;">
            <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#arrow_back"></use></svg>
            <span>Volver a Apps</span>
          </button>

          <div class="qr-preview-wrapper" data-ref="qr-preview-wrapper">
            <div class="qr-preview-card" data-ref="qr-preview-card">
              <div class="qr-preview-box" data-ref="qr-preview-box"></div>
            </div>
          </div>

          <div class="qr-drawer-section" data-ref="qr-section-url">
            <label class="field" data-ref="field-qr-url">
              <input class="field__input" data-ref="qr-input-url" type="text" placeholder=" " value="https://spriteboard.com" autocomplete="off" />
              <span class="field__label">URL o contenido</span>
            </label>
          </div>

          <div class="qr-drawer-section" data-ref="qr-section-fg-color">
            <div class="qr-drawer-section__header">
              <span class="qr-drawer-section__title">Color del código</span>
              <span class="qr-drawer-section__hex" data-ref="qr-fg-hex-label">#000000</span>
            </div>
            <div class="qr-color-controls">
              <div class="design-color-btn-rainbow-wrapper" data-tooltip="Elegir color personalizado">
                <input class="design-color-active-input" data-ref="input-qr-fg-color" type="color" value="#000000" aria-label="Color del código QR" />
                <div class="design-color-btn-rainbow">
                  <div class="design-color-btn-rainbow__inner">
                    <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#add"></use></svg>
                  </div>
                </div>
              </div>
              <div class="qr-swatches-grid" data-ref="qr-fg-swatches">
                <button type="button" class="qr-swatch-btn is-active" data-ref="qr-fg-swatch-000000" data-color="#000000" style="background-color: #000000;" data-tooltip="Negro" aria-label="Negro"></button>
                <button type="button" class="qr-swatch-btn" data-ref="qr-fg-swatch-1e293b" data-color="#1e293b" style="background-color: #1e293b;" data-tooltip="Pizarra" aria-label="Pizarra"></button>
                <button type="button" class="qr-swatch-btn" data-ref="qr-fg-swatch-2563eb" data-color="#2563eb" style="background-color: #2563eb;" data-tooltip="Azul" aria-label="Azul"></button>
                <button type="button" class="qr-swatch-btn" data-ref="qr-fg-swatch-7c3aed" data-color="#7c3aed" style="background-color: #7c3aed;" data-tooltip="Violeta" aria-label="Violeta"></button>
                <button type="button" class="qr-swatch-btn" data-ref="qr-fg-swatch-db2777" data-color="#db2777" style="background-color: #db2777;" data-tooltip="Rosa" aria-label="Rosa"></button>
                <button type="button" class="qr-swatch-btn" data-ref="qr-fg-swatch-059669" data-color="#059669" style="background-color: #059669;" data-tooltip="Esmeralda" aria-label="Esmeralda"></button>
                <button type="button" class="qr-swatch-btn" data-ref="qr-fg-swatch-ea580c" data-color="#ea580c" style="background-color: #ea580c;" data-tooltip="Naranja" aria-label="Naranja"></button>
              </div>
            </div>
          </div>

          <div class="qr-drawer-section" data-ref="qr-section-bg-color">
            <div class="qr-drawer-section__header">
              <span class="qr-drawer-section__title">Color de fondo</span>
              <span class="qr-drawer-section__hex" data-ref="qr-bg-hex-label">#FFFFFF</span>
            </div>
            <div class="qr-color-controls">
              <div class="design-color-btn-rainbow-wrapper" data-tooltip="Elegir color personalizado">
                <input class="design-color-active-input" data-ref="input-qr-bg-color" type="color" value="#ffffff" aria-label="Color de fondo" />
                <div class="design-color-btn-rainbow">
                  <div class="design-color-btn-rainbow__inner">
                    <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#add"></use></svg>
                  </div>
                </div>
              </div>
              <div class="qr-swatches-grid" data-ref="qr-bg-swatches">
                <button type="button" class="qr-swatch-btn is-active" data-ref="qr-bg-swatch-ffffff" data-color="#ffffff" style="background-color: #ffffff;" data-tooltip="Blanco" aria-label="Blanco"></button>
                <button type="button" class="qr-swatch-btn qr-swatch-btn--transparent" data-ref="qr-bg-swatch-transparent" data-color="transparent" data-tooltip="Transparente" aria-label="Transparente"></button>
                <button type="button" class="qr-swatch-btn" data-ref="qr-bg-swatch-000000" data-color="#000000" style="background-color: #000000;" data-tooltip="Negro" aria-label="Negro"></button>
                <button type="button" class="qr-swatch-btn" data-ref="qr-bg-swatch-f8fafc" data-color="#f8fafc" style="background-color: #f8fafc;" data-tooltip="Gris claro" aria-label="Gris claro"></button>
                <button type="button" class="qr-swatch-btn" data-ref="qr-bg-swatch-fef3c7" data-color="#fef3c7" style="background-color: #fef3c7;" data-tooltip="Crema" aria-label="Crema"></button>
                <button type="button" class="qr-swatch-btn" data-ref="qr-bg-swatch-eff6ff" data-color="#eff6ff" style="background-color: #eff6ff;" data-tooltip="Azul pastel" aria-label="Azul pastel"></button>
                <button type="button" class="qr-swatch-btn" data-ref="qr-bg-swatch-fdf2f8" data-color="#fdf2f8" style="background-color: #fdf2f8;" data-tooltip="Rosa pastel" aria-label="Rosa pastel"></button>
              </div>
            </div>
          </div>

          <div class="qr-drawer-section" data-ref="qr-section-margin">
            <div class="qr-drawer-section__header">
              <span class="qr-drawer-section__title">Margen</span>
              <span class="qr-drawer-section__value" data-ref="qr-margin-val-label">10px</span>
            </div>
            <div class="qr-slider-row">
              <input class="qr-range-slider" data-ref="slider-qr-margin" type="range" min="0" max="40" step="2" value="10" aria-label="Margen del código QR" />
            </div>
          </div>

          <div class="qr-drawer-actions" data-ref="qr-drawer-actions">
            <button type="button" class="component-button component-button--h44 component-button--black component-button--w-full" data-ref="btn-insert-qr">
              <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#add"></use></svg>
              <span>Agregar al diseño</span>
            </button>
          </div>
        </div>
      </div>
    `;

    const btnBack = drawerBody.querySelector<HTMLButtonElement>('[data-ref="btn-apps-back"]');
    btnBack?.addEventListener('click', () => {
      activeAppId = null;
      renderAppsDrawerContent(drawer, drawerBody);
    });

    const btnClose = drawerBody.querySelector<HTMLElement>('[data-ref="btn-close-canvas-panel"]');
    btnClose?.addEventListener('click', (e) => {
      e.preventDefault();
      toggleDrawer(false);
    });

    const previewBox = drawerBody.querySelector<HTMLElement>('[data-ref="qr-preview-box"]');
    const inputUrl = drawerBody.querySelector<HTMLInputElement>('[data-ref="qr-input-url"]');
    const inputFgColor = drawerBody.querySelector<HTMLInputElement>('[data-ref="input-qr-fg-color"]');
    const inputBgColor = drawerBody.querySelector<HTMLInputElement>('[data-ref="input-qr-bg-color"]');
    const fgHexLabel = drawerBody.querySelector<HTMLElement>('[data-ref="qr-fg-hex-label"]');
    const bgHexLabel = drawerBody.querySelector<HTMLElement>('[data-ref="qr-bg-hex-label"]');
    const sliderMargin = drawerBody.querySelector<HTMLInputElement>('[data-ref="slider-qr-margin"]');
    const marginValLabel = drawerBody.querySelector<HTMLElement>('[data-ref="qr-margin-val-label"]');
    const btnInsert = drawerBody.querySelector<HTMLButtonElement>('[data-ref="btn-insert-qr"]');
    const fgSwatches = drawerBody.querySelectorAll<HTMLButtonElement>('[data-ref="qr-fg-swatches"] .qr-swatch-btn');
    const bgSwatches = drawerBody.querySelectorAll<HTMLButtonElement>('[data-ref="qr-bg-swatches"] .qr-swatch-btn');

    let currentUrl = 'https://spriteboard.com';
    let currentFg = '#000000';
    let currentBg = '#ffffff';
    let currentMargin = 10;

    const qrInstance = new QRCodeStyling({
      width: 200,
      height: 200,
      data: currentUrl,
      margin: currentMargin,
      qrOptions: { errorCorrectionLevel: 'Q' },
      dotsOptions: { color: currentFg, type: 'square' },
      cornersSquareOptions: { color: currentFg, type: 'square' },
      cornersDotOptions: { color: currentFg, type: 'square' },
      backgroundOptions: { color: currentBg === 'transparent' ? '#00000000' : currentBg },
    });

    if (previewBox) {
      previewBox.innerHTML = '';
      qrInstance.append(previewBox);
    }

    const updatePreview = () => {
      qrInstance.update({
        data: currentUrl.trim() || 'https://spriteboard.com',
        margin: currentMargin,
        dotsOptions: { color: currentFg, type: 'square' },
        cornersSquareOptions: { color: currentFg, type: 'square' },
        cornersDotOptions: { color: currentFg, type: 'square' },
        backgroundOptions: { color: currentBg === 'transparent' ? '#00000000' : currentBg },
      });
    };

    inputUrl?.addEventListener('input', () => {
      currentUrl = inputUrl.value;
      updatePreview();
    });

    const setFgColor = (color: string) => {
      currentFg = color;
      if (inputFgColor) inputFgColor.value = color;
      if (fgHexLabel) fgHexLabel.textContent = color.toUpperCase();
      fgSwatches.forEach((s) => s.classList.toggle('is-active', s.getAttribute('data-color')?.toLowerCase() === color.toLowerCase()));
      updatePreview();
    };

    const setBgColor = (color: string) => {
      currentBg = color;
      if (inputBgColor && color !== 'transparent') inputBgColor.value = color;
      if (bgHexLabel) bgHexLabel.textContent = color === 'transparent' ? 'TRANSPARENTE' : color.toUpperCase();
      bgSwatches.forEach((s) => s.classList.toggle('is-active', s.getAttribute('data-color')?.toLowerCase() === color.toLowerCase()));
      updatePreview();
    };

    inputFgColor?.addEventListener('input', () => {
      setFgColor(inputFgColor.value);
    });

    inputBgColor?.addEventListener('input', () => {
      setBgColor(inputBgColor.value);
    });

    fgSwatches.forEach((btn) => {
      btn.addEventListener('click', () => {
        const color = btn.getAttribute('data-color');
        if (color) setFgColor(color);
      });
    });

    bgSwatches.forEach((btn) => {
      btn.addEventListener('click', () => {
        const color = btn.getAttribute('data-color');
        if (color) setBgColor(color);
      });
    });

    sliderMargin?.addEventListener('input', () => {
      currentMargin = parseInt(sliderMargin.value, 10) || 0;
      if (marginValLabel) marginValLabel.textContent = `${currentMargin}px`;
      updatePreview();
    });

    btnInsert?.addEventListener('click', async () => {
      try {
        btnInsert.disabled = true;

        const exportQr = new QRCodeStyling({
          width: 600,
          height: 600,
          data: currentUrl.trim() || 'https://spriteboard.com',
          margin: currentMargin * 2,
          qrOptions: { errorCorrectionLevel: 'Q' },
          dotsOptions: { color: currentFg, type: 'square' },
          cornersSquareOptions: { color: currentFg, type: 'square' },
          cornersDotOptions: { color: currentFg, type: 'square' },
          backgroundOptions: { color: currentBg === 'transparent' ? '#00000000' : currentBg },
        });

        const blob = (await exportQr.getRawData('png')) as Blob | null;
        if (!blob) {
          showToast('Error al generar el código QR', 'danger');
          return;
        }

        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });

        const canvasType = getActiveCanvasType();
        const controller = getActiveCanvasController();

        if (canvasType === 'doc') {
          if (!controller) {
            showToast('No se encontró el controlador del documento', 'warning');
            return;
          }
          controller.insertImage(dataUrl, 'Código QR', '220px');
        } else {
          if (!controller) {
            showToast('No se encontró el controlador del lienzo', 'warning');
            return;
          }
          controller.insertImage?.(dataUrl, 260, 260, 'Código QR');
        }

        showToast('Código QR agregado al diseño', 'success');
        if (window.innerWidth <= 768) {
          toggleDrawer(false);
        }
      } catch {
        showToast('Error al generar el código QR', 'danger');
      } finally {
        btnInsert.disabled = false;
      }
    });

    if (sidebar) {
      updateCanvasRailActiveState(sidebar);
    }
    renderIcons(drawerBody);
  });
  return;
}

  drawerBody.innerHTML = `
    <div class="canvas-panel-card" data-ref="canvas-panel-card">
      <div class="canvas-panel-card__header" data-ref="canvas-panel-header">
        <div class="canvas-panel-card__title-box" data-ref="canvas-panel-title-box">
          <svg class="component-icon canvas-panel-card__icon" aria-hidden="true"><use href="/icons.svg#apps"></use></svg>
          <span class="canvas-panel-card__title" data-ref="canvas-panel-title">Apps</span>
        </div>
        <button type="button" class="component-button component-button--h32 component-button--icon-only rail-btn canvas-panel-card__close" data-ref="btn-close-canvas-panel" data-tooltip="Cerrar panel" aria-label="Cerrar panel">
          <svg class="component-icon rail-btn__icon" aria-hidden="true"><use href="/icons.svg#close"></use></svg>
        </button>
      </div>
      <div class="canvas-panel-card__body apps-drawer-body" data-ref="canvas-panel-body">
        <div class="menu-panel__search" data-ref="canvas-apps-search">
          <svg class="component-icon menu-panel__search-icon" aria-hidden="true"><use href="/icons.svg#search"></use></svg>
          <input class="menu-panel__search-input" data-ref="canvas-apps-search-input" type="text" maxlength="50" autocomplete="off" placeholder="Buscar aplicaciones..." />
        </div>

        <div class="mockup-category-tabs" data-ref="apps-category-tabs" style="margin-bottom: 10px;">
          ${APP_CATEGORIES.map((cat) => `
            <button type="button" class="mockup-category-pill ${activeAppCategory === cat.id ? 'is-active' : ''}" data-ref="app-cat-pill-${cat.id}" data-app-cat="${cat.id}">
              ${escapeHtml(cat.name)}
            </button>
          `).join('')}
        </div>

        <div class="elements-section-title" data-ref="apps-section-title">Aplicaciones e integraciones</div>
        <div class="apps-grid" data-ref="apps-grid"></div>
      </div>
    </div>
  `;

  const btnClose = drawerBody.querySelector<HTMLElement>('[data-ref="btn-close-canvas-panel"]');
  btnClose?.addEventListener('click', (e) => {
    e.preventDefault();
    toggleDrawer(false);
  });

  const searchInput = drawerBody.querySelector<HTMLInputElement>('[data-ref="canvas-apps-search-input"]');
  const appsGrid = drawerBody.querySelector<HTMLElement>('[data-ref="apps-grid"]');

  const renderAppsList = (query = '') => {
    if (!appsGrid) return;
    const filtered = searchApps(query, activeAppCategory);

    if (filtered.length === 0) {
      appsGrid.innerHTML = `
        <div class="mockup-empty-state" data-ref="apps-empty">
          No se encontraron aplicaciones que coincidan con la búsqueda.
        </div>
      `;
      return;
    }

    appsGrid.innerHTML = filtered.map((app) => `
      <button type="button" class="app-card" data-ref="btn-app-card-${app.id}" data-app-id="${app.id}" data-tooltip="${escapeHtml(app.description)}" aria-label="${escapeHtml(app.name)}">
        <div class="app-card__thumb" data-ref="app-card-thumb-${app.id}">
          ${app.iconSvg || `<svg class="component-icon" aria-hidden="true" style="width: 36px; height: 36px;"><use href="/icons.svg#${app.icon}"></use></svg>`}
          ${app.badge ? `<span class="app-card__badge app-card__badge--${app.status}" data-ref="app-badge-${app.id}">${escapeHtml(app.badge)}</span>` : ''}
        </div>
        <div class="app-card__info" data-ref="app-card-info-${app.id}">
          <span class="app-card__title" data-ref="app-card-title-${app.id}">${escapeHtml(app.name)}</span>
          <span class="app-card__author" data-ref="app-card-author-${app.id}">${escapeHtml(app.author)}</span>
          <span class="app-card__desc" data-ref="app-card-desc-${app.id}">${escapeHtml(app.description)}</span>
        </div>
      </button>
    `).join('');

    appsGrid.querySelectorAll<HTMLButtonElement>('[data-app-id]').forEach((card) => {
      card.addEventListener('click', () => {
        const appId = card.getAttribute('data-app-id');
        const found = getAppById(appId || '');
        if (!found) return;

        if (found.id === 'google-drive') {
          activeAppId = 'google-drive';
          renderAppsDrawerContent(drawer, drawerBody);
          return;
        }

        if (found.id === 'google-photos') {
          activeAppId = 'google-photos';
          renderAppsDrawerContent(drawer, drawerBody);
          return;
        }

        if (found.id === 'google-maps') {
          activeAppId = 'google-maps';
          renderAppsDrawerContent(drawer, drawerBody);
          return;
        }

        if (found.id === 'qr-code') {
          activeAppId = 'qr-code';
          renderAppsDrawerContent(drawer, drawerBody);
          return;
        }

        if (found.id === 'youtube') {
          activeAppId = 'youtube';
          renderAppsDrawerContent(drawer, drawerBody);
          return;
        }

        if (found.status === 'coming_soon') {
          showToast(`La integración con ${found.name} estará disponible próximamente`, 'info');
        }
      });
    });

    renderIcons(appsGrid);
  };

  searchInput?.addEventListener('input', () => {
    renderAppsList(searchInput.value);
  });

  drawerBody.querySelectorAll<HTMLButtonElement>('[data-app-cat]').forEach((pill) => {
    pill.addEventListener('click', () => {
      const cat = pill.getAttribute('data-app-cat') as AppCategory;
      if (cat) {
        activeAppCategory = cat;
        drawerBody.querySelectorAll<HTMLButtonElement>('[data-app-cat]').forEach((p) => {
          p.classList.toggle('is-active', p.getAttribute('data-app-cat') === cat);
        });
        renderAppsList(searchInput?.value || '');
      }
    });
  });

  renderAppsList(searchInput?.value || '');

  if (sidebar) {
    updateCanvasRailActiveState(sidebar);
  }
  renderIcons(drawerBody);
}

