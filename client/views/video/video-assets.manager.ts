import { currentUser, getUploadsApi, uploadFilesApi } from '../../services/api.service.js';
import { showToast } from '../../services/toast.service.js';
import { VideoClip, VideoMediaType } from './video.types.js';

export interface VideoAssetsManagerOptions {
  container: HTMLElement;
  onAddClip: (clip: Partial<VideoClip>) => void;
}

export class VideoAssetsManager {
  private _container: HTMLElement;
  private _onAddClip: (clip: Partial<VideoClip>) => void;
  private _uploads: any[] = [];
  private _activeFilter: 'all' | 'audio' | 'image' | 'video' = 'all';
  private _abortController: AbortController | null = null;

  constructor(options: VideoAssetsManagerOptions) {
    this._container = options.container;
    this._onAddClip = options.onAddClip;
  }

  public init(): void {
    this._abortController = new AbortController();
    const signal = this._abortController.signal;

    const filterPills = this._container.querySelectorAll<HTMLElement>('[data-ref^="btn-filter-uploads-"]');
    filterPills.forEach((pill) => {
      pill.addEventListener('click', () => {
        const filterType = pill.getAttribute('data-type') as 'all' | 'audio' | 'image' | 'video';
        this._activeFilter = filterType || 'all';
        filterPills.forEach((p) => p.classList.remove('is-active'));
        pill.classList.add('is-active');
        this.renderUploads();
      }, { signal });
    });

    const fileInput = this._container.querySelector<HTMLInputElement>('[data-ref="input-video-upload-file"]');
    const dropzone = this._container.querySelector<HTMLElement>('[data-ref="video-upload-dropzone"]');

    dropzone?.addEventListener('click', () => fileInput?.click(), { signal });

    fileInput?.addEventListener('change', () => {
      if (fileInput.files && fileInput.files.length > 0) {
        void this.handleUploadFiles(Array.from(fileInput.files));
        fileInput.value = '';
      }
    }, { signal });

    dropzone?.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzone.classList.add('is-dragover');
    }, { signal });

    dropzone?.addEventListener('dragleave', () => {
      dropzone.classList.remove('is-dragover');
    }, { signal });

    dropzone?.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.classList.remove('is-dragover');
      if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
        void this.handleUploadFiles(Array.from(e.dataTransfer.files));
      }
    }, { signal });

    void this.loadUploads();
  }

  public async loadUploads(): Promise<void> {
    if (!currentUser) {
      this.renderUploads();
      return;
    }
    try {
      const res = await getUploadsApi('all');
      if (res.success && Array.isArray(res.uploads)) {
        this._uploads = res.uploads;
        this.renderUploads();
      }
    } catch {
      this._uploads = [];
      this.renderUploads();
    }
  }

  private async handleUploadFiles(files: File[]): Promise<void> {
    if (!currentUser) {
      showToast('Inicia sesión para subir archivos a la nube.', 'warning');
      return;
    }
    showToast('Subiendo archivo(s)...', 'info');
    try {
      const res = await uploadFilesApi(files);
      if (res.success && res.uploads) {
        this._uploads = [...res.uploads, ...this._uploads];
        this.renderUploads();
        showToast('Archivos subidos correctamente.', 'success');
      } else {
        showToast(res.message || 'Error al subir archivos.', 'danger');
      }
    } catch {
      showToast('Error de conexión al subir archivos.', 'danger');
    }
  }

  public renderUploads(): void {
    const grid = this._container.querySelector<HTMLElement>('[data-ref="video-uploads-grid"]');
    if (!grid) return;

    let list = this._uploads;
    if (this._activeFilter === 'video') {
      list = list.filter((u) => u.media_type === 'video');
    } else if (this._activeFilter === 'image') {
      list = list.filter((u) => u.media_type === 'image');
    } else if (this._activeFilter === 'audio') {
      list = list.filter((u) => u.media_type === 'audio' || (u.mime_type && u.mime_type.startsWith('audio/')));
    }

    if (list.length === 0) {
      grid.innerHTML = `
        <div style="grid-column: 1 / -1; padding: 24px 8px; text-align: center; color: var(--text-secondary); font-size: 13px;">
          No hay archivos subidos aún. Arrastra videos, fotos o música aquí.
        </div>
      `;
      return;
    }

    grid.innerHTML = list.map((item) => {
      const isVid = item.media_type === 'video';
      const isAud = item.media_type === 'audio' || (item.mime_type && item.mime_type.startsWith('audio/'));
      const durationStr = item.duration_seconds ? `${Math.round(item.duration_seconds)}s` : (isVid ? 'Video' : (isAud ? 'Audio' : 'Imagen'));
      const thumb = item.thumbnail_url || item.url;
      const name = item.original_filename || 'Archivo';

      return `
        <div class="video-upload-grid-item" data-ref="upload-item-${item.uuid || item.id}" draggable="true" data-url="${item.url}" data-name="${name}" data-thumb="${thumb}" data-type="${item.media_type}" data-duration="${item.duration_seconds || 5}">
          <img class="video-upload-grid-item__thumb" src="${thumb}" alt="${name}" loading="lazy" />
          <span class="video-upload-grid-item__badge">${durationStr}</span>
          <button type="button" class="video-upload-grid-item__add-btn" data-ref="btn-add-upload-${item.uuid || item.id}" data-tooltip="Añadir a línea de tiempo" aria-label="Añadir a línea de tiempo">
            <svg class="component-icon" style="width: 16px; height: 16px;" aria-hidden="true"><use href="/icons.svg#add"></use></svg>
          </button>
        </div>
      `;
    }).join('');

    const gridItems = grid.querySelectorAll<HTMLElement>('.video-upload-grid-item');
    gridItems.forEach((itemEl) => {
      itemEl.addEventListener('dragstart', (e) => {
        const url = itemEl.getAttribute('data-url') || '';
        const name = itemEl.getAttribute('data-name') || 'Clip';
        const thumb = itemEl.getAttribute('data-thumb') || '';
        const type = (itemEl.getAttribute('data-type') || 'video') as VideoMediaType;
        const dur = parseFloat(itemEl.getAttribute('data-duration') || '5') || 5;

        const clipData: Partial<VideoClip> = {
          assetUrl: url,
          duration: dur,
          mediaType: type,
          name,
          sourceDuration: dur,
          thumbnailUrl: thumb,
          trimEnd: dur,
          trimStart: 0,
        };

        if (e.dataTransfer) {
          e.dataTransfer.setData('application/json', JSON.stringify(clipData));
          e.dataTransfer.effectAllowed = 'copy';
        }
      }, { signal: this._abortController?.signal });

      const addBtn = itemEl.querySelector<HTMLElement>('[data-ref^="btn-add-upload-"]');
      addBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        const url = itemEl.getAttribute('data-url') || '';
        const name = itemEl.getAttribute('data-name') || 'Clip';
        const thumb = itemEl.getAttribute('data-thumb') || '';
        const type = (itemEl.getAttribute('data-type') || 'video') as VideoMediaType;
        const dur = parseFloat(itemEl.getAttribute('data-duration') || '5') || 5;

        this._onAddClip({
          assetUrl: url,
          duration: dur,
          mediaType: type,
          name,
          sourceDuration: dur,
          thumbnailUrl: thumb,
          trimEnd: dur,
          trimStart: 0,
        });
      }, { signal: this._abortController?.signal });
    });
  }

  public destroy(): void {
    if (this._abortController) {
      this._abortController.abort();
      this._abortController = null;
    }
  }
}
