import { loadTemplate } from '../services/template.js';
import { currentUser, postApi, setCurrentUser, escapeHtml } from '../services/api.js';
import { toggleSidebar, getIsSidebarOpen } from './sidebar.js';
import { navigate, render } from '../router.js';

export async function createTopBar() {
  const topbar = await loadTemplate('/views/components/topbar.html');

  const btnToggle = topbar.querySelector('[data-ref="btn-toggle-menu"]');
  if (btnToggle && getIsSidebarOpen()) {
    btnToggle.classList.add('is-active');
  }

  btnToggle?.addEventListener('click', (e) => {
    e.preventDefault();
    toggleSidebar();
  });

  const avatarContainer = topbar.querySelector('[data-ref="avatar-container"]');
  const btnLogin = topbar.querySelector('[data-ref="btn-login"]');

  if (currentUser) {
    if (avatarContainer) {
      avatarContainer.style.display = 'inline-flex';

      const avatarImg = avatarContainer.querySelector('[data-ref="avatar-img"]');
      const avatarBtn = avatarContainer.querySelector('[data-ref="btn-avatar"]');
      const avatarMenu = avatarContainer.querySelector('[data-ref="avatar-menu"]');
      const btnLogout = avatarContainer.querySelector('[data-ref="btn-logout"]');

      const avatarUrl = currentUser.avatar_url || `/api/avatar?name=${encodeURIComponent(currentUser.username)}`;

      if (avatarImg) {
        avatarImg.src = avatarUrl;
        avatarImg.alt = escapeHtml(currentUser.username);
        avatarImg.onerror = () => {
          avatarImg.onerror = null;
          avatarImg.src = `/api/avatar?name=${encodeURIComponent(currentUser.username)}`;
        };
      }

      if (avatarBtn) {
        avatarBtn.setAttribute('data-tooltip', currentUser.username || 'Perfil');
        avatarBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          avatarMenu?.classList.toggle('is-open');
        });
      }

      // Cerrar menú al hacer clic fuera
      const closeMenuHandler = () => {
        avatarMenu?.classList.remove('is-open');
      };
      document.addEventListener('click', closeMenuHandler);

      // Cerrar sesión
      btnLogout?.addEventListener('click', async (e) => {
        e.preventDefault();
        try {
          await postApi('/api/logout', {});
        } finally {
          setCurrentUser(null);
          document.removeEventListener('click', closeMenuHandler);
          render();
        }
      });
    }
  } else {
    if (btnLogin) {
      btnLogin.style.display = 'inline-flex';
      btnLogin.addEventListener('click', (e) => {
        e.preventDefault();
        navigate('/login');
      });
    }
  }

  return topbar;
}
