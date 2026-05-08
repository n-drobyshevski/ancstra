import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { GitBranch, UserPlus, Upload } from 'lucide-react';
import { RoleGate } from '@/components/auth/role-gate';

export function EmptyDashboard() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <GitBranch className="size-16 text-muted-foreground/30" />
      <h2 className="mt-4 text-lg font-semibold">Your family tree is empty</h2>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        Get started by adding your first family member or importing an existing GEDCOM file.
      </p>
      <div className="mt-6 flex flex-col gap-2 sm:flex-row">
        <RoleGate permission="person:create">
          <Button asChild>
            <Link href="/persons/new">
              <UserPlus className="mr-2 size-4" />
              Add First Person
            </Link>
          </Button>
        </RoleGate>
        <RoleGate permission="gedcom:import">
          <Button variant="outline" asChild>
            <Link href="/data">
              <Upload className="mr-2 size-4" />
              Import GEDCOM
            </Link>
          </Button>
        </RoleGate>
      </div>
    </div>
  );
}
