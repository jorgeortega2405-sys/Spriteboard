import { app, BaseWindow, Menu, MenuItemConstructorOptions, shell } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { DESKTOP_CONFIG, getAppTargetUrl } from './config.js';
import { TabManager } from './tab-manager.js';
import { AppUpdater } from './updater.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let appUpdater: AppUpdater | null = null;
let mainWindow: BaseWindow | null = null;
let tabManager: TabManager | null = null;

if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient('spriteboard', process.execPath, [path.resolve(process.argv[1])]);
  }
} else {
  app.setAsDefaultProtocolClient('spriteboard');
}

const gotTheLock = DESKTOP_CONFIG.isDev ? true : app.requestSingleInstanceLock();
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
      if (deepLink && tabManager) {
        try {
          const urlObj = new URL(deepLink);
          const relativePath = urlObj.searchParams.get('path');
          if (relativePath) {
            const targetUrl = new URL(relativePath, getAppTargetUrl()).toString();
            tabManager.createTab(targetUrl, true);
          }
        } catch {}
      }
    }
  });

  app.whenReady().then(createMainWindow);
}

function buildMenu(targetOrigin: string): Menu {
  const isMac = process.platform === 'darwin';
  const template: MenuItemConstructorOptions[] = [
    ...(isMac ? [{ role: 'appMenu' as const }] : []),
    {
      label: 'Archivo',
      submenu: [
        {
          accelerator: 'CmdOrCtrl+T',
          click: () => {
            const homeUrl = new URL('/', targetOrigin).toString();
            tabManager?.createTab(homeUrl, true);
          },
          label: 'Nueva pestaña',
        },
        {
          accelerator: 'CmdOrCtrl+W',
          click: () => {
            tabManager?.closeActiveTab();
          },
          label: 'Cerrar pestaña',
        },
        { type: 'separator' },
        {
          accelerator: 'CmdOrCtrl+R',
          click: () => tabManager?.reloadActiveTab(false),
          label: 'Recargar',
        },
        {
          accelerator: 'CmdOrCtrl+Shift+R',
          click: () => tabManager?.reloadActiveTab(true),
          label: 'Forzar recarga',
        },
        { type: 'separator' },
        isMac ? { role: 'close' as const } : { label: 'Salir', role: 'quit' as const },
      ],
    },
    {
      label: 'Edición',
      submenu: [
        { label: 'Deshacer', role: 'undo' as const },
        { label: 'Rehacer', role: 'redo' as const },
        { type: 'separator' },
        { label: 'Cortar', role: 'cut' as const },
        { label: 'Copiar', role: 'copy' as const },
        { label: 'Pegar', role: 'paste' as const },
        { label: 'Seleccionar todo', role: 'selectAll' as const },
      ],
    },
    {
      label: 'Ver',
      submenu: [
        {
          accelerator: 'CmdOrCtrl+Tab',
          click: () => tabManager?.nextTab(),
          label: 'Siguiente pestaña',
        },
        {
          accelerator: 'CmdOrCtrl+Shift+Tab',
          click: () => tabManager?.previousTab(),
          label: 'Pestaña anterior',
        },
        { type: 'separator' },
        { label: 'Tamaño original', role: 'resetZoom' as const },
        { label: 'Acercar', role: 'zoomIn' as const },
        { label: 'Alejar', role: 'zoomOut' as const },
        { type: 'separator' },
        { label: 'Pantalla completa', role: 'togglefullscreen' as const },
        ...(DESKTOP_CONFIG.isDev
          ? [
              { type: 'separator' as const },
              {
                click: () => {
                  const wc = tabManager?.getActiveWebContents();
                  if (wc) {
                    if (wc.isDevToolsOpened()) {
                      wc.closeDevTools();
                    } else {
                      wc.openDevTools();
                    }
                  }
                },
                label: 'Herramientas de desarrollador',
              },
            ]
          : []),
      ],
    },
    {
      label: 'Pestañas',
      submenu: [
        {
          accelerator: 'CmdOrCtrl+1',
          click: () => tabManager?.switchToIndex(0),
          label: 'Ir a pestaña 1',
        },
        {
          accelerator: 'CmdOrCtrl+2',
          click: () => tabManager?.switchToIndex(1),
          label: 'Ir a pestaña 2',
        },
        {
          accelerator: 'CmdOrCtrl+3',
          click: () => tabManager?.switchToIndex(2),
          label: 'Ir a pestaña 3',
        },
        {
          accelerator: 'CmdOrCtrl+4',
          click: () => tabManager?.switchToIndex(3),
          label: 'Ir a pestaña 4',
        },
        {
          accelerator: 'CmdOrCtrl+5',
          click: () => tabManager?.switchToIndex(4),
          label: 'Ir a pestaña 5',
        },
        {
          accelerator: 'CmdOrCtrl+6',
          click: () => tabManager?.switchToIndex(5),
          label: 'Ir a pestaña 6',
        },
        {
          accelerator: 'CmdOrCtrl+7',
          click: () => tabManager?.switchToIndex(6),
          label: 'Ir a pestaña 7',
        },
        {
          accelerator: 'CmdOrCtrl+8',
          click: () => tabManager?.switchToIndex(7),
          label: 'Ir a pestaña 8',
        },
        {
          accelerator: 'CmdOrCtrl+9',
          click: () => tabManager?.switchToIndex(8),
          label: 'Ir a pestaña 9',
        },
      ],
    },
    {
      label: 'Ayuda',
      submenu: [
        {
          click: () => {
            appUpdater?.checkForUpdates(true);
          },
          label: 'Buscar actualizaciones...',
        },
        { type: 'separator' },
        {
          click: () => {
            shell.openExternal('https://github.com/jorgeortega2405-sys/Spriteboard');
          },
          label: 'Documentación y Soporte',
        },
      ],
    },
  ];

  return Menu.buildFromTemplate(template);
}

async function createMainWindow(): Promise<void> {
  const targetUrl = getAppTargetUrl();
  const targetOrigin = new URL(targetUrl).origin;

  mainWindow = new BaseWindow({
    backgroundColor: '#0e0e10',
    height: DESKTOP_CONFIG.defaultHeight,
    minHeight: DESKTOP_CONFIG.minHeight,
    minWidth: DESKTOP_CONFIG.minWidth,
    show: false,
    title: 'Spriteboard',
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#0e0e10',
      height: 38,
      symbolColor: '#e4e4e7',
    },
    width: DESKTOP_CONFIG.defaultWidth,
  });

  mainWindow.setAutoHideMenuBar(true);
  mainWindow.setMenuBarVisibility(false);

  Menu.setApplicationMenu(buildMenu(targetOrigin));

  tabManager = new TabManager(mainWindow, targetOrigin);

  appUpdater = new AppUpdater((status) => {
    tabManager?.sendUpdateStatus(status);
  });

  mainWindow.on('closed', () => {
    appUpdater = null;
    tabManager = null;
    mainWindow = null;
  });

  await tabManager.createTab(targetUrl, true);
  mainWindow.show();

  setTimeout(() => {
    appUpdater?.checkForUpdates(false);
  }, 3000);
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BaseWindow.getAllWindows().length === 0) {
    createMainWindow();
  }
});
