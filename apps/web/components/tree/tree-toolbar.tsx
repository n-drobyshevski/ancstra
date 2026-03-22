'use client';

export function TreeToolbar({
  onAutoLayout,
  onSaveLayout,
}: {
  onAutoLayout: () => void;
  onSaveLayout: () => void;
}) {
  return (
    <div className="absolute top-3 left-3 right-3 z-10 flex justify-between" />
  );
}
