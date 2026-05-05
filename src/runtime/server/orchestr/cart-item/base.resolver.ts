import { CartItemBase, CartItemCost } from '@laioutr-core/canonical-types/entity/cart-item';
import { defineSyliusComponentResolver } from '../../middleware/defineSylius';
import { centsToMoney } from '../../orchestr-helper/products';

interface CartItemRef {
  cartToken: string;
  orderItemId: string;
}

function decodeId(id: string): CartItemRef | null {
  const [cartToken, orderItemId] = id.split('::');
  if (!cartToken || !orderItemId) return null;
  return { cartToken, orderItemId };
}

export default defineSyliusComponentResolver({
  entityType: 'CartItem',
  label: 'Sylius Cart Item Resolver',
  provides: [CartItemBase, CartItemCost],
  resolve: async ({ entityIds, context, $entity }) => {
    const { syliusClient } = context;
    const refs = entityIds.map((id) => decodeId(String(id))).filter((r): r is CartItemRef => !!r);
    const cartTokens = [...new Set(refs.map((r) => r.cartToken))];

    const cartsByToken = new Map<string, any>();
    await Promise.all(
      cartTokens.map(async (token) => {
        const cart = await syliusClient.getCart(token);
        if (cart) cartsByToken.set(token, cart);
      })
    );

    const entities = refs.flatMap((ref) => {
      const cart = cartsByToken.get(ref.cartToken);
      if (!cart) return [];
      const item = (cart.items ?? []).find((it: any) => String(it.id) === ref.orderItemId);
      if (!item) return [];
      const currency = cart.currencyCode ?? 'USD';
      const id = `${ref.cartToken}::${ref.orderItemId}`;

      return [
        $entity({
          id,
          base: () => ({
            type: 'product' as const,
            quantity: item.quantity ?? 0,
            title: item.productName ?? '',
            subtitle: item.variantName ?? undefined,
            code: item.variant ?? undefined, // variant IRI as code; refine post-MVP
          }),
          cost: () => ({
            single: centsToMoney(item.unitPrice ?? 0, currency),
            subtotal: centsToMoney(item.subtotal ?? item.total ?? 0, currency),
            total: centsToMoney(item.total ?? 0, currency),
          }),
        }),
      ];
    });

    return { entities };
  },
});
