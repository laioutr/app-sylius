import { ProductBreadcrumbLink } from '@laioutr-core/canonical-types/ecommerce';
import { codeFromTaxonIri, taxonEntityId } from '../../mappers/taxon';
import { defineSyliusLink } from '../../middleware/defineSylius';

export default defineSyliusLink({
  implements: ProductBreadcrumbLink,
  run: async ({ entityIds, context }) => {
    const { syliusClient } = context;
    const productCodes = entityIds.map(String);

    const links = await Promise.all(
      productCodes.map(async (productCode) => {
        const product = await syliusClient.getProductByCode(productCode);
        const mainTaxonIri = (product as { mainTaxon?: string | null }).mainTaxon ?? null;
        const startCode = codeFromTaxonIri(mainTaxonIri);
        if (!startCode) return { sourceId: productCode, targetIds: [] };

        // `/taxon-tree/{code}/path` returns the whole ancestor chain in one
        // call, root → leaf, already in the right order. We drop nodes
        // without a `name` (defends against a translation gap or the
        // unnamed Sylius meta-root if includeRoot=true ever gets flipped).
        const path = await syliusClient.getTaxonPath(startCode);
        const targetIds = path
          .filter((t) => t.code && t.name)
          .map((t) => taxonEntityId(t.code as string));

        return { sourceId: productCode, targetIds };
      })
    );

    return { links };
  },
});
