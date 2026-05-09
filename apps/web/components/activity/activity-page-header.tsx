import type { Role } from '@ancstra/auth/types';
import { getTranslations } from 'next-intl/server';

interface ActivityPageHeaderProps {
  role: Role;
  /** Optional actions area on the right (e.g. Subscribe, Export). */
  actions?: React.ReactNode;
}

/**
 * Role-tailored welcome copy for the /activity page. Title is shared; tagline
 * varies per role and is sourced from `activity.welcome.<role>`.
 */
export async function ActivityPageHeader({ role, actions }: ActivityPageHeaderProps) {
  const tPage = await getTranslations('activity.page');
  const tWelcome = await getTranslations('activity.welcome');
  const title = tPage('title');
  const tagline = tWelcome(role);

  return (
    <header className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold leading-tight">{title}</h1>
        <p className="max-w-xl text-sm text-muted-foreground">{tagline}</p>
      </div>
      {actions ? <div className="shrink-0">{actions}</div> : null}
    </header>
  );
}
