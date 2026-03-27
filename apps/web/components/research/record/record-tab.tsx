'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  CalendarDays,
  MapPin,
  Pencil,
  Heart,
  Users,
  Link2,
  Trash2,
  StickyNote,
  ChevronRight,
} from 'lucide-react';
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
import { Separator } from '@/components/ui/separator';
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
    <div className="grid gap-6 lg:grid-cols-2">
      {/* ── Left column: Vitals + Delete ── */}
      <div className="space-y-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Vital Information</CardTitle>
            {!editing && (
              <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
                <Pencil className="mr-1.5 size-3.5" />
                Edit
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {editing ? (
              <VitalsForm
                givenName={givenName}
                surname={surname}
                birthDate={birthDate}
                birthPlace={birthPlace}
                deathDate={deathDate}
                deathPlace={deathPlace}
                isLiving={isLiving}
                notes={notes}
                saving={saving}
                onGivenNameChange={setGivenName}
                onSurnameChange={setSurname}
                onBirthDateChange={setBirthDate}
                onBirthPlaceChange={setBirthPlace}
                onDeathDateChange={setDeathDate}
                onDeathPlaceChange={setDeathPlace}
                onIsLivingChange={setIsLiving}
                onNotesChange={setNotes}
                onSave={handleSaveVitals}
                onCancel={() => setEditing(false)}
              />
            ) : (
              <VitalsView person={person} fullName={fullName} />
            )}
          </CardContent>
        </Card>

        {/* Delete row */}
        <div className="flex items-center justify-between rounded-lg border border-dashed border-destructive/15 bg-destructive/[0.02] px-4 py-3 transition-colors hover:border-destructive/25">
        <p className="text-xs text-muted-foreground">
          Permanently remove this person and all associated data.
        </p>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive hover:text-destructive" disabled={deleting}>
              <Trash2 className="mr-1 size-3" />
              {deleting ? 'Deleting...' : 'Delete'}
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
              <AlertDialogAction
                onClick={handleDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
      </div>

      {/* ── Right column: Family ── */}
      <div>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Family</CardTitle>
            <PersonLinkPopover
              personId={person.id}
              personSex={person.sex}
              onLinked={() => router.refresh()}
            />
          </CardHeader>
          <CardContent className="space-y-5">
            <FamilySection
              icon={<Heart className="size-4 text-muted-foreground" />}
              label="Spouses"
              people={person.spouses}
              addHref={`/persons/new?relation=spouse&of=${person.id}`}
              addLabel="Add Spouse"
            />

            <Separator />

            <FamilySection
              icon={<Users className="size-4 text-muted-foreground" />}
              label="Parents"
              people={person.parents}
              emptyText="No parents recorded"
              actions={
                <div className="flex gap-2">
                  <Link href={`/persons/new?relation=father&of=${person.id}`}>
                    <Button variant="ghost" size="sm" className="h-7 text-xs">+ Father</Button>
                  </Link>
                  <Link href={`/persons/new?relation=mother&of=${person.id}`}>
                    <Button variant="ghost" size="sm" className="h-7 text-xs">+ Mother</Button>
                  </Link>
                </div>
              }
            />

            <Separator />

            <FamilySection
              icon={<Users className="size-4 text-muted-foreground" />}
              label="Children"
              people={person.children}
              addHref={`/persons/new?relation=child&of=${person.id}`}
              addLabel="Add Child"
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/* ── Vitals View ── */

function VitalsView({ person, fullName }: { person: PersonDetail; fullName: string }) {
  const hasBirth = person.birthDate || person.birthPlace;
  const hasDeath = person.deathDate || person.deathPlace;
  const isEmpty = !hasBirth && !hasDeath && !person.notes;

  if (isEmpty) {
    return (
      <div className="flex flex-col items-center py-8 text-center text-muted-foreground animate-fade-slide-in">
        <Pencil className="mb-2 size-8 text-muted-foreground/40" />
        <p className="text-sm">No vital information recorded yet.</p>
        <p className="mt-1 text-xs">Click Edit to add birth, death, and other details.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Name + badges */}
      <div className="flex items-center gap-2">
        <span className="font-medium">{fullName}</span>
        <Badge variant="secondary" className="text-[10px]">
          {person.sex === 'M' ? 'Male' : person.sex === 'F' ? 'Female' : 'Unknown'}
        </Badge>
        {person.isLiving && (
          <Badge variant="outline" className="text-[10px] border-green-500/50 text-green-600">
            Living
          </Badge>
        )}
      </div>

      <Separator className="my-1" />

      {/* Structured vital rows */}
      <div className="grid gap-3 rounded-lg bg-muted/30 p-3">
        {hasBirth && (
          <VitalRow label="Born">
            {person.birthDate && (
              <span className="inline-flex items-center gap-1">
                <CalendarDays className="size-3 text-muted-foreground" />
                {person.birthDate}
              </span>
            )}
            {person.birthPlace && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="size-3 text-muted-foreground" />
                {person.birthPlace}
              </span>
            )}
          </VitalRow>
        )}
        {hasDeath && (
          <VitalRow label="Died">
            {person.deathDate && (
              <span className="inline-flex items-center gap-1">
                <CalendarDays className="size-3 text-muted-foreground" />
                {person.deathDate}
              </span>
            )}
            {person.deathPlace && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="size-3 text-muted-foreground" />
                {person.deathPlace}
              </span>
            )}
          </VitalRow>
        )}
        {person.notes && (
          <VitalRow label="Notes">
            <span className="whitespace-pre-wrap">{person.notes}</span>
          </VitalRow>
        )}
      </div>
    </div>
  );
}

function VitalRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 border-l-2 border-primary/20 pl-3 text-sm">
      <span className="w-12 shrink-0 pt-0.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-foreground/80">
        {children}
      </div>
    </div>
  );
}

/* ── Vitals Form ── */

function VitalsForm({
  givenName, surname, birthDate, birthPlace, deathDate, deathPlace, isLiving, notes, saving,
  onGivenNameChange, onSurnameChange, onBirthDateChange, onBirthPlaceChange,
  onDeathDateChange, onDeathPlaceChange, onIsLivingChange, onNotesChange,
  onSave, onCancel,
}: {
  givenName: string; surname: string; birthDate: string; birthPlace: string;
  deathDate: string; deathPlace: string; isLiving: boolean; notes: string; saving: boolean;
  onGivenNameChange: (v: string) => void; onSurnameChange: (v: string) => void;
  onBirthDateChange: (v: string) => void; onBirthPlaceChange: (v: string) => void;
  onDeathDateChange: (v: string) => void; onDeathPlaceChange: (v: string) => void;
  onIsLivingChange: (v: boolean) => void; onNotesChange: (v: string) => void;
  onSave: () => void; onCancel: () => void;
}) {
  return (
    <div className="space-y-5">
      {/* Name */}
      <fieldset className="space-y-3">
        <legend className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Name</legend>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="givenName" className="text-xs">Given Name</Label>
            <Input id="givenName" value={givenName} onChange={(e) => onGivenNameChange(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="surname" className="text-xs">Surname</Label>
            <Input id="surname" value={surname} onChange={(e) => onSurnameChange(e.target.value)} />
          </div>
        </div>
      </fieldset>

      {/* Birth */}
      <fieldset className="space-y-3">
        <legend className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Birth</legend>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="birthDate" className="text-xs">Date</Label>
            <Input id="birthDate" value={birthDate} onChange={(e) => onBirthDateChange(e.target.value)} placeholder="15 Mar 1880" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="birthPlace" className="text-xs">Place</Label>
            <Input id="birthPlace" value={birthPlace} onChange={(e) => onBirthPlaceChange(e.target.value)} placeholder="London, England" />
          </div>
        </div>
      </fieldset>

      {/* Death */}
      <fieldset className="space-y-3">
        <legend className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Death</legend>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="deathDate" className="text-xs">Date</Label>
            <Input id="deathDate" value={deathDate} onChange={(e) => onDeathDateChange(e.target.value)} placeholder="22 Nov 1945" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="deathPlace" className="text-xs">Place</Label>
            <Input id="deathPlace" value={deathPlace} onChange={(e) => onDeathPlaceChange(e.target.value)} placeholder="Manchester, England" />
          </div>
        </div>
      </fieldset>

      {/* Status + Notes */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Switch id="isLiving" checked={isLiving} onCheckedChange={onIsLivingChange} />
          <Label htmlFor="isLiving" className="text-xs">Person is living</Label>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="notes" className="text-xs">Notes</Label>
          <Textarea id="notes" value={notes} onChange={(e) => onNotesChange(e.target.value)} rows={3} placeholder="Biographical notes, sources, or other details..." />
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        <Button size="sm" onClick={onSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save Changes'}
        </Button>
        <Button variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

/* ── Family Section ── */

function FamilySection({
  icon,
  label,
  people,
  addHref,
  addLabel,
  emptyText,
  actions,
}: {
  icon: React.ReactNode;
  label: string;
  people: PersonListItem[];
  addHref?: string;
  addLabel?: string;
  emptyText?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        {icon}
        <h4 className="text-sm font-medium">{label}</h4>
        <span className="text-xs text-muted-foreground">({people.length})</span>
      </div>

      {people.length > 0 ? (
        <ul className="space-y-0.5">
          {people.map((p) => (
            <PersonRow key={p.id} person={p} />
          ))}
        </ul>
      ) : (
        <p className="py-2 text-xs text-muted-foreground italic">
          {emptyText ?? `No ${label.toLowerCase()} recorded.`}
        </p>
      )}

      {actions ?? (
        addHref && addLabel && (
          <Link href={addHref}>
            <Button variant="ghost" size="sm" className="h-7 text-xs">
              + {addLabel}
            </Button>
          </Link>
        )
      )}
    </div>
  );
}

function PersonRow({ person }: { person: PersonListItem }) {
  return (
    <li className="group">
      <Link
        href={`/persons/${person.id}`}
        className="flex items-center gap-2 rounded-lg px-2.5 py-2 -mx-2.5 transition-all duration-150 hover:bg-muted/60 hover:shadow-sm"
      >
        {/* Initials avatar */}
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-medium text-muted-foreground transition-shadow duration-150 group-hover:ring-2 group-hover:ring-primary/20">
          {person.givenName.charAt(0)}{person.surname.charAt(0)}
        </span>

        <span className="flex-1 text-sm">
          {person.givenName} {person.surname}
        </span>

        {person.birthDate && (
          <span className="text-xs text-muted-foreground">b. {person.birthDate}</span>
        )}

        {person.sex !== 'U' && (
          <Badge variant="secondary" className="text-[10px]">
            {person.sex === 'M' ? 'M' : 'F'}
          </Badge>
        )}

        <ChevronRight className="size-3.5 text-muted-foreground/50 opacity-0 -translate-x-1 transition-all duration-150 group-hover:opacity-100 group-hover:translate-x-0" />
      </Link>
    </li>
  );
}
