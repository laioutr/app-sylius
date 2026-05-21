# @laioutr-app/sylius

Laioutr connector for the Sylius Shop API v2.

## MVP scope

- **Read:** Product, ProductVariant (PLP, PDP, variant selection), Category, MenuItem, BreadcrumbItem (taxon-derived navigation).
- **Write:** Cart line-items only — Add / Update quantity / Remove. No checkout.

Out of scope: customer auth, addresses, payments, shipping, CMS pages, wishlist, bundles, reviews, attributes, associations, promotions.

`menu/by-alias` resolves the `alias` argument as a Sylius taxon code. There is no separate alias-to-code mapping — the frontend asks for a menu by passing the code of the desired root taxon (e.g. `MENU_CATEGORY`). `MenuItem.parentId` is never emitted (the Sylius shop `taxon.show` schema does not expose `parent`); reconstruct the menu tree top-down from `childIds`.

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

The only file that issues non-GET HTTP requests is `src/runtime/server/client/index.ts`. Every write goes through one of its five cart-write wrapper methods (`createCart`, `getCart` is GET, `addCartItem`, `changeCartItemQuantity`, `removeCartItem`). Everything else — orchestr handlers, mappers, helpers — is read-only.

The client is built on `openapi-fetch`, so writes appear as `client.POST(...)` / `client.PATCH(...)` / `client.DELETE(...)` calls. A grep guard enforces that no other file uses these:

```sh
grep -RIn --include='*.ts' -E "client\.(POST|PATCH|PUT|DELETE)\(" src \
  | grep -v 'src/runtime/server/client/index.ts' || echo "GUARD: pass"
```
