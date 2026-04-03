import Link from 'next/link';
import { UserPlus, Upload, Sparkles, GitBranch } from 'lucide-react';

const actions = [
  { label: 'Add Person', icon: UserPlus, href: '/persons/new' },
  { label: 'Import Data', icon: Upload, href: '/data' },
  { label: 'AI Research', icon: Sparkles, href: '/research' },
  { label: 'View Tree', icon: GitBranch, href: '/tree' },
] as const;

export function QuickActions() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {actions.map(({ label, icon: Icon, href }) => (
        <Link
          key={href}
          href={href}
          className="flex flex-col items-center gap-2 p-4 rounded-lg border border-border bg-card text-card-foreground hover:bg-muted/50 transition-colors"
        >
          <Icon className="size-5 text-primary" />
          <span className="text-sm font-medium">{label}</span>
        </Link>
      ))}
    </div>
  );
}
