import { getCategoryBadgeIconSvg } from '../components/create-canvas-graphics.js';
import { t } from '../services/i18n.service.js';

export interface HomeCategoryBadgeItem {
  category: string;
  dataRef: string;
  i18nKey: string;
  iconSvg?: string;
  isDividerAfter?: boolean;
  label: string;
}

export const HOME_CATEGORY_BADGES: HomeCategoryBadgeItem[] = [
  {
    category: 'templates',
    dataRef: 'cat-badge-templates',
    i18nKey: 'home.badge_templates',
    isDividerAfter: true,
    label: 'Plantillas',
  },
  {
    category: 'presentation',
    dataRef: 'cat-badge-presentation',
    i18nKey: 'home.badge_presentation',
    label: 'Presentación',
  },
  {
    category: 'social',
    dataRef: 'cat-badge-social',
    i18nKey: 'home.badge_social',
    label: 'Redes',
  },
  {
    category: 'doc',
    dataRef: 'cat-badge-doc',
    i18nKey: 'home.badge_doc',
    label: 'Doc',
  },
  {
    category: 'board',
    dataRef: 'cat-badge-board',
    i18nKey: 'home.badge_board',
    label: 'Pizarrón',
  },
  {
    category: 'sheet',
    dataRef: 'cat-badge-sheet',
    i18nKey: 'home.badge_sheet',
    label: 'Hoja de cálculo',
  },
  {
    category: 'photos',
    dataRef: 'cat-badge-photos',
    i18nKey: 'home.badge_photos',
    label: 'Fotos',
  },
  {
    category: 'videos',
    dataRef: 'cat-badge-videos',
    i18nKey: 'home.badge_videos',
    label: 'Videos',
  },
  {
    category: 'custom',
    dataRef: 'cat-badge-custom',
    i18nKey: 'home.badge_custom',
    label: 'Personalizar',
  },
  {
    category: 'upload',
    dataRef: 'cat-badge-upload',
    i18nKey: 'home.badge_upload',
    label: 'Subir',
  },
  {
    category: 'more',
    dataRef: 'cat-badge-more',
    i18nKey: 'home.badge_more',
    label: 'Más',
  },
];

export function renderHomeCategoryBadgesHtml(activeCategory = 'templates'): string {
  return HOME_CATEGORY_BADGES.map((item) => {
    const activeClass = item.category === activeCategory ? ' is-active' : '';
    const divider = item.isDividerAfter ? '\n<div class="component-tag-divider" data-ref="quick-action-divider" aria-hidden="true"></div>' : '';
    const labelText = t(item.i18nKey) || item.label;
    const iconSvg = item.iconSvg || getCategoryBadgeIconSvg(item.category);
    return `<button type="button" class="component-badge component-badge--interactive${activeClass}" data-ref="${item.dataRef}" data-category="${item.category}" data-i18n-aria="${item.i18nKey}" aria-label="${labelText}">
  ${iconSvg}
  <span data-i18n="${item.i18nKey}">${labelText}</span>
</button>${divider}`;
  }).join('\n');
}
