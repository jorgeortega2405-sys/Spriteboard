import { app, BrowserWindow, Menu, MenuItemConstructorOptions, shell } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { DESKTOP_CONFIG, getAppTargetUrl } from './config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow: BrowserWindow | null = null;

if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient('spriteboard', process.execPath, [path.resolve(process.argv[1])]);
  }
} else {
  app.setAsDefaultProtocolClient('spriteboard');
}

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (_event, commandLine) => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) {
        mainWindow.restore();
      }
      mainWindow.focus();

      const deepLink = commandLine.find((arg) => arg.startsWith('spriteboard://'));
      if (deepLink) {
        try {
          const urlObj = new URL(deepLink);
          const relativePath = urlObj.searchParams.get('path');
          if (relativePath) {
            const targetUrl = new URL(relativePath, getAppTargetUrl()).toString();
            mainWindow.loadURL(targetUrl);
          }
        } catch {}
      }
    }
  });

  app.whenReady().then(createMainWindow);
}

function buildMenu(): Menu {
  const isMac = process.platform === 'darwin';
  const template: MenuItemConstructorOptions[] = [
    ...(isMac ? [{ role: 'appMenu' as const }] : []),
    {
      label: 'Archivo',
      submenu: [
        {
          label: 'Recargar',
          accelerator: 'CmdOrCtrl+R',
          click: () => mainWindow?.reload(),
        },
        {
          label: 'Forzar recarga',
          accelerator: 'CmdOrCtrl+Shift+R',
          click: () => mainWindow?.webContents.reloadIgnoringCache(),
        },
        { type: 'separator' },
        isMac ? { role: 'close' as const } : { role: 'quit' as const, label: 'Salir' },
      ],
    },
    {
      label: 'Edición',
      submenu: [
        { role: 'undo' as const, label: 'Deshacer' },
        { role: 'redo' as const, label: 'Rehacer' },
        { type: 'separator' },
        { role: 'cut' as const, label: 'Cortar' },
        { role: 'copy' as const, label: 'Copiar' },
        { role: 'paste' as const, label: 'Pegar' },
        { role: 'selectAll' as const, label: 'Seleccionar todo' },
      ],
    },
    {
      label: 'Ver',
      submenu: [
        { role: 'resetZoom' as const, label: 'Tamaño original' },
        { role: 'zoomIn' as const, label: 'Acercar' },
        { role: 'zoomOut' as const, label: 'Alejar' },
        { type: 'separator' },
        { role: 'togglefullscreen' as const, label: 'Pantalla completa' },
        ...(DESKTOP_CONFIG.isDev
          ? [
              { type: 'separator' as const },
              { role: 'toggleDevTools' as const, label: 'Herramientas de desarrollador' },
            ]
          : []),
      ],
    },
    {
      label: 'Ayuda',
      submenu: [
        {
          label: 'Documentación y Soporte',
          click: () => {
            shell.openExternal('https://github.com');
          },
        },
      ],
    },
  ];

  return Menu.buildFromTemplate(template);
}

function isInternalTarget(url: string, targetOrigin: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.port === String(DESKTOP_CONFIG.adminPort)) {
      return false;
    }
    return parsed.origin === targetOrigin;
  } catch {
    return false;
  }
}

async function loadAppWithRetry(window: BrowserWindow, url: string, retries = 15, delay = 1000): Promise<void> {
  for (let i = 0; i < retries; i++) {
    try {
      await window.loadURL(url);
      return;
    } catch {
      if (i < retries - 1) {
        await new Promise((resolve) => setTimeout(resolve, delay));
      } else {
        const errorHtml = `
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="utf-8">
              <title>Spriteboard Desktop</title>
              <style>
                body {
                  margin: 0;
                  display: flex;
                  flex-direction: column;
                  align-items: center;
                  justify-content: center;
                  height: 100vh;
                  background-color: #0e0e10;
                  color: #e4e4e7;
                  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                }
                .card {
                  max-width: 480px;
                  text-align: center;
                  padding: 32px;
                  background: #18181b;
                  border: 1px solid #27272a;
                  border-radius: 12px;
                  box-shadow: 0 8px 24px rgba(0,0,0,0.5);
                }
                h2 { margin: 0 0 12px; font-size: 20px; font-weight: 600; }
                p { margin: 0 0 24px; font-size: 14px; color: #a1a1aa; line-height: 1.5; }
                code { background: #27272a; padding: 2px 6px; border-radius: 4px; font-size: 13px; }
                button {
                  background: #3b82f6;
                  color: #fff;
                  border: none;
                  padding: 10px 24px;
                  border-radius: 6px;
                  font-weight: 500;
                  font-size: 14px;
                  cursor: pointer;
                  transition: background 0.2s;
                }
                button:hover { background: #2563eb; }
              </style>
            </head>
            <body>
              <div class="card">
                <h2>No se pudo conectar a Spriteboard (:3000)</h2>
                <p>Verifica que el servidor local esté ejecutándose con <code>npm run dev</code> o que tu conexión esté disponible.</p>
                <button onclick="location.reload()">Reintentar conexión</button>
              </div>
            </body>
          </html>
        `;
        window.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(errorHtml)}`);
      }
    }
  }
}

async function createMainWindow(): Promise<void> {
  const targetUrl = getAppTargetUrl();
  const targetOrigin = new URL(targetUrl).origin;

  mainWindow = new BrowserWindow({
    width: DESKTOP_CONFIG.defaultWidth,
    height: DESKTOP_CONFIG.defaultHeight,
    minWidth: DESKTOP_CONFIG.minWidth,
    minHeight: DESKTOP_CONFIG.minHeight,
    show: false,
    backgroundColor: '#0e0e10',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  Menu.setApplicationMenu(buildMenu());

  const originalUserAgent = mainWindow.webContents.getUserAgent();
  const sanitizedUserAgent = originalUserAgent.replace(/Electron\/[^\s]+\s?/, '');
  mainWindow.webContents.setUserAgent(sanitizedUserAgent);

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (!isInternalTarget(url, targetOrigin)) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!isInternalTarget(url, targetOrigin)) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  await loadAppWithRetry(mainWindow, targetUrl);
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createMainWindow();
  }
});
