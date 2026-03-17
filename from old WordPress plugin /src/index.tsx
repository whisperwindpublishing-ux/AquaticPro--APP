import _React from 'react';
import ReactDOM from 'react-dom/client';
import App from '@/App';
import './index.css';
import './styles/theme.css';

// NOTE: Excalidraw CSS moved to ExcalidrawEditor/ExcalidrawPresentation components
// so it only loads when the whiteboard is actually opened (code-splitting optimization).

// Wait for DOM to be ready and ensure the root element exists
const initializeApp = () => {
  const rootElement = document.getElementById('root');
  
  if (!rootElement) {
    console.error('AquaticPro: Root element not found. Make sure the shortcode is properly placed.');
    return;
  }

  // Check if already mounted to prevent duplicate mounts
  if (rootElement.hasAttribute('data-react-mounted')) {
    console.warn('AquaticPro: App already mounted on this element.');
    return;
  }

  // Mark as mounted
  rootElement.setAttribute('data-react-mounted', 'true');

  // Create root and render
  // NOTE: StrictMode is DISABLED because it causes "removeChild" crashes with Excalidraw.
  // Excalidraw manipulates the DOM directly, and StrictMode's double-render/unmount cycle
  // causes React to try to remove DOM nodes that Excalidraw already cleaned up.
  // See: https://github.com/excalidraw/excalidraw/issues/5765
  const root = ReactDOM.createRoot(rootElement);
  root.render(<App />);
};

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeApp);
} else {
  // DOM already loaded
  initializeApp();
}