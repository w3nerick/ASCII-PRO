import { useMemo, useRef, useState } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { Header } from './components/Header';
import { ControlPanel } from './components/ControlPanel';
import { MediaStage, type MediaStageHandle } from './components/MediaStage';
import { ExportBar } from './components/ExportBar';
import { HelpModal } from './components/HelpModal';
import { MobileSheet } from './components/MobileSheet';
import { DEFAULT_OPTIONS, type AsciiOptions, type AsciiFrame } from './lib/asciiConverter';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { copyText } from './lib/exporters';

export default function App() {
  const [options, setOptions] = useState<AsciiOptions>(DEFAULT_OPTIONS);
  const [frame, setFrame] = useState<AsciiFrame | null>(null);
  const [help, setHelp] = useState(false);
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
      <Header onHelp={() => setHelp(true)} />

      {/* ── Desktop layout ── */}
      <div className="hidden md:flex flex-1 min-h-0">
        <div className="flex flex-col flex-1 min-w-0 p-3 gap-2">
          <MediaStage ref={stageRef} options={options} onFrame={setFrame} />
          <ExportBar frame={frame} options={options} />
        </div>
        <div
          className="shrink-0 border-l border-separator flex flex-col overflow-hidden"
          style={{ width: 272, background: 'var(--bg-elevated)' }}
        >
          <ControlPanel
            options={options}
            onChange={setOptions}
            onReset={() => setOptions(DEFAULT_OPTIONS)}
          />
        </div>
      </div>

      {/* ── Mobile layout ── */}
      <div className="flex md:hidden flex-col flex-1 min-h-0">
        <div className="flex flex-col flex-1 min-h-0 px-2 pt-2 pb-1 gap-2">
          <MediaStage ref={stageRef} options={options} onFrame={setFrame} />
        </div>
        <div
          className="flex items-center gap-2 px-3 py-2 border-t border-separator"
          style={{ background: 'var(--bg-elevated)', paddingBottom: 'max(8px, env(safe-area-inset-bottom))' }}
        >
          <ExportBar frame={frame} options={options} compact />
          <button
            type="button"
            onClick={() => setMobileControls(true)}
            className="btn btn-primary"
            style={{ minWidth: 44, minHeight: 44, borderRadius: 12 }}
          >
            <SlidersHorizontal className="w-4 h-4" strokeWidth={2} />
            <span className="text-sm font-medium">Adjust</span>
          </button>
        </div>
      </div>

      {/* ── Mobile controls bottom sheet ── */}
      <MobileSheet open={mobileControls} onClose={() => setMobileControls(false)} title="Controls">
        <ControlPanel
          options={options}
          onChange={setOptions}
          onReset={() => setOptions(DEFAULT_OPTIONS)}
        />
      </MobileSheet>

      <HelpModal open={help} onClose={() => setHelp(false)} />
    </div>
  );
}
