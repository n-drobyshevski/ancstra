import { Suspense } from 'react';
import { requirePagePermission } from '@/lib/auth/page-guard';
import { BookmarkletReceiver } from './receiver-client';

async function BookmarkletReceiverGuarded() {
  await requirePagePermission('ai:research');
  return <BookmarkletReceiver />;
}

export default function BookmarkletReceiverPage() {
  return (
    <Suspense fallback={null}>
      <BookmarkletReceiverGuarded />
    </Suspense>
  );
}
