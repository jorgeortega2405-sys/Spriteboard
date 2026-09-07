import { CanvasItem } from '../types/canvas.types.js';

const DB_NAME = 'spriteboard_db';
const DB_VERSION = 1;
const STORE_NAME = 'canvases';
const LOCAL_STORAGE_KEY = 'spriteboard_guest_canvases';

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB no está disponible'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'uuid' });
        store.createIndex('created_at', 'created_at', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function getLocalStorageCanvases(): CanvasItem[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function setLocalStorageCanvases(canvases: CanvasItem[]): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(canvases));
  } catch {}
}

export async function saveLocalCanvas(canvas: CanvasItem): Promise<CanvasItem> {
  const item: CanvasItem = {
    ...canvas,
    is_local: true,
    created_at: canvas.created_at || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const localItems = getLocalStorageCanvases();
  const existingIdx = localItems.findIndex((c) => c.uuid === item.uuid);
  if (existingIdx >= 0) {
    localItems[existingIdx] = item;
  } else {
    localItems.unshift(item);
  }
  setLocalStorageCanvases(localItems);

  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(item);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {}

  return item;
}

export async function getAllLocalCanvases(): Promise<CanvasItem[]> {
  try {
    const db = await openDatabase();
    return await new Promise<CanvasItem[]>((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => {
        const result = (req.result as CanvasItem[]) || [];
        if (result.length > 0) {
          resolve(result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
        } else {
          resolve(getLocalStorageCanvases());
        }
      };
      req.onerror = () => resolve(getLocalStorageCanvases());
    });
  } catch {
    return getLocalStorageCanvases();
  }
}

export async function getLocalCanvasByUuid(uuid: string): Promise<CanvasItem | null> {
  try {
    const db = await openDatabase();
    return await new Promise<CanvasItem | null>((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(uuid);
      req.onsuccess = () => {
        if (req.result) {
          resolve(req.result as CanvasItem);
        } else {
          const fallback = getLocalStorageCanvases().find((c) => c.uuid === uuid) || null;
          resolve(fallback);
        }
      };
      req.onerror = () => {
        const fallback = getLocalStorageCanvases().find((c) => c.uuid === uuid) || null;
        resolve(fallback);
      };
    });
  } catch {
    return getLocalStorageCanvases().find((c) => c.uuid === uuid) || null;
  }
}

export async function removeLocalCanvas(uuid: string): Promise<void> {
  const localItems = getLocalStorageCanvases().filter((c) => c.uuid !== uuid);
  setLocalStorageCanvases(localItems);

  try {
    const db = await openDatabase();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(uuid);
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
    });
  } catch {}
}

export async function markLocalCanvasAsSynced(uuid: string, serverId?: number): Promise<void> {
  const canvas = await getLocalCanvasByUuid(uuid);
  if (!canvas) return;

  const updated: CanvasItem = {
    ...canvas,
    id: serverId !== undefined ? serverId : canvas.id,
    is_local: false,
    updated_at: new Date().toISOString(),
  };

  await saveLocalCanvas(updated);
}
