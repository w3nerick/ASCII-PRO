import { Github, Image, Keyboard, Sparkles } from 'lucide-react';

interface Props {
  onHelp?: () => void;
  onGallery?: () => void;
}

export function Header({ onHelp, onGallery }: Props) {
  return (
    <header className="toolbar sticky top-0 z-30">
      <div className="max-w-[1400px] mx-auto px-4 md:px-6 h-12 md:h-14 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className="w-7 h-7 md:w-8 md:h-8 rounded-[8px] flex items-center justify-center flex-shrink-0"
            style={{
              background: 'linear-gradient(135deg, #ffffff 0%, #a0a0a0 100%)',
              boxShadow: '0 2px 8px rgba(255,255,255,0.15)',
            }}
          >
            <Sparkles className="w-3.5 h-3.5 md:w-4 md:h-4 text-black" strokeWidth={2.5} />
          </div>
          <h1 className="headline m-0 truncate">ASCII Pro</h1>
          <span className="footnote text-label-tertiary hidden md:inline">
            Image & video to ASCII
          </span>
        </div>

        <div className="flex items-center gap-1">
          {onGallery && (
            <button
              type="button"
              onClick={onGallery}
              className="btn btn-ghost btn-sm btn-icon"
              title="Gallery"
              aria-label="Gallery"
            >
              <Image className="w-4 h-4" strokeWidth={1.75} />
            </button>
          )}
          {onHelp && (
            <button
              type="button"
              onClick={onHelp}
              className="btn btn-ghost btn-sm btn-icon"
              title="Keyboard shortcuts (?)"
              aria-label="Keyboard shortcuts"
            >
              <Keyboard className="w-4 h-4" strokeWidth={1.75} />
            </button>
          )}
          <a
            href="https://github.com/w3nerick/ASCII-PRO"
            target="_blank"
            rel="noreferrer"
            className="btn btn-ghost btn-sm btn-icon"
            aria-label="View source on GitHub"
          >
            <Github className="w-4 h-4" strokeWidth={1.75} />
          </a>
        </div>
      </div>
    </header>
  );
}
