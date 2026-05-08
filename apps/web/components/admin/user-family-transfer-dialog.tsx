'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ArrowLeftRight, Loader2, UserPlus } from 'lucide-react';
import { trpc } from '@/lib/trpc/client';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  FamilyPickerField,
  type FamilyOption,
} from '@/components/admin/family-picker-field';

type Mode = 'add' | 'move';
type Role = 'admin' | 'editor' | 'viewer';
type AnyRole = Role | 'owner';

interface Membership {
  familyId: string;
  familyName: string;
  role: AnyRole;
}

interface Props {
  mode: Mode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: {
    id: string;
    name: string;
    email: string;
  };
}

const ROLE_OPTIONS: ReadonlyArray<{
  value: Role;
  label: string;
  description: string;
}> = [
  { value: 'admin', label: 'Admin', description: 'Full management except owner-only ops' },
  { value: 'editor', label: 'Editor', description: 'Can edit data; not membership' },
  { value: 'viewer', label: 'Viewer', description: 'Read-only access' },
];

/**
 * User-row context dialog for "Add to another family" and "Move to another
 * family" on /admin/users. Distinct from `MoveOrAddMemberDialog` (which
 * lives in family-row context with a known source family) — here the user's
 * memberships are unknown until we fetch them, and the source family must
 * be resolved or picked.
 *
 * Move-mode flow:
 *   - 0 movable memberships → blocking error message + "switch to add" hint
 *   - 1 movable membership   → auto-resolves source, single-step picker
 *   - 2+ movable memberships → source-picker step, then target picker
 *
 * Add-mode flow: single step. Target picker excludes every family the user
 * is already in (computed from the same memberships query).
 */
export function UserFamilyTransferDialog(props: Props) {
  const { open, onOpenChange } = props;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {open ? (
          <UserFamilyTransferForm
            key={`${props.mode}|${props.user.id}`}
            {...props}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function UserFamilyTransferForm({ mode, onOpenChange, user }: Props) {
  const router = useRouter();

  const memberships = trpc.platformAdmin.getUserMemberships.useQuery(
    { userId: user.id },
    { staleTime: 30_000 },
  );

  // For "add", the user picks a target family directly; existing
  // memberships are excluded from results so we don't surface no-op picks.
  // For "move", the user (or we, if there's only one) picks a source first;
  // then the target picker excludes both source and any other current
  // memberships.
  const [sourceId, setSourceId] = useState<string | null>(null);
  const [target, setTarget] = useState<FamilyOption | null>(null);
  const [role, setRole] = useState<Role>('viewer');

  const movableMemberships = useMemo<ReadonlyArray<Membership>>(() => {
    return (memberships.data ?? []).filter((m) => m.role !== 'owner') as ReadonlyArray<Membership>;
  }, [memberships.data]);

  // Auto-resolve source when there's exactly one movable membership and
  // we're in move mode. This collapses the source-picker step to nothing.
  const autoResolvedSource = useMemo<Membership | null>(() => {
    if (mode !== 'move') return null;
    if (movableMemberships.length !== 1) return null;
    return movableMemberships[0]!;
  }, [mode, movableMemberships]);

  const effectiveSourceId =
    sourceId ?? (autoResolvedSource ? autoResolvedSource.familyId : null);
  const effectiveSource =
    effectiveSourceId && memberships.data
      ? (memberships.data.find((m) => m.familyId === effectiveSourceId) as Membership | undefined) ?? null
      : null;

  const allMembershipFamilyIds = useMemo(
    () => (memberships.data ?? []).map((m) => m.familyId),
    [memberships.data],
  );

  const addMutation = trpc.platformAdmin.addMemberToFamily.useMutation({
    onSuccess: (res) => {
      if (res.alreadyMember) {
        toast.info(
          `${user.name} is already a member of ${target?.name ?? 'that family'}`,
        );
      } else if (res.reactivated) {
        toast.success(`${user.name} re-added to ${target?.name} as ${role}`);
      } else {
        toast.success(`${user.name} added to ${target?.name} as ${role}`);
      }
      onOpenChange(false);
      router.refresh();
    },
    onError: (err) => toast.error(err.message || 'Failed to add member'),
  });

  const moveMutation = trpc.platformAdmin.moveMemberToFamily.useMutation({
    onSuccess: () => {
      toast.success(
        `${user.name} moved from ${effectiveSource?.familyName} to ${target?.name} as ${role}`,
      );
      onOpenChange(false);
      router.refresh();
    },
    onError: (err) => toast.error(err.message || 'Failed to move member'),
  });

  const isPending = addMutation.isPending || moveMutation.isPending;

  // The target picker should not surface families the user is already in
  // (including the source for move mode). The server-side `excludeFamilyId`
  // can carry one — give it the source if we have one — and the client-
  // side `excludeFamilyIds` carries the rest.
  const clientExcludes = useMemo(() => {
    const ids = new Set(allMembershipFamilyIds);
    if (effectiveSourceId) ids.delete(effectiveSourceId); // already excluded server-side
    return Array.from(ids);
  }, [allMembershipFamilyIds, effectiveSourceId]);

  function handleSubmit() {
    if (!target) return;
    if (mode === 'add') {
      addMutation.mutate({
        familyId: target.id,
        userId: user.id,
        role,
      });
    } else {
      if (!effectiveSourceId) return;
      moveMutation.mutate({
        fromFamilyId: effectiveSourceId,
        toFamilyId: target.id,
        userId: user.id,
        role,
      });
    }
  }

  // ----- Loading / error / empty states -------------------------------------

  if (memberships.isPending) {
    return (
      <>
        <DialogHeader>
          <DialogTitle>
            {mode === 'add'
              ? `Add ${user.name} to a family`
              : `Move ${user.name} between families`}
          </DialogTitle>
        </DialogHeader>
        <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading memberships…
        </div>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </DialogFooter>
      </>
    );
  }

  if (memberships.isError) {
    return (
      <>
        <DialogHeader>
          <DialogTitle>Couldn&apos;t load memberships</DialogTitle>
          <DialogDescription>
            {memberships.error?.message ?? 'Try again in a moment.'}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </>
    );
  }

  // Move-mode + nothing movable: blocking message that points at "Add".
  if (mode === 'move' && movableMemberships.length === 0) {
    const onlyOwnerMembership =
      (memberships.data ?? []).length > 0 && movableMemberships.length === 0;
    return (
      <>
        <DialogHeader>
          <DialogTitle>Nothing to move</DialogTitle>
          <DialogDescription>
            {onlyOwnerMembership ? (
              <>
                <strong>{user.name}</strong> only owns families. Owner moves
                aren&apos;t allowed — transfer ownership first, or use{' '}
                <em>Add to another family</em> to put them in another family
                as a non-owner.
              </>
            ) : (
              <>
                <strong>{user.name}</strong> has no active memberships to move
                from. Use <em>Add to another family</em> instead.
              </>
            )}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </>
    );
  }

  // ----- Source picker (move + 2+ movable memberships) ----------------------

  const needsSourcePick =
    mode === 'move' && !sourceId && movableMemberships.length > 1;

  if (needsSourcePick) {
    return (
      <>
        <DialogHeader>
          <DialogTitle>Move {user.name} from which family?</DialogTitle>
          <DialogDescription>
            Pick the source — selection advances to the target step
            automatically. Only non-owner memberships are listed; owner moves
            require an ownership transfer first.
          </DialogDescription>
        </DialogHeader>
        <RadioGroup
          value={sourceId ?? ''}
          onValueChange={(v: string) => setSourceId(v)}
          className="space-y-1.5 py-2"
        >
          {movableMemberships.map((m) => (
            <Label
              key={m.familyId}
              htmlFor={`source-${m.familyId}`}
              className={cn(
                'flex cursor-pointer items-center justify-between gap-3 rounded-md border border-input p-3 transition-colors hover:bg-accent/50',
                sourceId === m.familyId && 'border-primary bg-primary/5',
              )}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{m.familyName}</p>
                <p className="text-xs capitalize text-muted-foreground">
                  {m.role}
                </p>
              </div>
              <RadioGroupItem
                value={m.familyId}
                id={`source-${m.familyId}`}
              />
            </Label>
          ))}
        </RadioGroup>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </DialogFooter>
      </>
    );
  }

  // ----- Target picker step (add OR move-after-source-pick) -----------------

  const SubmitIcon = mode === 'add' ? UserPlus : ArrowLeftRight;
  const submitLabel = mode === 'add' ? 'Add to family' : 'Move to family';

  const canSubmit = !!target && !isPending;

  return (
    <>
      <DialogHeader>
        <DialogTitle>
          {mode === 'add'
            ? `Add ${user.name} to a family`
            : `Move ${user.name} to another family`}
        </DialogTitle>
        <DialogDescription>
          {mode === 'add' ? (
            <>
              Platform-admin override. Adds <strong>{user.name}</strong> to the
              selected family without an invitation. Logged in audit log and
              the family activity feed.
            </>
          ) : (
            <>
              Atomically removes <strong>{user.name}</strong> from{' '}
              <strong>{effectiveSource?.familyName}</strong> and adds them to
              the selected family. Logged in both families&apos; activity feeds.
            </>
          )}
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-5 py-2">
        <FamilyPickerField
          value={target}
          onChange={setTarget}
          disabled={isPending}
          excludeFamilyId={effectiveSourceId ?? undefined}
          excludeFamilyIds={clientExcludes}
          label="Target family"
        />

        {target ? (
          <div className="space-y-2">
            <Label>Role at target</Label>
            <RadioGroup
              value={role}
              onValueChange={(v: Role) => setRole(v)}
              className="grid grid-cols-3 gap-2"
              disabled={isPending}
            >
              {ROLE_OPTIONS.map((opt) => (
                <Label
                  key={opt.value}
                  htmlFor={`target-role-${opt.value}`}
                  className={cn(
                    'flex cursor-pointer flex-col gap-1 rounded-md border border-input p-3 transition-colors hover:bg-accent/50',
                    role === opt.value && 'border-primary bg-primary/5',
                    isPending && 'cursor-not-allowed opacity-60',
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium">{opt.label}</span>
                    <RadioGroupItem
                      value={opt.value}
                      id={`target-role-${opt.value}`}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {opt.description}
                  </span>
                </Label>
              ))}
            </RadioGroup>
          </div>
        ) : null}
      </div>

      <DialogFooter>
        {mode === 'move' && movableMemberships.length > 1 ? (
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setSourceId(null);
              setTarget(null);
            }}
            disabled={isPending}
          >
            Back
          </Button>
        ) : null}
        <Button
          type="button"
          variant="ghost"
          onClick={() => onOpenChange(false)}
          disabled={isPending}
        >
          Cancel
        </Button>
        <Button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit}
          variant={mode === 'move' ? 'destructive' : 'default'}
        >
          {isPending ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              {mode === 'add' ? 'Adding…' : 'Moving…'}
            </>
          ) : (
            <>
              <SubmitIcon className="size-4" />
              {submitLabel}
            </>
          )}
        </Button>
      </DialogFooter>
    </>
  );
}
