'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Loader2, ArrowLeft, ArrowRight, FileUp, User as UserIcon, Plus } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { trpc } from '@/lib/trpc/client';
import { GedcomImport } from '@/components/gedcom-import';

type Step =
  | { kind: 'name' }
  | { kind: 'seed' }
  | { kind: 'root-self' }
  | { kind: 'gedcom-creating' }
  | { kind: 'gedcom-importing'; familyId: string }
  | { kind: 'blank' };

type Sex = 'M' | 'F' | 'U';

/**
 * Split a single name string into givenName + surname. The signup form
 * collects a single "name" — we treat the first whitespace-separated chunk
 * as the given name and the rest as surname. Surname falls back to empty
 * string but the schema requires it be non-empty, so we re-prompt in that
 * case rather than guess.
 */
function splitName(full: string): { given: string; surname: string } {
  const trimmed = full.trim();
  const idx = trimmed.indexOf(' ');
  if (idx === -1) return { given: trimmed, surname: '' };
  return {
    given: trimmed.slice(0, idx),
    surname: trimmed.slice(idx + 1).trim(),
  };
}

export function CreateFamilyWizard() {
  const t = useTranslations('auth.createFamily');
  const { data: session, status: sessionStatus, update: updateSession } = useSession();
  const createFamily = trpc.family.create.useMutation();

  const [step, setStep] = useState<Step>({ kind: 'name' });
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const sessionName = session?.user?.name ?? '';

  function goBack() {
    setError(null);
    setStep((cur) => {
      if (cur.kind === 'seed') return { kind: 'name' };
      if (cur.kind === 'root-self' || cur.kind === 'blank') return { kind: 'seed' };
      // No back from creating/importing — the family already exists.
      return cur;
    });
  }

  async function landOnDashboard(familyId: string) {
    // Two-step recovery from the post-create stale JWT:
    //   1. Trigger a session refresh so next-auth re-runs the JWT callback
    //      and (ideally) re-encodes the cookie with the new membership.
    //   2. Hard-navigate. A full page load lets the proxy's stale-JWT path
    //      pull live memberships from the DB — works even if step 1 was a
    //      no-op, which can happen in next-auth v5 because the empty-array
    //      `!token.memberships` short-circuit means trigger='update' is the
    //      only branch that refreshes, and useSession.update()'s actual
    //      payload semantics shifted between betas.
    //   `router.push` retains the React tree, which keeps the wizard's
    //   client-side session view stale; window.location forces a clean
    //   server-rendered dashboard with the fresh data.
    try {
      await updateSession();
    } catch {
      /* update() is best-effort — the proxy path covers us either way. */
    }
    window.location.href = `/dashboard?family=${familyId}`;
  }

  // ── Step 1: name ────────────────────────────────────────────────────────
  if (step.kind === 'name') {
    return (
      <Shell>
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-semibold">{t('stepName.title')}</CardTitle>
          <p className="text-sm text-muted-foreground">{t('stepName.tagline')}</p>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              const trimmed = name.trim();
              if (!trimmed) {
                setError(t('errors.nameRequired'));
                return;
              }
              setError(null);
              setName(trimmed);
              setStep({ kind: 'seed' });
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="name">{t('stepName.label')}</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('stepName.placeholder')}
                autoFocus
                required
              />
              {error && <p className="text-sm text-destructive">{error}</p>}
            </div>
            <Button type="submit" className="w-full">
              {t('stepName.next')}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </form>
        </CardContent>
      </Shell>
    );
  }

  // ── Step 2: seed picker ─────────────────────────────────────────────────
  if (step.kind === 'seed') {
    return (
      <Shell>
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-semibold">{t('stepSeed.title')}</CardTitle>
          <p className="text-sm text-muted-foreground">{t('stepSeed.tagline')}</p>
        </CardHeader>
        <CardContent className="space-y-3">
          <SeedCard
            icon={<UserIcon className="h-5 w-5" />}
            label={t('stepSeed.rootSelf.label')}
            description={t('stepSeed.rootSelf.description')}
            onClick={() => setStep({ kind: 'root-self' })}
          />
          <SeedCard
            icon={<FileUp className="h-5 w-5" />}
            label={t('stepSeed.gedcom.label')}
            description={t('stepSeed.gedcom.description')}
            onClick={() => {
              // Create the family first so the GEDCOM importer has a DB to
              // write to. The importer renders only after creation + JWT
              // refresh succeeds.
              setStep({ kind: 'gedcom-creating' });
              createFamily.mutate(
                { name, seed: { kind: 'gedcom' } },
                {
                  onSuccess: async ({ familyId }) => {
                    await updateSession();
                    setStep({ kind: 'gedcom-importing', familyId });
                  },
                  onError: () => {
                    setError(t('errors.createFailed'));
                    setStep({ kind: 'seed' });
                  },
                },
              );
            }}
          />
          <SeedCard
            icon={<Plus className="h-5 w-5" />}
            label={t('stepSeed.blank.label')}
            description={t('stepSeed.blank.description')}
            onClick={() => setStep({ kind: 'blank' })}
          />
          <div className="pt-2">
            <Button variant="ghost" onClick={goBack} className="w-full">
              <ArrowLeft className="mr-2 h-4 w-4" />
              {t('stepSeed.back')}
            </Button>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </CardContent>
      </Shell>
    );
  }

  // ── Step 3a: root-self ──────────────────────────────────────────────────
  if (step.kind === 'root-self') {
    // Wait for session to settle so we can pre-fill name fields from
    // signup. RootSelfStep takes sessionName as a prop and uses it for
    // the *initial* form state — no effect-driven re-fills, no compiler-
    // hostile setState-in-useEffect.
    if (sessionStatus === 'loading') {
      return (
        <Shell>
          <CardContent className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </CardContent>
        </Shell>
      );
    }
    return (
      <RootSelfStep
        sessionName={sessionName}
        creating={createFamily.isPending}
        error={error}
        onBack={goBack}
        onSubmit={async ({ given, surname, sex, birthYear }) => {
          setError(null);
          try {
            const { familyId } = await createFamily.mutateAsync({
              name,
              seed: {
                kind: 'root-self',
                givenName: given,
                surname,
                sex,
                ...(birthYear !== undefined ? { birthYear } : {}),
              },
            });
            await landOnDashboard(familyId);
          } catch (e) {
            setError((e as Error).message || t('errors.createFailed'));
          }
        }}
      />
    );
  }

  // ── Step 3b: gedcom-creating (interstitial) ─────────────────────────────
  if (step.kind === 'gedcom-creating') {
    return (
      <Shell>
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-semibold">{t('stepGedcom.title')}</CardTitle>
          <p className="text-sm text-muted-foreground">{t('stepGedcom.preparing')}</p>
        </CardHeader>
        <CardContent className="flex justify-center py-6">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Shell>
    );
  }

  // ── Step 3c: gedcom-importing ───────────────────────────────────────────
  if (step.kind === 'gedcom-importing') {
    return (
      <Shell wide>
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-semibold">{t('stepGedcom.title')}</CardTitle>
          <p className="text-sm text-muted-foreground">{t('stepGedcom.tagline')}</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <GedcomImport
            redirectAfterImport={`/dashboard?family=${step.familyId}`}
            hardRedirect
          />
          <Button
            variant="ghost"
            className="w-full"
            onClick={() => landOnDashboard(step.familyId)}
          >
            {t('stepGedcom.skip')}
          </Button>
        </CardContent>
      </Shell>
    );
  }

  // ── Step 3d: blank ──────────────────────────────────────────────────────
  return (
    <Shell>
      <CardHeader className="text-center">
        <CardTitle className="text-2xl font-semibold">{t('stepBlank.title')}</CardTitle>
        <p className="text-sm text-muted-foreground">{t('stepBlank.tagline')}</p>
      </CardHeader>
      <CardContent className="space-y-3">
        <Button
          className="w-full"
          disabled={createFamily.isPending}
          onClick={async () => {
            setError(null);
            try {
              const { familyId } = await createFamily.mutateAsync({
                name,
                seed: { kind: 'blank' },
              });
              await landOnDashboard(familyId);
            } catch (e) {
              setError((e as Error).message || t('errors.createFailed'));
            }
          }}
        >
          {createFamily.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {t('stepBlank.creating')}
            </>
          ) : (
            t('stepBlank.create')
          )}
        </Button>
        <Button variant="ghost" className="w-full" onClick={goBack}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t('stepBlank.back')}
        </Button>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </CardContent>
    </Shell>
  );
}

function Shell({ children, wide = false }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4 py-8">
      <Card className={wide ? 'w-full max-w-lg' : 'w-full max-w-sm'}>
        {children}
      </Card>
    </div>
  );
}

function SeedCard({
  icon,
  label,
  description,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-full items-start gap-3 rounded-lg border border-border bg-card p-3 text-left transition-colors hover:border-primary/40 hover:bg-primary/5 focus:outline-none focus:ring-2 focus:ring-ring"
    >
      <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground transition-colors group-hover:bg-primary/10 group-hover:text-primary">
        {icon}
      </span>
      <span className="space-y-0.5">
        <span className="block font-medium">{label}</span>
        <span className="block text-sm text-muted-foreground">{description}</span>
      </span>
    </button>
  );
}

function RootSelfStep({
  sessionName,
  creating,
  error,
  onBack,
  onSubmit,
}: {
  sessionName: string;
  creating: boolean;
  error: string | null;
  onBack: () => void;
  onSubmit: (input: {
    given: string;
    surname: string;
    sex: Sex;
    birthYear?: number;
  }) => Promise<void>;
}) {
  const t = useTranslations('auth.createFamily.stepRootSelf');

  // Pre-fill from the signup name; user can edit either field freely. The
  // parent gates the mount on session !== 'loading', so sessionName is
  // stable here — useState reads it once and never re-syncs.
  const initial = splitName(sessionName);
  const [given, setGiven] = useState(initial.given);
  const [surname, setSurname] = useState(initial.surname);
  const [sex, setSex] = useState<Sex>('U');
  const [birthYearInput, setBirthYearInput] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimGiven = given.trim();
    const trimSurname = surname.trim();
    const yearTrim = birthYearInput.trim();
    const birthYear = yearTrim ? Number(yearTrim) : undefined;
    if (!trimGiven || !trimSurname) return; // HTML required attrs surface errors
    await onSubmit({
      given: trimGiven,
      surname: trimSurname,
      sex,
      ...(birthYear !== undefined && Number.isFinite(birthYear) ? { birthYear } : {}),
    });
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4 py-8">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-semibold">{t('title')}</CardTitle>
          <p className="text-sm text-muted-foreground">{t('tagline')}</p>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="given-name">{t('givenNameLabel')}</Label>
              <Input
                id="given-name"
                value={given}
                onChange={(e) => setGiven(e.target.value)}
                required
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="surname">{t('surnameLabel')}</Label>
              <Input
                id="surname"
                value={surname}
                onChange={(e) => setSurname(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sex">{t('sexLabel')}</Label>
              <Select value={sex} onValueChange={(v) => setSex(v as Sex)}>
                <SelectTrigger id="sex" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="M">{t('sexMale')}</SelectItem>
                  <SelectItem value="F">{t('sexFemale')}</SelectItem>
                  <SelectItem value="U">{t('sexUnknown')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="birth-year">{t('birthYearLabel')}</Label>
              <Input
                id="birth-year"
                type="number"
                inputMode="numeric"
                pattern="[0-9]*"
                min={1}
                max={9999}
                value={birthYearInput}
                onChange={(e) => setBirthYearInput(e.target.value)}
                placeholder="1988"
              />
              <p className="text-xs text-muted-foreground">{t('birthYearHint')}</p>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={creating}>
              {creating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('creating')}
                </>
              ) : (
                t('create')
              )}
            </Button>
            <Button type="button" variant="ghost" className="w-full" onClick={onBack} disabled={creating}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              {t('back')}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
