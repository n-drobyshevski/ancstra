import { requirePagePermission } from '@/lib/auth/page-guard';
import { BookmarkletReceiver } from './receiver-client';

export default async function BookmarkletReceiverPage() {
  await requirePagePermission('ai:research');
  return <BookmarkletReceiver />;
}
