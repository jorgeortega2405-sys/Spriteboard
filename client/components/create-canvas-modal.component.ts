import { PresetVariant } from '../config/templates.config.js';
import { getCategoryMenuSvg, getSocialPlatformBadgeIconSvg, getTemplateVariantSvg } from '../graphics/canvas-graphics.js';
import { escapeHtml, uploadFilesApi } from '../services/api.service.js';
import { createAndOpenCanvas, CreateCanvasOptions } from '../services/canvas-creator.service.js';
import { t, translateElement } from '../services/i18n.service.js';
import { createIconSvg, renderIcons } from '../services/icon.service.js';
import { showToast } from '../services/toast.service.js';
import { setupDropdown } from '../utils/dom.util.js';
import { DocOrientation, DocPaperSize } from '../views/doc/doc.types.js';

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
                ${createIconSvg('aspect_ratio')}
                <span class="menu-item__text">Elegir tamaño</span>
              </button>
              <button type="button" class="menu-item${activeCategory === 'upload' ? ' is-active' : ''}" data-ref="tab-category-upload" data-category="upload">
                ${createIconSvg('upload')}
                <span class="menu-item__text">Subir</span>
              </button>
            </div>
          </div>
        </div>

        <div class="modal-create-canvas__body" data-ref="modal-create-canvas-body">
          <div class="modal-create-canvas__body-top" data-ref="modal-body-top">
            <div class="component-search component-search--w-full" data-ref="modal-create-canvas-search">
              <div class="component-search__icon" data-ref="modal-search-icon">
                <span class="material-symbols-rounded">search</span>
              </div>
              <div class="component-search__input-box" data-ref="modal-search-input-box">
                <input class="component-search__input" data-ref="modal-search-input" type="text" placeholder="Buscar formatos y plantillas..." maxlength="100" autocomplete="off" />
              </div>
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

                  <div class="field-group" data-ref="field-custom-unit" style="min-width: 100px;">
                    <span class="field-group__label" style="display: block; font-size: 12px; font-weight: 500; color: var(--text-secondary); margin-bottom: 4px;">Unidad</span>
                    <div class="dropdown-wrapper dropdown-wrapper--full" data-ref="dropdown-wrapper-custom-unit">
                      <button type="button" class="dropdown-trigger dropdown-trigger--full dropdown-trigger--sm" data-ref="btn-trigger-custom-unit" aria-label="Unidad de medida">
                        <div class="dropdown-trigger__left">
                          <span class="dropdown-trigger__text" data-ref="custom-unit-selected-text">px</span>
                        </div>
                        <svg class="component-icon dropdown-trigger__chevron" aria-hidden="true"><use href="/icons.svg#expand_more"></use></svg>
                      </button>
                      <div class="dropdown-backdrop" data-ref="dropdown-backdrop-custom-unit">
                        <div class="menu-panel menu-panel--dropdown menu-panel--w-full menu-panel--h-auto" data-ref="dropdown-menu-custom-unit">
                          <div class="menu-panel__list">
                            <button type="button" class="menu-item is-active" data-ref="btn-unit-px" data-value="px"><span class="menu-item__text">px</span></button>
                            <button type="button" class="menu-item" data-ref="btn-unit-in" data-value="in"><span class="menu-item__text">in</span></button>
                            <button type="button" class="menu-item" data-ref="btn-unit-mm" data-value="mm"><span class="menu-item__text">mm</span></button>
                            <button type="button" class="menu-item" data-ref="btn-unit-cm" data-value="cm"><span class="menu-item__text">cm</span></button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
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
                <button type="button" class="creation-card" data-ref="card-board-online" data-type="board" data-bg="dots" data-color="#ffffff" data-name="Pizarrón online">
                  <div class="creation-card__thumbnail" data-ref="thumb-board-online">
                    <img class="creation-card__img" data-ref="img-board-online" src="https://category-public.canva.com/thumbnails/thumbnail_realistic25_whiteboard_square.svg" alt="Pizarrón online" loading="lazy" />
                    <span class="creation-card__badge" data-ref="badge-board-online">Sin límites</span>
                  </div>
                  <div class="creation-card__info" data-ref="info-board-online">
                    <h4 class="creation-card__title" data-ref="title-board-online">Pizarrón online</h4>
                    <p class="creation-card__meta" data-ref="meta-board-online">Sin límites</p>
                  </div>
                </button>
              </div>
            </div>

            <div class="modal-canvas-panel" data-ref="panel-category-sheet" style="${activeCategory === 'sheet' ? '' : 'display: none;'}">
              <div class="creation-cards-grid" data-ref="grid-sheets">
                <button type="button" class="creation-card" data-ref="card-sheet-sheet" data-type="sheet" data-name="Hoja de cálculo">
                  <div class="creation-card__thumbnail" data-ref="thumb-sheet-sheet">
                    <img class="creation-card__img" data-ref="img-sheet-sheet" src="https://category-public.canva.com/thumbnails/thumbnail_realistic25_sheet_square.svg" alt="Hoja de cálculo" loading="lazy" />
                    <span class="creation-card__badge" data-ref="badge-sheet-sheet">Sin límites</span>
                  </div>
                  <div class="creation-card__info" data-ref="info-sheet-sheet">
                    <h4 class="creation-card__title" data-ref="title-sheet-sheet">Hoja de cálculo</h4>
                    <p class="creation-card__meta" data-ref="meta-sheet-sheet">Sin límites</p>
                  </div>
                </button>
              </div>
            </div>

            <div class="modal-canvas-panel" data-ref="panel-category-presentation" style="${activeCategory === 'presentation' ? '' : 'display: none;'}">
              <div class="creation-cards-grid" data-ref="grid-presentation-cards">
                <button type="button" class="creation-card" data-ref="card-pres-presentation" data-type="presentation" data-w="1920" data-h="1080" data-name="Presentación">
                  <div class="creation-card__thumbnail" data-ref="thumb-pres-presentation">
                    <img class="creation-card__img" data-ref="img-pres-presentation" src="https://category-public.canva.com/thumbnails/thumbnail_realistic25_presentation_square.svg" alt="Presentación" loading="lazy" />
                    <span class="creation-card__badge" data-ref="badge-pres-presentation">1920 × 1080 px</span>
                  </div>
                  <div class="creation-card__info" data-ref="info-pres-presentation">
                    <h4 class="creation-card__title" data-ref="title-pres-presentation">Presentación</h4>
                    <p class="creation-card__meta" data-ref="meta-pres-presentation">1920 × 1080 px</p>
                  </div>
                </button>
              </div>
            </div>

            <div class="modal-canvas-panel" data-ref="panel-category-video" style="${activeCategory === 'video' ? '' : 'display: none;'}">
              <div class="creation-cards-grid" data-ref="grid-videos">
                <button type="button" class="creation-card" data-ref="card-video-youtube" data-type="video" data-preset-id="youtube" data-w="1920" data-h="1080" data-name="Video de YouTube">
                  <div class="creation-card__thumbnail" data-ref="thumb-video-youtube">
                    <img class="creation-card__img" data-ref="img-video-youtube" src="https://category-public.canva.com/thumbnails/thumbnail_realistic25_youtubevideo_square.png" alt="Video de YouTube" loading="lazy" />
                    <span class="creation-card__badge" data-ref="badge-video-youtube">1920 × 1080 px</span>
                  </div>
                  <div class="creation-card__info" data-ref="info-video-youtube">
                    <h4 class="creation-card__title" data-ref="title-video-youtube">Video de YouTube</h4>
                    <p class="creation-card__meta" data-ref="meta-video-youtube">1920 × 1080 px</p>
                  </div>
                </button>

                <button type="button" class="creation-card" data-ref="card-video-horizontal" data-type="video" data-preset-id="horizontal" data-w="1920" data-h="1080" data-name="Video horizontal">
                  <div class="creation-card__thumbnail" data-ref="thumb-video-horizontal">
                    <img class="creation-card__img" data-ref="img-video-horizontal" src="https://category-public.canva.com/thumbnails/thumbnail_realistic25_videohoriztonal_square.png" alt="Video horizontal" loading="lazy" />
                    <span class="creation-card__badge" data-ref="badge-video-horizontal">1920 × 1080 px</span>
                  </div>
                  <div class="creation-card__info" data-ref="info-video-horizontal">
                    <h4 class="creation-card__title" data-ref="title-video-horizontal">Video horizontal</h4>
                    <p class="creation-card__meta" data-ref="meta-video-horizontal">1920 × 1080 px</p>
                  </div>
                </button>

                <button type="button" class="creation-card" data-ref="card-video-mobile" data-type="video" data-preset-id="mobile" data-w="1080" data-h="1920" data-name="Video para dispositivos móviles">
                  <div class="creation-card__thumbnail" data-ref="thumb-video-mobile">
                    <img class="creation-card__img" data-ref="img-video-mobile" src="https://category-public.canva.com/thumbnails/thumbnail_realistic25_mobilevideo_square.png" alt="Video para dispositivos móviles" loading="lazy" />
                    <span class="creation-card__badge" data-ref="badge-video-mobile">1080 × 1920 px</span>
                  </div>
                  <div class="creation-card__info" data-ref="info-video-mobile">
                    <h4 class="creation-card__title" data-ref="title-video-mobile">Video para dispositivos móviles</h4>
                    <p class="creation-card__meta" data-ref="meta-video-mobile">1080 × 1920 px</p>
                  </div>
                </button>

                <button type="button" class="creation-card" data-ref="card-video-tiktok" data-type="video" data-preset-id="tiktok" data-w="1080" data-h="1920" data-name="Video para TikTok">
                  <div class="creation-card__thumbnail" data-ref="thumb-video-tiktok">
                    <img class="creation-card__img" data-ref="img-video-tiktok" src="https://category-public.canva.com/thumbnails/thumbnail_realistic25_tiktokvideo_square.png" alt="Video para TikTok" loading="lazy" />
                    <span class="creation-card__badge" data-ref="badge-video-tiktok">1080 × 1920 px</span>
                  </div>
                  <div class="creation-card__info" data-ref="info-video-tiktok">
                    <h4 class="creation-card__title" data-ref="title-video-tiktok">Video para TikTok</h4>
                    <p class="creation-card__meta" data-ref="meta-video-tiktok">1080 × 1920 px</p>
                  </div>
                </button>

                <button type="button" class="creation-card" data-ref="card-video-youtube-shorts" data-type="video" data-preset-id="youtube-shorts" data-w="1080" data-h="1920" data-name="Cortos para YouTube">
                  <div class="creation-card__thumbnail" data-ref="thumb-video-youtube-shorts">
                    <img class="creation-card__img" data-ref="img-video-youtube-shorts" src="https://category-public.canva.com/thumbnails/thumbnail_realistic25_youtubeshorts_square.png" alt="Cortos para YouTube" loading="lazy" />
                    <span class="creation-card__badge" data-ref="badge-video-youtube-shorts">1080 × 1920 px</span>
                  </div>
                  <div class="creation-card__info" data-ref="info-video-youtube-shorts">
                    <h4 class="creation-card__title" data-ref="title-video-youtube-shorts">Cortos para YouTube</h4>
                    <p class="creation-card__meta" data-ref="meta-video-youtube-shorts">1080 × 1920 px</p>
                  </div>
                </button>

                <button type="button" class="creation-card" data-ref="card-video-facebook" data-type="video" data-preset-id="facebook" data-w="1080" data-h="1080" data-name="Video para Facebook">
                  <div class="creation-card__thumbnail" data-ref="thumb-video-facebook">
                    <img class="creation-card__img" data-ref="img-video-facebook" src="https://category-public.canva.com/thumbnails/thumbnail_realistic25_facebookVideo_square_square.png" alt="Video para Facebook" loading="lazy" />
                    <span class="creation-card__badge" data-ref="badge-video-facebook">1080 × 1080 px</span>
                  </div>
                  <div class="creation-card__info" data-ref="info-video-facebook">
                    <h4 class="creation-card__title" data-ref="title-video-facebook">Video para Facebook</h4>
                    <p class="creation-card__meta" data-ref="meta-video-facebook">1080 × 1080 px</p>
                  </div>
                </button>

                <button type="button" class="creation-card" data-ref="card-video-instagram-reels" data-type="video" data-preset-id="instagram-reels" data-w="1080" data-h="1920" data-name="Reel de Instagram">
                  <div class="creation-card__thumbnail" data-ref="thumb-video-instagram-reels">
                    <img class="creation-card__img" data-ref="img-video-instagram-reels" src="https://category-public.canva.com/thumbnails/thumbnail_realistic25_instagramreel_square.png" alt="Reel de Instagram" loading="lazy" />
                    <span class="creation-card__badge" data-ref="badge-video-instagram-reels">1080 × 1920 px</span>
                  </div>
                  <div class="creation-card__info" data-ref="info-video-instagram-reels">
                    <h4 class="creation-card__title" data-ref="title-video-instagram-reels">Reel de Instagram</h4>
                    <p class="creation-card__meta" data-ref="meta-video-instagram-reels">1080 × 1920 px</p>
                  </div>
                </button>

                <button type="button" class="creation-card" data-ref="card-video-square-800" data-type="video" data-preset-id="square-800" data-w="800" data-h="800" data-name="Video cuadrado">
                  <div class="creation-card__thumbnail" data-ref="thumb-video-square-800">
                    <img class="creation-card__img" data-ref="img-video-square-800" src="https://category-public.canva.com/contextualThumbnails/thumbnail_realistic25_videosquare_square.png" alt="Video cuadrado" loading="lazy" />
                    <span class="creation-card__badge" data-ref="badge-video-square-800">800 × 800 px</span>
                  </div>
                  <div class="creation-card__info" data-ref="info-video-square-800">
                    <h4 class="creation-card__title" data-ref="title-video-square-800">Video cuadrado</h4>
                    <p class="creation-card__meta" data-ref="meta-video-square-800">800 × 800 px</p>
                  </div>
                </button>
              </div>
            </div>

            <div class="modal-canvas-panel" data-ref="panel-category-doc" style="${activeCategory === 'doc' ? '' : 'display: none;'}">
              <div class="creation-cards-grid" data-ref="grid-doc-papers">
                <button type="button" class="creation-card" data-ref="card-doc-digital" data-type="doc" data-paper="digital" data-name="Doc (Digital)">
                  <div class="creation-card__thumbnail" data-ref="thumb-doc-digital">
                    <img class="creation-card__img" data-ref="img-doc-digital" src="https://category-public.canva.com/thumbnails/thumbnail_realistic25_digitaldocument_square4444.svg" alt="Doc (Digital)" loading="lazy" />
                    <span class="creation-card__badge" data-ref="badge-doc-digital">Tamaño automático</span>
                  </div>
                  <div class="creation-card__info" data-ref="info-doc-digital">
                    <h4 class="creation-card__title" data-ref="title-doc-digital">Doc (Digital)</h4>
                    <p class="creation-card__meta" data-ref="meta-doc-digital">Tamaño automático</p>
                  </div>
                </button>

                <button type="button" class="creation-card" data-ref="card-doc-pageless" data-type="doc" data-paper="digital" data-template="pageless" data-name="Doc (Sin páginas)">
                  <div class="creation-card__thumbnail" data-ref="thumb-doc-pageless">
                    <img class="creation-card__img" data-ref="img-doc-pageless" src="https://category-public.canva.com/thumbnails/thumbnail_realistic25_pagelessdocument_square4444.svg" alt="Doc (Sin páginas)" loading="lazy" />
                    <span class="creation-card__badge" data-ref="badge-doc-pageless">Tamaño automático</span>
                  </div>
                  <div class="creation-card__info" data-ref="info-doc-pageless">
                    <h4 class="creation-card__title" data-ref="title-doc-pageless">Doc (Sin páginas)</h4>
                    <p class="creation-card__meta" data-ref="meta-doc-pageless">Tamaño automático</p>
                  </div>
                </button>

                <button type="button" class="creation-card" data-ref="card-doc-a4" data-type="doc" data-paper="a4" data-name="Doc (A4)">
                  <div class="creation-card__thumbnail" data-ref="thumb-doc-a4">
                    <img class="creation-card__img" data-ref="img-doc-a4" src="https://category-public.canva.com/thumbnails/thumbnail_realistic25_a4document_square4444.svg" alt="Doc (A4)" loading="lazy" />
                    <span class="creation-card__badge" data-ref="badge-doc-a4">21 × 29.7 cm</span>
                  </div>
                  <div class="creation-card__info" data-ref="info-doc-a4">
                    <h4 class="creation-card__title" data-ref="title-doc-a4">Doc (A4)</h4>
                    <p class="creation-card__meta" data-ref="meta-doc-a4">21 × 29.7 cm</p>
                  </div>
                </button>

                <button type="button" class="creation-card" data-ref="card-doc-legal" data-type="doc" data-paper="legal" data-name="Doc (Políticas)">
                  <div class="creation-card__thumbnail" data-ref="thumb-doc-legal">
                    <img class="creation-card__img" data-ref="img-doc-legal" src="https://category-public.canva.com/thumbnails/thumbnail_realistic25_legaldocument_square4444.svg" alt="Doc (Políticas)" loading="lazy" />
                    <span class="creation-card__badge" data-ref="badge-doc-legal">8.5 × 14 in</span>
                  </div>
                  <div class="creation-card__info" data-ref="info-doc-legal">
                    <h4 class="creation-card__title" data-ref="title-doc-legal">Doc (Políticas)</h4>
                    <p class="creation-card__meta" data-ref="meta-doc-legal">8.5 × 14 in</p>
                  </div>
                </button>

                <button type="button" class="creation-card" data-ref="card-doc-letter" data-type="doc" data-paper="letter" data-name="Doc (Carta)">
                  <div class="creation-card__thumbnail" data-ref="thumb-doc-letter">
                    <img class="creation-card__img" data-ref="img-doc-letter" src="https://category-public.canva.com/thumbnails/thumbnail_realistic25_letterdocument_square4444.svg" alt="Doc (Carta)" loading="lazy" />
                    <span class="creation-card__badge" data-ref="badge-doc-letter">8.5 × 11 in</span>
                  </div>
                  <div class="creation-card__info" data-ref="info-doc-letter">
                    <h4 class="creation-card__title" data-ref="title-doc-letter">Doc (Carta)</h4>
                    <p class="creation-card__meta" data-ref="meta-doc-letter">8.5 × 11 in</p>
                  </div>
                </button>
              </div>
            </div>

            <div class="modal-canvas-panel" data-ref="panel-category-social" style="${activeCategory === 'social' ? '' : 'display: none;'}">
              <div class="creation-category-section creation-category-section--platforms" data-ref="section-social-platforms">
                <div class="component-tags-carousel social-platforms-carousel" data-ref="social-platforms-carousel">
                  <button type="button" class="component-badge component-badge--interactive is-active" data-ref="badge-platform-facebook" data-platform="facebook">
                    ${getSocialPlatformBadgeIconSvg('facebook')}
                    <span class="component-badge__text">Facebook</span>
                  </button>
                  <button type="button" class="component-badge component-badge--interactive" data-ref="badge-platform-instagram" data-platform="instagram">
                    ${getSocialPlatformBadgeIconSvg('instagram')}
                    <span class="component-badge__text">Instagram</span>
                  </button>
                  <button type="button" class="component-badge component-badge--interactive" data-ref="badge-platform-linkedin" data-platform="linkedin">
                    ${getSocialPlatformBadgeIconSvg('linkedin')}
                    <span class="component-badge__text">LinkedIn</span>
                  </button>
                  <button type="button" class="component-badge component-badge--interactive" data-ref="badge-platform-pinterest" data-platform="pinterest">
                    ${getSocialPlatformBadgeIconSvg('pinterest')}
                    <span class="component-badge__text">Pinterest</span>
                  </button>
                  <button type="button" class="component-badge component-badge--interactive" data-ref="badge-platform-tiktok" data-platform="tiktok">
                    ${getSocialPlatformBadgeIconSvg('tiktok')}
                    <span class="component-badge__text">TikTok</span>
                  </button>
                  <button type="button" class="component-badge component-badge--interactive" data-ref="badge-platform-x" data-platform="x">
                    ${getSocialPlatformBadgeIconSvg('x')}
                    <span class="component-badge__text">X (Twitter)</span>
                  </button>
                  <button type="button" class="component-badge component-badge--interactive" data-ref="badge-platform-whatsapp" data-platform="whatsapp">
                    ${getSocialPlatformBadgeIconSvg('whatsapp')}
                    <span class="component-badge__text">WhatsApp</span>
                  </button>
                  <button type="button" class="component-badge component-badge--interactive" data-ref="badge-platform-youtube" data-platform="youtube">
                    ${getSocialPlatformBadgeIconSvg('youtube')}
                    <span class="component-badge__text">YouTube</span>
                  </button>
                </div>
              </div>

              <div class="creation-category-section" data-ref="platform-content-facebook">
                <h3 class="creation-category-section__title">Formatos para Facebook</h3>
                <div class="creation-cards-grid" data-ref="grid-social-facebook">
                  <button type="button" class="creation-card" data-ref="card-social-fb-post" data-type="social" data-w="940" data-h="788" data-name="Post para Facebook">
                    <div class="creation-card__thumbnail" data-ref="thumb-social-fb-post">
                      <img class="creation-card__img" data-ref="img-social-fb-post" src="https://category-public.canva.com/thumbnails/thumbnail_facebookpost_facebook_1.png" alt="Post para Facebook" loading="lazy" />
                      <span class="creation-card__badge" data-ref="badge-social-fb-post">940 × 788 px</span>
                    </div>
                    <div class="creation-card__info" data-ref="info-social-fb-post">
                      <h4 class="creation-card__title" data-ref="title-social-fb-post">Post para Facebook</h4>
                      <p class="creation-card__meta" data-ref="meta-social-fb-post">940 × 788 px</p>
                    </div>
                  </button>

                  <button type="button" class="creation-card" data-ref="card-social-fb-cover" data-type="social" data-w="851" data-h="315" data-name="Portada para Facebook (Horizontal)">
                    <div class="creation-card__thumbnail" data-ref="thumb-social-fb-cover">
                      <img class="creation-card__img" data-ref="img-social-fb-cover" src="https://category-public.canva.com/thumbnails/thumbnail_realistic25_facebookpagecover_square.svg" alt="Portada para Facebook (Horizontal)" loading="lazy" />
                      <span class="creation-card__badge" data-ref="badge-social-fb-cover">851 × 315 px</span>
                    </div>
                    <div class="creation-card__info" data-ref="info-social-fb-cover">
                      <h4 class="creation-card__title" data-ref="title-social-fb-cover">Portada para Facebook (Horizontal)</h4>
                      <p class="creation-card__meta" data-ref="meta-social-fb-cover">851 × 315 px</p>
                    </div>
                  </button>

                  <button type="button" class="creation-card" data-ref="card-social-fb-post-landscape" data-type="social" data-w="1200" data-h="630" data-name="Post para Facebook (Horizontal)">
                    <div class="creation-card__thumbnail" data-ref="thumb-social-fb-post-landscape">
                      <img class="creation-card__img" data-ref="img-social-fb-post-landscape" src="https://category-public.canva.com/thumbnails/thumbnail_facebookpost_landscape_1.png" alt="Post para Facebook (Horizontal)" loading="lazy" />
                      <span class="creation-card__badge" data-ref="badge-social-fb-post-landscape">1200 × 630 px</span>
                    </div>
                    <div class="creation-card__info" data-ref="info-social-fb-post-landscape">
                      <h4 class="creation-card__title" data-ref="title-social-fb-post-landscape">Post para Facebook (Horizontal)</h4>
                      <p class="creation-card__meta" data-ref="meta-social-fb-post-landscape">1200 × 630 px</p>
                    </div>
                  </button>

                  <button type="button" class="creation-card" data-ref="card-social-fb-post-square" data-type="social" data-w="1080" data-h="1080" data-name="Post para Facebook (Cuadrado)">
                    <div class="creation-card__thumbnail" data-ref="thumb-social-fb-post-square">
                      <img class="creation-card__img" data-ref="img-social-fb-post-square" src="https://category-public.canva.com/thumbnails/thumbnail_facebookpost_square_1.png" alt="Post para Facebook (Cuadrado)" loading="lazy" />
                      <span class="creation-card__badge" data-ref="badge-social-fb-post-square">1080 × 1080 px</span>
                    </div>
                    <div class="creation-card__info" data-ref="info-social-fb-post-square">
                      <h4 class="creation-card__title" data-ref="title-social-fb-post-square">Post para Facebook (Cuadrado)</h4>
                      <p class="creation-card__meta" data-ref="meta-social-fb-post-square">1080 × 1080 px</p>
                    </div>
                  </button>

                  <button type="button" class="creation-card" data-ref="card-social-fb-event-cover" data-type="social" data-w="1920" data-h="1080" data-name="Portada para evento de Facebook">
                    <div class="creation-card__thumbnail" data-ref="thumb-social-fb-event-cover">
                      <img class="creation-card__img" data-ref="img-social-fb-event-cover" src="https://category-public.canva.com/thumbnails/thumbnail_realistic25_facebookeventcover_square.png" alt="Portada para evento de Facebook" loading="lazy" />
                      <span class="creation-card__badge" data-ref="badge-social-fb-event-cover">1920 × 1080 px</span>
                    </div>
                    <div class="creation-card__info" data-ref="info-social-fb-event-cover">
                      <h4 class="creation-card__title" data-ref="title-social-fb-event-cover">Portada para evento de Facebook</h4>
                      <p class="creation-card__meta" data-ref="meta-social-fb-event-cover">1920 × 1080 px</p>
                    </div>
                  </button>

                  <button type="button" class="creation-card" data-ref="card-social-fb-story" data-type="social" data-w="1080" data-h="1920" data-name="Facebook Story">
                    <div class="creation-card__thumbnail" data-ref="thumb-social-fb-story">
                      <img class="creation-card__img" data-ref="img-social-fb-story" src="https://category-public.canva.com/thumbnails/_thumbnail_realistic25_facebookstory_novideo4x.png" alt="Facebook Story" loading="lazy" />
                      <span class="creation-card__badge" data-ref="badge-social-fb-story">1080 × 1920 px</span>
                    </div>
                    <div class="creation-card__info" data-ref="info-social-fb-story">
                      <h4 class="creation-card__title" data-ref="title-social-fb-story">Facebook Story</h4>
                      <p class="creation-card__meta" data-ref="meta-social-fb-story">1080 × 1920 px</p>
                    </div>
                  </button>

                  <button type="button" class="creation-card" data-ref="card-social-fb-video" data-type="social" data-w="1080" data-h="1080" data-name="Video para Facebook">
                    <div class="creation-card__thumbnail" data-ref="thumb-social-fb-video">
                      <img class="creation-card__img" data-ref="img-social-fb-video" src="https://category-public.canva.com/thumbnails/thumbnail_realistic25_facebookVideo_square_square.png" alt="Video para Facebook" loading="lazy" />
                      <span class="creation-card__badge" data-ref="badge-social-fb-video">1080 × 1080 px</span>
                    </div>
                    <div class="creation-card__info" data-ref="info-social-fb-video">
                      <h4 class="creation-card__title" data-ref="title-social-fb-video">Video para Facebook</h4>
                      <p class="creation-card__meta" data-ref="meta-social-fb-video">1080 × 1080 px</p>
                    </div>
                  </button>

                  <button type="button" class="creation-card" data-ref="card-social-fb-feed-ad" data-type="social" data-w="1200" data-h="628" data-name="Anuncio para Facebook">
                    <div class="creation-card__thumbnail" data-ref="thumb-social-fb-feed-ad">
                      <img class="creation-card__img" data-ref="img-social-fb-feed-ad" src="https://category-public.canva.com/thumbnails/thumbnail_realistic25_facebookfeedad_square_red.svg" alt="Anuncio para Facebook" loading="lazy" />
                      <span class="creation-card__badge" data-ref="badge-social-fb-feed-ad">1200 × 628 px</span>
                    </div>
                    <div class="creation-card__info" data-ref="info-social-fb-feed-ad">
                      <h4 class="creation-card__title" data-ref="title-social-fb-feed-ad">Anuncio para Facebook</h4>
                      <p class="creation-card__meta" data-ref="meta-social-fb-feed-ad">1200 × 628 px</p>
                    </div>
                  </button>

                  <button type="button" class="creation-card" data-ref="card-social-fb-profile" data-type="social" data-w="2048" data-h="2048" data-name="Foto de perfil de Facebook">
                    <div class="creation-card__thumbnail" data-ref="thumb-social-fb-profile">
                      <img class="creation-card__img" data-ref="img-social-fb-profile" src="https://category-public.canva.com/thumbnails/thumbnail_realistic25_facebookprofilepicture_square.png" alt="Foto de perfil de Facebook" loading="lazy" />
                      <span class="creation-card__badge" data-ref="badge-social-fb-profile">2048 × 2048 px</span>
                    </div>
                    <div class="creation-card__info" data-ref="info-social-fb-profile">
                      <h4 class="creation-card__title" data-ref="title-social-fb-profile">Foto de perfil de Facebook</h4>
                      <p class="creation-card__meta" data-ref="meta-social-fb-profile">2048 × 2048 px</p>
                    </div>
                  </button>

                  <button type="button" class="creation-card" data-ref="card-social-fb-story-ad" data-type="social" data-w="1080" data-h="1920" data-name="Anuncio para historias de Facebook">
                    <div class="creation-card__thumbnail" data-ref="thumb-social-fb-story-ad">
                      <img class="creation-card__img" data-ref="img-social-fb-story-ad" src="https://category-public.canva.com/thumbnails/thumbnail_realistic25_facebookstoryad_square_red.svg" alt="Anuncio para historias de Facebook" loading="lazy" />
                      <span class="creation-card__badge" data-ref="badge-social-fb-story-ad">1080 × 1920 px</span>
                    </div>
                    <div class="creation-card__info" data-ref="info-social-fb-story-ad">
                      <h4 class="creation-card__title" data-ref="title-social-fb-story-ad">Anuncio para historias de Facebook</h4>
                      <p class="creation-card__meta" data-ref="meta-social-fb-story-ad">1080 × 1920 px</p>
                    </div>
                  </button>
                </div>
              </div>

              <div class="creation-category-section" data-ref="platform-content-instagram" style="display: none;">
                <h3 class="creation-category-section__title">Formatos para Instagram</h3>
                <div class="creation-cards-grid" data-ref="grid-social-instagram">
                  <button type="button" class="creation-card" data-ref="card-social-ig-story" data-type="social" data-w="1080" data-h="1920" data-name="Instagram Story">
                    <div class="creation-card__thumbnail" data-ref="thumb-social-ig-story">
                      <img class="creation-card__img" data-ref="img-social-ig-story" src="https://category-public.canva.com/thumbnails/thumbnail_realistic25_instagramstory_static_square-1.png" alt="Instagram Story" loading="lazy" />
                      <span class="creation-card__badge" data-ref="badge-social-ig-story">1080 × 1920 px</span>
                    </div>
                    <div class="creation-card__info" data-ref="info-social-ig-story">
                      <h4 class="creation-card__title" data-ref="title-social-ig-story">Instagram Story</h4>
                      <p class="creation-card__meta" data-ref="meta-social-ig-story">1080 × 1920 px</p>
                    </div>
                  </button>

                  <button type="button" class="creation-card" data-ref="card-social-ig-post-4-5" data-type="social" data-w="1080" data-h="1350" data-name="Post para Instagram (4:5)">
                    <div class="creation-card__thumbnail" data-ref="thumb-social-ig-post-4-5">
                      <img class="creation-card__img" data-ref="img-social-ig-post-4-5" src="https://category-public.canva.com/thumbnails/thumbnail_realistic25_instagrampost_square.png" alt="Post para Instagram (4:5)" loading="lazy" />
                      <span class="creation-card__badge" data-ref="badge-social-ig-post-4-5">1080 × 1350 px</span>
                    </div>
                    <div class="creation-card__info" data-ref="info-social-ig-post-4-5">
                      <h4 class="creation-card__title" data-ref="title-social-ig-post-4-5">Post para Instagram (4:5)</h4>
                      <p class="creation-card__meta" data-ref="meta-social-ig-post-4-5">1080 × 1350 px</p>
                    </div>
                  </button>

                  <button type="button" class="creation-card" data-ref="card-social-ig-post-3-4" data-type="social" data-w="1080" data-h="1440" data-name="Post para Instagram (3:4)">
                    <div class="creation-card__thumbnail" data-ref="thumb-social-ig-post-3-4">
                      <img class="creation-card__img" data-ref="img-social-ig-post-3-4" src="https://category-public.canva.com/thumbnails/thumbnail_realistic25_instagrampost_square.png" alt="Post para Instagram (3:4)" loading="lazy" />
                      <span class="creation-card__badge" data-ref="badge-social-ig-post-3-4">1080 × 1440 px</span>
                    </div>
                    <div class="creation-card__info" data-ref="info-social-ig-post-3-4">
                      <h4 class="creation-card__title" data-ref="title-social-ig-post-3-4">Post para Instagram (3:4)</h4>
                      <p class="creation-card__meta" data-ref="meta-social-ig-post-3-4">1080 × 1440 px</p>
                    </div>
                  </button>

                  <button type="button" class="creation-card" data-ref="card-social-ig-post-square" data-type="social" data-w="1080" data-h="1080" data-name="Post para Instagram (Cuadrado)">
                    <div class="creation-card__thumbnail" data-ref="thumb-social-ig-post-square">
                      <img class="creation-card__img" data-ref="img-social-ig-post-square" src="https://category-public.canva.com/thumbnails/thumbnail_realistic25_instagrampost_square.png" alt="Post para Instagram (Cuadrado)" loading="lazy" />
                      <span class="creation-card__badge" data-ref="badge-social-ig-post-square">1080 × 1080 px</span>
                    </div>
                    <div class="creation-card__info" data-ref="info-social-ig-post-square">
                      <h4 class="creation-card__title" data-ref="title-social-ig-post-square">Post para Instagram (Cuadrado)</h4>
                      <p class="creation-card__meta" data-ref="meta-social-ig-post-square">1080 × 1080 px</p>
                    </div>
                  </button>

                  <button type="button" class="creation-card" data-ref="card-social-ig-reel" data-type="social" data-w="1080" data-h="1920" data-name="Reel de Instagram">
                    <div class="creation-card__thumbnail" data-ref="thumb-social-ig-reel">
                      <img class="creation-card__img" data-ref="img-social-ig-reel" src="https://category-public.canva.com/thumbnails/thumbnail_realistic25_instagramreel_square.png" alt="Reel de Instagram" loading="lazy" />
                      <span class="creation-card__badge" data-ref="badge-social-ig-reel">1080 × 1920 px</span>
                    </div>
                    <div class="creation-card__info" data-ref="info-social-ig-reel">
                      <h4 class="creation-card__title" data-ref="title-social-ig-reel">Reel de Instagram</h4>
                      <p class="creation-card__meta" data-ref="meta-social-ig-reel">1080 × 1920 px</p>
                    </div>
                  </button>

                  <button type="button" class="creation-card" data-ref="card-social-ig-profile" data-type="social" data-w="320" data-h="320" data-name="Foto del perfil de Instagram">
                    <div class="creation-card__thumbnail" data-ref="thumb-social-ig-profile">
                      <img class="creation-card__img" data-ref="img-social-ig-profile" src="https://category-public.canva.com/thumbnails/thumbnail_realistic25_instagramprofilepicture_square.png" alt="Foto del perfil de Instagram" loading="lazy" />
                      <span class="creation-card__badge" data-ref="badge-social-ig-profile">320 × 320 px</span>
                    </div>
                    <div class="creation-card__info" data-ref="info-social-ig-profile">
                      <h4 class="creation-card__title" data-ref="title-social-ig-profile">Foto del perfil de Instagram</h4>
                      <p class="creation-card__meta" data-ref="meta-social-ig-profile">320 × 320 px</p>
                    </div>
                  </button>

                  <button type="button" class="creation-card" data-ref="card-social-ig-feed-ad-4-5" data-type="social" data-w="1080" data-h="1350" data-name="Anuncio para Instagram (4:5)">
                    <div class="creation-card__thumbnail" data-ref="thumb-social-ig-feed-ad-4-5">
                      <img class="creation-card__img" data-ref="img-social-ig-feed-ad-4-5" src="https://category-public.canva.com/thumbnails/thumbnail_realistic25_instagramfeedad_square.svg" alt="Anuncio para Instagram (4:5)" loading="lazy" />
                      <span class="creation-card__badge" data-ref="badge-social-ig-feed-ad-4-5">1080 × 1350 px</span>
                    </div>
                    <div class="creation-card__info" data-ref="info-social-ig-feed-ad-4-5">
                      <h4 class="creation-card__title" data-ref="title-social-ig-feed-ad-4-5">Anuncio para Instagram (4:5)</h4>
                      <p class="creation-card__meta" data-ref="meta-social-ig-feed-ad-4-5">1080 × 1350 px</p>
                    </div>
                  </button>

                  <button type="button" class="creation-card" data-ref="card-social-ig-feed-ad-square" data-type="social" data-w="1080" data-h="1080" data-name="Anuncio para feed de Instagram">
                    <div class="creation-card__thumbnail" data-ref="thumb-social-ig-feed-ad-square">
                      <img class="creation-card__img" data-ref="img-social-ig-feed-ad-square" src="https://category-public.canva.com/thumbnails/thumbnail_realistic25_instagramfeedad_square_red.svg" alt="Anuncio para feed de Instagram" loading="lazy" />
                      <span class="creation-card__badge" data-ref="badge-social-ig-feed-ad-square">1080 × 1080 px</span>
                    </div>
                    <div class="creation-card__info" data-ref="info-social-ig-feed-ad-square">
                      <h4 class="creation-card__title" data-ref="title-social-ig-feed-ad-square">Anuncio para feed de Instagram</h4>
                      <p class="creation-card__meta" data-ref="meta-social-ig-feed-ad-square">1080 × 1080 px</p>
                    </div>
                  </button>

                  <button type="button" class="creation-card" data-ref="card-social-ig-story-ad" data-type="social" data-w="1080" data-h="1920" data-name="Anuncio para Instagram Story">
                    <div class="creation-card__thumbnail" data-ref="thumb-social-ig-story-ad">
                      <img class="creation-card__img" data-ref="img-social-ig-story-ad" src="https://category-public.canva.com/thumbnails/thumbnail_realistic25_instagramstoryad_square_red.svg" alt="Anuncio para Instagram Story" loading="lazy" />
                      <span class="creation-card__badge" data-ref="badge-social-ig-story-ad">1080 × 1920 px</span>
                    </div>
                    <div class="creation-card__info" data-ref="info-social-ig-story-ad">
                      <h4 class="creation-card__title" data-ref="title-social-ig-story-ad">Anuncio para Instagram Story</h4>
                      <p class="creation-card__meta" data-ref="meta-social-ig-story-ad">1080 × 1920 px</p>
                    </div>
                  </button>

                  <button type="button" class="creation-card" data-ref="card-social-ig-carousel" data-type="social" data-w="1080" data-h="1350" data-name="Carrusel de posts para Instagram (4:5)">
                    <div class="creation-card__thumbnail" data-ref="thumb-social-ig-carousel">
                      <img class="creation-card__img" data-ref="img-social-ig-carousel" src="https://category-public.canva.com/thumbnails/thumbnail_realistic25_instagrampost_square.png" alt="Carrusel de posts para Instagram (4:5)" loading="lazy" />
                      <span class="creation-card__badge" data-ref="badge-social-ig-carousel">1080 × 1350 px</span>
                    </div>
                    <div class="creation-card__info" data-ref="info-social-ig-carousel">
                      <h4 class="creation-card__title" data-ref="title-social-ig-carousel">Carrusel de posts para Instagram (4:5)</h4>
                      <p class="creation-card__meta" data-ref="meta-social-ig-carousel">1080 × 1350 px</p>
                    </div>
                  </button>
                </div>
              </div>

              <div class="creation-category-section" data-ref="platform-content-linkedin" style="display: none;">
                <h3 class="creation-category-section__title">Formatos para LinkedIn</h3>
                <div class="creation-cards-grid" data-ref="grid-social-linkedin">
                  <button type="button" class="creation-card" data-ref="card-social-li-post" data-type="social" data-w="1200" data-h="1200" data-name="Post para LinkedIn">
                    <div class="creation-card__thumbnail" data-ref="thumb-social-li-post">
                      <img class="creation-card__img" data-ref="img-social-li-post" src="https://category-public.canva.com/thumbnails/thumbnail_realistic25_linkedinpost_square.png" alt="Post para LinkedIn" loading="lazy" />
                      <span class="creation-card__badge" data-ref="badge-social-li-post">1200 × 1200 px</span>
                    </div>
                    <div class="creation-card__info" data-ref="info-social-li-post">
                      <h4 class="creation-card__title" data-ref="title-social-li-post">Post para LinkedIn</h4>
                      <p class="creation-card__meta" data-ref="meta-social-li-post">1200 × 1200 px</p>
                    </div>
                  </button>

                  <button type="button" class="creation-card" data-ref="card-social-li-video" data-type="social" data-w="1080" data-h="1920" data-name="Video para LinkedIn">
                    <div class="creation-card__thumbnail" data-ref="thumb-social-li-video">
                      <img class="creation-card__img" data-ref="img-social-li-video" src="https://category-public.canva.com/thumbnails/thumbnail_realistic25_linkedinvideo_square.png" alt="Video para LinkedIn" loading="lazy" />
                      <span class="creation-card__badge" data-ref="badge-social-li-video">1080 × 1920 px</span>
                    </div>
                    <div class="creation-card__info" data-ref="info-social-li-video">
                      <h4 class="creation-card__title" data-ref="title-social-li-video">Video para LinkedIn</h4>
                      <p class="creation-card__meta" data-ref="meta-social-li-video">1080 × 1920 px</p>
                    </div>
                  </button>

                  <button type="button" class="creation-card" data-ref="card-social-li-cover" data-type="social" data-w="1584" data-h="396" data-name="Foto de fondo de LinkedIn">
                    <div class="creation-card__thumbnail" data-ref="thumb-social-li-cover">
                      <img class="creation-card__img" data-ref="img-social-li-cover" src="https://category-public.canva.com/thumbnails/thumbnail_realistic25_linkedincoverimage_square.png" alt="Foto de fondo de LinkedIn" loading="lazy" />
                      <span class="creation-card__badge" data-ref="badge-social-li-cover">1584 × 396 px</span>
                    </div>
                    <div class="creation-card__info" data-ref="info-social-li-cover">
                      <h4 class="creation-card__title" data-ref="title-social-li-cover">Foto de fondo de LinkedIn</h4>
                      <p class="creation-card__meta" data-ref="meta-social-li-cover">1584 × 396 px</p>
                    </div>
                  </button>

                  <button type="button" class="creation-card" data-ref="card-social-li-single-image-ad" data-type="social" data-w="1200" data-h="627" data-name="Anuncio de una imagen para LinkedIn">
                    <div class="creation-card__thumbnail" data-ref="thumb-social-li-single-image-ad">
                      <img class="creation-card__img" data-ref="img-social-li-single-image-ad" src="https://category-public.canva.com/thumbnails/thumbnail_realistic25_linkedinsingleimagead_square_red.png" alt="Anuncio de una imagen para LinkedIn" loading="lazy" />
                      <span class="creation-card__badge" data-ref="badge-social-li-single-image-ad">1200 × 627 px</span>
                    </div>
                    <div class="creation-card__info" data-ref="info-social-li-single-image-ad">
                      <h4 class="creation-card__title" data-ref="title-social-li-single-image-ad">Anuncio de una imagen para LinkedIn</h4>
                      <p class="creation-card__meta" data-ref="meta-social-li-single-image-ad">1200 × 627 px</p>
                    </div>
                  </button>

                  <button type="button" class="creation-card" data-ref="card-social-li-profile" data-type="social" data-w="800" data-h="800" data-name="Foto del perfil de LinkedIn">
                    <div class="creation-card__thumbnail" data-ref="thumb-social-li-profile">
                      <img class="creation-card__img" data-ref="img-social-li-profile" src="https://category-public.canva.com/thumbnails/thumbnail_realistic25_linkedinprofilepicture_square.png" alt="Foto del perfil de LinkedIn" loading="lazy" />
                      <span class="creation-card__badge" data-ref="badge-social-li-profile">800 × 800 px</span>
                    </div>
                    <div class="creation-card__info" data-ref="info-social-li-profile">
                      <h4 class="creation-card__title" data-ref="title-social-li-profile">Foto del perfil de LinkedIn</h4>
                      <p class="creation-card__meta" data-ref="meta-social-li-profile">800 × 800 px</p>
                    </div>
                  </button>

                  <button type="button" class="creation-card" data-ref="card-social-li-article-cover" data-type="social" data-w="2000" data-h="600" data-name="Imagen de portada de artículo de LinkedIn">
                    <div class="creation-card__thumbnail" data-ref="thumb-social-li-article-cover">
                      <img class="creation-card__img" data-ref="img-social-li-article-cover" src="https://category-public.canva.com/thumbnails/thumbnail_realistic25_linkedinblogpost_square.png" alt="Imagen de portada de artículo de LinkedIn" loading="lazy" />
                      <span class="creation-card__badge" data-ref="badge-social-li-article-cover">2000 × 600 px</span>
                    </div>
                    <div class="creation-card__info" data-ref="info-social-li-article-cover">
                      <h4 class="creation-card__title" data-ref="title-social-li-article-cover">Imagen de portada de artículo de LinkedIn</h4>
                      <p class="creation-card__meta" data-ref="meta-social-li-article-cover">2000 × 600 px</p>
                    </div>
                  </button>

                  <button type="button" class="creation-card" data-ref="card-social-li-carousel" data-type="social" data-w="1200" data-h="1500" data-name="Post en carrusel para LinkedIn">
                    <div class="creation-card__thumbnail" data-ref="thumb-social-li-carousel">
                      <img class="creation-card__img" data-ref="img-social-li-carousel" src="https://category-public.canva.com/thumbnails/thumbnail_LinkedIncarousel_linkedin_1.png" alt="Post en carrusel para LinkedIn" loading="lazy" />
                      <span class="creation-card__badge" data-ref="badge-social-li-carousel">1200 × 1500 px</span>
                    </div>
                    <div class="creation-card__info" data-ref="info-social-li-carousel">
                      <h4 class="creation-card__title" data-ref="title-social-li-carousel">Post en carrusel para LinkedIn</h4>
                      <p class="creation-card__meta" data-ref="meta-social-li-carousel">1200 × 1500 px</p>
                    </div>
                  </button>

                  <button type="button" class="creation-card" data-ref="card-social-li-video-ad" data-type="social" data-w="1920" data-h="1920" data-name="Anuncio de video para LinkedIn">
                    <div class="creation-card__thumbnail" data-ref="thumb-social-li-video-ad">
                      <img class="creation-card__img" data-ref="img-social-li-video-ad" src="https://category-public.canva.com/thumbnails/thumbnail_LinkedInVideoAd_linkedin_1.png" alt="Anuncio de video para LinkedIn" loading="lazy" />
                      <span class="creation-card__badge" data-ref="badge-social-li-video-ad">1920 × 1920 px</span>
                    </div>
                    <div class="creation-card__info" data-ref="info-social-li-video-ad">
                      <h4 class="creation-card__title" data-ref="title-social-li-video-ad">Anuncio de video para LinkedIn</h4>
                      <p class="creation-card__meta" data-ref="meta-social-li-video-ad">1920 × 1920 px</p>
                    </div>
                  </button>
                </div>
              </div>

              <div class="creation-category-section" data-ref="platform-content-pinterest" style="display: none;">
                <h3 class="creation-category-section__title">Formatos para Pinterest</h3>
                <div class="creation-cards-grid" data-ref="grid-social-pinterest">
                  <button type="button" class="creation-card" data-ref="card-social-pin-carousel-ad" data-type="social" data-w="1000" data-h="1500" data-name="Anuncio de carrusel para Pinterest">
                    <div class="creation-card__thumbnail" data-ref="thumb-social-pin-carousel-ad">
                      <img class="creation-card__img" data-ref="img-social-pin-carousel-ad" src="https://category-public.canva.com/thumbnails/thumbnail_realistic25_pinterestad_square_red.svg" alt="Anuncio de carrusel para Pinterest" loading="lazy" />
                      <span class="creation-card__badge" data-ref="badge-social-pin-carousel-ad">1000 × 1500 px</span>
                    </div>
                    <div class="creation-card__info" data-ref="info-social-pin-carousel-ad">
                      <h4 class="creation-card__title" data-ref="title-social-pin-carousel-ad">Anuncio de carrusel para Pinterest</h4>
                      <p class="creation-card__meta" data-ref="meta-social-pin-carousel-ad">1000 × 1500 px</p>
                    </div>
                  </button>

                  <button type="button" class="creation-card" data-ref="card-social-pin-2-3" data-type="social" data-w="1000" data-h="1500" data-name="Pin de Pinterest (2:3)">
                    <div class="creation-card__thumbnail" data-ref="thumb-social-pin-2-3">
                      <img class="creation-card__img" data-ref="img-social-pin-2-3" src="https://category-public.canva.com/thumbnails/thumbnail_realistic25_pinterestpin_square.png" alt="Pin de Pinterest (2:3)" loading="lazy" />
                      <span class="creation-card__badge" data-ref="badge-social-pin-2-3">1000 × 1500 px</span>
                    </div>
                    <div class="creation-card__info" data-ref="info-social-pin-2-3">
                      <h4 class="creation-card__title" data-ref="title-social-pin-2-3">Pin de Pinterest (2:3)</h4>
                      <p class="creation-card__meta" data-ref="meta-social-pin-2-3">1000 × 1500 px</p>
                    </div>
                  </button>

                  <button type="button" class="creation-card" data-ref="card-social-pin-9-16" data-type="social" data-w="1080" data-h="1920" data-name="Pin de Pinterest (9:16)">
                    <div class="creation-card__thumbnail" data-ref="thumb-social-pin-9-16">
                      <img class="creation-card__img" data-ref="img-social-pin-9-16" src="https://category-public.canva.com/thumbnails/thumbnail_realistic25_pinterestpin_square.png" alt="Pin de Pinterest (9:16)" loading="lazy" />
                      <span class="creation-card__badge" data-ref="badge-social-pin-9-16">1080 × 1920 px</span>
                    </div>
                    <div class="creation-card__info" data-ref="info-social-pin-9-16">
                      <h4 class="creation-card__title" data-ref="title-social-pin-9-16">Pin de Pinterest (9:16)</h4>
                      <p class="creation-card__meta" data-ref="meta-social-pin-9-16">1080 × 1920 px</p>
                    </div>
                  </button>

                  <button type="button" class="creation-card" data-ref="card-social-pin-video-ad-square" data-type="social" data-w="1000" data-h="1000" data-name="Anuncio en video para Pinterest (cuadrado)">
                    <div class="creation-card__thumbnail" data-ref="thumb-social-pin-video-ad-square">
                      <img class="creation-card__img" data-ref="img-social-pin-video-ad-square" src="https://category-public.canva.com/thumbnails/thumbnail_realistic25_pinterestad_square_red.svg" alt="Anuncio en video para Pinterest (cuadrado)" loading="lazy" />
                      <span class="creation-card__badge" data-ref="badge-social-pin-video-ad-square">1000 × 1000 px</span>
                    </div>
                    <div class="creation-card__info" data-ref="info-social-pin-video-ad-square">
                      <h4 class="creation-card__title" data-ref="title-social-pin-video-ad-square">Anuncio en video para Pinterest (cuadrado)</h4>
                      <p class="creation-card__meta" data-ref="meta-social-pin-video-ad-square">1000 × 1000 px</p>
                    </div>
                  </button>

                  <button type="button" class="creation-card" data-ref="card-social-pin-static-ad" data-type="social" data-w="1000" data-h="1500" data-name="Anuncio estático para Pinterest">
                    <div class="creation-card__thumbnail" data-ref="thumb-social-pin-static-ad">
                      <img class="creation-card__img" data-ref="img-social-pin-static-ad" src="https://category-public.canva.com/thumbnails/thumbnail_realistic25_pinterestad_square_red.svg" alt="Anuncio estático para Pinterest" loading="lazy" />
                      <span class="creation-card__badge" data-ref="badge-social-pin-static-ad">1000 × 1500 px</span>
                    </div>
                    <div class="creation-card__info" data-ref="info-social-pin-static-ad">
                      <h4 class="creation-card__title" data-ref="title-social-pin-static-ad">Anuncio estático para Pinterest</h4>
                      <p class="creation-card__meta" data-ref="meta-social-pin-static-ad">1000 × 1500 px</p>
                    </div>
                  </button>
                </div>
              </div>

              <div class="creation-category-section" data-ref="platform-content-tiktok" style="display: none;">
                <h3 class="creation-category-section__title">Formatos para TikTok</h3>
                <div class="creation-cards-grid" data-ref="grid-social-tiktok">
                  <button type="button" class="creation-card" data-ref="card-social-tt-video" data-type="social" data-w="1080" data-h="1920" data-name="Video para TikTok">
                    <div class="creation-card__thumbnail" data-ref="thumb-social-tt-video">
                      <img class="creation-card__img" data-ref="img-social-tt-video" src="https://category-public.canva.com/thumbnails/thumbnail_realistic25_tiktokvideo_square.png" alt="Video para TikTok" loading="lazy" />
                      <span class="creation-card__badge" data-ref="badge-social-tt-video">1080 × 1920 px</span>
                    </div>
                    <div class="creation-card__info" data-ref="info-social-tt-video">
                      <h4 class="creation-card__title" data-ref="title-social-tt-video">Video para TikTok</h4>
                      <p class="creation-card__meta" data-ref="meta-social-tt-video">1080 × 1920 px</p>
                    </div>
                  </button>

                  <button type="button" class="creation-card" data-ref="card-social-tt-story" data-type="social" data-w="1080" data-h="1920" data-name="Historia de TikTok">
                    <div class="creation-card__thumbnail" data-ref="thumb-social-tt-story">
                      <img class="creation-card__img" data-ref="img-social-tt-story" src="https://category-public.canva.com/thumbnails/thumbnail_realistic25_tiktokstory_square.png" alt="Historia de TikTok" loading="lazy" />
                      <span class="creation-card__badge" data-ref="badge-social-tt-story">1080 × 1920 px</span>
                    </div>
                    <div class="creation-card__info" data-ref="info-social-tt-story">
                      <h4 class="creation-card__title" data-ref="title-social-tt-story">Historia de TikTok</h4>
                      <p class="creation-card__meta" data-ref="meta-social-tt-story">1080 × 1920 px</p>
                    </div>
                  </button>

                  <button type="button" class="creation-card" data-ref="card-social-tt-profile" data-type="social" data-w="200" data-h="200" data-name="Foto del perfil de TikTok">
                    <div class="creation-card__thumbnail" data-ref="thumb-social-tt-profile">
                      <img class="creation-card__img" data-ref="img-social-tt-profile" src="https://category-public.canva.com/thumbnails/thumbnail_realistic25_tiktokprofilepicture_square.png" alt="Foto del perfil de TikTok" loading="lazy" />
                      <span class="creation-card__badge" data-ref="badge-social-tt-profile">200 × 200 px</span>
                    </div>
                    <div class="creation-card__info" data-ref="info-social-tt-profile">
                      <h4 class="creation-card__title" data-ref="title-social-tt-profile">Foto del perfil de TikTok</h4>
                      <p class="creation-card__meta" data-ref="meta-social-tt-profile">200 × 200 px</p>
                    </div>
                  </button>

                  <button type="button" class="creation-card" data-ref="card-social-tt-photo-vertical-1080" data-type="social" data-w="1080" data-h="1920" data-name="Modo foto de TikTok (Vertical)">
                    <div class="creation-card__thumbnail" data-ref="thumb-social-tt-photo-vertical-1080">
                      <img class="creation-card__img" data-ref="img-social-tt-photo-vertical-1080" src="https://category-public.canva.com/icons/default_portrait_shadow.svg" alt="Modo foto de TikTok (Vertical)" loading="lazy" />
                      <span class="creation-card__badge" data-ref="badge-social-tt-photo-vertical-1080">1080 × 1920 px</span>
                    </div>
                    <div class="creation-card__info" data-ref="info-social-tt-photo-vertical-1080">
                      <h4 class="creation-card__title" data-ref="title-social-tt-photo-vertical-1080">Modo foto de TikTok (Vertical)</h4>
                      <p class="creation-card__meta" data-ref="meta-social-tt-photo-vertical-1080">1080 × 1920 px</p>
                    </div>
                  </button>

                  <button type="button" class="creation-card" data-ref="card-social-tt-photo-vertical-960" data-type="social" data-w="960" data-h="1280" data-name="Modo foto de TikTok (Vertical)">
                    <div class="creation-card__thumbnail" data-ref="thumb-social-tt-photo-vertical-960">
                      <img class="creation-card__img" data-ref="img-social-tt-photo-vertical-960" src="https://category-public.canva.com/icons/default_portrait_shadow.svg" alt="Modo foto de TikTok (Vertical)" loading="lazy" />
                      <span class="creation-card__badge" data-ref="badge-social-tt-photo-vertical-960">960 × 1280 px</span>
                    </div>
                    <div class="creation-card__info" data-ref="info-social-tt-photo-vertical-960">
                      <h4 class="creation-card__title" data-ref="title-social-tt-photo-vertical-960">Modo foto de TikTok (Vertical)</h4>
                      <p class="creation-card__meta" data-ref="meta-social-tt-photo-vertical-960">960 × 1280 px</p>
                    </div>
                  </button>

                  <button type="button" class="creation-card" data-ref="card-social-tt-photo-square" data-type="social" data-w="1080" data-h="1080" data-name="Modo foto de TikTok (Cuadrado)">
                    <div class="creation-card__thumbnail" data-ref="thumb-social-tt-photo-square">
                      <img class="creation-card__img" data-ref="img-social-tt-photo-square" src="https://category-public.canva.com/icons/default_square_shadow.svg" alt="Modo foto de TikTok (Cuadrado)" loading="lazy" />
                      <span class="creation-card__badge" data-ref="badge-social-tt-photo-square">1080 × 1080 px</span>
                    </div>
                    <div class="creation-card__info" data-ref="info-social-tt-photo-square">
                      <h4 class="creation-card__title" data-ref="title-social-tt-photo-square">Modo foto de TikTok (Cuadrado)</h4>
                      <p class="creation-card__meta" data-ref="meta-social-tt-photo-square">1080 × 1080 px</p>
                    </div>
                  </button>
                </div>
              </div>

              <div class="creation-category-section" data-ref="platform-content-x" style="display: none;">
                <h3 class="creation-category-section__title">Formatos para X (Twitter)</h3>
                <div class="creation-cards-grid" data-ref="grid-social-x">
                  <button type="button" class="creation-card" data-ref="card-social-x-post" data-type="social" data-w="1600" data-h="900" data-name="Post de Twitter/X">
                    <div class="creation-card__thumbnail" data-ref="thumb-social-x-post">
                      <img class="creation-card__img" data-ref="img-social-x-post" src="https://category-public.canva.com/thumbnails/thumbnail_realistic25_xpost_square.png" alt="Post de Twitter/X" loading="lazy" />
                      <span class="creation-card__badge" data-ref="badge-social-x-post">1600 × 900 px</span>
                    </div>
                    <div class="creation-card__info" data-ref="info-social-x-post">
                      <h4 class="creation-card__title" data-ref="title-social-x-post">Post de Twitter/X</h4>
                      <p class="creation-card__meta" data-ref="meta-social-x-post">1600 × 900 px</p>
                    </div>
                  </button>

                  <button type="button" class="creation-card" data-ref="card-social-x-header" data-type="social" data-w="1500" data-h="500" data-name="Encabezado de Twitter/X">
                    <div class="creation-card__thumbnail" data-ref="thumb-social-x-header">
                      <img class="creation-card__img" data-ref="img-social-x-header" src="https://category-public.canva.com/thumbnails/thumbnail_realistic25_xheader_square.svg" alt="Encabezado de Twitter/X" loading="lazy" />
                      <span class="creation-card__badge" data-ref="badge-social-x-header">1500 × 500 px</span>
                    </div>
                    <div class="creation-card__info" data-ref="info-social-x-header">
                      <h4 class="creation-card__title" data-ref="title-social-x-header">Encabezado de Twitter/X</h4>
                      <p class="creation-card__meta" data-ref="meta-social-x-header">1500 × 500 px</p>
                    </div>
                  </button>

                  <button type="button" class="creation-card" data-ref="card-social-x-video" data-type="social" data-w="1600" data-h="900" data-name="Video de Twitter/X">
                    <div class="creation-card__thumbnail" data-ref="thumb-social-x-video">
                      <img class="creation-card__img" data-ref="img-social-x-video" src="https://category-public.canva.com/thumbnails/thumbnail_realistic25_xvideopost_square.png" alt="Video de Twitter/X" loading="lazy" />
                      <span class="creation-card__badge" data-ref="badge-social-x-video">1600 × 900 px</span>
                    </div>
                    <div class="creation-card__info" data-ref="info-social-x-video">
                      <h4 class="creation-card__title" data-ref="title-social-x-video">Video de Twitter/X</h4>
                      <p class="creation-card__meta" data-ref="meta-social-x-video">1600 × 900 px</p>
                    </div>
                  </button>

                  <button type="button" class="creation-card" data-ref="card-social-x-ad" data-type="social" data-w="1600" data-h="900" data-name="Anuncio de Twitter/X">
                    <div class="creation-card__thumbnail" data-ref="thumb-social-x-ad">
                      <img class="creation-card__img" data-ref="img-social-x-ad" src="https://category-public.canva.com/thumbnails/thumbnail_realistic25_xad_square.png" alt="Anuncio de Twitter/X" loading="lazy" />
                      <span class="creation-card__badge" data-ref="badge-social-x-ad">1600 × 900 px</span>
                    </div>
                    <div class="creation-card__info" data-ref="info-social-x-ad">
                      <h4 class="creation-card__title" data-ref="title-social-x-ad">Anuncio de Twitter/X</h4>
                      <p class="creation-card__meta" data-ref="meta-social-x-ad">1600 × 900 px</p>
                    </div>
                  </button>

                  <button type="button" class="creation-card" data-ref="card-social-x-profile" data-type="social" data-w="400" data-h="400" data-name="Foto del perfil de Twitter (cuadrado)">
                    <div class="creation-card__thumbnail" data-ref="thumb-social-x-profile">
                      <img class="creation-card__img" data-ref="img-social-x-profile" src="https://category-public.canva.com/thumbnails/thumbnail_TwitterProfilePicture_Square_X_1.png" alt="Foto del perfil de Twitter (cuadrado)" loading="lazy" />
                      <span class="creation-card__badge" data-ref="badge-social-x-profile">400 × 400 px</span>
                    </div>
                    <div class="creation-card__info" data-ref="info-social-x-profile">
                      <h4 class="creation-card__title" data-ref="title-social-x-profile">Foto del perfil de Twitter (cuadrado)</h4>
                      <p class="creation-card__meta" data-ref="meta-social-x-profile">400 × 400 px</p>
                    </div>
                  </button>
                </div>
              </div>

              <div class="creation-category-section" data-ref="platform-content-whatsapp" style="display: none;">
                <h3 class="creation-category-section__title">Formatos para WhatsApp</h3>
                <div class="creation-cards-grid" data-ref="grid-social-whatsapp">
                  <button type="button" class="creation-card" data-ref="card-social-wa-status" data-type="social" data-w="1080" data-h="1920" data-name="Estado de WhatsApp">
                    <div class="creation-card__thumbnail" data-ref="thumb-social-wa-status">
                      <img class="creation-card__img" data-ref="img-social-wa-status" src="https://category-public.canva.com/thumbnails/thumbnail_whatsapp_status_whatsapp1.png" alt="Estado de WhatsApp" loading="lazy" />
                      <span class="creation-card__badge" data-ref="badge-social-wa-status">1080 × 1920 px</span>
                    </div>
                    <div class="creation-card__info" data-ref="info-social-wa-status">
                      <h4 class="creation-card__title" data-ref="title-social-wa-status">Estado de WhatsApp</h4>
                      <p class="creation-card__meta" data-ref="meta-social-wa-status">1080 × 1920 px</p>
                    </div>
                  </button>

                  <button type="button" class="creation-card" data-ref="card-social-wa-post-vertical" data-type="social" data-w="1080" data-h="1350" data-name="Publicación de WhatsApp (Vertical)">
                    <div class="creation-card__thumbnail" data-ref="thumb-social-wa-post-vertical">
                      <img class="creation-card__img" data-ref="img-social-wa-post-vertical" src="https://category-public.canva.com/thumbnails/thumbnail_whatsapp_postwhatsapp_1.png" alt="Publicación de WhatsApp (Vertical)" loading="lazy" />
                      <span class="creation-card__badge" data-ref="badge-social-wa-post-vertical">1080 × 1350 px</span>
                    </div>
                    <div class="creation-card__info" data-ref="info-social-wa-post-vertical">
                      <h4 class="creation-card__title" data-ref="title-social-wa-post-vertical">Publicación de WhatsApp (Vertical)</h4>
                      <p class="creation-card__meta" data-ref="meta-social-wa-post-vertical">1080 × 1350 px</p>
                    </div>
                  </button>

                  <button type="button" class="creation-card" data-ref="card-social-wa-post-horizontal" data-type="social" data-w="1600" data-h="1200" data-name="Publicación de WhatsApp (Horizontal)">
                    <div class="creation-card__thumbnail" data-ref="thumb-social-wa-post-horizontal">
                      <img class="creation-card__img" data-ref="img-social-wa-post-horizontal" src="https://category-public.canva.com/thumbnails/thumbnail_whatsapp_postwhatsapp_1.png" alt="Publicación de WhatsApp (Horizontal)" loading="lazy" />
                      <span class="creation-card__badge" data-ref="badge-social-wa-post-horizontal">1600 × 1200 px</span>
                    </div>
                    <div class="creation-card__info" data-ref="info-social-wa-post-horizontal">
                      <h4 class="creation-card__title" data-ref="title-social-wa-post-horizontal">Publicación de WhatsApp (Horizontal)</h4>
                      <p class="creation-card__meta" data-ref="meta-social-wa-post-horizontal">1600 × 1200 px</p>
                    </div>
                  </button>

                  <button type="button" class="creation-card" data-ref="card-social-wa-post-square" data-type="social" data-w="1080" data-h="1080" data-name="Publicación de WhatsApp (Cuadrado)">
                    <div class="creation-card__thumbnail" data-ref="thumb-social-wa-post-square">
                      <img class="creation-card__img" data-ref="img-social-wa-post-square" src="https://category-public.canva.com/thumbnails/thumbnail_whatsapp_postwhatsapp_1.png" alt="Publicación de WhatsApp (Cuadrado)" loading="lazy" />
                      <span class="creation-card__badge" data-ref="badge-social-wa-post-square">1080 × 1080 px</span>
                    </div>
                    <div class="creation-card__info" data-ref="info-social-wa-post-square">
                      <h4 class="creation-card__title" data-ref="title-social-wa-post-square">Publicación de WhatsApp (Cuadrado)</h4>
                      <p class="creation-card__meta" data-ref="meta-social-wa-post-square">1080 × 1080 px</p>
                    </div>
                  </button>

                  <button type="button" class="creation-card" data-ref="card-social-wa-card-vertical" data-type="social" data-w="1080" data-h="1350" data-name="Tarjeta de WhatsApp (Vertical)">
                    <div class="creation-card__thumbnail" data-ref="thumb-social-wa-card-vertical">
                      <img class="creation-card__img" data-ref="img-social-wa-card-vertical" src="https://category-public.canva.com/thumbnails/thumbnail_whatsapp_card_whatsapp_1.png" alt="Tarjeta de WhatsApp (Vertical)" loading="lazy" />
                      <span class="creation-card__badge" data-ref="badge-social-wa-card-vertical">1080 × 1350 px</span>
                    </div>
                    <div class="creation-card__info" data-ref="info-social-wa-card-vertical">
                      <h4 class="creation-card__title" data-ref="title-social-wa-card-vertical">Tarjeta de WhatsApp (Vertical)</h4>
                      <p class="creation-card__meta" data-ref="meta-social-wa-card-vertical">1080 × 1350 px</p>
                    </div>
                  </button>
                </div>
              </div>

              <div class="creation-category-section" data-ref="platform-content-youtube" style="display: none;">
                <h3 class="creation-category-section__title">Formatos para YouTube</h3>
                <div class="creation-cards-grid" data-ref="grid-social-youtube">
                  <button type="button" class="creation-card" data-ref="card-social-yt-video" data-type="social" data-w="1920" data-h="1080" data-name="Video de YouTube">
                    <div class="creation-card__thumbnail" data-ref="thumb-social-yt-video">
                      <img class="creation-card__img" data-ref="img-social-yt-video" src="https://category-public.canva.com/thumbnails/thumbnail_realistic25_youtubevideo_square.png" alt="Video de YouTube" loading="lazy" />
                      <span class="creation-card__badge" data-ref="badge-social-yt-video">1920 × 1080 px</span>
                    </div>
                    <div class="creation-card__info" data-ref="info-social-yt-video">
                      <h4 class="creation-card__title" data-ref="title-social-yt-video">Video de YouTube</h4>
                      <p class="creation-card__meta" data-ref="meta-social-yt-video">1920 × 1080 px</p>
                    </div>
                  </button>

                  <button type="button" class="creation-card" data-ref="card-social-yt-shorts" data-type="social" data-w="1080" data-h="1920" data-name="Cortos para YouTube">
                    <div class="creation-card__thumbnail" data-ref="thumb-social-yt-shorts">
                      <img class="creation-card__img" data-ref="img-social-yt-shorts" src="https://category-public.canva.com/thumbnails/thumbnail_realistic25_youtubeshorts_square.png" alt="Cortos para YouTube" loading="lazy" />
                      <span class="creation-card__badge" data-ref="badge-social-yt-shorts">1080 × 1920 px</span>
                    </div>
                    <div class="creation-card__info" data-ref="info-social-yt-shorts">
                      <h4 class="creation-card__title" data-ref="title-social-yt-shorts">Cortos para YouTube</h4>
                      <p class="creation-card__meta" data-ref="meta-social-yt-shorts">1080 × 1920 px</p>
                    </div>
                  </button>

                  <button type="button" class="creation-card" data-ref="card-social-yt-thumbnail" data-type="social" data-w="1280" data-h="720" data-name="Miniatura de YouTube">
                    <div class="creation-card__thumbnail" data-ref="thumb-social-yt-thumbnail">
                      <img class="creation-card__img" data-ref="img-social-yt-thumbnail" src="https://category-public.canva.com/thumbnails/thumbnail_realistic25_youtubethumbnail_square.png" alt="Miniatura de YouTube" loading="lazy" />
                      <span class="creation-card__badge" data-ref="badge-social-yt-thumbnail">1280 × 720 px</span>
                    </div>
                    <div class="creation-card__info" data-ref="info-social-yt-thumbnail">
                      <h4 class="creation-card__title" data-ref="title-social-yt-thumbnail">Miniatura de YouTube</h4>
                      <p class="creation-card__meta" data-ref="meta-social-yt-thumbnail">1280 × 720 px</p>
                    </div>
                  </button>

                  <button type="button" class="creation-card" data-ref="card-social-yt-banner" data-type="social" data-w="2560" data-h="1440" data-name="Banner para YouTube">
                    <div class="creation-card__thumbnail" data-ref="thumb-social-yt-banner">
                      <img class="creation-card__img" data-ref="img-social-yt-banner" src="https://category-public.canva.com/thumbnails/thumbnail_realistic25_youtubebanner_square.png" alt="Banner para YouTube" loading="lazy" />
                      <span class="creation-card__badge" data-ref="badge-social-yt-banner">2560 × 1440 px</span>
                    </div>
                    <div class="creation-card__info" data-ref="info-social-yt-banner">
                      <h4 class="creation-card__title" data-ref="title-social-yt-banner">Banner para YouTube</h4>
                      <p class="creation-card__meta" data-ref="meta-social-yt-banner">2560 × 1440 px</p>
                    </div>
                  </button>

                  <button type="button" class="creation-card" data-ref="card-social-yt-channel-logo" data-type="social" data-w="800" data-h="800" data-name="Logo para canal de YouTube">
                    <div class="creation-card__thumbnail" data-ref="thumb-social-yt-channel-logo">
                      <img class="creation-card__img" data-ref="img-social-yt-channel-logo" src="https://category-public.canva.com/thumbnails/thumbnail_realistic25_youtubechannellogo_square.svg" alt="Logo para canal de YouTube" loading="lazy" />
                      <span class="creation-card__badge" data-ref="badge-social-yt-channel-logo">800 × 800 px</span>
                    </div>
                    <div class="creation-card__info" data-ref="info-social-yt-channel-logo">
                      <h4 class="creation-card__title" data-ref="title-social-yt-channel-logo">Logo para canal de YouTube</h4>
                      <p class="creation-card__meta" data-ref="meta-social-yt-channel-logo">800 × 800 px</p>
                    </div>
                  </button>

                  <button type="button" class="creation-card" data-ref="card-social-yt-display-ad" data-type="social" data-w="300" data-h="60" data-name="Anuncio en pantalla para YouTube">
                    <div class="creation-card__thumbnail" data-ref="thumb-social-yt-display-ad">
                      <img class="creation-card__img" data-ref="img-social-yt-display-ad" src="https://category-public.canva.com/thumbnails/thumbnail_realistic25_youtubedisplayad_square_red.svg" alt="Anuncio en pantalla para YouTube" loading="lazy" />
                      <span class="creation-card__badge" data-ref="badge-social-yt-display-ad">300 × 60 px</span>
                    </div>
                    <div class="creation-card__info" data-ref="info-social-yt-display-ad">
                      <h4 class="creation-card__title" data-ref="title-social-yt-display-ad">Anuncio en pantalla para YouTube</h4>
                      <p class="creation-card__meta" data-ref="meta-social-yt-display-ad">300 × 60 px</p>
                    </div>
                  </button>

                  <button type="button" class="creation-card" data-ref="card-social-yt-profile" data-type="social" data-w="800" data-h="800" data-name="Foto del perfil de YouTube">
                    <div class="creation-card__thumbnail" data-ref="thumb-social-yt-profile">
                      <img class="creation-card__img" data-ref="img-social-yt-profile" src="https://category-public.canva.com/thumbnails/thumbnail_realistic25_youtubeprofilepicture_square.png" alt="Foto del perfil de YouTube" loading="lazy" />
                      <span class="creation-card__badge" data-ref="badge-social-yt-profile">800 × 800 px</span>
                    </div>
                    <div class="creation-card__info" data-ref="info-social-yt-profile">
                      <h4 class="creation-card__title" data-ref="title-social-yt-profile">Foto del perfil de YouTube</h4>
                      <p class="creation-card__meta" data-ref="meta-social-yt-profile">800 × 800 px</p>
                    </div>
                  </button>

                  <button type="button" class="creation-card" data-ref="card-social-yt-video-ad-landscape" data-type="social" data-w="1920" data-h="1080" data-name="anuncio para YouTube (Horizontal)">
                    <div class="creation-card__thumbnail" data-ref="thumb-social-yt-video-ad-landscape">
                      <img class="creation-card__img" data-ref="img-social-yt-video-ad-landscape" src="https://category-public.canva.com/thumbnails/thumbnail_realistic25_youtubevideoad_square.png" alt="anuncio para YouTube (Horizontal)" loading="lazy" />
                      <span class="creation-card__badge" data-ref="badge-social-yt-video-ad-landscape">1920 × 1080 px</span>
                    </div>
                    <div class="creation-card__info" data-ref="info-social-yt-video-ad-landscape">
                      <h4 class="creation-card__title" data-ref="title-social-yt-video-ad-landscape">anuncio para YouTube (Horizontal)</h4>
                      <p class="creation-card__meta" data-ref="meta-social-yt-video-ad-landscape">1920 × 1080 px</p>
                    </div>
                  </button>

                  <button type="button" class="creation-card" data-ref="card-social-yt-video-ad-portrait" data-type="social" data-w="1080" data-h="1920" data-name="anuncio para YouTube (Vertical)">
                    <div class="creation-card__thumbnail" data-ref="thumb-social-yt-video-ad-portrait">
                      <img class="creation-card__img" data-ref="img-social-yt-video-ad-portrait" src="https://category-public.canva.com/thumbnails/thumbnail_realistic25_youtubevideoad_square.png" alt="anuncio para YouTube (Vertical)" loading="lazy" />
                      <span class="creation-card__badge" data-ref="badge-social-yt-video-ad-portrait">1080 × 1920 px</span>
                    </div>
                    <div class="creation-card__info" data-ref="info-social-yt-video-ad-portrait">
                      <h4 class="creation-card__title" data-ref="title-social-yt-video-ad-portrait">anuncio para YouTube (Vertical)</h4>
                      <p class="creation-card__meta" data-ref="meta-social-yt-video-ad-portrait">1080 × 1920 px</p>
                    </div>
                  </button>

                  <button type="button" class="creation-card" data-ref="card-social-yt-video-chapter" data-type="social" data-w="1920" data-h="1080" data-name="Capítulo de video de YouTube">
                    <div class="creation-card__thumbnail" data-ref="thumb-social-yt-video-chapter">
                      <img class="creation-card__img" data-ref="img-social-yt-video-chapter" src="https://category-public.canva.com/thumbnails/thumbnail_Youtube_Video_Chapter_youtube_1.png" alt="Capítulo de video de YouTube" loading="lazy" />
                      <span class="creation-card__badge" data-ref="badge-social-yt-video-chapter">1920 × 1080 px</span>
                    </div>
                    <div class="creation-card__info" data-ref="info-social-yt-video-chapter">
                      <h4 class="creation-card__title" data-ref="title-social-yt-video-chapter">Capítulo de video de YouTube</h4>
                      <p class="creation-card__meta" data-ref="meta-social-yt-video-chapter">1920 × 1080 px</p>
                    </div>
                  </button>

                  <button type="button" class="creation-card" data-ref="card-social-yt-livestream-video" data-type="social" data-w="1920" data-h="1080" data-name="Video de transmisión en directo de YouTube">
                    <div class="creation-card__thumbnail" data-ref="thumb-social-yt-livestream-video">
                      <img class="creation-card__img" data-ref="img-social-yt-livestream-video" src="https://category-public.canva.com/thumbnails/thumbnail_YouTube_Livestream_Video_youtube_1.png" alt="Video de transmisión en directo de YouTube" loading="lazy" />
                      <span class="creation-card__badge" data-ref="badge-social-yt-livestream-video">1920 × 1080 px</span>
                    </div>
                    <div class="creation-card__info" data-ref="info-social-yt-livestream-video">
                      <h4 class="creation-card__title" data-ref="title-social-yt-livestream-video">Video de transmisión en directo de YouTube</h4>
                      <p class="creation-card__meta" data-ref="meta-social-yt-livestream-video">1920 × 1080 px</p>
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

  const navItems = backdrop.querySelectorAll<HTMLElement>('[data-category]');
  const panels = backdrop.querySelectorAll<HTMLElement>('[data-ref^="panel-category-"]');
  const searchInput = backdrop.querySelector<HTMLInputElement>('[data-ref="modal-search-input"]');
  const errorBanner = backdrop.querySelector<HTMLElement>('[data-ref="create-canvas-error"]');
  const btnClose = backdrop.querySelector<HTMLElement>('[data-ref="btn-modal-close"]');

  const filterCards = (query: string) => {
    const q = query.trim().toLowerCase();
    const activePanelEl = backdrop.querySelector<HTMLElement>(`[data-ref="panel-category-${activeCategory}"]`);
    if (!activePanelEl) return;

    const cards = activePanelEl.querySelectorAll<HTMLElement>('.creation-card');
    cards.forEach((card) => {
      if (!q) {
        card.style.display = '';
        return;
      }
      const title = card.querySelector('.creation-card__title')?.textContent?.toLowerCase() || '';
      const meta = card.querySelector('.creation-card__meta')?.textContent?.toLowerCase() || '';
      const badge = card.querySelector('.creation-card__badge')?.textContent?.toLowerCase() || '';
      const matches = title.includes(q) || meta.includes(q) || badge.includes(q);
      card.style.display = matches ? '' : 'none';
    });
  };

  searchInput?.addEventListener('input', () => {
    filterCards(searchInput.value);
  });

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
      activePanel.style.display = 'block';
    }

    if (searchInput && searchInput.value) {
      filterCards(searchInput.value);
    }

    if (errorBanner) {
      errorBanner.style.display = 'none';
    }
  };

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
      const cardTitle = card.getAttribute('data-name') || card.querySelector('.creation-card__title')?.textContent?.trim() || 'Pizarrón';
      const name = `${cardTitle} sin título`;
      void handleInstantCreation({
        bgType: 'dots',
        canvasType: 'board',
        name,
        solidColor: '#ffffff',
      }, card);
    });
  });

  const sheetCards = backdrop.querySelectorAll<HTMLElement>('[data-ref^="card-sheet-"]');
  sheetCards.forEach((card) => {
    card.addEventListener('click', () => {
      const cardTitle = card.getAttribute('data-name') || card.querySelector('.creation-card__title')?.textContent?.trim() || 'Hoja de cálculo';
      const name = `${cardTitle} sin título`;
      void handleInstantCreation({
        canvasType: 'sheet',
        name,
      }, card);
    });
  });

  const presCards = backdrop.querySelectorAll<HTMLElement>('[data-ref^="card-pres-"]');
  presCards.forEach((card) => {
    card.addEventListener('click', () => {
      const w = parseInt(card.getAttribute('data-w') || '1920', 10);
      const h = parseInt(card.getAttribute('data-h') || '1080', 10);
      const cardTitle = card.getAttribute('data-name') || card.querySelector('.creation-card__title')?.textContent?.trim() || 'Presentación';
      const name = `${cardTitle} sin título`;
      void handleInstantCreation({
        canvasType: 'presentation',
        height: h,
        name,
        width: w,
      }, card);
    });
  });

  const docCards = backdrop.querySelectorAll<HTMLElement>('[data-ref^="card-doc-"]');
  docCards.forEach((card) => {
    card.addEventListener('click', () => {
      const paper = (card.getAttribute('data-paper') as DocPaperSize) || 'letter';
      const templateId = card.getAttribute('data-template') || 'blank';
      const cardTitle = card.getAttribute('data-name') || card.querySelector('.creation-card__title')?.textContent?.trim() || `Documento ${paper.toUpperCase()}`;
      const name = `${cardTitle} sin título`;
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
      const cardTitle = card.getAttribute('data-name') || card.querySelector('.creation-card__title')?.textContent?.trim() || 'Video';
      const name = `${cardTitle} sin título`;
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
  const platformSections = backdrop.querySelectorAll<HTMLElement>('[data-ref^="platform-content-"]');
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

      platformSections.forEach((sec) => {
        sec.style.display = 'none';
      });

      const activePlatformSec = backdrop.querySelector<HTMLElement>(`[data-ref="platform-content-${platform}"]`);
      if (activePlatformSec) {
        activePlatformSec.style.display = 'block';
      } else if (otherContent) {
        otherContent.style.display = 'block';
        if (otherText) {
          otherText.textContent = `Formatos para ${platformNames[platform] || platform} disponibles próximamente.`;
        }
      }

      if (searchInput && searchInput.value) {
        filterCards(searchInput.value);
      }
    });
  });

  const socialCards = backdrop.querySelectorAll<HTMLElement>('[data-ref^="card-social-"]');
  socialCards.forEach((card) => {
    card.addEventListener('click', () => {
      const w = parseInt(card.getAttribute('data-w') || '1080', 10);
      const h = parseInt(card.getAttribute('data-h') || '1080', 10);
      const cardTitle = card.getAttribute('data-name') || card.querySelector('.creation-card__title')?.textContent?.trim() || 'Diseño para redes';
      const name = `${cardTitle} sin título`;
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
  const dropdownWrapperUnit = backdrop.querySelector<HTMLElement>('[data-ref="dropdown-wrapper-custom-unit"]');
  const unitSelectedText = backdrop.querySelector<HTMLElement>('[data-ref="custom-unit-selected-text"]');
  const btnSubmitCustom = backdrop.querySelector<HTMLElement>('[data-ref="btn-submit-custom-size"]');
  let selectedUnit = 'px';

  if (dropdownWrapperUnit) {
    setupDropdown(dropdownWrapperUnit, {
      isSelect: true,
      onSelect: (val) => {
        if (typeof val === 'string') {
          selectedUnit = val;
          if (unitSelectedText) {
            unitSelectedText.textContent = val;
          }
        }
      },
    });
  }

  btnSubmitCustom?.addEventListener('click', () => {
    const rawW = parseFloat(inputCustomW?.value || '1920') || 1920;
    const rawH = parseFloat(inputCustomH?.value || '1080') || 1080;
    const unit = selectedUnit || unitSelectedText?.textContent?.trim() || 'px';
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
      selectedUnit = unit;
      if (unitSelectedText) unitSelectedText.textContent = unit;
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

