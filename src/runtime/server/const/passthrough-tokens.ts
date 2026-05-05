import type { ResolvedOption } from '../orchestr-helper/option-resolver';
import type { PassthroughToken } from '@laioutr-core/orchestr/types';

/**
 * Per-request cache of option-value IRI → {name, value}.
 * Stores a promise so concurrent resolvers in the same request share one
 * fetch of /product-options + /product-option-values.
 *
 * Inlined as an object literal rather than via createPassthroughToken
 * because that helper is only exported through Nuxt's #imports alias,
 * which Vitest does not resolve in unit tests.
 */
export const optionCachePassthroughToken = {
  token: '@laioutr-app/sylius/optionCache',
} as PassthroughToken<Promise<Map<string, ResolvedOption>>>;
