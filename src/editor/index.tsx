import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { Toaster } from '@/components/ui/sonner';
import '@/styles/globals.css';

// Suppress ResizeObserver loop warnings - this is a known browser quirk
// that occurs when ResizeObserver callbacks trigger layout changes.
// It's harmless and commonly caused by UI libraries (e.g., Radix UI) that use
// ResizeObserver internally for positioning tooltips, dropdowns, etc.
const originalError = console.error;
console.error = (...args) => {
  if (
    typeof args[0] === 'string' &&
    args[0].includes('ResizeObserver loop completed with undelivered notifications')
  ) {
    // Suppress this specific error
    return;
  }
  originalError.apply(console, args);
};

// Also handle unhandled errors
window.addEventListener('error', (event) => {
  if (
    event.message?.includes('ResizeObserver loop completed with undelivered notifications')
  ) {
    event.preventDefault();
    return false;
  }
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
    <Toaster />
  </React.StrictMode>
);

