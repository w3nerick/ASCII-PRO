// Saved works (IndexedDB). Each entry keeps a thumbnail, the look and optionally the source image.
import type { Look } from '../engine/types';

export interface LibraryItem {
  id: string;
  name: string;
  created: number;
  thumb: Blob;
  look: Look;
  source?: Blob;
  sourceName?: string;
}

const DB = 'asciipro-library';
const STORE = 'items';

function open(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' });
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise((res, rej) => {
    const t = db.transaction(STORE, mode);
    const r = fn(t.objectStore(STORE));
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}

export async function listLibrary(): Promise<LibraryItem[]> {
  try {
    const all = await tx<LibraryItem[]>('readonly', (s) => s.getAll() as IDBRequest<LibraryItem[]>);
    return all.sort((a, b) => b.created - a.created);
  } catch {
    return [];
  }
}

export async function saveLibrary(item: LibraryItem) {
  await tx('readwrite', (s) => s.put(item));
}

export async function deleteLibrary(id: string) {
  await tx('readwrite', (s) => s.delete(id));
}
