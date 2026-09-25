import { navigate } from '../app-router.js';
import { openModal } from '../components/modal.component.js';
import { openTemplatePreviewModal } from '../components/template-preview-modal.component.js';
import { API_ROUTES } from '../config/api-routes.js';
import { currentUser, deleteApi, escapeHtml, getApi, postApi } from '../services/api.service.js';
import { t, translateElement } from '../services/i18n.service.js';
import { renderIcons } from '../services/icon.service.js';
import { SkeletonService } from '../services/skeleton.service.js';
import { loadTemplate } from '../services/template.service.js';
import { showToast } from '../services/toast.service.js';
import { canPublishTemplates } from '../types/auth.types.js';
import { DesignerMetrics } from '../types/designer.types.js';
import { debounce, removeEmptyState, renderEmptyState, setupDropdown, setupLazyImages } from '../utils/dom.util.js';

class DesignerController {
  private container: HTMLElement;
  private abortController: AbortController;

  private templates: any[] = [];
  private metrics: DesignerMetrics | null = null;
  private activeTab: 'templates' | 'elements' = 'templates';
  private filterStatus = 'all';
  private sortOption = 'recent';
  private searchQuery = '';

  private statusDropdownController: ReturnType<typeof setupDropdown> | null = null;
  private sortDropdownController: ReturnType<typeof setupDropdown> | null = null;

  private gridEl: HTMLElement | null = null;
  private searchBoxEl: HTMLElement | null = null;
  private searchInputEl: HTMLInputElement | null = null;
  private btnClearSearchEl: HTMLButtonElement | null = null;

  private tabBtnTemplates: HTMLElement | null = null;
  private tabBtnElements: HTMLElement | null = null;
  private sectionTemplates: HTMLElement | null = null;
  private sectionElements: HTMLElement | null = null;

  private metricValPublished: HTMLElement | null = null;
  private metricValUses: HTMLElement | null = null;
  private metricValPending: HTMLElement | null = null;
  private metricValDrafts: HTMLElement | null = null;

  private btnPublicProfile: HTMLButtonElement | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
    this.abortController = new AbortController();
  }

  public async init(): Promise<void> {
    this.gridEl = this.container.querySelector<HTMLElement>('[data-ref="designer-templates-grid"]');
    this.searchBoxEl = this.container.querySelector<HTMLElement>('[data-ref="designer-search-box"]');
    this.searchInputEl = this.container.querySelector<HTMLInputElement>('[data-ref="designer-search-input"]');
    this.btnClearSearchEl = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-designer-clear-search"]');

    this.tabBtnTemplates = this.container.querySelector<HTMLElement>('[data-ref="tab-btn-templates"]');
    this.tabBtnElements = this.container.querySelector<HTMLElement>('[data-ref="tab-btn-elements"]');
    this.sectionTemplates = this.container.querySelector<HTMLElement>('[data-ref="designer-section-templates"]');
    this.sectionElements = this.container.querySelector<HTMLElement>('[data-ref="designer-section-elements"]');

    this.metricValPublished = this.container.querySelector<HTMLElement>('[data-ref="metric-val-published"]');
    this.metricValUses = this.container.querySelector<HTMLElement>('[data-ref="metric-val-uses"]');
    this.metricValPending = this.container.querySelector<HTMLElement>('[data-ref="metric-val-pending"]');
    this.metricValDrafts = this.container.querySelector<HTMLElement>('[data-ref="metric-val-drafts"]');

    this.btnPublicProfile = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-designer-public-profile"]');

    const statusDropdownWrapper = this.container.querySelector<HTMLElement>('[data-ref="designer-dropdown-wrapper-status"]');
    if (statusDropdownWrapper) {
      this.statusDropdownController = setupDropdown(statusDropdownWrapper, {
        onSelect: (item) => {
          const status = item.getAttribute('data-status') || 'all';
          this.filterStatus = status;
          this.renderTemplates();
        },
      });
    }

    const sortDropdownWrapper = this.container.querySelector<HTMLElement>('[data-ref="designer-dropdown-wrapper-sort"]');
    if (sortDropdownWrapper) {
      this.sortDropdownController = setupDropdown(sortDropdownWrapper, {
        onSelect: (item) => {
          const sort = item.getAttribute('data-sort') || 'recent';
          this.sortOption = sort;
          this.renderTemplates();
        },
      });
    }

    if (this.gridEl) {
      SkeletonService.renderGridCardSkeletons(this.gridEl, 8, 'template');
    }

    this.bindEvents();

    await Promise.all([
      this.loadMetrics(),
      this.loadTemplates(),
    ]);
  }

  private bindEvents(): void {
    const signal = this.abortController.signal;

    if (this.btnPublicProfile) {
      this.btnPublicProfile.addEventListener('click', () => {
        if (currentUser?.username) {
          navigate(`/p/${currentUser.username}`);
        } else {
          navigate('/p/spriteboard');
        }
      }, { signal });
    }

    if (this.tabBtnTemplates) {
      this.tabBtnTemplates.addEventListener('click', () => {
        this.switchTab('templates');
      }, { signal });
    }

    if (this.tabBtnElements) {
      this.tabBtnElements.addEventListener('click', () => {
        this.switchTab('elements');
      }, { signal });
    }

    if (this.searchInputEl) {
      const onSearchDebounced = debounce(() => {
        this.searchQuery = this.searchInputEl?.value.trim().toLowerCase() || '';
        if (this.btnClearSearchEl) {
          this.btnClearSearchEl.style.display = this.searchQuery.length > 0 ? 'inline-flex' : 'none';
        }
        this.renderTemplates();
      }, 200);

      this.searchInputEl.addEventListener('input', onSearchDebounced, { signal });
    }

    if (this.btnClearSearchEl) {
      this.btnClearSearchEl.addEventListener('click', () => {
        if (this.searchInputEl) {
          this.searchInputEl.value = '';
          this.searchQuery = '';
          this.btnClearSearchEl!.style.display = 'none';
          this.searchInputEl.focus();
          this.renderTemplates();
        }
      }, { signal });
    }

    if (this.gridEl) {
      this.gridEl.addEventListener('click', (e) => {
        void this.handleGridClick(e);
      }, { signal });
    }
  }

  private switchTab(tab: 'templates' | 'elements'): void {
    this.activeTab = tab;

    if (this.tabBtnTemplates) {
      this.tabBtnTemplates.classList.toggle('is-active', tab === 'templates');
    }
    if (this.tabBtnElements) {
      this.tabBtnElements.classList.toggle('is-active', tab === 'elements');
    }

    if (this.sectionTemplates) {
      this.sectionTemplates.style.display = tab === 'templates' ? '' : 'none';
    }
    if (this.sectionElements) {
      this.sectionElements.style.display = tab === 'elements' ? '' : 'none';
    }
  }

  private async loadMetrics(): Promise<void> {
    try {
      const res = await getApi(API_ROUTES.templates.myMetrics);
      if (res.ok) {
        const data = await res.json();
        if (data && data.metrics) {
          this.metrics = data.metrics;
          this.updateMetricsUI();
        }
      }
    } catch {
      this.metrics = {
        approvedCount: 0,
        draftCount: 0,
        pendingCount: 0,
        rejectedCount: 0,
        totalCount: 0,
        totalUses: 0,
      };
      this.updateMetricsUI();
    }
  }

  private updateMetricsUI(): void {
    if (!this.metrics) return;
    if (this.metricValPublished) {
      this.metricValPublished.textContent = String(this.metrics.approvedCount || 0);
    }
    if (this.metricValUses) {
      this.metricValUses.textContent = String(this.metrics.totalUses || 0);
    }
    if (this.metricValPending) {
      this.metricValPending.textContent = String(this.metrics.pendingCount || 0);
    }
    if (this.metricValDrafts) {
      this.metricValDrafts.textContent = String(this.metrics.draftCount || 0);
    }
  }

  private async loadTemplates(): Promise<void> {
    try {
      const res = await getApi(API_ROUTES.templates.myTemplates);
      if (res.ok) {
        const data = await res.json();
        this.templates = Array.isArray(data?.templates) ? data.templates : [];
      } else {
        this.templates = [];
      }
    } catch {
      this.templates = [];
    }

    this.renderTemplates();
  }

  private getFilteredAndSortedTemplates(): any[] {
    let result = [...this.templates];

    if (this.filterStatus !== 'all') {
      result = result.filter((t) => t.status === this.filterStatus);
    }

    if (this.searchQuery.length > 0) {
      const q = this.searchQuery;
      result = result.filter((t) => {
        const title = (t.title || '').toLowerCase();
        const desc = (t.description || '').toLowerCase();
        const cat = (t.category || '').toLowerCase();
        return title.includes(q) || desc.includes(q) || cat.includes(q);
      });
    }

    if (this.sortOption === 'uses') {
      result.sort((a, b) => Number(b.uses_count || 0) - Number(a.uses_count || 0));
    } else if (this.sortOption === 'alpha') {
      result.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
    } else {
      result.sort((a, b) => {
        const dateA = new Date(a.created_at || 0).getTime();
        const dateB = new Date(b.created_at || 0).getTime();
        return dateB - dateA;
      });
    }

    return result;
  }

  private renderTemplates(): void {
    if (!this.gridEl || !this.sectionTemplates) return;

    removeEmptyState(this.sectionTemplates, 'designer-empty-state');
    this.gridEl.innerHTML = '';

    const list = this.getFilteredAndSortedTemplates();

    if (list.length === 0) {
      this.gridEl.style.display = 'none';
      const isFiltered = this.filterStatus !== 'all' || this.searchQuery.length > 0;
      renderEmptyState({
        container: this.sectionTemplates,
        dataRef: 'designer-empty-state',
        desc: isFiltered ? t('designer.empty_filter_desc') : t('designer.empty_templates_desc'),
        graphicType: isFiltered ? 'search' : 'canvas',
        title: isFiltered ? t('designer.empty_filter_title') : t('designer.empty_templates_title'),
      });
      return;
    }

    this.gridEl.style.display = '';
    const html = list.map((item) => this.buildDesignerCardHtml(item)).join('');
    this.gridEl.innerHTML = html;

    renderIcons(this.gridEl);
    setupLazyImages(this.gridEl);
  }

  private buildDesignerCardHtml(tItem: any): string {
    const status = tItem.status;
    let badgeClass = 'component-badge--neutral';
    let badgeText = t('designer.filter_draft');
    let badgeIcon = 'lock';

    if (status === 'approved') {
      badgeClass = 'component-badge--success';
      badgeText = t('designer.filter_approved');
      badgeIcon = 'check_circle';
    } else if (status === 'pending') {
      badgeClass = 'component-badge--warning';
      badgeText = t('designer.filter_pending');
      badgeIcon = 'schedule';
    } else if (status === 'rejected') {
      badgeClass = 'component-badge--danger';
      badgeText = t('designer.filter_rejected');
      badgeIcon = 'cancel';
    }

    const isPres = tItem.canvas_type === 'presentation';
    const isDoc = tItem.canvas_type === 'doc';
    const typeIcon = isPres ? 'slideshow' : (isDoc ? 'description' : 'dashboard');
    const typeLabel = isPres ? (t('templates.filter_presentation') || 'Presentación') : (isDoc ? (t('templates.filter_doc') || 'Documento') : (t('templates.filter_board') || 'Pizarrón'));
    const usesCount = Number(tItem.uses_count || 0);
    const usesRaw = t('templates.uses_count_label') || '{count} usos';
    const usesText = usesRaw.replace('{count}', String(usesCount));

    const isPremium = Boolean(tItem.is_premium);
    const pricingBadgeClass = isPremium ? 'component-badge--warning' : 'component-badge--neutral';
    const pricingBadgeText = isPremium ? (t('templates.tier_premium') || 'Premium') : (t('templates.tier_free') || 'Libre');
    const pricingBadgeIcon = isPremium ? 'workspace_premium' : 'public';

    const defaultThumb = isPres ? '/assets/templates/presentations/pitch.svg' : (isDoc ? '/assets/templates/docs/proposal.svg' : '/assets/templates/boards/retro.svg');
    const thumbUrl = tItem.preview_thumbnail || defaultThumb;

    return `
      <div class="canvas-card template-card designer-card" data-ref="designer-card-${tItem.uuid}" data-template-uuid="${tItem.uuid}" data-template-id="${tItem.id}">
        <div class="canvas-card__thumbnail template-card__thumbnail" data-ref="designer-card-thumb-${tItem.uuid}">
          <img class="canvas-card__image image-lazy-fade" data-ref="designer-card-img-${tItem.uuid}" src="${thumbUrl}" alt="${escapeHtml(tItem.title)}" loading="lazy" decoding="async" onload="this.classList.add('image-loaded')" onerror="this.classList.add('image-loaded')" />
          <div class="canvas-card__badge-overlay" style="position: absolute; top: 10px; left: 10px; z-index: 2; display: flex; gap: 6px;">
            <span class="component-badge ${badgeClass}" style="gap: 4px; font-weight: 600; font-size: 11px; padding: 4px 8px; backdrop-filter: blur(8px);">
              <svg class="component-icon" style="font-size: 14px; width: 14px; height: 14px;" aria-hidden="true"><use href="/icons.svg#${badgeIcon}"></use></svg>
              <span>${badgeText}</span>
            </span>
            <span class="component-badge ${pricingBadgeClass}" style="gap: 4px; font-weight: 600; font-size: 11px; padding: 4px 8px; backdrop-filter: blur(8px);">
              <svg class="component-icon" style="font-size: 14px; width: 14px; height: 14px;" aria-hidden="true"><use href="/icons.svg#${pricingBadgeIcon}"></use></svg>
              <span>${pricingBadgeText}</span>
            </span>
          </div>
          <div class="canvas-card__actions-wrapper" data-ref="designer-card-actions-${tItem.uuid}">
            <div class="canvas-card__actions">
              ${tItem.source_canvas_uuid ? `
                <a class="canvas-card__action-btn" data-ref="btn-designer-open-canvas-${tItem.uuid}" href="/design/${tItem.source_canvas_uuid}" data-tooltip="${t('templates.btn_open_canvas') || 'Abrir lienzo de origen'}" aria-label="${t('templates.btn_open_canvas') || 'Abrir lienzo'}">
                  <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#arrow_back"></use></svg>
                </a>
              ` : ''}
              ${status === 'approved' ? `
                <button type="button" class="canvas-card__action-btn" data-ref="btn-toggle-private-${tItem.uuid}" data-action="toggle-visibility" data-tooltip="${t('templates.btn_make_private') || 'Hacer privada'}" aria-label="${t('templates.btn_make_private') || 'Hacer privada'}">
                  <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#lock"></use></svg>
                </button>
              ` : ''}
              ${status === 'draft' ? `
                <button type="button" class="canvas-card__action-btn" data-ref="btn-toggle-public-${tItem.uuid}" data-action="toggle-visibility" data-tooltip="${t('templates.btn_make_public') || 'Hacer pública'}" aria-label="${t('templates.btn_make_public') || 'Hacer pública'}">
                  <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#auto_awesome"></use></svg>
                </button>
              ` : ''}
              ${status === 'rejected' ? `
                <button type="button" class="canvas-card__action-btn is-active" style="color: var(--color-danger, #ef4444);" data-ref="btn-view-rejection-${tItem.uuid}" data-action="view-rejection" data-reason="${escapeHtml(tItem.rejection_reason || '')}" data-tooltip="${t('designer.view_rejection_title') || 'Ver motivo de rechazo'}" aria-label="${t('designer.view_rejection_title') || 'Ver motivo de rechazo'}">
                  <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#error"></use></svg>
                </button>
              ` : ''}
              <button type="button" class="canvas-card__action-btn" style="color: var(--color-danger, #ef4444);" data-ref="btn-delete-template-${tItem.uuid}" data-action="delete-template" data-tooltip="${t('templates.btn_delete') || 'Eliminar'}" aria-label="${t('templates.btn_delete') || 'Eliminar'}">
                <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#delete"></use></svg>
              </button>
            </div>
          </div>
        </div>
        <div class="canvas-card__info" data-ref="designer-card-info-${tItem.uuid}" style="padding: 10px 12px; cursor: pointer;">
          <span class="canvas-card__name" data-ref="designer-card-title-${tItem.uuid}" title="${escapeHtml(tItem.title)}" style="font-size: 13px; font-weight: 600; color: var(--text-primary); margin-bottom: 4px; display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
            ${escapeHtml(tItem.title)}
          </span>
          <div class="canvas-card__meta" style="display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--text-secondary);">
            <svg class="component-icon" style="font-size: 14px; width: 14px; height: 14px;" aria-hidden="true"><use href="/icons.svg#${typeIcon}"></use></svg>
            <span>${typeLabel}</span>
            <span class="canvas-card__meta-dot">·</span>
            <svg class="component-icon" style="font-size: 14px; width: 14px; height: 14px;" aria-hidden="true"><use href="/icons.svg#group"></use></svg>
            <span>${usesText}</span>
          </div>
        </div>
      </div>
    `;
  }

  private async handleGridClick(e: MouseEvent): Promise<void> {
    const target = e.target as HTMLElement;

    const actionBtn = target.closest<HTMLElement>('[data-action]');
    const card = target.closest<HTMLElement>('[data-template-uuid]');
    if (!card) return;

    const templateUuid = card.getAttribute('data-template-uuid');
    if (!templateUuid) return;

    const item = this.templates.find((t) => t.uuid === templateUuid);
    if (!item) return;

    if (actionBtn) {
      const action = actionBtn.getAttribute('data-action');
      e.preventDefault();
      e.stopPropagation();

      if (action === 'view-rejection') {
        const reason = actionBtn.getAttribute('data-reason') || item.rejection_reason || '';
        openModal({
          bodyHtml: `
            <div class="banner banner--danger" data-ref="rejection-reason-box" style="margin-top: 12px; font-size: 13px; line-height: 1.5; padding: 14px 16px; border-radius: 8px;">
              ${escapeHtml(reason || 'No se especificó un motivo detallado.')}
            </div>
          `,
          confirmClass: 'component-button--black',
          confirmText: t('modal.close') || 'Cerrar',
          descriptionKey: 'templates.rejection_modal_desc',
          showCancel: false,
          size: 'sm',
          titleKey: 'designer.view_rejection_title',
        });
        return;
      }

      if (action === 'toggle-visibility') {
        try {
          const res = await postApi(API_ROUTES.templates.toggleVisibility(templateUuid));
          if (res.ok) {
            const data = await res.json();
            if (data && data.template) {
              const idx = this.templates.findIndex((t) => t.uuid === templateUuid);
              if (idx !== -1) {
                this.templates[idx] = data.template;
              }
              const isDraft = data.template.status === 'draft';
              showToast(isDraft ? t('designer.visibility_updated_private') : t('designer.visibility_updated_public'), 'success');
              void this.loadMetrics();
              this.renderTemplates();
            }
          } else {
            showToast(t('toasts.generic_error') || 'Error al actualizar visibilidad', 'danger');
          }
        } catch {
          showToast(t('toasts.generic_error') || 'Error al actualizar visibilidad', 'danger');
        }
        return;
      }

      if (action === 'delete-template') {
        openModal({
          confirmClass: 'component-button--danger',
          confirmText: t('templates.btn_delete') || 'Eliminar plantilla',
          descriptionKey: 'designer.delete_confirm_desc',
          onConfirm: async () => {
            try {
              const res = await deleteApi(API_ROUTES.templates.deleteMyTemplate(templateUuid));
              if (res.ok) {
                this.templates = this.templates.filter((t) => t.uuid !== templateUuid);
                showToast(t('designer.delete_success') || 'Plantilla eliminada exitosamente.', 'success');
                void this.loadMetrics();
                this.renderTemplates();
              } else {
                showToast(t('toasts.generic_error') || 'Error al eliminar plantilla', 'danger');
              }
            } catch {
              showToast(t('toasts.generic_error') || 'Error al eliminar plantilla', 'danger');
            }
          },
          size: 'sm',
          titleKey: 'designer.delete_confirm_title',
        });
        return;
      }
      return;
    }

    const isCardThumb = target.closest<HTMLElement>('.canvas-card__thumbnail');
    const isCardInfo = target.closest<HTMLElement>('.canvas-card__info');
    if (isCardThumb || isCardInfo) {
      e.preventDefault();
      openTemplatePreviewModal({
        aspectType: 'wide',
        authorAvatar: currentUser?.avatar_url,
        authorName: currentUser?.username || 'Diseñador',
        authorUsername: currentUser?.username,
        canvasType: item.canvas_type || 'board',
        categoryKey: item.category || 'all',
        categoryName: item.category || 'Para ti',
        description: item.description || '',
        height: item.height || 1080,
        id: item.uuid,
        imagePath: item.preview_thumbnail || '',
        isPremium: Boolean(item.is_premium),
        isTemplate: true,
        name: item.title,
        templateUuid: item.uuid,
        width: item.width || 1920,
      });
    }
  }

  public destroy(): void {
    if (this.sectionTemplates) {
      removeEmptyState(this.sectionTemplates, 'designer-empty-state');
    }
    this.statusDropdownController?.destroy();
    this.statusDropdownController = null;
    this.sortDropdownController?.destroy();
    this.sortDropdownController = null;
    this.abortController.abort();
  }
}

let activeDesignerController: DesignerController | null = null;

export async function createDesignerView(): Promise<HTMLElement> {
  if (activeDesignerController) {
    activeDesignerController.destroy();
    activeDesignerController = null;
  }

  const container = await loadTemplate('/views/designer/designer.html');
  translateElement(container);
  renderIcons(container);

  activeDesignerController = new DesignerController(container);
  await activeDesignerController.init();
  (container as any).__controller = activeDesignerController;

  return container;
}
