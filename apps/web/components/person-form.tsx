'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { createRelatedPerson } from '@/app/actions/create-related-person';
import type { PersonDetail } from '@ancstra/shared';

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

  const defaultSex = getDefaultSex();

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
    <Card>
      <CardContent className="pt-6">
        {isRelationContext && (
          <div className="mb-4 rounded-md border border-primary/20 bg-primary/5 px-4 py-3 text-sm">
            Creating <strong>{relationLabel}</strong> of{' '}
            <strong>{targetPersonName ?? 'loading...'}</strong>
          </div>
        )}

        <form {...formProps} className="space-y-4">
          {/* Hidden fields for server action relation context */}
          {isRelationContext && (
            <>
              <input type="hidden" name="relation" value={relation} />
              <input type="hidden" name="ofPersonId" value={ofPersonId} />
            </>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="givenName">Given Name *</Label>
              <Input
                id="givenName"
                name="givenName"
                required
                defaultValue={person?.givenName ?? ''}
              />
              {errors.givenName && (
                <p className="text-sm text-destructive">{errors.givenName}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="surname">Surname *</Label>
              <Input
                id="surname"
                name="surname"
                required
                defaultValue={person?.surname ?? ''}
              />
              {errors.surname && (
                <p className="text-sm text-destructive">{errors.surname}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="sex">Sex *</Label>
            <select
              id="sex"
              name="sex"
              defaultValue={defaultSex}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="M">Male</option>
              <option value="F">Female</option>
              <option value="U">Unknown</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="birthDate">Birth Date</Label>
              <Input
                id="birthDate"
                name="birthDate"
                placeholder="15 Mar 1845"
                defaultValue={person?.birthDate ?? ''}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="birthPlace">Birth Place</Label>
              <Input
                id="birthPlace"
                name="birthPlace"
                placeholder="Springfield, IL"
                defaultValue={person?.birthPlace ?? ''}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="deathDate">Death Date</Label>
              <Input
                id="deathDate"
                name="deathDate"
                placeholder="23 Nov 1923"
                defaultValue={person?.deathDate ?? ''}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="deathPlace">Death Place</Label>
              <Input
                id="deathPlace"
                name="deathPlace"
                defaultValue={person?.deathPlace ?? ''}
              />
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="isLiving"
              name="isLiving"
              defaultChecked={person?.isLiving ?? false}
            />
            <Label htmlFor="isLiving">Living Person</Label>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              name="notes"
              rows={3}
              defaultValue={person?.notes ?? ''}
            />
          </div>

          <div className="flex gap-2">
            <Button type="submit" disabled={loading}>
              {loading
                ? 'Saving...'
                : isEditMode
                  ? 'Save Changes'
                  : 'Save Person'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
            >
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

export function PersonForm({ person }: PersonFormProps) {
  return (
    <Suspense fallback={null}>
      <PersonFormInner person={person} />
    </Suspense>
  );
}
