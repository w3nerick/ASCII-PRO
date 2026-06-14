/**
 * Share Codes — encode/decode AsciiOptions as compact base64 in URL hash.
 * Inspired by lumenshaders' share code system.
 *
 * Format: #share=<base64url(JSON array of values)>
 * Only non-default values are stored to keep URLs short.
 */

import type { AsciiOptions } from './asciiConverter';
import { DEFAULT_OPTIONS } from './asciiConverter';

// Keys that are shareable (skip runtime/display-only stuff)
const SHARE_KEYS: (keyof AsciiOptions)[] = [
  'width', 'charset', 'customRamp', 'invert', 'color',
  'brightness', 'contrast', 'saturation', 'colorEnhance', 'blur',
  'edges', 'edgeThreshold', 'dithering', 'density',
  'renderMode', 'blendMode', 'bgColor', 'fgColor',
  'bgMode', 'bgBlur', 'bgOpacity', 'charOpacity', 'coverage',
  'charGlow', 'charBrightness',
  'colorPalette', 'gradientMap', 'gradientStart', 'gradientEnd',
  'aspectRatio', 'animatedAscii', 'animSpeed',
  'fx_scanlines', 'fx_scanlines_intensity',
  'fx_vignette', 'fx_vignette_intensity',
  'fx_glitch', 'fx_glitch_intensity',
  'fx_chromatic', 'fx_chromatic_px',
  'fx_bloom', 'fx_bloom_intensity',
  'fx_grain', 'fx_grain_intensity',
  'fx_crt', 'fx_crt_intensity',
  'fx_reeded', 'fx_reeded_intensity', 'fx_reeded_slices',
  'fx_lightrays', 'fx_lightrays_intensity', 'fx_lightrays_x', 'fx_lightrays_y',
  'pointLightsEnabled', 'animPreset', 'animPresetSpeed',
  'shapeMask', 'discoMode', 'discoSpeed',
];

/**
 * Encode options into a compact share code string.
 * Only encodes values that differ from defaults to keep it short.
 */
export function encodeShareCode(options: AsciiOptions): string {
  const diff: Record<string, unknown> = {};
  for (const key of SHARE_KEYS) {
    const val = options[key];
    const def = DEFAULT_OPTIONS[key];
    if (JSON.stringify(val) !== JSON.stringify(def)) {
      diff[key] = val;
    }
  }
  const json = JSON.stringify(diff);
  // Use base64url encoding (safe for URLs without percent-encoding)
  const b64 = btoa(unescape(encodeURIComponent(json)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  return b64;
}

/**
 * Decode a share code back to options (merged with defaults).
 * Returns null if invalid.
 */
export function decodeShareCode(code: string): AsciiOptions | null {
  try {
    // Restore base64 padding
    const padded = code.replace(/-/g, '+').replace(/_/g, '/');
    const json = decodeURIComponent(escape(atob(padded)));
    const diff = JSON.parse(json);
    if (typeof diff !== 'object' || diff === null) return null;
    // Merge with defaults, only accepting known keys
    const result = { ...DEFAULT_OPTIONS };
    for (const key of SHARE_KEYS) {
      if (key in diff) {
        (result as Record<string, unknown>)[key] = diff[key];
      }
    }
    return result;
  } catch {
    return null;
  }
}

/**
 * Generate a full shareable URL with the current options encoded.
 */
export function generateShareUrl(options: AsciiOptions): string {
  const code = encodeShareCode(options);
  const url = new URL(window.location.href);
  url.hash = `share=${code}`;
  return url.toString();
}

/**
 * Check current URL for a share code and decode it.
 * Returns null if no share code present or invalid.
 */
export function loadFromUrl(): AsciiOptions | null {
  const hash = window.location.hash;
  if (!hash.startsWith('#share=')) return null;
  const code = hash.slice(7); // remove '#share='
  return decodeShareCode(code);
}

/**
 * Clear the share code from the URL without reloading.
 */
export function clearShareFromUrl(): void {
  if (window.location.hash.startsWith('#share=')) {
    history.replaceState(null, '', window.location.pathname + window.location.search);
  }
}
