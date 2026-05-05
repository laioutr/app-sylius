import { GetCurrentCartQuery } from '@laioutr-core/canonical-types/ecommerce';
import { clearCartToken, getCartToken } from '../../client/cartTokenCookie';
import { defineSyliusQuery } from '../../middleware/defineSylius';

export default defineSyliusQuery(GetCurrentCartQuery, async ({ event, context }) => {
  const tokenValue = getCartToken(event);
  if (!tokenValue) return { id: undefined };

  const cart = await context.syliusClient.getCart(tokenValue);
  if (!cart) {
    clearCartToken(event);
    return { id: undefined };
  }
  return { id: tokenValue };
});
