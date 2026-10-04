import { t } from '../../services/i18n.service.js';
import { renderIcons } from '../../services/icon.service.js';
import { showToast } from '../../services/toast.service.js';
import { getActiveCanvasController, getActiveCanvasType, toggleDrawer, updateCanvasRailActiveState } from '../layout.component.js';

export function handleApplyTextPreset(type: 'heading' | 'subheading' | 'body', canvasType: 'board' | 'doc' | 'presentation' | 'video'): void {
  const controller = getActiveCanvasController();
  if (!controller) {
    showToast('No se encontró el controlador del lienzo activo', 'warning');
    return;
  }

  if (typeof controller.insertTextPreset === 'function') {
    controller.insertTextPreset(type);
    const labelMap = {
      body: 'Texto',
      heading: 'Título',
      subheading: 'Subtítulo',
    };
    showToast(`«${labelMap[type]}» insertado en el lienzo`, 'success');
    if (window.innerWidth <= 768) {
      toggleDrawer(false);
    }
    return;
  }

  showToast('No se pudo insertar el texto en este modo', 'warning');
}

export function renderTextDrawerContent(drawer: HTMLElement, drawerBody: HTMLElement): void {
  const sidebar = drawer.closest<HTMLElement>('[data-ref="sidebar"]') || document.querySelector<HTMLElement>('[data-ref="sidebar"]');
  const canvasType = getActiveCanvasType();

  drawerBody.innerHTML = `
    <div class="canvas-panel-card" data-ref="canvas-panel-card">
      <div class="canvas-panel-card__header" data-ref="canvas-panel-header">
        <div class="canvas-panel-card__title-box" data-ref="canvas-panel-title-box">
          <svg class="component-icon canvas-panel-card__icon" aria-hidden="true"><use href="/icons.svg#text_fields"></use></svg>
          <span class="canvas-panel-card__title" data-ref="canvas-panel-title">${t('nav.text') || 'Texto'}</span>
        </div>
        <button type="button" class="component-button component-button--h32 component-button--icon-only rail-btn canvas-panel-card__close" data-ref="btn-close-canvas-panel" data-tooltip="Cerrar panel" aria-label="Cerrar panel">
          <svg class="component-icon rail-btn__icon" aria-hidden="true"><use href="/icons.svg#close"></use></svg>
        </button>
      </div>
      <div class="canvas-panel-card__body" data-ref="canvas-panel-body">
        <div class="text-drawer-actions" data-ref="text-drawer-actions">
          <button type="button" class="component-button component-button--h40 component-button--primary component-button--w-full" data-ref="btn-add-textbox">
            <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#text_fields"></use></svg>
            <span>Agregar caja de texto</span>
          </button>
          <button type="button" class="component-button component-button--h40 component-button--w-full" data-ref="btn-magic-text">
            <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#auto_awesome"></use></svg>
            <span>Texto mágico</span>
          </button>
        </div>

        <div class="elements-section-title">Texto predeterminado</div>
        <div class="text-drawer-presets" data-ref="text-drawer-presets">
          <button type="button" class="text-preset-btn text-preset-btn--heading" data-ref="btn-text-preset-heading" data-preset="heading">
            <span class="text-preset-btn__label">Agregar un título</span>
          </button>
          <button type="button" class="text-preset-btn text-preset-btn--subheading" data-ref="btn-text-preset-subheading" data-preset="subheading">
            <span class="text-preset-btn__label">Agregar un subtítulo</span>
          </button>
          <button type="button" class="text-preset-btn text-preset-btn--body" data-ref="btn-text-preset-body" data-preset="body">
            <span class="text-preset-btn__label">Agregar algo de texto</span>
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

  const btnAddTextbox = drawerBody.querySelector<HTMLButtonElement>('[data-ref="btn-add-textbox"]');
  btnAddTextbox?.addEventListener('click', (e) => {
    e.preventDefault();
    const vtoolTextBtn = document.querySelector<HTMLButtonElement>('[data-ref="vertical-tool-text"]');
    if (vtoolTextBtn) {
      vtoolTextBtn.click();
    } else {
      handleApplyTextPreset('body', canvasType);
    }
  });

  const btnMagicText = drawerBody.querySelector<HTMLButtonElement>('[data-ref="btn-magic-text"]');
  btnMagicText?.addEventListener('click', (e) => {
    e.preventDefault();
  });

  const presetBtns = drawerBody.querySelectorAll<HTMLButtonElement>('[data-ref^="btn-text-preset-"]');
  presetBtns.forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const presetType = btn.getAttribute('data-preset') as 'heading' | 'subheading' | 'body';
      if (presetType) {
        handleApplyTextPreset(presetType, canvasType);
      }
    });
  });

  const drawerFooter = drawer.querySelector<HTMLElement>('[data-ref="drawer-footer"]');
  if (drawerFooter) {
    drawerFooter.style.display = 'none';
  }

  if (sidebar) {
    updateCanvasRailActiveState(sidebar);
  }

  renderIcons(drawerBody);
}
