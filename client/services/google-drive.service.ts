import { escapeHtml } from './api.service.js';
import { showToast } from './toast.service.js';

export const GOOGLE_DRIVE_API_KEY = 'AIzaSyCCiGzBMk3HTKozEDevKYJgYH5t04oRH44';
export const GOOGLE_DRIVE_CLIENT_ID = '899980904040-n9foado9rou3etjr8d5ouikpa1ivaml2.apps.googleusercontent.com';
export const GOOGLE_DRIVE_SCOPES = 'https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email';

const STORAGE_KEY_TOKEN = 'sb_gdrive_token';
const STORAGE_KEY_EXPIRES = 'sb_gdrive_expires_at';
const STORAGE_KEY_USER = 'sb_gdrive_user';

declare const google: any;
declare const gapi: any;

export interface GoogleDriveFile {
  iconLink?: string;
  id: string;
  isDoc: boolean;
  isFolder: boolean;
  isImage: boolean;
  isPdf: boolean;
  mimeType: string;
  modifiedTime?: string;
  name: string;
  parents?: string[];
  size?: number;
  thumbnailLink?: string;
  webContentLink?: string;
  webViewLink?: string;
}

export interface GoogleDriveUser {
  displayName: string;
  emailAddress: string;
  photoLink?: string;
}

export interface GoogleDriveListResponse {
  files: GoogleDriveFile[];
  nextPageToken?: string;
}

let gisScriptLoading: Promise<void> | null = null;
let gapiScriptLoading: Promise<void> | null = null;
let tokenClientInstance: any = null;

export function loadGisScript(): Promise<void> {
  if (typeof google !== 'undefined' && google?.accounts?.oauth2) {
    return Promise.resolve();
  }
  if (gisScriptLoading) {
    return gisScriptLoading;
  }
  gisScriptLoading = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector('script[src="https://accounts.google.com/gsi/client"]');
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('No se pudo cargar Google Identity Services')));
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('No se pudo cargar Google Identity Services'));
    document.head.appendChild(script);
  });
  return gisScriptLoading;
}

export function loadGapiScript(): Promise<void> {
  if (typeof gapi !== 'undefined' && gapi?.load) {
    return Promise.resolve();
  }
  if (gapiScriptLoading) {
    return gapiScriptLoading;
  }
  gapiScriptLoading = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector('script[src="https://apis.google.com/js/api.js"]');
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('No se pudo cargar Google API Client')));
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://apis.google.com/js/api.js';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('No se pudo cargar Google API Client'));
    document.head.appendChild(script);
  });
  return gapiScriptLoading;
}

export function getGoogleDriveToken(): string | null {
  try {
    const expiresAt = sessionStorage.getItem(STORAGE_KEY_EXPIRES);
    if (!expiresAt || Date.now() > Number(expiresAt)) {
      disconnectGoogleDrive();
      return null;
    }
    return sessionStorage.getItem(STORAGE_KEY_TOKEN);
  } catch {
    return null;
  }
}

export function isGoogleDriveConnected(): boolean {
  return Boolean(getGoogleDriveToken());
}

export function getGoogleDriveUser(): GoogleDriveUser | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY_USER);
    return raw ? (JSON.parse(raw) as GoogleDriveUser) : null;
  } catch {
    return null;
  }
}

export function disconnectGoogleDrive(): void {
  const token = sessionStorage.getItem(STORAGE_KEY_TOKEN);
  if (token && typeof google !== 'undefined' && google?.accounts?.oauth2?.revoke) {
    try {
      google.accounts.oauth2.revoke(token, () => {});
    } catch {}
  }
  sessionStorage.removeItem(STORAGE_KEY_TOKEN);
  sessionStorage.removeItem(STORAGE_KEY_EXPIRES);
  sessionStorage.removeItem(STORAGE_KEY_USER);
}

export async function fetchGoogleDriveUserProfile(token: string): Promise<GoogleDriveUser | null> {
  try {
    const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const user: GoogleDriveUser = {
      displayName: data.name || data.given_name || 'Usuario de Google',
      emailAddress: data.email || '',
      photoLink: data.picture || '',
    };
    sessionStorage.setItem(STORAGE_KEY_USER, JSON.stringify(user));
    return user;
  } catch {
    return null;
  }
}

export async function connectGoogleDrive(): Promise<{ success: boolean; error?: string; user?: GoogleDriveUser | null }> {
  try {
    await loadGisScript();
  } catch {
    return { error: 'No se pudo cargar el cliente de autenticación de Google.', success: false };
  }

  return new Promise((resolve) => {
    try {
      tokenClientInstance = google.accounts.oauth2.initTokenClient({
        callback: async (response: any) => {
          if (response.error) {
            resolve({ error: 'Autorización cancelada o denegada.', success: false });
            return;
          }
          if (!response.access_token) {
            resolve({ error: 'No se recibió el token de acceso de Google.', success: false });
            return;
          }

          const expiresInSec = Number(response.expires_in) || 3500;
          const expiresAt = Date.now() + (expiresInSec - 60) * 1000;

          sessionStorage.setItem(STORAGE_KEY_TOKEN, response.access_token);
          sessionStorage.setItem(STORAGE_KEY_EXPIRES, String(expiresAt));

          const user = await fetchGoogleDriveUserProfile(response.access_token);
          resolve({ success: true, user });
        },
        client_id: GOOGLE_DRIVE_CLIENT_ID,
        error_callback: (err: any) => {
          resolve({ error: err?.message || 'Error en la autenticación con Google.', success: false });
        },
        prompt: 'consent',
        scope: GOOGLE_DRIVE_SCOPES,
      });

      tokenClientInstance.requestAccessToken();
    } catch {
      resolve({ error: 'Error al iniciar la sesión con Google.', success: false });
    }
  });
}

export function formatFileSize(bytes?: number): string {
  if (!bytes || bytes <= 0) return '';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  let val = bytes;
  while (val >= 1024 && i < units.length - 1) {
    val /= 1024;
    i++;
  }
  return `${val.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export function transformDriveFile(item: any): GoogleDriveFile {
  const mimeType = item.mimeType || '';
  const isFolder = mimeType === 'application/vnd.google-apps.folder';
  const isImage = mimeType.startsWith('image/');
  const isPdf = mimeType === 'application/pdf';
  const isDoc =
    mimeType.includes('document') ||
    mimeType.includes('presentation') ||
    mimeType.includes('spreadsheet') ||
    mimeType.includes('application/vnd.google-apps') ||
    mimeType.includes('text/') ||
    isPdf;

  return {
    iconLink: item.iconLink,
    id: item.id,
    isDoc,
    isFolder,
    isImage,
    isPdf,
    mimeType,
    modifiedTime: item.modifiedTime,
    name: item.name || 'Archivo sin nombre',
    parents: item.parents || [],
    size: item.size ? Number(item.size) : undefined,
    thumbnailLink: item.thumbnailLink,
    webContentLink: item.webContentLink,
    webViewLink: item.webViewLink,
  };
}

export async function listGoogleDriveFiles(options: {
  filterType?: 'all' | 'documents' | 'folders' | 'images';
  folderId?: string;
  pageSize?: number;
  pageToken?: string;
  query?: string;
} = {}): Promise<GoogleDriveListResponse> {
  const token = getGoogleDriveToken();
  if (!token) {
    throw new Error('No hay sesión activa en Google Drive.');
  }

  const clauses: string[] = ['trashed = false'];

  const cleanQ = (options.query || '').trim().replace(/'/g, "\\'");
  if (cleanQ) {
    clauses.push(`name contains '${cleanQ}'`);
  } else {
    const parentId = options.folderId || 'root';
    clauses.push(`'${parentId}' in parents`);
  }

  if (options.filterType === 'folders') {
    clauses.push("mimeType = 'application/vnd.google-apps.folder'");
  } else if (options.filterType === 'images') {
    clauses.push("mimeType contains 'image/'");
  } else if (options.filterType === 'documents') {
    clauses.push("(mimeType contains 'application/vnd.google-apps' or mimeType = 'application/pdf' or mimeType contains 'text/' or mimeType contains 'presentation' or mimeType contains 'document' or mimeType contains 'spreadsheet') and mimeType != 'application/vnd.google-apps.folder'");
  }

  const q = clauses.join(' and ');
  const fields = 'nextPageToken, files(id, name, mimeType, iconLink, thumbnailLink, webViewLink, webContentLink, size, modifiedTime, parents)';
  const pageSize = options.pageSize || 40;

  const url = new URL('https://www.googleapis.com/drive/v3/files');
  url.searchParams.set('q', q);
  url.searchParams.set('fields', fields);
  url.searchParams.set('pageSize', String(pageSize));
  url.searchParams.set('orderBy', 'folder,modifiedTime desc,name');
  url.searchParams.set('key', GOOGLE_DRIVE_API_KEY);
  if (options.pageToken) {
    url.searchParams.set('pageToken', options.pageToken);
  }

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    if (res.status === 401) {
      disconnectGoogleDrive();
      throw new Error('La sesión de Google Drive ha expirado. Conéctate de nuevo.');
    }
    const errText = await res.text();
    throw new Error(`Error al consultar Google Drive (${res.status}): ${errText}`);
  }

  const data = await res.json();
  const rawFiles = Array.isArray(data.files) ? data.files : [];
  return {
    files: rawFiles.map(transformDriveFile),
    nextPageToken: data.nextPageToken,
  };
}

export async function fetchGoogleDriveFileBlob(fileId: string): Promise<{ blob: Blob; dataUrl: string; mimeType: string }> {
  const token = getGoogleDriveToken();
  if (!token) {
    throw new Error('No hay sesión activa en Google Drive.');
  }

  const metaUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?fields=id,name,mimeType&key=${GOOGLE_DRIVE_API_KEY}`;
  const metaRes = await fetch(metaUrl, {
    headers: { Authorization: `Bearer ${token}` },
  });
  let mimeType = 'image/png';
  if (metaRes.ok) {
    const metaData = await metaRes.json();
    if (metaData.mimeType) mimeType = metaData.mimeType;
  }

  const downloadUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&key=${GOOGLE_DRIVE_API_KEY}`;
  const res = await fetch(downloadUrl, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    throw new Error('No se pudo descargar el archivo desde Google Drive.');
  }

  const blob = await res.blob();
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Error al procesar el archivo.'));
    reader.readAsDataURL(blob);
  });

  return { blob, dataUrl, mimeType };
}

export async function uploadCanvasExportToDrive(
  blob: Blob,
  filename: string,
  folderId?: string
): Promise<GoogleDriveFile> {
  const token = getGoogleDriveToken();
  if (!token) {
    throw new Error('No hay sesión activa en Google Drive.');
  }

  const metadata: any = {
    name: filename,
  };
  if (folderId && folderId !== 'root') {
    metadata.parents = [folderId];
  }

  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  form.append('file', blob);

  const url = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,webViewLink,thumbnailLink';
  const res = await fetch(url, {
    body: form,
    headers: {
      Authorization: `Bearer ${token}`,
    },
    method: 'POST',
  });

  if (!res.ok) {
    throw new Error('No se pudo guardar el archivo en Google Drive.');
  }

  const data = await res.json();
  return transformDriveFile(data);
}

export async function openGooglePicker(onSelect: (file: GoogleDriveFile) => void): Promise<void> {
  const token = getGoogleDriveToken();
  if (!token) {
    showToast('Debes conectar tu cuenta de Google Drive primero', 'warning');
    return;
  }

  try {
    await loadGapiScript();
  } catch {
    showToast('No se pudo cargar el selector de Google', 'danger');
    return;
  }

  return new Promise((resolve) => {
    gapi.load('picker', () => {
      try {
        const viewAll = new google.picker.DocsView(google.picker.ViewId.DOCS).setIncludeFolders(true);
        const viewImages = new google.picker.DocsView(google.picker.ViewId.DOCS_IMAGES);

        const picker = new google.picker.PickerBuilder()
          .addView(viewAll)
          .addView(viewImages)
          .setOAuthToken(token)
          .setDeveloperKey(GOOGLE_DRIVE_API_KEY)
          .setCallback((data: any) => {
            if (data.action === google.picker.Action.PICKED) {
              const doc = data.docs?.[0];
              if (doc) {
                const picked: GoogleDriveFile = transformDriveFile({
                  iconLink: doc.iconUrl,
                  id: doc.id,
                  mimeType: doc.mimeType,
                  name: doc.name,
                  size: doc.sizeBytes,
                  thumbnailLink: doc.thumbnails?.[0]?.url,
                  webViewLink: doc.url,
                });
                onSelect(picked);
              }
              resolve();
            } else if (data.action === google.picker.Action.CANCEL) {
              resolve();
            }
          })
          .build();

        picker.setVisible(true);
      } catch {
        showToast('Error al abrir el selector de Google Picker', 'danger');
        resolve();
      }
    });
  });
}
