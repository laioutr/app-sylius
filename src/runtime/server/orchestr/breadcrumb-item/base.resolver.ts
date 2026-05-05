import { BreadcrumbItemBase } from '@laioutr-core/canonical-types/entity/breadcrumb-item';
import { categoryLinkReference, taxonCodeFromEntityId, taxonEntityId } from '../../mappers/taxon';
import { defineSyliusComponentResolver } from '../../middleware/defineSylius';

export default defineSyliusComponentResolver({
  entityType: 'BreadcrumbItem',
  label: 'Sylius Breadcrumb Item Resolver',
  provides: [BreadcrumbItemBase],
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
            name: t.name ?? '',
            link: categoryLinkReference({ code: t.code, slug: t.slug }),
          }),
        })
      );

    return { entities };
  },
});
