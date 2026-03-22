import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Welcome to Ancstra</h1>
      <p className="text-muted-foreground">
        Your AI-powered personal genealogy workspace.
      </p>
      <Button asChild>
        <Link href="/person/new">Add New Person</Link>
      </Button>
    </div>
  );
}
