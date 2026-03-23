import { ThemeSelector } from '@/components/settings/theme-selector';
import { SettingsMobileHeader } from '@/components/settings/settings-mobile-header';

export default function AppearancePage() {
  return (
    <div className="space-y-6">
      <SettingsMobileHeader title="Appearance" />
      <div>
        <h2 className="text-lg font-semibold">Appearance</h2>
        <p className="text-sm text-muted-foreground">
          Customize how Ancstra looks on your device.
        </p>
      </div>
      <ThemeSelector />
    </div>
  );
}
