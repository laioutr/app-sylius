import type { ResolvedOption } from '../option-resolver';

export interface VariantAvailabilityInput {
  inStock: boolean | null | undefined;
}

export function computeAvailability(v: VariantAvailabilityInput) {
  return {
    status: v.inStock ? ('inStock' as const) : ('outOfStock' as const),
    quantity: 100, // Sylius shop does not expose stock count
  };
}

export async function mapVariantOptions(
  optionValueIris: string[],
  resolver: { resolve: (iri: string) => Promise<ResolvedOption | undefined> }
): Promise<{ name: string; value: string }[]> {
  const resolved = await Promise.all(optionValueIris.map((iri) => resolver.resolve(iri)));
  return resolved.filter((r): r is ResolvedOption => !!r);
}
