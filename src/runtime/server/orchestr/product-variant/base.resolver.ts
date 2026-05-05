import { Money } from '@screeny05/ts-money';
import {
  ProductVariantAvailability,
  ProductVariantBase,
  ProductVariantInfo,
  ProductVariantOptions,
  ProductVariantPrices,
} from '@laioutr-core/canonical-types/entity/product-variant';
import { defineSyliusComponentResolver } from '../../middleware/defineSylius';
import { createOptionResolver } from '../../orchestr-helper/option-resolver';
import { computeAvailability, mapVariantOptions } from '../../orchestr-helper/product-variants';

export default defineSyliusComponentResolver({
  entityType: 'ProductVariant',
  label: 'Sylius Product Variant Resolver',
  provides: [
    ProductVariantBase,
    ProductVariantInfo,
    ProductVariantPrices,
    ProductVariantOptions,
    ProductVariantAvailability,
  ],
  cache: {
    ttl: '1 day',
    components: {
      prices: { ttl: '10 minutes' },
      availability: { enabled: false },
    },
  },
  resolve: async ({ entityIds, context, clientEnv, $entity }) => {
    const { syliusClient } = context;
    const variants = await syliusClient.getVariantsByCodes(entityIds.map(String));
    const optionResolver = createOptionResolver(syliusClient);
    const { currency } = clientEnv;

    const entities = await Promise.all(
      variants.map(async (v) => {
        const optionValues = ((v as any).optionValues ?? []) as string[];
        const selected = await mapVariantOptions(optionValues, optionResolver);
        return $entity({
          id: (v as any).code!,
          base: () => ({
            sku: (v as any).code ?? '',
            name: (v as any).name ?? '',
          }),
          info: () => ({}),
          prices: () => {
            const price = (v as any).price ?? 0;
            const original = (v as any).originalPrice ?? price;
            const lowestPrior = (v as any).lowestPriceBeforeDiscount;
            return {
              price: Money.fromInteger(price, currency),
              strikethroughPrice: original > price ? Money.fromInteger(original, currency) : undefined,
              isOnSale: original > price,
              lowestPriorPrice:
                typeof lowestPrior === 'number' ? Money.fromInteger(lowestPrior, currency) : undefined,
            };
          },
          options: () => ({ selected }),
          availability: () => computeAvailability({ inStock: (v as any).inStock }),
        });
      })
    );

    return { entities };
  },
});
