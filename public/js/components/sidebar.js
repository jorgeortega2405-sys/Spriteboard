import { loadTemplate } from '../services/template.js';
import { navigate } from '../router.js';

let isSidebarOpen = false;

export function getIsSidebarOpen() {
  return isSidebarOpen;
}

export function toggleSidebar(forceState) {
  isSidebarOpen = forceState !== undefined ? forceState : !isSidebarOpen;
  const sidebar = document.querySelector('[data-ref="sidebar"]');
  const btnToggle = document.querySelector('[data-ref="btn-toggle-menu"]');

  if (sidebar) {
    sidebar.classList.toggle('is-active', isSidebarOpen);
  }
  if (btnToggle) {
    btnToggle.classList.toggle('is-active', isSidebarOpen);
  }
}

export async function createSidebar() {
  const sidebar = await loadTemplate('/views/components/sidebar.html');

  if (isSidebarOpen) {
    sidebar.classList.add('is-active');
  }

  const currentPath = window.location.pathname;

  const btnHome = sidebar.querySelector('[data-ref="btn-nav-home"]');
  const btnTrash = sidebar.querySelector('[data-ref="btn-nav-trash"]');

  if (btnHome && currentPath === '/') {
    btnHome.classList.add('is-active');
  }
  if (btnTrash && currentPath === '/trash') {
    btnTrash.classList.add('is-active');
  }

  btnHome?.addEventListener('click', (e) => {
    e.preventDefault();
    navigate('/');
  });

  btnTrash?.addEventListener('click', (e) => {
    e.preventDefault();
    navigate('/trash');
  });

  return sidebar;
}
