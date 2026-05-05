import { describe, expect, it } from 'vitest';
import { getMinMaxPrices } from './index';

describe('getMinMaxPrices', () => {
  it('returns min and max prices over variants', () => {
    const variants = [
      { price: 1000, originalPrice: 1500 },
      { price: 2000, originalPrice: 2000 },
      { price: 500, originalPrice: 500 },
    ];
    const result = getMinMaxPrices(variants);
    expect(result).toEqual({ minPrice: 500, maxPrice: 2000, minOriginal: 500, maxOriginal: 2000 });
  });

  it('handles single variant', () => {
    const result = getMinMaxPrices([{ price: 100, originalPrice: 100 }]);
    expect(result).toEqual({ minPrice: 100, maxPrice: 100, minOriginal: 100, maxOriginal: 100 });
  });
});
