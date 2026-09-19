import { getBoardSvg, getDiagramSvg, getDocSvg, getPixelSvg, getTemplateVariantSvg } from './create-canvas-graphics.js';
import { PresetVariant } from '../config/templates.config.js';
import { createAndOpenCanvas, CreateCanvasOptions } from '../services/canvas-creator.service.js';
import { t, translateElement } from '../services/i18n.service.js';
import { renderIcons } from '../services/icon.service.js';
import { DIAGRAM_CATEGORIES, DIAGRAM_SUBTYPES, DiagramCategory, DiagramSubtype } from '../types/mindmap.types.js';
import { DocOrientation, DocPaperSize } from '../views/doc/doc.types.js';

let activeCreateCanvasModal: { close: () => void } | null = null;

export interface OpenCreateCanvasModalOptions {
  boardTemplateId?: string;
  diagramSubtype?: DiagramSubtype;
  diagramTemplateId?: string;
  docOrientation?: DocOrientation;
  docPaperSize?: DocPaperSize;
  docTemplateId?: string;
  height?: number;
  initialType?: 'board' | 'diagram' | 'doc' | 'mindmap' | 'pixel';
  name?: string;
  pixelTemplateId?: string;
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

  const templateVariants = options?.variants && options.variants.length > 0 ? options.variants : null;
  const templateName = options?.templateName || null;
  const templateImage = options?.templateImage || null;
  const normalizedInitialType = options?.initialType === 'mindmap' ? 'diagram' : options?.initialType;
  let activeCategory: 'board' | 'diagram' | 'doc' | 'pixel' | 'template' = templateVariants ? 'template' : (normalizedInitialType || 'board');

  let customWidth = options?.width || 64;
  let customHeight = options?.height || 64;
  let selectedBgType: 'solid' | 'transparent' = 'transparent';
  let selectedCheckSize = 16;
  let selectedSolidColor = '#ffffff';
  let isCreating = false;

  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.setAttribute('data-ref', 'modal-create-canvas-backdrop');

  const modalTitle = templateName ? `Plantilla: ${templateName}` : (options?.teamName ? `Lienzo para ${options.teamName}` : 'Crear centro de trabajo');

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
              <h1 class="component-top-title">${modalTitle}</h1>
            </div>
          </div>
          <div class="modal-create-canvas__sidebar-bottom" data-ref="modal-sidebar-bottom">
            <div class="menu-panel__list" data-ref="modal-nav-list">
              ${templateVariants ? `
              <button type="button" class="menu-item is-active" data-ref="tab-category-template" data-category="template">
                <span class="material-symbols-rounded menu-item__icon">style</span>
                <span class="menu-item__text">Plantilla</span>
              </button>
              ` : ''}
              <button type="button" class="menu-item${activeCategory === 'board' ? ' is-active' : ''}" data-ref="tab-category-board" data-category="board">
                <span class="material-symbols-rounded menu-item__icon">space_dashboard</span>
                <span class="menu-item__text">Pizarrón Infinito</span>
              </button>
              <button type="button" class="menu-item${activeCategory === 'diagram' ? ' is-active' : ''}" data-ref="tab-category-diagram" data-category="diagram">
                <span class="material-symbols-rounded menu-item__icon">account_tree</span>
                <span class="menu-item__text">Diagramas y Esquemas</span>
              </button>
              <button type="button" class="menu-item${activeCategory === 'doc' ? ' is-active' : ''}" data-ref="tab-category-doc" data-category="doc">
                <span class="material-symbols-rounded menu-item__icon">description</span>
                <span class="menu-item__text">Documento Doc</span>
              </button>
              <button type="button" class="menu-item${activeCategory === 'pixel' ? ' is-active' : ''}" data-ref="tab-category-pixel" data-category="pixel">
                <span class="material-symbols-rounded menu-item__icon">grid_on</span>
                <span class="menu-item__text">Pixel Art</span>
              </button>
            </div>
          </div>
        </div>

        <div class="modal-create-canvas__body" data-ref="modal-create-canvas-body">
          <div class="modal-create-canvas__body-top" data-ref="modal-body-top">
            <div class="component-top-left" data-ref="modal-body-top-left">
              <h2 class="component-top-title" data-ref="modal-body-title">Pizarrón Infinito</h2>
            </div>
          </div>

          <div class="modal-create-canvas__body-bottom" data-ref="modal-body-bottom">
            ${templateVariants ? `
            <div class="modal-canvas-panel" data-ref="panel-category-template" style="${activeCategory === 'template' ? '' : 'display: none;'}">
              <div class="creation-category-section" data-ref="section-template-variants">
                <h3 class="creation-category-section__title">Resoluciones disponibles de la plantilla</h3>
                <div class="creation-cards-grid" data-ref="grid-template-variants">
                  ${templateVariants.map((v) => `
                    <button type="button" class="creation-card" data-ref="card-template-${v.width}x${v.height}" data-type="template-variant" data-w="${v.width}" data-h="${v.height}" data-img="${v.imagePath || ''}">
                      <div class="creation-card__thumbnail" data-ref="thumb-card-tpl-${v.width}">
                        <div class="creation-card__svg-wrapper" data-ref="svg-card-tpl-${v.width}">
                          ${getTemplateVariantSvg(v.width, v.height, v.imagePath)}
                        </div>
                        <span class="creation-card__badge" data-ref="badge-card-tpl-${v.width}">${v.width} × ${v.height} px</span>
                      </div>
                      <div class="creation-card__info" data-ref="info-card-tpl-${v.width}">
                        <h4 class="creation-card__title" data-ref="title-card-tpl-${v.width}">${v.label || `${v.width} × ${v.height} px`}</h4>
                        <p class="creation-card__meta" data-ref="meta-card-tpl-${v.width}">Plantilla de lienzo</p>
                      </div>
                    </button>
                  `).join('')}
                </div>
              </div>
            </div>
            ` : ''}

            <div class="modal-canvas-panel" data-ref="panel-category-board" style="${activeCategory === 'board' ? '' : 'display: none;'}">
              <div class="creation-cards-grid" data-ref="grid-boards">
                <button type="button" class="creation-card" data-ref="card-board-dots" data-type="board" data-bg="dots" data-color="#ffffff">
                  <div class="creation-card__thumbnail" data-ref="thumb-board-dots">
                    <div class="creation-card__svg-wrapper" data-ref="svg-board-dots">
                      ${getBoardSvg('dots')}
                    </div>
                    <span class="creation-card__badge creation-card__badge--popular" data-ref="badge-board-dots">Estándar</span>
                  </div>
                  <div class="creation-card__info" data-ref="info-board-dots">
                    <h4 class="creation-card__title" data-ref="title-board-dots">Pizarrón Infinito</h4>
                    <p class="creation-card__meta" data-ref="meta-board-dots">Fondo blanco • Cuadrícula de puntos</p>
                  </div>
                </button>
              </div>
            </div>

            <div class="modal-canvas-panel" data-ref="panel-category-diagram" style="${activeCategory === 'diagram' ? '' : 'display: none;'}">
              <div class="template-variants-pills" data-ref="diagram-category-pills" style="display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 16px; width: 100%;">
                ${DIAGRAM_CATEGORIES.map((cat) => `
                  <button type="button" class="template-variant-pill${cat.id === 'all' ? ' is-active' : ''}" data-ref="btn-diag-cat-${cat.id}" data-category="${cat.id}">
                    <span class="material-symbols-rounded" style="font-size: 16px; margin-right: 4px;">${cat.icon}</span>
                    <span>${cat.name}</span>
                  </button>
                `).join('')}
              </div>

              <div class="creation-cards-grid" data-ref="grid-diagrams">
                ${DIAGRAM_SUBTYPES.map((sub) => `
                  <button type="button" class="creation-card" data-ref="card-diagram-${sub.id}" data-type="diagram" data-subtype="${sub.id}" data-category="${sub.category}">
                    <div class="creation-card__thumbnail" data-ref="thumb-diag-${sub.id}">
                      <div class="creation-card__svg-wrapper" data-ref="svg-diag-${sub.id}">
                        ${getDiagramSvg(sub.id)}
                      </div>
                      ${sub.badge ? `<span class="creation-card__badge ${sub.badge === 'Popular' ? 'creation-card__badge--popular' : ''}" data-ref="badge-diag-${sub.id}">${sub.badge}</span>` : ''}
                    </div>
                    <div class="creation-card__info" data-ref="info-diag-${sub.id}">
                      <h4 class="creation-card__title" data-ref="title-diag-${sub.id}">${sub.name}</h4>
                      <p class="creation-card__meta" data-ref="meta-diag-${sub.id}">${sub.description}</p>
                    </div>
                  </button>
                `).join('')}
              </div>
            </div>

            <div class="modal-canvas-panel" data-ref="panel-category-doc" style="${activeCategory === 'doc' ? '' : 'display: none;'}">
              <div class="creation-category-section" data-ref="section-doc-paper-sizes">
                <h3 class="creation-category-section__title">Formatos de papel estándar</h3>
                <div class="creation-cards-grid" data-ref="grid-doc-papers">
                  <button type="button" class="creation-card" data-ref="card-doc-digital" data-type="doc" data-paper="digital" data-template="blank">
                    <div class="creation-card__thumbnail" data-ref="thumb-doc-digital">
                      <div class="creation-card__svg-wrapper" data-ref="svg-doc-digital">
                        ${getDocSvg('digital')}
                      </div>
                      <span class="creation-card__badge creation-card__badge--popular" data-ref="badge-doc-digital">Recomendado</span>
                    </div>
                    <div class="creation-card__info" data-ref="info-doc-digital">
                      <h4 class="creation-card__title" data-ref="title-doc-digital">Doc (Digital)</h4>
                      <p class="creation-card__meta" data-ref="meta-doc-digital">Lienzo continuo adaptable</p>
                    </div>
                  </button>

                  <button type="button" class="creation-card" data-ref="card-doc-a4" data-type="doc" data-paper="a4" data-template="blank">
                    <div class="creation-card__thumbnail" data-ref="thumb-doc-a4">
                      <div class="creation-card__svg-wrapper" data-ref="svg-doc-a4">
                        ${getDocSvg('a4')}
                      </div>
                      <span class="creation-card__badge" data-ref="badge-doc-a4">ISO 216</span>
                    </div>
                    <div class="creation-card__info" data-ref="info-doc-a4">
                      <h4 class="creation-card__title" data-ref="title-doc-a4">Doc (A4)</h4>
                      <p class="creation-card__meta" data-ref="meta-doc-a4">21 × 29.7 cm • Informes y cartas</p>
                    </div>
                  </button>

                  <button type="button" class="creation-card" data-ref="card-doc-letter" data-type="doc" data-paper="letter" data-template="blank">
                    <div class="creation-card__thumbnail" data-ref="thumb-doc-letter">
                      <div class="creation-card__svg-wrapper" data-ref="svg-doc-letter">
                        ${getDocSvg('letter')}
                      </div>
                      <span class="creation-card__badge" data-ref="badge-doc-letter">Carta</span>
                    </div>
                    <div class="creation-card__info" data-ref="info-doc-letter">
                      <h4 class="creation-card__title" data-ref="title-doc-letter">Doc (Carta)</h4>
                      <p class="creation-card__meta" data-ref="meta-doc-letter">8.5 × 11 in • Estándar América</p>
                    </div>
                  </button>

                  <button type="button" class="creation-card" data-ref="card-doc-a3" data-type="doc" data-paper="a3" data-template="blank">
                    <div class="creation-card__thumbnail" data-ref="thumb-doc-a3">
                      <div class="creation-card__svg-wrapper" data-ref="svg-doc-a3">
                        ${getDocSvg('a3')}
                      </div>
                      <span class="creation-card__badge" data-ref="badge-doc-a3">Gran Formato</span>
                    </div>
                    <div class="creation-card__info" data-ref="info-doc-a3">
                      <h4 class="creation-card__title" data-ref="title-doc-a3">Doc (A3)</h4>
                      <p class="creation-card__meta" data-ref="meta-doc-a3">29.7 × 42 cm • Tablas y esquemas</p>
                    </div>
                  </button>

                  <button type="button" class="creation-card" data-ref="card-doc-legal" data-type="doc" data-paper="legal" data-template="blank">
                    <div class="creation-card__thumbnail" data-ref="thumb-doc-legal">
                      <div class="creation-card__svg-wrapper" data-ref="svg-doc-legal">
                        ${getDocSvg('legal')}
                      </div>
                      <span class="creation-card__badge" data-ref="badge-doc-legal">Legal</span>
                    </div>
                    <div class="creation-card__info" data-ref="info-doc-legal">
                      <h4 class="creation-card__title" data-ref="title-doc-legal">Doc (Oficio)</h4>
                      <p class="creation-card__meta" data-ref="meta-doc-legal">8.5 × 14 in • Contratos y acuerdos</p>
                    </div>
                  </button>

                  <button type="button" class="creation-card" data-ref="card-doc-a5" data-type="doc" data-paper="a5" data-template="blank">
                    <div class="creation-card__thumbnail" data-ref="thumb-doc-a5">
                      <div class="creation-card__svg-wrapper" data-ref="svg-doc-a5">
                        ${getDocSvg('a5')}
                      </div>
                      <span class="creation-card__badge" data-ref="badge-doc-a5">Compacto</span>
                    </div>
                    <div class="creation-card__info" data-ref="info-doc-a5">
                      <h4 class="creation-card__title" data-ref="title-doc-a5">Doc (A5)</h4>
                      <p class="creation-card__meta" data-ref="meta-doc-a5">14.8 × 21 cm • Folletos y notas</p>
                    </div>
                  </button>
                </div>
              </div>


            </div>

            <div class="modal-canvas-panel" data-ref="panel-category-pixel" style="${activeCategory === 'pixel' ? '' : 'display: none;'}">
              <div class="creation-cards-grid" data-ref="grid-pixel-presets">
                <button type="button" class="creation-card" data-ref="card-pixel-infinite" data-type="pixel-infinite">
                  <div class="creation-card__thumbnail" data-ref="thumb-pixel-infinite">
                    <div class="creation-card__svg-wrapper" data-ref="svg-pixel-infinite">
                      ${getPixelSvg('pixel-infinite')}
                    </div>
                    <span class="creation-card__badge creation-card__badge--popular" data-ref="badge-pixel-infinite">Infinito</span>
                  </div>
                  <div class="creation-card__info" data-ref="info-pixel-infinite">
                    <h4 class="creation-card__title" data-ref="title-pixel-infinite">Lienzo Infinito</h4>
                    <p class="creation-card__meta" data-ref="meta-pixel-infinite">Expansión continua por chunks</p>
                  </div>
                </button>

                <button type="button" class="creation-card" data-ref="card-pixel-16" data-type="pixel-fixed" data-w="16" data-h="16">
                  <div class="creation-card__thumbnail" data-ref="thumb-pixel-16">
                    <div class="creation-card__svg-wrapper" data-ref="svg-pixel-16">
                      ${getPixelSvg('fixed', 16)}
                    </div>
                    <span class="creation-card__badge" data-ref="badge-pixel-16">16 × 16 px</span>
                  </div>
                  <div class="creation-card__info" data-ref="info-pixel-16">
                    <h4 class="creation-card__title" data-ref="title-pixel-16">Sprite Diminuto</h4>
                    <p class="creation-card__meta" data-ref="meta-pixel-16">16 × 16 px • Iconos y favicons</p>
                  </div>
                </button>

                <button type="button" class="creation-card" data-ref="card-pixel-32" data-type="pixel-fixed" data-w="32" data-h="32">
                  <div class="creation-card__thumbnail" data-ref="thumb-pixel-32">
                    <div class="creation-card__svg-wrapper" data-ref="svg-pixel-32">
                      ${getPixelSvg('fixed', 32)}
                    </div>
                    <span class="creation-card__badge creation-card__badge--popular" data-ref="badge-pixel-32">Popular</span>
                  </div>
                  <div class="creation-card__info" data-ref="info-pixel-32">
                    <h4 class="creation-card__title" data-ref="title-pixel-32">Sprite Clásico</h4>
                    <p class="creation-card__meta" data-ref="meta-pixel-32">32 × 32 px • Personajes 16-bit</p>
                  </div>
                </button>

                <button type="button" class="creation-card" data-ref="card-pixel-64" data-type="pixel-fixed" data-w="64" data-h="64">
                  <div class="creation-card__thumbnail" data-ref="thumb-pixel-64">
                    <div class="creation-card__svg-wrapper" data-ref="svg-pixel-64">
                      ${getPixelSvg('fixed', 64)}
                    </div>
                    <span class="creation-card__badge" data-ref="badge-pixel-64">Estándar</span>
                  </div>
                  <div class="creation-card__info" data-ref="info-pixel-64">
                    <h4 class="creation-card__title" data-ref="title-pixel-64">Lienzo 64 × 64</h4>
                    <p class="creation-card__meta" data-ref="meta-pixel-64">64 × 64 px • Avatares y retratos</p>
                  </div>
                </button>

                <button type="button" class="creation-card" data-ref="card-pixel-128" data-type="pixel-fixed" data-w="128" data-h="128">
                  <div class="creation-card__thumbnail" data-ref="thumb-pixel-128">
                    <div class="creation-card__svg-wrapper" data-ref="svg-pixel-128">
                      ${getPixelSvg('fixed', 128)}
                    </div>
                    <span class="creation-card__badge" data-ref="badge-pixel-128">128 × 128 px</span>
                  </div>
                  <div class="creation-card__info" data-ref="info-pixel-128">
                    <h4 class="creation-card__title" data-ref="title-pixel-128">Resolución Media</h4>
                    <p class="creation-card__meta" data-ref="meta-pixel-128">128 × 128 px • Sprites y fondos</p>
                  </div>
                </button>

                <button type="button" class="creation-card" data-ref="card-pixel-256" data-type="pixel-fixed" data-w="256" data-h="256">
                  <div class="creation-card__thumbnail" data-ref="thumb-pixel-256">
                    <div class="creation-card__svg-wrapper" data-ref="svg-pixel-256">
                      ${getPixelSvg('fixed', 256)}
                    </div>
                    <span class="creation-card__badge" data-ref="badge-pixel-256">256 × 256 px</span>
                  </div>
                  <div class="creation-card__info" data-ref="info-pixel-256">
                    <h4 class="creation-card__title" data-ref="title-pixel-256">Ilustración Grande</h4>
                    <p class="creation-card__meta" data-ref="meta-pixel-256">256 × 256 px • Concept art HD</p>
                  </div>
                </button>

                <button type="button" class="creation-card" data-ref="card-pixel-512" data-type="pixel-fixed" data-w="512" data-h="512">
                  <div class="creation-card__thumbnail" data-ref="thumb-pixel-512">
                    <div class="creation-card__svg-wrapper" data-ref="svg-pixel-512">
                      ${getPixelSvg('fixed', 512)}
                    </div>
                    <span class="creation-card__badge" data-ref="badge-pixel-512">512 × 512 px</span>
                  </div>
                  <div class="creation-card__info" data-ref="info-pixel-512">
                    <h4 class="creation-card__title" data-ref="title-pixel-512">Alta Resolución</h4>
                    <p class="creation-card__meta" data-ref="meta-pixel-512">512 × 512 px • Gran formato</p>
                  </div>
                </button>

                <button type="button" class="creation-card creation-card--custom" data-ref="btn-trigger-custom-size">
                  <div class="creation-card__thumbnail" data-ref="thumb-pixel-custom">
                    <div class="creation-card__svg-wrapper" data-ref="svg-pixel-custom">
                      ${getPixelSvg('custom')}
                    </div>
                    <span class="creation-card__badge creation-card__badge--popular" data-ref="badge-pixel-custom">Personalizado</span>
                  </div>
                  <div class="creation-card__info" data-ref="info-pixel-custom">
                    <h4 class="creation-card__title" data-ref="title-pixel-custom">Elegir tamaño a medida...</h4>
                    <p class="creation-card__meta" data-ref="meta-pixel-custom">Resolución y fondo personalizados</p>
                  </div>
                </button>
              </div>
            </div>

            <div class="modal-canvas-panel" data-ref="panel-pixel-custom-form" style="display: none;">
              <div class="modal-canvas-panel__form" data-ref="form-pixel-custom">
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
                  <button type="button" class="component-button component-button--h36 component-button--outline" data-ref="btn-back-to-pixel-presets">
                    <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#chevron_left"></use></svg>
                    <span>Volver a tamaños rápidos</span>
                  </button>
                </div>

                <div class="settings-group" data-ref="group-custom-name">
                  <div class="settings-item" data-ref="item-custom-name">
                    <div class="settings-item__content" data-ref="content-custom-name">
                      <div class="settings-item__text" data-ref="text-custom-name">
                        <h2 class="settings-item__title" data-ref="title-custom-name">Nombre del lienzo</h2>
                        <p class="settings-item__desc" data-ref="desc-custom-name">Identificador de tu proyecto (opcional).</p>
                      </div>
                    </div>
                    <div class="settings-item__actions" data-ref="actions-custom-name">
                      <input class="modal-canvas-panel__name-input" data-ref="input-custom-name" type="text" placeholder="Lienzo sin título" value="" maxlength="100" autocomplete="off" />
                    </div>
                  </div>
                </div>

                <div class="settings-group" data-ref="group-custom-width">
                  <div class="settings-item" data-ref="item-custom-width">
                    <div class="settings-item__content" data-ref="content-custom-width">
                      <div class="settings-item__text" data-ref="text-custom-width">
                        <h2 class="settings-item__title" data-ref="title-custom-width">Ancho (PX)</h2>
                        <p class="settings-item__desc" data-ref="desc-custom-width">Dimensión horizontal del lienzo.</p>
                      </div>
                    </div>
                    <div class="settings-item__actions" data-ref="actions-custom-width">
                      <div class="component-inline-control component-inline-control--fixed" data-ref="inline-control-custom-width">
                        <div class="component-inline-control__group" data-ref="group-width-dec">
                          <button type="button" class="component-inline-control__btn" data-ref="btn-custom-w-dec-large" data-tooltip="-16 px" aria-label="Disminuir 16 píxeles">
                            <span class="material-symbols-rounded">keyboard_double_arrow_left</span>
                          </button>
                          <button type="button" class="component-inline-control__btn" data-ref="btn-custom-w-dec" data-tooltip="-1 px" aria-label="Disminuir 1 píxel">
                            <span class="material-symbols-rounded">chevron_left</span>
                          </button>
                        </div>
                        <input class="component-inline-control__input" data-ref="input-custom-width" type="number" min="1" max="16384" value="${customWidth}" autocomplete="off" />
                        <div class="component-inline-control__group" data-ref="group-width-inc">
                          <button type="button" class="component-inline-control__btn" data-ref="btn-custom-w-inc" data-tooltip="+1 px" aria-label="Aumentar 1 píxel">
                            <span class="material-symbols-rounded">chevron_right</span>
                          </button>
                          <button type="button" class="component-inline-control__btn" data-ref="btn-custom-w-inc-large" data-tooltip="+16 px" aria-label="Aumentar 16 píxeles">
                            <span class="material-symbols-rounded">keyboard_double_arrow_right</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div class="settings-group" data-ref="group-custom-height">
                  <div class="settings-item" data-ref="item-custom-height">
                    <div class="settings-item__content" data-ref="content-custom-height">
                      <div class="settings-item__text" data-ref="text-custom-height">
                        <h2 class="settings-item__title" data-ref="title-custom-height">Alto (PX)</h2>
                        <p class="settings-item__desc" data-ref="desc-custom-height">Dimensión vertical del lienzo.</p>
                      </div>
                    </div>
                    <div class="settings-item__actions" data-ref="actions-custom-height">
                      <div class="component-inline-control component-inline-control--fixed" data-ref="inline-control-custom-height">
                        <div class="component-inline-control__group" data-ref="group-height-dec">
                          <button type="button" class="component-inline-control__btn" data-ref="btn-custom-h-dec-large" data-tooltip="-16 px" aria-label="Disminuir 16 píxeles">
                            <span class="material-symbols-rounded">keyboard_double_arrow_left</span>
                          </button>
                          <button type="button" class="component-inline-control__btn" data-ref="btn-custom-h-dec" data-tooltip="-1 px" aria-label="Disminuir 1 píxel">
                            <span class="material-symbols-rounded">chevron_left</span>
                          </button>
                        </div>
                        <input class="component-inline-control__input" data-ref="input-custom-height" type="number" min="1" max="16384" value="${customHeight}" autocomplete="off" />
                        <div class="component-inline-control__group" data-ref="group-height-inc">
                          <button type="button" class="component-inline-control__btn" data-ref="btn-custom-h-inc" data-tooltip="+1 px" aria-label="Aumentar 1 píxel">
                            <span class="material-symbols-rounded">chevron_right</span>
                          </button>
                          <button type="button" class="component-inline-control__btn" data-ref="btn-custom-h-inc-large" data-tooltip="+16 px" aria-label="Aumentar 16 píxeles">
                            <span class="material-symbols-rounded">keyboard_double_arrow_right</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div class="settings-group" data-ref="group-custom-quick-chips">
                  <div class="settings-item" data-ref="item-custom-quick-chips">
                    <div class="settings-item__content" data-ref="content-custom-chips">
                      <div class="settings-item__text" data-ref="text-custom-chips">
                        <h2 class="settings-item__title" data-ref="title-custom-chips">Resoluciones rápidas</h2>
                        <p class="settings-item__desc" data-ref="desc-custom-chips">Selecciona proporciones cuadradas predefinidas.</p>
                      </div>
                    </div>
                    <div class="settings-item__actions" data-ref="actions-custom-chips">
                      <div class="template-variants-pills" data-ref="custom-preset-chips">
                        <button type="button" class="template-variant-pill" data-ref="btn-custom-chip-16" data-w="16" data-h="16">16 × 16</button>
                        <button type="button" class="template-variant-pill" data-ref="btn-custom-chip-32" data-w="32" data-h="32">32 × 32</button>
                        <button type="button" class="template-variant-pill is-active" data-ref="btn-custom-chip-64" data-w="64" data-h="64">64 × 64</button>
                        <button type="button" class="template-variant-pill" data-ref="btn-custom-chip-128" data-w="128" data-h="128">128 × 128</button>
                        <button type="button" class="template-variant-pill" data-ref="btn-custom-chip-256" data-w="256" data-h="256">256 × 256</button>
                        <button type="button" class="template-variant-pill" data-ref="btn-custom-chip-512" data-w="512" data-h="512">512 × 512</button>
                      </div>
                    </div>
                  </div>
                </div>

                <div class="settings-group" data-ref="group-custom-bg-type">
                  <div class="settings-item" data-ref="item-custom-bg-type">
                    <div class="settings-item__content" data-ref="content-custom-bg-type">
                      <div class="settings-item__text" data-ref="text-custom-bg-type">
                        <h2 class="settings-item__title" data-ref="title-custom-bg-type">Tipo de fondo</h2>
                        <p class="settings-item__desc" data-ref="desc-custom-bg-type">Cuadrícula transparente o color sólido.</p>
                      </div>
                    </div>
                    <div class="settings-item__actions" data-ref="actions-custom-bg-type">
                      <div class="template-variants-pills" data-ref="custom-bg-type-pills">
                        <button type="button" class="template-variant-pill is-active" data-ref="btn-custom-bg-trans" data-bg-type="transparent">
                          <span class="material-symbols-rounded" style="font-size: 16px; margin-right: 4px;">opacity</span>
                          <span>Transparente</span>
                        </button>
                        <button type="button" class="template-variant-pill" data-ref="btn-custom-bg-solid" data-bg-type="solid">
                          <span class="material-symbols-rounded" style="font-size: 16px; margin-right: 4px;">format_color_fill</span>
                          <span>Color Sólido</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div class="settings-group" data-ref="group-custom-bg-check">
                  <div class="settings-item" data-ref="item-custom-bg-check">
                    <div class="settings-item__content" data-ref="content-custom-bg-check">
                      <div class="settings-item__text" data-ref="text-custom-bg-check">
                        <h2 class="settings-item__title" data-ref="title-custom-bg-check">Tamaño de cuadrícula</h2>
                        <p class="settings-item__desc" data-ref="desc-custom-bg-check">Dimensión del patrón de transparencia.</p>
                      </div>
                    </div>
                    <div class="settings-item__actions" data-ref="actions-custom-bg-check">
                      <div class="template-variants-pills" data-ref="custom-check-pills">
                        <button type="button" class="template-variant-pill" data-ref="btn-custom-check-8" data-size="8">8 px</button>
                        <button type="button" class="template-variant-pill is-active" data-ref="btn-custom-check-16" data-size="16">16 px</button>
                        <button type="button" class="template-variant-pill" data-ref="btn-custom-check-32" data-size="32">32 px</button>
                      </div>
                    </div>
                  </div>
                </div>

                <div class="settings-group" data-ref="group-custom-bg-color" style="display: none;">
                  <div class="settings-item" data-ref="item-custom-bg-color">
                    <div class="settings-item__content" data-ref="content-custom-bg-color">
                      <div class="settings-item__text" data-ref="text-custom-bg-color">
                        <h2 class="settings-item__title" data-ref="title-custom-bg-color">Color de fondo</h2>
                        <p class="settings-item__desc" data-ref="desc-custom-bg-color">Selecciona color predefinido o personalizado.</p>
                      </div>
                    </div>
                    <div class="settings-item__actions" data-ref="actions-custom-bg-color">
                      <div class="template-variants-pills" data-ref="custom-color-pills" style="margin-bottom: 8px;">
                        <button type="button" class="template-variant-pill is-active" data-ref="btn-custom-color-white" data-color="#ffffff">Blanco</button>
                        <button type="button" class="template-variant-pill" data-ref="btn-custom-color-black" data-color="#000000">Negro</button>
                        <button type="button" class="template-variant-pill" data-ref="btn-custom-color-picker" data-color="custom">Personalizado</button>
                      </div>
                      <div class="design-colors-custom-row" data-ref="custom-color-row" style="display: none;">
                        <input class="design-color-active-input" data-ref="input-custom-bg-color" type="color" value="#ffffff" />
                        <input class="design-colors-text-input" data-ref="input-custom-bg-color-hex" type="text" value="#ffffff" maxlength="7" placeholder="#ffffff" />
                      </div>
                    </div>
                  </div>
                </div>

                <div class="modal-canvas-panel__actions" data-ref="custom-pixel-actions">
                  <div class="modal-canvas-panel__actions-row" data-ref="custom-pixel-actions-row">
                    <div></div>
                    <button type="button" class="component-button component-button--h44 component-button--black" data-ref="btn-submit-custom-pixel">
                      <span>Crear lienzo</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div class="banner banner--danger" data-ref="create-canvas-error" style="display: none; margin-top: 14px;"></div>
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

  const categoryTitles: Record<string, string> = {
    board: 'Pizarrón Infinito',
    diagram: 'Diagramas y Esquemas',
    doc: 'Documento Doc',
    pixel: 'Pixel Art',
    template: templateName ? `Plantilla: ${templateName}` : 'Plantilla',
  };

  const navItems = backdrop.querySelectorAll<HTMLElement>('[data-category]');
  const panels = backdrop.querySelectorAll<HTMLElement>('[data-ref^="panel-category-"]');
  const bodyTitle = backdrop.querySelector<HTMLElement>('[data-ref="modal-body-title"]');
  const errorBanner = backdrop.querySelector<HTMLElement>('[data-ref="create-canvas-error"]');
  const btnClose = backdrop.querySelector<HTMLElement>('[data-ref="btn-modal-close"]');

  const panelPixelCustomForm = backdrop.querySelector<HTMLElement>('[data-ref="panel-pixel-custom-form"]');
  const panelCategoryPixel = backdrop.querySelector<HTMLElement>('[data-ref="panel-category-pixel"]');
  const btnTriggerCustomSize = backdrop.querySelector<HTMLElement>('[data-ref="btn-trigger-custom-size"]');
  const btnBackToPixelPresets = backdrop.querySelector<HTMLElement>('[data-ref="btn-back-to-pixel-presets"]');

  const switchCategory = (category: 'board' | 'diagram' | 'doc' | 'pixel' | 'template') => {
    activeCategory = category;
    navItems.forEach((item) => {
      item.classList.toggle('is-active', item.getAttribute('data-category') === category);
    });

    panels.forEach((p) => {
      p.style.display = 'none';
    });
    if (panelPixelCustomForm) {
      panelPixelCustomForm.style.display = 'none';
    }

    const activePanel = backdrop.querySelector<HTMLElement>(`[data-ref="panel-category-${category}"]`);
    if (activePanel) {
      activePanel.style.display = 'block';
    }

    if (bodyTitle && categoryTitles[category]) {
      bodyTitle.textContent = categoryTitles[category];
    }
    if (errorBanner) {
      errorBanner.style.display = 'none';
    }
  };

  if (bodyTitle && categoryTitles[activeCategory]) {
    bodyTitle.textContent = categoryTitles[activeCategory];
  }

  navItems.forEach((item) => {
    item.addEventListener('click', () => {
      const cat = item.getAttribute('data-category') as 'board' | 'diagram' | 'doc' | 'pixel' | 'template';
      if (cat) {
        switchCategory(cat);
      }
    });
  });

  const categoryPills = backdrop.querySelectorAll<HTMLElement>('[data-ref^="btn-diag-cat-"]');
  const diagramCards = backdrop.querySelectorAll<HTMLElement>('[data-ref^="card-diagram-"]');

  categoryPills.forEach((pill) => {
    pill.addEventListener('click', () => {
      const cat = pill.getAttribute('data-category') as DiagramCategory;
      categoryPills.forEach((p) => p.classList.remove('is-active'));
      pill.classList.add('is-active');

      diagramCards.forEach((card) => {
        const cardCat = card.getAttribute('data-category') as DiagramCategory;
        if (cat === 'all' || cardCat === cat) {
          card.style.display = 'flex';
        } else {
          card.style.display = 'none';
        }
      });
    });
  });

  const handleInstantCreation = async (optionsToCreate: CreateCanvasOptions, triggerButton?: HTMLElement | null) => {
    if (isCreating) return;
    isCreating = true;

    if (errorBanner) {
      errorBanner.style.display = 'none';
    }
    if (triggerButton) {
      triggerButton.classList.add('is-loading');
    }

    try {
      await createAndOpenCanvas({
        ...optionsToCreate,
        effectiveTier: options?.teamUuid ? 'business' : null,
        teamUuid: options?.teamUuid || null,
      });
      closeModal();
    } catch (err: unknown) {
      isCreating = false;
      if (triggerButton) {
        triggerButton.classList.remove('is-loading');
      }
      const msg = err instanceof Error ? err.message : t('canvas.error_save');
      if (errorBanner) {
        errorBanner.textContent = msg;
        errorBanner.style.display = 'block';
      }
    }
  };

  const boardCards = backdrop.querySelectorAll<HTMLElement>('[data-ref^="card-board-"]');
  boardCards.forEach((card) => {
    card.addEventListener('click', () => {
      void handleInstantCreation({
        bgType: 'dots',
        canvasType: 'board',
        name: 'Pizarrón sin título',
        solidColor: '#ffffff',
      }, card);
    });
  });

  diagramCards.forEach((card) => {
    card.addEventListener('click', () => {
      const subtype = (card.getAttribute('data-subtype') as DiagramSubtype) || 'mindmap';
      const subtypeInfo = DIAGRAM_SUBTYPES.find((s) => s.id === subtype);
      void handleInstantCreation({
        bgType: 'dots',
        canvasType: 'diagram',
        diagramSubtype: subtype,
        mindmapLineStyle: 'curved',
        name: subtypeInfo?.name ? `${subtypeInfo.name} sin título` : 'Mapa Mental sin título',
        rootIdeaText: subtypeInfo?.name || 'Idea Principal',
        solidColor: '#ffffff',
      }, card);
    });
  });

  const docCards = backdrop.querySelectorAll<HTMLElement>('[data-ref^="card-doc-"]');
  docCards.forEach((card) => {
    card.addEventListener('click', () => {
      const paper = (card.getAttribute('data-paper') as DocPaperSize) || 'letter';
      const templateId = card.getAttribute('data-template') || 'blank';
      const name = `Documento ${paper.toUpperCase()}`;
      void handleInstantCreation({
        canvasType: 'doc',
        docOrientation: 'portrait',
        docPaperSize: paper,
        docTemplateId: templateId,
        name,
      }, card);
    });
  });

  const pixelPresetCards = backdrop.querySelectorAll<HTMLElement>('[data-ref^="card-pixel-"]');
  pixelPresetCards.forEach((card) => {
    card.addEventListener('click', () => {
      const type = card.getAttribute('data-type');
      if (type === 'pixel-infinite') {
        void handleInstantCreation({
          bgType: 'dots',
          canvasType: 'board',
          name: 'Pizarrón con Pixel Art',
          pixelGrid: { backgroundColor: 'transparent', gridHeight: 64, gridWidth: 64, pixelSize: 16 },
        }, card);
      } else if (type === 'pixel-fixed') {
        const w = parseInt(card.getAttribute('data-w') || '64', 10);
        const h = parseInt(card.getAttribute('data-h') || '64', 10);
        void handleInstantCreation({
          bgType: 'dots',
          canvasType: 'board',
          height: h,
          name: `Pizarrón Pixel ${w}×${h}`,
          pixelGrid: { backgroundColor: 'transparent', gridHeight: h, gridWidth: w, pixelSize: 16 },
          width: w,
        }, card);
      }
    });
  });

  const templateVariantCards = backdrop.querySelectorAll<HTMLElement>('[data-ref^="card-template-"]');
  templateVariantCards.forEach((card) => {
    card.addEventListener('click', () => {
      const w = parseInt(card.getAttribute('data-w') || '64', 10);
      const h = parseInt(card.getAttribute('data-h') || '64', 10);
      const img = card.getAttribute('data-img') || templateImage || null;
      void handleInstantCreation({
        bgType: 'dots',
        canvasType: 'board',
        height: h,
        name: templateName || `Pizarrón ${w}×${h}`,
        pixelGrid: { backgroundColor: 'transparent', gridHeight: h, gridWidth: w, pixelSize: 16 },
        templateImage: img,
        width: w,
      }, card);
    });
  });

  btnTriggerCustomSize?.addEventListener('click', () => {
    if (panelCategoryPixel) panelCategoryPixel.style.display = 'none';
    if (panelPixelCustomForm) panelPixelCustomForm.style.display = 'block';
    if (bodyTitle) bodyTitle.textContent = 'Pixel Art personalizado';
    if (errorBanner) errorBanner.style.display = 'none';
  });

  btnBackToPixelPresets?.addEventListener('click', () => {
    if (panelPixelCustomForm) panelPixelCustomForm.style.display = 'none';
    if (panelCategoryPixel) panelCategoryPixel.style.display = 'block';
    if (bodyTitle) bodyTitle.textContent = 'Pixel Art';
    if (errorBanner) errorBanner.style.display = 'none';
  });

  const inputCustomName = backdrop.querySelector<HTMLInputElement>('[data-ref="input-custom-name"]');
  const inputCustomWidth = backdrop.querySelector<HTMLInputElement>('[data-ref="input-custom-width"]');
  const inputCustomHeight = backdrop.querySelector<HTMLInputElement>('[data-ref="input-custom-height"]');
  const btnCustomWDecLarge = backdrop.querySelector<HTMLElement>('[data-ref="btn-custom-w-dec-large"]');
  const btnCustomWDec = backdrop.querySelector<HTMLElement>('[data-ref="btn-custom-w-dec"]');
  const btnCustomWInc = backdrop.querySelector<HTMLElement>('[data-ref="btn-custom-w-inc"]');
  const btnCustomWIncLarge = backdrop.querySelector<HTMLElement>('[data-ref="btn-custom-w-inc-large"]');
  const btnCustomHDecLarge = backdrop.querySelector<HTMLElement>('[data-ref="btn-custom-h-dec-large"]');
  const btnCustomHDec = backdrop.querySelector<HTMLElement>('[data-ref="btn-custom-h-dec"]');
  const btnCustomHInc = backdrop.querySelector<HTMLElement>('[data-ref="btn-custom-h-inc"]');
  const btnCustomHIncLarge = backdrop.querySelector<HTMLElement>('[data-ref="btn-custom-h-inc-large"]');
  const customPresetChips = backdrop.querySelectorAll<HTMLElement>('[data-ref^="btn-custom-chip-"]');
  const btnSubmitCustomPixel = backdrop.querySelector<HTMLButtonElement>('[data-ref="btn-submit-custom-pixel"]');

  const setupStepper = (
    inputEl: HTMLInputElement | null,
    btnDecL: HTMLElement | null,
    btnDecS: HTMLElement | null,
    btnIncS: HTMLElement | null,
    btnIncL: HTMLElement | null
  ) => {
    if (!inputEl) return;
    const adjust = (delta: number) => {
      const val = parseInt(inputEl.value, 10) || 64;
      const next = Math.max(1, Math.min(16384, val + delta));
      inputEl.value = String(next);
      inputEl.dispatchEvent(new Event('input', { bubbles: true }));
      updateChips();
    };

    btnDecL?.addEventListener('click', () => adjust(-16));
    btnDecS?.addEventListener('click', () => adjust(-1));
    btnIncS?.addEventListener('click', () => adjust(1));
    btnIncL?.addEventListener('click', () => adjust(16));

    inputEl.addEventListener('change', () => {
      let val = parseInt(inputEl.value, 10);
      if (isNaN(val) || val < 1) val = 1;
      if (val > 16384) val = 16384;
      inputEl.value = String(val);
      updateChips();
    });
  };

  const updateChips = () => {
    const curW = parseInt(inputCustomWidth?.value || '0', 10);
    const curH = parseInt(inputCustomHeight?.value || '0', 10);
    customPresetChips.forEach((chip) => {
      const cw = parseInt(chip.getAttribute('data-w') || '0', 10);
      const ch = parseInt(chip.getAttribute('data-h') || '0', 10);
      chip.classList.toggle('is-active', cw === curW && ch === curH);
    });
  };

  setupStepper(inputCustomWidth, btnCustomWDecLarge, btnCustomWDec, btnCustomWInc, btnCustomWIncLarge);
  setupStepper(inputCustomHeight, btnCustomHDecLarge, btnCustomHDec, btnCustomHInc, btnCustomHIncLarge);

  customPresetChips.forEach((chip) => {
    chip.addEventListener('click', () => {
      const w = chip.getAttribute('data-w');
      const h = chip.getAttribute('data-h');
      if (w && inputCustomWidth) {
        inputCustomWidth.value = w;
      }
      if (h && inputCustomHeight) {
        inputCustomHeight.value = h;
      }
      updateChips();
    });
  });

  const btnCustomBgTrans = backdrop.querySelector<HTMLElement>('[data-ref="btn-custom-bg-trans"]');
  const btnCustomBgSolid = backdrop.querySelector<HTMLElement>('[data-ref="btn-custom-bg-solid"]');
  const groupCustomBgCheck = backdrop.querySelector<HTMLElement>('[data-ref="group-custom-bg-check"]');
  const groupCustomBgColor = backdrop.querySelector<HTMLElement>('[data-ref="group-custom-bg-color"]');
  const customCheckPills = backdrop.querySelectorAll<HTMLElement>('[data-ref^="btn-custom-check-"]');
  const customColorPills = backdrop.querySelectorAll<HTMLElement>('[data-ref^="btn-custom-color-"]');
  const customColorRow = backdrop.querySelector<HTMLElement>('[data-ref="custom-color-row"]');
  const inputCustomBgColor = backdrop.querySelector<HTMLInputElement>('[data-ref="input-custom-bg-color"]');
  const inputCustomBgColorHex = backdrop.querySelector<HTMLInputElement>('[data-ref="input-custom-bg-color-hex"]');

  btnCustomBgTrans?.addEventListener('click', () => {
    selectedBgType = 'transparent';
    btnCustomBgTrans.classList.add('is-active');
    btnCustomBgSolid?.classList.remove('is-active');
    if (groupCustomBgCheck) groupCustomBgCheck.style.display = '';
    if (groupCustomBgColor) groupCustomBgColor.style.display = 'none';
  });

  btnCustomBgSolid?.addEventListener('click', () => {
    selectedBgType = 'solid';
    btnCustomBgSolid.classList.add('is-active');
    btnCustomBgTrans?.classList.remove('is-active');
    if (groupCustomBgCheck) groupCustomBgCheck.style.display = 'none';
    if (groupCustomBgColor) groupCustomBgColor.style.display = '';
  });

  customCheckPills.forEach((pill) => {
    pill.addEventListener('click', () => {
      customCheckPills.forEach((p) => p.classList.remove('is-active'));
      pill.classList.add('is-active');
      selectedCheckSize = parseInt(pill.getAttribute('data-size') || '16', 10);
    });
  });

  customColorPills.forEach((pill) => {
    pill.addEventListener('click', () => {
      customColorPills.forEach((p) => p.classList.remove('is-active'));
      pill.classList.add('is-active');
      const c = pill.getAttribute('data-color');
      if (c === 'custom') {
        if (customColorRow) customColorRow.style.display = 'flex';
        selectedSolidColor = inputCustomBgColorHex?.value || inputCustomBgColor?.value || '#ffffff';
      } else {
        if (customColorRow) customColorRow.style.display = 'none';
        selectedSolidColor = c || '#ffffff';
      }
    });
  });

  inputCustomBgColor?.addEventListener('input', () => {
    selectedSolidColor = inputCustomBgColor.value;
    if (inputCustomBgColorHex) inputCustomBgColorHex.value = inputCustomBgColor.value;
  });

  inputCustomBgColorHex?.addEventListener('input', () => {
    let hex = inputCustomBgColorHex.value.trim();
    if (!hex.startsWith('#')) hex = '#' + hex;
    if (/^#[0-9A-Fa-f]{6}$/.test(hex)) {
      selectedSolidColor = hex;
      if (inputCustomBgColor) inputCustomBgColor.value = hex;
    }
  });

  btnSubmitCustomPixel?.addEventListener('click', () => {
    const w = parseInt(inputCustomWidth?.value || '64', 10);
    const h = parseInt(inputCustomHeight?.value || '64', 10);

    if (isNaN(w) || w <= 0 || isNaN(h) || h <= 0) {
      if (errorBanner) {
        errorBanner.textContent = 'Las dimensiones deben ser mayores a 0.';
        errorBanner.style.display = 'block';
      }
      return;
    }

    if (w > 16384 || h > 16384) {
      if (errorBanner) {
        errorBanner.textContent = 'Las dimensiones no pueden superar los 16384 píxeles.';
        errorBanner.style.display = 'block';
      }
      return;
    }

    const name = inputCustomName?.value.trim() || `Lienzo ${w}x${h}`;
    void handleInstantCreation({
      bgType: 'dots',
      canvasType: 'board',
      height: h,
      name,
      pixelGrid: { backgroundColor: selectedBgType === 'solid' ? selectedSolidColor : 'transparent', gridHeight: h, gridWidth: w, pixelSize: selectedCheckSize },
      solidColor: selectedSolidColor,
      templateImage,
      width: w,
    }, btnSubmitCustomPixel);
  });

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      closeModal();
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
}

