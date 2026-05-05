import { useRuntimeConfig } from '#imports';
import {
  ProductBase,
  ProductDescription,
  ProductFlags,
  ProductInfo,
  ProductMedia,
  ProductPrices,
  ProductSeo,
} from '@laioutr-core/canonical-types/entity/product';
import { deriveApiOrigin, mapSyliusImage } from '../../mappers/media';
import { defineSyliusComponentResolver } from '../../middleware/defineSylius';
import { centsToMoney, getMinMaxPrices } from '../../orchestr-helper/products';

export default defineSyliusComponentResolver({
  entityType: 'Product',
  label: 'Sylius Product Resolver',
  provides: [ProductBase, ProductInfo, ProductMedia, ProductPrices, ProductSeo, ProductDescription, ProductFlags],
  cache: { ttl: '1 day', components: { prices: { ttl: '15 minutes' } } },
  resolve: async ({ entityIds, context, clientEnv, $entity }) => {
    const { syliusClient } = context;
    const { imageFilter = 'sylius_large' } = useRuntimeConfig()['@laioutr-app/sylius'];
    const apiOrigin = deriveApiOrigin(syliusClient.apiURL);

    const products = await Promise.all(
      entityIds.map((code) => syliusClient.getProductByCode(String(code)))
    );

    const entities = products.map((p) => {
      const variants = ((p as any).variants ?? []) as { price?: number; originalPrice?: number }[];
      const prices = getMinMaxPrices(variants);
      const currency = clientEnv.currency ?? 'USD';
      const images = ((p as any).images ?? []) as { id: number; path: string; type: string | null }[];
      const cover = images[0] ? mapSyliusImage(images[0], { apiOrigin, imageFilter }) : undefined;

      return $entity({
        id: (p as any).code!,
        base: () => ({
          name: (p as any).name ?? '',
          slug: (p as any).slug ?? '',
        }),
        info: () => ({
          cover: cover ?? { type: 'image', sources: [], alt: '' },
          shortDescription: (p as any).shortDescription ?? undefined,
        }),
        media: () => ({
          images: images.map((img) => mapSyliusImage(img, { apiOrigin, imageFilter })),
          media: images.map((img) => mapSyliusImage(img, { apiOrigin, imageFilter })),
        }),
        prices: () => ({
          price: centsToMoney(prices.minPrice, currency),
          strikethroughPrice:
            prices.minOriginal > prices.minPrice ? centsToMoney(prices.minOriginal, currency) : undefined,
          isOnSale: prices.minOriginal > prices.minPrice,
          isStartingFrom: prices.minPrice !== prices.maxPrice,
        }),
        seo: () => ({
          title: (p as any).metaKeywords ?? (p as any).name ?? '',
          description: (p as any).metaDescription ?? '',
        }),
        description: () => ({ html: (p as any).description ?? '' }),
        flags: () => [],
      });
    });

    return { entities };
  },
});
