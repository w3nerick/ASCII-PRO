import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import {
  Bookmark,
  CameraOff,
  Circle,
  Columns,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  Square,
  ToggleLeft,
  ToggleRight,
  X,
} from 'lucide-react';
import { Dropzone } from './Dropzone';
import { AsciiViewer } from './AsciiViewer';
import { CompareSlider } from './CompareSlider';
import {
  type AsciiFrame,
  type AsciiOptions,
  conversionKey,
  imageToAscii,
  videoFrameToAscii,
  sourceToAscii,
} from '../lib/asciiConverter';
import { fileKind, loadImageFromFile, loadVideoFromFile } from '../lib/loadMedia';
import { AsciiVideoRecorder } from '../lib/videoRecorder';
import { downloadVideoBlob } from '../lib/exporters';
import { generateDemoImage } from '../lib/demoImage';
import { buildZip } from '../lib/zip';
import { saveToGallery, canvasThumbnail } from '../lib/gallery';

type Mode = 'idle' | 'image' | 'video' | 'webcam';

interface Props {
  options: AsciiOptions;
  onFrame: (f: AsciiFrame | null) => void;
}

export interface MediaStageHandle {
  togglePlay: () => void;
  toggleRecord: () => void;
  toggleFullscreen: () => void;
  reset: () => void;
  loadDemo: (img?: HTMLImageElement) => Promise<void>;
  startWebcam: () => Promise<void>;
  isStream: () => boolean;
}


const MODE_LABEL: Record<Mode, string> = {
  idle: 'Idle',
  image: 'Image',
  video: 'Video',
  webcam: 'Webcam',
};

export const MediaStage = forwardRef<MediaStageHandle, Props>(function MediaStage(
  { options, onFrame },
  ref,
) {
  const [mode, setMode] = useState<Mode>('idle');
  const [frame, setFrame] = useState<AsciiFrame | null>(null);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [recording, setRecording] = useState(false);
  const [showOriginal, setShowOriginal] = useState(false);
  const [compareMode, setCompareMode] = useState(false);
  const [sourceEl, setSourceEl] = useState<HTMLImageElement | HTMLVideoElement | null>(null);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const originalCanvasRef = useRef<HTMLCanvasElement>(null);
  const asciiCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const stageRef = useRef<HTMLDivElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const recorderRef = useRef<AsciiVideoRecorder | null>(null);
  const frameRef = useRef<AsciiFrame | null>(null);
  const optionsRef = useRef(options);
  const pendingRef = useRef<number | null>(null);
  const lastConvKey = useRef<string>('');
  const modeRef = useRef<Mode>('idle');

  optionsRef.current = options;
  frameRef.current = frame;
  modeRef.current = mode;



  // Re-convert images only when conversion-relevant options change.
  useEffect(() => {
    if (modeRef.current !== 'image' || !imgRef.current) return;
    const key = conversionKey(options);
    if (key === lastConvKey.current) return;
    lastConvKey.current = key;
    if (pendingRef.current != null) cancelAnimationFrame(pendingRef.current);
    pendingRef.current = requestAnimationFrame(() => {
      pendingRef.current = null;
      if (!imgRef.current) return;
      const f = imageToAscii(imgRef.current, optionsRef.current);
      setFrame(f);
      onFrame(f);
    });
  }, [options, onFrame]);

  // Live conversion for video / webcam at ~24fps.
  useEffect(() => {
    if (mode !== 'video' && mode !== 'webcam') return;
    const v = videoRef.current;
    if (!v) return;
    let lastT = 0;
    const interval = 1000 / 24;
    const tick = (t: number) => {
      if (t - lastT >= interval) {
        lastT = t;
        if (v.readyState >= 2 && v.videoWidth > 0) {
          try {
            const opts = optionsRef.current;
            const f =
              mode === 'webcam'
                ? sourceToAscii(v, v.videoWidth, v.videoHeight, opts)
                : videoFrameToAscii(v, opts);
            setFrame(f);
            onFrame(f);
            if (recorderRef.current?.isRecording()) {
              recorderRef.current.pushFrame(f, opts);
            }
          } catch { /* tainted frame */ }
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); };
  }, [mode, onFrame]);



  useEffect(() => {
    const handler = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  // Paint original source onto canvas whenever preview is toggled on
  useEffect(() => {
    if (!showOriginal || !originalCanvasRef.current) return;
    const canvas = originalCanvasRef.current;
    const ctx = canvas.getContext('2d')!;
    if (imgRef.current) {
      const img = imgRef.current;
      canvas.width = img.naturalWidth || img.width;
      canvas.height = img.naturalHeight || img.height;
      ctx.drawImage(img, 0, 0);
    } else if (videoRef.current) {
      const v = videoRef.current;
      canvas.width = v.videoWidth;
      canvas.height = v.videoHeight;
      ctx.drawImage(v, 0, 0);
    }
  }, [showOriginal]);

  const reset = () => {
    if (recorderRef.current?.isRecording()) void recorderRef.current.stop();
    recorderRef.current = null;
    if (pendingRef.current != null) {
      cancelAnimationFrame(pendingRef.current);
      pendingRef.current = null;
    }
    lastConvKey.current = '';
    setRecording(false);
    setShowOriginal(false);
    setError(null);
    setFrame(null);
    onFrame(null);
    setPlaying(false);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.srcObject = null;
      videoRef.current.removeAttribute('src');
      videoRef.current.load();
      videoRef.current = null;
    }
    imgRef.current = null;
    setSourceEl(null);
    setMode('idle');
  };

  const handleFile = async (file: File) => {
    setError(null);
    const kind = fileKind(file);
    if (kind === 'unknown') { setError('Unsupported file format'); return; }
    try {
      if (kind === 'image') {
        const img = await loadImageFromFile(file);
        imgRef.current = img;
        setSourceEl(img);
        setMode('image');
        const f = imageToAscii(img, optionsRef.current);
        lastConvKey.current = conversionKey(optionsRef.current);
        setFrame(f); onFrame(f);
      } else {
        const video = await loadVideoFromFile(file);
        videoRef.current = video;
        setSourceEl(video);
        setMode('video');
        await video.play().catch(() => {});
        setPlaying(!video.paused);
      }
    } catch (e) {
      setError((e as Error).message ?? 'Failed to load file');
    }
  };

  const handleBatch = async (files: File[]) => {
    setError(null);
    const imageFiles = files.filter(f => fileKind(f) === 'image');
    if (imageFiles.length === 0) { setError('No images found in batch'); return; }
    setProgress({ current: 0, total: imageFiles.length });
    try {
      const opts = optionsRef.current;
      const blobs: { name: string; blob: Blob }[] = [];
      for (let i = 0; i < imageFiles.length; i++) {
        const file = imageFiles[i];
        const img = await loadImageFromFile(file);
        const f = imageToAscii(img, opts);
        const { frameToPngBlob } = await import('../lib/exporters');
        const blob = await frameToPngBlob(f, {
          background: opts.bgColor,
          foreground: opts.fgColor,
          fontSize: opts.fontSize,
          color: opts.color,
          scale: opts.exportScale,
        });
        const baseName = file.name.replace(/\.[^.]+$/, '');
        blobs.push({ name: `${baseName}-ascii.png`, blob });
        setProgress({ current: i + 1, total: imageFiles.length });
      }
      if (blobs.length === 1) {
        const { downloadVideoBlob } = await import('../lib/exporters');
        downloadVideoBlob(blobs[0].blob, blobs[0].name);
      } else {
        const zip = await buildZip(blobs);
        const url = URL.createObjectURL(zip);
        const a = document.createElement('a');
        a.href = url; a.download = 'ascii-pro-batch.zip';
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
      setError(null);
    } catch (e) {
      setError((e as Error).message ?? 'Batch export failed');
    } finally {
      setProgress(null);
    }
  };



  const loadDemo = async (img?: HTMLImageElement) => {
    setError(null);
    try {
      const demoImg = img ?? (await generateDemoImage());
      imgRef.current = demoImg;
      setSourceEl(demoImg);
      setMode('image');
      const f = imageToAscii(demoImg, optionsRef.current);
      lastConvKey.current = conversionKey(optionsRef.current);
      setFrame(f); onFrame(f);
    } catch (e) {
      setError((e as Error).message ?? 'Failed to load demo');
    }
  };

  const startWebcam = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      streamRef.current = stream;
      const v = document.createElement('video');
      v.muted = true; v.playsInline = true; v.srcObject = stream;
      await v.play();
      videoRef.current = v;
      setSourceEl(v);
      setMode('webcam');
      setPlaying(true);
    } catch {
      setError('Camera access denied');
    }
  };

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) { void v.play(); setPlaying(true); }
    else { v.pause(); setPlaying(false); }
  };

  const toggleFullscreen = async () => {
    const el = stageRef.current;
    if (!el) return;
    if (!document.fullscreenElement) await el.requestFullscreen?.();
    else await document.exitFullscreen?.();
  };

  const toggleRecord = async () => {
    const f = frameRef.current;
    if (!f) return;
    if (!recorderRef.current?.isRecording()) {
      try {
        recorderRef.current = new AsciiVideoRecorder(f, optionsRef.current, 24);
        recorderRef.current.start();
        setRecording(true);
      } catch (e) { setError(`Recording failed: ${(e as Error).message}`); }
    } else {
      const blob = await recorderRef.current.stop();
      const ext = recorderRef.current.getExt();
      setRecording(false);
      downloadVideoBlob(blob, `ascii-pro.${ext}`);
      recorderRef.current = null;
    }
  };

  const isStream = () => mode === 'video' || mode === 'webcam';



  useImperativeHandle(
    ref,
    () => ({ togglePlay, toggleRecord, toggleFullscreen, reset, loadDemo, startWebcam, isStream }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mode, recording],
  );

  return (
    <div className="flex flex-col gap-3 h-full">
      {error && (
        <div className="material-thin px-4 py-3 flex items-start gap-2 text-sys-red callout fade-in">
          <span className="font-medium">Error:</span>
          <span>{error}</span>
        </div>
      )}

      {progress && (
        <div className="material-thin px-4 py-3 flex items-center gap-3 callout fade-in">
          <div className="flex-1">
            <div className="flex items-center justify-between mb-1">
              <span className="footnote text-label-secondary">Processing batch...</span>
              <span className="footnote text-label-tertiary tabular-nums font-mono">{progress.current}/{progress.total}</span>
            </div>
            <div style={{ height: 3, background: 'var(--surface-2)', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${(progress.current / progress.total) * 100}%`, background: 'var(--accent)', borderRadius: 2, transition: 'width 200ms var(--ease)' }} />
            </div>
          </div>
        </div>
      )}

      {mode === 'idle' ? (
        <Dropzone
          onFile={handleFile}
          onBatch={handleBatch}
          onWebcam={startWebcam}
        />
      ) : (
        <div
          ref={stageRef}
          className="ascii-stage flex flex-col flex-1 min-h-0 md:min-h-[420px] shadow-card scale-in"
          style={fullscreen ? { background: options.bgColor, borderRadius: 0 } : undefined}
        >
          {/* Stage toolbar */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-separator flex-wrap gap-2 bg-bg-elevated/60 backdrop-blur-md">
            <div className="flex items-center gap-2 text-label-secondary footnote">
              <StatusDot recording={recording} />
              <span className="font-medium text-label">{MODE_LABEL[mode]}</span>
              {frame && (
                <>
                  <span className="text-label-quaternary">·</span>
                  <span className="font-mono tabular-nums">
                    {frame.cols}×{frame.rows}
                  </span>
                </>
              )}
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              {isStream() && (
                <>
                  <IconButton onClick={togglePlay} title="Play / pause (Space)">
                    {playing ? <Pause className="w-3.5 h-3.5" strokeWidth={2} /> : <Play className="w-3.5 h-3.5" strokeWidth={2} />}
                  </IconButton>
                  <button
                    type="button"
                    onClick={toggleRecord}
                    title="Record (R)"
                    className={`btn btn-sm ${recording ? 'btn-danger' : 'btn-ghost'}`}
                  >
                    {recording ? (
                      <><Square className="w-3 h-3 fill-white" strokeWidth={0} /> Stop</>
                    ) : (
                      <><Circle className="w-3 h-3 text-sys-red fill-sys-red" strokeWidth={0} /> Record</>
                    )}
                  </button>
                </>
              )}
              {mode === 'image' && (
                <>
                  <button
                    type="button"
                    onClick={() => { setShowOriginal((v) => !v); setCompareMode(false); }}
                    title="Toggle original / ASCII"
                    className={`btn btn-sm ${showOriginal ? 'btn-primary' : 'btn-ghost'}`}
                  >
                    {showOriginal
                      ? <><ToggleRight className="w-3.5 h-3.5" strokeWidth={2} /> Original</>
                      : <><ToggleLeft className="w-3.5 h-3.5" strokeWidth={2} /> Original</>}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setCompareMode(v => !v); setShowOriginal(false); }}
                    title="Compare slider"
                    className={`btn btn-sm ${compareMode ? 'btn-primary' : 'btn-ghost'}`}
                  >
                    <Columns className="w-3.5 h-3.5" strokeWidth={2} />
                    <span className="hidden sm:inline">Compare</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (asciiCanvasRef.current) {
                        const thumb = canvasThumbnail(asciiCanvasRef.current);
                        saveToGallery(thumb);
                      }
                    }}
                    title="Save to gallery"
                    className="btn btn-ghost btn-sm"
                  >
                    <Bookmark className="w-3.5 h-3.5" strokeWidth={2} />
                    <span className="hidden sm:inline">Save</span>
                  </button>
                </>
              )}
              <IconButton onClick={toggleFullscreen} title="Fullscreen (F)">
                {fullscreen ? <Minimize2 className="w-3.5 h-3.5" strokeWidth={2} /> : <Maximize2 className="w-3.5 h-3.5" strokeWidth={2} />}
              </IconButton>
              <button
                type="button"
                onClick={reset}
                title="Close (Esc)"
                className="btn btn-ghost btn-sm"
              >
                {mode === 'webcam' ? <CameraOff className="w-3.5 h-3.5" strokeWidth={2} /> : <X className="w-3.5 h-3.5" strokeWidth={2} />}
                <span className="hidden sm:inline">Close</span>
              </button>
            </div>
          </div>

          {/* Output */}
          <div className="flex-1 overflow-hidden relative">
            {showOriginal && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/90 fade-in">
                <canvas
                  ref={originalCanvasRef}
                  style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', display: 'block' }}
                />
              </div>
            )}
            {compareMode && (
              <CompareSlider sourceEl={sourceEl} canvasEl={asciiCanvasRef.current} />
            )}
            <AsciiViewer
              frame={frame}
              options={options}
              sourceEl={sourceEl}
              onCanvasReady={(el) => { asciiCanvasRef.current = el; }}
            />
          </div>
        </div>
      )}
    </div>
  );
});



function IconButton({
  children,
  onClick,
  title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="btn btn-ghost btn-sm btn-icon"
    >
      {children}
    </button>
  );
}

function StatusDot({ recording }: { recording: boolean }) {
  if (recording) {
    return (
      <span className="inline-flex items-center gap-1.5">
        <span
          className="w-2 h-2 rounded-full bg-sys-red"
          style={{ animation: 'fadeIn 1s ease-in-out infinite alternate' }}
        />
        <span className="text-sys-red font-medium">REC</span>
      </span>
    );
  }
  return <span className="w-1.5 h-1.5 rounded-full bg-sys-green" />;
}

