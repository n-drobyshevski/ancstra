'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, CalendarIcon } from 'lucide-react';
import { format, parse } from 'date-fns';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { PlaceInput } from '@/components/place-input';
import { toast } from 'sonner';
import { createRelatedPerson } from '@/app/actions/create-related-person';
import type { PersonDetail } from '@ancstra/shared';
import { personDetailCache } from '@/lib/tree/person-detail-cache';

/** Try to parse a flexible date string into a Date object for the calendar */
function tryParseDate(value: string): Date | undefined {
  if (!value) return undefined;
  // Try common genealogy formats
  for (const fmt of ['d MMM yyyy', 'dd MMM yyyy', 'yyyy-MM-dd', 'dd/MM/yyyy', 'MM/dd/yyyy', 'd MMMM yyyy']) {
    try {
      const d = parse(value, fmt, new Date());
      if (!isNaN(d.getTime()) && d.getFullYear() > 0) return d;
    } catch { /* try next */ }
  }
  // Fallback: native Date parsing
  const d = new Date(value);
  if (!isNaN(d.getTime()) && d.getFullYear() > 0) return d;
  return undefined;
}

interface PersonFormProps {
  person?: PersonDetail;
}

function PersonFormInner({ person }: PersonFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Relation context from URL search params
  const relation = searchParams.get('relation');
  const ofPersonId = searchParams.get('of');
  const isRelationContext = !!(relation && ofPersonId);
  const isEditMode = !!person;

  // Fetch target person name for context banner
  const [targetPersonName, setTargetPersonName] = useState<string | null>(null);
  const [targetPersonSex, setTargetPersonSex] = useState<string | null>(null);

  useEffect(() => {
    if (!ofPersonId) return;
    fetch(`/api/persons/${ofPersonId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) {
          setTargetPersonName(`${data.givenName} ${data.surname}`);
          setTargetPersonSex(data.sex ?? null);
        }
      })
      .catch(() => {});
  }, [ofPersonId]);

  // Determine default sex based on relation context
  function getDefaultSex(): string {
    if (isEditMode) return person.sex;
    if (!relation) return 'U';
    if (relation === 'father') return 'M';
    if (relation === 'mother') return 'F';
    if (relation === 'spouse' && targetPersonSex) {
      return targetPersonSex === 'M' ? 'F' : targetPersonSex === 'F' ? 'M' : 'U';
    }
    return 'U';
  }

  const [sex, setSex] = useState(getDefaultSex());
  const [isLiving, setIsLiving] = useState(person?.isLiving ?? true);
  const [birthDate, setBirthDate] = useState<Date | undefined>(
    person?.birthDate ? tryParseDate(person.birthDate) : undefined
  );
  const [birthCalendarOpen, setBirthCalendarOpen] = useState(false);
  const [deathDate, setDeathDate] = useState<Date | undefined>(
    person?.deathDate ? tryParseDate(person.deathDate) : undefined
  );
  const [deathCalendarOpen, setDeathCalendarOpen] = useState(false);

  // Handle edit mode submit (PUT)
  async function handleEditSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!person) return;
    setErrors({});
    setLoading(true);

    const form = new FormData(e.currentTarget);
    const body = {
      givenName: form.get('givenName') as string,
      surname: form.get('surname') as string,
      sex: form.get('sex') as string,
      birthDate: (form.get('birthDate') as string) || undefined,
      birthPlace: (form.get('birthPlace') as string) || undefined,
      deathDate: (form.get('deathDate') as string) || undefined,
      deathPlace: (form.get('deathPlace') as string) || undefined,
      isLiving: form.get('isLiving') === 'on' || form.get('isLiving') === 'true',
      notes: (form.get('notes') as string) || undefined,
    };

    const res = await fetch(`/api/persons/${person.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const data = await res.json();
      if (data.issues) {
        const fieldErrors: Record<string, string> = {};
        for (const issue of data.issues) {
          const path = issue.path?.[0];
          if (path) fieldErrors[path] = issue.message;
        }
        setErrors(fieldErrors);
      } else {
        toast.error(data.error || 'Failed to update person');
      }
      setLoading(false);
      return;
    }

    personDetailCache.invalidate(person.id);
    toast.success('Changes saved');
    router.push(`/persons/${person.id}`);
  }

  // Handle standard create submit (POST)
  async function handleCreateSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrors({});
    setLoading(true);

    const form = new FormData(e.currentTarget);
    const body = {
      givenName: form.get('givenName') as string,
      surname: form.get('surname') as string,
      sex: form.get('sex') as string,
      birthDate: (form.get('birthDate') as string) || undefined,
      birthPlace: (form.get('birthPlace') as string) || undefined,
      deathDate: (form.get('deathDate') as string) || undefined,
      deathPlace: (form.get('deathPlace') as string) || undefined,
      isLiving: form.get('isLiving') === 'on' || form.get('isLiving') === 'true',
      notes: (form.get('notes') as string) || undefined,
    };

    const res = await fetch('/api/persons', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const data = await res.json();
      if (data.issues) {
        const fieldErrors: Record<string, string> = {};
        for (const issue of data.issues) {
          const path = issue.path?.[0];
          if (path) fieldErrors[path] = issue.message;
        }
        setErrors(fieldErrors);
      } else {
        toast.error(data.error || 'Failed to create person');
      }
      setLoading(false);
      return;
    }

    const created = await res.json();
    toast.success(`${body.givenName} ${body.surname} created`);
    router.push(`/persons/${created.id}`);
  }

  // Relation context uses server action via form action
  const formProps = isRelationContext
    ? { action: createRelatedPerson }
    : { onSubmit: isEditMode ? handleEditSubmit : handleCreateSubmit };

  const relationLabel =
    relation === 'father' ? 'father' :
    relation === 'mother' ? 'mother' :
    relation === 'spouse' ? 'spouse' :
    relation === 'child' ? 'child' : relation;

  return (
    <>
      {/* Mobile header with back arrow */}
      <div className="mb-3 flex items-center gap-2 md:hidden">
        <button
          type="button"
          onClick={() => router.back()}
          className="-ml-1 rounded-md p-1.5 hover:bg-muted"
          aria-label="Go back"
        >
          <ArrowLeft className="size-4" />
        </button>
        <h1 className="text-base font-semibold">
          {isEditMode ? `Edit ${person.givenName} ${person.surname}` : 'Add New Person'}
        </h1>
      </div>

      <Card>
        <CardContent className="pt-6">
          {/* Relation context banner — keep as-is */}
          {isRelationContext && (
            <div className="mb-4 rounded-md border border-primary/20 bg-primary/5 px-4 py-3 text-sm">
              Creating <strong>{relationLabel}</strong> of{' '}
              <strong>{targetPersonName ?? 'loading...'}</strong>
            </div>
          )}

          <form id="person-form" {...formProps} className="space-y-4">
            {/* Hidden fields for server action relation context */}
            {isRelationContext && (
              <>
                <input type="hidden" name="relation" value={relation} />
                <input type="hidden" name="ofPersonId" value={ofPersonId} />
              </>
            )}

            {/* Names — responsive grid */}
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4">
              <div className="space-y-2">
                <Label htmlFor="givenName">Given Name <span className="text-destructive">*</span></Label>
                <Input
                  id="givenName"
                  name="givenName"
                  required
                  defaultValue={person?.givenName ?? ''}
                  className="h-10 md:h-8"
                />
                {errors.givenName && (
                  <p className="text-sm text-destructive">{errors.givenName}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="surname">Surname <span className="text-destructive">*</span></Label>
                <Input
                  id="surname"
                  name="surname"
                  required
                  defaultValue={person?.surname ?? ''}
                  className="h-10 md:h-8"
                />
                {errors.surname && (
                  <p className="text-sm text-destructive">{errors.surname}</p>
                )}
              </div>
            </div>

            {/* Sex — segmented control */}
            <div className="space-y-2">
              <Label>Sex <span className="text-destructive">*</span></Label>
              <input type="hidden" name="sex" value={sex} />
              <div
                role="radiogroup"
                aria-label="Sex"
                className="inline-flex w-full overflow-hidden rounded-lg border border-border md:w-auto"
              >
                {(['M', 'F', 'U'] as const).map((value) => {
                  const label = value === 'M' ? 'Male' : value === 'F' ? 'Female' : 'Unknown';
                  const isActive = sex === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      role="radio"
                      aria-checked={isActive}
                      onClick={() => setSex(value)}
                      className={`flex-1 px-4 py-1.5 text-sm font-medium transition-colors md:flex-none ${
                        isActive
                          ? 'bg-primary text-primary-foreground'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            <Separator />

            {/* Living toggle */}
            <div className="flex items-center space-x-2">
              <Switch
                id="isLiving"
                name="isLiving"
                checked={isLiving}
                onCheckedChange={setIsLiving}
              />
              <Label htmlFor="isLiving">Living Person</Label>
            </div>

            {/* Birth date/place — responsive grid */}
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4">
              <div className="space-y-2">
                <Label>Birth Date</Label>
                <input type="hidden" name="birthDate" value={birthDate ? format(birthDate, 'd MMM yyyy') : ''} />
                <Popover open={birthCalendarOpen} onOpenChange={setBirthCalendarOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className={`h-10 w-full justify-start font-normal md:h-8 ${
                        !birthDate ? 'text-muted-foreground' : ''
                      }`}
                    >
                      <CalendarIcon className="mr-2 size-4" />
                      {birthDate ? format(birthDate, 'd MMM yyyy') : 'Pick a date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      captionLayout="dropdown"
                      selected={birthDate}
                      defaultMonth={birthDate}
                      onSelect={(date) => {
                        setBirthDate(date);
                        setBirthCalendarOpen(false);
                      }}
                      startMonth={new Date(1700, 0)}
                      endMonth={new Date()}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <PlaceInput
                name="birthPlace"
                label="Birth Place"
                defaultValue={person?.birthPlace ?? ''}
              />
            </div>

            {/* Death date/place — dimmed when living */}
            <div
              className={`grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4 transition-opacity duration-200 ${
                isLiving ? 'opacity-40 pointer-events-none' : ''
              }`}
              aria-disabled={isLiving}
            >
              <div className="space-y-2">
                <Label>Death Date</Label>
                <input type="hidden" name="deathDate" value={deathDate ? format(deathDate, 'd MMM yyyy') : ''} />
                <Popover open={deathCalendarOpen} onOpenChange={setDeathCalendarOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={isLiving}
                      className={`h-10 w-full justify-start font-normal md:h-8 ${
                        !deathDate ? 'text-muted-foreground' : ''
                      }`}
                    >
                      <CalendarIcon className="mr-2 size-4" />
                      {deathDate ? format(deathDate, 'd MMM yyyy') : 'Pick a date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      captionLayout="dropdown"
                      selected={deathDate}
                      defaultMonth={deathDate}
                      onSelect={(date) => {
                        setDeathDate(date);
                        setDeathCalendarOpen(false);
                      }}
                      startMonth={new Date(1700, 0)}
                      endMonth={new Date()}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <PlaceInput
                name="deathPlace"
                label="Death Place"
                defaultValue={person?.deathPlace ?? ''}
                disabled={isLiving}
              />
            </div>

            <Separator />

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                name="notes"
                rows={3}
                defaultValue={person?.notes ?? ''}
              />
            </div>

            {/* Desktop: inline buttons */}
            <div className="hidden gap-2 md:flex">
              <Button type="submit" disabled={loading}>
                {loading ? 'Saving...' : isEditMode ? 'Save Changes' : 'Save Person'}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => router.back()}
              >
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Mobile: sticky save bar */}
      <div className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background px-4 pb-[env(safe-area-inset-bottom,0px)] pt-2 shadow-lg md:hidden">
        <Button
          type="submit"
          form="person-form"
          disabled={loading}
          className="w-full"
        >
          {loading ? 'Saving...' : isEditMode ? 'Save Changes' : 'Save Person'}
        </Button>
      </div>
    </>
  );
}

export function PersonForm({ person }: PersonFormProps) {
  return (
    <Suspense fallback={null}>
      <PersonFormInner person={person} />
    </Suspense>
  );
}
