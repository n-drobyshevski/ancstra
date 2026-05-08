import { redirect } from 'next/navigation';
import { requirePagePermission } from '@/lib/auth/page-guard';

export default async function ImportPage() {
  // Gate before redirecting so a user without import access lands on
  // /dashboard with a toast rather than at /data?tab=import where the
  // import tab would be hidden anyway.
  await requirePagePermission('gedcom:import');
  redirect('/data');
}
