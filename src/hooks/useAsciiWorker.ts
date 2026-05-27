import { useCallback, useEffect, useRef } from 'react';
import type { AsciiFrame, AsciiOptions } from '../lib/asciiConverter';
import type { WorkerRequest, WorkerResponse } from '../lib/asciiWorker';

const CHAR_ASPECT = 0.5;

export function useAsciiWorker(onResult: (frame: AsciiFrame) => void) {
  const workerRef = useRef<Worker | null>(null);
  const idRef = useRef(0);
  const callbackRef = useRef(onResult);
  callbackRef.current = onResult;

  useEffect(() => {
    const worker = new Worker(
      new URL('../lib/asciiWorker.ts', import.meta.url),
      { type: 'module' }
    );
    worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
      const { id: _id, ...frameData } = e.data;
      callbackRef.current({
        text: frameData.text,
        cells: frameData.cells ?? undefined,
        cols: frameData.cols,
        rows: frameData.rows,
      });
    };
    workerRef.current = worker;
    return () => { worker.terminate(); };
  }, []);

  const convert = useCallback((
    source: CanvasImageSource,
    sourceWidth: number,
    sourceHeight: number,
    options: AsciiOptions,
  ) => {
    const worker = workerRef.current;
    if (!worker) return;

    const cols = Math.max(8, Math.min(400, Math.floor(options.width)));
    const densityFactor = Math.max(0.3, Math.min(2.5, options.density));
    let aspect: number;
    if (options.aspectRatio !== 'free') {
      const [aw, ah] = options.aspectRatio.split(':').map(Number);
      aspect = ah / aw;
    } else {
      aspect = sourceHeight / sourceWidth;
    }
    const rows = Math.max(4, Math.floor(cols * aspect * CHAR_ASPECT * densityFactor));

    const canvas = document.createElement('canvas');
    canvas.width = cols;
    canvas.height = rows;
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    ctx.imageSmoothingEnabled = true;

    const satPct = 100 + options.saturation;
    const filters: string[] = [];
    if (options.blur > 0) filters.push(`blur(${options.blur}px)`);
    if (satPct !== 100) filters.push(`saturate(${satPct}%)`);
    ctx.filter = filters.length ? filters.join(' ') : 'none';
    ctx.drawImage(source, 0, 0, cols, rows);
    ctx.filter = 'none';

    const imageData = ctx.getImageData(0, 0, cols, rows);

    const id = ++idRef.current;
    const req: WorkerRequest = {
      id,
      imageData: imageData.data,
      width: sourceWidth,
      height: sourceHeight,
      cols,
      rows,
      charset: options.charset,
      customRamp: options.customRamp,
      invert: options.invert,
      color: options.color,
      brightness: options.brightness,
      contrast: options.contrast,
      saturation: options.saturation,
      colorEnhance: options.colorEnhance,
      blur: options.blur,
      edges: options.edges,
      edgeThreshold: options.edgeThreshold,
      dithering: options.dithering,
      coverage: options.coverage,
      density: options.density,
    };

    worker.postMessage(req, [imageData.data.buffer]);
  }, []);

  return convert;
}
