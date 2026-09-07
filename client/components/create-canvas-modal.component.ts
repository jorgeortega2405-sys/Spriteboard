import { navigate } from '../app-router.js';
import { API_ROUTES } from '../config/api-routes.js';
import { currentUser, postApi } from '../services/api.service.js';
import { saveLocalCanvas } from '../services/canvas-storage.service.js';
import { renderIcons } from '../services/icon.service.js';
import { t, translateElement } from '../services/i18n.service.js';
import { showToast } from '../services/toast.service.js';
import { getEmptyGraphicSvg, initCarouselScroll } from '../utils/dom.util.js';

let activeCreateCanvasModal: { close: () => void } | null = null;

interface PresetItem {
  id: string;
  name: string;
  width: number;
  height: number;
  category: 'most-used' | 'popular' | 'try-something-new';
  svgIcon: string;
}

const PRESETS: PresetItem[] = [
  {
    id: 'presentation',
    name: 'Presentación',
    width: 1920,
    height: 1080,
    category: 'most-used',
    svgIcon: `
      <svg viewBox="0 0 120 75" width="108" height="68" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="10" y="8" width="100" height="59" rx="6" fill="#ffffff" filter="drop-shadow(0 2px 8px rgba(0,0,0,0.3))"/>
        <rect x="18" y="16" width="30" height="4" rx="2" fill="#E2E8F0"/>
        <rect x="18" y="24" width="18" height="3" rx="1.5" fill="#CBD5E1"/>
        <path d="M18 54L38 48L54 53L76 36L92 42L102 32V60H18V54Z" fill="url(#orange_grad_pres)"/>
        <path d="M18 54L38 48L54 53L76 36L92 42L102 32" stroke="#FF5400" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
        <defs>
          <linearGradient id="orange_grad_pres" x1="60" y1="32" x2="60" y2="60" gradientUnits="userSpaceOnUse">
            <stop stop-color="#FF6B00"/>
            <stop offset="1" stop-color="#FF9E00" stop-opacity="0.2"/>
          </linearGradient>
        </defs>
      </svg>
    `,
  },
  {
    id: 'whiteboard',
    name: 'Pizarrón online',
    width: 48,
    height: 48,
    category: 'most-used',
    svgIcon: `
      <svg viewBox="0 0 120 75" width="108" height="68" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="10" y="8" width="100" height="59" rx="6" fill="#ffffff" filter="drop-shadow(0 2px 8px rgba(0,0,0,0.3))"/>
        <path d="M10 14C10 10.6863 12.6863 8 16 8H104C107.314 8 110 10.6863 110 14V20H10V14Z" fill="#00C48C"/>
        <rect x="22" y="28" width="28" height="28" rx="4" fill="#BBF7D0"/>
        <rect x="26" y="32" width="6" height="6" rx="1" fill="#16A34A"/>
        <path d="M26 44H42" stroke="#16A34A" stroke-width="2" stroke-linecap="round"/>
        <path d="M26 49H36" stroke="#16A34A" stroke-width="2" stroke-linecap="round"/>
        <g transform="translate(68, 28)">
          <path d="M12 2C12 2 4 10 4 18C4 22 7 26 12 26C17 26 20 22 20 18C20 10 12 2 12 2Z" fill="#059669"/>
          <path d="M12 4V24" stroke="#ffffff" stroke-width="1.5" stroke-linecap="round"/>
          <path d="M6 14C8 16 12 16 12 16" stroke="#ffffff" stroke-width="1.2" stroke-linecap="round"/>
          <path d="M18 14C16 16 12 16 12 16" stroke="#ffffff" stroke-width="1.2" stroke-linecap="round"/>
        </g>
      </svg>
    `,
  },
  {
    id: 'logo',
    name: 'Logo',
    width: 16,
    height: 16,
    category: 'most-used',
    svgIcon: `
      <svg viewBox="0 0 120 75" width="108" height="68" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="28" y="8" width="64" height="59" rx="6" fill="#ffffff" filter="drop-shadow(0 2px 8px rgba(0,0,0,0.3))"/>
        <path d="M68 20C62 20 54 24 50 30L44 42C42 46 45 50 50 50H70C76 50 80 44 78 38C76 32 74 20 68 20Z" stroke="#6366F1" stroke-width="3" stroke-linejoin="round" fill="none"/>
        <path d="M50 36C56 36 64 34 68 30" stroke="#6366F1" stroke-width="2.5" stroke-linecap="round"/>
        <circle cx="68" cy="26" r="2" fill="#6366F1"/>
        <rect x="42" y="56" width="36" height="3" rx="1.5" fill="#A5B4FC"/>
      </svg>
    `,
  },
  {
    id: 'character',
    name: 'Sprite estándar',
    width: 32,
    height: 32,
    category: 'most-used',
    svgIcon: `
      <svg viewBox="0 0 120 75" width="108" height="68" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="24" y="8" width="72" height="59" rx="6" fill="#1E293B" filter="drop-shadow(0 2px 8px rgba(0,0,0,0.3))"/>
        <rect x="44" y="16" width="32" height="26" rx="6" fill="#3B82F6"/>
        <rect x="48" y="24" width="24" height="8" rx="3" fill="#38BDF8"/>
        <circle cx="54" cy="28" r="2" fill="#ffffff"/>
        <circle cx="66" cy="28" r="2" fill="#ffffff"/>
        <path d="M40 50C40 44 48 44 60 44C72 44 80 44 80 50V58H40V50Z" fill="#2563EB"/>
        <circle cx="60" cy="50" r="3" fill="#FBBF24"/>
      </svg>
    `,
  },
  {
    id: 'document-a4',
    name: 'Documento (A4, vertical)',
    width: 64,
    height: 128,
    category: 'popular',
    svgIcon: `
      <svg viewBox="0 0 120 75" width="108" height="68" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M38 6H76L88 18V68C88 70.2091 86.2091 72 84 72H38C35.7909 72 34 70.2091 34 68V10C34 7.79086 35.7909 6 38 6Z" fill="#7C3AED" filter="drop-shadow(0 2px 8px rgba(0,0,0,0.3))"/>
        <path d="M76 6V16C76 17.1046 76.8954 18 78 18H88L76 6Z" fill="#A78BFA"/>
        <g transform="translate(61, 40)">
          <path d="M0 -14C4 -8 4 -4 0 0C-4 -4 -4 -8 0 -14Z" fill="#C4B5FD"/>
          <path d="M12 -8C10 -2 7 0 0 0C2 -5 6 -8 12 -8Z" fill="#DDD6FE"/>
          <path d="M-12 -8C-10 -2 -7 0 0 0C-2 -5 -6 -8 -12 -8Z" fill="#DDD6FE"/>
          <path d="M10 6C6 6 3 3 0 0C4 -1 8 1 10 6Z" fill="#C4B5FD"/>
          <path d="M-10 6C-6 6 -3 3 0 0C-4 -1 -8 1 -10 6Z" fill="#C4B5FD"/>
          <circle cx="0" cy="0" r="3" fill="#ffffff"/>
        </g>
        <rect x="44" y="58" width="32" height="3" rx="1.5" fill="#DDD6FE"/>
        <rect x="50" y="64" width="20" height="2" rx="1" fill="#C4B5FD"/>
      </svg>
    `,
  },
  {
    id: 'post-instagram',
    name: 'Post para Instagram (4:5)',
    width: 400,
    height: 150,
    category: 'popular',
    svgIcon: `
      <svg viewBox="0 0 120 75" width="108" height="68" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="42" y="6" width="36" height="66" rx="8" fill="#ffffff" stroke="#E2E8F0" stroke-width="1.5" filter="drop-shadow(0 2px 8px rgba(0,0,0,0.3))"/>
        <circle cx="60" cy="11" r="1.5" fill="#94A3B8"/>
        <rect x="46" y="16" width="28" height="34" rx="3" fill="#F87171"/>
        <circle cx="56" cy="26" r="4" fill="#FEF08A"/>
        <path d="M46 42L54 34L64 44L70 38L74 44V50H46V42Z" fill="#B91C1C"/>
        <rect x="46" y="54" width="20" height="3" rx="1.5" fill="#F59E0B"/>
        <rect x="46" y="59" width="14" height="2" rx="1" fill="#CBD5E1"/>
      </svg>
    `,
  },
  {
    id: 'poster',
    name: 'Póster (vertical 3:4)',
    width: 128,
    height: 128,
    category: 'popular',
    svgIcon: `
      <svg viewBox="0 0 120 75" width="108" height="68" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="36" y="6" width="48" height="64" rx="4" fill="#8B5CF6" filter="drop-shadow(0 2px 8px rgba(0,0,0,0.3))"/>
        <circle cx="60" cy="24" r="10" fill="#C4B5FD" fill-opacity="0.8"/>
        <rect x="44" y="38" width="14" height="14" rx="2" fill="#DDD6FE"/>
        <path d="M62 38H76V52C68.268 52 62 45.732 62 38Z" fill="#EDE9FE"/>
        <rect x="44" y="56" width="32" height="3" rx="1.5" fill="#ffffff"/>
        <rect x="44" y="61" width="22" height="2" rx="1" fill="#DDD6FE"/>
      </svg>
    `,
  },
  {
    id: 'doc-digital',
    name: 'Doc (Digital)',
    width: 256,
    height: 256,
    category: 'popular',
    svgIcon: `
      <svg viewBox="0 0 120 75" width="108" height="68" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="22" y="8" width="60" height="58" rx="4" fill="#ffffff" filter="drop-shadow(0 2px 8px rgba(0,0,0,0.3))"/>
        <path d="M22 12C22 9.79086 23.7909 8 26 8H78C80.2091 8 82 9.79086 82 12V20H22V12Z" fill="#0D9488"/>
        <circle cx="28" cy="14" r="2" fill="#ffffff"/>
        <path d="M22 50L36 44L48 52L62 38L74 44L82 36V66H22V50Z" fill="#99F6E4"/>
        <path d="M22 50L36 44L48 52L62 38L74 44L82 36" stroke="#0D9488" stroke-width="2" stroke-linecap="round"/>
        <rect x="68" y="24" width="28" height="46" rx="6" fill="#ffffff" stroke="#CBD5E1" stroke-width="1.2" filter="drop-shadow(0 2px 6px rgba(0,0,0,0.25))"/>
        <rect x="72" y="30" width="20" height="12" rx="2" fill="#F0FDFA"/>
        <path d="M72 54L80 48L88 52L92 46V64H72V54Z" fill="#2DD4BF"/>
        <circle cx="82" cy="27" r="1" fill="#94A3B8"/>
      </svg>
    `,
  },
  {
    id: 'game-banner',
    name: 'Game banner',
    width: 320,
    height: 180,
    category: 'popular',
    svgIcon: `
      <svg viewBox="0 0 120 75" width="108" height="68" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="12" y="10" width="96" height="54" rx="6" fill="#0F172A" filter="drop-shadow(0 2px 8px rgba(0,0,0,0.3))"/>
        <circle cx="60" cy="30" r="12" fill="#F59E0B"/>
        <polygon points="12,64 36,40 60,64" fill="#3B82F6"/>
        <polygon points="48,64 74,32 100,64" fill="#1D4ED8"/>
        <polygon points="80,64 96,46 108,64" fill="#1E40AF"/>
        <rect x="12" y="58" width="96" height="6" rx="2" fill="#059669"/>
      </svg>
    `,
  },
  {
    id: 'hd-art',
    name: 'Ilustración HD',
    width: 512,
    height: 512,
    category: 'popular',
    svgIcon: `
      <svg viewBox="0 0 120 75" width="108" height="68" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="24" y="8" width="72" height="58" rx="6" fill="#18181B" filter="drop-shadow(0 2px 8px rgba(0,0,0,0.3))"/>
        <circle cx="60" cy="34" r="18" fill="url(#hd_grad)"/>
        <circle cx="52" cy="28" r="3" fill="#ffffff"/>
        <circle cx="68" cy="28" r="3" fill="#FDE047"/>
        <circle cx="54" cy="40" r="3" fill="#38BDF8"/>
        <circle cx="66" cy="40" r="3" fill="#4ADE80"/>
        <path d="M36 56C48 50 72 50 84 56" stroke="#EC4899" stroke-width="3" stroke-linecap="round"/>
        <defs>
          <linearGradient id="hd_grad" x1="42" y1="16" x2="78" y2="52" gradientUnits="userSpaceOnUse">
            <stop stop-color="#8B5CF6"/>
            <stop offset="1" stop-color="#EC4899"/>
          </linearGradient>
        </defs>
      </svg>
    `,
  },
  {
    id: 'isometric',
    name: 'Sprite isométrico',
    width: 64,
    height: 32,
    category: 'try-something-new',
    svgIcon: `
      <svg viewBox="0 0 120 75" width="108" height="68" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="20" y="8" width="80" height="58" rx="6" fill="#09090B" filter="drop-shadow(0 2px 8px rgba(0,0,0,0.3))"/>
        <polygon points="60,18 86,30 60,42 34,30" fill="#38BDF8"/>
        <polygon points="34,30 60,42 60,60 34,48" fill="#0284C7"/>
        <polygon points="60,42 86,30 86,48 60,60" fill="#0369A1"/>
        <polygon points="60,24 74,30 60,36 46,30" fill="#BAE6FD"/>
      </svg>
    `,
  },
  {
    id: 'widescreen',
    name: 'Cinemática panorámica',
    width: 640,
    height: 360,
    category: 'try-something-new',
    svgIcon: `
      <svg viewBox="0 0 120 75" width="108" height="68" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="10" y="10" width="100" height="54" rx="6" fill="#09090B" filter="drop-shadow(0 2px 8px rgba(0,0,0,0.3))"/>
        <circle cx="60" cy="32" r="14" fill="#F43F5E"/>
        <rect x="10" y="38" width="100" height="26" rx="2" fill="#18181B"/>
        <line x1="10" y1="44" x2="110" y2="44" stroke="#A855F7" stroke-width="1.2"/>
        <line x1="10" y1="52" x2="110" y2="52" stroke="#A855F7" stroke-width="1.2"/>
        <line x1="60" y1="38" x2="60" y2="64" stroke="#06B6D4" stroke-width="1.2"/>
        <line x1="60" y1="38" x2="25" y2="64" stroke="#06B6D4" stroke-width="1.2"/>
        <line x1="60" y1="38" x2="95" y2="64" stroke="#06B6D4" stroke-width="1.2"/>
      </svg>
    `,
  },
  {
    id: 'fhd',
    name: 'Fondo pantalla FHD',
    width: 1920,
    height: 1080,
    category: 'try-something-new',
    svgIcon: `
      <svg viewBox="0 0 120 75" width="108" height="68" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="16" y="8" width="88" height="50" rx="4" fill="#18181B" stroke="#3F3F46" stroke-width="1.5" filter="drop-shadow(0 2px 8px rgba(0,0,0,0.3))"/>
        <rect x="20" y="12" width="80" height="42" fill="#1E1B4B"/>
        <circle cx="78" cy="22" r="6" fill="#FDE047"/>
        <polygon points="20,54 44,34 68,54" fill="#4338CA"/>
        <polygon points="52,54 76,28 100,54" fill="#6366F1"/>
        <rect x="54" y="58" width="12" height="6" fill="#71717A"/>
        <rect x="44" y="64" width="32" height="3" rx="1" fill="#52525B"/>
      </svg>
    `,
  },
];

const CATEGORIES: Array<{ id: 'most-used' | 'popular' | 'try-something-new'; titleKey: string }> = [
  { id: 'most-used', titleKey: 'canvas.category_most_used' },
  { id: 'popular', titleKey: 'canvas.category_popular' },
  { id: 'try-something-new', titleKey: 'canvas.category_try_something_new' },
];

function buildPresetCardHtml(item: PresetItem): string {
  return `
    <div class="canvas-card" data-ref="preset-card-${item.id}" data-preset-id="${item.id}" data-width="${item.width}" data-height="${item.height}" data-name="${item.name}">
      <div class="canvas-card__preview">
        ${item.svgIcon}
      </div>
      <div class="canvas-card__badges-tl">
        <div class="canvas-card__badge canvas-card__badge--glass">
          <span>${item.width} × ${item.height} px</span>
        </div>
      </div>
      <div class="canvas-card__bottom">
        <h3 class="canvas-card__title" title="${item.name}">
          ${item.name}
        </h3>
      </div>
    </div>
  `;
}

function buildCategorySectionHtml(catId: 'most-used' | 'popular' | 'try-something-new', titleKey: string): string {
  const items = PRESETS.filter((p) => p.category === catId);
  const cardsHtml = items.map(buildPresetCardHtml).join('');

  return `
    <div class="preset-category" data-ref="preset-category-${catId}">
      <h4 class="preset-category__title" data-i18n="${titleKey}">${t(titleKey)}</h4>
      <div class="preset-category__carousel-container" data-ref="carousel-container-${catId}">
        <button type="button" class="preset-carousel__nav-btn preset-carousel__nav-btn--left is-disabled" data-ref="btn-carousel-left-${catId}" data-tooltip="Desplazar a la izquierda" aria-label="Desplazar a la izquierda">
          <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#chevron_left"></use></svg>
        </button>
        <div class="preset-category__track" data-ref="preset-track-${catId}">
          ${cardsHtml}
        </div>
        <button type="button" class="preset-carousel__nav-btn preset-carousel__nav-btn--right" data-ref="btn-carousel-right-${catId}" data-tooltip="Desplazar a la derecha" aria-label="Desplazar a la derecha">
          <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#chevron_right"></use></svg>
        </button>
      </div>
    </div>
  `;
}

export function openCreateCanvasModal(): void {
  if (activeCreateCanvasModal) {
    activeCreateCanvasModal.close();
  }

  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.setAttribute('data-ref', 'modal-create-canvas-backdrop');

  const categoriesHtml = CATEGORIES.map((c) => buildCategorySectionHtml(c.id, c.titleKey)).join('');

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
              <h1 class="component-top-title" data-i18n="canvas.modal_title">${t('canvas.modal_title')}</h1>
            </div>
          </div>
          <div class="modal-create-canvas__sidebar-bottom" data-ref="modal-sidebar-bottom">
            <div class="menu-panel__list" data-ref="modal-nav-list">
              <button type="button" class="menu-item is-active" data-ref="tab-for-you">
                <svg class="component-icon menu-item__icon" aria-hidden="true"><use href="/icons.svg#recommend"></use></svg>
                <span class="menu-item__text" data-i18n="canvas.tab_for_you">${t('canvas.tab_for_you')}</span>
              </button>
              <button type="button" class="menu-item" data-ref="tab-custom-size">
                <svg class="component-icon menu-item__icon" aria-hidden="true"><use href="/icons.svg#aspect_ratio"></use></svg>
                <span class="menu-item__text" data-i18n="canvas.tab_custom_size">${t('canvas.tab_custom_size')}</span>
              </button>
              <button type="button" class="menu-item" data-ref="tab-upload">
                <svg class="component-icon menu-item__icon" aria-hidden="true"><use href="/icons.svg#cloud_upload"></use></svg>
                <span class="menu-item__text" data-i18n="canvas.tab_upload">${t('canvas.tab_upload')}</span>
              </button>
            </div>
          </div>
        </div>

        <div class="modal-create-canvas__body" data-ref="modal-create-canvas-body">
          <div class="modal-create-canvas__body-top" data-ref="modal-body-top">
            <div class="component-search component-search--full" data-ref="modal-search-box">
              <div class="component-search__icon" data-ref="modal-search-icon">
                <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#search"></use></svg>
              </div>
              <div class="component-search__input-box" data-ref="modal-search-input-box">
                <input class="component-search__input" data-ref="modal-search-input" data-i18n-placeholder="canvas.search_placeholder" type="text" maxlength="100" autocomplete="off" placeholder="${t('canvas.search_placeholder')}" />
              </div>
            </div>
          </div>

          <div class="modal-create-canvas__body-bottom" data-ref="modal-body-bottom">
            <div class="modal-canvas-panel" data-ref="panel-for-you">
              <div class="modal-presets-container" data-ref="modal-presets-container">
                ${categoriesHtml}
              </div>
              <div class="component-empty-state" data-ref="presets-empty-search" style="display: none;">
                <div class="component-empty-state-graphic" data-ref="modal-empty-search-graphic">
                  ${getEmptyGraphicSvg('search')}
                </div>
                <h2 class="component-empty-state-title">Sin plantillas encontradas</h2>
                <p class="component-empty-state-desc">No se encontraron tamaños o plantillas que coincidan con la búsqueda.</p>
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
              <div class="component-empty-state" data-ref="panel-upload-empty">
                <div class="component-empty-state-graphic" data-ref="modal-upload-empty-graphic">
                  ${getEmptyGraphicSvg('upload')}
                </div>
                <h2 class="component-empty-state-title" data-i18n="canvas.upload_title">${t('canvas.upload_title')}</h2>
                <p class="component-empty-state-desc" data-i18n="canvas.upload_desc">${t('canvas.upload_desc')}</p>
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

  const searchInput = backdrop.querySelector<HTMLInputElement>('[data-ref="modal-search-input"]');
  const presetsContainer = backdrop.querySelector<HTMLElement>('[data-ref="modal-presets-container"]');
  const presetsEmptySearch = backdrop.querySelector<HTMLElement>('[data-ref="presets-empty-search"]');

  const carouselControllers: Array<{ destroy: () => void; updateButtons: () => void }> = [];

  CATEGORIES.forEach((cat) => {
    const wrapper = backdrop.querySelector<HTMLElement>(`[data-ref="carousel-container-${cat.id}"]`);
    if (wrapper) {
      const ctrl = initCarouselScroll(wrapper, {
        carouselSelector: `[data-ref="preset-track-${cat.id}"]`,
        leftBtnSelector: `[data-ref="btn-carousel-left-${cat.id}"]`,
        rightBtnSelector: `[data-ref="btn-carousel-right-${cat.id}"]`,
        step: 220,
      });
      if (ctrl) {
        carouselControllers.push(ctrl);
      }
    }
  });

  const switchTab = (activeTab: 'for-you' | 'custom-size' | 'upload') => {
    tabForYou?.classList.toggle('is-active', activeTab === 'for-you');
    tabCustomSize?.classList.toggle('is-active', activeTab === 'custom-size');
    tabUpload?.classList.toggle('is-active', activeTab === 'upload');

    if (panelForYou) panelForYou.style.display = activeTab === 'for-you' ? 'flex' : 'none';
    if (panelCustomSize) panelCustomSize.style.display = activeTab === 'custom-size' ? 'flex' : 'none';
    if (panelUpload) panelUpload.style.display = activeTab === 'upload' ? 'flex' : 'none';

    if (activeTab === 'for-you') {
      setTimeout(() => {
        carouselControllers.forEach((c) => c.updateButtons());
      }, 50);
    }
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
    carouselControllers.forEach((c) => c.destroy());
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

  const executeCreateCanvas = async (name: string, width: number, height: number): Promise<void> => {
    clearError();

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
  };

  btnSubmit?.addEventListener('click', async () => {
    const name = inputName?.value.trim() || t('canvas.input_name_placeholder');
    const width = parseInt(inputWidth?.value || '0', 10);
    const height = parseInt(inputHeight?.value || '0', 10);
    await executeCreateCanvas(name, width, height);
  });

  const presetCards = backdrop.querySelectorAll<HTMLElement>('.canvas-card[data-preset-id]');
  presetCards.forEach((card) => {
    card.addEventListener('click', () => {
      const name = card.getAttribute('data-name') || t('canvas.input_name_placeholder');
      const width = parseInt(card.getAttribute('data-width') || '0', 10);
      const height = parseInt(card.getAttribute('data-height') || '0', 10);
      if (width > 0 && height > 0) {
        void executeCreateCanvas(name, width, height);
      }
    });
  });

  searchInput?.addEventListener('input', () => {
    const query = (searchInput.value || '').trim().toLowerCase();
    let totalVisible = 0;

    CATEGORIES.forEach((cat) => {
      const catEl = backdrop.querySelector<HTMLElement>(`[data-ref="preset-category-${cat.id}"]`);
      if (!catEl) return;

      const cards = catEl.querySelectorAll<HTMLElement>('.canvas-card[data-preset-id]');
      let catVisible = 0;

      cards.forEach((card) => {
        const name = (card.getAttribute('data-name') || '').toLowerCase();
        const w = card.getAttribute('data-width') || '';
        const h = card.getAttribute('data-height') || '';
        const matches = !query || name.includes(query) || `${w}x${h}`.includes(query) || `${w} × ${h}`.includes(query);

        card.style.display = matches ? 'block' : 'none';
        if (matches) catVisible++;
      });

      catEl.style.display = catVisible > 0 ? 'flex' : 'none';
      totalVisible += catVisible;
    });

    if (presetsContainer) {
      presetsContainer.style.display = totalVisible > 0 ? 'flex' : 'none';
    }
    if (presetsEmptySearch) {
      presetsEmptySearch.style.display = totalVisible === 0 ? 'flex' : 'none';
    }

    carouselControllers.forEach((c) => c.updateButtons());
  });

  document.body.appendChild(backdrop);
  requestAnimationFrame(() => {
    backdrop.classList.add('is-visible');
    searchInput?.focus();
    carouselControllers.forEach((c) => c.updateButtons());
  });

  activeCreateCanvasModal = { close: closeModal };
}
