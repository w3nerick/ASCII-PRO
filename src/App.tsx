import { useMemo, useRef, useState } from 'react';
import { Header } from './components/Header';
import { ControlPanel } from './components/ControlPanel';
import { MediaStage, type MediaStageHandle } from './components/MediaStage';
import { ExportBar } from './components/ExportBar';
import { PresetBar } from './components/PresetBar';
import { HelpModal } from './components/HelpModal';
import { DEFAULT_OPTIONS, type AsciiOptions, type AsciiFrame } from './lib/asciiConverter';
import { PRESETS } from './lib/presets';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { copyText } from './lib/exporters';

export default function App() {
  const [options, setOptions] = useState<AsciiOptions>(DEFAULT_OPTIONS);
  const [frame, setFrame] = useState<AsciiFrame | null>(null);
  const [help, setHelp] = useState(false);
  const stageRef = useRef<MediaStageHandle | null>(null);



  const shortcuts = useMemo(
    () => ({
      '1': () => setOptions((o) => PRESETS[0]?.apply(o) ?? o),
      '2': () => setOptions((o) => PRESETS[1]?.apply(o) ?? o),
      '3': () => setOptions((o) => PRESETS[2]?.apply(o) ?? o),
      '4': () => setOptions((o) => PRESETS[3]?.apply(o) ?? o),
      '5': () => setOptions((o) => PRESETS[4]?.apply(o) ?? o),
      '6': () => setOptions((o) => PRESETS[5]?.apply(o) ?? o),
      d: () => stageRef.current?.loadDemo(),
      w: () => stageRef.current?.startWebcam(),
      ' ': () => stageRef.current?.togglePlay(),
      r: () => stageRef.current?.toggleRecord(),
      f: () => stageRef.current?.toggleFullscreen(),
      escape: () => {
        if (help) setHelp(false);
        else stageRef.current?.reset();
      },
      c: () => { if (frame) void copyText(frame); },
      i: () => setOptions((o) => ({ ...o, invert: !o.invert })),
      m: () => setOptions((o) => ({ ...o, color: !o.color })),
      '?': () => setHelp((v) => !v),
      '/': () => setHelp((v) => !v),
    }),
    [frame, help],
  );
  useKeyboardShortcuts(shortcuts);



  return (
    <div className="min-h-screen flex flex-col">
      <Header onHelp={() => setHelp(true)} />

      <main className="flex-1 max-w-[1400px] w-full mx-auto px-4 md:px-6 py-6 md:py-8 grid gap-6 lg:grid-cols-[340px_1fr]">
        {/* Sidebar */}
        <aside className="lg:sticky lg:top-[72px] lg:self-start lg:max-h-[calc(100vh-88px)] lg:overflow-y-auto lg:-mx-2 lg:px-2 order-2 lg:order-1 fade-in-up">
          <ControlPanel
            options={options}
            onChange={setOptions}
            onReset={() => setOptions(DEFAULT_OPTIONS)}
          />
        </aside>

        {/* Stage + actions */}
        <section className="flex flex-col gap-3 min-h-[60vh] order-1 lg:order-2 fade-in-up">
          <PresetBar current={options} onApply={setOptions} />
          <MediaStage ref={stageRef} options={options} onFrame={setFrame} />
          <ExportBar frame={frame} options={options} />
        </section>
      </main>

      <footer className="max-w-[1400px] w-full mx-auto px-6 py-6 flex items-center justify-between flex-wrap gap-2 text-label-tertiary footnote">
        <span>
          ASCII Pro · {new Date().getFullYear()}
        </span>
        <span>All processing runs on your device.</span>
      </footer>

      <HelpModal open={help} onClose={() => setHelp(false)} />
    </div>
  );
}
