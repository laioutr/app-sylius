import { CartUpdateItemsAction } from '@laioutr-core/canonical-types/ecommerce';
import { getCartToken } from '../../client/cartTokenCookie';
import { defineSyliusAction } from '../../middleware/defineSylius';

export default defineSyliusAction(CartUpdateItemsAction, async ({ event, context, input }) => {
  const tokenValue = getCartToken(event);
  if (!tokenValue) throw new Error('No cart found.');

  for (const it of input) {
    if (it.quantity === undefined) continue;
    const [, orderItemId] = it.itemId.split('::');
    if (!orderItemId) continue;
    await context.syliusClient.changeCartItemQuantity(tokenValue, orderItemId, { quantity: it.quantity });
  }
});
