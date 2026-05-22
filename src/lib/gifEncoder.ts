export class GifEncoder {
  private width: number;
  private height: number;
  private frames: ImageData[] = [];
  private delay: number;

  constructor(width: number, height: number, fps = 10) {
    this.width = width;
    this.height = height;
    this.delay = Math.round(1000 / fps);
  }

  addFrame(ctx: CanvasRenderingContext2D) {
    this.frames.push(ctx.getImageData(0, 0, this.width, this.height));
  }

  async render(): Promise<Blob> {
    const canvas = new OffscreenCanvas(this.width, this.height);
    const ctx = canvas.getContext('2d')!;
    const stream = (canvas as unknown as { captureStream(fps: number): MediaStream }).captureStream(0);
    const track = stream.getVideoTracks()[0] as unknown as { requestFrame?: () => void };

    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
      ? 'video/webm;codecs=vp9' : 'video/webm';

    const recorder = new MediaRecorder(stream, { mimeType });
    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };

    const done = new Promise<Blob>((resolve) => {
      recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType }));
    });

    recorder.start();

    for (const frame of this.frames) {
      ctx.putImageData(frame, 0, 0);
      if (track.requestFrame) track.requestFrame();
      await new Promise(r => setTimeout(r, this.delay));
    }

    recorder.stop();
    return done;
  }
}
