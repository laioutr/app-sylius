import { describe, expect, it } from 'vitest';
import { unwrapHydraCollection } from './hydra';

describe('unwrapHydraCollection', () => {
  it('extracts items and total from a Hydra response', () => {
    const response = {
      '@context': '/api/v2/contexts/Product',
      'hydra:member': [{ code: 'a' }, { code: 'b' }],
      'hydra:totalItems': 87,
      'hydra:view': { '@id': '/api/v2/shop/products?page=1' },
    };
    const result = unwrapHydraCollection(response);
    expect(result.items).toEqual([{ code: 'a' }, { code: 'b' }]);
    expect(result.total).toBe(87);
  });

  it('handles empty collections', () => {
    const result = unwrapHydraCollection({ 'hydra:member': [], 'hydra:totalItems': 0 });
    expect(result.items).toEqual([]);
    expect(result.total).toBe(0);
  });
});
