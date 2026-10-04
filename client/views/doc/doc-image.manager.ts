import { openUpgradeModal } from '../../components/upgrade-modal.component.js';
import { currentUser, escapeHtml } from '../../services/api.service.js';
import { removeImageBackground } from '../../services/image-ai.service.js';
import { showToast } from '../../services/toast.service.js';
import { withButtonLoading } from '../../utils/dom.util.js';
import { validateAndSanitizeFile } from '../../utils/validators.util.js';
import { DocImageRadius, DocImageShadow, DocImageWrapMode } from './doc.types.js';

export function insertDocImageElement(options: {
  altText?: string;
  container: HTMLElement;
  initialWidth?: string;
  onInitSingleImageWrapper: (wrapper: HTMLElement) => void;
  onRecordChange: () => void;
  onSelectImageWrapper: (wrapper: HTMLElement) => void;
  src: string;
}): void {
  const {
    altText = 'Imagen insertada',
    container,
    initialWidth = '50%',
    onInitSingleImageWrapper,
    onRecordChange,
    onSelectImageWrapper,
    src,
  } = options;

  const wrapper = document.createElement('div');
  wrapper.className = 'doc-image-wrapper doc-img-wrap--left doc-img-radius--8 doc-img-shadow--sm';
  wrapper.style.width = initialWidth;
  wrapper.innerHTML = `<img src="${src}" alt="${altText}" />`;

  const sel = window.getSelection();
  if (sel && sel.rangeCount > 0) {
    const range = sel.getRangeAt(0);
    range.deleteContents();
    range.insertNode(wrapper);
    const afterP = document.createElement('p');
    afterP.innerHTML = '<br>';
    wrapper.after(afterP);
  } else {
    const firstPage = container.querySelector('.doc-page__content');
    firstPage?.appendChild(wrapper);
  }

  onInitSingleImageWrapper(wrapper);
  onSelectImageWrapper(wrapper);
  onRecordChange();
  showToast('Elemento insertado con éxito', 'success');
}

export function insertDocVideo(options: {
  container: HTMLElement;
  onInitSingleImageWrapper: (wrapper: HTMLElement) => void;
  onRecordChange: () => void;
  onSelectImageWrapper: (wrapper: HTMLElement) => void;
  poster?: string;
  src: string;
  title?: string;
}): void {
  const {
    container,
    onInitSingleImageWrapper,
    onRecordChange,
    onSelectImageWrapper,
    poster = '',
    src,
    title = 'Video',
  } = options;

  const wrapper = document.createElement('div');
  wrapper.className = 'doc-image-wrapper doc-img-wrap--center doc-img-radius--8 doc-img-shadow--md';
  wrapper.style.width = '80%';
  wrapper.style.maxWidth = '640px';
  wrapper.style.margin = '16px auto';
  wrapper.innerHTML = `
    <div style="position: relative; width: 100%; border-radius: 8px; overflow: hidden; background: #000;">
      <video src="${escapeHtml(src)}" poster="${escapeHtml(poster)}" controls playsinline style="width: 100%; height: auto; display: block; border-radius: 8px;"></video>
    </div>
  `;

  const sel = window.getSelection();
  if (sel && sel.rangeCount > 0) {
    const range = sel.getRangeAt(0);
    range.deleteContents();
    range.insertNode(wrapper);
    const afterP = document.createElement('p');
    afterP.innerHTML = '<br>';
    wrapper.after(afterP);
  } else {
    const firstPage = container.querySelector('.doc-page__content');
    firstPage?.appendChild(wrapper);
  }

  onInitSingleImageWrapper(wrapper);
  onSelectImageWrapper(wrapper);
  onRecordChange();
  showToast(`Video «${title}» insertado en el documento`, 'success');
}

export function insertDocYouTubeEmbed(options: {
  container: HTMLElement;
  onInitSingleImageWrapper: (wrapper: HTMLElement) => void;
  onRecordChange: () => void;
  onSelectImageWrapper: (wrapper: HTMLElement) => void;
  title?: string;
  videoId: string;
}): void {
  const {
    container,
    onInitSingleImageWrapper,
    onRecordChange,
    onSelectImageWrapper,
    title = 'Video de YouTube',
    videoId,
  } = options;

  const embedUrl = `https://www.youtube-nocookie.com/embed/${videoId}?rel=0&modestbranding=1`;
  const wrapper = document.createElement('div');
  wrapper.className = 'doc-image-wrapper doc-img-wrap--center doc-img-radius--8 doc-img-shadow--md';
  wrapper.style.width = '80%';
  wrapper.style.maxWidth = '640px';
  wrapper.style.margin = '16px auto';
  wrapper.innerHTML = `
    <div style="position: relative; width: 100%; padding-bottom: 56.25%; height: 0; border-radius: 8px; overflow: hidden; background: #000;">
      <iframe src="${embedUrl}" title="${escapeHtml(title)}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: 0;"></iframe>
    </div>
  `;

  const sel = window.getSelection();
  if (sel && sel.rangeCount > 0) {
    const range = sel.getRangeAt(0);
    range.deleteContents();
    range.insertNode(wrapper);
    const afterP = document.createElement('p');
    afterP.innerHTML = '<br>';
    wrapper.after(afterP);
  } else {
    const firstPage = container.querySelector('.doc-page__content');
    firstPage?.appendChild(wrapper);
  }

  onInitSingleImageWrapper(wrapper);
  onSelectImageWrapper(wrapper);
  onRecordChange();
  showToast('Video de YouTube insertado en el documento', 'success');
}

export function attachImageResizeHandles(
  wrapper: HTMLElement,
  onStartResize: (wrapper: HTMLElement, pos: string, e: MouseEvent) => void
): void {
  wrapper.querySelectorAll('.doc-image-handle').forEach((h) => h.remove());

  const positions = ['nw', 'ne', 'sw', 'se', 'n', 's', 'e', 'w'];
  positions.forEach((pos) => {
    const handle = document.createElement('div');
    handle.className = `doc-image-handle doc-image-handle--${pos}`;
    handle.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      e.preventDefault();
      onStartResize(wrapper, pos, e);
    });
    wrapper.appendChild(handle);
  });
}

export function startImageResizeDrag(
  wrapper: HTMLElement,
  handlePos: string,
  startEvent: MouseEvent,
  onRecordChange: () => void
): void {
  const startX = startEvent.clientX;
  const startY = startEvent.clientY;
  const startRect = wrapper.getBoundingClientRect();
  const parentWidth = (wrapper.parentElement?.getBoundingClientRect().width) || 600;

  const onMouseMove = (moveEvent: MouseEvent) => {
    const dx = moveEvent.clientX - startX;
    const dy = moveEvent.clientY - startY;

    let newWidth = startRect.width;
    if (handlePos.includes('e')) newWidth = startRect.width + dx;
    if (handlePos.includes('w')) newWidth = startRect.width - dx;
    if (handlePos.includes('s') && !handlePos.includes('e') && !handlePos.includes('w')) {
      newWidth = startRect.width + dy * (startRect.width / startRect.height);
    }
    if (handlePos.includes('n') && !handlePos.includes('e') && !handlePos.includes('w')) {
      newWidth = startRect.width - dy * (startRect.width / startRect.height);
    }

    newWidth = Math.max(60, Math.min(parentWidth, newWidth));
    const pct = Math.round((newWidth / parentWidth) * 100);
    wrapper.style.width = `${pct}%`;
  };

  const onMouseUp = () => {
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', onMouseUp);
    onRecordChange();
  };

  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', onMouseUp);
}

export function startImageFreeDrag(
  wrapper: HTMLElement,
  startEvent: MouseEvent,
  onRecordChange: () => void
): void {
  startEvent.preventDefault();
  const page = wrapper.closest<HTMLElement>('.doc-page');
  if (!page) return;

  const pageRect = page.getBoundingClientRect();
  const startX = startEvent.clientX;
  const startY = startEvent.clientY;
  const startLeft = parseFloat(wrapper.style.left) || (wrapper.getBoundingClientRect().left - pageRect.left);
  const startTop = parseFloat(wrapper.style.top) || (wrapper.getBoundingClientRect().top - pageRect.top);

  const onMouseMove = (moveEvent: MouseEvent) => {
    const dx = moveEvent.clientX - startX;
    const dy = moveEvent.clientY - startY;
    wrapper.style.left = `${Math.max(0, startLeft + dx)}px`;
    wrapper.style.top = `${Math.max(0, startTop + dy)}px`;
  };

  const onMouseUp = () => {
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', onMouseUp);
    onRecordChange();
  };

  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', onMouseUp);
}

export function setupImageTrayControls(options: {
  container: HTMLElement;
  getSelectedImageWrapper: () => HTMLElement | null;
  onRecordChange: () => void;
  signal: AbortSignal;
}): void {
  const { container, getSelectedImageWrapper, onRecordChange, signal } = options;

  const bindWrap = (ref: string, mode: DocImageWrapMode) => {
    const btn = container.querySelector<HTMLElement>(`[data-ref="${ref}"]`);
    btn?.addEventListener('click', () => {
      const selected = getSelectedImageWrapper();
      if (!selected) return;
      selected.classList.remove('doc-img-wrap--inline', 'doc-img-wrap--left', 'doc-img-wrap--right', 'doc-img-wrap--center', 'doc-img-wrap--free');
      selected.classList.add(`doc-img-wrap--${mode}`);
      onRecordChange();
    }, { signal });
  };

  bindWrap('img-btn-wrap-inline', 'inline');
  bindWrap('img-btn-wrap-left', 'left');
  bindWrap('img-btn-wrap-right', 'right');
  bindWrap('img-btn-wrap-center', 'center');
  bindWrap('img-btn-wrap-free', 'free');

  const bindImgResize = (ref: string, widthPercent: string) => {
    const btn = container.querySelector<HTMLElement>(`[data-ref="${ref}"]`);
    if (btn) {
      btn.addEventListener('click', () => {
        const selected = getSelectedImageWrapper();
        if (selected) {
          selected.style.width = widthPercent;
          container.querySelectorAll<HTMLElement>('[data-ref^="img-btn-size-"]').forEach((b) => b.classList.remove('is-active'));
          btn.classList.add('is-active');
          onRecordChange();
        }
      }, { signal });
    }
  };

  bindImgResize('img-btn-size-25', '25%');
  bindImgResize('img-btn-size-50', '50%');
  bindImgResize('img-btn-size-75', '75%');
  bindImgResize('img-btn-size-100', '100%');

  const btnImgRadius = container.querySelector<HTMLElement>('[data-ref="img-btn-toggle-radius"]');
  btnImgRadius?.addEventListener('click', () => {
    const selected = getSelectedImageWrapper();
    if (!selected) return;
    const classes: DocImageRadius[] = ['0', '8', '18', 'pill'];
    const cur = classes.find((c) => selected.classList.contains(`doc-img-radius--${c}`)) || '8';
    const next = classes[(classes.indexOf(cur) + 1) % classes.length];
    classes.forEach((c) => selected.classList.remove(`doc-img-radius--${c}`));
    selected.classList.add(`doc-img-radius--${next}`);
    onRecordChange();
  }, { signal });

  const btnImgShadow = container.querySelector<HTMLElement>('[data-ref="img-btn-toggle-shadow"]');
  btnImgShadow?.addEventListener('click', () => {
    const selected = getSelectedImageWrapper();
    if (!selected) return;
    const classes: DocImageShadow[] = ['none', 'sm', 'md', 'lg'];
    const cur = classes.find((c) => selected.classList.contains(`doc-img-shadow--${c}`)) || 'sm';
    const next = classes[(classes.indexOf(cur) + 1) % classes.length];
    classes.forEach((c) => selected.classList.remove(`doc-img-shadow--${c}`));
    selected.classList.add(`doc-img-shadow--${next}`);
    onRecordChange();
  }, { signal });

  const btnImgCaption = container.querySelector<HTMLElement>('[data-ref="img-btn-caption"]');
  btnImgCaption?.addEventListener('click', () => {
    const selected = getSelectedImageWrapper();
    if (!selected) return;
    const existing = selected.querySelector('.doc-image-caption');
    if (existing) {
      existing.remove();
    } else {
      const caption = document.createElement('div');
      caption.className = 'doc-image-caption';
      caption.contentEditable = 'true';
      caption.textContent = 'Pie de foto descriptivo';
      selected.appendChild(caption);
    }
    onRecordChange();
  }, { signal });

  const btnImgRemoveBg = container.querySelector<HTMLButtonElement>('[data-ref="img-btn-remove-bg"]');
  if (btnImgRemoveBg) {
    btnImgRemoveBg.addEventListener('click', async () => {
      const userPermissions: string[] = (currentUser as any)?.permissions || [];
      const hasAiBgRemoval = userPermissions.includes('*') ||
        userPermissions.includes('subscription:feature:ai_bg_removal') ||
        userPermissions.includes('subscription:feature:all');
      if (!hasAiBgRemoval) {
        openUpgradeModal('pro');
        showToast('La eliminación de fondo con IA está disponible para planes Pro y Negocios', 'info');
        return;
      }

      const selected = getSelectedImageWrapper();
      if (!selected) return;
      const img = selected.querySelector<HTMLImageElement>('img');
      if (!img || !img.src) {
        showToast('No se encontró una imagen válida para procesar', 'warning');
        return;
      }

      selected.classList.add('is-processing-bg-removal');

      await withButtonLoading(btnImgRemoveBg, async () => {
        showToast('Eliminando fondo con IA...', 'info');
        try {
          const res = await removeImageBackground(img.src);
          if (res.success && res.url) {
            img.src = res.url;
            onRecordChange();
            showToast('Fondo eliminado exitosamente', 'success');
          } else {
            if (res.upgradeRequired) {
              openUpgradeModal('pro');
            }
            showToast(res.error || 'No se pudo eliminar el fondo de la imagen', 'error');
          }
        } catch {
          showToast('Error al conectar con el servicio de IA.', 'error');
        } finally {
          selected.classList.remove('is-processing-bg-removal');
        }
      });
    }, { signal });
  }
}

export interface DocImageManagerOptions {
  container: HTMLElement;
  onRecordChange: () => void;
  signal: AbortSignal;
}

export interface DocImageManagerController {
  bindDragDropAndPaste: () => void;
  deselectAllImages: () => void;
  getSelectedImageWrapper: () => HTMLElement | null;
  initExistingImages: () => void;
  initSingleImageWrapper: (wrapper: HTMLElement) => void;
  insertImageElement: (src: string, initialWidth?: string, altText?: string) => void;
  selectImageWrapper: (wrapper: HTMLElement) => void;
}

export function setupDocImageManager(options: DocImageManagerOptions): DocImageManagerController {
  const { container, onRecordChange, signal } = options;
  let selectedImageWrapper: HTMLElement | null = null;

  const deselectAllImages = (): void => {
    container.querySelectorAll<HTMLElement>('.doc-image-wrapper').forEach((w) => {
      w.classList.remove('is-selected');
      w.querySelectorAll('.doc-image-handle').forEach((h) => h.remove());
    });
    selectedImageWrapper = null;
  };

  const selectImageWrapper = (wrapper: HTMLElement): void => {
    deselectAllImages();
    selectedImageWrapper = wrapper;
    wrapper.classList.add('is-selected');
    attachImageResizeHandles(wrapper, (w, pos, e) => {
      startImageResizeDrag(w, pos, e, onRecordChange);
    });

    const imageTray = container.querySelector<HTMLElement>('[data-ref="doc-image-tray"]');
    imageTray?.classList.remove('is-hidden');
  };

  const initSingleImageWrapper = (wrapper: HTMLElement): void => {
    wrapper.addEventListener('click', (e) => {
      e.stopPropagation();
      selectImageWrapper(wrapper);
    });

    wrapper.addEventListener('mousedown', (e) => {
      if (wrapper.classList.contains('doc-img-wrap--free') && !(e.target as HTMLElement).classList.contains('doc-image-handle')) {
        startImageFreeDrag(wrapper, e, onRecordChange);
      }
    });
  };

  const initExistingImages = (): void => {
    container.querySelectorAll<HTMLElement>('.doc-image-wrapper').forEach((wrapper) => {
      initSingleImageWrapper(wrapper);
    });
  };

  const insertImageElement = (src: string, initialWidth = '50%', altText = 'Imagen insertada'): void => {
    insertDocImageElement({
      altText,
      container,
      initialWidth,
      onInitSingleImageWrapper: initSingleImageWrapper,
      onRecordChange,
      onSelectImageWrapper: selectImageWrapper,
      src,
    });
  };

  const bindDragDropAndPaste = (): void => {
    const viewport = container.querySelector<HTMLElement>('[data-ref="doc-viewport"]');
    if (!viewport) return;

    viewport.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.stopPropagation();
    }, { signal });

    viewport.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const files = e.dataTransfer?.files;
      if (files && files.length > 0) {
        const file = files[0];
        if (file.type.startsWith('image/')) {
          const validation = validateAndSanitizeFile(file, { maxMb: 10 });
          if (!validation.valid || !validation.file) {
            showToast(validation.error || 'Archivo de imagen no válido.', 'error');
            return;
          }
          const reader = new FileReader();
          reader.onload = (ev) => {
            const dataUrl = ev.target?.result as string;
            if (dataUrl) insertImageElement(dataUrl);
          };
          reader.readAsDataURL(validation.file);
        }
      }
    }, { signal });
  };

  return {
    bindDragDropAndPaste,
    deselectAllImages,
    getSelectedImageWrapper: () => selectedImageWrapper,
    initExistingImages,
    initSingleImageWrapper,
    insertImageElement,
    selectImageWrapper,
  };
}
