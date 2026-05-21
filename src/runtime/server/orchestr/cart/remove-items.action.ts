import { CartRemoveItemsAction } from '@laioutr-core/canonical-types/ecommerce';
import { getCartToken } from '../../client/cartTokenCookie';
import { defineSyliusAction } from '../../middleware/defineSylius';

export default defineSyliusAction(CartRemoveItemsAction, async ({ event, context, input }) => {
  const tokenValue = getCartToken(event);
  if (!tokenValue) throw new Error('No cart found.');

  for (const itemId of input) {
    const [, orderItemId] = itemId.split('::');
    if (!orderItemId) continue;
    await context.syliusClient.removeCartItem(tokenValue, orderItemId);
  }
});
