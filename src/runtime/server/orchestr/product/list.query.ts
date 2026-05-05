import { z } from 'zod/v4';
import { defineQueryToken } from '@laioutr-core/core-types/orchestr';
import { defineSyliusQuery } from '../../middleware/defineSylius';

export const ProductListQuery = defineQueryToken('@laioutr-app/sylius/product/list', {
  entity: 'Product',
  type: 'multi',
  label: 'Product list (paginated)',
  input: z.object({
    page: z.number().optional(),
    itemsPerPage: z.number().optional(),
    sort: z
      .object({
        field: z.enum(['name', 'createdAt', 'updatedAt']),
        dir: z.enum(['asc', 'desc']),
      })
      .optional(),
  }),
  defaultLimit: 20,
});

export default defineSyliusQuery(ProductListQuery, async ({ context, input }) => {
  const result = await context.syliusClient.getProducts({
    page: input.page,
    itemsPerPage: input.itemsPerPage,
    sort: input.sort,
  });
  return {
    ids: result.items.map((p) => (p as { code?: string }).code ?? '').filter(Boolean),
    total: result.total,
  };
});
