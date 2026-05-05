import { Money } from '@screeny05/ts-money';

export function centsToMoney(cents: number, currency: string) {
  return Money.fromInteger(cents, currency);
}

export interface VariantPriceInput {
  price?: number | null;
  originalPrice?: number | null;
}

export function getMinMaxPrices(variants: VariantPriceInput[]) {
  const prices = variants.map((v) => v.price ?? 0);
  const originals = variants.map((v) => v.originalPrice ?? v.price ?? 0);
  return {
    minPrice: Math.min(...prices),
    maxPrice: Math.max(...prices),
    minOriginal: Math.min(...originals),
    maxOriginal: Math.max(...originals),
  };
}
