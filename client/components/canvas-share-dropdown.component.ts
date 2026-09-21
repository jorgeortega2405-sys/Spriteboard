import { openModal } from './modal.component.js';
import { API_ROUTES } from '../config/api-routes.js';
import { currentUser, deleteApi, escapeHtml, getApi, patchApi, postApi } from '../services/api.service.js';
import { getLocalCanvasByUuid, markLocalCanvasAsSynced } from '../services/canvas-storage.service.js';
import { t, translateElement } from '../services/i18n.service.js';
import { renderIcons } from '../services/icon.service.js';
import { showToast } from '../services/toast.service.js';
import { CanvasItem, CanvasMember, SearchUserResult } from '../types/canvas.types.js';
import { CanvasTeamItem, Team } from '../types/team.types.js';
import { setupDropdown } from '../utils/dom.util.js';

export interface CanvasShareExportOption {
  icon: string;
  label: string;
  onClick: () => void;
  ref: string;
}

export interface CanvasShareDropdownOptions {
  exportOptions?: CanvasShareExportOption[];
  getCanvas: () => CanvasItem;
  onAccessChanged?: (accessLevel: 'private' | 'public', publicRole?: 'viewer' | 'editor') => void;
  signal?: AbortSignal;
  trigger: HTMLElement;
  wrapper: HTMLElement;
}

export interface CanvasShareDropdownController {
  close: () => void;
  destroy: () => void;
  open: () => void;
  toggle: () => void;
  update: () => void;
}

function setIconUse(el: HTMLElement | null, iconName: string): void {
  if (!el) return;
  const use = el.querySelector('use');
  if (use) {
    use.setAttribute('href', `/icons.svg#${iconName}`);
    use.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', `/icons.svg#${iconName}`);
  } else {
    el.textContent = iconName;
  }
}

export function setupCanvasShareDropdown(options: CanvasShareDropdownOptions): CanvasShareDropdownController {
  const { getCanvas, onAccessChanged, signal, trigger, wrapper } = options;
  const initialCanvas = getCanvas();
  const isLoggedIn = Boolean(currentUser);
  const isOwner = Boolean(currentUser && initialCanvas.user_id && initialCanvas.user_id === currentUser.id) || (!initialCanvas.user_id && !initialCanvas.id);

  let canvasMembers: CanvasMember[] = [];
  let canvasTeams: CanvasTeamItem[] = [];
  let userTeams: Team[] = [];
  let searchTimer: ReturnType<typeof setTimeout> | null = null;
  let currentAccessLevel: 'private' | 'public' = initialCanvas.access_level || 'private';
  let currentPublicRole: 'viewer' | 'editor' = initialCanvas.public_role || 'editor';

  const shareTitle = initialCanvas.canvas_type === 'doc' || initialCanvas.unit === 'doc'
    ? 'Compartir documento'
    : 'Compartir pizarrón';

  let backdrop = wrapper.querySelector<HTMLElement>('[data-ref="dropdown-backdrop-share"]');
  let menu = wrapper.querySelector<HTMLElement>('[data-ref="dropdown-menu-share"]');

  if (!backdrop || !menu) {
    const isLocal = Boolean(initialCanvas.is_local && !initialCanvas.id);
    const markup = `
      <div class="dropdown-backdrop" data-ref="dropdown-backdrop-share">
        <div class="menu-panel menu-panel--dropdown menu-panel--w-465 menu-panel--h-auto design-share-menu" data-ref="dropdown-menu-share">
          <div class="menu-panel__drag-zone" data-ref="share-drag-zone" aria-hidden="true">
            <div class="menu-panel__drag-handle"></div>
          </div>
          <div class="design-share-stage" data-ref="share-stage-main">
            <div class="design-share-menu__header">
              <h2 class="design-share-menu__title">${escapeHtml(shareTitle)}</h2>
            </div>
            <div class="design-share-menu__content">
              ${
                !isLoggedIn
                  ? `<div class="banner banner--info" data-ref="banner-share-login" style="margin-bottom: var(--sl-spacing-md);">Inicia sesión para invitar personas y administrar permisos de acceso.</div>`
                  : ''
              }
              ${
                isLoggedIn && isLocal
                  ? `<div class="design-share-section" data-ref="section-share-local-sync">
                      <p class="settings-item__desc">Este lienzo está guardado únicamente de forma local. Sincronízalo con la nube para poder compartirlo con personas y equipos.</p>
                      <button type="button" class="component-button component-button--h40 component-button--black component-button--w-full" data-ref="btn-modal-sync-cloud">
                        <span class="component-icon">cloud_upload</span>
                        <span>Sincronizar a la nube</span>
                      </button>
                    </div>`
                  : ''
              }
              <div class="design-share-section${isLocal || !isLoggedIn ? ' is-hidden' : ''}" data-ref="section-share-members">
                <span class="design-share-section__label">Personas y equipos con acceso</span>
                <div class="design-share-search-box" data-ref="share-search-box">
                  <div class="component-search component-search--full" data-ref="field-share-search">
                    <div class="component-search__icon">
                      <span class="component-icon">search</span>
                    </div>
                    <div class="component-search__input-box">
                      <input class="component-search__input" data-ref="input-share-search-people" type="text" placeholder="Agregar personas o equipos" autocomplete="off" />
                    </div>
                  </div>
                  <div class="design-share-search-results is-hidden" data-ref="share-search-results"></div>
                </div>
                <div class="design-share-members-row" data-ref="share-members-container">
                  <div class="design-share-members-list" data-ref="share-members-list"></div>
                  <button type="button" class="design-share-add-chip-btn" data-ref="btn-share-focus-search" data-tooltip="Agregar personas o equipos" aria-label="Agregar personas o equipos">
                    <span class="component-icon">add</span>
                  </button>
                </div>
              </div>

              <div class="design-share-section${isLocal || !isLoggedIn ? ' is-hidden' : ''}" data-ref="section-share-access">
                <span class="design-share-section__label">Nivel de acceso</span>
                <div class="settings-dropdown-wrapper" data-ref="dropdown-wrapper-access-level">
                  <button type="button" class="dropdown-trigger" data-ref="btn-trigger-access-level" aria-label="Nivel de acceso">
                    <div class="dropdown-trigger__left">
                      <span class="component-icon dropdown-trigger__icon" data-ref="access-level-selected-icon">lock</span>
                      <span class="dropdown-trigger__text" data-ref="access-level-selected-text">Solo tú tienes acceso</span>
                    </div>
                    <span class="component-icon dropdown-trigger__chevron">expand_more</span>
                  </button>
                  <div class="dropdown-backdrop" data-ref="dropdown-backdrop-access-level">
                    <div class="menu-panel menu-panel--dropdown menu-panel--w-full menu-panel--h-auto" data-ref="dropdown-menu-access-level">
                      <div class="menu-panel__drag-zone" data-ref="access-drag-zone" aria-hidden="true">
                        <div class="menu-panel__drag-handle"></div>
                      </div>
                      <div class="menu-panel__list" data-ref="list-access-level">
                        <button type="button" class="menu-item is-active" data-ref="btn-access-private" data-value="private">
                          <span class="component-icon menu-item__icon">lock</span>
                          <span class="menu-item__text">Solo tú tienes acceso</span>
                        </button>
                        <button type="button" class="menu-item" data-ref="btn-access-public" data-value="public">
                          <span class="component-icon menu-item__icon">language</span>
                          <span class="menu-item__text">Cualquier persona con el enlace</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div class="design-share-section is-hidden" data-ref="section-public-role">
                <span class="design-share-section__label">Permiso del enlace</span>
                <div class="settings-dropdown-wrapper" data-ref="dropdown-wrapper-public-role">
                  <button type="button" class="dropdown-trigger" data-ref="btn-trigger-public-role" aria-label="Permiso del enlace">
                    <div class="dropdown-trigger__left">
                      <span class="component-icon dropdown-trigger__icon" data-ref="public-role-selected-icon">edit</span>
                      <span class="dropdown-trigger__text" data-ref="public-role-selected-text">Ver y editar</span>
                    </div>
                    <span class="component-icon dropdown-trigger__chevron">expand_more</span>
                  </button>
                  <div class="dropdown-backdrop" data-ref="dropdown-backdrop-public-role">
                    <div class="menu-panel menu-panel--dropdown menu-panel--w-full menu-panel--h-auto" data-ref="dropdown-menu-public-role">
                      <div class="menu-panel__drag-zone" data-ref="public-role-drag-zone" aria-hidden="true">
                        <div class="menu-panel__drag-handle"></div>
                      </div>
                      <div class="menu-panel__list" data-ref="list-public-role">
                        <button type="button" class="menu-item is-active" data-ref="btn-public-role-editor" data-value="editor">
                          <span class="component-icon menu-item__icon">edit</span>
                          <span class="menu-item__text">Ver y editar</span>
                        </button>
                        <button type="button" class="menu-item" data-ref="btn-public-role-viewer" data-value="viewer">
                          <span class="component-icon menu-item__icon">visibility</span>
                          <span class="menu-item__text">Solo ver</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div class="design-share-link-row">
                <button type="button" class="component-button component-button--h40 component-button--black component-button--w-full" data-ref="btn-copy-share-link">
                  <span class="component-icon">link</span>
                  <span>Copiar el enlace</span>
                </button>
                <button type="button" class="component-button component-button--h40 component-button--outline component-button--w-full" data-ref="btn-customize-share-link">
                  <span class="component-icon">edit</span>
                  <span>Personaliza tu enlace</span>
                </button>
              </div>

              ${
                options.exportOptions && options.exportOptions.length > 0
                  ? `<div class="design-share-section" data-ref="section-share-download">
                      <div class="settings-dropdown-wrapper" data-ref="dropdown-wrapper-share-download">
                        <button type="button" class="component-button component-button--h40 component-button--icon-only" data-ref="btn-share-download-trigger" data-tooltip="Descargar" aria-label="Descargar">
                          <span class="component-icon">download</span>
                        </button>
                        <div class="dropdown-backdrop" data-ref="dropdown-backdrop-share-download">
                          <div class="menu-panel menu-panel--dropdown menu-panel--w-full menu-panel--h-auto" data-ref="dropdown-menu-share-download">
                            <div class="menu-panel__list" data-ref="list-share-download">
                              ${options.exportOptions
                                .map(
                                  (opt) => `
                                <button type="button" class="menu-item" data-ref="${escapeHtml(opt.ref)}">
                                  <span class="component-icon menu-item__icon">${escapeHtml(opt.icon)}</span>
                                  <span class="menu-item__text">${escapeHtml(opt.label)}</span>
                                </button>
                              `
                                )
                                .join('')}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>`
                  : ''
              }
            </div>
          </div>
        </div>
      </div>
    `;

    const temp = document.createElement('div');
    temp.innerHTML = markup.trim();
    backdrop = temp.firstElementChild as HTMLElement;
    wrapper.appendChild(backdrop);
    menu = backdrop.querySelector<HTMLElement>('[data-ref="dropdown-menu-share"]');
    translateElement(backdrop);
    renderIcons(backdrop);
  }

  const sectionMembers = wrapper.querySelector<HTMLElement>('[data-ref="section-share-members"]');
  const sectionAccess = wrapper.querySelector<HTMLElement>('[data-ref="section-share-access"]');
  const sectionLocalSync = wrapper.querySelector<HTMLElement>('[data-ref="section-share-local-sync"]');
  const btnSyncCloud = wrapper.querySelector<HTMLButtonElement>('[data-ref="btn-modal-sync-cloud"]');

  const shareSearchInput = wrapper.querySelector<HTMLInputElement>('[data-ref="input-share-search-people"]');
  const shareSearchResults = wrapper.querySelector<HTMLElement>('[data-ref="share-search-results"]');
  const shareMembersList = wrapper.querySelector<HTMLElement>('[data-ref="share-members-list"]');
  const btnFocusSearch = wrapper.querySelector<HTMLButtonElement>('[data-ref="btn-share-focus-search"]');
  const btnCopyLink = wrapper.querySelector<HTMLButtonElement>('[data-ref="btn-copy-share-link"]');
  const btnCustomizeLink = wrapper.querySelector<HTMLButtonElement>('[data-ref="btn-customize-share-link"]');

  const dropdownWrapperAccess = wrapper.querySelector<HTMLElement>('[data-ref="dropdown-wrapper-access-level"]');
  const accessTriggerIcon = wrapper.querySelector<HTMLElement>('[data-ref="access-level-selected-icon"]');
  const accessTriggerText = wrapper.querySelector<HTMLElement>('[data-ref="access-level-selected-text"]');
  const btnAccessPrivate = wrapper.querySelector<HTMLButtonElement>('[data-ref="btn-access-private"]');
  const btnAccessPublic = wrapper.querySelector<HTMLButtonElement>('[data-ref="btn-access-public"]');

  const sectionPublicRole = wrapper.querySelector<HTMLElement>('[data-ref="section-public-role"]');
  const dropdownWrapperPublicRole = wrapper.querySelector<HTMLElement>('[data-ref="dropdown-wrapper-public-role"]');
  const publicRoleTriggerIcon = wrapper.querySelector<HTMLElement>('[data-ref="public-role-selected-icon"]');
  const publicRoleTriggerText = wrapper.querySelector<HTMLElement>('[data-ref="public-role-selected-text"]');
  const btnPublicRoleEditor = wrapper.querySelector<HTMLButtonElement>('[data-ref="btn-public-role-editor"]');
  const btnPublicRoleViewer = wrapper.querySelector<HTMLButtonElement>('[data-ref="btn-public-role-viewer"]');

  const updateAccessUI = () => {
    const canvas = getCanvas();
    currentAccessLevel = canvas.access_level || currentAccessLevel;
    currentPublicRole = canvas.public_role || currentPublicRole;

    if (accessTriggerIcon) {
      setIconUse(accessTriggerIcon, currentAccessLevel === 'public' ? 'language' : 'lock');
    }
    if (accessTriggerText) {
      accessTriggerText.textContent =
        currentAccessLevel === 'public' ? 'Cualquier persona con el enlace' : 'Solo tú tienes acceso';
    }
    btnAccessPrivate?.classList.toggle('is-active', currentAccessLevel === 'private');
    btnAccessPublic?.classList.toggle('is-active', currentAccessLevel === 'public');

    if (sectionPublicRole) {
      sectionPublicRole.classList.toggle('is-hidden', currentAccessLevel !== 'public');
    }

    if (publicRoleTriggerIcon) {
      setIconUse(publicRoleTriggerIcon, currentPublicRole === 'viewer' ? 'visibility' : 'edit');
    }
    if (publicRoleTriggerText) {
      publicRoleTriggerText.textContent = currentPublicRole === 'viewer' ? 'Solo ver' : 'Ver y editar';
    }
    btnPublicRoleEditor?.classList.toggle('is-active', currentPublicRole !== 'viewer');
    btnPublicRoleViewer?.classList.toggle('is-active', currentPublicRole === 'viewer');
  };

  updateAccessUI();

  let accessDropdownCtrl: { close: () => void; destroy: () => void } | null = null;
  let publicRoleDropdownCtrl: { close: () => void; destroy: () => void } | null = null;
  let downloadDropdownCtrl: { close: () => void; destroy: () => void } | null = null;

  if (dropdownWrapperAccess) {
    accessDropdownCtrl = setupDropdown(dropdownWrapperAccess, {});
  }
  if (dropdownWrapperPublicRole) {
    publicRoleDropdownCtrl = setupDropdown(dropdownWrapperPublicRole, {});
  }
  const dropdownWrapperDownload = wrapper.querySelector<HTMLElement>('[data-ref="dropdown-wrapper-share-download"]');
  if (dropdownWrapperDownload) {
    downloadDropdownCtrl = setupDropdown(dropdownWrapperDownload, {});
  }

  if (options.exportOptions) {
    for (const opt of options.exportOptions) {
      const optBtn = wrapper.querySelector<HTMLButtonElement>(`[data-ref="${opt.ref}"]`);
      optBtn?.addEventListener(
        'click',
        () => {
          downloadDropdownCtrl?.close();
          dropdownController.close();
          opt.onClick();
        },
        { signal }
      );
    }
  }

  btnAccessPrivate?.addEventListener('click', async () => {
    const canvas = getCanvas();
    if (currentAccessLevel === 'private') return;
    currentAccessLevel = 'private';
    canvas.access_level = 'private';
    updateAccessUI();
    accessDropdownCtrl?.close();
    onAccessChanged?.('private', currentPublicRole);

    try {
      await patchApi(API_ROUTES.canvases.access(canvas.uuid), {
        access_level: 'private',
        public_role: currentPublicRole,
      });
      showToast('Lienzo configurado como privado', 'success');
    } catch {
      showToast('Error al actualizar el acceso', 'danger');
    }
  });

  btnAccessPublic?.addEventListener('click', async () => {
    const canvas = getCanvas();
    if (currentAccessLevel === 'public') return;
    currentAccessLevel = 'public';
    canvas.access_level = 'public';
    updateAccessUI();
    accessDropdownCtrl?.close();
    onAccessChanged?.('public', currentPublicRole);

    try {
      await patchApi(API_ROUTES.canvases.access(canvas.uuid), {
        access_level: 'public',
        public_role: currentPublicRole,
      });
      showToast('Lienzo público para cualquiera con el enlace', 'success');
    } catch {
      showToast('Error al actualizar el acceso', 'danger');
    }
  });

  btnPublicRoleEditor?.addEventListener('click', async () => {
    const canvas = getCanvas();
    if (currentPublicRole === 'editor') return;
    currentPublicRole = 'editor';
    canvas.public_role = 'editor';
    updateAccessUI();
    publicRoleDropdownCtrl?.close();
    onAccessChanged?.(currentAccessLevel, 'editor');

    try {
      await patchApi(API_ROUTES.canvases.access(canvas.uuid), {
        access_level: currentAccessLevel,
        public_role: 'editor',
      });
      showToast('Enlace configurado en modo: Ver y editar', 'success');
    } catch {
      showToast('Error al actualizar el permiso', 'danger');
    }
  });

  btnPublicRoleViewer?.addEventListener('click', async () => {
    const canvas = getCanvas();
    if (currentPublicRole === 'viewer') return;
    currentPublicRole = 'viewer';
    canvas.public_role = 'viewer';
    updateAccessUI();
    publicRoleDropdownCtrl?.close();
    onAccessChanged?.(currentAccessLevel, 'viewer');

    try {
      await patchApi(API_ROUTES.canvases.access(canvas.uuid), {
        access_level: currentAccessLevel,
        public_role: 'viewer',
      });
      showToast('Enlace configurado en modo: Solo ver', 'success');
    } catch {
      showToast('Error al actualizar el permiso', 'danger');
    }
  });

  const renderMembers = () => {
    if (!shareMembersList) return;
    shareMembersList.innerHTML = '';
    const canvas = getCanvas();

    const ownerChip = document.createElement('div');
    ownerChip.className = 'design-share-avatar-chip design-share-avatar-chip--owner';
    const ownerName = isOwner && currentUser ? currentUser.username : 'Propietario';
    ownerChip.setAttribute('data-tooltip', `${ownerName} (Propietario)`);
    ownerChip.setAttribute('aria-label', `${ownerName} (Propietario)`);
    if (isOwner && currentUser?.avatar_url) {
      ownerChip.style.backgroundImage = `url(${currentUser.avatar_url})`;
    } else {
      ownerChip.textContent = ownerName.slice(0, 2).toUpperCase();
    }
    shareMembersList.appendChild(ownerChip);

    for (const member of canvasMembers) {
      const chip = document.createElement('div');
      chip.className = 'design-share-avatar-chip';
      chip.setAttribute('data-tooltip', `${member.username} (${member.email})`);
      chip.setAttribute('aria-label', member.username);

      if (member.avatar_url) {
        chip.style.backgroundImage = `url(${member.avatar_url})`;
      } else {
        chip.textContent = member.username.slice(0, 2).toUpperCase();
      }

      if (isOwner) {
        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'design-share-avatar-chip__remove';
        removeBtn.setAttribute('data-tooltip', `Eliminar acceso a ${member.username}`);
        removeBtn.setAttribute('aria-label', `Eliminar acceso a ${member.username}`);
        removeBtn.innerHTML = '<span class="component-icon">close</span>';
        removeBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          try {
            const res = await deleteApi(API_ROUTES.canvases.removeMember(canvas.uuid, member.user_id));
            if (res.ok) {
              canvasMembers = canvasMembers.filter((m) => m.user_id !== member.user_id);
              renderMembers();
              showToast(`Acceso revocado a ${member.username}`, 'info');
            } else {
              showToast('No se pudo remover el acceso', 'danger');
            }
          } catch {
            showToast('Error al remover acceso', 'danger');
          }
        });
        chip.appendChild(removeBtn);
      }

      shareMembersList.appendChild(chip);
    }

    for (const team of canvasTeams) {
      const item = document.createElement('div');
      item.className = 'design-share-team-chip';

      const icon = document.createElement('span');
      icon.className = 'component-icon';
      icon.textContent = 'group';

      const name = document.createElement('span');
      name.className = 'design-share-team-chip__name';
      name.textContent = team.team_name || 'Equipo';

      const meta = document.createElement('span');
      meta.className = 'design-share-team-chip__count';
      meta.textContent = `(${team.member_count || 1})`;

      item.appendChild(icon);
      item.appendChild(name);
      item.appendChild(meta);

      if (isOwner) {
        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'design-share-team-chip__remove';
        removeBtn.setAttribute('data-tooltip', `Desvincular ${team.team_name || 'equipo'}`);
        removeBtn.setAttribute('aria-label', `Desvincular ${team.team_name || 'equipo'}`);
        removeBtn.innerHTML = '<span class="component-icon">close</span>';
        removeBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          try {
            const res = await deleteApi(API_ROUTES.canvases.removeTeam(canvas.uuid, team.team_id));
            if (res.ok) {
              canvasTeams = canvasTeams.filter((t) => t.team_id !== team.team_id);
              renderMembers();
              showToast(`Equipo "${team.team_name || 'equipo'}" desvinculado`, 'info');
            } else {
              showToast('No se pudo desvincular el equipo', 'danger');
            }
          } catch {
            showToast('Error al desvincular equipo', 'danger');
          }
        });
        item.appendChild(removeBtn);
      }

      shareMembersList.appendChild(item);
    }

    renderIcons(shareMembersList);
  };

  const loadData = async () => {
    const canvas = getCanvas();
    if (!currentUser || (canvas.is_local && !canvas.id)) return;
    try {
      const [membersRes, teamsRes, userTeamsRes] = await Promise.all([
        getApi(API_ROUTES.canvases.members(canvas.uuid)),
        getApi(API_ROUTES.canvases.teams(canvas.uuid)),
        getApi(API_ROUTES.teams.base),
      ]);

      if (membersRes.ok) {
        const mData = await membersRes.json();
        if (Array.isArray(mData?.members)) canvasMembers = mData.members;
      }
      if (teamsRes.ok) {
        const tData = await teamsRes.json();
        if (Array.isArray(tData?.teams)) canvasTeams = tData.teams;
      }
      if (userTeamsRes.ok) {
        const utData = await userTeamsRes.json();
        if (Array.isArray(utData?.teams)) userTeams = utData.teams;
      }
      renderMembers();
    } catch {}
  };

  const handleSearch = (query: string) => {
    if (searchTimer) clearTimeout(searchTimer);
    const clean = query.trim();
    if (clean.length < 2) {
      if (shareSearchResults) {
        shareSearchResults.classList.add('is-hidden');
        shareSearchResults.innerHTML = '';
      }
      return;
    }

    searchTimer = setTimeout(async () => {
      try {
        const res = await getApi(API_ROUTES.users.search(clean));
        if (!shareSearchResults) return;

        let users: SearchUserResult[] = [];
        if (res.ok) {
          const data = await res.json();
          users = Array.isArray(data.users) ? data.users : [];
        }

        const matchingTeams = userTeams.filter((t) => t.name.toLowerCase().includes(clean.toLowerCase()));
        shareSearchResults.innerHTML = '';

        if (users.length === 0 && matchingTeams.length === 0) {
          const empty = document.createElement('div');
          empty.className = 'design-share-search-empty';
          empty.textContent = 'No se encontraron personas ni equipos';
          shareSearchResults.appendChild(empty);
        } else {
          for (const team of matchingTeams) {
            const isAlreadyLinked = canvasTeams.some((t) => t.team_id === team.id);
            const item = document.createElement('button');
            item.type = 'button';
            item.className = 'design-share-search-item';

            const iconChip = document.createElement('div');
            iconChip.className = 'design-share-team-search-icon';
            iconChip.innerHTML = '<span class="component-icon">group</span>';

            const info = document.createElement('div');
            info.className = 'design-share-search-item__info';

            const teamName = document.createElement('span');
            teamName.className = 'design-share-search-item__username';
            teamName.textContent = team.name + (isAlreadyLinked ? ' (Ya vinculado)' : '');

            const teamMeta = document.createElement('span');
            teamMeta.className = 'design-share-search-item__email';
            teamMeta.textContent = `Equipo (${team.member_count || 1} miembros)`;

            info.appendChild(teamName);
            info.appendChild(teamMeta);
            item.appendChild(iconChip);
            item.appendChild(info);

            if (!isAlreadyLinked) {
              item.addEventListener('click', async () => {
                const canvas = getCanvas();
                try {
                  const addRes = await postApi(API_ROUTES.canvases.teams(canvas.uuid), {
                    role: 'editor',
                    teamId: team.id,
                  });
                  if (addRes.ok) {
                    showToast(`Equipo "${team.name}" vinculado exitosamente`, 'success');
                    const updated = await getApi(API_ROUTES.canvases.teams(canvas.uuid));
                    if (updated.ok) {
                      const dt = await updated.json();
                      if (Array.isArray(dt?.teams)) canvasTeams = dt.teams;
                      renderMembers();
                    }
                    if (shareSearchInput) shareSearchInput.value = '';
                    shareSearchResults.classList.add('is-hidden');
                    shareSearchResults.innerHTML = '';
                  } else {
                    showToast('No se pudo vincular el equipo', 'danger');
                  }
                } catch {
                  showToast('Error al vincular equipo', 'danger');
                }
              });
            }
            shareSearchResults.appendChild(item);
          }

          for (const user of users) {
            if (currentUser && user.id === currentUser.id) continue;
            const isAlreadyMember = canvasMembers.some((m) => m.user_id === user.id);
            const item = document.createElement('button');
            item.type = 'button';
            item.className = 'design-share-search-item';

            const avatarChip = document.createElement('div');
            avatarChip.className = 'design-share-avatar-chip';
            if (user.avatar_url) {
              avatarChip.style.backgroundImage = `url(${user.avatar_url})`;
            } else {
              avatarChip.textContent = (user.username || 'U').slice(0, 2).toUpperCase();
            }

            const info = document.createElement('div');
            info.className = 'design-share-search-item__info';

            const uName = document.createElement('span');
            uName.className = 'design-share-search-item__username';
            uName.textContent = user.username + (isAlreadyMember ? ' (Ya tiene acceso)' : '');

            const uEmail = document.createElement('span');
            uEmail.className = 'design-share-search-item__email';
            uEmail.textContent = user.email || '';

            info.appendChild(uName);
            info.appendChild(uEmail);
            item.appendChild(avatarChip);
            item.appendChild(info);

            if (!isAlreadyMember) {
              item.addEventListener('click', async () => {
                const canvas = getCanvas();
                try {
                  const addRes = await postApi(API_ROUTES.canvases.members(canvas.uuid), {
                    role: 'editor',
                    userId: user.id,
                  });
                  if (addRes.ok) {
                    const dt = await addRes.json();
                    if (dt?.member) {
                      canvasMembers.push(dt.member);
                      renderMembers();
                      showToast(`Acceso concedido a ${user.username}`, 'success');
                    }
                    if (shareSearchInput) shareSearchInput.value = '';
                    shareSearchResults.classList.add('is-hidden');
                    shareSearchResults.innerHTML = '';
                  } else {
                    showToast('No se pudo agregar a la persona', 'danger');
                  }
                } catch {
                  showToast('Error al otorgar acceso', 'danger');
                }
              });
            }
            shareSearchResults.appendChild(item);
          }
        }

        renderIcons(shareSearchResults);
        shareSearchResults.classList.remove('is-hidden');
      } catch {}
    }, 250);
  };

  shareSearchInput?.addEventListener('input', () => {
    handleSearch(shareSearchInput.value);
  });

  btnFocusSearch?.addEventListener('click', () => {
    shareSearchInput?.focus();
  });

  btnCopyLink?.addEventListener('click', async () => {
    const canvas = getCanvas();
    const slug = canvas.custom_slug || canvas.short_code;
    let fallbackPath = `/design/${canvas.uuid}`;
    if (canvas.canvas_type === 'doc' || canvas.unit === 'doc') {
      fallbackPath = `/doc/${canvas.uuid}`;
    } else {
      fallbackPath = `/board/${canvas.uuid}`;
    }

    const url = slug ? `${window.location.origin}/${slug}` : `${window.location.origin}${fallbackPath}`;
    try {
      await navigator.clipboard.writeText(url);
      showToast(t('canvas.copy_link_success') || 'Enlace copiado al portapapeles');
    } catch {
      showToast(t('canvas.copy_link_error') || 'Error al copiar el enlace', 'danger');
    }
  });

  btnCustomizeLink?.addEventListener('click', () => {
    const canvas = getCanvas();
    const currentSlug = canvas.custom_slug || '';
    const modal = openModal({
      bodyHtml: `
        <div class="field" data-ref="field-custom-slug" style="margin-top: 8px;">
          <input class="field__input" data-ref="input-custom-slug" type="text" placeholder=" " value="${escapeHtml(currentSlug)}" autocomplete="off" />
          <label class="field__label">Enlace personalizado (slug)</label>
        </div>
        <p class="settings-item__desc" style="margin-top: 8px; font-size: 12px; color: var(--text-secondary);">
          Solo letras, números, guiones y guiones bajos (3-50 caracteres).
        </p>
      `,
      confirmClass: 'component-button--black',
      confirmText: 'Guardar enlace',
      onConfirm: async (m) => {
        const input = (m.body || m.backdrop)?.querySelector<HTMLInputElement>('[data-ref="input-custom-slug"]');
        const rawSlug = (input?.value || '').trim();
        if (!rawSlug) {
          m.showError('El enlace personalizado no puede estar vacío.');
          return;
        }
        if (!/^[a-zA-Z0-9_-]{3,50}$/.test(rawSlug)) {
          m.showError('Formato inválido. Debe tener entre 3 y 50 caracteres (letras, números, guiones).');
          return;
        }

        m.setConfirmLoading(true);
        try {
          const res = await postApi(API_ROUTES.canvases.slug(canvas.uuid), { slug: rawSlug });
          if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            m.showError(errData.message || 'Error al guardar el enlace personalizado.');
            m.setConfirmLoading(false);
            return;
          }
          canvas.custom_slug = rawSlug;
          showToast('Enlace personalizado guardado con éxito', 'success');
          m.close();
        } catch {
          m.showError('Error al guardar el enlace personalizado.');
          m.setConfirmLoading(false);
        }
      },
      size: 'sm',
      title: 'Personaliza tu enlace',
    });
  });

  btnSyncCloud?.addEventListener('click', async () => {
    const canvas = getCanvas();
    if (!btnSyncCloud) return;
    btnSyncCloud.disabled = true;
    btnSyncCloud.textContent = t('canvas.syncing');

    try {
      const fullCanvas = (await getLocalCanvasByUuid(canvas.uuid)) || canvas;
      const res = await postApi(API_ROUTES.canvases.sync, {
        data: fullCanvas.data || null,
        height: fullCanvas.height,
        name: fullCanvas.name,
        preview_thumbnail: fullCanvas.preview_thumbnail || null,
        unit: fullCanvas.unit || 'px',
        uuid: fullCanvas.uuid,
        width: fullCanvas.width,
      });

      if (res.ok) {
        const data = await res.json();
        if (data?.canvas?.id) {
          canvas.id = data.canvas.id;
          canvas.is_local = false;
          await markLocalCanvasAsSynced(canvas.uuid, data.canvas.id);
          showToast(t('canvas.sync_success'));
          sectionLocalSync?.remove();
          sectionMembers?.classList.remove('is-hidden');
          sectionAccess?.classList.remove('is-hidden');
          void loadData();
          return;
        }
      }

      showToast(t('canvas.sync_error'), 'danger');
      btnSyncCloud.disabled = false;
      btnSyncCloud.textContent = 'Sincronizar a la nube';
    } catch {
      showToast(t('canvas.sync_error'), 'danger');
      btnSyncCloud.disabled = false;
      btnSyncCloud.textContent = 'Sincronizar a la nube';
    }
  });

  const dropdownController = setupDropdown(wrapper, {
    backdrop,
    isSelect: false,
    matchWidth: false,
    menu,
    placement: 'bottom-end',
    trigger,
  });

  trigger.addEventListener('click', () => {
    updateAccessUI();
    void loadData();
  }, { signal });

  return {
    close: () => {
      downloadDropdownCtrl?.close();
      dropdownController.close();
    },
    destroy: () => {
      if (searchTimer) clearTimeout(searchTimer);
      accessDropdownCtrl?.destroy();
      publicRoleDropdownCtrl?.destroy();
      downloadDropdownCtrl?.destroy();
      dropdownController.destroy();
    },
    open: () => {
      updateAccessUI();
      void loadData();
      dropdownController.open();
    },
    toggle: () => {
      updateAccessUI();
      void loadData();
      dropdownController.toggle();
    },
    update: () => dropdownController.update(),
  };
}
