'use client';

import { useState } from 'react';
import type { FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ChevronDown, ChevronRight, HousePlus, Loader2 } from 'lucide-react';
import { trpc } from '@/lib/trpc/client';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  UserPickerField,
  type UserOption,
} from '@/components/admin/user-picker-field';

const DEFAULT_MAX_MEMBERS = 50;

export function AddFamilyDialog() {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <HousePlus className="size-4" />
          Add family
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        {/* Remount on each open so state is fresh — same pattern
            add-user-dialog uses. */}
        {open ? <AddFamilyForm onClose={() => setOpen(false)} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function AddFamilyForm({ onClose }: { onClose: () => void }) {
  const router = useRouter();

  const [name, setName] = useState('');
  const [selectedOwner, setSelectedOwner] = useState<UserOption | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [maxMembers, setMaxMembers] = useState<number>(DEFAULT_MAX_MEMBERS);

  const createFamily = trpc.platformAdmin.createFamily.useMutation({
    onSuccess: ({ name: createdName, ownerName }) => {
      toast.success(`Created family "${createdName}" with ${ownerName} as owner`);
      onClose();
      router.refresh();
    },
    onError: (err) => toast.error(err.message || 'Failed to create family'),
  });

  const trimmedName = name.trim();
  const capValid =
    Number.isInteger(maxMembers) && maxMembers >= 1 && maxMembers <= 10000;
  const canSubmit =
    trimmedName.length > 0 &&
    selectedOwner !== null &&
    capValid &&
    !createFamily.isPending;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit || !selectedOwner) return;
    createFamily.mutate({
      name: trimmedName,
      ownerId: selectedOwner.id,
      // Only send when the user explicitly diverged from the default,
      // keeping the audit-log metadata clean.
      maxMembers:
        showAdvanced && maxMembers !== DEFAULT_MAX_MEMBERS
          ? maxMembers
          : undefined,
    });
  }

  return (
    <form onSubmit={handleSubmit}>
      <DialogHeader>
        <DialogTitle>Add new family</DialogTitle>
        <DialogDescription>
          Provision a new family tree on behalf of an existing user. They
          become the owner. This action is logged in the platform audit log.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4 py-2">
        <div className="space-y-2">
          <Label htmlFor="add-family-name">Family name</Label>
          <Input
            id="add-family-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={createFamily.isPending}
            autoComplete="off"
            autoFocus
            required
            placeholder="e.g. Smith Family Tree"
          />
        </div>

        <UserPickerField
          value={selectedOwner}
          onChange={setSelectedOwner}
          disabled={createFamily.isPending}
        />

        <div className="border-t border-border pt-2">
          <button
            type="button"
            aria-expanded={showAdvanced}
            onClick={() => setShowAdvanced((v) => !v)}
            disabled={createFamily.isPending}
            className="flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            {showAdvanced ? (
              <ChevronDown className="size-4" />
            ) : (
              <ChevronRight className="size-4" />
            )}
            Advanced settings
          </button>
        </div>

        {showAdvanced ? (
          <div className="space-y-3 rounded-md border border-dashed border-border p-3">
            <div className="space-y-2">
              <Label htmlFor="add-family-max-members">Member cap</Label>
              <Input
                id="add-family-max-members"
                type="number"
                min={1}
                max={10000}
                value={maxMembers}
                onChange={(e) =>
                  setMaxMembers(Number.parseInt(e.target.value, 10) || 0)
                }
                disabled={createFamily.isPending}
                className="max-w-[10rem]"
              />
              <p className="text-xs text-muted-foreground">
                Default is {DEFAULT_MAX_MEMBERS}. Increase for large extended
                families. Range 1–10000.
              </p>
              {!capValid ? (
                <p className="text-xs text-destructive">
                  Enter a whole number between 1 and 10000.
                </p>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>

      <DialogFooter>
        <Button
          type="button"
          variant="ghost"
          onClick={onClose}
          disabled={createFamily.isPending}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={!canSubmit}>
          {createFamily.isPending ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Creating…
            </>
          ) : (
            <>
              <HousePlus className="size-4" />
              Create family
            </>
          )}
        </Button>
      </DialogFooter>
    </form>
  );
}
