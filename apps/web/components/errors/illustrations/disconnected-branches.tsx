import * as React from 'react';
import { cn } from '@/lib/utils';

type IllustrationProps = Omit<React.SVGProps<SVGSVGElement>, 'children'>;

export function DisconnectedBranches({
  className,
  ...props
}: IllustrationProps) {
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
        <path d="M20 100 Q 40 96 56 102 Q 70 108 80 104" />
        <circle cx="20" cy="100" r="6" />
        <circle cx="56" cy="102" r="4" />
        <circle cx="80" cy="104" r="5" />
      </g>
      <g
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M120 96 Q 130 92 144 98 Q 160 104 180 100" />
        <circle cx="120" cy="96" r="5" />
        <circle cx="144" cy="98" r="4" />
        <circle cx="180" cy="100" r="6" />
      </g>
      <g
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.5"
      >
        <path d="M20 100 L 12 80" />
        <circle cx="12" cy="80" r="3" />
        <path d="M56 102 L 60 124" />
        <circle cx="60" cy="124" r="3" />
        <path d="M180 100 L 188 78" />
        <circle cx="188" cy="78" r="3" />
        <path d="M144 98 L 140 122" />
        <circle cx="140" cy="122" r="3" />
      </g>
      <g
        className="text-destructive/70"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      >
        <path d="M84 96 L 92 100 L 86 106" />
        <path d="M116 92 L 108 100 L 114 106" />
      </g>
      <g
        className="text-destructive/50"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeDasharray="3 5"
        strokeLinecap="round"
      >
        <path d="M88 100 L 112 100" />
      </g>
    </svg>
  );
}
