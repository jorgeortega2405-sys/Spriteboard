import { getActiveCanvasController, getActiveCanvasType, toggleDrawer, updateCanvasRailActiveState } from '../../components/layout.component.js';
import { getAppById } from '../../config/apps.config.js';
import { escapeHtml } from '../../services/api.service.js';
import { buildStaticMapUrl, fetchMapImageBlob, getGoogleMapsExternalUrl, MAP_PRESET_LOCATIONS, MapStyleOption, MapTypeOption } from '../../services/google-maps.service.js';
import { renderIcons } from '../../services/icon.service.js';
import { showToast } from '../../services/toast.service.js';
import { AppPlugin, AppPluginContext } from '../plugin.types.js';

let mapsAddress = 'Madrid, España';
let mapsZoom = 14;
let mapsType: MapTypeOption = 'roadmap';
let mapsStyle: MapStyleOption = 'standard';
let mapsShowMarker = true;

export class GoogleMapsPlugin implements AppPlugin {
  public readonly id = 'google-maps';

  public render(ctx: AppPluginContext): void {
    const { drawer, drawerBody, onBack, onClose } = ctx;
    const sidebar = drawer.closest<HTMLElement>('[data-ref="sidebar"]') || document.querySelector<HTMLElement>('[data-ref="sidebar"]');

    drawerBody.innerHTML = `
      <div class="canvas-panel-card" data-ref="canvas-panel-card">
        <div class="canvas-panel-card__header" data-ref="canvas-panel-header">
          <div class="canvas-panel-card__title-box" data-ref="canvas-panel-title-box">
            ${getAppById('google-maps')?.iconSvg || '<svg class="component-icon canvas-panel-card__icon"><use href="/icons.svg#map"></use></svg>'}
            <span class="canvas-panel-card__title" data-ref="canvas-panel-title">Google Maps</span>
          </div>
          <button type="button" class="component-button component-button--h32 component-button--icon-only rail-btn canvas-panel-card__close" data-ref="btn-close-canvas-panel" data-tooltip="Cerrar panel" aria-label="Cerrar panel">
            <svg class="component-icon rail-btn__icon" aria-hidden="true"><use href="/icons.svg#close"></use></svg>
          </button>
        </div>
        <div class="canvas-panel-card__body maps-drawer-body" data-ref="canvas-panel-body">
          <button type="button" class="elements-back-btn" data-ref="btn-apps-back" style="margin-bottom: 2px;">
            <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#arrow_back"></use></svg>
            <span>Volver a Apps</span>
          </button>

          <div class="menu-panel__search" data-ref="maps-search-wrapper">
            <svg class="component-icon menu-panel__search-icon" aria-hidden="true"><use href="/icons.svg#search"></use></svg>
            <input class="menu-panel__search-input" data-ref="maps-search-input" type="text" maxlength="120" autocomplete="off" placeholder="Buscar dirección o ciudad..." value="${escapeHtml(mapsAddress)}" />
          </div>

          <div class="maps-chips-row" data-ref="maps-presets-row">
            ${MAP_PRESET_LOCATIONS.map((loc) => `
              <button type="button" class="mockup-category-pill" data-ref="chip-map-${loc.name}" data-map-loc="${escapeHtml(loc.address)}">
                ${escapeHtml(loc.name)}
              </button>
            `).join('')}
          </div>

          <div class="maps-preview-card" data-ref="maps-preview-card">
            <div class="maps-preview-box" data-ref="maps-preview-box">
              <img class="maps-preview-img" data-ref="maps-preview-img" src="${buildStaticMapUrl({ address: mapsAddress, mapType: mapsType, showMarker: mapsShowMarker, styleTheme: mapsStyle, zoom: mapsZoom })}" alt="Vista previa del mapa" />
            </div>
          </div>

          <div class="maps-controls-section" data-ref="maps-controls-style">
            <span class="maps-controls-label" data-ref="label-maps-style">Estilo de mapa</span>
            <div class="maps-style-grid" data-ref="maps-style-grid">
              <button type="button" class="maps-style-btn ${mapsType === 'roadmap' && mapsStyle === 'standard' ? 'is-active' : ''}" data-ref="btn-map-roadmap" data-map-type="roadmap" data-map-style="standard">Estándar</button>
              <button type="button" class="maps-style-btn ${mapsType === 'satellite' ? 'is-active' : ''}" data-ref="btn-map-satellite" data-map-type="satellite" data-map-style="standard">Satélite</button>
              <button type="button" class="maps-style-btn ${mapsType === 'hybrid' ? 'is-active' : ''}" data-ref="btn-map-hybrid" data-map-type="hybrid" data-map-style="standard">Híbrido</button>
              <button type="button" class="maps-style-btn ${mapsStyle === 'dark' ? 'is-active' : ''}" data-ref="btn-map-dark" data-map-type="roadmap" data-map-style="dark">Oscuro</button>
            </div>
          </div>

          <div class="maps-controls-section" data-ref="maps-controls-zoom">
            <div style="display: flex; align-items: center; justify-content: space-between;">
              <span class="maps-controls-label" data-ref="label-maps-zoom">Zoom</span>
              <span style="font-size: 11px; color: var(--text-tertiary);" data-ref="label-maps-zoom-val">${mapsZoom}</span>
            </div>
            <input class="qr-range-slider" data-ref="slider-maps-zoom" type="range" min="3" max="18" step="1" value="${mapsZoom}" aria-label="Nivel de zoom del mapa" />
          </div>

          <div style="display: flex; align-items: center; justify-content: space-between; padding: 2px 0;">
            <label style="display: flex; align-items: center; gap: 8px; font-size: 11.5px; color: var(--text-secondary); cursor: pointer;" data-ref="label-marker-toggle">
              <input data-ref="check-maps-marker" type="checkbox" ${mapsShowMarker ? 'checked' : ''} />
              <span>Marcador de ubicación</span>
            </label>
            <a class="link" data-ref="link-open-gmaps" href="${getGoogleMapsExternalUrl(mapsAddress)}" target="_blank" rel="noopener noreferrer" style="font-size: 11px; display: flex; align-items: center; gap: 4px;">
              <span>Abrir Maps</span>
              <svg class="component-icon" aria-hidden="true" style="width: 12px; height: 12px;"><use href="/icons.svg#open_in_new"></use></svg>
            </a>
          </div>

          <button type="button" class="component-button component-button--h44 component-button--black component-button--w-full" data-ref="btn-insert-map-canvas">
            <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#add"></use></svg>
            <span>Insertar mapa en el diseño</span>
          </button>
        </div>
      </div>
    `;

    const btnBack = drawerBody.querySelector<HTMLButtonElement>('[data-ref="btn-apps-back"]');
    btnBack?.addEventListener('click', () => {
      onBack();
    });

    const btnClose = drawerBody.querySelector<HTMLElement>('[data-ref="btn-close-canvas-panel"]');
    btnClose?.addEventListener('click', (e) => {
      e.preventDefault();
      onClose();
    });

    const searchInput = drawerBody.querySelector<HTMLInputElement>('[data-ref="maps-search-input"]');
    const previewImg = drawerBody.querySelector<HTMLImageElement>('[data-ref="maps-preview-img"]');
    const zoomSlider = drawerBody.querySelector<HTMLInputElement>('[data-ref="slider-maps-zoom"]');
    const zoomValLabel = drawerBody.querySelector<HTMLElement>('[data-ref="label-maps-zoom-val"]');
    const markerCheck = drawerBody.querySelector<HTMLInputElement>('[data-ref="check-maps-marker"]');
    const linkOpen = drawerBody.querySelector<HTMLAnchorElement>('[data-ref="link-open-gmaps"]');
    const btnInsert = drawerBody.querySelector<HTMLButtonElement>('[data-ref="btn-insert-map-canvas"]');

    const updateMapPreview = () => {
      const url = buildStaticMapUrl({
        address: mapsAddress,
        mapType: mapsType,
        showMarker: mapsShowMarker,
        styleTheme: mapsStyle,
        zoom: mapsZoom,
      });
      if (previewImg) previewImg.src = url;
      if (linkOpen) linkOpen.href = getGoogleMapsExternalUrl(mapsAddress);
      if (zoomValLabel) zoomValLabel.textContent = String(mapsZoom);
    };

    let debounceTimer: number | null = null;
    searchInput?.addEventListener('input', () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = window.setTimeout(() => {
        const q = searchInput.value.trim();
        if (q) {
          mapsAddress = q;
          updateMapPreview();
        }
      }, 500);
    });

    drawerBody.querySelectorAll<HTMLButtonElement>('[data-map-loc]').forEach((chip) => {
      chip.addEventListener('click', () => {
        const loc = chip.getAttribute('data-map-loc');
        if (loc && searchInput) {
          mapsAddress = loc;
          searchInput.value = loc;
          updateMapPreview();
        }
      });
    });

    drawerBody.querySelectorAll<HTMLButtonElement>('[data-map-type]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const mType = btn.getAttribute('data-map-type') as MapTypeOption;
        const mStyle = btn.getAttribute('data-map-style') as MapStyleOption;
        if (mType) {
          mapsType = mType;
          mapsStyle = mStyle || 'standard';
          drawerBody.querySelectorAll<HTMLButtonElement>('[data-map-type]').forEach((b) => b.classList.remove('is-active'));
          btn.classList.add('is-active');
          updateMapPreview();
        }
      });
    });

    zoomSlider?.addEventListener('input', () => {
      mapsZoom = Number(zoomSlider.value);
      updateMapPreview();
    });

    markerCheck?.addEventListener('change', () => {
      mapsShowMarker = markerCheck.checked;
      updateMapPreview();
    });

    btnInsert?.addEventListener('click', async () => {
      const controller = getActiveCanvasController();
      const canvasType = getActiveCanvasType();
      if (!controller) {
        showToast('No se encontró el controlador del lienzo activo', 'warning');
        return;
      }

      const mapUrl = buildStaticMapUrl({
        address: mapsAddress,
        height: 480,
        mapType: mapsType,
        showMarker: mapsShowMarker,
        styleTheme: mapsStyle,
        width: 640,
        zoom: mapsZoom,
      });

      showToast(`Generando mapa de «${mapsAddress}»...`, 'info');

      try {
        const res = await fetchMapImageBlob(mapUrl);
        if (canvasType === 'doc') {
          controller.insertImage(res.dataUrl, `Mapa: ${mapsAddress}`, '75%');
        } else {
          controller.insertImage?.(res.dataUrl, 640, 480, `Mapa: ${mapsAddress}`);
        }
        showToast(`Mapa de «${mapsAddress}» insertado en el lienzo`, 'success');
        if (window.innerWidth <= 768) {
          toggleDrawer(false);
        }
      } catch {
        if (canvasType === 'doc') {
          controller.insertImage(mapUrl, `Mapa: ${mapsAddress}`, '75%');
        } else {
          controller.insertImage?.(mapUrl, 640, 480, `Mapa: ${mapsAddress}`);
        }
        showToast(`Mapa de «${mapsAddress}» insertado`, 'success');
        if (window.innerWidth <= 768) {
          toggleDrawer(false);
        }
      }
    });

    if (sidebar) {
      updateCanvasRailActiveState(sidebar);
    }
    renderIcons(drawerBody);
  }
}

export const googleMapsPlugin = new GoogleMapsPlugin();
