# @laioutr-app/sylius

Laioutr connector for the Sylius Shop API v2.

## MVP scope

- **Read:** Product, ProductVariant (PLP, PDP, variant selection)
- **Write:** Cart line-items only — Add / Update quantity / Remove. No checkout.

Out of scope: customer auth, addresses, payments, shipping, taxons, CMS pages, wishlist, bundles, reviews, attributes, associations, promotions.

## Setup

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  modules: ['@laioutr-app/sylius'],
  '@laioutr-app/sylius': {
    apiURL: 'http://localhost/api/v2/shop',
    defaultLocale: 'en_US',
    imageFilter: 'sylius_large',
    itemsPerPage: 20,
  },
});
```

## Codegen

Sylius types are generated from the OpenAPI spec:

```sh
pnpm gen:sylius
```

The output (`src/runtime/server/client/sylius-types.ts`) is committed.

## Architecture invariant

Only the cart-write methods in `src/runtime/server/client/index.ts` and the action handlers in `src/runtime/server/orchestr/cart/*.action.ts` may issue non-GET HTTP requests. All other code is read-only. The grep guard at the end of the test plan enforces this.
