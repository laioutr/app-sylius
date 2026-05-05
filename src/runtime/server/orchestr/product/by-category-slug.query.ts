import { ProductsByCategorySlugQuery } from '@laioutr-core/canonical-types/ecommerce';
import { defineSyliusQuery } from '../../middleware/defineSylius';

const SORT_MAP: Record<string, { field: string; dir: 'asc' | 'desc' }> = {
  'name:asc': { field: 'translation.name', dir: 'asc' },
  'name:desc': { field: 'translation.name', dir: 'desc' },
  'price:asc': { field: 'price', dir: 'asc' },
  'price:desc': { field: 'price', dir: 'desc' },
};

const AVAILABLE_SORTINGS = [
  { key: 'name:asc', label: 'Name A-Z' },
  { key: 'name:desc', label: 'Name Z-A' },
  { key: 'price:asc', label: 'Price low to high' },
  { key: 'price:desc', label: 'Price high to low' },
];

const DEFAULT_SORT_ID = 'name:asc';

export default defineSyliusQuery(
  ProductsByCategorySlugQuery,
  async ({ context, input, pagination, sorting }) => {
    const { syliusClient } = context;

    const taxon = await syliusClient.getTaxonBySlug(input.categorySlug);
    const code = taxon?.code;
    if (!code) {
      return {
        ids: [],
        total: 0,
        availableSortings: AVAILABLE_SORTINGS,
        availableFilters: [],
        sorting: sorting ?? DEFAULT_SORT_ID,
      };
    }

    const sortId = sorting && SORT_MAP[sorting] ? sorting : DEFAULT_SORT_ID;
    const sort = SORT_MAP[sortId];

    const collection = await syliusClient.getProducts({
      page: pagination.page,
      itemsPerPage: pagination.limit,
      taxon: code,
      sort,
    });

    return {
      ids: collection.items.map((p) => p.code ?? '').filter(Boolean),
      total: collection.total,
      availableSortings: AVAILABLE_SORTINGS,
      availableFilters: [],
      sorting: sortId,
    };
  }
);
