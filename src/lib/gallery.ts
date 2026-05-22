const STORAGE_KEY = 'ascii-pro-gallery';
const MAX_ITEMS = 20;

export interface GalleryItem {
  id: string;
  thumbnail: string;
  createdAt: number;
  preset?: string;
}

export function getGallery(): GalleryItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export function saveToGallery(thumbnail: string, preset?: string): GalleryItem {
  const items = getGallery();
  const item: GalleryItem = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    thumbnail,
    createdAt: Date.now(),
    preset,
  };
  items.unshift(item);
  if (items.length > MAX_ITEMS) items.length = MAX_ITEMS;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  return item;
}

export function removeFromGallery(id: string) {
  const items = getGallery().filter(i => i.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export function clearGallery() {
  localStorage.removeItem(STORAGE_KEY);
}

export function canvasThumbnail(canvas: HTMLCanvasElement, maxSize = 200): string {
  const tmp = document.createElement('canvas');
  const ratio = canvas.width / canvas.height;
  if (ratio >= 1) {
    tmp.width = maxSize;
    tmp.height = Math.round(maxSize / ratio);
  } else {
    tmp.height = maxSize;
    tmp.width = Math.round(maxSize * ratio);
  }
  const ctx = tmp.getContext('2d')!;
  ctx.drawImage(canvas, 0, 0, tmp.width, tmp.height);
  return tmp.toDataURL('image/jpeg', 0.7);
}
