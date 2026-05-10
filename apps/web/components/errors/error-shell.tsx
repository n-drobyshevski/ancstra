'use client';

import * as React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { PagePadding } from '@/components/page-padding';
import { cn } from '@/lib/utils';

export type ErrorShellAction = {
  label: string;
  onClick?: () => void;
  href?: string;
  variant?: 'default' | 'outline' | 'ghost' | 'secondary';
};

type ErrorShellProps = {
  illustration: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  primaryAction?: ErrorShellAction;
  secondaryAction?: ErrorShellAction;
  digest?: string;
  referenceLabel?: string;
  className?: string;
};

export function ErrorShell({
  illustration,
  title,
  description,
  primaryAction,
  secondaryAction,
  digest,
  referenceLabel,
  className,
}: ErrorShellProps) {
  return (
    <PagePadding>
      <div
        role="alert"
        aria-live="polite"
        className={cn(
          'flex min-h-[60vh] flex-col items-center justify-center text-center',
          className,
        )}
      >
        <div className="text-muted-foreground/40 dark:text-muted-foreground/55">
          {illustration}
        </div>
        <h1 className="mt-6 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          {title}
        </h1>
        {description ? (
          <p className="mt-3 max-w-md text-base text-muted-foreground">
            {description}
          </p>
        ) : null}
        {(primaryAction || secondaryAction) && (
          <div className="mt-8 flex w-full max-w-sm flex-col gap-2 sm:w-auto sm:flex-row">
            {primaryAction ? (
              <ActionButton action={primaryAction} primary />
            ) : null}
            {secondaryAction ? <ActionButton action={secondaryAction} /> : null}
          </div>
        )}
        {digest ? (
          <p className="mt-8 text-xs text-muted-foreground/70">
            <span>{referenceLabel ?? 'Reference:'}</span>{' '}
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.7rem]">
              {digest}
            </code>
          </p>
        ) : null}
      </div>
    </PagePadding>
  );
}

function ActionButton({
  action,
  primary,
}: {
  action: ErrorShellAction;
  primary?: boolean;
}) {
  const variant = action.variant ?? (primary ? 'default' : 'outline');
  if (action.href) {
    return (
      <Button asChild variant={variant} className="w-full sm:w-auto">
        <Link href={action.href}>{action.label}</Link>
      </Button>
    );
  }
  return (
    <Button
      variant={variant}
      onClick={action.onClick}
      className="w-full sm:w-auto"
    >
      {action.label}
    </Button>
  );
}
