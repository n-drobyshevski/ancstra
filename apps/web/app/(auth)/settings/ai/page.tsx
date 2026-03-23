import { AiBudgetSettings } from '@/components/settings/ai-budget-settings';
import { SettingsMobileHeader } from '@/components/settings/settings-mobile-header';

export default function AiSettingsPage() {
  return (
    <div className="space-y-6">
      <SettingsMobileHeader title="AI" />
      <div>
        <h2 className="text-lg font-semibold">AI</h2>
        <p className="text-sm text-muted-foreground">
          Manage your monthly AI budget and monitor usage.
        </p>
      </div>
      <AiBudgetSettings />
    </div>
  );
}
