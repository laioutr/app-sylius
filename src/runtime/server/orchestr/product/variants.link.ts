import { ProductVariantsLink } from '@laioutr-core/canonical-types/ecommerce';
import { defineSyliusLink } from '../../middleware/defineSylius';

export default defineSyliusLink({
  implements: ProductVariantsLink,
  run: async ({ entityIds, context }) => {
    const links = await Promise.all(
      entityIds.map(async (code) => {
        const productCode = String(code);
        const productIri = `/api/v2/shop/products/${encodeURIComponent(productCode)}`;
        const variants = await context.syliusClient.getVariantsByProduct(productIri);
        return {
          sourceId: productCode,
          targetIds: variants.items.map((v) => (v as { code?: string }).code ?? '').filter(Boolean),
        };
      })
    );
    return { links };
  },
});
