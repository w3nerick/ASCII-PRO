import { useEffect } from 'react';
import { X } from 'lucide-react';

interface Props {
  open: boolean;
  onClose: () => void;
}

interface Shortcut {
  keys: string[];
  label: string;
}

const SECTIONS: { title: string; items: Shortcut[] }[] = [
  {
    title: 'Presets',
    items: [
      { keys: ['1'], label: 'Photo' },
      { keys: ['2'], label: 'Sketch' },
      { keys: ['3'], label: 'Matrix' },
      { keys: ['4'], label: 'Glitch' },
      { keys: ['5'], label: 'Newspaper' },
      { keys: ['6'], label: 'Blocks' },
    ],
  },
  {
    title: 'Source',
    items: [
      { keys: ['D'], label: 'Load demo image' },
      { keys: ['W'], label: 'Activate webcam' },
      { keys: ['Esc'], label: 'Close source / dismiss' },
    ],
  },
  {
    title: 'Playback',
    items: [
      { keys: ['Space'], label: 'Play / pause stream' },
      { keys: ['R'], label: 'Toggle recording' },
      { keys: ['F'], label: 'Toggle fullscreen' },
    ],
  },
  {
    title: 'Output',
    items: [
      { keys: ['C'], label: 'Copy ASCII text' },
      { keys: ['I'], label: 'Toggle invert' },
      { keys: ['M'], label: 'Toggle color / mono' },
      { keys: ['?'], label: 'Show this help' },
    ],
  },
];

export function HelpModal({ open, onClose }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 fade-in"
      style={{ background: 'rgba(0, 0, 0, 0.45)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="help-title"
    >
      <div
        className="material-thick max-w-md w-full max-h-[85vh] overflow-hidden flex flex-col scale-in shadow-elevated"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-separator">
          <div>
            <h2 id="help-title" className="title-3 m-0">Keyboard Shortcuts</h2>
            <p className="footnote text-label-tertiary mt-0.5">All processing runs locally</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="btn btn-ghost btn-sm btn-icon"
            aria-label="Close"
          >
            <X className="w-4 h-4" strokeWidth={2} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {SECTIONS.map((section) => (
            <section key={section.title}>
              <div className="caption mb-2 px-1">{section.title}</div>
              <div className="material-thin overflow-hidden">
                {section.items.map((item) => (
                  <div key={item.label} className="list-row">
                    <span className="callout">{item.label}</span>
                    <span className="flex gap-1 flex-shrink-0">
                      {item.keys.map((k) => (
                        <kbd key={k}>{k}</kbd>
                      ))}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-separator">
          <p className="footnote text-label-tertiary text-center m-0">
            Press <kbd>?</kbd> to toggle this panel
          </p>
        </div>
      </div>
    </div>
  );
}
