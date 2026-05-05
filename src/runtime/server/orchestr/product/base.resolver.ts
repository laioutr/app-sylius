import { Money } from '@screeny05/ts-money';
import {
  ProductBase,
  ProductDefaultVariant,
  ProductDescription,
  ProductFlags,
  ProductInfo,
  ProductMedia,
  ProductPrices,
  ProductSeo,
} from '@laioutr-core/canonical-types/entity/product';
import { mapSyliusImage } from '../../mappers/media';
import { defineSyliusComponentResolver } from '../../middleware/defineSylius';

export default defineSyliusComponentResolver({
  entityType: 'Product',
  label: 'Sylius Product Resolver',
  provides: [ProductBase, ProductInfo, ProductMedia, ProductPrices, ProductSeo, ProductDescription, ProductFlags, ProductDefaultVariant],
  cache: { ttl: '1 day', components: { prices: { ttl: '15 minutes' } } },
  resolve: async ({ entityIds, context, clientEnv, $entity }) => {
    const { syliusClient } = context;

    const products = await Promise.all(
      entityIds.map((code) => syliusClient.getProductByCode(String(code)))
    );

    const entities = products.map((p) => {
      const { currency } = clientEnv;
      const images = ((p as any).images ?? []) as { id: number; path: string; type: string | null }[];
      const cover = images[0] ? mapSyliusImage(images[0]) : undefined;
      const variants = ((p as any).variants ?? []) as string[];
      const defaultVariant = ((p as any).defaultVariantData ?? {}) as {
        price?: number;
        originalPrice?: number;
      };
      const price = defaultVariant.price ?? 0;
      const originalPrice = defaultVariant.originalPrice ?? price;

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
          images: images.map((img) => mapSyliusImage(img)),
          media: images.map((img) => mapSyliusImage(img)),
        }),
        prices: () => ({
          price: Money.fromInteger(price, currency),
          strikethroughPrice:
            originalPrice > price ? Money.fromInteger(originalPrice, currency) : undefined,
          isOnSale: originalPrice > price,
          isStartingFrom: variants.length > 1,
        }),
        seo: () => ({
          title: (p as any).metaKeywords ?? (p as any).name ?? '',
          description: (p as any).metaDescription ?? '',
        }),
        description: () => ({ html: (p as any).description ?? '' }),
        flags: () => [],
        defaultVariant: () => {
          const iri = (p as any).defaultVariant as string | null | undefined;
          const id = iri ? decodeURIComponent(iri.split('/').pop() ?? '') : undefined;
          const dvData = ((p as any).defaultVariantData ?? {}) as { optionValues?: string[] };
          const options = Array.isArray(dvData.optionValues)
            ? dvData.optionValues.map((ov) => decodeURIComponent(ov.split('/').pop() ?? ''))
            : undefined;
          return { id, options };
        },
      });
    });

    return { entities };
  },
});
