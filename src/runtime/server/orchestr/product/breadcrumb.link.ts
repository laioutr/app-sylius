import { ProductBreadcrumbLink } from '@laioutr-core/canonical-types/ecommerce';
import { codeFromTaxonIri, taxonEntityId } from '../../mappers/taxon';
import { defineSyliusLink } from '../../middleware/defineSylius';

const MAX_BREADCRUMB_DEPTH = 16;

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

        // Walk parents leaf -> root via `taxon-tree/{code}/branch` (the only shop
        // endpoint that exposes the `parent` IRI). Reverse for root -> leaf order.
        // Skip taxons without a `name`: the unnamed Sylius root taxon would
        // otherwise emit an empty BreadcrumbItem with a broken Category reference.
        // We can't filter on `parent === null` alone since the storefront menu
        // root also has `parent: null`. The branch schema does not expose
        // `enabled`, so disabled-taxon filtering is intentionally absent here.
        const chain: string[] = [];
        let nextCode: string | null = startCode;
        let depth = 0;
        while (nextCode && depth < MAX_BREADCRUMB_DEPTH) {
          const taxon = await syliusClient.getTaxonBranch(nextCode);
          if (!taxon) break;
          if (taxon.code && taxon.name) chain.push(taxon.code);
          nextCode = codeFromTaxonIri(taxon.parent);
          depth += 1;
        }

        return {
          sourceId: productCode,
          targetIds: chain.reverse().map(taxonEntityId),
        };
      })
    );

    return { links };
  },
});
