import { createResolver, defineNuxtModule, installModule } from '@nuxt/kit';
import { defu } from 'defu';
import { registerLaioutrApp } from '@laioutr-core/kit';
import { name, version } from '../package.json';

/**
 * The options the module adds to the nuxt.config.ts.
 */
export interface ModuleOptions {
  /** Sylius Shop API base URL. Example: "http://localhost/api/v2/shop" */
  apiURL: string;
  /** Fallback Accept-Language header. Default: "en_US" */
  defaultLocale?: string;
  /** LiipImagine filter for image URLs. Default: "sylius_large" */
  imageFilter?: string;
  /** Pagination default for list queries. Default: 20 */
  itemsPerPage?: number;
}

export default defineNuxtModule<ModuleOptions>({
  meta: {
    name,
    version,
    configKey: name, // configKey must match package name
  },
  // Default configuration options of the Nuxt module
  defaults: {
    apiURL: 'http://localhost/api/v2/shop',
    defaultLocale: 'en_US',
    imageFilter: 'sylius_large',
    itemsPerPage: 20,
  } as ModuleOptions,
  async setup(_options, nuxt) {
    const { resolve } = createResolver(import.meta.url);
    const resolveRuntimeModule = (path: string) => resolve('./runtime', path);

    nuxt.options.build.transpile.push(resolve('./runtime'));

    // Make app-assets publicly available (logo etc., served from /app-sylius/...)
    nuxt.options.nitro ??= {};
    nuxt.options.nitro.publicAssets ??= [];
    nuxt.options.nitro.publicAssets.push({
      dir: resolveRuntimeModule('./app/public'),
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    // Runtime configuration for this module
    // These two statements can be removed if you don't provide a runtime config
    nuxt.options.runtimeConfig[name] = defu(nuxt.options.runtimeConfig[name] as Parameters<typeof defu>[0], _options);
    nuxt.options.runtimeConfig.public[name] = defu(nuxt.options.runtimeConfig.public[name] as Parameters<typeof defu>[0], _options);

    await registerLaioutrApp({
      name,
      version,
      orchestrDirs: [resolveRuntimeModule('server/orchestr')],
      sections: [resolveRuntimeModule('app/sections')],
      blocks: [resolveRuntimeModule('app/blocks')],
    });

    // Install peer-dependency modules only on prepare-step.
    // This makes auto-imports and import-aliases work. Remove any modules you might not need.
    if (nuxt.options._prepare) {
      await installModule('@nuxt/image');
      await installModule('@laioutr-core/frontend-core');
      await installModule('@laioutr-core/orchestr');
      await installModule('@laioutr-app/ui');
    }

    // Shared
    // Imports and other stuff which is shared between client and server

    // Client
    // Add plugins, composables, etc.

    // Server
    // Add server-only imports, etc.
  },
});
