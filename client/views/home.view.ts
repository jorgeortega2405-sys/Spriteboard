import { createPopper, Instance as PopperInstance, VirtualElement } from '@popperjs/core';
import { navigate } from '../app-router.js';
import { openCanvasDownloadModal } from '../components/canvas-download-modal.component.js';
import { openCanvasShareModal } from '../components/canvas-share-modal.component.js';
import { openCreateCanvasModal } from '../components/create-canvas-modal.component.js';
import { openCreateFolderModal, openRenameFolderModal } from '../components/folder-modal.component.js';
import { createSidebar } from '../components/layout.component.js';
import { openModal } from '../components/modal.component.js';
import { openMoveCanvasModal } from '../components/move-canvas-modal.component.js';
import { openTemplatePreviewModal } from '../components/template-preview-modal.component.js';
import { openUpgradeModal } from '../components/upgrade-modal.component.js';
import { API_ROUTES } from '../config/api-routes.js';
import { ALL_PRESETS, PresetItem } from '../config/templates.config.js';
import { buildAdCardHtml, createAdCardElement, DEFAULT_AD_FREQUENCY, getAdByIndex, handleAdClick, shouldShowAds } from '../services/ad.service.js';
import { currentUser, deleteApi, escapeHtml, getApi, postApi, putApi } from '../services/api.service.js';
import { createAndOpenCanvas } from '../services/canvas-creator.service.js';
import { getAllLocalCanvases, getLocalCanvasByUuid, markLocalCanvasAsSynced, removeLocalCanvas, saveLocalCanvas, softDeleteLocalCanvas } from '../services/canvas-storage.service.js';
import { t, translateElement } from '../services/i18n.service.js';
import { createIconSvg, renderIcons } from '../services/icon.service.js';
import { SkeletonService } from '../services/skeleton.service.js';
import { loadTemplate } from '../services/template.service.js';
import { showToast } from '../services/toast.service.js';
import { CanvasItem, FolderItem } from '../types/canvas.types.js';
import { bindDragToScroll, CarouselController, closeAllDropdowns, initCarouselScroll, registerActiveDropdown, removeEmptyState, renderEmptyState, setupDropdown, setupLazyImages, unregisterActiveDropdown } from '../utils/dom.util.js';
import { exportDocWord } from './doc/doc-export.service.js';

const BATCH_SIZE = 20;

function formatEditedTime(dateStr?: string | null): string {
  if (!dateStr) return 'hace un momento';
  const date = new Date(dateStr);
  const now = new Date();
  const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (isNaN(diffSec) || diffSec < 60) return 'hace un momento';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return diffMin === 1 ? 'hace 1 minuto' : `hace ${diffMin} minutos`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return diffHours === 1 ? 'hace 1 hora' : `hace ${diffHours} horas`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return diffDays === 1 ? 'hace 1 día' : `hace ${diffDays} días`;
  const diffWeeks = Math.floor(diffDays / 7);
  if (diffWeeks < 4) return diffWeeks === 1 ? 'hace 1 semana' : `hace ${diffWeeks} semanas`;
  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths < 12) return diffMonths === 1 ? 'hace 1 mes' : `hace ${diffMonths} meses`;
  return diffDays > 365 ? 'hace más de 1 año' : date.toLocaleDateString();
}

class HomeController {
  private container: HTMLElement;
  private abortController: AbortController;
  private allCanvases: CanvasItem[] = [];
  private currentCanvases: CanvasItem[] = [];
  private currentEntityFilter: 'all' | 'designs' | 'folders' = 'all';
  private currentTypeFilter: 'all' | 'board' | 'doc' = 'all';
  private currentSort: 'activity' | 'alpha-asc' | 'alpha-desc' = 'activity';
  private currentFolders: FolderItem[] = [];
  private typeDropdownController: ReturnType<typeof setupDropdown> | null = null;
  private sortDropdownController: ReturnType<typeof setupDropdown> | null = null;
  private currentPage = 1;
  private totalPages = 1;
  private hasMore = false;
  private isLoadingBatch = false;
  private searchDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  private searchQuery = '';
  private gridEl: HTMLElement | null = null;
  private canvasSection: HTMLElement | null = null;
  private scrollableEl: HTMLElement | null = null;
  private sentinelEl: HTMLElement | null = null;
  private scrollObserver: IntersectionObserver | null = null;
  private activeOpenDropdown: HTMLElement | null = null;
  private activeOpenCard: HTMLElement | null = null;
  private activeCardPopper: PopperInstance | null = null;

  private templatesSection: HTMLElement | null = null;
  private templatesGridEl: HTMLElement | null = null;
  private templatesSentinelEl: HTMLElement | null = null;
  private templatesTypeDropdownController: ReturnType<typeof setupDropdown> | null = null;
  private templatesSortDropdownController: ReturnType<typeof setupDropdown> | null = null;
  private templateTypeFilter: 'all' | 'board' | 'favorites' | 'pixel' = 'all';
  private templateSort: 'default' | 'alpha-asc' | 'alpha-desc' | 'size-desc' | 'size-asc' = 'default';
  private favoritedTemplateIds = new Set<string>();
  private currentTemplates: PresetItem[] = [];
  private templatesRenderedCount = 0;
  private isRenderingTemplateBatch = false;
  private templatesScrollObserver: IntersectionObserver | null = null;
  private isShowingTemplatesEmptyState = false;

  private isSearchActive = false;
  private btnToggleSearch: HTMLElement | null = null;
  private searchToolbar: HTMLElement | null = null;
  private searchInput: HTMLInputElement | null = null;
  private btnClearSearch: HTMLElement | null = null;
  private heroSearchInput: HTMLInputElement | null = null;
  private btnHeroClearSearch: HTMLElement | null = null;
  private homeHero: HTMLElement | null = null;
  private btnFolderBack: HTMLElement | null = null;
  private canvasSectionTitle: HTMLElement | null = null;

  private currentFolderUuid: string | null = null;
  private currentFolder: FolderItem | null = null;
  private folders: FolderItem[] = [];
  private btnCreateFolder: HTMLElement | null = null;
  private btnHomeUpgrade: HTMLElement | null = null;
  private homeTitle: HTMLElement | null = null;
  private folderTitleContainer: HTMLElement | null = null;
  private folderTitleName: HTMLElement | null = null;
  private folderContextActions: HTMLElement | null = null;
  private btnFolderRename: HTMLElement | null = null;
  private btnFolderDelete: HTMLElement | null = null;
  private categoriesCarouselWrapper: HTMLElement | null = null;
  private categoriesCarouselController: CarouselController | null = null;
  private cleanupCategoriesDrag: (() => void) | null = null;

  private selectedUuids = new Set<string>();
  private selectionToolbar: HTMLElement | null = null;
  private selectionCountEl: HTMLElement | null = null;

  private marqueeEl: HTMLElement | null = null;
  private isMarqueeDragging = false;
  private dragStartX = 0;
  private dragStartY = 0;
  private dragInitialSelection = new Set<string>();
  private isShiftDrag = false;
  private didDrag = false;
  private currentDraggedUuids: string[] = [];
  private boundCloseCardDropdowns: () => void;

  constructor(container: HTMLElement) {
    this.container = container;
    this.abortController = new AbortController();
    this.boundCloseCardDropdowns = this.closeAllDropdowns.bind(this);
  }

  public async init(initialFolderUuid?: string | null): Promise<void> {
    this.gridEl = this.container.querySelector<HTMLElement>('[data-ref="canvas-grid"]');
    this.canvasSection = this.container.querySelector<HTMLElement>('[data-ref="canvas-section"]');
    this.scrollableEl = this.container;
    this.sentinelEl = this.container.querySelector<HTMLElement>('[data-ref="canvas-sentinel"]');

    this.templatesSection = this.container.querySelector<HTMLElement>('[data-ref="templates-section"]');
    this.templatesGridEl = this.container.querySelector<HTMLElement>('[data-ref="templates-grid"]');
    this.templatesSentinelEl = this.container.querySelector<HTMLElement>('[data-ref="templates-sentinel"]');

    this.btnToggleSearch = this.container.querySelector<HTMLElement>('[data-ref="btn-toggle-search"]');
    this.searchToolbar = this.container.querySelector<HTMLElement>('[data-ref="search-toolbar"]');
    this.searchInput = this.container.querySelector<HTMLInputElement>('[data-ref="home-search-input"]');
    this.btnClearSearch = this.container.querySelector<HTMLElement>('[data-ref="btn-clear-search"]');

    this.heroSearchInput = this.container.querySelector<HTMLInputElement>('[data-ref="hero-search-input"]');
    this.btnHeroClearSearch = this.container.querySelector<HTMLElement>('[data-ref="btn-hero-clear-search"]');
    this.homeHero = this.container.querySelector<HTMLElement>('[data-ref="home-hero"]');
    this.btnFolderBack = this.container.querySelector<HTMLElement>('[data-ref="btn-folder-back"]');
    this.canvasSectionTitle = this.container.querySelector<HTMLElement>('[data-ref="canvas-section-title"]');

    this.btnCreateFolder = this.container.querySelector<HTMLElement>('[data-ref="btn-create-folder"]');
    this.btnHomeUpgrade = this.container.querySelector<HTMLElement>('[data-ref="btn-home-upgrade"]');

    if (!currentUser) {
      if (this.btnHomeUpgrade) {
        this.btnHomeUpgrade.style.display = 'none';
      }
      if (this.btnCreateFolder) {
        this.btnCreateFolder.style.display = 'none';
      }
    }

    this.homeTitle = this.container.querySelector<HTMLElement>('[data-ref="home-title"]');
    this.folderTitleContainer = this.container.querySelector<HTMLElement>('[data-ref="folder-title-container"]');
    this.folderTitleName = this.container.querySelector<HTMLElement>('[data-ref="folder-title-name"]');
    this.folderContextActions = this.container.querySelector<HTMLElement>('[data-ref="folder-context-actions"]');
    this.btnFolderRename = this.container.querySelector<HTMLElement>('[data-ref="btn-folder-rename"]');
    this.btnFolderDelete = this.container.querySelector<HTMLElement>('[data-ref="btn-folder-delete"]');

    this.bindEvents();
    this.setupNavDropTargets();

    const typeDropdownWrapper = this.container.querySelector<HTMLElement>('[data-ref="home-dropdown-wrapper-type"]');
    if (typeDropdownWrapper) {
      if (!currentUser) {
        const foldersFilterItem = typeDropdownWrapper.querySelector<HTMLElement>('[data-value="folders"]');
        if (foldersFilterItem) {
          foldersFilterItem.style.display = 'none';
        }
      }
      this.typeDropdownController = setupDropdown(typeDropdownWrapper, {
        matchWidth: false,
        onSelect: (val: string) => {
          this.currentEntityFilter = (val as 'all' | 'designs' | 'folders') || 'all';
          const typeMenu = this.container.querySelector<HTMLElement>('[data-ref="dropdown-menu-filter-type"]');
          typeMenu?.querySelectorAll<HTMLButtonElement>('.menu-item').forEach((item) => {
            item.classList.toggle('is-active', item.getAttribute('data-value') === this.currentEntityFilter);
          });
          void this.onFiltersChanged();
        },
        placement: 'bottom-end',
      });
    }

    const sortDropdownWrapper = this.container.querySelector<HTMLElement>('[data-ref="home-dropdown-wrapper-sort"]');
    if (sortDropdownWrapper) {
      this.sortDropdownController = setupDropdown(sortDropdownWrapper, {
        matchWidth: false,
        onSelect: (val: string) => {
          this.currentSort = (val as 'activity' | 'alpha-asc' | 'alpha-desc') || 'activity';
          const sortMenu = this.container.querySelector<HTMLElement>('[data-ref="dropdown-menu-sort"]');
          sortMenu?.querySelectorAll<HTMLButtonElement>('.menu-item').forEach((item) => {
            item.classList.toggle('is-active', item.getAttribute('data-value') === this.currentSort);
          });
          void this.onFiltersChanged();
        },
        placement: 'bottom-end',
      });
    }

    const templatesTypeDropdownWrapper = this.container.querySelector<HTMLElement>('[data-ref="templates-dropdown-wrapper-type"]');
    if (templatesTypeDropdownWrapper) {
      this.templatesTypeDropdownController = setupDropdown(templatesTypeDropdownWrapper, {
        matchWidth: false,
        onSelect: (val: string) => {
          this.templateTypeFilter = (val as 'all' | 'board' | 'favorites' | 'pixel') || 'all';
          const typeMenu = this.container.querySelector<HTMLElement>('[data-ref="dropdown-menu-filter-type"]');
          typeMenu?.querySelectorAll<HTMLButtonElement>('.menu-item').forEach((item) => {
            item.classList.toggle('is-active', item.getAttribute('data-value') === this.templateTypeFilter);
          });
          this.renderTemplates();
        },
        placement: 'bottom-end',
      });
    }

    const templatesSortDropdownWrapper = this.container.querySelector<HTMLElement>('[data-ref="templates-dropdown-wrapper-sort"]');
    if (templatesSortDropdownWrapper) {
      this.templatesSortDropdownController = setupDropdown(templatesSortDropdownWrapper, {
        matchWidth: false,
        onSelect: (val: string) => {
          const next = (val as 'default' | 'alpha-asc' | 'alpha-desc' | 'size-desc' | 'size-asc') || 'default';
          if (this.templateSort === next) return;
          this.templateSort = next;
          const sortMenu = this.container.querySelector<HTMLElement>('[data-ref="dropdown-menu-sort"]');
          sortMenu?.querySelectorAll<HTMLButtonElement>('.menu-item').forEach((item) => {
            item.classList.toggle('is-active', item.getAttribute('data-value') === this.templateSort);
          });
          this.renderTemplates();
        },
        placement: 'bottom-end',
      });
    }

    if (currentUser) {
      await this.loadFavoriteTemplates();
    }

    if (initialFolderUuid) {
      await this.openFolder(initialFolderUuid, false);
    } else {
      await this.loadAll();
    }
  }

  private bindEvents(): void {
    const { signal } = this.abortController;

    this.scrollableEl?.addEventListener(
      'scroll',
      () => {
        this.handleScroll();
      },
      { passive: true, signal }
    );

    const innerScrollable = this.container.querySelector<HTMLElement>('[data-ref="home-scrollable"]');
    innerScrollable?.addEventListener(
      'scroll',
      () => {
        this.handleScroll();
      },
      { passive: true, signal }
    );

    this.btnToggleSearch?.addEventListener(
      'click',
      (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (this.homeHero && this.homeHero.style.display !== 'none' && this.heroSearchInput) {
          this.heroSearchInput.focus();
          this.scrollableEl?.scrollTo({ top: 0, behavior: 'smooth' });
        } else {
          this.toggleSearchToolbar();
        }
      },
      { signal }
    );

    this.btnFolderBack?.addEventListener(
      'click',
      () => {
        void this.exitFolder();
      },
      { signal }
    );

    this.searchInput?.addEventListener(
      'input',
      () => {
        if (this.heroSearchInput) {
          this.heroSearchInput.value = this.searchInput?.value || '';
        }
        this.handleSearchInput();
      },
      { signal }
    );

    this.btnClearSearch?.addEventListener(
      'click',
      () => {
        this.handleClearSearch();
        this.searchInput?.focus();
      },
      { signal }
    );

    this.heroSearchInput?.addEventListener(
      'input',
      () => {
        if (this.searchInput) {
          this.searchInput.value = this.heroSearchInput?.value || '';
        }
        this.handleSearchInput();
      },
      { signal }
    );

    this.btnHeroClearSearch?.addEventListener(
      'click',
      () => {
        this.handleClearSearch();
        this.heroSearchInput?.focus();
      },
      { signal }
    );

    const categoriesRow = this.container.querySelector<HTMLElement>('[data-ref="home-categories-row"]');
    const setActiveBadge = (ref: string) => {
      categoriesRow?.querySelectorAll('.component-badge').forEach((b) => b.classList.remove('is-active'));
      this.container.querySelector<HTMLElement>(`[data-ref="${ref}"]`)?.classList.add('is-active');
    };

    const bindCat = (ref: string, filterType: 'all' | 'board' | 'doc') => {
      this.container.querySelector<HTMLElement>(`[data-ref="${ref}"]`)?.addEventListener(
        'click',
        (e) => {
          e.preventDefault();
          if (this.currentTypeFilter === filterType) return;
          this.currentTypeFilter = filterType;
          setActiveBadge(ref);
          void this.onFiltersChanged();
        },
        { signal }
      );
    };

    bindCat('cat-badge-all', 'all');
    bindCat('cat-badge-board', 'board');
    bindCat('cat-badge-doc', 'doc');

    this.categoriesCarouselWrapper = this.container.querySelector<HTMLElement>('[data-ref="home-categories-carousel-wrapper"]');
    if (this.categoriesCarouselWrapper) {
      renderIcons(this.categoriesCarouselWrapper);
    }

    this.btnHomeUpgrade?.addEventListener(
      'click',
      () => {
        openUpgradeModal('pro');
      },
      { signal }
    );

    this.btnCreateFolder?.addEventListener(
      'click',
      () => {
        if (!currentUser) {
          showToast(t('canvas.folder_login_required') || 'Debes iniciar sesión para crear carpetas', 'info');
          return;
        }
        openCreateFolderModal({
          onSuccess: (newFolder) => {
            this.folders.unshift(newFolder);
            this.filterFolders();
            this.renderGrid();
          },
        });
      },
      { signal }
    );


    this.btnFolderRename?.addEventListener(
      'click',
      () => {
        if (this.currentFolder) {
          openRenameFolderModal(this.currentFolder, {
            onSuccess: (updated) => {
              this.currentFolder = updated;
              if (this.folderTitleName) {
                this.folderTitleName.textContent = updated.name;
              }
              const idx = this.folders.findIndex((f) => f.uuid === updated.uuid);
              if (idx !== -1) {
                this.folders[idx] = updated;
              }
              this.filterFolders();
              this.renderGrid();
            },
          });
        }
      },
      { signal }
    );

    this.btnFolderDelete?.addEventListener(
      'click',
      () => {
        if (this.currentFolder) {
          this.confirmDeleteFolder(this.currentFolder);
        }
      },
      { signal }
    );

    window.addEventListener(
      'canvas-created',
      () => {
        if (this.currentFolderUuid) {
          void this.openFolder(this.currentFolderUuid, false);
        } else {
          void this.loadAll();
        }
      },
      { signal }
    );

    window.addEventListener(
      'popstate',
      () => {
        const path = window.location.pathname;
        if (path.startsWith('/folder/')) {
          const fUuid = path.split('/folder/')[1]?.split('/')[0];
          if (fUuid && fUuid !== this.currentFolderUuid) {
            void this.openFolder(fUuid, false);
          }
        } else if (this.currentFolderUuid) {
          void this.exitFolder(false);
        }
      },
      { signal }
    );

    document.addEventListener(
      'click',
      (e: MouseEvent) => {
        const target = e.target as HTMLElement | null;
        if (this.isSearchActive) {
          if (
            this.searchToolbar &&
            !this.searchToolbar.contains(target) &&
            this.btnToggleSearch &&
            !this.btnToggleSearch.contains(target)
          ) {
            this.toggleSearchToolbar(false);
          }
        }
        if (
          this.activeOpenDropdown &&
          !this.activeOpenDropdown.contains(target) &&
          !target?.closest('[data-ref="btn-card-more"]') &&
          !target?.closest('[data-ref="btn-folder-more"]')
        ) {
          this.closeAllDropdowns();
        }
      },
      { signal }
    );

    document.addEventListener(
      'contextmenu',
      (e: MouseEvent) => {
        const target = e.target as HTMLElement | null;
        if (
          this.activeOpenDropdown &&
          !this.activeOpenDropdown.contains(target) &&
          !target?.closest('.canvas-card')
        ) {
          this.closeAllDropdowns();
        }
      },
      { signal }
    );

    this.scrollableEl?.addEventListener(
      'scroll',
      () => {
        if (this.activeOpenDropdown) {
          this.closeAllDropdowns();
        }
      },
      { signal, passive: true }
    );

    this.scrollableEl?.addEventListener(
      'pointerdown',
      (e: PointerEvent) => {
        this.handlePointerDown(e);
      },
      { signal }
    );

    window.addEventListener(
      'pointermove',
      (e: PointerEvent) => {
        this.handlePointerMove(e);
      },
      { signal }
    );

    window.addEventListener(
      'pointerup',
      (e: PointerEvent) => {
        this.handlePointerUp(e);
      },
      { signal }
    );

    document.addEventListener(
      'keydown',
      (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          if (this.activeOpenDropdown) {
            this.closeAllDropdowns();
            return;
          }
          if (this.selectedUuids.size > 0) {
            this.clearSelection();
            return;
          }
          if (this.isSearchActive) {
            this.toggleSearchToolbar(false);
          }
        }
      },
      { signal }
    );

    this.templatesGridEl?.addEventListener(
      'click',
      (e) => {
        const target = e.target as HTMLElement;
        const adCard = target.closest<HTMLElement>('[data-ad-url]');
        if (adCard) {
          if (target.closest('a')) return;
          const adUrl = adCard.getAttribute('data-ad-url');
          if (adUrl) {
            e.preventDefault();
            e.stopPropagation();
            handleAdClick(adUrl);
          }
          return;
        }

        const bookmarkBtn = target.closest<HTMLButtonElement>('[data-bookmark-preset]');
        if (bookmarkBtn) {
          e.stopPropagation();
          const presetId = bookmarkBtn.getAttribute('data-bookmark-preset');
          if (presetId) {
            void this.handleToggleTemplateFavorite(presetId, bookmarkBtn);
          }
          return;
        }

        const card = target.closest<HTMLElement>('[data-preset-id]');
        if (!card) return;

        const presetId = card.getAttribute('data-preset-id');
        if (!presetId) return;

        const preset = ALL_PRESETS.find((p) => p.id === presetId);
        if (!preset) return;

        openTemplatePreviewModal(preset, {
          onFavoriteToggle: (favId, isFav) => {
            if (isFav) {
              this.favoritedTemplateIds.add(favId);
            } else {
              this.favoritedTemplateIds.delete(favId);
            }
            const cardBtn = this.templatesGridEl?.querySelector<HTMLButtonElement>(`[data-bookmark-preset="${favId}"]`);
            if (cardBtn) {
              cardBtn.classList.toggle('is-active', isFav);
              const tooltipText = isFav ? t('canvas.bookmark_remove') : t('canvas.bookmark_save');
              cardBtn.setAttribute('data-tooltip', tooltipText);
              cardBtn.setAttribute('aria-label', tooltipText);
              cardBtn.innerHTML = `<svg class="component-icon" aria-hidden="true"><use href="/icons.svg#${isFav ? 'star_fill' : 'star'}"></use></svg>`;
              renderIcons(cardBtn);
            }
          },
        });
      },
      { signal }
    );
  }

  public destroy(): void {
    if (this.searchDebounceTimer) {
      clearTimeout(this.searchDebounceTimer);
      this.searchDebounceTimer = null;
    }
    if (this.scrollObserver) {
      this.scrollObserver.disconnect();
      this.scrollObserver = null;
    }
    if (this.templatesScrollObserver) {
      this.templatesScrollObserver.disconnect();
      this.templatesScrollObserver = null;
    }
    if (this.marqueeEl) {
      this.marqueeEl.remove();
      this.marqueeEl = null;
    }
    this.typeDropdownController?.destroy();
    this.typeDropdownController = null;
    this.sortDropdownController?.destroy();
    this.sortDropdownController = null;
    this.templatesTypeDropdownController?.destroy();
    this.templatesTypeDropdownController = null;
    this.templatesSortDropdownController?.destroy();
    this.templatesSortDropdownController = null;
    this.categoriesCarouselController?.destroy();
    this.categoriesCarouselController = null;
    this.cleanupCategoriesDrag?.();
    if (this.selectionToolbar) {
      this.selectionToolbar.remove();
      this.selectionToolbar = null;
      this.selectionCountEl = null;
    }
    this.closeAllDropdowns();
    this.abortController.abort();
  }

  private toggleSearchToolbar(force?: boolean): void {
    this.clearSelection();
    this.isSearchActive = force !== undefined ? force : !this.isSearchActive;
    if (!this.searchToolbar) return;

    if (this.isSearchActive) {
      this.searchToolbar.classList.remove('is-hidden');
      this.searchToolbar.classList.add('is-active');
      setTimeout(() => this.searchInput?.focus(), 80);
    } else {
      this.searchToolbar.classList.remove('is-active');
      this.searchToolbar.classList.add('is-hidden');
      this.handleClearSearch();
    }
  }

  private handleSearchInput(): void {
    this.clearSelection();
    const query = (this.heroSearchInput?.value || this.searchInput?.value || '').trim();
    if (this.btnClearSearch) {
      this.btnClearSearch.style.display = query ? 'inline-flex' : 'none';
    }
    if (this.btnHeroClearSearch) {
      this.btnHeroClearSearch.style.display = query ? 'inline-flex' : 'none';
    }
    if (this.searchInput && this.heroSearchInput && this.searchInput.value !== this.heroSearchInput.value) {
      this.searchInput.value = this.heroSearchInput.value;
    }

    if (this.searchDebounceTimer) {
      clearTimeout(this.searchDebounceTimer);
    }

    this.searchDebounceTimer = setTimeout(() => {
      this.searchQuery = query.toLowerCase();
      void this.onFiltersChanged();
    }, 280);
  }

  private handleClearSearch(): void {
    this.clearSelection();
    if (this.searchDebounceTimer) {
      clearTimeout(this.searchDebounceTimer);
      this.searchDebounceTimer = null;
    }
    if (this.searchInput) {
      this.searchInput.value = '';
    }
    if (this.heroSearchInput) {
      this.heroSearchInput.value = '';
    }
    if (this.btnClearSearch) {
      this.btnClearSearch.style.display = 'none';
    }
    if (this.btnHeroClearSearch) {
      this.btnHeroClearSearch.style.display = 'none';
    }
    if (this.searchQuery !== '') {
      this.searchQuery = '';
      void this.onFiltersChanged();
    }
  }

  private async onFiltersChanged(): Promise<void> {
    this.filterFolders();
    if (this.isShowingTemplatesEmptyState || (this.allCanvases.length === 0 && this.folders.length === 0 && !this.currentFolderUuid)) {
      this.renderTemplates();
    }
    await this.loadCanvases(true);
  }

  private filterFolders(): void {
    let filteredFolders: FolderItem[] = [];
    if (!this.currentFolderUuid && this.currentEntityFilter !== 'designs' && this.currentTypeFilter === 'all') {
      filteredFolders = this.folders;
      if (this.searchQuery) {
        filteredFolders = filteredFolders.filter((f) => f.name.toLowerCase().includes(this.searchQuery));
      }
      if (this.currentSort === 'alpha-asc') {
        filteredFolders = [...filteredFolders].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
      } else if (this.currentSort === 'alpha-desc') {
        filteredFolders = [...filteredFolders].sort((a, b) => b.name.localeCompare(a.name, undefined, { sensitivity: 'base' }));
      } else {
        filteredFolders = [...filteredFolders].sort((a, b) => new Date(b.updated_at || b.created_at || 0).getTime() - new Date(a.updated_at || a.created_at || 0).getTime());
      }
    }
    this.currentFolders = filteredFolders;
  }

  private closeAllDropdowns(): void {
    if (this.activeCardPopper) {
      this.activeCardPopper.destroy();
      this.activeCardPopper = null;
    }
    if (this.activeOpenDropdown) {
      this.activeOpenDropdown.style.display = 'none';
      this.activeOpenDropdown.removeAttribute('data-popper-placement');
      this.activeOpenDropdown.style.position = '';
      this.activeOpenDropdown.style.top = '';
      this.activeOpenDropdown.style.left = '';
      this.activeOpenDropdown.style.transform = '';
      this.activeOpenDropdown = null;
    }
    if (this.activeOpenCard) {
      this.activeOpenCard.classList.remove('has-dropdown-open');
      const wrapper = this.activeOpenCard.querySelector<HTMLElement>('[data-ref="card-actions-wrapper"]');
      wrapper?.classList.remove('is-open');
      this.activeOpenCard = null;
    }
    this.container.querySelectorAll<HTMLElement>('.canvas-card.has-dropdown-open').forEach((c) => {
      c.classList.remove('has-dropdown-open');
    });
    this.container.querySelectorAll<HTMLElement>('.canvas-card__actions-wrapper.is-open').forEach((w) => {
      w.classList.remove('is-open');
    });
    unregisterActiveDropdown(this.boundCloseCardDropdowns);
  }

  private openCardDropdown(
    card: HTMLElement,
    dropdown: HTMLElement,
    actionsWrapper: HTMLElement | null,
    target: HTMLElement | { x: number; y: number }
  ): void {
    const isCurrentlyOpen = this.activeOpenDropdown === dropdown && dropdown.style.display === 'flex';
    this.closeAllDropdowns();
    closeAllDropdowns();

    if (isCurrentlyOpen && target instanceof HTMLElement) {
      return;
    }

    dropdown.style.display = 'flex';
    card.classList.add('has-dropdown-open');
    actionsWrapper?.classList.add('is-open');
    this.activeOpenDropdown = dropdown;
    this.activeOpenCard = card;
    registerActiveDropdown({
      close: this.boundCloseCardDropdowns,
      wrapper: card,
    });

    if (window.innerWidth > 768) {
      if (target instanceof HTMLElement) {
        this.activeCardPopper = createPopper(target, dropdown, {
          placement: 'bottom-end',
          modifiers: [
            {
              name: 'offset',
              options: {
                offset: [0, 4],
              },
            },
            {
              name: 'flip',
              options: {
                fallbackPlacements: ['top-end', 'bottom-start', 'top-start'],
                padding: 8,
              },
            },
            {
              name: 'preventOverflow',
              options: {
                boundary: 'viewport',
                padding: 8,
              },
            },
          ],
        });
      } else {
        const { x, y } = target;
        const virtualElement: VirtualElement = {
          getBoundingClientRect: () =>
            ({
              bottom: y,
              height: 0,
              left: x,
              right: x,
              top: y,
              width: 0,
              x,
              y,
              toJSON: () => {},
            } as DOMRect),
          contextElement: card,
        };

        this.activeCardPopper = createPopper(virtualElement, dropdown, {
          placement: 'bottom-start',
          strategy: 'fixed',
          modifiers: [
            {
              name: 'offset',
              options: {
                offset: [0, 2],
              },
            },
            {
              name: 'flip',
              options: {
                fallbackPlacements: ['top-start', 'bottom-end', 'top-end'],
                padding: 8,
              },
            },
            {
              name: 'preventOverflow',
              options: {
                boundary: 'viewport',
                padding: 8,
              },
            },
          ],
        });
      }
    }
  }

  private async loadAll(): Promise<void> {
    if (!this.gridEl) return;

    if (this.allCanvases.length === 0 && this.folders.length === 0) {
      this.gridEl.style.display = 'grid';
      SkeletonService.renderGridCardSkeletons(this.gridEl, 8, 'canvas');
    }

    await this.loadFolders();
    this.filterFolders();
    await this.loadCanvases(false);
  }

  private async loadCanvases(showInitialSkeletons = true): Promise<void> {
    if (!this.gridEl) return;

    if (showInitialSkeletons) {
      this.gridEl.style.display = 'grid';
      SkeletonService.renderGridCardSkeletons(this.gridEl, 6, 'canvas');
    }

    if (this.currentEntityFilter === 'folders') {
      this.currentCanvases = [];
      this.allCanvases = [];
      this.currentPage = 1;
      this.totalPages = 1;
      this.hasMore = false;
      this.renderGrid(Boolean(this.searchQuery));
      return;
    }

    let items: CanvasItem[] = [];

    if (currentUser) {
      const currentUserId = currentUser.id;
      const params = new URLSearchParams();
      params.set('page', '1');
      params.set('limit', String(BATCH_SIZE));
      if (this.currentTypeFilter !== 'all') {
        params.set('type', this.currentTypeFilter);
      }
      if (this.currentSort) {
        params.set('sort', this.currentSort);
      }
      if (this.searchQuery) {
        params.set('search', this.searchQuery);
      }

      const endpoint = this.currentFolderUuid
        ? API_ROUTES.folders.canvases(this.currentFolderUuid)
        : API_ROUTES.canvases.base;

      try {
        const res = await getApi(`${endpoint}?${params.toString()}`);
        let cloudCanvases: CanvasItem[] = [];
        if (res.ok) {
          const data = await res.json();
          cloudCanvases = Array.isArray(data.canvases) ? data.canvases : [];
          this.currentPage = data.pagination?.page || 1;
          this.totalPages = data.pagination?.totalPages || 1;
          this.hasMore = Boolean(data.pagination?.hasMore);
          if (this.currentFolderUuid && data.folder) {
            this.currentFolder = data.folder;
            if (this.folderTitleName) {
              this.folderTitleName.textContent = data.folder.name;
            }
          }
        } else {
          if (this.currentFolderUuid && res.status === 404) {
            showToast(t('canvas.folder_empty_title'), 'info');
            void this.exitFolder();
            return;
          }
          this.currentPage = 1;
          this.totalPages = 1;
          this.hasMore = false;
        }

        if (!this.currentFolderUuid) {
          const localCanvases = await getAllLocalCanvases();
          const cloudUuids = new Set(cloudCanvases.map((c) => c.uuid));
          let unsyncedLocals = localCanvases.filter((c) => {
            if (!c.is_local || cloudUuids.has(c.uuid) || c.id) return false;
            if (c.user_id && c.user_id !== currentUserId) return false;
            if (c.access_level === 'public') return false;
            return true;
          });
          if (this.currentTypeFilter === 'board') {
            unsyncedLocals = unsyncedLocals.filter((c) => (c.canvas_type === 'board' || c.unit === 'board') && c.canvas_type !== 'doc' && c.unit !== 'doc');
          } else if (this.currentTypeFilter === 'doc') {
            unsyncedLocals = unsyncedLocals.filter((c) => c.canvas_type === 'doc' || c.unit === 'doc');
          }
          if (this.searchQuery) {
            unsyncedLocals = unsyncedLocals.filter((c) => c.name.toLowerCase().includes(this.searchQuery));
          }
          items = [...unsyncedLocals, ...cloudCanvases];
        } else {
          items = cloudCanvases;
        }
      } catch {
        if (!this.currentFolderUuid) {
          const localCanvases = await getAllLocalCanvases();
          items = localCanvases.filter((c) => (!c.user_id || c.user_id === currentUserId) && c.access_level !== 'public');
        } else {
          items = [];
        }
        this.currentPage = 1;
        this.totalPages = 1;
        this.hasMore = false;
      }
    } else {
      const localCanvases = await getAllLocalCanvases();
      let filtered = localCanvases.filter((c) => c.is_local && !c.user_id && !c.id && c.access_level !== 'public');
      if (this.currentTypeFilter === 'board') {
        filtered = filtered.filter((c) => (c.canvas_type === 'board' || c.unit === 'board') && c.canvas_type !== 'doc' && c.unit !== 'doc');
      } else if (this.currentTypeFilter === 'doc') {
        filtered = filtered.filter((c) => c.canvas_type === 'doc' || c.unit === 'doc');
      }
      if (this.searchQuery) {
        filtered = filtered.filter((c) => c.name.toLowerCase().includes(this.searchQuery));
      }
      if (this.currentSort === 'alpha-asc') {
        filtered.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
      } else if (this.currentSort === 'alpha-desc') {
        filtered.sort((a, b) => b.name.localeCompare(a.name, undefined, { sensitivity: 'base' }));
      } else {
        filtered.sort((a, b) => new Date(b.updated_at || b.created_at || 0).getTime() - new Date(a.updated_at || a.created_at || 0).getTime());
      }
      this.currentPage = 1;
      this.totalPages = Math.ceil(filtered.length / BATCH_SIZE) || 1;
      this.hasMore = filtered.length > BATCH_SIZE;
      items = filtered.slice(0, BATCH_SIZE);
      this.allCanvases = filtered;
    }

    this.currentCanvases = items;
    if (currentUser) {
      this.allCanvases = [...items];
    }
    this.renderGrid(Boolean(this.searchQuery));
  }

  private renderGrid(isSearchResult = false): void {
    if (!this.gridEl) return;

    const displayedFolders = this.currentFolders;
    const totalItems = displayedFolders.length + this.currentCanvases.length;

    if (totalItems === 0) {
      if (this.scrollObserver) {
        this.scrollObserver.disconnect();
        this.scrollObserver = null;
      }
      if (this.sentinelEl) {
        this.sentinelEl.style.display = 'none';
      }
      this.gridEl.innerHTML = '';
      this.gridEl.style.display = 'none';

      if (this.currentFolderUuid) {
        if (this.templatesSection) {
          this.templatesSection.style.display = 'none';
        }
        if (this.canvasSection) {
          this.canvasSection.style.display = 'block';
          renderEmptyState({
            container: this.canvasSection,
            dataRef: 'canvas-empty-state',
            desc: t('canvas.folder_empty_desc') || 'Añade o mueve proyectos a esta carpeta para verlos aquí.',
            graphicType: 'canvas',
            title: t('canvas.folder_empty_title') || 'Esta carpeta está vacía',
          });
        }
      } else if (isSearchResult && !this.isShowingTemplatesEmptyState) {
        if (this.templatesSection) {
          this.templatesSection.style.display = 'none';
        }
        if (this.canvasSection) {
          this.canvasSection.style.display = 'block';
          renderEmptyState({
            container: this.canvasSection,
            dataRef: 'canvas-empty-state',
            desc: t('canvas.home_search_no_results') || 'No se encontraron lienzos que coincidan con la búsqueda.',
            graphicType: 'search',
            title: t('canvas.home_search_no_results_title') || 'Sin resultados',
          });
        }
      } else {
        this.isShowingTemplatesEmptyState = true;
        if (this.canvasSection) {
          removeEmptyState(this.canvasSection, 'canvas-empty-state');
          this.canvasSection.style.display = 'none';
        }
        if (this.templatesSection) {
          this.templatesSection.style.display = 'block';
        }
        this.renderTemplates();
      }
      return;
    }

    this.isShowingTemplatesEmptyState = false;
    if (this.templatesScrollObserver) {
      this.templatesScrollObserver.disconnect();
      this.templatesScrollObserver = null;
    }
    if (this.templatesSection) {
      removeEmptyState(this.templatesSection, 'templates-empty-state');
      this.templatesSection.style.display = 'none';
    }
    if (this.canvasSection) {
      removeEmptyState(this.canvasSection, 'canvas-empty-state');
      this.canvasSection.style.display = 'block';
    }
    this.gridEl.style.display = 'grid';
    this.gridEl.innerHTML = '';

    if (displayedFolders.length > 0) {
      const folderFragment = document.createDocumentFragment();
      displayedFolders.forEach((folder) => {
        folderFragment.appendChild(this.createFolderCardElement(folder));
      });
      this.gridEl.appendChild(folderFragment);
    }

    if (this.currentCanvases.length > 0) {
      const canvasFragment = document.createDocumentFragment();
      let adIndex = 0;
      this.currentCanvases.forEach((canvas, index) => {
        canvasFragment.appendChild(this.createCardElement(canvas));
        if (shouldShowAds() && (index + 1) % DEFAULT_AD_FREQUENCY === 0) {
          const ad = getAdByIndex(adIndex++);
          canvasFragment.appendChild(createAdCardElement(ad));
        }
      });
      this.gridEl.appendChild(canvasFragment);
    }

    if (this.hasMore) {
      if (this.sentinelEl) {
        this.sentinelEl.style.display = 'block';
      }
      this.initScrollObserver();
    } else {
      if (this.sentinelEl) {
        this.sentinelEl.style.display = 'none';
      }
      if (this.scrollObserver) {
        this.scrollObserver.disconnect();
        this.scrollObserver = null;
      }
    }

    translateElement(this.gridEl);
    renderIcons(this.gridEl);
    setupLazyImages(this.gridEl);
  }

  private async loadNextBatch(): Promise<void> {
    if (!this.gridEl || this.isLoadingBatch || !this.hasMore) return;
    this.isLoadingBatch = true;

    const skeletonFragment = document.createDocumentFragment();
    for (let i = 0; i < 6; i++) {
      skeletonFragment.appendChild(SkeletonService.createSkeletonCard('canvas', i));
    }
    this.gridEl.appendChild(skeletonFragment);

    const nextPage = this.currentPage + 1;
    let newCanvases: CanvasItem[] = [];
    let hasMorePages = false;

    try {
      if (currentUser) {
        const params = new URLSearchParams();
        params.set('page', String(nextPage));
        params.set('limit', String(BATCH_SIZE));
        if (this.currentTypeFilter !== 'all') {
          params.set('type', this.currentTypeFilter);
        }
        if (this.currentSort) {
          params.set('sort', this.currentSort);
        }
        if (this.searchQuery) {
          params.set('search', this.searchQuery);
        }

        const endpoint = this.currentFolderUuid
          ? API_ROUTES.folders.canvases(this.currentFolderUuid)
          : API_ROUTES.canvases.base;

        const [res] = await Promise.all([
          getApi(`${endpoint}?${params.toString()}`),
          new Promise((r) => setTimeout(r, 250)),
        ]);

        if (res.ok) {
          const data = await res.json();
          newCanvases = Array.isArray(data.canvases) ? data.canvases : [];
          this.currentPage = data.pagination?.page || nextPage;
          this.totalPages = data.pagination?.totalPages || this.totalPages;
          hasMorePages = Boolean(data.pagination?.hasMore);
        }
      } else {
        await new Promise((r) => setTimeout(r, 250));
        const start = (nextPage - 1) * BATCH_SIZE;
        const end = start + BATCH_SIZE;
        newCanvases = this.allCanvases.slice(start, end);
        this.currentPage = nextPage;
        hasMorePages = end < this.allCanvases.length;
      }
    } catch {
      hasMorePages = false;
    } finally {
      if (this.gridEl) {
        const skeletons = this.gridEl.querySelectorAll('[data-ref="skeleton-card"]');
        skeletons.forEach((s) => s.remove());
      }
    }

    if (this.abortController.signal.aborted || !this.gridEl) return;

    if (newCanvases.length > 0) {
      const fragment = document.createDocumentFragment();
      const previousTotal = this.currentCanvases.length;
      newCanvases.forEach((canvas, index) => {
        this.currentCanvases.push(canvas);
        if (currentUser) {
          this.allCanvases.push(canvas);
        }
        fragment.appendChild(this.createCardElement(canvas));
        const currentTotalIndex = previousTotal + index + 1;
        if (shouldShowAds() && currentTotalIndex % DEFAULT_AD_FREQUENCY === 0) {
          const adIndex = Math.floor(currentTotalIndex / DEFAULT_AD_FREQUENCY) - 1;
          const ad = getAdByIndex(adIndex);
          fragment.appendChild(createAdCardElement(ad));
        }
      });
      this.gridEl.appendChild(fragment);
      translateElement(this.gridEl);
      renderIcons(this.gridEl);
      setupLazyImages(this.gridEl);
    }

    this.hasMore = hasMorePages;
    if (!this.hasMore) {
      if (this.sentinelEl) {
        this.sentinelEl.style.display = 'none';
      }
      if (this.scrollObserver) {
        this.scrollObserver.disconnect();
        this.scrollObserver = null;
      }
    }

    this.isLoadingBatch = false;
  }

  private handleScroll(): void {
    if (this.isShowingTemplatesEmptyState) {
      this.handleTemplatesScroll();
      return;
    }
    if (!this.scrollableEl || this.isLoadingBatch || !this.hasMore) return;
    const { clientHeight, scrollHeight, scrollTop } = this.scrollableEl;
    if (scrollTop + clientHeight >= scrollHeight - 300) {
      void this.loadNextBatch();
    }
  }

  private async loadFavoriteTemplates(): Promise<void> {
    try {
      const res = await getApi(API_ROUTES.favorites.byType('template'));
      if (res.ok) {
        const data = await res.json();
        if (data && Array.isArray(data.favorites)) {
          this.favoritedTemplateIds.clear();
          data.favorites.forEach((fav: { item_id: string }) => {
            if (fav.item_id) {
              this.favoritedTemplateIds.add(fav.item_id);
            }
          });
        }
      }
    } catch {}
  }

  private async handleToggleTemplateFavorite(presetId: string, btn: HTMLButtonElement): Promise<void> {
    if (!currentUser) {
      showToast(t('canvas.bookmark_login_required'), 'info');
      return;
    }

    const prevFavorite = this.favoritedTemplateIds.has(presetId);
    const nextFavorite = !prevFavorite;

    if (nextFavorite) {
      this.favoritedTemplateIds.add(presetId);
    } else {
      this.favoritedTemplateIds.delete(presetId);
    }

    btn.classList.toggle('is-active', nextFavorite);

    const tooltipText = nextFavorite ? t('canvas.bookmark_remove') : t('canvas.bookmark_save');
    btn.setAttribute('data-tooltip', tooltipText);
    btn.setAttribute('aria-label', tooltipText);
    btn.innerHTML = `<svg class="component-icon" aria-hidden="true"><use href="/icons.svg#${nextFavorite ? 'star_fill' : 'star'}"></use></svg>`;

    try {
      const res = await postApi(API_ROUTES.favorites.toggle, {
        itemId: presetId,
        itemType: 'template',
      });

      if (res.ok) {
        const data = await res.json();
        const serverFavorite = Boolean(data?.isFavorite);
        if (serverFavorite) {
          this.favoritedTemplateIds.add(presetId);
        } else {
          this.favoritedTemplateIds.delete(presetId);
        }
        btn.classList.toggle('is-active', serverFavorite);
        const finalTooltip = serverFavorite ? t('canvas.bookmark_remove') : t('canvas.bookmark_save');
        btn.setAttribute('data-tooltip', finalTooltip);
        btn.setAttribute('aria-label', finalTooltip);
        btn.innerHTML = `<svg class="component-icon" aria-hidden="true"><use href="/icons.svg#${serverFavorite ? 'star_fill' : 'star'}"></use></svg>`;
        showToast(serverFavorite ? t('canvas.bookmark_saved') : t('canvas.bookmark_removed'), 'success');
      } else {
        if (prevFavorite) {
          this.favoritedTemplateIds.add(presetId);
        } else {
          this.favoritedTemplateIds.delete(presetId);
        }
        btn.classList.toggle('is-active', prevFavorite);
        const rollbackTooltip = prevFavorite ? t('canvas.bookmark_remove') : t('canvas.bookmark_save');
        btn.setAttribute('data-tooltip', rollbackTooltip);
        btn.setAttribute('aria-label', rollbackTooltip);
        btn.innerHTML = `<svg class="component-icon" aria-hidden="true"><use href="/icons.svg#${prevFavorite ? 'star_fill' : 'star'}"></use></svg>`;
        showToast(t('toasts.generic_error'), 'danger');
      }
    } catch {
      if (prevFavorite) {
        this.favoritedTemplateIds.add(presetId);
      } else {
        this.favoritedTemplateIds.delete(presetId);
      }
      btn.classList.toggle('is-active', prevFavorite);
      const rollbackTooltip = prevFavorite ? t('canvas.bookmark_remove') : t('canvas.bookmark_save');
      btn.setAttribute('data-tooltip', rollbackTooltip);
      btn.setAttribute('aria-label', rollbackTooltip);
      btn.innerHTML = `<svg class="component-icon" aria-hidden="true"><use href="/icons.svg#${prevFavorite ? 'star_fill' : 'star'}"></use></svg>`;
      showToast(t('toasts.generic_error'), 'danger');
    }
  }

  private renderTemplates(): void {
    if (!this.templatesGridEl) return;

    let filtered = [...ALL_PRESETS];

    if (this.currentTypeFilter === 'board') {
      filtered = filtered.filter((item) => item.canvasType === 'board' || item.categoryKey === 'board');
    } else if (this.currentTypeFilter === 'doc') {
      filtered = filtered.filter((item) => item.canvasType === 'doc' || item.categoryKey === 'doc');
    }

    if (this.templateTypeFilter === 'favorites') {
      filtered = filtered.filter((item) => this.favoritedTemplateIds.has(item.id));
    } else if (this.templateTypeFilter === 'pixel') {
      filtered = filtered.filter((item) => item.categoryKey === 'pixel');
    } else if (this.templateTypeFilter === 'board') {
      filtered = filtered.filter((item) => item.canvasType === 'board' || item.categoryKey === 'board');
    }

    if (this.searchQuery) {
      const q = this.searchQuery;
      filtered = filtered.filter((item) => {
        const nameMatch = item.name.toLowerCase().includes(q);
        const catMatch = item.categoryName ? item.categoryName.toLowerCase().includes(q) : false;
        const dimMatch = `${item.width}x${item.height}`.includes(q) || `${item.width} x ${item.height}`.includes(q);
        return nameMatch || catMatch || dimMatch;
      });
    }

    if (this.templateSort === 'alpha-asc') {
      filtered.sort((a, b) => a.name.localeCompare(b.name));
    } else if (this.templateSort === 'alpha-desc') {
      filtered.sort((a, b) => b.name.localeCompare(a.name));
    } else if (this.templateSort === 'size-desc') {
      filtered.sort((a, b) => (b.width * b.height) - (a.width * a.height));
    } else if (this.templateSort === 'size-asc') {
      filtered.sort((a, b) => (a.width * a.height) - (b.width * b.height));
    }

    this.currentTemplates = filtered;
    this.templatesRenderedCount = 0;

    if (filtered.length === 0) {
      if (this.templatesScrollObserver) {
        this.templatesScrollObserver.disconnect();
        this.templatesScrollObserver = null;
      }
      if (this.templatesSentinelEl) {
        this.templatesSentinelEl.style.display = 'none';
      }
      this.templatesGridEl.innerHTML = '';
      this.templatesGridEl.style.display = 'none';

      if (this.templatesSection) {
        renderEmptyState({
          container: this.templatesSection,
          dataRef: 'templates-empty-state',
          desc: t('templates.empty_desc') || 'Intenta con otro término de búsqueda o selecciona otra categoría.',
          graphicType: 'search',
          title: t('templates.empty_title') || 'No se encontraron plantillas',
        });
      }
      return;
    }

    if (this.templatesSection) {
      removeEmptyState(this.templatesSection, 'templates-empty-state');
    }
    this.templatesGridEl.style.display = 'grid';
    this.templatesGridEl.innerHTML = '';
    if (this.templatesSentinelEl) {
      this.templatesSentinelEl.style.display = 'block';
    }

    this.renderNextTemplateBatch();
    this.initTemplatesScrollObserver();
  }

  private renderNextTemplateBatch(): void {
    if (!this.templatesGridEl || this.isRenderingTemplateBatch) return;
    if (this.templatesRenderedCount >= this.currentTemplates.length) {
      if (this.templatesScrollObserver) {
        this.templatesScrollObserver.disconnect();
        this.templatesScrollObserver = null;
      }
      if (this.templatesSentinelEl) {
        this.templatesSentinelEl.style.display = 'none';
      }
      return;
    }

    this.isRenderingTemplateBatch = true;
    const batch = this.currentTemplates.slice(this.templatesRenderedCount, this.templatesRenderedCount + BATCH_SIZE);
    const htmlChunks: string[] = [];
    batch.forEach((item, index) => {
      htmlChunks.push(this.buildTemplateCardHtml(item));
      const overallIndex = this.templatesRenderedCount + index + 1;
      if (shouldShowAds() && overallIndex % DEFAULT_AD_FREQUENCY === 0) {
        const adIndex = Math.floor(overallIndex / DEFAULT_AD_FREQUENCY) - 1;
        const ad = getAdByIndex(adIndex);
        htmlChunks.push(buildAdCardHtml(ad));
      }
    });
    this.templatesGridEl.insertAdjacentHTML('beforeend', htmlChunks.join(''));
    this.templatesRenderedCount += batch.length;

    setupLazyImages(this.templatesGridEl);
    renderIcons(this.templatesGridEl);

    this.isRenderingTemplateBatch = false;

    if (this.templatesRenderedCount >= this.currentTemplates.length) {
      if (this.templatesScrollObserver) {
        this.templatesScrollObserver.disconnect();
        this.templatesScrollObserver = null;
      }
      if (this.templatesSentinelEl) {
        this.templatesSentinelEl.style.display = 'none';
      }
    }
  }

  private initTemplatesScrollObserver(): void {
    if (this.templatesScrollObserver) {
      this.templatesScrollObserver.disconnect();
      this.templatesScrollObserver = null;
    }
    if (!this.templatesSentinelEl) return;

    this.templatesScrollObserver = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;

        if (entry.isIntersecting) {
          if (this.scrollableEl && this.scrollableEl.scrollTop === 0 && this.scrollableEl.scrollHeight > this.scrollableEl.clientHeight) {
            return;
          }
          this.renderNextTemplateBatch();
        }
      },
      {
        root: this.scrollableEl,
        rootMargin: '40px',
      }
    );

    this.templatesScrollObserver.observe(this.templatesSentinelEl);
  }

  private handleTemplatesScroll(): void {
    if (!this.scrollableEl || this.isRenderingTemplateBatch) return;
    if (this.templatesRenderedCount >= this.currentTemplates.length) return;

    const { clientHeight, scrollHeight, scrollTop } = this.scrollableEl;
    if (scrollTop + clientHeight >= scrollHeight - 200) {
      this.renderNextTemplateBatch();
    }
  }

  private buildTemplateCardHtml(item: PresetItem): string {
    const isFavorite = this.favoritedTemplateIds.has(item.id);
    const previewContent = `<img class="canvas-card__image image-lazy-fade" data-ref="template-card-img-${item.id}" src="${item.imagePath}" alt="${escapeHtml(item.name)}" loading="lazy" decoding="async" onload="this.classList.add('image-loaded')" onerror="this.classList.add('image-loaded')" />`;

    const actionsHtml = currentUser
      ? `
          <div class="canvas-card__actions-wrapper" data-ref="card-actions-wrapper-${item.id}">
            <div class="canvas-card__actions" data-ref="card-actions-${item.id}">
              <button type="button" class="canvas-card__action-btn${isFavorite ? ' is-active' : ''}" data-ref="btn-template-bookmark-${item.id}" data-bookmark-preset="${item.id}" data-tooltip="${isFavorite ? t('canvas.bookmark_remove') : t('canvas.bookmark_save')}" aria-label="${isFavorite ? t('canvas.bookmark_remove') : t('canvas.bookmark_save')}">
                <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#${isFavorite ? 'star_fill' : 'star'}"></use></svg>
              </button>
            </div>
          </div>
        `
      : '';

    return `
      <div class="canvas-card template-card" data-ref="template-card-${item.id}" data-preset-id="${item.id}">
        <div class="canvas-card__thumbnail template-card__thumbnail" data-ref="template-card-thumb-${item.id}">
          ${previewContent}
          ${actionsHtml}
        </div>
      </div>
    `;
  }

  private initScrollObserver(): void {
    if (this.scrollObserver) {
      this.scrollObserver.disconnect();
      this.scrollObserver = null;
    }
    if (!this.sentinelEl) return;

    this.scrollObserver = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;

        if (entry.isIntersecting && !this.isLoadingBatch && this.hasMore) {
          void this.loadNextBatch();
        }
      },
      {
        root: null,
        rootMargin: '200px',
      }
    );

    this.scrollObserver.observe(this.sentinelEl);
  }

  private createCardElement(canvas: CanvasItem): HTMLElement {
    const card = document.createElement('div');
    card.className = 'canvas-card';
    card.setAttribute('data-ref', `canvas-card-${canvas.uuid}`);
    card.setAttribute('data-uuid', canvas.uuid);

    const isLocal = Boolean(canvas.is_local);
    const canSync = isLocal && Boolean(currentUser);
    const isFavorite = Boolean(canvas.is_favorite);
    const isDoc = canvas.canvas_type === 'doc' || canvas.unit === 'doc';
    const targetUrl = `/design/${canvas.uuid}`;
    const typeIcon = isDoc ? 'description' : 'draw';
    const editedTime = formatEditedTime(canvas.updated_at || canvas.created_at);

    const badgeText = isLocal ? t('canvas.status_local') : t('canvas.status_cloud');

    const thumbnailHtml = canvas.preview_thumbnail
      ? `<img class="canvas-card__image image-lazy-fade" src="${escapeHtml(canvas.preview_thumbnail)}" alt="${escapeHtml(canvas.name)}" loading="lazy" decoding="async" onload="this.classList.add('image-loaded')" onerror="this.onerror=null; this.classList.add('image-loaded');" />`
      : `<div class="canvas-card__canvas-placeholder"></div>`;

    card.innerHTML = `
      <div class="canvas-card__thumbnail" data-ref="card-thumbnail">
        ${thumbnailHtml}

        <button type="button" class="canvas-card__checkbox" data-ref="card-checkbox" aria-label="Seleccionar">
          <span class="material-symbols-rounded">check</span>
        </button>

        ${
          canSync
            ? `
          <button type="button" class="component-button component-button--h28 component-button--white canvas-card__btn-sync" data-ref="btn-sync-cloud">
            <span class="material-symbols-rounded">cloud_upload</span>
            <span>${t('canvas.btn_sync')}</span>
          </button>
        `
            : ''
        }

        <div class="canvas-card__actions-wrapper" data-ref="card-actions-wrapper">
          <div class="canvas-card__actions" data-ref="card-actions">
            ${
              currentUser
                ? `
            <button type="button" class="canvas-card__action-btn${isFavorite ? ' is-active' : ''}" data-ref="btn-card-bookmark" data-tooltip="${isFavorite ? t('canvas.bookmark_remove') : t('canvas.bookmark_save')}" aria-label="${isFavorite ? t('canvas.bookmark_remove') : t('canvas.bookmark_save')}">
              <span class="material-symbols-rounded">${isFavorite ? 'star_fill' : 'star'}</span>
            </button>
            `
                : ''
            }
            <button type="button" class="canvas-card__action-btn" data-ref="btn-card-more" data-tooltip="Opciones" aria-label="${t('canvas.menu_open_new_tab')}">
              <span class="material-symbols-rounded">more_vert</span>
            </button>
          </div>

          <div class="menu-panel menu-panel--dropdown menu-panel--w-265 menu-panel--h-auto" data-ref="card-menu-dropdown" style="display: none;">
            <div class="menu-panel__drag-zone" data-ref="card-menu-drag-zone" aria-hidden="true">
              <div class="menu-panel__drag-handle"></div>
            </div>
            <div class="menu-panel__list" data-ref="card-menu-list">
              <button type="button" class="menu-item" data-ref="action-open-new-tab">
                <svg class="component-icon menu-item__icon" aria-hidden="true"><use href="/icons.svg#open_in_new"></use></svg>
                <span class="menu-item__text" data-i18n="canvas.menu_open_new_tab">${t('canvas.menu_open_new_tab')}</span>
              </button>
              <button type="button" class="menu-item" data-ref="action-duplicate">
                <svg class="component-icon menu-item__icon" aria-hidden="true"><use href="/icons.svg#filter_none"></use></svg>
                <span class="menu-item__text" data-i18n="canvas.menu_duplicate">${t('canvas.menu_duplicate')}</span>
              </button>
              <button type="button" class="menu-item" data-ref="action-download">
                <svg class="component-icon menu-item__icon" aria-hidden="true"><use href="/icons.svg#download"></use></svg>
                <span class="menu-item__text" data-i18n="canvas.menu_download">${t('canvas.menu_download')}</span>
              </button>
              <button type="button" class="menu-item" data-ref="action-share">
                <svg class="component-icon menu-item__icon" aria-hidden="true"><use href="/icons.svg#share"></use></svg>
                <span class="menu-item__text" data-i18n="canvas.menu_share">${t('canvas.menu_share')}</span>
              </button>
              <button type="button" class="menu-item" data-ref="action-copy-link">
                <svg class="component-icon menu-item__icon" aria-hidden="true"><use href="/icons.svg#link"></use></svg>
                <span class="menu-item__text" data-i18n="canvas.menu_copy_link">${t('canvas.menu_copy_link')}</span>
              </button>
              ${
                currentUser
                  ? `
              <button type="button" class="menu-item" data-ref="action-move">
                <svg class="component-icon menu-item__icon" aria-hidden="true"><use href="/icons.svg#drive_file_move"></use></svg>
                <span class="menu-item__text" data-i18n="canvas.menu_move">${t('canvas.menu_move')}</span>
              </button>
              `
                  : ''
              }
              <div class="menu-divider"></div>
              <button type="button" class="menu-item menu-item--bordered menu-item--danger" data-ref="action-delete">
                <svg class="component-icon menu-item__icon" aria-hidden="true"><use href="/icons.svg#delete"></use></svg>
                <span class="menu-item__text" data-i18n="canvas.menu_move_to_trash">${t('canvas.menu_move_to_trash')}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div class="canvas-card__info" data-ref="canvas-info">
        <span class="canvas-card__name" data-ref="canvas-title" title="${escapeHtml(canvas.name)}">
          ${escapeHtml(canvas.name)}
        </span>
        <div class="canvas-card__meta" data-ref="canvas-meta">
          <span class="material-symbols-rounded canvas-card__meta-icon">${typeIcon}</span>
          <span>Editado ${editedTime}</span>
          ${isLocal ? `<span class="canvas-card__meta-dot">·</span><span class="canvas-card__meta-badge" data-ref="badge-status-text">${badgeText}</span>` : ''}
        </div>
      </div>
    `;

    const actionsWrapper = card.querySelector<HTMLElement>('[data-ref="card-actions-wrapper"]');
    const btnBookmark = card.querySelector<HTMLButtonElement>('[data-ref="btn-card-bookmark"]');
    const btnMore = card.querySelector<HTMLButtonElement>('[data-ref="btn-card-more"]');
    const menuDropdown = card.querySelector<HTMLElement>('[data-ref="card-menu-dropdown"]');
    const actionOpenNewTab = card.querySelector<HTMLButtonElement>('[data-ref="action-open-new-tab"]');
    const actionDuplicate = card.querySelector<HTMLButtonElement>('[data-ref="action-duplicate"]');
    const actionDownload = card.querySelector<HTMLButtonElement>('[data-ref="action-download"]');
    const actionShare = card.querySelector<HTMLButtonElement>('[data-ref="action-share"]');
    const actionCopyLink = card.querySelector<HTMLButtonElement>('[data-ref="action-copy-link"]');
    const actionMove = card.querySelector<HTMLButtonElement>('[data-ref="action-move"]');
    const actionDelete = card.querySelector<HTMLButtonElement>('[data-ref="action-delete"]');
    const checkbox = card.querySelector<HTMLButtonElement>('[data-ref="card-checkbox"]');

    if (this.selectedUuids.has(canvas.uuid)) {
      card.classList.add('is-selected');
    }

    checkbox?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleCardSelection(canvas.uuid);
    });

    actionMove?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.closeAllDropdowns();
      if (!currentUser) {
        showToast(t('canvas.folder_login_required') || 'Debes iniciar sesión para organizar en carpetas', 'info');
        return;
      }
      openMoveCanvasModal(canvas, {
        onMoved: () => {
          if (this.currentFolderUuid) {
            void this.openFolder(this.currentFolderUuid, false);
          } else {
            void this.loadAll();
          }
        },
      });
    });

    btnBookmark?.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!currentUser) {
        showToast(t('canvas.bookmark_login_required'), 'info');
        return;
      }

      const prevFavorite = Boolean(canvas.is_favorite);
      const nextFavorite = !prevFavorite;
      canvas.is_favorite = nextFavorite;
      btnBookmark.classList.toggle('is-active', nextFavorite);

      const tooltipText = nextFavorite ? t('canvas.bookmark_remove') : t('canvas.bookmark_save');
      btnBookmark.setAttribute('data-tooltip', tooltipText);
      btnBookmark.setAttribute('aria-label', tooltipText);
      btnBookmark.innerHTML = `<span class="material-symbols-rounded">${nextFavorite ? 'star_fill' : 'star'}</span>`;
      renderIcons(btnBookmark);

      try {
        const res = await postApi(API_ROUTES.favorites.toggle, {
          itemId: canvas.uuid,
          itemType: 'canvas',
        });

        if (res.ok) {
          const data = await res.json();
          const serverFavorite = Boolean(data?.isFavorite);
          canvas.is_favorite = serverFavorite;
          btnBookmark.classList.toggle('is-active', serverFavorite);
          const finalTooltip = serverFavorite ? t('canvas.bookmark_remove') : t('canvas.bookmark_save');
          btnBookmark.setAttribute('data-tooltip', finalTooltip);
          btnBookmark.setAttribute('aria-label', finalTooltip);
          btnBookmark.innerHTML = `<span class="material-symbols-rounded">${serverFavorite ? 'star_fill' : 'star'}</span>`;
          renderIcons(btnBookmark);
          showToast(serverFavorite ? t('canvas.bookmark_saved') : t('canvas.bookmark_removed'), 'success');
        } else {
          canvas.is_favorite = prevFavorite;
          btnBookmark.classList.toggle('is-active', prevFavorite);
          const rollbackTooltip = prevFavorite ? t('canvas.bookmark_remove') : t('canvas.bookmark_save');
          btnBookmark.setAttribute('data-tooltip', rollbackTooltip);
          btnBookmark.setAttribute('aria-label', rollbackTooltip);
          btnBookmark.innerHTML = `<span class="material-symbols-rounded">${prevFavorite ? 'star_fill' : 'star'}</span>`;
          renderIcons(btnBookmark);
          showToast(t('toasts.generic_error'), 'danger');
        }
      } catch {
        canvas.is_favorite = prevFavorite;
        btnBookmark.classList.toggle('is-active', prevFavorite);
        const rollbackTooltip = prevFavorite ? t('canvas.bookmark_remove') : t('canvas.bookmark_save');
        btnBookmark.setAttribute('data-tooltip', rollbackTooltip);
        btnBookmark.setAttribute('aria-label', rollbackTooltip);
        btnBookmark.innerHTML = `<span class="material-symbols-rounded">${prevFavorite ? 'star_fill' : 'star'}</span>`;
        renderIcons(btnBookmark);
        showToast(t('toasts.generic_error'), 'danger');
      }
    });

    actionsWrapper?.addEventListener('click', (e) => {
      e.stopPropagation();
    });

    card.addEventListener('contextmenu', (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest('[data-ref="card-menu-dropdown"]')) {
        e.preventDefault();
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      if (!menuDropdown) return;
      this.openCardDropdown(card, menuDropdown, actionsWrapper, { x: e.clientX, y: e.clientY });
    });

    btnMore?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!menuDropdown) return;
      this.openCardDropdown(card, menuDropdown, actionsWrapper, btnMore);
    });

    actionOpenNewTab?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.closeAllDropdowns();
      window.open(targetUrl, '_blank');
    });

    actionDuplicate?.addEventListener('click', async (e) => {
      e.stopPropagation();
      this.closeAllDropdowns();
      await this.handleDuplicateCanvas(canvas);
    });

    actionDownload?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.closeAllDropdowns();
      openCanvasDownloadModal(canvas);
    });

    actionShare?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.closeAllDropdowns();
      openCanvasShareModal(canvas);
    });

    actionCopyLink?.addEventListener('click', async (e) => {
      e.stopPropagation();
      this.closeAllDropdowns();
      const url = `${window.location.origin}${targetUrl}`;
      try {
        await navigator.clipboard.writeText(url);
        showToast(t('canvas.copy_link_success'));
      } catch {
        showToast(t('canvas.copy_link_error'), 'danger');
      }
    });

    actionDelete?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.closeAllDropdowns();
      this.handleDeleteCanvas(canvas);
    });

    const btnSync = card.querySelector<HTMLButtonElement>('[data-ref="btn-sync-cloud"]');
    btnSync?.addEventListener('click', async (e) => {
      e.stopPropagation();
      await this.handleSyncCanvas(canvas, card, btnSync);
    });

    card.setAttribute('draggable', 'true');

    card.addEventListener('dragstart', (e) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest('button, [data-ref="card-actions-wrapper"]')) {
        e.preventDefault();
        return;
      }

      if (!this.selectedUuids.has(canvas.uuid)) {
        this.selectedUuids = new Set([canvas.uuid]);
        this.updateSelectionUi();
      }

      this.currentDraggedUuids = Array.from(this.selectedUuids);

      if (e.dataTransfer) {
        e.dataTransfer.setData('text/plain', JSON.stringify(this.currentDraggedUuids));
        e.dataTransfer.effectAllowed = 'move';

        const ghost = document.createElement('div');
        ghost.className = 'canvas-drag-ghost';
        const count = this.currentDraggedUuids.length;
        const label =
          count === 1
            ? t('canvas.drag_ghost_one') || 'Mover lienzo'
            : t('canvas.drag_ghost_many', { count }) || `Mover ${count} lienzos`;
        ghost.innerHTML = `<span class="material-symbols-rounded">layers</span><span>${label}</span>`;
        document.body.appendChild(ghost);
        e.dataTransfer.setDragImage(ghost, 20, 20);
        requestAnimationFrame(() => {
          ghost.remove();
        });
      }

      requestAnimationFrame(() => {
        this.currentDraggedUuids.forEach((uuid) => {
          const cEl = this.gridEl?.querySelector<HTMLElement>(`[data-ref="canvas-card-${uuid}"]`);
          cEl?.classList.add('is-dragging');
        });
      });
    });

    card.addEventListener('dragend', () => {
      this.currentDraggedUuids = [];
      this.didDrag = true;
      setTimeout(() => {
        this.didDrag = false;
      }, 100);

      this.gridEl?.querySelectorAll('.canvas-card.is-dragging').forEach((el) => {
        el.classList.remove('is-dragging');
      });
      this.gridEl?.querySelectorAll('.canvas-card--folder.is-drop-target').forEach((el) => {
        el.classList.remove('is-drop-target');
      });
      const navHome = this.container.querySelector<HTMLElement>('[data-ref="btn-nav-home"]');
      navHome?.classList.remove('is-drop-target');
    });

    card.addEventListener('click', () => {
      if (this.didDrag) return;
      if (this.activeOpenDropdown) {
        this.closeAllDropdowns();
        return;
      }
      if (this.selectedUuids.size > 0) {
        this.toggleCardSelection(canvas.uuid);
        return;
      }
      window.open(targetUrl, '_blank');
    });

    return card;
  }

  private async handleDuplicateCanvas(canvas: CanvasItem): Promise<void> {
    try {
      await this.duplicateCanvasItem(canvas);
      showToast(t('canvas.duplicate_success'));
      await this.loadCanvases();
    } catch {
      showToast(t('canvas.duplicate_error'), 'danger');
    }
  }

  private handleDeleteCanvas(canvas: CanvasItem): void {
    openModal({
      title: t('canvas.trash_confirm_title') || 'Mover a la papelera',
      description: t('canvas.trash_confirm_desc') || '¿Estás seguro de que deseas mover este lienzo a la papelera?',
      confirmText: t('canvas.menu_move_to_trash') || 'Mover a la papelera',
      confirmClass: 'component-button--danger',
      onConfirm: async (modal) => {
        modal.setConfirmLoading(true);
        try {
          if (canvas.is_local || !canvas.id || !currentUser) {
            await softDeleteLocalCanvas(canvas.uuid);
            showToast(t('canvas.trash_success'));
            modal.close();
            await this.loadCanvases();
          } else {
            const res = await deleteApi(API_ROUTES.canvases.delete(canvas.uuid));
            if (res.ok) {
              await softDeleteLocalCanvas(canvas.uuid);
              showToast(t('canvas.trash_success'));
              modal.close();
              await this.loadCanvases();
            } else {
              let errMsg = t('canvas.trash_error');
              try {
                const data = await res.json();
                if (data?.error) errMsg = data.error;
              } catch {}
              modal.showError(errMsg);
              showToast(errMsg, 'danger');
            }
          }
        } catch {
          const errMsg = t('canvas.trash_error');
          modal.showError(errMsg);
          showToast(errMsg, 'danger');
        } finally {
          modal.setConfirmLoading(false);
        }
      },
    });
  }

  private async handleSyncCanvas(canvas: CanvasItem, card: HTMLElement, btnSync: HTMLButtonElement): Promise<void> {
    btnSync.disabled = true;
    btnSync.textContent = t('canvas.syncing');

    try {
      const fullCanvas = (await getLocalCanvasByUuid(canvas.uuid)) || canvas;

      const res = await postApi(API_ROUTES.canvases.sync, {
        uuid: fullCanvas.uuid,
        name: fullCanvas.name,
        width: fullCanvas.width,
        height: fullCanvas.height,
        unit: fullCanvas.unit || 'px',
        data: fullCanvas.data || null,
        preview_thumbnail: fullCanvas.preview_thumbnail || null,
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

      const errData = await res.json().catch(() => null);
      const errMsg = errData?.error || t('canvas.sync_error');
      showToast(errMsg, 'danger');
      btnSync.disabled = false;
      btnSync.textContent = t('canvas.btn_sync');
    } catch {
      showToast(t('canvas.sync_error'), 'danger');
      btnSync.disabled = false;
      btnSync.textContent = t('canvas.btn_sync');
    }
  }

  private async loadFolders(): Promise<void> {
    if (!currentUser || this.currentFolderUuid) {
      this.folders = [];
      return;
    }

    try {
      const res = await getApi(API_ROUTES.folders.base);
      if (res.ok) {
        const data = await res.json();
        this.folders = Array.isArray(data?.folders) ? data.folders : [];
      }
    } catch {
      this.folders = [];
    }
  }

  private createFolderCardElement(folder: FolderItem): HTMLElement {
    const card = document.createElement('div');
    card.className = 'canvas-card canvas-card--folder';
    card.setAttribute('data-ref', `folder-card-${folder.uuid}`);
    card.setAttribute('data-folder-uuid', folder.uuid);

    card.innerHTML = `
      <div class="canvas-card__thumbnail" data-ref="folder-thumbnail">
        <div class="folder-card__back" data-ref="folder-back-${folder.uuid}">
          <svg class="folder-card__back-svg" viewBox="0 0 300 50" preserveAspectRatio="none" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M0 10C0 4.5 4.5 0 10 0H105C110 0 115 2 118 6L124 14C127 18 132 20 137 20H290C295.5 20 300 24.5 300 30V50H0Z" fill="currentColor" />
          </svg>
        </div>

        <div class="folder-card__front" data-ref="folder-front-${folder.uuid}">
          <div class="folder-card__content" data-ref="folder-content-${folder.uuid}">
            <div class="folder-card__icon-box" data-ref="folder-icon-${folder.uuid}">
              <svg class="folder-card__cloud-icon" viewBox="0 0 32 26" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M8 21C5.2 21 3 18.8 3 16C3 13.4 4.9 11.3 7.5 11C8.5 7 12 4 16 4C20.2 4 23.6 7.2 24 11.3C26.3 12 28 14 28 16.5C28 19 26 21 23.5 21H8Z" />
                <path d="M16 17V10M12.5 13.5L16 10L19.5 13.5" />
              </svg>
            </div>
          </div>
        </div>

        <div class="canvas-card__actions-wrapper" data-ref="card-actions-wrapper">
          <div class="canvas-card__actions" data-ref="card-actions">
            <button type="button" class="canvas-card__action-btn" data-ref="btn-folder-more" data-tooltip="Opciones" aria-label="Opciones">
              <span class="material-symbols-rounded">more_vert</span>
            </button>
          </div>
          <div class="menu-panel menu-panel--dropdown menu-panel--w-265 menu-panel--h-auto" data-ref="folder-menu-dropdown" style="display: none;">
            <div class="menu-panel__drag-zone" data-ref="folder-menu-drag-zone" aria-hidden="true">
              <div class="menu-panel__drag-handle"></div>
            </div>
            <div class="menu-panel__list" data-ref="folder-menu-list">
              <button type="button" class="menu-item" data-ref="action-folder-rename">
                <svg class="component-icon menu-item__icon" aria-hidden="true"><use href="/icons.svg#edit"></use></svg>
                <span class="menu-item__text" data-i18n="canvas.folder_rename">${t('canvas.folder_rename')}</span>
              </button>
              <div class="menu-divider"></div>
              <button type="button" class="menu-item menu-item--bordered menu-item--danger" data-ref="action-folder-delete">
                <svg class="component-icon menu-item__icon" aria-hidden="true"><use href="/icons.svg#delete"></use></svg>
                <span class="menu-item__text" data-i18n="canvas.folder_delete">${t('canvas.folder_delete')}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div class="canvas-card__info" data-ref="folder-info-${folder.uuid}">
        <span class="canvas-card__name" data-ref="folder-title-${folder.uuid}" title="${escapeHtml(folder.name)}">
          ${escapeHtml(folder.name)}
        </span>
        <div class="canvas-card__meta">
          <span class="material-symbols-rounded canvas-card__meta-icon">folder</span>
          <span>Carpeta</span>
          ${folder.items_count !== undefined ? `<span class="canvas-card__meta-dot">·</span><span>${folder.items_count} ${folder.items_count === 1 ? 'elemento' : 'elementos'}</span>` : ''}
        </div>
      </div>
    `;

    const actionsWrapper = card.querySelector<HTMLElement>('[data-ref="card-actions-wrapper"]');
    const btnMore = card.querySelector<HTMLButtonElement>('[data-ref="btn-folder-more"]');
    const dropdown = card.querySelector<HTMLElement>('[data-ref="folder-menu-dropdown"]');
    const actionRename = card.querySelector<HTMLButtonElement>('[data-ref="action-folder-rename"]');
    const actionDelete = card.querySelector<HTMLButtonElement>('[data-ref="action-folder-delete"]');

    actionsWrapper?.addEventListener('click', (e) => {
      e.stopPropagation();
    });

    card.addEventListener('dragenter', (e) => {
      e.preventDefault();
      if (this.currentDraggedUuids.length > 0) {
        card.classList.add('is-drop-target');
      }
    });

    card.addEventListener('dragover', (e) => {
      e.preventDefault();
      if (this.currentDraggedUuids.length > 0 && e.dataTransfer) {
        e.dataTransfer.dropEffect = 'move';
        if (!card.classList.contains('is-drop-target')) {
          card.classList.add('is-drop-target');
        }
      }
    });

    card.addEventListener('dragleave', (e) => {
      const related = e.relatedTarget as Node | null;
      if (!card.contains(related)) {
        card.classList.remove('is-drop-target');
      }
    });

    card.addEventListener('drop', (e) => {
      e.preventDefault();
      this.didDrag = true;
      setTimeout(() => {
        this.didDrag = false;
      }, 150);
      card.classList.remove('is-drop-target');
      let uuids = this.currentDraggedUuids;
      if (!uuids || uuids.length === 0) {
        try {
          const raw = e.dataTransfer?.getData('text/plain');
          if (raw) uuids = JSON.parse(raw);
        } catch {}
      }
      if (uuids && uuids.length > 0) {
        void this.moveCanvasesToFolder(uuids, folder);
      }
    });

    card.addEventListener('click', () => {
      if (this.didDrag) return;
      if (this.activeOpenDropdown) {
        this.closeAllDropdowns();
        return;
      }
      this.closeAllDropdowns();
      void this.openFolder(folder.uuid);
    });

    card.addEventListener('contextmenu', (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest('[data-ref="folder-menu-dropdown"]')) {
        e.preventDefault();
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      if (!dropdown) return;
      this.openCardDropdown(card, dropdown, actionsWrapper, { x: e.clientX, y: e.clientY });
    });

    btnMore?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!dropdown) return;
      this.openCardDropdown(card, dropdown, actionsWrapper, btnMore);
    });

    actionRename?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.closeAllDropdowns();
      openRenameFolderModal(folder, {
        onSuccess: (updated) => {
          folder.name = updated.name;
          const titleEl = card.querySelector<HTMLElement>(`[data-ref="folder-title-${folder.uuid}"]`);
          if (titleEl) {
            titleEl.textContent = updated.name;
            titleEl.title = updated.name;
          }
        },
      });
    });

    actionDelete?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.closeAllDropdowns();
      this.confirmDeleteFolder(folder);
    });

    return card;
  }

  public async openFolder(folderUuid: string, pushState = true): Promise<void> {
    this.clearSelection();
    this.currentFolderUuid = folderUuid;
    this.container.classList.add('is-folder-view');
    if (pushState) {
      window.history.pushState({}, '', `/folder/${folderUuid}`);
    }

    if (this.homeTitle) this.homeTitle.style.display = 'none';
    if (this.homeHero) this.homeHero.style.display = 'none';
    if (this.canvasSectionTitle) this.canvasSectionTitle.textContent = t('canvas.folder_content') || 'Contenido de la carpeta';
    if (this.folderTitleContainer) this.folderTitleContainer.style.display = 'flex';
    if (this.btnCreateFolder) this.btnCreateFolder.style.display = 'none';
    if (this.folderContextActions) this.folderContextActions.style.display = 'flex';

    this.currentFolders = [];
    this.currentPage = 1;
    this.totalPages = 1;
    this.hasMore = false;
    await this.loadCanvases(true);
  }

  public async exitFolder(pushState = true): Promise<void> {
    this.clearSelection();
    this.currentFolderUuid = null;
    this.currentFolder = null;
    this.container.classList.remove('is-folder-view');
    if (pushState) {
      window.history.pushState({}, '', '/');
    }

    if (this.homeTitle) this.homeTitle.style.display = '';
    if (this.homeHero) this.homeHero.style.display = '';
    if (this.canvasSectionTitle) this.canvasSectionTitle.textContent = t('canvas.recent_canvases') || 'Lienzos recientes';
    if (this.folderTitleContainer) this.folderTitleContainer.style.display = 'none';
    if (this.btnCreateFolder) this.btnCreateFolder.style.display = '';
    if (this.folderContextActions) this.folderContextActions.style.display = 'none';

    await this.loadAll();
  }

  private confirmDeleteFolder(folder: FolderItem): void {
    openModal({
      confirmClass: 'component-button--danger',
      confirmText: t('canvas.folder_delete_submit'),
      description: t('canvas.folder_delete_desc'),
      size: 'sm',
      titleKey: 'canvas.folder_delete_title',
      onConfirm: async (inst) => {
        inst.setConfirmLoading(true);
        try {
          const res = await deleteApi(API_ROUTES.folders.byId(folder.uuid));
          if (!res.ok) {
            const err = await res.json().catch(() => null);
            inst.showError(err?.error || t('canvas.folder_delete_error'));
            inst.setConfirmLoading(false);
            return false;
          }

          inst.close();
          showToast(t('canvas.folder_delete_success'), 'success');
          this.folders = this.folders.filter((f) => f.uuid !== folder.uuid);
          if (this.currentFolderUuid === folder.uuid) {
            void this.exitFolder();
          } else {
            this.filterFolders();
            this.renderGrid();
          }
          return true;
        } catch {
          inst.showError(t('canvas.folder_delete_error'));
          inst.setConfirmLoading(false);
          return false;
        }
      },
    });
  }

  private toggleCardSelection(uuid: string): void {
    if (this.selectedUuids.has(uuid)) {
      this.selectedUuids.delete(uuid);
    } else {
      this.selectedUuids.add(uuid);
    }
    this.updateSelectionUi();
  }

  private createSelectionToolbar(): HTMLElement {
    const toolbar = document.createElement('div');
    toolbar.className = 'selection-toolbar is-hidden';
    toolbar.setAttribute('data-ref', 'selection-toolbar');
    toolbar.innerHTML = `
      <div class="selection-toolbar__left" data-ref="selection-toolbar-left">
        <button type="button" class="component-button component-button--icon-only component-button--h34 selection-toolbar__btn selection-toolbar__btn--close" data-ref="btn-selection-close" data-tooltip="Cancelar selección" aria-label="Cancelar selección">
          ${createIconSvg('close')}
        </button>
        <span class="selection-toolbar__count" data-ref="selection-count">0 seleccionados</span>
      </div>
      <div class="selection-toolbar__divider" data-ref="selection-toolbar-divider"></div>
      <div class="selection-toolbar__actions" data-ref="selection-toolbar-actions">
        <button type="button" class="component-button component-button--icon-only component-button--h34 selection-toolbar__btn" data-ref="btn-selection-download" data-tooltip="Descargar" aria-label="Descargar">
          ${createIconSvg('download')}
        </button>
        ${
          currentUser
            ? `
        <button type="button" class="component-button component-button--icon-only component-button--h34 selection-toolbar__btn" data-ref="btn-selection-move" data-tooltip="Mover a carpeta" aria-label="Mover a carpeta">
          ${createIconSvg('drive_file_move')}
        </button>
        `
            : ''
        }
        <button type="button" class="component-button component-button--icon-only component-button--h34 selection-toolbar__btn" data-ref="btn-selection-duplicate" data-tooltip="Duplicar" aria-label="Duplicar">
          ${createIconSvg('filter_none')}
        </button>
        <button type="button" class="component-button component-button--icon-only component-button--h34 component-button--danger-hover selection-toolbar__btn" data-ref="btn-selection-delete" data-tooltip="Mover a la papelera" aria-label="Mover a la papelera">
          ${createIconSvg('delete')}
        </button>
      </div>
    `;

    const btnClose = toolbar.querySelector<HTMLElement>('[data-ref="btn-selection-close"]');
    const btnDownload = toolbar.querySelector<HTMLElement>('[data-ref="btn-selection-download"]');
    const btnMove = toolbar.querySelector<HTMLElement>('[data-ref="btn-selection-move"]');
    const btnDuplicate = toolbar.querySelector<HTMLElement>('[data-ref="btn-selection-duplicate"]');
    const btnDelete = toolbar.querySelector<HTMLElement>('[data-ref="btn-selection-delete"]');

    btnClose?.addEventListener('click', () => {
      this.clearSelection();
    });

    btnDownload?.addEventListener('click', () => {
      void this.handleBulkDownload();
    });

    btnMove?.addEventListener('click', () => {
      this.handleBulkMove();
    });

    btnDuplicate?.addEventListener('click', () => {
      void this.handleBulkDuplicate();
    });

    btnDelete?.addEventListener('click', () => {
      this.handleBulkDelete();
    });

    const wrapper = this.container.querySelector<HTMLElement>('[data-ref="home-wrapper"]') || this.container;
    wrapper.appendChild(toolbar);

    this.selectionToolbar = toolbar;
    this.selectionCountEl = toolbar.querySelector<HTMLElement>('[data-ref="selection-count"]');

    return toolbar;
  }

  private removeSelectionToolbar(): void {
    if (!this.selectionToolbar) return;
    const toolbar = this.selectionToolbar;
    toolbar.classList.remove('is-active');
    setTimeout(() => {
      if (this.selectedUuids.size === 0 && toolbar.parentNode) {
        toolbar.remove();
        if (this.selectionToolbar === toolbar) {
          this.selectionToolbar = null;
          this.selectionCountEl = null;
        }
      }
    }, 220);
  }

  private updateSelectionUi(): void {
    const count = this.selectedUuids.size;
    const isSelecting = count > 0;

    this.scrollableEl?.classList.toggle('is-selecting', isSelecting);

    if (isSelecting) {
      if (!this.selectionToolbar) {
        this.createSelectionToolbar();
      }
      this.selectionToolbar?.classList.remove('is-hidden');
      requestAnimationFrame(() => {
        this.selectionToolbar?.classList.add('is-active');
      });
    } else {
      this.removeSelectionToolbar();
    }

    if (this.selectionCountEl) {
      const text = count === 1
        ? (t('canvas.selection_count_one') || '1 seleccionado')
        : (t('canvas.selection_count_many', { count }) || `${count} seleccionados`);
      this.selectionCountEl.textContent = text;
    }

    const cards = this.gridEl?.querySelectorAll<HTMLElement>('.canvas-card:not(.canvas-card--folder)') || [];
    cards.forEach((card) => {
      const uuid = card.getAttribute('data-uuid');
      if (!uuid) return;
      const isSelected = this.selectedUuids.has(uuid);
      card.classList.toggle('is-selected', isSelected);
    });
  }

  private clearSelection(): void {
    this.selectedUuids.clear();
    this.updateSelectionUi();
  }

  private handlePointerDown(e: PointerEvent): void {
    if (e.button !== 0) return;

    const target = e.target as HTMLElement | null;
    if (
      target?.closest(
        '.layout-nav, .canvas-card, button, a, input, [data-ref="card-menu-dropdown"], [data-ref="folder-menu-dropdown"], [data-ref="selection-toolbar"], [data-ref="search-toolbar"], [data-ref="home-floating-top"], [data-ref="home-hero"], [data-ref="component-top"]'
      )
    ) {
      return;
    }

    this.dragStartX = e.clientX;
    this.dragStartY = e.clientY;
    this.isShiftDrag = e.shiftKey || e.ctrlKey || e.metaKey;
    this.dragInitialSelection = new Set(this.selectedUuids);
    this.didDrag = false;
    this.isMarqueeDragging = true;
  }

  private handlePointerMove(e: PointerEvent): void {
    if (!this.isMarqueeDragging) return;

    const dist = Math.hypot(e.clientX - this.dragStartX, e.clientY - this.dragStartY);
    if (!this.didDrag) {
      if (dist < 6) return;
      this.didDrag = true;
      if (!this.marqueeEl) {
        this.marqueeEl = document.createElement('div');
        this.marqueeEl.className = 'selection-marquee';
        document.body.appendChild(this.marqueeEl);
      }
    }

    const left = Math.min(this.dragStartX, e.clientX);
    const top = Math.min(this.dragStartY, e.clientY);
    const width = Math.abs(e.clientX - this.dragStartX);
    const height = Math.abs(e.clientY - this.dragStartY);
    const right = left + width;
    const bottom = top + height;

    if (this.marqueeEl) {
      this.marqueeEl.style.left = `${left}px`;
      this.marqueeEl.style.top = `${top}px`;
      this.marqueeEl.style.width = `${width}px`;
      this.marqueeEl.style.height = `${height}px`;
    }

    const cards = this.gridEl?.querySelectorAll<HTMLElement>('.canvas-card:not(.canvas-card--folder)') || [];
    const nextSelection = new Set(this.isShiftDrag ? this.dragInitialSelection : []);

    cards.forEach((card) => {
      const uuid = card.getAttribute('data-uuid');
      if (!uuid) return;
      const r = card.getBoundingClientRect();
      const intersects = !(right < r.left || left > r.right || bottom < r.top || top > r.bottom);

      if (this.isShiftDrag) {
        if (intersects) {
          if (this.dragInitialSelection.has(uuid)) {
            nextSelection.delete(uuid);
          } else {
            nextSelection.add(uuid);
          }
        }
      } else {
        if (intersects) {
          nextSelection.add(uuid);
        }
      }
    });

    this.selectedUuids = nextSelection;
    this.updateSelectionUi();
  }

  private handlePointerUp(e: PointerEvent): void {
    if (!this.isMarqueeDragging) return;
    this.isMarqueeDragging = false;

    if (this.marqueeEl) {
      this.marqueeEl.remove();
      this.marqueeEl = null;
    }

    if (!this.didDrag) {
      const target = e.target as HTMLElement | null;
      const card = target?.closest<HTMLElement>('.canvas-card:not(.canvas-card--folder)');
      if (!card && this.selectedUuids.size > 0) {
        this.clearSelection();
      }
    } else {
      setTimeout(() => {
        this.didDrag = false;
      }, 50);
    }
  }

  private async handleBulkDownload(): Promise<void> {
    const selectedCanvases = this.allCanvases.filter((c) => this.selectedUuids.has(c.uuid));
    if (selectedCanvases.length === 0) {
      showToast('Selecciona al menos un lienzo para descargar', 'info');
      return;
    }

    if (selectedCanvases.length === 1 && selectedCanvases[0]) {
      openCanvasDownloadModal(selectedCanvases[0]);
      return;
    }

    showToast(t('canvas.selection_download_multi', { count: selectedCanvases.length }) || `Descargando ${selectedCanvases.length} lienzos...`);

    for (let i = 0; i < selectedCanvases.length; i++) {
      const c = selectedCanvases[i];
      if (c) {
        await this.downloadSingleCanvas(c);
      }
      if (i < selectedCanvases.length - 1) {
        await new Promise((r) => setTimeout(r, 250));
      }
    }

    showToast(t('canvas.download_success') || 'Descarga completada', 'success');
  }

  private async downloadSingleCanvas(canvas: CanvasItem): Promise<void> {
    const isDoc = canvas.canvas_type === 'doc' || canvas.unit === 'doc';

    const cleanName = (canvas.name || 'lienzo')
      .trim()
      .replace(/[/\\?%*:|"<>]/g, '_')
      .replace(/\s+/g, '_');

    try {
      let fullCanvas: CanvasItem | null = null;
      if (canvas.is_local) {
        fullCanvas = await getLocalCanvasByUuid(canvas.uuid);
      } else {
        const res = await getApi(API_ROUTES.canvases.byId(canvas.uuid));
        if (res.ok) {
          const data = await res.json();
          if (data?.canvas) fullCanvas = data.canvas;
        }
      }
      if (!fullCanvas) fullCanvas = canvas;

      if (isDoc) {
        let docProject: any = null;
        if (fullCanvas.data) {
          try {
            docProject = typeof fullCanvas.data === 'string' ? JSON.parse(fullCanvas.data) : fullCanvas.data;
          } catch {}
        }
        if (!docProject || !Array.isArray(docProject.pages)) {
          docProject = {
            pages: [{ contentHtml: '<p></p>', id: 'page-1' }],
            settings: {
              columnsCount: 1,
              fontFamily: 'Inter',
              fontSize: 11,
              lineHeight: 1.5,
              margins: { bottom: 96, left: 96, right: 96, top: 96 },
              orientation: 'portrait',
              paperSize: 'letter',
              showPageNumbers: true,
              viewMode: 'paginated',
              zoom: 1,
            },
            type: 'doc',
            version: 1,
          };
        }
        exportDocWord(docProject, fullCanvas.name);
        return;
      }

      const baseW = fullCanvas.width || 800;
      const baseH = fullCanvas.height || 600;

      let parsedData: any = null;
      if (fullCanvas.data) {
        try {
          parsedData = typeof fullCanvas.data === 'string' ? JSON.parse(fullCanvas.data) : fullCanvas.data;
        } catch {}
      }

      const frames = Array.isArray(parsedData?.frames) && parsedData.frames.length > 0 ? parsedData.frames : null;
      const outCanvas = document.createElement('canvas');
      outCanvas.width = baseW;
      outCanvas.height = baseH;
      const outCtx = outCanvas.getContext('2d');
      if (!outCtx) return;

      outCtx.imageSmoothingEnabled = false;

      let renderedFromLayers = false;
      if (frames && frames[0] && Array.isArray(frames[0].layers)) {
        const fCanvas = document.createElement('canvas');
        fCanvas.width = baseW;
        fCanvas.height = baseH;
        const fCtx = fCanvas.getContext('2d');
        if (fCtx) {
          for (const layer of frames[0].layers) {
            if (layer.visible !== false && layer.data) {
              const img = new Image();
              await new Promise<void>((r) => {
                img.onload = () => r();
                img.onerror = () => r();
                img.src = layer.data;
              });
              fCtx.globalAlpha = typeof layer.opacity === 'number' ? layer.opacity : 1;
              fCtx.drawImage(img, 0, 0);
            }
          }
          outCtx.drawImage(fCanvas, 0, 0, outCanvas.width, outCanvas.height);
          renderedFromLayers = true;
        }
      }

      if (!renderedFromLayers) {
        const thumb = fullCanvas.preview_thumbnail || canvas.preview_thumbnail;
        if (thumb) {
          const img = new Image();
          await new Promise<void>((r) => {
            img.onload = () => r();
            img.onerror = () => r();
            img.src = thumb;
          });
          outCtx.drawImage(img, 0, 0, outCanvas.width, outCanvas.height);
        }
      }

      const blob = await new Promise<Blob | null>((resolve) => outCanvas.toBlob(resolve, 'image/png'));
      if (blob) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${cleanName}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch {}
  }

  private handleBulkMove(): void {
    const selectedCanvases = this.allCanvases.filter((c) => this.selectedUuids.has(c.uuid));
    if (selectedCanvases.length === 0) {
      showToast('Selecciona al menos un lienzo para mover', 'info');
      return;
    }
    if (!currentUser) {
      showToast(t('canvas.folder_login_required') || 'Debes iniciar sesión para organizar en carpetas', 'info');
      return;
    }

    openMoveCanvasModal(selectedCanvases, {
      onMoved: () => {
        this.clearSelection();
        if (this.currentFolderUuid) {
          void this.openFolder(this.currentFolderUuid, false);
        } else {
          void this.loadAll();
        }
      },
    });
  }

  private setupNavDropTargets(): void {
    const setupTarget = (el: HTMLElement | null) => {
      if (!el) return;
      const { signal } = this.abortController;

      el.addEventListener(
        'dragenter',
        (e) => {
          e.preventDefault();
          if (this.currentFolderUuid && this.currentDraggedUuids.length > 0) {
            el.classList.add('is-drop-target');
          }
        },
        { signal }
      );

      el.addEventListener(
        'dragover',
        (e) => {
          e.preventDefault();
          if (this.currentFolderUuid && this.currentDraggedUuids.length > 0 && e.dataTransfer) {
            e.dataTransfer.dropEffect = 'move';
            if (!el.classList.contains('is-drop-target')) {
              el.classList.add('is-drop-target');
            }
          }
        },
        { signal }
      );

      el.addEventListener(
        'dragleave',
        (e) => {
          const related = e.relatedTarget as Node | null;
          if (!el.contains(related)) {
            el.classList.remove('is-drop-target');
          }
        },
        { signal }
      );

      el.addEventListener(
        'drop',
        (e) => {
          e.preventDefault();
          this.didDrag = true;
          setTimeout(() => {
            this.didDrag = false;
          }, 150);
          el.classList.remove('is-drop-target');
          if (!this.currentFolderUuid) return;

          let uuids = this.currentDraggedUuids;
          if (!uuids || uuids.length === 0) {
            try {
              const raw = e.dataTransfer?.getData('text/plain');
              if (raw) uuids = JSON.parse(raw);
            } catch {}
          }
          if (uuids && uuids.length > 0) {
            void this.moveCanvasesToFolder(uuids, null);
          }
        },
        { signal }
      );
    };

    const navHome = this.container.querySelector<HTMLElement>('[data-ref="btn-nav-home"]');
    setupTarget(navHome);
  }

  private async moveCanvasesToFolder(canvasUuids: string[], targetFolder: FolderItem | null): Promise<void> {
    if (!currentUser) {
      showToast(t('canvas.bookmark_login_required'), 'info');
      return;
    }

    const canvasesToMove = this.allCanvases.filter((c) => canvasUuids.includes(c.uuid));
    if (canvasesToMove.length === 0) return;

    const targetFolderUuid = targetFolder?.uuid || null;
    const filteredCanvases = canvasesToMove.filter((c) => (c.folder_uuid || null) !== targetFolderUuid);
    if (filteredCanvases.length === 0) return;

    try {
      await Promise.all(
        filteredCanvases.map(async (c) => {
          if (c.is_local || !c.id) {
            const fullCanvas = (await getLocalCanvasByUuid(c.uuid)) || c;
            const syncRes = await postApi(API_ROUTES.canvases.sync, {
              uuid: fullCanvas.uuid,
              name: fullCanvas.name,
              width: fullCanvas.width,
              height: fullCanvas.height,
              unit: fullCanvas.unit || 'px',
              data: fullCanvas.data || null,
              preview_thumbnail: fullCanvas.preview_thumbnail || null,
            });
            if (syncRes.ok) {
              const data = await syncRes.json();
              if (data?.canvas?.id) {
                await markLocalCanvasAsSynced(c.uuid, data.canvas.id);
                c.is_local = false;
                c.id = data.canvas.id;
              }
            }
          }

          const res = await putApi(API_ROUTES.canvases.move(c.uuid), {
            folder_uuid: targetFolderUuid,
          });
          if (!res.ok) {
            let errMsg = t('canvas.folder_move_error');
            try {
              const data = await res.json();
              if (data?.error) errMsg = data.error;
            } catch {}
            throw new Error(errMsg);
          }
        })
      );

      const count = filteredCanvases.length;
      if (targetFolder) {
        const msg =
          count === 1
            ? t('canvas.drag_drop_move_one', { name: targetFolder.name }) || `Lienzo movido a "${targetFolder.name}"`
            : t('canvas.drag_drop_move_many', { count, name: targetFolder.name }) || `${count} lienzos movidos a "${targetFolder.name}"`;
        showToast(msg, 'success');
      } else {
        const msg =
          count === 1
            ? t('canvas.drag_drop_move_root_one') || 'Lienzo movido a Mis proyectos'
            : t('canvas.drag_drop_move_root_many', { count }) || `${count} lienzos movidos a Mis proyectos`;
        showToast(msg, 'success');
      }

      this.clearSelection();

      if (this.currentFolderUuid) {
        await this.openFolder(this.currentFolderUuid, false);
      } else {
        await this.loadAll();
      }
    } catch {
      showToast(t('canvas.folder_move_error') || 'Error al mover lienzos', 'danger');
    }
  }

  private async handleBulkDuplicate(): Promise<void> {
    const selectedCanvases = this.allCanvases.filter((c) => this.selectedUuids.has(c.uuid));
    if (selectedCanvases.length === 0) {
      showToast('Selecciona al menos un lienzo para duplicar', 'info');
      return;
    }

    try {
      await Promise.all(selectedCanvases.map((c) => this.duplicateCanvasItem(c)));
      showToast(t('canvas.selection_duplicate_success') || 'Lienzos duplicados exitosamente', 'success');
      this.clearSelection();
      await this.loadCanvases();
    } catch {
      showToast(t('canvas.selection_duplicate_error') || 'Error al duplicar lienzos', 'danger');
    }
  }

  private async duplicateCanvasItem(canvas: CanvasItem): Promise<void> {
    if (canvas.is_local || !canvas.id || !currentUser) {
      const fullCanvas = (await getLocalCanvasByUuid(canvas.uuid)) || canvas;
      const newUuid = crypto.randomUUID();
      const copyItem: CanvasItem = {
        ...fullCanvas,
        uuid: newUuid,
        id: undefined,
        name: `${canvas.name} (Copia)`,
        is_local: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      await saveLocalCanvas(copyItem);
      return;
    }

    const res = await postApi(API_ROUTES.canvases.duplicate(canvas.uuid));
    if (!res.ok) {
      let errMsg = t('canvas.duplicate_error');
      try {
        const data = await res.json();
        if (data?.error) errMsg = data.error;
      } catch {}
      throw new Error(errMsg);
    }
  }

  private handleBulkDelete(): void {
    const count = this.selectedUuids.size;
    if (count === 0) return;

    openModal({
      title: t('canvas.selection_delete_confirm_title') || 'Mover a la papelera',
      description: t('canvas.selection_delete_confirm_desc', { count }) || `¿Estás seguro de que deseas mover los ${count} lienzos seleccionados a la papelera?`,
      confirmText: t('canvas.selection_delete_submit') || 'Mover a la papelera',
      confirmClass: 'component-button--danger',
      onConfirm: async (modal) => {
        modal.setConfirmLoading(true);
        try {
          const selectedCanvases = this.allCanvases.filter((c) => this.selectedUuids.has(c.uuid));

          await Promise.all([
            ...selectedCanvases.map(async (c) => {
              if (c.is_local || !c.id || !currentUser) {
                await softDeleteLocalCanvas(c.uuid);
              } else {
                await deleteApi(API_ROUTES.canvases.delete(c.uuid));
                await softDeleteLocalCanvas(c.uuid);
              }
            }),
          ]);

          showToast(t('canvas.selection_delete_success') || 'Lienzos movidos a la papelera', 'success');
          modal.close();
          this.clearSelection();
          if (this.currentFolderUuid) {
            await this.openFolder(this.currentFolderUuid, false);
          } else {
            await this.loadAll();
          }
        } catch {
          modal.showError(t('canvas.trash_error') || 'Error al eliminar lienzos');
        } finally {
          modal.setConfirmLoading(false);
        }
      },
    });
  }
}

export async function createHomeView(folderUuid?: string): Promise<HTMLElement> {
  const container = await loadTemplate('/views/home/home.html');
  translateElement(container);

  const sidebar = await createSidebar();
  container.prepend(sidebar);

  const controller = new HomeController(container);
  await controller.init(folderUuid);
  (container as any).__controller = controller;

  return container;
}
