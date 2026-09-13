import { renderIcons } from '../services/icon.service.js';
import { showToast } from '../services/toast.service.js';
import { openModal } from './modal.component.js';

export interface InsertPixelGridConfig {
  backgroundColor: string;
  gridHeight: number;
  gridWidth: number;
  pixelSize: number;
}

export interface InsertPixelGridModalOptions {
  onInsert: (config: InsertPixelGridConfig) => void;
}

export function openInsertPixelGridModal(options: InsertPixelGridModalOptions): void {
  let width = 32;
  let height = 32;
  let pixelSize = 16;
  let backgroundColor = 'transparent';
  let isLinked = true;

  const bodyHtml = `
    <div class="settings-container" data-ref="pixel-grid-settings">
      <div class="settings-group" data-ref="group-grid-presets">
        <div class="settings-item" data-ref="item-grid-presets">
          <div class="settings-item__content" data-ref="content-grid-presets">
            <div class="settings-item__text" data-ref="text-grid-presets">
              <h2 class="settings-item__title" data-ref="title-grid-presets">Tamaños recomendados</h2>
              <p class="settings-item__desc" data-ref="desc-grid-presets">Elige un preset rápido o escribe las medidas exactas abajo.</p>
            </div>
          </div>
          <div class="settings-item__actions" data-ref="actions-grid-presets">
            <div class="template-variants-pills" data-ref="grid-preset-pills">
              <button type="button" class="template-variant-pill" data-ref="btn-preset-16" data-size="16">16×16</button>
              <button type="button" class="template-variant-pill" data-ref="btn-preset-24" data-size="24">24×24</button>
              <button type="button" class="template-variant-pill is-active" data-ref="btn-preset-32" data-size="32">32×32</button>
              <button type="button" class="template-variant-pill" data-ref="btn-preset-48" data-size="48">48×48</button>
              <button type="button" class="template-variant-pill" data-ref="btn-preset-64" data-size="64">64×64</button>
              <button type="button" class="template-variant-pill" data-ref="btn-preset-128" data-size="128">128×128</button>
              <button type="button" class="template-variant-pill" data-ref="btn-preset-256" data-size="256">256×256</button>
            </div>
          </div>
        </div>
      </div>

      <div class="settings-group" data-ref="group-grid-width">
        <div class="settings-item" data-ref="item-grid-width">
          <div class="settings-item__content" data-ref="content-grid-width">
            <div class="settings-item__text" data-ref="text-grid-width">
              <h2 class="settings-item__title" data-ref="title-grid-width">Ancho de cuadrícula (px)</h2>
              <p class="settings-item__desc" data-ref="desc-grid-width">Columnas de píxeles (mínimo 1, máximo 4096).</p>
            </div>
          </div>
          <div class="settings-item__actions" data-ref="actions-grid-width">
            <div class="component-inline-control component-inline-control--fixed" data-ref="inline-ctrl-width">
              <div class="component-inline-control__group" data-ref="group-width-dec">
                <button type="button" class="component-inline-control__btn" data-ref="btn-width-dec-16" data-tooltip="-16 px" aria-label="Disminuir 16 píxeles">
                  <span class="material-symbols-rounded">keyboard_double_arrow_left</span>
                </button>
                <button type="button" class="component-inline-control__btn" data-ref="btn-width-dec-1" data-tooltip="-1 px" aria-label="Disminuir 1 píxel">
                  <span class="material-symbols-rounded">chevron_left</span>
                </button>
              </div>
              <input class="component-inline-control__input" data-ref="input-grid-width" type="number" min="1" max="4096" value="32" autocomplete="off" />
              <div class="component-inline-control__group" data-ref="group-width-inc">
                <button type="button" class="component-inline-control__btn" data-ref="btn-width-inc-1" data-tooltip="+1 px" aria-label="Aumentar 1 píxel">
                  <span class="material-symbols-rounded">chevron_right</span>
                </button>
                <button type="button" class="component-inline-control__btn" data-ref="btn-width-inc-16" data-tooltip="+16 px" aria-label="Aumentar 16 píxeles">
                  <span class="material-symbols-rounded">keyboard_double_arrow_right</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="settings-group" data-ref="group-grid-height">
        <div class="settings-item" data-ref="item-grid-height">
          <div class="settings-item__content" data-ref="content-grid-height">
            <div class="settings-item__text" data-ref="text-grid-height">
              <h2 class="settings-item__title" data-ref="title-grid-height">Alto de cuadrícula (px)</h2>
              <p class="settings-item__desc" data-ref="desc-grid-height">Filas de píxeles (mínimo 1, máximo 4096).</p>
            </div>
          </div>
          <div class="settings-item__actions" data-ref="actions-grid-height">
            <button type="button" class="component-button component-button--h34 component-button--icon-only is-active" data-ref="btn-toggle-aspect-link" data-tooltip="Vincular proporciones 1:1" aria-label="Vincular proporciones 1:1" style="margin-right: 8px;">
              <span class="material-symbols-rounded" data-ref="icon-aspect-link">link</span>
            </button>
            <div class="component-inline-control component-inline-control--fixed" data-ref="inline-ctrl-height">
              <div class="component-inline-control__group" data-ref="group-height-dec">
                <button type="button" class="component-inline-control__btn" data-ref="btn-height-dec-16" data-tooltip="-16 px" aria-label="Disminuir 16 píxeles">
                  <span class="material-symbols-rounded">keyboard_double_arrow_left</span>
                </button>
                <button type="button" class="component-inline-control__btn" data-ref="btn-height-dec-1" data-tooltip="-1 px" aria-label="Disminuir 1 píxel">
                  <span class="material-symbols-rounded">chevron_left</span>
                </button>
              </div>
              <input class="component-inline-control__input" data-ref="input-grid-height" type="number" min="1" max="4096" value="32" autocomplete="off" />
              <div class="component-inline-control__group" data-ref="group-height-inc">
                <button type="button" class="component-inline-control__btn" data-ref="btn-height-inc-1" data-tooltip="+1 px" aria-label="Aumentar 1 píxel">
                  <span class="material-symbols-rounded">chevron_right</span>
                </button>
                <button type="button" class="component-inline-control__btn" data-ref="btn-height-inc-16" data-tooltip="+16 px" aria-label="Aumentar 16 píxeles">
                  <span class="material-symbols-rounded">keyboard_double_arrow_right</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="settings-group" data-ref="group-cell-scale">
        <div class="settings-item" data-ref="item-cell-scale">
          <div class="settings-item__content" data-ref="content-cell-scale">
            <div class="settings-item__text" data-ref="text-cell-scale">
              <h2 class="settings-item__title" data-ref="title-cell-scale">Tamaño de celda en pizarrón</h2>
              <p class="settings-item__desc" data-ref="desc-cell-scale">Define el tamaño visual de cada píxel en el lienzo inicial.</p>
            </div>
          </div>
          <div class="settings-item__actions" data-ref="actions-cell-scale">
            <div class="template-variants-pills" data-ref="cell-scale-pills">
              <button type="button" class="template-variant-pill" data-ref="btn-scale-8" data-scale="8">8 px</button>
              <button type="button" class="template-variant-pill" data-ref="btn-scale-12" data-scale="12">12 px</button>
              <button type="button" class="template-variant-pill is-active" data-ref="btn-scale-16" data-scale="16">16 px</button>
              <button type="button" class="template-variant-pill" data-ref="btn-scale-24" data-scale="24">24 px</button>
              <button type="button" class="template-variant-pill" data-ref="btn-scale-32" data-scale="32">32 px</button>
            </div>
          </div>
        </div>
      </div>

      <div class="settings-group" data-ref="group-grid-bg">
        <div class="settings-item" data-ref="item-grid-bg">
          <div class="settings-item__content" data-ref="content-grid-bg">
            <div class="settings-item__text" data-ref="text-grid-bg">
              <h2 class="settings-item__title" data-ref="title-grid-bg">Fondo inicial</h2>
              <p class="settings-item__desc" data-ref="desc-grid-bg">Transparente (patrón de ajedrez) o color de fondo base.</p>
            </div>
          </div>
          <div class="settings-item__actions" data-ref="actions-grid-bg">
            <div class="template-variants-pills" data-ref="grid-bg-pills">
              <button type="button" class="template-variant-pill is-active" data-ref="btn-bg-trans" data-bg="transparent">
                <span class="material-symbols-rounded" style="font-size: 16px; margin-right: 4px;">grid_view</span>
                <span>Transparente</span>
              </button>
              <button type="button" class="template-variant-pill" data-ref="btn-bg-white" data-bg="#ffffff">
                <span class="material-symbols-rounded" style="font-size: 16px; margin-right: 4px;">check_box_outline_blank</span>
                <span>Blanco</span>
              </button>
              <button type="button" class="template-variant-pill" data-ref="btn-bg-dark" data-bg="#0f172a">
                <span class="material-symbols-rounded" style="font-size: 16px; margin-right: 4px;">dark_mode</span>
                <span>Oscuro</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  const modal = openModal({
    bodyHtml,
    cancelText: 'Cancelar',
    confirmClass: 'component-button--black',
    confirmText: 'Insertar cuadrícula',
    description: 'Inserta una cuadrícula editable de píxeles con un tamaño de hasta 4096×4096 px.',
    onConfirm: () => {
      const errorBanner = modal.backdrop.querySelector<HTMLElement>('[data-ref="modal-error"]');
      const w = parseInt(inputWidth?.value || '0', 10);
      const h = parseInt(inputHeight?.value || '0', 10);

      if (isNaN(w) || w < 1 || w > 4096) {
        if (errorBanner) {
          errorBanner.textContent = 'El ancho debe ser un número entero entre 1 y 4096 píxeles.';
          errorBanner.style.display = 'block';
        }
        return;
      }

      if (isNaN(h) || h < 1 || h > 4096) {
        if (errorBanner) {
          errorBanner.textContent = 'El alto debe ser un número entero entre 1 y 4096 píxeles.';
          errorBanner.style.display = 'block';
        }
        return;
      }

      options.onInsert({
        backgroundColor,
        gridHeight: h,
        gridWidth: w,
        pixelSize,
      });

      modal.close();
      showToast(`Cuadrícula de ${w}×${h} px insertada`);
    },
    size: 'md',
    title: 'Insertar cuadrícula de Pixel Art',
  });

  const inputWidth = modal.backdrop.querySelector<HTMLInputElement>('[data-ref="input-grid-width"]');
  const inputHeight = modal.backdrop.querySelector<HTMLInputElement>('[data-ref="input-grid-height"]');
  const btnToggleAspect = modal.backdrop.querySelector<HTMLButtonElement>('[data-ref="btn-toggle-aspect-link"]');
  const iconAspect = modal.backdrop.querySelector<HTMLElement>('[data-ref="icon-aspect-link"]');
  const errorBanner = modal.backdrop.querySelector<HTMLElement>('[data-ref="modal-error"]');

  const clampValue = (val: number): number => Math.max(1, Math.min(4096, val));

  const setDimensions = (w: number, h: number): void => {
    width = clampValue(w);
    height = clampValue(h);
    if (inputWidth) inputWidth.value = String(width);
    if (inputHeight) inputHeight.value = String(height);
    updatePresetActiveState();
    if (errorBanner) errorBanner.style.display = 'none';
  };

  const updatePresetActiveState = (): void => {
    const presetPills = modal.backdrop.querySelectorAll<HTMLButtonElement>('[data-size]');
    presetPills.forEach((p) => {
      const s = parseInt(p.getAttribute('data-size') || '0', 10);
      p.classList.toggle('is-active', s === width && s === height);
    });
  };

  btnToggleAspect?.addEventListener('click', () => {
    isLinked = !isLinked;
    btnToggleAspect.classList.toggle('is-active', isLinked);
    if (iconAspect) {
      iconAspect.textContent = isLinked ? 'link' : 'link_off';
    }
    if (isLinked) {
      setDimensions(width, width);
    }
  });

  inputWidth?.addEventListener('input', () => {
    const raw = parseInt(inputWidth.value, 10);
    if (!isNaN(raw)) {
      width = clampValue(raw);
      if (isLinked) {
        height = width;
        if (inputHeight) inputHeight.value = String(height);
      }
      updatePresetActiveState();
    }
  });

  inputHeight?.addEventListener('input', () => {
    const raw = parseInt(inputHeight.value, 10);
    if (!isNaN(raw)) {
      height = clampValue(raw);
      if (isLinked) {
        width = height;
        if (inputWidth) inputWidth.value = String(width);
      }
      updatePresetActiveState();
    }
  });

  const btnWidthDec1 = modal.backdrop.querySelector<HTMLButtonElement>('[data-ref="btn-width-dec-1"]');
  const btnWidthDec16 = modal.backdrop.querySelector<HTMLButtonElement>('[data-ref="btn-width-dec-16"]');
  const btnWidthInc1 = modal.backdrop.querySelector<HTMLButtonElement>('[data-ref="btn-width-inc-1"]');
  const btnWidthInc16 = modal.backdrop.querySelector<HTMLButtonElement>('[data-ref="btn-width-inc-16"]');

  btnWidthDec1?.addEventListener('click', () => setDimensions(width - 1, isLinked ? width - 1 : height));
  btnWidthDec16?.addEventListener('click', () => setDimensions(width - 16, isLinked ? width - 16 : height));
  btnWidthInc1?.addEventListener('click', () => setDimensions(width + 1, isLinked ? width + 1 : height));
  btnWidthInc16?.addEventListener('click', () => setDimensions(width + 16, isLinked ? width + 1 : height));

  const btnHeightDec1 = modal.backdrop.querySelector<HTMLButtonElement>('[data-ref="btn-height-dec-1"]');
  const btnHeightDec16 = modal.backdrop.querySelector<HTMLButtonElement>('[data-ref="btn-height-dec-16"]');
  const btnHeightInc1 = modal.backdrop.querySelector<HTMLButtonElement>('[data-ref="btn-height-inc-1"]');
  const btnHeightInc16 = modal.backdrop.querySelector<HTMLButtonElement>('[data-ref="btn-height-inc-16"]');

  btnHeightDec1?.addEventListener('click', () => setDimensions(isLinked ? height - 1 : width, height - 1));
  btnHeightDec16?.addEventListener('click', () => setDimensions(isLinked ? height - 16 : width, height - 16));
  btnHeightInc1?.addEventListener('click', () => setDimensions(isLinked ? height + 1 : width, height + 1));
  btnHeightInc16?.addEventListener('click', () => setDimensions(isLinked ? height + 16 : width, height + 1));

  const presetPills = modal.backdrop.querySelectorAll<HTMLButtonElement>('[data-size]');
  presetPills.forEach((btn) => {
    btn.addEventListener('click', () => {
      const s = parseInt(btn.getAttribute('data-size') || '32', 10);
      setDimensions(s, s);
    });
  });

  const scalePills = modal.backdrop.querySelectorAll<HTMLButtonElement>('[data-scale]');
  scalePills.forEach((btn) => {
    btn.addEventListener('click', () => {
      scalePills.forEach((p) => p.classList.remove('is-active'));
      btn.classList.add('is-active');
      pixelSize = parseInt(btn.getAttribute('data-scale') || '16', 10);
    });
  });

  const bgPills = modal.backdrop.querySelectorAll<HTMLButtonElement>('[data-bg]');
  bgPills.forEach((btn) => {
    btn.addEventListener('click', () => {
      bgPills.forEach((p) => p.classList.remove('is-active'));
      btn.classList.add('is-active');
      backgroundColor = btn.getAttribute('data-bg') || 'transparent';
    });
  });

  renderIcons(modal.backdrop);
}
