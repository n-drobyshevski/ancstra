'use client';

import { RouteError } from '@/components/errors/route-error';

export default function PersonDetailError(props: {
  error: Error & { digest?: string };
  unstable_retry?: () => void;
  reset?: () => void;
}) {
  return <RouteError {...props} segment="persons/[id]" back="persons" />;
}
