import type { Taxon } from '../client';

/** Canonical entity ID prefix for taxon-derived entities. */
export const TAXON_ID_PREFIX = 'taxon:';

/** Build the canonical entity ID for a Sylius taxon code. */
export function taxonEntityId(code: string): string {
  return `${TAXON_ID_PREFIX}${code}`;
}

/**
 * Resolve a Sylius taxon code from an IRI like `/api/v2/shop/taxons/MENU_CATEGORY`.
 * Returns null when the IRI does not match the expected shape.
 */
export function codeFromTaxonIri(iri: string | null | undefined): string | null {
  if (!iri) return null;
  const last = iri.split('/').pop();
  if (!last) return null;
  return decodeURIComponent(last);
}

/**
 * Sort a list of taxons by Sylius `position` ascending. Stable: taxons with the
 * same position keep input order.
 */
export function sortByPosition<T extends { position?: number | null }>(taxons: T[]): T[] {
  return [...taxons].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
}

/** Filter out taxons explicitly disabled in Sylius. */
export function filterEnabled<T extends { enabled?: boolean | null }>(taxons: T[]): T[] {
  return taxons.filter((t) => t.enabled !== false);
}

/**
 * Build a canonical `LinkReference` to a Category for a given taxon. The frontend
 * resolves this to a route via its page-types `resolveFor: [{ referenceType: 'Category' }]`
 * mapping; the connector emits no URL strings.
 */
export function categoryLinkReference(taxon: Pick<Taxon, 'code' | 'slug'>) {
  const code = taxon.code ?? '';
  const slug = taxon.slug ?? '';
  return {
    type: 'reference' as const,
    reference: {
      type: 'Category' as const,
      slug,
      id: taxonEntityId(code),
    },
  };
}
