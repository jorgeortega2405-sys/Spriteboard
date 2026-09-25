import { navigate } from '../app-router.js';
import { openTemplatePreviewModal } from '../components/template-preview-modal.component.js';
import { API_ROUTES } from '../config/api-routes.js';
import { ALL_PRESETS, PresetItem } from '../config/templates.config.js';
import { currentUser, deleteApi, escapeHtml, getApi, postApi } from '../services/api.service.js';
import { t, translateElement } from '../services/i18n.service.js';
import { renderIcons } from '../services/icon.service.js';
import { SkeletonService } from '../services/skeleton.service.js';
import { loadTemplate } from '../services/template.service.js';
import { showToast } from '../services/toast.service.js';
import { PublicUserProfile } from '../types/user-profile.types.js';
import { removeEmptyState, renderEmptyState, setupLazyImages } from '../utils/dom.util.js';

class ProfileController {
  private container: HTMLElement;
  private username: string;
  private abortController: AbortController;
  private profile: PublicUserProfile | null = null;
  private templates: any[] = [];
  private activeTab: 'content' | 'info' = 'content';
  private isFollowPending = false;

  private bannerImg: HTMLImageElement | null = null;
  private bannerFallback: HTMLElement | null = null;
  private btnUploadBanner: HTMLButtonElement | null = null;
  private inputBannerFile: HTMLInputElement | null = null;

  private avatarImg: HTMLImageElement | null = null;
  private avatarFallback: HTMLElement | null = null;
  private displayNameEl: HTMLElement | null = null;
  private usernameEl: HTMLElement | null = null;
  private badgeDesigner: HTMLElement | null = null;
  private followersCountEl: HTMLElement | null = null;
  private templatesCountEl: HTMLElement | null = null;
  private bioSnippetEl: HTMLElement | null = null;

  private btnFollow: HTMLButtonElement | null = null;
  private btnFollowText: HTMLElement | null = null;
  private btnEditProfile: HTMLButtonElement | null = null;
  private btnShareProfile: HTMLButtonElement | null = null;

  private tabBtnContent: HTMLButtonElement | null = null;
  private tabBtnInfo: HTMLButtonElement | null = null;
  private tabPaneContent: HTMLElement | null = null;
  private tabPaneInfo: HTMLElement | null = null;

  private templatesGrid: HTMLElement | null = null;
  private templatesEmpty: HTMLElement | null = null;

  private infoBioEl: HTMLElement | null = null;
  private metaJoinedTextEl: HTMLElement | null = null;
  private metaCountryEl: HTMLElement | null = null;
  private metaCountryTextEl: HTMLElement | null = null;
  private metaWebsiteEl: HTMLElement | null = null;
  private metaWebsiteLinkEl: HTMLAnchorElement | null = null;

  private statTemplatesValEl: HTMLElement | null = null;
  private statFollowersValEl: HTMLElement | null = null;
  private statFollowingValEl: HTMLElement | null = null;

  constructor(container: HTMLElement, username: string) {
    this.container = container;
    this.username = username;
    this.abortController = new AbortController();
  }

  public async init(): Promise<void> {
    this.bindDomElements();
    this.bindEvents();

    if (this.templatesGrid) {
      SkeletonService.renderGridCardSkeletons(this.templatesGrid, 6, 'template');
    }

    await this.loadProfileData();
  }

  public destroy(): void {
    this.abortController.abort();
  }

  private bindDomElements(): void {
    this.bannerImg = this.container.querySelector<HTMLImageElement>('[data-ref="profile-banner-img"]');
    this.bannerFallback = this.container.querySelector<HTMLElement>('[data-ref="profile-banner-fallback"]');
    this.btnUploadBanner = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-upload-banner"]');
    this.inputBannerFile = this.container.querySelector<HTMLInputElement>('[data-ref="input-banner-file"]');

    this.avatarImg = this.container.querySelector<HTMLImageElement>('[data-ref="profile-avatar-img"]');
    this.avatarFallback = this.container.querySelector<HTMLElement>('[data-ref="profile-avatar-fallback"]');
    this.displayNameEl = this.container.querySelector<HTMLElement>('[data-ref="profile-display-name"]');
    this.usernameEl = this.container.querySelector<HTMLElement>('[data-ref="profile-username"]');
    this.badgeDesigner = this.container.querySelector<HTMLElement>('[data-ref="badge-designer"]');
    this.followersCountEl = this.container.querySelector<HTMLElement>('[data-ref="profile-followers-count"]');
    this.templatesCountEl = this.container.querySelector<HTMLElement>('[data-ref="profile-templates-count"]');
    this.bioSnippetEl = this.container.querySelector<HTMLElement>('[data-ref="profile-bio-snippet"]');

    this.btnFollow = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-follow-user"]');
    this.btnFollowText = this.container.querySelector<HTMLElement>('[data-ref="btn-follow-text"]');
    this.btnEditProfile = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-edit-profile"]');
    this.btnShareProfile = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-share-profile"]');

    this.tabBtnContent = this.container.querySelector<HTMLButtonElement>('[data-ref="tab-btn-content"]');
    this.tabBtnInfo = this.container.querySelector<HTMLButtonElement>('[data-ref="tab-btn-info"]');
    this.tabPaneContent = this.container.querySelector<HTMLElement>('[data-ref="tab-pane-content"]');
    this.tabPaneInfo = this.container.querySelector<HTMLElement>('[data-ref="tab-pane-info"]');

    this.templatesGrid = this.container.querySelector<HTMLElement>('[data-ref="profile-templates-grid"]');
    this.templatesEmpty = this.container.querySelector<HTMLElement>('[data-ref="profile-templates-empty"]');

    this.infoBioEl = this.container.querySelector<HTMLElement>('[data-ref="profile-info-bio"]');
    this.metaJoinedTextEl = this.container.querySelector<HTMLElement>('[data-ref="profile-meta-joined-text"]');
    this.metaCountryEl = this.container.querySelector<HTMLElement>('[data-ref="profile-meta-country"]');
    this.metaCountryTextEl = this.container.querySelector<HTMLElement>('[data-ref="profile-meta-country-text"]');
    this.metaWebsiteEl = this.container.querySelector<HTMLElement>('[data-ref="profile-meta-website"]');
    this.metaWebsiteLinkEl = this.container.querySelector<HTMLAnchorElement>('[data-ref="profile-meta-website-link"]');

    this.statTemplatesValEl = this.container.querySelector<HTMLElement>('[data-ref="stat-value-templates"]');
    this.statFollowersValEl = this.container.querySelector<HTMLElement>('[data-ref="stat-value-followers"]');
    this.statFollowingValEl = this.container.querySelector<HTMLElement>('[data-ref="stat-value-following"]');
  }

  private bindEvents(): void {
    const { signal } = this.abortController;

    this.tabBtnContent?.addEventListener('click', () => {
      this.switchTab('content');
    }, { signal });

    this.tabBtnInfo?.addEventListener('click', () => {
      this.switchTab('info');
    }, { signal });

    this.btnFollow?.addEventListener('click', () => {
      void this.handleFollowToggle();
    }, { signal });

    this.btnShareProfile?.addEventListener('click', () => {
      void this.handleShareProfile();
    }, { signal });

    this.btnEditProfile?.addEventListener('click', () => {
      navigate('/settings/your-account');
    }, { signal });

    this.btnUploadBanner?.addEventListener('click', () => {
      this.inputBannerFile?.click();
    }, { signal });

    this.inputBannerFile?.addEventListener('change', () => {
      const file = this.inputBannerFile?.files?.[0];
      if (file) {
        void this.handleBannerUpload(file);
      }
    }, { signal });
  }

  private async loadProfileData(): Promise<void> {
    try {
      const res = await getApi(API_ROUTES.users.profile(this.username));
      if (!res.ok) {
        showToast(t('profile.not_found') || 'Perfil de usuario no encontrado.', 'danger');
        navigate('/templates');
        return;
      }

      const data = await res.json();
      this.profile = data?.profile || null;
      if (!this.profile) {
        navigate('/templates');
        return;
      }

      this.renderProfile();
      void this.loadUserTemplates();
    } catch {
      showToast(t('toasts.generic_error') || 'Error al cargar perfil.', 'danger');
      navigate('/templates');
    }
  }

  private async loadUserTemplates(): Promise<void> {
    try {
      const res = await getApi(API_ROUTES.users.profileTemplates(this.username));
      if (res.ok) {
        const data = await res.json();
        this.templates = Array.isArray(data.templates) ? data.templates : [];
      }
    } catch {}
    this.renderTemplatesGrid();
  }

  private renderProfile(): void {
    if (!this.profile) return;

    if (this.profile.banner_url && this.bannerImg) {
      this.bannerImg.src = this.profile.banner_url;
      this.bannerImg.style.display = 'block';
      if (this.bannerFallback) this.bannerFallback.style.display = 'none';
    } else {
      if (this.bannerImg) this.bannerImg.style.display = 'none';
      if (this.bannerFallback) this.bannerFallback.style.display = 'block';
    }

    if (this.profile.is_me && this.btnUploadBanner) {
      this.btnUploadBanner.style.display = 'inline-flex';
    }

    const isOfficialAccount = this.profile.id === -1 || this.profile.username === 'Spriteboard Oficial' || this.profile.username.toLowerCase() === 'spriteboard';

    if (this.profile.avatar_url && this.avatarImg) {
      this.avatarImg.src = this.profile.avatar_url;
      this.avatarImg.style.display = 'block';
      if (this.avatarFallback) this.avatarFallback.style.display = 'none';
    } else if (this.avatarFallback) {
      if (isOfficialAccount) {
        this.avatarFallback.className = 'profile-avatar-fallback profile-avatar-fallback--official';
        this.avatarFallback.innerHTML = '<svg class="component-icon" style="color: #fbbf24; width: 44px; height: 44px;" aria-hidden="true"><use href="/icons.svg#auto_awesome"></use></svg>';
      } else {
        const initial = escapeHtml(this.profile.username.charAt(0).toUpperCase() || 'U');
        this.avatarFallback.className = 'profile-avatar-fallback';
        this.avatarFallback.textContent = initial;
      }
      this.avatarFallback.style.display = 'flex';
      if (this.avatarImg) this.avatarImg.style.display = 'none';
    }

    if (this.displayNameEl) {
      this.displayNameEl.textContent = this.profile.username;
    }
    if (this.usernameEl) {
      this.usernameEl.textContent = `@${this.profile.username}`;
    }

    if (this.badgeDesigner) {
      if (isOfficialAccount) {
        this.badgeDesigner.innerHTML = '<svg class="component-icon" aria-hidden="true"><use href="/icons.svg#check_circle"></use></svg><span>Oficial</span>';
        this.badgeDesigner.style.display = 'inline-flex';
      } else {
        this.badgeDesigner.innerHTML = '<svg class="component-icon" aria-hidden="true"><use href="/icons.svg#palette"></use></svg><span>Diseñador</span>';
        this.badgeDesigner.style.display = this.profile.is_designer ? 'inline-flex' : 'none';
      }
    }

    this.updateFollowersCountUi();

    if (this.templatesCountEl) {
      const tplLabel = t('profile.templates_stat_label') || '{count} plantillas';
      this.templatesCountEl.textContent = tplLabel.replace('{count}', String(this.profile.templates_count));
    }

    if (this.profile.bio && this.profile.bio.trim()) {
      if (this.bioSnippetEl) {
        this.bioSnippetEl.textContent = this.profile.bio.trim();
        this.bioSnippetEl.style.display = 'block';
      }
      if (this.infoBioEl) {
        this.infoBioEl.textContent = this.profile.bio.trim();
      }
    } else {
      if (this.bioSnippetEl) this.bioSnippetEl.style.display = 'none';
      if (this.infoBioEl) {
        this.infoBioEl.textContent = t('profile.no_bio') || 'Sin descripción disponible.';
      }
    }

    if (this.profile.is_me) {
      if (this.btnFollow) this.btnFollow.style.display = 'none';
      if (this.btnEditProfile) this.btnEditProfile.style.display = 'inline-flex';
    } else {
      if (this.btnEditProfile) this.btnEditProfile.style.display = 'none';
      if (this.btnFollow) {
        this.btnFollow.style.display = 'inline-flex';
        this.updateFollowButtonUi();
      }
    }

    if (this.metaJoinedTextEl && this.profile.created_at) {
      try {
        const d = new Date(this.profile.created_at);
        const dateStr = d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
        const joinedLabel = t('profile.member_since_label') || 'Miembro desde {date}';
        this.metaJoinedTextEl.textContent = joinedLabel.replace('{date}', dateStr);
      } catch {}
    }

    if (this.profile.country && this.metaCountryEl && this.metaCountryTextEl) {
      this.metaCountryTextEl.textContent = this.profile.country;
      this.metaCountryEl.style.display = 'flex';
    }

    if (this.profile.website_url && this.metaWebsiteEl && this.metaWebsiteLinkEl) {
      this.metaWebsiteLinkEl.href = this.profile.website_url;
      this.metaWebsiteLinkEl.textContent = this.profile.website_url.replace(/^https?:\/\//, '');
      this.metaWebsiteEl.style.display = 'flex';
    }

    if (this.statTemplatesValEl) {
      this.statTemplatesValEl.textContent = String(this.profile.templates_count);
    }
    if (this.statFollowersValEl) {
      this.statFollowersValEl.textContent = String(this.profile.followers_count);
    }
    if (this.statFollowingValEl) {
      this.statFollowingValEl.textContent = String(this.profile.following_count);
    }

    renderIcons(this.container);
  }

  private updateFollowersCountUi(): void {
    if (!this.profile || !this.followersCountEl) return;
    const rawLabel = t('profile.followers_stat_label') || '{count} seguidores';
    this.followersCountEl.textContent = rawLabel.replace('{count}', String(this.profile.followers_count));
    if (this.statFollowersValEl) {
      this.statFollowersValEl.textContent = String(this.profile.followers_count);
    }
  }

  private updateFollowButtonUi(): void {
    if (!this.btnFollow || !this.profile) return;
    const isFollowing = this.profile.is_following;

    this.btnFollow.classList.toggle('component-button--black', !isFollowing);
    this.btnFollow.classList.toggle('component-button--outline', isFollowing);

    const iconName = isFollowing ? 'check' : 'person_add';
    const textKey = isFollowing ? 'profile.following' : 'profile.follow';
    const defaultText = isFollowing ? 'Siguiendo' : 'Seguir';

    this.btnFollow.innerHTML = `
      <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#${iconName}"></use></svg>
      <span data-ref="btn-follow-text">${t(textKey) || defaultText}</span>
    `;
    renderIcons(this.btnFollow);
  }

  private async handleFollowToggle(): Promise<void> {
    if (!currentUser) {
      showToast(t('profile.login_required_follow') || 'Debes iniciar sesión para seguir a este creador.', 'info');
      navigate('/login');
      return;
    }

    if (!this.profile || this.isFollowPending) return;

    this.isFollowPending = true;
    const prevFollowing = this.profile.is_following;
    const nextFollowing = !prevFollowing;

    this.profile.is_following = nextFollowing;
    this.profile.followers_count += nextFollowing ? 1 : -1;
    if (this.profile.followers_count < 0) this.profile.followers_count = 0;

    this.updateFollowButtonUi();
    this.updateFollowersCountUi();

    try {
      const res = await postApi(API_ROUTES.users.follow(this.profile.username), {});
      if (res.ok) {
        const data = await res.json();
        this.profile.is_following = Boolean(data.following);
        this.profile.followers_count = Number(data.followers_count || this.profile.followers_count);
        this.updateFollowButtonUi();
        this.updateFollowersCountUi();
      } else {
        this.profile.is_following = prevFollowing;
        this.profile.followers_count += prevFollowing ? 1 : -1;
        this.updateFollowButtonUi();
        this.updateFollowersCountUi();
        showToast(t('toasts.generic_error') || 'Error al actualizar seguimiento.', 'danger');
      }
    } catch {
      this.profile.is_following = prevFollowing;
      this.profile.followers_count += prevFollowing ? 1 : -1;
      this.updateFollowButtonUi();
      this.updateFollowersCountUi();
      showToast(t('toasts.generic_error') || 'Error al actualizar seguimiento.', 'danger');
    } finally {
      this.isFollowPending = false;
    }
  }

  private async handleBannerUpload(file: File): Promise<void> {
    if (!currentUser) return;
    const formData = new FormData();
    formData.append('banner', file);

    showToast(t('profile.uploading_banner') || 'Subiendo portada...', 'info');

    try {
      const res = await postApi(API_ROUTES.users.banner, formData);
      if (res.ok) {
        const data = await res.json();
        if (data?.banner_url) {
          if (this.profile) this.profile.banner_url = data.banner_url;
          if (this.bannerImg) {
            this.bannerImg.src = data.banner_url;
            this.bannerImg.style.display = 'block';
          }
          if (this.bannerFallback) this.bannerFallback.style.display = 'none';
          showToast(t('profile.banner_updated') || 'Portada actualizada exitosamente.', 'success');
        }
      } else {
        const data = await res.json().catch(() => ({}));
        showToast(data?.error || t('profile.banner_upload_error') || 'Error al subir portada.', 'danger');
      }
    } catch {
      showToast(t('profile.banner_upload_error') || 'Error al subir portada.', 'danger');
    }
  }

  private async handleShareProfile(): Promise<void> {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      showToast(t('profile.link_copied') || 'Enlace del perfil copiado al portapapeles.', 'success');
    } catch {
      showToast(t('toasts.copied') || 'Copiado al portapapeles', 'success');
    }
  }

  private switchTab(tab: 'content' | 'info'): void {
    if (this.activeTab === tab) return;
    this.activeTab = tab;

    this.tabBtnContent?.classList.toggle('is-active', tab === 'content');
    this.tabBtnInfo?.classList.toggle('is-active', tab === 'info');

    if (this.tabPaneContent) this.tabPaneContent.style.display = tab === 'content' ? 'block' : 'none';
    if (this.tabPaneInfo) this.tabPaneInfo.style.display = tab === 'info' ? 'block' : 'none';
  }

  private renderTemplatesGrid(): void {
    if (!this.templatesGrid) return;

    if (this.templates.length === 0) {
      this.templatesGrid.innerHTML = '';
      this.templatesGrid.style.display = 'none';
      const isOwner = Boolean(this.profile?.is_me);
      renderEmptyState({
        container: this.container.querySelector<HTMLElement>('[data-ref="profile-templates-section"]') || this.container,
        dataRef: 'profile-templates-empty-state',
        desc: isOwner
          ? (t('profile.empty_owner_templates_desc') || 'Abre cualquier lienzo en Spriteboard y selecciona "Publicar como plantilla" para compartir tus diseños.')
          : (t('profile.empty_templates_desc') || 'Este creador aún no ha publicado plantillas públicas.'),
        graphicType: 'canvas',
        title: t('profile.empty_templates_title') || 'Sin plantillas publicadas',
      });
      return;
    }

    const sectionEl = this.container.querySelector<HTMLElement>('[data-ref="profile-templates-section"]');
    if (sectionEl) {
      removeEmptyState(sectionEl, 'profile-templates-empty-state');
    }

    this.templatesGrid.style.display = 'grid';
    this.templatesGrid.innerHTML = this.templates.map((tItem) => this.buildTemplateCardHtml(tItem)).join('');

    setupLazyImages(this.templatesGrid);
    renderIcons(this.templatesGrid);

    this.templatesGrid.querySelectorAll<HTMLElement>('[data-template-uuid]').forEach((card) => {
      card.addEventListener('click', () => {
        const uuid = card.getAttribute('data-template-uuid');
        const officialPreset = ALL_PRESETS.find((p) => p.id === uuid || p.templateUuid === uuid);
        if (officialPreset) {
          openTemplatePreviewModal(officialPreset);
          return;
        }

        const found = this.templates.find((item: any) => item.uuid === uuid);
        if (found) {
          const preset: PresetItem = {
            aspectType: 'wide',
            authorAvatar: found.author_avatar,
            authorName: found.author_username,
            canvasData: found.canvas_data,
            canvasType: found.canvas_type,
            categoryKey: found.category || 'general',
            categoryName: found.category || 'General',
            description: found.description,
            height: 1080,
            id: `community-${found.uuid}`,
            imagePath: found.preview_thumbnail || '/assets/templates/boards/retro.svg',
            isPremium: Boolean(found.is_premium),
            isTemplate: true,
            name: found.title,
            tags: found.tags,
            templateUuid: found.uuid,
            width: 1920,
          };
          openTemplatePreviewModal(preset);
        }
      });
    });
  }

  private buildTemplateCardHtml(tItem: any): string {
    const isPres = tItem.canvas_type === 'presentation';
    const isDoc = tItem.canvas_type === 'doc';
    const defaultThumb = isPres
      ? '/assets/templates/presentations/pitch.svg'
      : (isDoc ? '/assets/templates/docs/proposal.svg' : '/assets/templates/boards/retro.svg');
    const thumbUrl = tItem.preview_thumbnail || defaultThumb;

    const isPremium = Boolean(tItem.is_premium);
    const premiumBadgeHtml = isPremium
      ? `
        <div class="template-card__badge-overlay">
          <span class="template-card__premium-badge" data-tooltip="${t('templates.badge_premium') || 'Plantilla Premium'}">
            <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#workspace_premium"></use></svg>
            <span>PRO</span>
          </span>
        </div>
      `
      : '';

    return `
      <div class="canvas-card template-card" data-ref="profile-card-${tItem.uuid}" data-template-uuid="${tItem.uuid}">
        <div class="canvas-card__thumbnail template-card__thumbnail" data-ref="profile-thumb-${tItem.uuid}">
          <img class="canvas-card__image image-lazy-fade" data-ref="profile-img-${tItem.uuid}" src="${thumbUrl}" alt="${escapeHtml(tItem.title)}" loading="lazy" decoding="async" onload="this.classList.add('image-loaded')" onerror="this.classList.add('image-loaded')" />
          ${premiumBadgeHtml}
        </div>
        <div class="canvas-card__info template-card__info" data-ref="profile-info-${tItem.uuid}">
          <span class="canvas-card__title template-card__title" data-ref="profile-title-${tItem.uuid}">${escapeHtml(tItem.title)}</span>
          <span class="template-card__author" data-ref="profile-author-${tItem.uuid}">${escapeHtml(tItem.author_username || this.username)}</span>
        </div>
      </div>
    `;
  }
}

export async function createProfileView(username: string): Promise<HTMLElement> {
  const container = await loadTemplate('/views/profile/profile.html');
  const controller = new ProfileController(container, username);
  (container as any).__controller = controller;
  (container as any).__profileController = controller;
  await controller.init();
  return container;
}
