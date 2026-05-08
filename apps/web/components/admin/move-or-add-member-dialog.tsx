'use client';

import { useState } from 'react';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  FamilyPickerField,
  type FamilyOption,
} from '@/components/admin/family-picker-field';

type Mode = 'add' | 'move';
type Role = 'admin' | 'editor' | 'viewer';

interface Props {
  mode: Mode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentFamilyId: string;
  currentFamilyName: string;
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

export function MoveOrAddMemberDialog(props: Props) {
  const { open, onOpenChange } = props;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {/* Remount on each open so state is fresh without a reset effect.
            Same pattern family-settings-edit-button uses. */}
        {open ? <MoveOrAddMemberForm key={`${props.mode}|${props.user.id}`} {...props} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function MoveOrAddMemberForm({
  mode,
  onOpenChange,
  currentFamilyId,
  currentFamilyName,
  user,
}: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState<FamilyOption | null>(null);
  const [role, setRole] = useState<Role>('viewer');
  const [confirmText, setConfirmText] = useState('');

  const addMutation = trpc.platformAdmin.addMemberToFamily.useMutation({
    onSuccess: (res) => {
      if (res.alreadyMember) {
        toast.info(`${user.name} is already a member of ${selected?.name ?? 'that family'}`);
      } else if (res.reactivated) {
        toast.success(`${user.name} re-added to ${selected?.name} as ${role}`);
      } else {
        toast.success(`${user.name} added to ${selected?.name} as ${role}`);
      }
      onOpenChange(false);
      router.refresh();
    },
    onError: (err) => toast.error(err.message || 'Failed to add member'),
  });

  const moveMutation = trpc.platformAdmin.moveMemberToFamily.useMutation({
    onSuccess: () => {
      toast.success(`${user.name} moved to ${selected?.name} as ${role}`);
      onOpenChange(false);
      router.refresh();
    },
    onError: (err) => toast.error(err.message || 'Failed to move member'),
  });

  const isPending = addMutation.isPending || moveMutation.isPending;

  const moveConfirmOk =
    mode === 'add' || confirmText.trim() === currentFamilyName.trim();

  const canSubmit = !!selected && !isPending && moveConfirmOk;

  function handleSubmit() {
    if (!selected) return;
    if (mode === 'add') {
      addMutation.mutate({
        familyId: selected.id,
        userId: user.id,
        role,
      });
    } else {
      moveMutation.mutate({
        fromFamilyId: currentFamilyId,
        toFamilyId: selected.id,
        userId: user.id,
        role,
      });
    }
  }

  const SubmitIcon = mode === 'add' ? UserPlus : ArrowLeftRight;
  const submitLabel = mode === 'add' ? 'Add to family' : 'Move to family';

  return (
    <>
      <DialogHeader>
        <DialogTitle>
          {mode === 'add'
            ? `Add ${user.name} to another family`
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
              Platform-admin override. Atomically removes{' '}
              <strong>{user.name}</strong> from{' '}
              <strong>{currentFamilyName}</strong> and adds them to the selected
              family. Logged in both families&apos; activity feeds.
            </>
          )}
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-5">
        <FamilyPickerField
          value={selected}
          onChange={setSelected}
          disabled={isPending}
          excludeFamilyId={currentFamilyId}
          label="Target family"
        />

        {selected ? (
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
                  htmlFor={`role-${opt.value}`}
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
                      id={`role-${opt.value}`}
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

        {selected && mode === 'move' ? (
          <div className="space-y-2">
            <Label htmlFor="confirm-source-name">
              Type{' '}
              <strong className="font-mono text-foreground">
                {currentFamilyName}
              </strong>{' '}
              to confirm removal from source
            </Label>
            <Input
              id="confirm-source-name"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              autoComplete="off"
              placeholder={currentFamilyName}
              disabled={isPending}
              aria-invalid={
                confirmText.length > 0 && !moveConfirmOk ? true : undefined
              }
            />
          </div>
        ) : null}
      </div>

      <DialogFooter>
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
