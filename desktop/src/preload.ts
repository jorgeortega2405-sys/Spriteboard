import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('spriteDesktop', {
  checkForUpdates: (manual = true) => ipcRenderer.send('app-updater:check', manual),
  clipboard: {
    readImage: () => ipcRenderer.invoke('clipboard-read-image'),
    readText: () => ipcRenderer.invoke('clipboard-read-text'),
    writeText: (text: string) => ipcRenderer.invoke('clipboard-write-text', text),
  },
  getVersion: () => ipcRenderer.invoke('get-app-version'),
  isDesktop: true,
  onUpdateAvailable: (callback: (info: unknown) => void) => {
    ipcRenderer.on('app-update-available', (_event, value) => callback(value));
  },
  openExternal: (url: string) => ipcRenderer.invoke('open-external-url', url),
  platform: process.platform,
  saveFile: (options: { dataBase64: string; defaultPath?: string; filters?: { extensions: string[]; name: string }[] }) =>
    ipcRenderer.invoke('save-file-dialog', options),
});
