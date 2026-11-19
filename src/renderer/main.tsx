import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import type { FocusGardenBridge } from '../shared/bridge';
import { App } from './App';
import './styles.css';

declare global {
  interface Window {
    focusGarden: FocusGardenBridge;
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App bridge={window.focusGarden} />
  </StrictMode>,
);
