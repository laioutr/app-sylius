import type { Taxon } from '../client';

/** Canonical entity ID prefix for taxon-derived entities. */
export const TAXON_ID_PREFIX = 'taxon:';

/** Build the canonical entity ID for a Sylius taxon code. */
export function taxonEntityId(code: string): string {
  return `${TAXON_ID_PREFIX}${code}`;
}

/** Strip the canonical `taxon:` prefix from an entity ID, returning the bare Sylius code. */
export function taxonCodeFromEntityId(id: string | number): string {
  return String(id).startsWith(TAXON_ID_PREFIX)
    ? String(id).slice(TAXON_ID_PREFIX.length)
    : String(id);
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
