import { API_ROUTES } from '../config/api-routes.js';
import { currentUser, deleteApi, escapeHtml, getApi, patchApi, postApi } from '../services/api.service.js';
import { getLocalCanvasByUuid, markLocalCanvasAsSynced } from '../services/canvas-storage.service.js';
import { renderIcons } from '../services/icon.service.js';
import { t, translateElement } from '../services/i18n.service.js';
import { showToast } from '../services/toast.service.js';
import { CanvasItem, CanvasMember, SearchUserResult } from '../types/canvas.types.js';
import { CanvasTeamItem, Team } from '../types/team.types.js';
import { setupDropdown } from '../utils/dom.util.js';

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

let activeShareModal: { close: () => void } | null = null;

export function openCanvasShareModal(canvas: CanvasItem): void {
  if (activeShareModal) {
    activeShareModal.close();
  }

  const isLoggedIn = Boolean(currentUser);
  let canvasMembers: CanvasMember[] = [];
  let canvasTeams: CanvasTeamItem[] = [];
  let userTeams: Team[] = [];
  let searchTimer: ReturnType<typeof setTimeout> | null = null;
  const isOwner = Boolean(currentUser && canvas.user_id && canvas.user_id === currentUser.id) || (!canvas.user_id && !canvas.id);
  let currentAccessLevel: 'private' | 'public' = canvas.access_level || 'private';
  let currentPublicRole: 'viewer' | 'editor' = canvas.public_role || 'editor';

  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.setAttribute('data-ref', 'modal-share-backdrop');

  backdrop.innerHTML = `
    <div class="modal-container" data-ref="modal-share-container">
      <button type="button" class="modal-close-btn" data-ref="btn-modal-close" aria-label="Cerrar ventana">
        <svg class="component-icon" aria-hidden="true"><use href="/icons.svg#close"></use></svg>
      </button>
      <div class="modal-card modal-card--w-480" data-ref="modal-card-share">
        <div class="modal-card__drag-zone" data-ref="modal-drag-zone" aria-hidden="true">
          <div class="modal-card__drag-handle"></div>
        </div>
        <div class="modal-card__header" data-ref="modal-share-header">
          <h2 class="modal-card__title">Compartir el diseño</h2>
          <p class="modal-card__desc">${escapeHtml(canvas.name)}</p>
        </div>
        <div class="modal-card__body" data-ref="modal-share-body">
          <div class="design-share-menu__content">
            ${
              !isLoggedIn
                ? `
              <div class="banner banner--info" data-ref="banner-share-login" style="margin-bottom: var(--sl-spacing-md);">
                Inicia sesión para invitar personas y administrar permisos de acceso.
              </div>
            `
                : ''
            }
            ${
              isLoggedIn && canvas.is_local && !canvas.id
                ? `
              <div class="design-share-section" data-ref="section-share-local-sync">
                <p class="settings-item__desc">Este lienzo está guardado únicamente de forma local. Sincronízalo con la nube para poder compartirlo con personas y equipos.</p>
                <button type="button" class="btn btn--h40 btn--black btn--w-full" data-ref="btn-modal-sync-cloud">
                  <span class="material-symbols-rounded">cloud_upload</span>
                  <span>Sincronizar a la nube</span>
                </button>
              </div>
            `
                : ''
            }
            <div class="design-share-section${(canvas.is_local && !canvas.id) || !isLoggedIn ? ' is-hidden' : ''}" data-ref="section-share-members">
              <span class="design-share-section__label">Personas y equipos con acceso</span>
              <div class="design-share-search-box" data-ref="share-search-box">
                <div class="component-search component-search--full" data-ref="field-share-search">
                  <div class="component-search__icon">
                    <span class="material-symbols-rounded">search</span>
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
                  <span class="material-symbols-rounded">add</span>
                </button>
              </div>
            </div>

            <div class="design-share-section${(canvas.is_local && !canvas.id) || !isLoggedIn ? ' is-hidden' : ''}" data-ref="section-share-access">
              <span class="design-share-section__label">Nivel de acceso</span>
              <div class="settings-dropdown-wrapper" data-ref="dropdown-wrapper-access-level">
                <button type="button" class="dropdown-trigger" data-ref="btn-trigger-access-level" aria-label="Nivel de acceso">
                  <div class="dropdown-trigger__left">
                    <span class="material-symbols-rounded dropdown-trigger__icon" data-ref="access-level-selected-icon">lock</span>
                    <span class="dropdown-trigger__text" data-ref="access-level-selected-text">Solo tú tienes acceso</span>
                  </div>
                  <span class="material-symbols-rounded dropdown-trigger__chevron">expand_more</span>
                </button>
                <div class="dropdown-backdrop" data-ref="dropdown-backdrop-access-level">
                  <div class="menu-panel menu-panel--dropdown menu-panel--w-full menu-panel--h-auto" data-ref="dropdown-menu-access-level">
                    <div class="menu-panel__drag-zone" data-ref="access-drag-zone" aria-hidden="true">
                      <div class="menu-panel__drag-handle"></div>
                    </div>
                    <div class="menu-panel__list" data-ref="list-access-level">
                      <button type="button" class="menu-item is-active" data-ref="btn-access-private" data-value="private">
                        <span class="material-symbols-rounded menu-item__icon">lock</span>
                        <span class="menu-item__text">Solo tú tienes acceso</span>
                      </button>
                      <button type="button" class="menu-item" data-ref="btn-access-public" data-value="public">
                        <span class="material-symbols-rounded menu-item__icon">language</span>
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
                    <span class="material-symbols-rounded dropdown-trigger__icon" data-ref="public-role-selected-icon">edit</span>
                    <span class="dropdown-trigger__text" data-ref="public-role-selected-text">Ver y editar</span>
                  </div>
                  <span class="material-symbols-rounded dropdown-trigger__chevron">expand_more</span>
                </button>
                <div class="dropdown-backdrop" data-ref="dropdown-backdrop-public-role">
                  <div class="menu-panel menu-panel--dropdown menu-panel--w-full menu-panel--h-auto" data-ref="dropdown-menu-public-role">
                    <div class="menu-panel__drag-zone" data-ref="public-role-drag-zone" aria-hidden="true">
                      <div class="menu-panel__drag-handle"></div>
                    </div>
                    <div class="menu-panel__list" data-ref="list-public-role">
                      <button type="button" class="menu-item is-active" data-ref="btn-public-role-editor" data-value="editor">
                        <span class="material-symbols-rounded menu-item__icon">edit</span>
                        <span class="menu-item__text">Ver y editar</span>
                      </button>
                      <button type="button" class="menu-item" data-ref="btn-public-role-viewer" data-value="viewer">
                        <span class="material-symbols-rounded menu-item__icon">visibility</span>
                        <span class="menu-item__text">Solo ver</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div class="design-share-link-row">
              <button type="button" class="btn btn--h40 btn--black btn--w-full" data-ref="btn-copy-share-link">
                <span class="material-symbols-rounded">link</span>
                <span>Copiar el enlace</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(backdrop);
  document.body.classList.add('modal-open');
  translateElement(backdrop);
  renderIcons(backdrop);

  requestAnimationFrame(() => {
    backdrop.classList.add('is-visible');
  });

  const closeBtn = backdrop.querySelector<HTMLButtonElement>('[data-ref="btn-modal-close"]');
  const card = backdrop.querySelector<HTMLElement>('[data-ref="modal-card-share"]');
  const sectionMembers = backdrop.querySelector<HTMLElement>('[data-ref="section-share-members"]');
  const sectionAccess = backdrop.querySelector<HTMLElement>('[data-ref="section-share-access"]');
  const sectionLocalSync = backdrop.querySelector<HTMLElement>('[data-ref="section-share-local-sync"]');
  const btnSyncCloud = backdrop.querySelector<HTMLButtonElement>('[data-ref="btn-modal-sync-cloud"]');

  const shareSearchInput = backdrop.querySelector<HTMLInputElement>('[data-ref="input-share-search-people"]');
  const shareSearchResults = backdrop.querySelector<HTMLElement>('[data-ref="share-search-results"]');
  const shareMembersList = backdrop.querySelector<HTMLElement>('[data-ref="share-members-list"]');
  const btnFocusSearch = backdrop.querySelector<HTMLButtonElement>('[data-ref="btn-share-focus-search"]');
  const btnCopyLink = backdrop.querySelector<HTMLButtonElement>('[data-ref="btn-copy-share-link"]');

  const dropdownWrapperAccess = backdrop.querySelector<HTMLElement>('[data-ref="dropdown-wrapper-access-level"]');
  const accessTriggerIcon = backdrop.querySelector<HTMLElement>('[data-ref="access-level-selected-icon"]');
  const accessTriggerText = backdrop.querySelector<HTMLElement>('[data-ref="access-level-selected-text"]');
  const btnAccessPrivate = backdrop.querySelector<HTMLButtonElement>('[data-ref="btn-access-private"]');
  const btnAccessPublic = backdrop.querySelector<HTMLButtonElement>('[data-ref="btn-access-public"]');

  const sectionPublicRole = backdrop.querySelector<HTMLElement>('[data-ref="section-public-role"]');
  const dropdownWrapperPublicRole = backdrop.querySelector<HTMLElement>('[data-ref="dropdown-wrapper-public-role"]');
  const publicRoleTriggerIcon = backdrop.querySelector<HTMLElement>('[data-ref="public-role-selected-icon"]');
  const publicRoleTriggerText = backdrop.querySelector<HTMLElement>('[data-ref="public-role-selected-text"]');
  const btnPublicRoleEditor = backdrop.querySelector<HTMLButtonElement>('[data-ref="btn-public-role-editor"]');
  const btnPublicRoleViewer = backdrop.querySelector<HTMLButtonElement>('[data-ref="btn-public-role-viewer"]');

  let isClosing = false;
  const closeModal = () => {
    if (isClosing) return;
    isClosing = true;
    if (searchTimer) clearTimeout(searchTimer);
    backdrop.classList.remove('is-visible');
    document.removeEventListener('keydown', onKeyDown);
    setTimeout(() => {
      backdrop.remove();
      document.body.classList.remove('modal-open');
      if (activeShareModal?.close === closeModal) {
        activeShareModal = null;
      }
    }, 200);
  };

  activeShareModal = { close: closeModal };

  closeBtn?.addEventListener('click', closeModal);
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) closeModal();
  });
  card?.addEventListener('click', (e) => {
    e.stopPropagation();
  });

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      closeModal();
      document.removeEventListener('keydown', onKeyDown);
    }
  };
  document.addEventListener('keydown', onKeyDown);

  const updateAccessUI = () => {
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

  const accessDropdownCtrl = setupDropdown(dropdownWrapperAccess, {});
  const publicRoleDropdownCtrl = setupDropdown(dropdownWrapperPublicRole, {});

  btnAccessPrivate?.addEventListener('click', async () => {
    if (currentAccessLevel === 'private') return;
    currentAccessLevel = 'private';
    canvas.access_level = 'private';
    updateAccessUI();
    accessDropdownCtrl.close();

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
    if (currentAccessLevel === 'public') return;
    currentAccessLevel = 'public';
    canvas.access_level = 'public';
    updateAccessUI();
    accessDropdownCtrl.close();

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
    if (currentPublicRole === 'editor') return;
    currentPublicRole = 'editor';
    canvas.public_role = 'editor';
    updateAccessUI();
    publicRoleDropdownCtrl.close();

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
    if (currentPublicRole === 'viewer') return;
    currentPublicRole = 'viewer';
    canvas.public_role = 'viewer';
    updateAccessUI();
    publicRoleDropdownCtrl.close();

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

  void loadData();

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
            uEmail.textContent = user.email;

            info.appendChild(uName);
            info.appendChild(uEmail);
            item.appendChild(avatarChip);
            item.appendChild(info);

            if (!isAlreadyMember) {
              item.addEventListener('click', async () => {
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
    const url = `${window.location.origin}/design/${canvas.uuid}`;
    try {
      await navigator.clipboard.writeText(url);
      showToast(t('canvas.copy_link_success'));
    } catch {
      showToast(t('canvas.copy_link_error'), 'danger');
    }
  });

  btnSyncCloud?.addEventListener('click', async () => {
    btnSyncCloud.disabled = true;
    btnSyncCloud.textContent = t('canvas.syncing');

    try {
      const fullCanvas = (await getLocalCanvasByUuid(canvas.uuid)) || canvas;
      const res = await postApi(API_ROUTES.canvases.sync, {
        uuid: fullCanvas.uuid,
        name: fullCanvas.name,
        width: fullCanvas.width,
        height: fullCanvas.height,
        unit: fullCanvas.unit || 'px',
        data: fullCanvas.data || null,
        preview_thumbnail: fullCanvas.preview_thumbnail || null,
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
}
