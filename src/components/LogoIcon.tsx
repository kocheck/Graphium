import { useState, useEffect, useRef } from 'react';

interface LogoIconProps {
  size?: number;
  animate?: boolean;
  onAnimationComplete?: (roll: number) => void;
}

/**
 * LogoIcon - Placeholder SVG icon for Hyle branding
 *
 * A twenty-sided die (d20) representing tabletop gaming and fortune.
 * This is a placeholder that can be replaced with the final logo design.
 *
 * Features:
 * - Optional dice roll animation on mount
 * - 3D rotation effect
 * - Displays random roll result (weighted toward natural 20)
 */
export function LogoIcon({ size = 80, animate = false, onAnimationComplete }: LogoIconProps) {
  const [isRolling, setIsRolling] = useState(false);
  const [displayNumber, setDisplayNumber] = useState(20);
  const [rotation, setRotation] = useState(0);
  const spinIntervalRef = useRef<number | null>(null);

  useEffect(() => {
    if (animate) {
      // Start the roll animation
      setIsRolling(true);

      // Randomize displayed number during spin
      spinIntervalRef.current = window.setInterval(() => {
        setDisplayNumber(Math.floor(Math.random() * 20) + 1);
        setRotation(prev => prev + 45);
      }, 50);

      // Stop after 800ms and show final roll
      const stopTimeout = window.setTimeout(() => {
        if (spinIntervalRef.current !== null) {
          clearInterval(spinIntervalRef.current);
          spinIntervalRef.current = null;
        }

        // Weighted roll: 15% chance for natural 20, otherwise random
        const finalRoll = Math.random() < 0.15 ? 20 : Math.floor(Math.random() * 20) + 1;
        setDisplayNumber(finalRoll);
        setRotation(0);
        setIsRolling(false);

        if (onAnimationComplete) {
          onAnimationComplete(finalRoll);
        }
      }, 800);

      return () => {
        if (spinIntervalRef.current !== null) {
          clearInterval(spinIntervalRef.current);
        }
        clearTimeout(stopTimeout);
      };
    }
  }, [animate, onAnimationComplete]);

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={isRolling ? 'logo-icon-rolling' : 'logo-icon-idle'}
      style={{
        filter: 'drop-shadow(0 4px 12px rgba(0, 0, 0, 0.3))',
        transform: `rotate(${rotation}deg) ${isRolling ? 'scale(1.1)' : 'scale(1)'}`,
      }}
    >
      <style>{`
        .logo-icon-idle {
          transition: transform 0.3s ease-out;
        }
        .logo-icon-rolling {
          transition: none;
        }
      `}</style>
      {/* D20 Icosahedron - simplified geometric representation */}

      {/* Main body - pentagon shape suggesting 3D die */}
      <path
        d="M 50 10 L 85 35 L 75 75 L 25 75 L 15 35 Z"
        fill="url(#logoGradient)"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />

      {/* Internal facets for dimension */}
      <path
        d="M 50 10 L 50 45"
        stroke="currentColor"
        strokeWidth="1.5"
        opacity="0.4"
      />
      <path
        d="M 50 45 L 85 35"
        stroke="currentColor"
        strokeWidth="1.5"
        opacity="0.4"
      />
      <path
        d="M 50 45 L 15 35"
        stroke="currentColor"
        strokeWidth="1.5"
        opacity="0.4"
      />
      <path
        d="M 50 45 L 75 75"
        stroke="currentColor"
        strokeWidth="1.5"
        opacity="0.4"
      />
      <path
        d="M 50 45 L 25 75"
        stroke="currentColor"
        strokeWidth="1.5"
        opacity="0.4"
      />

      {/* Dynamic number in the center */}
      <text
        x="50"
        y="50"
        fontSize="24"
        fontWeight="bold"
        fontFamily="IBM Plex Sans, sans-serif"
        fill="currentColor"
        textAnchor="middle"
        dominantBaseline="middle"
      >
        {displayNumber}
      </text>

      {/* Gradient definition */}
      <defs>
        <linearGradient id="logoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="var(--app-accent-solid)" stopOpacity="0.2" />
          <stop offset="100%" stopColor="var(--app-accent-solid)" stopOpacity="0.4" />
        </linearGradient>
      </defs>
    </svg>
  );
}
