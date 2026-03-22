import { AiBudgetSettings } from '@/components/settings/ai-budget-settings';

export default function AiSettingsPage() {
  return (
    <div className="space-y-6">
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
