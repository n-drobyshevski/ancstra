'use client';

import { useState } from 'react';
import { StorageUsage } from '@/components/settings/storage-usage';
import { DataSettings } from '@/components/settings/data-settings';

export default function DataPage() {
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Data & Storage</h2>
        <p className="text-sm text-muted-foreground">
          Manage your database, backups, and cached data.
        </p>
      </div>
      <StorageUsage refreshKey={refreshKey} />
      <DataSettings onDataChanged={() => setRefreshKey((k) => k + 1)} />
    </div>
  );
}
