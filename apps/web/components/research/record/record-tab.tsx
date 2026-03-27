'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import type { PersonDetail, PersonListItem } from '@ancstra/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
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
import { PersonLinkPopover } from '@/components/person-link-popover';

interface RecordTabProps {
  person: PersonDetail;
}

export function RecordTab({ person }: RecordTabProps) {
  const router = useRouter();

  // --- Vitals edit state ---
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [givenName, setGivenName] = useState(person.givenName);
  const [surname, setSurname] = useState(person.surname);
  const [birthDate, setBirthDate] = useState(person.birthDate ?? '');
  const [birthPlace, setBirthPlace] = useState(person.birthPlace ?? '');
  const [deathDate, setDeathDate] = useState(person.deathDate ?? '');
  const [deathPlace, setDeathPlace] = useState(person.deathPlace ?? '');
  const [isLiving, setIsLiving] = useState(person.isLiving);
  const [notes, setNotes] = useState(person.notes ?? '');

  // --- Delete state ---
  const [deleting, setDeleting] = useState(false);

  const handleSaveVitals = useCallback(async () => {
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
      if (!res.ok) throw new Error('Save failed');
      toast.success('Person updated');
      setEditing(false);
      router.refresh();
    } catch {
      toast.error('Failed to save changes');
    } finally {
      setSaving(false);
    }
  }, [person.id, givenName, surname, birthDate, birthPlace, deathDate, deathPlace, isLiving, notes, router]);

  const handleDelete = useCallback(async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/persons/${person.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      toast.success('Person deleted');
      router.push('/persons');
    } catch {
      toast.error('Failed to delete person');
      setDeleting(false);
    }
  }, [person.id, router]);

  const fullName = [person.prefix, person.givenName, person.surname, person.suffix]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="max-w-2xl space-y-6">
      {/* Vitals Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Vital Information</CardTitle>
          {!editing && (
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
              Edit
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {editing ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="givenName">Given Name</Label>
                  <Input id="givenName" value={givenName} onChange={(e) => setGivenName(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="surname">Surname</Label>
                  <Input id="surname" value={surname} onChange={(e) => setSurname(e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="birthDate">Birth Date</Label>
                  <Input id="birthDate" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} placeholder="15 Mar 1880" />
                </div>
                <div>
                  <Label htmlFor="birthPlace">Birth Place</Label>
                  <Input id="birthPlace" value={birthPlace} onChange={(e) => setBirthPlace(e.target.value)} placeholder="London, England" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="deathDate">Death Date</Label>
                  <Input id="deathDate" value={deathDate} onChange={(e) => setDeathDate(e.target.value)} placeholder="22 Nov 1945" />
                </div>
                <div>
                  <Label htmlFor="deathPlace">Death Place</Label>
                  <Input id="deathPlace" value={deathPlace} onChange={(e) => setDeathPlace(e.target.value)} placeholder="Manchester, England" />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Switch id="isLiving" checked={isLiving} onCheckedChange={setIsLiving} />
                <Label htmlFor="isLiving">Is Living</Label>
              </div>
              <div>
                <Label htmlFor="notes">Notes</Label>
                <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} />
              </div>
              <div className="flex gap-2">
                <Button onClick={handleSaveVitals} disabled={saving}>
                  {saving ? 'Saving...' : 'Save'}
                </Button>
                <Button variant="outline" onClick={() => setEditing(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{fullName}</span>
                <Badge variant="secondary">{person.sex === 'M' ? 'Male' : person.sex === 'F' ? 'Female' : 'Unknown'}</Badge>
                {person.isLiving && <Badge variant="outline">Living</Badge>}
              </div>
              {(person.birthDate || person.birthPlace) && (
                <p className="text-sm text-muted-foreground">
                  <span className="font-medium">Born:</span> {[person.birthDate, person.birthPlace].filter(Boolean).join(', ')}
                </p>
              )}
              {(person.deathDate || person.deathPlace) && (
                <p className="text-sm text-muted-foreground">
                  <span className="font-medium">Died:</span> {[person.deathDate, person.deathPlace].filter(Boolean).join(', ')}
                </p>
              )}
              {person.notes && (
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{person.notes}</p>
              )}
              {!person.birthDate && !person.deathDate && !person.notes && (
                <p className="text-sm text-muted-foreground italic">No vital information recorded.</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Family Card */}
      <Card>
        <CardHeader>
          <CardTitle>Family</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <FamilySection
            label="Spouses"
            people={person.spouses}
            addButton={
              <Link href={`/person/new?relation=spouse&of=${person.id}`}>
                <Button variant="outline" size="sm">+ Add Spouse</Button>
              </Link>
            }
          />
          <div>
            <h4 className="mb-2 text-sm font-medium text-muted-foreground">Parents</h4>
            {person.parents.length > 0 ? (
              <ul className="space-y-1">
                {person.parents.map((p) => (
                  <PersonRow key={p.id} person={p} />
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground italic">No parents recorded.</p>
            )}
            <div className="mt-2 flex gap-2">
              <Link href={`/person/new?relation=father&of=${person.id}`}>
                <Button variant="outline" size="sm">+ Add Father</Button>
              </Link>
              <Link href={`/person/new?relation=mother&of=${person.id}`}>
                <Button variant="outline" size="sm">+ Add Mother</Button>
              </Link>
            </div>
          </div>
          <FamilySection
            label="Children"
            people={person.children}
            addButton={
              <Link href={`/person/new?relation=child&of=${person.id}`}>
                <Button variant="outline" size="sm">+ Add Child</Button>
              </Link>
            }
          />
          <PersonLinkPopover
            personId={person.id}
            personSex={person.sex}
            onLinked={() => router.refresh()}
          />
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="text-destructive">Danger Zone</CardTitle>
        </CardHeader>
        <CardContent>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" disabled={deleting}>
                {deleting ? 'Deleting...' : 'Delete Person'}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete {fullName}?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete this person and all associated events, citations, and family links.
                  This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>
    </div>
  );
}

function FamilySection({
  label,
  people,
  addButton,
}: {
  label: string;
  people: PersonListItem[];
  addButton: React.ReactNode;
}) {
  return (
    <div>
      <h4 className="mb-2 text-sm font-medium text-muted-foreground">{label}</h4>
      {people.length > 0 ? (
        <ul className="space-y-1">
          {people.map((p) => (
            <PersonRow key={p.id} person={p} />
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground italic">None recorded.</p>
      )}
      <div className="mt-2">{addButton}</div>
    </div>
  );
}

function PersonRow({ person }: { person: PersonListItem }) {
  return (
    <li>
      <Link
        href={`/person/${person.id}`}
        className="text-sm text-primary underline-offset-4 hover:underline"
      >
        {person.givenName} {person.surname}
      </Link>
      {person.sex !== 'U' && (
        <Badge variant="secondary" className="ml-2 text-[10px]">
          {person.sex === 'M' ? 'Male' : 'Female'}
        </Badge>
      )}
      {person.birthDate && (
        <span className="ml-2 text-xs text-muted-foreground">b. {person.birthDate}</span>
      )}
    </li>
  );
}
