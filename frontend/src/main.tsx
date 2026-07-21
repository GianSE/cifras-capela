import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { App } from './App';
import { bootstrapTheme } from '@/hooks/useTheme';
import './index.css';

// Aplica o tema salvo antes da primeira renderização (evita flash).
bootstrapTheme();

// PWA: quando um novo service worker assume (novo deploy), recarrega uma vez
// para pegar o build novo — evita ficar preso numa versão antiga em cache.
// Ignora a primeira instalação (quando ainda não havia SW controlando a página).
if ('serviceWorker' in navigator) {
  const hadController = Boolean(navigator.serviceWorker.controller);
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading || !hadController) return;
    reloading = true;
    window.location.reload();
  });
}

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Root element not found');
}

createRoot(rootElement).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
