/**
 * Built-in demo images so visitors can try the tool without uploading anything.
 * Each generates a procedural canvas for full client-side independence.
 */

function createCanvasImage(draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void, w = 720, h = 480): Promise<HTMLImageElement> {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!;
    draw(ctx, w, h);
    canvas.toBlob((blob) => {
      const url = URL.createObjectURL(blob!);
      const img = new Image();
      img.onload = () => resolve(img);
      img.src = url;
    }, 'image/png');
  });
}

export interface DemoEntry {
  id: string;
  label: string;
  generate: () => Promise<HTMLImageElement>;
}

export const DEMO_GALLERY: DemoEntry[] = [
  {
    id: 'synthwave',
    label: 'SYNTHWAVE',
    generate: () => createCanvasImage((ctx, w, h) => {
      // Sunset gradient sky
      const sky = ctx.createLinearGradient(0, 0, 0, h * 0.75);
      sky.addColorStop(0, '#0a0420');
      sky.addColorStop(0.5, '#ff2bd6');
      sky.addColorStop(0.85, '#ffae00');
      sky.addColorStop(1, '#fff200');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, w, h);

      // Sun
      const sunY = h * 0.72;
      const sunGrad = ctx.createRadialGradient(w / 2, sunY, 8, w / 2, sunY, 140);
      sunGrad.addColorStop(0, '#fff8a0');
      sunGrad.addColorStop(0.4, '#ffae00');
      sunGrad.addColorStop(1, 'rgba(255,43,214,0)');
      ctx.fillStyle = sunGrad;
      ctx.beginPath();
      ctx.arc(w / 2, sunY, 140, 0, Math.PI * 2);
      ctx.fill();

      // Sun horizontal cuts
      ctx.fillStyle = '#0a0420';
      for (let i = 0; i < 6; i++) {
        const y = sunY + 30 + i * 14;
        ctx.fillRect(w / 2 - 140, y, 280, 4 + i);
      }

      // Ground
      ctx.fillStyle = '#120428';
      ctx.fillRect(0, h * 0.75, w, h * 0.25);

      // Grid lines
      ctx.strokeStyle = '#ff2bd6';
      ctx.lineWidth = 1.5;
      const horizon = h * 0.75;
      for (let i = 1; i <= 8; i++) {
        const t = i / 8;
        const y = horizon + Math.pow(t, 1.7) * (h - horizon);
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }
      const cx = w / 2;
      for (let i = -10; i <= 10; i++) {
        const xBottom = cx + i * (w / 4);
        ctx.beginPath();
        ctx.moveTo(cx, horizon);
        ctx.lineTo(xBottom, h);
        ctx.stroke();
      }

      // Mountain silhouette
      ctx.fillStyle = '#0a0014';
      ctx.beginPath();
      ctx.moveTo(0, horizon);
      const peaks = [0.05, 0.15, 0.28, 0.4, 0.52, 0.62, 0.7, 0.82, 0.92, 1];
      const heights = [0.62, 0.55, 0.68, 0.5, 0.6, 0.5, 0.66, 0.55, 0.7, 0.58];
      peaks.forEach((p, i) => ctx.lineTo(p * w, heights[i] * h));
      ctx.lineTo(w, horizon);
      ctx.closePath();
      ctx.fill();

      // Stars
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      for (let i = 0; i < 60; i++) {
        const x = Math.random() * w;
        const y = Math.random() * (h * 0.45);
        ctx.beginPath();
        ctx.arc(x, y, Math.random() * 1.5 + 0.3, 0, Math.PI * 2);
        ctx.fill();
      }
    }),
  },
  {
    id: 'portrait',
    label: 'FACE',
    generate: () => createCanvasImage((ctx, w, h) => {
      // Abstract face using gradients and shapes
      ctx.fillStyle = '#1a1a2e';
      ctx.fillRect(0, 0, w, h);

      // Head shape
      const headGrad = ctx.createRadialGradient(w / 2, h * 0.45, 50, w / 2, h * 0.45, 180);
      headGrad.addColorStop(0, '#f4c2a0');
      headGrad.addColorStop(0.7, '#d4956a');
      headGrad.addColorStop(1, '#2a1a0e');
      ctx.fillStyle = headGrad;
      ctx.beginPath();
      ctx.ellipse(w / 2, h * 0.45, 140, 180, 0, 0, Math.PI * 2);
      ctx.fill();

      // Eyes
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(w / 2 - 50, h * 0.38, 22, 14, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(w / 2 + 50, h * 0.38, 22, 14, 0, 0, Math.PI * 2);
      ctx.fill();

      // Pupils
      ctx.fillStyle = '#2a1a0e';
      ctx.beginPath();
      ctx.arc(w / 2 - 50, h * 0.38, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(w / 2 + 50, h * 0.38, 10, 0, Math.PI * 2);
      ctx.fill();

      // Nose shadow
      ctx.fillStyle = 'rgba(100,60,30,0.4)';
      ctx.beginPath();
      ctx.moveTo(w / 2, h * 0.42);
      ctx.lineTo(w / 2 - 12, h * 0.54);
      ctx.lineTo(w / 2 + 12, h * 0.54);
      ctx.closePath();
      ctx.fill();

      // Mouth
      ctx.strokeStyle = '#8b4040';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(w / 2, h * 0.58, 30, 0.1 * Math.PI, 0.9 * Math.PI);
      ctx.stroke();

      // Hair
      ctx.fillStyle = '#1a0a00';
      ctx.beginPath();
      ctx.ellipse(w / 2, h * 0.26, 155, 100, 0, Math.PI, 0);
      ctx.fill();

      // Neon frame
      ctx.strokeStyle = '#00fff5';
      ctx.lineWidth = 3;
      ctx.strokeRect(60, 30, w - 120, h - 60);
      ctx.strokeStyle = '#ff2bd6';
      ctx.lineWidth = 1;
      ctx.strokeRect(65, 35, w - 130, h - 70);
    }),
  },
  {
    id: 'cityscape',
    label: 'CITY',
    generate: () => createCanvasImage((ctx, w, h) => {
      // Night city skyline
      const skyGrad = ctx.createLinearGradient(0, 0, 0, h);
      skyGrad.addColorStop(0, '#0a0025');
      skyGrad.addColorStop(0.6, '#1a0040');
      skyGrad.addColorStop(1, '#0d0020');
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, w, h);

      // Stars
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      for (let i = 0; i < 80; i++) {
        ctx.beginPath();
        ctx.arc(Math.random() * w, Math.random() * h * 0.5, Math.random() + 0.3, 0, Math.PI * 2);
        ctx.fill();
      }

      // Buildings
      const buildingColors = ['#0d0d1a', '#141428', '#1a1a33', '#0a0a1e'];
      for (let i = 0; i < 30; i++) {
        const bw = 20 + Math.random() * 60;
        const bh = 80 + Math.random() * 300;
        const bx = Math.random() * w;
        const by = h - bh;
        ctx.fillStyle = buildingColors[i % buildingColors.length];
        ctx.fillRect(bx, by, bw, bh);

        // Windows
        ctx.fillStyle = Math.random() > 0.5 ? '#fff200' : '#00fff5';
        for (let wy = by + 10; wy < h - 10; wy += 18) {
          for (let wx = bx + 5; wx < bx + bw - 5; wx += 12) {
            if (Math.random() > 0.4) {
              ctx.globalAlpha = 0.3 + Math.random() * 0.7;
              ctx.fillRect(wx, wy, 5, 8);
            }
          }
        }
        ctx.globalAlpha = 1;
      }

      // Road reflection
      ctx.fillStyle = '#0a0a14';
      ctx.fillRect(0, h - 40, w, 40);
      ctx.strokeStyle = '#ff2bd6';
      ctx.lineWidth = 2;
      ctx.setLineDash([20, 15]);
      ctx.beginPath();
      ctx.moveTo(0, h - 20);
      ctx.lineTo(w, h - 20);
      ctx.stroke();
      ctx.setLineDash([]);

      // Neon signs
      ctx.font = 'bold 28px monospace';
      ctx.fillStyle = '#ff2bd6';
      ctx.shadowColor = '#ff2bd6';
      ctx.shadowBlur = 15;
      ctx.fillText('CYBER', 100, h - 120);
      ctx.fillStyle = '#00fff5';
      ctx.shadowColor = '#00fff5';
      ctx.fillText('NIGHT', w - 200, h - 180);
      ctx.shadowBlur = 0;
    }),
  },
  {
    id: 'geometric',
    label: 'SHAPES',
    generate: () => createCanvasImage((ctx, w, h) => {
      ctx.fillStyle = '#0a0020';
      ctx.fillRect(0, 0, w, h);

      // Concentric circles
      for (let r = 200; r > 10; r -= 15) {
        ctx.strokeStyle = r % 30 === 0 ? '#00fff5' : '#ff2bd6';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(w / 2, h / 2, r, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Triangle
      ctx.strokeStyle = '#fff200';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(w / 2, h * 0.2);
      ctx.lineTo(w * 0.25, h * 0.75);
      ctx.lineTo(w * 0.75, h * 0.75);
      ctx.closePath();
      ctx.stroke();

      // Diamond
      ctx.fillStyle = 'rgba(57, 255, 20, 0.3)';
      ctx.beginPath();
      ctx.moveTo(w / 2, h * 0.15);
      ctx.lineTo(w * 0.7, h / 2);
      ctx.lineTo(w / 2, h * 0.85);
      ctx.lineTo(w * 0.3, h / 2);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#39ff14';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Scattered dots
      for (let i = 0; i < 100; i++) {
        const x = Math.random() * w;
        const y = Math.random() * h;
        const s = Math.random() * 6 + 2;
        ctx.fillStyle = ['#00fff5', '#ff2bd6', '#fff200', '#39ff14'][i % 4];
        ctx.globalAlpha = 0.5 + Math.random() * 0.5;
        ctx.fillRect(x, y, s, s);
      }
      ctx.globalAlpha = 1;
    }),
  },
];

/** Legacy single demo for backwards compat. */
export function generateDemoImage(): Promise<HTMLImageElement> {
  return DEMO_GALLERY[0].generate();
}
