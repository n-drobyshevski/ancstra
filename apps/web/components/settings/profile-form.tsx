'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, Save } from 'lucide-react';
import { useTranslations } from 'next-intl';
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

// A short, opinionated locale list. Full BCP-47 input is allowed via the
// underlying server validator (z.string), but most users will pick from here.
const LOCALE_VALUES = [
  'en-US',
  'en-GB',
  'de-DE',
  'fr-FR',
  'es-ES',
  'it-IT',
  'nl-NL',
  'pt-BR',
  'ru-RU',
  'ja-JP',
  'zh-CN',
] as const;

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
  const t = useTranslations('settings.profile.form');
  const tLocales = useTranslations('settings.profile.locales');

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
      toast.error(t('errors.displayNameEmpty'));
      return;
    }
    const trimmedAvatar = avatarUrl.trim();
    if (trimmedAvatar.length > 0) {
      try {
        new URL(trimmedAvatar);
      } catch {
        toast.error(t('errors.avatarInvalid'));
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
      toast.success(t('saved'));
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('errors.saveFailed'));
    }
  }

  type LocaleKey = Parameters<typeof tLocales>[0];

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t('accountHeading')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="profile-name">{t('displayNameLabel')}</Label>
            <Input
              id="profile-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={120}
              required
              disabled={isSaving}
            />
            <p className="text-xs text-muted-foreground">
              {t('displayNameHint')}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="profile-email">{t('emailLabel')}</Label>
            <Input
              id="profile-email"
              type="email"
              value={initialProfile.email}
              disabled
              readOnly
            />
            <p className="text-xs text-muted-foreground">
              {t('emailHint')}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="profile-avatar">{t('avatarUrlLabel')}</Label>
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
              {t('avatarUrlHint')}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('regionHeading')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="profile-locale">{t('languageLabel')}</Label>
              <Select value={locale} onValueChange={setLocale} disabled={isSaving}>
                <SelectTrigger id="profile-locale">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LOCALE_VALUES.map((v) => (
                    <SelectItem key={v} value={v}>
                      {tLocales(v as LocaleKey)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="profile-tz">{t('timezoneLabel')}</Label>
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
          <CardTitle>{t('densityHeading')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-2 sm:flex-row sm:gap-3">
            {(['comfortable', 'compact'] as const).map((d) => (
              <button
                type="button"
                key={d}
                onClick={() => setDensity(d)}
                disabled={isSaving}
                className={cn(
                  'flex-1 rounded-lg border p-4 text-left transition-colors',
                  density === d
                    ? 'border-primary bg-primary/5 ring-1 ring-primary'
                    : 'border-input hover:bg-muted/50',
                )}
              >
                <div className="font-medium">
                  {d === 'comfortable' ? t('densityComfortable') : t('densityCompact')}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {d === 'comfortable' ? t('densityComfortableHint') : t('densityCompactHint')}
                </div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('notificationsHeading')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <Label htmlFor="notify-email" className="text-base">
                {t('emailNotificationsLabel')}
              </Label>
              <p className="text-xs text-muted-foreground mt-1">
                {t('emailNotificationsHint')}
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
                {t('activityFeedLabel')}
              </Label>
              <p className="text-xs text-muted-foreground mt-1">
                {t('activityFeedHint')}
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
              {t('saving')}
            </>
          ) : (
            <>
              <Save className="size-4" />
              {t('saveChanges')}
            </>
          )}
        </Button>
        {dirty ? (
          <span className="text-xs text-muted-foreground">{t('unsavedChanges')}</span>
        ) : null}
      </div>
    </form>
  );
}
