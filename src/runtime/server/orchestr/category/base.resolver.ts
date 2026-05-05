import { CategoryBase } from '@laioutr-core/canonical-types/entity/category';
import { taxonCodeFromEntityId, taxonEntityId } from '../../mappers/taxon';
import { defineSyliusComponentResolver } from '../../middleware/defineSylius';

export default defineSyliusComponentResolver({
  entityType: 'Category',
  label: 'Sylius Category Resolver',
  provides: [CategoryBase],
  cache: { ttl: '1 day' },
  resolve: async ({ entityIds, context, $entity }) => {
    const { syliusClient } = context;

    const taxons = await Promise.all(
      entityIds.map((id) => syliusClient.getTaxonByCode(taxonCodeFromEntityId(id)))
    );

    const entities = taxons
      .filter((t): t is NonNullable<typeof t> => t !== null)
      .map((t) =>
        $entity({
          id: taxonEntityId(t.code ?? ''),
          base: () => ({
            slug: t.slug ?? '',
            title: t.name ?? '',
          }),
        })
      );

    return { entities };
  },
});
