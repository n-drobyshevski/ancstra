import { redirect } from 'next/navigation';
import { requirePagePermission } from '@/lib/auth/page-guard';

export default async function ExportPage() {
  await requirePagePermission('gedcom:export');
  redirect('/data?tab=export');
}
