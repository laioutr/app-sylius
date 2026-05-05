import { Money } from '@screeny05/ts-money';
import { CartBase, CartCost } from '@laioutr-core/canonical-types/entity/cart';
import { defineSyliusComponentResolver } from '../../middleware/defineSylius';

export default defineSyliusComponentResolver({
  entityType: 'Cart',
  label: 'Sylius Cart Resolver',
  provides: [CartBase, CartCost],
  resolve: async ({ entityIds, context, $entity }) => {
    const { syliusClient } = context;
    const carts = await Promise.all(
      entityIds.map(async (tokenValue) => {
        const cart = await syliusClient.getCart(String(tokenValue));
        return { tokenValue: String(tokenValue), cart };
      })
    );

    const entities = carts.flatMap(({ tokenValue, cart }) => {
      if (!cart) return [];
      const currency = (cart as any).currencyCode as string;
      const items = ((cart as any).items ?? []) as { quantity: number }[];
      return [
        $entity({
          id: tokenValue,
          base: () => ({
            totalQuantity: items.reduce((sum, it) => sum + (it.quantity ?? 0), 0),
          }),
          cost: () => ({
            subtotal: Money.fromInteger((cart as any).itemsTotal ?? 0, currency),
            subtotalIsEstimated: false,
            total: Money.fromInteger((cart as any).total ?? 0, currency),
            totalIsEstimated: false,
            tax:
              (cart as any).taxTotal > 0
                ? {
                    total: Money.fromInteger((cart as any).taxTotal, currency),
                    isEstimated: false,
                    isIncluded: ((cart as any).taxIncludedTotal ?? 0) > 0,
                  }
                : undefined,
          }),
        }),
      ];
    });

    return { entities };
  },
});
