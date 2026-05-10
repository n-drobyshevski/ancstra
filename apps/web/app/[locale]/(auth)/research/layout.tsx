import type { ReactNode } from 'react';
import { ThreadHeaderBar } from '@/components/research/threads/thread-header-bar';

export default function ResearchLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <ThreadHeaderBar />
      {children}
    </>
  );
}
