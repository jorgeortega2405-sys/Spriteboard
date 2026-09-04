/**
 * Arquitectura SPA 100% Nativa basada en Componentes
 * Sin etiquetas <form> y con soporte para CSRF y Autenticación con MySQL
 */

let currentUser = null;
let csrfToken = '';
let appConfig = { appName: 'Spriteboard' };

// Obtener configuración pública de la app desde el backend
async function fetchAppConfig() {
  try {
    const res = await fetch('/api/config');
    if (res.ok) {
      const data = await res.json();
      if (data.appName) {
        appConfig.appName = data.appName;
        document.title = data.appName;
      }
    }
  } catch (err) {
    console.warn('No se pudo cargar la configuración de la app:', err);
  }
}

// Helper para escapar HTML y evitar inyecciones XSS en el DOM
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Obtener o refrescar Token CSRF desde el backend
async function fetchCsrfToken() {
  try {
    const res = await fetch('/api/csrf-token');
    if (res.ok) {
      const data = await res.json();
      csrfToken = data.csrfToken;
      return csrfToken;
    }
  } catch (err) {
    console.error('Error al obtener token CSRF:', err);
  }
  return '';
}

// Comprobar si hay sesión activa del usuario
async function checkAuthSession() {
  try {
    const res = await fetch('/api/me');
    if (res.ok) {
      const data = await res.json();
      currentUser = data.user;
    } else {
      currentUser = null;
    }
  } catch {
    currentUser = null;
  }
}

// Helper para llamadas POST a la API con token CSRF y credenciales
async function postApi(url, body) {
  if (!csrfToken) {
    await fetchCsrfToken();
  }

  let res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': csrfToken,
    },
    credentials: 'include',
    body: JSON.stringify(body),
  });

  // Reintento automático si el token expiró
  if (res.status === 403) {
    await fetchCsrfToken();
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrfToken,
      },
      credentials: 'include',
      body: JSON.stringify(body),
    });
  }

  return res;
}

// SVG del icono de Google
const GOOGLE_ICON_SVG = `
  <svg width="20" height="20" viewBox="0 0 24 24">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
  </svg>
`;

// Estado de la Sidebar
let isSidebarOpen = false;

function toggleSidebar(forceState) {
  isSidebarOpen = forceState !== undefined ? forceState : !isSidebarOpen;
  const sidebar = document.getElementById('main-sidebar');
  const btnToggle = document.getElementById('btn-toggle-menu');
  if (sidebar) {
    sidebar.classList.toggle('is-active', isSidebarOpen);
  }
  if (btnToggle) {
    btnToggle.classList.toggle('is-active', isSidebarOpen);
  }
}

// Componente TopBar
function TopBar() {
  const top = document.createElement('div');
  top.className = 'general-content-top';

  const avatarUrl = currentUser
    ? currentUser.avatar_url || `/api/avatar?name=${encodeURIComponent(currentUser.username)}`
    : '';

  top.innerHTML = `
    <div class="top-left">
      <button id="btn-toggle-menu" class="component-button component-button--h40 component-button--icon-only${isSidebarOpen ? ' is-active' : ''}" aria-label="Menú" title="Menú">
        <span class="material-symbols-rounded">menu</span>
      </button>
    </div>
    <div class="top-center"></div>
    <div class="top-right">
      ${
        currentUser
          ? `
            <div class="avatar-dropdown-container">
              <button id="btn-avatar" class="component-button--avatar" aria-label="Perfil de usuario" title="${escapeHtml(currentUser.username)}">
                <img src="${avatarUrl}" alt="${escapeHtml(currentUser.username)}" referrerpolicy="no-referrer" onerror="this.onerror=null; this.src='/api/avatar?name=${encodeURIComponent(currentUser.username)}';" />
              </button>
              
              <div id="avatar-menu" class="avatar-menu">
                <button type="button" class="component-menu-link" id="btn-menu-settings">
                  <span class="material-symbols-rounded component-menu-link-icon">settings</span>
                  <span class="component-menu-link-text">Configuración</span>
                </button>
                <button type="button" class="component-menu-link" id="btn-menu-help">
                  <span class="material-symbols-rounded component-menu-link-icon">help</span>
                  <span class="component-menu-link-text">Ayuda y comentarios</span>
                </button>
                <button type="button" id="btn-logout" class="component-menu-link component-menu-link--danger component-menu-link--bordered">
                  <span class="material-symbols-rounded component-menu-link-icon">logout</span>
                  <span class="component-menu-link-text">Cerrar sesión</span>
                </button>
              </div>
            </div>
          `
          : `<button id="btn-login" class="component-button component-button--h40 component-button--black">Acceder</button>`
      }
    </div>
  `;

  // Toggle de la Sidebar al hacer clic en el botón de menú
  top.querySelector('#btn-toggle-menu')?.addEventListener('click', (e) => {
    e.preventDefault();
    toggleSidebar();
  });

  // Ir a Login
  top.querySelector('#btn-login')?.addEventListener('click', (e) => {
    e.preventDefault();
    navigate('/login');
  });

  // Toggle del Dropdown de Avatar
  const avatarBtn = top.querySelector('#btn-avatar');
  const avatarMenu = top.querySelector('#avatar-menu');
  if (avatarBtn && avatarMenu) {
    avatarBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      avatarMenu.classList.toggle('is-open');
    });

    // Cerrar dropdown al hacer clic fuera
    document.addEventListener('click', () => {
      avatarMenu.classList.remove('is-open');
    });
  }

  // Cerrar Sesión desde el menú del avatar
  top.querySelector('#btn-logout')?.addEventListener('click', async (e) => {
    e.preventDefault();
    try {
      await postApi('/api/logout', {});
    } finally {
      currentUser = null;
      render();
    }
  });

  return top;
}

// Componente Sidebar con Secciones Top y Bottom
function Sidebar() {
  const sidebar = document.createElement('div');
  sidebar.id = 'main-sidebar';
  sidebar.className = `module-sidebar${isSidebarOpen ? ' is-active' : ''}`;

  const currentPath = window.location.pathname;

  sidebar.innerHTML = `
    <div class="component-menu" id="main-menu">
      <div class="component-menu-top">
        <div class="component-menu-list">
          <button type="button" class="component-menu-link${currentPath === '/' ? ' is-active' : ''}" id="btn-nav-home">
            <span class="material-symbols-rounded component-menu-link-icon">home</span>
            <span class="component-menu-link-text">Página principal</span>
          </button>
        </div>
      </div>
      <div class="component-menu-bottom">
        <div class="component-menu-list">
          <button type="button" class="component-menu-link${currentPath === '/trash' ? ' is-active' : ''}" id="btn-nav-trash">
            <span class="material-symbols-rounded component-menu-link-icon">delete</span>
            <span class="component-menu-link-text">Papelera de reciclaje</span>
          </button>
        </div>
      </div>
    </div>
  `;

  sidebar.querySelector('#btn-nav-home')?.addEventListener('click', (e) => {
    e.preventDefault();
    navigate('/');
  });

  sidebar.querySelector('#btn-nav-trash')?.addEventListener('click', (e) => {
    e.preventDefault();
    navigate('/trash');
  });

  return sidebar;
}

// Componente Bottom para Home
function HomeContent() {
  const bottom = document.createElement('div');
  bottom.className = 'general-content-bottom';

  // Sidebar con navegación
  bottom.appendChild(Sidebar());

  // Área de contenido principal
  const contentArea = document.createElement('div');
  contentArea.className = 'home-main-area';

  if (currentUser) {
    contentArea.innerHTML = `
      <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; gap: 10px; padding: 24px;">
        <h1 style="font-size: 32px; font-weight: 700; color: #111827; letter-spacing: -0.5px; margin: 0;">
          Bienvenido, ${escapeHtml(currentUser.username)}
        </h1>
        <p style="font-size: 15px; color: #6b7280; margin: 0;">
          Has iniciado sesión correctamente en ${escapeHtml(appConfig.appName || 'Spriteboard')}.
        </p>
      </div>
    `;
  }
  bottom.appendChild(contentArea);

  return bottom;
}

// Componente Bottom para Papelera de reciclaje (/trash) - por ahora sin contenido
function TrashContent() {
  const bottom = document.createElement('div');
  bottom.className = 'general-content-bottom';

  // Sidebar con navegación
  bottom.appendChild(Sidebar());

  // Área de contenido principal (vacía por ahora)
  const contentArea = document.createElement('div');
  contentArea.className = 'home-main-area';
  bottom.appendChild(contentArea);

  return bottom;
}

// Componente Login View (Sin etiquetas <form>)
function LoginView() {
  const container = document.createElement('div');
  container.className = 'general-content-bottom';
  container.innerHTML = `
    <div class="login-container">
      <a href="/" class="login-header-logo" id="login-home-link" aria-label="Ir al inicio" title="Spriteboard">
        <img src="/logo.svg" alt="Spriteboard" class="login-logo-img" />
      </a>

      <div class="login-card">
        <div class="login-header">
          <h1 class="login-title">Bienvenido de vuelta</h1>
          <p class="login-subtitle">Ingresa tus credenciales para acceder a tu cuenta</p>
        </div>
        
        <div id="login-error" class="form-error" style="display: none;"></div>

        <!-- Contenedor sin etiqueta form -->
        <div class="login-form">
          <div class="form-field">
            <input type="email" id="login-email" class="form-input" placeholder=" " autocomplete="email" />
            <label for="login-email" class="form-label">Correo electrónico</label>
          </div>

          <div class="form-field">
            <input type="password" id="login-password" class="form-input form-input--with-action" placeholder=" " autocomplete="current-password" />
            <label for="login-password" class="form-label">Contraseña</label>
            <button type="button" class="form-input-action" id="toggle-login-password" aria-label="Alternar visibilidad">
              <span class="material-symbols-rounded">visibility</span>
            </button>
          </div>

          <div class="form-link-row">
            <a href="/forgot-password" class="form-link" id="btn-forgot-password">¿Olvidaste la contraseña?</a>
          </div>

          <button type="button" id="btn-submit-login" class="component-button component-button--h55 component-button--black component-button--full-width">
            Continuar
          </button>

          <button type="button" id="btn-google-login" class="component-button component-button--h55 component-button--full-width">
            ${GOOGLE_ICON_SVG}
            <span>Continuar con Google</span>
          </button>

          <p class="form-footer-text">
            ¿No tienes una cuenta? <a href="/register" class="form-link form-link-primary" id="btn-to-register">Crear cuenta</a>
          </p>
        </div>
      </div>
    </div>
  `;

  // Iniciar sesión con Google
  container.querySelector('#btn-google-login')?.addEventListener('click', () => {
    window.location.href = '/api/auth/google';
  });

  // Toggle visibilidad de contraseña
  const toggleBtn = container.querySelector('#toggle-login-password');
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

  // Navegación logo
  container.querySelector('#login-home-link')?.addEventListener('click', (e) => {
    e.preventDefault();
    navigate('/');
  });

  // Navegación links
  container.querySelector('#btn-forgot-password')?.addEventListener('click', (e) => {
    e.preventDefault();
    navigate('/forgot-password');
  });

  container.querySelector('#btn-to-register')?.addEventListener('click', (e) => {
    e.preventDefault();
    navigate('/register');
  });

  // Mostrar mensaje de error si viene redirigido desde OAuth
  const urlParams = new URLSearchParams(window.location.search);
  const oauthError = urlParams.get('error');
  const initialErrorBanner = container.querySelector('#login-error');
  if (oauthError && initialErrorBanner) {
    initialErrorBanner.textContent = 'No se pudo iniciar sesión con Google o se canceló la solicitud.';
    initialErrorBanner.style.display = 'block';
  }

  // Procesar Login
  const emailInput = container.querySelector('#login-email');
  const submitBtn = container.querySelector('#btn-submit-login');
  const errorBanner = container.querySelector('#login-error');

  const executeLogin = async () => {
    errorBanner.style.display = 'none';
    const email = emailInput.value.trim();
    const password = passwordInput.value;

    if (!email || !password) {
      errorBanner.textContent = 'Por favor ingresa tu correo y contraseña.';
      errorBanner.style.display = 'block';
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Iniciando sesión...';

    try {
      const res = await postApi('/api/login', { email, password });
      const data = await res.json();

      if (!res.ok) {
        errorBanner.textContent = data.error || 'Error al iniciar sesión.';
        errorBanner.style.display = 'block';
        return;
      }

      currentUser = data.user;
      navigate('/');
    } catch {
      errorBanner.textContent = 'Error de conexión con el servidor.';
      errorBanner.style.display = 'block';
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Continuar';
    }
  };

  submitBtn?.addEventListener('click', executeLogin);

  // Soporte para tecla Enter
  [emailInput, passwordInput].forEach((input) => {
    input?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        executeLogin();
      }
    });
  });

  return container;
}

// Componente Register View (Sin etiquetas <form>)
function RegisterView() {
  const container = document.createElement('div');
  container.className = 'general-content-bottom';
  container.innerHTML = `
    <div class="login-container">
      <a href="/" class="login-header-logo" id="register-home-link" aria-label="Ir al inicio" title="Spriteboard">
        <img src="/logo.svg" alt="Spriteboard" class="login-logo-img" />
      </a>

      <div class="login-card">
        <div class="login-header">
          <h1 class="login-title">Crear cuenta</h1>
          <p class="login-subtitle">Ingresa tus datos para registrarte en Spriteboard</p>
        </div>
        
        <div id="register-error" class="form-error" style="display: none;"></div>

        <!-- Contenedor sin etiqueta form -->
        <div class="login-form">
          <!-- Input Nombre de Usuario (55px) -->
          <div class="form-field">
            <input type="text" id="register-username" class="form-input" placeholder=" " autocomplete="username" />
            <label for="register-username" class="form-label">Nombre de usuario</label>
          </div>

          <!-- Input Correo (55px) -->
          <div class="form-field">
            <input type="email" id="register-email" class="form-input" placeholder=" " autocomplete="email" />
            <label for="register-email" class="form-label">Correo electrónico</label>
          </div>

          <!-- Input Contraseña (55px) con toggle de visibilidad -->
          <div class="form-field">
            <input type="password" id="register-password" class="form-input form-input--with-action" placeholder=" " autocomplete="new-password" />
            <label for="register-password" class="form-label">Contraseña</label>
            <button type="button" class="form-input-action" id="toggle-register-password" aria-label="Alternar visibilidad">
              <span class="material-symbols-rounded">visibility</span>
            </button>
          </div>

          <button type="button" id="btn-submit-register" class="component-button component-button--h55 component-button--black component-button--full-width">
            Crear cuenta
          </button>

          <button type="button" id="btn-google-register" class="component-button component-button--h55 component-button--full-width">
            ${GOOGLE_ICON_SVG}
            <span>Continuar con Google</span>
          </button>

          <p class="form-footer-text">
            ¿Ya tienes una cuenta? <a href="/login" class="form-link form-link-primary" id="btn-to-login">Iniciar sesión</a>
          </p>
        </div>
      </div>
    </div>
  `;

  // Iniciar sesión / registro con Google
  container.querySelector('#btn-google-register')?.addEventListener('click', () => {
    window.location.href = '/api/auth/google';
  });

  // Toggle visibilidad de contraseña
  const toggleBtn = container.querySelector('#toggle-register-password');
  const passwordInput = container.querySelector('#register-password');
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

  // Navegación logo y link
  container.querySelector('#register-home-link')?.addEventListener('click', (e) => {
    e.preventDefault();
    navigate('/');
  });

  container.querySelector('#btn-to-login')?.addEventListener('click', (e) => {
    e.preventDefault();
    navigate('/login');
  });

  // Procesar Registro
  const usernameInput = container.querySelector('#register-username');
  const emailInput = container.querySelector('#register-email');
  const submitBtn = container.querySelector('#btn-submit-register');
  const errorBanner = container.querySelector('#register-error');

  const executeRegister = async () => {
    errorBanner.style.display = 'none';
    const username = usernameInput.value.trim();
    const email = emailInput.value.trim();
    const password = passwordInput.value;

    if (!username || !email || !password) {
      errorBanner.textContent = 'Por favor completa todos los campos.';
      errorBanner.style.display = 'block';
      return;
    }

    if (username.length < 3) {
      errorBanner.textContent = 'El nombre de usuario debe tener al menos 3 caracteres.';
      errorBanner.style.display = 'block';
      return;
    }

    if (password.length < 6) {
      errorBanner.textContent = 'La contraseña debe tener al menos 6 caracteres.';
      errorBanner.style.display = 'block';
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Creando cuenta...';

    try {
      const res = await postApi('/api/register', { username, email, password });
      const data = await res.json();

      if (!res.ok) {
        errorBanner.textContent = data.error || 'Error al registrar usuario.';
        errorBanner.style.display = 'block';
        return;
      }

      // Al crear la cuenta se inicia sesión automáticamente
      currentUser = data.user;
      navigate('/');
    } catch {
      errorBanner.textContent = 'Error de conexión con el servidor.';
      errorBanner.style.display = 'block';
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Crear cuenta';
    }
  };

  submitBtn?.addEventListener('click', executeRegister);

  // Soporte para tecla Enter
  [usernameInput, emailInput, passwordInput].forEach((input) => {
    input?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        executeRegister();
      }
    });
  });

  return container;
}

// Componente Forgot Password View (Sin etiquetas <form>)
function ForgotPasswordView() {
  const container = document.createElement('div');
  container.className = 'general-content-bottom';
  container.innerHTML = `
    <div class="login-container">
      <a href="/" class="login-header-logo" id="forgot-home-link" aria-label="Ir al inicio" title="Spriteboard">
        <img src="/logo.svg" alt="Spriteboard" class="login-logo-img" />
      </a>

      <div class="login-card">
        <div class="login-header">
          <h1 class="login-title">¿Olvidaste tu contraseña?</h1>
          <p class="login-subtitle">Ingresa tu correo electrónico para enviarte las instrucciones de recuperación</p>
        </div>
        
        <!-- Contenedor sin etiqueta form -->
        <div class="login-form">
          <div class="form-field">
            <input type="email" id="forgot-email" class="form-input" placeholder=" " autocomplete="email" />
            <label for="forgot-email" class="form-label">Correo electrónico</label>
          </div>

          <button type="button" class="component-button component-button--h55 component-button--black component-button--full-width">
            Continuar
          </button>

          <p class="form-footer-text">
            ¿Recordaste tu contraseña? <a href="/login" class="form-link form-link-primary" id="btn-forgot-to-login">Iniciar sesión</a>
          </p>
        </div>
      </div>
    </div>
  `;

  container.querySelector('#forgot-home-link')?.addEventListener('click', (e) => {
    e.preventDefault();
    navigate('/');
  });

  container.querySelector('#btn-forgot-to-login')?.addEventListener('click', (e) => {
    e.preventDefault();
    navigate('/login');
  });

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
  app.replaceChildren();

  if (path === '/login') {
    app.appendChild(LoginView());
  } else if (path === '/register') {
    app.appendChild(RegisterView());
  } else if (path === '/forgot-password') {
    app.appendChild(ForgotPasswordView());
  } else if (path === '/trash') {
    app.appendChild(TopBar());
    app.appendChild(TrashContent());
  } else {
    // Vista Principal
    app.appendChild(TopBar());
    app.appendChild(HomeContent());
  }
}

// Soporte para historial del navegador
window.addEventListener('popstate', render);

// Inicializar al cargar la página
async function init() {
  await Promise.all([fetchCsrfToken(), checkAuthSession(), fetchAppConfig()]);
  render();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
