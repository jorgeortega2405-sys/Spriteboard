import { navigate } from '../app-router.js';
import { openModal } from '../components/modal.component.js';
import { openUpgradeModal } from '../components/upgrade-modal.component.js';
import { API_ROUTES } from '../config/api-routes.js';
import { hasFeature } from '../config/plans.config.js';
import { currentUser, escapeHtml, getApi } from '../services/api.service.js';
import { addBrandChartApi, addBrandColorApi, addBrandTemplateApi, createBrandKitApi, deleteBrandAssetApi, deleteBrandChartApi, deleteBrandColorApi, deleteBrandFontApi, deleteBrandKitApi, deleteBrandTemplateApi, duplicateBrandKitApi, getBrandKitDetailApi, getBrandKitsApi, setBrandFontsApi, setDefaultBrandKitApi, updateBrandKitApi, uploadBrandAssetApi } from '../services/brand.service.js';
import { t, translateElement } from '../services/i18n.service.js';
import { renderIcons } from '../services/icon.service.js';
import { loadTemplate } from '../services/template.service.js';
import { showToast } from '../services/toast.service.js';
import { BrandAssetType, BrandColorType, BrandFontRole, BrandKit, BrandKitAsset, BrandKitChart, BrandKitColor, BrandKitDetail, BrandKitFont, BrandKitTemplate, SetBrandFontDto } from '../types/brand.types.js';
import { bindDragToScroll, CarouselController, closeAllDropdowns, initCarouselScroll, registerActiveDropdown, setupDropdown, unregisterActiveDropdown, withButtonLoading } from '../utils/dom.util.js';

const AVAILABLE_GOOGLE_FONTS = [
  'Inter', 'Roboto', 'Montserrat', 'Playfair Display', 'Outfit',
  'Open Sans', 'Lato', 'Poppins', 'Oswald', 'Source Sans Pro',
  'Merriweather', 'Raleway', 'Fira Code', 'Lora', 'Space Grotesk'
];

export class BrandController {
  private abortController: AbortController;
  private activeKit: BrandKitDetail | null = null;
  private activeTab: 'logos' | 'colors' | 'fonts' | 'photos' | 'elements' | 'charts' | 'templates' | 'voice' = 'logos';
  private allKits: BrandKit[] = [];
  private badgesContainer: HTMLElement | null = null;
  private bannerColorError: HTMLElement | null = null;
  private bannerKitError: HTMLElement | null = null;
  private bannerTemplateError: HTMLElement | null = null;
  private btnCancelColor: HTMLElement | null = null;
  private btnCancelKit: HTMLElement | null = null;
  private btnCancelTemplate: HTMLElement | null = null;
  private btnClearSearch: HTMLElement | null = null;
  private btnCreateKit: HTMLElement | null = null;
  private btnKitOptions: HTMLElement | null = null;
  private btnLockedHome: HTMLElement | null = null;
  private btnLockedUpgrade: HTMLElement | null = null;
  private btnOptionDeleteKit: HTMLElement | null = null;
  private btnOptionDuplicateKit: HTMLElement | null = null;
  private btnOptionEditKit: HTMLElement | null = null;
  private btnOptionSetDefault: HTMLElement | null = null;
  private btnPickerCreateKit: HTMLElement | null = null;
  private btnSaveFonts: HTMLElement | null = null;
  private btnSaveVoice: HTMLElement | null = null;
  private btnSubmitColor: HTMLButtonElement | null = null;
  private btnSubmitKit: HTMLButtonElement | null = null;
  private btnSubmitTemplate: HTMLButtonElement | null = null;
  private btnTriggerAddChart: HTMLElement | null = null;
  private btnTriggerAddColor: HTMLElement | null = null;
  private btnTriggerAddTemplate: HTMLElement | null = null;
  private btnTriggerKitPicker: HTMLElement | null = null;
  private btnTriggerUploadElement: HTMLElement | null = null;
  private btnTriggerUploadFont: HTMLElement | null = null;
  private btnTriggerUploadLogo: HTMLElement | null = null;
  private btnTriggerUploadPhoto: HTMLElement | null = null;
  private carouselController: CarouselController | null = null;
  private carouselWrapper: HTMLElement | null = null;
  private cleanupDrag: (() => void) | null = null;
  private container: HTMLElement;
  private containerCustomFonts: HTMLElement | null = null;
  private contentViewEl: HTMLElement | null = null;
  private countCustomFonts: HTMLElement | null = null;
  private dropzoneElements: HTMLElement | null = null;
  private dropzoneLogos: HTMLElement | null = null;
  private dropzonePhotos: HTMLElement | null = null;
  private editingKitUuid: string | null = null;
  private fileInputElement: HTMLInputElement | null = null;
  private fileInputFont: HTMLInputElement | null = null;
  private fileInputLogo: HTMLInputElement | null = null;
  private fileInputPhoto: HTMLInputElement | null = null;
  private formColor: HTMLFormElement | null = null;
  private formKit: HTMLFormElement | null = null;
  private formTemplate: HTMLFormElement | null = null;
  private gridCharts: HTMLElement | null = null;
  private gridElements: HTMLElement | null = null;
  private gridLogos: HTMLElement | null = null;
  private gridPhotos: HTMLElement | null = null;
  private gridTemplates: HTMLElement | null = null;
  private inputColorHex: HTMLInputElement | null = null;
  private inputColorName: HTMLInputElement | null = null;
  private inputColorPalette: HTMLInputElement | null = null;
  private inputKitColor: HTMLInputElement | null = null;
  private inputKitDesc: HTMLInputElement | null = null;
  private inputKitName: HTMLInputElement | null = null;
  private inputTemplateDesc: HTMLInputElement | null = null;
  private inputTemplateName: HTMLInputElement | null = null;
  private kitOptionsBackdrop: HTMLElement | null = null;
  private kitOptionsController: ReturnType<typeof setupDropdown> | null = null;
  private kitPickerContainer: HTMLElement | null = null;
  private kitPickerDropdownBackdrop: HTMLElement | null = null;
  private kitPickerDropdownController: ReturnType<typeof setupDropdown> | null = null;
  private kitPickerList: HTMLElement | null = null;
  private lockedStateEl: HTMLElement | null = null;
  private modalColorBackdrop: HTMLElement | null = null;
  private modalKitBackdrop: HTMLElement | null = null;
  private modalTemplateBackdrop: HTMLElement | null = null;
  private palettesContainer: HTMLElement | null = null;
  private searchInput: HTMLInputElement | null = null;
  private sectionCustomFonts: HTMLElement | null = null;
  private templateCanvasPicker: HTMLElement | null = null;
  private textareaBrandVoice: HTMLTextAreaElement | null = null;
  private activeKitDot: HTMLElement | null = null;
  private activeKitName: HTMLElement | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
    this.abortController = new AbortController();
  }

  public async init(): Promise<void> {
    this.bindDomRefs();
    this.initCarousel();
    this.bindEvents();

    if (!currentUser || !hasFeature('brand_kits', currentUser)) {
      this.showLockedState();
      return;
    }

    this.hideLockedState();
    await this.loadKits();
  }

  public destroy(): void {
    this.abortController.abort();
    this.cleanupDrag?.();
    this.carouselController?.destroy?.();
    this.kitPickerDropdownController?.destroy();
    this.kitOptionsController?.destroy();
    const styleEl = document.head.querySelector('style[data-ref="brand-custom-fonts-style"]');
    styleEl?.remove();
  }

  private initCarousel(): void {
    if (!this.carouselWrapper || !this.badgesContainer) return;

    this.carouselController = initCarouselScroll(this.carouselWrapper, {
      carouselSelector: '[data-ref="brand-categories-badges"]',
      leftBtnSelector: '[data-ref="btn-tags-scroll-left"]',
      rightBtnSelector: '[data-ref="btn-tags-scroll-right"]',
      step: 180,
    });

    this.cleanupDrag = bindDragToScroll(this.badgesContainer);
    this.carouselController?.updateButtons();
  }

  private bindDomRefs(): void {
    this.lockedStateEl = this.container.querySelector<HTMLElement>('[data-ref="brand-locked-state"]');
    this.btnLockedUpgrade = this.container.querySelector<HTMLElement>('[data-ref="btn-locked-upgrade"]');
    this.btnLockedHome = this.container.querySelector<HTMLElement>('[data-ref="btn-locked-home"]');

    this.contentViewEl = this.container.querySelector<HTMLElement>('[data-ref="brand-content-view"]');
    this.kitPickerContainer = this.container.querySelector<HTMLElement>('[data-ref="kit-picker-container"]');
    this.btnTriggerKitPicker = this.container.querySelector<HTMLElement>('[data-ref="btn-trigger-kit-picker"]');
    this.activeKitDot = this.container.querySelector<HTMLElement>('[data-ref="active-kit-dot"]');
    this.activeKitName = this.container.querySelector<HTMLElement>('[data-ref="active-kit-name"]');
    this.kitPickerDropdownBackdrop = this.container.querySelector<HTMLElement>('[data-ref="kit-picker-dropdown-backdrop"]');
    this.kitPickerList = this.container.querySelector<HTMLElement>('[data-ref="kit-picker-list"]');
    this.btnPickerCreateKit = this.container.querySelector<HTMLElement>('[data-ref="btn-picker-create-kit"]');

    this.btnKitOptions = this.container.querySelector<HTMLElement>('[data-ref="btn-kit-options"]');
    this.kitOptionsBackdrop = this.container.querySelector<HTMLElement>('[data-ref="kit-options-backdrop"]');
    this.btnOptionEditKit = this.container.querySelector<HTMLElement>('[data-ref="btn-option-edit-kit"]');
    this.btnOptionDuplicateKit = this.container.querySelector<HTMLElement>('[data-ref="btn-option-duplicate-kit"]');
    this.btnOptionSetDefault = this.container.querySelector<HTMLElement>('[data-ref="btn-option-set-default"]');
    this.btnOptionDeleteKit = this.container.querySelector<HTMLElement>('[data-ref="btn-option-delete-kit"]');
    this.btnCreateKit = this.container.querySelector<HTMLElement>('[data-ref="btn-create-kit"]');

    this.carouselWrapper = this.container.querySelector<HTMLElement>('[data-ref="brand-tags-carousel-wrapper"]');
    this.badgesContainer = this.container.querySelector<HTMLElement>('[data-ref="brand-categories-badges"]');
    this.searchInput = this.container.querySelector<HTMLInputElement>('[data-ref="brand-search-input"]');
    this.btnClearSearch = this.container.querySelector<HTMLElement>('[data-ref="btn-brand-clear-search"]');

    this.gridLogos = this.container.querySelector<HTMLElement>('[data-ref="grid-logos"]');
    this.dropzoneLogos = this.container.querySelector<HTMLElement>('[data-ref="dropzone-logos"]');
    this.btnTriggerUploadLogo = this.container.querySelector<HTMLElement>('[data-ref="btn-trigger-upload-logo"]');
    this.fileInputLogo = this.container.querySelector<HTMLInputElement>('[data-ref="file-input-logo"]');

    this.palettesContainer = this.container.querySelector<HTMLElement>('[data-ref="container-palettes"]');
    this.btnTriggerAddColor = this.container.querySelector<HTMLElement>('[data-ref="btn-trigger-add-color"]');

    this.btnTriggerUploadFont = this.container.querySelector<HTMLElement>('[data-ref="btn-trigger-upload-font"]');
    this.fileInputFont = this.container.querySelector<HTMLInputElement>('[data-ref="file-input-font"]');
    this.sectionCustomFonts = this.container.querySelector<HTMLElement>('[data-ref="section-custom-fonts"]');
    this.containerCustomFonts = this.container.querySelector<HTMLElement>('[data-ref="container-custom-fonts"]');
    this.countCustomFonts = this.container.querySelector<HTMLElement>('[data-ref="count-custom-fonts"]');
    this.btnSaveFonts = this.container.querySelector<HTMLElement>('[data-ref="btn-save-fonts"]');

    this.gridPhotos = this.container.querySelector<HTMLElement>('[data-ref="grid-photos"]');
    this.dropzonePhotos = this.container.querySelector<HTMLElement>('[data-ref="dropzone-photos"]');
    this.btnTriggerUploadPhoto = this.container.querySelector<HTMLElement>('[data-ref="btn-trigger-upload-photo"]');
    this.fileInputPhoto = this.container.querySelector<HTMLInputElement>('[data-ref="file-input-photo"]');

    this.gridElements = this.container.querySelector<HTMLElement>('[data-ref="grid-elements"]');
    this.dropzoneElements = this.container.querySelector<HTMLElement>('[data-ref="dropzone-elements"]');
    this.btnTriggerUploadElement = this.container.querySelector<HTMLElement>('[data-ref="btn-trigger-upload-element"]');
    this.fileInputElement = this.container.querySelector<HTMLInputElement>('[data-ref="file-input-element"]');

    this.gridCharts = this.container.querySelector<HTMLElement>('[data-ref="grid-charts"]');
    this.btnTriggerAddChart = this.container.querySelector<HTMLElement>('[data-ref="btn-trigger-add-chart"]');

    this.gridTemplates = this.container.querySelector<HTMLElement>('[data-ref="grid-templates"]');
    this.btnTriggerAddTemplate = this.container.querySelector<HTMLElement>('[data-ref="btn-trigger-add-template"]');

    this.textareaBrandVoice = this.container.querySelector<HTMLTextAreaElement>('[data-ref="textarea-brand-voice"]');
    this.btnSaveVoice = this.container.querySelector<HTMLElement>('[data-ref="btn-save-voice"]');

    this.modalKitBackdrop = this.container.querySelector<HTMLElement>('[data-ref="modal-kit-backdrop"]');
    this.formKit = this.container.querySelector<HTMLFormElement>('[data-ref="form-kit"]');
    this.inputKitName = this.container.querySelector<HTMLInputElement>('[data-ref="input-kit-name"]');
    this.inputKitDesc = this.container.querySelector<HTMLInputElement>('[data-ref="input-kit-desc"]');
    this.inputKitColor = this.container.querySelector<HTMLInputElement>('[data-ref="input-kit-color"]');
    this.btnCancelKit = this.container.querySelector<HTMLElement>('[data-ref="btn-cancel-kit"]');
    this.btnSubmitKit = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-submit-kit"]');
    this.bannerKitError = this.container.querySelector<HTMLElement>('[data-ref="banner-kit-error"]');

    this.modalColorBackdrop = this.container.querySelector<HTMLElement>('[data-ref="modal-color-backdrop"]');
    this.formColor = this.container.querySelector<HTMLFormElement>('[data-ref="form-color"]');
    this.inputColorName = this.container.querySelector<HTMLInputElement>('[data-ref="input-color-name"]');
    this.inputColorHex = this.container.querySelector<HTMLInputElement>('[data-ref="input-color-hex"]');
    this.inputColorPalette = this.container.querySelector<HTMLInputElement>('[data-ref="input-color-palette"]');
    this.btnCancelColor = this.container.querySelector<HTMLElement>('[data-ref="btn-cancel-color"]');
    this.btnSubmitColor = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-submit-color"]');
    this.bannerColorError = this.container.querySelector<HTMLElement>('[data-ref="banner-color-error"]');

    this.modalTemplateBackdrop = this.container.querySelector<HTMLElement>('[data-ref="modal-template-backdrop"]');
    this.formTemplate = this.container.querySelector<HTMLFormElement>('[data-ref="form-template"]');
    this.inputTemplateName = this.container.querySelector<HTMLInputElement>('[data-ref="input-template-name"]');
    this.inputTemplateDesc = this.container.querySelector<HTMLInputElement>('[data-ref="input-template-desc"]');
    this.templateCanvasPicker = this.container.querySelector<HTMLElement>('[data-ref="template-canvas-picker"]');
    this.btnCancelTemplate = this.container.querySelector<HTMLElement>('[data-ref="btn-cancel-template"]');
    this.btnSubmitTemplate = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-submit-template"]');
    this.bannerTemplateError = this.container.querySelector<HTMLElement>('[data-ref="banner-template-error"]');
  }

  private bindEvents(): void {
    const signal = this.abortController.signal;

    this.btnLockedUpgrade?.addEventListener('click', () => openUpgradeModal('business'), { signal });
    this.btnLockedHome?.addEventListener('click', () => navigate('/'), { signal });

    if (this.btnTriggerKitPicker && this.kitPickerDropdownBackdrop) {
      this.kitPickerDropdownController = setupDropdown(this.btnTriggerKitPicker.parentElement, {
        backdrop: this.kitPickerDropdownBackdrop,
        trigger: this.btnTriggerKitPicker,
      });
    }
    if (this.btnKitOptions && this.kitOptionsBackdrop) {
      this.kitOptionsController = setupDropdown(this.btnKitOptions.parentElement, {
        backdrop: this.kitOptionsBackdrop,
        trigger: this.btnKitOptions,
      });
    }

    this.btnPickerCreateKit?.addEventListener('click', () => {
      this.kitPickerDropdownController?.close();
      this.openKitModal();
    }, { signal });

    this.btnCreateKit?.addEventListener('click', () => this.openKitModal(), { signal });
    this.btnOptionEditKit?.addEventListener('click', () => {
      this.kitOptionsController?.close();
      if (this.activeKit) this.openKitModal(this.activeKit);
    }, { signal });

    this.btnOptionDuplicateKit?.addEventListener('click', async () => {
      this.kitOptionsController?.close();
      if (!this.activeKit) return;
      showToast('Duplicando kit de marca...', 'info');
      const res = await duplicateBrandKitApi(this.activeKit.uuid);
      if (res.success && res.kit) {
        showToast(`Kit «${res.kit.name}» duplicado correctamente`, 'success');
        await this.loadKits(res.kit.uuid);
      } else {
        showToast(res.error || 'No se pudo duplicar el kit de marca.', 'danger');
      }
    }, { signal });

    this.btnOptionSetDefault?.addEventListener('click', async () => {
      this.kitOptionsController?.close();
      if (!this.activeKit) return;
      const res = await setDefaultBrandKitApi(this.activeKit.uuid);
      if (res.success) {
        showToast(`«${this.activeKit.name}» establecido como kit predeterminado`, 'success');
        await this.loadKits(this.activeKit.uuid);
      } else {
        showToast(res.error || 'Error al actualizar kit predeterminado.', 'danger');
      }
    }, { signal });

    this.btnOptionDeleteKit?.addEventListener('click', () => {
      this.kitOptionsController?.close();
      if (!this.activeKit) return;
      const kitToDelete = this.activeKit;
      openModal({
        cancelText: 'Cancelar',
        confirmClass: 'component-button--danger',
        confirmText: 'Eliminar kit',
        description: `¿Estás seguro de que deseas eliminar «${kitToDelete.name}»? Esta acción borrará permanentemente sus logotipos, paletas y configuraciones de marca.`,
        showCancel: true,
        showConfirm: true,
        title: 'Eliminar kit de marca',
        onConfirm: async () => {
          const res = await deleteBrandKitApi(kitToDelete.uuid);
          if (res.success) {
            showToast(`Kit «${kitToDelete.name}» eliminado`, 'success');
            await this.loadKits();
          } else {
            showToast(res.error || 'Error al eliminar kit de marca.', 'danger');
          }
        },
      });
    }, { signal });

    this.searchInput?.addEventListener('input', () => {
      this.btnClearSearch?.style.setProperty('display', this.searchInput?.value ? 'inline-flex' : 'none');
      this.renderActiveTabContent();
    }, { signal });

    this.btnClearSearch?.addEventListener('click', () => {
      if (this.searchInput) this.searchInput.value = '';
      this.btnClearSearch?.style.setProperty('display', 'none');
      this.renderActiveTabContent();
    }, { signal });

    this.container.querySelectorAll<HTMLElement>('.component-badge[data-tab]').forEach((tabBtn) => {
      tabBtn.addEventListener('click', () => {
        const tab = tabBtn.getAttribute('data-tab') as any;
        if (!tab || tab === this.activeTab) return;
        this.activeTab = tab;
        this.container.querySelectorAll('.component-badge[data-tab]').forEach((b) => b.classList.remove('is-active'));
        tabBtn.classList.add('is-active');

        this.container.querySelectorAll('.brand-pane').forEach((p) => p.classList.add('is-hidden'));
        const activePane = this.container.querySelector<HTMLElement>(`[data-ref="pane-${tab}"]`);
        activePane?.classList.remove('is-hidden');
        this.renderActiveTabContent();
      }, { signal });
    });

    this.btnTriggerUploadLogo?.addEventListener('click', () => this.fileInputLogo?.click(), { signal });
    this.dropzoneLogos?.addEventListener('click', () => this.fileInputLogo?.click(), { signal });
    this.fileInputLogo?.addEventListener('change', () => {
      if (this.fileInputLogo?.files && this.fileInputLogo.files[0] && this.activeKit) {
        void this.handleUploadAsset(this.fileInputLogo.files[0], 'logo');
        this.fileInputLogo.value = '';
      }
    }, { signal });

    this.btnTriggerUploadPhoto?.addEventListener('click', () => this.fileInputPhoto?.click(), { signal });
    this.dropzonePhotos?.addEventListener('click', () => this.fileInputPhoto?.click(), { signal });
    this.fileInputPhoto?.addEventListener('change', () => {
      if (this.fileInputPhoto?.files && this.fileInputPhoto.files[0] && this.activeKit) {
        void this.handleUploadAsset(this.fileInputPhoto.files[0], 'photo');
        this.fileInputPhoto.value = '';
      }
    }, { signal });

    this.btnTriggerUploadElement?.addEventListener('click', () => this.fileInputElement?.click(), { signal });
    this.dropzoneElements?.addEventListener('click', () => this.fileInputElement?.click(), { signal });
    this.fileInputElement?.addEventListener('change', () => {
      if (this.fileInputElement?.files && this.fileInputElement.files[0] && this.activeKit) {
        void this.handleUploadAsset(this.fileInputElement.files[0], 'element');
        this.fileInputElement.value = '';
      }
    }, { signal });

    this.btnTriggerUploadFont?.addEventListener('click', () => this.fileInputFont?.click(), { signal });
    this.fileInputFont?.addEventListener('change', () => {
      if (this.fileInputFont?.files && this.fileInputFont.files[0] && this.activeKit) {
        void this.handleUploadFont(this.fileInputFont.files[0]);
        this.fileInputFont.value = '';
      }
    }, { signal });

    this.btnTriggerAddColor?.addEventListener('click', () => this.openColorModal(), { signal });
    this.btnTriggerAddChart?.addEventListener('click', () => this.handleAddChartPreset(), { signal });
    this.btnTriggerAddTemplate?.addEventListener('click', () => this.openTemplateModal(), { signal });

    this.btnSaveFonts?.addEventListener('click', () => this.handleSaveFonts(), { signal });
    this.btnSaveVoice?.addEventListener('click', () => this.handleSaveVoice(), { signal });

    this.btnCancelKit?.addEventListener('click', () => this.closeKitModal(), { signal });
    this.container.querySelector('[data-ref="btn-close-kit-modal"]')?.addEventListener('click', () => this.closeKitModal(), { signal });
    this.formKit?.addEventListener('submit', (e) => this.handleKitSubmit(e), { signal });

    this.btnCancelColor?.addEventListener('click', () => this.closeColorModal(), { signal });
    this.container.querySelector('[data-ref="btn-close-color-modal"]')?.addEventListener('click', () => this.closeColorModal(), { signal });
    this.formColor?.addEventListener('submit', (e) => this.handleColorSubmit(e), { signal });

    this.btnCancelTemplate?.addEventListener('click', () => this.closeTemplateModal(), { signal });
    this.container.querySelector('[data-ref="btn-close-template-modal"]')?.addEventListener('click', () => this.closeTemplateModal(), { signal });
    this.formTemplate?.addEventListener('submit', (e) => this.handleTemplateSubmit(e), { signal });
  }

  private showLockedState(): void {
    this.lockedStateEl?.classList.remove('is-hidden');
    if (this.contentViewEl) this.contentViewEl.style.display = 'none';
    if (this.kitPickerContainer) this.kitPickerContainer.style.display = 'none';
  }

  private hideLockedState(): void {
    this.lockedStateEl?.classList.add('is-hidden');
    if (this.contentViewEl) this.contentViewEl.style.display = 'block';
    if (this.kitPickerContainer) this.kitPickerContainer.style.display = 'block';
  }

  private async loadKits(targetUuid?: string): Promise<void> {
    const res = await getBrandKitsApi();
    if (!res.success) {
      showToast(res.error || 'Error al obtener kits de marca.', 'danger');
      return;
    }

    this.allKits = res.kits || [];

    if (this.allKits.length === 0) {
      const createRes = await createBrandKitApi({ name: 'Mi Marca Principal' });
      if (createRes.success && createRes.kit) {
        this.allKits = [createRes.kit];
        this.activeKit = createRes.kit;
      }
    }

    if (this.allKits.length > 0) {
      let current = targetUuid ? this.allKits.find((k) => k.uuid === targetUuid) : null;
      if (!current) {
        current = this.allKits.find((k) => k.is_default) || this.allKits[0];
      }
      if (current) {
        const detailRes = await getBrandKitDetailApi(current.uuid);
        if (detailRes.success && detailRes.kit) {
          this.activeKit = detailRes.kit;
          this.injectCustomFontFace();
        }
      }
    }

    this.renderKitPicker();
    this.renderActiveTabContent();
    renderIcons(this.container);
  }

  private renderKitPicker(): void {
    if (!this.activeKit) return;
    if (this.activeKitDot) this.activeKitDot.style.backgroundColor = this.activeKit.color;
    if (this.activeKitName) this.activeKitName.textContent = this.activeKit.name;

    if (!this.kitPickerList) return;
    this.kitPickerList.innerHTML = this.allKits.map((k) => `
      <button type="button" class="menu-item${k.uuid === this.activeKit?.uuid ? ' is-active' : ''}" data-ref="btn-select-kit-${k.uuid}" data-kit-uuid="${k.uuid}">
        <span style="width: 8px; height: 8px; border-radius: 50%; background-color: ${escapeHtml(k.color)}; margin-right: 8px; flex-shrink: 0;"></span>
        <span class="menu-item__text" style="flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(k.name)}</span>
        ${k.is_default ? '<span style="font-size: 10px; font-weight: 700; text-transform: uppercase; padding: 2px 6px; border-radius: 4px; background-color: rgba(99, 102, 241, 0.12); color: var(--color-brand); margin-left: 6px;">Predeterminado</span>' : ''}
      </button>
    `).join('');

    this.kitPickerList.querySelectorAll<HTMLElement>('[data-kit-uuid]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const uuid = btn.getAttribute('data-kit-uuid');
        if (!uuid || uuid === this.activeKit?.uuid) return;
        this.kitPickerDropdownController?.close();
        showToast('Cargando kit de marca...', 'info');
        const detailRes = await getBrandKitDetailApi(uuid);
        if (detailRes.success && detailRes.kit) {
          this.activeKit = detailRes.kit;
          this.injectCustomFontFace();
          this.renderKitPicker();
          this.renderActiveTabContent();
          renderIcons(this.container);
        }
      });
    });
  }

  private renderActiveTabContent(): void {
    if (!this.activeKit) return;

    this.updateTabCounters();

    const q = this.searchInput?.value.trim().toLowerCase() || '';

    switch (this.activeTab) {
      case 'logos':
        this.renderLogosTab(q);
        break;
      case 'colors':
        this.renderColorsTab(q);
        break;
      case 'fonts':
        this.renderFontsTab();
        break;
      case 'photos':
        this.renderPhotosTab(q);
        break;
      case 'elements':
        this.renderElementsTab(q);
        break;
      case 'charts':
        this.renderChartsTab(q);
        break;
      case 'templates':
        this.renderTemplatesTab(q);
        break;
      case 'voice':
        this.renderVoiceTab();
        break;
    }
  }

  private updateTabCounters(): void {
    if (!this.activeKit) return;
    const setCounter = (ref: string, val: number) => {
      const el = this.container.querySelector<HTMLElement>(`[data-ref="${ref}"]`);
      if (el) el.textContent = String(val);
    };
    setCounter('count-logos', this.activeKit.logos.length);
    setCounter('count-colors', this.activeKit.colors.length);
    setCounter('count-fonts', this.activeKit.fonts.length + (this.activeKit.custom_fonts?.length || 0));
    setCounter('count-photos', this.activeKit.photos.length);
    setCounter('count-elements', this.activeKit.elements.length);
    setCounter('count-charts', this.activeKit.charts.length);
    setCounter('count-templates', this.activeKit.templates.length);
  }

  private renderLogosTab(query = ''): void {
    if (!this.gridLogos || !this.activeKit) return;
    const filtered = query
      ? this.activeKit.logos.filter((l) => l.name.toLowerCase().includes(query))
      : this.activeKit.logos;

    if (filtered.length === 0) {
      this.gridLogos.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 32px 0; color: var(--text-tertiary);">
          <span style="font-size: 14px; font-weight: 500;">No hay logotipos subidos en este kit.</span>
        </div>
      `;
      return;
    }

    this.gridLogos.innerHTML = filtered.map((logo) => `
      <div class="brand-card" data-ref="card-logo-${logo.uuid}">
        <div class="brand-card__preview brand-card__preview--checkerboard">
          <img class="brand-card__img" src="${escapeHtml(logo.url)}" alt="${escapeHtml(logo.name)}" loading="lazy" />
          <button type="button" class="brand-card__delete" data-ref="btn-del-asset-${logo.uuid}" data-asset-uuid="${logo.uuid}" data-tooltip="Eliminar logotipo" aria-label="Eliminar logotipo">
            <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#delete"></use></svg>
          </button>
        </div>
        <div class="brand-card__footer">
          <span class="brand-card__name" title="${escapeHtml(logo.name)}">${escapeHtml(logo.name)}</span>
          <span class="brand-card__tag">${escapeHtml(logo.category)}</span>
        </div>
      </div>
    `).join('');

    this.bindAssetDeleteButtons(this.gridLogos);
    renderIcons(this.gridLogos);
  }

  private renderColorsTab(query = ''): void {
    if (!this.palettesContainer || !this.activeKit) return;

    const palettesMap = new Map<string, BrandKitColor[]>();
    for (const c of this.activeKit.colors) {
      if (query && !c.name.toLowerCase().includes(query) && !c.hex.toLowerCase().includes(query)) {
        continue;
      }
      const list = palettesMap.get(c.palette_name) || [];
      list.push(c);
      palettesMap.set(c.palette_name, list);
    }

    if (palettesMap.size === 0) {
      this.palettesContainer.innerHTML = `
        <div style="text-align: center; padding: 32px 0; color: var(--text-tertiary);">
          <span style="font-size: 14px; font-weight: 500;">No hay colores configurados.</span>
        </div>
      `;
      return;
    }

    let html = '';
    for (const [pName, colors] of palettesMap.entries()) {
      html += `
        <div class="brand-palette-box">
          <div class="brand-palette-header">
            <span class="brand-palette-title">${escapeHtml(pName)}</span>
          </div>
          <div class="brand-palette-swatches">
            ${colors.map((c) => `
              <div class="brand-swatch" data-ref="swatch-${c.uuid}" data-hex="${escapeHtml(c.hex)}" data-tooltip="Clic para copiar ${escapeHtml(c.hex)}">
                <div class="brand-swatch__circle" style="background-color: ${escapeHtml(c.hex)};">
                  <button type="button" class="brand-swatch__delete" data-ref="btn-del-color-${c.uuid}" data-color-uuid="${c.uuid}" aria-label="Eliminar color">×</button>
                </div>
                <span class="brand-swatch__hex">${escapeHtml(c.hex)}</span>
                <span class="brand-swatch__name" title="${escapeHtml(c.name)}">${escapeHtml(c.name)}</span>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }

    this.palettesContainer.innerHTML = html;

    this.palettesContainer.querySelectorAll<HTMLElement>('.brand-swatch').forEach((swatch) => {
      swatch.addEventListener('click', (e) => {
        const target = e.target as HTMLElement | null;
        if (target?.closest('[data-color-uuid]')) return;
        const hex = swatch.getAttribute('data-hex');
        if (hex) {
          navigator.clipboard.writeText(hex).catch(() => {});
          showToast(`Color ${hex} copiado al portapapeles`, 'success');
        }
      });
    });

    this.palettesContainer.querySelectorAll<HTMLButtonElement>('[data-color-uuid]').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (!this.activeKit) return;
        const colorUuid = btn.getAttribute('data-color-uuid');
        if (!colorUuid) return;
        const res = await deleteBrandColorApi(this.activeKit.uuid, colorUuid);
        if (res.success) {
          showToast('Color eliminado', 'success');
          this.activeKit.colors = this.activeKit.colors.filter((c) => c.uuid !== colorUuid);
          this.renderColorsTab(this.searchInput?.value || '');
          this.updateTabCounters();
        }
      });
    });
  }

  private renderFontsTab(): void {
    const container = this.container.querySelector<HTMLElement>('[data-ref="container-fonts"]');
    if (!this.activeKit) return;

    if (this.sectionCustomFonts && this.containerCustomFonts && this.countCustomFonts) {
      const customFonts = this.activeKit.custom_fonts || [];
      this.countCustomFonts.textContent = String(customFonts.length);

      if (customFonts.length === 0) {
        this.sectionCustomFonts.classList.add('is-hidden');
      } else {
        this.sectionCustomFonts.classList.remove('is-hidden');
        this.containerCustomFonts.innerHTML = customFonts.map((cf) => {
          const ext = (cf.file_path.split('.').pop() || 'FONT').toUpperCase();
          return `
            <div class="brand-custom-font-card" data-ref="card-custom-font-${cf.uuid}">
              <div class="brand-custom-font-card__info">
                <svg class="component-icon brand-custom-font-card__icon" aria-hidden="true"><use href="/icons.svg#text_fields"></use></svg>
                <span class="brand-custom-font-card__name" style="font-family: '${escapeHtml(cf.name)}', sans-serif;" title="${escapeHtml(cf.name)}">${escapeHtml(cf.name)}</span>
                <span class="brand-custom-font-card__badge">${escapeHtml(ext)}</span>
              </div>
              <button type="button" class="brand-custom-font-card__delete" data-ref="btn-del-custom-font-${cf.uuid}" data-font-uuid="${cf.uuid}" data-tooltip="Eliminar fuente" aria-label="Eliminar fuente">
                <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#delete"></use></svg>
              </button>
            </div>
          `;
        }).join('');

        this.containerCustomFonts.querySelectorAll<HTMLButtonElement>('[data-font-uuid]').forEach((btn) => {
          btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const fontUuid = btn.getAttribute('data-font-uuid');
            if (fontUuid) void this.handleDeleteCustomFont(fontUuid);
          });
        });
      }
    }

    if (!container) return;

    const roleConfigs: Array<{
      defaultFamily: string;
      defaultFontSize: number;
      defaultStyle: string;
      defaultWeight: string;
      label: string;
      role: BrandFontRole;
      sampleText: string;
    }> = [
      {
        defaultFamily: 'Inter',
        defaultFontSize: 48,
        defaultStyle: 'normal',
        defaultWeight: '700',
        label: 'Título',
        role: 'title',
        sampleText: 'Título',
      },
      {
        defaultFamily: 'Inter',
        defaultFontSize: 28,
        defaultStyle: 'normal',
        defaultWeight: '600',
        label: 'Subtítulo',
        role: 'subtitle',
        sampleText: 'Subtítulo',
      },
      {
        defaultFamily: 'Inter',
        defaultFontSize: 20,
        defaultStyle: 'normal',
        defaultWeight: '600',
        label: 'Título de la sección',
        role: 'heading_2',
        sampleText: 'Título de la sección',
      },
      {
        defaultFamily: 'Inter',
        defaultFontSize: 14,
        defaultStyle: 'normal',
        defaultWeight: '400',
        label: 'Cuerpo',
        role: 'body',
        sampleText: 'Cuerpo',
      },
      {
        defaultFamily: 'Inter',
        defaultFontSize: 18,
        defaultStyle: 'italic',
        defaultWeight: '400',
        label: 'Cita',
        role: 'quote',
        sampleText: 'Cita',
      },
      {
        defaultFamily: 'Inter',
        defaultFontSize: 11,
        defaultStyle: 'normal',
        defaultWeight: '400',
        label: 'Pie de foto',
        role: 'caption',
        sampleText: 'Pie de foto',
      },
    ];

    const customFonts = this.activeKit.custom_fonts || [];

    container.innerHTML = roleConfigs.map((cfg) => {
      const existing = this.activeKit?.fonts.find((f) => f.role === cfg.role);
      const activeFamily = existing?.font_family || cfg.defaultFamily;
      const activeSize = existing?.font_size || cfg.defaultFontSize;
      const activeWeight = existing?.font_weight || cfg.defaultWeight;
      const activeStyle = existing?.font_style || cfg.defaultStyle;
      const isBold = activeWeight === '700' || activeWeight === '800' || activeWeight === 'bold';
      const isItalic = activeStyle === 'italic';

      return `
        <div class="brand-font-row" data-ref="row-font-${cfg.role}" data-role="${cfg.role}">
          <div class="brand-font-row__left">
            <span class="brand-font-row__role-label">${escapeHtml(cfg.label)}</span>
            <div class="brand-font-row__preview" data-ref="preview-font-${cfg.role}" contenteditable="true" style="font-family: '${escapeHtml(activeFamily)}', sans-serif; font-size: ${activeSize}px; font-weight: ${escapeHtml(activeWeight)}; font-style: ${escapeHtml(activeStyle)};">
              ${escapeHtml(cfg.sampleText)}
            </div>
          </div>
          <div class="brand-font-row__controls">
            <select class="brand-font-select" data-ref="select-font-family-${cfg.role}">
              ${customFonts.length > 0 ? `
                <optgroup label="Fuentes de tu marca">
                  ${customFonts.map((cf) => `<option value="${escapeHtml(cf.name)}"${cf.name === activeFamily ? ' selected' : ''}>${escapeHtml(cf.name)}</option>`).join('')}
                </optgroup>
              ` : ''}
              <optgroup label="Fuentes populares">
                ${AVAILABLE_GOOGLE_FONTS.map((gf) => `<option value="${gf}"${gf === activeFamily ? ' selected' : ''}>${gf}</option>`).join('')}
              </optgroup>
            </select>

            <div class="brand-font-size-wrapper">
              <input class="brand-font-size-input" data-ref="input-font-size-${cfg.role}" type="number" min="8" max="140" value="${activeSize}" />
              <span class="brand-font-size-unit">px</span>
            </div>

            <button type="button" class="brand-font-toggle-btn${isBold ? ' is-active' : ''}" data-ref="btn-bold-${cfg.role}" data-tooltip="Negrita" aria-label="Negrita">B</button>
            <button type="button" class="brand-font-toggle-btn${isItalic ? ' is-active' : ''}" data-ref="btn-italic-${cfg.role}" data-tooltip="Cursiva" aria-label="Cursiva" style="font-style: italic; font-family: serif;">I</button>
            <button type="button" class="brand-font-action-btn" data-ref="btn-delete-font-${cfg.role}" data-font-uuid="${existing?.uuid || ''}" data-role="${cfg.role}" data-tooltip="Restablecer estilo" aria-label="Restablecer estilo">
              <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#delete"></use></svg>
            </button>
          </div>
        </div>
      `;
    }).join('');

    roleConfigs.forEach((cfg) => {
      const row = container.querySelector<HTMLElement>(`[data-ref="row-font-${cfg.role}"]`);
      if (!row) return;

      const selFamily = row.querySelector<HTMLSelectElement>(`[data-ref="select-font-family-${cfg.role}"]`);
      const inputSize = row.querySelector<HTMLInputElement>(`[data-ref="input-font-size-${cfg.role}"]`);
      const btnBold = row.querySelector<HTMLButtonElement>(`[data-ref="btn-bold-${cfg.role}"]`);
      const btnItalic = row.querySelector<HTMLButtonElement>(`[data-ref="btn-italic-${cfg.role}"]`);
      const btnDelete = row.querySelector<HTMLButtonElement>(`[data-ref="btn-delete-font-${cfg.role}"]`);
      const preview = row.querySelector<HTMLElement>(`[data-ref="preview-font-${cfg.role}"]`);

      const updateRowPreview = () => {
        if (!preview || !selFamily || !inputSize) return;
        const fontName = selFamily.value;
        const sizeVal = parseInt(inputSize.value, 10) || cfg.defaultFontSize;
        const boldVal = btnBold?.classList.contains('is-active') ? '700' : '400';
        const italicVal = btnItalic?.classList.contains('is-active') ? 'italic' : 'normal';

        preview.style.fontFamily = `'${fontName}', sans-serif`;
        preview.style.fontSize = `${sizeVal}px`;
        preview.style.fontWeight = boldVal;
        preview.style.fontStyle = italicVal;
      };

      selFamily?.addEventListener('change', updateRowPreview);
      inputSize?.addEventListener('input', updateRowPreview);

      btnBold?.addEventListener('click', () => {
        btnBold.classList.toggle('is-active');
        updateRowPreview();
      });

      btnItalic?.addEventListener('click', () => {
        btnItalic.classList.toggle('is-active');
        updateRowPreview();
      });

      btnDelete?.addEventListener('click', async () => {
        const fontUuid = btnDelete.getAttribute('data-font-uuid');
        if (fontUuid && this.activeKit) {
          await deleteBrandFontApi(this.activeKit.uuid, fontUuid);
          this.activeKit.fonts = this.activeKit.fonts.filter((f) => f.uuid !== fontUuid);
        }
        if (selFamily) selFamily.value = cfg.defaultFamily;
        if (inputSize) inputSize.value = String(cfg.defaultFontSize);
        if (btnBold) {
          if (cfg.defaultWeight === '700' || cfg.defaultWeight === '600') btnBold.classList.add('is-active');
          else btnBold.classList.remove('is-active');
        }
        if (btnItalic) {
          if (cfg.defaultStyle === 'italic') btnItalic.classList.add('is-active');
          else btnItalic.classList.remove('is-active');
        }
        updateRowPreview();
        showToast(`Estilo «${cfg.label}» restablecido`, 'info');
      });
    });

    renderIcons(this.container);
  }

  private renderPhotosTab(query = ''): void {
    if (!this.gridPhotos || !this.activeKit) return;
    const filtered = query
      ? this.activeKit.photos.filter((p) => p.name.toLowerCase().includes(query))
      : this.activeKit.photos;

    if (filtered.length === 0) {
      this.gridPhotos.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 32px 0; color: var(--text-tertiary);">
          <span style="font-size: 14px; font-weight: 500;">No hay fotografías guardadas en este kit.</span>
        </div>
      `;
      return;
    }

    this.gridPhotos.innerHTML = filtered.map((photo) => `
      <div class="brand-card" data-ref="card-photo-${photo.uuid}">
        <div class="brand-card__preview">
          <img class="brand-card__img" src="${escapeHtml(photo.url)}" alt="${escapeHtml(photo.name)}" loading="lazy" style="object-fit: cover; width: 100%; height: 100%; max-width: 100%; max-height: 100%;" />
          <button type="button" class="brand-card__delete" data-ref="btn-del-asset-${photo.uuid}" data-asset-uuid="${photo.uuid}" data-tooltip="Eliminar fotografía" aria-label="Eliminar fotografía">
            <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#delete"></use></svg>
          </button>
        </div>
        <div class="brand-card__footer">
          <span class="brand-card__name" title="${escapeHtml(photo.name)}">${escapeHtml(photo.name)}</span>
          <span class="brand-card__tag">${photo.width && photo.height ? `${photo.width}×${photo.height}` : 'Foto'}</span>
        </div>
      </div>
    `).join('');

    this.bindAssetDeleteButtons(this.gridPhotos);
    renderIcons(this.gridPhotos);
  }

  private renderElementsTab(query = ''): void {
    if (!this.gridElements || !this.activeKit) return;
    const filtered = query
      ? this.activeKit.elements.filter((e) => e.name.toLowerCase().includes(query))
      : this.activeKit.elements;

    if (filtered.length === 0) {
      this.gridElements.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 32px 0; color: var(--text-tertiary);">
          <span style="font-size: 14px; font-weight: 500;">No hay elementos gráficos o iconos en este kit.</span>
        </div>
      `;
      return;
    }

    this.gridElements.innerHTML = filtered.map((el) => `
      <div class="brand-card" data-ref="card-element-${el.uuid}">
        <div class="brand-card__preview brand-card__preview--checkerboard">
          <img class="brand-card__img" src="${escapeHtml(el.url)}" alt="${escapeHtml(el.name)}" loading="lazy" />
          <button type="button" class="brand-card__delete" data-ref="btn-del-asset-${el.uuid}" data-asset-uuid="${el.uuid}" data-tooltip="Eliminar elemento" aria-label="Eliminar elemento">
            <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#delete"></use></svg>
          </button>
        </div>
        <div class="brand-card__footer">
          <span class="brand-card__name" title="${escapeHtml(el.name)}">${escapeHtml(el.name)}</span>
          <span class="brand-card__tag">${escapeHtml(el.category)}</span>
        </div>
      </div>
    `).join('');

    this.bindAssetDeleteButtons(this.gridElements);
    renderIcons(this.gridElements);
  }

  private renderChartsTab(query = ''): void {
    if (!this.gridCharts || !this.activeKit) return;
    const filtered = query
      ? this.activeKit.charts.filter((c) => c.name.toLowerCase().includes(query))
      : this.activeKit.charts;

    if (filtered.length === 0) {
      this.gridCharts.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 32px 0; color: var(--text-tertiary);">
          <span style="font-size: 14px; font-weight: 500;">No hay estilos de gráfica configurados.</span>
        </div>
      `;
      return;
    }

    this.gridCharts.innerHTML = filtered.map((chart) => {
      const palette = chart.palette || ['#6366f1', '#8b5cf6', '#ec4899', '#3b82f6'];
      return `
        <div class="brand-chart-card" data-ref="card-chart-${chart.uuid}">
          <div style="display: flex; align-items: center; justify-content: space-between;">
            <span style="font-size: 14px; font-weight: 600; color: var(--text-primary);">${escapeHtml(chart.name)}</span>
            <button type="button" class="component-button component-button--h32 component-button--icon-only component-button--danger" data-ref="btn-del-chart-${chart.uuid}" data-chart-uuid="${chart.uuid}" data-tooltip="Eliminar gráfica" aria-label="Eliminar gráfica">
              <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#delete"></use></svg>
            </button>
          </div>
          <div class="brand-chart-card__preview">
            <div style="display: flex; align-items: flex-end; gap: 8px; height: 120px; width: 80%;">
              ${palette.slice(0, 5).map((color, idx) => {
                const heights = [40, 75, 95, 60, 85];
                return `<div style="flex: 1; height: ${heights[idx % heights.length]}%; background-color: ${escapeHtml(color)}; border-radius: 4px;"></div>`;
              }).join('')}
            </div>
          </div>
          <div style="display: flex; align-items: center; gap: 4px;">
            ${palette.map((c) => `<span style="width: 14px; height: 14px; border-radius: 3px; background-color: ${escapeHtml(c)};"></span>`).join('')}
          </div>
        </div>
      `;
    }).join('');

    this.gridCharts.querySelectorAll<HTMLButtonElement>('[data-chart-uuid]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (!this.activeKit) return;
        const chartUuid = btn.getAttribute('data-chart-uuid');
        if (!chartUuid) return;
        const res = await deleteBrandChartApi(this.activeKit.uuid, chartUuid);
        if (res.success) {
          showToast('Estilo de gráfica eliminado', 'success');
          this.activeKit.charts = this.activeKit.charts.filter((c) => c.uuid !== chartUuid);
          this.renderChartsTab(this.searchInput?.value || '');
          this.updateTabCounters();
        }
      });
    });

    renderIcons(this.gridCharts);
  }

  private renderTemplatesTab(query = ''): void {
    if (!this.gridTemplates || !this.activeKit) return;
    const filtered = query
      ? this.activeKit.templates.filter((t) => t.name.toLowerCase().includes(query))
      : this.activeKit.templates;

    if (filtered.length === 0) {
      this.gridTemplates.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 32px 0; color: var(--text-tertiary);">
          <span style="font-size: 14px; font-weight: 500;">No hay plantillas oficiales vinculadas a este kit.</span>
        </div>
      `;
      return;
    }

    this.gridTemplates.innerHTML = filtered.map((tpl) => `
      <div class="brand-card" data-ref="card-template-${tpl.uuid}">
        <div class="brand-card__preview">
          ${tpl.preview_thumbnail ? `<img class="brand-card__img" src="${escapeHtml(tpl.preview_thumbnail)}" alt="${escapeHtml(tpl.name)}" loading="lazy" style="width: 100%; height: 100%; object-fit: cover;" />` : `<svg class="component-icon" style="font-size: 40px; color: var(--text-tertiary);" aria-hidden="true"><use href="/icons.svg#space_dashboard"></use></svg>`}
          <button type="button" class="brand-card__delete" data-ref="btn-del-template-${tpl.uuid}" data-template-uuid="${tpl.uuid}" data-tooltip="Eliminar plantilla" aria-label="Eliminar plantilla">
            <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#delete"></use></svg>
          </button>
        </div>
        <div class="brand-card__footer">
          <span class="brand-card__name" title="${escapeHtml(tpl.name)}">${escapeHtml(tpl.name)}</span>
          <button type="button" class="component-button component-button--h32 component-button--primary" data-ref="btn-use-tpl-${tpl.uuid}" data-tpl-canvas-id="${tpl.canvas_id || ''}">
            <span>Usar</span>
          </button>
        </div>
      </div>
    `).join('');

    this.gridTemplates.querySelectorAll<HTMLButtonElement>('[data-template-uuid]').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (!this.activeKit) return;
        const tplUuid = btn.getAttribute('data-template-uuid');
        if (!tplUuid) return;
        const res = await deleteBrandTemplateApi(this.activeKit.uuid, tplUuid);
        if (res.success) {
          showToast('Plantilla desvinculada', 'success');
          this.activeKit.templates = this.activeKit.templates.filter((t) => t.uuid !== tplUuid);
          this.renderTemplatesTab(this.searchInput?.value || '');
          this.updateTabCounters();
        }
      });
    });

    renderIcons(this.gridTemplates);
  }

  private renderVoiceTab(): void {
    if (!this.textareaBrandVoice || !this.activeKit) return;
    this.textareaBrandVoice.value = this.activeKit.brand_voice || '';
  }

  private bindAssetDeleteButtons(parentEl: HTMLElement): void {
    parentEl.querySelectorAll<HTMLButtonElement>('[data-asset-uuid]').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (!this.activeKit) return;
        const assetUuid = btn.getAttribute('data-asset-uuid');
        if (!assetUuid) return;
        const res = await deleteBrandAssetApi(this.activeKit.uuid, assetUuid);
        if (res.success) {
          showToast('Recurso eliminado', 'success');
          this.activeKit.logos = this.activeKit.logos.filter((a) => a.uuid !== assetUuid);
          this.activeKit.photos = this.activeKit.photos.filter((a) => a.uuid !== assetUuid);
          this.activeKit.elements = this.activeKit.elements.filter((a) => a.uuid !== assetUuid);
          this.renderActiveTabContent();
        }
      });
    });
  }

  private async handleUploadAsset(file: File, assetType: BrandAssetType): Promise<void> {
    if (!this.activeKit) return;
    showToast('Subiendo archivo al kit de marca...', 'info');
    const res = await uploadBrandAssetApi(this.activeKit.uuid, file, assetType);
    if (res.success && res.asset) {
      showToast('Recurso añadido al kit de marca', 'success');
      if (assetType === 'logo') this.activeKit.logos.unshift(res.asset);
      else if (assetType === 'photo') this.activeKit.photos.unshift(res.asset);
      else this.activeKit.elements.unshift(res.asset);
      this.renderActiveTabContent();
    } else {
      showToast(res.error || 'No se pudo subir el archivo.', 'danger');
    }
  }

  private injectCustomFontFace(): void {
    let styleEl = document.head.querySelector<HTMLStyleElement>('style[data-ref="brand-custom-fonts-style"]');
    if (!this.activeKit?.custom_fonts || this.activeKit.custom_fonts.length === 0) {
      if (styleEl) styleEl.textContent = '';
      return;
    }

    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.setAttribute('data-ref', 'brand-custom-fonts-style');
      document.head.appendChild(styleEl);
    }

    const rules = this.activeKit.custom_fonts.map((f) => {
      const ext = (f.file_path.split('.').pop() || '').toLowerCase();
      let format = 'woff2';
      if (ext === 'woff') format = 'woff';
      else if (ext === 'ttf') format = 'truetype';
      else if (ext === 'otf') format = 'opentype';
      else if (ext === 'eot') format = 'embedded-opentype';

      return `@font-face {
  font-family: '${escapeHtml(f.name)}';
  src: url('${escapeHtml(f.url)}') format('${format}');
  font-display: swap;
}`;
    }).join('\n');

    styleEl.textContent = rules;
  }

  private async handleUploadFont(file: File): Promise<void> {
    if (!this.activeKit) return;
    showToast('Subiendo tipografía...', 'info');
    const cleanFontName = file.name.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ');
    const res = await uploadBrandAssetApi(this.activeKit.uuid, file, 'font', 'fonts', cleanFontName);
    if (res.success && res.asset) {
      showToast('Tipografía añadida al kit de marca', 'success');
      this.activeKit.custom_fonts.unshift(res.asset);
      this.injectCustomFontFace();
      this.renderFontsTab();
      this.updateTabCounters();
    } else {
      showToast(res.error || 'No se pudo subir la tipografía.', 'danger');
    }
  }

  private async handleDeleteCustomFont(fontUuid: string): Promise<void> {
    if (!this.activeKit) return;
    const res = await deleteBrandAssetApi(this.activeKit.uuid, fontUuid);
    if (res.success) {
      showToast('Tipografía eliminada', 'success');
      this.activeKit.custom_fonts = this.activeKit.custom_fonts.filter((f) => f.uuid !== fontUuid);
      this.injectCustomFontFace();
      this.renderFontsTab();
      this.updateTabCounters();
    } else {
      showToast(res.error || 'Error al eliminar tipografía.', 'danger');
    }
  }

  private async handleSaveFonts(): Promise<void> {
    if (!this.activeKit) return;
    const container = this.container.querySelector<HTMLElement>('[data-ref="container-fonts"]');
    if (!container) return;

    const roles: BrandFontRole[] = ['title', 'subtitle', 'heading_2', 'body', 'quote', 'caption'];
    const dtos: SetBrandFontDto[] = [];

    for (const role of roles) {
      const selFamily = container.querySelector<HTMLSelectElement>(`[data-ref="select-font-family-${role}"]`);
      const inputSize = container.querySelector<HTMLInputElement>(`[data-ref="input-font-size-${role}"]`);
      const btnBold = container.querySelector<HTMLButtonElement>(`[data-ref="btn-bold-${role}"]`);
      const btnItalic = container.querySelector<HTMLButtonElement>(`[data-ref="btn-italic-${role}"]`);

      if (selFamily) {
        const isBold = btnBold?.classList.contains('is-active');
        const isItalic = btnItalic?.classList.contains('is-active');
        const fontSize = inputSize ? parseInt(inputSize.value, 10) : undefined;

        dtos.push({
          font_family: selFamily.value,
          font_size: fontSize || undefined,
          font_style: isItalic ? 'italic' : 'normal',
          font_weight: isBold ? '700' : '400',
          role,
        });
      }
    }

    if (this.btnSaveFonts) {
      await withButtonLoading(this.btnSaveFonts, 'Guardando...', async () => {
        const res = await setBrandFontsApi(this.activeKit!.uuid, dtos);
        if (res.success && res.fonts) {
          this.activeKit!.fonts = res.fonts;
          showToast('Tipografías de marca guardadas correctamente', 'success');
        } else {
          showToast(res.error || 'Error al guardar tipografías.', 'danger');
        }
      });
    }
  }

  private async handleSaveVoice(): Promise<void> {
    if (!this.activeKit || !this.textareaBrandVoice) return;
    const voiceText = this.textareaBrandVoice.value.trim();

    if (this.btnSaveVoice) {
      await withButtonLoading(this.btnSaveVoice, 'Guardando...', async () => {
        const res = await updateBrandKitApi(this.activeKit!.uuid, { brand_voice: voiceText });
        if (res.success && res.kit) {
          this.activeKit = res.kit;
          showToast('Pautas y voz de marca guardadas', 'success');
        } else {
          showToast(res.error || 'Error al guardar pautas.', 'danger');
        }
      });
    }
  }

  private openKitModal(kitToEdit?: BrandKit): void {
    if (!this.modalKitBackdrop || !this.formKit) return;
    this.editingKitUuid = kitToEdit ? kitToEdit.uuid : null;
    const modalTitle = this.container.querySelector<HTMLElement>('[data-ref="modal-kit-title"]');
    if (modalTitle) {
      modalTitle.textContent = kitToEdit ? 'Editar kit de marca' : 'Nuevo kit de marca';
    }

    if (this.inputKitName) this.inputKitName.value = kitToEdit ? kitToEdit.name : '';
    if (this.inputKitDesc) this.inputKitDesc.value = kitToEdit?.description || '';
    if (this.inputKitColor) this.inputKitColor.value = kitToEdit?.color || '#6366f1';

    if (this.bannerKitError) {
      this.bannerKitError.classList.add('is-hidden');
      this.bannerKitError.textContent = '';
    }

    this.modalKitBackdrop.classList.add('is-active');
    setTimeout(() => this.inputKitName?.focus(), 50);
  }

  private closeKitModal(): void {
    this.modalKitBackdrop?.classList.remove('is-active');
    this.editingKitUuid = null;
  }

  private async handleKitSubmit(e: Event): Promise<void> {
    e.preventDefault();
    if (!this.inputKitName || !this.inputKitName.value.trim()) return;

    const name = this.inputKitName.value.trim();
    const description = this.inputKitDesc?.value.trim() || undefined;
    const color = this.inputKitColor?.value || '#6366f1';

    if (!this.btnSubmitKit) return;

    await withButtonLoading(this.btnSubmitKit, 'Guardando...', async () => {
      if (this.editingKitUuid) {
        const res = await updateBrandKitApi(this.editingKitUuid, { color, description, name });
        if (res.success && res.kit) {
          showToast('Kit de marca actualizado', 'success');
          this.closeKitModal();
          await this.loadKits(res.kit.uuid);
        } else {
          this.showBannerError(this.bannerKitError, res.error || 'Error al actualizar kit.');
        }
      } else {
        const res = await createBrandKitApi({ color, description, name });
        if (res.success && res.kit) {
          showToast(`Kit «${res.kit.name}» creado con éxito`, 'success');
          this.closeKitModal();
          await this.loadKits(res.kit.uuid);
        } else {
          this.showBannerError(this.bannerKitError, res.error || 'Error al crear kit.');
        }
      }
    });
  }

  private openColorModal(): void {
    if (!this.modalColorBackdrop || !this.formColor) return;
    if (this.inputColorName) this.inputColorName.value = '';
    if (this.inputColorHex) this.inputColorHex.value = '#6366f1';
    if (this.bannerColorError) {
      this.bannerColorError.classList.add('is-hidden');
      this.bannerColorError.textContent = '';
    }
    this.modalColorBackdrop.classList.add('is-active');
    setTimeout(() => this.inputColorName?.focus(), 50);
  }

  private closeColorModal(): void {
    this.modalColorBackdrop?.classList.remove('is-active');
  }

  private async handleColorSubmit(e: Event): Promise<void> {
    e.preventDefault();
    if (!this.activeKit || !this.inputColorName || !this.inputColorHex) return;

    const name = this.inputColorName.value.trim();
    const hex = this.inputColorHex.value.trim();
    const palette_name = this.inputColorPalette?.value.trim() || 'Paleta principal';

    if (!name || !hex || !this.btnSubmitColor) return;

    await withButtonLoading(this.btnSubmitColor, 'Guardando...', async () => {
      const res = await addBrandColorApi(this.activeKit!.uuid, { hex, name, palette_name });
      if (res.success && res.color) {
        showToast('Color añadido con éxito', 'success');
        this.activeKit!.colors.push(res.color);
        this.closeColorModal();
        this.renderColorsTab(this.searchInput?.value || '');
        this.updateTabCounters();
      } else {
        this.showBannerError(this.bannerColorError, res.error || 'Error al guardar color.');
      }
    });
  }

  private async handleAddChartPreset(): Promise<void> {
    if (!this.activeKit) return;
    const defaultColors = this.activeKit.colors.map((c) => c.hex).slice(0, 6);
    const palette = defaultColors.length >= 3 ? defaultColors : ['#6366f1', '#8b5cf6', '#ec4899', '#3b82f6'];

    const res = await addBrandChartApi(this.activeKit.uuid, {
      chart_type: 'bar',
      name: `Estilo Gráfica ${this.activeKit.charts.length + 1}`,
      palette,
    });

    if (res.success && res.chart) {
      showToast('Estilo de gráfica añadido', 'success');
      this.activeKit.charts.push(res.chart);
      this.renderChartsTab(this.searchInput?.value || '');
      this.updateTabCounters();
    } else {
      showToast(res.error || 'Error al añadir gráfica.', 'danger');
    }
  }

  private async openTemplateModal(): Promise<void> {
    if (!this.modalTemplateBackdrop || !this.templateCanvasPicker) return;
    if (this.inputTemplateName) this.inputTemplateName.value = '';
    if (this.inputTemplateDesc) this.inputTemplateDesc.value = '';

    this.templateCanvasPicker.innerHTML = '<span style="font-size: 12px; color: var(--text-tertiary); padding: 8px;">Cargando lienzos...</span>';
    this.modalTemplateBackdrop.classList.add('is-active');

    try {
      const res = await getApi(API_ROUTES.canvases.base);
      if (res.ok) {
        const data = await res.json();
        const canvases = data.canvases || [];
        if (canvases.length === 0) {
          this.templateCanvasPicker.innerHTML = '<span style="font-size: 12px; color: var(--text-tertiary); padding: 8px;">No tienes lienzos creados aún.</span>';
        } else {
          this.templateCanvasPicker.innerHTML = canvases.map((c: any) => `
            <label style="display: flex; align-items: center; gap: 8px; padding: 6px 8px; border-radius: 6px; cursor: pointer;">
              <input type="radio" name="canvas_select" value="${escapeHtml(c.uuid)}" data-canvas-name="${escapeHtml(c.name)}" />
              <span style="font-size: 13px; font-weight: 500; color: var(--text-primary);">${escapeHtml(c.name)}</span>
            </label>
          `).join('');

          this.templateCanvasPicker.querySelectorAll<HTMLInputElement>('input[name="canvas_select"]').forEach((radio) => {
            radio.addEventListener('change', () => {
              if (this.inputTemplateName && radio.checked) {
                this.inputTemplateName.value = radio.getAttribute('data-canvas-name') || '';
              }
            });
          });
        }
      }
    } catch {
      this.templateCanvasPicker.innerHTML = '<span style="font-size: 12px; color: var(--text-tertiary); padding: 8px;">Error al cargar lienzos.</span>';
    }
  }

  private closeTemplateModal(): void {
    this.modalTemplateBackdrop?.classList.remove('is-active');
  }

  private async handleTemplateSubmit(e: Event): Promise<void> {
    e.preventDefault();
    if (!this.activeKit || !this.inputTemplateName || !this.btnSubmitTemplate) return;

    const name = this.inputTemplateName.value.trim();
    const description = this.inputTemplateDesc?.value.trim() || undefined;
    const selectedCanvasRadio = this.templateCanvasPicker?.querySelector<HTMLInputElement>('input[name="canvas_select"]:checked');
    const canvas_uuid = selectedCanvasRadio ? selectedCanvasRadio.value : undefined;

    if (!name) return;

    await withButtonLoading(this.btnSubmitTemplate, 'Vinculando...', async () => {
      const res = await addBrandTemplateApi(this.activeKit!.uuid, {
        canvas_uuid,
        description,
        name,
      });

      if (res.success && res.template) {
        showToast('Plantilla de marca vinculada con éxito', 'success');
        this.activeKit!.templates.push(res.template);
        this.closeTemplateModal();
        this.renderTemplatesTab(this.searchInput?.value || '');
        this.updateTabCounters();
      } else {
        this.showBannerError(this.bannerTemplateError, res.error || 'Error al vincular plantilla.');
      }
    });
  }

  private showBannerError(banner: HTMLElement | null, message: string): void {
    if (!banner) return;
    banner.textContent = message;
    banner.classList.remove('is-hidden');
  }
}

export async function createBrandView(): Promise<HTMLElement> {
  const view = await loadTemplate('/views/brand/brand.html');
  const controller = new BrandController(view);
  (view as any).__controller = controller;
  await controller.init();

  return view;
}
