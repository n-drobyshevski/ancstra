'use client';

import { useEffect, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';

interface Props {
  iso: string;
  /** Fallback shown until the client mounts. Defaults to the raw ISO. */
  fallback?: string;
}

/**
 * Renders a relative time like "5 minutes ago" client-side.
 *
 * Lives in a client component because Next.js 16's prerender check
 * forbids Server Components from calling Date.now() (which date-fns
 * uses) without first reading a request data source. Server-rendering
 * the fallback (the absolute ISO) avoids both the prerender error and
 * any hydration mismatch.
 */
export function RelativeTime({ iso, fallback }: Props) {
  const [label, setLabel] = useState<string>(fallback ?? iso);

  useEffect(() => {
    function update() {
      try {
        setLabel(formatDistanceToNow(new Date(iso), { addSuffix: true }));
      } catch {
        setLabel(iso);
      }
    }
    update();
    const id = setInterval(update, 60_000);
    return () => clearInterval(id);
  }, [iso]);

  return <span title={iso}>{label}</span>;
}
