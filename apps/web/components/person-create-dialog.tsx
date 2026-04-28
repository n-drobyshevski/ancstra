'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { UserPlus, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { useIsMobile } from '@/hooks/use-mobile';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerFooter,
} from '@/components/ui/drawer';

import type { RelationType } from '@/components/person-link-dialog';
import { personDetailCache } from '@/lib/tree/person-detail-cache';

interface PersonCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The person this new person will be linked to */
  personId: string;
  personName: string;
  personSex: 'M' | 'F' | 'U';
  /** What relation the new person will be to the current person */
  relationType: RelationType;
  onCreated?: () => void;
}

const RELATION_LABELS: Record<RelationType, string> = {
  spouse: 'Spouse',
  father: 'Father',
  mother: 'Mother',
  child: 'Child',
};

function getDefaultSex(relation: RelationType, personSex: 'M' | 'F' | 'U'): 'M' | 'F' | 'U' {
  if (relation === 'father') return 'M';
  if (relation === 'mother') return 'F';
  if (relation === 'spouse') {
    if (personSex === 'M') return 'F';
    if (personSex === 'F') return 'M';
  }
  return 'U';
}

export function PersonCreateDialog({
  open,
  onOpenChange,
  personId,
  personName,
  personSex,
  relationType,
  onCreated,
}: PersonCreateDialogProps) {
  const isMobile = useIsMobile();
  const givenNameRef = useRef<HTMLInputElement>(null);

  const [givenName, setGivenName] = useState('');
  const [surname, setSurname] = useState('');
  const [sex, setSex] = useState<'M' | 'F' | 'U'>(() => getDefaultSex(relationType, personSex));
  const [saving, setSaving] = useState(false);

  // Reset form when dialog opens/closes or relation changes
  useEffect(() => {
    if (open) {
      setGivenName('');
      setSurname('');
      setSex(getDefaultSex(relationType, personSex));
      // Focus the given name input after mount
      setTimeout(() => givenNameRef.current?.focus(), 100);
    }
  }, [open, relationType, personSex]);

  const handleSubmit = useCallback(async () => {
    if (!givenName.trim() || !surname.trim()) {
      toast.error('Given name and surname are required');
      return;
    }

    setSaving(true);
    try {
      // 1. Create the person
      const createRes = await fetch('/api/persons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          givenName: givenName.trim(),
          surname: surname.trim(),
          sex,
          isLiving: true,
        }),
      });

      if (!createRes.ok) {
        const data = await createRes.json();
        toast.error(data.error || 'Failed to create person');
        return;
      }

      const created = await createRes.json();

      // 2. Link the relationship
      if (relationType === 'spouse') {
        const res = await fetch('/api/families', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            partner1Id: personId,
            partner2Id: created.id,
          }),
        });
        if (!res.ok) {
          toast.error('Person created but failed to link as spouse');
          return;
        }
      } else if (relationType === 'father' || relationType === 'mother') {
        const partnerKey = relationType === 'father' ? 'partner1Id' : 'partner2Id';
        const famRes = await fetch('/api/families', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ [partnerKey]: created.id }),
        });
        if (!famRes.ok) {
          toast.error('Person created but failed to create family');
          return;
        }
        const family = await famRes.json();
        const childRes = await fetch(`/api/families/${family.id}/children`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ personId }),
        });
        if (!childRes.ok) {
          toast.error('Person created but failed to link as parent');
          return;
        }
      } else if (relationType === 'child') {
        const partnerKey = personSex === 'F' ? 'partner2Id' : 'partner1Id';
        const famRes = await fetch('/api/families', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ [partnerKey]: personId }),
        });
        if (!famRes.ok) {
          toast.error('Person created but failed to create family');
          return;
        }
        const family = await famRes.json();
        const childRes = await fetch(`/api/families/${family.id}/children`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ personId: created.id }),
        });
        if (!childRes.ok) {
          toast.error('Person created but failed to link as child');
          return;
        }
      }

      personDetailCache.invalidate(personId);
      toast.success(`Created ${givenName} ${surname} as ${RELATION_LABELS[relationType].toLowerCase()}`);
      onOpenChange(false);
      onCreated?.();
    } catch {
      toast.error('Network error');
    } finally {
      setSaving(false);
    }
  }, [givenName, surname, sex, relationType, personId, personSex, onOpenChange, onCreated]);

  const label = RELATION_LABELS[relationType];
  const sexLocked = relationType === 'father' || relationType === 'mother';

  const form = (
    <div className="space-y-4 p-4">
      {/* Context banner */}
      <div className="rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-sm">
        Adding <strong>{label.toLowerCase()}</strong> of <strong>{personName}</strong>
      </div>

      {/* Name fields */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="create-givenName" className="text-xs">
            Given Name <span className="text-destructive">*</span>
          </Label>
          <Input
            ref={givenNameRef}
            id="create-givenName"
            value={givenName}
            onChange={(e) => setGivenName(e.target.value)}
            placeholder="John"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                document.getElementById('create-surname')?.focus();
              }
            }}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="create-surname" className="text-xs">
            Surname <span className="text-destructive">*</span>
          </Label>
          <Input
            id="create-surname"
            value={surname}
            onChange={(e) => setSurname(e.target.value)}
            placeholder="Smith"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleSubmit();
              }
            }}
          />
        </div>
      </div>

      {/* Sex selector */}
      <div className="space-y-1.5">
        <Label className="text-xs">
          Sex
          {sexLocked && (
            <span className="ml-1 text-muted-foreground font-normal">
              (set by relation)
            </span>
          )}
        </Label>
        <div
          role="radiogroup"
          aria-label="Sex"
          className="inline-flex w-full overflow-hidden rounded-lg border border-border"
        >
          {(['M', 'F', 'U'] as const).map((value) => {
            const sexLabel = value === 'M' ? 'Male' : value === 'F' ? 'Female' : 'Unknown';
            const isActive = sex === value;
            return (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={isActive}
                disabled={sexLocked}
                onClick={() => setSex(value)}
                className={`flex-1 px-3 py-1.5 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : sexLocked
                      ? 'text-muted-foreground/50'
                      : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {sexLabel}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );

  const footer = (
    <div className="flex gap-2 justify-end">
      <Button
        variant="outline"
        size="sm"
        onClick={() => onOpenChange(false)}
        disabled={saving}
      >
        Cancel
      </Button>
      <Button
        size="sm"
        onClick={handleSubmit}
        disabled={saving || !givenName.trim() || !surname.trim()}
      >
        {saving ? (
          <>
            <Loader2 className="mr-1.5 size-3.5 animate-spin" />
            Creating...
          </>
        ) : (
          <>
            <UserPlus className="mr-1.5 size-3.5" />
            Create {label}
          </>
        )}
      </Button>
    </div>
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>New {label}</DrawerTitle>
            <DrawerDescription>Quick-add a new person and link them</DrawerDescription>
          </DrawerHeader>
          {form}
          <DrawerFooter>{footer}</DrawerFooter>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>New {label}</DialogTitle>
          <DialogDescription>Quick-add a new person and link them</DialogDescription>
        </DialogHeader>
        {form}
        <DialogFooter>{footer}</DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
