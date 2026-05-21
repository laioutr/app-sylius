import type { createSyliusClient } from '../client';
import type { PassthroughToken } from '@laioutr-core/orchestr/types';
import { optionCachePassthroughToken } from '../const/passthrough-tokens';

type ClientLike = Pick<ReturnType<typeof createSyliusClient>, 'getProductOptions' | 'getProductOptionValues'>;

interface PassthroughLike {
  get: <T>(token: PassthroughToken<T>) => T | undefined;
  set: <T>(token: PassthroughToken<T>, data: T) => void;
}

export interface ResolvedOption {
  name: string;
  value: string;
}

async function loadCache(client: ClientLike): Promise<Map<string, ResolvedOption>> {
  const [optionsRes, valuesRes] = await Promise.all([
    client.getProductOptions(),
    client.getProductOptionValues(),
  ]);
  const optionByIri = new Map<string, string>();
  for (const opt of optionsRes.items) {
    const iri = (opt as { '@id'?: string })['@id'];
    const name = (opt as { name?: string }).name ?? '';
    if (iri) optionByIri.set(iri, name);
  }
  const result = new Map<string, ResolvedOption>();
  for (const ov of valuesRes.items) {
    const iri = (ov as { '@id'?: string })['@id'];
    const value = (ov as { value?: string }).value ?? '';
    const optionIri = (ov as { option?: string }).option ?? '';
    const name = optionByIri.get(optionIri) ?? '';
    if (iri) result.set(iri, { name, value });
  }
  return result;
}

export function createOptionResolver(client: ClientLike, passthrough: PassthroughLike) {
  return {
    async resolve(optionValueIri: string): Promise<ResolvedOption | undefined> {
      let cachePromise = passthrough.get(optionCachePassthroughToken);
      if (!cachePromise) {
        cachePromise = loadCache(client);
        passthrough.set(optionCachePassthroughToken, cachePromise);
      }
      const cache = await cachePromise;
      return cache.get(optionValueIri);
    },
  };
}
