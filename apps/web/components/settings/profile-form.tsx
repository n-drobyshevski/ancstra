'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, Save } from 'lucide-react';
import { trpc } from '@/lib/trpc/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

interface ProfileShape {
  name: string;
  email: string;
  avatarUrl: string | null;
}

interface PrefsShape {
  locale: string;
  timezone: string;
  density: 'comfortable' | 'compact';
  notifyEmail: boolean;
  notifyActivity: boolean;
}

interface Props {
  initialProfile: ProfileShape;
  initialPrefs: PrefsShape;
}

const DENSITIES = [
  { value: 'comfortable', label: 'Comfortable', hint: 'Spacious — Quick View default' },
  { value: 'compact', label: 'Compact', hint: 'Dense — Research View' },
] as const;

// A short, opinionated locale list. Full BCP-47 input is allowed via the
// underlying server validator (z.string), but most users will pick from here.
const LOCALES = [
  { value: 'en-US', label: 'English (United States)' },
  { value: 'en-GB', label: 'English (United Kingdom)' },
  { value: 'de-DE', label: 'Deutsch (Deutschland)' },
  { value: 'fr-FR', label: 'Français (France)' },
  { value: 'es-ES', label: 'Español (España)' },
  { value: 'it-IT', label: 'Italiano (Italia)' },
  { value: 'nl-NL', label: 'Nederlands' },
  { value: 'pt-BR', label: 'Português (Brasil)' },
  { value: 'ru-RU', label: 'Русский' },
  { value: 'ja-JP', label: '日本語' },
  { value: 'zh-CN', label: '简体中文' },
];

function getTimezones(): string[] {
  const intl = Intl as unknown as { supportedValuesOf?: (k: string) => string[] };
  if (typeof intl.supportedValuesOf === 'function') {
    try {
      return intl.supportedValuesOf('timeZone');
    } catch {
      /* fall through */
    }
  }
  return [
    'UTC',
    'America/Los_Angeles',
    'America/New_York',
    'Europe/London',
    'Europe/Berlin',
    'Europe/Paris',
    'Asia/Tokyo',
    'Asia/Shanghai',
    'Australia/Sydney',
  ];
}

export function ProfileForm({ initialProfile, initialPrefs }: Props) {
  const router = useRouter();

  const [name, setName] = useState(initialProfile.name);
  const [avatarUrl, setAvatarUrl] = useState(initialProfile.avatarUrl ?? '');

  const [locale, setLocale] = useState(initialPrefs.locale);
  const [timezone, setTimezone] = useState(initialPrefs.timezone);
  const [density, setDensity] = useState<'comfortable' | 'compact'>(initialPrefs.density);
  const [notifyEmail, setNotifyEmail] = useState(initialPrefs.notifyEmail);
  const [notifyActivity, setNotifyActivity] = useState(initialPrefs.notifyActivity);

  const timezones = useMemo(() => getTimezones(), []);

  const updateProfile = trpc.userPreferences.updateProfile.useMutation();
  const updatePrefs = trpc.userPreferences.update.useMutation();

  const isSaving = updateProfile.isPending || updatePrefs.isPending;

  const profileDirty =
    name.trim() !== initialProfile.name ||
    (avatarUrl.trim() || null) !== (initialProfile.avatarUrl ?? null);

  const prefsDirty =
    locale !== initialPrefs.locale ||
    timezone !== initialPrefs.timezone ||
    density !== initialPrefs.density ||
    notifyEmail !== initialPrefs.notifyEmail ||
    notifyActivity !== initialPrefs.notifyActivity;

  const dirty = profileDirty || prefsDirty;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!dirty) return;

    const trimmedName = name.trim();
    if (trimmedName.length === 0) {
      toast.error('Display name cannot be empty.');
      return;
    }
    const trimmedAvatar = avatarUrl.trim();
    if (trimmedAvatar.length > 0) {
      try {
        new URL(trimmedAvatar);
      } catch {
        toast.error('Avatar URL must be a valid URL.');
        return;
      }
    }

    try {
      const ops: Promise<unknown>[] = [];

      if (profileDirty) {
        ops.push(
          updateProfile.mutateAsync({
            ...(trimmedName !== initialProfile.name ? { name: trimmedName } : {}),
            ...((trimmedAvatar || null) !== (initialProfile.avatarUrl ?? null)
              ? { avatarUrl: trimmedAvatar || null }
              : {}),
          }),
        );
      }
      if (prefsDirty) {
        ops.push(
          updatePrefs.mutateAsync({
            ...(locale !== initialPrefs.locale ? { locale } : {}),
            ...(timezone !== initialPrefs.timezone ? { timezone } : {}),
            ...(density !== initialPrefs.density ? { density } : {}),
            ...(notifyEmail !== initialPrefs.notifyEmail ? { notifyEmail } : {}),
            ...(notifyActivity !== initialPrefs.notifyActivity ? { notifyActivity } : {}),
          }),
        );
      }

      await Promise.all(ops);
      toast.success('Saved.');
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save.');
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="profile-name">Display name</Label>
            <Input
              id="profile-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={120}
              required
              disabled={isSaving}
            />
            <p className="text-xs text-muted-foreground">
              Shown next to your contributions and on your avatar.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="profile-email">Email</Label>
            <Input
              id="profile-email"
              type="email"
              value={initialProfile.email}
              disabled
              readOnly
            />
            <p className="text-xs text-muted-foreground">
              Email is set at sign-up and not editable here.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="profile-avatar">Avatar URL</Label>
            <Input
              id="profile-avatar"
              type="url"
              placeholder="https://…"
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              maxLength={2048}
              disabled={isSaving}
            />
            <p className="text-xs text-muted-foreground">
              Leave blank to fall back to a generated avatar.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Region</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="profile-locale">Language</Label>
              <Select value={locale} onValueChange={setLocale} disabled={isSaving}>
                <SelectTrigger id="profile-locale">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LOCALES.map((l) => (
                    <SelectItem key={l.value} value={l.value}>
                      {l.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="profile-tz">Time zone</Label>
              <Select value={timezone} onValueChange={setTimezone} disabled={isSaving}>
                <SelectTrigger id="profile-tz">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {timezones.map((tz) => (
                    <SelectItem key={tz} value={tz}>
                      {tz}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Display density</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-2 sm:flex-row sm:gap-3">
            {DENSITIES.map((d) => (
              <button
                type="button"
                key={d.value}
                onClick={() => setDensity(d.value)}
                disabled={isSaving}
                className={cn(
                  'flex-1 rounded-lg border p-4 text-left transition-colors',
                  density === d.value
                    ? 'border-primary bg-primary/5 ring-1 ring-primary'
                    : 'border-input hover:bg-muted/50',
                )}
              >
                <div className="font-medium">{d.label}</div>
                <div className="text-xs text-muted-foreground mt-1">{d.hint}</div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Notifications</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <Label htmlFor="notify-email" className="text-base">
                Email notifications
              </Label>
              <p className="text-xs text-muted-foreground mt-1">
                Important account changes and invitations.
              </p>
            </div>
            <Switch
              id="notify-email"
              checked={notifyEmail}
              onCheckedChange={setNotifyEmail}
              disabled={isSaving}
            />
          </div>

          <div className="flex items-center justify-between gap-4">
            <div>
              <Label htmlFor="notify-activity" className="text-base">
                Activity feed
              </Label>
              <p className="text-xs text-muted-foreground mt-1">
                Edits and contributions in families you belong to.
              </p>
            </div>
            <Switch
              id="notify-activity"
              checked={notifyActivity}
              onCheckedChange={setNotifyActivity}
              disabled={isSaving}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={!dirty || isSaving}>
          {isSaving ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Saving…
            </>
          ) : (
            <>
              <Save className="size-4" />
              Save changes
            </>
          )}
        </Button>
        {dirty ? (
          <span className="text-xs text-muted-foreground">Unsaved changes</span>
        ) : null}
      </div>
    </form>
  );
}
