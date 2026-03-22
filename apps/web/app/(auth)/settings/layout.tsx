import { SettingsNav } from '@/components/settings/settings-nav';

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-[calc(100vh-4rem)] gap-6">
      <SettingsNav />
      <div className="flex-1 min-w-0 overflow-y-auto">{children}</div>
    </div>
  );
}
