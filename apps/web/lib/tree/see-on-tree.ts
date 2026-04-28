/**
 * Build the URL search string for a "View on tree" navigation.
 *
 * Forces view=canvas and focus=<personId>. Clears topologyAnchor, and resets
 * topologyMode to 'all' when it was non-default — otherwise an ancestors-only
 * topology with no anchor would render an empty canvas. Drops the table-only
 * `page` param. Every other param (q, sex, sort, year ranges, etc.) is
 * preserved untouched.
 */
export function buildSeeOnTreeSearch(
  current: URLSearchParams,
  personId: string,
): string {
  const params = new URLSearchParams(current.toString());

  params.set('view', 'canvas');
  params.set('focus', personId);

  params.delete('topologyAnchor');
  const mode = params.get('topologyMode');
  if (mode && mode !== 'all') params.set('topologyMode', 'all');

  params.delete('page');

  return params.toString();
}
