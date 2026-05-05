import type { createSyliusClient } from '../client';

type ClientLike = Pick<ReturnType<typeof createSyliusClient>, 'getProductOptions' | 'getProductOptionValues'>;

export interface ResolvedOption {
  name: string;
  value: string;
}

export function createOptionResolver(client: ClientLike) {
  let cachePromise: Promise<Map<string, ResolvedOption>> | null = null;

  async function loadCache(): Promise<Map<string, ResolvedOption>> {
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

  return {
    async resolve(optionValueIri: string): Promise<ResolvedOption | undefined> {
      cachePromise ??= loadCache();
      const cache = await cachePromise;
      return cache.get(optionValueIri);
    },
  };
}
