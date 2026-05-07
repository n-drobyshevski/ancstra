'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  AlertTriangle,
  ArrowLeftRight,
  Loader2,
  Search,
  TriangleAlert,
  UserPlus,
  X,
} from 'lucide-react';
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

type Mode = 'add' | 'move';
type Role = 'admin' | 'editor' | 'viewer';

interface SelectedFamily {
  id: string;
  name: string;
  ownerEmail: string;
  memberCount: number;
  maxMembers: number;
}

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
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [selected, setSelected] = useState<SelectedFamily | null>(null);
  const [role, setRole] = useState<Role>('viewer');
  const [confirmText, setConfirmText] = useState('');

  // Debounce search input — 200ms is a good admin-tool balance.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), 200);
    return () => clearTimeout(t);
  }, [query]);

  const search = trpc.platformAdmin.searchFamilies.useQuery(
    {
      q: debouncedQuery,
      excludeFamilyId: currentFamilyId,
      limit: 8,
    },
    {
      enabled: debouncedQuery.length > 0 && !selected,
      staleTime: 5_000,
    },
  );

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

  const capExceeded = useMemo(() => {
    if (!selected) return false;
    return selected.memberCount + 1 > selected.maxMembers;
  }, [selected]);

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
          {/* Step 1 — pick a family */}
          <div className="space-y-2">
            <Label htmlFor="family-search">Target family</Label>
            {selected ? (
              <SelectedCard
                family={selected}
                onClear={() => {
                  setSelected(null);
                  setQuery('');
                }}
                disabled={isPending}
              />
            ) : (
              <>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="family-search"
                    autoComplete="off"
                    placeholder="Search by family name…"
                    className="pl-9"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    disabled={isPending}
                  />
                </div>
                <SearchResults
                  query={debouncedQuery}
                  loading={search.isFetching}
                  data={search.data ?? []}
                  onPick={(f) => setSelected(f)}
                />
              </>
            )}
          </div>

          {/* Step 2 — show cap warning */}
          {selected && capExceeded ? (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-md border border-amber-500/50 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200"
            >
              <TriangleAlert className="mt-0.5 size-4 shrink-0" />
              <div>
                Adding will make member{' '}
                <strong className="tabular-nums">
                  {selected.memberCount + 1}
                </strong>{' '}
                of a{' '}
                <strong className="tabular-nums">{selected.maxMembers}</strong>{' '}
                cap. Continue only if intentional.
              </div>
            </div>
          ) : null}

          {/* Step 3 — pick role */}
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

          {/* Step 4 — confirm typing the source family name (move only) */}
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

interface SelectedCardProps {
  family: SelectedFamily;
  onClear: () => void;
  disabled?: boolean;
}

function SelectedCard({ family, onClear, disabled }: SelectedCardProps) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-primary/50 bg-primary/5 px-3 py-2.5">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{family.name}</p>
        <p className="truncate text-xs text-muted-foreground">
          Owner: {family.ownerEmail} ·{' '}
          <span className="tabular-nums">
            {family.memberCount}/{family.maxMembers}
          </span>{' '}
          members
        </p>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={onClear}
        disabled={disabled}
        aria-label="Choose a different family"
      >
        <X className="size-4" />
      </Button>
    </div>
  );
}

interface SearchResultsProps {
  query: string;
  loading: boolean;
  data: ReadonlyArray<SelectedFamily>;
  onPick: (f: SelectedFamily) => void;
}

function SearchResults({ query, loading, data, onPick }: SearchResultsProps) {
  if (query.length === 0) {
    return (
      <p className="px-1 text-xs text-muted-foreground">
        Start typing a family name to search.
      </p>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-1 text-xs text-muted-foreground">
        <Loader2 className="size-3 animate-spin" />
        Searching…
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-dashed border-border px-3 py-3 text-xs text-muted-foreground">
        <AlertTriangle className="size-3.5" />
        No families match “{query}”.
      </div>
    );
  }

  return (
    <ul className="max-h-56 divide-y divide-border overflow-y-auto rounded-md border border-border">
      {data.map((f) => (
        <li key={f.id}>
          <button
            type="button"
            onClick={() => onPick(f)}
            className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left transition-colors hover:bg-accent focus:bg-accent focus:outline-none"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{f.name}</p>
              <p className="truncate text-xs text-muted-foreground">
                Owner: {f.ownerEmail}
              </p>
            </div>
            <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
              {f.memberCount}/{f.maxMembers}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
