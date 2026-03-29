import { Badge } from '@/components/ui/badge';
import { Globe, Archive, Newspaper, MapPin, Search, TreePine, type LucideIcon } from 'lucide-react';

interface ProviderConfigEntry {
  label: string;
  className: string;
  borderClass: string;
  icon: LucideIcon;
}

const PROVIDER_CONFIG: Record<string, ProviderConfigEntry> = {
  mock: {
    label: 'Mock',
    className: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
    borderClass: 'border-l-purple-500',
    icon: Globe,
  },
  nara: {
    label: 'NARA',
    className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    borderClass: 'border-l-[oklch(0.60_0.12_240)]',
    icon: Archive,
  },
  // NOTE: key is chronicling_america (underscore) — the old file incorrectly
  // used chronicling-america (hyphen). This matches the actual providerId.
  chronicling_america: {
    label: 'Chronicling America',
    className: 'bg-primary/10 text-primary dark:bg-primary/15 dark:text-primary/90',
    borderClass: 'border-l-accent',
    icon: Newspaper,
  },
  familysearch: {
    label: 'FamilySearch',
    className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
    borderClass: 'border-l-[oklch(0.55_0.15_150)]',
    icon: Globe,
  },
  findagrave: {
    label: 'Find A Grave',
    className: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300',
    borderClass: 'border-l-provider-findagrave',
    icon: MapPin,
  },
  web_search: {
    label: 'Web Search',
    className: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300',
    borderClass: 'border-l-primary',
    icon: Search,
  },
  wikitree: {
    label: 'WikiTree',
    className: 'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300',
    borderClass: 'border-l-provider-wikitree',
    icon: TreePine,
  },
};

const DEFAULT_CONFIG: ProviderConfigEntry = {
  label: '',
  className: 'bg-secondary text-secondary-foreground',
  borderClass: 'border-l-border',
  icon: Globe,
};

export function getProviderConfig(providerId: string): ProviderConfigEntry {
  const config = PROVIDER_CONFIG[providerId];
  if (config) return config;
  return { ...DEFAULT_CONFIG, label: providerId };
}

interface ProviderBadgeProps {
  providerId: string;
}

export function ProviderBadge({ providerId }: ProviderBadgeProps) {
  const config = getProviderConfig(providerId);
  return (
    <Badge variant="outline" className={config.className}>
      {config.label}
    </Badge>
  );
}
