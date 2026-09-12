import { navigate } from '../app-router.js';
import { createSidebar } from '../components/layout.component.js';
import { openUpgradeModal } from '../components/upgrade-modal.component.js';
import { API_ROUTES } from '../config/api-routes.js';
import { currentUser, deleteApi, escapeHtml, getApi, patchApi, postApi } from '../services/api.service.js';
import { t, translateElement } from '../services/i18n.service.js';
import { renderIcons } from '../services/icon.service.js';
import { loadTemplate } from '../services/template.service.js';
import { showToast } from '../services/toast.service.js';
import { SearchUserResult } from '../types/canvas.types.js';
import { Team, TeamMember } from '../types/team.types.js';
import { removeEmptyState, renderEmptyState, setupDropdown } from '../utils/dom.util.js';

function formatDate(iso?: string): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return iso;
  }
}

class TeamsController {
  private container: HTMLElement;
  private abortController: AbortController;
  private allTeams: Team[] = [];
  private selectedTeamUuids = new Set<string>();
  private currentTeam: Team | null = null;
  private currentMembers: TeamMember[] = [];
  private selectedColor = '#6366f1';
  private isSearchActive = false;

  private tableEl: HTMLElement | null = null;
  private tbodyEl: HTMLElement | null = null;
  private tableWrapperEl: HTMLElement | null = null;
  private defaultActions: HTMLElement | null = null;
  private selectedActions: HTMLElement | null = null;
  private btnActionMembers: HTMLElement | null = null;
  private btnActionEdit: HTMLElement | null = null;
  private btnActionDelete: HTMLElement | null = null;

  private btnToggleSearch: HTMLElement | null = null;
  private searchToolbar: HTMLElement | null = null;
  private searchInput: HTMLInputElement | null = null;
  private btnClearSearch: HTMLElement | null = null;
  private btnCreateTeam: HTMLElement | null = null;

  private modalTeamBackdrop: HTMLElement | null = null;
  private modalTeamTitle: HTMLElement | null = null;
  private formTeam: HTMLFormElement | null = null;
  private inputTeamName: HTMLInputElement | null = null;
  private inputTeamDesc: HTMLInputElement | null = null;
  private bannerTeamError: HTMLElement | null = null;

  private modalMembersBackdrop: HTMLElement | null = null;
  private membersModalTitle: HTMLElement | null = null;
  private inputAddMember: HTMLInputElement | null = null;
  private btnAddMember: HTMLElement | null = null;
  private membersDropdownWrapper: HTMLElement | null = null;
  private membersTriggerText: HTMLElement | null = null;
  private membersDropdownList: HTMLElement | null = null;
  private membersDropdownController: ReturnType<typeof setupDropdown> | null = null;

  private lockedStateEl: HTMLElement | null = null;
  private btnLockedUpgrade: HTMLElement | null = null;
  private btnLockedHome: HTMLElement | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
    this.abortController = new AbortController();
  }

  public async init(): Promise<void> {
    this.tableEl = this.container.querySelector<HTMLElement>('[data-ref="teams-table"]');
    this.tbodyEl = this.container.querySelector<HTMLElement>('[data-ref="teams-tbody"]');
    this.tableWrapperEl = this.container.querySelector<HTMLElement>('[data-ref="teams-table-wrapper"]');

    this.lockedStateEl = this.container.querySelector<HTMLElement>('[data-ref="teams-locked-state"]');
    this.btnLockedUpgrade = this.container.querySelector<HTMLElement>('[data-ref="btn-locked-upgrade"]');
    this.btnLockedHome = this.container.querySelector<HTMLElement>('[data-ref="btn-locked-home"]');

    this.defaultActions = this.container.querySelector<HTMLElement>('[data-ref="teams-default-actions"]');
    this.selectedActions = this.container.querySelector<HTMLElement>('[data-ref="teams-selected-actions"]');
    this.btnActionMembers = this.container.querySelector<HTMLElement>('[data-ref="btn-action-members"]');
    this.btnActionEdit = this.container.querySelector<HTMLElement>('[data-ref="btn-action-edit"]');
    this.btnActionDelete = this.container.querySelector<HTMLElement>('[data-ref="btn-action-delete"]');

    this.btnToggleSearch = this.container.querySelector<HTMLElement>('[data-ref="btn-toggle-search"]');
    this.searchToolbar = this.container.querySelector<HTMLElement>('[data-ref="search-toolbar"]');
    this.searchInput = this.container.querySelector<HTMLInputElement>('[data-ref="teams-search-input"]');
    this.btnClearSearch = this.container.querySelector<HTMLElement>('[data-ref="btn-clear-search"]');
    this.btnCreateTeam = this.container.querySelector<HTMLElement>('[data-ref="btn-create-team"]');

    this.modalTeamBackdrop = this.container.querySelector<HTMLElement>('[data-ref="modal-team-backdrop"]');
    this.modalTeamTitle = this.container.querySelector<HTMLElement>('[data-ref="modal-team-title"]');
    this.formTeam = this.container.querySelector<HTMLFormElement>('[data-ref="form-team"]');
    this.inputTeamName = this.container.querySelector<HTMLInputElement>('[data-ref="input-team-name"]');
    this.inputTeamDesc = this.container.querySelector<HTMLInputElement>('[data-ref="input-team-desc"]');
    this.bannerTeamError = this.container.querySelector<HTMLElement>('[data-ref="banner-team-error"]');

    this.modalMembersBackdrop = this.container.querySelector<HTMLElement>('[data-ref="modal-members-backdrop"]');
    this.membersModalTitle = this.container.querySelector<HTMLElement>('[data-ref="members-modal-title"]');
    this.inputAddMember = this.container.querySelector<HTMLInputElement>('[data-ref="input-add-member"]');
    this.btnAddMember = this.container.querySelector<HTMLElement>('[data-ref="btn-add-member"]');
    this.membersDropdownWrapper = this.container.querySelector<HTMLElement>('[data-ref="members-dropdown-wrapper"]');
    this.membersTriggerText = this.container.querySelector<HTMLElement>('[data-ref="members-trigger-text"]');
    this.membersDropdownList = this.container.querySelector<HTMLElement>('[data-ref="members-dropdown-list"]');

    if (this.membersDropdownWrapper) {
      this.membersDropdownController = setupDropdown(this.membersDropdownWrapper, {
        isSelect: false,
        matchWidth: true,
        placement: 'bottom-start',
      });
    }

    this.bindEvents();
    await this.loadTeams();
  }

  private bindEvents(): void {
    const { signal } = this.abortController;

    this.btnLockedUpgrade?.addEventListener('click', () => {
      openUpgradeModal('pro');
    }, { signal });

    this.btnLockedHome?.addEventListener('click', () => {
      navigate('/');
    }, { signal });

    window.addEventListener('subscription-updated', () => {
      void this.loadTeams();
    }, { signal });

    this.btnCreateTeam?.addEventListener('click', () => this.openTeamModal(), { signal });

    this.btnToggleSearch?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.toggleSearchToolbar();
    }, { signal });

    document.addEventListener('click', (e) => {
      if (!this.isSearchActive) return;
      if (
        this.searchToolbar &&
        !this.searchToolbar.contains(e.target as Node) &&
        this.btnToggleSearch &&
        !this.btnToggleSearch.contains(e.target as Node)
      ) {
        this.toggleSearchToolbar(false);
      }
    }, { signal });

    document.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (this.isSearchActive) {
          this.toggleSearchToolbar(false);
        } else if (this.selectedTeamUuids.size > 0) {
          this.selectedTeamUuids.clear();
          this.updateSelectionUi();
        }
        if (this.modalTeamBackdrop?.classList.contains('is-visible')) {
          this.closeTeamModal();
        }
        if (this.modalMembersBackdrop?.classList.contains('is-visible')) {
          this.closeMembersModal();
        }
      }
    }, { signal });

    this.btnClearSearch?.addEventListener('click', (e) => {
      e.preventDefault();
      if (this.searchInput) {
        this.searchInput.value = '';
        if (this.btnClearSearch) this.btnClearSearch.style.display = 'none';
        this.renderRows(this.allTeams);
        this.searchInput.focus();
      }
    }, { signal });

    this.searchInput?.addEventListener('input', () => {
      const query = (this.searchInput?.value || '').trim().toLowerCase();
      if (this.btnClearSearch) {
        this.btnClearSearch.style.display = query.length > 0 ? 'inline-flex' : 'none';
      }

      if (!query) {
        this.renderRows(this.allTeams);
        return;
      }

      const filtered = this.allTeams.filter((t) => {
        const name = (t.name || '').toLowerCase();
        const desc = (t.description || '').toLowerCase();
        const role = (t.user_role || '').toLowerCase();
        return name.includes(query) || desc.includes(query) || role.includes(query);
      });

      this.renderRows(filtered, true);
    }, { signal });

    this.btnActionMembers?.addEventListener('click', () => {
      const selectedUuid = [...this.selectedTeamUuids][0];
      const team = this.allTeams.find((t) => t.uuid === selectedUuid);
      if (team) {
        void this.openMembersModal(team);
      }
    }, { signal });

    this.btnActionEdit?.addEventListener('click', () => {
      const selectedUuid = [...this.selectedTeamUuids][0];
      const team = this.allTeams.find((t) => t.uuid === selectedUuid);
      if (team) {
        this.openTeamModal(team);
      }
    }, { signal });

    this.btnActionDelete?.addEventListener('click', () => {
      void this.handleDeleteSelectedTeams();
    }, { signal });

    const btnCloseTeamModal = this.container.querySelector<HTMLElement>('[data-ref="btn-close-team-modal"]');
    btnCloseTeamModal?.addEventListener('click', () => this.closeTeamModal(), { signal });

    const btnCancelTeam = this.container.querySelector<HTMLElement>('[data-ref="btn-cancel-team"]');
    btnCancelTeam?.addEventListener('click', () => this.closeTeamModal(), { signal });

    this.modalTeamBackdrop?.addEventListener('click', (e) => {
      if (e.target === this.modalTeamBackdrop) this.closeTeamModal();
    }, { signal });

    this.formTeam?.addEventListener('submit', (e) => {
      e.preventDefault();
      void this.handleSaveTeam();
    }, { signal });

    const btnCloseMembersModal = this.container.querySelector<HTMLElement>('[data-ref="btn-close-members-modal"]');
    btnCloseMembersModal?.addEventListener('click', () => this.closeMembersModal(), { signal });

    const btnDoneMembers = this.container.querySelector<HTMLElement>('[data-ref="btn-done-members"]');
    btnDoneMembers?.addEventListener('click', () => this.closeMembersModal(), { signal });

    this.modalMembersBackdrop?.addEventListener('click', (e) => {
      if (e.target === this.modalMembersBackdrop) this.closeMembersModal();
    }, { signal });

    this.btnAddMember?.addEventListener('click', () => {
      void this.handleAddMemberFromInput();
    }, { signal });

    this.inputAddMember?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        void this.handleAddMemberFromInput();
      }
    }, { signal });
  }

  public destroy(): void {
    this.membersDropdownController?.destroy();
    this.abortController.abort();
  }

  private toggleSearchToolbar(forceState?: boolean): void {
    this.isSearchActive = forceState !== undefined ? forceState : !this.isSearchActive;

    if (this.searchToolbar) {
      this.searchToolbar.classList.toggle('is-active', this.isSearchActive);
      this.searchToolbar.classList.toggle('is-hidden', !this.isSearchActive);
    }

    if (this.btnToggleSearch) {
      this.btnToggleSearch.classList.toggle('is-active', this.isSearchActive);
    }

    if (this.isSearchActive && this.searchInput) {
      setTimeout(() => {
        this.searchInput?.focus();
      }, 50);
    }
  }

  private async loadTeams(): Promise<void> {
    if (!currentUser) return;

    const userTier = (currentUser.subscription_tier || 'free').toLowerCase();
    if (userTier === 'free') {
      if (this.lockedStateEl) {
        this.lockedStateEl.classList.remove('is-hidden');
        renderIcons(this.lockedStateEl);
      }
      if (this.tableEl) this.tableEl.style.display = 'none';
      if (this.defaultActions) this.defaultActions.style.display = 'none';
      if (this.selectedActions) this.selectedActions.style.display = 'none';
      if (this.searchToolbar) this.searchToolbar.classList.add('is-hidden');
      if (this.tableWrapperEl) {
        removeEmptyState(this.tableWrapperEl, 'teams-empty-state');
      }
      return;
    }

    if (this.lockedStateEl) {
      this.lockedStateEl.classList.add('is-hidden');
    }
    if (this.defaultActions) {
      this.defaultActions.style.display = 'flex';
    }

    try {
      const res = await getApi(API_ROUTES.teams.base);
      if (res.ok) {
        const data = await res.json();
        this.allTeams = Array.isArray(data.teams) ? data.teams : [];
        this.renderRows(this.allTeams);
      }
    } catch {
      showToast(t('teams.load_error') || 'Error al cargar equipos', 'danger');
    }
  }

  private renderRows(teams: Team[], isSearchResult = false): void {
    if (!this.tbodyEl) return;

    if (teams.length === 0) {
      if (this.tableEl) this.tableEl.style.display = 'none';
      if (this.tableWrapperEl) {
        renderEmptyState({
          container: this.tableWrapperEl,
          dataRef: 'teams-empty-state',
          desc: isSearchResult
            ? t('teams.search_no_results') || 'No se encontraron equipos que coincidan con la búsqueda.'
            : t('teams.empty_desc') || 'Crea un equipo de trabajo para compartir lienzos con varias personas a la vez con un solo clic.',
          graphicType: isSearchResult ? 'search' : 'users',
          isTable: true,
          title: isSearchResult
            ? t('teams.search_no_results_title') || 'Sin resultados'
            : t('teams.empty_title') || 'Aún no tienes equipos',
        });
      }
      this.updateSelectionUi();
      return;
    }

    if (this.tableWrapperEl) {
      removeEmptyState(this.tableWrapperEl, 'teams-empty-state');
    }
    if (this.tableEl) this.tableEl.style.display = 'table';
    this.tbodyEl.innerHTML = '';

    for (const team of teams) {
      const tr = document.createElement('tr');
      tr.className = 'is-selectable';
      tr.setAttribute('data-ref', `team-row-${team.uuid}`);
      tr.setAttribute('data-uuid', team.uuid);

      const tdTeam = document.createElement('td');
      tdTeam.setAttribute('data-ref', `cell-team-${team.uuid}`);
      tdTeam.innerHTML = `<span class="component-badge component-badge--sm" data-ref="badge-team-${team.uuid}">${escapeHtml(team.name)}</span>`;

      const tdDesc = document.createElement('td');
      tdDesc.setAttribute('data-ref', `cell-desc-${team.uuid}`);
      tdDesc.innerHTML = `<span class="component-badge component-badge--sm" data-ref="badge-desc-${team.uuid}">${escapeHtml(team.description || '—')}</span>`;

      const tdMembers = document.createElement('td');
      tdMembers.setAttribute('data-ref', `cell-members-${team.uuid}`);
      const count = Number(team.member_count) || 1;
      tdMembers.innerHTML = `<span class="component-badge component-badge--sm" data-ref="badge-members-${team.uuid}">${count} ${count === 1 ? 'miembro' : 'miembros'}</span>`;

      const tdRole = document.createElement('td');
      tdRole.setAttribute('data-ref', `cell-role-${team.uuid}`);
      const roleText = team.user_role === 'owner' ? 'Propietario' : team.user_role === 'admin' ? 'Admin' : 'Miembro';
      tdRole.innerHTML = `<span class="component-badge component-badge--sm" data-ref="badge-role-${team.uuid}">${escapeHtml(roleText)}</span>`;

      const tdDate = document.createElement('td');
      tdDate.setAttribute('data-ref', `cell-date-${team.uuid}`);
      tdDate.innerHTML = `<span class="component-badge component-badge--sm" data-ref="badge-date-${team.uuid}">${escapeHtml(formatDate(team.created_at))}</span>`;

      tr.appendChild(tdTeam);
      tr.appendChild(tdDesc);
      tr.appendChild(tdMembers);
      tr.appendChild(tdRole);
      tr.appendChild(tdDate);

      tr.addEventListener('click', () => {
        if (this.selectedTeamUuids.has(team.uuid)) {
          this.selectedTeamUuids.delete(team.uuid);
        } else {
          this.selectedTeamUuids.add(team.uuid);
        }
        this.updateSelectionUi();
      }, { signal: this.abortController.signal });

      this.tbodyEl.appendChild(tr);
    }

    this.updateSelectionUi();
    renderIcons(this.container);
  }

  private updateSelectionUi(): void {
    const totalSelected = this.selectedTeamUuids.size;

    if (totalSelected === 0) {
      if (this.defaultActions) this.defaultActions.style.display = 'flex';
      if (this.selectedActions) this.selectedActions.style.display = 'none';
    } else {
      if (this.defaultActions) this.defaultActions.style.display = 'none';
      if (this.selectedActions) this.selectedActions.style.display = 'flex';

      if (totalSelected === 1) {
        const selectedUuid = [...this.selectedTeamUuids][0];
        const selectedTeam = this.allTeams.find((t) => t.uuid === selectedUuid);

        if (this.btnActionMembers) this.btnActionMembers.style.display = 'inline-flex';

        if (this.btnActionEdit) {
          const canEdit = selectedTeam?.user_role === 'owner' || selectedTeam?.user_role === 'admin';
          this.btnActionEdit.style.display = canEdit ? 'inline-flex' : 'none';
        }

        if (this.btnActionDelete) {
          this.btnActionDelete.style.display = 'inline-flex';
          const isOwner = selectedTeam?.user_role === 'owner';
          const label = isOwner ? 'Eliminar' : 'Salir';
          this.btnActionDelete.setAttribute('data-tooltip', label);
          this.btnActionDelete.setAttribute('aria-label', label);
        }
      } else {
        if (this.btnActionMembers) this.btnActionMembers.style.display = 'none';
        if (this.btnActionEdit) this.btnActionEdit.style.display = 'none';
        if (this.btnActionDelete) {
          this.btnActionDelete.style.display = 'inline-flex';
          this.btnActionDelete.setAttribute('data-tooltip', 'Eliminar');
          this.btnActionDelete.setAttribute('aria-label', 'Eliminar');
        }
      }
    }

    const rows = this.tbodyEl?.querySelectorAll<HTMLTableRowElement>('tr[data-uuid]');
    rows?.forEach((row) => {
      const uuid = row.getAttribute('data-uuid');
      if (!uuid) return;
      const isSelected = this.selectedTeamUuids.has(uuid);
      row.classList.toggle('is-selected', isSelected);
    });
  }

  private async handleDeleteSelectedTeams(): Promise<void> {
    if (this.selectedTeamUuids.size === 0) return;

    const selectedList = this.allTeams.filter((t) => this.selectedTeamUuids.has(t.uuid));
    const count = selectedList.length;

    let confirmMsg = '';
    if (count === 1) {
      const single = selectedList[0];
      if (single.user_role === 'owner') {
        confirmMsg = `¿Estás seguro de que deseas eliminar el equipo "${single.name}"? Esta acción no se puede deshacer.`;
      } else {
        confirmMsg = `¿Estás seguro de que deseas salir del equipo "${single.name}"?`;
      }
    } else {
      confirmMsg = `¿Estás seguro de que deseas eliminar o salir de los ${count} equipos seleccionados?`;
    }

    if (!window.confirm(confirmMsg)) return;

    try {
      for (const team of selectedList) {
        if (team.user_role === 'owner') {
          await deleteApi(API_ROUTES.teams.byId(team.uuid));
        } else if (currentUser) {
          await deleteApi(API_ROUTES.teams.removeMember(team.uuid, currentUser.id));
        }
      }

      showToast(count === 1 ? 'Acción realizada correctamente' : `${count} equipos procesados`, 'info');
      this.selectedTeamUuids.clear();
      await this.loadTeams();
    } catch {
      showToast('Error al procesar la eliminación', 'danger');
    }
  }

  private openTeamModal(teamToEdit?: Team): void {
    if (!teamToEdit) {
      const userTier = (currentUser?.subscription_tier || 'free').toLowerCase();
      if (userTier === 'free') {
        showToast(t('teams.toast_upgrade_required') || 'La creación de equipos requiere una suscripción Pro o Negocios.', 'warning');
        openUpgradeModal('pro');
        return;
      }
      const ownedTeams = this.allTeams.filter((t) => t.user_role === 'owner');
      if (userTier === 'pro' && ownedTeams.length >= 1) {
        showToast(t('teams.toast_pro_teams_limit') || 'El plan Pro permite 1 equipo. Mejora a Negocios para equipos ilimitados.', 'warning');
        openUpgradeModal('business');
        return;
      }
    }

    this.currentTeam = teamToEdit || null;
    if (this.bannerTeamError) {
      this.bannerTeamError.classList.add('is-hidden');
      this.bannerTeamError.textContent = '';
    }

    if (this.modalTeamTitle) {
      this.modalTeamTitle.textContent = teamToEdit ? 'Editar equipo' : 'Nuevo equipo de trabajo';
    }

    if (this.inputTeamName) {
      this.inputTeamName.value = teamToEdit ? teamToEdit.name : '';
    }

    if (this.inputTeamDesc) {
      this.inputTeamDesc.value = teamToEdit && teamToEdit.description ? teamToEdit.description : '';
    }

    this.selectedColor = teamToEdit ? teamToEdit.color : '#6366f1';

    if (this.modalTeamBackdrop) {
      this.modalTeamBackdrop.classList.add('is-visible');
      document.body.classList.add('modal-open');
      renderIcons(this.modalTeamBackdrop);
    }
    setTimeout(() => this.inputTeamName?.focus(), 80);
  }

  private closeTeamModal(): void {
    if (this.modalTeamBackdrop) {
      this.modalTeamBackdrop.classList.remove('is-visible');
      document.body.classList.remove('modal-open');
    }
    this.currentTeam = null;
  }

  private async handleSaveTeam(): Promise<void> {
    const name = this.inputTeamName?.value.trim();
    if (!name) return;
    const description = this.inputTeamDesc?.value.trim();

    try {
      if (this.currentTeam) {
        const res = await patchApi(API_ROUTES.teams.byId(this.currentTeam.uuid), {
          name,
          description,
          color: this.selectedColor,
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          this.showTeamError(errData.error || 'No se pudo actualizar el equipo.');
          return;
        }

        showToast('Equipo actualizado correctamente', 'success');
      } else {
        const res = await postApi(API_ROUTES.teams.base, {
          name,
          description,
          color: this.selectedColor,
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          this.showTeamError(errData.error || 'No se pudo crear el equipo.');
          return;
        }

        showToast('Equipo creado exitosamente', 'success');
      }

      this.closeTeamModal();
      await this.loadTeams();
    } catch {
      this.showTeamError('Ha ocurrido un error inesperado al guardar el equipo.');
    }
  }

  private showTeamError(msg: string): void {
    if (!this.bannerTeamError) return;
    this.bannerTeamError.textContent = msg;
      this.bannerTeamError.classList.remove('is-hidden');
  }

  private async openMembersModal(team: Team): Promise<void> {
    this.currentTeam = team;

    if (this.membersModalTitle) {
      this.membersModalTitle.textContent = `${t('teams.members_title') || 'Integrantes del equipo'}: ${team.name}`;
    }

    if (this.inputAddMember) {
      this.inputAddMember.value = '';
    }

    if (this.membersTriggerText) {
      this.membersTriggerText.textContent = `${t('teams.col_members') || 'Integrantes'} (${team.member_count || 1})`;
    }

    if (this.modalMembersBackdrop) {
      this.modalMembersBackdrop.classList.add('is-visible');
      document.body.classList.add('modal-open');
      renderIcons(this.modalMembersBackdrop);
    }
    await this.loadCurrentTeamDetails(team.uuid);
  }

  private closeMembersModal(): void {
    this.membersDropdownController?.close();
    if (this.modalMembersBackdrop) {
      this.modalMembersBackdrop.classList.remove('is-visible');
      document.body.classList.remove('modal-open');
    }
    this.currentTeam = null;
    this.currentMembers = [];
  }

  private async loadCurrentTeamDetails(uuid: string): Promise<void> {
    try {
      const res = await getApi(API_ROUTES.teams.byId(uuid));
      if (res.ok) {
        const data = await res.json();
        this.currentMembers = Array.isArray(data.members) ? data.members : [];
        if (this.membersTriggerText) {
          this.membersTriggerText.textContent = `${t('teams.col_members') || 'Integrantes'} (${this.currentMembers.length})`;
        }
        this.renderMembersDropdown();
      }
    } catch {
      showToast(t('teams.load_members_error') || 'Error al cargar integrantes del equipo', 'danger');
    }
  }

  private renderMembersDropdown(): void {
    if (!this.membersDropdownList) return;
    this.membersDropdownList.innerHTML = '';

    if (this.currentMembers.length === 0) {
      const emptyItem = document.createElement('div');
      emptyItem.className = 'menu-item';
      emptyItem.style.color = 'var(--text-secondary)';
      emptyItem.style.cursor = 'default';
      emptyItem.textContent = 'No hay integrantes en este equipo.';
      this.membersDropdownList.appendChild(emptyItem);
      return;
    }

    const canManage = this.currentTeam?.user_role === 'owner' || this.currentTeam?.user_role === 'admin';
    const teamColor = this.currentTeam?.color || '#6366f1';

    for (const member of this.currentMembers) {
      const item = document.createElement('div');
      item.className = 'menu-item menu-item--member';
      item.setAttribute('data-ref', `member-item-${member.user_id}`);

      const avatar = document.createElement('div');
      avatar.className = 'account-item__avatar';
      avatar.style.backgroundColor = teamColor;
      if (member.avatar_url) {
        avatar.innerHTML = `<img class="avatar-img image-lazy-fade" src="${escapeHtml(member.avatar_url)}" alt="${escapeHtml(member.username)}" referrerpolicy="no-referrer" onload="this.classList.add('image-loaded')" onerror="this.classList.add('image-loaded')" />`;
      } else {
        avatar.textContent = (member.username || 'U').slice(0, 2).toUpperCase();
      }

      const info = document.createElement('div');
      info.className = 'account-item__info';

      const uName = document.createElement('span');
      uName.className = 'account-item__name';
      uName.textContent = member.username || 'Usuario';

      const uEmail = document.createElement('span');
      uEmail.className = 'account-item__email';
      uEmail.textContent = member.email || '';

      info.appendChild(uName);
      info.appendChild(uEmail);

      const roleBadge = document.createElement('span');
      const isOwner = this.currentTeam?.owner_id === member.user_id;
      roleBadge.className = `team-badge team-badge--${isOwner ? 'owner' : member.role}`;
      roleBadge.textContent = isOwner ? 'Propietario' : member.role === 'admin' ? 'Admin' : 'Miembro';

      item.appendChild(avatar);
      item.appendChild(info);
      item.appendChild(roleBadge);

      if (canManage && !isOwner && member.user_id !== currentUser?.id) {
        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'btn-icon-soft';
        removeBtn.setAttribute('data-tooltip', `Remover a ${member.username}`);
        removeBtn.setAttribute('aria-label', `Remover a ${member.username}`);
        removeBtn.innerHTML = '<span class="material-symbols-rounded" style="font-size: 18px;">person_remove</span>';
        removeBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          void this.handleRemoveMember(member.user_id, member.username || 'usuario');
        }, { signal: this.abortController.signal });
        item.appendChild(removeBtn);
      }

      this.membersDropdownList.appendChild(item);
    }

    renderIcons(this.membersDropdownList);
  }

  private async handleAddMemberFromInput(): Promise<void> {
    if (!this.currentTeam || !this.inputAddMember) return;
    const query = this.inputAddMember.value.trim();
    if (!query) return;

    try {
      const res = await getApi(API_ROUTES.users.search(query));
      if (!res.ok) {
        showToast('Error al buscar usuario', 'danger');
        return;
      }

      const data = await res.json();
      const users: SearchUserResult[] = data.users || [];
      if (users.length === 0) {
        showToast('No se encontró ningún usuario con ese nombre o correo.', 'danger');
        return;
      }

      const targetUser = users.find(
        (u) => u.username.toLowerCase() === query.toLowerCase() || (Boolean(u.email) && u.email?.toLowerCase() === query.toLowerCase())
      ) || users[0];

      const alreadyMember = this.currentMembers.some((m) => m.user_id === targetUser.id);
      if (alreadyMember) {
        showToast('Este usuario ya es integrante del equipo.', 'info');
        return;
      }

      const userTier = (currentUser?.subscription_tier || 'free').toLowerCase();
      if (userTier === 'pro' && this.currentMembers.length >= 3) {
        showToast(t('teams.toast_pro_members_limit') || 'El plan Pro permite un máximo de 3 miembros por equipo. Mejora a Negocios para miembros ilimitados.', 'warning');
        openUpgradeModal('business');
        return;
      }

      const addRes = await postApi(API_ROUTES.teams.members(this.currentTeam.uuid), {
        userId: targetUser.id,
        role: 'member',
      });

      if (!addRes.ok) {
        showToast('No se pudo agregar al integrante', 'danger');
        return;
      }

      showToast(t('teams.toast_member_added') || `${targetUser.username} agregado al equipo`, 'success');
      this.inputAddMember.value = '';
      await this.loadCurrentTeamDetails(this.currentTeam.uuid);
      await this.loadTeams();
    } catch {
      showToast('Error al agregar integrante', 'danger');
    }
  }

  private async handleRemoveMember(targetUserId: number, username: string): Promise<void> {
    if (!this.currentTeam) return;

    try {
      const res = await deleteApi(API_ROUTES.teams.removeMember(this.currentTeam.uuid, targetUserId));
      if (!res.ok) {
        showToast('No se pudo remover al integrante', 'danger');
        return;
      }

      showToast(t('teams.toast_member_removed') || `${username} removido del equipo`, 'info');
      await this.loadCurrentTeamDetails(this.currentTeam.uuid);
      await this.loadTeams();
    } catch {
      showToast('Error al remover integrante', 'danger');
    }
  }
}

export async function createTeamsView(): Promise<HTMLElement> {
  const container = await loadTemplate('/views/teams/teams.html');
  translateElement(container);

  const sidebar = await createSidebar();
  container.prepend(sidebar);

  const controller = new TeamsController(container);
  await controller.init();

  return container;
}
