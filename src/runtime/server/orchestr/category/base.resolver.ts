import { CategoryBase } from '@laioutr-core/canonical-types/entity/category';
import { defineSyliusComponentResolver } from '../../middleware/defineSylius';

export default defineSyliusComponentResolver({
  entityType: 'Category',
  label: 'Sylius Category Resolver',
  provides: [CategoryBase],
  cache: { ttl: '1 day' },
  resolve: async ({ entityIds, context, $entity }) => {
    const { syliusClient } = context;

    const taxons = await Promise.all(
      entityIds.map((id) => {
        const code = String(id).replace(/^taxon:/, '');
        return syliusClient.getTaxonByCode(code);
      })
    );

    const entities = taxons
      .filter((t): t is NonNullable<typeof t> => t !== null)
      .map((t) =>
        $entity({
          id: `taxon:${(t as { code?: string }).code ?? ''}`,
          base: () => ({
            slug: (t as { slug?: string }).slug ?? '',
            title: (t as { name?: string }).name ?? '',
          }),
        })
      );

    return { entities };
  },
});
