export interface HydraCollection<T> {
  items: T[];
  total: number;
}

interface RawHydraCollection {
  'hydra:member': unknown[];
  'hydra:totalItems'?: number;
}

export function unwrapHydraCollection<T>(response: unknown): HydraCollection<T> {
  const raw = response as RawHydraCollection;
  return {
    items: (raw['hydra:member'] ?? []) as T[],
    total: raw['hydra:totalItems'] ?? 0,
  };
}
