'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { PersonDetail as PersonDetailType, PersonListItem } from '@ancstra/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { EventList } from '@/components/event-list';
import { CitationList } from '@/components/citation-list';
import { PersonLinkPopover } from '@/components/person-link-popover';
import { BiographyTab } from '@/components/biography/biography-tab';
import { HistoricalEvent } from '@/components/timeline/historical-event';
import { toast } from 'sonner';

const sexLabel = { M: 'Male', F: 'Female', U: 'Unknown' } as const;

function PersonLink({ person }: { person: PersonListItem }) {
  return (
    <Link
      href={`/person/${person.id}`}
      className="text-sm text-primary underline-offset-4 hover:underline"
    >
      {person.givenName} {person.surname}
      {person.birthDate ? ` (b. ${person.birthDate})` : ''}
    </Link>
  );
}

export function PersonDetail({ person }: { person: PersonDetailType }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Edit form state
  const [givenName, setGivenName] = useState(person.givenName);
  const [surname, setSurname] = useState(person.surname);
  const [birthDate, setBirthDate] = useState(person.birthDate ?? '');
  const [birthPlace, setBirthPlace] = useState(person.birthPlace ?? '');
  const [deathDate, setDeathDate] = useState(person.deathDate ?? '');
  const [deathPlace, setDeathPlace] = useState(person.deathPlace ?? '');
  const [isLiving, setIsLiving] = useState(person.isLiving);
  const [notes, setNotes] = useState(person.notes ?? '');

  // Historical context state
  const [showHistorical, setShowHistorical] = useState(false);
  const [historicalEvents, setHistoricalEvents] = useState<
    { year: number; title: string; description: string; relevance: string }[]
  >([]);
  const [historicalLoading, setHistoricalLoading] = useState(false);
  const [historicalLoaded, setHistoricalLoaded] = useState(false);

  const fetchHistoricalContext = useCallback(async () => {
    setHistoricalLoading(true);
    try {
      const res = await fetch(
        `/api/ai/historical-context?personId=${encodeURIComponent(person.id)}`
      );
      if (res.ok) {
        const data = await res.json();
        if (data.events && Array.isArray(data.events)) {
          setHistoricalEvents(data.events);
          setHistoricalLoaded(true);
        }
      }
    } catch {
      // Failed to load historical context
    } finally {
      setHistoricalLoading(false);
    }
  }, [person.id]);

  async function generateHistoricalContext() {
    setHistoricalLoading(true);
    try {
      const res = await fetch('/api/ai/historical-context', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ personId: person.id }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.events && Array.isArray(data.events)) {
          setHistoricalEvents(data.events);
          setHistoricalLoaded(true);
        }
      }
    } catch {
      toast.error('Failed to generate historical context');
    } finally {
      setHistoricalLoading(false);
    }
  }

  useEffect(() => {
    if (showHistorical && !historicalLoaded && !historicalLoading) {
      fetchHistoricalContext();
    }
  }, [showHistorical, historicalLoaded, historicalLoading, fetchHistoricalContext]);

  function resetForm() {
    setGivenName(person.givenName);
    setSurname(person.surname);
    setBirthDate(person.birthDate ?? '');
    setBirthPlace(person.birthPlace ?? '');
    setDeathDate(person.deathDate ?? '');
    setDeathPlace(person.deathPlace ?? '');
    setIsLiving(person.isLiving);
    setNotes(person.notes ?? '');
    setEditing(false);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch(`/api/persons/${person.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          givenName,
          surname,
          birthDate: birthDate || undefined,
          birthPlace: birthPlace || undefined,
          deathDate: deathDate || undefined,
          deathPlace: deathPlace || undefined,
          isLiving,
          notes: notes || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error ?? 'Failed to save changes');
        return;
      }
      toast.success('Person updated');
      setEditing(false);
      router.refresh();
    } catch {
      toast.error('Network error');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/persons/${person.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error ?? 'Failed to delete');
        setDeleting(false);
        return;
      }
      toast.success('Person deleted');
      router.push('/dashboard');
    } catch {
      toast.error('Network error');
      setDeleting(false);
    }
  }

  const fullName = [person.prefix, person.givenName, person.surname, person.suffix]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="max-w-2xl mx-auto py-8 space-y-6">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold">{fullName}</h1>
          <Badge variant="secondary">{sexLabel[person.sex]}</Badge>
          {person.isLiving && <Badge>Living</Badge>}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/person/${person.id}/edit`}>Edit</Link>
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm" disabled={deleting}>
                Delete
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete {fullName}?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. This will permanently delete this
                  person and remove them from all family relationships.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete}>
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* ── Vital Info Card ── */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Vital Information</CardTitle>
          {!editing && (
            <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
              Edit
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {editing ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="givenName">Given Name</Label>
                  <Input
                    id="givenName"
                    value={givenName}
                    onChange={(e) => setGivenName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="surname">Surname</Label>
                  <Input
                    id="surname"
                    value={surname}
                    onChange={(e) => setSurname(e.target.value)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="birthDate">Birth Date</Label>
                  <Input
                    id="birthDate"
                    value={birthDate}
                    onChange={(e) => setBirthDate(e.target.value)}
                    placeholder="e.g. 15 Mar 1880"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="birthPlace">Birth Place</Label>
                  <Input
                    id="birthPlace"
                    value={birthPlace}
                    onChange={(e) => setBirthPlace(e.target.value)}
                    placeholder="e.g. London, England"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="deathDate">Death Date</Label>
                  <Input
                    id="deathDate"
                    value={deathDate}
                    onChange={(e) => setDeathDate(e.target.value)}
                    placeholder="e.g. 22 Nov 1945"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="deathPlace">Death Place</Label>
                  <Input
                    id="deathPlace"
                    value={deathPlace}
                    onChange={(e) => setDeathPlace(e.target.value)}
                    placeholder="e.g. Manchester, England"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="isLiving"
                  checked={isLiving}
                  onCheckedChange={setIsLiving}
                />
                <Label htmlFor="isLiving">Living</Label>
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                />
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={handleSave} disabled={saving}>
                  {saving ? 'Saving...' : 'Save'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={resetForm}
                  disabled={saving}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3 text-sm">
              {(person.birthDate || person.birthPlace) && (
                <div>
                  <span className="font-medium">Birth:</span>{' '}
                  {[person.birthDate, person.birthPlace].filter(Boolean).join(', ')}
                </div>
              )}
              {(person.deathDate || person.deathPlace) && (
                <div>
                  <span className="font-medium">Death:</span>{' '}
                  {[person.deathDate, person.deathPlace].filter(Boolean).join(', ')}
                </div>
              )}
              {!person.birthDate &&
                !person.birthPlace &&
                !person.deathDate &&
                !person.deathPlace && (
                  <p className="text-muted-foreground">No vital events recorded.</p>
                )}
              {person.notes && (
                <div>
                  <span className="font-medium">Notes:</span>{' '}
                  <span className="whitespace-pre-wrap">{person.notes}</span>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Family Card ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Family</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Spouses */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-muted-foreground">Spouses</h3>
            {person.spouses.length === 0 && (
              <p className="text-sm text-muted-foreground">None recorded</p>
            )}
            {person.spouses.map((spouse) => (
              <div key={spouse.id} className="flex items-center gap-2">
                <PersonLink person={spouse} />
              </div>
            ))}
            <Button variant="outline" size="sm" asChild>
              <Link href={`/person/new?relation=spouse&of=${person.id}`}>
                + Add Spouse
              </Link>
            </Button>
          </div>

          {/* Parents */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-muted-foreground">Parents</h3>
            {person.parents.length === 0 && (
              <p className="text-sm text-muted-foreground">None recorded</p>
            )}
            {person.parents.map((parent) => (
              <div key={parent.id} className="flex items-center gap-2">
                <PersonLink person={parent} />
              </div>
            ))}
            <div className="flex gap-2">
              <Button variant="outline" size="sm" asChild>
                <Link href={`/person/new?relation=father&of=${person.id}`}>
                  + Add Father
                </Link>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link href={`/person/new?relation=mother&of=${person.id}`}>
                  + Add Mother
                </Link>
              </Button>
            </div>
          </div>

          {/* Children */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-muted-foreground">Children</h3>
            {person.children.length === 0 && (
              <p className="text-sm text-muted-foreground">None recorded</p>
            )}
            {person.children.map((child) => (
              <div key={child.id} className="flex items-center gap-2">
                <PersonLink person={child} />
              </div>
            ))}
            <Button variant="outline" size="sm" asChild>
              <Link href={`/person/new?relation=child&of=${person.id}`}>
                + Add Child
              </Link>
            </Button>
          </div>

          {/* Link existing person */}
          <div className="pt-2 border-t">
            <PersonLinkPopover
              personId={person.id}
              personSex={person.sex}
              onLinked={() => router.refresh()}
            />
          </div>
        </CardContent>
      </Card>

      {/* ── Events ── */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Events</CardTitle>
          <div className="flex items-center gap-2">
            <Switch
              id="showHistorical"
              checked={showHistorical}
              onCheckedChange={setShowHistorical}
            />
            <Label htmlFor="showHistorical" className="text-xs">
              Historical Context
            </Label>
          </div>
        </CardHeader>
        <CardContent>
          <EventList
            events={person.events}
            personId={person.id}
            onUpdate={() => router.refresh()}
          />
          {showHistorical && (
            <div className="mt-4 space-y-1">
              {historicalLoading && (
                <p className="text-xs text-muted-foreground py-2">
                  Loading historical context...
                </p>
              )}
              {!historicalLoading &&
                historicalLoaded &&
                historicalEvents.length === 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={generateHistoricalContext}
                  >
                    Generate Historical Context
                  </Button>
                )}
              {historicalEvents.map((evt, i) => (
                <HistoricalEvent
                  key={i}
                  year={evt.year}
                  title={evt.title}
                  description={evt.description}
                  relevance={evt.relevance}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Biography ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Biography</CardTitle>
        </CardHeader>
        <CardContent>
          <BiographyTab personId={person.id} />
        </CardContent>
      </Card>

      {/* ── Sources ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sources</CardTitle>
        </CardHeader>
        <CardContent>
          <CitationList personId={person.id} onUpdate={() => router.refresh()} />
        </CardContent>
      </Card>

      {/* ── Footer ── */}
      <div className="text-xs text-muted-foreground">
        Created: {new Date(person.createdAt).toLocaleDateString()} | Updated:{' '}
        {new Date(person.updatedAt).toLocaleDateString()}
      </div>

      <Button variant="outline" asChild>
        <Link href="/dashboard">Back to Dashboard</Link>
      </Button>
    </div>
  );
}
