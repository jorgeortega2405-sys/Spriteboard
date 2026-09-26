import { openModal } from '../../components/modal.component.js';
import { showToast } from '../../services/toast.service.js';
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
    const curTheme = this.ctx.project.settings.pageColor || 'white';
    const curBorder = this.ctx.project.settings.pageBorder || 'none';
    const curCols = this.ctx.project.settings.columnsCount || 1;

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
              <select class="settings-dropdown-wrapper" data-ref="modal-select-theme" style="padding: 8px 12px; border-radius: 6px; border: 1px solid #cbd5e1; background: transparent; color: inherit;">
                <option value="white" ${curTheme === 'white' ? 'selected' : ''}>Blanco puro</option>
                <option value="cream" ${curTheme === 'cream' ? 'selected' : ''}>Marfil / Crema suave</option>
                <option value="sepia" ${curTheme === 'sepia' ? 'selected' : ''}>Sepia cálido</option>
                <option value="editorial" ${curTheme === 'editorial' ? 'selected' : ''}>Gris editorial (#f8fafc)</option>
              </select>
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
              <select class="settings-dropdown-wrapper" data-ref="modal-select-border" style="padding: 8px 12px; border-radius: 6px; border: 1px solid #cbd5e1; background: transparent; color: inherit;">
                <option value="none" ${curBorder === 'none' ? 'selected' : ''}>Sin borde</option>
                <option value="thin" ${curBorder === 'thin' ? 'selected' : ''}>Borde fino (1.5px)</option>
                <option value="double" ${curBorder === 'double' ? 'selected' : ''}>Borde doble clásico</option>
                <option value="dashed" ${curBorder === 'dashed' ? 'selected' : ''}>Borde punteado</option>
              </select>
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
        const modalEl = document.querySelector('.modal-card');
        if (!modalEl) return;
        const selTheme = modalEl.querySelector<HTMLSelectElement>('[data-ref="modal-select-theme"]');
        const selBorder = modalEl.querySelector<HTMLSelectElement>('[data-ref="modal-select-border"]');
        let cols: DocColumnsCount = 1;
        if (modalEl.querySelector('[data-ref="modal-btn-col-2"]')?.classList.contains('component-button--black')) cols = 2;
        if (modalEl.querySelector('[data-ref="modal-btn-col-3"]')?.classList.contains('component-button--black')) cols = 3;

        if (selTheme) this.ctx.project.settings.pageColor = selTheme.value as DocPageColor;
        if (selBorder) this.ctx.project.settings.pageBorder = selBorder.value as DocPageBorder;
        this.ctx.project.settings.columnsCount = cols;

        this.ctx.renderDocument();
        this.ctx.recordChange();
        showToast('Diseño de hoja actualizado', 'success');
      },
      title: 'Diseño y Formato de Hoja',
    });

    setTimeout(() => {
      const modalEl = document.querySelector('.modal-card');
      if (!modalEl) return;
      const b1 = modalEl.querySelector<HTMLElement>('[data-ref="modal-btn-col-1"]');
      const b2 = modalEl.querySelector<HTMLElement>('[data-ref="modal-btn-col-2"]');
      const b3 = modalEl.querySelector<HTMLElement>('[data-ref="modal-btn-col-3"]');

      const setCols = (active: number) => {
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
              <select class="settings-dropdown-wrapper" data-ref="modal-select-paper" style="padding: 8px 12px; border-radius: 6px; border: 1px solid #cbd5e1; background: transparent; color: inherit;">
                <option value="digital" ${this.ctx.project.settings.paperSize === 'digital' ? 'selected' : ''}>Digital (Tamaño automático)</option>
                <option value="a4" ${this.ctx.project.settings.paperSize === 'a4' ? 'selected' : ''}>A4 (21 × 29.7 cm)</option>
                <option value="a3" ${this.ctx.project.settings.paperSize === 'a3' ? 'selected' : ''}>A3 (29.7 × 42 cm)</option>
                <option value="letter" ${this.ctx.project.settings.paperSize === 'letter' ? 'selected' : ''}>Carta (8.5 × 11 in)</option>
                <option value="legal" ${this.ctx.project.settings.paperSize === 'legal' ? 'selected' : ''}>Oficio (8.5 × 14 in)</option>
                <option value="a5" ${this.ctx.project.settings.paperSize === 'a5' ? 'selected' : ''}>A5 (14.8 × 21 cm)</option>
                <option value="tabloid" ${this.ctx.project.settings.paperSize === 'tabloid' ? 'selected' : ''}>Tabloide (11 × 17 in)</option>
              </select>
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
              <select class="settings-dropdown-wrapper" data-ref="modal-select-margins" style="padding: 8px 12px; border-radius: 6px; border: 1px solid #cbd5e1; background: transparent; color: inherit;">
                <option value="normal" ${this.ctx.project.settings.margins.top === 96 && this.ctx.project.settings.margins.left === 96 ? 'selected' : ''}>Normal (2.54 cm / 1 pulgada)</option>
                <option value="narrow" ${this.ctx.project.settings.margins.top === 48 ? 'selected' : ''}>Estrecho (1.27 cm / 0.5 pulgada)</option>
                <option value="wide" ${this.ctx.project.settings.margins.left === 192 ? 'selected' : ''}>Ancho (5.08 cm / 2 pulgadas)</option>
              </select>
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
        const selPaper = modalEl.querySelector<HTMLSelectElement>('[data-ref="modal-select-paper"]');
        const selMargins = modalEl.querySelector<HTMLSelectElement>('[data-ref="modal-select-margins"]');
        const chkDiff = modalEl.querySelector<HTMLInputElement>('[data-ref="modal-first-page-diff"]');
        const isLandscape = modalEl.querySelector('[data-ref="modal-btn-landscape"]')?.classList.contains('component-button--black');

        if (selPaper) {
          this.ctx.project.settings.paperSize = selPaper.value as DocPaperSize;
        }
        this.ctx.project.settings.orientation = isLandscape ? 'landscape' : 'portrait';
        this.ctx.project.settings.firstPageDifferent = Boolean(chkDiff?.checked);

        if (selMargins) {
          const mKey = selMargins.value;
          this.ctx.project.settings.margins = DOC_MARGIN_PRESETS[mKey]?.margins || DOC_MARGIN_PRESETS.normal.margins;
        }

        this.ctx.renderDocument();
        this.ctx.recordChange();
        showToast('Configuración de página actualizada', 'success');
      },
      title: 'Configuración de Página',
    });

    setTimeout(() => {
      const modalEl = document.querySelector('.modal-card');
      if (!modalEl) return;
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
