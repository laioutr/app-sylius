import { type HydraCollection, unwrapHydraCollection } from './hydra';
import type { components } from './sylius-types';

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
  filter?: Record<string, unknown>;
}

export interface SyliusClientOptions {
  apiURL: string;
  locale: string;
  itemsPerPage?: number;
}

const JSON_LD = 'application/ld+json';
const MERGE_PATCH = 'application/merge-patch+json';

function buildListQuery(params: SyliusListParams | undefined, defaultItemsPerPage: number) {
  const q: Record<string, string | number> = {
    page: params?.page ?? 1,
    itemsPerPage: params?.itemsPerPage ?? defaultItemsPerPage,
  };
  if (params?.sort) q[`order[${params.sort.field}]`] = params.sort.dir;
  if (params?.filter) {
    for (const [k, v] of Object.entries(params.filter)) {
      if (v !== undefined && v !== null) q[k] = String(v);
    }
  }
  return q;
}

export function createSyliusClient(opts: SyliusClientOptions) {
  const { apiURL, locale, itemsPerPage = 20 } = opts;
  const headers = { Accept: JSON_LD, 'Accept-Language': locale };

  const get = <T>(path: string, query?: Record<string, unknown>) =>
    $fetch<T>(`${apiURL}${path}`, { headers, query });

  return {
    apiURL,
    locale,

    async getProducts(params?: SyliusListParams): Promise<HydraCollection<Product>> {
      const data = await get<unknown>('/products', buildListQuery(params, itemsPerPage));
      return unwrapHydraCollection<Product>(data);
    },

    async getProductByCode(code: string): Promise<Product> {
      return get<Product>(`/products/${encodeURIComponent(code)}`);
    },

    async getProductBySlug(slug: string): Promise<Product> {
      return get<Product>(`/products-by-slug/${encodeURIComponent(slug)}`);
    },

    async getProductImages(productCode: string): Promise<HydraCollection<ProductImage>> {
      const data = await get<unknown>(`/products/${encodeURIComponent(productCode)}/images`);
      return unwrapHydraCollection<ProductImage>(data);
    },

    async getVariantsByProduct(productIri: string): Promise<HydraCollection<ProductVariant>> {
      const data = await get<unknown>('/product-variants', { product: productIri });
      return unwrapHydraCollection<ProductVariant>(data);
    },

    async getVariantByCode(code: string): Promise<ProductVariant> {
      return get<ProductVariant>(`/product-variants/${encodeURIComponent(code)}`);
    },

    async getVariantsByCodes(codes: string[]): Promise<ProductVariant[]> {
      if (codes.length === 0) return [];
      const data = await get<unknown>('/product-variants', { 'code[]': codes, itemsPerPage: codes.length });
      return unwrapHydraCollection<ProductVariant>(data).items;
    },

    async getProductOptions(): Promise<HydraCollection<ProductOption>> {
      const data = await get<unknown>('/product-options', { itemsPerPage: 100 });
      return unwrapHydraCollection<ProductOption>(data);
    },

    async getProductOptionValues(): Promise<HydraCollection<ProductOptionValue>> {
      const data = await get<unknown>('/product-option-values', { itemsPerPage: 200 });
      return unwrapHydraCollection<ProductOptionValue>(data);
    },

    async createCart(input?: { localeCode?: string }): Promise<Order> {
      return $fetch<Order>(`${apiURL}/orders`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': JSON_LD },
        body: input?.localeCode ? { localeCode: input.localeCode } : {},
      });
    },

    async getCart(tokenValue: string): Promise<Order | null> {
      try {
        return await get<Order>(`/orders/${encodeURIComponent(tokenValue)}`);
      } catch (err) {
        if ((err as { statusCode?: number }).statusCode === 404) return null;
        throw err;
      }
    },

    async addCartItem(
      tokenValue: string,
      body: { productVariant: string; quantity: number }
    ): Promise<Order> {
      return $fetch<Order>(`${apiURL}/orders/${encodeURIComponent(tokenValue)}/items`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': JSON_LD },
        body,
      });
    },

    async changeCartItemQuantity(
      tokenValue: string,
      orderItemId: string | number,
      body: { quantity: number }
    ): Promise<Order> {
      return $fetch<Order>(
        `${apiURL}/orders/${encodeURIComponent(tokenValue)}/items/${orderItemId}`,
        {
          method: 'PATCH',
          headers: { ...headers, 'Content-Type': MERGE_PATCH },
          body,
        }
      );
    },

    async removeCartItem(tokenValue: string, orderItemId: string | number): Promise<Order> {
      return $fetch<Order>(
        `${apiURL}/orders/${encodeURIComponent(tokenValue)}/items/${orderItemId}`,
        { method: 'DELETE', headers }
      );
    },
  };
}
