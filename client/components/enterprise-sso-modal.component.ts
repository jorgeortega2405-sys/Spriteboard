import { API_ROUTES } from '../config/api-routes.js';
import { currentUser, deleteApi, escapeHtml, getApi, postApi } from '../services/api.service.js';
import { t, translateElement } from '../services/i18n.service.js';
import { renderIcons } from '../services/icon.service.js';
import { showToast } from '../services/toast.service.js';
import { EnterpriseTenant, EnterpriseTenantType } from '../types/enterprise.types.js';
import { openModal } from './modal.component.js';
import { openUpgradeModal } from './upgrade-modal.component.js';

let activeSsoModal: any = null;

export async function openEnterpriseSsoModal(options: {
  tenantType?: EnterpriseTenantType;
  targetTeamId?: number | null;
  targetTeamName?: string;
} = {}): Promise<void> {
  if (activeSsoModal) {
    activeSsoModal.close();
  }

  const type = options.tenantType || 'business';
  const rawTier = (currentUser?.subscription_tier || 'free').toLowerCase();
  const hasAccess = ['business', 'negocios', 'escuelas', 'instituciones', 'education_institution', 'schools'].includes(rawTier);

  if (!hasAccess) {
    openUpgradeModal(type === 'business' ? 'business' : 'schools');
    return;
  }

  let currentTenant: EnterpriseTenant | null = null;
  let activeTab: 'sso' | 'scim' = 'sso';

  try {
    const res = await getApi(API_ROUTES.enterprise.config(type));
    if (res.ok) {
      const data = await res.json();
      currentTenant = data.tenant || null;
    }
  } catch {}

  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop is-visible';
  backdrop.setAttribute('data-ref', 'modal-enterprise-sso-backdrop');

  const origin = window.location.origin;
  const acsUrl = `${origin}/api/auth/sso/saml/callback`;
  const scimBaseUrl = `${origin}/api/scim/v2`;

  const renderContent = () => {
    const isSsoActive = Boolean(currentTenant?.sso_enabled);
    const isScimActive = Boolean(currentTenant?.scim_enabled);
    const domainVal = currentTenant?.domain || '';
    const idpSsoVal = currentTenant?.idp_sso_url || '';
    const idpEntityVal = currentTenant?.idp_entity_id || '';
    const idpCertVal = currentTenant?.idp_certificate || '';
    const usersCount = currentTenant?.users_count || 0;
    const metadataUrl = currentTenant ? API_ROUTES.enterprise.samlMetadata(currentTenant.uuid) : '';

    backdrop.innerHTML = `
      <div class="modal-container" data-ref="modal-enterprise-sso-container">
        <button type="button" class="modal-close-btn" data-ref="btn-modal-close" aria-label="${t('modal.close') || 'Cerrar'}">
          <span class="material-symbols-rounded">close</span>
        </button>
        <div class="modal-card modal-card--w-640" data-ref="modal-enterprise-sso-card">
          <div class="modal-card__header">
            <h2 class="modal-card__title" data-ref="modal-sso-title">${t('teams.sso_modal_title') || 'Inicio de sesión único (SSO) y SCIM'}</h2>
            <p class="modal-card__desc">${t('teams.sso_form_desc') || 'Vincula el dominio de tu organización para autenticar usuarios vía SAML/OIDC y aprovisionarlos automáticamente con SCIM 2.0.'}</p>
          </div>

          <div style="display: flex; gap: 8px; border-bottom: 1px solid var(--border-color); padding: 0 24px; margin-bottom: 16px;">
            <button type="button" class="component-button component-button--h34 ${activeTab === 'sso' ? 'component-button--black' : 'component-button--outline'}" data-ref="btn-tab-sso" style="border-bottom-left-radius: 0; border-bottom-right-radius: 0;">
              <span class="material-symbols-rounded" style="font-size: 18px; margin-right: 6px;">vpn_key</span>
              <span>SSO (SAML / Entra ID / Google)</span>
            </button>
            <button type="button" class="component-button component-button--h34 ${activeTab === 'scim' ? 'component-button--black' : 'component-button--outline'}" data-ref="btn-tab-scim" style="border-bottom-left-radius: 0; border-bottom-right-radius: 0;">
              <span class="material-symbols-rounded" style="font-size: 18px; margin-right: 6px;">sync_alt</span>
              <span>SCIM 2.0 (Aprovisionamiento)</span>
            </button>
          </div>

          <div class="modal-card__body" data-ref="modal-sso-body" style="padding-top: 0;">
            ${activeTab === 'sso' ? `
              <form data-ref="form-sso-settings" style="display: flex; flex-direction: column; gap: 14px;">
                <label class="field" data-ref="field-sso-domain">
                  <input class="field__input" data-ref="input-sso-domain" type="text" placeholder=" " value="${escapeHtml(domainVal)}" maxlength="100" required autocomplete="off" />
                  <span class="field__label">${t('teams.sso_domain_label') || 'Dominio corporativo / académico'} (ej. empresa.com)</span>
                </label>

                <div style="display: flex; align-items: center; gap: 10px; margin: 2px 0;">
                  <input type="checkbox" data-ref="chk-sso-enabled" ${isSsoActive ? 'checked' : ''} style="width: 18px; height: 18px; cursor: pointer;" />
                  <label data-ref="lbl-sso-enabled" style="font-size: 14px; font-weight: 500; cursor: pointer; color: var(--text-primary);">
                    ${t('teams.sso_enable_checkbox') || 'Habilitar inicio de sesión único (SSO) para este dominio'}
                  </label>
                </div>

                <label class="field" data-ref="field-idp-sso-url">
                  <input class="field__input" data-ref="input-idp-sso-url" type="url" placeholder=" " value="${escapeHtml(idpSsoVal)}" maxlength="500" autocomplete="off" />
                  <span class="field__label">URL de inicio de sesión del IdP (Single Sign-On Service URL)</span>
                </label>

                <label class="field" data-ref="field-idp-entity-id">
                  <input class="field__input" data-ref="input-idp-entity-id" type="text" placeholder=" " value="${escapeHtml(idpEntityVal)}" maxlength="255" autocomplete="off" />
                  <span class="field__label">Entity ID / Emisor del IdP (Microsoft / Google / Okta)</span>
                </label>

                <div style="background: var(--bg-hover); padding: 12px; border-radius: 8px; font-size: 13px; color: var(--text-secondary); display: flex; flex-direction: column; gap: 8px;">
                  <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span><strong>URL de ACS (Callback para tu IdP):</strong></span>
                    <button type="button" class="component-button component-button--h32 component-button--outline" data-ref="btn-copy-acs" data-copy="${acsUrl}">
                      <span class="material-symbols-rounded" style="font-size: 16px; margin-right: 4px;">content_copy</span> Copiar
                    </button>
                  </div>
                  <code style="word-break: break-all; font-size: 12px; color: var(--text-primary);">${acsUrl}</code>
                  ${metadataUrl ? `
                    <div style="margin-top: 4px;">
                      <a class="link" href="${metadataUrl}" target="_blank" rel="noopener noreferrer">
                        Descargar archivo de Metadatos SP XML
                      </a>
                    </div>
                  ` : ''}
                </div>

                <div class="modal-card__actions" style="margin-top: 8px;">
                  <button type="button" class="component-button component-button--h40 component-button--outline" data-ref="btn-cancel-sso">${t('modal.cancel') || 'Cancelar'}</button>
                  <button type="submit" class="component-button component-button--h40 component-button--black" data-ref="btn-save-sso">${t('teams.sso_btn_save') || 'Guardar configuración'}</button>
                </div>
                <div class="banner banner--danger is-hidden" data-ref="banner-sso-error"></div>
              </form>
            ` : `
              <div style="display: flex; flex-direction: column; gap: 16px;">
                <p style="font-size: 14px; color: var(--text-secondary); margin: 0;">
                  El protocolo SCIM 2.0 (RFC 7644) permite a <strong>Microsoft Entra ID</strong>, <strong>Okta</strong> y <strong>Google Workspace</strong> sincronizar usuarios automáticamente.
                </p>

                <div style="background: var(--bg-hover); padding: 14px; border-radius: 8px; display: flex; flex-direction: column; gap: 10px;">
                  <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span style="font-size: 13px; font-weight: 600;">URL base de SCIM (Endpoint para Microsoft/Okta):</span>
                    <button type="button" class="component-button component-button--h32 component-button--outline" data-ref="btn-copy-scim-url" data-copy="${scimBaseUrl}">
                      <span class="material-symbols-rounded" style="font-size: 16px; margin-right: 4px;">content_copy</span> Copiar
                    </button>
                  </div>
                  <code style="word-break: break-all; font-size: 13px; color: var(--text-primary);">${scimBaseUrl}</code>
                </div>

                <div style="background: var(--bg-hover); padding: 14px; border-radius: 8px; display: flex; flex-direction: column; gap: 10px;">
                  <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div>
                      <span style="font-size: 13px; font-weight: 600; display: block;">Token Secreto SCIM (Bearer Token):</span>
                      <span style="font-size: 12px; color: var(--text-secondary);">
                        ${isScimActive ? 'Activo y enlazado' : 'Aún no has generado un token SCIM activo'}
                      </span>
                    </div>
                    <div style="display: flex; gap: 8px;">
                      ${isScimActive ? `
                        <button type="button" class="component-button component-button--h34 component-button--danger" data-ref="btn-revoke-scim">
                          Revocar
                        </button>
                      ` : ''}
                      <button type="button" class="component-button component-button--h34 component-button--black" data-ref="btn-generate-scim">
                        ${isScimActive ? 'Regenerar token' : 'Generar nuevo token SCIM'}
                      </button>
                    </div>
                  </div>

                  <div data-ref="box-generated-token" style="display: none; margin-top: 8px; background: var(--bg-card); padding: 12px; border-radius: 6px; border: 1px dashed var(--border-color);">
                    <span style="font-size: 12px; font-weight: 600; color: #16a34a; display: block; margin-bottom: 4px;">
                      ¡Copia este token ahora! No volverá a mostrarse completo por seguridad:
                    </span>
                    <div style="display: flex; gap: 8px; align-items: center;">
                      <input class="field__input" data-ref="input-token-display" type="text" readonly style="font-family: monospace; font-size: 12px;" />
                      <button type="button" class="component-button component-button--h34 component-button--outline" data-ref="btn-copy-generated-token">
                        Copiar
                      </button>
                    </div>
                  </div>
                </div>

                <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; background: var(--bg-hover); border-radius: 8px;">
                  <span style="font-size: 13px; color: var(--text-secondary);">Usuarios federados activos vía SCIM:</span>
                  <span class="component-badge component-badge--sm" style="font-weight: 700;">${usersCount}</span>
                </div>

                <div class="modal-card__actions" style="margin-top: 8px;">
                  <button type="button" class="component-button component-button--h40 component-button--black" data-ref="btn-close-scim">${t('modal.close') || 'Cerrar'}</button>
                </div>
              </div>
            `}
          </div>
        </div>
      </div>
    `;

    bindEvents();
    renderIcons(backdrop);
    translateElement(backdrop);
  };

  const bindEvents = () => {
    const btnClose = backdrop.querySelector<HTMLElement>('[data-ref="btn-modal-close"]');
    const btnCancel = backdrop.querySelector<HTMLElement>('[data-ref="btn-cancel-sso"]');
    const btnCloseScim = backdrop.querySelector<HTMLElement>('[data-ref="btn-close-scim"]');
    const closeHandler = () => {
      backdrop.remove();
      document.body.classList.remove('modal-open');
      activeSsoModal = null;
    };

    btnClose?.addEventListener('click', closeHandler);
    btnCancel?.addEventListener('click', closeHandler);
    btnCloseScim?.addEventListener('click', closeHandler);

    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) closeHandler();
    });

    const btnTabSso = backdrop.querySelector<HTMLElement>('[data-ref="btn-tab-sso"]');
    const btnTabScim = backdrop.querySelector<HTMLElement>('[data-ref="btn-tab-scim"]');

    btnTabSso?.addEventListener('click', () => {
      activeTab = 'sso';
      renderContent();
    });

    btnTabScim?.addEventListener('click', () => {
      activeTab = 'scim';
      renderContent();
    });

    const btnCopyAcs = backdrop.querySelector<HTMLElement>('[data-ref="btn-copy-acs"]');
    btnCopyAcs?.addEventListener('click', () => {
      const txt = btnCopyAcs.getAttribute('data-copy') || '';
      void navigator.clipboard.writeText(txt);
      showToast(t('teams.code_copied') || 'URL copiada al portapapeles.', 'success');
    });

    const btnCopyScimUrl = backdrop.querySelector<HTMLElement>('[data-ref="btn-copy-scim-url"]');
    btnCopyScimUrl?.addEventListener('click', () => {
      const txt = btnCopyScimUrl.getAttribute('data-copy') || '';
      void navigator.clipboard.writeText(txt);
      showToast('URL de endpoint SCIM copiada al portapapeles.', 'success');
    });

    const formSso = backdrop.querySelector<HTMLFormElement>('[data-ref="form-sso-settings"]');
    const bannerError = backdrop.querySelector<HTMLElement>('[data-ref="banner-sso-error"]');

    formSso?.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (bannerError) bannerError.classList.add('is-hidden');

      const domainInput = backdrop.querySelector<HTMLInputElement>('[data-ref="input-sso-domain"]');
      const ssoEnabledInput = backdrop.querySelector<HTMLInputElement>('[data-ref="chk-sso-enabled"]');
      const idpSsoUrlInput = backdrop.querySelector<HTMLInputElement>('[data-ref="input-idp-sso-url"]');
      const idpEntityIdInput = backdrop.querySelector<HTMLInputElement>('[data-ref="input-idp-entity-id"]');

      const domain = (domainInput?.value || '').trim();
      if (!domain) {
        if (bannerError) {
          bannerError.textContent = t('teams.sso_invalid_domain') || 'Por favor ingresa un dominio corporativo válido.';
          bannerError.classList.remove('is-hidden');
        }
        return;
      }

      try {
        const res = await postApi(API_ROUTES.enterprise.saveConfig, {
          domain,
          tenant_type: type,
          sso_enabled: Boolean(ssoEnabledInput?.checked),
          idp_sso_url: (idpSsoUrlInput?.value || '').trim() || null,
          idp_entity_id: (idpEntityIdInput?.value || '').trim() || null,
          target_team_id: options.targetTeamId || null,
        });

        if (!res.ok) {
          const errData = await res.json();
          if (bannerError) {
            bannerError.textContent = errData.error || 'Error al guardar la configuración.';
            bannerError.classList.remove('is-hidden');
          }
          return;
        }

        const data = await res.json();
        currentTenant = data.tenant;
        showToast(t('teams.sso_toast_saved') || 'Configuración de SSO guardada exitosamente.', 'success');
        renderContent();
      } catch {
        if (bannerError) {
          bannerError.textContent = 'Error de conexión con el servidor.';
          bannerError.classList.remove('is-hidden');
        }
      }
    });

    const btnGenerateScim = backdrop.querySelector<HTMLElement>('[data-ref="btn-generate-scim"]');
    btnGenerateScim?.addEventListener('click', async () => {
      if (!currentTenant || !currentTenant.domain) {
        showToast('Debes configurar y guardar tu dominio en la pestaña SSO antes de generar un token SCIM.', 'warning');
        return;
      }

      try {
        const res = await postApi(API_ROUTES.enterprise.generateScimToken, {
          type,
          tenantId: currentTenant.id,
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          showToast(errData?.error || 'Error al generar token SCIM.', 'danger');
          return;
        }

        const data = await res.json();
        const box = backdrop.querySelector<HTMLElement>('[data-ref="box-generated-token"]');
        const inputDisplay = backdrop.querySelector<HTMLInputElement>('[data-ref="input-token-display"]');
        const btnCopy = backdrop.querySelector<HTMLElement>('[data-ref="btn-copy-generated-token"]');

        if (box && inputDisplay) {
          inputDisplay.value = data.token;
          box.style.display = 'block';

          btnCopy?.addEventListener('click', () => {
            void navigator.clipboard.writeText(data.token);
            showToast('Token SCIM copiado al portapapeles.', 'success');
          });
        }

        if (currentTenant) currentTenant.scim_enabled = true;
        showToast('Nuevo token SCIM generado exitosamente.', 'success');
      } catch {
        showToast('Error al conectar con el servidor.', 'danger');
      }
    });

    const btnRevokeScim = backdrop.querySelector<HTMLElement>('[data-ref="btn-revoke-scim"]');
    btnRevokeScim?.addEventListener('click', async () => {
      try {
        const res = await deleteApi(`${API_ROUTES.enterprise.revokeScimToken}?type=${encodeURIComponent(type)}&tenantId=${encodeURIComponent(currentTenant?.id || '')}`);
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          showToast(errData?.error || 'Error al revocar token SCIM.', 'danger');
          return;
        }

        if (currentTenant) currentTenant.scim_enabled = false;
        showToast('Token SCIM revocado.', 'info');
        renderContent();
      } catch {
        showToast('Error de conexión.', 'danger');
      }
    });
  };

  renderContent();
  document.body.appendChild(backdrop);
  document.body.classList.add('modal-open');

  activeSsoModal = {
    close: () => {
      backdrop.remove();
      document.body.classList.remove('modal-open');
      activeSsoModal = null;
    },
  };
}
