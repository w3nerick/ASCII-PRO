import { Wand2 } from 'lucide-react';
import { PRESETS } from '../lib/presets';
import type { AsciiOptions } from '../lib/asciiConverter';

interface Props {
  onApply: (next: AsciiOptions) => void;
  current: AsciiOptions;
}

/**
 * Apple-style preset row. A scrollable strip of pill chips, each one
 * applying a curated look on top of the user's current options.
 */
export function PresetBar({ onApply, current }: Props) {
  return (
    <div className="material-thin px-4 py-3 flex items-center gap-3 overflow-hidden">
      <div className="flex items-center gap-2 flex-shrink-0">
        <Wand2 className="w-3.5 h-3.5 text-label-secondary" strokeWidth={2} />
        <span className="callout font-medium text-label-secondary hidden sm:inline">Style</span>
      </div>

      <div className="w-px h-5 bg-separator flex-shrink-0 hidden sm:block" />

      <div
        className="flex items-center gap-1.5 overflow-x-auto"
        style={{ scrollbarWidth: 'thin' }}
      >
        {PRESETS.map((p, i) => {
          const active = isPresetActive(p, current);
          return (
            <button
              key={p.id}
              type="button"
              aria-selected={active}
              title={`${p.hint}${i < 6 ? ` · key ${i + 1}` : ''}`}
              onClick={() => onApply(p.apply(current))}
              className="chip"
            >
              {p.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** A preset is "active" when its core look (charset + color/invert) matches. */
function isPresetActive(preset: { apply: (b: AsciiOptions) => AsciiOptions }, current: AsciiOptions): boolean {
  const applied = preset.apply(current);
  return (
    applied.charset === current.charset &&
    applied.color === current.color &&
    applied.invert === current.invert &&
    applied.dithering === current.dithering &&
    applied.edges === current.edges &&
    applied.bgColor.toLowerCase() === current.bgColor.toLowerCase() &&
    applied.fgColor.toLowerCase() === current.fgColor.toLowerCase()
  );
}
