import { ProductsByCategorySlugQuery } from '@laioutr-core/canonical-types/ecommerce';
import { defineSyliusQuery } from '../../middleware/defineSylius';

const SORTINGS = {
  'name:asc': { field: 'translation.name', dir: 'asc', label: 'Name A-Z' },
  'name:desc': { field: 'translation.name', dir: 'desc', label: 'Name Z-A' },
  'price:asc': { field: 'price', dir: 'asc', label: 'Price low to high' },
  'price:desc': { field: 'price', dir: 'desc', label: 'Price high to low' },
} as const satisfies Record<string, { field: string; dir: 'asc' | 'desc'; label: string }>;

const AVAILABLE_SORTINGS = Object.entries(SORTINGS).map(([key, v]) => ({ key, label: v.label }));

const DEFAULT_SORT_KEY = 'name:asc';

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
        sorting: sorting ?? DEFAULT_SORT_KEY,
      };
    }

    const sortKey = sorting && sorting in SORTINGS ? (sorting as keyof typeof SORTINGS) : DEFAULT_SORT_KEY;
    const { field, dir } = SORTINGS[sortKey];

    const collection = await syliusClient.getProducts({
      page: pagination.page,
      itemsPerPage: pagination.limit,
      taxon: code,
      sort: { field, dir },
    });

    return {
      ids: collection.items.flatMap((p) => (p.code ? [p.code] : [])),
      total: collection.total,
      availableSortings: AVAILABLE_SORTINGS,
      availableFilters: [],
      sorting: sortKey,
    };
  }
);
