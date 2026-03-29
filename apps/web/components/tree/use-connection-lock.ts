import { useRef } from 'react';

function connectionKey(source: string, target: string, type: 'spouse' | 'parentChild'): string {
  if (type === 'spouse') {
    const sorted = [source, target].sort();
    return `spouse:${sorted[0]}:${sorted[1]}`;
  }
  return `pc:${source}:${target}`;
}

export function useConnectionLock() {
  const lockedRef = useRef(new Set<string>());

  return {
    isLocked(source: string, target: string, type: 'spouse' | 'parentChild'): boolean {
      return lockedRef.current.has(connectionKey(source, target, type));
    },
    lock(source: string, target: string, type: 'spouse' | 'parentChild'): void {
      lockedRef.current.add(connectionKey(source, target, type));
    },
    unlock(source: string, target: string, type: 'spouse' | 'parentChild'): void {
      lockedRef.current.delete(connectionKey(source, target, type));
    },
  };
}
