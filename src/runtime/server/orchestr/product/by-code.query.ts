import { z } from 'zod/v4';
import { defineQueryToken } from '@laioutr-core/core-types/orchestr';
import { defineSyliusQuery } from '../../middleware/defineSylius';

export const ProductByCodeQuery = defineQueryToken('@laioutr-app/sylius/product/by-code', {
  entity: 'Product',
  type: 'single',
  label: 'Product by Sylius code',
  input: z.object({ code: z.string() }),
});

export default defineSyliusQuery(ProductByCodeQuery, async ({ context, input }) => {
  const product = await context.syliusClient.getProductByCode(input.code);
  return { id: (product as { code?: string }).code ?? '' };
});
