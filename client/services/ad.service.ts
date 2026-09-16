import { DEFAULT_AD_FREQUENCY, MOCK_ADS } from '../config/ads.config.js';
import { AdItem } from '../types/ad.types.js';
import { escapeHtml } from './api.service.js';
import { t } from './i18n.service.js';

export function shouldShowAds(): boolean {
  return true;
}

export function getAdByIndex(index: number): AdItem {
  const safeIndex = Math.abs(index) % MOCK_ADS.length;
  return MOCK_ADS[safeIndex];
}

export function getRandomAd(): AdItem {
  const randomIndex = Math.floor(Math.random() * MOCK_ADS.length);
  return MOCK_ADS[randomIndex];
}

export function handleAdClick(targetUrl: string): void {
  if (!targetUrl) return;
  window.open(targetUrl, '_blank', 'noopener,noreferrer');
}

const FALLBACK_AD_IMAGE = "data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='600' height='400' viewBox='0 0 600 400'%3E%3Cdefs%3E%3ClinearGradient id='ad-grad' x1='0%25' y1='0%25' x2='100%25' y2='100%25'%3E%3Cstop offset='0%25' stop-color='%233b82f6'/%3E%3Cstop offset='100%25' stop-color='%231d4ed8'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='100%25' height='100%25' fill='url(%23ad-grad)'/%3E%3Ctext x='50%25' y='50%25' fill='%23ffffff' font-family='system-ui,-apple-system,sans-serif' font-size='22' font-weight='700' text-anchor='middle' dy='.35em'%3EGoogle%3C/text%3E%3C/svg%3E";

export function createAdCardElement(ad: AdItem): HTMLElement {
  const card = document.createElement('div');
  card.className = 'canvas-card canvas-card--ad';
  card.setAttribute('data-ref', `ad-card-${ad.id}`);
  card.setAttribute('data-ad-url', ad.targetUrl);
  card.setAttribute('data-ad-id', ad.id);

  const badgeText = ad.badgeText || t('ads.badge') || 'AD';
  const sponsorName = ad.sponsorName || t('ads.sponsored') || 'Google';
  const visitTooltip = t('ads.visit_link') || 'Visitar enlace';

  card.innerHTML = `
    <div class="canvas-card__thumbnail canvas-card__thumbnail--ad" data-ref="ad-thumbnail-${ad.id}">
      <img class="canvas-card__image canvas-card__image--ad image-lazy-fade" data-ref="ad-img-${ad.id}" src="${escapeHtml(ad.imageUrl)}" alt="${escapeHtml(ad.title)}" loading="lazy" decoding="async" onload="this.classList.add('image-loaded')" onerror="this.onerror=null; this.src='${FALLBACK_AD_IMAGE}'; this.classList.add('image-loaded');" />
      <div class="canvas-card__actions-wrapper" data-ref="ad-actions-wrapper-${ad.id}">
        <div class="canvas-card__actions" data-ref="ad-actions-${ad.id}">
          <a class="canvas-card__action-btn" data-ref="btn-ad-open-${ad.id}" href="${escapeHtml(ad.targetUrl)}" target="_blank" rel="noopener noreferrer" data-tooltip="${escapeHtml(visitTooltip)}" aria-label="${escapeHtml(visitTooltip)}">
            <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#open_in_new"></use></svg>
          </a>
        </div>
      </div>
    </div>
    <div class="canvas-card__info canvas-card__info--ad" data-ref="ad-info-${ad.id}">
      <span class="canvas-card__name" data-ref="ad-title-${ad.id}" title="${escapeHtml(ad.title)}">
        ${escapeHtml(ad.title)}
      </span>
      <div class="canvas-card__meta" data-ref="ad-meta-${ad.id}">
        <span class="canvas-card__ad-badge" data-ref="ad-badge-${ad.id}">${escapeHtml(badgeText)}</span>
        <span>${escapeHtml(sponsorName)}</span>
      </div>
    </div>
  `;

  card.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    if (target.closest('a') || target.closest('button')) {
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    handleAdClick(ad.targetUrl);
  });

  return card;
}

export function buildAdCardHtml(ad: AdItem): string {
  const badgeText = ad.badgeText || t('ads.badge') || 'AD';
  const sponsorName = ad.sponsorName || t('ads.sponsored') || 'Google';
  const visitTooltip = t('ads.visit_link') || 'Visitar enlace';

  return `
    <div class="canvas-card canvas-card--ad" data-ref="ad-card-${ad.id}" data-ad-url="${escapeHtml(ad.targetUrl)}" data-ad-id="${escapeHtml(ad.id)}">
      <div class="canvas-card__thumbnail canvas-card__thumbnail--ad" data-ref="ad-thumbnail-${ad.id}">
        <img class="canvas-card__image canvas-card__image--ad image-lazy-fade" data-ref="ad-img-${ad.id}" src="${escapeHtml(ad.imageUrl)}" alt="${escapeHtml(ad.title)}" loading="lazy" decoding="async" onload="this.classList.add('image-loaded')" onerror="this.onerror=null; this.src='${FALLBACK_AD_IMAGE}'; this.classList.add('image-loaded');" />
        <div class="canvas-card__actions-wrapper" data-ref="ad-actions-wrapper-${ad.id}">
          <div class="canvas-card__actions" data-ref="ad-actions-${ad.id}">
            <a class="canvas-card__action-btn" data-ref="btn-ad-open-${ad.id}" href="${escapeHtml(ad.targetUrl)}" target="_blank" rel="noopener noreferrer" data-tooltip="${escapeHtml(visitTooltip)}" aria-label="${escapeHtml(visitTooltip)}">
              <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#open_in_new"></use></svg>
            </a>
          </div>
        </div>
      </div>
      <div class="canvas-card__info canvas-card__info--ad" data-ref="ad-info-${ad.id}">
        <span class="canvas-card__name" data-ref="ad-title-${ad.id}" title="${escapeHtml(ad.title)}">
          ${escapeHtml(ad.title)}
        </span>
        <div class="canvas-card__meta" data-ref="ad-meta-${ad.id}">
          <span class="canvas-card__ad-badge" data-ref="ad-badge-${ad.id}">${escapeHtml(badgeText)}</span>
          <span>${escapeHtml(sponsorName)}</span>
        </div>
      </div>
    </div>
  `;
}

export { DEFAULT_AD_FREQUENCY };
