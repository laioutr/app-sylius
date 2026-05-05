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
  };
}
