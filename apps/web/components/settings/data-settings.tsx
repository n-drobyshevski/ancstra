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

      toast.success('Backup downloaded');
    } catch {
      toast.error('Failed to create backup');
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

      toast.success('Database restored. Reloading...');
      onDataChanged();
      setTimeout(() => window.location.reload(), 1500);
    } catch {
      toast.error('Failed to restore database');
    }
  }

  async function handleClearCache() {
    setCacheLoading(true);
    try {
      const res = await fetch('/api/settings/cache', { method: 'DELETE' });
      if (!res.ok) throw new Error('Clear cache failed');
      const data = await res.json();
      toast.success(`Cleared ${data.cleared} dismissed research items`);
      onDataChanged();
    } catch {
      toast.error('Failed to clear cache');
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
      toast.success(`Freed ${formatBytes(data.freedBytes)} of archive storage`);
      onDataChanged();
    } catch {
      toast.error('Failed to clear archives');
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
      toast.success('All data cleared. Reloading...');
      onDataChanged();
      setTimeout(() => window.location.reload(), 1500);
    } catch {
      toast.error('Failed to delete all data');
    }
  }

  return (
    <div className="space-y-6">
      {/* Backup & Restore */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium">Backup & Restore</h3>
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="flex-1"
            onClick={handleBackup}
            disabled={backupLoading}
          >
            <Download className="size-4" data-icon="inline-start" />
            {backupLoading ? 'Creating backup...' : 'Download Backup'}
          </Button>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" className="flex-1">
                <Upload className="size-4" data-icon="inline-start" />
                Restore Backup
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Restore Database</AlertDialogTitle>
                <AlertDialogDescription>
                  This will replace your entire database with the uploaded file.
                  This action cannot be undone. Make sure you have a current
                  backup before proceeding.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
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
                  Choose File & Restore
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Clear Cache */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium">Cache</h3>
        <p className="text-sm text-muted-foreground">
          Remove dismissed research items from the database.
        </p>
        <Button
          variant="outline"
          className="w-full md:w-auto"
          onClick={handleClearCache}
          disabled={cacheLoading}
        >
          <Trash2 className="size-4" data-icon="inline-start" />
          {cacheLoading ? 'Clearing...' : 'Clear Search Cache'}
        </Button>
      </div>

      {/* Danger Zone */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-destructive">Danger Zone</h3>
        <p className="text-sm text-muted-foreground">
          Permanently delete all cached data and web archives. This cannot be
          undone.
        </p>
        <div className="flex gap-2">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" className="flex-1" disabled={archiveLoading}>
                <Archive className="size-4" data-icon="inline-start" />
                {archiveLoading ? 'Clearing...' : 'Clear Web Archives'}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Clear Web Archives</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete all saved HTML archives and
                  screenshots. Research items will be kept but their archive
                  references will be removed.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  variant="destructive"
                  onClick={handleClearArchives}
                >
                  Delete Archives
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <AlertDialog
            onOpenChange={(open) => {
              if (!open) setDeleteConfirmText('');
            }}
          >
            <AlertDialogTrigger asChild>
              <Button variant="destructive" className="flex-1">
                <AlertTriangle className="size-4" data-icon="inline-start" />
                Delete All Data
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete All Data</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete all cached research items and web
                  archives. Type <strong>DELETE</strong> below to confirm.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <Input
                placeholder="Type DELETE to confirm"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
              />
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  variant="destructive"
                  disabled={deleteConfirmText !== 'DELETE'}
                  onClick={handleDeleteAll}
                >
                  Delete Everything
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </div>
  );
}
