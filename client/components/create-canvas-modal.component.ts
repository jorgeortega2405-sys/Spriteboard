import { PresetVariant } from '../config/templates.config.js';
import { createAndOpenCanvas } from '../services/canvas-creator.service.js';
import { renderIcons } from '../services/icon.service.js';
import { t, translateElement } from '../services/i18n.service.js';
import { setupDropdown } from '../utils/dom.util.js';

let activeCreateCanvasModal: { close: () => void } | null = null;

export interface OpenCreateCanvasModalOptions {
  height?: number;
  name?: string;
  teamName?: string | null;
  teamUuid?: string | null;
  templateImage?: string | null;
  templateName?: string | null;
  variants?: PresetVariant[] | null;
  width?: number;
}

export function openCreateCanvasModal(options?: OpenCreateCanvasModalOptions): void {
  if (activeCreateCanvasModal) {
    activeCreateCanvasModal.close();
  }

  const initialName = options?.name || options?.templateName || '';
  const templateVariants = options?.variants && options.variants.length > 0 ? options.variants : null;
  const templateName = options?.templateName || null;

  let currentWidth = options?.width || templateVariants?.[0]?.width || 64;
  let currentHeight = options?.height || templateVariants?.[0]?.height || 64;
  let currentTemplateImage = options?.templateImage || templateVariants?.[0]?.imagePath || null;

  const initialVariant = templateVariants
    ? templateVariants.find((v) => v.width === currentWidth && v.height === currentHeight) || templateVariants[0]
    : null;
  if (initialVariant) {
    currentWidth = initialVariant.width;
    currentHeight = initialVariant.height;
    if (initialVariant.imagePath) {
      currentTemplateImage = initialVariant.imagePath;
    }
  }
  const initialVariantLabel = initialVariant ? initialVariant.label : `${currentWidth} × ${currentHeight} px`;

  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.setAttribute('data-ref', 'modal-create-canvas-backdrop');

  backdrop.innerHTML = `
    <div class="modal-container" data-ref="modal-create-canvas-container">
      <button type="button" class="modal-close-btn" data-ref="btn-modal-close" data-i18n-aria="modal.close" aria-label="${t('modal.close')}">
        <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#close"></use></svg>
      </button>

      <div class="modal-card modal-card--create-canvas no-padding" data-ref="modal-card-create-canvas">
        <div class="modal-card__drag-zone" data-ref="modal-drag-zone" aria-hidden="true">
          <div class="modal-card__drag-handle"></div>
        </div>

        <div class="modal-create-canvas__sidebar" data-ref="modal-create-canvas-sidebar">
          <div class="modal-create-canvas__sidebar-top" data-ref="modal-sidebar-top">
            <div class="component-top-left" data-ref="modal-sidebar-top-left">
              <h1 class="component-top-title">${templateName ? 'Crear desde plantilla' : (options?.teamName ? `Lienzo para ${options.teamName}` : t('canvas.modal_title'))}</h1>
            </div>
          </div>
          <div class="modal-create-canvas__sidebar-bottom" data-ref="modal-sidebar-bottom">
            <div class="menu-panel__list" data-ref="modal-nav-list">
              <button type="button" class="menu-item is-active" data-ref="tab-stage-dimensions" data-stage="dimensions">
                <svg class="component-icon menu-item__icon" aria-hidden="true"><use href="/icons.svg#aspect_ratio"></use></svg>
                <span class="menu-item__text" data-i18n="canvas.stage_dimensions">${t('canvas.stage_dimensions')}</span>
              </button>
              <button type="button" class="menu-item" data-ref="tab-stage-background" data-stage="background">
                <svg class="component-icon menu-item__icon" aria-hidden="true"><use href="/icons.svg#palette"></use></svg>
                <span class="menu-item__text" data-i18n="canvas.stage_background">${t('canvas.stage_background')}</span>
              </button>
              <button type="button" class="menu-item" data-ref="tab-stage-animation" data-stage="animation">
                <svg class="component-icon menu-item__icon" aria-hidden="true"><use href="/icons.svg#animation"></use></svg>
                <span class="menu-item__text" data-i18n="canvas.stage_animation">${t('canvas.stage_animation')}</span>
              </button>
            </div>
          </div>
        </div>

        <div class="modal-create-canvas__body" data-ref="modal-create-canvas-body">
          <div class="modal-create-canvas__body-top" data-ref="modal-body-top">
            <div class="component-top-left" data-ref="modal-body-top-left">
              <h2 class="component-top-title" data-ref="modal-stage-title" data-i18n="canvas.stage_dimensions">${t('canvas.stage_dimensions')}</h2>
            </div>
          </div>

          <div class="modal-create-canvas__body-bottom" data-ref="modal-body-bottom">
            <div class="modal-canvas-panel" data-ref="panel-stage-dimensions">
              <div class="modal-canvas-panel__form" data-ref="form-stage-dimensions">
                <div class="settings-group" data-ref="custom-size-group-name">
                  <div class="settings-item" data-ref="custom-size-item-name">
                    <div class="settings-item__content" data-ref="custom-size-name-content">
                      <div class="settings-item__text" data-ref="custom-size-name-text">
                        <h2 class="settings-item__title" data-ref="custom-size-name-title" data-i18n="canvas.canvas_name_title">${t('canvas.canvas_name_title')}</h2>
                        <p class="settings-item__desc" data-ref="custom-size-name-desc" data-i18n="canvas.canvas_name_desc">${t('canvas.canvas_name_desc')}</p>
                      </div>
                    </div>
                    <div class="settings-item__actions" data-ref="custom-size-name-actions">
                      <input class="modal-canvas-panel__name-input" data-ref="input-canvas-name" type="text" placeholder="${t('canvas.input_name_placeholder')}" value="${initialName || t('canvas.input_name_placeholder')}" maxlength="100" autocomplete="off" />
                    </div>
                  </div>
                </div>

                ${templateVariants ? `
                <div class="settings-group" data-ref="custom-size-group-template-sizes">
                  <div class="settings-item" data-ref="custom-size-item-template-size">
                    <div class="settings-item__content" data-ref="custom-size-template-size-content">
                      <div class="settings-item__text" data-ref="custom-size-template-size-text">
                        <h2 class="settings-item__title" data-ref="custom-size-template-size-title">Tamaño de la plantilla</h2>
                        <p class="settings-item__desc" data-ref="custom-size-template-size-desc">Selecciona una de las resoluciones optimizadas disponibles.</p>
                      </div>
                    </div>
                    <div class="settings-item__actions" data-ref="custom-size-template-size-actions">
                      <div class="settings-dropdown-wrapper settings-dropdown-wrapper--w-320" data-ref="dropdown-wrapper-template-size">
                        <button type="button" class="dropdown-trigger" data-ref="btn-trigger-template-size" aria-label="Seleccionar tamaño de plantilla">
                          <div class="dropdown-trigger__left" data-ref="template-size-trigger-left">
                            <span class="material-symbols-rounded dropdown-trigger__icon" data-ref="template-size-selected-icon">aspect_ratio</span>
                            <span class="dropdown-trigger__text" data-ref="template-size-selected-text">${initialVariantLabel}</span>
                          </div>
                          <span class="material-symbols-rounded dropdown-trigger__chevron" data-ref="template-size-chevron">expand_more</span>
                        </button>
                        <div class="dropdown-backdrop" data-ref="dropdown-backdrop-template-size">
                          <div class="menu-panel menu-panel--dropdown menu-panel--w-full menu-panel--h-auto" data-ref="dropdown-menu-template-size">
                            <div class="menu-panel__drag-zone" data-ref="drag-zone-template-size" aria-hidden="true">
                              <div class="menu-panel__drag-handle"></div>
                            </div>
                            <div class="menu-panel__list" data-ref="list-template-sizes" style="max-height: 280px; overflow-y: auto;">
                              ${templateVariants.map((v) => {
                                const isSel = v.width === currentWidth && v.height === currentHeight;
                                return `
                                  <button type="button" class="menu-item${isSel ? ' is-active' : ''}" data-ref="option-template-size-${v.width}x${v.height}" data-w="${v.width}" data-h="${v.height}" data-img="${v.imagePath || ''}" data-label="${v.label}">
                                    <span class="material-symbols-rounded menu-item__icon">aspect_ratio</span>
                                    <span class="menu-item__text">${v.label}</span>
                                  </button>
                                `;
                              }).join('')}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <input class="hidden" data-ref="input-canvas-width" type="hidden" value="${currentWidth}" />
                <input class="hidden" data-ref="input-canvas-height" type="hidden" value="${currentHeight}" />
                ` : `
                <div class="settings-group" data-ref="custom-size-group-width">
                  <div class="settings-item" data-ref="custom-size-item-width">
                    <div class="settings-item__content" data-ref="custom-size-width-content">
                      <div class="settings-item__text" data-ref="custom-size-width-text">
                        <h2 class="settings-item__title" data-ref="custom-size-width-title" data-i18n="canvas.canvas_width_title">${t('canvas.canvas_width_title')}</h2>
                        <p class="settings-item__desc" data-ref="custom-size-width-desc" data-i18n="canvas.canvas_width_desc">${t('canvas.canvas_width_desc')}</p>
                      </div>
                    </div>
                    <div class="settings-item__actions" data-ref="custom-size-width-actions">
                      <div class="component-inline-control component-inline-control--fixed" data-ref="inline-control-width">
                        <div class="component-inline-control__group" data-ref="inline-group-width-dec">
                          <button type="button" class="component-inline-control__btn" data-ref="btn-width-dec-large" data-tooltip="-16 px" aria-label="Disminuir 16 píxeles">
                            <span class="material-symbols-rounded">keyboard_double_arrow_left</span>
                          </button>
                          <button type="button" class="component-inline-control__btn" data-ref="btn-width-dec" data-tooltip="-1 px" aria-label="Disminuir 1 píxel">
                            <span class="material-symbols-rounded">chevron_left</span>
                          </button>
                        </div>
                        <input class="component-inline-control__input" data-ref="input-canvas-width" type="number" min="1" max="16384" value="${currentWidth}" autocomplete="off" />
                        <div class="component-inline-control__group" data-ref="inline-group-width-inc">
                          <button type="button" class="component-inline-control__btn" data-ref="btn-width-inc" data-tooltip="+1 px" aria-label="Aumentar 1 píxel">
                            <span class="material-symbols-rounded">chevron_right</span>
                          </button>
                          <button type="button" class="component-inline-control__btn" data-ref="btn-width-inc-large" data-tooltip="+16 px" aria-label="Aumentar 16 píxeles">
                            <span class="material-symbols-rounded">keyboard_double_arrow_right</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div class="settings-group" data-ref="custom-size-group-height">
                  <div class="settings-item" data-ref="custom-size-item-height">
                    <div class="settings-item__content" data-ref="custom-size-height-content">
                      <div class="settings-item__text" data-ref="custom-size-height-text">
                        <h2 class="settings-item__title" data-ref="custom-size-height-title" data-i18n="canvas.canvas_height_title">${t('canvas.canvas_height_title')}</h2>
                        <p class="settings-item__desc" data-ref="custom-size-height-desc" data-i18n="canvas.canvas_height_desc">${t('canvas.canvas_height_desc')}</p>
                      </div>
                    </div>
                    <div class="settings-item__actions" data-ref="custom-size-height-actions">
                      <div class="component-inline-control component-inline-control--fixed" data-ref="inline-control-height">
                        <div class="component-inline-control__group" data-ref="inline-group-height-dec">
                          <button type="button" class="component-inline-control__btn" data-ref="btn-height-dec-large" data-tooltip="-16 px" aria-label="Disminuir 16 píxeles">
                            <span class="material-symbols-rounded">keyboard_double_arrow_left</span>
                          </button>
                          <button type="button" class="component-inline-control__btn" data-ref="btn-height-dec" data-tooltip="-1 px" aria-label="Disminuir 1 píxel">
                            <span class="material-symbols-rounded">chevron_left</span>
                          </button>
                        </div>
                        <input class="component-inline-control__input" data-ref="input-canvas-height" type="number" min="1" max="16384" value="${currentHeight}" autocomplete="off" />
                        <div class="component-inline-control__group" data-ref="inline-group-height-inc">
                          <button type="button" class="component-inline-control__btn" data-ref="btn-height-inc" data-tooltip="+1 px" aria-label="Aumentar 1 píxel">
                            <span class="material-symbols-rounded">chevron_right</span>
                          </button>
                          <button type="button" class="component-inline-control__btn" data-ref="btn-height-inc-large" data-tooltip="+16 px" aria-label="Aumentar 16 píxeles">
                            <span class="material-symbols-rounded">keyboard_double_arrow_right</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div class="settings-group" data-ref="custom-size-group-quick-presets">
                  <div class="settings-item" data-ref="custom-size-item-presets">
                    <div class="settings-item__content" data-ref="custom-size-presets-content">
                      <div class="settings-item__text" data-ref="custom-size-presets-text">
                        <h2 class="settings-item__title" data-ref="custom-size-presets-title">Tamaños rápidos</h2>
                        <p class="settings-item__desc" data-ref="custom-size-presets-desc">Establece una resolución estándar con un clic.</p>
                      </div>
                    </div>
                    <div class="settings-item__actions" data-ref="custom-size-presets-actions">
                      <div class="template-variants-pills" data-ref="quick-preset-pills">
                        <button type="button" class="template-variant-pill" data-ref="btn-preset-16" data-w="16" data-h="16">16 × 16</button>
                        <button type="button" class="template-variant-pill" data-ref="btn-preset-32" data-w="32" data-h="32">32 × 32</button>
                        <button type="button" class="template-variant-pill is-active" data-ref="btn-preset-64" data-w="64" data-h="64">64 × 64</button>
                        <button type="button" class="template-variant-pill" data-ref="btn-preset-128" data-w="128" data-h="128">128 × 128</button>
                        <button type="button" class="template-variant-pill" data-ref="btn-preset-256" data-w="256" data-h="256">256 × 256</button>
                        <button type="button" class="template-variant-pill" data-ref="btn-preset-512" data-w="512" data-h="512">512 × 512</button>
                      </div>
                    </div>
                  </div>
                </div>
                `}

                <div class="modal-canvas-panel__actions" data-ref="stage1-actions">
                  <div class="modal-canvas-panel__actions-row" data-ref="stage1-actions-row">
                    <div></div>
                    <button type="button" class="btn btn--h44 btn--black" data-ref="btn-stage1-next">
                      <span>${t('canvas.btn_next')}</span>
                      <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#chevron_right"></use></svg>
                    </button>
                  </div>
                  <div class="banner banner--danger" data-ref="create-canvas-error-stage1" style="display: none;"></div>
                </div>
              </div>
            </div>

            <div class="modal-canvas-panel" data-ref="panel-stage-background" style="display: none;">
              <div class="modal-canvas-panel__form" data-ref="form-stage-background">
                <div class="settings-group" data-ref="custom-size-group-preview">
                  <div class="settings-item" data-ref="custom-size-item-preview">
                    <div class="settings-item__content" data-ref="custom-size-preview-content">
                      <div class="settings-item__text" data-ref="custom-size-preview-text">
                        <h2 class="settings-item__title" data-ref="custom-size-preview-title">Previsualización del fondo</h2>
                        <p class="settings-item__desc" data-ref="custom-size-preview-desc">Vista previa en tiempo real de la base de dibujo.</p>
                      </div>
                    </div>
                    <div class="settings-item__actions" data-ref="custom-size-preview-actions" style="width: 220px;">
                      <div class="bg-live-preview is-check-16" data-ref="bg-live-preview">
                        <span class="bg-live-preview__label" data-ref="bg-live-preview-label">Transparente (16px)</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div class="settings-group" data-ref="custom-size-group-background">
                  <div class="settings-item" data-ref="custom-size-item-background">
                    <div class="settings-item__content" data-ref="custom-size-bg-content">
                      <div class="settings-item__text" data-ref="custom-size-bg-text">
                        <h2 class="settings-item__title" data-ref="custom-size-bg-title">Tipo de fondo</h2>
                        <p class="settings-item__desc" data-ref="custom-size-bg-desc">Elige entre fondo transparente de tablero o color sólido.</p>
                      </div>
                    </div>
                    <div class="settings-item__actions" data-ref="custom-size-bg-actions">
                      <div class="template-variants-pills" data-ref="bg-type-pills">
                        <button type="button" class="template-variant-pill is-active" data-ref="btn-bg-transparent" data-bg="transparent">
                          Transparente
                        </button>
                        <button type="button" class="template-variant-pill" data-ref="btn-bg-solid" data-bg="solid">
                          Color Sólido
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div class="settings-group" data-ref="custom-size-group-bg-transparent">
                  <div class="settings-item" data-ref="custom-size-item-bg-check">
                    <div class="settings-item__content" data-ref="custom-size-check-content">
                      <div class="settings-item__text" data-ref="custom-size-check-text">
                        <h2 class="settings-item__title" data-ref="custom-size-check-title">Tamaño de cuadrícula</h2>
                        <p class="settings-item__desc" data-ref="custom-size-check-desc">Tamaño de los cuadros del patrón transparente.</p>
                      </div>
                    </div>
                    <div class="settings-item__actions" data-ref="custom-size-check-actions">
                      <div class="template-variants-pills" data-ref="bg-checksize-pills">
                        <button type="button" class="template-variant-pill" data-ref="btn-check-8" data-size="8">8 px</button>
                        <button type="button" class="template-variant-pill is-active" data-ref="btn-check-16" data-size="16">16 px</button>
                        <button type="button" class="template-variant-pill" data-ref="btn-check-32" data-size="32">32 px</button>
                      </div>
                    </div>
                  </div>
                </div>

                <div class="settings-group" data-ref="custom-size-group-bg-solid" style="display: none;">
                  <div class="settings-item" data-ref="custom-size-item-bg-color">
                    <div class="settings-item__content" data-ref="custom-size-solid-content">
                      <div class="settings-item__text" data-ref="custom-size-solid-text">
                        <h2 class="settings-item__title" data-ref="custom-size-solid-title">Color de fondo</h2>
                        <p class="settings-item__desc" data-ref="custom-size-solid-desc">Selecciona un color predeterminado o personalizado.</p>
                      </div>
                    </div>
                    <div class="settings-item__actions" data-ref="custom-size-solid-actions">
                      <div class="template-variants-pills" data-ref="bg-color-pills" style="margin-bottom: 8px;">
                        <button type="button" class="template-variant-pill is-active" data-ref="btn-color-white" data-color="#ffffff">Blanco</button>
                        <button type="button" class="template-variant-pill" data-ref="btn-color-black" data-color="#000000">Negro</button>
                        <button type="button" class="template-variant-pill" data-ref="btn-color-custom" data-color="custom">Personalizado</button>
                      </div>
                      <div class="design-colors-custom-row" data-ref="bg-color-custom-row" style="display: none;">
                        <input class="design-color-active-input" data-ref="input-bg-color" type="color" value="#ffffff" />
                        <input class="design-colors-text-input" data-ref="input-bg-color-hex" type="text" value="#ffffff" maxlength="7" placeholder="#ffffff" />
                      </div>
                    </div>
                  </div>
                </div>

                <div class="modal-canvas-panel__actions" data-ref="stage2-actions">
                  <div class="modal-canvas-panel__actions-row" data-ref="stage2-actions-row">
                    <button type="button" class="btn btn--h44 btn--outline" data-ref="btn-stage2-prev">
                      <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#chevron_left"></use></svg>
                      <span>${t('canvas.btn_back')}</span>
                    </button>
                    <button type="button" class="btn btn--h44 btn--black" data-ref="btn-stage2-next">
                      <span>${t('canvas.btn_next')}</span>
                      <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#chevron_right"></use></svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div class="modal-canvas-panel" data-ref="panel-stage-animation" style="display: none;">
              <div class="modal-canvas-panel__form" data-ref="form-stage-animation">
                <div class="settings-group" data-ref="custom-size-group-fps">
                  <div class="settings-item" data-ref="custom-size-item-fps">
                    <div class="settings-item__content" data-ref="custom-size-fps-content">
                      <div class="settings-item__text" data-ref="custom-size-fps-text">
                        <h2 class="settings-item__title" data-ref="custom-size-fps-title">Velocidad de animación (FPS)</h2>
                        <p class="settings-item__desc" data-ref="custom-size-fps-desc">Fotogramas por segundo predeterminados para la línea de tiempo.</p>
                      </div>
                    </div>
                    <div class="settings-item__actions" data-ref="custom-size-fps-actions">
                      <div class="template-variants-pills" data-ref="fps-pills">
                        <button type="button" class="template-variant-pill is-active" data-ref="btn-fps-8" data-fps="8">8 FPS (Retro)</button>
                        <button type="button" class="template-variant-pill" data-ref="btn-fps-12" data-fps="12">12 FPS</button>
                        <button type="button" class="template-variant-pill" data-ref="btn-fps-16" data-fps="16">16 FPS</button>
                        <button type="button" class="template-variant-pill" data-ref="btn-fps-24" data-fps="24">24 FPS (Fluido)</button>
                      </div>
                    </div>
                  </div>
                </div>

                <div class="settings-group" data-ref="custom-size-group-onion">
                  <div class="settings-item" data-ref="custom-size-item-onion">
                    <div class="settings-item__content" data-ref="custom-size-onion-content">
                      <div class="settings-item__text" data-ref="custom-size-onion-text">
                        <h2 class="settings-item__title" data-ref="custom-size-onion-title">Papel de cebolla (Onion Skin)</h2>
                        <p class="settings-item__desc" data-ref="custom-size-onion-desc">Previsualiza los fotogramas vecinos mientras dibujas animaciones.</p>
                      </div>
                    </div>
                    <div class="settings-item__actions" data-ref="custom-size-onion-actions">
                      <div class="template-variants-pills" data-ref="onion-pills">
                        <button type="button" class="template-variant-pill is-active" data-ref="btn-onion-off" data-onion="false">Desactivado</button>
                        <button type="button" class="template-variant-pill" data-ref="btn-onion-on" data-onion="true">Activado</button>
                      </div>
                    </div>
                  </div>
                </div>

                <div class="settings-group" data-ref="custom-size-group-summary">
                  <div class="modal-create-canvas-summary" data-ref="project-summary-box">
                    ${templateName || currentTemplateImage ? `
                    <div class="modal-create-canvas-summary__row" data-ref="summary-row-tmpl">
                      <span class="modal-create-canvas-summary__label">Plantilla:</span>
                      <span class="modal-create-canvas-summary__value" data-ref="summary-val-tmpl">${templateName || 'Plantilla de naturaleza'}</span>
                    </div>
                    ` : ''}
                    <div class="modal-create-canvas-summary__row" data-ref="summary-row-name">
                      <span class="modal-create-canvas-summary__label">Nombre:</span>
                      <span class="modal-create-canvas-summary__value" data-ref="summary-val-name">-</span>
                    </div>
                    <div class="modal-create-canvas-summary__row" data-ref="summary-row-dims">
                      <span class="modal-create-canvas-summary__label">Dimensiones:</span>
                      <span class="modal-create-canvas-summary__value" data-ref="summary-val-dims">64 × 64 px</span>
                    </div>
                    <div class="modal-create-canvas-summary__row" data-ref="summary-row-bg">
                      <span class="modal-create-canvas-summary__label">Fondo:</span>
                      <span class="modal-create-canvas-summary__value" data-ref="summary-val-bg">Transparente (16px)</span>
                    </div>
                    <div class="modal-create-canvas-summary__row" data-ref="summary-row-fps">
                      <span class="modal-create-canvas-summary__label">Animación:</span>
                      <span class="modal-create-canvas-summary__value" data-ref="summary-val-fps">8 FPS</span>
                    </div>
                  </div>
                </div>

                <div class="modal-canvas-panel__actions" data-ref="stage3-actions">
                  <div class="modal-canvas-panel__actions-row" data-ref="stage3-actions-row">
                    <button type="button" class="btn btn--h44 btn--outline" data-ref="btn-stage3-prev">
                      <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#chevron_left"></use></svg>
                      <span>${t('canvas.btn_back')}</span>
                    </button>
                    <button type="button" class="btn btn--h44 btn--black" data-ref="btn-submit-create-canvas">
                      ${t('canvas.btn_create')}
                    </button>
                  </div>
                  <div class="banner banner--danger" data-ref="create-canvas-error" style="display: none;"></div>
                </div>
              </div>
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

  const tabStageDimensions = backdrop.querySelector<HTMLElement>('[data-ref="tab-stage-dimensions"]');
  const tabStageBackground = backdrop.querySelector<HTMLElement>('[data-ref="tab-stage-background"]');
  const tabStageAnimation = backdrop.querySelector<HTMLElement>('[data-ref="tab-stage-animation"]');

  const panelStageDimensions = backdrop.querySelector<HTMLElement>('[data-ref="panel-stage-dimensions"]');
  const panelStageBackground = backdrop.querySelector<HTMLElement>('[data-ref="panel-stage-background"]');
  const panelStageAnimation = backdrop.querySelector<HTMLElement>('[data-ref="panel-stage-animation"]');
  const modalStageTitle = backdrop.querySelector<HTMLElement>('[data-ref="modal-stage-title"]');

  const btnClose = backdrop.querySelector<HTMLElement>('[data-ref="btn-modal-close"]');
  const inputName = backdrop.querySelector<HTMLInputElement>('[data-ref="input-canvas-name"]');
  const inputWidth = backdrop.querySelector<HTMLInputElement>('[data-ref="input-canvas-width"]');
  const inputHeight = backdrop.querySelector<HTMLInputElement>('[data-ref="input-canvas-height"]');
  const btnSubmit = backdrop.querySelector<HTMLButtonElement>('[data-ref="btn-submit-create-canvas"]');
  const errorBoxStage1 = backdrop.querySelector<HTMLElement>('[data-ref="create-canvas-error-stage1"]');
  const errorBoxStage3 = backdrop.querySelector<HTMLElement>('[data-ref="create-canvas-error"]');

  const btnStage1Next = backdrop.querySelector<HTMLElement>('[data-ref="btn-stage1-next"]');
  const btnStage2Prev = backdrop.querySelector<HTMLElement>('[data-ref="btn-stage2-prev"]');
  const btnStage2Next = backdrop.querySelector<HTMLElement>('[data-ref="btn-stage2-next"]');
  const btnStage3Prev = backdrop.querySelector<HTMLElement>('[data-ref="btn-stage3-prev"]');

  const btnWidthDecLarge = backdrop.querySelector<HTMLElement>('[data-ref="btn-width-dec-large"]');
  const btnWidthDec = backdrop.querySelector<HTMLElement>('[data-ref="btn-width-dec"]');
  const btnWidthInc = backdrop.querySelector<HTMLElement>('[data-ref="btn-width-inc"]');
  const btnWidthIncLarge = backdrop.querySelector<HTMLElement>('[data-ref="btn-width-inc-large"]');

  const btnHeightDecLarge = backdrop.querySelector<HTMLElement>('[data-ref="btn-height-dec-large"]');
  const btnHeightDec = backdrop.querySelector<HTMLElement>('[data-ref="btn-height-dec"]');
  const btnHeightInc = backdrop.querySelector<HTMLElement>('[data-ref="btn-height-inc"]');
  const btnHeightIncLarge = backdrop.querySelector<HTMLElement>('[data-ref="btn-height-inc-large"]');

  const quickPresetPills = backdrop.querySelectorAll<HTMLElement>('[data-ref^="btn-preset-"]');

  let selectedBgType: 'transparent' | 'solid' = 'transparent';
  let selectedCheckSize = 16;
  let selectedSolidColor = '#ffffff';
  let selectedFps = 8;
  let selectedOnionSkin = false;

  const btnBgTransparent = backdrop.querySelector<HTMLElement>('[data-ref="btn-bg-transparent"]');
  const btnBgSolid = backdrop.querySelector<HTMLElement>('[data-ref="btn-bg-solid"]');
  const groupBgTransparent = backdrop.querySelector<HTMLElement>('[data-ref="custom-size-group-bg-transparent"]');
  const groupBgSolid = backdrop.querySelector<HTMLElement>('[data-ref="custom-size-group-bg-solid"]');
  const checkSizePills = backdrop.querySelectorAll<HTMLElement>('[data-ref^="btn-check-"]');
  const colorPresetPills = backdrop.querySelectorAll<HTMLElement>('[data-ref^="btn-color-"]');
  const customColorRow = backdrop.querySelector<HTMLElement>('[data-ref="bg-color-custom-row"]');
  const inputBgColor = backdrop.querySelector<HTMLInputElement>('[data-ref="input-bg-color"]');
  const inputBgColorHex = backdrop.querySelector<HTMLInputElement>('[data-ref="input-bg-color-hex"]');

  const bgLivePreview = backdrop.querySelector<HTMLElement>('[data-ref="bg-live-preview"]');
  const bgLivePreviewLabel = backdrop.querySelector<HTMLElement>('[data-ref="bg-live-preview-label"]');

  const fpsPills = backdrop.querySelectorAll<HTMLElement>('[data-ref^="btn-fps-"]');
  const onionPills = backdrop.querySelectorAll<HTMLElement>('[data-ref^="btn-onion-"]');

  const summaryValName = backdrop.querySelector<HTMLElement>('[data-ref="summary-val-name"]');
  const summaryValDims = backdrop.querySelector<HTMLElement>('[data-ref="summary-val-dims"]');
  const summaryValBg = backdrop.querySelector<HTMLElement>('[data-ref="summary-val-bg"]');
  const summaryValFps = backdrop.querySelector<HTMLElement>('[data-ref="summary-val-fps"]');

  const updateLivePreview = () => {
    if (!bgLivePreview) return;

    if (currentTemplateImage) {
      bgLivePreview.style.backgroundImage = `url("${currentTemplateImage}")`;
      bgLivePreview.style.backgroundSize = 'cover';
      bgLivePreview.style.backgroundPosition = 'center';
      if (selectedBgType === 'solid') {
        bgLivePreview.style.backgroundColor = selectedSolidColor;
        if (bgLivePreviewLabel) {
          bgLivePreviewLabel.textContent = `Plantilla sobre color sólido (${selectedSolidColor.toUpperCase()})`;
        }
      } else {
        bgLivePreview.style.backgroundColor = '';
        if (bgLivePreviewLabel) {
          bgLivePreviewLabel.textContent = `Plantilla sobre cuadrícula (${selectedCheckSize} px)`;
        }
      }
      return;
    }

    if (selectedBgType === 'solid') {
      bgLivePreview.className = 'bg-live-preview';
      bgLivePreview.style.backgroundImage = 'none';
      bgLivePreview.style.backgroundColor = selectedSolidColor;
      if (bgLivePreviewLabel) {
        bgLivePreviewLabel.textContent = `Color sólido (${selectedSolidColor.toUpperCase()})`;
      }
    } else {
      bgLivePreview.style.backgroundColor = '';
      bgLivePreview.className = `bg-live-preview is-check-${selectedCheckSize}`;
      if (bgLivePreviewLabel) {
        bgLivePreviewLabel.textContent = `Cuadrícula transparente (${selectedCheckSize} px)`;
      }
    }
  };

  const updateSummary = () => {
    const name = inputName?.value.trim() || t('canvas.input_name_placeholder');
    const width = parseInt(inputWidth?.value || '0', 10);
    const height = parseInt(inputHeight?.value || '0', 10);

    if (summaryValName) summaryValName.textContent = name;
    if (summaryValDims) summaryValDims.textContent = `${width} × ${height} px`;
    if (summaryValBg) {
      summaryValBg.textContent =
        selectedBgType === 'solid'
          ? `Sólido (${selectedSolidColor.toUpperCase()})`
          : `Transparente (${selectedCheckSize} px)`;
    }
    if (summaryValFps) {
      const onionLabel = selectedOnionSkin ? 'Onion Skin: Activado' : 'Onion Skin: Desactivado';
      summaryValFps.textContent = `${selectedFps} FPS (${onionLabel})`;
    }
  };

  const switchStage = (stage: 'dimensions' | 'background' | 'animation') => {
    tabStageDimensions?.classList.toggle('is-active', stage === 'dimensions');
    tabStageBackground?.classList.toggle('is-active', stage === 'background');
    tabStageAnimation?.classList.toggle('is-active', stage === 'animation');

    if (panelStageDimensions) panelStageDimensions.style.display = stage === 'dimensions' ? 'block' : 'none';
    if (panelStageBackground) panelStageBackground.style.display = stage === 'background' ? 'block' : 'none';
    if (panelStageAnimation) panelStageAnimation.style.display = stage === 'animation' ? 'block' : 'none';

    if (modalStageTitle) {
      if (stage === 'dimensions') {
        modalStageTitle.textContent = t('canvas.stage_dimensions');
      } else if (stage === 'background') {
        modalStageTitle.textContent = t('canvas.stage_background');
      } else {
        modalStageTitle.textContent = t('canvas.stage_animation');
      }
    }

    if (stage === 'background') {
      updateLivePreview();
    }

    if (stage === 'animation') {
      updateSummary();
    }
  };

  tabStageDimensions?.addEventListener('click', () => switchStage('dimensions'));
  tabStageBackground?.addEventListener('click', () => switchStage('background'));
  tabStageAnimation?.addEventListener('click', () => switchStage('animation'));

  const validateDimensions = (): boolean => {
    const width = parseInt(inputWidth?.value || '0', 10);
    const height = parseInt(inputHeight?.value || '0', 10);

    if (errorBoxStage1) errorBoxStage1.style.display = 'none';
    if (errorBoxStage3) errorBoxStage3.style.display = 'none';

    if (isNaN(width) || width <= 0 || isNaN(height) || height <= 0) {
      if (errorBoxStage1) {
        errorBoxStage1.textContent = 'Las dimensiones deben ser mayores a 0.';
        errorBoxStage1.style.display = 'block';
      }
      return false;
    }

    if (width > 16384 || height > 16384) {
      if (errorBoxStage1) {
        errorBoxStage1.textContent = 'Las dimensiones no pueden superar los 16384 píxeles.';
        errorBoxStage1.style.display = 'block';
      }
      return false;
    }

    return true;
  };

  btnStage1Next?.addEventListener('click', () => {
    if (validateDimensions()) {
      switchStage('background');
    }
  });

  btnStage2Prev?.addEventListener('click', () => switchStage('dimensions'));
  btnStage2Next?.addEventListener('click', () => switchStage('animation'));
  btnStage3Prev?.addEventListener('click', () => switchStage('background'));

  const setupNumberStepper = (
    inputEl: HTMLInputElement | null,
    btnDecLarge: HTMLElement | null,
    btnDec: HTMLElement | null,
    btnInc: HTMLElement | null,
    btnIncLarge: HTMLElement | null,
    minVal = 1,
    maxVal = 16384
  ) => {
    if (!inputEl) return;

    const adjust = (delta: number) => {
      const current = parseInt(inputEl.value, 10) || minVal;
      const next = Math.max(minVal, Math.min(maxVal, current + delta));
      inputEl.value = String(next);
      inputEl.dispatchEvent(new Event('input', { bubbles: true }));
      inputEl.dispatchEvent(new Event('change', { bubbles: true }));
      updatePresetPillsState();
    };

    btnDecLarge?.addEventListener('click', () => adjust(-16));
    btnDec?.addEventListener('click', () => adjust(-1));
    btnInc?.addEventListener('click', () => adjust(1));
    btnIncLarge?.addEventListener('click', () => adjust(16));

    inputEl.addEventListener('change', () => {
      let val = parseInt(inputEl.value, 10);
      if (isNaN(val) || val < minVal) val = minVal;
      if (val > maxVal) val = maxVal;
      inputEl.value = String(val);
      updatePresetPillsState();
    });
  };

  const updatePresetPillsState = () => {
    const currentW = parseInt(inputWidth?.value || '0', 10);
    const currentH = parseInt(inputHeight?.value || '0', 10);
    quickPresetPills.forEach((pill) => {
      const pw = parseInt(pill.getAttribute('data-w') || '0', 10);
      const ph = parseInt(pill.getAttribute('data-h') || '0', 10);
      pill.classList.toggle('is-active', pw === currentW && ph === currentH);
    });
  };

  let templateSizeDropdownController: ReturnType<typeof setupDropdown> | null = null;

  if (templateVariants) {
    const templateSizeDropdown = backdrop.querySelector<HTMLElement>('[data-ref="dropdown-wrapper-template-size"]');
    const templateSizeSelectedText = backdrop.querySelector<HTMLElement>('[data-ref="template-size-selected-text"]');

    if (templateSizeDropdown) {
      templateSizeDropdownController = setupDropdown(templateSizeDropdown, {
        matchWidth: true,
        onSelect: (_val: unknown, item?: HTMLElement) => {
          if (!item) return;
          const wStr = item.getAttribute('data-w');
          const hStr = item.getAttribute('data-h');
          const img = item.getAttribute('data-img');
          const label = item.getAttribute('data-label') || item.querySelector('.menu-item__text')?.textContent?.trim() || '';

          const newW = parseInt(wStr || '0', 10);
          const newH = parseInt(hStr || '0', 10);

          if (newW > 0 && newH > 0) {
            currentWidth = newW;
            currentHeight = newH;
            if (inputWidth) inputWidth.value = String(newW);
            if (inputHeight) inputHeight.value = String(newH);
            if (img) currentTemplateImage = img;
            if (templateSizeSelectedText) templateSizeSelectedText.textContent = label;
            updateLivePreview();
            updateSummary();
          }
        },
      });
    }
  } else {
    setupNumberStepper(inputWidth, btnWidthDecLarge, btnWidthDec, btnWidthInc, btnWidthIncLarge);
    setupNumberStepper(inputHeight, btnHeightDecLarge, btnHeightDec, btnHeightInc, btnHeightIncLarge);
    updatePresetPillsState();

    quickPresetPills.forEach((pill) => {
      pill.addEventListener('click', () => {
        const w = pill.getAttribute('data-w');
        const h = pill.getAttribute('data-h');
        if (w && inputWidth) {
          inputWidth.value = w;
          inputWidth.dispatchEvent(new Event('input', { bubbles: true }));
        }
        if (h && inputHeight) {
          inputHeight.value = h;
          inputHeight.dispatchEvent(new Event('input', { bubbles: true }));
        }
        updatePresetPillsState();
      });
    });
  }

  btnBgTransparent?.addEventListener('click', () => {
    selectedBgType = 'transparent';
    btnBgTransparent.classList.add('is-active');
    btnBgSolid?.classList.remove('is-active');
    if (groupBgTransparent) groupBgTransparent.style.display = '';
    if (groupBgSolid) groupBgSolid.style.display = 'none';
    updateLivePreview();
  });

  btnBgSolid?.addEventListener('click', () => {
    selectedBgType = 'solid';
    btnBgSolid.classList.add('is-active');
    btnBgTransparent?.classList.remove('is-active');
    if (groupBgTransparent) groupBgTransparent.style.display = 'none';
    if (groupBgSolid) groupBgSolid.style.display = '';
    updateLivePreview();
  });

  checkSizePills.forEach((pill) => {
    pill.addEventListener('click', () => {
      checkSizePills.forEach((p) => p.classList.remove('is-active'));
      pill.classList.add('is-active');
      selectedCheckSize = parseInt(pill.getAttribute('data-size') || '16', 10);
      updateLivePreview();
    });
  });

  colorPresetPills.forEach((pill) => {
    pill.addEventListener('click', () => {
      colorPresetPills.forEach((p) => p.classList.remove('is-active'));
      pill.classList.add('is-active');
      const col = pill.getAttribute('data-color');
      if (col === 'custom') {
        if (customColorRow) customColorRow.style.display = 'flex';
        selectedSolidColor = inputBgColorHex?.value || inputBgColor?.value || '#ffffff';
      } else {
        if (customColorRow) customColorRow.style.display = 'none';
        selectedSolidColor = col || '#ffffff';
        if (inputBgColor) inputBgColor.value = selectedSolidColor;
        if (inputBgColorHex) inputBgColorHex.value = selectedSolidColor;
      }
      updateLivePreview();
    });
  });

  inputBgColor?.addEventListener('input', () => {
    if (inputBgColorHex) inputBgColorHex.value = inputBgColor.value;
    selectedSolidColor = inputBgColor.value;
    updateLivePreview();
  });

  inputBgColorHex?.addEventListener('input', () => {
    let val = inputBgColorHex.value.trim();
    if (!val.startsWith('#')) val = '#' + val;
    if (/^#[0-9a-fA-F]{6}$/.test(val)) {
      if (inputBgColor) inputBgColor.value = val;
      selectedSolidColor = val;
      updateLivePreview();
    }
  });

  fpsPills.forEach((pill) => {
    pill.addEventListener('click', () => {
      fpsPills.forEach((p) => p.classList.remove('is-active'));
      pill.classList.add('is-active');
      selectedFps = parseInt(pill.getAttribute('data-fps') || '8', 10);
      updateSummary();
    });
  });

  onionPills.forEach((pill) => {
    pill.addEventListener('click', () => {
      onionPills.forEach((p) => p.classList.remove('is-active'));
      pill.classList.add('is-active');
      selectedOnionSkin = pill.getAttribute('data-onion') === 'true';
      updateSummary();
    });
  });

  const showError = (msg: string) => {
    if (errorBoxStage3) {
      errorBoxStage3.textContent = msg;
      errorBoxStage3.style.display = 'block';
    }
  };

  const handleCreateCanvas = async () => {
    if (!validateDimensions()) {
      switchStage('dimensions');
      return;
    }

    const name = inputName?.value.trim() || t('canvas.input_name_placeholder');
    const width = parseInt(inputWidth?.value || '0', 10);
    const height = parseInt(inputHeight?.value || '0', 10);

    if (btnSubmit) {
      btnSubmit.disabled = true;
      btnSubmit.textContent = t('modal.loading');
    }

    try {
      await createAndOpenCanvas({
        name,
        width,
        height,
        templateImage: currentTemplateImage,
        bgType: selectedBgType,
        solidColor: selectedSolidColor,
        checkSize: selectedCheckSize,
        fps: selectedFps,
        onionSkin: selectedOnionSkin,
        teamUuid: options?.teamUuid || null,
        effectiveTier: options?.teamUuid ? 'business' : null,
      });
      closeModal();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t('canvas.error_save');
      showError(msg);
      if (btnSubmit) {
        btnSubmit.disabled = false;
        btnSubmit.textContent = t('canvas.btn_create');
      }
    }
  };

  btnSubmit?.addEventListener('click', handleCreateCanvas);

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      closeModal();
    } else if (e.key === 'Enter' && e.target === inputName) {
      if (validateDimensions()) {
        switchStage('background');
      }
    }
  };

  const handleBackdropClick = (e: MouseEvent) => {
    if (e.target === backdrop) {
      closeModal();
    }
  };

  const closeModal = () => {
    window.removeEventListener('keydown', handleKeyDown);
    backdrop.removeEventListener('click', handleBackdropClick);
    backdrop.classList.remove('is-visible');
    document.body.classList.remove('modal-open');
    if (templateSizeDropdownController) {
      templateSizeDropdownController.destroy();
      templateSizeDropdownController = null;
    }
    setTimeout(() => {
      backdrop.remove();
      if (activeCreateCanvasModal && activeCreateCanvasModal.close === closeModal) {
        activeCreateCanvasModal = null;
      }
    }, 200);
  };

  btnClose?.addEventListener('click', closeModal);
  backdrop.addEventListener('click', handleBackdropClick);
  window.addEventListener('keydown', handleKeyDown);

  activeCreateCanvasModal = { close: closeModal };

  setTimeout(() => {
    inputName?.focus();
    inputName?.select();
  }, 100);
}
