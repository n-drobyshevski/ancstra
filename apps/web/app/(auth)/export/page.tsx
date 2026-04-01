import { redirect } from 'next/navigation';

export default function ExportPage() {
  redirect('/data?tab=export');
}
