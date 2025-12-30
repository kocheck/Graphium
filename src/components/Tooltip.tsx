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

import { useState, useRef, useEffect, useCallback, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface TooltipProps {
  content: string;
  children: ReactNode;
  delay?: number; // Delay in milliseconds before showing tooltip
  offset?: number; // Vertical offset in pixels from element (default: 50)
}

const Tooltip = ({ content, children, delay = 100, offset = 50 }: TooltipProps) => {
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const updatePosition = useCallback(() => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const newPosition = {
        top: rect.top - offset, // Position above the element with configurable offset
        left: rect.left + rect.width / 2, // Center horizontally
      };
      setPosition(newPosition);
    }
  }, [offset]);

  const handleMouseEnter = () => {
    timeoutRef.current = setTimeout(() => {
      updatePosition();
      setIsVisible(true);
    }, delay);
  };

  const handleMouseLeave = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsVisible(false);
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

      {isVisible && createPortal(
        <div
          className="fixed z-[9999] pointer-events-none"
          style={{
            top: `${position.top}px`,
            left: `${position.left}px`,
            transform: 'translateX(-50%)',
          }}
        >
          <div className="relative px-3 py-1.5 pb-3 rounded-md shadow-lg text-sm font-medium whitespace-nowrap bg-neutral-900 text-white border border-neutral-600">
            {content}
            {/* Tooltip arrow */}
            <div
              className="absolute left-1/2 -translate-x-1/2 bottom-0 translate-y-1/2 w-2 h-2 rotate-45 bg-neutral-900 border-r border-b border-neutral-600"
            />
          </div>
        </div>,
        document.body
      )}
    </>
  );
};

export default Tooltip;
