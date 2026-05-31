import type { AsciiOptions } from './asciiConverter';

const STORAGE_KEY = 'ascii-pro-user-presets';

export interface UserPreset {
  id: string;
  name: string;
  options: Partial<AsciiOptions>;
  createdAt: number;
}

export function saveUserPreset(name: string, options: AsciiOptions): UserPreset {
  const preset: UserPreset = {
    id: typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : Date.now().toString(36),
    name,
    options: { ...options },
    createdAt: Date.now(),
  };
  const existing = loadUserPresets();
  existing.push(preset);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
  return preset;
}

export function loadUserPresets(): UserPreset[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as UserPreset[];
  } catch {
    return [];
  }
}

export function deleteUserPreset(id: string): void {
  const presets = loadUserPresets().filter(p => p.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
}

export function exportPresetsJson(): string {
  return JSON.stringify(loadUserPresets(), null, 2);
}

export function importPresetsJson(json: string): number {
  try {
    const parsed = JSON.parse(json);
    if (!Array.isArray(parsed)) return 0;
    const valid = parsed.filter(
      (p: unknown): p is UserPreset =>
        typeof p === 'object' && p !== null &&
        'id' in p && 'name' in p && 'options' in p && 'createdAt' in p
    );
    if (valid.length === 0) return 0;
    const existing = loadUserPresets();
    const existingIds = new Set(existing.map(p => p.id));
    const newPresets = valid.filter(p => !existingIds.has(p.id));
    const merged = [...existing, ...newPresets];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
    return newPresets.length;
  } catch {
    return 0;
  }
}
