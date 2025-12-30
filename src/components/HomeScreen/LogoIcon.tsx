/**
 * LogoIcon - Placeholder SVG icon for Hyle branding
 *
 * A twenty-sided die (d20) representing tabletop gaming and fortune.
 * This is a placeholder that can be replaced with the final logo design.
 */
export function LogoIcon({ size = 80 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ filter: 'drop-shadow(0 4px 12px rgba(0, 0, 0, 0.3))' }}
    >
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

      {/* "20" in the center - the critical success number */}
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
        20
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
