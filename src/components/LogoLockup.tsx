import { useEffect, useState } from 'react';
const logoDarkUrl = '/branding/logo-dark.png';
const logoLightUrl = '/branding/logo-light.png';

interface LogoLockupProps {
  /**
   * Override the theme detection (e.g. force 'dark' for dark backgrounds)
   */
  theme?: 'light' | 'dark';
  className?: string;
  width?: number | string;
  style?: React.CSSProperties;
}

/**
 * LogoLockup - Graphium Wordmark + Icon
 *
 * Automatically switches between light and dark versions based on
 * the current application theme or provided prop.
 */
export function LogoLockup({ theme, className = '', width = 'auto', style = {} }: LogoLockupProps) {
  const [currentTheme, setCurrentTheme] = useState<'light' | 'dark'>(theme || 'light');

  useEffect(() => {
    // If theme is manually provided, stick with it
    if (theme) {
      setCurrentTheme(theme);
      return;
    }

    // Otherwise, detect from HTML data-theme attribute
    const updateTheme = () => {
      const htmlTheme = document.documentElement.getAttribute('data-theme');
      setCurrentTheme(htmlTheme === 'dark' ? 'dark' : 'light');
    };

    // Initial check
    updateTheme();

    // Observe changes to the data-theme attribute
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' && mutation.attributeName === 'data-theme') {
          updateTheme();
        }
      });
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });

    return () => observer.disconnect();
  }, [theme]);

  const src = currentTheme === 'dark' ? logoDarkUrl : logoLightUrl;

  return (
    <img
      src={src}
      className={className}
      alt="Graphium"
      style={{
        width,
        height: 'auto',
        display: 'block',
        ...style,
      }}
    />
  );
}
