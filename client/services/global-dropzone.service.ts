import { getActiveCanvasType, handleApplyCanvasUpload, isCanvasRoute } from '../components/layout.component.js';
import { UserUploadItem } from '../types/upload.types.js';
import { isCompatibleMediaFile, validateAndSanitizeFiles } from '../utils/validators.util.js';
import { currentUser, uploadFilesApi } from './api.service.js';
import { t } from './i18n.service.js';
import { showToast } from './toast.service.js';

interface DroppedEntryFile {
  file: File;
  folderName: string | null;
}

let dragDepth = 0;
let isGlobalUploading = false;
let dropOverlayElement: HTMLElement | null = null;
let removeTimer: ReturnType<typeof setTimeout> | null = null;

function createDropOverlay(): HTMLElement {
  const overlay = document.createElement('div');
  overlay.className = 'global-dropzone-overlay';
  overlay.setAttribute('data-ref', 'global-dropzone-overlay');
  overlay.innerHTML = `
    <div class="global-dropzone-overlay__box" data-ref="global-dropzone-box">
      <div class="global-dropzone-overlay__icon-wrapper" data-ref="global-dropzone-icon">
        <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#cloud_upload"></use></svg>
      </div>
      <div class="global-dropzone-overlay__title" data-ref="global-dropzone-title">${t('uploads.drop_to_add') || 'Suelta para agregar'}</div>
      <div class="global-dropzone-overlay__subtitle" data-ref="global-dropzone-subtitle">${t('uploads.drop_to_add_subtitle') || 'Imágenes, videos y audios compatibles'}</div>
    </div>
  `;
  return overlay;
}

function showDropOverlay(): void {
  if (removeTimer) {
    clearTimeout(removeTimer);
    removeTimer = null;
  }

  const container =
    document.querySelector<HTMLElement>(
      '.layout-content .component-wrapper, .layout-content .view-wrapper, .component-wrapper, .view-wrapper'
    ) || document.querySelector<HTMLElement>('.layout-content') || document.body;

  if (!dropOverlayElement || dropOverlayElement.parentElement !== container) {
    dropOverlayElement?.remove();
    dropOverlayElement = createDropOverlay();
    container.appendChild(dropOverlayElement);
  }

  const titleEl = dropOverlayElement.querySelector<HTMLElement>('[data-ref="global-dropzone-title"]');
  if (titleEl) {
    titleEl.textContent = t('uploads.drop_to_add') || 'Suelta para agregar';
  }
  const subtitleEl = dropOverlayElement.querySelector<HTMLElement>('[data-ref="global-dropzone-subtitle"]');
  if (subtitleEl) {
    subtitleEl.textContent = t('uploads.drop_to_add_subtitle') || 'Imágenes, videos y audios compatibles';
  }

  requestAnimationFrame(() => {
    dropOverlayElement?.classList.add('is-active');
  });
}

function hideDropOverlay(): void {
  dragDepth = 0;
  if (!dropOverlayElement) return;

  dropOverlayElement.classList.remove('is-active');
  const target = dropOverlayElement;
  dropOverlayElement = null;

  removeTimer = setTimeout(() => {
    target.remove();
    removeTimer = null;
  }, 220);
}

function readFileEntry(fileEntry: FileSystemFileEntry): Promise<File | null> {
  return new Promise((resolve) => {
    fileEntry.file(
      (file) => resolve(file),
      () => resolve(null)
    );
  });
}

async function readDirectoryEntries(dirEntry: FileSystemDirectoryEntry, rootFolderName: string): Promise<DroppedEntryFile[]> {
  const reader = dirEntry.createReader();
  const collected: DroppedEntryFile[] = [];

  const readBatch = (): Promise<FileSystemEntry[]> => {
    return new Promise((resolve) => {
      reader.readEntries(
        (entries) => resolve(entries),
        () => resolve([])
      );
    });
  };

  let batch = await readBatch();
  while (batch.length > 0) {
    for (const entry of batch) {
      if (entry.isFile) {
        const file = await readFileEntry(entry as FileSystemFileEntry);
        if (file && isCompatibleMediaFile(file)) {
          collected.push({ file, folderName: rootFolderName });
        }
      } else if (entry.isDirectory) {
        const subFiles = await readDirectoryEntries(entry as FileSystemDirectoryEntry, rootFolderName);
        collected.push(...subFiles);
      }
    }
    batch = await readBatch();
  }

  return collected;
}

async function extractFilesFromDataTransfer(dataTransfer: DataTransfer): Promise<DroppedEntryFile[]> {
  const items = dataTransfer.items;
  const collected: DroppedEntryFile[] = [];

  if (items && items.length > 0) {
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const entry = (item as any).webkitGetAsEntry ? ((item as any).webkitGetAsEntry() as FileSystemEntry | null) : null;
      if (entry) {
        if (entry.isDirectory) {
          const dirFiles = await readDirectoryEntries(entry as FileSystemDirectoryEntry, entry.name);
          collected.push(...dirFiles);
        } else if (entry.isFile) {
          const file = await readFileEntry(entry as FileSystemFileEntry);
          if (file && isCompatibleMediaFile(file)) {
            collected.push({ file, folderName: null });
          }
        }
      } else {
        const file = item.getAsFile();
        if (file && isCompatibleMediaFile(file)) {
          collected.push({ file, folderName: null });
        }
      }
    }
  }

  if (collected.length === 0 && dataTransfer.files && dataTransfer.files.length > 0) {
    for (let i = 0; i < dataTransfer.files.length; i++) {
      const file = dataTransfer.files[i];
      if (isCompatibleMediaFile(file)) {
        collected.push({ file, folderName: null });
      }
    }
  }

  return collected;
}

export async function processDroppedEntries(entries: DroppedEntryFile[]): Promise<void> {
  if (!currentUser) {
    showToast(t('uploads.login_required') || 'Debes iniciar sesión para subir fotos y videos.', 'warning');
    return;
  }

  if (entries.length === 0) {
    showToast('No se encontraron archivos multimedia compatibles (imágenes, videos o audios).', 'warning');
    return;
  }

  if (isGlobalUploading) return;
  isGlobalUploading = true;

  const railUploadBtns = document.querySelectorAll<HTMLElement>('[data-ref="btn-rail-canvas-uploads"], [data-ref="btn-rail-create"]');
  railUploadBtns.forEach((b) => b.classList.add('is-uploading'));

  const btnUploadTrigger = document.querySelector<HTMLButtonElement>('[data-ref="btn-upload-file-trigger"]');
  if (btnUploadTrigger) {
    btnUploadTrigger.disabled = true;
  }

  const grid = document.querySelector<HTMLElement>('[data-ref="canvas-uploads-grid"]');
  let placeholder: HTMLElement | null = null;
  if (grid) {
    placeholder = document.createElement('div');
    placeholder.className = 'element-grid-item';
    placeholder.setAttribute('data-ref', 'upload-item-placeholder');
    placeholder.innerHTML = `
      <div class="skeleton" style="width: 100%; height: 100%; border-radius: 6px; display: flex; align-items: center; justify-content: center;">
        <svg class="component-icon" style="width: 18px; height: 18px; animation: railBtnUploadSpin 0.75s linear infinite; color: var(--accent-pink);" aria-hidden="true"><use href="/icons.svg#sync"></use></svg>
      </div>
    `;
    grid.prepend(placeholder);
  }

  showToast(
    entries.length === 1
      ? (t('uploads.uploading_files') || 'Subiendo archivo...')
      : `Subiendo ${entries.length} archivos...`,
    'info'
  );

  const groups = new Map<string | null, File[]>();
  for (const item of entries) {
    const key = item.folderName || null;
    const list = groups.get(key) || [];
    list.push(item.file);
    groups.set(key, list);
  }

  const allUploadedItems: UserUploadItem[] = [];
  let hasCreatedFolder = false;

  try {
    for (const [folderName, groupFiles] of groups.entries()) {
      const validation = validateAndSanitizeFiles(groupFiles, { maxMb: 1024 });
      if (!validation.valid || !validation.files || validation.files.length === 0) {
        continue;
      }

      const res = await uploadFilesApi(validation.files, { folderName: folderName || undefined });
      if (res.success && res.uploads && res.uploads.length > 0) {
        allUploadedItems.push(...res.uploads);
        if (folderName) {
          hasCreatedFolder = true;
        }
      } else if (!res.success && res.message) {
        showToast(res.message, 'danger');
      }
    }

    if (allUploadedItems.length > 0) {
      const msg = allUploadedItems.length === 1
        ? (t('uploads.upload_success_single') || 'Archivo subido correctamente.')
        : (t('uploads.upload_success') || 'Archivos subidos correctamente.');
      showToast(msg, 'success');

      window.dispatchEvent(new CustomEvent<UserUploadItem[]>('spriteboard:uploads-updated', { detail: allUploadedItems }));

      if (hasCreatedFolder) {
        window.dispatchEvent(new CustomEvent('spriteboard:folders-updated'));
      }

      const currentPath = window.location.pathname;
      if (isCanvasRoute(currentPath)) {
        const canvasType = getActiveCanvasType();
        for (const item of allUploadedItems) {
          handleApplyCanvasUpload(item, canvasType);
        }
      }
    } else {
      showToast(t('uploads.upload_error') || 'Error al subir los archivos.', 'danger');
    }
  } catch {
    showToast(t('uploads.upload_error') || 'Error al subir los archivos.', 'danger');
  } finally {
    isGlobalUploading = false;
    railUploadBtns.forEach((b) => b.classList.remove('is-uploading'));
    if (btnUploadTrigger) {
      btnUploadTrigger.disabled = false;
    }
    placeholder?.remove();
  }
}

export async function processDroppedFiles(files: FileList | File[], folderName?: string): Promise<void> {
  const fileArray = Array.from(files);
  const entries: DroppedEntryFile[] = fileArray
    .filter((f) => isCompatibleMediaFile(f))
    .map((f) => ({ file: f, folderName: folderName || null }));
  await processDroppedEntries(entries);
}

export function initGlobalDropzone(): void {
  window.addEventListener('dragenter', (e: DragEvent) => {
    if (!e.dataTransfer?.types || !Array.from(e.dataTransfer.types).includes('Files')) return;
    e.preventDefault();
    dragDepth++;
    if (dragDepth === 1) {
      showDropOverlay();
    }
  });

  window.addEventListener('dragover', (e: DragEvent) => {
    if (!e.dataTransfer?.types || !Array.from(e.dataTransfer.types).includes('Files')) return;
    e.preventDefault();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'copy';
    }
  });

  window.addEventListener('dragleave', (e: DragEvent) => {
    if (!e.dataTransfer?.types || !Array.from(e.dataTransfer.types).includes('Files')) return;
    e.preventDefault();
    dragDepth--;
    if (dragDepth <= 0) {
      hideDropOverlay();
    }
  });

  window.addEventListener('dragend', () => {
    hideDropOverlay();
  });

  window.addEventListener('drop', (e: DragEvent) => {
    if (!e.dataTransfer?.types || !Array.from(e.dataTransfer.types).includes('Files')) return;
    e.preventDefault();
    hideDropOverlay();

    if (e.dataTransfer) {
      void (async () => {
        const entries = await extractFilesFromDataTransfer(e.dataTransfer!);
        await processDroppedEntries(entries);
      })();
    }
  });

  document.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      hideDropOverlay();
    }
  });
}
