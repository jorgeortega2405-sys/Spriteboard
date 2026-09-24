import { navigate } from '../app-router.js';
import { API_ROUTES } from '../config/api-routes.js';
import { currentUser, escapeHtml, getApi, postFormApi } from '../services/api.service.js';
import { renderIcons } from '../services/icon.service.js';
import { loadTemplate } from '../services/template.service.js';
import { showToast } from '../services/toast.service.js';
import { DesignerApplicationItem, DesignerStatusResponse } from '../types/designer.types.js';
import { withButtonLoading } from '../utils/dom.util.js';

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return iso;
  }
}

export class DesignerApplyController {
  private abortController = new AbortController();
  private container: HTMLElement;
  private currentStep = 1;
  private portfolioLinks: string[] = [];
  private selectedFiles: File[] = [];
  private selectedRole = 'designer';

  constructor(container: HTMLElement) {
    this.container = container;
  }

  public async init(): Promise<void> {
    this.bindEvents();
    renderIcons(this.container);
    await this.loadApplicationStatus();
  }

  public destroy(): void {
    this.abortController.abort();
  }

  private goToStep(step: number): void {
    this.currentStep = Math.max(1, Math.min(4, step));

    const progressFill = this.container.querySelector<HTMLElement>('[data-ref="wizard-progress-fill"]');
    const stepIndicator = this.container.querySelector<HTMLElement>('[data-ref="wizard-step-indicator"]');
    const btnBack = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-step-back"]');

    if (progressFill) {
      progressFill.style.width = `${(this.currentStep / 4) * 100}%`;
    }

    if (stepIndicator) {
      stepIndicator.textContent = `Paso ${this.currentStep} de 4`;
    }

    if (btnBack) {
      btnBack.style.visibility = this.currentStep > 1 ? 'visible' : 'hidden';
    }

    for (let i = 1; i <= 4; i++) {
      const stepEl = this.container.querySelector<HTMLElement>(`[data-ref="step-${i}"]`);
      if (stepEl) {
        if (i === this.currentStep) {
          stepEl.classList.add('is-active');
        } else {
          stepEl.classList.remove('is-active');
        }
      }
    }

    renderIcons(this.container);
  }

  private async loadApplicationStatus(): Promise<void> {
    if (!currentUser) return;

    try {
      const res = await getApi(API_ROUTES.designerApplications.myStatus);
      if (!res.ok) return;

      const data: DesignerStatusResponse = await res.json();
      if (data.is_designer) {
        this.renderStatusApproved();
        return;
      }

      if (data.application) {
        this.renderStatusApplication(data.application);
      }
    } catch {}
  }

  private renderStatusApproved(): void {
    const statusCard = this.container.querySelector<HTMLElement>('[data-ref="designer-status-card"]');
    const wizardCard = this.container.querySelector<HTMLElement>('[data-ref="designer-wizard-card"]');
    if (!statusCard || !wizardCard) return;

    wizardCard.style.display = 'none';
    statusCard.style.display = 'block';

    const iconBox = statusCard.querySelector<HTMLElement>('[data-ref="status-icon-box"]');
    const icon = statusCard.querySelector<SVGElement>('[data-ref="status-icon"]');
    const title = statusCard.querySelector<HTMLElement>('[data-ref="status-title"]');
    const pill = statusCard.querySelector<HTMLElement>('[data-ref="status-pill"]');
    const msg = statusCard.querySelector<HTMLElement>('[data-ref="status-message"]');
    const summary = statusCard.querySelector<HTMLElement>('[data-ref="status-details-summary"]');

    if (iconBox) {
      iconBox.style.background = 'rgba(16, 185, 129, 0.12)';
      iconBox.style.color = '#10b981';
    }
    if (icon) icon.innerHTML = '<use href="/icons.svg#check_circle"></use>';
    if (title) title.textContent = '¡Ya eres Diseñador Verificado!';
    if (pill) {
      pill.className = 'component-badge component-badge--success';
      pill.textContent = 'Creador Oficial';
    }
    if (msg) {
      msg.textContent = 'Tu cuenta cuenta con los permisos para publicar y gestionar plantillas comunitarias en Spriteboard.';
    }
    if (summary) summary.style.display = 'none';

    renderIcons(statusCard);
  }

  private renderStatusApplication(app: DesignerApplicationItem): void {
    const statusCard = this.container.querySelector<HTMLElement>('[data-ref="designer-status-card"]');
    const wizardCard = this.container.querySelector<HTMLElement>('[data-ref="designer-wizard-card"]');
    if (!statusCard || !wizardCard) return;

    if (app.status === 'pending') {
      wizardCard.style.display = 'none';
      statusCard.style.display = 'block';

      const iconBox = statusCard.querySelector<HTMLElement>('[data-ref="status-icon-box"]');
      const icon = statusCard.querySelector<SVGElement>('[data-ref="status-icon"]');
      const title = statusCard.querySelector<HTMLElement>('[data-ref="status-title"]');
      const pill = statusCard.querySelector<HTMLElement>('[data-ref="status-pill"]');
      const msg = statusCard.querySelector<HTMLElement>('[data-ref="status-message"]');

      if (iconBox) {
        iconBox.style.background = 'rgba(245, 158, 11, 0.12)';
        iconBox.style.color = '#f59e0b';
      }
      if (icon) icon.innerHTML = '<use href="/icons.svg#schedule"></use>';
      if (title) title.textContent = 'Solicitud en Revisión';
      if (pill) {
        pill.className = 'component-badge component-badge--warning';
        pill.textContent = 'Pendiente';
      }
      if (msg) {
        msg.textContent = 'Hemos recibido tu postulación. El equipo de moderadores la revisará a la brevedad posible.';
      }

      this.populateStatusSummary(app);
      renderIcons(statusCard);
    } else if (app.status === 'rejected') {
      statusCard.style.display = 'block';
      wizardCard.style.display = 'none';

      const iconBox = statusCard.querySelector<HTMLElement>('[data-ref="status-icon-box"]');
      const icon = statusCard.querySelector<SVGElement>('[data-ref="status-icon"]');
      const title = statusCard.querySelector<HTMLElement>('[data-ref="status-title"]');
      const pill = statusCard.querySelector<HTMLElement>('[data-ref="status-pill"]');
      const msg = statusCard.querySelector<HTMLElement>('[data-ref="status-message"]');
      const btnReapply = statusCard.querySelector<HTMLElement>('[data-ref="btn-reapply"]');
      const rejectionBox = statusCard.querySelector<HTMLElement>('[data-ref="rejection-feedback-box"]');
      const rejectionText = statusCard.querySelector<HTMLElement>('[data-ref="rejection-reason-text"]');

      if (iconBox) {
        iconBox.style.background = 'rgba(239, 68, 68, 0.12)';
        iconBox.style.color = '#ef4444';
      }
      if (icon) icon.innerHTML = '<use href="/icons.svg#cancel"></use>';
      if (title) title.textContent = 'Postulación no admitida';
      if (pill) {
        pill.className = 'component-badge component-badge--danger';
        pill.textContent = 'No admitida';
      }
      if (msg) {
        msg.textContent = 'Tu postulación anterior no fue admitida en esta ocasión. Puedes revisar las pautas y enviar una nueva solicitud cuando lo desees.';
      }
      if (btnReapply) {
        btnReapply.style.display = 'inline-flex';
      }
      if (rejectionBox && rejectionText && app.rejection_reason) {
        rejectionBox.style.display = 'block';
        rejectionText.textContent = app.rejection_reason;
      }

      this.populateStatusSummary(app);
      renderIcons(statusCard);
    }
  }

  private populateStatusSummary(app: DesignerApplicationItem): void {
    const sName = this.container.querySelector<HTMLElement>('[data-ref="status-summary-name"]');
    const sCountry = this.container.querySelector<HTMLElement>('[data-ref="status-summary-country"]');
    const sDate = this.container.querySelector<HTMLElement>('[data-ref="status-summary-date"]');
    const sFiles = this.container.querySelector<HTMLElement>('[data-ref="status-summary-files"]');

    if (sName) sName.textContent = app.full_name;
    if (sCountry) sCountry.textContent = app.country;
    if (sDate) sDate.textContent = formatDate(app.created_at);
    if (sFiles) {
      const count = Array.isArray(app.files) ? app.files.length : 0;
      sFiles.textContent = `${count} ${count === 1 ? 'archivo' : 'archivos'}`;
    }
  }

  private bindEvents(): void {
    const { signal } = this.abortController;

    const btnBack = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-back-to-templates"]');
    btnBack?.addEventListener('click', () => navigate('/templates'), { signal });

    const btnGoTemplates = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-status-go-templates"]');
    btnGoTemplates?.addEventListener('click', () => navigate('/templates'), { signal });

    const btnStepBack = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-step-back"]');
    btnStepBack?.addEventListener('click', () => {
      if (this.currentStep > 1) {
        this.goToStep(this.currentStep - 1);
      }
    }, { signal });

    const btnReapply = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-reapply"]');
    btnReapply?.addEventListener('click', () => {
      const statusCard = this.container.querySelector<HTMLElement>('[data-ref="designer-status-card"]');
      const wizardCard = this.container.querySelector<HTMLElement>('[data-ref="designer-wizard-card"]');
      if (statusCard) statusCard.style.display = 'none';
      if (wizardCard) wizardCard.style.display = 'block';
      this.goToStep(1);
    }, { signal });

    const roleOptions = this.container.querySelectorAll<HTMLElement>('[data-ref="role-option"]');
    roleOptions.forEach((option) => {
      option.addEventListener('click', () => {
        roleOptions.forEach((o) => o.classList.remove('is-selected'));
        option.classList.add('is-selected');
        this.selectedRole = option.getAttribute('data-role') || 'designer';
      }, { signal });
    });

    const btnNext1 = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-next-step-1"]');
    btnNext1?.addEventListener('click', () => {
      this.goToStep(2);
    }, { signal });

    const btnNext2 = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-next-step-2"]');
    btnNext2?.addEventListener('click', () => {
      this.goToStep(3);
    }, { signal });

    const chips = this.container.querySelectorAll<HTMLButtonElement>('[data-ref="chip-specialty"]');
    chips.forEach((chip) => {
      chip.addEventListener('click', () => {
        chip.classList.toggle('is-active');
      }, { signal });
    });

    const btnNext3 = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-next-step-3"]');
    btnNext3?.addEventListener('click', () => {
      this.goToStep(4);
    }, { signal });

    const inputPortfolio = this.container.querySelector<HTMLInputElement>('[data-ref="input-portfolio-url"]');
    const btnAddLink = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-add-portfolio-link"]');

    const handleAddLink = () => {
      if (!inputPortfolio) return;
      const url = inputPortfolio.value.trim();
      if (!url) return;

      if (!/^https?:\/\/.+/i.test(url)) {
        this.showError('Por favor ingresa una URL válida (ej. https://behance.net/...)');
        return;
      }

      if (this.portfolioLinks.includes(url)) {
        inputPortfolio.value = '';
        return;
      }

      this.portfolioLinks.push(url);
      inputPortfolio.value = '';
      this.clearError();
      this.renderPortfolioLinks();
    };

    btnAddLink?.addEventListener('click', handleAddLink, { signal });
    inputPortfolio?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleAddLink();
      }
    }, { signal });

    const dropzone = this.container.querySelector<HTMLElement>('[data-ref="upload-dropzone"]');
    const inputIndividual = this.container.querySelector<HTMLInputElement>('[data-ref="input-files-individual"]');
    const inputFolder = this.container.querySelector<HTMLInputElement>('[data-ref="input-files-folder"]');
    const btnTriggerFiles = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-trigger-files"]');
    const btnTriggerFolder = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-trigger-folder"]');

    btnTriggerFiles?.addEventListener('click', (e) => {
      e.stopPropagation();
      inputIndividual?.click();
    }, { signal });

    btnTriggerFolder?.addEventListener('click', (e) => {
      e.stopPropagation();
      inputFolder?.click();
    }, { signal });

    dropzone?.addEventListener('click', () => {
      inputIndividual?.click();
    }, { signal });

    inputIndividual?.addEventListener('change', () => {
      if (inputIndividual.files) {
        this.addFiles(Array.from(inputIndividual.files));
        inputIndividual.value = '';
      }
    }, { signal });

    inputFolder?.addEventListener('change', () => {
      if (inputFolder.files) {
        this.addFiles(Array.from(inputFolder.files));
        inputFolder.value = '';
      }
    }, { signal });

    dropzone?.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzone.style.borderColor = '#6366f1';
      dropzone.style.background = 'rgba(99, 102, 241, 0.06)';
    }, { signal });

    dropzone?.addEventListener('dragleave', () => {
      dropzone.style.borderColor = '';
      dropzone.style.background = '';
    }, { signal });

    dropzone?.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.style.borderColor = '';
      dropzone.style.background = '';
      if (e.dataTransfer?.files) {
        this.addFiles(Array.from(e.dataTransfer.files));
      }
    }, { signal });

    const btnSubmit = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-submit-application"]');
    btnSubmit?.addEventListener('click', () => {
      void this.handleSubmit();
    }, { signal });
  }

  private addFiles(newFiles: File[]): void {
    const existingNames = new Set(this.selectedFiles.map((f) => `${f.name}-${f.size}`));
    for (const f of newFiles) {
      const key = `${f.name}-${f.size}`;
      if (!existingNames.has(key)) {
        if (f.size > 25 * 1024 * 1024) {
          this.showError(`El archivo "${f.name}" supera el límite de 25 MB.`);
          continue;
        }
        this.selectedFiles.push(f);
        existingNames.add(key);
      }
    }
    this.renderFilesPreview();
  }

  private removeFile(index: number): void {
    this.selectedFiles.splice(index, 1);
    this.renderFilesPreview();
  }

  private renderFilesPreview(): void {
    const grid = this.container.querySelector<HTMLElement>('[data-ref="uploaded-files-grid"]');
    const counter = this.container.querySelector<HTMLElement>('[data-ref="files-counter-badge"]');
    if (!grid) return;

    if (counter) {
      const totalBytes = this.selectedFiles.reduce((acc, f) => acc + f.size, 0);
      counter.textContent = `${this.selectedFiles.length} ${this.selectedFiles.length === 1 ? 'archivo' : 'archivos'} (${formatFileSize(totalBytes)})`;
    }

    grid.innerHTML = '';

    this.selectedFiles.forEach((file, index) => {
      const card = document.createElement('div');
      card.className = 'uploaded-file-card';
      card.setAttribute('data-ref', 'uploaded-file-card');
      card.style.cssText = 'position: relative; border: 1px solid var(--border-color); border-radius: 10px; overflow: hidden; background: var(--bg-card); display: flex; flex-direction: column; align-items: center; padding: 10px; text-align: center;';

      const isImage = file.type.startsWith('image/');
      let thumbHtml = '';

      if (isImage) {
        const objectUrl = URL.createObjectURL(file);
        thumbHtml = `<img class="uploaded-thumb" src="${objectUrl}" alt="${escapeHtml(file.name)}" style="width: 100%; height: 75px; object-fit: cover; border-radius: 6px; margin-bottom: 6px;" />`;
      } else {
        thumbHtml = `
          <div style="width: 100%; height: 75px; display: flex; align-items: center; justify-content: center; background: rgba(125,125,125,0.08); border-radius: 6px; margin-bottom: 6px;">
            <svg class="component-icon" style="font-size: 32px; color: var(--text-secondary);" aria-hidden="true"><use href="/icons.svg#folder"></use></svg>
          </div>
        `;
      }

      card.innerHTML = `
        <button type="button" class="component-button component-button--icon-only component-button--danger" data-ref="btn-remove-file" style="position: absolute; top: 4px; right: 4px; width: 22px; height: 22px; border-radius: 50%; padding: 0; box-shadow: var(--shadow-sm);" aria-label="Eliminar archivo">
          <svg class="component-icon" style="font-size: 14px;" aria-hidden="true"><use href="/icons.svg#close"></use></svg>
        </button>
        ${thumbHtml}
        <span style="font-size: 11px; font-weight: 600; width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-bottom: 2px;" title="${escapeHtml(file.name)}">${escapeHtml(file.name)}</span>
        <span style="font-size: 10px; color: var(--text-secondary);">${formatFileSize(file.size)}</span>
      `;

      const btnRemove = card.querySelector<HTMLButtonElement>('[data-ref="btn-remove-file"]');
      btnRemove?.addEventListener('click', (e) => {
        e.stopPropagation();
        this.removeFile(index);
      });

      grid.appendChild(card);
    });

    renderIcons(grid);
  }

  private renderPortfolioLinks(): void {
    const list = this.container.querySelector<HTMLElement>('[data-ref="portfolio-links-list"]');
    if (!list) return;

    list.innerHTML = '';

    this.portfolioLinks.forEach((link, idx) => {
      const item = document.createElement('div');
      item.className = 'portfolio-link-chip';
      item.setAttribute('data-ref', 'portfolio-link-chip');
      item.style.cssText = 'display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; background: var(--bg-hover, rgba(125,125,125,0.06)); border: 1px solid var(--border-color); border-radius: 8px; font-size: 13px;';

      item.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; margin-right: 8px;">
          <svg class="component-icon" style="color: #10b981; flex-shrink: 0;" aria-hidden="true"><use href="/icons.svg#link"></use></svg>
          <a class="link" href="${escapeHtml(link)}" target="_blank" rel="noopener noreferrer" style="color: var(--text-primary); text-decoration: none; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
            ${escapeHtml(link)}
          </a>
        </div>
        <button type="button" class="component-button component-button--icon-only component-button--bordered" data-ref="btn-remove-link" style="width: 28px; height: 28px; flex-shrink: 0;" aria-label="Eliminar enlace">
          <svg class="component-icon" style="font-size: 16px;" aria-hidden="true"><use href="/icons.svg#close"></use></svg>
        </button>
      `;

      const btnRemove = item.querySelector<HTMLButtonElement>('[data-ref="btn-remove-link"]');
      btnRemove?.addEventListener('click', () => {
        this.portfolioLinks.splice(idx, 1);
        this.renderPortfolioLinks();
      });

      list.appendChild(item);
    });

    renderIcons(list);
  }

  private showError(msg: string): void {
    const banner = this.container.querySelector<HTMLElement>('[data-ref="apply-form-error"]');
    const msgEl = this.container.querySelector<HTMLElement>('[data-ref="apply-form-error-msg"]');
    if (banner && msgEl) {
      msgEl.textContent = msg;
      banner.style.display = 'flex';
      banner.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  private clearError(): void {
    const banner = this.container.querySelector<HTMLElement>('[data-ref="apply-form-error"]');
    if (banner) {
      banner.style.display = 'none';
    }
  }

  private async handleSubmit(): Promise<void> {
    this.clearError();

    const inputName = this.container.querySelector<HTMLInputElement>('[data-ref="input-full-name"]');
    const selectCountry = this.container.querySelector<HTMLSelectElement>('[data-ref="select-country"]');
    const textareaBio = this.container.querySelector<HTMLTextAreaElement>('[data-ref="textarea-bio"]');
    const btnSubmit = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-submit-application"]');

    const fullName = inputName?.value.trim() || '';
    const country = selectCountry?.value.trim() || '';
    const bio = textareaBio?.value.trim() || '';

    if (!fullName || fullName.length < 2) {
      this.showError('Por favor ingresa tu nombre completo (mínimo 2 caracteres).');
      inputName?.focus();
      return;
    }

    if (!country) {
      this.showError('Por favor selecciona tu país de residencia.');
      selectCountry?.focus();
      return;
    }

    if (this.portfolioLinks.length === 0 && this.selectedFiles.length === 0) {
      this.showError('Debes agregar al menos un enlace a tus obras o subir fotos/archivos con muestras de tu trabajo.');
      return;
    }

    const selectedSpecialties: string[] = [];
    this.container.querySelectorAll<HTMLButtonElement>('[data-ref="chip-specialty"].is-active').forEach((chip) => {
      const val = chip.getAttribute('data-value');
      if (val) selectedSpecialties.push(val);
    });

    const formData = new FormData();
    formData.append('full_name', fullName);
    formData.append('country', country);
    if (bio) formData.append('bio', bio);
    if (selectedSpecialties.length > 0) {
      formData.append('specialties', JSON.stringify(selectedSpecialties));
    }
    if (this.portfolioLinks.length > 0) {
      formData.append('portfolio_urls', JSON.stringify(this.portfolioLinks));
    }
    for (const file of this.selectedFiles) {
      formData.append('files', file, file.name);
    }

    if (btnSubmit) {
      await withButtonLoading(btnSubmit, 'Enviando postulación...', async () => {
        try {
          const res = await postFormApi(API_ROUTES.designerApplications.apply, formData);
          if (!res.ok) {
            const errData = await res.json().catch(() => null);
            this.showError(errData?.error || 'No se pudo enviar la solicitud. Por favor intenta más tarde.');
            return;
          }

          const resData = await res.json();
          showToast('¡Postulación enviada exitosamente!', 'success');

          if (resData.application) {
            this.renderStatusApplication(resData.application);
          } else {
            await this.loadApplicationStatus();
          }
        } catch {
          this.showError('Ha ocurrido un error al conectar con el servidor.');
        }
      });
    }
  }
}

export async function createDesignerApplyView(): Promise<HTMLElement> {
  const container = await loadTemplate('/views/designer/designer-apply.html');
  renderIcons(container);

  const controller = new DesignerApplyController(container);
  await controller.init();
  (container as any).__controller = controller;

  return container;
}

