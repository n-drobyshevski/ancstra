'use client';
import Link from 'next/link';
import { Plus } from 'lucide-react';

export function MobileAddButton() {
  return (
    <Link
      href="/persons/new"
      className="fixed bottom-4 right-4 z-30 flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105 active:scale-95 md:hidden"
      style={{ marginBottom: 'env(safe-area-inset-bottom)' }}
      aria-label="Add new person"
    >
      <Plus className="size-6" />
    </Link>
  );
}
