import { ProductBySlugQuery } from '@laioutr-core/canonical-types/ecommerce';
import { defineSyliusQuery } from '../../middleware/defineSylius';

export default defineSyliusQuery(ProductBySlugQuery, async ({ context, input }) => {
  const product = await context.syliusClient.getProductBySlug(input.slug);
  return { id: (product as { code?: string }).code ?? '' };
});
