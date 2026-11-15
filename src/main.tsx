import '@fontsource/bowlby-one';
import '@fontsource-variable/bitter';
import './index.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import App from './App.tsx';

const rootElement = document.getElementById('root');

if (rootElement === null) {
  throw new Error('Elemento #root não encontrado em index.html.');
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
