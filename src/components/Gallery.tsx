import { useState } from 'react';
import { Trash2, X } from 'lucide-react';
import { getGallery, removeFromGallery, clearGallery, type GalleryItem } from '../lib/gallery';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function Gallery({ open, onClose }: Props) {
  const [items, setItems] = useState<GalleryItem[]>(getGallery);

  if (!open) return null;

  const handleRemove = (id: string) => {
    removeFromGallery(id);
    setItems(getGallery());
  };

  const handleClear = () => {
    clearGallery();
    setItems([]);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-lg max-h-[80vh] rounded-t-2xl md:rounded-2xl overflow-hidden flex flex-col"
        style={{ background: 'var(--bg-elevated)', border: '0.5px solid var(--separator)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'var(--separator)' }}>
          <span className="title-3">Gallery</span>
          <div className="flex items-center gap-2">
            {items.length > 0 && (
              <button type="button" onClick={handleClear} className="btn btn-ghost btn-sm text-sys-red">
                <Trash2 className="w-3.5 h-3.5" strokeWidth={2} />
                <span>Clear</span>
              </button>
            )}
            <button type="button" onClick={onClose} className="btn btn-ghost btn-sm btn-icon">
              <X className="w-4 h-4" strokeWidth={2} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          {items.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-label-tertiary subhead">
              No saved images yet
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {items.map(item => (
                <div key={item.id} className="relative group rounded-lg overflow-hidden aspect-square">
                  <img src={item.thumbnail} alt="" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => handleRemove(item.id)}
                    className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/70 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-3 h-3 text-white" strokeWidth={2.5} />
                  </button>
                  {item.preset && (
                    <span className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded bg-black/60 text-white text-[9px] font-medium">
                      {item.preset}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
