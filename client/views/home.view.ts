import { navigate } from '../app-router.js';
import { openCreateCanvasModal } from '../components/create-canvas-modal.component.js';
import { openCreateFolderModal } from '../components/folder-modal.component.js';
import { openUpgradeModal } from '../components/upgrade-modal.component.js';
import { renderHomeCategoryBadgesHtml } from '../config/home-category-badges.config.js';
import { getUserTier } from '../config/plans.config.js';
import { currentUser } from '../services/api.service.js';
import { createAndOpenCanvas } from '../services/canvas-creator.service.js';
import { t, translateElement } from '../services/i18n.service.js';
import { renderIcons } from '../services/icon.service.js';
import { SkeletonService } from '../services/skeleton.service.js';
import { loadTemplate } from '../services/template.service.js';
import { showToast } from '../services/toast.service.js';
import { bindDragToScroll, CarouselController, initCarouselScroll, removeEmptyState, renderEmptyState, setupDropdown, setupLazyImages } from '../utils/dom.util.js';
import { HomeCanvasesManager } from './home/home-canvases.manager.js';
import { HomeCardsManager } from './home/home-cards.manager.js';
import { HomeFoldersManager } from './home/home-folders.manager.js';
import { HomeSelectionManager } from './home/home-selection.manager.js';
import { HomeTemplatesManager } from './home/home-templates.manager.js';
import { CanvasSort, CanvasTypeFilter, EntityFilter } from './home/home.types.js';

class HomeController {
  private container: HTMLElement;
  private abortController: AbortController;
  private currentEntityFilter: EntityFilter = 'all';
  private currentTypeFilter: CanvasTypeFilter = 'all';
  private currentSort: CanvasSort = 'activity';
  private typeDropdownController: ReturnType<typeof setupDropdown> | null = null;
  private sortDropdownController: ReturnType<typeof setupDropdown> | null = null;
  private searchDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  private searchQuery = '';
  private gridEl: HTMLElement | null = null;
  private canvasSection: HTMLElement | null = null;
  private canvasSectionHeader: HTMLElement | null = null;
  private canvasSectionTitle: HTMLElement | null = null;
  private scrollableEl: HTMLElement | null = null;
  private sentinelEl: HTMLElement | null = null;

  private isSearchActive = false;
  private btnToggleSearch: HTMLElement | null = null;
  private searchToolbar: HTMLElement | null = null;
  private searchInput: HTMLInputElement | null = null;
  private btnClearSearch: HTMLElement | null = null;
  private heroSearchInput: HTMLInputElement | null = null;
  private btnHeroClearSearch: HTMLElement | null = null;
  private homeHero: HTMLElement | null = null;

  private homeDefaultActions: HTMLElement | null = null;
  private btnCreateFolder: HTMLElement | null = null;
  private btnHomeUpgrade: HTMLElement | null = null;
  private homeTitle: HTMLElement | null = null;
  private categoriesCarouselWrapper: HTMLElement | null = null;
  private categoriesCarouselController: CarouselController | null = null;
  private cleanupCategoriesDrag: (() => void) | null = null;

  private canvasesManager: HomeCanvasesManager;
  private templatesManager: HomeTemplatesManager;
  private cardsManager: HomeCardsManager;
  private foldersManager: HomeFoldersManager;
  private selectionManager: HomeSelectionManager;

  constructor(container: HTMLElement) {
    this.container = container;
    this.abortController = new AbortController();

    this.canvasesManager = new HomeCanvasesManager({
      createCardElement: (canvas) => this.cardsManager.createCardElement(canvas),
      getAbortSignal: () => this.abortController.signal,
      getFilters: () => ({
        currentEntityFilter: this.currentEntityFilter,
        currentSort: this.currentSort,
        currentTypeFilter: this.currentTypeFilter,
        searchQuery: this.searchQuery,
      }),
      getGridEl: () => this.gridEl,
      getScrollableEl: () => this.scrollableEl,
      getSentinelEl: () => this.sentinelEl,
      renderGrid: (isSearch) => this.renderGrid(isSearch),
    });

    this.selectionManager = new HomeSelectionManager({
      container: this.container,
      getAllCanvases: () => this.canvasesManager.getAllCanvases(),
      getGridEl: () => this.gridEl,
      getScrollableEl: () => this.scrollableEl,
      onReloadAll: () => this.loadAll(),
      onReloadCanvases: () => this.canvasesManager.loadCanvases(),
    });

    this.cardsManager = new HomeCardsManager({
      container: this.container,
      getCurrentDraggedUuids: () => this.selectionManager.getCurrentDraggedUuids(),
      getDidDrag: () => this.selectionManager.getDidDrag(),
      getGridEl: () => this.gridEl,
      getSelectedUuids: () => this.selectionManager.getSelectedUuids(),
      isCardSelected: (uuid) => this.selectionManager.isCardSelected(uuid),
      onReloadAll: () => this.loadAll(),
      onReloadCanvases: (showSkeletons) => this.canvasesManager.loadCanvases(showSkeletons),
      onSelectionStateChange: () => this.selectionManager.updateSelectionUi(),
      onToggleSelection: (uuid) => this.selectionManager.toggleCardSelection(uuid),
      setCurrentDraggedUuids: (uuids) => this.selectionManager.setCurrentDraggedUuids(uuids),
      setDidDrag: (val) => this.selectionManager.setDidDrag(val),
      setSelectedUuids: (uuids) => this.selectionManager.setSelectedUuids(uuids),
    });

    this.foldersManager = new HomeFoldersManager({
      closeAllDropdowns: () => this.cardsManager.closeAllDropdowns(),
      getCurrentDraggedUuids: () => this.selectionManager.getCurrentDraggedUuids(),
      getDidDrag: () => this.selectionManager.getDidDrag(),
      onFoldersChanged: () => {
        this.foldersManager.filterFolders(this.currentEntityFilter, this.currentTypeFilter, this.searchQuery, this.currentSort);
        this.renderGrid();
      },
      onMoveCanvasesToFolder: (uuids, folder) => this.selectionManager.moveCanvasesToFolder(uuids, folder),
      openCardDropdown: (card, dd, wrapper, target) => this.cardsManager.openCardDropdown(card, dd, wrapper, target),
      setDidDrag: (val) => this.selectionManager.setDidDrag(val),
    });

    this.templatesManager = new HomeTemplatesManager(
      this.container,
      this.container,
      () => ({ currentTypeFilter: this.currentTypeFilter, searchQuery: this.searchQuery })
    );
  }

  public async init(): Promise<void> {
    this.gridEl = this.container.querySelector<HTMLElement>('[data-ref="canvas-grid"]');
    this.canvasSection = this.container.querySelector<HTMLElement>('[data-ref="canvas-section"]');
    this.canvasSectionHeader = this.container.querySelector<HTMLElement>('[data-ref="canvas-section-header"]');
    this.scrollableEl = this.container;
    this.sentinelEl = this.container.querySelector<HTMLElement>('[data-ref="canvas-sentinel"]');

    this.btnToggleSearch = this.container.querySelector<HTMLElement>('[data-ref="btn-toggle-search"]');
    this.searchToolbar = this.container.querySelector<HTMLElement>('[data-ref="search-toolbar"]');
    this.searchInput = this.container.querySelector<HTMLInputElement>('[data-ref="home-search-input"]');
    this.btnClearSearch = this.container.querySelector<HTMLElement>('[data-ref="btn-clear-search"]');

    this.heroSearchInput = this.container.querySelector<HTMLInputElement>('[data-ref="hero-search-input"]');
    this.btnHeroClearSearch = this.container.querySelector<HTMLElement>('[data-ref="btn-hero-clear-search"]');
    this.homeHero = this.container.querySelector<HTMLElement>('[data-ref="home-hero"]');
    this.canvasSectionTitle = this.container.querySelector<HTMLElement>('[data-ref="canvas-section-title"]');

    this.homeDefaultActions = this.container.querySelector<HTMLElement>('[data-ref="home-default-actions"]');
    this.btnCreateFolder = this.container.querySelector<HTMLElement>('[data-ref="btn-create-folder"]');
    this.btnHomeUpgrade = this.container.querySelector<HTMLElement>('[data-ref="btn-home-upgrade"]');

    if (!currentUser) {
      if (this.btnHomeUpgrade) {
        this.btnHomeUpgrade.style.display = 'none';
      }
      if (this.btnCreateFolder) {
        this.btnCreateFolder.style.display = 'none';
      }
    } else {
      const userTier = getUserTier(currentUser);
      if (userTier === 'enterprise') {
        if (this.btnHomeUpgrade) {
          this.btnHomeUpgrade.style.display = 'none';
        }
      } else if (userTier === 'business') {
        if (this.btnHomeUpgrade) {
          const manageLabel = t('nav.manage_subscription') || 'Gestionar suscripción';
          this.btnHomeUpgrade.setAttribute('data-tooltip', manageLabel);
          this.btnHomeUpgrade.setAttribute('aria-label', manageLabel);
        }
      } else if (userTier === 'pro') {
        if (this.btnHomeUpgrade) {
          const upgradeBusinessLabel = t('nav.upgrade_to_business') || 'Mejorar a Negocios';
          this.btnHomeUpgrade.setAttribute('data-tooltip', upgradeBusinessLabel);
          this.btnHomeUpgrade.setAttribute('aria-label', upgradeBusinessLabel);
        }
      }
    }

    this.homeTitle = this.container.querySelector<HTMLElement>('[data-ref="home-title"]');

    const badgesContainer = this.container.querySelector<HTMLElement>('[data-ref="home-categories-badges"]');
    if (badgesContainer) {
      badgesContainer.innerHTML = renderHomeCategoryBadgesHtml();
    }

    await this.templatesManager.init();
    this.bindEvents();
    this.selectionManager.setupNavDropTargets(this.abortController.signal);

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
          this.currentEntityFilter = (val as EntityFilter) || 'all';
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
          this.currentSort = (val as CanvasSort) || 'activity';
          const sortMenu = this.container.querySelector<HTMLElement>('[data-ref="dropdown-menu-sort"]');
          sortMenu?.querySelectorAll<HTMLButtonElement>('.menu-item').forEach((item) => {
            item.classList.toggle('is-active', item.getAttribute('data-value') === this.currentSort);
          });
          void this.onFiltersChanged();
        },
        placement: 'bottom-end',
      });
    }

    await this.loadAll();
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

    const bindCreationBadge = (ref: string, action: () => void) => {
      this.container.querySelector<HTMLElement>(`[data-ref="${ref}"]`)?.addEventListener(
        'click',
        (e) => {
          e.preventDefault();
          action();
        },
        { signal }
      );
    };

    bindCreationBadge('cat-badge-templates', () => {
      navigate('/templates');
    });
    bindCreationBadge('cat-badge-presentation', () => {
      void createAndOpenCanvas({
        canvasType: 'presentation',
        name: 'Presentación sin título',
      });
    });
    bindCreationBadge('cat-badge-social', () => {
      openCreateCanvasModal({ initialType: 'social' });
    });
    bindCreationBadge('cat-badge-doc', () => {
      void createAndOpenCanvas({
        canvasType: 'doc',
        docOrientation: 'portrait',
        docPaperSize: 'letter',
        name: 'Documento sin título',
      });
    });
    bindCreationBadge('cat-badge-board', () => {
      void createAndOpenCanvas({
        bgType: 'dots',
        canvasType: 'board',
        name: 'Pizarrón sin título',
        solidColor: '#ffffff',
      });
    });
    bindCreationBadge('cat-badge-sheet', () => {
      void createAndOpenCanvas({
        canvasType: 'sheet',
        name: 'Hoja de cálculo sin título',
      });
    });
    bindCreationBadge('cat-badge-videos', () => {
      openCreateCanvasModal({ initialType: 'video' });
    });
    bindCreationBadge('cat-badge-custom', () => {
      openCreateCanvasModal({ initialType: 'custom-size' });
    });
    bindCreationBadge('cat-badge-upload', () => {
      openCreateCanvasModal({ initialType: 'upload' });
    });
    bindCreationBadge('cat-badge-more', () => {
      openCreateCanvasModal({ initialType: 'board' });
    });

    this.categoriesCarouselWrapper = this.container.querySelector<HTMLElement>('[data-ref="home-categories-carousel-wrapper"]');
    if (this.categoriesCarouselWrapper) {
      this.categoriesCarouselController = initCarouselScroll(this.categoriesCarouselWrapper, {
        step: 180,
      });
      const carouselEl = this.categoriesCarouselWrapper.querySelector<HTMLElement>('.component-tags-carousel');
      if (carouselEl) {
        this.cleanupCategoriesDrag = bindDragToScroll(carouselEl);
      }
      renderIcons(this.categoriesCarouselWrapper);
    }

    this.btnHomeUpgrade?.addEventListener(
      'click',
      () => {
        const userTier = getUserTier(currentUser);
        if (userTier === 'business') {
          navigate('/settings/billing');
        } else if (userTier === 'pro') {
          openUpgradeModal('business');
        } else {
          openUpgradeModal('pro');
        }
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
            this.foldersManager.addFolder(newFolder);
            this.foldersManager.filterFolders(this.currentEntityFilter, this.currentTypeFilter, this.searchQuery, this.currentSort);
            this.renderGrid();
          },
        });
      },
      { signal }
    );

    window.addEventListener(
      'canvas-created',
      () => {
        void this.loadAll();
      },
      { signal }
    );

    window.addEventListener(
      'spriteboard:folders-updated',
      () => {
        void this.foldersManager.loadFolders().then(() => {
          this.foldersManager.filterFolders(this.currentEntityFilter, this.currentTypeFilter, this.searchQuery, this.currentSort);
          this.renderGrid();
        });
      },
      { signal }
    );

    window.addEventListener(
      'spriteboard:uploads-updated',
      () => {
        void this.foldersManager.loadFolders().then(() => {
          this.foldersManager.filterFolders(this.currentEntityFilter, this.currentTypeFilter, this.searchQuery, this.currentSort);
          this.renderGrid();
        });
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
        const activeDd = this.cardsManager.getActiveDropdown();
        if (
          activeDd &&
          !activeDd.contains(target) &&
          !target?.closest('[data-ref="btn-card-more"]') &&
          !target?.closest('[data-ref="btn-folder-more"]')
        ) {
          this.cardsManager.closeAllDropdowns();
        }
      },
      { signal }
    );

    document.addEventListener(
      'contextmenu',
      (e: MouseEvent) => {
        const target = e.target as HTMLElement | null;
        const activeDd = this.cardsManager.getActiveDropdown();
        if (
          activeDd &&
          !activeDd.contains(target) &&
          !target?.closest('.canvas-card')
        ) {
          this.cardsManager.closeAllDropdowns();
        }
      },
      { signal }
    );

    this.scrollableEl?.addEventListener(
      'scroll',
      () => {
        if (this.cardsManager.getActiveDropdown()) {
          this.cardsManager.closeAllDropdowns();
        }
      },
      { signal, passive: true }
    );

    this.scrollableEl?.addEventListener(
      'pointerdown',
      (e: PointerEvent) => {
        this.selectionManager.handlePointerDown(e);
      },
      { signal }
    );

    window.addEventListener(
      'pointermove',
      (e: PointerEvent) => {
        this.selectionManager.handlePointerMove(e);
      },
      { signal }
    );

    window.addEventListener(
      'pointerup',
      (e: PointerEvent) => {
        this.selectionManager.handlePointerUp(e);
      },
      { signal }
    );

    document.addEventListener(
      'keydown',
      (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          if (this.cardsManager.getActiveDropdown()) {
            this.cardsManager.closeAllDropdowns();
            return;
          }
          if (this.selectionManager.getSelectedUuids().size > 0) {
            this.selectionManager.clearSelection();
            return;
          }
          if (this.isSearchActive) {
            this.toggleSearchToolbar(false);
          }
        }
      },
      { signal }
    );

    this.templatesManager.bindEvents(signal);
  }

  public destroy(): void {
    if (this.searchDebounceTimer) {
      clearTimeout(this.searchDebounceTimer);
      this.searchDebounceTimer = null;
    }
    this.canvasesManager.destroy();
    this.templatesManager.destroy();
    this.selectionManager.destroy();
    this.typeDropdownController?.destroy();
    this.typeDropdownController = null;
    this.sortDropdownController?.destroy();
    this.sortDropdownController = null;
    this.categoriesCarouselController?.destroy();
    this.categoriesCarouselController = null;
    this.cleanupCategoriesDrag?.();
    this.cardsManager.closeAllDropdowns();
    this.abortController.abort();
  }

  private toggleSearchToolbar(force?: boolean): void {
    this.selectionManager.clearSelection();
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
    this.selectionManager.clearSelection();
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
    this.selectionManager.clearSelection();
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
    this.foldersManager.filterFolders(this.currentEntityFilter, this.currentTypeFilter, this.searchQuery, this.currentSort);
    if (this.templatesManager.isShowingEmptyState || (this.canvasesManager.getAllCanvases().length === 0 && this.foldersManager.getAllFolders().length === 0)) {
      this.templatesManager.renderTemplates();
    }
    await this.canvasesManager.loadCanvases(true);
  }

  private async loadAll(): Promise<void> {
    if (!this.gridEl) return;

    if (this.canvasesManager.getAllCanvases().length === 0 && this.foldersManager.getAllFolders().length === 0) {
      this.gridEl.style.display = 'grid';
      SkeletonService.renderGridCardSkeletons(this.gridEl, 8, 'canvas');
    }

    await this.foldersManager.loadFolders();
    this.foldersManager.filterFolders(this.currentEntityFilter, this.currentTypeFilter, this.searchQuery, this.currentSort);
    await this.canvasesManager.loadCanvases(false);
  }

  private renderGrid(isSearchResult = false): void {
    if (!this.gridEl) return;

    const displayedFolders = this.foldersManager.getCurrentFolders();
    const currentCanvases = this.canvasesManager.getCurrentCanvases();
    const totalItems = displayedFolders.length + currentCanvases.length;

    if (totalItems === 0) {
      this.canvasesManager.disconnectScrollObserver();
      if (this.sentinelEl) {
        this.sentinelEl.style.display = 'none';
      }
      this.gridEl.innerHTML = '';
      this.gridEl.style.display = 'none';

      const templatesSection = this.templatesManager.getSection();

      if (isSearchResult && !this.templatesManager.isShowingEmptyState) {
        if (templatesSection) {
          templatesSection.style.display = 'none';
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
        this.templatesManager.isShowingEmptyState = true;
        if (this.canvasSection) {
          removeEmptyState(this.canvasSection, 'canvas-empty-state');
          this.canvasSection.style.display = 'none';
        }
        if (templatesSection) {
          templatesSection.style.display = 'block';
        }
        this.templatesManager.renderTemplates();
      }
      return;
    }

    this.templatesManager.isShowingEmptyState = false;
    const templatesSection = this.templatesManager.getSection();
    if (templatesSection) {
      removeEmptyState(templatesSection, 'templates-empty-state');
      templatesSection.style.display = 'none';
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
        folderFragment.appendChild(this.foldersManager.createFolderCardElement(folder));
      });
      this.gridEl.appendChild(folderFragment);
    }

    if (currentCanvases.length > 0) {
      const canvasFragment = document.createDocumentFragment();
      currentCanvases.forEach((canvas) => {
        canvasFragment.appendChild(this.cardsManager.createCardElement(canvas));
      });
      this.gridEl.appendChild(canvasFragment);
    }

    if (this.canvasesManager.hasMoreCanvases()) {
      if (this.sentinelEl) {
        this.sentinelEl.style.display = 'block';
      }
      this.canvasesManager.initScrollObserver();
    } else {
      if (this.sentinelEl) {
        this.sentinelEl.style.display = 'none';
      }
      this.canvasesManager.disconnectScrollObserver();
    }

    translateElement(this.gridEl);
    renderIcons(this.gridEl);
    setupLazyImages(this.gridEl);
  }

  private handleScroll(): void {
    if (this.templatesManager.isShowingEmptyState) {
      this.templatesManager.handleTemplatesScroll();
      return;
    }
    this.canvasesManager.handleScroll();
  }
}

export async function createHomeView(): Promise<HTMLElement> {
  const container = await loadTemplate('/views/home/home.html');
  translateElement(container);

  const controller = new HomeController(container);
  await controller.init();
  (container as any).__controller = controller;

  return container;
}
