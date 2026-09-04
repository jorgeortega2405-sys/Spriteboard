/**
 * Arquitectura SPA 100% Nativa basada en Componentes
 */

// Componente TopBar
function TopBar() {
  const top = document.createElement('div');
  top.className = 'general-content-top';
  top.innerHTML = `
    <div class="top-left">
      <button class="component-button component-button--h40 component-button--icon-only" aria-label="Menú" title="Menú">
        <span class="material-symbols-rounded">menu</span>
      </button>
    </div>
    <div class="top-center"></div>
    <div class="top-right">
      <button id="btn-login" class="component-button component-button--h40 component-button--black">Acceder</button>
    </div>
  `;

  // Enlace del botón Acceder
  const loginBtn = top.querySelector('#btn-login');
  if (loginBtn) {
    loginBtn.addEventListener('click', (e) => {
      e.preventDefault();
      navigate('/login');
    });
  }

  return top;
}

// Componente Bottom (Contenedor base)
function BottomContent(contentHtml = '') {
  const bottom = document.createElement('div');
  bottom.className = 'general-content-bottom';
  bottom.innerHTML = contentHtml;
  return bottom;
}

// Componente Login View
function LoginView() {
  const container = document.createElement('div');
  container.className = 'general-content-bottom';
  container.innerHTML = `
    <div class="login-container">
      <div class="login-card">
        <div class="login-header">
          <h1 class="login-title">Bienvenido de vuelta</h1>
          <p class="login-subtitle">Ingresa tus credenciales para acceder a tu cuenta</p>
        </div>
        
        <form class="login-form" onsubmit="return false;">
          <!-- Input Correo con floating label -->
          <div class="form-field">
            <input type="email" id="login-email" class="form-input" placeholder=" " autocomplete="email" />
            <label for="login-email" class="form-label">Correo electrónico</label>
          </div>

          <!-- Input Contraseña con floating label y botón de alternar visibilidad -->
          <div class="form-field">
            <input type="password" id="login-password" class="form-input form-input--with-action" placeholder=" " autocomplete="current-password" />
            <label for="login-password" class="form-label">Contraseña</label>
            <button type="button" class="form-input-action" id="toggle-password" aria-label="Alternar visibilidad de contraseña">
              <span class="material-symbols-rounded">visibility</span>
            </button>
          </div>

          <!-- Botón Continuar (100% ancho) -->
          <button type="button" class="component-button component-button--h40 component-button--black component-button--full-width">
            Continuar
          </button>

          <!-- Botón Continuar con Google (100% ancho) -->
          <button type="button" class="component-button component-button--h40 component-button--full-width">
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
            </svg>
            <span>Continuar con Google</span>
          </button>
        </form>
      </div>
    </div>
  `;

  // Alternar visibilidad de contraseña
  const toggleBtn = container.querySelector('#toggle-password');
  const passwordInput = container.querySelector('#login-password');
  if (toggleBtn && passwordInput) {
    toggleBtn.addEventListener('click', () => {
      const isPassword = passwordInput.type === 'password';
      passwordInput.type = isPassword ? 'text' : 'password';
      const icon = toggleBtn.querySelector('.material-symbols-rounded');
      if (icon) {
        icon.textContent = isPassword ? 'visibility_off' : 'visibility';
      }
    });
  }

  return container;
}

// Navegación de la SPA
export function navigate(url) {
  window.history.pushState({}, '', url);
  render();
}

// Enrutador y renderizador nativo
function render() {
  const app = document.getElementById('app');
  if (!app) return;

  const path = window.location.pathname;

  // Limpiar el contenedor raíz
  app.replaceChildren();

  if (path === '/login') {
    // En /login se monta ÚNICAMENTE la vista de login (centrada y sin top bar)
    app.appendChild(LoginView());
  } else {
    // En la vista principal se montan TopBar y BottomContent
    app.appendChild(TopBar());
    app.appendChild(BottomContent());
  }
}

// Soporte para botones de navegación del navegador (atrás/adelante)
window.addEventListener('popstate', render);

// Render inicial
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', render);
} else {
  render();
}
