import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('spriteDesktop', {
  isDesktop: true,
  platform: process.platform,
  onUpdateAvailable: (callback: (info: unknown) => void) => {
    ipcRenderer.on('app-update-available', (_event, value) => callback(value));
  },
});
