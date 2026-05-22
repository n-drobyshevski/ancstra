// Tiny version chip rendered in the sidebar footer. Build-time env vars
// (see next.config.ts) inline the values into the client bundle, so this is
// a zero-cost RSC at runtime.
//
// Surface chosen: sidebar footer (always visible to authenticated users) +
// /api/health (for ops + bug reports on unauthenticated pages). Sentry
// "release" tag is set separately in the three Sentry init files.
export function AppVersionBadge() {
  const version = process.env.NEXT_PUBLIC_APP_VERSION ?? '0.0.0';
  const commit = process.env.NEXT_PUBLIC_APP_COMMIT ?? 'local';
  return (
    <div
      className="px-2 pt-1 text-[10px] leading-none text-muted-foreground/60 select-none group-data-[collapsible=icon]:hidden"
      title={`Ancstra v${version} · ${commit}`}
    >
      <span className="font-mono">v{version}</span>
      {commit !== 'local' && (
        <span className="font-mono opacity-70"> · {commit}</span>
      )}
    </div>
  );
}
