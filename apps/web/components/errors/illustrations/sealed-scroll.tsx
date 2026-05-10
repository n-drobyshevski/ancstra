import * as React from 'react';
import { cn } from '@/lib/utils';

type IllustrationProps = Omit<React.SVGProps<SVGSVGElement>, 'children'>;

export function SealedScroll({ className, ...props }: IllustrationProps) {
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
        <path d="M40 70 Q 36 100 40 130 L 160 130 Q 164 100 160 70 Z" />
        <path d="M40 70 Q 50 64 60 70 Q 50 76 40 70 Z" />
        <path d="M160 70 Q 150 64 140 70 Q 150 76 160 70 Z" />
        <path d="M40 130 Q 50 124 60 130 Q 50 136 40 130 Z" />
        <path d="M160 130 Q 150 124 140 130 Q 150 136 160 130 Z" />
      </g>
      <g stroke="currentColor" strokeWidth="1" opacity="0.55">
        <path d="M70 86 L 130 86" />
        <path d="M70 96 L 130 96" />
        <path d="M70 106 L 110 106" />
        <path d="M70 116 L 130 116" />
      </g>
      <g className="text-primary">
        <circle cx="100" cy="100" r="18" fill="currentColor" opacity="0.85" />
        <circle
          cx="100"
          cy="100"
          r="18"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          opacity="0.6"
        />
      </g>
      <g
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        className="text-primary-foreground"
        opacity="0.95"
      >
        <path d="M93 96 L 100 103 L 107 96" />
        <path d="M93 104 L 107 104" />
      </g>
      <g
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        className="text-primary/55"
      >
        <path d="M82 100 L 88 102" />
        <path d="M118 100 L 112 102" />
        <path d="M84 110 L 90 108" />
        <path d="M116 110 L 110 108" />
      </g>
    </svg>
  );
}
