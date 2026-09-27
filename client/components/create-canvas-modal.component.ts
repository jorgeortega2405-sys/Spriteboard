import { PresetVariant } from '../config/templates.config.js';
import { escapeHtml, uploadFilesApi } from '../services/api.service.js';
import { createAndOpenCanvas, CreateCanvasOptions } from '../services/canvas-creator.service.js';
import { t, translateElement } from '../services/i18n.service.js';
import { renderIcons } from '../services/icon.service.js';
import { showToast } from '../services/toast.service.js';
import { DocOrientation, DocPaperSize } from '../views/doc/doc.types.js';
import { getBoardSvg, getCategoryMenuSvg, getDocSvg, getPresentationSvg, getSheetSvg, getSocialSvg, getTemplateVariantSvg, getVideoSvg } from './create-canvas-graphics.js';

let activeCreateCanvasModal: { close: () => void } | null = null;

export interface OpenCreateCanvasModalOptions {
  boardTemplateId?: string;
  docOrientation?: DocOrientation;
  docPaperSize?: DocPaperSize;
  docTemplateId?: string;
  height?: number;
  initialType?: 'board' | 'custom-size' | 'doc' | 'presentation' | 'sheet' | 'social' | 'upload' | 'video';
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

  const templateVariants = options?.variants && options.variants.length > 0 ? options.variants : null;
  const templateName = options?.templateName || null;
  const templateImage = options?.templateImage || null;
  const normalizedInitialType = options?.initialType || 'board';
  let activeCategory: 'board' | 'custom-size' | 'doc' | 'presentation' | 'sheet' | 'social' | 'template' | 'upload' | 'video' = templateVariants ? 'template' : normalizedInitialType;
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
                ${getCategoryMenuSvg('template')}
                <span class="menu-item__text">Plantilla</span>
              </button>
              ` : ''}
              <button type="button" class="menu-item${activeCategory === 'board' ? ' is-active' : ''}" data-ref="tab-category-board" data-category="board">
                ${getCategoryMenuSvg('board')}
                <span class="menu-item__text">Pizarrón Infinito</span>
              </button>
              <button type="button" class="menu-item${activeCategory === 'sheet' ? ' is-active' : ''}" data-ref="tab-category-sheet" data-category="sheet">
                ${getCategoryMenuSvg('sheet')}
                <span class="menu-item__text">Hoja de Cálculo</span>
              </button>
              <button type="button" class="menu-item${activeCategory === 'presentation' ? ' is-active' : ''}" data-ref="tab-category-presentation" data-category="presentation">
                ${getCategoryMenuSvg('presentation')}
                <span class="menu-item__text">Presentación</span>
              </button>
              <button type="button" class="menu-item${activeCategory === 'social' ? ' is-active' : ''}" data-ref="tab-category-social" data-category="social">
                ${getCategoryMenuSvg('social')}
                <span class="menu-item__text">Redes Sociales</span>
              </button>
              <button type="button" class="menu-item${activeCategory === 'video' ? ' is-active' : ''}" data-ref="tab-category-video" data-category="video">
                ${getCategoryMenuSvg('video')}
                <span class="menu-item__text">Video</span>
              </button>
              <button type="button" class="menu-item${activeCategory === 'doc' ? ' is-active' : ''}" data-ref="tab-category-doc" data-category="doc">
                ${getCategoryMenuSvg('doc')}
                <span class="menu-item__text">Documento Doc</span>
              </button>
              <button type="button" class="menu-item${activeCategory === 'custom-size' ? ' is-active' : ''}" data-ref="tab-category-custom-size" data-category="custom-size">
                ${getCategoryMenuSvg('custom-size')}
                <span class="menu-item__text">Elegir tamaño</span>
              </button>
              <button type="button" class="menu-item${activeCategory === 'upload' ? ' is-active' : ''}" data-ref="tab-category-upload" data-category="upload">
                ${getCategoryMenuSvg('upload')}
                <span class="menu-item__text">Subir</span>
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

            <div class="modal-canvas-panel" data-ref="panel-category-custom-size" style="${activeCategory === 'custom-size' ? '' : 'display: none;'}">
              <div class="custom-size-container" data-ref="custom-size-container" style="max-width: 560px;">
                <h3 class="creation-category-section__title" style="margin-bottom: 8px;">Crea un lienzo con dimensiones a tu medida</h3>
                <p style="font-size: 13px; color: var(--text-secondary); margin-bottom: 24px;">Especifica el ancho y alto deseados para tu espacio de trabajo en formato libre.</p>

                <div class="custom-size-form-grid" style="display: grid; grid-template-columns: 1fr 1fr 120px; gap: 16px; align-items: flex-end; margin-bottom: 24px;">
                  <label class="field" data-ref="field-custom-w">
                    <span class="field__label">Ancho</span>
                    <input class="field__input" data-ref="input-custom-w" type="number" min="10" max="10000" step="any" value="1920" placeholder="1920" />
                  </label>

                  <label class="field" data-ref="field-custom-h">
                    <span class="field__label">Alto</span>
                    <input class="field__input" data-ref="input-custom-h" type="number" min="10" max="10000" step="any" value="1080" placeholder="1080" />
                  </label>

                  <label class="field" data-ref="field-custom-unit">
                    <span class="field__label">Unidad</span>
                    <select class="field__input field__select" data-ref="select-custom-unit" style="height: 48px; cursor: pointer;">
                      <option value="px" selected>px</option>
                      <option value="in">in</option>
                      <option value="mm">mm</option>
                      <option value="cm">cm</option>
                    </select>
                  </label>
                </div>

                <div class="custom-size-actions" style="display: flex; gap: 12px; align-items: center;">
                  <button type="button" class="component-button component-button--h48 component-button--primary" data-ref="btn-submit-custom-size" style="padding: 0 28px;">
                    <span class="material-symbols-rounded" style="font-size: 20px; margin-right: 6px;">add</span>
                    <span>Crear nuevo diseño</span>
                  </button>
                </div>

                <div class="custom-size-presets-row" style="margin-top: 36px;">
                  <h4 style="font-size: 13px; font-weight: 600; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 12px;">Tamaños sugeridos</h4>
                  <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                    <button type="button" class="component-badge component-badge--interactive" data-ref="preset-size-square" data-w="1080" data-h="1080" data-unit="px">
                      <span class="component-badge__text">Cuadrado (1080 × 1080 px)</span>
                    </button>
                    <button type="button" class="component-badge component-badge--interactive" data-ref="preset-size-fhd" data-w="1920" data-h="1080" data-unit="px">
                      <span class="component-badge__text">Full HD (1920 × 1080 px)</span>
                    </button>
                    <button type="button" class="component-badge component-badge--interactive" data-ref="preset-size-story" data-w="1080" data-h="1920" data-unit="px">
                      <span class="component-badge__text">Historia / Vertical (1080 × 1920 px)</span>
                    </button>
                    <button type="button" class="component-badge component-badge--interactive" data-ref="preset-size-a4" data-w="21" data-h="29.7" data-unit="cm">
                      <span class="component-badge__text">A4 (21 × 29.7 cm)</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

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

            <div class="modal-canvas-panel" data-ref="panel-category-sheet" style="${activeCategory === 'sheet' ? '' : 'display: none;'}">
              <div class="creation-cards-grid" data-ref="grid-sheets">
                <button type="button" class="creation-card" data-ref="card-sheet-blank" data-type="sheet">
                  <div class="creation-card__thumbnail" data-ref="thumb-sheet-blank">
                    <div class="creation-card__svg-wrapper" data-ref="svg-sheet-blank">
                      ${getSheetSvg()}
                    </div>
                    <span class="creation-card__badge creation-card__badge--popular" data-ref="badge-sheet-blank">Estándar</span>
                  </div>
                  <div class="creation-card__info" data-ref="info-sheet-blank">
                    <h4 class="creation-card__title" data-ref="title-sheet-blank">Hoja de cálculo en blanco</h4>
                    <p class="creation-card__meta" data-ref="meta-sheet-blank">Grid de celdas • Fórmulas y gráficos</p>
                  </div>
                </button>
              </div>
            </div>

            <div class="modal-canvas-panel" data-ref="panel-category-presentation" style="${activeCategory === 'presentation' ? '' : 'display: none;'}">
              <div class="creation-cards-grid" data-ref="grid-presentation-cards">
                <button type="button" class="creation-card" data-ref="card-pres-16-9" data-type="presentation" data-paper="presentation_16_9" data-orientation="landscape">
                  <div class="creation-card__thumbnail" data-ref="thumb-pres-16-9">
                    <div class="creation-card__svg-wrapper" data-ref="svg-pres-16-9">
                      ${getPresentationSvg('16_9')}
                    </div>
                    <span class="creation-card__badge creation-card__badge--popular" data-ref="badge-pres-16-9">Estándar</span>
                  </div>
                  <div class="creation-card__info" data-ref="info-pres-16-9">
                    <h4 class="creation-card__title" data-ref="title-pres-16-9">Presentación 16:9</h4>
                    <p class="creation-card__meta" data-ref="meta-pres-16-9">1920 × 1080 px • Panorámica estándar</p>
                  </div>
                </button>
              </div>
            </div>

            <div class="modal-canvas-panel" data-ref="panel-category-video" style="${activeCategory === 'video' ? '' : 'display: none;'}">
              <div class="creation-cards-grid" data-ref="grid-videos">
                <button type="button" class="creation-card" data-ref="card-video-youtube" data-type="video" data-preset-id="youtube" data-w="1920" data-h="1080" data-format="16_9">
                  <div class="creation-card__thumbnail" data-ref="thumb-video-youtube">
                    <div class="creation-card__svg-wrapper" data-ref="svg-video-youtube">
                      ${getVideoSvg('16_9')}
                    </div>
                    <span class="creation-card__badge creation-card__badge--popular" data-ref="badge-video-youtube">16:9 Estándar</span>
                  </div>
                  <div class="creation-card__info" data-ref="info-video-youtube">
                    <h4 class="creation-card__title" data-ref="title-video-youtube">Video de YouTube</h4>
                    <p class="creation-card__meta" data-ref="meta-video-youtube">1920 × 1080 px • YouTube horizontal</p>
                  </div>
                </button>

                <button type="button" class="creation-card" data-ref="card-video-horizontal" data-type="video" data-preset-id="horizontal" data-w="1920" data-h="1080" data-format="16_9">
                  <div class="creation-card__thumbnail" data-ref="thumb-video-horizontal">
                    <div class="creation-card__svg-wrapper" data-ref="svg-video-horizontal">
                      ${getVideoSvg('16_9')}
                    </div>
                    <span class="creation-card__badge" data-ref="badge-video-horizontal">16:9 Panorámico</span>
                  </div>
                  <div class="creation-card__info" data-ref="info-video-horizontal">
                    <h4 class="creation-card__title" data-ref="title-video-horizontal">Video horizontal</h4>
                    <p class="creation-card__meta" data-ref="meta-video-horizontal">1920 × 1080 px • Pantallas estándar</p>
                  </div>
                </button>

                <button type="button" class="creation-card" data-ref="card-video-mobile" data-type="video" data-preset-id="mobile" data-w="1080" data-h="1920" data-format="9_16">
                  <div class="creation-card__thumbnail" data-ref="thumb-video-mobile">
                    <div class="creation-card__svg-wrapper" data-ref="svg-video-mobile">
                      ${getVideoSvg('9_16')}
                    </div>
                    <span class="creation-card__badge" data-ref="badge-video-mobile">9:16 Vertical</span>
                  </div>
                  <div class="creation-card__info" data-ref="info-video-mobile">
                    <h4 class="creation-card__title" data-ref="title-video-mobile">Video para dispositivos móviles</h4>
                    <p class="creation-card__meta" data-ref="meta-video-mobile">1080 × 1920 px • Móviles y pantallas verticales</p>
                  </div>
                </button>

                <button type="button" class="creation-card" data-ref="card-video-tiktok" data-type="video" data-preset-id="tiktok" data-w="1080" data-h="1920" data-format="9_16">
                  <div class="creation-card__thumbnail" data-ref="thumb-video-tiktok">
                    <div class="creation-card__svg-wrapper" data-ref="svg-video-tiktok">
                      ${getVideoSvg('9_16')}
                    </div>
                    <span class="creation-card__badge creation-card__badge--popular" data-ref="badge-video-tiktok">Popular</span>
                  </div>
                  <div class="creation-card__info" data-ref="info-video-tiktok">
                    <h4 class="creation-card__title" data-ref="title-video-tiktok">Video para TikTok</h4>
                    <p class="creation-card__meta" data-ref="meta-video-tiktok">1080 × 1920 px • TikTok Feed</p>
                  </div>
                </button>

                <button type="button" class="creation-card" data-ref="card-video-youtube-shorts" data-type="video" data-preset-id="youtube-shorts" data-w="1080" data-h="1920" data-format="9_16">
                  <div class="creation-card__thumbnail" data-ref="thumb-video-youtube-shorts">
                    <div class="creation-card__svg-wrapper" data-ref="svg-video-youtube-shorts">
                      ${getVideoSvg('9_16')}
                    </div>
                    <span class="creation-card__badge" data-ref="badge-video-youtube-shorts">Shorts</span>
                  </div>
                  <div class="creation-card__info" data-ref="info-video-youtube-shorts">
                    <h4 class="creation-card__title" data-ref="title-video-youtube-shorts">Corto para YouTube</h4>
                    <p class="creation-card__meta" data-ref="meta-video-youtube-shorts">1080 × 1920 px • YouTube Shorts</p>
                  </div>
                </button>

                <button type="button" class="creation-card" data-ref="card-video-facebook" data-type="video" data-preset-id="facebook" data-w="1080" data-h="1080" data-format="1_1">
                  <div class="creation-card__thumbnail" data-ref="thumb-video-facebook">
                    <div class="creation-card__svg-wrapper" data-ref="svg-video-facebook">
                      ${getVideoSvg('1_1')}
                    </div>
                    <span class="creation-card__badge" data-ref="badge-video-facebook">1:1 HD</span>
                  </div>
                  <div class="creation-card__info" data-ref="info-video-facebook">
                    <h4 class="creation-card__title" data-ref="title-video-facebook">Video para Facebook</h4>
                    <p class="creation-card__meta" data-ref="meta-video-facebook">1080 × 1080 px • Feed y publicaciones</p>
                  </div>
                </button>

                <button type="button" class="creation-card" data-ref="card-video-instagram-reels" data-type="video" data-preset-id="instagram-reels" data-w="1080" data-h="1920" data-format="9_16">
                  <div class="creation-card__thumbnail" data-ref="thumb-video-instagram-reels">
                    <div class="creation-card__svg-wrapper" data-ref="svg-video-instagram-reels">
                      ${getVideoSvg('9_16')}
                    </div>
                    <span class="creation-card__badge" data-ref="badge-video-instagram-reels">Reels</span>
                  </div>
                  <div class="creation-card__info" data-ref="info-video-instagram-reels">
                    <h4 class="creation-card__title" data-ref="title-video-instagram-reels">Reel de Instagram</h4>
                    <p class="creation-card__meta" data-ref="meta-video-instagram-reels">1080 × 1920 px • Instagram Reels</p>
                  </div>
                </button>

                <button type="button" class="creation-card" data-ref="card-video-square-800" data-type="video" data-preset-id="square-800" data-w="800" data-h="800" data-format="1_1">
                  <div class="creation-card__thumbnail" data-ref="thumb-video-square-800">
                    <div class="creation-card__svg-wrapper" data-ref="svg-video-square-800">
                      ${getVideoSvg('1_1')}
                    </div>
                    <span class="creation-card__badge" data-ref="badge-video-square-800">800×800 px</span>
                  </div>
                  <div class="creation-card__info" data-ref="info-video-square-800">
                    <h4 class="creation-card__title" data-ref="title-video-square-800">Video cuadrado</h4>
                    <p class="creation-card__meta" data-ref="meta-video-square-800">800 × 800 px • Formato ligero</p>
                  </div>
                </button>
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

            <div class="modal-canvas-panel" data-ref="panel-category-social" style="${activeCategory === 'social' ? '' : 'display: none;'}">
              <div class="creation-category-section" data-ref="section-social-platforms">
                <div class="component-tags-carousel" data-ref="social-platforms-carousel" style="margin-bottom: 20px; overflow-x: auto; padding-bottom: 4px; display: flex; gap: 8px;">
                  <button type="button" class="component-badge component-badge--interactive is-active" data-ref="badge-platform-facebook" data-platform="facebook">
                    <span class="component-badge__text">Facebook</span>
                  </button>
                  <button type="button" class="component-badge component-badge--interactive" data-ref="badge-platform-instagram" data-platform="instagram">
                    <span class="component-badge__text">Instagram</span>
                  </button>
                  <button type="button" class="component-badge component-badge--interactive" data-ref="badge-platform-linkedin" data-platform="linkedin">
                    <span class="component-badge__text">LinkedIn</span>
                  </button>
                  <button type="button" class="component-badge component-badge--interactive" data-ref="badge-platform-pinterest" data-platform="pinterest">
                    <span class="component-badge__text">Pinterest</span>
                  </button>
                  <button type="button" class="component-badge component-badge--interactive" data-ref="badge-platform-tiktok" data-platform="tiktok">
                    <span class="component-badge__text">TikTok</span>
                  </button>
                  <button type="button" class="component-badge component-badge--interactive" data-ref="badge-platform-x" data-platform="x">
                    <span class="component-badge__text">X (Twitter)</span>
                  </button>
                  <button type="button" class="component-badge component-badge--interactive" data-ref="badge-platform-whatsapp" data-platform="whatsapp">
                    <span class="component-badge__text">WhatsApp</span>
                  </button>
                  <button type="button" class="component-badge component-badge--interactive" data-ref="badge-platform-youtube" data-platform="youtube">
                    <span class="component-badge__text">YouTube</span>
                  </button>
                </div>
              </div>

              <div class="creation-category-section" data-ref="platform-content-facebook">
                <h3 class="creation-category-section__title">Formatos para Facebook</h3>
                <div class="creation-cards-grid" data-ref="grid-social-facebook">
                  <button type="button" class="creation-card" data-ref="card-social-fb-post" data-type="social" data-w="940" data-h="788" data-format="facebook_post">
                    <div class="creation-card__thumbnail" data-ref="thumb-social-fb-post">
                      <div class="creation-card__svg-wrapper" data-ref="svg-social-fb-post">
                        ${getSocialSvg('facebook_post')}
                      </div>
                      <span class="creation-card__badge creation-card__badge--popular" data-ref="badge-social-fb-post">Popular</span>
                    </div>
                    <div class="creation-card__info" data-ref="info-social-fb-post">
                      <h4 class="creation-card__title" data-ref="title-social-fb-post">Post para Facebook</h4>
                      <p class="creation-card__meta" data-ref="meta-social-fb-post">940 × 788 px • Formato estándar para publicaciones</p>
                    </div>
                  </button>

                  <button type="button" class="creation-card" data-ref="card-social-fb-cover" data-type="social" data-w="851" data-h="315" data-format="facebook_cover">
                    <div class="creation-card__thumbnail" data-ref="thumb-social-fb-cover">
                      <div class="creation-card__svg-wrapper" data-ref="svg-social-fb-cover">
                        ${getSocialSvg('facebook_cover')}
                      </div>
                      <span class="creation-card__badge" data-ref="badge-social-fb-cover">Horizontal</span>
                    </div>
                    <div class="creation-card__info" data-ref="info-social-fb-cover">
                      <h4 class="creation-card__title" data-ref="title-social-fb-cover">Portada para Facebook</h4>
                      <p class="creation-card__meta" data-ref="meta-social-fb-cover">851 × 315 px • Portada horizontal para páginas y perfiles</p>
                    </div>
                  </button>
                </div>
              </div>

              <div class="creation-category-section" data-ref="platform-content-other" style="display: none;">
                <div class="empty-state" data-ref="empty-state-platform" style="padding: 48px 16px; text-align: center;">
                  <p class="empty-state__description" data-ref="empty-state-platform-text" style="color: var(--text-secondary); font-size: 14px;">Formatos disponibles próximamente.</p>
                </div>
              </div>
            </div>

            <div class="modal-canvas-panel" data-ref="panel-category-upload" style="${activeCategory === 'upload' ? '' : 'display: none;'}">
              <div class="modal-upload-container" data-ref="modal-upload-container">
                <input class="modal-upload-file-input" data-ref="modal-upload-file-input" type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp,image/gif,image/avif,video/mp4,video/webm,video/quicktime,video/x-m4v,video/ogg" multiple style="display: none;" />

                <div class="modal-upload-dropzone" data-ref="modal-upload-dropzone">
                  <div class="modal-upload-dropzone__icon-box">
                    <svg class="component-icon" style="width: 32px; height: 32px;" aria-hidden="true"><use href="/icons.svg#cloud_upload"></use></svg>
                  </div>
                  <h4 class="modal-upload-dropzone__title">Arrastra y suelta tus archivos aquí</h4>
                  <p class="modal-upload-dropzone__subtitle">o haz clic en el botón para explorar desde tu dispositivo</p>
                  <button type="button" class="component-button component-button--h44 component-button--primary" data-ref="btn-trigger-file-upload">
                    <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#cloud_upload"></use></svg>
                    <span>Subir archivos</span>
                  </button>
                </div>

                <div class="modal-upload-status" data-ref="modal-upload-status" style="margin-top: 16px; display: none;">
                  <div class="modal-upload-progress-text" data-ref="modal-upload-progress-text" style="font-size: 13px; font-weight: 600; color: var(--text-primary); margin-bottom: 8px;">Subiendo archivos...</div>
                  <div class="modal-upload-files-preview" data-ref="modal-upload-files-preview" style="display: flex; gap: 8px; flex-wrap: wrap; margin-top: 12px;"></div>
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
    'custom-size': 'Elegir tamaño',
    doc: 'Documento Doc',
    presentation: 'Presentación de Diapositivas',
    sheet: 'Hoja de Cálculo',
    social: 'Redes Sociales',
    template: templateName ? `Plantilla: ${templateName}` : 'Plantilla',
    upload: 'Subir archivos',
    video: 'Video',
  };

  const navItems = backdrop.querySelectorAll<HTMLElement>('[data-category]');
  const panels = backdrop.querySelectorAll<HTMLElement>('[data-ref^="panel-category-"]');
  const bodyTitle = backdrop.querySelector<HTMLElement>('[data-ref="modal-body-title"]');
  const errorBanner = backdrop.querySelector<HTMLElement>('[data-ref="create-canvas-error"]');
  const btnClose = backdrop.querySelector<HTMLElement>('[data-ref="btn-modal-close"]');

  const switchCategory = (category: 'board' | 'custom-size' | 'doc' | 'presentation' | 'sheet' | 'social' | 'template' | 'upload' | 'video') => {
    activeCategory = category;
    navItems.forEach((item) => {
      item.classList.toggle('is-active', item.getAttribute('data-category') === category);
    });

    panels.forEach((p) => {
      p.style.display = 'none';
    });

    const activePanel = backdrop.querySelector<HTMLElement>(`[data-ref="panel-category-${category}"]`);
    if (activePanel) {
      activePanel.style.display = 'flex';
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
      const cat = item.getAttribute('data-category') as 'board' | 'custom-size' | 'doc' | 'presentation' | 'sheet' | 'social' | 'template' | 'upload' | 'video';
      if (cat) {
        switchCategory(cat);
      }
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

  const sheetCards = backdrop.querySelectorAll<HTMLElement>('[data-ref^="card-sheet-"]');
  sheetCards.forEach((card) => {
    card.addEventListener('click', () => {
      void handleInstantCreation({
        canvasType: 'sheet',
        name: 'Hoja de cálculo sin título',
      }, card);
    });
  });

  const presCards = backdrop.querySelectorAll<HTMLElement>('[data-ref^="card-pres-"]');
  presCards.forEach((card) => {
    card.addEventListener('click', () => {
      const name = 'Presentación sin título';
      void handleInstantCreation({
        canvasType: 'presentation',
        name,
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

  const videoCards = backdrop.querySelectorAll<HTMLElement>('[data-ref^="card-video-"]');
  videoCards.forEach((card) => {
    card.addEventListener('click', () => {
      const w = parseInt(card.getAttribute('data-w') || '1920', 10);
      const h = parseInt(card.getAttribute('data-h') || '1080', 10);
      const presetId = card.getAttribute('data-preset-id') || undefined;
      const title = card.querySelector('.creation-card__title')?.textContent?.trim() || 'Video';
      const name = `${title} sin título`;
      void handleInstantCreation({
        canvasType: 'video',
        height: h,
        initialProject: presetId ? { height: h, presetId, width: w } : undefined,
        name,
        width: w,
      }, card);
    });
  });

  const platformBadges = backdrop.querySelectorAll<HTMLElement>('[data-platform]');
  const fbContent = backdrop.querySelector<HTMLElement>('[data-ref="platform-content-facebook"]');
  const otherContent = backdrop.querySelector<HTMLElement>('[data-ref="platform-content-other"]');
  const otherText = backdrop.querySelector<HTMLElement>('[data-ref="empty-state-platform-text"]');

  const platformNames: Record<string, string> = {
    facebook: 'Facebook',
    instagram: 'Instagram',
    linkedin: 'LinkedIn',
    pinterest: 'Pinterest',
    tiktok: 'TikTok',
    whatsapp: 'WhatsApp',
    x: 'X (Twitter)',
    youtube: 'YouTube',
  };

  platformBadges.forEach((badge) => {
    badge.addEventListener('click', () => {
      const platform = badge.getAttribute('data-platform') || 'facebook';
      platformBadges.forEach((b) => b.classList.remove('is-active'));
      badge.classList.add('is-active');

      if (platform === 'facebook') {
        if (fbContent) fbContent.style.display = 'block';
        if (otherContent) otherContent.style.display = 'none';
      } else {
        if (fbContent) fbContent.style.display = 'none';
        if (otherContent) {
          otherContent.style.display = 'block';
          if (otherText) {
            otherText.textContent = `Formatos para ${platformNames[platform] || platform} disponibles próximamente.`;
          }
        }
      }
    });
  });

  const socialCards = backdrop.querySelectorAll<HTMLElement>('[data-ref^="card-social-"]');
  socialCards.forEach((card) => {
    card.addEventListener('click', () => {
      const w = parseInt(card.getAttribute('data-w') || '940', 10);
      const h = parseInt(card.getAttribute('data-h') || '788', 10);
      const format = card.getAttribute('data-format') || 'facebook_post';
      const name = format === 'facebook_cover' ? 'Portada de Facebook sin título' : 'Post para Facebook sin título';
      void handleInstantCreation({
        canvasType: 'social',
        height: h,
        name,
        width: w,
      }, card);
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

  const convertToPixels = (val: number, unit: string): number => {
    if (unit === 'in') return Math.round(val * 96);
    if (unit === 'cm') return Math.round((val / 2.54) * 96);
    if (unit === 'mm') return Math.round((val / 25.4) * 96);
    return Math.round(val);
  };

  const inputCustomW = backdrop.querySelector<HTMLInputElement>('[data-ref="input-custom-w"]');
  const inputCustomH = backdrop.querySelector<HTMLInputElement>('[data-ref="input-custom-h"]');
  const selectCustomUnit = backdrop.querySelector<HTMLSelectElement>('[data-ref="select-custom-unit"]');
  const btnSubmitCustom = backdrop.querySelector<HTMLElement>('[data-ref="btn-submit-custom-size"]');

  btnSubmitCustom?.addEventListener('click', () => {
    const rawW = parseFloat(inputCustomW?.value || '1920') || 1920;
    const rawH = parseFloat(inputCustomH?.value || '1080') || 1080;
    const unit = selectCustomUnit?.value || 'px';
    const finalW = Math.max(10, Math.min(10000, convertToPixels(rawW, unit)));
    const finalH = Math.max(10, Math.min(10000, convertToPixels(rawH, unit)));
    void handleInstantCreation({
      canvasType: 'social',
      height: finalH,
      name: `Diseño ${rawW}×${rawH} ${unit}`,
      width: finalW,
    }, btnSubmitCustom);
  });

  const presetSizeBadges = backdrop.querySelectorAll<HTMLElement>('[data-ref^="preset-size-"]');
  presetSizeBadges.forEach((badge) => {
    badge.addEventListener('click', () => {
      const w = badge.getAttribute('data-w');
      const h = badge.getAttribute('data-h');
      const unit = badge.getAttribute('data-unit') || 'px';
      if (inputCustomW && w) inputCustomW.value = w;
      if (inputCustomH && h) inputCustomH.value = h;
      if (selectCustomUnit && unit) selectCustomUnit.value = unit;
    });
  });

  const uploadDropzone = backdrop.querySelector<HTMLElement>('[data-ref="modal-upload-dropzone"]');
  const uploadFileInput = backdrop.querySelector<HTMLInputElement>('[data-ref="modal-upload-file-input"]');
  const btnTriggerUpload = backdrop.querySelector<HTMLElement>('[data-ref="btn-trigger-file-upload"]');
  const uploadStatus = backdrop.querySelector<HTMLElement>('[data-ref="modal-upload-status"]');
  const uploadProgressText = backdrop.querySelector<HTMLElement>('[data-ref="modal-upload-progress-text"]');
  const uploadPreviewContainer = backdrop.querySelector<HTMLElement>('[data-ref="modal-upload-files-preview"]');

  const handleUploadFiles = async (files: File[]) => {
    if (!files || files.length === 0) return;
    if (uploadStatus) uploadStatus.style.display = 'block';
    if (uploadProgressText) uploadProgressText.textContent = `Subiendo ${files.length} archivo(s)...`;

    try {
      const res = await uploadFilesApi(files);
      if (res.success && res.uploads) {
        if (uploadProgressText) {
          uploadProgressText.textContent = `¡${res.uploads.length} archivo(s) subido(s) con éxito!`;
        }
        showToast('Archivos subidos con éxito', 'success');
        if (uploadPreviewContainer) {
          uploadPreviewContainer.innerHTML = res.uploads.map((up) => `
            <div class="modal-upload-thumb-card" title="${escapeHtml(up.original_filename)}">
              <img src="${escapeHtml(up.thumbnail_url || up.url)}" alt="${escapeHtml(up.original_filename)}" />
            </div>
          `).join('');
        }
      } else {
        if (uploadProgressText) {
          uploadProgressText.textContent = res.message || 'Error al subir los archivos.';
        }
        showToast(res.message || 'Error al subir los archivos', 'danger');
      }
    } catch {
      if (uploadProgressText) {
        uploadProgressText.textContent = 'Error de conexión al subir los archivos.';
      }
      showToast('Error de conexión al subir los archivos', 'danger');
    }
  };

  btnTriggerUpload?.addEventListener('click', (e) => {
    e.stopPropagation();
    uploadFileInput?.click();
  });

  uploadDropzone?.addEventListener('click', () => {
    uploadFileInput?.click();
  });

  uploadDropzone?.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.stopPropagation();
    uploadDropzone.classList.add('is-dragover');
  });

  uploadDropzone?.addEventListener('dragleave', (e) => {
    e.preventDefault();
    e.stopPropagation();
    uploadDropzone.classList.remove('is-dragover');
  });

  uploadDropzone?.addEventListener('drop', (e) => {
    e.preventDefault();
    e.stopPropagation();
    uploadDropzone.classList.remove('is-dragover');
    if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
      void handleUploadFiles(Array.from(e.dataTransfer.files));
    }
  });

  uploadFileInput?.addEventListener('change', () => {
    if (uploadFileInput && uploadFileInput.files && uploadFileInput.files.length > 0) {
      void handleUploadFiles(Array.from(uploadFileInput.files));
    }
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

