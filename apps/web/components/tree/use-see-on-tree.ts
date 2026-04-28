'use client';

import { useCallback } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { buildSeeOnTreeSearch } from '@/lib/tree/see-on-tree';

export function useSeeOnTree() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return useCallback(
    (personId: string) => {
      const qs = buildSeeOnTreeSearch(
        new URLSearchParams(searchParams.toString()),
        personId,
      );
      router.push(`${pathname}?${qs}`);
    },
    [router, pathname, searchParams],
  );
}
