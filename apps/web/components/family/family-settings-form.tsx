'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, Save } from 'lucide-react';
import { trpc } from '@/lib/trpc/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { DeleteFamilyDialog } from '@/components/family/delete-family-dialog';

interface FamilySettings {
  id: string;
  name: string;
  ownerId: string;
  dbFilename: string;
  moderationEnabled: boolean;
  maxMembers: number;
  monthlyAiBudgetUsd: number;
  createdAt: string;
  updatedAt: string;
}

interface Props {
  initialSettings: FamilySettings;
  canEdit: boolean;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export function FamilySettingsForm({ initialSettings, canEdit }: Props) {
  const router = useRouter();
  const [name, setName] = useState(initialSettings.name);
  const [maxMembers, setMaxMembers] = useState(String(initialSettings.maxMembers));
  const [aiBudget, setAiBudget] = useState(initialSettings.monthlyAiBudgetUsd.toFixed(2));
  const [moderationEnabled, setModerationEnabled] = useState(initialSettings.moderationEnabled);

  const update = trpc.family.updateSettings.useMutation({
    onSuccess: ({ row, changed }) => {
      if (changed.length === 0) {
        toast.info('No changes to save.');
        return;
      }
      toast.success(`Saved (${changed.length} change${changed.length === 1 ? '' : 's'})`);
      // Sync local state to canonical row in case server normalized values.
      setName(row.name);
      setMaxMembers(String(row.maxMembers));
      setAiBudget(row.monthlyAiBudgetUsd.toFixed(2));
      setModerationEnabled(row.moderationEnabled);
      router.refresh();
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to save settings');
    },
  });

  const dirty =
    name !== initialSettings.name ||
    Number(maxMembers) !== initialSettings.maxMembers ||
    Number(aiBudget) !== initialSettings.monthlyAiBudgetUsd ||
    moderationEnabled !== initialSettings.moderationEnabled;

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canEdit) return;

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
      name: name.trim(),
      maxMembers: Math.floor(max),
      monthlyAiBudgetUsd: budget,
      moderationEnabled,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>General</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="family-name">Family name</Label>
            <Input
              id="family-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={!canEdit || update.isPending}
              maxLength={120}
              required
            />
            <p className="text-xs text-muted-foreground">
              Shown across the app and in the family picker.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Limits & budget</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="max-members">Member limit</Label>
              <Input
                id="max-members"
                type="number"
                inputMode="numeric"
                pattern="[0-9]*"
                min={1}
                step={1}
                value={maxMembers}
                onChange={(e) => setMaxMembers(e.target.value)}
                disabled={!canEdit || update.isPending}
              />
              <p className="text-xs text-muted-foreground">
                Hard cap on active members. Pending invites count toward this.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="ai-budget">Monthly AI budget (USD)</Label>
              <Input
                id="ai-budget"
                type="number"
                inputMode="decimal"
                min={0}
                step={0.5}
                value={aiBudget}
                onChange={(e) => setAiBudget(e.target.value)}
                disabled={!canEdit || update.isPending}
              />
              <p className="text-xs text-muted-foreground">
                Soft cap on AI research spend per calendar month.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Moderation</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between gap-4">
            <div>
              <Label htmlFor="moderation-toggle" className="text-base">
                Editor moderation
              </Label>
              <p className="text-xs text-muted-foreground mt-1">
                When on, edits from the editor role are queued for review
                instead of applying immediately.
              </p>
            </div>
            <Switch
              id="moderation-toggle"
              checked={moderationEnabled}
              onCheckedChange={setModerationEnabled}
              disabled={!canEdit || update.isPending}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm text-muted-foreground">
            Read-only metadata
          </CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-4 sm:grid-cols-2 text-sm">
            <div>
              <dt className="text-muted-foreground">Family ID</dt>
              <dd className="font-mono text-xs mt-1">{initialSettings.id}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Storage</dt>
              <dd className="font-mono text-xs mt-1 truncate" title={initialSettings.dbFilename}>
                {initialSettings.dbFilename}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Created</dt>
              <dd className="mt-1">{formatDate(initialSettings.createdAt)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Last updated</dt>
              <dd className="mt-1">{formatDate(initialSettings.updatedAt)}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      {canEdit ? (
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={!dirty || update.isPending}>
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
          {dirty ? (
            <span className="text-xs text-muted-foreground">Unsaved changes</span>
          ) : null}
        </div>
      ) : null}

      {canEdit ? (
        <>
          <Separator />
          <Card className="border-destructive/40">
            <CardHeader>
              <CardTitle className="text-destructive">Danger zone</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium">Delete this family</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Removes all members, invitations, and activity history. The
                  family tree storage is orphaned and cannot be recovered.
                </p>
              </div>
              <DeleteFamilyDialog familyName={initialSettings.name} />
            </CardContent>
          </Card>
        </>
      ) : null}
    </form>
  );
}
