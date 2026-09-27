import { dialog, ipcMain } from 'electron';
import pkg, { type ProgressInfo, type UpdateInfo } from 'electron-updater';
import { DESKTOP_CONFIG } from './config.js';

const { autoUpdater } = pkg;

export interface UpdateStatus {
  available: boolean;
  downloaded: boolean;
  error?: string;
  isChecking: boolean;
  isDownloading: boolean;
  percent?: number;
  version?: string;
}

export class AppUpdater {
  private isCheckingManual = false;
  private readonly onStatusChange: (status: UpdateStatus) => void;
  private status: UpdateStatus = {
    available: false,
    downloaded: false,
    isChecking: false,
    isDownloading: false,
  };

  constructor(onStatusChange: (status: UpdateStatus) => void) {
    this.onStatusChange = onStatusChange;
    this.configureUpdater();
    this.setupIpc();
  }

  public async checkForUpdates(manual = false): Promise<void> {
    this.isCheckingManual = manual;
    this.status.isChecking = true;
    this.notify();

    if (DESKTOP_CONFIG.isDev) {
      setTimeout(() => {
        this.status.isChecking = false;
        this.notify();
        if (manual) {
          dialog.showMessageBox({
            buttons: ['Aceptar'],
            message: 'Estás en modo desarrollo. Las actualizaciones automáticas se descargan e instalan en la versión empaquetada (v1.0.0).',
            title: 'Spriteboard Actualizaciones',
            type: 'info',
          });
        }
      }, 800);
      return;
    }

    try {
      await autoUpdater.checkForUpdates();
    } catch (err: unknown) {
      this.status.isChecking = false;
      this.status.error = err instanceof Error ? err.message : 'Error desconocido';
      this.notify();
      if (manual) {
        dialog.showMessageBox({
          buttons: ['Aceptar'],
          message: 'No se pudo comprobar la existencia de actualizaciones. Por favor verifica tu conexión a internet.',
          title: 'Spriteboard Actualizaciones',
          type: 'warning',
        });
      }
    }
  }

  public quitAndInstall(): void {
    autoUpdater.quitAndInstall();
  }

  private configureUpdater(): void {
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;

    autoUpdater.on('checking-for-update', () => {
      this.status.isChecking = true;
      this.notify();
    });

    autoUpdater.on('update-available', (info: UpdateInfo) => {
      this.status.available = true;
      this.status.isChecking = false;
      this.status.isDownloading = true;
      this.status.version = info.version;
      this.notify();
    });

    autoUpdater.on('update-not-available', () => {
      this.status.available = false;
      this.status.isChecking = false;
      this.status.isDownloading = false;
      this.notify();
      if (this.isCheckingManual) {
        dialog.showMessageBox({
          buttons: ['Aceptar'],
          message: 'Spriteboard está actualizado a la última versión disponible.',
          title: 'Spriteboard Actualizaciones',
          type: 'info',
        });
        this.isCheckingManual = false;
      }
    });

    autoUpdater.on('download-progress', (progressObj: ProgressInfo) => {
      this.status.isDownloading = true;
      this.status.percent = Math.round(progressObj.percent);
      this.notify();
    });

    autoUpdater.on('update-downloaded', (info: UpdateInfo) => {
      this.status.available = true;
      this.status.downloaded = true;
      this.status.isDownloading = false;
      this.status.percent = 100;
      this.status.version = info.version;
      this.notify();
    });

    autoUpdater.on('error', (err: Error) => {
      this.status.error = err.message;
      this.status.isChecking = false;
      this.status.isDownloading = false;
      this.notify();
    });
  }

  private notify(): void {
    this.onStatusChange({ ...this.status });
  }

  private setupIpc(): void {
    ipcMain.on('app-updater:check', () => {
      this.checkForUpdates(true);
    });

    ipcMain.on('app-updater:install', () => {
      this.quitAndInstall();
    });
  }
}
