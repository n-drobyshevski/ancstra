'use client';

import { useTranslations } from 'next-intl';
import { FacetSearch } from './facets/facet-search';
import { FacetSex } from './facets/facet-sex';
import { FacetLiving } from './facets/facet-living';
import { FacetValidation } from './facets/facet-validation';
import { FacetYearRange } from './facets/facet-year-range';
import { FacetPlace } from './facets/facet-place';
import { FacetCitations } from './facets/facet-citations';
import { FacetCompleteness } from './facets/facet-completeness';
import { FacetHasProposals } from './facets/facet-has-proposals';
import type { TreeYearBounds } from '@/lib/persons/year-bounds';

const FALLBACK_BOUNDS = { minYear: 1700, maxYear: new Date().getFullYear() };

interface TreeFiltersListProps {
  yearBounds: TreeYearBounds;
}

/** Composition of every tree filter facet, in the canonical sidebar order.
 *  Both `TreeSidebar` (desktop table view) and `TreeFiltersPanelContent`
 *  (canvas view sheet/drawer) render this — a single source for the facet
 *  ordering and which dimensions exist. Each facet binds to the URL via
 *  `useTreeTableFilters()` internally, so this component is stateless. */
export function TreeFiltersList({ yearBounds }: TreeFiltersListProps) {
  const tFacets = useTranslations('tree.sidebar.facetLabels');

  const visualBounds = {
    minYear: yearBounds.minYear ?? FALLBACK_BOUNDS.minYear,
    maxYear: yearBounds.maxYear ?? FALLBACK_BOUNDS.maxYear,
  };

  return (
    <>
      <FacetSearch />
      <FacetSex />
      <FacetLiving />
      <FacetValidation />
      <FacetYearRange
        label={tFacets('born')}
        fromKey="bornFrom"
        toKey="bornTo"
        defaultOpen
        visualBounds={visualBounds}
      />
      <FacetYearRange
        label={tFacets('died')}
        fromKey="diedFrom"
        toKey="diedTo"
        visualBounds={visualBounds}
      />
      <FacetPlace />
      <FacetCitations />
      <FacetCompleteness />
      <FacetHasProposals />
    </>
  );
}
