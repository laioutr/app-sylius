import { CartAddItemsAction } from '@laioutr-core/canonical-types/ecommerce';
import { defineSyliusAction } from '../../middleware/defineSylius';
import { assertCartExists, variantIri } from '../../orchestr-helper/cart';

export default defineSyliusAction(CartAddItemsAction, async ({ event, context, input }) => {
  const products = input.filter((it) => it.type === 'product');
  if (products.length === 0) return;

  const { tokenValue } = await assertCartExists(event, context.syliusClient);

  for (const product of products) {
    await context.syliusClient.addCartItem(tokenValue, {
      productVariant: variantIri(product.variantId),
      quantity: product.quantity,
    });
  }
});
