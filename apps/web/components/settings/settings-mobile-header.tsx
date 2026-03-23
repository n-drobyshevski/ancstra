'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export function SettingsMobileHeader({ title }: { title: string }) {
  return (
    <Link
      href="/settings"
      className="flex items-center gap-2 md:hidden mb-4"
    >
      <ArrowLeft className="size-4 text-muted-foreground" />
      <span className="text-sm font-semibold">{title}</span>
    </Link>
  );
}
