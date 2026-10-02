import { useId } from 'react';

interface Props {
  size?: number;
  animated?: boolean;
}

/** The Lumen mark: an "L" lit by a small light source. */
export function Logo({ size = 30, animated = false }: Props) {
  const id = useId().replace(/:/g, '');
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      aria-hidden="true"
      style={{ flexShrink: 0, overflow: 'visible' }}
    >
      <defs>
        <linearGradient id={`${id}g`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#FFD36E" />
          <stop offset=".5" stopColor="#FF8A5B" />
          <stop offset="1" stopColor="#B66DFF" />
        </linearGradient>
        <radialGradient id={`${id}c`}>
          <stop offset="0" stopColor="#FFFFFF" />
          <stop offset=".35" stopColor="#FFE3A3" />
          <stop offset="1" stopColor="#FFB547" stopOpacity="0" />
        </radialGradient>
        <filter id={`${id}glow`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="1.6" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <rect
        x="1.5"
        y="1.5"
        width="29"
        height="29"
        rx="9"
        fill="#0E1019"
        stroke={`url(#${id}g)`}
        strokeWidth="1.6"
      />
      <path
        d="M11 8.5V21.5H22.5"
        fill="none"
        stroke={`url(#${id}g)`}
        strokeWidth="3.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        filter={`url(#${id}glow)`}
      />
      <circle cx="21.5" cy="10.5" r="5" fill={`url(#${id}c)`}>
        {animated && (
          <animate attributeName="r" values="4.2;5.6;4.2" dur="2.8s" repeatCount="indefinite" />
        )}
      </circle>
    </svg>
  );
}
