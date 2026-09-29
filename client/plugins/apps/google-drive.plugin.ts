import { getActiveCanvasController, getActiveCanvasType, toggleDrawer, updateCanvasRailActiveState } from '../../components/layout.component.js';
import { getAppById } from '../../config/apps.config.js';
import { escapeHtml } from '../../services/api.service.js';
import { connectGoogleDrive, disconnectGoogleDrive, fetchGoogleDriveFileBlob, formatFileSize, getGoogleDriveUser, GoogleDriveFile, isGoogleDriveConnected, listGoogleDriveFiles, openGooglePicker, uploadCanvasExportToDrive } from '../../services/google-drive.service.js';
import { renderIcons } from '../../services/icon.service.js';
import { showToast } from '../../services/toast.service.js';
import { AppPlugin, AppPluginContext } from '../plugin.types.js';

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

export class GoogleDrivePlugin implements AppPlugin {
  public readonly id = 'google-drive';

  public render(ctx: AppPluginContext): void {
    const { drawer, drawerBody, onBack, onClose } = ctx;
    const sidebar = drawer.closest<HTMLElement>('[data-ref="sidebar"]') || document.querySelector<HTMLElement>('[data-ref="sidebar"]');

    if (!isGoogleDriveConnected()) {
      drawerBody.innerHTML = `
        <div class="canvas-panel-card" data-ref="canvas-panel-card">
          <div class="canvas-panel-card__header" data-ref="canvas-panel-header">
            <div class="canvas-panel-card__title-box" data-ref="canvas-panel-title-box">
              ${getAppById('google-drive')?.iconSvg || '<svg class="component-icon canvas-panel-card__icon"><use href="/icons.svg#add_to_drive"></use></svg>'}
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
                ${getAppById('google-drive')?.iconSvg || '<svg class="component-icon"><use href="/icons.svg#add_to_drive"></use></svg>'}
              </div>
              <span class="drive-connect-title" data-ref="drive-connect-title">Conecta con Google Drive</span>
              <span class="drive-connect-desc" data-ref="drive-connect-desc">Accede a tus fotos, ilustraciones, carpetas y documentos de Google Drive sin salir de Spriteboard.</span>

              <div class="drive-connect-features" data-ref="drive-connect-features">
                <div class="drive-connect-feature-item" data-ref="drive-feat-1">
                  <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#check"></use></svg>
                  <span>Explora todas tus carpetas y archivos en la nube</span>
                </div>
                <div class="drive-connect-feature-item" data-ref="drive-feat-2">
                  <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#check"></use></svg>
                  <span>Inserta imágenes en alta resolución con un solo clic</span>
                </div>
                <div class="drive-connect-feature-item" data-ref="drive-feat-3">
                  <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#check"></use></svg>
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
        onBack();
      });

      const btnClose = drawerBody.querySelector<HTMLElement>('[data-ref="btn-close-canvas-panel"]');
      btnClose?.addEventListener('click', (e) => {
        e.preventDefault();
        onClose();
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
          this.render(ctx);
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
            ${getAppById('google-drive')?.iconSvg || '<svg class="component-icon canvas-panel-card__icon"><use href="/icons.svg#add_to_drive"></use></svg>'}
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
      onBack();
    });

    const btnClose = drawerBody.querySelector<HTMLElement>('[data-ref="btn-close-canvas-panel"]');
    btnClose?.addEventListener('click', (e) => {
      e.preventDefault();
      onClose();
    });

    const btnDisconnect = drawerBody.querySelector<HTMLButtonElement>('[data-ref="btn-disconnect-drive"]');
    btnDisconnect?.addEventListener('click', () => {
      disconnectGoogleDrive();
      showToast('Cuenta de Google Drive desconectada', 'info');
      this.render(ctx);
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
}

export const googleDrivePlugin = new GoogleDrivePlugin();
