import * as React from 'react';
import { cn } from '@/lib/utils';

type IllustrationProps = Omit<React.SVGProps<SVGSVGElement>, 'children'>;

export function ClosedGate({ className, ...props }: IllustrationProps) {
  return (
    <svg
      viewBox="0 0 200 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      role="img"
      className={cn('size-32', className)}
      {...props}
    >
      <g
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M40 60 Q 100 38 160 60" />
        <path d="M40 60 L 40 168" />
        <path d="M160 60 L 160 168" />
        <path d="M40 168 L 160 168" />
        <path d="M40 90 L 160 90" />
        <path d="M40 130 L 160 130" />
      </g>
      <g
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.85"
      >
        <path d="M60 60 L 60 168" />
        <path d="M80 60 L 80 168" />
        <path d="M120 60 L 120 168" />
        <path d="M140 60 L 140 168" />
      </g>
      <g
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.65"
      >
        <path d="M50 50 Q 60 44 70 50" />
        <path d="M70 48 Q 80 42 90 48" />
        <path d="M90 46 Q 100 40 110 46" />
        <path d="M110 48 Q 120 42 130 48" />
        <path d="M130 50 Q 140 44 150 50" />
      </g>
      <g className="text-primary">
        <circle
          cx="100"
          cy="110"
          r="14"
          fill="currentColor"
          opacity="0.18"
        />
        <circle
          cx="100"
          cy="110"
          r="14"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        />
        <rect
          x="96"
          y="118"
          width="8"
          height="14"
          rx="1.5"
          fill="currentColor"
          opacity="0.7"
        />
      </g>
      <g
        className="text-primary"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        fill="none"
      >
        <path d="M100 110 L 100 116" />
      </g>
    </svg>
  );
}
