import { useState } from 'react';
import { Check, Copy, FileCode2, FileImage, FileText, Share2, Film, Image } from 'lucide-react';
import type { AsciiFrame, AsciiOptions } from '../lib/asciiConverter';
import {
  copyText,
  downloadHtml,
  downloadPng,
  downloadSvg,
  downloadText,
  frameToHtml,
} from '../lib/exporters';

interface Props {
  frame: AsciiFrame | null;
  options: AsciiOptions;
  compact?: boolean;
}

export function ExportBar({ frame, options, compact }: Props) {
  const [copied, setCopied] = useState(false);
  const [exporting, setExporting] = useState(false);
  const disabled = !frame;

  const exportOpts = {
    background: options.bgColor,
    foreground: options.fgColor,
    fontSize: options.fontSize,
    color: options.color,
    scale: options.exportScale,
  };

  const handleCopy = async () => {
    if (!frame) return;
    try {
      await copyText(frame);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard access denied - silently ignore
    }
  };

  const handlePreview = () => {
    if (!frame) return;
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.open();
    w.document.write(
      frameToHtml(frame, {
        background: exportOpts.background,
        foreground: exportOpts.foreground,
      }),
    );
    w.document.close();
  };

  const handleExportAnimation = async () => {
    if (!frame?.cells || exporting) return;
    setExporting(true);
    try {
      const { GifEncoder } = await import('../lib/gifEncoder');
      const { frameCanvasSize, renderFrameToCanvas } = await import('../lib/videoRecorder');
      const { CHARSETS } = await import('../lib/charsets');
      const ramp = options.charset === 'custom'
        ? options.customRamp
        : CHARSETS[options.charset as keyof typeof CHARSETS]?.ramp ?? '@%#*+=-:. ';

      const fontSize = options.fontSize * (options.exportScale || 1);
      const size = frameCanvasSize(frame, fontSize);
      const encoder = new GifEncoder(size.width, size.height, options.animSpeed || 5);
      const canvas = document.createElement('canvas');
      canvas.width = size.width; canvas.height = size.height;
      const ctx = canvas.getContext('2d')!;

      const numFrames = Math.min(30, options.animSpeed * 3);
      for (let i = 0; i < numFrames; i++) {
        const mutated = frame.cells!.map(row =>
          row.map(c => c.char === ' ' ? c : {
            ...c,
            char: Math.random() < 0.15 ? ramp[Math.floor(Math.random() * ramp.length)] : c.char,
          })
        );
        renderFrameToCanvas(ctx, { ...frame, cells: mutated }, {
          fontSize,
          bgColor: options.bgColor,
          fgColor: options.fgColor,
          color: options.color,
        });
        encoder.addFrame(ctx);
      }

      const blob = await encoder.render();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'ascii-pro-animated.webm';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } finally {
      setExporting(false);
    }
  };

  if (compact) {
    return (
      <div className="flex items-center gap-1 flex-1 min-w-0">
        <MobileAction
          icon={copied ? <Check className="w-[18px] h-[18px] text-sys-green" strokeWidth={2} /> : <Copy className="w-[18px] h-[18px]" strokeWidth={1.75} />}
          label={copied ? 'Copied' : 'Copy'}
          onClick={handleCopy}
          disabled={disabled}
          active={copied}
        />
        <MobileAction
          icon={<FileImage className="w-[18px] h-[18px]" strokeWidth={1.75} />}
          label="Save"
          onClick={() => frame && downloadPng(frame, exportOpts)}
          disabled={disabled}
        />
        <MobileAction
          icon={<FileText className="w-[18px] h-[18px]" strokeWidth={1.75} />}
          label="Text"
          onClick={() => frame && downloadText(frame)}
          disabled={disabled}
        />
        <MobileAction
          icon={<Share2 className="w-[18px] h-[18px]" strokeWidth={1.75} />}
          label="Share"
          onClick={handlePreview}
          disabled={disabled}
        />
      </div>
    );
  }

  return (
    <div className="material-thin px-3 py-2 flex items-center gap-2 flex-wrap justify-between">
      <span className="footnote text-label-tertiary px-1 hidden sm:inline">Export</span>

      <div className="flex items-center gap-1.5 flex-wrap">
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          disabled={disabled}
          onClick={handleCopy}
          title="Copy ASCII text (C)"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-sys-green" strokeWidth={2.5} />
              <span>Copied</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" strokeWidth={1.75} />
              <span>Copy</span>
            </>
          )}
        </button>

        <button
          type="button"
          className="btn btn-ghost btn-sm"
          disabled={disabled}
          onClick={() => frame && downloadText(frame)}
          title="Download .txt"
        >
          <FileText className="w-3.5 h-3.5" strokeWidth={1.75} />
          <span>Text</span>
        </button>

        <button
          type="button"
          className="btn btn-ghost btn-sm"
          disabled={disabled}
          onClick={() =>
            frame &&
            downloadHtml(frame, {
              background: exportOpts.background,
              foreground: exportOpts.foreground,
            })
          }
          title="Download .html"
        >
          <FileCode2 className="w-3.5 h-3.5" strokeWidth={1.75} />
          <span>HTML</span>
        </button>

        <button
          type="button"
          className="btn btn-ghost btn-sm"
          disabled={disabled}
          onClick={handlePreview}
          title="Open standalone preview"
        >
          <Share2 className="w-3.5 h-3.5" strokeWidth={1.75} />
          <span className="hidden sm:inline">Preview</span>
        </button>

        <div className="w-px h-4 bg-separator mx-1" />

        <button
          type="button"
          className="btn btn-grain btn-sm"
          disabled={disabled}
          onClick={() => frame && downloadPng(frame, exportOpts)}
          title="Save as PNG image"
        >
          <FileImage className="w-3.5 h-3.5 relative z-[2]" strokeWidth={1.75} />
          <span className="relative z-[2]">Save Image</span>
        </button>

        <button
          type="button"
          className="btn btn-ghost btn-sm"
          disabled={disabled}
          onClick={() => frame && downloadSvg(frame, {
            background: exportOpts.background,
            foreground: exportOpts.foreground,
            fontSize: exportOpts.fontSize,
            color: exportOpts.color,
            renderMode: options.renderMode,
          })}
          title="Download .svg (vector)"
          aria-label="Download SVG"
        >
          <Image className="w-3.5 h-3.5" strokeWidth={1.75} />
          <span>SVG</span>
        </button>

        {options.animatedAscii && (
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            disabled={disabled || exporting}
            onClick={() => frame && handleExportAnimation()}
            title="Export animated video"
            aria-label="Export animation"
          >
            <Film className="w-3.5 h-3.5" strokeWidth={1.75} />
            <span>{exporting ? 'Exporting...' : 'Anim'}</span>
          </button>
        )}
      </div>
    </div>
  );
}

function MobileAction({ icon, label, onClick, disabled, active }: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      className={`mobile-action ${active ? 'active' : ''}`}
      disabled={disabled}
      onClick={onClick}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}
