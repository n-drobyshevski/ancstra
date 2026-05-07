'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, Pencil, Save } from 'lucide-react';
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
import { Switch } from '@/components/ui/switch';

interface InitialValues {
  name: string;
  maxMembers: number;
  monthlyAiBudgetUsd: number;
  moderationEnabled: boolean;
}

interface Props {
  familyId: string;
  initial: InitialValues;
}

export function FamilySettingsEditButton({ familyId, initial }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Pencil className="size-4" />
          Edit settings
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit family settings</DialogTitle>
          <DialogDescription>
            Platform-admin override. Changes are written to the audit log.
          </DialogDescription>
        </DialogHeader>
        {/* Remount on each open so initial values are re-seeded without an effect. */}
        {open ? (
          <FamilySettingsEditForm
            key={`${initial.name}|${initial.maxMembers}|${initial.monthlyAiBudgetUsd}|${initial.moderationEnabled}`}
            familyId={familyId}
            initial={initial}
            onClose={() => setOpen(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

interface FormProps {
  familyId: string;
  initial: InitialValues;
  onClose: () => void;
}

function FamilySettingsEditForm({ familyId, initial, onClose }: FormProps) {
  const router = useRouter();
  const [name, setName] = useState(initial.name);
  const [maxMembers, setMaxMembers] = useState(String(initial.maxMembers));
  const [aiBudget, setAiBudget] = useState(initial.monthlyAiBudgetUsd.toFixed(2));
  const [moderationEnabled, setModerationEnabled] = useState(initial.moderationEnabled);

  const update = trpc.platformAdmin.updateFamilySettings.useMutation({
    onSuccess: ({ changed }) => {
      if (changed.length === 0) {
        toast.info('No changes to save.');
      } else {
        toast.success(`Saved (${changed.length} change${changed.length === 1 ? '' : 's'})`);
      }
      onClose();
      router.refresh();
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to save settings');
    },
  });

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const max = Number(maxMembers);
    const budget = Number(aiBudget);
    if (!Number.isFinite(max) || max < 1) {
      toast.error('Member limit must be a positive number.');
      return;
    }
    if (!Number.isFinite(budget) || budget < 0) {
      toast.error('AI budget must be zero or positive.');
      return;
    }

    update.mutate({
      familyId,
      name: name.trim(),
      maxMembers: Math.floor(max),
      monthlyAiBudgetUsd: budget,
      moderationEnabled,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="admin-family-name">Name</Label>
        <Input
          id="admin-family-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          maxLength={120}
          disabled={update.isPending}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="admin-max-members">Member limit</Label>
          <Input
            id="admin-max-members"
            type="number"
            min={1}
            step={1}
            value={maxMembers}
            onChange={(e) => setMaxMembers(e.target.value)}
            disabled={update.isPending}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="admin-ai-budget">Monthly AI budget (USD)</Label>
          <Input
            id="admin-ai-budget"
            type="number"
            min={0}
            step={0.5}
            value={aiBudget}
            onChange={(e) => setAiBudget(e.target.value)}
            disabled={update.isPending}
          />
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 rounded-md border border-border px-4 py-3">
        <div>
          <Label htmlFor="admin-moderation" className="text-sm font-medium">
            Editor moderation
          </Label>
          <p className="text-xs text-muted-foreground mt-0.5">
            Queue editor changes for review.
          </p>
        </div>
        <Switch
          id="admin-moderation"
          checked={moderationEnabled}
          onCheckedChange={setModerationEnabled}
          disabled={update.isPending}
        />
      </div>

      <DialogFooter>
        <Button
          type="button"
          variant="ghost"
          onClick={onClose}
          disabled={update.isPending}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={update.isPending}>
          {update.isPending ? (
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
      </DialogFooter>
    </form>
  );
}
