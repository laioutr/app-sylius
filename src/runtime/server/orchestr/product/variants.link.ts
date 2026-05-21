import { ProductVariantsLink } from '@laioutr-core/canonical-types/ecommerce';
import { defineSyliusLink } from '../../middleware/defineSylius';

export default defineSyliusLink({
  implements: ProductVariantsLink,
  run: async ({ entityIds, context }) => {
    const productCodes = entityIds.map(String);
    const productIris = productCodes.map(
      (code) => `/api/v2/shop/products/${encodeURIComponent(code)}`
    );

    const variants = await context.syliusClient.getVariantsByProducts(productIris);

    const variantsByProductCode = new Map<string, string[]>();
    for (const v of variants) {
      const productIri = (v as { product?: string }).product ?? '';
      const productCode = decodeURIComponent(productIri.split('/').pop() ?? '');
      const variantCode = (v as { code?: string }).code;
      if (!productCode || !variantCode) continue;
      const list = variantsByProductCode.get(productCode) ?? [];
      list.push(variantCode);
      variantsByProductCode.set(productCode, list);
    }

    return {
      links: productCodes.map((code) => ({
        sourceId: code,
        targetIds: variantsByProductCode.get(code) ?? [],
      })),
    };
  },
});
