import { getActiveCanvasController, getActiveCanvasType, toggleDrawer, updateCanvasRailActiveState } from '../../components/layout.component.js';
import { renderIcons } from '../../services/icon.service.js';
import { showToast } from '../../services/toast.service.js';
import { AppPlugin, AppPluginContext } from '../plugin.types.js';

export class QrCodePlugin implements AppPlugin {
  public readonly id = 'qr-code';

  public render(ctx: AppPluginContext): void {
    const { drawer, drawerBody, onBack, onClose } = ctx;
    const sidebar = drawer.closest<HTMLElement>('[data-ref="sidebar"]') || document.querySelector<HTMLElement>('[data-ref="sidebar"]');

    void import('qr-code-styling').then(({ default: QRCodeStyling }) => {
      drawerBody.innerHTML = `
        <div class="canvas-panel-card" data-ref="canvas-panel-card">
          <div class="canvas-panel-card__header" data-ref="canvas-panel-header">
            <div class="canvas-panel-card__title-box" data-ref="canvas-panel-title-box">
              <svg class="component-icon canvas-panel-card__icon" aria-hidden="true"><use href="/icons.svg#qr_code"></use></svg>
              <span class="canvas-panel-card__title" data-ref="canvas-panel-title">Código QR</span>
            </div>
            <button type="button" class="component-button component-button--h32 component-button--icon-only rail-btn canvas-panel-card__close" data-ref="btn-close-canvas-panel" data-tooltip="Cerrar panel" aria-label="Cerrar panel">
              <svg class="component-icon rail-btn__icon" aria-hidden="true"><use href="/icons.svg#close"></use></svg>
            </button>
          </div>
          <div class="canvas-panel-card__body qr-drawer-body" data-ref="canvas-panel-body">
            <button type="button" class="elements-back-btn" data-ref="btn-apps-back" style="margin-bottom: 12px;">
              <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#arrow_back"></use></svg>
              <span>Volver a Apps</span>
            </button>

            <div class="qr-preview-wrapper" data-ref="qr-preview-wrapper">
              <div class="qr-preview-card" data-ref="qr-preview-card">
                <div class="qr-preview-box" data-ref="qr-preview-box"></div>
              </div>
            </div>

            <div class="qr-drawer-section" data-ref="qr-section-url">
              <label class="field" data-ref="field-qr-url">
                <input class="field__input" data-ref="qr-input-url" type="text" placeholder=" " value="https://spriteboard.com" autocomplete="off" />
                <span class="field__label">URL o contenido</span>
              </label>
            </div>

            <div class="qr-drawer-section" data-ref="qr-section-fg-color">
              <div class="qr-drawer-section__header">
                <span class="qr-drawer-section__title">Color del código</span>
                <span class="qr-drawer-section__hex" data-ref="qr-fg-hex-label">#000000</span>
              </div>
              <div class="qr-color-controls">
                <div class="design-color-btn-rainbow-wrapper" data-tooltip="Elegir color personalizado">
                  <input class="design-color-active-input" data-ref="input-qr-fg-color" type="color" value="#000000" aria-label="Color del código QR" />
                  <div class="design-color-btn-rainbow">
                    <div class="design-color-btn-rainbow__inner">
                      <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#add"></use></svg>
                    </div>
                  </div>
                </div>
                <div class="qr-swatches-grid" data-ref="qr-fg-swatches">
                  <button type="button" class="qr-swatch-btn is-active" data-ref="qr-fg-swatch-000000" data-color="#000000" style="background-color: #000000;" data-tooltip="Negro" aria-label="Negro"></button>
                  <button type="button" class="qr-swatch-btn" data-ref="qr-fg-swatch-1e293b" data-color="#1e293b" style="background-color: #1e293b;" data-tooltip="Pizarra" aria-label="Pizarra"></button>
                  <button type="button" class="qr-swatch-btn" data-ref="qr-fg-swatch-2563eb" data-color="#2563eb" style="background-color: #2563eb;" data-tooltip="Azul" aria-label="Azul"></button>
                  <button type="button" class="qr-swatch-btn" data-ref="qr-fg-swatch-7c3aed" data-color="#7c3aed" style="background-color: #7c3aed;" data-tooltip="Violeta" aria-label="Violeta"></button>
                  <button type="button" class="qr-swatch-btn" data-ref="qr-fg-swatch-db2777" data-color="#db2777" style="background-color: #db2777;" data-tooltip="Rosa" aria-label="Rosa"></button>
                  <button type="button" class="qr-swatch-btn" data-ref="qr-fg-swatch-059669" data-color="#059669" style="background-color: #059669;" data-tooltip="Esmeralda" aria-label="Esmeralda"></button>
                  <button type="button" class="qr-swatch-btn" data-ref="qr-fg-swatch-ea580c" data-color="#ea580c" style="background-color: #ea580c;" data-tooltip="Naranja" aria-label="Naranja"></button>
                </div>
              </div>
            </div>

            <div class="qr-drawer-section" data-ref="qr-section-bg-color">
              <div class="qr-drawer-section__header">
                <span class="qr-drawer-section__title">Color de fondo</span>
                <span class="qr-drawer-section__hex" data-ref="qr-bg-hex-label">#FFFFFF</span>
              </div>
              <div class="qr-color-controls">
                <div class="design-color-btn-rainbow-wrapper" data-tooltip="Elegir color personalizado">
                  <input class="design-color-active-input" data-ref="input-qr-bg-color" type="color" value="#ffffff" aria-label="Color de fondo" />
                  <div class="design-color-btn-rainbow">
                    <div class="design-color-btn-rainbow__inner">
                      <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#add"></use></svg>
                    </div>
                  </div>
                </div>
                <div class="qr-swatches-grid" data-ref="qr-bg-swatches">
                  <button type="button" class="qr-swatch-btn is-active" data-ref="qr-bg-swatch-ffffff" data-color="#ffffff" style="background-color: #ffffff;" data-tooltip="Blanco" aria-label="Blanco"></button>
                  <button type="button" class="qr-swatch-btn qr-swatch-btn--transparent" data-ref="qr-bg-swatch-transparent" data-color="transparent" data-tooltip="Transparente" aria-label="Transparente"></button>
                  <button type="button" class="qr-swatch-btn" data-ref="qr-bg-swatch-000000" data-color="#000000" style="background-color: #000000;" data-tooltip="Negro" aria-label="Negro"></button>
                  <button type="button" class="qr-swatch-btn" data-ref="qr-bg-swatch-f8fafc" data-color="#f8fafc" style="background-color: #f8fafc;" data-tooltip="Gris claro" aria-label="Gris claro"></button>
                  <button type="button" class="qr-swatch-btn" data-ref="qr-bg-swatch-fef3c7" data-color="#fef3c7" style="background-color: #fef3c7;" data-tooltip="Crema" aria-label="Crema"></button>
                  <button type="button" class="qr-swatch-btn" data-ref="qr-bg-swatch-eff6ff" data-color="#eff6ff" style="background-color: #eff6ff;" data-tooltip="Azul pastel" aria-label="Azul pastel"></button>
                  <button type="button" class="qr-swatch-btn" data-ref="qr-bg-swatch-fdf2f8" data-color="#fdf2f8" style="background-color: #fdf2f8;" data-tooltip="Rosa pastel" aria-label="Rosa pastel"></button>
                </div>
              </div>
            </div>

            <div class="qr-drawer-section" data-ref="qr-section-margin">
              <div class="qr-drawer-section__header">
                <span class="qr-drawer-section__title">Margen</span>
                <span class="qr-drawer-section__value" data-ref="qr-margin-val-label">10px</span>
              </div>
              <div class="qr-slider-row">
                <input class="qr-range-slider" data-ref="slider-qr-margin" type="range" min="0" max="40" step="2" value="10" aria-label="Margen del código QR" />
              </div>
            </div>

            <div class="qr-drawer-actions" data-ref="qr-drawer-actions">
              <button type="button" class="component-button component-button--h44 component-button--black component-button--w-full" data-ref="btn-insert-qr">
                <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#add"></use></svg>
                <span>Agregar al diseño</span>
              </button>
            </div>
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

      const previewBox = drawerBody.querySelector<HTMLElement>('[data-ref="qr-preview-box"]');
      const inputUrl = drawerBody.querySelector<HTMLInputElement>('[data-ref="qr-input-url"]');
      const inputFgColor = drawerBody.querySelector<HTMLInputElement>('[data-ref="input-qr-fg-color"]');
      const inputBgColor = drawerBody.querySelector<HTMLInputElement>('[data-ref="input-qr-bg-color"]');
      const fgHexLabel = drawerBody.querySelector<HTMLElement>('[data-ref="qr-fg-hex-label"]');
      const bgHexLabel = drawerBody.querySelector<HTMLElement>('[data-ref="qr-bg-hex-label"]');
      const sliderMargin = drawerBody.querySelector<HTMLInputElement>('[data-ref="slider-qr-margin"]');
      const marginValLabel = drawerBody.querySelector<HTMLElement>('[data-ref="qr-margin-val-label"]');
      const btnInsert = drawerBody.querySelector<HTMLButtonElement>('[data-ref="btn-insert-qr"]');
      const fgSwatches = drawerBody.querySelectorAll<HTMLButtonElement>('[data-ref="qr-fg-swatches"] .qr-swatch-btn');
      const bgSwatches = drawerBody.querySelectorAll<HTMLButtonElement>('[data-ref="qr-bg-swatches"] .qr-swatch-btn');

      let currentUrl = 'https://spriteboard.com';
      let currentFg = '#000000';
      let currentBg = '#ffffff';
      let currentMargin = 10;

      const qrInstance = new QRCodeStyling({
        width: 200,
        height: 200,
        data: currentUrl,
        margin: currentMargin,
        qrOptions: { errorCorrectionLevel: 'Q' },
        dotsOptions: { color: currentFg, type: 'square' },
        cornersSquareOptions: { color: currentFg, type: 'square' },
        cornersDotOptions: { color: currentFg, type: 'square' },
        backgroundOptions: { color: currentBg === 'transparent' ? '#00000000' : currentBg },
      });

      if (previewBox) {
        previewBox.innerHTML = '';
        qrInstance.append(previewBox);
      }

      const updatePreview = () => {
        qrInstance.update({
          data: currentUrl.trim() || 'https://spriteboard.com',
          margin: currentMargin,
          dotsOptions: { color: currentFg, type: 'square' },
          cornersSquareOptions: { color: currentFg, type: 'square' },
          cornersDotOptions: { color: currentFg, type: 'square' },
          backgroundOptions: { color: currentBg === 'transparent' ? '#00000000' : currentBg },
        });
      };

      inputUrl?.addEventListener('input', () => {
        currentUrl = inputUrl.value;
        updatePreview();
      });

      const setFgColor = (color: string) => {
        currentFg = color;
        if (inputFgColor) inputFgColor.value = color;
        if (fgHexLabel) fgHexLabel.textContent = color.toUpperCase();
        fgSwatches.forEach((s) => s.classList.toggle('is-active', s.getAttribute('data-color')?.toLowerCase() === color.toLowerCase()));
        updatePreview();
      };

      const setBgColor = (color: string) => {
        currentBg = color;
        if (inputBgColor && color !== 'transparent') inputBgColor.value = color;
        if (bgHexLabel) bgHexLabel.textContent = color === 'transparent' ? 'TRANSPARENTE' : color.toUpperCase();
        bgSwatches.forEach((s) => s.classList.toggle('is-active', s.getAttribute('data-color')?.toLowerCase() === color.toLowerCase()));
        updatePreview();
      };

      inputFgColor?.addEventListener('input', () => {
        setFgColor(inputFgColor.value);
      });

      inputBgColor?.addEventListener('input', () => {
        setBgColor(inputBgColor.value);
      });

      fgSwatches.forEach((btn) => {
        btn.addEventListener('click', () => {
          const color = btn.getAttribute('data-color');
          if (color) setFgColor(color);
        });
      });

      bgSwatches.forEach((btn) => {
        btn.addEventListener('click', () => {
          const color = btn.getAttribute('data-color');
          if (color) setBgColor(color);
        });
      });

      sliderMargin?.addEventListener('input', () => {
        currentMargin = parseInt(sliderMargin.value, 10) || 0;
        if (marginValLabel) marginValLabel.textContent = `${currentMargin}px`;
        updatePreview();
      });

      btnInsert?.addEventListener('click', async () => {
        try {
          btnInsert.disabled = true;

          const exportQr = new QRCodeStyling({
            width: 600,
            height: 600,
            data: currentUrl.trim() || 'https://spriteboard.com',
            margin: currentMargin * 2,
            qrOptions: { errorCorrectionLevel: 'Q' },
            dotsOptions: { color: currentFg, type: 'square' },
            cornersSquareOptions: { color: currentFg, type: 'square' },
            cornersDotOptions: { color: currentFg, type: 'square' },
            backgroundOptions: { color: currentBg === 'transparent' ? '#00000000' : currentBg },
          });

          const blob = (await exportQr.getRawData('png')) as Blob | null;
          if (!blob) {
            showToast('Error al generar el código QR', 'danger');
            return;
          }

          const dataUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });

          const canvasType = getActiveCanvasType();
          const controller = getActiveCanvasController();

          if (canvasType === 'doc') {
            if (!controller) {
              showToast('No se encontró el controlador del documento', 'warning');
              return;
            }
            controller.insertImage(dataUrl, 'Código QR', '220px');
          } else {
            if (!controller) {
              showToast('No se encontró el controlador del lienzo', 'warning');
              return;
            }
            controller.insertImage?.(dataUrl, 260, 260, 'Código QR');
          }

          showToast('Código QR agregado al diseño', 'success');
          if (window.innerWidth <= 768) {
            toggleDrawer(false);
          }
        } catch {
          showToast('Error al generar el código QR', 'danger');
        } finally {
          btnInsert.disabled = false;
        }
      });

      if (sidebar) {
        updateCanvasRailActiveState(sidebar);
      }
      renderIcons(drawerBody);
    });
  }
}

export const qrCodePlugin = new QrCodePlugin();
