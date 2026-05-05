import createClient from 'openapi-fetch';
import { type HydraCollection, unwrapHydraCollection } from './hydra';
import type { components, paths } from './sylius-types';

export type Product = components['schemas']['Product.jsonld-sylius.shop.product.show'];
export type ProductVariant = components['schemas']['ProductVariant.jsonld-sylius.shop.product_variant.show'];
export type ProductImage = components['schemas']['ProductImage.jsonld-sylius.shop.product.show'];
export type ProductOption = components['schemas']['ProductOption.jsonld'];
export type ProductOptionValue = components['schemas']['ProductOptionValue.jsonld'];
export type Order = components['schemas']['Order.jsonld-sylius.shop.cart.show'];
export type Taxon = components['schemas']['Taxon.jsonld-sylius.shop.taxon.show'];
export type TaxonPathNode = components['schemas']['Taxon.jsonld-sylius.shop.taxon_tree.path'];

export interface SyliusListParams {
  page?: number;
  itemsPerPage?: number;
  sort?: { field: string; dir: 'asc' | 'desc' };
  /** Filter products to a single taxon by Sylius taxon code. */
  taxon?: string;
}

export interface SyliusClientOptions {
  apiURL: string;
  locale: string;
  itemsPerPage?: number;
  /**
   * LiipImagine filter Sylius applies server-side before returning image URLs.
   * Sent on every product/variant fetch so `image.path` comes back as a
   * ready-to-use absolute URL.
   */
  imageFilter?: SyliusImageFilter;
}

type SyliusImageFilter = NonNullable<
  paths['/api/v2/shop/products']['get']['parameters']['query']
>['imageFilter'];

const JSON_LD = 'application/ld+json';
const MERGE_PATCH = 'application/merge-patch+json';

function buildSortQuery(
  sort: SyliusListParams['sort'] | undefined
): Record<string, 'asc' | 'desc'> | undefined {
  if (!sort) return undefined;
  return { [`order[${sort.field}]`]: sort.dir };
}

export function createSyliusClient(opts: SyliusClientOptions) {
  const { apiURL, locale, itemsPerPage = 20, imageFilter } = opts;

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
            ...(imageFilter ? { imageFilter } : {}),
            // Sylius's `taxon` filter expects an IRI, not a code, despite
            // the openapi-typescript output typing it as plain `string`. The
            // filter is recursive: filtering by a parent IRI returns products
            // assigned to that taxon and any of its descendants.
            ...(params?.taxon
              ? { taxon: `/api/v2/shop/taxons/${encodeURIComponent(params.taxon)}` }
              : {}),
            ...(buildSortQuery(params?.sort) as Record<string, 'asc' | 'desc'>),
          },
        },
      });
      if (!data) throw new Error(`getProducts failed: ${response.status}`);
      return unwrapHydraCollection<Product>(data);
    },

    async getProductByCode(code: string): Promise<Product> {
      const { data, response } = await client.GET('/api/v2/shop/products/{code}', {
        params: { path: { code }, query: imageFilter ? { imageFilter } : undefined },
      });
      if (!data) throw new Error(`getProductByCode(${code}) failed: ${response.status}`);
      return data as Product;
    },

    async getProductBySlug(slug: string): Promise<Product> {
      const { data, response } = await client.GET('/api/v2/shop/products-by-slug/{slug}', {
        params: { path: { slug }, query: imageFilter ? { imageFilter } : undefined },
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

    async getTaxonBySlug(slug: string): Promise<Taxon | null> {
      const { data, response } = await client.GET('/api/v2/shop/taxons-by-slug/{slug}', {
        params: { path: { slug } },
      });
      if (response.status === 404) return null;
      if (!data) throw new Error(`getTaxonBySlug(${slug}) failed: ${response.status}`);
      return data as Taxon;
    },

    async getTaxonByCode(code: string): Promise<Taxon | null> {
      const { data, response } = await client.GET('/api/v2/shop/taxons/{code}', {
        params: { path: { code } },
      });
      if (response.status === 404) return null;
      if (!data) throw new Error(`getTaxonByCode(${code}) failed: ${response.status}`);
      return data as Taxon;
    },

    /**
     * Fetches the full ancestor chain for a taxon as an array, root → leaf,
     * excluding the storefront menu root (MENU_CATEGORY) by default. Sylius
     * exposes this as `/taxon-tree/{code}/path` and the response is a hydra
     * collection — the openapi-typescript output mistypes it as a single taxon.
     * Use this for breadcrumb construction; one HTTP call gives you the whole
     * chain instead of walking parents one at a time.
     */
    async getTaxonPath(code: string): Promise<TaxonPathNode[]> {
      const url = new URL(`taxon-tree/${encodeURIComponent(code)}/path`, apiURL.endsWith('/') ? apiURL : `${apiURL}/`).toString();
      const res = await fetch(url, {
        headers: { Accept: JSON_LD, 'Accept-Language': locale },
      });
      if (res.status === 404) return [];
      if (!res.ok) throw new Error(`getTaxonPath(${code}) failed: ${res.status}`);
      const body = (await res.json()) as unknown;
      return unwrapHydraCollection<TaxonPathNode>(body).items;
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
