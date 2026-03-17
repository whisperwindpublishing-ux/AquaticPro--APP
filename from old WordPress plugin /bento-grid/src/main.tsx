import React from 'react';
import ReactDOM from 'react-dom/client';
import BentoGrid from './BentoGrid';
import './index.css';

// Support multiple instances on the same page
const initBentoGrids = () => {
  // Find all bento grid instances
  const rootElements = document.querySelectorAll('.bento-media-grid-instance');
  
  rootElements.forEach((rootElement) => {
    const configString = rootElement.getAttribute('data-config');
    const config = configString ? JSON.parse(configString) : {};
    
    // Set CSS custom property for accent color on this instance
    if (config.accent_color) {
      (rootElement as HTMLElement).style.setProperty('--accent-color', config.accent_color);
    }
    
    ReactDOM.createRoot(rootElement).render(
      <React.StrictMode>
        <BentoGrid config={config} />
      </React.StrictMode>
    );
  });
  
  // Fallback for old single-instance markup
  const legacyRoot = document.getElementById('bento-media-grid-root');
  if (legacyRoot && !legacyRoot.classList.contains('bento-media-grid-instance')) {
    const configString = legacyRoot.getAttribute('data-config');
    const config = configString ? JSON.parse(configString) : {};
    
    if (config.accent_color) {
      document.documentElement.style.setProperty('--accent-color', config.accent_color);
    }
    
    ReactDOM.createRoot(legacyRoot).render(
      <React.StrictMode>
        <BentoGrid config={config} />
      </React.StrictMode>
    );
  }
};

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initBentoGrids);
} else {
  initBentoGrids();
}
