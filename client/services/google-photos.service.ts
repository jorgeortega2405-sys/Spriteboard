import { escapeHtml } from './api.service.js';
import { showToast } from './toast.service.js';

export const GOOGLE_PHOTOS_API_KEY = (import.meta as any).env?.VITE_GOOGLE_API_KEY || (import.meta as any).env?.VITE_GOOGLE_PHOTOS_API_KEY || 'AIzaSyBFsBn3Hi6CLH904UXGgOHP-rXORvs1-Us';
export const GOOGLE_PHOTOS_CLIENT_ID = (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID || '899980904040-n9foado9rou3etjr8d5ouikpa1ivaml2.apps.googleusercontent.com';
export const GOOGLE_PHOTOS_SCOPES = 'https://www.googleapis.com/auth/photoslibrary.readonly https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email';

const STORAGE_KEY_TOKEN = 'sb_gphotos_token';
const STORAGE_KEY_EXPIRES = 'sb_gphotos_expires_at';
const STORAGE_KEY_USER = 'sb_gphotos_user';

declare const google: any;
declare const gapi: any;

export interface GooglePhotoItem {
  baseUrl: string;
  description?: string;
  filename: string;
  height?: number;
  id: string;
  mimeType?: string;
  thumbnailUrl: string;
  width?: number;
}

export interface GooglePhotoAlbum {
  coverPhotoBaseUrl?: string;
  id: string;
  mediaItemsCount?: number;
  title: string;
}

export interface GooglePhotosUser {
  displayName: string;
  emailAddress: string;
  photoLink?: string;
}

let gisScriptLoading: Promise<void> | null = null;
let gapiScriptLoading: Promise<void> | null = null;

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

export function getGooglePhotosToken(): string | null {
  try {
    const expiresAt = sessionStorage.getItem(STORAGE_KEY_EXPIRES);
    if (!expiresAt || Date.now() > Number(expiresAt)) {
      disconnectGooglePhotos();
      return null;
    }
    return sessionStorage.getItem(STORAGE_KEY_TOKEN);
  } catch {
    return null;
  }
}

export function isGooglePhotosConnected(): boolean {
  return Boolean(getGooglePhotosToken());
}

export function getGooglePhotosUser(): GooglePhotosUser | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY_USER);
    return raw ? (JSON.parse(raw) as GooglePhotosUser) : null;
  } catch {
    return null;
  }
}

export function disconnectGooglePhotos(): void {
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

export async function fetchGooglePhotosUserProfile(token: string): Promise<GooglePhotosUser | null> {
  try {
    const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const user: GooglePhotosUser = {
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

export async function connectGooglePhotos(): Promise<{ error?: string; success: boolean; user?: GooglePhotosUser | null }> {
  try {
    await loadGisScript();
  } catch {
    return { error: 'No se pudo cargar el cliente de autenticación de Google.', success: false };
  }

  return new Promise((resolve) => {
    try {
      const tokenClient = google.accounts.oauth2.initTokenClient({
        callback: async (response: any) => {
          if (response.error) {
            resolve({ error: 'Autorización de Google Fotos cancelada o denegada.', success: false });
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

          const user = await fetchGooglePhotosUserProfile(response.access_token);
          resolve({ success: true, user });
        },
        client_id: GOOGLE_PHOTOS_CLIENT_ID,
        error_callback: (err: any) => {
          resolve({ error: err?.message || 'Error en la autenticación con Google Fotos.', success: false });
        },
        prompt: 'consent',
        scope: GOOGLE_PHOTOS_SCOPES,
      });

      tokenClient.requestAccessToken();
    } catch {
      resolve({ error: 'Error al iniciar sesión con Google Fotos.', success: false });
    }
  });
}

export async function listGooglePhotos(options: {
  albumId?: string;
  pageSize?: number;
  pageToken?: string;
} = {}): Promise<{ mediaItems: GooglePhotoItem[]; nextPageToken?: string }> {
  const token = getGooglePhotosToken();
  if (!token) {
    throw new Error('No hay sesión activa en Google Fotos.');
  }

  const pageSize = options.pageSize || 30;
  const isAlbum = Boolean(options.albumId);
  const endpoint = isAlbum
    ? 'https://photoslibrary.googleapis.com/v1/mediaItems:search'
    : `https://photoslibrary.googleapis.com/v1/mediaItems?pageSize=${pageSize}${options.pageToken ? `&pageToken=${options.pageToken}` : ''}&key=${GOOGLE_PHOTOS_API_KEY}`;

  const fetchOptions: RequestInit = {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    method: isAlbum ? 'POST' : 'GET',
  };

  if (isAlbum) {
    fetchOptions.body = JSON.stringify({
      albumId: options.albumId,
      pageSize,
      pageToken: options.pageToken,
    });
  }

  const res = await fetch(endpoint, fetchOptions);

  if (!res.ok) {
    if (res.status === 401) {
      disconnectGooglePhotos();
      throw new Error('La sesión de Google Fotos ha expirado. Conéctate de nuevo.');
    }
    if (res.status === 403) {
      throw new Error('Permisos insuficientes: Tu cuenta de Google no tiene concedido el acceso a Photos Library API. Agrega el scope "photoslibrary.readonly" en la Pantalla de consentimiento de OAuth en Google Cloud Console y vuelve a conectar.');
    }
    throw new Error('Ha ocurrido un error al consultar las fotos de Google Fotos.');
  }

  const data = await res.json();
  const rawItems = Array.isArray(data.mediaItems) ? data.mediaItems : [];

  const mediaItems: GooglePhotoItem[] = rawItems.map((item: any) => {
    const baseUrl = item.baseUrl || '';
    return {
      baseUrl,
      description: item.description || '',
      filename: item.filename || 'Foto',
      height: item.mediaMetadata?.height ? Number(item.mediaMetadata.height) : undefined,
      id: item.id,
      mimeType: item.mimeType || 'image/jpeg',
      thumbnailUrl: baseUrl ? `${baseUrl}=w400-h300` : '',
      width: item.mediaMetadata?.width ? Number(item.mediaMetadata.width) : undefined,
    };
  });

  return {
    mediaItems,
    nextPageToken: data.nextPageToken,
  };
}

export async function listGooglePhotosAlbums(pageSize = 20): Promise<{ albums: GooglePhotoAlbum[]; nextPageToken?: string }> {
  const token = getGooglePhotosToken();
  if (!token) {
    throw new Error('No hay sesión activa en Google Fotos.');
  }

  const url = `https://photoslibrary.googleapis.com/v1/albums?pageSize=${pageSize}&key=${GOOGLE_PHOTOS_API_KEY}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    return { albums: [] };
  }

  const data = await res.json();
  const rawAlbums = Array.isArray(data.albums) ? data.albums : [];

  const albums: GooglePhotoAlbum[] = rawAlbums.map((alb: any) => ({
    coverPhotoBaseUrl: alb.coverPhotoBaseUrl ? `${alb.coverPhotoBaseUrl}=w200-h150` : undefined,
    id: alb.id,
    mediaItemsCount: alb.mediaItemsCount ? Number(alb.mediaItemsCount) : undefined,
    title: alb.title || 'Álbum sin título',
  }));

  return {
    albums,
    nextPageToken: data.nextPageToken,
  };
}

export async function fetchPhotoBlob(photoUrl: string): Promise<{ blob: Blob; dataUrl: string }> {
  const downloadUrl = `${photoUrl}=d`;
  const res = await fetch(downloadUrl);
  if (!res.ok) {
    const fallbackRes = await fetch(photoUrl);
    if (!fallbackRes.ok) {
      throw new Error('No se pudo descargar la fotografía de Google Fotos.');
    }
    const blob = await fallbackRes.blob();
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('Error al procesar la imagen.'));
      reader.readAsDataURL(blob);
    });
    return { blob, dataUrl };
  }

  const blob = await res.blob();
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Error al procesar la imagen.'));
    reader.readAsDataURL(blob);
  });
  return { blob, dataUrl };
}

export async function openGooglePhotosPicker(onSelect: (photo: GooglePhotoItem) => void): Promise<void> {
  const token = getGooglePhotosToken();
  if (!token) {
    showToast('Debes conectar tu cuenta de Google Fotos primero', 'warning');
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
        const photosView = new google.picker.PhotosView();

        const picker = new google.picker.PickerBuilder()
          .addView(photosView)
          .setOAuthToken(token)
          .setDeveloperKey(GOOGLE_PHOTOS_API_KEY)
          .setCallback((data: any) => {
            if (data.action === google.picker.Action.PICKED) {
              const doc = data.docs?.[0];
              if (doc) {
                const picked: GooglePhotoItem = {
                  baseUrl: doc.thumbnails?.[0]?.url || '',
                  filename: doc.name || 'Foto de Google',
                  id: doc.id,
                  mimeType: doc.mimeType || 'image/jpeg',
                  thumbnailUrl: doc.thumbnails?.[0]?.url || '',
                };
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
        showToast('Error al abrir el selector de Google Photos', 'danger');
        resolve();
      }
    });
  });
}
