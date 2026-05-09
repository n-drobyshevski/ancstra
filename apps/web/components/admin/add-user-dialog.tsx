'use client';

import { useState } from 'react';
import type { FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Eye, EyeOff, Loader2, UserPlus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { trpc } from '@/lib/trpc/client';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  FamilyPickerField,
  type FamilyOption,
} from '@/components/admin/family-picker-field';

type Role = 'admin' | 'editor' | 'viewer';
const ROLE_VALUES: Role[] = ['admin', 'editor', 'viewer'];

export function AddUserDialog() {
  const t = useTranslations('admin.users.addDialog');
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <UserPlus className="size-4" />
          {t('trigger')}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        {open ? <AddUserForm onClose={() => setOpen(false)} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function AddUserForm({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const t = useTranslations('admin.users.addDialog');
  const tRoles = useTranslations('admin.users.addDialog.roles');

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [addToFamily, setAddToFamily] = useState(false);
  const [selectedFamily, setSelectedFamily] = useState<FamilyOption | null>(null);
  const [role, setRole] = useState<Role>('viewer');

  const createUser = trpc.platformAdmin.createUser.useMutation({
    onSuccess: ({ email: createdEmail, addedToFamily, capExceeded }) => {
      if (addedToFamily && capExceeded) {
        toast.warning(t('createdAddedOverCap', { email: createdEmail, family: addedToFamily.name }));
      } else if (addedToFamily) {
        toast.success(t('createdAddedToFamily', { email: createdEmail, family: addedToFamily.name }));
      } else {
        toast.success(t('createdUser', { email: createdEmail }));
      }
      onClose();
      router.refresh();
    },
    onError: (err) => toast.error(err.message || t('createFailed')),
  });

  const trimmedName = name.trim();
  const trimmedEmail = email.trim().toLowerCase();
  const emailLooksValid = /\S+@\S+\.\S+/.test(trimmedEmail);
  const familyOk = !addToFamily || !!selectedFamily;
  const canSubmit =
    trimmedName.length > 0 &&
    emailLooksValid &&
    password.length >= 8 &&
    familyOk &&
    !createUser.isPending;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    createUser.mutate({
      name: trimmedName,
      email: trimmedEmail,
      password,
      family:
        addToFamily && selectedFamily
          ? { familyId: selectedFamily.id, role }
          : undefined,
    });
  }

  return (
    <form onSubmit={handleSubmit}>
      <DialogHeader>
        <DialogTitle>{t('title')}</DialogTitle>
        <DialogDescription>
          {t('description')}
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4 py-2">
        <div className="space-y-2">
          <Label htmlFor="add-user-name">{t('nameLabel')}</Label>
          <Input
            id="add-user-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={createUser.isPending}
            autoComplete="off"
            autoFocus
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="add-user-email">{t('emailLabel')}</Label>
          <Input
            id="add-user-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={createUser.isPending}
            autoComplete="off"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="add-user-password">{t('passwordLabel')}</Label>
          <div className="relative">
            <Input
              id="add-user-password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={createUser.isPending}
              autoComplete="new-password"
              required
              minLength={8}
              className="pr-10"
            />
            <button
              type="button"
              tabIndex={-1}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? (
                <EyeOff className="size-4" />
              ) : (
                <Eye className="size-4" />
              )}
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            {t('passwordHint')}
          </p>
        </div>

        <div className="border-t border-border pt-3">
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <Checkbox
              checked={addToFamily}
              onCheckedChange={(v) => setAddToFamily(v === true)}
              disabled={createUser.isPending}
            />
            <span>{t('alsoAddToFamily')}</span>
          </label>
        </div>

        {addToFamily ? (
          <div className="space-y-3 rounded-md border border-dashed border-border p-3">
            <FamilyPickerField
              value={selectedFamily}
              onChange={setSelectedFamily}
              disabled={createUser.isPending}
            />

            {selectedFamily ? (
              <div className="space-y-2">
                <Label>{t('roleLabel')}</Label>
                <RadioGroup
                  value={role}
                  onValueChange={(v: Role) => setRole(v)}
                  className="grid grid-cols-3 gap-2"
                  disabled={createUser.isPending}
                >
                  {ROLE_VALUES.map((r) => (
                    <Label
                      key={r}
                      htmlFor={`add-user-role-${r}`}
                      className={cn(
                        'flex cursor-pointer flex-col gap-1 rounded-md border border-input p-3 transition-colors hover:bg-accent/50',
                        role === r && 'border-primary bg-primary/5',
                        createUser.isPending && 'cursor-not-allowed opacity-60',
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium">{tRoles(r)}</span>
                        <RadioGroupItem
                          value={r}
                          id={`add-user-role-${r}`}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {tRoles(`${r}Hint` as const)}
                      </span>
                    </Label>
                  ))}
                </RadioGroup>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <DialogFooter>
        <Button
          type="button"
          variant="ghost"
          onClick={onClose}
          disabled={createUser.isPending}
        >
          {t('cancel')}
        </Button>
        <Button type="submit" disabled={!canSubmit}>
          {createUser.isPending ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              {t('creating')}
            </>
          ) : (
            <>
              <UserPlus className="size-4" />
              {t('create')}
            </>
          )}
        </Button>
      </DialogFooter>
    </form>
  );
}
