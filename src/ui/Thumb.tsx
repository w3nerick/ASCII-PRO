import { useEffect, useReducer, useState } from 'react';
import type { Look } from '../engine/types';
import { thumbs } from '../state/renderer';
import { useStore } from '../state/store';
import { useInView } from './controls';
import type { Generator } from '../state/source';
import { DEMO_GALLERY } from '../lib/demoImage';

export function Thumb({ thumbKey, look, icon }: { thumbKey: string; look: Look; icon?: string }) {
  const [ref, seen] = useInView<HTMLDivElement>('300px');
  const source = useStore((s) => s.source);
  const [, force] = useReducer((x: number) => x + 1, 0);
  useEffect(() => {
    if (!seen) return;
    const off = thumbs.request(thumbKey, look, force);
    return () => {
      off();
    };
  }, [seen, thumbKey, look, source]);
  const url = thumbs.get(thumbKey);
  return (
    <div className="card-thumb" ref={ref}>
      {url ? <img src={url} alt="" className="ready" draggable={false} /> : <div className="ph loading">{icon}</div>}
    </div>
  );
}

const genCache = new Map<string, string>();
const genPending = new Map<string, Promise<string>>();

async function genThumb(g: Generator): Promise<string> {
  const hit = genCache.get(g.id);
  if (hit) return hit;
  let p = genPending.get(g.id);
  if (!p) {
    p = (async () => {
      let img: HTMLImageElement;
      if (g.kind === 'lumen') {
        const { renderLumenMode } = await import('../lib/lumenRenderer');
        img = await renderLumenMode(g.index, 320, 220);
      } else {
        const demo = DEMO_GALLERY.find((d) => d.id === g.id)!;
        img = await demo.generate();
      }
      genCache.set(g.id, img.src);
      return img.src;
    })();
    genPending.set(g.id, p);
  }
  return p;
}

export function GenThumb({ gen }: { gen: Generator }) {
  const [ref, seen] = useInView<HTMLDivElement>('200px');
  const [url, setUrl] = useState<string | null>(genCache.get(gen.id) || null);
  useEffect(() => {
    if (!seen || url) return;
    let alive = true;
    genThumb(gen).then((u) => alive && setUrl(u)).catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [seen, url, gen]);
  return (
    <div className="card-thumb" ref={ref}>
      {url ? <img src={url} alt="" className="ready" draggable={false} /> : <div className="ph loading">✦</div>}
    </div>
  );
}
