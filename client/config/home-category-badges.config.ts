import { t } from '../services/i18n.service.js';

export interface HomeCategoryBadgeItem {
  category: string;
  dataRef: string;
  i18nKey: string;
  iconSvg: string;
  isDividerAfter?: boolean;
  label: string;
}

export const HOME_CATEGORY_BADGES: HomeCategoryBadgeItem[] = [
  {
    category: 'templates',
    dataRef: 'cat-badge-templates',
    i18nKey: 'home.badge_templates',
    iconSvg: `<svg class="component-badge__icon" viewBox="0 0 32 32" aria-hidden="true"><path fill="#7C3AED" fill-rule="evenodd" d="M4 8a4 4 0 0 1 4-4h16a4 4 0 0 1 4 4v16a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V8Zm4-1.5a1.5 1.5 0 0 0-1.5 1.5v4.5a1.5 1.5 0 0 0 1.5 1.5h16a1.5 1.5 0 0 0 1.5-1.5V8a1.5 1.5 0 0 0-1.5-1.5H8Zm0 10a1.5 1.5 0 0 0-1.5 1.5v4.5a1.5 1.5 0 0 0 1.5 1.5h6a1.5 1.5 0 0 0 1.5-1.5V18a1.5 1.5 0 0 0-1.5-1.5H8Zm10 0a1.5 1.5 0 0 0-1.5 1.5v4.5a1.5 1.5 0 0 0 1.5 1.5h6a1.5 1.5 0 0 0 1.5-1.5V18a1.5 1.5 0 0 0-1.5-1.5h-6Z"></path></svg>`,
    isDividerAfter: true,
    label: 'Plantillas',
  },
  {
    category: 'presentation',
    dataRef: 'cat-badge-presentation',
    i18nKey: 'home.badge_presentation',
    iconSvg: `<svg class="component-badge__icon" viewBox="0 0 32 32" aria-hidden="true"><path fill="#FF6105" fill-rule="evenodd" d="M4 7a4 4 0 0 1 4-4h16a4 4 0 0 1 4 4v13a4 4 0 0 1-4 4h-5.4l2.2 4.4a1.2 1.2 0 1 1-2.14 1.08L16.2 25h-.4l-2.46 4.48a1.2 1.2 0 1 1-2.14-1.08L13.4 24H8a4 4 0 0 1-4-4V7Zm12 2a5 5 0 0 0-5 5h5V9Zm-1.8 6.5H9.2a5 5 0 0 0 5 5v-5Zm1.8 5a5 5 0 0 0 5-5H16v5Zm5-6.5a5 5 0 0 0-3.5-4.78V13.5H21Z"></path></svg>`,
    label: 'Presentación',
  },
  {
    category: 'social',
    dataRef: 'cat-badge-social',
    i18nKey: 'home.badge_social',
    iconSvg: `<svg class="component-badge__icon" viewBox="0 0 32 32" aria-hidden="true"><path fill="#FF3B4B" fill-rule="evenodd" d="M5 13.5C5 7.7 9.9 3 16 3s11 4.7 11 10.5c0 5.2-4 9.6-9.4 10.3l-3.8 3.8a1.2 1.2 0 0 1-2-.85V23.4C7.8 21.7 5 17.9 5 13.5Zm11-4.2c-1.3-1.6-3.8-1.5-5 0-1.1 1.3-.9 3.2.3 4.5l4.7 4.5 4.7-4.5c1.2-1.3 1.4-3.2.3-4.5-1.2-1.5-3.7-1.6-5 0Z"></path></svg>`,
    label: 'Redes',
  },
  {
    category: 'doc',
    dataRef: 'cat-badge-doc',
    i18nKey: 'home.badge_doc',
    iconSvg: `<svg class="component-badge__icon" viewBox="0 0 32 32" aria-hidden="true"><path fill="#13A3B5" fill-rule="evenodd" d="M6 6a4 4 0 0 1 4-4h8.5a1.5 1.5 0 0 1 1.06.44l5.5 5.5A1.5 1.5 0 0 1 25.5 9V26a4 4 0 0 1-4 4H10a4 4 0 0 1-4-4V6Zm4-1.5a1.5 1.5 0 0 0-1.5 1.5v20a1.5 1.5 0 0 0 1.5 1.5h11.5a1.5 1.5 0 0 0 1.5-1.5V10.5h-4a2.5 2.5 0 0 1-2.5-2.5v-4H10Zm8 0v3.5a.5.5 0 0 0 .5.5H22l-4-4ZM11 14a1.25 1.25 0 0 1 1.25-1.25h9.5a1.25 1.25 0 1 1 0 2.5h-9.5A1.25 1.25 0 0 1 11 14Zm0 4.5a1.25 1.25 0 0 1 1.25-1.25h9.5a1.25 1.25 0 1 1 0 2.5h-9.5A1.25 1.25 0 0 1 11 18.5Zm0 4.5a1.25 1.25 0 0 1 1.25-1.25h6a1.25 1.25 0 1 1 0 2.5h-6A1.25 1.25 0 0 1 11 23Z"></path></svg>`,
    label: 'Doc',
  },
  {
    category: 'board',
    dataRef: 'cat-badge-board',
    i18nKey: 'home.badge_board',
    iconSvg: `<svg class="component-badge__icon" viewBox="0 0 32 32" aria-hidden="true"><path fill="#00C48C" fill-rule="evenodd" d="M4 6a3 3 0 0 1 3-3h18a3 3 0 0 1 3 3v14a3 3 0 0 1-3 3h-1.5v1.5a1 1 0 0 1-1 1h-13a1 1 0 0 1-1-1V23H7a3 3 0 0 1-3-3V6Zm3-1a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h18a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1H7Zm1.5 3a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1v3.5a1 1 0 0 1-1 1h-3.5a1 1 0 0 1-1-1V8Zm7.5 0a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1v3.5a1 1 0 0 1-1 1H17a1 1 0 0 1-1-1V8Zm-6 7.5a1 1 0 0 1 1-1h10.5a1 1 0 1 1 0 2H11a1 1 0 0 1-1-1Zm-1.5 8h13v.5H8.5V23.5Zm-1 2.5l-1.8 3.2a1 1 0 1 1-1.74-.98L5.3 25h18.4l1.34 3.22a1 1 0 1 1-1.84.76L21.5 26h-14Z"></path></svg>`,
    label: 'Pizarrón',
  },
  {
    category: 'sheet',
    dataRef: 'cat-badge-sheet',
    i18nKey: 'home.badge_sheet',
    iconSvg: `<svg class="component-badge__icon" viewBox="0 0 32 32" aria-hidden="true"><path fill="#138EFF" fill-rule="evenodd" d="M4 7a4 4 0 0 1 4-4h16a4 4 0 0 1 4 4v18a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V7Zm4-1.5a1.5 1.5 0 0 0-1.5 1.5v4.5H14V5.5H8Zm7.5 0V11.5H24V7a1.5 1.5 0 0 0-1.5-1.5h-7Zm8.5 7.5H15.5V18H24v-5Zm0 6.5H15.5v5.5H22.5A1.5 1.5 0 0 0 24 23.5V19.5Zm-10 5.5V19.5H6.5v4A1.5 1.5 0 0 0 8 25h6Zm-7.5-7H14V13H6.5v5Z"></path></svg>`,
    label: 'Hoja de cálculo',
  },
  {
    category: 'photos',
    dataRef: 'cat-badge-photos',
    i18nKey: 'home.badge_photos',
    iconSvg: `<svg class="component-badge__icon" viewBox="0 0 32 32" aria-hidden="true"><path fill="#A855F7" fill-rule="evenodd" d="M4 8a4 4 0 0 1 4-4h16a4 4 0 0 1 4 4v16a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V8Zm4-1.5a1.5 1.5 0 0 0-1.5 1.5v16a1.5 1.5 0 0 0 1.5 1.5h16a1.5 1.5 0 0 0 1.5-1.5V8a1.5 1.5 0 0 0-1.5-1.5H8Zm3 4a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5Zm-2.7 13.2 5.2-6.5a1.5 1.5 0 0 1 2.34 0l2.36 2.95 2.8-3.73a1.5 1.5 0 0 1 2.4 0l4.3 5.74a1.2 1.2 0 0 1-.96 1.94H9.26a1.2 1.2 0 0 1-.96-1.9Z"></path></svg>`,
    label: 'Fotos',
  },
  {
    category: 'videos',
    dataRef: 'cat-badge-videos',
    i18nKey: 'home.badge_videos',
    iconSvg: `<svg class="component-badge__icon" viewBox="0 0 32 32" aria-hidden="true"><path fill="#E11D48" fill-rule="evenodd" d="M4 7a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v2.2l4.4-2.64A1.5 1.5 0 0 1 29 7.85v16.3a1.5 1.5 0 0 1-2.6 1.01L22 22.8V25a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V7Zm3-1a1 1 0 0 0-1 1v18a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V7a1 1 0 0 0-1-1H7Zm17 5.28v9.44l3 1.8V10.48l-3 1.8ZM11 11a1 1 0 0 1 1.55-.83l5 3.5a1 1 0 0 1 0 1.66l-5 3.5A1 1 0 0 1 11 18v-7Z"></path></svg>`,
    label: 'Videos',
  },
  {
    category: 'custom',
    dataRef: 'cat-badge-custom',
    i18nKey: 'home.badge_custom',
    iconSvg: `<svg class="component-badge__icon" viewBox="0 0 32 32" aria-hidden="true"><path fill="#8B5CF6" fill-rule="evenodd" d="M5 9a4 4 0 0 1 4-4h14a4 4 0 0 1 4 4v14a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4V9Zm4-1.5a1.5 1.5 0 0 0-1.5 1.5v3.5a1 1 0 1 0 2 0v-2h2a1 1 0 1 0 0-2H9Zm14 0h-2a1 1 0 1 0 0 2h2v2a1 1 0 1 0 2 0V9a1.5 1.5 0 0 0-1.5-1.5ZM7.5 23a1.5 1.5 0 0 0 1.5 1.5h2a1 1 0 1 0 0-2H9v-2a1 1 0 1 0-2 0V23Zm17 0v-2a1 1 0 1 0-2 0v2h-2a1 1 0 1 0 0 2h2a1.5 1.5 0 0 0 1.5-1.5Z"></path></svg>`,
    label: 'Personalizar',
  },
  {
    category: 'upload',
    dataRef: 'cat-badge-upload',
    i18nKey: 'home.badge_upload',
    iconSvg: `<svg class="component-badge__icon" viewBox="0 0 32 32" aria-hidden="true"><g transform="translate(4, 4)"><path fill="#0EA5E9" fill-rule="evenodd" d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM14 13v4h-4v-4H7l5-5 5 5h-3z"></path></g></svg>`,
    label: 'Subir',
  },
  {
    category: 'more',
    dataRef: 'cat-badge-more',
    i18nKey: 'home.badge_more',
    iconSvg: `<svg class="component-badge__icon" viewBox="0 0 32 32" aria-hidden="true"><circle cx="7" cy="16" r="2.5" fill="#64748B"></circle><circle cx="16" cy="16" r="2.5" fill="#64748B"></circle><circle cx="25" cy="16" r="2.5" fill="#64748B"></circle></svg>`,
    label: 'Más',
  },
];

export function renderHomeCategoryBadgesHtml(activeCategory = 'templates'): string {
  return HOME_CATEGORY_BADGES.map((item) => {
    const activeClass = item.category === activeCategory ? ' is-active' : '';
    const divider = item.isDividerAfter ? '\n<div class="component-tag-divider" data-ref="quick-action-divider" aria-hidden="true"></div>' : '';
    const labelText = t(item.i18nKey) || item.label;
    return `<button type="button" class="component-badge component-badge--interactive${activeClass}" data-ref="${item.dataRef}" data-category="${item.category}" data-i18n-aria="${item.i18nKey}" aria-label="${labelText}">
  ${item.iconSvg}
  <span data-i18n="${item.i18nKey}">${labelText}</span>
</button>${divider}`;
  }).join('\n');
}
