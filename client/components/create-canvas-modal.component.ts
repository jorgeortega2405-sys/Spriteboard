import { navigate } from '../app-router.js';
import { API_ROUTES } from '../config/api-routes.js';
import { currentUser, postApi } from '../services/api.service.js';
import { saveLocalCanvas } from '../services/canvas-storage.service.js';
import { renderIcons } from '../services/icon.service.js';
import { t, translateElement } from '../services/i18n.service.js';
import { showToast } from '../services/toast.service.js';

let activeCreateCanvasModal: { close: () => void } | null = null;

export function openCreateCanvasModal(): void {
  if (activeCreateCanvasModal) {
    activeCreateCanvasModal.close();
  }

  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.setAttribute('data-ref', 'modal-create-canvas-backdrop');

  backdrop.innerHTML = `
    <div class="modal-container" data-ref="modal-create-canvas-container">
      <button type="button" class="modal-close-btn" data-ref="btn-modal-close" data-i18n-aria="modal.close" aria-label="${t('modal.close')}">
        <span class="material-symbols-rounded">close</span>
      </button>
      <div class="modal-card modal-card--create-canvas no-padding" data-ref="modal-card-create-canvas">
        <div class="modal-card__drag-zone" data-ref="modal-drag-zone" aria-hidden="true">
          <div class="modal-card__drag-handle"></div>
        </div>

        <div class="modal-create-canvas__sidebar" data-ref="modal-create-canvas-sidebar">
          <div class="modal-create-canvas__sidebar-top" data-ref="modal-sidebar-top">
            <div class="component-top-left" data-ref="modal-sidebar-top-left">
              <h1 class="component-top-title" data-i18n="canvas.modal_title">${t('canvas.modal_title')}</h1>
            </div>
          </div>
          <div class="modal-create-canvas__sidebar-bottom" data-ref="modal-sidebar-bottom">
            <div class="menu-panel__list" data-ref="modal-nav-list">
              <button type="button" class="menu-item is-active" data-ref="tab-for-you">
                <span class="material-symbols-rounded menu-item__icon">recommend</span>
                <span class="menu-item__text" data-i18n="canvas.tab_for_you">${t('canvas.tab_for_you')}</span>
              </button>
              <button type="button" class="menu-item" data-ref="tab-custom-size">
                <span class="material-symbols-rounded menu-item__icon">aspect_ratio</span>
                <span class="menu-item__text" data-i18n="canvas.tab_custom_size">${t('canvas.tab_custom_size')}</span>
              </button>
              <button type="button" class="menu-item" data-ref="tab-upload">
                <span class="material-symbols-rounded menu-item__icon">cloud_upload</span>
                <span class="menu-item__text" data-i18n="canvas.tab_upload">${t('canvas.tab_upload')}</span>
              </button>
            </div>
          </div>
        </div>

        <div class="modal-create-canvas__body" data-ref="modal-create-canvas-body">
          <div class="modal-create-canvas__body-top" data-ref="modal-body-top">
            <div class="component-search component-search--full" data-ref="modal-search-box">
              <div class="component-search__icon" data-ref="modal-search-icon">
                <span class="material-symbols-rounded">search</span>
              </div>
              <div class="component-search__input-box" data-ref="modal-search-input-box">
                <input class="component-search__input" data-ref="modal-search-input" data-i18n-placeholder="canvas.search_placeholder" type="text" maxlength="100" autocomplete="off" placeholder="${t('canvas.search_placeholder')}" />
              </div>
            </div>
          </div>

          <div class="modal-create-canvas__body-bottom" data-ref="modal-body-bottom">
            <div class="modal-canvas-panel" data-ref="panel-for-you">
              <div class="modal-presets-container" data-ref="modal-presets-container">
                <div class="preset-category" data-ref="preset-category-most-used">
                  <h4 class="preset-category__title" data-i18n="canvas.category_most_used">${t('canvas.category_most_used')}</h4>
                  <div class="preset-category__grid" data-ref="preset-grid-most-used">
                    <div class="preset-card" data-ref="preset-card-16">
                      <div class="preset-card__preview" data-ref="preset-preview-16">
                        <svg class="preset-card__art" viewBox="0 0 16 16" width="38" height="38" shape-rendering="crispEdges">
                          <rect x="6" y="1" width="4" height="2" fill="#8B5A2B"/>
                          <rect x="5" y="3" width="6" height="2" fill="#E2E8F0"/>
                          <rect x="4" y="5" width="8" height="2" fill="#CBD5E1"/>
                          <rect x="3" y="7" width="10" height="7" fill="#3B82F6"/>
                          <rect x="4" y="8" width="3" height="3" fill="#93C5FD"/>
                          <rect x="4" y="8" width="1" height="1" fill="#FFFFFF"/>
                          <rect x="3" y="7" width="1" height="7" fill="#1D4ED8"/>
                          <rect x="12" y="7" width="1" height="7" fill="#1D4ED8"/>
                          <rect x="4" y="14" width="8" height="1" fill="#1D4ED8"/>
                        </svg>
                      </div>
                      <span class="preset-card__badge">16 × 16 px</span>
                      <div class="preset-card__info" data-ref="preset-info-16">
                        <span class="preset-card__name" data-i18n="canvas.preset_icon_name">${t('canvas.preset_icon_name')}</span>
                      </div>
                    </div>
                    <div class="preset-card" data-ref="preset-card-32">
                      <div class="preset-card__preview" data-ref="preset-preview-32">
                        <svg class="preset-card__art" viewBox="0 0 16 16" width="38" height="38" shape-rendering="crispEdges">
                          <rect x="5" y="1" width="6" height="4" fill="#94A3B8"/>
                          <rect x="5" y="5" width="6" height="2" fill="#0F172A"/>
                          <rect x="7" y="5" width="3" height="1" fill="#38BDF8"/>
                          <rect x="4" y="7" width="8" height="4" fill="#EF4444"/>
                          <rect x="3" y="8" width="1" height="3" fill="#FBBF24"/>
                          <rect x="12" y="7" width="1" height="5" fill="#E2E8F0"/>
                          <rect x="11" y="10" width="3" height="1" fill="#FBBF24"/>
                          <rect x="5" y="11" width="6" height="3" fill="#475569"/>
                          <rect x="5" y="14" width="2" height="2" fill="#0F172A"/>
                          <rect x="9" y="14" width="2" height="2" fill="#0F172A"/>
                        </svg>
                      </div>
                      <span class="preset-card__badge">32 × 32 px</span>
                      <div class="preset-card__info" data-ref="preset-info-32">
                        <span class="preset-card__name" data-i18n="canvas.preset_character_name">${t('canvas.preset_character_name')}</span>
                      </div>
                    </div>
                    <div class="preset-card" data-ref="preset-card-64">
                      <div class="preset-card__preview" data-ref="preset-preview-64">
                        <svg class="preset-card__art" viewBox="0 0 16 16" width="38" height="38" shape-rendering="crispEdges">
                          <rect x="2" y="1" width="2" height="3" fill="#EF4444"/>
                          <rect x="12" y="1" width="2" height="3" fill="#EF4444"/>
                          <rect x="4" y="3" width="8" height="8" fill="#10B981"/>
                          <rect x="5" y="5" width="2" height="2" fill="#FEF08A"/>
                          <rect x="9" y="5" width="2" height="2" fill="#FEF08A"/>
                          <rect x="6" y="5" width="1" height="2" fill="#0F172A"/>
                          <rect x="10" y="5" width="1" height="2" fill="#0F172A"/>
                          <rect x="5" y="9" width="6" height="2" fill="#047857"/>
                          <rect x="6" y="9" width="1" height="1" fill="#FFFFFF"/>
                          <rect x="9" y="9" width="1" height="1" fill="#FFFFFF"/>
                          <rect x="3" y="11" width="10" height="4" fill="#059669"/>
                        </svg>
                      </div>
                      <span class="preset-card__badge">64 × 64 px</span>
                      <div class="preset-card__info" data-ref="preset-info-64">
                        <span class="preset-card__name" data-i18n="canvas.preset_detailed_name">${t('canvas.preset_detailed_name')}</span>
                      </div>
                    </div>
                    <div class="preset-card" data-ref="preset-card-48">
                      <div class="preset-card__preview" data-ref="preset-preview-48">
                        <svg class="preset-card__art" viewBox="0 0 16 16" width="38" height="38" shape-rendering="crispEdges">
                          <rect x="1" y="2" width="14" height="4" fill="#22C55E"/>
                          <rect x="2" y="5" width="2" height="2" fill="#15803D"/>
                          <rect x="7" y="5" width="2" height="2" fill="#15803D"/>
                          <rect x="12" y="5" width="2" height="2" fill="#15803D"/>
                          <rect x="1" y="6" width="14" height="9" fill="#92400E"/>
                          <rect x="3" y="8" width="3" height="2" fill="#B45309"/>
                          <rect x="9" y="8" width="4" height="2" fill="#78350F"/>
                          <rect x="4" y="11" width="4" height="2" fill="#78350F"/>
                          <rect x="10" y="11" width="3" height="2" fill="#B45309"/>
                        </svg>
                      </div>
                      <span class="preset-card__badge">48 × 48 px</span>
                      <div class="preset-card__info" data-ref="preset-info-48">
                        <span class="preset-card__name" data-i18n="canvas.preset_tile_name">${t('canvas.preset_tile_name')}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div class="preset-category" data-ref="preset-category-popular">
                  <h4 class="preset-category__title" data-i18n="canvas.category_popular">${t('canvas.category_popular')}</h4>
                  <div class="preset-category__grid" data-ref="preset-grid-popular">
                    <div class="preset-card" data-ref="preset-card-128">
                      <div class="preset-card__preview" data-ref="preset-preview-128">
                        <svg class="preset-card__art" viewBox="0 0 16 16" width="38" height="38" shape-rendering="crispEdges">
                          <rect x="1" y="1" width="14" height="14" fill="#1E1B4B"/>
                          <rect x="10" y="2" width="3" height="3" fill="#FDE047"/>
                          <rect x="4" y="6" width="2" height="2" fill="#64748B"/>
                          <rect x="8" y="6" width="2" height="2" fill="#64748B"/>
                          <rect x="3" y="8" width="8" height="7" fill="#475569"/>
                          <rect x="6" y="11" width="2" height="4" fill="#0F172A"/>
                          <rect x="5" y="9" width="1" height="1" fill="#FDE047"/>
                          <rect x="8" y="9" width="1" height="1" fill="#FDE047"/>
                        </svg>
                      </div>
                      <span class="preset-card__badge">128 × 128 px</span>
                      <div class="preset-card__info" data-ref="preset-info-128">
                        <span class="preset-card__name" data-i18n="canvas.preset_retro_name">${t('canvas.preset_retro_name')}</span>
                      </div>
                    </div>
                    <div class="preset-card" data-ref="preset-card-256">
                      <div class="preset-card__preview" data-ref="preset-preview-256">
                        <svg class="preset-card__art" viewBox="0 0 16 16" width="38" height="38" shape-rendering="crispEdges">
                          <rect x="0" y="0" width="16" height="6" fill="#6366F1"/>
                          <rect x="2" y="2" width="1" height="1" fill="#FFFFFF"/>
                          <rect x="12" y="1" width="1" height="1" fill="#FFFFFF"/>
                          <rect x="8" y="3" width="1" height="1" fill="#FDE047"/>
                          <rect x="0" y="6" width="16" height="4" fill="#EC4899"/>
                          <polygon points="1,12 5,7 9,12" fill="#4338CA"/>
                          <polygon points="7,12 11,6 15,12" fill="#3730A3"/>
                          <rect x="0" y="12" width="16" height="4" fill="#1E1B4B"/>
                          <rect x="3" y="13" width="1" height="2" fill="#10B981"/>
                          <rect x="7" y="13" width="1" height="2" fill="#10B981"/>
                          <rect x="12" y="13" width="1" height="2" fill="#10B981"/>
                        </svg>
                      </div>
                      <span class="preset-card__badge">256 × 256 px</span>
                      <div class="preset-card__info" data-ref="preset-info-256">
                        <span class="preset-card__name" data-i18n="canvas.preset_background_name">${t('canvas.preset_background_name')}</span>
                      </div>
                    </div>
                    <div class="preset-card" data-ref="preset-card-320x180">
                      <div class="preset-card__preview" data-ref="preset-preview-320x180">
                        <svg class="preset-card__art" viewBox="0 0 20 12" width="46" height="28" shape-rendering="crispEdges">
                          <rect x="0" y="0" width="20" height="12" fill="#0F172A"/>
                          <rect x="2" y="2" width="3" height="3" fill="#F59E0B"/>
                          <rect x="8" y="4" width="4" height="1" fill="#38BDF8"/>
                          <rect x="15" y="2" width="2" height="2" fill="#EF4444"/>
                          <rect x="1" y="9" width="18" height="3" fill="#059669"/>
                          <rect x="4" y="7" width="2" height="2" fill="#6366F1"/>
                        </svg>
                      </div>
                      <span class="preset-card__badge">320 × 180 px</span>
                      <div class="preset-card__info" data-ref="preset-info-320x180">
                        <span class="preset-card__name" data-i18n="canvas.preset_banner_name">${t('canvas.preset_banner_name')}</span>
                      </div>
                    </div>
                    <div class="preset-card" data-ref="preset-card-512">
                      <div class="preset-card__preview" data-ref="preset-preview-512">
                        <svg class="preset-card__art" viewBox="0 0 16 16" width="38" height="38" shape-rendering="crispEdges">
                          <rect x="7" y="1" width="2" height="2" fill="#B45309"/>
                          <rect x="2" y="3" width="12" height="8" fill="#F8FAFC"/>
                          <rect x="4" y="5" width="4" height="4" fill="#3B82F6"/>
                          <rect x="8" y="7" width="4" height="2" fill="#EC4899"/>
                          <rect x="1" y="11" width="14" height="1" fill="#78350F"/>
                          <rect x="4" y="12" width="1" height="4" fill="#92400E"/>
                          <rect x="11" y="12" width="1" height="4" fill="#92400E"/>
                          <rect x="7" y="12" width="2" height="4" fill="#78350F"/>
                        </svg>
                      </div>
                      <span class="preset-card__badge">512 × 512 px</span>
                      <div class="preset-card__info" data-ref="preset-info-512">
                        <span class="preset-card__name" data-i18n="canvas.preset_hd_name">${t('canvas.preset_hd_name')}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div class="preset-category" data-ref="preset-category-try-something-new">
                  <h4 class="preset-category__title" data-i18n="canvas.category_try_something_new">${t('canvas.category_try_something_new')}</h4>
                  <div class="preset-category__grid" data-ref="preset-grid-try-something-new">
                    <div class="preset-card" data-ref="preset-card-400x150">
                      <div class="preset-card__preview" data-ref="preset-preview-400x150">
                        <svg class="preset-card__art" viewBox="0 0 24 10" width="48" height="20" shape-rendering="crispEdges">
                          <rect x="0" y="0" width="24" height="10" fill="#1E1B4B"/>
                          <rect x="2" y="3" width="4" height="7" fill="#312E81"/>
                          <rect x="3" y="4" width="1" height="1" fill="#FDE047"/>
                          <rect x="7" y="1" width="5" height="9" fill="#4338CA"/>
                          <rect x="9" y="2" width="1" height="1" fill="#38BDF8"/>
                          <rect x="9" y="5" width="1" height="1" fill="#38BDF8"/>
                          <rect x="13" y="4" width="4" height="6" fill="#312E81"/>
                          <rect x="15" y="6" width="1" height="1" fill="#F43F5E"/>
                          <rect x="18" y="2" width="4" height="8" fill="#4338CA"/>
                          <rect x="20" y="4" width="1" height="1" fill="#FDE047"/>
                        </svg>
                      </div>
                      <span class="preset-card__badge">400 × 150 px</span>
                      <div class="preset-card__info" data-ref="preset-info-400x150">
                        <span class="preset-card__name" data-i18n="canvas.preset_social_name">${t('canvas.preset_social_name')}</span>
                      </div>
                    </div>
                    <div class="preset-card" data-ref="preset-card-64x32">
                      <div class="preset-card__preview" data-ref="preset-preview-64x32">
                        <svg class="preset-card__art" viewBox="0 0 16 12" width="40" height="30" shape-rendering="crispEdges">
                          <polygon points="8,1 15,4 8,7 1,4" fill="#38BDF8"/>
                          <polygon points="1,4 8,7 8,11 1,8" fill="#0284C7"/>
                          <polygon points="8,7 15,4 15,8 8,11" fill="#0369A1"/>
                        </svg>
                      </div>
                      <span class="preset-card__badge">64 × 32 px</span>
                      <div class="preset-card__info" data-ref="preset-info-64x32">
                        <span class="preset-card__name" data-i18n="canvas.preset_isometric_name">${t('canvas.preset_isometric_name')}</span>
                      </div>
                    </div>
                    <div class="preset-card" data-ref="preset-card-640x360">
                      <div class="preset-card__preview" data-ref="preset-preview-640x360">
                        <svg class="preset-card__art" viewBox="0 0 20 12" width="46" height="28" shape-rendering="crispEdges">
                          <rect x="0" y="0" width="20" height="12" fill="#09090B"/>
                          <circle cx="10" cy="5" r="4" fill="#F43F5E"/>
                          <rect x="0" y="7" width="20" height="5" fill="#18181B"/>
                          <line x1="0" y1="9" x2="20" y2="9" stroke="#A855F7" stroke-width="0.75"/>
                          <line x1="0" y1="11" x2="20" y2="11" stroke="#A855F7" stroke-width="0.75"/>
                          <line x1="10" y1="7" x2="10" y2="12" stroke="#06B6D4" stroke-width="0.75"/>
                          <line x1="10" y1="7" x2="3" y2="12" stroke="#06B6D4" stroke-width="0.75"/>
                          <line x1="10" y1="7" x2="17" y2="12" stroke="#06B6D4" stroke-width="0.75"/>
                        </svg>
                      </div>
                      <span class="preset-card__badge">640 × 360 px</span>
                      <div class="preset-card__info" data-ref="preset-info-640x360">
                        <span class="preset-card__name" data-i18n="canvas.preset_widescreen_name">${t('canvas.preset_widescreen_name')}</span>
                      </div>
                    </div>
                    <div class="preset-card" data-ref="preset-card-1920x1080">
                      <div class="preset-card__preview" data-ref="preset-preview-1920x1080">
                        <svg class="preset-card__art" viewBox="0 0 18 14" width="42" height="32" shape-rendering="crispEdges">
                          <rect x="1" y="1" width="16" height="10" rx="1" fill="#27272A"/>
                          <rect x="2" y="2" width="14" height="8" fill="#3B82F6"/>
                          <rect x="4" y="4" width="1" height="1" fill="#FFFFFF"/>
                          <rect x="11" y="5" width="2" height="1" fill="#FBBF24"/>
                          <rect x="7" y="7" width="4" height="2" fill="#1D4ED8"/>
                          <rect x="8" y="11" width="2" height="2" fill="#71717A"/>
                          <rect x="6" y="13" width="6" height="1" fill="#52525B"/>
                        </svg>
                      </div>
                      <span class="preset-card__badge">1920 × 1080 px</span>
                      <div class="preset-card__info" data-ref="preset-info-1920x1080">
                        <span class="preset-card__name" data-i18n="canvas.preset_fhd_name">${t('canvas.preset_fhd_name')}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div class="modal-canvas-panel" data-ref="panel-custom-size" style="display: none;">
              <div class="modal-canvas-panel__header" data-ref="panel-custom-size-header">
                <h3 class="modal-canvas-panel__title" data-i18n="canvas.custom_size_title">
                  ${t('canvas.custom_size_title')}
                </h3>
                <p class="modal-canvas-panel__desc" data-i18n="canvas.custom_size_desc">
                  ${t('canvas.custom_size_desc')}
                </p>
              </div>

              <div class="modal-canvas-panel__form" data-ref="form-custom-size">
                <label class="field" data-ref="field-canvas-name">
                  <input class="field__input" data-ref="input-canvas-name" type="text" placeholder=" " value="${t('canvas.input_name_placeholder')}" maxlength="100" autocomplete="off" />
                  <span class="field__label" data-i18n="canvas.input_name_label">${t('canvas.input_name_label')}</span>
                </label>

                <div class="modal-canvas-panel__dimensions" data-ref="modal-dimensions-box">
                  <label class="field" data-ref="field-canvas-width">
                    <input class="field__input" data-ref="input-canvas-width" type="number" min="1" max="16384" value="64" placeholder=" " />
                    <span class="field__label" data-i18n="canvas.input_width_label">${t('canvas.input_width_label')}</span>
                  </label>

                  <label class="field" data-ref="field-canvas-height">
                    <input class="field__input" data-ref="input-canvas-height" type="number" min="1" max="16384" value="64" placeholder=" " />
                    <span class="field__label" data-i18n="canvas.input_height_label">${t('canvas.input_height_label')}</span>
                  </label>
                </div>

                <button type="button" class="btn btn--h44 btn--black btn--w-full" data-ref="btn-submit-create-canvas">
                  ${t('canvas.btn_create')}
                </button>

                <div class="banner banner--danger" data-ref="create-canvas-error" style="display: none;"></div>
              </div>
            </div>

            <div class="modal-canvas-panel" data-ref="panel-upload" style="display: none;">
              <div class="modal-canvas-panel__empty" data-ref="panel-upload-empty">
                <span class="material-symbols-rounded modal-canvas-panel__empty-icon">cloud_upload</span>
                <h4 class="modal-canvas-panel__empty-title" data-i18n="canvas.upload_title">
                  ${t('canvas.upload_title')}
                </h4>
                <p class="modal-canvas-panel__empty-desc" data-i18n="canvas.upload_desc">
                  ${t('canvas.upload_desc')}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  translateElement(backdrop);
  renderIcons(backdrop);

  const tabForYou = backdrop.querySelector<HTMLElement>('[data-ref="tab-for-you"]');
  const tabCustomSize = backdrop.querySelector<HTMLElement>('[data-ref="tab-custom-size"]');
  const tabUpload = backdrop.querySelector<HTMLElement>('[data-ref="tab-upload"]');

  const panelForYou = backdrop.querySelector<HTMLElement>('[data-ref="panel-for-you"]');
  const panelCustomSize = backdrop.querySelector<HTMLElement>('[data-ref="panel-custom-size"]');
  const panelUpload = backdrop.querySelector<HTMLElement>('[data-ref="panel-upload"]');

  const switchTab = (activeTab: 'for-you' | 'custom-size' | 'upload') => {
    tabForYou?.classList.toggle('is-active', activeTab === 'for-you');
    tabCustomSize?.classList.toggle('is-active', activeTab === 'custom-size');
    tabUpload?.classList.toggle('is-active', activeTab === 'upload');

    if (panelForYou) panelForYou.style.display = activeTab === 'for-you' ? 'flex' : 'none';
    if (panelCustomSize) panelCustomSize.style.display = activeTab === 'custom-size' ? 'flex' : 'none';
    if (panelUpload) panelUpload.style.display = activeTab === 'upload' ? 'flex' : 'none';
  };

  switchTab('for-you');

  tabForYou?.addEventListener('click', () => switchTab('for-you'));
  tabCustomSize?.addEventListener('click', () => switchTab('custom-size'));
  tabUpload?.addEventListener('click', () => switchTab('upload'));

  const closeBtn = backdrop.querySelector<HTMLElement>('[data-ref="btn-modal-close"]');
  const errorBanner = backdrop.querySelector<HTMLElement>('[data-ref="create-canvas-error"]');
  const btnSubmit = backdrop.querySelector<HTMLButtonElement>('[data-ref="btn-submit-create-canvas"]');
  const inputName = backdrop.querySelector<HTMLInputElement>('[data-ref="input-canvas-name"]');
  const inputWidth = backdrop.querySelector<HTMLInputElement>('[data-ref="input-canvas-width"]');
  const inputHeight = backdrop.querySelector<HTMLInputElement>('[data-ref="input-canvas-height"]');

  let isClosing = false;

  const closeModal = () => {
    if (isClosing) return;
    isClosing = true;
    backdrop.classList.remove('is-visible');
    document.removeEventListener('keydown', handleKeyDown);
    setTimeout(() => {
      if (backdrop.parentNode) {
        backdrop.parentNode.removeChild(backdrop);
      }
      if (activeCreateCanvasModal?.close === closeModal) {
        activeCreateCanvasModal = null;
      }
    }, 200);
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      closeModal();
    }
  };

  closeBtn?.addEventListener('click', closeModal);
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) {
      closeModal();
    }
  });
  document.addEventListener('keydown', handleKeyDown);

  const showError = (msg: string) => {
    if (errorBanner) {
      errorBanner.textContent = msg;
      errorBanner.style.display = 'block';
    }
  };

  const clearError = () => {
    if (errorBanner) {
      errorBanner.textContent = '';
      errorBanner.style.display = 'none';
    }
  };

  btnSubmit?.addEventListener('click', async () => {
    clearError();
    const name = inputName?.value.trim() || t('canvas.input_name_placeholder');
    const width = parseInt(inputWidth?.value || '0', 10);
    const height = parseInt(inputHeight?.value || '0', 10);

    if (isNaN(width) || width <= 0 || isNaN(height) || height <= 0) {
      showError('Las medidas deben ser números positivos mayores a 0.');
      return;
    }

    if (btnSubmit) {
      btnSubmit.disabled = true;
      btnSubmit.textContent = t('modal.loading');
    }

    try {
      if (currentUser) {
        const res = await postApi(API_ROUTES.canvases.base, {
          name,
          width,
          height,
          unit: 'px',
        });

        if (res.ok) {
          const data = await res.json();
          if (data && data.canvas) {
            showToast(t('canvas.create_success'));
            closeModal();
            window.dispatchEvent(new CustomEvent('canvas-created', { detail: data.canvas }));
            if (window.location.pathname !== '/') {
              navigate('/');
            }
            return;
          }
        }

        let errMsg = 'No se pudo crear el lienzo.';
        try {
          const errData = await res.json();
          if (errData && errData.error) errMsg = errData.error;
        } catch {}
        showError(errMsg);
      } else {
        const localUuid = crypto.randomUUID();
        const localCanvas = await saveLocalCanvas({
          uuid: localUuid,
          name,
          width,
          height,
          unit: 'px',
          is_local: true,
          created_at: new Date().toISOString(),
        });

        showToast(t('canvas.create_success'));
        closeModal();
        window.dispatchEvent(new CustomEvent('canvas-created', { detail: localCanvas }));
        if (window.location.pathname !== '/') {
          navigate('/');
        }
        return;
      }
    } catch {
      showError('Error al crear el lienzo. Intenta de nuevo.');
    } finally {
      if (btnSubmit) {
        btnSubmit.disabled = false;
        btnSubmit.textContent = t('canvas.btn_create');
      }
    }
  });

  document.body.appendChild(backdrop);
  requestAnimationFrame(() => {
    backdrop.classList.add('is-visible');
    inputName?.focus();
  });

  activeCreateCanvasModal = { close: closeModal };
}
