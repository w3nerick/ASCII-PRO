import { Github, Keyboard, Sparkles } from 'lucide-react';

interface Props {
  onHelp?: () => void;
}

export function Header({ onHelp }: Props) {
  return (
    <header className="toolbar sticky top-0 z-30">
      <div className="max-w-[1400px] mx-auto px-4 md:px-6 h-14 flex items-center justify-between gap-4">
        {/* Brand */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="relative w-8 h-8 rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0"
               style={{
                 background: 'linear-gradient(135deg, #0a84ff 0%, #5e5ce6 100%)',
                 boxShadow: '0 1px 2px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.16)',
               }}>
            <Sparkles className="w-4 h-4 text-white" strokeWidth={2.5} />
          </div>
          <div className="flex items-baseline gap-2 min-w-0">
            <h1 className="title-3 m-0 truncate">ASCII Pro</h1>
            <span className="footnote text-label-tertiary hidden sm:inline">
              Image &amp; video to ASCII
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {onHelp && (
            <button
              type="button"
              onClick={onHelp}
              className="btn btn-ghost btn-sm"
              title="Keyboard shortcuts (?)"
              aria-label="Keyboard shortcuts"
            >
              <Keyboard className="w-3.5 h-3.5" strokeWidth={2} />
              <span className="hidden sm:inline">Shortcuts</span>
            </button>
          )}
          <a
            href="https://github.com/w3nerick/ASCII-PRO"
            target="_blank"
            rel="noreferrer"
            className="btn btn-ghost btn-sm"
            aria-label="View source on GitHub"
          >
            <Github className="w-3.5 h-3.5" strokeWidth={2} />
            <span className="hidden sm:inline">GitHub</span>
          </a>
        </div>
      </div>
    </header>
  );
}
