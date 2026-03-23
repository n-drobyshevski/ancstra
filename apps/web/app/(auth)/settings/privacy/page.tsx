import { PrivacySettings } from '@/components/settings/privacy-settings';
import { SettingsMobileHeader } from '@/components/settings/settings-mobile-header';

export default function PrivacyPage() {
  return (
    <div className="space-y-6">
      <SettingsMobileHeader title="Privacy" />
      <div>
        <h2 className="text-lg font-semibold">Privacy</h2>
        <p className="text-sm text-muted-foreground">
          Control how living persons and sensitive data are handled.
        </p>
      </div>
      <PrivacySettings />
    </div>
  );
}
