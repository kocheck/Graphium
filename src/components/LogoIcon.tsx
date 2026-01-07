import { useState, useEffect } from 'react';
import iconUrl from '../assets/branding/icon.png';

interface LogoIconProps {
  size?: number;
  animate?: boolean;
  onAnimationComplete?: (roll: number) => void;
  className?: string; // Added className prop support
}

/**
 * LogoIcon - Graphium Branding Icon
 *
 * Displays the official Graphium D20 icon.
 *
 * Features:
 * - Optional rotation animation on mount
 */
export function LogoIcon({
  size = 80,
  animate = false,
  onAnimationComplete,
  className = '',
}: LogoIconProps) {
  const [isRolling, setIsRolling] = useState(false);
  const [rotation, setRotation] = useState(0);

  useEffect(() => {
    if (animate) {
      // Start the roll animation
      setIsRolling(true);

      // Spin for a bit
      const spinInterval = window.setInterval(() => {
        setRotation((prev) => prev + 45);
      }, 50);

      // Stop after 800ms
      const timeout = window.setTimeout(() => {
        clearInterval(spinInterval);

        // Finalize
        setRotation(0);
        setIsRolling(false);

        if (onAnimationComplete) {
          // Send a "natural 20" equivalent as a placeholder for functionality relying on this
          onAnimationComplete(20);
        }
      }, 800);

      return () => {
        clearInterval(spinInterval);
        clearTimeout(timeout);
      };
    }
  }, [animate, onAnimationComplete]);

  return (
    <div
      className={`logo-icon-container ${className}`}
      style={{
        width: size,
        height: size,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: isRolling ? 'none' : 'transform 0.3s ease-out',
        transform: `rotate(${rotation}deg) ${isRolling ? 'scale(1.1)' : 'scale(1)'}`,
        filter: 'drop-shadow(0 4px 12px rgba(0, 0, 0, 0.3))',
      }}
    >
      <img
        src={iconUrl}
        alt="Graphium D20 Icon"
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'contain',
        }}
      />
    </div>
  );
}
