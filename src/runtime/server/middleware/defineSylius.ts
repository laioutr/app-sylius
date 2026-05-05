import { defineOrchestr, useRuntimeConfig } from '#imports';
import { name } from '../../../../package.json';
import { createSyliusClient } from '../client';

export const defineSylius = defineOrchestr
  .meta({
    app: name,
    label: 'Sylius',
  })
  .extendRequest(async ({ clientEnv }) => {
    const config = useRuntimeConfig()['@laioutr-app/sylius'];
    const syliusClient = createSyliusClient({
      apiURL: config.apiURL,
      locale: clientEnv?.locale ?? config.defaultLocale ?? 'en_US',
      itemsPerPage: config.itemsPerPage,
    });

    return { context: { syliusClient } };
  });

export const defineSyliusQuery = defineSylius.queryHandler;
export const defineSyliusAction = defineSylius.actionHandler;
export const defineSyliusLink = defineSylius.linkHandler;
export const defineSyliusComponentResolver = defineSylius.componentResolver;
