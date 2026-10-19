import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import ErrorBoundary from './components/ErrorBoundary.tsx';
import './index.css';

// Prevent unhandled promise rejections or dynamic import errors from crashing the page silently
window.addEventListener('unhandledrejection', (event) => {
  console.warn('[Global Unhandled Rejection]:', event.reason);
});

window.addEventListener('error', (event) => {
  console.warn('[Global Window Error]:', event.error || event.message);
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary fallbackTitle="Aplikasi Berhasil Diamankan">
      <App />
    </ErrorBoundary>
  </StrictMode>,
);

