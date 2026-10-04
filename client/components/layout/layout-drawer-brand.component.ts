import { navigate } from '../../app-router.js';
import { hasFeature } from '../../config/plans.config.js';
import { currentUser, escapeHtml } from '../../services/api.service.js';
import { getBrandKitDetailApi, getBrandKitsApi } from '../../services/brand.service.js';
import { t } from '../../services/i18n.service.js';
import { renderIcons } from '../../services/icon.service.js';
import { showToast } from '../../services/toast.service.js';
import { BrandKitAsset } from '../../types/brand.types.js';
import { setupDropdown } from '../../utils/dom.util.js';
import { ChartType } from '../../views/board/board.types.js';
import { getActiveCanvasController, getActiveCanvasType, toggleDrawer, updateCanvasRailActiveState } from '../layout.component.js';
import { openUpgradeModal } from '../upgrade-modal.component.js';
import { handleApplyChart } from './layout-drawer-elements.component.js';

export async function renderBrandDrawerContent(drawer: HTMLElement, drawerBody: HTMLElement): Promise<void> {
  const sidebar = drawer.closest<HTMLElement>('[data-ref="sidebar"]') || document.querySelector<HTMLElement>('[data-ref="sidebar"]');
  const canvasType = getActiveCanvasType();

  if (!currentUser || !hasFeature('brand_kits', currentUser)) {
    drawerBody.innerHTML = `
      <div class="canvas-panel-card" data-ref="canvas-panel-card">
        <div class="canvas-panel-card__header" data-ref="canvas-panel-header">
          <div class="canvas-panel-card__title-box" data-ref="canvas-panel-title-box">
            <svg class="component-icon canvas-panel-card__icon" aria-hidden="true"><use href="/icons.svg#palette"></use></svg>
            <span class="canvas-panel-card__title" data-ref="canvas-panel-title">${t('brand.title') || 'Kits de marca'}</span>
          </div>
          <button type="button" class="component-button component-button--h32 component-button--icon-only rail-btn canvas-panel-card__close" data-ref="btn-close-canvas-panel" data-tooltip="Cerrar panel" aria-label="Cerrar panel">
            <svg class="component-icon rail-btn__icon" aria-hidden="true"><use href="/icons.svg#close"></use></svg>
          </button>
        </div>
        <div class="canvas-panel-card__body" data-ref="canvas-panel-body">
          <div class="canvas-panel-card__empty" data-ref="brand-drawer-locked">
            <div class="brand-locked-badge" style="display: inline-flex; align-items: center; justify-content: center; width: 48px; height: 48px; border-radius: 50%; background: var(--bg-hover); margin-bottom: 12px; color: var(--color-primary, #6366f1);">
              <svg class="component-icon" style="width: 24px; height: 24px;" aria-hidden="true"><use href="/icons.svg#workspace_premium"></use></svg>
            </div>
            <span class="canvas-panel-card__empty-title" style="font-size: 15px; font-weight: 600; margin-bottom: 6px;">${t('brand.business_exclusive_title') || 'Exclusivo para Business'}</span>
            <p class="canvas-panel-card__empty-desc" style="margin-bottom: 16px;">${t('brand.drawer_locked_desc') || 'Gestiona hasta 500 kits de marca con paletas, logos, tipografías y recursos directamente en tu lienzo.'}</p>
            <button type="button" class="component-button component-button--h40 component-button--black component-button--w-full" data-ref="btn-drawer-upgrade-brand">
              <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#workspace_premium"></use></svg>
              <span>${t('plans.upgrade_to_business') || 'Actualizar a Business'}</span>
            </button>
          </div>
        </div>
      </div>
    `;

    const btnClose = drawerBody.querySelector<HTMLElement>('[data-ref="btn-close-canvas-panel"]');
    btnClose?.addEventListener('click', (e) => {
      e.preventDefault();
      toggleDrawer(false);
    });

    const btnUpgrade = drawerBody.querySelector<HTMLElement>('[data-ref="btn-drawer-upgrade-brand"]');
    btnUpgrade?.addEventListener('click', (e) => {
      e.preventDefault();
      openUpgradeModal('business');
    });

    const drawerFooter = drawer.querySelector<HTMLElement>('[data-ref="drawer-footer"]');
    if (drawerFooter) {
      drawerFooter.style.display = 'none';
    }
    if (sidebar) {
      updateCanvasRailActiveState(sidebar);
    }
    renderIcons(drawerBody);
    return;
  }

  drawerBody.innerHTML = `
    <div class="canvas-panel-card" data-ref="canvas-panel-card">
      <div class="canvas-panel-card__header" data-ref="canvas-panel-header">
        <div class="canvas-panel-card__title-box" data-ref="canvas-panel-title-box">
          <svg class="component-icon canvas-panel-card__icon" aria-hidden="true"><use href="/icons.svg#palette"></use></svg>
          <span class="canvas-panel-card__title" data-ref="canvas-panel-title">${t('brand.title') || 'Kit de marca'}</span>
        </div>
        <div style="display: flex; align-items: center; gap: 4px;">
          <button type="button" class="component-button component-button--h32 component-button--icon-only rail-btn" data-ref="btn-drawer-open-brand-page" data-tooltip="${t('brand.drawer_manage') || 'Administrar kits de marca'}" aria-label="${t('brand.drawer_manage') || 'Administrar kits de marca'}">
            <svg class="component-icon rail-btn__icon" aria-hidden="true"><use href="/icons.svg#open_in_new"></use></svg>
          </button>
          <button type="button" class="component-button component-button--h32 component-button--icon-only rail-btn canvas-panel-card__close" data-ref="btn-close-canvas-panel" data-tooltip="Cerrar panel" aria-label="Cerrar panel">
            <svg class="component-icon rail-btn__icon" aria-hidden="true"><use href="/icons.svg#close"></use></svg>
          </button>
        </div>
      </div>
      <div class="canvas-panel-card__body brand-drawer-body" data-ref="canvas-panel-body">
        <div class="brand-drawer-loading" data-ref="brand-drawer-loading">
          <div class="skeleton" style="height: 38px; border-radius: 8px; margin-bottom: 12px;"></div>
          <div class="skeleton" style="height: 100px; border-radius: 8px; margin-bottom: 12px;"></div>
          <div class="skeleton" style="height: 100px; border-radius: 8px;"></div>
        </div>
        <div class="brand-drawer-content" data-ref="brand-drawer-content" style="display: none;"></div>
      </div>
    </div>
  `;

  const btnClose = drawerBody.querySelector<HTMLElement>('[data-ref="btn-close-canvas-panel"]');
  btnClose?.addEventListener('click', (e) => {
    e.preventDefault();
    toggleDrawer(false);
  });

  const btnOpenPage = drawerBody.querySelector<HTMLElement>('[data-ref="btn-drawer-open-brand-page"]');
  btnOpenPage?.addEventListener('click', (e) => {
    e.preventDefault();
    toggleDrawer(false);
    navigate('/brand');
  });

  const drawerFooter = drawer.querySelector<HTMLElement>('[data-ref="drawer-footer"]');
  if (drawerFooter) {
    drawerFooter.style.display = 'none';
  }
  if (sidebar) {
    updateCanvasRailActiveState(sidebar);
  }
  renderIcons(drawerBody);

  const loadingEl = drawerBody.querySelector<HTMLElement>('[data-ref="brand-drawer-loading"]');
  const contentEl = drawerBody.querySelector<HTMLElement>('[data-ref="brand-drawer-content"]');

  const res = await getBrandKitsApi();
  const kits = res.kits || [];

  if (!loadingEl || !contentEl) return;
  loadingEl.style.display = 'none';
  contentEl.style.display = 'block';

  if (kits.length === 0) {
    contentEl.innerHTML = `
      <div class="canvas-panel-card__empty" data-ref="brand-drawer-empty">
        <div class="canvas-panel-card__empty-icon" data-ref="brand-drawer-empty-icon">
          <svg class="component-icon" data-ref="brand-drawer-empty-svg" viewBox="0 0 56 56" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" style="width: 52px; height: 52px; color: var(--text-tertiary);">
            <rect x="8" y="10" width="40" height="36" rx="8" stroke-width="1.8" />
            <circle cx="19" cy="23" r="5" stroke-width="1.8" />
            <circle cx="34" cy="21" r="3" stroke-width="1.8" />
            <path d="M12 40c4-6 10-8 16-4s10 2 16-6" stroke-width="1.8" />
            <path d="M37 31l5-5 3 3-5 5-3-3z" stroke-width="1.8" />
            <path d="M37 31l-3 7 7-3" stroke-width="1.8" />
          </svg>
        </div>
        <span class="canvas-panel-card__empty-title">${t('brand.drawer_empty_title') || 'No hay kits de marca'}</span>
        <p class="canvas-panel-card__empty-desc">${t('brand.drawer_empty_desc') || 'Crea tu primer kit de marca para organizar tus logos, paletas y recursos.'}</p>
      </div>
    `;
    renderIcons(contentEl);
    return;
  }

  let activeKitUuid = kits.find((k) => k.is_default)?.uuid || kits[0].uuid;

  const roleLabels: Record<string, string> = {
    body: 'Cuerpo',
    body_secondary: 'Texto secundario',
    caption: 'Pie de página',
    heading_secondary: 'Subtítulo secundario',
    subtitle: 'Subtítulo',
    title: 'Título',
  };

  const renderActiveKitDetail = async (uuid: string) => {
    const activeKit = kits.find((k) => k.uuid === uuid) || kits[0];

    contentEl.innerHTML = `
      <div class="settings-dropdown-wrapper settings-dropdown-wrapper--full" data-ref="dropdown-wrapper-brand-kit" style="margin-bottom: 12px;">
        <button type="button" class="dropdown-trigger dropdown-trigger--full" data-ref="trigger-brand-kit">
          <div class="dropdown-trigger__left">
            <svg class="component-icon dropdown-trigger__icon" aria-hidden="true"><use href="/icons.svg#${activeKit.is_default ? 'star' : 'palette'}"></use></svg>
            <span class="dropdown-trigger__text" data-ref="text-brand-kit">${escapeHtml(activeKit.name)}</span>
          </div>
          <svg class="component-icon dropdown-trigger__chevron" aria-hidden="true"><use href="/icons.svg#expand_more"></use></svg>
        </button>
        <div class="dropdown-backdrop" data-ref="backdrop-brand-kit">
          <div class="menu-panel menu-panel--dropdown menu-panel--w-full menu-panel--h-auto" data-ref="menu-brand-kit">
            <div class="menu-panel__drag-zone" aria-hidden="true">
              <div class="menu-panel__drag-handle"></div>
            </div>
            <div class="menu-panel__list" data-ref="list-brand-kits">
              ${kits.map((k) => `
                <button type="button" class="menu-item${k.uuid === uuid ? ' is-active' : ''}" data-ref="opt-brand-kit-${k.uuid}" data-value="${k.uuid}">
                  <svg class="component-icon menu-item__icon" aria-hidden="true"><use href="/icons.svg#${k.is_default ? 'star' : 'palette'}"></use></svg>
                  <span class="menu-item__text">${escapeHtml(k.name)}</span>
                  ${k.is_default ? '<span class="menu-item__shortcut">Predeterminado</span>' : ''}
                </button>
              `).join('')}
            </div>
          </div>
        </div>
      </div>
      <div class="brand-drawer-kit-loading">
        <div class="skeleton" style="height: 80px; border-radius: 8px; margin-bottom: 10px;"></div>
        <div class="skeleton" style="height: 80px; border-radius: 8px;"></div>
      </div>
    `;

    const dropdownWrapper = contentEl.querySelector<HTMLElement>('[data-ref="dropdown-wrapper-brand-kit"]');
    if (dropdownWrapper) {
      setupDropdown(dropdownWrapper, {
        onSelect: (val) => {
          if (val && val !== activeKitUuid) {
            activeKitUuid = val;
            void renderActiveKitDetail(activeKitUuid);
          }
        },
      });
    }

    const detailRes = await getBrandKitDetailApi(uuid);
    const kit = detailRes.kit;
    if (!kit) {
      contentEl.innerHTML = `<p class="canvas-panel-card__empty-desc">Error al cargar kit de marca.</p>`;
      return;
    }

    let html = `
      <div class="settings-dropdown-wrapper settings-dropdown-wrapper--full" data-ref="dropdown-wrapper-brand-kit" style="margin-bottom: 12px;">
        <button type="button" class="dropdown-trigger dropdown-trigger--full" data-ref="trigger-brand-kit">
          <div class="dropdown-trigger__left">
            <svg class="component-icon dropdown-trigger__icon" aria-hidden="true"><use href="/icons.svg#${activeKit.is_default ? 'star' : 'palette'}"></use></svg>
            <span class="dropdown-trigger__text" data-ref="text-brand-kit">${escapeHtml(activeKit.name)}</span>
          </div>
          <svg class="component-icon dropdown-trigger__chevron" aria-hidden="true"><use href="/icons.svg#expand_more"></use></svg>
        </button>
        <div class="dropdown-backdrop" data-ref="backdrop-brand-kit">
          <div class="menu-panel menu-panel--dropdown menu-panel--w-full menu-panel--h-auto" data-ref="menu-brand-kit">
            <div class="menu-panel__drag-zone" aria-hidden="true">
              <div class="menu-panel__drag-handle"></div>
            </div>
            <div class="menu-panel__list" data-ref="list-brand-kits">
              ${kits.map((k) => `
                <button type="button" class="menu-item${k.uuid === uuid ? ' is-active' : ''}" data-ref="opt-brand-kit-${k.uuid}" data-value="${k.uuid}">
                  <svg class="component-icon menu-item__icon" aria-hidden="true"><use href="/icons.svg#${k.is_default ? 'star' : 'palette'}"></use></svg>
                  <span class="menu-item__text">${escapeHtml(k.name)}</span>
                  ${k.is_default ? '<span class="menu-item__shortcut">Predeterminado</span>' : ''}
                </button>
              `).join('')}
            </div>
          </div>
        </div>
      </div>
      <div class="brand-drawer-sections" data-ref="brand-drawer-sections">
    `;

    let hasAnyItems = false;

    if (kit.colors && kit.colors.length > 0) {
      hasAnyItems = true;
      html += `
        <div class="elements-section-title">
          <span>${t('brand.tab_colors') || 'Colores'}</span>
          <span style="font-size: 11px; opacity: 0.6; font-weight: normal; margin-left: auto;">${kit.colors.length}</span>
        </div>
        <div class="brand-drawer-swatches-grid" data-ref="brand-drawer-colors-grid">
          ${kit.colors.map((c) => {
            const hexVal = c.hex || c.hex_value || '#6366f1';
            return `
              <button type="button" class="brand-drawer-swatch-btn" data-ref="brand-swatch-${c.id}" data-color-hex="${hexVal}" data-color-name="${escapeHtml(c.name)}" data-tooltip="${escapeHtml(c.name)} (${hexVal})" aria-label="${escapeHtml(c.name)}" style="background-color: ${hexVal};"></button>
            `;
          }).join('')}
        </div>
      `;
    }

    if (kit.fonts && kit.fonts.length > 0) {
      hasAnyItems = true;
      html += `
        <div class="elements-section-title">
          <span>${t('brand.tab_fonts') || 'Tipografía'}</span>
          <span style="font-size: 11px; opacity: 0.6; font-weight: normal; margin-left: auto;">${kit.fonts.length}</span>
        </div>
        <div class="brand-drawer-fonts-list" style="display: flex; flex-direction: column; gap: 4px; margin-bottom: 12px;">
          ${kit.fonts.map((f) => {
            const roleLabel = roleLabels[f.role] || f.role;
            return `
              <button type="button" class="menu-item menu-item--bordered brand-drawer-font-item" data-ref="brand-font-btn-${f.role}" data-font-family="${escapeHtml(f.font_family)}" data-font-weight="${f.font_weight}" data-font-size="${f.font_size || 16}" data-font-role="${f.role}">
                <div style="display: flex; flex-direction: column; gap: 2px; overflow: hidden; min-width: 0; text-align: left;">
                  <span style="font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-tertiary);">${escapeHtml(roleLabel)}</span>
                  <span class="brand-drawer-font-preview" style="font-size: 13px; font-family: '${escapeHtml(f.font_family)}', sans-serif; font-weight: ${f.font_weight};">${escapeHtml(f.font_family)}</span>
                </div>
                <span class="menu-item__shortcut" style="margin-left: 8px;">${f.font_size || 16}px</span>
              </button>
            `;
          }).join('')}
        </div>
      `;
    }

    if (kit.logos && kit.logos.length > 0) {
      hasAnyItems = true;
      html += `
        <div class="elements-section-title">
          <span>${t('brand.tab_logos') || 'Logos'}</span>
          <span style="font-size: 11px; opacity: 0.6; font-weight: normal; margin-left: auto;">${kit.logos.length}</span>
        </div>
        <div class="elements-grid" data-ref="canvas-brand-logos-grid">
          ${kit.logos.map((l) => {
            const url = l.url || l.file_url || '';
            return `
              <button type="button" class="element-grid-item" data-ref="brand-logo-btn-${l.id}" data-asset-url="${url}" data-asset-name="${escapeHtml(l.name)}" data-asset-w="${l.width || 200}" data-asset-h="${l.height || 200}" data-tooltip="${escapeHtml(l.name)}" aria-label="${escapeHtml(l.name)}">
                <img class="canvas-upload-img image-lazy-fade image-loaded" data-ref="img-brand-logo-${l.id}" src="${url}" alt="${escapeHtml(l.name)}" loading="lazy" decoding="async" onload="this.classList.add('image-loaded')" onerror="this.classList.add('image-loaded')" />
              </button>
            `;
          }).join('')}
        </div>
      `;
    }

    if (kit.photos && kit.photos.length > 0) {
      hasAnyItems = true;
      html += `
        <div class="elements-section-title">
          <span>${t('brand.tab_photos') || 'Fotos'}</span>
          <span style="font-size: 11px; opacity: 0.6; font-weight: normal; margin-left: auto;">${kit.photos.length}</span>
        </div>
        <div class="elements-grid" data-ref="canvas-brand-photos-grid">
          ${kit.photos.map((p) => {
            const url = p.url || p.file_url || '';
            return `
              <button type="button" class="element-grid-item" data-ref="brand-photo-btn-${p.id}" data-asset-url="${url}" data-asset-name="${escapeHtml(p.name)}" data-asset-w="${p.width || 300}" data-asset-h="${p.height || 200}" data-tooltip="${escapeHtml(p.name)}" aria-label="${escapeHtml(p.name)}">
                <img class="canvas-upload-img image-lazy-fade image-loaded" data-ref="img-brand-photo-${p.id}" src="${url}" alt="${escapeHtml(p.name)}" loading="lazy" decoding="async" onload="this.classList.add('image-loaded')" onerror="this.classList.add('image-loaded')" />
              </button>
            `;
          }).join('')}
        </div>
      `;
    }

    const brandGraphics = kit.elements || kit.graphics || [];
    if (brandGraphics.length > 0) {
      hasAnyItems = true;
      html += `
        <div class="elements-section-title">
          <span>${t('brand.tab_graphics') || 'Elementos'}</span>
          <span style="font-size: 11px; opacity: 0.6; font-weight: normal; margin-left: auto;">${brandGraphics.length}</span>
        </div>
        <div class="elements-grid" data-ref="canvas-brand-graphics-grid">
          ${brandGraphics.map((g: BrandKitAsset) => {
            const url = g.url || g.file_url || '';
            return `
              <button type="button" class="element-grid-item" data-ref="brand-graphic-btn-${g.id}" data-asset-url="${url}" data-asset-name="${escapeHtml(g.name)}" data-asset-w="${g.width || 200}" data-asset-h="${g.height || 200}" data-tooltip="${escapeHtml(g.name)}" aria-label="${escapeHtml(g.name)}">
                <img class="canvas-upload-img image-lazy-fade image-loaded" data-ref="img-brand-graphic-${g.id}" src="${url}" alt="${escapeHtml(g.name)}" loading="lazy" decoding="async" onload="this.classList.add('image-loaded')" onerror="this.classList.add('image-loaded')" />
              </button>
            `;
          }).join('')}
        </div>
      `;
    }

    if (kit.charts && kit.charts.length > 0) {
      hasAnyItems = true;
      html += `
        <div class="elements-section-title">
          <span>${t('brand.tab_charts') || 'Gráficas'}</span>
          <span style="font-size: 11px; opacity: 0.6; font-weight: normal; margin-left: auto;">${kit.charts.length}</span>
        </div>
        <div style="display: flex; flex-direction: column; gap: 4px; margin-bottom: 12px;">
          ${kit.charts.map((c) => `
            <button type="button" class="menu-item menu-item--bordered" data-ref="brand-chart-btn-${c.id}" data-chart-type="${c.chart_type}">
              <svg class="component-icon menu-item__icon" aria-hidden="true"><use href="/icons.svg#bar_chart"></use></svg>
              <span class="menu-item__text">${escapeHtml(c.name)}</span>
            </button>
          `).join('')}
        </div>
      `;
    }

    if (kit.templates && kit.templates.length > 0) {
      hasAnyItems = true;
      html += `
        <div class="elements-section-title">
          <span>${t('brand.tab_templates') || 'Plantillas'}</span>
          <span style="font-size: 11px; opacity: 0.6; font-weight: normal; margin-left: auto;">${kit.templates.length}</span>
        </div>
        <div class="elements-grid" data-ref="canvas-brand-templates-grid">
          ${kit.templates.map((tItem) => {
            const tplUuid = tItem.template_canvas_uuid || tItem.canvas_uuid || tItem.uuid || '';
            return `
              <button type="button" class="element-grid-item" data-ref="brand-template-btn-${tItem.id}" data-template-uuid="${tplUuid}" data-tooltip="${escapeHtml(tItem.name)}" aria-label="${escapeHtml(tItem.name)}">
                ${tItem.preview_thumbnail ? `<img class="canvas-upload-img image-lazy-fade image-loaded" src="${tItem.preview_thumbnail}" alt="${escapeHtml(tItem.name)}" loading="lazy" decoding="async" onload="this.classList.add('image-loaded')" onerror="this.classList.add('image-loaded')" />` : `<svg class="component-icon" aria-hidden="true"><use href="/icons.svg#space_dashboard"></use></svg>`}
              </button>
            `;
          }).join('')}
        </div>
      `;
    }

    if (!hasAnyItems) {
      html += `
        <div class="canvas-panel-card__empty" data-ref="brand-kit-empty" style="padding: 20px 8px;">
          <span class="canvas-panel-card__empty-title">Kit sin elementos</span>
          <p class="canvas-panel-card__empty-desc">Personaliza este kit agregando colores, logos, tipografías y recursos.</p>
        </div>
      `;
    }

    html += `
        <div style="padding-top: 12px; border-top: 1px solid var(--border-color); margin-top: 8px; display: flex; flex-direction: column; gap: 4px;">
          <button type="button" class="menu-item" data-ref="btn-drawer-manage-kit">
            <svg class="component-icon menu-item__icon" aria-hidden="true"><use href="/icons.svg#tune"></use></svg>
            <span class="menu-item__text">${t('brand.drawer_manage') || 'Administrar kit de marca'}</span>
          </button>
        </div>
      </div>
    `;

    contentEl.innerHTML = html;

    const newDropdownWrapper = contentEl.querySelector<HTMLElement>('[data-ref="dropdown-wrapper-brand-kit"]');
    if (newDropdownWrapper) {
      setupDropdown(newDropdownWrapper, {
        onSelect: (val) => {
          if (val && val !== activeKitUuid) {
            activeKitUuid = val;
            void renderActiveKitDetail(activeKitUuid);
          }
        },
      });
    }

    const btnManage = contentEl.querySelector<HTMLElement>('[data-ref="btn-drawer-manage-kit"]');
    btnManage?.addEventListener('click', () => {
      toggleDrawer(false);
      navigate('/brand');
    });

    contentEl.querySelectorAll<HTMLButtonElement>('[data-color-hex]').forEach((swatch) => {
      swatch.addEventListener('click', () => {
        const hex = swatch.getAttribute('data-color-hex') || '';
        if (!hex) return;
        try {
          navigator.clipboard.writeText(hex);
          showToast(`Color ${hex} copiado al portapapeles`, 'success');
        } catch {}

        const controller = getActiveCanvasController();
        if (controller && typeof controller.applyFillColor === 'function') {
          controller.applyFillColor(hex);
        } else if (controller && typeof controller.setColor === 'function') {
          controller.setColor(hex);
        }
      });
    });

    contentEl.querySelectorAll<HTMLButtonElement>('[data-font-family]').forEach((fontBtn) => {
      fontBtn.addEventListener('click', () => {
        const fontFamily = fontBtn.getAttribute('data-font-family') || 'sans-serif';
        const fontWeight = parseInt(fontBtn.getAttribute('data-font-weight') || '400', 10);
        const fontSize = parseInt(fontBtn.getAttribute('data-font-size') || '16', 10);
        const role = fontBtn.getAttribute('data-font-role') || 'body';

        const controller = getActiveCanvasController();
        const activeCanvas = getActiveCanvasType();

        if (activeCanvas === 'board' || activeCanvas === 'presentation') {
          if (typeof controller?.insertTextPreset === 'function') {
            controller.insertTextPreset({ fontFamily, fontSize, fontWeight, role });
          } else if (typeof controller?.insertText === 'function') {
            controller.insertText(role === 'title' ? 'Título de marca' : (role === 'subtitle' ? 'Subtítulo de marca' : 'Texto de párrafo'), fontFamily);
          }
          showToast(`Texto con «${fontFamily}» añadido al lienzo`, 'success');
        } else if (activeCanvas === 'doc') {
          controller?.insertText?.(fontFamily);
          showToast(`Texto insertado en el documento`, 'success');
        }
        if (window.innerWidth <= 768) toggleDrawer(false);
      });
    });

    contentEl.querySelectorAll<HTMLButtonElement>('[data-asset-url]').forEach((assetBtn) => {
      assetBtn.addEventListener('click', () => {
        const url = assetBtn.getAttribute('data-asset-url') || '';
        const name = assetBtn.getAttribute('data-asset-name') || 'Recurso de marca';
        const w = parseInt(assetBtn.getAttribute('data-asset-w') || '200', 10);
        const h = parseInt(assetBtn.getAttribute('data-asset-h') || '200', 10);

        const controller = getActiveCanvasController();
        const activeCanvas = getActiveCanvasType();

        if (activeCanvas === 'board' || activeCanvas === 'presentation') {
          controller?.insertImage?.(url, w, h, name);
          showToast(`«${name}» añadido al lienzo`, 'success');
        } else if (activeCanvas === 'doc') {
          controller?.insertImage?.(url, name);
          showToast(`«${name}» insertado en el documento`, 'success');
        }
        if (window.innerWidth <= 768) toggleDrawer(false);
      });
    });

    contentEl.querySelectorAll<HTMLButtonElement>('[data-chart-type]').forEach((chartBtn) => {
      chartBtn.addEventListener('click', () => {
        const chartType = chartBtn.getAttribute('data-chart-type') as ChartType;
        if (chartType) {
          handleApplyChart(chartType, canvasType);
        }
      });
    });

    renderIcons(contentEl);
  };

  await renderActiveKitDetail(activeKitUuid);
}
