import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles/studio.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

if (import.meta.env.DEV) {
  // Dev-only automation hooks (stripped from production builds).
  Promise.all([import('./state/store'), import('./state/source'), import('./state/renderer'), import('./state/actions')]).then(([store, source, renderer, actions]) => {
    (window as unknown as Record<string, unknown>).__ap = { store, source, renderer, actions };
  });
}
