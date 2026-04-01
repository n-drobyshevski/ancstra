import { UserPlus } from 'lucide-react';
import { PersonForm } from '@/components/person-form';
import { PagePadding } from '@/components/page-padding';

export default function NewPersonPage() {
  return (
    <PagePadding>
    <div className="mx-auto max-w-2xl pb-20 py-6 md:pb-0 md:py-8">
      {/* Desktop header — hidden on mobile (form has its own mobile header) */}
      <div className="mb-6 hidden items-center gap-3 md:flex">
        <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <UserPlus className="size-5" />
        </div>
        <div>
          <h1 className="text-xl font-semibold">Add New Person</h1>
          <p className="text-sm text-muted-foreground">
            Enter details to add someone to your family tree
          </p>
        </div>
      </div>
      <PersonForm />
    </div>
    </PagePadding>
  );
}
