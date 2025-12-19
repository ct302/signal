import { useState, useEffect } from 'react';
import { KATEX_CSS, KATEX_JS } from '../constants';

export const useKatex = () => {
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    // Check if already loaded
    if (document.querySelector(`link[href="${KATEX_CSS}"]`)) {
      setIsLoaded(!!window.katex);
      return;
    }

    // Load CSS
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = KATEX_CSS;
    document.head.appendChild(link);

    // Load JS
    const script = document.createElement('script');
    script.src = KATEX_JS;
    script.async = true;
    script.onload = () => setIsLoaded(true);
    script.onerror = () => console.error("KaTeX failed to load.");
    document.head.appendChild(script);
  }, []);

  return isLoaded;
};
