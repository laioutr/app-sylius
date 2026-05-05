import { describe, expect, it, vi } from 'vitest';
import { createOptionResolver } from './option-resolver';

describe('createOptionResolver', () => {
  it('resolves option-value IRI to {name, value} via memoized fetch', async () => {
    const client = {
      getProductOptions: vi.fn().mockResolvedValue({
        items: [
          { '@id': '/api/v2/shop/product-options/size', code: 'size', name: 'Size', values: [] },
        ],
        total: 1,
      }),
      getProductOptionValues: vi.fn().mockResolvedValue({
        items: [
          {
            '@id': '/api/v2/shop/product-options/size/values/s',
            code: 's',
            value: 'S',
            option: '/api/v2/shop/product-options/size',
          },
        ],
        total: 1,
      }),
    } as never;

    const resolver = createOptionResolver(client);

    const a = await resolver.resolve('/api/v2/shop/product-options/size/values/s');
    expect(a).toEqual({ name: 'Size', value: 'S' });

    // second call: must not re-fetch
    const b = await resolver.resolve('/api/v2/shop/product-options/size/values/s');
    expect(b).toEqual({ name: 'Size', value: 'S' });
    expect((client as any).getProductOptions).toHaveBeenCalledTimes(1);
    expect((client as any).getProductOptionValues).toHaveBeenCalledTimes(1);
  });

  it('returns undefined for unknown IRI', async () => {
    const client = {
      getProductOptions: vi.fn().mockResolvedValue({ items: [], total: 0 }),
      getProductOptionValues: vi.fn().mockResolvedValue({ items: [], total: 0 }),
    } as never;
    const resolver = createOptionResolver(client);
    const result = await resolver.resolve('/api/v2/shop/product-options/x/values/y');
    expect(result).toBeUndefined();
  });
});
