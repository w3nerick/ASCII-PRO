import { useCallback, useRef, useState, type DragEvent } from 'react';
import { Upload, ImageIcon, Film, Sparkles, Camera } from 'lucide-react';
import { DEMO_GALLERY } from '../lib/demoImage';

interface Props {
  onFile: (file: File) => void;
  onDemoImage?: (img: HTMLImageElement) => void;
  onWebcam?: () => void;
  disabled?: boolean;
}

/**
 * Apple-style empty state. Generous whitespace, soft typography, accent-blue
 * focus on the primary upload affordance, secondary actions below.
 */
export function Dropzone({ onFile, onDemoImage, onWebcam, disabled }: Props) {
  const [drag, setDrag] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files || files.length === 0) return;
      onFile(files[0]);
    },
    [onFile],
  );

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDrag(false);
    if (disabled) return;
    handleFiles(e.dataTransfer.files);
  };

  return (
    <div className="flex flex-col gap-6 fade-in-up">
      {/* ===== Hero / Dropzone ===== */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={onDrop}
        onClick={() => !disabled && inputRef.current?.click()}
        data-active={drag}
        className={`dropzone p-12 sm:p-16 text-center ${
          disabled ? 'opacity-50 pointer-events-none' : ''
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*,video/*"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        <div className="flex flex-col items-center gap-4">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center"
            style={{
              background: drag
                ? 'linear-gradient(135deg, #0a84ff, #5e5ce6)'
                : 'rgba(255,255,255,0.06)',
              boxShadow: drag
                ? '0 8px 24px rgba(10,132,255,0.4)'
                : '0 1px 2px rgba(0,0,0,0.3)',
              transition: 'all 220ms cubic-bezier(0.4,0,0.2,1)',
            }}
          >
            <Upload
              className={`w-7 h-7 ${drag ? 'text-white' : 'text-label-secondary'}`}
              strokeWidth={1.75}
            />
          </div>

          <div className="space-y-1">
            <h3 className="title-2 m-0">
              {drag ? 'Drop to import' : 'Drop an image or video'}
            </h3>
            <p className="callout text-label-secondary">
              or <span className="text-accent">click to browse</span>
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 mt-2 text-label-tertiary footnote">
            <span className="inline-flex items-center gap-1.5">
              <ImageIcon className="w-3.5 h-3.5" strokeWidth={2} />
              JPG, PNG, WEBP, GIF
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Film className="w-3.5 h-3.5" strokeWidth={2} />
              MP4, WEBM
            </span>
          </div>
        </div>
      </div>

      {/* ===== Webcam shortcut ===== */}
      {onWebcam && (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={onWebcam}
            className="btn btn-ghost"
            aria-label="Use webcam"
          >
            <Camera className="w-4 h-4" strokeWidth={2} />
            Use webcam
          </button>
        </div>
      )}

      {/* ===== Demo gallery ===== */}
      {onDemoImage && (
        <section className="fade-in-up" style={{ animationDelay: '80ms' }}>
          <div className="section-header">
            <span>Try a demo</span>
            <Sparkles className="w-3 h-3 text-label-tertiary" strokeWidth={2.5} />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {DEMO_GALLERY.map((demo) => {
              const isLoading = loading === demo.id;
              return (
                <button
                  key={demo.id}
                  type="button"
                  disabled={loading !== null}
                  onClick={async (e) => {
                    e.stopPropagation();
                    setLoading(demo.id);
                    try {
                      const img = await demo.generate();
                      onDemoImage(img);
                    } finally {
                      setLoading(null);
                    }
                  }}
                  className="group relative h-20 rounded-lg overflow-hidden border border-separator hover:border-separator-strong transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ background: gradientFor(demo.id) }}
                >
                  <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                  <div className="relative h-full flex flex-col items-center justify-center gap-1">
                    <span className="callout font-semibold text-white drop-shadow-sm">
                      {isLoading ? 'Loading…' : demo.label}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

/** Decorative gradient backgrounds for demo tiles. */
function gradientFor(id: string): string {
  switch (id) {
    case 'synthwave':
      return 'linear-gradient(135deg, #5e5ce6 0%, #ff375f 60%, #ff9f0a 100%)';
    case 'portrait':
      return 'linear-gradient(135deg, #0a84ff 0%, #bf5af2 100%)';
    case 'cityscape':
      return 'linear-gradient(135deg, #1c1c1e 0%, #0a84ff 60%, #ff375f 100%)';
    case 'geometric':
      return 'linear-gradient(135deg, #30d158 0%, #0a84ff 50%, #bf5af2 100%)';
    default:
      return 'linear-gradient(135deg, #1c1c1e, #3a3a3c)';
  }
}
