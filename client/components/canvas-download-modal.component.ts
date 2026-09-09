import { API_ROUTES } from '../config/api-routes.js';
import { escapeHtml, getApi } from '../services/api.service.js';
import { getLocalCanvasByUuid } from '../services/canvas-storage.service.js';
import { renderIcons } from '../services/icon.service.js';
import { t, translateElement } from '../services/i18n.service.js';
import { showToast } from '../services/toast.service.js';
import { CanvasItem } from '../types/canvas.types.js';
import { setupDropdown } from '../utils/dom.util.js';

function setIconUse(el: HTMLElement | null, iconName: string): void {
  if (!el) return;
  const use = el.querySelector('use');
  if (use) {
    use.setAttribute('href', `/icons.svg#${iconName}`);
    use.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', `/icons.svg#${iconName}`);
  } else {
    el.textContent = iconName;
  }
}

let activeDownloadModal: { close: () => void } | null = null;

export function openCanvasDownloadModal(canvas: CanvasItem): void {
  if (activeDownloadModal) {
    activeDownloadModal.close();
  }

  let selectedType: 'png-current' | 'spritesheet' | 'project-json' = 'png-current';
  let selectedScale = 1;
  let selectedBg: 'transparent' | 'solid' = 'transparent';

  const baseW = canvas.width || 800;
  const baseH = canvas.height || 600;

  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.setAttribute('data-ref', 'modal-download-backdrop');

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
          <p class="modal-card__desc">${escapeHtml(canvas.name)} (${baseW} × ${baseH} px)</p>
        </div>
        <div class="modal-card__body" data-ref="modal-download-body">
          <div class="design-share-menu__content">
            <div class="design-share-section" data-ref="section-download-type">
              <span class="design-share-section__label">Tipo de archivo</span>
              <div class="settings-dropdown-wrapper" data-ref="dropdown-wrapper-download-type">
                <button type="button" class="dropdown-trigger" data-ref="btn-trigger-download-type" aria-label="Tipo de archivo">
                  <div class="dropdown-trigger__left">
                    <span class="material-symbols-rounded dropdown-trigger__icon" data-ref="download-type-selected-icon">image</span>
                    <span class="dropdown-trigger__text" data-ref="download-type-selected-text">PNG (Fotograma actual)</span>
                  </div>
                  <span class="material-symbols-rounded dropdown-trigger__chevron">expand_more</span>
                </button>
                <div class="dropdown-backdrop" data-ref="dropdown-backdrop-download-type">
                  <div class="menu-panel menu-panel--dropdown menu-panel--w-full menu-panel--h-auto" data-ref="dropdown-menu-download-type">
                    <div class="menu-panel__drag-zone" data-ref="download-type-drag-zone" aria-hidden="true">
                      <div class="menu-panel__drag-handle"></div>
                    </div>
                    <div class="menu-panel__list" data-ref="list-download-type">
                      <button type="button" class="menu-item is-active" data-ref="btn-download-type-png" data-value="png-current">
                        <span class="material-symbols-rounded menu-item__icon">image</span>
                        <span class="menu-item__text">PNG (Fotograma actual)</span>
                      </button>
                      <button type="button" class="menu-item" data-ref="btn-download-type-spritesheet" data-value="spritesheet">
                        <span class="material-symbols-rounded menu-item__icon">grid_view</span>
                        <span class="menu-item__text">PNG (Hoja de sprites)</span>
                      </button>
                      <button type="button" class="menu-item" data-ref="btn-download-type-project" data-value="project-json">
                        <span class="material-symbols-rounded menu-item__icon">data_object</span>
                        <span class="menu-item__text">Proyecto Spriteboard (.json)</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div class="design-share-section" data-ref="section-download-scale">
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

            <div class="design-share-section" data-ref="section-download-bg">
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
              <button type="button" class="btn btn--h40 btn--black btn--w-full" data-ref="btn-confirm-download">
                <span class="material-symbols-rounded">download</span>
                <span data-ref="btn-confirm-download-text">Descargar PNG (${baseW} × ${baseH} px)</span>
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
  const typeSelectedIcon = backdrop.querySelector<HTMLElement>('[data-ref="download-type-selected-icon"]');
  const typeSelectedText = backdrop.querySelector<HTMLElement>('[data-ref="download-type-selected-text"]');

  const dropdownWrapperScale = backdrop.querySelector<HTMLElement>('[data-ref="dropdown-wrapper-download-scale"]');
  const scaleSelectedText = backdrop.querySelector<HTMLElement>('[data-ref="download-scale-selected-text"]');

  const dropdownWrapperBg = backdrop.querySelector<HTMLElement>('[data-ref="dropdown-wrapper-download-bg"]');
  const bgSelectedIcon = backdrop.querySelector<HTMLElement>('[data-ref="download-bg-selected-icon"]');
  const bgSelectedText = backdrop.querySelector<HTMLElement>('[data-ref="download-bg-selected-text"]');

  let isClosing = false;
  const closeModal = () => {
    if (isClosing) return;
    isClosing = true;
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
    if (btnConfirmText) {
      if (selectedType === 'png-current') {
        const w = baseW * selectedScale;
        const h = baseH * selectedScale;
        btnConfirmText.textContent = `Descargar PNG (${w} × ${h} px)`;
      } else if (selectedType === 'spritesheet') {
        const w = baseW * selectedScale;
        const h = baseH * selectedScale;
        btnConfirmText.textContent = `Descargar Hoja de sprites (${w} × ${h} px)`;
      } else {
        btnConfirmText.textContent = 'Descargar Proyecto (.json)';
      }
    }

    const isJson = selectedType === 'project-json';
    if (sectionScale) sectionScale.classList.toggle('is-hidden', isJson);
    if (sectionBg) sectionBg.classList.toggle('is-hidden', isJson);
  };

  const typeCtrl = setupDropdown(dropdownWrapperType, {});
  const scaleCtrl = setupDropdown(dropdownWrapperScale, {});
  const bgCtrl = setupDropdown(dropdownWrapperBg, {});

  const typeButtons = backdrop.querySelectorAll<HTMLButtonElement>('[data-ref^="btn-download-type-"]');
  typeButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const val = btn.getAttribute('data-value') as typeof selectedType;
      if (!val) return;
      selectedType = val;
      typeButtons.forEach((b) => b.classList.toggle('is-active', b === btn));

      if (typeSelectedIcon) {
        setIconUse(typeSelectedIcon, val === 'png-current' ? 'image' : val === 'spritesheet' ? 'grid_view' : 'data_object');
      }
      if (typeSelectedText) {
        typeSelectedText.textContent =
          val === 'png-current' ? 'PNG (Fotograma actual)' : val === 'spritesheet' ? 'PNG (Hoja de sprites)' : 'Proyecto Spriteboard (.json)';
      }

      updateUI();
      typeCtrl.close();
    });
  });

  const scaleButtons = backdrop.querySelectorAll<HTMLButtonElement>('[data-ref^="btn-scale-"]');
  scaleButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const val = parseInt(btn.getAttribute('data-value') || '1', 10);
      selectedScale = val;
      scaleButtons.forEach((b) => b.classList.toggle('is-active', b === btn));

      if (scaleSelectedText) {
        const w = baseW * val;
        const h = baseH * val;
        scaleSelectedText.textContent = val === 1 ? `1x (Original - ${w} × ${h} px)` : `${val}x (${w} × ${h} px)`;
      }

      updateUI();
      scaleCtrl.close();
    });
  });

  const bgButtons = backdrop.querySelectorAll<HTMLButtonElement>('[data-ref^="btn-download-bg-"]');
  bgButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const val = btn.getAttribute('data-value') as typeof selectedBg;
      if (!val) return;
      selectedBg = val;
      bgButtons.forEach((b) => b.classList.toggle('is-active', b === btn));

      if (bgSelectedIcon) {
        setIconUse(bgSelectedIcon, val === 'transparent' ? 'opacity' : 'format_color_fill');
      }
      if (bgSelectedText) {
        bgSelectedText.textContent = val === 'transparent' ? 'Transparente' : 'Color del lienzo';
      }

      bgCtrl.close();
    });
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

      if (selectedType === 'project-json') {
        let projectJson = fullCanvas.data;
        if (!projectJson) {
          projectJson = JSON.stringify({
            version: 1,
            name: fullCanvas.name,
            width: baseW,
            height: baseH,
            unit: fullCanvas.unit || 'px',
            created_at: fullCanvas.created_at,
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

      if (selectedType === 'spritesheet' && frames && frames.length > 1) {
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
          }

          const blob = await new Promise<Blob | null>((resolve) => sheetCanvas.toBlob(resolve, 'image/png'));
          if (blob) {
            triggerBlobDownload(blob, `${cleanName}_spritesheet_${targetScale}x.png`);
            showToast(t('canvas.download_success'));
            closeModal();
            return;
          }
        }
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
