'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Download, FileText, Users, Shield } from 'lucide-react';

interface ExportStats {
  total: number;
  living: number;
}

type GedcomVersion = '5.5.1' | '7.0';

export function ExportOptions() {
  const [version, setVersion] = useState<GedcomVersion>('5.5.1');
  const [includeLiving, setIncludeLiving] = useState(true);
  const [includeSources, setIncludeSources] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [stats, setStats] = useState<ExportStats | null>(null);

  useEffect(() => {
    // FIXME(PR #3): /api/persons enforces a max size of 100 via parseAsNumberLiteral.
    // Replace with the streaming /api/persons/export endpoint once it lands. For now
    // the export will silently include only the first 20 results (default fallback).
    fetch('/api/persons?size=9999')
      .then((r) => r.json())
      .then((d) => {
        const living = d.items.filter(
          (p: { isLiving: boolean }) => p.isLiving,
        ).length;
        setStats({ total: d.total, living });
      })
      .catch(() => {});
  }, []);

  async function handleExport() {
    setExporting(true);
    try {
      const params = new URLSearchParams({
        version,
        includeLiving: String(includeLiving),
        includeSources: String(includeSources),
      });

      const res = await fetch(`/api/export/gedcom?${params}`);

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || 'Export failed');
      }

      const blob = await res.blob();
      const disposition = res.headers.get('Content-Disposition') || '';
      const filenameMatch = disposition.match(/filename="(.+?)"/);
      const filename = filenameMatch?.[1] || 'family-tree.ged';

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('GEDCOM file downloaded');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setExporting(false);
    }
  }

  const exportedCount =
    stats && !includeLiving ? stats.total - stats.living : stats?.total ?? 0;

  return (
    <div className="space-y-6">
      {/* Format Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="h-4 w-4" />
            GEDCOM Format
          </CardTitle>
          <CardDescription>
            Choose the GEDCOM version for your export
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="radio"
              name="version"
              value="5.5.1"
              checked={version === '5.5.1'}
              onChange={() => setVersion('5.5.1')}
              className="mt-0.5 accent-primary"
            />
            <div>
              <div className="text-sm font-medium">GEDCOM 5.5.1</div>
              <div className="text-xs text-muted-foreground">
                Most widely supported format. Compatible with nearly all
                genealogy software.
              </div>
            </div>
          </label>
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="radio"
              name="version"
              value="7.0"
              checked={version === '7.0'}
              onChange={() => setVersion('7.0')}
              className="mt-0.5 accent-primary"
            />
            <div>
              <div className="text-sm font-medium">GEDCOM 7.0</div>
              <div className="text-xs text-muted-foreground">
                Newer standard with better Unicode support. Check if your target
                software supports it.
              </div>
            </div>
          </label>
        </CardContent>
      </Card>

      {/* Options */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Shield className="h-4 w-4" />
            Export Options
          </CardTitle>
          <CardDescription>
            Control what data is included in the export
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Label className="flex items-start gap-3 cursor-pointer font-normal">
            <input
              type="checkbox"
              checked={includeLiving}
              onChange={(e) => setIncludeLiving(e.target.checked)}
              className="mt-0.5 accent-primary"
            />
            <div>
              <div className="text-sm font-medium">Include living persons</div>
              <div className="text-xs text-muted-foreground">
                Uncheck to redact living individuals for sharing
              </div>
            </div>
          </Label>
          <Label className="flex items-start gap-3 cursor-pointer font-normal">
            <input
              type="checkbox"
              checked={includeSources}
              onChange={(e) => setIncludeSources(e.target.checked)}
              className="mt-0.5 accent-primary"
            />
            <div>
              <div className="text-sm font-medium">Include sources</div>
              <div className="text-xs text-muted-foreground">
                Include source citations in the export
              </div>
            </div>
          </Label>
        </CardContent>
      </Card>

      {/* Stats + Download */}
      <Card>
        <CardContent className="pt-6">
          {stats && (
            <div className="flex items-center gap-4 mb-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5" />
                {stats.total} persons in tree
              </span>
              {stats.living > 0 && (
                <span>
                  {stats.living} living
                  {!includeLiving && ' (will be excluded)'}
                </span>
              )}
            </div>
          )}

          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              {stats
                ? `${exportedCount} persons will be exported`
                : 'Loading tree data...'}
            </div>
            <Button
              onClick={handleExport}
              disabled={exporting || !stats?.total}
            >
              <Download className="mr-2 h-4 w-4" />
              {exporting ? 'Exporting...' : 'Download .ged'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
