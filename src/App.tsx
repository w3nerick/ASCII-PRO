import { useEffect } from 'react';
import { Palette, SlidersHorizontal, Upload, Download } from 'lucide-react';
import { TopBar } from './ui/TopBar';
import { StylesPanel } from './ui/StylesPanel';
import { Stage } from './ui/Stage';
import { RightRail, Dock } from './ui/Dock';
import { RecipesModal, LibraryModal, HelpModal, AllStylesModal, Toast } from './ui/Modals';
import { FlowView } from './ui/FlowView';
import { getState, redo, replaceLook, setUi, toast, undo, useStore } from './state/store';
import { loadFile, inspire, setVideoPlaying } from './state/source';
import { restyle, shuffle, stepStyle } from './state/actions';
import { decodeRecipe, recipeFromHash } from './state/recipes';
import { addText } from './ui/overlays/TextOverlay';
import { pickFile } from './ui/filePicker';
import { patchLook } from './state/store';

function useGlobalInput() {
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      if ((e.target as HTMLElement)?.closest?.('input,textarea')) return;
      const item = Array.from(e.clipboardData?.items || []).find((i) => i.type.startsWith('image/') || i.type.startsWith('video/'));
      const f = item?.getAsFile();
      if (f) {
        e.preventDefault();
        loadFile(f);
      }
    };
    const onDragOver = (e: DragEvent) => e.preventDefault();
    const onDrop = (e: DragEvent) => {
      e.preventDefault();
      const f = e.dataTransfer?.files?.[0];
      if (f) loadFile(f);
    };
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t?.closest?.('input,textarea,select,[contenteditable]')) return;
      const s = getState();
      const mod = e.metaKey || e.ctrlKey;
      const k = e.key.toLowerCase();
      if (mod && k === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if (mod && k === 'y') {
        e.preventDefault();
        redo();
        return;
      }
      if (mod && e.key === '\\') {
        e.preventDefault();
        const open = s.ui.leftOpen || s.ui.rightOpen;
        setUi({ leftOpen: !open, rightOpen: !open });
        return;
      }
      if (mod || e.altKey) return;
      if (s.ui.modal) return;
      const hasSrc = !!s.source;
      switch (k) {
        case 'escape':
          setUi({ tool: 'none', exportOpen: false, selectedText: null, compare: false });
          break;
        case 'o':
          pickFile();
          break;
        case 'i':
          inspire();
          break;
        case 'r':
          if (hasSrc) restyle();
          break;
        case 's':
          if (hasSrc) shuffle();
          break;
        case '[':
          stepStyle(-1);
          break;
        case ']':
          stepStyle(1);
          break;
        case 'e':
          if (hasSrc) setUi({ exportOpen: !s.ui.exportOpen });
          break;
        case 'b':
          if (hasSrc) setUi({ compare: !s.ui.compare });
          break;
        case 'c':
          if (hasSrc && s.ui.mode === 'studio') setUi({ tool: s.ui.tool === 'crop' ? 'none' : 'crop' });
          break;
        case 't':
          if (hasSrc && s.ui.mode === 'studio') (s.ui.tool === 'text' ? setUi({ tool: 'none' }) : addText());
          break;
        case 'm':
          if (hasSrc) {
            const on = !(s.ui.tool === 'mask');
            if (on) patchLook('mask', { enabled: true });
            setUi({ tool: on ? 'mask' : 'none', rightTab: 'mask', rightOpen: true });
          }
          break;
        case 'k': {
          const playing = !s.ui.playing;
          setUi({ playing });
          setVideoPlaying(playing);
          break;
        }
        case 'f':
          setUi({ zoom: 0 });
          break;
        case '=':
        case '+':
          setUi({ zoom: Math.min(800, Math.round((s.ui.zoom || 100) * 1.25)) });
          break;
        case '-':
          setUi({ zoom: Math.max(10, Math.round((s.ui.zoom || 100) / 1.25)) });
          break;
        default:
          return;
      }
      e.preventDefault();
    };
    window.addEventListener('paste', onPaste);
    window.addEventListener('dragover', onDragOver);
    window.addEventListener('drop', onDrop);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('paste', onPaste);
      window.removeEventListener('dragover', onDragOver);
      window.removeEventListener('drop', onDrop);
      window.removeEventListener('keydown', onKey);
    };
  }, []);
}

function useRecipeFromUrl() {
  useEffect(() => {
    const code = recipeFromHash();
    if (!code) return;
    decodeRecipe(code).then((look) => {
      if (look) {
        replaceLook(look);
        toast('Recipe loaded — drop your image to apply it');
      } else toast('Recipe link is invalid');
      history.replaceState(null, '', location.pathname + location.search);
    });
  }, []);
}

export default function App() {
  useGlobalInput();
  useRecipeFromUrl();
  const ui = useStore((s) => s.ui);
  const cls = ['app', ui.mode === 'flow' ? 'flow-mode' : '', ui.leftOpen ? '' : 'left-closed', ui.rightOpen ? '' : 'right-closed', ui.mobilePanel ? `m-${ui.mobilePanel}` : ''].join(' ');
  return (
    <div className={cls}>
      <TopBar />
      <div className="main">
        {ui.leftOpen || ui.mobilePanel === 'styles' ? <StylesPanel /> : <div />}
        {ui.mode === 'flow' ? <FlowView /> : <Stage />}
        <RightRail />
        {ui.rightOpen || ui.mobilePanel === 'settings' ? <Dock /> : <div />}
      </div>
      <nav className="mobile-tabs" aria-label="Mobile navigation">
        <button className={ui.mobilePanel === 'styles' ? 'on' : ''} onClick={() => setUi({ mobilePanel: ui.mobilePanel === 'styles' ? null : 'styles', leftOpen: true })}><Palette size={18} />Styles</button>
        <button className={ui.mobilePanel === 'settings' ? 'on' : ''} onClick={() => setUi({ mobilePanel: ui.mobilePanel === 'settings' ? null : 'settings', rightOpen: true })}><SlidersHorizontal size={18} />Adjust</button>
        <button onClick={() => { setUi({ mobilePanel: null }); pickFile(); }}><Upload size={18} />Upload</button>
        <button onClick={() => setUi({ mobilePanel: null, exportOpen: !ui.exportOpen })}><Download size={18} />Export</button>
      </nav>
      {ui.modal === 'recipes' && <RecipesModal />}
      {ui.modal === 'library' && <LibraryModal />}
      {ui.modal === 'help' && <HelpModal />}
      {ui.modal === 'allStyles' && <AllStylesModal />}
      <Toast />
    </div>
  );
}
