import { navigate } from '../app-router.js';
import { API_ROUTES } from '../config/api-routes.js';
import { currentUser, postApi } from '../services/api.service.js';
import { renderIcons } from '../services/icon.service.js';
import { loadTemplate } from '../services/template.service.js';
import { setupDropdown, withButtonLoading } from '../utils/dom.util.js';
import { validateEmail } from '../utils/validators.util.js';

export class SalesContactController {
  private abortController = new AbortController();
  private container: HTMLElement;
  private currentStage = 1;
  private departmentDropdownCtrl: ReturnType<typeof setupDropdown> | null = null;
  private countryDropdownCtrl: ReturnType<typeof setupDropdown> | null = null;
  private reasonDropdownCtrl: ReturnType<typeof setupDropdown> | null = null;
  private roleDropdownCtrl: ReturnType<typeof setupDropdown> | null = null;
  private sizeDropdownCtrl: ReturnType<typeof setupDropdown> | null = null;

  private selectedContactReason = 'Estoy interesado en comprar Spriteboard Enterprise';
  private selectedCompanySize = '';
  private selectedCountry = '';
  private selectedRoleLevel = '';
  private selectedDepartment = '';

  constructor(container: HTMLElement) {
    this.container = container;
  }

  public async init(): Promise<void> {
    this.prefillUserData();
    this.setupDropdowns();
    this.bindEvents();
    renderIcons(this.container);
  }

  public destroy(): void {
    this.abortController.abort();
    this.reasonDropdownCtrl?.destroy();
    this.sizeDropdownCtrl?.destroy();
    this.countryDropdownCtrl?.destroy();
    this.roleDropdownCtrl?.destroy();
    this.departmentDropdownCtrl?.destroy();
  }

  private prefillUserData(): void {
    if (!currentUser) return;

    const emailInput = this.container.querySelector<HTMLInputElement>('[data-ref="input-company-email"]');
    if (emailInput && currentUser.email && !emailInput.value) {
      emailInput.value = currentUser.email;
    }

    if (currentUser.country) {
      this.selectedCountry = currentUser.country;
      const countryText = this.container.querySelector<HTMLElement>('[data-ref="country-selected-text"]');
      if (countryText) {
        countryText.textContent = currentUser.country;
      }
    }
  }

  private setupDropdowns(): void {
    const reasonWrapper = this.container.querySelector<HTMLElement>('[data-ref="dropdown-wrapper-reason"]');
    if (reasonWrapper) {
      this.reasonDropdownCtrl = setupDropdown(reasonWrapper, {
        onSelect: (val: string) => {
          this.selectedContactReason = val;
          const textEl = reasonWrapper.querySelector<HTMLElement>('[data-ref="reason-selected-text"]');
          if (textEl) textEl.textContent = val;
        },
      });
    }

    const sizeWrapper = this.container.querySelector<HTMLElement>('[data-ref="dropdown-wrapper-size"]');
    if (sizeWrapper) {
      this.sizeDropdownCtrl = setupDropdown(sizeWrapper, {
        onSelect: (val: string) => {
          this.selectedCompanySize = val;
          const textEl = sizeWrapper.querySelector<HTMLElement>('[data-ref="size-selected-text"]');
          if (textEl) textEl.textContent = val;
        },
      });
    }

    const countryWrapper = this.container.querySelector<HTMLElement>('[data-ref="dropdown-wrapper-country"]');
    if (countryWrapper) {
      this.countryDropdownCtrl = setupDropdown(countryWrapper, {
        onSelect: (val: string) => {
          this.selectedCountry = val;
          const textEl = countryWrapper.querySelector<HTMLElement>('[data-ref="country-selected-text"]');
          if (textEl) textEl.textContent = val;
        },
      });
    }

    const roleWrapper = this.container.querySelector<HTMLElement>('[data-ref="dropdown-wrapper-role"]');
    if (roleWrapper) {
      this.roleDropdownCtrl = setupDropdown(roleWrapper, {
        onSelect: (val: string) => {
          this.selectedRoleLevel = val;
          const textEl = roleWrapper.querySelector<HTMLElement>('[data-ref="role-selected-text"]');
          if (textEl) textEl.textContent = val;
        },
      });
    }

    const deptWrapper = this.container.querySelector<HTMLElement>('[data-ref="dropdown-wrapper-department"]');
    if (deptWrapper) {
      this.departmentDropdownCtrl = setupDropdown(deptWrapper, {
        onSelect: (val: string) => {
          this.selectedDepartment = val;
          const textEl = deptWrapper.querySelector<HTMLElement>('[data-ref="department-selected-text"]');
          if (textEl) textEl.textContent = val;
        },
      });
    }
  }

  private bindEvents(): void {
    const { signal } = this.abortController;

    const btnWizardBack = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-wizard-back"]');
    btnWizardBack?.addEventListener('click', () => this.goToStage(1), { signal });

    const btnNextStage1 = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-next-stage1"]');
    btnNextStage1?.addEventListener('click', (e) => {
      e.preventDefault();
      this.handleStage1Submit();
    }, { signal });

    const formStage1 = this.container.querySelector<HTMLFormElement>('[data-ref="form-stage-1"]');
    formStage1?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleStage1Submit();
    }, { signal });

    const btnSubmitSales = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-submit-sales"]');
    btnSubmitSales?.addEventListener('click', (e) => {
      e.preventDefault();
      this.handleFinalSubmit();
    }, { signal });

    const formStage2 = this.container.querySelector<HTMLFormElement>('[data-ref="form-stage-2"]');
    formStage2?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleFinalSubmit();
    }, { signal });

    const btnSuccessGoPlans = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-success-go-plans"]');
    btnSuccessGoPlans?.addEventListener('click', () => navigate('/upgrade'), { signal });

    const btnSuccessGoHome = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-success-go-home"]');
    btnSuccessGoHome?.addEventListener('click', () => navigate('/'), { signal });
  }

  private goToStage(stage: number): void {
    this.currentStage = stage;

    const progressFill = this.container.querySelector<HTMLElement>('[data-ref="wizard-progress-fill"]');
    const stepIndicator = this.container.querySelector<HTMLElement>('[data-ref="wizard-step-indicator"]');
    const btnWizardBack = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-wizard-back"]');

    const stage1El = this.container.querySelector<HTMLElement>('[data-ref="stage-1"]');
    const stage2El = this.container.querySelector<HTMLElement>('[data-ref="stage-2"]');
    const stageSuccessEl = this.container.querySelector<HTMLElement>('[data-ref="stage-success"]');

    if (stage === 1) {
      if (progressFill) progressFill.style.width = '50%';
      if (stepIndicator) stepIndicator.textContent = 'Etapa 1 de 2: Información de contacto';
      if (btnWizardBack) btnWizardBack.style.visibility = 'hidden';

      if (stage1El) stage1El.style.display = 'block';
      if (stage2El) stage2El.style.display = 'none';
      if (stageSuccessEl) stageSuccessEl.style.display = 'none';
    } else if (stage === 2) {
      if (progressFill) progressFill.style.width = '100%';
      if (stepIndicator) stepIndicator.textContent = 'Etapa 2 de 2: Datos de la organización';
      if (btnWizardBack) btnWizardBack.style.visibility = 'visible';

      if (stage1El) stage1El.style.display = 'none';
      if (stage2El) stage2El.style.display = 'block';
      if (stageSuccessEl) stageSuccessEl.style.display = 'none';
    } else if (stage === 3) {
      if (progressFill) progressFill.style.width = '100%';
      if (stepIndicator) stepIndicator.textContent = '¡Solicitud completada!';
      if (btnWizardBack) btnWizardBack.style.visibility = 'hidden';

      if (stage1El) stage1El.style.display = 'none';
      if (stage2El) stage2El.style.display = 'none';
      if (stageSuccessEl) stageSuccessEl.style.display = 'block';
    }

    renderIcons(this.container);
  }

  private showStage1Error(msg: string): void {
    const errorBanner = this.container.querySelector<HTMLElement>('[data-ref="stage-1-error"]');
    const errorMsg = this.container.querySelector<HTMLElement>('[data-ref="stage-1-error-msg"]');
    if (errorBanner && errorMsg) {
      errorMsg.textContent = msg;
      errorBanner.style.display = 'flex';
    }
  }

  private hideStage1Error(): void {
    const errorBanner = this.container.querySelector<HTMLElement>('[data-ref="stage-1-error"]');
    if (errorBanner) {
      errorBanner.style.display = 'none';
    }
  }

  private showStage2Error(msg: string): void {
    const errorBanner = this.container.querySelector<HTMLElement>('[data-ref="stage-2-error"]');
    const errorMsg = this.container.querySelector<HTMLElement>('[data-ref="stage-2-error-msg"]');
    if (errorBanner && errorMsg) {
      errorMsg.textContent = msg;
      errorBanner.style.display = 'flex';
    }
  }

  private hideStage2Error(): void {
    const errorBanner = this.container.querySelector<HTMLElement>('[data-ref="stage-2-error"]');
    if (errorBanner) {
      errorBanner.style.display = 'none';
    }
  }

  private handleStage1Submit(): void {
    this.hideStage1Error();

    const firstNameInput = this.container.querySelector<HTMLInputElement>('[data-ref="input-first-name"]');
    const lastNameInput = this.container.querySelector<HTMLInputElement>('[data-ref="input-last-name"]');
    const emailInput = this.container.querySelector<HTMLInputElement>('[data-ref="input-company-email"]');

    const firstName = firstNameInput?.value.trim() || '';
    const lastName = lastNameInput?.value.trim() || '';
    const email = emailInput?.value.trim() || '';

    if (!firstName || firstName.length < 2) {
      this.showStage1Error('Por favor ingresa tu nombre (mínimo 2 caracteres).');
      firstNameInput?.focus();
      return;
    }

    if (!lastName || lastName.length < 2) {
      this.showStage1Error('Por favor ingresa tu apellido (mínimo 2 caracteres).');
      lastNameInput?.focus();
      return;
    }

    const emailResult = validateEmail(email, { enforceAllowedDomains: false });
    if (!emailResult.valid) {
      this.showStage1Error(emailResult.error || 'Por favor ingresa un correo electrónico corporativo válido.');
      emailInput?.focus();
      return;
    }

    if (!this.selectedContactReason) {
      this.showStage1Error('Por favor selecciona el motivo de tu consulta.');
      return;
    }

    this.goToStage(2);
  }

  private async handleFinalSubmit(): Promise<void> {
    this.hideStage2Error();

    const firstNameInput = this.container.querySelector<HTMLInputElement>('[data-ref="input-first-name"]');
    const lastNameInput = this.container.querySelector<HTMLInputElement>('[data-ref="input-last-name"]');
    const emailInput = this.container.querySelector<HTMLInputElement>('[data-ref="input-company-email"]');

    const companyNameInput = this.container.querySelector<HTMLInputElement>('[data-ref="input-company-name"]');
    const phoneInput = this.container.querySelector<HTMLInputElement>('[data-ref="input-phone-number"]');
    const howCanWeHelpInput = this.container.querySelector<HTMLTextAreaElement>('[data-ref="textarea-how-can-we-help"]');

    const firstName = firstNameInput?.value.trim() || '';
    const lastName = lastNameInput?.value.trim() || '';
    const email = emailInput?.value.trim() || '';

    const companyName = companyNameInput?.value.trim() || '';
    const phone = phoneInput?.value.trim() || '';
    const howCanWeHelp = howCanWeHelpInput?.value.trim() || '';

    if (!companyName || companyName.length < 2) {
      this.showStage2Error('Por favor ingresa el nombre de tu empresa u organización.');
      companyNameInput?.focus();
      return;
    }

    if (!this.selectedCompanySize) {
      this.showStage2Error('Por favor selecciona el tamaño aproximado de tu empresa.');
      return;
    }

    if (!this.selectedCountry) {
      this.showStage2Error('Por favor selecciona tu país o región.');
      return;
    }

    if (!this.selectedRoleLevel) {
      this.showStage2Error('Por favor selecciona tu nivel de cargo o rol.');
      return;
    }

    if (!this.selectedDepartment) {
      this.showStage2Error('Por favor selecciona tu departamento.');
      return;
    }

    if (!phone || phone.length < 5) {
      this.showStage2Error('Por favor ingresa un número de teléfono de contacto válido.');
      phoneInput?.focus();
      return;
    }

    if (!howCanWeHelp || howCanWeHelp.length < 5) {
      this.showStage2Error('Por favor cuéntanos cómo podemos ayudarte (mínimo 5 caracteres).');
      howCanWeHelpInput?.focus();
      return;
    }

    const submitBtn = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-submit-sales"]');

    await withButtonLoading(submitBtn, async () => {
      try {
        const payload = {
          company_email: email,
          company_name: companyName,
          company_size: this.selectedCompanySize,
          contact_reason: this.selectedContactReason,
          country_or_region: this.selectedCountry,
          department: this.selectedDepartment,
          first_name: firstName,
          how_can_we_help: howCanWeHelp,
          last_name: lastName,
          phone_number: phone,
          role_level: this.selectedRoleLevel,
        };

        const res = await postApi(API_ROUTES.sales.inquiry, payload);
        if (res.ok) {
          this.goToStage(3);
        } else {
          let errorText = 'Ocurrió un error al procesar tu solicitud. Por favor intenta más tarde.';
          try {
            const data = await res.json();
            if (data.error) errorText = data.error;
          } catch {}
          this.showStage2Error(errorText);
        }
      } catch {
        this.showStage2Error('Error de conexión con el servidor. Por favor intenta nuevamente.');
      }
    });
  }
}

export async function createSalesContactView(): Promise<HTMLElement> {
  const container = await loadTemplate('/views/contact/sales-contact.html');
  const controller = new SalesContactController(container);
  await controller.init();
  return container;
}
