import { getActiveCanvasController, getActiveCanvasType, toggleDrawer, updateCanvasRailActiveState } from '../../components/layout.component.js';
import { getAppById } from '../../config/apps.config.js';
import { escapeHtml } from '../../services/api.service.js';
import { connectGooglePhotos, disconnectGooglePhotos, fetchPhotoBlob, getGooglePhotosUser, GooglePhotoItem, isGooglePhotosConnected, listGooglePhotos, listGooglePhotosAlbums, openGooglePhotosPicker } from '../../services/google-photos.service.js';
import { renderIcons } from '../../services/icon.service.js';
import { showToast } from '../../services/toast.service.js';
import { AppPlugin, AppPluginContext } from '../plugin.types.js';

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

export class GooglePhotosPlugin implements AppPlugin {
  public readonly id = 'google-photos';

  public render(ctx: AppPluginContext): void {
    const { drawer, drawerBody, onBack, onClose } = ctx;
    const sidebar = drawer.closest<HTMLElement>('[data-ref="sidebar"]') || document.querySelector<HTMLElement>('[data-ref="sidebar"]');

    if (!isGooglePhotosConnected()) {
      drawerBody.innerHTML = `
        <div class="canvas-panel-card" data-ref="canvas-panel-card">
          <div class="canvas-panel-card__header" data-ref="canvas-panel-header">
            <div class="canvas-panel-card__title-box" data-ref="canvas-panel-title-box">
              ${getAppById('google-photos')?.iconSvg || '<svg class="component-icon canvas-panel-card__icon"><use href="/icons.svg#photo_library"></use></svg>'}
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
                ${getAppById('google-photos')?.iconSvg || '<svg class="component-icon"><use href="/icons.svg#photo_library"></use></svg>'}
              </div>
              <span class="drive-connect-title" data-ref="photos-connect-title">Conecta con Google Fotos</span>
              <span class="drive-connect-desc" data-ref="photos-connect-desc">Accede a tus fotografías, ilustraciones y álbumes personales para agregarlos directamente a tu diseño.</span>

              <div class="drive-connect-features" data-ref="photos-connect-features">
                <div class="drive-connect-feature-item" data-ref="photos-feat-1">
                  <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#check"></use></svg>
                  <span>Accede a tus fotos y álbumes de Google</span>
                </div>
                <div class="drive-connect-feature-item" data-ref="photos-feat-2">
                  <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#check"></use></svg>
                  <span>Inserta imágenes en alta calidad en un solo clic</span>
                </div>
                <div class="drive-connect-feature-item" data-ref="photos-feat-3">
                  <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#check"></use></svg>
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
        onBack();
      });

      const btnClose = drawerBody.querySelector<HTMLElement>('[data-ref="btn-close-canvas-panel"]');
      btnClose?.addEventListener('click', (e) => {
        e.preventDefault();
        onClose();
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
          this.render(ctx);
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
            ${getAppById('google-photos')?.iconSvg || '<svg class="component-icon canvas-panel-card__icon"><use href="/icons.svg#photo_library"></use></svg>'}
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
      onBack();
    });

    const btnClose = drawerBody.querySelector<HTMLElement>('[data-ref="btn-close-canvas-panel"]');
    btnClose?.addEventListener('click', (e) => {
      e.preventDefault();
      onClose();
    });

    const btnDisconnect = drawerBody.querySelector<HTMLButtonElement>('[data-ref="btn-disconnect-photos"]');
    btnDisconnect?.addEventListener('click', () => {
      disconnectGooglePhotos();
      showToast('Cuenta de Google Fotos desconectada', 'info');
      this.render(ctx);
    });

    const btnBackToAlbums = drawerBody.querySelector<HTMLButtonElement>('[data-ref="btn-back-to-albums"]');
    btnBackToAlbums?.addEventListener('click', () => {
      photosActiveAlbumId = null;
      photosActiveAlbumTitle = null;
      this.render(ctx);
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
                this.render(ctx);
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
            this.render(ctx);
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
}

export const googlePhotosPlugin = new GooglePhotosPlugin();
