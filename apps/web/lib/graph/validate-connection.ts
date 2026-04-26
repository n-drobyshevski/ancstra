export type ConnectionViolation =
  | { kind: 'self_reference' }
  | { kind: 'duplicate'; relationshipType: string }
  | { kind: 'cycle'; relationshipType: string };

export function validateNoSelfRef(
  source: string,
  target: string,
): ConnectionViolation | null {
  return source === target ? { kind: 'self_reference' } : null;
}

interface EdgeKey {
  from: string;
  to: string;
  type: string;
  /** When true, treat (from,to) and (to,from) as identical. */
  symmetric?: boolean;
}

export function validateNoDuplicate<E>(
  source: string,
  target: string,
  type: string,
  edges: readonly E[],
  getEdgeKey: (edge: E) => EdgeKey,
): ConnectionViolation | null {
  for (const edge of edges) {
    const key = getEdgeKey(edge);
    if (key.type !== type) continue;
    if (key.from === source && key.to === target) {
      return { kind: 'duplicate', relationshipType: type };
    }
    if (key.symmetric && key.from === target && key.to === source) {
      return { kind: 'duplicate', relationshipType: type };
    }
  }
  return null;
}

/**
 * Detect a cycle that adding `source → target` would introduce, given a
 * directed adjacency list of existing edges of the same relationship type.
 */
export function validateAcyclic(
  source: string,
  target: string,
  adjacency: Map<string, Set<string>>,
  relationshipType: string,
): ConnectionViolation | null {
  // A cycle would form if `target` can already reach `source` in the
  // existing adjacency. Walk forward from `target` looking for `source`.
  const stack: string[] = [target];
  const visited = new Set<string>();
  while (stack.length > 0) {
    const node = stack.pop()!;
    if (node === source) {
      return { kind: 'cycle', relationshipType };
    }
    if (visited.has(node)) continue;
    visited.add(node);
    const neighbours = adjacency.get(node);
    if (!neighbours) continue;
    for (const next of neighbours) {
      if (!visited.has(next)) stack.push(next);
    }
  }
  return null;
}

export function formatViolation(violation: ConnectionViolation): string {
  switch (violation.kind) {
    case 'self_reference':
      return 'Cannot connect to itself';
    case 'duplicate':
      return 'This connection already exists';
    case 'cycle':
      return 'This would create a circular relationship';
  }
}
