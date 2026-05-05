import { describe, expect, it, vi } from 'vitest';
import { createOptionResolver } from './option-resolver';

function createPassthroughMock() {
  const store = new Map<string, unknown>();
  return {
    get: <T>(token: { token: string }) => store.get(token.token) as T | undefined,
    set: <T>(token: { token: string }, data: T) => {
      store.set(token.token, data);
    },
  };
}

describe('createOptionResolver', () => {
  it('resolves option-value IRI to {name, value} via passthrough-cached fetch', async () => {
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
    const passthrough = createPassthroughMock();

    const resolver = createOptionResolver(client, passthrough);

    const a = await resolver.resolve('/api/v2/shop/product-options/size/values/s');
    expect(a).toEqual({ name: 'Size', value: 'S' });

    // second call: must not re-fetch (cached in passthrough)
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
    const resolver = createOptionResolver(client, createPassthroughMock());
    const result = await resolver.resolve('/api/v2/shop/product-options/x/values/y');
    expect(result).toBeUndefined();
  });

  it('shares the cache across two resolver instances backed by the same passthrough', async () => {
    const client = {
      getProductOptions: vi.fn().mockResolvedValue({
        items: [{ '@id': '/o/size', code: 'size', name: 'Size', values: [] }],
        total: 1,
      }),
      getProductOptionValues: vi.fn().mockResolvedValue({
        items: [{ '@id': '/ov/s', code: 's', value: 'S', option: '/o/size' }],
        total: 1,
      }),
    } as never;
    const passthrough = createPassthroughMock();

    const resolver1 = createOptionResolver(client, passthrough);
    const resolver2 = createOptionResolver(client, passthrough);

    await resolver1.resolve('/ov/s');
    await resolver2.resolve('/ov/s');

    expect((client as any).getProductOptions).toHaveBeenCalledTimes(1);
    expect((client as any).getProductOptionValues).toHaveBeenCalledTimes(1);
  });
});
