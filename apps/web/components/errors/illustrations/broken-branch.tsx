import * as React from 'react';
import { cn } from '@/lib/utils';

type IllustrationProps = Omit<React.SVGProps<SVGSVGElement>, 'children'>;

export function BrokenBranch({ className, ...props }: IllustrationProps) {
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
        <path d="M30 178 C 48 150, 70 130, 96 116" />
        <path d="M68 142 C 80 134, 88 130, 102 126" />
        <path d="M96 116 C 112 108, 122 102, 130 98" />
      </g>
      <path
        d="M134 96 L 144 92 M 152 88 L 162 84 M 170 80 L 178 76"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <g stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
        <path d="M129 96 L 134 104" />
        <path d="M133 92 L 137 100" />
      </g>
      <g className="text-primary/50">
        <path
          d="M118 132 Q 128 126 132 138 Q 124 144 118 132 Z"
          fill="currentColor"
        />
        <path
          d="M115 134 L 122 140"
          stroke="currentColor"
          strokeWidth="0.8"
          fill="none"
        />
      </g>
      <g className="text-primary/40">
        <path
          d="M148 158 Q 158 152 162 164 Q 154 170 148 158 Z"
          fill="currentColor"
        />
        <path
          d="M145 160 L 152 166"
          stroke="currentColor"
          strokeWidth="0.8"
          fill="none"
        />
      </g>
    </svg>
  );
}
