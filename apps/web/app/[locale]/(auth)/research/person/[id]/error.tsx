'use client';

import { RouteError } from '@/components/errors/route-error';

export default function ResearchPersonError(props: {
  error: Error & { digest?: string };
  unstable_retry?: () => void;
  reset?: () => void;
}) {
  return (
    <RouteError {...props} segment="research/person/[id]" back="research" />
  );
}
