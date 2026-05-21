import { useMemo, useRef, useState } from 'react';
import { Header } from './components/Header';
import { ControlPanel } from './components/ControlPanel';
import { MediaStage, type MediaStageHandle } from './components/MediaStage';
import { ExportBar } from './components/ExportBar';
import { HelpModal } from './components/HelpModal';
import { DEFAULT_OPTIONS, type AsciiOptions, type AsciiFrame } from './lib/asciiConverter';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { copyText } from './lib/exporters';

export default function App() {
  const [options, setOptions] = useState<AsciiOptions>(DEFAULT_OPTIONS);
  const [frame, setFrame] = useState<AsciiFrame | null>(null);
  const [help, setHelp] = useState(false);
  const stageRef = useRef<MediaStageHandle | null>(null);

  const shortcuts = useMemo(() => ({
    ' ': () => stageRef.current?.togglePlay(),
    r: () => stageRef.current?.toggleRecord(),
    f: () => stageRef.current?.toggleFullscreen(),
    d: () => stageRef.current?.loadDemo(),
    w: () => stageRef.current?.startWebcam(),
    escape: () => { if (help) setHelp(false); else stageRef.current?.reset(); },
    c: () => { if (frame) void copyText(frame); },
    i: () => setOptions(o => ({ ...o, invert: !o.invert })),
    m: () => setOptions(o => ({ ...o, color: !o.color })),
    '?': () => setHelp(v => !v),
  }), [frame, help]);
  useKeyboardShortcuts(shortcuts);

  return (
    <div className="flex flex-col" style={{ height: '100vh', background: 'var(--bg)', overflow: 'hidden' }}>
      <Header onHelp={() => setHelp(true)} />

      <div className="flex flex-1 min-h-0">
        {/* ── Canvas Stage ── */}
        <div className="flex flex-col flex-1 min-w-0 p-3 gap-2">
          <MediaStage ref={stageRef} options={options} onFrame={setFrame} />
          <ExportBar frame={frame} options={options} />
        </div>

        {/* ── Right Panel ── */}
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

      <HelpModal open={help} onClose={() => setHelp(false)} />
    </div>
  );
}
