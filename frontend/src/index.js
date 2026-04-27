import React from "react";
import ReactDOM from "react-dom/client";
import "@/index.css";
import App from "@/App";
import { bootstrapLanguage } from "@/lib/languageBootstrap";

// Completely disable React Error Overlay for cross-origin Script errors
// This runs before React loads
const hideErrorOverlay = () => {
  const style = document.createElement('style');
  style.innerHTML = `
    iframe#webpack-dev-server-client-overlay { display: none !important; }
    body > iframe[style*="position: fixed"] { display: none !important; }
  `;
  document.head.appendChild(style);
};

// Run immediately
hideErrorOverlay();

// Override error handling globally
const originalOnError = window.onerror;
window.onerror = (message, source, lineno, colno, error) => {
  // Suppress cross-origin Script errors
  if (message === 'Script error.' || message?.toString?.().includes?.('Script error')) {
    return true; // Prevent default handling
  }
  if (originalOnError) {
    return originalOnError(message, source, lineno, colno, error);
  }
  return false;
};

// Suppress wallet extension errors in console
const originalError = console.error;
console.error = (...args) => {
  const msg = args[0]?.toString() || '';
  // Suppress known extension conflicts and cross-origin errors
  if (msg.includes('Cannot redefine property: ethereum') ||
      msg.includes('evmAsk.js') ||
      msg.includes('chrome-extension://') ||
      msg.includes('Script error') ||
      msg.includes('handleError') ||
      msg.includes('at handleError')) {
    return; // Silently ignore
  }
  originalError.apply(console, args);
};

// Global error handler for uncaught extension errors and cross-origin script errors
window.addEventListener('error', (event) => {
  if (event.filename?.includes('chrome-extension://') ||
      event.message?.includes('Cannot redefine property') ||
      event.message === 'Script error.' ||
      event.message?.includes('Script error') ||
      event.message?.includes('handleError') ||
      !event.filename) { // No filename means cross-origin
    event.preventDefault();
    event.stopImmediatePropagation();
    return true;
  }
}, true); // Use capture phase

// Suppress unhandled promise rejections from external sources
window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason?.toString() || '';
  if (reason.includes('Script error') || 
      reason.includes('chrome-extension://') ||
      reason.includes('ResizeObserver')) {
    event.preventDefault();
    event.stopImmediatePropagation();
  }
});

const root = ReactDOM.createRoot(document.getElementById("root"));

// Resolve preferred language BEFORE mounting React so the UI never
// renders in the wrong language and then flickers.
bootstrapLanguage().finally(() => {
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
});
