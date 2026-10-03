import { navigate } from '../app-router.js';
import { API_ROUTES } from '../config/api-routes.js';
import { getApi } from '../services/api.service.js';
import { renderIcons } from '../services/icon.service.js';
import { loadTemplate } from '../services/template.service.js';
import { FeaturedCreator } from '../types/designer.types.js';

function formatRoundedCreatorsCount(count: number): string {
  if (count <= 0) return '+0';
  if (count < 100) return `+${count}`;
  if (count < 500) {
    const rounded = Math.floor(count / 50) * 50;
    return `+${rounded.toLocaleString()}`;
  }
  if (count < 1000) {
    const rounded = Math.floor(count / 100) * 100;
    return `+${rounded.toLocaleString()}`;
  }
  const rounded = Math.floor(count / 500) * 500;
  return `+${rounded.toLocaleString()}`;
}

export class CreatorsController {
  private abortController = new AbortController();
  private container: HTMLElement;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  public async init(): Promise<void> {
    this.bindEvents();
    renderIcons(this.container);
    await this.loadFeaturedCreators();
  }

  public destroy(): void {
    this.abortController.abort();
  }

  private async loadFeaturedCreators(): Promise<void> {
    const grid = this.container.querySelector<HTMLElement>('[data-ref="creators-featured-grid"]');

    try {
      const res = await getApi(API_ROUTES.creators.featured);
      if (!res.ok) {
        if (grid) this.renderEmptyCreators(grid);
        return;
      }

      const result = await res.json();
      const creators: FeaturedCreator[] = Array.isArray(result?.creators) ? result.creators : [];
      const totalCreators = typeof result?.total_creators === 'number' ? result.total_creators : creators.length;
      this.updateBadgeCount(totalCreators);

      if (!grid) return;

      if (creators.length === 0) {
        this.renderEmptyCreators(grid);
        return;
      }

      this.renderCreators(grid, creators);
    } catch {
      if (grid) this.renderEmptyCreators(grid);
    }
  }

  private updateBadgeCount(totalCreators: number): void {
    const badgeCount = this.container.querySelector<HTMLElement>('[data-ref="creators-badge-count"]');
    if (!badgeCount) return;
    badgeCount.textContent = `${formatRoundedCreatorsCount(totalCreators)} creadores activos`;
  }

  private renderEmptyCreators(grid: HTMLElement): void {
    grid.innerHTML = `
      <div class="creators-empty-state" data-ref="creators-empty-state">
        <div class="creators-empty-state__icon" data-ref="creators-empty-icon">
          <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#groups"></use></svg>
        </div>
        <p class="creators-empty-state__text" data-ref="creators-empty-text">No se han encontrado creadores destacados por el momento.</p>
      </div>
    `;
    renderIcons(grid);
  }

  private renderCreators(grid: HTMLElement, creators: FeaturedCreator[]): void {
    grid.innerHTML = '';
    const signal = this.abortController.signal;

    creators.forEach((creator, idx) => {
      const card = document.createElement('div');
      card.className = 'creators-card';
      card.setAttribute('data-ref', `creator-card-${idx + 1}`);

      const cleanHandle = creator.designer_handle ? creator.designer_handle.replace(/^@+/, '') : creator.username;
      const initial = (creator.username || 'C').charAt(0).toUpperCase();

      const avatarHtml = creator.avatar_url
        ? `<img class="creators-card__avatar" data-ref="creator-avatar-${idx + 1}" src="${creator.avatar_url}" alt="${creator.username}" loading="lazy" />`
        : `<div class="creators-card__avatar" data-ref="creator-avatar-${idx + 1}">${initial}</div>`;

      const statsText = creator.templates_count > 0
        ? `${creator.templates_count} plantillas${creator.total_uses > 0 ? ` • ${creator.total_uses} usos` : ''}`
        : `${creator.followers_count} seguidores`;

      card.innerHTML = `
        <div class="creators-card__cover" data-ref="creator-cover-${idx + 1}">
          <div class="creators-card__avatar-wrap" data-ref="creator-avatar-wrap-${idx + 1}">
            ${avatarHtml}
          </div>
        </div>
        <div class="creators-card__body" data-ref="creator-body-${idx + 1}">
          <span class="creators-card__name" data-ref="creator-name-${idx + 1}">${creator.username}</span>
          <span class="creators-card__handle" data-ref="creator-handle-${idx + 1}">@${cleanHandle}</span>
          <span class="creators-card__tag" data-ref="creator-tag-${idx + 1}">${statsText}</span>
        </div>
      `;

      card.addEventListener(
        'click',
        () => {
          navigate(`/p/${encodeURIComponent(cleanHandle)}`);
        },
        { signal }
      );

      grid.appendChild(card);
    });
  }

  private bindEvents(): void {
    const signal = this.abortController.signal;

    const btnHeroApply = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-creators-hero-apply"]');
    btnHeroApply?.addEventListener(
      'click',
      () => {
        navigate('/creators/apply');
      },
      { signal }
    );

    const btnBottomApply = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-creators-bottom-apply"]');
    btnBottomApply?.addEventListener(
      'click',
      () => {
        navigate('/creators/apply');
      },
      { signal }
    );

    const faqItems = this.container.querySelectorAll<HTMLElement>('.creators-faq-item');
    faqItems.forEach((item) => {
      const trigger = item.querySelector<HTMLButtonElement>('.creators-faq-item__trigger');
      trigger?.addEventListener(
        'click',
        () => {
          const isOpen = item.classList.contains('is-open');
          faqItems.forEach((other) => {
            if (other !== item) {
              other.classList.remove('is-open');
              other.querySelector('.creators-faq-item__trigger')?.setAttribute('aria-expanded', 'false');
            }
          });
          item.classList.toggle('is-open', !isOpen);
          trigger.setAttribute('aria-expanded', (!isOpen).toString());
        },
        { signal }
      );
    });
  }
}

export async function createCreatorsView(): Promise<HTMLElement> {
  const container = await loadTemplate('/views/creators/creators.html');
  const controller = new CreatorsController(container);
  await controller.init();
  return container;
}
