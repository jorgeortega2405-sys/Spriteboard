import { openModal } from '../../components/modal.component.js';
import { showToast } from '../../services/toast.service.js';
import { setupDropdown } from '../../utils/dom.util.js';
import { validateAndSanitizeFile } from '../../utils/validators.util.js';
import { DocPaginationManager } from './doc-pagination.manager.js';
import { DOC_MARGIN_PRESETS, DocColumnsCount, DocPageBorder, DocPageColor, DocPaperSize, DocProject } from './doc.types.js';

const SPECIAL_SYMBOLS = [
  '©', '®', '™', '§', '¶', '†', '‡', '•', '–', '—',
  '€', '$', '£', '¥', '₹', '¢', '°', '±', '×', '÷',
  '≠', '≤', '≥', '≈', '∞', '√', '∑', '∏', 'π', 'µ',
  'α', 'β', 'γ', 'δ', 'θ', 'λ', 'σ', 'ω', 'Δ', 'Ω',
  '→', '←', '↑', '↓', '↔', '⇒', '⇔', '✓', '✗', '★',
];
export interface DocModalsContext {
  container: HTMLElement;
  paginationManager: DocPaginationManager;
  project: DocProject;
  recordChange: () => void;
  renderDocument: () => void;
}

export class DocModalsManager {
  private ctx: DocModalsContext;

  constructor(ctx: DocModalsContext) {
    this.ctx = ctx;
  }

  public openWatermarkModal(): void {
    const wm = this.ctx.project.settings.watermark || { enabled: false, text: 'CONFIDENCIAL', type: 'text' };
    openModal({
      bodyHtml: `
        <div class="settings-group">
          <div class="settings-item">
            <div class="settings-item__content">
              <div class="settings-item__text">
                <h3 class="settings-item__title">Activar marca de agua</h3>
                <p class="settings-item__desc">Muestra un texto o sello gráfico tenue en el fondo de cada página.</p>
              </div>
            </div>
            <div class="settings-item__actions">
              <input class="field__input" data-ref="modal-wm-enabled" type="checkbox" ${wm.enabled ? 'checked' : ''} style="width: 20px; height: 20px; accent-color: #3b82f6;" />
            </div>
          </div>
        </div>

        <div class="settings-group">
          <div class="settings-item">
            <div class="settings-item__content">
              <div class="settings-item__text">
                <h3 class="settings-item__title">Texto de la marca de agua</h3>
                <p class="settings-item__desc">Elige un texto predeterminado o escribe uno personalizado.</p>
              </div>
            </div>
            <div class="settings-item__actions" style="display: flex; flex-direction: column; gap: 8px;">
              <input class="design-options-text-input" data-ref="modal-wm-text" type="text" value="${wm.text || 'CONFIDENCIAL'}" placeholder="Ej. CONFIDENCIAL, BORRADOR..." style="width: 100%;" />
              <div style="display: flex; gap: 6px; flex-wrap: wrap;">
                <button type="button" class="component-button component-button--h28 component-button--secondary" data-ref="btn-wm-preset-confidential">CONFIDENCIAL</button>
                <button type="button" class="component-button component-button--h28 component-button--secondary" data-ref="btn-wm-preset-draft">BORRADOR</button>
                <button type="button" class="component-button component-button--h28 component-button--secondary" data-ref="btn-wm-preset-copy">COPIA</button>
                <button type="button" class="component-button component-button--h28 component-button--secondary" data-ref="btn-wm-preset-urgent">URGENTE</button>
              </div>
            </div>
          </div>
        </div>
      `,
      confirmText: 'Guardar marca de agua',
      onConfirm: () => {
        const modalEl = document.querySelector('.modal-card');
        if (!modalEl) return;
        const chkEnabled = modalEl.querySelector<HTMLInputElement>('[data-ref="modal-wm-enabled"]');
        const txtWatermark = modalEl.querySelector<HTMLInputElement>('[data-ref="modal-wm-text"]');

        this.ctx.project.settings.watermark = {
          enabled: Boolean(chkEnabled?.checked),
          text: txtWatermark?.value.trim().toUpperCase() || 'CONFIDENCIAL',
          type: 'text',
        };

        this.ctx.renderDocument();
        this.ctx.recordChange();
        showToast('Marca de agua actualizada', 'success');
      },
      title: 'Marca de Agua del Documento',
    });

    setTimeout(() => {
      const modalEl = document.querySelector('.modal-card');
      if (!modalEl) return;
      const txt = modalEl.querySelector<HTMLInputElement>('[data-ref="modal-wm-text"]');
      modalEl.querySelectorAll<HTMLElement>('[data-ref^="btn-wm-preset-"]').forEach((btn) => {
        btn.addEventListener('click', () => {
          if (txt) txt.value = btn.textContent?.trim() || '';
        });
      });
    }, 100);
  }

  public openPageDesignModal(): void {
    let curTheme: DocPageColor = (this.ctx.project.settings.pageColor || 'white') as DocPageColor;
    let curBorder: DocPageBorder = (this.ctx.project.settings.pageBorder || 'none') as DocPageBorder;
    let curCols: DocColumnsCount = (this.ctx.project.settings.columnsCount || 1) as DocColumnsCount;

    const themeLabels: Record<DocPageColor, string> = {
      white: 'Blanco puro',
      cream: 'Marfil / Crema suave',
      sepia: 'Sepia cálido',
      editorial: 'Gris editorial (#f8fafc)',
    };

    const borderLabels: Record<DocPageBorder, string> = {
      none: 'Sin borde',
      thin: 'Borde fino (1.5px)',
      double: 'Borde doble clásico',
      dashed: 'Borde punteado',
    };

    openModal({
      bodyHtml: `
        <div class="settings-group">
          <div class="settings-item">
            <div class="settings-item__content">
              <div class="settings-item__text">
                <h3 class="settings-item__title">Tono de papel</h3>
                <p class="settings-item__desc">Color de fondo estético para lectura y edición.</p>
              </div>
            </div>
            <div class="settings-item__actions">
              <div class="dropdown-wrapper dropdown-wrapper--w-200" data-ref="dropdown-wrapper-modal-theme">
                <button type="button" class="dropdown-trigger" data-ref="btn-trigger-modal-theme" aria-label="Tono de papel">
                  <div class="dropdown-trigger__left">
                    <svg class="component-icon dropdown-trigger__icon" aria-hidden="true"><use href="/icons.svg#palette"></use></svg>
                    <span class="dropdown-trigger__text" data-ref="modal-theme-selected-text">${themeLabels[curTheme] || 'Blanco puro'}</span>
                  </div>
                  <svg class="component-icon dropdown-trigger__chevron" aria-hidden="true"><use href="/icons.svg#expand_more"></use></svg>
                </button>
                <div class="dropdown-backdrop" data-ref="dropdown-backdrop-modal-theme">
                  <div class="menu-panel menu-panel--dropdown menu-panel--w-200 menu-panel--h-auto" data-ref="dropdown-menu-modal-theme">
                    <div class="menu-panel__list">
                      <button type="button" class="menu-item${curTheme === 'white' ? ' is-active' : ''}" data-ref="btn-opt-theme-white" data-value="white"><span class="menu-item__text">Blanco puro</span></button>
                      <button type="button" class="menu-item${curTheme === 'cream' ? ' is-active' : ''}" data-ref="btn-opt-theme-cream" data-value="cream"><span class="menu-item__text">Marfil / Crema suave</span></button>
                      <button type="button" class="menu-item${curTheme === 'sepia' ? ' is-active' : ''}" data-ref="btn-opt-theme-sepia" data-value="sepia"><span class="menu-item__text">Sepia cálido</span></button>
                      <button type="button" class="menu-item${curTheme === 'editorial' ? ' is-active' : ''}" data-ref="btn-opt-theme-editorial" data-value="editorial"><span class="menu-item__text">Gris editorial (#f8fafc)</span></button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="settings-group">
          <div class="settings-item">
            <div class="settings-item__content">
              <div class="settings-item__text">
                <h3 class="settings-item__title">Borde de página</h3>
                <p class="settings-item__desc">Enmarcado perimetral del documento.</p>
              </div>
            </div>
            <div class="settings-item__actions">
              <div class="dropdown-wrapper dropdown-wrapper--w-200" data-ref="dropdown-wrapper-modal-border">
                <button type="button" class="dropdown-trigger" data-ref="btn-trigger-modal-border" aria-label="Borde de página">
                  <div class="dropdown-trigger__left">
                    <svg class="component-icon dropdown-trigger__icon" aria-hidden="true"><use href="/icons.svg#border_style"></use></svg>
                    <span class="dropdown-trigger__text" data-ref="modal-border-selected-text">${borderLabels[curBorder] || 'Sin borde'}</span>
                  </div>
                  <svg class="component-icon dropdown-trigger__chevron" aria-hidden="true"><use href="/icons.svg#expand_more"></use></svg>
                </button>
                <div class="dropdown-backdrop" data-ref="dropdown-backdrop-modal-border">
                  <div class="menu-panel menu-panel--dropdown menu-panel--w-200 menu-panel--h-auto" data-ref="dropdown-menu-modal-border">
                    <div class="menu-panel__list">
                      <button type="button" class="menu-item${curBorder === 'none' ? ' is-active' : ''}" data-ref="btn-opt-border-none" data-value="none"><span class="menu-item__text">Sin borde</span></button>
                      <button type="button" class="menu-item${curBorder === 'thin' ? ' is-active' : ''}" data-ref="btn-opt-border-thin" data-value="thin"><span class="menu-item__text">Borde fino (1.5px)</span></button>
                      <button type="button" class="menu-item${curBorder === 'double' ? ' is-active' : ''}" data-ref="btn-opt-border-double" data-value="double"><span class="menu-item__text">Borde doble clásico</span></button>
                      <button type="button" class="menu-item${curBorder === 'dashed' ? ' is-active' : ''}" data-ref="btn-opt-border-dashed" data-value="dashed"><span class="menu-item__text">Borde punteado</span></button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="settings-group">
          <div class="settings-item">
            <div class="settings-item__content">
              <div class="settings-item__text">
                <h3 class="settings-item__title">Distribución en columnas</h3>
                <p class="settings-item__desc">Divide el flujo del texto tipo periódico o boletín.</p>
              </div>
            </div>
            <div class="settings-item__actions" style="display: flex; gap: 8px;">
              <button type="button" class="component-button component-button--h32 ${curCols === 1 ? 'component-button--black' : 'component-button--secondary'}" data-ref="modal-btn-col-1">1 Columna</button>
              <button type="button" class="component-button component-button--h32 ${curCols === 2 ? 'component-button--black' : 'component-button--secondary'}" data-ref="modal-btn-col-2">2 Columnas</button>
              <button type="button" class="component-button component-button--h32 ${curCols === 3 ? 'component-button--black' : 'component-button--secondary'}" data-ref="modal-btn-col-3">3 Columnas</button>
            </div>
          </div>
        </div>
      `,
      confirmText: 'Aplicar diseño',
      onConfirm: () => {
        this.ctx.project.settings.pageColor = curTheme;
        this.ctx.project.settings.pageBorder = curBorder;
        this.ctx.project.settings.columnsCount = curCols;

        this.ctx.renderDocument();
        this.ctx.recordChange();
        showToast('Diseño de hoja actualizado', 'success');
      },
      title: 'Diseño y Formato de Hoja',
    });

    setTimeout(() => {
      const modalEl = document.querySelector('.modal-card');
      if (!modalEl) return;

      const themeWrapper = modalEl.querySelector<HTMLElement>('[data-ref="dropdown-wrapper-modal-theme"]');
      const themeTrigger = modalEl.querySelector<HTMLElement>('[data-ref="btn-trigger-modal-theme"]');
      const themeMenu = modalEl.querySelector<HTMLElement>('[data-ref="dropdown-menu-modal-theme"]');
      const themeBackdrop = modalEl.querySelector<HTMLElement>('[data-ref="dropdown-backdrop-modal-theme"]');
      const themeText = modalEl.querySelector<HTMLElement>('[data-ref="modal-theme-selected-text"]');

      if (themeWrapper && themeTrigger && themeMenu) {
        setupDropdown(themeWrapper, { backdrop: themeBackdrop || undefined, menu: themeMenu, trigger: themeTrigger });
        themeMenu.addEventListener('click', (e) => {
          const item = (e.target as HTMLElement).closest<HTMLElement>('.menu-item');
          if (!item) return;
          const val = item.getAttribute('data-value') as DocPageColor;
          if (val) {
            curTheme = val;
            themeMenu.querySelectorAll('.menu-item').forEach((m) => m.classList.toggle('is-active', m === item));
            if (themeText) themeText.textContent = themeLabels[val] || val;
          }
        });
      }

      const borderWrapper = modalEl.querySelector<HTMLElement>('[data-ref="dropdown-wrapper-modal-border"]');
      const borderTrigger = modalEl.querySelector<HTMLElement>('[data-ref="btn-trigger-modal-border"]');
      const borderMenu = modalEl.querySelector<HTMLElement>('[data-ref="dropdown-menu-modal-border"]');
      const borderBackdrop = modalEl.querySelector<HTMLElement>('[data-ref="dropdown-backdrop-modal-border"]');
      const borderText = modalEl.querySelector<HTMLElement>('[data-ref="modal-border-selected-text"]');

      if (borderWrapper && borderTrigger && borderMenu) {
        setupDropdown(borderWrapper, { backdrop: borderBackdrop || undefined, menu: borderMenu, trigger: borderTrigger });
        borderMenu.addEventListener('click', (e) => {
          const item = (e.target as HTMLElement).closest<HTMLElement>('.menu-item');
          if (!item) return;
          const val = item.getAttribute('data-value') as DocPageBorder;
          if (val) {
            curBorder = val;
            borderMenu.querySelectorAll('.menu-item').forEach((m) => m.classList.toggle('is-active', m === item));
            if (borderText) borderText.textContent = borderLabels[val] || val;
          }
        });
      }

      const b1 = modalEl.querySelector<HTMLElement>('[data-ref="modal-btn-col-1"]');
      const b2 = modalEl.querySelector<HTMLElement>('[data-ref="modal-btn-col-2"]');
      const b3 = modalEl.querySelector<HTMLElement>('[data-ref="modal-btn-col-3"]');

      const setCols = (active: DocColumnsCount) => {
        curCols = active;
        b1?.setAttribute('class', `component-button component-button--h32 ${active === 1 ? 'component-button--black' : 'component-button--secondary'}`);
        b2?.setAttribute('class', `component-button component-button--h32 ${active === 2 ? 'component-button--black' : 'component-button--secondary'}`);
        b3?.setAttribute('class', `component-button component-button--h32 ${active === 3 ? 'component-button--black' : 'component-button--secondary'}`);
      };

      b1?.addEventListener('click', () => setCols(1));
      b2?.addEventListener('click', () => setCols(2));
      b3?.addEventListener('click', () => setCols(3));
    }, 100);
  }

  public openSymbolsModal(): void {
    const symbolsHtml = SPECIAL_SYMBOLS.map((s) => `
      <button type="button" class="component-button component-button--h40 component-button--secondary" data-symbol="${s}" style="font-size: 16px; font-weight: 700;">${s}</button>
    `).join('');

    openModal({
      bodyHtml: `
        <p style="margin-top: 0; color: #64748b; font-size: 10pt;">Haz clic en cualquier carácter o símbolo para insertarlo en la posición actual del cursor:</p>
        <div style="display: grid; grid-template-columns: repeat(8, 1fr); gap: 8px; margin: 16px 0;">
          ${symbolsHtml}
        </div>
      `,
      confirmText: 'Cerrar',
      title: 'Símbolos y Caracteres Especiales',
    });

    setTimeout(() => {
      const modalEl = document.querySelector('.modal-card');
      if (!modalEl) return;
      modalEl.querySelectorAll<HTMLElement>('[data-symbol]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const sym = btn.getAttribute('data-symbol');
          if (sym) {
            document.execCommand('insertText', false, sym);
            this.ctx.recordChange();
            showToast(`Símbolo ${sym} insertado`, 'success');
          }
        });
      });
    }, 100);
  }

  public openLogoModal(): void {
    const fileInputLogo = this.ctx.container.querySelector<HTMLInputElement>('[data-ref="input-file-logo"]');
    if (!fileInputLogo) return;

    openModal({
      bodyHtml: `
        <div class="settings-group">
          <div class="settings-item">
            <div class="settings-item__content">
              <div class="settings-item__text">
                <h3 class="settings-item__title">Logo del encabezado</h3>
                <p class="settings-item__desc">Sube la insignia o logo corporativo que se reflejará en todas las páginas.</p>
              </div>
            </div>
            <div class="settings-item__actions" style="display: flex; gap: 8px;">
              <button type="button" class="component-button component-button--h32 component-button--black" data-ref="btn-modal-upload-logo">Seleccionar imagen</button>
              ${this.ctx.project.settings.headerLogoUrl ? `<button type="button" class="component-button component-button--h32 component-button--danger" data-ref="btn-modal-remove-logo">Quitar logo</button>` : ''}
            </div>
          </div>
        </div>

        <div class="settings-group">
          <div class="settings-item">
            <div class="settings-item__content">
              <div class="settings-item__text">
                <h3 class="settings-item__title">Posición del logo</h3>
                <p class="settings-item__desc">Alineación del logo en el encabezado.</p>
              </div>
            </div>
            <div class="settings-item__actions" style="display: flex; gap: 8px;">
              <button type="button" class="component-button component-button--h32 ${this.ctx.project.settings.headerLogoPosition !== 'right' ? 'component-button--black' : 'component-button--secondary'}" data-ref="modal-btn-logo-left">Izquierda</button>
              <button type="button" class="component-button component-button--h32 ${this.ctx.project.settings.headerLogoPosition === 'right' ? 'component-button--black' : 'component-button--secondary'}" data-ref="modal-btn-logo-right">Derecha</button>
            </div>
          </div>
        </div>
      `,
      confirmText: 'Aceptar',
      title: 'Logo del Encabezado',
    });

    setTimeout(() => {
      const modalEl = document.querySelector('.modal-card');
      if (!modalEl) return;

      const btnUpload = modalEl.querySelector<HTMLElement>('[data-ref="btn-modal-upload-logo"]');
      const btnRemove = modalEl.querySelector<HTMLElement>('[data-ref="btn-modal-remove-logo"]');
      const btnLeft = modalEl.querySelector<HTMLElement>('[data-ref="modal-btn-logo-left"]');
      const btnRight = modalEl.querySelector<HTMLElement>('[data-ref="modal-btn-logo-right"]');

      btnUpload?.addEventListener('click', () => {
        fileInputLogo.onchange = () => {
          const file = fileInputLogo.files?.[0];
          if (!file) return;
          const validation = validateAndSanitizeFile(file, { maxMb: 5 });
          if (!validation.valid || !validation.file) {
            showToast(validation.error || 'Archivo de imagen no válido.', 'error');
            fileInputLogo.value = '';
            return;
          }
          const reader = new FileReader();
          reader.onload = (e) => {
            const dataUrl = e.target?.result as string;
            if (dataUrl) {
              this.ctx.project.settings.headerLogoUrl = dataUrl;
              this.ctx.renderDocument();
              this.ctx.recordChange();
              showToast('Logo de encabezado actualizado', 'success');
            }
          };
          reader.readAsDataURL(validation.file);
          fileInputLogo.value = '';
        };
        fileInputLogo.click();
      });

      btnRemove?.addEventListener('click', () => {
        this.ctx.project.settings.headerLogoUrl = undefined;
        this.ctx.renderDocument();
        this.ctx.recordChange();
        showToast('Logo removido', 'success');
      });

      btnLeft?.addEventListener('click', () => {
        this.ctx.project.settings.headerLogoPosition = 'left';
        btnLeft.className = 'component-button component-button--h32 component-button--black';
        if (btnRight) btnRight.className = 'component-button component-button--h32 component-button--secondary';
        this.ctx.renderDocument();
        this.ctx.recordChange();
      });

      btnRight?.addEventListener('click', () => {
        this.ctx.project.settings.headerLogoPosition = 'right';
        btnRight.className = 'component-button component-button--h32 component-button--black';
        if (btnLeft) btnLeft.className = 'component-button component-button--h32 component-button--secondary';
        this.ctx.renderDocument();
        this.ctx.recordChange();
      });
    }, 100);
  }

  public openPageSetupModal(): void {
    let curPaper: DocPaperSize = this.ctx.project.settings.paperSize || 'a4';
    let curMarginsKey = 'normal';
    if (this.ctx.project.settings.margins.top === 48) curMarginsKey = 'narrow';
    else if (this.ctx.project.settings.margins.left === 192) curMarginsKey = 'wide';

    const paperLabels: Record<string, string> = {
      digital: 'Digital (Tamaño automático)',
      a4: 'A4 (21 × 29.7 cm)',
      a3: 'A3 (29.7 × 42 cm)',
      letter: 'Carta (8.5 × 11 in)',
      legal: 'Oficio (8.5 × 14 in)',
      a5: 'A5 (14.8 × 21 cm)',
      tabloid: 'Tabloide (11 × 17 in)',
    };

    const marginLabels: Record<string, string> = {
      normal: 'Normal (2.54 cm / 1 pulgada)',
      narrow: 'Estrecho (1.27 cm / 0.5 pulgada)',
      wide: 'Ancho (5.08 cm / 2 pulgadas)',
    };

    openModal({
      bodyHtml: `
        <div class="settings-group">
          <div class="settings-item">
            <div class="settings-item__content">
              <div class="settings-item__text">
                <h3 class="settings-item__title">Tamaño de papel</h3>
                <p class="settings-item__desc">Dimensiones físicas normalizadas para impresión y vista.</p>
              </div>
            </div>
            <div class="settings-item__actions">
              <div class="dropdown-wrapper dropdown-wrapper--w-220" data-ref="dropdown-wrapper-modal-paper">
                <button type="button" class="dropdown-trigger" data-ref="btn-trigger-modal-paper" aria-label="Tamaño de papel">
                  <div class="dropdown-trigger__left">
                    <svg class="component-icon dropdown-trigger__icon" aria-hidden="true"><use href="/icons.svg#description"></use></svg>
                    <span class="dropdown-trigger__text" data-ref="modal-paper-selected-text">${paperLabels[curPaper] || curPaper}</span>
                  </div>
                  <svg class="component-icon dropdown-trigger__chevron" aria-hidden="true"><use href="/icons.svg#expand_more"></use></svg>
                </button>
                <div class="dropdown-backdrop" data-ref="dropdown-backdrop-modal-paper">
                  <div class="menu-panel menu-panel--dropdown menu-panel--w-220 menu-panel--h-auto" data-ref="dropdown-menu-modal-paper" style="max-height: 220px; overflow-y: auto;">
                    <div class="menu-panel__list">
                      <button type="button" class="menu-item${curPaper === 'digital' ? ' is-active' : ''}" data-ref="btn-opt-paper-digital" data-value="digital"><span class="menu-item__text">Digital (Tamaño automático)</span></button>
                      <button type="button" class="menu-item${curPaper === 'a4' ? ' is-active' : ''}" data-ref="btn-opt-paper-a4" data-value="a4"><span class="menu-item__text">A4 (21 × 29.7 cm)</span></button>
                      <button type="button" class="menu-item${curPaper === 'a3' ? ' is-active' : ''}" data-ref="btn-opt-paper-a3" data-value="a3"><span class="menu-item__text">A3 (29.7 × 42 cm)</span></button>
                      <button type="button" class="menu-item${curPaper === 'letter' ? ' is-active' : ''}" data-ref="btn-opt-paper-letter" data-value="letter"><span class="menu-item__text">Carta (8.5 × 11 in)</span></button>
                      <button type="button" class="menu-item${curPaper === 'legal' ? ' is-active' : ''}" data-ref="btn-opt-paper-legal" data-value="legal"><span class="menu-item__text">Oficio (8.5 × 14 in)</span></button>
                      <button type="button" class="menu-item${curPaper === 'a5' ? ' is-active' : ''}" data-ref="btn-opt-paper-a5" data-value="a5"><span class="menu-item__text">A5 (14.8 × 21 cm)</span></button>
                      <button type="button" class="menu-item${curPaper === 'tabloid' ? ' is-active' : ''}" data-ref="btn-opt-paper-tabloid" data-value="tabloid"><span class="menu-item__text">Tabloide (11 × 17 in)</span></button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="settings-group">
          <div class="settings-item">
            <div class="settings-item__content">
              <div class="settings-item__text">
                <h3 class="settings-item__title">Orientación</h3>
                <p class="settings-item__desc">Disposición vertical u horizontal de las páginas.</p>
              </div>
            </div>
            <div class="settings-item__actions" style="display: flex; gap: 8px;">
              <button type="button" class="component-button component-button--h32 ${this.ctx.project.settings.orientation === 'portrait' ? 'component-button--black' : 'component-button--secondary'}" data-ref="modal-btn-portrait">Vertical</button>
              <button type="button" class="component-button component-button--h32 ${this.ctx.project.settings.orientation === 'landscape' ? 'component-button--black' : 'component-button--secondary'}" data-ref="modal-btn-landscape">Horizontal</button>
            </div>
          </div>
        </div>

        <div class="settings-group">
          <div class="settings-item">
            <div class="settings-item__content">
              <div class="settings-item__text">
                <h3 class="settings-item__title">Márgenes</h3>
                <p class="settings-item__desc">Espaciado perimetral del contenido.</p>
              </div>
            </div>
            <div class="settings-item__actions">
              <div class="dropdown-wrapper dropdown-wrapper--w-220" data-ref="dropdown-wrapper-modal-margins">
                <button type="button" class="dropdown-trigger" data-ref="btn-trigger-modal-margins" aria-label="Márgenes">
                  <div class="dropdown-trigger__left">
                    <svg class="component-icon dropdown-trigger__icon" aria-hidden="true"><use href="/icons.svg#straighten"></use></svg>
                    <span class="dropdown-trigger__text" data-ref="modal-margins-selected-text">${marginLabels[curMarginsKey] || curMarginsKey}</span>
                  </div>
                  <svg class="component-icon dropdown-trigger__chevron" aria-hidden="true"><use href="/icons.svg#expand_more"></use></svg>
                </button>
                <div class="dropdown-backdrop" data-ref="dropdown-backdrop-modal-margins">
                  <div class="menu-panel menu-panel--dropdown menu-panel--w-220 menu-panel--h-auto" data-ref="dropdown-menu-modal-margins">
                    <div class="menu-panel__list">
                      <button type="button" class="menu-item${curMarginsKey === 'normal' ? ' is-active' : ''}" data-ref="btn-opt-margins-normal" data-value="normal"><span class="menu-item__text">Normal (2.54 cm / 1 pulgada)</span></button>
                      <button type="button" class="menu-item${curMarginsKey === 'narrow' ? ' is-active' : ''}" data-ref="btn-opt-margins-narrow" data-value="narrow"><span class="menu-item__text">Estrecho (1.27 cm / 0.5 pulgada)</span></button>
                      <button type="button" class="menu-item${curMarginsKey === 'wide' ? ' is-active' : ''}" data-ref="btn-opt-margins-wide" data-value="wide"><span class="menu-item__text">Ancho (5.08 cm / 2 pulgadas)</span></button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="settings-group">
          <div class="settings-item">
            <div class="settings-item__content">
              <div class="settings-item__text">
                <h3 class="settings-item__title">Primera página diferente</h3>
                <p class="settings-item__desc">Oculta encabezado y pie de página en la portada o primera hoja.</p>
              </div>
            </div>
            <div class="settings-item__actions">
              <input class="field__input" data-ref="modal-first-page-diff" type="checkbox" ${this.ctx.project.settings.firstPageDifferent ? 'checked' : ''} style="width: 20px; height: 20px; accent-color: #3b82f6;" />
            </div>
          </div>
        </div>
      `,
      confirmText: 'Aplicar cambios',
      onConfirm: () => {
        const modalEl = document.querySelector('.modal-card');
        if (!modalEl) return;
        const chkDiff = modalEl.querySelector<HTMLInputElement>('[data-ref="modal-first-page-diff"]');
        const isLandscape = modalEl.querySelector('[data-ref="modal-btn-landscape"]')?.classList.contains('component-button--black');

        this.ctx.project.settings.paperSize = curPaper;
        this.ctx.project.settings.orientation = isLandscape ? 'landscape' : 'portrait';
        this.ctx.project.settings.firstPageDifferent = Boolean(chkDiff?.checked);
        this.ctx.project.settings.margins = DOC_MARGIN_PRESETS[curMarginsKey]?.margins || DOC_MARGIN_PRESETS.normal.margins;

        this.ctx.renderDocument();
        this.ctx.recordChange();
        showToast('Configuración de página actualizada', 'success');
      },
      title: 'Configuración de Página',
    });

    setTimeout(() => {
      const modalEl = document.querySelector('.modal-card');
      if (!modalEl) return;

      const paperWrapper = modalEl.querySelector<HTMLElement>('[data-ref="dropdown-wrapper-modal-paper"]');
      const paperTrigger = modalEl.querySelector<HTMLElement>('[data-ref="btn-trigger-modal-paper"]');
      const paperMenu = modalEl.querySelector<HTMLElement>('[data-ref="dropdown-menu-modal-paper"]');
      const paperBackdrop = modalEl.querySelector<HTMLElement>('[data-ref="dropdown-backdrop-modal-paper"]');
      const paperText = modalEl.querySelector<HTMLElement>('[data-ref="modal-paper-selected-text"]');

      if (paperWrapper && paperTrigger && paperMenu) {
        setupDropdown(paperWrapper, { backdrop: paperBackdrop || undefined, menu: paperMenu, trigger: paperTrigger });
        paperMenu.addEventListener('click', (e) => {
          const item = (e.target as HTMLElement).closest<HTMLElement>('.menu-item');
          if (!item) return;
          const val = item.getAttribute('data-value') as DocPaperSize;
          if (val) {
            curPaper = val;
            paperMenu.querySelectorAll('.menu-item').forEach((m) => m.classList.toggle('is-active', m === item));
            if (paperText) paperText.textContent = paperLabels[val] || val;
          }
        });
      }

      const marginsWrapper = modalEl.querySelector<HTMLElement>('[data-ref="dropdown-wrapper-modal-margins"]');
      const marginsTrigger = modalEl.querySelector<HTMLElement>('[data-ref="btn-trigger-modal-margins"]');
      const marginsMenu = modalEl.querySelector<HTMLElement>('[data-ref="dropdown-menu-modal-margins"]');
      const marginsBackdrop = modalEl.querySelector<HTMLElement>('[data-ref="dropdown-backdrop-modal-margins"]');
      const marginsText = modalEl.querySelector<HTMLElement>('[data-ref="modal-margins-selected-text"]');

      if (marginsWrapper && marginsTrigger && marginsMenu) {
        setupDropdown(marginsWrapper, { backdrop: marginsBackdrop || undefined, menu: marginsMenu, trigger: marginsTrigger });
        marginsMenu.addEventListener('click', (e) => {
          const item = (e.target as HTMLElement).closest<HTMLElement>('.menu-item');
          if (!item) return;
          const val = item.getAttribute('data-value');
          if (val) {
            curMarginsKey = val;
            marginsMenu.querySelectorAll('.menu-item').forEach((m) => m.classList.toggle('is-active', m === item));
            if (marginsText) marginsText.textContent = marginLabels[val] || val;
          }
        });
      }

      const btnP = modalEl.querySelector<HTMLElement>('[data-ref="modal-btn-portrait"]');
      const btnL = modalEl.querySelector<HTMLElement>('[data-ref="modal-btn-landscape"]');

      if (btnP && btnL) {
        btnP.addEventListener('click', () => {
          btnP.className = 'component-button component-button--h32 component-button--black';
          btnL.className = 'component-button component-button--h32 component-button--secondary';
        });
        btnL.addEventListener('click', () => {
          btnL.className = 'component-button component-button--h32 component-button--black';
          btnP.className = 'component-button component-button--h32 component-button--secondary';
        });
      }
    }, 100);
  }

  public openStatsModal(): void {
    const stats = this.ctx.paginationManager.calculateStats(this.ctx.project);
    openModal({
      bodyHtml: `
        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; margin: 10px 0;">
          <div style="background: var(--color-bg-secondary, #f8fafc); padding: 16px; border-radius: 8px; text-align: center;">
            <div style="font-size: 24pt; font-weight: 800; color: #3b82f6;">${stats.words.toLocaleString()}</div>
            <div style="font-size: 10pt; color: #64748b;">Palabras</div>
          </div>
          <div style="background: var(--color-bg-secondary, #f8fafc); padding: 16px; border-radius: 8px; text-align: center;">
            <div style="font-size: 24pt; font-weight: 800; color: #10b981;">${stats.pages}</div>
            <div style="font-size: 10pt; color: #64748b;">Páginas</div>
          </div>
          <div style="background: var(--color-bg-secondary, #f8fafc); padding: 16px; border-radius: 8px; text-align: center;">
            <div style="font-size: 24pt; font-weight: 800; color: #6366f1;">${stats.characters.toLocaleString()}</div>
            <div style="font-size: 10pt; color: #64748b;">Caracteres (con espacios)</div>
          </div>
          <div style="background: var(--color-bg-secondary, #f8fafc); padding: 16px; border-radius: 8px; text-align: center;">
            <div style="font-size: 24pt; font-weight: 800; color: #f59e0b;">${stats.readingTimeMinutes} min</div>
            <div style="font-size: 10pt; color: #64748b;">Tiempo estimado de lectura</div>
          </div>
        </div>
      `,
      confirmText: 'Aceptar',
      title: 'Estadísticas del Documento',
    });
  }
}
