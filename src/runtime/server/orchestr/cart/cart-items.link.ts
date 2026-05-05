import { CartItemsLink } from '@laioutr-core/canonical-types/ecommerce';
import { defineSyliusLink } from '../../middleware/defineSylius';

export default defineSyliusLink(CartItemsLink, async ({ entityIds, context }) => {
  const links = await Promise.all(
    entityIds.map(async (tokenValue) => {
      const cart = await context.syliusClient.getCart(String(tokenValue));
      const items = ((cart as any)?.items ?? []) as { id: number | string }[];
      return {
        sourceId: String(tokenValue),
        targetIds: items.map((it) => `${String(tokenValue)}::${it.id}`),
      };
    })
  );
  return { links };
});
