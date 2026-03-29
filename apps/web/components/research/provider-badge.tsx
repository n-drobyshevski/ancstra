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
    className: 'bg-[oklch(0.93_0.04_300)] text-[oklch(0.35_0.12_300)] dark:bg-[oklch(0.28_0.04_300)] dark:text-[oklch(0.75_0.10_300)]',
    borderClass: 'border-l-purple-500',
    icon: Globe,
  },
  nara: {
    label: 'NARA',
    className: 'bg-[oklch(0.93_0.04_240)] text-[oklch(0.35_0.12_240)] dark:bg-[oklch(0.28_0.04_240)] dark:text-[oklch(0.75_0.10_240)]',
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
    className: 'bg-status-success-bg text-status-success-text',
    borderClass: 'border-l-[oklch(0.55_0.15_150)]',
    icon: Globe,
  },
  findagrave: {
    label: 'Find A Grave',
    className: 'bg-[oklch(0.93_0.04_180)] text-[oklch(0.35_0.12_180)] dark:bg-[oklch(0.28_0.04_180)] dark:text-[oklch(0.75_0.10_180)]',
    borderClass: 'border-l-provider-findagrave',
    icon: MapPin,
  },
  web_search: {
    label: 'Web Search',
    className: 'bg-status-info-bg text-status-info-text',
    borderClass: 'border-l-primary',
    icon: Search,
  },
  wikitree: {
    label: 'WikiTree',
    className: 'bg-[oklch(0.93_0.04_300)] text-[oklch(0.35_0.12_300)] dark:bg-[oklch(0.28_0.04_300)] dark:text-[oklch(0.75_0.10_300)]',
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
