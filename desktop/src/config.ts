import path from 'path';

export const DESKTOP_CONFIG = {
  appName: 'Spriteboard',
  defaultPort: 3000,
  adminPort: 3002,
  devUrl: 'http://localhost:3000',
  defaultWidth: 1440,
  defaultHeight: 900,
  minWidth: 1024,
  minHeight: 700,
  isDev: process.env.NODE_ENV === 'development' || !process.env.NODE_ENV,
};

export function getAppTargetUrl(): string {
  const envUrl = process.env.SPRITEBOARD_APP_URL || process.env.APP_URL;
  if (envUrl) {
    return envUrl;
  }
  return DESKTOP_CONFIG.isDev ? DESKTOP_CONFIG.devUrl : 'http://localhost:3000';
}
