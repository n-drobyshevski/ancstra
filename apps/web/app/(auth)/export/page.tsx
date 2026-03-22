'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { exportGedcom } from '@/app/actions/export-gedcom';

export default function ExportPage() {
  const [mode, setMode] = useState<'full' | 'shareable'>('full');
  const [exporting, setExporting] = useState(false);
  const [stats, setStats] = useState<{ total: number; living: number } | null>(null);

  useEffect(() => {
    fetch('/api/persons?pageSize=9999')
      .then((r) => r.json())
      .then((d) => {
        const living = d.items.filter((p: { isLiving: boolean }) => p.isLiving).length;
        setStats({ total: d.total, living });
      })
      .catch(() => {});
  }, []);

  async function handleExport() {
    setExporting(true);
    try {
      const formData = new FormData();
      formData.set('mode', mode);
      const gedcom = await exportGedcom(formData);
      const blob = new Blob([gedcom], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ancstra-export-${mode}.ged`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('GEDCOM exported');
    } catch {
      toast.error('Export failed');
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto py-8">
      <h1 className="text-xl font-semibold mb-6">Export GEDCOM</h1>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Export Mode</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="radio"
                name="mode"
                value="full"
                checked={mode === 'full'}
                onChange={() => setMode('full')}
                className="accent-primary"
              />
              <div>
                <div className="text-sm font-medium">Full backup</div>
                <div className="text-xs text-muted-foreground">
                  Includes all persons and events
                </div>
              </div>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="radio"
                name="mode"
                value="shareable"
                checked={mode === 'shareable'}
                onChange={() => setMode('shareable')}
                className="accent-primary"
              />
              <div>
                <div className="text-sm font-medium">Shareable</div>
                <div className="text-xs text-muted-foreground">
                  Hides living persons for sharing
                </div>
              </div>
            </label>
          </div>
          {stats && (
            <p className="text-sm text-muted-foreground">
              {stats.total} persons in your tree
              {mode === 'shareable' && stats.living > 0 && (
                <> ({stats.living} living persons will be hidden)</>
              )}
            </p>
          )}
          <Button onClick={handleExport} disabled={exporting || !stats?.total}>
            {exporting ? 'Exporting...' : 'Download .ged'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
