import createClient from 'openapi-fetch';
import { type HydraCollection, unwrapHydraCollection } from './hydra';
import type { components, paths } from './sylius-types';

export type Product = components['schemas']['Product.jsonld-sylius.shop.product.show'];
export type ProductVariant = components['schemas']['ProductVariant.jsonld-sylius.shop.product_variant.show'];
export type ProductImage = components['schemas']['ProductImage.jsonld-sylius.shop.product.show'];
export type ProductOption = components['schemas']['ProductOption.jsonld'];
export type ProductOptionValue = components['schemas']['ProductOptionValue.jsonld'];
export type Order = components['schemas']['Order.jsonld-sylius.shop.cart.show'];

export interface SyliusListParams {
  page?: number;
  itemsPerPage?: number;
  sort?: { field: string; dir: 'asc' | 'desc' };
}

export interface SyliusClientOptions {
  apiURL: string;
  locale: string;
  itemsPerPage?: number;
}

const JSON_LD = 'application/ld+json';
const MERGE_PATCH = 'application/merge-patch+json';

function buildSortQuery(
  sort: SyliusListParams['sort'] | undefined
): Record<string, 'asc' | 'desc'> | undefined {
  if (!sort) return undefined;
  return { [`order[${sort.field}]`]: sort.dir };
}

export function createSyliusClient(opts: SyliusClientOptions) {
  const { apiURL, locale, itemsPerPage = 20 } = opts;

  const client = createClient<paths>({
    baseUrl: new URL(apiURL).origin,
    headers: { Accept: JSON_LD, 'Accept-Language': locale },
  });

  return {
    apiURL,
    locale,

    async getProducts(params?: SyliusListParams): Promise<HydraCollection<Product>> {
      const { data, response } = await client.GET('/api/v2/shop/products', {
        params: {
          query: {
            page: params?.page ?? 1,
            itemsPerPage: params?.itemsPerPage ?? itemsPerPage,
            ...(buildSortQuery(params?.sort) as Record<string, 'asc' | 'desc'>),
          },
        },
      });
      if (!data) throw new Error(`getProducts failed: ${response.status}`);
      return unwrapHydraCollection<Product>(data);
    },

    async getProductByCode(code: string): Promise<Product> {
      const { data, response } = await client.GET('/api/v2/shop/products/{code}', {
        params: { path: { code } },
      });
      if (!data) throw new Error(`getProductByCode(${code}) failed: ${response.status}`);
      return data as Product;
    },

    async getProductBySlug(slug: string): Promise<Product> {
      const { data, response } = await client.GET('/api/v2/shop/products-by-slug/{slug}', {
        params: { path: { slug } },
      });
      if (!data) throw new Error(`getProductBySlug(${slug}) failed: ${response.status}`);
      return data as Product;
    },

    async getProductImages(productCode: string): Promise<HydraCollection<ProductImage>> {
      const { data, response } = await client.GET('/api/v2/shop/products/{code}/images', {
        params: { path: { code: productCode } },
      });
      if (!data) throw new Error(`getProductImages(${productCode}) failed: ${response.status}`);
      return unwrapHydraCollection<ProductImage>(data);
    },

    async getVariantsByProduct(productIri: string): Promise<HydraCollection<ProductVariant>> {
      const { data, response } = await client.GET('/api/v2/shop/product-variants', {
        params: { query: { product: productIri } },
      });
      if (!data) throw new Error(`getVariantsByProduct failed: ${response.status}`);
      return unwrapHydraCollection<ProductVariant>(data);
    },

    async getVariantsByProducts(productIris: string[]): Promise<ProductVariant[]> {
      if (productIris.length === 0) return [];
      const { data, response } = await client.GET('/api/v2/shop/product-variants', {
        params: { query: { 'product[]': productIris, itemsPerPage: 100 } },
      });
      if (!data) throw new Error(`getVariantsByProducts failed: ${response.status}`);
      return unwrapHydraCollection<ProductVariant>(data).items;
    },

    async getVariantByCode(code: string): Promise<ProductVariant> {
      const { data, response } = await client.GET('/api/v2/shop/product-variants/{code}', {
        params: { path: { code } },
      });
      if (!data) throw new Error(`getVariantByCode(${code}) failed: ${response.status}`);
      return data as ProductVariant;
    },

    async getVariantsByCodes(codes: string[]): Promise<ProductVariant[]> {
      if (codes.length === 0) return [];
      const { data, response } = await client.GET('/api/v2/shop/product-variants', {
        params: { query: { 'code[]': codes, itemsPerPage: codes.length } },
      });
      if (!data) throw new Error(`getVariantsByCodes failed: ${response.status}`);
      return unwrapHydraCollection<ProductVariant>(data).items;
    },

    async getProductOptions(): Promise<HydraCollection<ProductOption>> {
      const { data, response } = await client.GET('/api/v2/shop/product-options', {
        params: { query: { itemsPerPage: 100 } },
      });
      if (!data) throw new Error(`getProductOptions failed: ${response.status}`);
      return unwrapHydraCollection<ProductOption>(data);
    },

    async getProductOptionValues(): Promise<HydraCollection<ProductOptionValue>> {
      const { data, response } = await client.GET('/api/v2/shop/product-option-values', {
        params: { query: { itemsPerPage: 200 } },
      });
      if (!data) throw new Error(`getProductOptionValues failed: ${response.status}`);
      return unwrapHydraCollection<ProductOptionValue>(data);
    },

    async createCart(input?: { localeCode?: string }): Promise<Order> {
      const { data, response } = await client.POST('/api/v2/shop/orders', {
        headers: { 'Content-Type': JSON_LD },
        body: (input?.localeCode ? { localeCode: input.localeCode } : {}) as never,
      });
      if (!data) throw new Error(`createCart failed: ${response.status}`);
      return data as Order;
    },

    async getCart(tokenValue: string): Promise<Order | null> {
      const { data, response } = await client.GET('/api/v2/shop/orders/{tokenValue}', {
        params: { path: { tokenValue } },
      });
      if (response.status === 404) return null;
      if (!data) throw new Error(`getCart failed: ${response.status}`);
      return data as Order;
    },

    async addCartItem(
      tokenValue: string,
      body: { productVariant: string; quantity: number }
    ): Promise<Order> {
      const { data, response } = await client.POST('/api/v2/shop/orders/{tokenValue}/items', {
        params: { path: { tokenValue } },
        headers: { 'Content-Type': JSON_LD },
        body: body as never,
      });
      if (!data) throw new Error(`addCartItem failed: ${response.status}`);
      return data as Order;
    },

    async changeCartItemQuantity(
      tokenValue: string,
      orderItemId: string | number,
      body: { quantity: number }
    ): Promise<Order> {
      const { data, response } = await client.PATCH(
        '/api/v2/shop/orders/{tokenValue}/items/{orderItemId}',
        {
          params: { path: { tokenValue, orderItemId: String(orderItemId) } },
          headers: { 'Content-Type': MERGE_PATCH },
          body: body as never,
        }
      );
      if (!data) throw new Error(`changeCartItemQuantity failed: ${response.status}`);
      return data as Order;
    },

    async removeCartItem(tokenValue: string, orderItemId: string | number): Promise<Order> {
      const { data, response } = await client.DELETE(
        '/api/v2/shop/orders/{tokenValue}/items/{orderItemId}',
        { params: { path: { tokenValue, orderItemId: String(orderItemId) } } }
      );
      if (response.status === 204) return {} as Order;
      if (!data) throw new Error(`removeCartItem failed: ${response.status}`);
      return data as Order;
    },
  };
}
