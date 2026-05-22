import { useCallback, useRef, useState, type DragEvent } from 'react';
import { Upload, ImageIcon, Film, Camera } from 'lucide-react';

interface Props {
  onFile: (file: File) => void;
  onBatch?: (files: File[]) => void;
  onDemoImage?: (img: HTMLImageElement) => void;
  onWebcam?: () => void;
  disabled?: boolean;
}

export function Dropzone({ onFile, onBatch, onWebcam, disabled }: Props) {
  const [drag, setDrag] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files || files.length === 0) return;
      if (files.length > 1 && onBatch) {
        onBatch(Array.from(files));
      } else {
        onFile(files[0]);
      }
    },
    [onFile, onBatch],
  );

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDrag(false);
    if (disabled) return;
    handleFiles(e.dataTransfer.files);
  };

  return (
    <div className="flex flex-col gap-5 md:gap-8 fade-in-up py-4 md:py-0 md:h-full md:justify-center">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={onDrop}
        onClick={() => !disabled && inputRef.current?.click()}
        data-active={drag}
        className={`dropzone p-10 sm:p-14 md:p-20 text-center ${
          disabled ? 'opacity-50 pointer-events-none' : ''
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*,video/*"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        <div className="flex flex-col items-center gap-5">
          <div
            className="static-icon w-16 h-16 md:w-20 md:h-20 rounded-2xl flex items-center justify-center"
            style={{
              background: drag
                ? '#ffffff'
                : 'var(--surface-2)',
              boxShadow: drag
                ? '0 8px 32px rgba(255,255,255,0.25)'
                : '0 2px 8px rgba(0,0,0,0.3)',
              transition: 'all 280ms var(--ease-out)',
            }}
          >
            <Upload
              className={`w-7 h-7 md:w-8 md:h-8 relative z-[2] ${drag ? 'text-black' : 'text-label-secondary'}`}
              strokeWidth={1.5}
            />
          </div>

          <div className="space-y-2">
            <h3 className="title-2 m-0">
              {drag ? 'Drop to import' : 'Drop an image or video'}
            </h3>
            <p className="subhead text-label-secondary">
              or <span className="text-accent font-medium">browse files</span>
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 mt-2 text-label-tertiary footnote">
            <span className="inline-flex items-center gap-1.5">
              <ImageIcon className="w-3.5 h-3.5" strokeWidth={1.75} />
              JPG, PNG, WEBP, GIF
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Film className="w-3.5 h-3.5" strokeWidth={1.75} />
              MP4, WEBM
            </span>
          </div>
        </div>
      </div>

      {onWebcam && (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={onWebcam}
            className="btn btn-grain-dark"
            aria-label="Use webcam"
          >
            <Camera className="w-4 h-4 relative z-[2]" strokeWidth={1.75} />
            <span className="relative z-[2]">Use webcam</span>
          </button>
        </div>
      )}
    </div>
  );
}
