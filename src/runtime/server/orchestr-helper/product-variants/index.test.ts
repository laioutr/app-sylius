import { describe, expect, it } from 'vitest';
import { computeAvailability } from './index';

describe('computeAvailability', () => {
  it('returns inStock when inStock=true', () => {
    expect(computeAvailability({ inStock: true })).toEqual({ status: 'inStock', quantity: 100 });
  });
  it('returns outOfStock when inStock=false', () => {
    expect(computeAvailability({ inStock: false })).toEqual({ status: 'outOfStock', quantity: 100 });
  });
});
