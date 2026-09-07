import { navigate } from '../app-router.js';
import { openCreateCanvasModal } from '../components/create-canvas-modal.component.js';
import { createSidebar } from '../components/layout.component.js';
import { API_ROUTES } from '../config/api-routes.js';
import { currentUser, escapeHtml, getApi, postApi } from '../services/api.service.js';
import { getAllLocalCanvases, markLocalCanvasAsSynced } from '../services/canvas-storage.service.js';
import { renderIcons } from '../services/icon.service.js';
import { t, translateElement } from '../services/i18n.service.js';
import { loadTemplate } from '../services/template.service.js';
import { showToast } from '../services/toast.service.js';
import { CanvasItem } from '../types/canvas.types.js';

class HomeController {
  private container: HTMLElement;
  private abortController: AbortController;
  private gridEl: HTMLElement | null = null;
  private emptyStateEl: HTMLElement | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
    this.abortController = new AbortController();
  }

  public async init(): Promise<void> {
    this.gridEl = this.container.querySelector<HTMLElement>('[data-ref="canvas-grid"]');
    this.emptyStateEl = this.container.querySelector<HTMLElement>('[data-ref="canvas-empty-state"]');

    this.bindEvents();
    await this.loadCanvases();
  }

  private bindEvents(): void {
    const { signal } = this.abortController;

    const btnEmptyCreate = this.container.querySelector<HTMLElement>('[data-ref="btn-home-create-canvas"]');
    btnEmptyCreate?.addEventListener(
      'click',
      () => {
        openCreateCanvasModal();
      },
      { signal }
    );

    window.addEventListener(
      'canvas-created',
      () => {
        void this.loadCanvases();
      },
      { signal }
    );
  }

  public destroy(): void {
    this.abortController.abort();
  }

  private async loadCanvases(): Promise<void> {
    if (!this.gridEl) return;

    let items: CanvasItem[] = [];

    const localCanvases = await getAllLocalCanvases();

    if (currentUser) {
      try {
        const res = await getApi(API_ROUTES.canvases.base);
        let cloudCanvases: CanvasItem[] = [];
        if (res.ok) {
          const data = await res.json();
          if (data && Array.isArray(data.canvases)) {
            cloudCanvases = data.canvases;
          }
        }

        const cloudUuids = new Set(cloudCanvases.map((c) => c.uuid));

        const unsyncedLocals = localCanvases.filter((c) => c.is_local && !cloudUuids.has(c.uuid));

        items = [...unsyncedLocals, ...cloudCanvases];
      } catch {
        items = localCanvases;
      }
    } else {
      items = localCanvases;
    }

    this.renderCanvases(items);
  }

  private renderCanvases(canvases: CanvasItem[]): void {
    if (!this.gridEl || !this.emptyStateEl) return;

    if (canvases.length === 0) {
      this.gridEl.innerHTML = '';
      this.gridEl.style.display = 'none';
      this.emptyStateEl.style.display = 'flex';
      return;
    }

    this.emptyStateEl.style.display = 'none';
    this.gridEl.style.display = 'grid';
    this.gridEl.innerHTML = '';

    canvases.forEach((canvas) => {
      const card = this.createCardElement(canvas);
      this.gridEl?.appendChild(card);
    });

    translateElement(this.gridEl);
    renderIcons(this.gridEl);
  }

  private createCardElement(canvas: CanvasItem): HTMLElement {
    const card = document.createElement('div');
    card.className = 'canvas-card';
    card.setAttribute('data-ref', `canvas-card-${canvas.uuid}`);
    card.setAttribute('data-uuid', canvas.uuid);

    const isLocal = Boolean(canvas.is_local);
    const canSync = isLocal && Boolean(currentUser);

    const badgeText = isLocal ? t('canvas.status_local') : t('canvas.status_cloud');
    const badgeIcon = isLocal ? 'devices' : 'cloud_done';

    const thumbnailHtml = canvas.preview_thumbnail
      ? `<img class="canvas-card__image" src="${escapeHtml(canvas.preview_thumbnail)}" alt="${escapeHtml(canvas.name)}" loading="lazy" />`
      : `<div class="canvas-card__canvas-placeholder"></div>`;

    card.innerHTML = `
      ${thumbnailHtml}

      <div class="canvas-card__badges-tl" data-ref="badges-tl">
        <div class="canvas-card__badge canvas-card__badge--glass">
          <span class="material-symbols-rounded">straighten</span>
          <span>${canvas.width} × ${canvas.height} px</span>
        </div>
      </div>

      <div class="canvas-card__badges-tr" data-ref="badges-tr">
        <div class="canvas-card__badge canvas-card__badge--glass ${isLocal ? 'canvas-card__badge--local' : ''}">
          <span class="material-symbols-rounded">${badgeIcon}</span>
          <span data-ref="badge-status-text">${badgeText}</span>
        </div>
        ${
          canSync
            ? `
          <button type="button" class="btn btn--h28 btn--white canvas-card__btn-sync" data-ref="btn-sync-cloud">
            <span class="material-symbols-rounded">cloud_upload</span>
            <span>${t('canvas.btn_sync')}</span>
          </button>
        `
            : ''
        }
      </div>

      <div class="canvas-card__bottom" data-ref="canvas-bottom">
        <h3 class="canvas-card__title" data-ref="canvas-title" title="${escapeHtml(canvas.name)}">
          ${escapeHtml(canvas.name)}
        </h3>
      </div>
    `;

    const btnSync = card.querySelector<HTMLButtonElement>('[data-ref="btn-sync-cloud"]');
    btnSync?.addEventListener('click', async (e) => {
      e.stopPropagation();
      await this.handleSyncCanvas(canvas, card, btnSync);
    });

    card.addEventListener('click', () => {
      navigate(`/design/${canvas.uuid}`);
    });

    return card;
  }

  private async handleSyncCanvas(canvas: CanvasItem, card: HTMLElement, btnSync: HTMLButtonElement): Promise<void> {
    btnSync.disabled = true;
    btnSync.textContent = t('canvas.syncing');

    try {
      const res = await postApi(API_ROUTES.canvases.sync, {
        uuid: canvas.uuid,
        name: canvas.name,
        width: canvas.width,
        height: canvas.height,
        unit: canvas.unit || 'px',
        data: canvas.data || null,
      });

      if (res.ok) {
        const data = await res.json();
        if (data && data.canvas) {
          await markLocalCanvasAsSynced(canvas.uuid, data.canvas.id);
          showToast(t('canvas.sync_success'));

          const badgeTextEl = card.querySelector<HTMLElement>('[data-ref="badge-status-text"]');
          if (badgeTextEl) {
            badgeTextEl.textContent = t('canvas.status_cloud');
          }
          const badgeEl = card.querySelector<HTMLElement>('.canvas-card__badge--local');
          if (badgeEl) {
            badgeEl.classList.remove('canvas-card__badge--local');
            const icon = badgeEl.querySelector<HTMLElement>('.material-symbols-rounded');
            if (icon) icon.textContent = 'cloud_done';
          }

          btnSync.remove();
          return;
        }
      }

      showToast(t('canvas.sync_error'));
      btnSync.disabled = false;
      btnSync.textContent = t('canvas.btn_sync');
    } catch {
      showToast(t('canvas.sync_error'));
      btnSync.disabled = false;
      btnSync.textContent = t('canvas.btn_sync');
    }
  }
}

export async function createHomeView(): Promise<HTMLElement> {
  const container = await loadTemplate('/views/home/home.html');
  const sidebar = await createSidebar();
  container.prepend(sidebar);

  const controller = new HomeController(container);
  await controller.init();

  return container;
}
