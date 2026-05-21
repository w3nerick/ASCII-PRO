import { useState } from 'react';
import { Check, Copy, FileCode2, FileImage, FileText, Share2 } from 'lucide-react';
import type { AsciiFrame, AsciiOptions } from '../lib/asciiConverter';
import {
  copyText,
  downloadHtml,
  downloadPng,
  downloadText,
  frameToHtml,
} from '../lib/exporters';

interface Props {
  frame: AsciiFrame | null;
  options: AsciiOptions;
}

/**
 * Apple-style export toolbar. Primary action (Save image) uses accent blue,
 * secondary actions are ghost-styled. Copy gives a tactile check confirmation.
 */
export function ExportBar({ frame, options }: Props) {
  const [copied, setCopied] = useState(false);
  const disabled = !frame;

  const exportOpts = {
    background: options.bgColor,
    foreground: options.fgColor,
    fontSize: options.fontSize,
    color: options.color,
  };

  const handleCopy = async () => {
    if (!frame) return;
    await copyText(frame);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
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

  return (
    <div className="material-thin px-3 py-2 flex items-center gap-2 flex-wrap justify-between">
      <span className="callout text-label-tertiary px-1 hidden sm:inline">Export</span>

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
              Copied
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" strokeWidth={2} />
              Copy
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
          <FileText className="w-3.5 h-3.5" strokeWidth={2} />
          Text
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
          <FileCode2 className="w-3.5 h-3.5" strokeWidth={2} />
          HTML
        </button>

        <button
          type="button"
          className="btn btn-ghost btn-sm"
          disabled={disabled}
          onClick={handlePreview}
          title="Open standalone preview"
        >
          <Share2 className="w-3.5 h-3.5" strokeWidth={2} />
          <span className="hidden sm:inline">Preview</span>
        </button>

        <div className="w-px h-5 bg-separator mx-1" />

        <button
          type="button"
          className="btn btn-primary btn-sm"
          disabled={disabled}
          onClick={() => frame && downloadPng(frame, exportOpts)}
          title="Save as PNG image"
        >
          <FileImage className="w-3.5 h-3.5" strokeWidth={2} />
          Save Image
        </button>
      </div>
    </div>
  );
}
