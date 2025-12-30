/**
 * Tooltip Component - Custom tooltip with fast show timing and high contrast
 *
 * Provides a better alternative to browser-native title tooltips with:
 * - Faster show timing (100ms vs ~700ms default)
 * - High contrast styling for better readability
 * - Consistent appearance across browsers
 *
 * @component
 */

import { useState, useRef, useEffect, type ReactNode } from 'react';

interface TooltipProps {
  content: string;
  children: ReactNode;
  delay?: number; // Delay in milliseconds before showing tooltip
}

const Tooltip = ({ content, children, delay = 100 }: TooltipProps) => {
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseEnter = () => {
    timeoutRef.current = setTimeout(() => {
      setIsVisible(true);
      updatePosition();
    }, delay);
  };

  const handleMouseLeave = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsVisible(false);
  };

  const updatePosition = () => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setPosition({
        top: rect.top - 40, // Position above the element
        left: rect.left + rect.width / 2, // Center horizontally
      });
    }
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return (
    <>
      <div
        ref={containerRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className="inline-flex"
      >
        {children}
      </div>

      {isVisible && (
        <div
          className="fixed z-[9999] pointer-events-none"
          style={{
            top: `${position.top}px`,
            left: `${position.left}px`,
            transform: 'translateX(-50%)',
          }}
        >
          <div className="relative px-3 py-1.5 rounded-md shadow-lg text-sm font-medium whitespace-nowrap bg-neutral-900 text-white border border-neutral-600">
            {content}
            {/* Tooltip arrow */}
            <div
              className="absolute left-1/2 -translate-x-1/2 -bottom-1 w-2 h-2 rotate-45 bg-neutral-900 border-r border-b border-neutral-600"
            />
          </div>
        </div>
      )}
    </>
  );
};

export default Tooltip;
