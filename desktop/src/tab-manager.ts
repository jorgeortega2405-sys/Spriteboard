import { BaseWindow, ipcMain, shell, WebContents, WebContentsView } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { DESKTOP_CONFIG } from './config.js';
import { ensureTabBarHtmlFile } from './tab-bar-template.js';
import { UpdateStatus } from './updater.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface TabItem {
  favicon?: string;
  id: string;
  isLoading: boolean;
  title: string;
  url: string;
  view: WebContentsView;
}

export function isInternalTarget(url: string, targetOrigin: string): boolean {
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

export class TabManager {
  private activeTabId: string | null = null;
  private nextTabId = 1;
  private readonly tabBarHeight = 38;
  private readonly tabBarView: WebContentsView;
  private tabs: TabItem[] = [];
  private readonly targetOrigin: string;
  private readonly window: BaseWindow;

  constructor(window: BaseWindow, targetOrigin: string) {
    this.window = window;
    this.targetOrigin = targetOrigin;

    this.tabBarView = new WebContentsView({
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        preload: path.join(__dirname, 'tab-bar-preload.js'),
        sandbox: false,
      },
    });

    ensureTabBarHtmlFile(__dirname);
    this.tabBarView.webContents.loadFile(path.join(__dirname, 'tab-bar.html'));
    this.window.contentView.addChildView(this.tabBarView);

    this.setupIpcListeners();

    this.window.on('resize', () => {
      this.layout();
    });

    this.tabBarView.webContents.on('did-finish-load', () => {
      this.sendTabsUpdate();
    });
  }

  public async createTab(url: string, activate = true): Promise<string> {
    const tabId = `tab-${this.nextTabId++}`;
    const view = new WebContentsView({
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        preload: path.join(__dirname, 'preload.js'),
        sandbox: false,
      },
    });

    const originalUserAgent = view.webContents.getUserAgent();
    const sanitizedUserAgent = originalUserAgent.replace(/Electron\/[^\s]+\s?/, '');
    view.webContents.setUserAgent(sanitizedUserAgent);

    const tab: TabItem = {
      id: tabId,
      isLoading: true,
      title: 'Cargando...',
      url,
      view,
    };

    this.tabs.push(tab);

    view.webContents.on('page-title-updated', (_event, title) => {
      tab.title = this.cleanTabTitle(title);
      this.sendTabsUpdate();
    });

    view.webContents.on('page-favicon-updated', (_event, favicons) => {
      if (favicons.length > 0) {
        tab.favicon = favicons[0];
        this.sendTabsUpdate();
      }
    });

    view.webContents.on('did-start-loading', () => {
      tab.isLoading = true;
      this.sendTabsUpdate();
    });

    view.webContents.on('did-stop-loading', () => {
      tab.isLoading = false;
      this.sendTabsUpdate();
    });

    view.webContents.setWindowOpenHandler(({ features, frameName, url: openUrl }) => {
      const isAuthPopup = (features && features.includes('width=')) || frameName === 'google_verify_window';
      if (isAuthPopup) {
        return {
          action: 'allow',
          overrideBrowserWindowOptions: {
            autoHideMenuBar: true,
            height: 650,
            width: 500,
          },
        };
      }

      if (isInternalTarget(openUrl, this.targetOrigin)) {
        this.createTab(openUrl, true);
        return { action: 'deny' };
      }

      shell.openExternal(openUrl);
      return { action: 'deny' };
    });

    view.webContents.on('will-navigate', (event, targetUrl) => {
      if (!isInternalTarget(targetUrl, this.targetOrigin)) {
        event.preventDefault();
        shell.openExternal(targetUrl);
      }
    });

    if (activate || this.tabs.length === 1) {
      this.switchTab(tabId);
    } else {
      this.sendTabsUpdate();
    }

    await this.loadUrlWithRetry(view, url);
    return tabId;
  }

  public switchTab(tabId: string): void {
    const targetTab = this.tabs.find((t) => t.id === tabId);
    if (!targetTab) {
      return;
    }

    if (this.activeTabId && this.activeTabId !== tabId) {
      const currentTab = this.tabs.find((t) => t.id === this.activeTabId);
      if (currentTab) {
        currentTab.view.setVisible(false);
        this.window.contentView.removeChildView(currentTab.view);
      }
    }

    this.activeTabId = tabId;
    this.window.contentView.addChildView(targetTab.view);
    targetTab.view.setVisible(true);
    this.layout();
    targetTab.view.webContents.focus();
    this.sendTabsUpdate();
  }

  public closeTab(tabId: string): void {
    const index = this.tabs.findIndex((t) => t.id === tabId);
    if (index === -1) {
      return;
    }

    const tabToClose = this.tabs[index];

    if (this.tabs.length === 1) {
      this.window.close();
      return;
    }

    const wasActive = this.activeTabId === tabId;
    let nextActiveId: string | null = null;

    if (wasActive) {
      const nextIndex = index > 0 ? index - 1 : index + 1;
      nextActiveId = this.tabs[nextIndex].id;
    }

    this.window.contentView.removeChildView(tabToClose.view);
    if (!tabToClose.view.webContents.isDestroyed()) {
      tabToClose.view.webContents.close();
    }

    this.tabs.splice(index, 1);

    if (wasActive && nextActiveId) {
      this.switchTab(nextActiveId);
    } else {
      this.sendTabsUpdate();
    }
  }

  public closeActiveTab(): void {
    if (this.activeTabId) {
      this.closeTab(this.activeTabId);
    }
  }

  public nextTab(): void {
    if (this.tabs.length <= 1 || !this.activeTabId) {
      return;
    }
    const currentIndex = this.tabs.findIndex((t) => t.id === this.activeTabId);
    const nextIndex = (currentIndex + 1) % this.tabs.length;
    this.switchTab(this.tabs[nextIndex].id);
  }

  public previousTab(): void {
    if (this.tabs.length <= 1 || !this.activeTabId) {
      return;
    }
    const currentIndex = this.tabs.findIndex((t) => t.id === this.activeTabId);
    const prevIndex = (currentIndex - 1 + this.tabs.length) % this.tabs.length;
    this.switchTab(this.tabs[prevIndex].id);
  }

  public switchToIndex(index: number): void {
    if (index >= 0 && index < this.tabs.length) {
      this.switchTab(this.tabs[index].id);
    }
  }

  public getActiveWebContents(): WebContents | null {
    const activeTab = this.tabs.find((t) => t.id === this.activeTabId);
    return activeTab ? activeTab.view.webContents : null;
  }

  public reloadActiveTab(ignoreCache = false): void {
    const wc = this.getActiveWebContents();
    if (!wc) return;
    if (ignoreCache) {
      wc.reloadIgnoringCache();
    } else {
      wc.reload();
    }
  }

  public layout(): void {
    const [width, height] = this.window.getContentSize();
    this.tabBarView.setBounds({
      height: this.tabBarHeight,
      width,
      x: 0,
      y: 0,
    });

    const activeTab = this.tabs.find((t) => t.id === this.activeTabId);
    if (activeTab) {
      activeTab.view.setBounds({
        height: Math.max(0, height - this.tabBarHeight),
        width,
        x: 0,
        y: this.tabBarHeight,
      });
    }
  }

  public sendUpdateStatus(status: UpdateStatus): void {
    if (!this.tabBarView.webContents.isDestroyed()) {
      this.tabBarView.webContents.send('app-updater:status', status);
    }
  }

  private cleanTabTitle(title: string): string {
    if (!title) return 'Spriteboard';
    return title.replace(/\s*-\s*Spriteboard\s*$/i, '').trim() || 'Spriteboard';
  }

  private sendTabsUpdate(): void {
    if (this.tabBarView.webContents.isDestroyed()) {
      return;
    }
    const safeTabs = this.tabs.map((t) => ({
      favicon: t.favicon,
      id: t.id,
      isLoading: t.isLoading,
      title: t.title,
      url: t.url,
    }));
    this.tabBarView.webContents.send('tabs-updated', safeTabs, this.activeTabId);
  }

  private setupIpcListeners(): void {
    ipcMain.on('tab-bar:switch-tab', (_event, tabId: string) => {
      this.switchTab(tabId);
    });

    ipcMain.on('tab-bar:close-tab', (_event, tabId: string) => {
      this.closeTab(tabId);
    });

    ipcMain.on('tab-bar:new-tab', () => {
      const homeUrl = new URL('/', this.targetOrigin).toString();
      this.createTab(homeUrl, true);
    });

    ipcMain.on('tab-bar:reload-tab', (_event, tabId: string) => {
      const tab = this.tabs.find((t) => t.id === tabId);
      tab?.view.webContents.reload();
    });
  }

  private async loadUrlWithRetry(view: WebContentsView, url: string, retries = 15, delay = 1000): Promise<void> {
    for (let i = 0; i < retries; i++) {
      try {
        await view.webContents.loadURL(url);
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
                  <button type="button" onclick="location.reload()">Reintentar conexión</button>
                </div>
              </body>
            </html>
          `;
          view.webContents.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(errorHtml)}`);
        }
      }
    }
  }
}
