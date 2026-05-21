import type { AsciiFrame, AsciiOptions } from './asciiConverter';
import { bestVideoMime } from './exporters';

/**
 * Render a single ASCII frame onto a canvas with the configured colors.
 * Used both by the live recorder and the PNG exporter.
 */
export function renderFrameToCanvas(
  ctx: CanvasRenderingContext2D,
  frame: AsciiFrame,
  options: { fontSize: number; bgColor: string; fgColor: string; color: boolean },
) {
  const { fontSize, bgColor, fgColor, color } = options;
  const charW = fontSize * 0.6;
  const lineH = fontSize;
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;

  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, w, h);
  ctx.font = `${fontSize}px "Share Tech Mono", ui-monospace, monospace`;
  ctx.textBaseline = 'top';

  if (color && frame.cells) {
    for (let y = 0; y < frame.cells.length; y++) {
      const row = frame.cells[y];
      for (let x = 0; x < row.length; x++) {
        const c = row[x];
        ctx.fillStyle = `rgb(${c.r},${c.g},${c.b})`;
        ctx.fillText(c.char, x * charW, y * lineH);
      }
    }
  } else {
    ctx.fillStyle = fgColor;
    const lines = frame.text.split('\n');
    for (let y = 0; y < lines.length; y++) {
      ctx.fillText(lines[y], 0, y * lineH);
    }
  }
}

export function frameCanvasSize(frame: AsciiFrame, fontSize: number) {
  return {
    width: Math.max(8, Math.ceil(frame.cols * fontSize * 0.6)),
    height: Math.max(8, Math.ceil(frame.rows * fontSize)),
  };
}

/**
 * Records the live ASCII output to a WEBM video using MediaRecorder
 * + canvas.captureStream(). Works fully client-side.
 */
export class AsciiVideoRecorder {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private recorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private fps: number;
  private opts: AsciiOptions;
  private mime: string;
  private ext: string;

  constructor(initialFrame: AsciiFrame, opts: AsciiOptions, fps = 24) {
    this.fps = fps;
    this.opts = opts;
    const size = frameCanvasSize(initialFrame, opts.fontSize);
    this.canvas = document.createElement('canvas');
    this.canvas.width = size.width;
    this.canvas.height = size.height;
    this.ctx = this.canvas.getContext('2d')!;
    const best = bestVideoMime();
    this.mime = best.mime;
    this.ext = best.ext;
    renderFrameToCanvas(this.ctx, initialFrame, this.opts);
  }

  getExt(): string { return this.ext; }

  start() {
    const stream = this.canvas.captureStream(this.fps);
    this.recorder = new MediaRecorder(stream, {
      mimeType: this.mime,
      videoBitsPerSecond: 4_000_000,
    });
    this.chunks = [];
    this.recorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.chunks.push(e.data);
    };
    this.recorder.start(250);
  }

  /** Push a new frame to the recording. */
  pushFrame(frame: AsciiFrame, opts: AsciiOptions) {
    this.opts = opts;
    const size = frameCanvasSize(frame, opts.fontSize);
    if (this.canvas.width !== size.width || this.canvas.height !== size.height) {
      this.canvas.width = size.width;
      this.canvas.height = size.height;
    }
    renderFrameToCanvas(this.ctx, frame, this.opts);
  }

  stop(): Promise<Blob> {
    return new Promise((resolve) => {
      if (!this.recorder) {
        resolve(new Blob(this.chunks, { type: this.mime }));
        return;
      }
      this.recorder.onstop = () => {
        resolve(new Blob(this.chunks, { type: this.mime }));
      };
      this.recorder.stop();
    });
  }

  isRecording(): boolean {
    return this.recorder?.state === 'recording';
  }
}
