'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import {
  Download,
  Upload,
  Trash2,
  Archive,
  AlertTriangle,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { RoleGate } from '@/components/auth/role-gate';

interface DataSettingsProps {
  onDataChanged: () => void;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export function DataSettings({ onDataChanged }: DataSettingsProps) {
  const tBackup = useTranslations('settings.data.backup');
  const tCache = useTranslations('settings.data.cache');
  const tDanger = useTranslations('settings.data.danger');
  const [backupLoading, setBackupLoading] = useState(false);
  const [cacheLoading, setCacheLoading] = useState(false);
  const [archiveLoading, setArchiveLoading] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  async function handleBackup() {
    setBackupLoading(true);
    try {
      const res = await fetch('/api/settings/backup', { method: 'POST' });
      if (!res.ok) throw new Error('Backup failed');

      const blob = await res.blob();
      const disposition = res.headers.get('Content-Disposition') || '';
      const filenameMatch = disposition.match(/filename="(.+?)"/);
      const filename = filenameMatch?.[1] || 'ancstra-backup.db';

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success(tBackup('downloaded'));
    } catch {
      toast.error(tBackup('downloadFailed'));
    } finally {
      setBackupLoading(false);
    }
  }

  async function handleRestore(file: File) {
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/settings/restore', {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) throw new Error('Restore failed');

      toast.success(tBackup('restored'));
      onDataChanged();
      setTimeout(() => window.location.reload(), 1500);
    } catch {
      toast.error(tBackup('restoreFailed'));
    }
  }

  async function handleClearCache() {
    setCacheLoading(true);
    try {
      const res = await fetch('/api/settings/cache', { method: 'DELETE' });
      if (!res.ok) throw new Error('Clear cache failed');
      const data = await res.json();
      toast.success(tCache('cleared', { count: data.cleared }));
      onDataChanged();
    } catch {
      toast.error(tCache('clearFailed'));
    } finally {
      setCacheLoading(false);
    }
  }

  async function handleClearArchives() {
    setArchiveLoading(true);
    try {
      const res = await fetch('/api/settings/archives', { method: 'DELETE' });
      if (!res.ok) throw new Error('Clear archives failed');
      const data = await res.json();
      toast.success(tDanger('freed', { size: formatBytes(data.freedBytes) }));
      onDataChanged();
    } catch {
      toast.error(tDanger('clearArchivesFailed'));
    } finally {
      setArchiveLoading(false);
    }
  }

  async function handleDeleteAll() {
    try {
      // Clear cache + archives in parallel
      await Promise.all([
        fetch('/api/settings/cache', { method: 'DELETE' }),
        fetch('/api/settings/archives', { method: 'DELETE' }),
      ]);
      toast.success(tDanger('allCleared'));
      onDataChanged();
      setTimeout(() => window.location.reload(), 1500);
    } catch {
      toast.error(tDanger('deleteAllFailed'));
    }
  }

  return (
    <div className="space-y-6">
      {/* Backup & Restore */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium">{tBackup('heading')}</h3>
        <div className="flex gap-2">
          <RoleGate permission="settings:manage">
            <Button
              variant="outline"
              className="flex-1"
              onClick={handleBackup}
              disabled={backupLoading}
            >
              <Download className="size-4" data-icon="inline-start" />
              {backupLoading ? tBackup('creating') : tBackup('download')}
            </Button>
          </RoleGate>

          <RoleGate permission="settings:manage">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" className="flex-1">
                  <Upload className="size-4" data-icon="inline-start" />
                  {tBackup('restore')}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{tBackup('restoreTitle')}</AlertDialogTitle>
                  <AlertDialogDescription>
                    {tBackup('restoreDescription')}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{tBackup('cancel')}</AlertDialogCancel>
                  <AlertDialogAction
                    variant="destructive"
                    onClick={() => {
                      const input = document.createElement('input');
                      input.type = 'file';
                      input.accept = '.db,.sqlite,.sqlite3';
                      input.onchange = (e) => {
                        const file = (e.target as HTMLInputElement).files?.[0];
                        if (file) handleRestore(file);
                      };
                      input.click();
                    }}
                  >
                    {tBackup('chooseAndRestore')}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </RoleGate>
        </div>
      </div>

      {/* Clear Cache */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium">{tCache('heading')}</h3>
        <p className="text-sm text-muted-foreground">
          {tCache('description')}
        </p>
        <RoleGate permission="settings:manage">
          <Button
            variant="outline"
            className="w-full md:w-auto"
            onClick={handleClearCache}
            disabled={cacheLoading}
          >
            <Trash2 className="size-4" data-icon="inline-start" />
            {cacheLoading ? tCache('clearing') : tCache('clear')}
          </Button>
        </RoleGate>
      </div>

      {/* Danger Zone */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-destructive">{tDanger('heading')}</h3>
        <p className="text-sm text-muted-foreground">
          {tDanger('archivesDescription')}
        </p>
        <div className="flex gap-2">
          <RoleGate permission="settings:manage">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" className="flex-1" disabled={archiveLoading}>
                  <Archive className="size-4" data-icon="inline-start" />
                  {archiveLoading ? tDanger('clearing') : tDanger('clearArchives')}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{tDanger('clearArchivesTitle')}</AlertDialogTitle>
                  <AlertDialogDescription>
                    {tDanger('clearArchivesDescription')}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{tBackup('cancel')}</AlertDialogCancel>
                  <AlertDialogAction
                    variant="destructive"
                    onClick={handleClearArchives}
                  >
                    {tDanger('deleteArchives')}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </RoleGate>

          <RoleGate permission="settings:manage">
            <AlertDialog
              onOpenChange={(open) => {
                if (!open) setDeleteConfirmText('');
              }}
            >
              <AlertDialogTrigger asChild>
                <Button variant="destructive" className="flex-1">
                  <AlertTriangle className="size-4" data-icon="inline-start" />
                  {tDanger('deleteAll')}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{tDanger('deleteAllTitle')}</AlertDialogTitle>
                  <AlertDialogDescription>
                    {tDanger.rich('deleteAllDescription', {
                      b: (chunks) => <strong>{chunks}</strong>,
                    })}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <Input
                  placeholder={tDanger('deleteConfirmPlaceholder')}
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                />
                <AlertDialogFooter>
                  <AlertDialogCancel>{tBackup('cancel')}</AlertDialogCancel>
                  <AlertDialogAction
                    variant="destructive"
                    disabled={deleteConfirmText !== 'DELETE'}
                    onClick={handleDeleteAll}
                  >
                    {tDanger('deleteEverything')}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </RoleGate>
        </div>
      </div>
    </div>
  );
}
