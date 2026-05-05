import { MenuItemBase } from '@laioutr-core/canonical-types/entity/menuItem';
import {
  categoryLinkReference,
  codeFromTaxonIri,
  taxonCodeFromEntityId,
  taxonEntityId,
} from '../../mappers/taxon';
import { defineSyliusComponentResolver } from '../../middleware/defineSylius';

export default defineSyliusComponentResolver({
  entityType: 'MenuItem',
  label: 'Sylius Menu Item Resolver',
  provides: [MenuItemBase],
  cache: { ttl: '1 day' },
  resolve: async ({ entityIds, context, $entity }) => {
    const { syliusClient } = context;

    const taxons = await Promise.all(
      entityIds.map((id) => syliusClient.getTaxonByCode(taxonCodeFromEntityId(id)))
    );

    const entities = taxons
      .filter((t): t is NonNullable<typeof t> => t !== null)
      .map((t) => {
        const childCodes = (t.children ?? [])
          .map((iri) => codeFromTaxonIri(iri))
          .filter((c): c is string => !!c);
        const childIds = childCodes.map(taxonEntityId);

        return $entity({
          id: taxonEntityId(t.code ?? ''),
          base: () => ({
            type: 'link' as const,
            name: t.name ?? '',
            link: categoryLinkReference({ code: t.code, slug: t.slug }),
            ...(childIds.length ? { childIds } : {}),
          }),
        });
      });

    return { entities };
  },
});
