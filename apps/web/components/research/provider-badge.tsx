import { Badge } from '@/components/ui/badge';

const PROVIDER_CONFIG: Record<string, { label: string; className: string }> = {
  mock: {
    label: 'Mock',
    className: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  },
  nara: {
    label: 'NARA',
    className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  },
  'chronicling-america': {
    label: 'Chronicling America',
    className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  },
  familysearch: {
    label: 'FamilySearch',
    className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  },
};

interface ProviderBadgeProps {
  providerId: string;
}

export function ProviderBadge({ providerId }: ProviderBadgeProps) {
  const config = PROVIDER_CONFIG[providerId] ?? {
    label: providerId,
    className: 'bg-secondary text-secondary-foreground',
  };

  return (
    <Badge variant="outline" className={config.className}>
      {config.label}
    </Badge>
  );
}
