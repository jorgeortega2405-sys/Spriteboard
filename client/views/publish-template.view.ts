import { navigate } from '../app-router.js';
import { API_ROUTES } from '../config/api-routes.js';
import { getCanvasTypeIconSvg } from '../graphics/canvas-graphics.js';
import { currentUser, escapeHtml, getApi, postApi } from '../services/api.service.js';
import { getLocalCanvasByUuid } from '../services/canvas-storage.service.js';
import { t, translateElement } from '../services/i18n.service.js';
import { renderIcons } from '../services/icon.service.js';
import { loadTemplate } from '../services/template.service.js';
import { showToast } from '../services/toast.service.js';
import { canPublishTemplates } from '../types/auth.types.js';
import { CanvasItem } from '../types/canvas.types.js';
import { ViewController } from '../types/common.types.js';
import { setupDropdown, withButtonLoading } from '../utils/dom.util.js';

const CATEGORY_NAMES: Record<string, string> = {
  business: 'Negocios',
  marketing: 'Marketing e Impresión',
  social: 'Redes sociales',
  videos: 'Videos',
};

const CATEGORY_ICONS: Record<string, string> = {
  business: 'business_center',
  marketing: 'storefront',
  social: 'share',
  videos: 'videocam',
};

export class PublishTemplateViewController implements ViewController {
  private abortController = new AbortController();
  private canvas: CanvasItem | null = null;
  private canvasUuid: string;
  private categoryDropdown: { close: () => void; destroy: () => void } | null = null;
  private container: HTMLElement;
  private isPremium = false;
  private pricingDropdown: { close: () => void; destroy: () => void } | null = null;
  private selectedCategory = 'business';

  constructor(container: HTMLElement, canvasUuid: string) {
    this.container = container;
    this.canvasUuid = canvasUuid;
  }

  public async init(): Promise<void> {
    if (!currentUser) {
      showToast(t('templates.login_required_publish') || 'Debes iniciar sesión para publicar una plantilla.', 'error');
      navigate('/login');
      return;
    }

    if (!canPublishTemplates(currentUser)) {
      showToast(t('templates.designer_required') || 'Solo los usuarios con rol de Diseñador pueden publicar plantillas.', 'error');
      navigate('/creators');
      return;
    }

    await this.loadCanvas();
    this.setupDropdowns();
    this.bindEvents();
    this.syncPreview();
    renderIcons(this.container);
    translateElement(this.container);
  }

  public destroy(): void {
    this.categoryDropdown?.destroy();
    this.pricingDropdown?.destroy();
    this.abortController.abort();
  }

  private async loadCanvas(): Promise<void> {
    if (!this.canvasUuid) {
      showToast('Lienzo no especificado.', 'error');
      navigate('/templates');
      return;
    }

    try {
      const local = await getLocalCanvasByUuid(this.canvasUuid);
      if (local) {
        this.canvas = local;
      }
    } catch {}

    if (!this.canvas) {
      try {
        const res = await getApi(API_ROUTES.canvases.byId(this.canvasUuid));
        if (res.ok) {
          const data = await res.json();
          this.canvas = data?.canvas || null;
        }
      } catch {}
    }

    if (!this.canvas) {
      showToast('No se encontró el lienzo para publicar.', 'error');
      navigate('/templates');
      return;
    }

    const rawType = (this.canvas.canvas_type || this.canvas.unit || 'board').toLowerCase().trim();
    const nameLower = (this.canvas.name || '').toLowerCase();

    if (rawType === 'presentation' || rawType === 'doc' || rawType === 'sheet' || rawType === 'board') {
      this.selectedCategory = 'business';
    } else if (rawType === 'video') {
      this.selectedCategory = 'videos';
    } else if (
      nameLower.includes('flyer') ||
      nameLower.includes('poster') ||
      nameLower.includes('póster') ||
      nameLower.includes('tarjeta') ||
      nameLower.includes('folleto') ||
      nameLower.includes('menu') ||
      nameLower.includes('menú') ||
      nameLower.includes('logo') ||
      nameLower.includes('invitacion') ||
      nameLower.includes('invitación') ||
      nameLower.includes('correo')
    ) {
      this.selectedCategory = 'marketing';
    } else {
      this.selectedCategory = 'social';
    }

    const titleInput = this.container.querySelector<HTMLInputElement>('[data-ref="input-template-title"]');
    if (titleInput && this.canvas.name) {
      titleInput.value = this.canvas.name;
    }

    const imgEl = this.container.querySelector<HTMLImageElement>('[data-ref="preview-canvas-img"]');
    const placeholderEl = this.container.querySelector<HTMLElement>('[data-ref="preview-canvas-placeholder"]');

    if (this.canvas.preview_thumbnail && imgEl) {
      imgEl.src = this.canvas.preview_thumbnail;
      imgEl.style.display = 'block';
      imgEl.classList.add('image-loaded');
      if (placeholderEl) placeholderEl.style.display = 'none';
    } else if (imgEl) {
      imgEl.style.display = 'none';
      if (placeholderEl) placeholderEl.style.display = 'flex';
    }

    this.updateCategoryDisplay(this.selectedCategory);
    this.updatePricingDisplay(this.isPremium);
  }

  private setupDropdowns(): void {
    const categoryWrapper = this.container.querySelector<HTMLElement>('[data-ref="dropdown-wrapper-category"]');
    if (categoryWrapper) {
      this.categoryDropdown = setupDropdown(categoryWrapper, {
        isSelect: true,
        matchWidth: true,
        onSelect: (val: string) => {
          if (!val) return;
          this.selectedCategory = val;
          this.updateCategoryDisplay(val);
          this.syncPreview();
        },
      });
    }

    const pricingWrapper = this.container.querySelector<HTMLElement>('[data-ref="dropdown-wrapper-pricing"]');
    if (pricingWrapper) {
      this.pricingDropdown = setupDropdown(pricingWrapper, {
        isSelect: true,
        matchWidth: true,
        onSelect: (val: string) => {
          this.isPremium = val === 'premium';
          this.updatePricingDisplay(this.isPremium);
          this.syncPreview();
        },
      });
    }
  }

  private updateCategoryDisplay(category: string): void {
    const textEl = this.container.querySelector<HTMLElement>('[data-ref="category-selected-text"]');
    const iconEl = this.container.querySelector<HTMLElement>('[data-ref="category-selected-icon"]');
    const label = CATEGORY_NAMES[category] || 'Negocios';
    const icon = CATEGORY_ICONS[category] || 'business_center';

    if (textEl) textEl.textContent = label;
    if (iconEl) {
      iconEl.innerHTML = `<use href="/icons.svg#${icon}"></use>`;
    }

    const menuItems = this.container.querySelectorAll<HTMLElement>('[data-ref="list-category"] .menu-item');
    menuItems.forEach((item) => {
      const isSelected = item.getAttribute('data-value') === category;
      item.classList.toggle('is-selected', isSelected);
    });
  }

  private updatePricingDisplay(isPremium: boolean): void {
    const textEl = this.container.querySelector<HTMLElement>('[data-ref="pricing-selected-text"]');
    const iconEl = this.container.querySelector<HTMLElement>('[data-ref="pricing-selected-icon"]');
    const noticeEl = this.container.querySelector<HTMLElement>('[data-ref="pricing-notice"]');
    const noticeTextEl = this.container.querySelector<HTMLElement>('[data-ref="pricing-notice-text"]');

    if (textEl) {
      textEl.textContent = isPremium ? 'Premium (PRO - Exclusivo suscriptores)' : 'Libre (Gratis para todos)';
    }
    if (iconEl) {
      iconEl.innerHTML = `<use href="/icons.svg#${isPremium ? 'workspace_premium' : 'public'}"></use>`;
      iconEl.style.color = isPremium ? '#f59e0b' : '';
    }

    if (noticeEl && noticeTextEl) {
      if (isPremium) {
        noticeEl.className = 'banner banner--warning publish-pricing-notice';
        noticeTextEl.textContent = t('templates.notice_premium') || 'Esta plantilla quedará identificada como contenido PRO y solo los usuarios con suscripción de pago podrán utilizarla.';
      } else {
        noticeEl.className = 'banner banner--info publish-pricing-notice';
        noticeTextEl.textContent = t('templates.notice_free') || 'Esta plantilla estará disponible de forma gratuita para todos los usuarios de Spriteboard.';
      }
    }

    const menuItems = this.container.querySelectorAll<HTMLElement>('[data-ref="list-pricing"] .menu-item');
    menuItems.forEach((item) => {
      const isSelected = item.getAttribute('data-value') === (isPremium ? 'premium' : 'free');
      item.classList.toggle('is-selected', isSelected);
    });
  }

  private syncPreview(): void {
    const titleInput = this.container.querySelector<HTMLInputElement>('[data-ref="input-template-title"]');
    const previewTitle = this.container.querySelector<HTMLElement>('[data-ref="preview-meta-title"]');
    const previewBadgeText = this.container.querySelector<HTMLElement>('[data-ref="preview-meta-badge-text"]');
    const previewBadgeIcon = this.container.querySelector<HTMLElement>('[data-ref="preview-meta-badge-icon"]');
    const previewPremiumBadge = this.container.querySelector<HTMLElement>('[data-ref="preview-premium-badge"]');
    const previewDims = this.container.querySelector<HTMLElement>('[data-ref="preview-meta-dims"]');
    const previewAuthorName = this.container.querySelector<HTMLElement>('[data-ref="preview-author-name"]');
    const previewAuthorAvatar = this.container.querySelector<HTMLElement>('[data-ref="preview-author-avatar"]');
    const previewAuthorInitials = this.container.querySelector<HTMLElement>('[data-ref="preview-author-initials"]');

    const currentTitle = titleInput?.value.trim() || this.canvas?.name || 'Plantilla sin título';
    if (previewTitle) previewTitle.textContent = currentTitle;

    const catLabel = CATEGORY_NAMES[this.selectedCategory] || 'Negocios';
    const catIcon = CATEGORY_ICONS[this.selectedCategory] || 'business_center';

    if (previewBadgeText) previewBadgeText.textContent = catLabel;
    if (previewBadgeIcon) {
      previewBadgeIcon.innerHTML = `<use href="/icons.svg#${catIcon}"></use>`;
    }

    if (previewPremiumBadge) {
      previewPremiumBadge.style.display = this.isPremium ? 'inline-flex' : 'none';
    }

    if (previewDims && this.canvas) {
      previewDims.textContent = `${this.canvas.width || 1920} × ${this.canvas.height || 1080} px`;
    }

    const isOfficial = currentUser?.role === 'SYSTEM_ACCOUNT' || currentUser?.roles?.includes('SYSTEM_ACCOUNT');
    const authorName = isOfficial ? 'Spriteboard Oficial' : (currentUser?.username || 'Usuario');

    if (previewAuthorName) previewAuthorName.textContent = authorName;

    if (currentUser?.avatar_url && previewAuthorAvatar) {
      previewAuthorAvatar.innerHTML = `<img src="${escapeHtml(currentUser.avatar_url)}" alt="${escapeHtml(authorName)}" />`;
    } else if (previewAuthorInitials) {
      previewAuthorInitials.textContent = (authorName.charAt(0) || 'S').toUpperCase();
    }

    renderIcons(this.container);
  }

  private bindEvents(): void {
    const { signal } = this.abortController;

    const btnBack = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-publish-back"]');
    const btnCancel = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-cancel-publish"]');
    const btnSubmit = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-submit-publish"]');
    const titleInput = this.container.querySelector<HTMLInputElement>('[data-ref="input-template-title"]');

    const goBack = () => {
      if (window.history.length > 1) {
        window.history.back();
      } else {
        navigate('/templates');
      }
    };

    btnBack?.addEventListener('click', goBack, { signal });
    btnCancel?.addEventListener('click', goBack, { signal });

    titleInput?.addEventListener(
      'input',
      () => {
        this.syncPreview();
      },
      { signal }
    );

    btnSubmit?.addEventListener(
      'click',
      () => {
        void this.handleSubmit();
      },
      { signal }
    );
  }

  private showError(message: string): void {
    const banner = this.container.querySelector<HTMLElement>('[data-ref="publish-error-banner"]');
    const msgEl = this.container.querySelector<HTMLElement>('[data-ref="publish-error-msg"]');
    if (banner && msgEl) {
      msgEl.textContent = message;
      banner.style.display = 'flex';
      banner.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  private clearError(): void {
    const banner = this.container.querySelector<HTMLElement>('[data-ref="publish-error-banner"]');
    if (banner) {
      banner.style.display = 'none';
    }
  }

  private async handleSubmit(): Promise<void> {
    if (!this.canvas) return;

    this.clearError();

    const titleInput = this.container.querySelector<HTMLInputElement>('[data-ref="input-template-title"]');
    const descInput = this.container.querySelector<HTMLTextAreaElement>('[data-ref="input-template-desc"]');
    const tagsInput = this.container.querySelector<HTMLInputElement>('[data-ref="input-template-tags"]');
    const btnSubmit = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-submit-publish"]');

    const title = titleInput?.value.trim() || '';
    if (!title) {
      this.showError(t('templates.error_title_required') || 'El título de la plantilla es obligatorio.');
      titleInput?.focus();
      return;
    }

    if (!btnSubmit) return;

    await withButtonLoading(btnSubmit, t('templates.btn_publish') || 'Publicando...', async () => {
      try {
        const rawTags = tagsInput?.value || '';
        const tags = rawTags
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean);

        const res = await postApi(API_ROUTES.templates.publish, {
          canvas_uuid: this.canvas?.uuid,
          category: this.selectedCategory,
          description: descInput?.value.trim() || undefined,
          is_premium: this.isPremium,
          tags,
          title,
        });

        if (res.ok) {
          showToast(t('templates.publish_success') || '¡Plantilla publicada exitosamente!', 'success');
          navigate('/templates');
          return;
        }

        const data = await res.json().catch(() => ({}));
        this.showError(data?.error || t('templates.publish_error') || 'No se pudo publicar la plantilla.');
      } catch (err: any) {
        this.showError(err?.message || (t('templates.publish_error') || 'Error al procesar la solicitud.'));
      }
    });
  }
}

export async function createPublishTemplateView(canvasUuid?: string): Promise<HTMLElement> {
  const container = await loadTemplate('/views/templates/publish-template.html');
  renderIcons(container);

  const targetUuid = canvasUuid || new URLSearchParams(window.location.search).get('canvas') || '';
  const controller = new PublishTemplateViewController(container, targetUuid);
  await controller.init();
  (container as any).__controller = controller;

  return container;
}
