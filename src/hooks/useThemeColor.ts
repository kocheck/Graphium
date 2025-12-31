import { useState, useEffect } from 'react';

/**
 * Hook to get the computed value of a CSS variable, reactive to theme changes.
 *
 * @param variableName - The CSS variable name (e.g., '--app-text-primary')
 * @returns The computed hex/rgb string value
 */
export function useThemeColor(variableName: string): string {
  // Helper to get current value
  const getValue = () => {
    if (typeof window === 'undefined') return '';
    return getComputedStyle(document.documentElement).getPropertyValue(variableName).trim();
  };

  const [color, setColor] = useState(getValue);

  useEffect(() => {
    // Update immediately on mount
    setColor(getValue());

    // Create an observer to watch for class/attribute changes on <html>
    // This catches data-theme changes
    const observer = new MutationObserver(() => {
      setColor(getValue());
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme', 'class', 'style'],
    });

    // Also listen for any custom 'theme-change' events we might emit
    const handleThemeChange = () => setColor(getValue());
    window.addEventListener('theme-change', handleThemeChange);

    return () => {
      observer.disconnect();
      window.removeEventListener('theme-change', handleThemeChange);
    };
  }, [variableName]);

  return color;
}
