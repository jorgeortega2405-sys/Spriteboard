import { navigate } from '../app-router.js';
import { openCreateCanvasModal } from '../components/create-canvas-modal.component.js';
import { openEnterpriseSsoModal } from '../components/enterprise-sso-modal.component.js';
import { createSidebar } from '../components/layout.component.js';
import { openModal } from '../components/modal.component.js';
import { openUpgradeModal } from '../components/upgrade-modal.component.js';
import { API_ROUTES } from '../config/api-routes.js';
import { currentUser, deleteApi, escapeHtml, getApi, postApi, putApi } from '../services/api.service.js';
import { t, translateElement } from '../services/i18n.service.js';
import { loadTemplate } from '../services/template.service.js';
import { showToast } from '../services/toast.service.js';
import { SearchUserResult } from '../types/canvas.types.js';
import { Classroom, SchoolOrganization, SchoolStudent, SchoolTeacher } from '../types/education.types.js';
import { TeamMember } from '../types/team.types.js';
import { removeEmptyState, renderEmptyState, setupDropdown } from '../utils/dom.util.js';

function formatDate(iso?: string): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

class EducationController {
  private abortController = new AbortController();
  private container: HTMLElement;
  private classrooms: Classroom[] = [];
  private selectedClassroom: Classroom | null = null;
  private currentMembers: TeamMember[] = [];
  private searchQuery = '';
  private activeTab: 'classrooms' | 'teachers' | 'students' | 'school' = 'classrooms';
  private school: SchoolOrganization | null = null;
  private students: SchoolStudent[] = [];
  private membersDropdownController: ReturnType<typeof setupDropdown> | null = null;
  private tabFilterDropdownWrapper: HTMLElement | null = null;
  private tabFilterDropdownController: ReturnType<typeof setupDropdown> | null = null;

  private educationTitle: HTMLElement | null = null;
  private tabBtnClassrooms: HTMLElement | null = null;
  private tabBtnTeachers: HTMLElement | null = null;
  private tabBtnStudents: HTMLElement | null = null;
  private tabBtnSchool: HTMLElement | null = null;
  private tabPaneClassrooms: HTMLElement | null = null;
  private tabPaneTeachers: HTMLElement | null = null;
  private tabPaneStudents: HTMLElement | null = null;
  private tabPaneSchool: HTMLElement | null = null;

  private defaultActions: HTMLElement | null = null;
  private selectedActions: HTMLElement | null = null;
  private teachersTopActions: HTMLElement | null = null;
  private studentsTopActions: HTMLElement | null = null;
  private schoolTopActions: HTMLElement | null = null;

  private tableWrapper: HTMLElement | null = null;
  private tableBody: HTMLElement | null = null;
  private lockedState: HTMLElement | null = null;
  private searchToolbar: HTMLElement | null = null;
  private searchInput: HTMLInputElement | null = null;
  private btnClearSearch: HTMLElement | null = null;
  private btnToggleSearch: HTMLElement | null = null;
  private btnJoinClassroom: HTMLElement | null = null;
  private btnCreateClassroom: HTMLElement | null = null;

  private btnActionCreateCanvas: HTMLElement | null = null;
  private btnActionCopyCode: HTMLElement | null = null;
  private btnActionRegenCode: HTMLElement | null = null;
  private btnActionMembers: HTMLElement | null = null;
  private btnActionDelete: HTMLElement | null = null;

  private teachersTableWrapper: HTMLElement | null = null;
  private teachersTableBody: HTMLElement | null = null;
  private btnAddTeacher: HTMLElement | null = null;

  private studentsTableWrapper: HTMLElement | null = null;
  private studentsTableBody: HTMLElement | null = null;

  private statSchoolName: HTMLElement | null = null;
  private statSchoolDomain: HTMLElement | null = null;
  private statSchoolTeachers: HTMLElement | null = null;
  private statSchoolClassrooms: HTMLElement | null = null;
  private statSchoolStudents: HTMLElement | null = null;
  private cardStatStudents: HTMLElement | null = null;
  private btnViewStudents: HTMLElement | null = null;
  private btnEditSchool: HTMLElement | null = null;
  private btnOpenSchoolEdit: HTMLElement | null = null;
  private btnOpenEducationSso: HTMLElement | null = null;

  private modalJoinBackdrop: HTMLElement | null = null;
  private formJoin: HTMLFormElement | null = null;
  private inputJoinCode: HTMLInputElement | null = null;
  private bannerJoinError: HTMLElement | null = null;

  private modalClassroomBackdrop: HTMLElement | null = null;
  private formClassroom: HTMLFormElement | null = null;
  private inputClassroomName: HTMLInputElement | null = null;
  private inputClassroomDesc: HTMLInputElement | null = null;
  private bannerClassroomError: HTMLElement | null = null;

  private modalMembersBackdrop: HTMLElement | null = null;
  private displayClassroomCode: HTMLElement | null = null;
  private btnCopyModalCode: HTMLElement | null = null;
  private inputAddMember: HTMLInputElement | null = null;
  private btnAddMember: HTMLElement | null = null;
  private membersDropdownWrapper: HTMLElement | null = null;
  private membersDropdownList: HTMLElement | null = null;
  private membersTriggerText: HTMLElement | null = null;

  private modalTeacherBackdrop: HTMLElement | null = null;
  private formTeacher: HTMLFormElement | null = null;
  private inputTeacherQuery: HTMLInputElement | null = null;
  private bannerTeacherError: HTMLElement | null = null;

  private modalSchoolBackdrop: HTMLElement | null = null;
  private formSchool: HTMLFormElement | null = null;
  private inputSchoolName: HTMLInputElement | null = null;
  private inputSchoolDomain: HTMLInputElement | null = null;
  private bannerSchoolError: HTMLElement | null = null;

  private cardStatCampuses: HTMLElement | null = null;
  private cardStatFaculties: HTMLElement | null = null;
  private statSchoolCampuses: HTMLElement | null = null;
  private statSchoolFaculties: HTMLElement | null = null;
  private btnOpenUniversityCampuses: HTMLElement | null = null;
  private modalCampusesBackdrop: HTMLElement | null = null;
  private campusesListContainer: HTMLElement | null = null;
  private btnAddCampus: HTMLElement | null = null;
  private formAddCampus: HTMLFormElement | null = null;
  private inputNewCampusName: HTMLInputElement | null = null;
  private inputNewCampusCity: HTMLInputElement | null = null;
  private bannerCampusError: HTMLElement | null = null;
  private btnTabCampuses: HTMLElement | null = null;
  private btnTabFaculties: HTMLElement | null = null;
  private sectionTabCampuses: HTMLElement | null = null;
  private sectionTabFaculties: HTMLElement | null = null;
  private btnAddFaculty: HTMLElement | null = null;
  private formAddFaculty: HTMLFormElement | null = null;
  private selectNewFacultyCampus: HTMLSelectElement | null = null;
  private inputNewFacultyName: HTMLInputElement | null = null;
  private inputNewFacultyCode: HTMLInputElement | null = null;
  private facultiesListContainer: HTMLElement | null = null;
  private bannerFacultyError: HTMLElement | null = null;
  private cachedCampuses: any[] = [];

  constructor(container: HTMLElement, activeTab: 'classrooms' | 'teachers' | 'students' | 'school' = 'classrooms') {
    this.container = container;
    this.activeTab = activeTab;
  }

  public async init(): Promise<void> {
    this.queryDOMElements();
    this.setupDropdowns();
    this.bindEvents();
    if (this.activeTab === 'classrooms') {
      await Promise.all([
        this.loadClassrooms(),
        this.loadSchool(),
      ]);
    } else if (this.activeTab === 'students') {
      await Promise.all([
        this.loadSchool(),
        this.loadStudents(),
      ]);
      if (!this.school) {
        navigate('/education');
        return;
      }
    } else {
      await this.loadSchool();
      if (!this.school || (this.activeTab === 'school' && !this.school.is_admin)) {
        navigate('/education');
        return;
      }
    }
  }

  public destroy(): void {
    this.abortController.abort();
    this.membersDropdownController?.destroy();
    this.tabFilterDropdownController?.destroy();
    document.body.classList.remove('modal-open');
  }

  private queryDOMElements(): void {
    this.educationTitle = this.container.querySelector<HTMLElement>('[data-ref="education-title"]');
    this.tabFilterDropdownWrapper = this.container.querySelector<HTMLElement>('[data-ref="education-tab-filter-wrapper"]');
    this.tabBtnClassrooms = this.container.querySelector<HTMLElement>('[data-ref="tab-btn-classrooms"]');
    this.tabBtnTeachers = this.container.querySelector<HTMLElement>('[data-ref="tab-btn-teachers"]');
    this.tabBtnStudents = this.container.querySelector<HTMLElement>('[data-ref="tab-btn-students"]');
    this.tabBtnSchool = this.container.querySelector<HTMLElement>('[data-ref="tab-btn-school"]');
    this.tabPaneClassrooms = this.container.querySelector<HTMLElement>('[data-ref="tab-pane-classrooms"]');
    this.tabPaneTeachers = this.container.querySelector<HTMLElement>('[data-ref="tab-pane-teachers"]');
    this.tabPaneStudents = this.container.querySelector<HTMLElement>('[data-ref="tab-pane-students"]');
    this.tabPaneSchool = this.container.querySelector<HTMLElement>('[data-ref="tab-pane-school"]');

    this.defaultActions = this.container.querySelector<HTMLElement>('[data-ref="education-default-actions"]');
    this.selectedActions = this.container.querySelector<HTMLElement>('[data-ref="education-selected-actions"]');
    this.teachersTopActions = this.container.querySelector<HTMLElement>('[data-ref="teachers-top-actions"]');
    this.studentsTopActions = this.container.querySelector<HTMLElement>('[data-ref="students-top-actions"]');
    this.schoolTopActions = this.container.querySelector<HTMLElement>('[data-ref="school-top-actions"]');

    this.tableWrapper = this.container.querySelector<HTMLElement>('[data-ref="education-table-wrapper"]');
    this.tableBody = this.container.querySelector<HTMLElement>('[data-ref="education-tbody"]');
    this.lockedState = this.container.querySelector<HTMLElement>('[data-ref="education-locked-state"]');
    this.searchToolbar = this.container.querySelector<HTMLElement>('[data-ref="search-toolbar"]');
    this.searchInput = this.container.querySelector<HTMLInputElement>('[data-ref="education-search-input"]');
    this.btnClearSearch = this.container.querySelector<HTMLElement>('[data-ref="btn-clear-search"]');
    this.btnToggleSearch = this.container.querySelector<HTMLElement>('[data-ref="btn-toggle-search"]');
    this.btnJoinClassroom = this.container.querySelector<HTMLElement>('[data-ref="btn-join-classroom"]');
    this.btnCreateClassroom = this.container.querySelector<HTMLElement>('[data-ref="btn-create-classroom"]');

    this.btnActionCreateCanvas = this.container.querySelector<HTMLElement>('[data-ref="btn-action-create-canvas"]');
    this.btnActionCopyCode = this.container.querySelector<HTMLElement>('[data-ref="btn-action-copy-code"]');
    this.btnActionRegenCode = this.container.querySelector<HTMLElement>('[data-ref="btn-action-regen-code"]');
    this.btnActionMembers = this.container.querySelector<HTMLElement>('[data-ref="btn-action-members"]');
    this.btnActionDelete = this.container.querySelector<HTMLElement>('[data-ref="btn-action-delete"]');

    this.teachersTableWrapper = this.container.querySelector<HTMLElement>('[data-ref="teachers-table-wrapper"]');
    this.teachersTableBody = this.container.querySelector<HTMLElement>('[data-ref="teachers-tbody"]');
    this.btnAddTeacher = this.container.querySelector<HTMLElement>('[data-ref="btn-add-teacher"]');

    this.studentsTableWrapper = this.container.querySelector<HTMLElement>('[data-ref="students-table-wrapper"]');
    this.studentsTableBody = this.container.querySelector<HTMLElement>('[data-ref="students-tbody"]');

    this.statSchoolName = this.container.querySelector<HTMLElement>('[data-ref="stat-school-name"]');
    this.statSchoolDomain = this.container.querySelector<HTMLElement>('[data-ref="stat-school-domain"]');
    this.statSchoolTeachers = this.container.querySelector<HTMLElement>('[data-ref="stat-school-teachers"]');
    this.statSchoolClassrooms = this.container.querySelector<HTMLElement>('[data-ref="stat-school-classrooms"]');
    this.statSchoolStudents = this.container.querySelector<HTMLElement>('[data-ref="stat-school-students"]');
    this.cardStatStudents = this.container.querySelector<HTMLElement>('[data-ref="card-stat-students"]');
    this.btnViewStudents = this.container.querySelector<HTMLElement>('[data-ref="btn-view-students"]');
    this.btnEditSchool = this.container.querySelector<HTMLElement>('[data-ref="btn-edit-school"]');
    this.btnOpenSchoolEdit = this.container.querySelector<HTMLElement>('[data-ref="btn-open-school-edit"]');
    this.btnOpenEducationSso = this.container.querySelector<HTMLElement>('[data-ref="btn-open-education-sso"]');

    this.modalJoinBackdrop = this.container.querySelector<HTMLElement>('[data-ref="modal-join-backdrop"]');
    this.formJoin = this.container.querySelector<HTMLFormElement>('[data-ref="form-join"]');
    this.inputJoinCode = this.container.querySelector<HTMLInputElement>('[data-ref="input-join-code"]');
    this.bannerJoinError = this.container.querySelector<HTMLElement>('[data-ref="banner-join-error"]');

    this.modalClassroomBackdrop = this.container.querySelector<HTMLElement>('[data-ref="modal-classroom-backdrop"]');
    this.formClassroom = this.container.querySelector<HTMLFormElement>('[data-ref="form-classroom"]');
    this.inputClassroomName = this.container.querySelector<HTMLInputElement>('[data-ref="input-classroom-name"]');
    this.inputClassroomDesc = this.container.querySelector<HTMLInputElement>('[data-ref="input-classroom-desc"]');
    this.bannerClassroomError = this.container.querySelector<HTMLElement>('[data-ref="banner-classroom-error"]');

    this.modalMembersBackdrop = this.container.querySelector<HTMLElement>('[data-ref="modal-members-backdrop"]');
    this.displayClassroomCode = this.container.querySelector<HTMLElement>('[data-ref="display-classroom-code"]');
    this.btnCopyModalCode = this.container.querySelector<HTMLElement>('[data-ref="btn-copy-modal-code"]');
    this.inputAddMember = this.container.querySelector<HTMLInputElement>('[data-ref="input-add-member"]');
    this.btnAddMember = this.container.querySelector<HTMLElement>('[data-ref="btn-add-member"]');
    this.membersDropdownWrapper = this.container.querySelector<HTMLElement>('[data-ref="members-dropdown-wrapper"]');
    this.membersDropdownList = this.container.querySelector<HTMLElement>('[data-ref="members-dropdown-list"]');
    this.membersTriggerText = this.container.querySelector<HTMLElement>('[data-ref="members-trigger-text"]');

    this.modalTeacherBackdrop = this.container.querySelector<HTMLElement>('[data-ref="modal-teacher-backdrop"]');
    this.formTeacher = this.container.querySelector<HTMLFormElement>('[data-ref="form-teacher"]');
    this.inputTeacherQuery = this.container.querySelector<HTMLInputElement>('[data-ref="input-teacher-query"]');
    this.bannerTeacherError = this.container.querySelector<HTMLElement>('[data-ref="banner-teacher-error"]');

    this.modalSchoolBackdrop = this.container.querySelector<HTMLElement>('[data-ref="modal-school-backdrop"]');
    this.formSchool = this.container.querySelector<HTMLFormElement>('[data-ref="form-school"]');
    this.inputSchoolName = this.container.querySelector<HTMLInputElement>('[data-ref="input-school-name"]');
    this.inputSchoolDomain = this.container.querySelector<HTMLInputElement>('[data-ref="input-school-domain"]');
    this.bannerSchoolError = this.container.querySelector<HTMLElement>('[data-ref="banner-school-error"]');

    this.cardStatCampuses = this.container.querySelector<HTMLElement>('[data-ref="card-stat-campuses"]');
    this.cardStatFaculties = this.container.querySelector<HTMLElement>('[data-ref="card-stat-faculties"]');
    this.statSchoolCampuses = this.container.querySelector<HTMLElement>('[data-ref="stat-school-campuses"]');
    this.statSchoolFaculties = this.container.querySelector<HTMLElement>('[data-ref="stat-school-faculties"]');
    this.btnOpenUniversityCampuses = this.container.querySelector<HTMLElement>('[data-ref="btn-open-university-campuses"]');
    this.modalCampusesBackdrop = this.container.querySelector<HTMLElement>('[data-ref="modal-campuses-backdrop"]');
    this.campusesListContainer = this.container.querySelector<HTMLElement>('[data-ref="campuses-list-container"]');
    this.btnAddCampus = this.container.querySelector<HTMLElement>('[data-ref="btn-add-campus"]');
    this.formAddCampus = this.container.querySelector<HTMLFormElement>('[data-ref="form-add-campus"]');
    this.inputNewCampusName = this.container.querySelector<HTMLInputElement>('[data-ref="input-new-campus-name"]');
    this.inputNewCampusCity = this.container.querySelector<HTMLInputElement>('[data-ref="input-new-campus-city"]');
    this.bannerCampusError = this.container.querySelector<HTMLElement>('[data-ref="banner-campus-error"]');

    this.btnTabCampuses = this.container.querySelector<HTMLElement>('[data-ref="btn-tab-campuses"]');
    this.btnTabFaculties = this.container.querySelector<HTMLElement>('[data-ref="btn-tab-faculties"]');
    this.sectionTabCampuses = this.container.querySelector<HTMLElement>('[data-ref="section-tab-campuses"]');
    this.sectionTabFaculties = this.container.querySelector<HTMLElement>('[data-ref="section-tab-faculties"]');
    this.btnAddFaculty = this.container.querySelector<HTMLElement>('[data-ref="btn-add-faculty"]');
    this.formAddFaculty = this.container.querySelector<HTMLFormElement>('[data-ref="form-add-faculty"]');
    this.selectNewFacultyCampus = this.container.querySelector<HTMLSelectElement>('[data-ref="select-new-faculty-campus"]');
    this.inputNewFacultyName = this.container.querySelector<HTMLInputElement>('[data-ref="input-new-faculty-name"]');
    this.inputNewFacultyCode = this.container.querySelector<HTMLInputElement>('[data-ref="input-new-faculty-code"]');
    this.facultiesListContainer = this.container.querySelector<HTMLElement>('[data-ref="faculties-list-container"]');
    this.bannerFacultyError = this.container.querySelector<HTMLElement>('[data-ref="banner-faculty-error"]');
  }

  private setupDropdowns(): void {
    if (this.membersDropdownWrapper) {
      this.membersDropdownController = setupDropdown(this.membersDropdownWrapper);
    }
    if (this.tabFilterDropdownWrapper) {
      this.tabFilterDropdownController = setupDropdown(this.tabFilterDropdownWrapper, {
        matchWidth: false,
        placement: 'bottom-end',
      });
    }
  }

  private bindEvents(): void {
    const signal = this.abortController.signal;

    this.tabBtnClassrooms?.addEventListener('click', (e) => {
      e.preventDefault();
      this.tabFilterDropdownController?.close();
      navigate('/education');
    }, { signal });
    this.tabBtnTeachers?.addEventListener('click', (e) => {
      e.preventDefault();
      this.tabFilterDropdownController?.close();
      navigate('/education/teachers');
    }, { signal });
    this.tabBtnStudents?.addEventListener('click', (e) => {
      e.preventDefault();
      this.tabFilterDropdownController?.close();
      navigate('/education/students');
    }, { signal });
    this.tabBtnSchool?.addEventListener('click', (e) => {
      e.preventDefault();
      this.tabFilterDropdownController?.close();
      navigate('/education/institution');
    }, { signal });

    this.cardStatStudents?.addEventListener('click', () => {
      navigate('/education/students');
    }, { signal });
    this.btnViewStudents?.addEventListener('click', () => {
      navigate('/education/students');
    }, { signal });

    this.btnToggleSearch?.addEventListener('click', () => this.toggleSearchToolbar(), { signal });
    this.btnClearSearch?.addEventListener('click', () => {
      if (this.searchInput) this.searchInput.value = '';
      this.searchQuery = '';
      this.btnClearSearch?.style.setProperty('display', 'none');
      if (this.activeTab === 'teachers') {
        this.renderTeachersTable();
      } else if (this.activeTab === 'students') {
        this.renderStudentsTable();
      } else {
        this.renderClassrooms();
      }
    }, { signal });

    this.searchInput?.addEventListener('input', () => {
      this.searchQuery = (this.searchInput?.value || '').trim().toLowerCase();
      if (this.btnClearSearch) {
        this.btnClearSearch.style.display = this.searchQuery ? 'inline-flex' : 'none';
      }
      if (this.activeTab === 'teachers') {
        this.renderTeachersTable();
      } else if (this.activeTab === 'students') {
        this.renderStudentsTable();
      } else {
        this.renderClassrooms();
      }
    }, { signal });

    this.btnJoinClassroom?.addEventListener('click', () => this.openJoinModal(), { signal });
    this.btnCreateClassroom?.addEventListener('click', () => this.openCreateModal(), { signal });

    this.btnActionCreateCanvas?.addEventListener('click', () => {
      if (this.selectedClassroom) {
        openCreateCanvasModal({
          teamName: this.selectedClassroom.name,
          teamUuid: this.selectedClassroom.uuid,
        });
      }
    }, { signal });

    this.btnActionCopyCode?.addEventListener('click', () => {
      if (this.selectedClassroom?.join_code) {
        this.copyCodeToClipboard(this.selectedClassroom.join_code);
      }
    }, { signal });

    this.btnActionRegenCode?.addEventListener('click', () => {
      if (this.selectedClassroom) {
        this.confirmRegenerateCode(this.selectedClassroom);
      }
    }, { signal });

    this.btnActionMembers?.addEventListener('click', () => {
      if (this.selectedClassroom) {
        this.openMembersModal(this.selectedClassroom);
      }
    }, { signal });

    this.btnActionDelete?.addEventListener('click', () => {
      if (this.selectedClassroom) {
        this.confirmDeleteClassroom(this.selectedClassroom);
      }
    }, { signal });

    const btnActionDeselect = this.container.querySelector<HTMLElement>('[data-ref="btn-action-deselect"]');
    btnActionDeselect?.addEventListener('click', () => {
      this.selectedClassroom = null;
      this.tableBody?.querySelectorAll('.component-table__row').forEach((r) => r.classList.remove('is-selected'));
      this.updateActionButtons();
    }, { signal });

    this.tableWrapper?.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.component-table__row') && this.selectedClassroom) {
        this.selectedClassroom = null;
        this.tableBody?.querySelectorAll('.component-table__row').forEach((r) => r.classList.remove('is-selected'));
        this.updateActionButtons();
      }
    }, { signal });

    document.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Escape' && this.selectedClassroom) {
        this.selectedClassroom = null;
        this.tableBody?.querySelectorAll('.component-table__row').forEach((r) => r.classList.remove('is-selected'));
        this.updateActionButtons();
      }
    }, { signal });

    const btnCloseJoin = this.container.querySelector<HTMLElement>('[data-ref="btn-close-join-modal"]');
    const btnCancelJoin = this.container.querySelector<HTMLElement>('[data-ref="btn-cancel-join"]');
    btnCloseJoin?.addEventListener('click', () => this.closeJoinModal(), { signal });
    btnCancelJoin?.addEventListener('click', () => this.closeJoinModal(), { signal });

    this.formJoin?.addEventListener('submit', (e) => {
      e.preventDefault();
      void this.handleJoinSubmit();
    }, { signal });

    const btnCloseClassroom = this.container.querySelector<HTMLElement>('[data-ref="btn-close-classroom-modal"]');
    const btnCancelClassroom = this.container.querySelector<HTMLElement>('[data-ref="btn-cancel-classroom"]');
    btnCloseClassroom?.addEventListener('click', () => this.closeCreateModal(), { signal });
    btnCancelClassroom?.addEventListener('click', () => this.closeCreateModal(), { signal });

    this.formClassroom?.addEventListener('submit', (e) => {
      e.preventDefault();
      void this.handleCreateSubmit();
    }, { signal });

    const btnCloseMembers = this.container.querySelector<HTMLElement>('[data-ref="btn-close-members-modal"]');
    const btnDoneMembers = this.container.querySelector<HTMLElement>('[data-ref="btn-done-members"]');
    btnCloseMembers?.addEventListener('click', () => this.closeMembersModal(), { signal });
    btnDoneMembers?.addEventListener('click', () => this.closeMembersModal(), { signal });

    this.btnCopyModalCode?.addEventListener('click', () => {
      if (this.selectedClassroom?.join_code) {
        this.copyCodeToClipboard(this.selectedClassroom.join_code);
      }
    }, { signal });

    this.btnAddMember?.addEventListener('click', () => {
      void this.handleAddMember();
    }, { signal });

    this.btnAddTeacher?.addEventListener('click', () => this.openTeacherModal(), { signal });
    const btnCloseTeacher = this.container.querySelector<HTMLElement>('[data-ref="btn-close-teacher-modal"]');
    const btnCancelTeacher = this.container.querySelector<HTMLElement>('[data-ref="btn-cancel-teacher"]');
    btnCloseTeacher?.addEventListener('click', () => this.closeTeacherModal(), { signal });
    btnCancelTeacher?.addEventListener('click', () => this.closeTeacherModal(), { signal });

    this.formTeacher?.addEventListener('submit', (e) => {
      e.preventDefault();
      void this.handleTeacherSubmit();
    }, { signal });

    this.btnEditSchool?.addEventListener('click', () => this.openSchoolModal(), { signal });
    this.btnOpenSchoolEdit?.addEventListener('click', () => this.openSchoolModal(), { signal });
    this.btnOpenUniversityCampuses?.addEventListener('click', () => this.openCampusesModal(), { signal });
    this.btnOpenEducationSso?.addEventListener('click', () => {
      const userTier = (currentUser as any)?.subscription_tier;
      const isUniv = userTier === 'universidades' || userTier === 'universities';
      void openEnterpriseSsoModal({ tenantType: isUniv ? 'university' : 'school' });
    }, { signal });
    const btnCloseSchool = this.container.querySelector<HTMLElement>('[data-ref="btn-close-school-modal"]');
    const btnCancelSchool = this.container.querySelector<HTMLElement>('[data-ref="btn-cancel-school"]');
    btnCloseSchool?.addEventListener('click', () => this.closeSchoolModal(), { signal });
    btnCancelSchool?.addEventListener('click', () => this.closeSchoolModal(), { signal });

    this.formSchool?.addEventListener('submit', (e) => {
      e.preventDefault();
      void this.handleSchoolSubmit();
    }, { signal });

    const btnCloseCampuses = this.container.querySelector<HTMLElement>('[data-ref="btn-close-campuses-modal"]');
    btnCloseCampuses?.addEventListener('click', () => this.closeCampusesModal(), { signal });

    this.btnTabCampuses?.addEventListener('click', () => this.switchCampusModalTab('campuses'), { signal });
    this.btnTabFaculties?.addEventListener('click', () => this.switchCampusModalTab('faculties'), { signal });

    this.btnAddCampus?.addEventListener('click', () => {
      this.formAddCampus?.classList.toggle('is-hidden');
      this.inputNewCampusName?.focus();
    }, { signal });

    const btnCancelAddCampus = this.container.querySelector<HTMLElement>('[data-ref="btn-cancel-add-campus"]');
    btnCancelAddCampus?.addEventListener('click', () => {
      this.formAddCampus?.classList.add('is-hidden');
    }, { signal });

    this.formAddCampus?.addEventListener('submit', (e) => {
      e.preventDefault();
      void this.handleAddCampusSubmit();
    }, { signal });

    this.btnAddFaculty?.addEventListener('click', () => {
      this.formAddFaculty?.classList.toggle('is-hidden');
      this.inputNewFacultyName?.focus();
    }, { signal });

    const btnCancelAddFaculty = this.container.querySelector<HTMLElement>('[data-ref="btn-cancel-add-faculty"]');
    btnCancelAddFaculty?.addEventListener('click', () => {
      this.formAddFaculty?.classList.add('is-hidden');
    }, { signal });

    this.formAddFaculty?.addEventListener('submit', (e) => {
      e.preventDefault();
      void this.handleAddFacultySubmit();
    }, { signal });

    const btnLockedUpgrade = this.container.querySelector<HTMLElement>('[data-ref="btn-locked-upgrade"]');
    const btnLockedHome = this.container.querySelector<HTMLElement>('[data-ref="btn-locked-home"]');
    btnLockedUpgrade?.addEventListener('click', () => {
      openUpgradeModal('schools');
    }, { signal });
    btnLockedHome?.addEventListener('click', () => {
      navigate('/');
    }, { signal });
  }

  private toggleSearchToolbar(): void {
    if (!this.searchToolbar) return;
    const isHidden = this.searchToolbar.classList.contains('is-hidden');
    if (isHidden) {
      this.searchToolbar.classList.remove('is-hidden');
      this.searchInput?.focus();
    } else {
      this.searchToolbar.classList.add('is-hidden');
      if (this.searchInput) this.searchInput.value = '';
      this.searchQuery = '';
      if (this.btnClearSearch) this.btnClearSearch.style.display = 'none';
      if (this.activeTab === 'teachers') {
        this.renderTeachersTable();
      } else if (this.activeTab === 'students') {
        this.renderStudentsTable();
      } else {
        this.renderClassrooms();
      }
    }
  }

  private async loadClassrooms(): Promise<void> {
    try {
      const res = await getApi(API_ROUTES.education.classrooms);
      if (!res.ok) {
        showToast(t('teams.load_error') || 'Error al cargar las aulas escolares', 'danger');
        return;
      }

      const data = await res.json();
      this.classrooms = Array.isArray(data.classrooms) ? data.classrooms : [];
      this.renderClassrooms();
    } catch {
      showToast(t('teams.load_error') || 'Error al conectar con el servidor', 'danger');
    }
  }

  private async loadSchool(): Promise<void> {
    try {
      const res = await getApi(API_ROUTES.education.school);
      if (!res.ok) {
        this.school = null;
        this.renderSchoolUi();
        return;
      }

      const data = await res.json();
      this.school = data.school || null;
      this.renderSchoolUi();
    } catch {
      this.school = null;
      this.renderSchoolUi();
    }
  }

  private renderSchoolUi(): void {
    if (!this.school) {
      if (this.educationTitle && this.activeTab === 'classrooms') {
        this.educationTitle.textContent = t('education.my_classrooms_title') || 'Aulas escolares';
      }
      if (this.tabFilterDropdownWrapper) {
        this.tabFilterDropdownWrapper.style.display = 'none';
      }
      if (this.tabBtnTeachers) {
        this.tabBtnTeachers.style.display = 'none';
      }
      if (this.tabBtnStudents) {
        this.tabBtnStudents.style.display = 'none';
      }
      if (this.tabBtnSchool) {
        this.tabBtnSchool.style.display = 'none';
      }
      if (this.teachersTopActions) {
        this.teachersTopActions.style.display = 'none';
      }
      if (this.studentsTopActions) {
        this.studentsTopActions.style.display = 'none';
      }
      if (this.schoolTopActions) {
        this.schoolTopActions.style.display = 'none';
      }
      return;
    }

    if (this.tabFilterDropdownWrapper) {
      this.tabFilterDropdownWrapper.style.display = '';
    }

    if (this.school.name && this.educationTitle && this.activeTab === 'classrooms') {
      this.educationTitle.textContent = this.school.name;
    }

    if (this.tabBtnTeachers) {
      this.tabBtnTeachers.style.display = 'flex';
    }
    if (this.tabBtnStudents) {
      this.tabBtnStudents.style.display = 'flex';
    }
    if (this.tabBtnSchool) {
      this.tabBtnSchool.style.display = this.school.is_admin ? 'flex' : 'none';
    }

    if (this.teachersTopActions) {
      this.teachersTopActions.style.display = this.school.is_admin ? 'inline-flex' : 'none';
    }
    if (this.schoolTopActions) {
      this.schoolTopActions.style.display = this.school.is_admin ? 'inline-flex' : 'none';
    }

    if (this.statSchoolName) this.statSchoolName.textContent = this.school.name || 'Centro Educativo';
    if (this.statSchoolDomain) this.statSchoolDomain.textContent = this.school.domain || 'Dominio libre';
    if (this.statSchoolTeachers) {
      this.statSchoolTeachers.textContent = `${this.school.teachers_count || 0} / ${this.school.max_teachers || 50}`;
    }
    if (this.statSchoolClassrooms) {
      this.statSchoolClassrooms.textContent = String(this.school.classrooms_count || this.classrooms.length);
    }
    if (this.statSchoolStudents) {
      this.statSchoolStudents.textContent = String(this.school.students_count || 0);
    }

    void this.loadUniversityStats();
    this.renderTeachersTable();
    this.renderStudentsTable();
  }

  private async loadUniversityStats(): Promise<void> {
    try {
      const res = await getApi(API_ROUTES.education.university);
      if (!res.ok) return;
      const data = await res.json();
      if (!data.ok) return;

      if (this.cardStatCampuses) this.cardStatCampuses.classList.remove('is-hidden');
      if (this.cardStatFaculties) this.cardStatFaculties.classList.remove('is-hidden');
      if (this.statSchoolCampuses) this.statSchoolCampuses.textContent = String(data.total_campuses || 0);
      if (this.statSchoolFaculties) this.statSchoolFaculties.textContent = String(data.total_faculties || 0);
      if (this.btnOpenUniversityCampuses) this.btnOpenUniversityCampuses.classList.remove('is-hidden');
    } catch {}
  }

  private openCampusesModal(): void {
    if (!this.modalCampusesBackdrop) return;
    this.modalCampusesBackdrop.classList.add('is-visible');
    document.body.classList.add('modal-open');
    this.switchCampusModalTab('campuses');
  }

  private closeCampusesModal(): void {
    if (!this.modalCampusesBackdrop) return;
    this.modalCampusesBackdrop.classList.remove('is-visible');
    document.body.classList.remove('modal-open');
    this.formAddCampus?.classList.add('is-hidden');
    this.formAddFaculty?.classList.add('is-hidden');
    if (this.bannerCampusError) this.bannerCampusError.classList.add('is-hidden');
    if (this.bannerFacultyError) this.bannerFacultyError.classList.add('is-hidden');
  }

  private switchCampusModalTab(tab: 'campuses' | 'faculties'): void {
    if (tab === 'campuses') {
      this.btnTabCampuses?.classList.add('component-button--black');
      this.btnTabCampuses?.classList.remove('component-button--outline');
      this.btnTabFaculties?.classList.remove('component-button--black');
      this.btnTabFaculties?.classList.add('component-button--outline');
      this.sectionTabCampuses?.classList.remove('is-hidden');
      this.sectionTabFaculties?.classList.add('is-hidden');
      void this.loadCampusesList();
    } else {
      this.btnTabFaculties?.classList.add('component-button--black');
      this.btnTabFaculties?.classList.remove('component-button--outline');
      this.btnTabCampuses?.classList.remove('component-button--black');
      this.btnTabCampuses?.classList.add('component-button--outline');
      this.sectionTabFaculties?.classList.remove('is-hidden');
      this.sectionTabCampuses?.classList.add('is-hidden');
      void this.loadFacultiesList();
    }
  }

  private populateCampusSelect(campuses: any[]): void {
    if (!this.selectNewFacultyCampus) return;
    this.selectNewFacultyCampus.innerHTML = '';
    if (campuses.length === 0) {
      const opt = document.createElement('option');
      opt.value = '';
      opt.textContent = t('education.no_campuses_yet') || 'Primero debes registrar al menos una sede';
      this.selectNewFacultyCampus.appendChild(opt);
      return;
    }
    for (const c of campuses) {
      const opt = document.createElement('option');
      opt.value = String(c.id);
      opt.textContent = `${c.name}${c.city ? ` (${c.city})` : ''}`;
      this.selectNewFacultyCampus.appendChild(opt);
    }
  }

  private async loadCampusesList(): Promise<void> {
    if (!this.campusesListContainer) return;
    this.campusesListContainer.innerHTML = '<p style="padding: 12px; color: var(--text-secondary); font-size: 13px;">Cargando sedes...</p>';
    try {
      const res = await getApi(API_ROUTES.education.university);
      if (!res.ok) {
        this.campusesListContainer.innerHTML = '<p style="padding: 12px; color: var(--text-secondary); font-size: 13px;">No se pudieron cargar las sedes.</p>';
        return;
      }
      const data = await res.json();
      const campuses = data.campuses || [];
      this.cachedCampuses = campuses;
      this.populateCampusSelect(campuses);

      if (campuses.length === 0) {
        this.campusesListContainer.innerHTML = '<p style="padding: 12px; color: var(--text-secondary); font-size: 13px;">Aún no has registrado campus o sedes universitarias.</p>';
        return;
      }

      this.campusesListContainer.innerHTML = '';
      for (const c of campuses) {
        const item = document.createElement('div');
        item.className = 'card card--padded';
        item.style.cssText = 'border: 1px solid var(--border-color); border-radius: 8px; padding: 12px; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center;';

        const left = document.createElement('div');
        const title = document.createElement('strong');
        title.style.cssText = 'color: var(--text-primary); font-size: 14px;';
        title.textContent = c.name;

        const sub = document.createElement('div');
        sub.style.cssText = 'font-size: 12px; color: var(--text-secondary); margin-top: 2px;';
        sub.textContent = `${c.city ? c.city + ' • ' : ''}${c.faculties_count || 0} facultades • ${c.members_count || 0} integrantes`;

        left.appendChild(title);
        left.appendChild(sub);

        const right = document.createElement('div');
        right.style.cssText = 'display: flex; align-items: center; gap: 8px;';

        const badge = document.createElement('span');
        badge.className = 'component-badge component-badge--sm';
        badge.textContent = c.code || 'SEDE';
        right.appendChild(badge);

        const deleteBtn = document.createElement('button');
        deleteBtn.type = 'button';
        deleteBtn.className = 'component-button component-button--icon-only component-button--ghost component-button--h28';
        deleteBtn.setAttribute('data-tooltip', 'Eliminar sede');
        deleteBtn.setAttribute('aria-label', 'Eliminar sede');
        deleteBtn.innerHTML = '<svg class="component-icon" aria-hidden="true" style="width: 16px; height: 16px;"><use href="/icons.svg#delete"></use></svg>';
        deleteBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.confirmDeleteCampus(c.id, c.name);
        }, { signal: this.abortController.signal });
        right.appendChild(deleteBtn);

        item.appendChild(left);
        item.appendChild(right);
        this.campusesListContainer.appendChild(item);
      }
    } catch {
      this.campusesListContainer.innerHTML = '<p style="padding: 12px; color: var(--text-danger); font-size: 13px;">Error al consultar sedes.</p>';
    }
  }

  private async loadFacultiesList(): Promise<void> {
    if (!this.facultiesListContainer) return;
    this.facultiesListContainer.innerHTML = '<p style="padding: 12px; color: var(--text-secondary); font-size: 13px;">Cargando facultades...</p>';
    try {
      const res = await getApi(API_ROUTES.education.university);
      if (!res.ok) {
        this.facultiesListContainer.innerHTML = '<p style="padding: 12px; color: var(--text-secondary); font-size: 13px;">No se pudieron cargar las facultades.</p>';
        return;
      }
      const data = await res.json();
      const campuses = data.campuses || [];
      this.cachedCampuses = campuses;
      this.populateCampusSelect(campuses);

      const allFaculties: any[] = [];
      for (const camp of campuses) {
        if (Array.isArray(camp.faculties)) {
          for (const f of camp.faculties) {
            allFaculties.push({ ...f, campus_name: camp.name });
          }
        }
      }

      if (allFaculties.length === 0) {
        this.facultiesListContainer.innerHTML = '<p style="padding: 12px; color: var(--text-secondary); font-size: 13px;">Aún no has registrado facultades o escuelas universitarias.</p>';
        return;
      }

      this.facultiesListContainer.innerHTML = '';
      for (const f of allFaculties) {
        const item = document.createElement('div');
        item.className = 'card card--padded';
        item.style.cssText = 'border: 1px solid var(--border-color); border-radius: 8px; padding: 12px; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center;';

        const left = document.createElement('div');
        const title = document.createElement('strong');
        title.style.cssText = 'color: var(--text-primary); font-size: 14px;';
        title.textContent = f.name;

        const sub = document.createElement('div');
        sub.style.cssText = 'font-size: 12px; color: var(--text-secondary); margin-top: 2px;';
        sub.textContent = `Sede: ${f.campus_name}${f.code ? ` • Código: ${f.code}` : ''}`;

        left.appendChild(title);
        left.appendChild(sub);

        const right = document.createElement('div');
        right.style.cssText = 'display: flex; align-items: center; gap: 8px;';

        const deleteBtn = document.createElement('button');
        deleteBtn.type = 'button';
        deleteBtn.className = 'component-button component-button--icon-only component-button--ghost component-button--h28';
        deleteBtn.setAttribute('data-tooltip', 'Eliminar facultad');
        deleteBtn.setAttribute('aria-label', 'Eliminar facultad');
        deleteBtn.innerHTML = '<svg class="component-icon" aria-hidden="true" style="width: 16px; height: 16px;"><use href="/icons.svg#delete"></use></svg>';
        deleteBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.confirmDeleteFaculty(f.id, f.name);
        }, { signal: this.abortController.signal });
        right.appendChild(deleteBtn);

        item.appendChild(left);
        item.appendChild(right);
        this.facultiesListContainer.appendChild(item);
      }
    } catch {
      this.facultiesListContainer.innerHTML = '<p style="padding: 12px; color: var(--text-danger); font-size: 13px;">Error al consultar facultades.</p>';
    }
  }

  private async handleAddCampusSubmit(): Promise<void> {
    if (!this.inputNewCampusName) return;
    const name = this.inputNewCampusName.value.trim();
    const city = this.inputNewCampusCity?.value.trim() || undefined;
    if (!name) return;

    try {
      const res = await postApi(API_ROUTES.education.universityCampuses, { name, city });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        if (this.bannerCampusError) {
          this.bannerCampusError.textContent = errData.error || 'Error al crear campus.';
          this.bannerCampusError.classList.remove('is-hidden');
        }
        return;
      }
      this.inputNewCampusName.value = '';
      if (this.inputNewCampusCity) this.inputNewCampusCity.value = '';
      this.formAddCampus?.classList.add('is-hidden');
      if (this.bannerCampusError) this.bannerCampusError.classList.add('is-hidden');
      showToast('Sede universitaria creada exitosamente.', 'success');
      await this.loadCampusesList();
      await this.loadUniversityStats();
    } catch {
      if (this.bannerCampusError) {
        this.bannerCampusError.textContent = 'Error de conexión al crear sede.';
        this.bannerCampusError.classList.remove('is-hidden');
      }
    }
  }

  private async handleAddFacultySubmit(): Promise<void> {
    if (!this.inputNewFacultyName || !this.selectNewFacultyCampus) return;
    const name = this.inputNewFacultyName.value.trim();
    const campusId = parseInt(this.selectNewFacultyCampus.value, 10);
    const code = this.inputNewFacultyCode?.value.trim() || undefined;

    if (!name || isNaN(campusId)) {
      if (this.bannerFacultyError) {
        this.bannerFacultyError.textContent = 'Por favor selecciona una sede e ingresa el nombre de la facultad.';
        this.bannerFacultyError.classList.remove('is-hidden');
      }
      return;
    }

    try {
      const res = await postApi(API_ROUTES.education.universityFaculties, { campusId, name, code });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        if (this.bannerFacultyError) {
          this.bannerFacultyError.textContent = errData.error || 'Error al registrar facultad.';
          this.bannerFacultyError.classList.remove('is-hidden');
        }
        return;
      }
      this.inputNewFacultyName.value = '';
      if (this.inputNewFacultyCode) this.inputNewFacultyCode.value = '';
      this.formAddFaculty?.classList.add('is-hidden');
      if (this.bannerFacultyError) this.bannerFacultyError.classList.add('is-hidden');
      showToast('Facultad registrada exitosamente.', 'success');
      await this.loadFacultiesList();
      await this.loadUniversityStats();
    } catch {
      if (this.bannerFacultyError) {
        this.bannerFacultyError.textContent = 'Error de conexión al registrar facultad.';
        this.bannerFacultyError.classList.remove('is-hidden');
      }
    }
  }

  private confirmDeleteCampus(campusId: number, campusName: string): void {
    openModal({
      confirmClass: 'component-button--danger',
      confirmText: t('education.confirm_delete_campus_btn') || 'Eliminar sede',
      description: (t('education.confirm_delete_campus_desc') || '¿Estás seguro de que deseas eliminar esta sede?').replace('{name}', campusName),
      onConfirm: async () => {
        try {
          const res = await deleteApi(API_ROUTES.education.universityCampusById(campusId));
          if (!res.ok) {
            showToast('No se pudo eliminar la sede universitaria', 'danger');
            return;
          }
          showToast('Sede universitaria eliminada', 'info');
          await this.loadCampusesList();
          await this.loadUniversityStats();
        } catch {
          showToast('Error al eliminar sede', 'danger');
        }
      },
      title: t('education.confirm_delete_campus_title') || 'Eliminar sede',
    });
  }

  private confirmDeleteFaculty(facultyId: number, facultyName: string): void {
    openModal({
      confirmClass: 'component-button--danger',
      confirmText: t('education.confirm_delete_faculty_btn') || 'Eliminar facultad',
      description: (t('education.confirm_delete_faculty_desc') || '¿Estás seguro de que deseas eliminar esta facultad?').replace('{name}', facultyName),
      onConfirm: async () => {
        try {
          const res = await deleteApi(API_ROUTES.education.universityFacultyById(facultyId));
          if (!res.ok) {
            showToast('No se pudo eliminar la facultad', 'danger');
            return;
          }
          showToast('Facultad eliminada', 'info');
          await this.loadFacultiesList();
          await this.loadUniversityStats();
        } catch {
          showToast('Error al eliminar facultad', 'danger');
        }
      },
      title: t('education.confirm_delete_faculty_title') || 'Eliminar facultad',
    });
  }

  private renderClassrooms(): void {
    if (!this.tableBody) return;
    this.tableBody.innerHTML = '';
    this.selectedClassroom = null;
    this.updateActionButtons();

    const filtered = this.classrooms.filter((c) => {
      if (!this.searchQuery) return true;
      return (
        c.name.toLowerCase().includes(this.searchQuery) ||
        (c.description && c.description.toLowerCase().includes(this.searchQuery)) ||
        (c.join_code && c.join_code.toLowerCase().includes(this.searchQuery))
      );
    });

    const tableWrapper = this.tableWrapper;
    if (filtered.length === 0) {
      if (tableWrapper) {
        renderEmptyState({
          container: tableWrapper,
          dataRef: 'education-empty-state',
          desc: this.searchQuery
            ? t('teams.search_no_results') || 'No se encontraron aulas escolares con ese término.'
            : t('education.empty_desc') || 'Únete a un aula con el código de tu profesor o crea una nueva si eres docente.',
          graphicType: this.searchQuery ? 'search' : 'users',
          isTable: true,
          title: this.searchQuery
            ? t('teams.search_no_results_title') || 'Sin resultados'
            : t('education.empty_title') || 'No estás en ningún aula escolar',
        });
      }
      return;
    }

    if (tableWrapper) {
      removeEmptyState(tableWrapper, 'education-empty-state');
    }

    for (const classroom of filtered) {
      const tr = document.createElement('tr');
      tr.className = 'component-table__row is-selectable';
      tr.setAttribute('data-ref', `row-classroom-${classroom.uuid}`);

      const tdName = document.createElement('td');
      tdName.className = 'component-table__cell';
      tdName.setAttribute('data-ref', `cell-name-${classroom.uuid}`);
      tdName.innerHTML = `<span class="component-badge component-badge--sm" data-ref="badge-name-${classroom.uuid}">${escapeHtml(classroom.name)}</span>`;

      const tdDesc = document.createElement('td');
      tdDesc.className = 'component-table__cell';
      tdDesc.setAttribute('data-ref', `cell-desc-${classroom.uuid}`);
      const descText = classroom.description || '—';
      tdDesc.innerHTML = `<span class="component-badge component-badge--sm" data-ref="badge-desc-${classroom.uuid}">${escapeHtml(descText)}</span>`;

      const tdCode = document.createElement('td');
      tdCode.className = 'component-table__cell';
      tdCode.setAttribute('data-ref', `cell-code-${classroom.uuid}`);
      const codeText = classroom.join_code || '—';
      tdCode.innerHTML = `<span class="component-badge component-badge--sm" data-ref="badge-code-${classroom.uuid}">${escapeHtml(codeText)}</span>`;

      const tdMembers = document.createElement('td');
      tdMembers.className = 'component-table__cell';
      tdMembers.setAttribute('data-ref', `cell-members-${classroom.uuid}`);
      const memberCount = Number(classroom.member_count) || 1;
      const memberLabel = memberCount === 1 ? '1 integrante' : `${memberCount} integrantes`;
      tdMembers.innerHTML = `<span class="component-badge component-badge--sm" data-ref="badge-members-${classroom.uuid}">${escapeHtml(memberLabel)}</span>`;

      const tdRole = document.createElement('td');
      tdRole.className = 'component-table__cell';
      tdRole.setAttribute('data-ref', `cell-role-${classroom.uuid}`);
      const roleText = classroom.user_role === 'owner' ? 'Docente titular' : (classroom.user_role === 'admin' ? 'Profesor adjunto' : 'Estudiante');
      tdRole.innerHTML = `<span class="component-badge component-badge--sm" data-ref="badge-role-${classroom.uuid}">${escapeHtml(roleText)}</span>`;

      const tdCreated = document.createElement('td');
      tdCreated.className = 'component-table__cell';
      tdCreated.setAttribute('data-ref', `cell-date-${classroom.uuid}`);
      tdCreated.innerHTML = `<span class="component-badge component-badge--sm" data-ref="badge-date-${classroom.uuid}">${escapeHtml(formatDate(classroom.created_at))}</span>`;

      tr.appendChild(tdName);
      tr.appendChild(tdDesc);
      tr.appendChild(tdCode);
      tr.appendChild(tdMembers);
      tr.appendChild(tdRole);
      tr.appendChild(tdCreated);

      tr.addEventListener('click', () => {
        const isAlreadySelected = this.selectedClassroom?.uuid === classroom.uuid;
        const rows = this.tableBody?.querySelectorAll('.component-table__row');
        rows?.forEach((r) => r.classList.remove('is-selected'));
        if (isAlreadySelected) {
          this.selectedClassroom = null;
        } else {
          tr.classList.add('is-selected');
          this.selectedClassroom = classroom;
        }
        this.updateActionButtons();
      }, { signal: this.abortController.signal });

      this.tableBody.appendChild(tr);
    }
  }

  private renderTeachersTable(): void {
    if (!this.teachersTableBody) return;
    this.teachersTableBody.innerHTML = '';

    let teachers = Array.isArray(this.school?.teachers) ? this.school!.teachers : [];
    if (this.searchQuery) {
      teachers = teachers.filter((t) =>
        (t.username || '').toLowerCase().includes(this.searchQuery) ||
        (t.email || '').toLowerCase().includes(this.searchQuery)
      );
    }
    const wrapper = this.teachersTableWrapper;

    if (teachers.length === 0) {
      if (wrapper) {
        renderEmptyState({
          container: wrapper,
          dataRef: 'teachers-empty-state',
          desc: 'Aún no has vinculado docentes a tu institución. Agrega miembros para otorgarles licencias de aula.',
          graphicType: 'users',
          isTable: true,
          title: 'Sin docentes vinculados',
        });
      }
      return;
    }

    if (wrapper) {
      removeEmptyState(wrapper, 'teachers-empty-state');
    }

    for (const teacher of teachers) {
      const tr = document.createElement('tr');
      tr.className = 'component-table__row';
      tr.setAttribute('data-ref', `row-teacher-${teacher.user_id}`);

      const tdTeacher = document.createElement('td');
      tdTeacher.className = 'component-table__cell';
      tdTeacher.setAttribute('data-ref', `cell-teacher-${teacher.user_id}`);
      tdTeacher.innerHTML = `<span class="component-badge component-badge--sm" data-ref="badge-teacher-${teacher.user_id}">${escapeHtml(teacher.username || 'Docente')}</span>`;

      const tdEmail = document.createElement('td');
      tdEmail.className = 'component-table__cell';
      tdEmail.setAttribute('data-ref', `cell-email-${teacher.user_id}`);
      const emailText = teacher.email || '—';
      tdEmail.innerHTML = `<span class="component-badge component-badge--sm" data-ref="badge-email-${teacher.user_id}">${escapeHtml(emailText)}</span>`;

      const tdStatus = document.createElement('td');
      tdStatus.className = 'component-table__cell';
      tdStatus.setAttribute('data-ref', `cell-status-${teacher.user_id}`);
      const isActive = teacher.status === 'active';
      tdStatus.innerHTML = `<span class="component-badge component-badge--sm" data-ref="badge-status-${teacher.user_id}">${escapeHtml(isActive ? 'Activo' : teacher.status)}</span>`;

      const tdJoined = document.createElement('td');
      tdJoined.className = 'component-table__cell';
      tdJoined.setAttribute('data-ref', `cell-date-${teacher.user_id}`);
      tdJoined.innerHTML = `<span class="component-badge component-badge--sm" data-ref="badge-date-${teacher.user_id}">${escapeHtml(formatDate(teacher.created_at))}</span>`;

      const tdActions = document.createElement('td');
      tdActions.className = 'component-table__cell';
      tdActions.style.textAlign = 'right';

      if (this.school?.is_admin && teacher.user_id !== currentUser?.id) {
        const btnRemove = document.createElement('button');
        btnRemove.type = 'button';
        btnRemove.className = 'component-button component-button--h32 component-button--danger component-button--icon-only';
        btnRemove.setAttribute('data-ref', `btn-remove-teacher-${teacher.user_id}`);
        btnRemove.setAttribute('data-tooltip', 'Desvincular docente');
        btnRemove.setAttribute('aria-label', 'Desvincular docente');
        btnRemove.innerHTML = '<svg class="component-icon" aria-hidden="true"><use href="/icons.svg#delete"></use></svg>';
        btnRemove.addEventListener('click', (e) => {
          e.stopPropagation();
          this.confirmRemoveTeacher(teacher.user_id, teacher.username || 'el docente');
        }, { signal: this.abortController.signal });
        tdActions.appendChild(btnRemove);
      }

      tr.appendChild(tdTeacher);
      tr.appendChild(tdEmail);
      tr.appendChild(tdStatus);
      tr.appendChild(tdJoined);
      tr.appendChild(tdActions);

      this.teachersTableBody.appendChild(tr);
    }
  }

  private async loadStudents(): Promise<void> {
    try {
      const res = await getApi(API_ROUTES.education.students);
      if (!res.ok) {
        this.students = [];
        this.renderStudentsTable();
        return;
      }
      const data = await res.json();
      this.students = Array.isArray(data.students) ? data.students : [];
      this.renderStudentsTable();
    } catch {
      this.students = [];
      this.renderStudentsTable();
    }
  }

  private renderStudentsTable(): void {
    if (!this.studentsTableBody) return;
    this.studentsTableBody.innerHTML = '';

    let students = this.students;
    if (this.searchQuery) {
      students = students.filter((s) =>
        (s.username || '').toLowerCase().includes(this.searchQuery) ||
        (s.email || '').toLowerCase().includes(this.searchQuery) ||
        (s.source_label || '').toLowerCase().includes(this.searchQuery)
      );
    }
    const wrapper = this.studentsTableWrapper;

    if (students.length === 0) {
      if (wrapper) {
        renderEmptyState({
          container: wrapper,
          dataRef: 'students-empty-state',
          desc: this.searchQuery
            ? t('teams.search_no_results') || 'No se encontraron estudiantes con ese término.'
            : t('education.empty_students_desc') || 'Aún no hay estudiantes registrados con el dominio institucional, inscritos en aulas escolares o sincronizados mediante SSO/SCIM.',
          graphicType: this.searchQuery ? 'search' : 'users',
          isTable: true,
          title: this.searchQuery
            ? t('teams.search_no_results_title') || 'Sin resultados'
            : t('education.empty_students_title') || 'Sin estudiantes registrados',
        });
      }
      return;
    }

    if (wrapper) {
      removeEmptyState(wrapper, 'students-empty-state');
    }

    for (const student of students) {
      const tr = document.createElement('tr');
      tr.className = 'component-table__row';
      tr.setAttribute('data-ref', `row-student-${student.id}`);

      const tdStudent = document.createElement('td');
      tdStudent.className = 'component-table__cell';
      tdStudent.setAttribute('data-ref', `cell-student-${student.id}`);
      tdStudent.innerHTML = `<span class="component-badge component-badge--sm" data-ref="badge-student-${student.id}">${escapeHtml(student.username || 'Estudiante')}</span>`;

      const tdEmail = document.createElement('td');
      tdEmail.className = 'component-table__cell';
      tdEmail.setAttribute('data-ref', `cell-email-${student.id}`);
      const emailText = student.email || '—';
      tdEmail.innerHTML = `<span class="component-badge component-badge--sm" data-ref="badge-email-${student.id}">${escapeHtml(emailText)}</span>`;

      const tdSource = document.createElement('td');
      tdSource.className = 'component-table__cell';
      tdSource.setAttribute('data-ref', `cell-source-${student.id}`);
      const sourceBadgeClass = student.source === 'sso_scim' ? 'component-badge--primary' : '';
      tdSource.innerHTML = `<span class="component-badge component-badge--sm ${sourceBadgeClass}" data-ref="badge-source-${student.id}">${escapeHtml(student.source_label)}</span>`;

      const tdClassrooms = document.createElement('td');
      tdClassrooms.className = 'component-table__cell';
      tdClassrooms.setAttribute('data-ref', `cell-classrooms-${student.id}`);
      const classroomsLabel = student.classrooms_count === 1 ? '1 aula' : `${student.classrooms_count} aulas`;
      tdClassrooms.innerHTML = `<span class="component-badge component-badge--sm" data-ref="badge-classrooms-${student.id}">${escapeHtml(classroomsLabel)}</span>`;

      const tdJoined = document.createElement('td');
      tdJoined.className = 'component-table__cell';
      tdJoined.setAttribute('data-ref', `cell-date-${student.id}`);
      tdJoined.innerHTML = `<span class="component-badge component-badge--sm" data-ref="badge-date-${student.id}">${escapeHtml(formatDate(student.created_at))}</span>`;

      const tdStatus = document.createElement('td');
      tdStatus.className = 'component-table__cell';
      tdStatus.style.textAlign = 'right';
      tdStatus.setAttribute('data-ref', `cell-status-${student.id}`);
      const isActive = student.status === 'active';
      tdStatus.innerHTML = `<span class="component-badge component-badge--sm" data-ref="badge-status-${student.id}">${escapeHtml(isActive ? (t('common.status_active') || 'Activo') : student.status)}</span>`;

      tr.appendChild(tdStudent);
      tr.appendChild(tdEmail);
      tr.appendChild(tdSource);
      tr.appendChild(tdClassrooms);
      tr.appendChild(tdJoined);
      tr.appendChild(tdStatus);

      this.studentsTableBody.appendChild(tr);
    }
  }

  private updateActionButtons(): void {
    if (this.activeTab !== 'classrooms') return;

    if (this.selectedClassroom) {
      if (this.defaultActions) this.defaultActions.style.display = 'none';
      if (this.selectedActions) this.selectedActions.style.display = 'inline-flex';

      const isTeacherOrAdmin = this.selectedClassroom.user_role === 'owner' || this.selectedClassroom.user_role === 'admin';
      if (this.btnActionRegenCode) this.btnActionRegenCode.style.display = isTeacherOrAdmin ? 'inline-flex' : 'none';
      if (this.btnActionDelete) this.btnActionDelete.style.display = this.selectedClassroom.user_role === 'owner' ? 'inline-flex' : 'none';
      if (this.btnActionCopyCode) this.btnActionCopyCode.style.display = this.selectedClassroom.join_code ? 'inline-flex' : 'none';
    } else {
      if (this.defaultActions) this.defaultActions.style.display = 'inline-flex';
      if (this.selectedActions) this.selectedActions.style.display = 'none';
    }
  }

  private copyCodeToClipboard(code: string): void {
    navigator.clipboard.writeText(code).then(() => {
      showToast(t('education.code_copied') || 'Código de clase copiado al portapapeles', 'info');
    }).catch(() => {
      showToast('No se pudo copiar el código', 'danger');
    });
  }

  private confirmRegenerateCode(classroom: Classroom): void {
    openModal({
      confirmClass: 'component-button--black',
      confirmText: 'Regenerar código',
      description: t('education.regen_code_confirm') || '¿Deseas generar un nuevo código de clase? El código anterior dejará de funcionar para nuevos alumnos.',
      onConfirm: async () => {
        try {
          const res = await postApi(API_ROUTES.education.regenerateCode(classroom.uuid), {});
          if (!res.ok) {
            showToast('Error al regenerar el código de clase', 'danger');
            return;
          }
          const data = await res.json();
          classroom.join_code = data.joinCode;
          showToast(t('education.regen_code_success') || 'Nuevo código generado exitosamente', 'success');
          this.renderClassrooms();
        } catch {
          showToast('Error al conectar con el servidor', 'danger');
        }
      },
      title: 'Regenerar código de clase',
    });
  }

  private openJoinModal(): void {
    if (!this.modalJoinBackdrop) return;
    if (this.bannerJoinError) {
      this.bannerJoinError.textContent = '';
      this.bannerJoinError.classList.add('is-hidden');
    }
    if (this.inputJoinCode) {
      this.inputJoinCode.value = '';
      if (this.bannerJoinError) this.bannerJoinError.classList.add('is-hidden');
      this.modalJoinBackdrop.classList.add('is-visible');
      document.body.classList.add('modal-open');
      this.inputJoinCode.focus();
    }
  }

  private closeJoinModal(): void {
    if (this.modalJoinBackdrop) {
      this.modalJoinBackdrop.classList.remove('is-visible');
      document.body.classList.remove('modal-open');
    }
  }

  private async handleJoinSubmit(): Promise<void> {
    const code = (this.inputJoinCode?.value || '').trim();
    if (!code) return;

    if (this.bannerJoinError) this.bannerJoinError.classList.add('is-hidden');

    try {
      const res = await postApi(API_ROUTES.education.join, { code });
      const data = await res.json();

      if (!res.ok) {
        if (this.bannerJoinError) {
          this.bannerJoinError.textContent = data.error || 'Código de aula inválido o no encontrado.';
          this.bannerJoinError.classList.remove('is-hidden');
        }
        return;
      }

      this.closeJoinModal();
      showToast(data.isNewMember ? 'Te has unido al aula escolar con éxito.' : 'Ya perteneces a esta aula.', 'success');
      await this.loadClassrooms();
    } catch {
      if (this.bannerJoinError) {
        this.bannerJoinError.textContent = 'Error al conectarse con el servidor.';
        this.bannerJoinError.classList.remove('is-hidden');
      }
    }
  }

  private openCreateModal(): void {
    const rawTier = (currentUser?.subscription_tier || 'free').toLowerCase();
    const canCreate = ['docentes', 'escuelas', 'education', 'business', 'negocios', 'pro', 'universidades', 'universities'].includes(rawTier);

    if (!canCreate) {
      showToast('La creación de aulas escolares requiere el plan Docentes o Escuelas e Instituciones.', 'warning');
      openUpgradeModal('teachers');
      return;
    }

    if (this.modalClassroomBackdrop && this.inputClassroomName) {
      this.inputClassroomName.value = '';
      if (this.inputClassroomDesc) this.inputClassroomDesc.value = '';
      if (this.bannerClassroomError) this.bannerClassroomError.classList.add('is-hidden');
      this.modalClassroomBackdrop.classList.add('is-visible');
      document.body.classList.add('modal-open');
      this.inputClassroomName.focus();
    }
  }

  private closeCreateModal(): void {
    if (this.modalClassroomBackdrop) {
      this.modalClassroomBackdrop.classList.remove('is-visible');
      document.body.classList.remove('modal-open');
    }
  }

  private async handleCreateSubmit(): Promise<void> {
    const name = (this.inputClassroomName?.value || '').trim();
    const description = (this.inputClassroomDesc?.value || '').trim();

    if (!name) return;
    if (this.bannerClassroomError) this.bannerClassroomError.classList.add('is-hidden');

    try {
      const res = await postApi(API_ROUTES.education.classrooms, {
        description,
        name,
      });

      const data = await res.json();
      if (!res.ok) {
        if (this.bannerClassroomError) {
          this.bannerClassroomError.textContent = data.error || 'Error al crear aula escolar.';
          this.bannerClassroomError.classList.remove('is-hidden');
        }
        return;
      }

      this.closeCreateModal();
      showToast('Aula escolar creada con éxito.', 'success');
      await this.loadClassrooms();
    } catch {
      if (this.bannerClassroomError) {
        this.bannerClassroomError.textContent = 'Error al procesar la solicitud.';
        this.bannerClassroomError.classList.remove('is-hidden');
      }
    }
  }

  private openTeacherModal(): void {
    if (this.modalTeacherBackdrop && this.inputTeacherQuery) {
      this.inputTeacherQuery.value = '';
      if (this.bannerTeacherError) this.bannerTeacherError.classList.add('is-hidden');
      this.modalTeacherBackdrop.classList.add('is-visible');
      document.body.classList.add('modal-open');
      this.inputTeacherQuery.focus();
    }
  }

  private closeTeacherModal(): void {
    if (this.modalTeacherBackdrop) {
      this.modalTeacherBackdrop.classList.remove('is-visible');
      document.body.classList.remove('modal-open');
    }
  }

  private async handleTeacherSubmit(): Promise<void> {
    const query = (this.inputTeacherQuery?.value || '').trim();
    if (!query) return;
    if (this.bannerTeacherError) this.bannerTeacherError.classList.add('is-hidden');

    try {
      const res = await postApi(API_ROUTES.education.addTeacher, {
        emailOrUsername: query,
      });

      const data = await res.json();
      if (!res.ok) {
        if (this.bannerTeacherError) {
          this.bannerTeacherError.textContent = data.error || 'No se pudo vincular al docente.';
          this.bannerTeacherError.classList.remove('is-hidden');
        }
        return;
      }

      this.closeTeacherModal();
      showToast('Docente vinculado a la institución exitosamente.', 'success');
      await this.loadSchool();
    } catch {
      if (this.bannerTeacherError) {
        this.bannerTeacherError.textContent = 'Error al procesar la vinculación.';
        this.bannerTeacherError.classList.remove('is-hidden');
      }
    }
  }

  private confirmRemoveTeacher(userId: number, username: string): void {
    openModal({
      confirmClass: 'component-button--danger',
      confirmText: 'Desvincular docente',
      description: `¿Estás seguro de que deseas desvincular a "${username}" de la institución? El docente perderá la licencia educativa institucional.`,
      onConfirm: async () => {
        try {
          const res = await deleteApi(API_ROUTES.education.removeTeacher(userId));
          if (!res.ok) {
            showToast('No se pudo desvincular al docente', 'danger');
            return;
          }
          showToast('Docente desvinculado exitosamente', 'info');
          await this.loadSchool();
        } catch {
          showToast('Error al desvincular docente', 'danger');
        }
      },
      title: 'Desvincular docente',
    });
  }

  private openSchoolModal(): void {
    if (!this.school) return;
    if (this.modalSchoolBackdrop && this.inputSchoolName) {
      this.inputSchoolName.value = this.school.name || '';
      if (this.inputSchoolDomain) {
        this.inputSchoolDomain.value = this.school.domain || '';
      }
      if (this.bannerSchoolError) this.bannerSchoolError.classList.add('is-hidden');
      this.modalSchoolBackdrop.classList.add('is-visible');
      document.body.classList.add('modal-open');
      this.inputSchoolName.focus();
    }
  }

  private closeSchoolModal(): void {
    if (this.modalSchoolBackdrop) {
      this.modalSchoolBackdrop.classList.remove('is-visible');
      document.body.classList.remove('modal-open');
    }
  }

  private async handleSchoolSubmit(): Promise<void> {
    const name = (this.inputSchoolName?.value || '').trim();
    const domain = (this.inputSchoolDomain?.value || '').trim();

    if (!name) return;
    if (this.bannerSchoolError) this.bannerSchoolError.classList.add('is-hidden');

    try {
      const res = await putApi(API_ROUTES.education.school, {
        domain,
        name,
      });

      const data = await res.json();
      if (!res.ok) {
        if (this.bannerSchoolError) {
          this.bannerSchoolError.textContent = data.error || 'Error al actualizar datos de la institución.';
          this.bannerSchoolError.classList.remove('is-hidden');
        }
        return;
      }

      this.closeSchoolModal();
      showToast('Información de la institución actualizada', 'success');
      await this.loadSchool();
    } catch {
      if (this.bannerSchoolError) {
        this.bannerSchoolError.textContent = 'Error al actualizar la institución.';
        this.bannerSchoolError.classList.remove('is-hidden');
      }
    }
  }

  private async handleRegenerateCode(uuid: string): Promise<void> {
    openModal({
      confirmClass: 'component-button--danger',
      confirmText: 'Regenerar código',
      description: t('education.regen_code_confirm') || '¿Deseas generar un nuevo código de clase? El código anterior dejará de funcionar para nuevos alumnos.',
      onConfirm: async () => {
        try {
          const res = await postApi(API_ROUTES.education.regenerateCode(uuid));
          if (!res.ok) {
            showToast('No se pudo regenerar el código de clase', 'danger');
            return;
          }
          const data = await res.json();
          showToast(t('education.regen_code_success') || `Nuevo código: ${data.joinCode}`, 'success');
          await this.loadClassrooms();
        } catch {
          showToast('Error al regenerar código', 'danger');
        }
      },
      title: 'Regenerar código de clase',
    });
  }

  private async openMembersModal(classroom: Classroom): Promise<void> {
    this.selectedClassroom = classroom;
    if (this.displayClassroomCode) {
      this.displayClassroomCode.textContent = classroom.join_code || '—';
    }

    if (this.modalMembersBackdrop) {
      this.modalMembersBackdrop.classList.add('is-visible');
      document.body.classList.add('modal-open');
    }

    await this.loadClassroomDetails(classroom.uuid);
  }

  private closeMembersModal(): void {
    this.membersDropdownController?.close();
    if (this.modalMembersBackdrop) {
      this.modalMembersBackdrop.classList.remove('is-visible');
      document.body.classList.remove('modal-open');
    }
  }

  private async loadClassroomDetails(uuid: string): Promise<void> {
    try {
      const res = await getApi(API_ROUTES.teams.byId(uuid));
      if (res.ok) {
        const data = await res.json();
        this.currentMembers = Array.isArray(data.members) ? data.members : [];
        if (this.membersTriggerText) {
          this.membersTriggerText.textContent = `Alumnos inscritos (${this.currentMembers.length})`;
        }
        this.renderMembersDropdown();
      }
    } catch {
      showToast('Error al cargar alumnos del aula', 'danger');
    }
  }

  private renderMembersDropdown(): void {
    if (!this.membersDropdownList) return;
    this.membersDropdownList.innerHTML = '';

    if (this.currentMembers.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'menu-item';
      empty.style.color = 'var(--text-secondary)';
      empty.style.cursor = 'default';
      empty.textContent = 'No hay estudiantes inscritos aún.';
      this.membersDropdownList.appendChild(empty);
      return;
    }

    const canManage = this.selectedClassroom?.user_role === 'owner' || this.selectedClassroom?.user_role === 'admin';

    for (const member of this.currentMembers) {
      const item = document.createElement('div');
      item.className = 'menu-item menu-item--member';
      item.setAttribute('data-ref', `member-item-${member.user_id}`);

      const avatar = document.createElement('div');
      avatar.className = 'account-item__avatar';
      avatar.style.backgroundColor = this.selectedClassroom?.color || '#4f46e5';
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
      const isOwner = this.selectedClassroom?.owner_id === member.user_id;
      roleBadge.className = `team-badge team-badge--${isOwner ? 'owner' : 'member'}`;
      roleBadge.textContent = isOwner ? 'Docente titular' : 'Estudiante';

      item.appendChild(avatar);
      item.appendChild(info);
      item.appendChild(roleBadge);

      if (canManage && !isOwner && member.user_id !== currentUser?.id) {
        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'component-button component-button--icon-only component-button--ghost component-button--h28';
        removeBtn.setAttribute('data-tooltip', `Remover a ${member.username}`);
        removeBtn.setAttribute('aria-label', `Remover a ${member.username}`);
        removeBtn.innerHTML = '<svg class="component-icon" aria-hidden="true" style="width: 18px; height: 18px;"><use href="/icons.svg#person_remove"></use></svg>';
        removeBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          void this.handleRemoveMember(member.user_id, member.username || 'estudiante');
        }, { signal: this.abortController.signal });
        item.appendChild(removeBtn);
      }

      this.membersDropdownList.appendChild(item);
    }
  }

  private async handleAddMember(): Promise<void> {
    if (!this.selectedClassroom || !this.inputAddMember) return;
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
        showToast('No se encontró ningún estudiante con ese nombre o correo.', 'danger');
        return;
      }

      const targetUser = users.find(
        (u) => u.username.toLowerCase() === query.toLowerCase() || (Boolean(u.email) && u.email?.toLowerCase() === query.toLowerCase())
      ) || users[0];

      const addRes = await postApi(API_ROUTES.teams.members(this.selectedClassroom.uuid), {
        role: 'member',
        userId: targetUser.id,
      });

      if (!addRes.ok) {
        showToast('No se pudo agregar al estudiante', 'danger');
        return;
      }

      showToast(`${targetUser.username} inscrito en el aula`, 'success');
      this.inputAddMember.value = '';
      await this.loadClassroomDetails(this.selectedClassroom.uuid);
      await this.loadClassrooms();
    } catch {
      showToast('Error al inscribir estudiante', 'danger');
    }
  }

  private async handleRemoveMember(userId: number, username: string): Promise<void> {
    if (!this.selectedClassroom) return;

    try {
      const res = await deleteApi(API_ROUTES.teams.removeMember(this.selectedClassroom.uuid, userId));
      if (!res.ok) {
        showToast('No se pudo remover al estudiante', 'danger');
        return;
      }

      showToast(`${username} removido del aula`, 'info');
      await this.loadClassroomDetails(this.selectedClassroom.uuid);
      await this.loadClassrooms();
    } catch {
      showToast('Error al remover estudiante', 'danger');
    }
  }

  private confirmDeleteClassroom(classroom: Classroom): void {
    openModal({
      confirmClass: 'component-button--danger',
      confirmText: 'Eliminar aula',
      description: `¿Estás seguro de que deseas eliminar el aula "${classroom.name}"? Los estudiantes perderán el acceso a los proyectos compartidos.`,
      onConfirm: async () => {
        try {
          const res = await deleteApi(API_ROUTES.teams.byId(classroom.uuid));
          if (!res.ok) {
            showToast('No se pudo eliminar el aula escolar', 'danger');
            return;
          }
          showToast('Aula escolar eliminada exitosamente', 'info');
          await this.loadClassrooms();
        } catch {
          showToast('Error al eliminar aula', 'danger');
        }
      },
      title: 'Eliminar aula escolar',
    });
  }
}

export async function createEducationClassroomsView(): Promise<HTMLElement> {
  const container = await loadTemplate('/views/education/classrooms.html');
  translateElement(container);

  const sidebar = await createSidebar();
  container.prepend(sidebar);

  const controller = new EducationController(container, 'classrooms');
  await controller.init();
  (container as any).__controller = controller;

  return container;
}

export async function createEducationTeachersView(): Promise<HTMLElement> {
  const container = await loadTemplate('/views/education/teachers.html');
  translateElement(container);

  const sidebar = await createSidebar();
  container.prepend(sidebar);

  const controller = new EducationController(container, 'teachers');
  await controller.init();
  (container as any).__controller = controller;

  return container;
}

export async function createEducationInstitutionView(): Promise<HTMLElement> {
  const container = await loadTemplate('/views/education/institution.html');
  translateElement(container);

  const sidebar = await createSidebar();
  container.prepend(sidebar);

  const controller = new EducationController(container, 'school');
  await controller.init();
  (container as any).__controller = controller;

  return container;
}

export async function createEducationStudentsView(): Promise<HTMLElement> {
  const container = await loadTemplate('/views/education/students.html');
  translateElement(container);

  const sidebar = await createSidebar();
  container.prepend(sidebar);

  const controller = new EducationController(container, 'students');
  await controller.init();
  (container as any).__controller = controller;

  return container;
}

export const createEducationView = createEducationClassroomsView;
