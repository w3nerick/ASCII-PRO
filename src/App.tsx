import { useMemo, useRef, useState } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { Header } from './components/Header';
import { ControlPanel } from './components/ControlPanel';
import { MediaStage, type MediaStageHandle } from './components/MediaStage';
import { ExportBar } from './components/ExportBar';
import { HelpModal } from './components/HelpModal';
import { MobileSheet } from './components/MobileSheet';
import { Gallery } from './components/Gallery';
import { DEFAULT_OPTIONS, type AsciiOptions, type AsciiFrame } from './lib/asciiConverter';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { copyText } from './lib/exporters';

export default function App() {
  const [options, setOptions] = useState<AsciiOptions>(DEFAULT_OPTIONS);
  const [frame, setFrame] = useState<AsciiFrame | null>(null);
  const [help, setHelp] = useState(false);
  const [gallery, setGallery] = useState(false);
  const [mobileControls, setMobileControls] = useState(false);
  const stageRef = useRef<MediaStageHandle | null>(null);

  const shortcuts = useMemo(() => ({
    ' ': () => stageRef.current?.togglePlay(),
    r: () => stageRef.current?.toggleRecord(),
    f: () => stageRef.current?.toggleFullscreen(),
    d: () => stageRef.current?.loadDemo(),
    w: () => stageRef.current?.startWebcam(),
    escape: () => {
      if (help) setHelp(false);
      else if (mobileControls) setMobileControls(false);
      else stageRef.current?.reset();
    },
    c: () => { if (frame) void copyText(frame); },
    i: () => setOptions(o => ({ ...o, invert: !o.invert })),
    m: () => setOptions(o => ({ ...o, color: !o.color })),
    '?': () => setHelp(v => !v),
  }), [frame, help, mobileControls]);
  useKeyboardShortcuts(shortcuts);

  return (
    <div className="flex flex-col" style={{ height: '100dvh', background: 'var(--bg)', overflow: 'hidden' }}>
      <Header onHelp={() => setHelp(true)} onGallery={() => setGallery(true)} />

      {/* Desktop layout */}
      <div className="hidden md:flex flex-1 min-h-0">
        <div className="flex flex-col flex-1 min-w-0 p-4 gap-3 fade-in-up">
          <MediaStage ref={stageRef} options={options} onFrame={setFrame} />
          <ExportBar frame={frame} options={options} />
        </div>
        <div
          className="shrink-0 border-l flex flex-col overflow-hidden slide-in-right"
          style={{ width: 280, background: 'var(--bg-elevated)', borderColor: 'var(--separator)', animationDelay: '150ms' }}
        >
          <ControlPanel
            options={options}
            onChange={setOptions}
            onReset={() => setOptions(DEFAULT_OPTIONS)}
          />
        </div>
      </div>

      {/* Mobile layout */}
      <div className="flex md:hidden flex-col flex-1 min-h-0 overflow-hidden">
        <div className="flex flex-col flex-1 min-h-0 px-2 pt-2">
          <MediaStage ref={stageRef} options={options} onFrame={setFrame} />
        </div>

        {/* iOS-style bottom bar */}
        <div className="mobile-bar shrink-0">
          <ExportBar frame={frame} options={options} compact />
          <button
            type="button"
            onClick={() => setMobileControls(true)}
            className="fab shrink-0"
          >
            <SlidersHorizontal className="w-[18px] h-[18px]" strokeWidth={2} />
            <span>Adjust</span>
          </button>
        </div>
      </div>

      {/* Mobile controls bottom sheet */}
      <MobileSheet open={mobileControls} onClose={() => setMobileControls(false)} title="Controls">
        <ControlPanel
          options={options}
          onChange={setOptions}
          onReset={() => setOptions(DEFAULT_OPTIONS)}
        />
      </MobileSheet>

      <HelpModal open={help} onClose={() => setHelp(false)} />
      <Gallery open={gallery} onClose={() => setGallery(false)} />
    </div>
  );
}
