import * as React from 'react';
import { cn } from '@/lib/utils';

type IllustrationProps = Omit<React.SVGProps<SVGSVGElement>, 'children'>;

export function SpilledInkwell({ className, ...props }: IllustrationProps) {
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
        <path d="M30 60 L 130 60 L 130 170 L 30 170 Z" />
        <path d="M30 60 L 130 60" />
      </g>
      <g stroke="currentColor" strokeWidth="1" opacity="0.5">
        <path d="M44 80 L 116 80" />
        <path d="M44 92 L 116 92" />
        <path d="M44 104 L 100 104" />
        <path d="M44 116 L 116 116" />
        <path d="M44 128 L 108 128" />
      </g>
      <g
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M132 80 Q 152 70 172 76 L 168 110 Q 152 116 138 110 Z" />
        <path d="M132 80 Q 152 86 172 76" />
        <ellipse cx="152" cy="78" rx="20" ry="3" fill="none" />
      </g>
      <g className="text-primary/80">
        <path
          d="M138 108 Q 130 130 110 142 Q 86 152 56 156 Q 80 160 110 154 Q 134 148 142 132 Q 148 118 142 110 Z"
          fill="currentColor"
          opacity="0.7"
        />
        <ellipse cx="60" cy="158" rx="6" ry="2" fill="currentColor" opacity="0.55" />
        <ellipse cx="74" cy="162" rx="3" ry="1.5" fill="currentColor" opacity="0.45" />
        <ellipse cx="46" cy="162" rx="3" ry="1.5" fill="currentColor" opacity="0.45" />
      </g>
      <g
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        opacity="0.85"
      >
        <path d="M150 50 L 122 88" />
        <path d="M148 48 L 156 56" />
        <path d="M122 88 L 118 96 L 126 92 Z" fill="currentColor" />
      </g>
    </svg>
  );
}
