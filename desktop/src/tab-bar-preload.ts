import { contextBridge, ipcRenderer } from 'electron';

export interface TabData {
  favicon?: string;
  id: string;
  isLoading: boolean;
  title: string;
  url: string;
}

contextBridge.exposeInMainWorld('tabBarApi', {
  checkForUpdates: (): void => {
    ipcRenderer.send('app-updater:check');
  },
  closeTab: (tabId: string): void => {
    ipcRenderer.send('tab-bar:close-tab', tabId);
  },
  installUpdate: (): void => {
    ipcRenderer.send('app-updater:install');
  },
  newTab: (): void => {
    ipcRenderer.send('tab-bar:new-tab');
  },
  onUpdateStatus: (callback: (status: unknown) => void): void => {
    ipcRenderer.on('app-updater:status', (_event, status) => callback(status));
  },
  onUpdateTabs: (callback: (tabs: TabData[], activeTabId: string) => void): void => {
    ipcRenderer.on('tabs-updated', (_event, tabs: TabData[], activeTabId: string) => callback(tabs, activeTabId));
  },
  reloadTab: (tabId: string): void => {
    ipcRenderer.send('tab-bar:reload-tab', tabId);
  },
  switchTab: (tabId: string): void => {
    ipcRenderer.send('tab-bar:switch-tab', tabId);
  },
});
