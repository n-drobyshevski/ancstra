import { useMemo, useRef } from 'react';

interface UseConnectionLockOptions<T extends string> {
  /** Types whose key is independent of source/target order (e.g. spouse, sibling). */
  symmetricTypes?: readonly T[];
}

export interface ConnectionLock<T extends string> {
  isLocked(source: string, target: string, type: T): boolean;
  lock(source: string, target: string, type: T): void;
  unlock(source: string, target: string, type: T): void;
}

export function useConnectionLock<T extends string>(
  options: UseConnectionLockOptions<T> = {},
): ConnectionLock<T> {
  const lockedRef = useRef(new Set<string>());
  const symmetric = useMemo(
    () => new Set<string>(options.symmetricTypes ?? []),
    [options.symmetricTypes],
  );

  const key = (source: string, target: string, type: T): string => {
    if (symmetric.has(type)) {
      const [a, b] = [source, target].sort();
      return `${type}:${a}:${b}`;
    }
    return `${type}:${source}:${target}`;
  };

  return {
    isLocked(source, target, type) {
      return lockedRef.current.has(key(source, target, type));
    },
    lock(source, target, type) {
      lockedRef.current.add(key(source, target, type));
    },
    unlock(source, target, type) {
      lockedRef.current.delete(key(source, target, type));
    },
  };
}
