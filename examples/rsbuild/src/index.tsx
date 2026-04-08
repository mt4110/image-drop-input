import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';

const container = document.getElementById('root');

if (!container) {
  throw new Error('The root container was not found.');
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>
);
