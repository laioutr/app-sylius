# Design: `@laioutr-app/sylius` — MVP completion (taxons + defaultVariant)

**Status:** design validated 2026-05-05 against the gap audit between the repo and Laioutr's official "minimum viable connector" checklist.

**Prior art:** `2026-04-30-sylius-mvp-design.md` shipped the Product/Variant read + cart-write surface. This design closes the remaining MVP gaps that were declared out of scope at that time.

## Goal

Bring `@laioutr-app/sylius` to parity with Laioutr's published minimum-viable-connector contract by adding the three taxon-shaped entities (Category, MenuItem, BreadcrumbItem) and the missing `Product.defaultVariant` component. After this lands, the connector implements every required query, action, link, and component on the official MVP checklist.

## Gap audit vs official MVP checklist

| Surface | Required | Present | Missing |
|---|---|---|---|
| Queries | `product/by-slug`, `product/by-category-slug`, `category/by-slug`, `cart/get-current`, `menu/by-alias` | 2/5 | `product/by-category-slug`, `category/by-slug`, `menu/by-alias` |
| Actions | `cart/add-items`, `cart/remove-items`, `cart/update-items` | 3/3 | none |
| Links | `product/variants`, `product/breadcrumb`, `cart/cart-items`, `cart/cart-item-product-variant` | 3/4 | `product/breadcrumb` |
| Components | Product (base, description, media, prices, defaultVariant); ProductVariant (base, prices, options); Category (base); Cart (base, cost); CartItem (base, cost); MenuItem (base); BreadcrumbItem (base) | partial | `Product.defaultVariant`; Category, MenuItem, BreadcrumbItem entities not implemented |

## Scope decisions (recorded)

1. **Single tree, three views.** Category, MenuItem, BreadcrumbItem all read from the same Sylius taxon tree. Every taxon is all three depending on which entity asks. No filtering of "what counts as a category vs menu item".
2. **Alias = Sylius taxon code.** `menu/by-alias` resolves the alias string directly as a Sylius taxon code. No module-config alias map. The frontend asks for `menu/by-alias` with `alias: 'MENU_CATEGORY'` (or whatever code the storefront uses as its menu root). Tradeoff accepted: frontend templates couple to Sylius taxon codes.
3. **Tests deferred.** Orchestr layer only; testing scaffolding is a separate brainstorm. Captured Sylius response fixtures should be pinned into `test/fixtures/` during implementation as a head start.

## File layout

```
src/runtime/server/orchestr/
  product/
    base.resolver.ts            (MODIFY: add defaultVariant component)
    by-category-slug.query.ts   (NEW)
    breadcrumb.link.ts          (NEW)
  category/                     (NEW DIR)
    base.resolver.ts            (components: base)
    by-slug.query.ts
  menu-item/                    (NEW DIR)
    base.resolver.ts            (components: base)
  breadcrumb-item/              (NEW DIR)
    base.resolver.ts            (components: base)
  menu/                         (NEW DIR)
    by-alias.query.ts

src/runtime/server/mappers/
  taxon.ts                      (NEW: shared Sylius Taxon → canonical conversion)
```

No new files under `client/`. The architecture invariant ("only `client/index.ts` issues writes") holds because every addition is GET-only. New handlers call `client.GET(...)` directly, the same pattern used by `product/by-slug` and `product/variants`.

No module-options additions (per decision 2).

## Sylius API surface

| Handler | Sylius call(s) |
|---|---|
| `category/by-slug` | `GET /api/v2/shop/taxons-by-slug/{slug}` |
| `product/breadcrumb` link | `GET /api/v2/shop/taxons/{code}` per ancestor (walks `parent` IRI) |
| `menu/by-alias` | `GET /api/v2/shop/taxons/{code}` (alias = code) → fetch each `children[]` IRI in parallel |
| `product/by-category-slug` | `GET /taxons-by-slug/{slug}` (cached separately, slug→code) then `GET /products?taxon={code}&page=…&itemsPerPage=…&order[…]` |
| `Product.defaultVariant` | already in product payload (`product.defaultVariant` IRI); `options` from the variant's `optionValues[]` (read from pre-loaded variants when available, fallback `GET /product-variants/{code}`) |

### Sylius Taxon fields consumed

`{ code, slug, name, description, position, enabled, parent (IRI|null), children (IRI[]), images[] }`

### Shared `mappers/taxon.ts` responsibilities

1. Filter `enabled === false` out of every taxon list.
2. Sort children by `position` ascending.
3. Resolve `code` from a Sylius IRI (`/api/v2/shop/taxons/MENU` → `MENU`); same approach as `cart-item/product-variant.link.ts`.
4. Canonical IDs: `taxon:<code>` for Category, MenuItem, and BreadcrumbItem (so the same Sylius taxon resolves consistently across entity types).

The mapper does **not** assemble URLs; link assembly is `LinkReference`-shaped and locale-agnostic (see Component population).

## Component population

Field-by-field mapping from Sylius shapes to the canonical schemas in `@laioutr-core/canonical-types`.

### `Category.base` → `{ slug, title }`

- `slug` ← Sylius `taxon.slug` (locale-resolved by the Sylius channel).
- `title` ← Sylius `taxon.name`.

### `MenuItem.base` → `{ type: 'link', name, link, childIds?, parentId? }`

Every taxon is `type: 'link'` in MVP. `type: 'folder'` is reserved for a later config-driven case (Sylius does not natively model folder-only taxons).

- `name` ← `taxon.name`.
- `link` ← `LinkReference` (see below).
- `childIds` ← canonical IDs of enabled children, sorted by `position`.
- `parentId` ← parent's canonical ID, or omitted if the parent is the unnamed Sylius root.

### `BreadcrumbItem.base` → `{ name, link?, isCurrentPage? }`

For each ancestor of the product's `mainTaxon`, walked root → leaf, excluding the unnamed Sylius root:

- `name` ← `taxon.name`.
- `link` ← `LinkReference` to its Category.
- `isCurrentPage` ← omitted on ancestors. Reserved for a future Category-page resolver that emits a "self" crumb with `isCurrentPage: true` and `link` omitted.

### `Product.defaultVariant` → `{ id?, options? }`

- `id` ← variant code parsed from the `product.defaultVariant` IRI (`/api/v2/shop/product-variants/SKU-RED-M` → `SKU-RED-M`).
- `options` ← option codes from the variant's `optionValues[]`. When the resolver is loading variants for the same request, read from the pre-loaded set; otherwise fall back to one `GET /product-variants/{code}`.
- Both fields optional. If the Sylius product has no `defaultVariant`, return `{}`.

### `LinkReference` shape (used by MenuItem and BreadcrumbItem)

```ts
{
  type: 'reference',
  reference: {
    type: 'Category',
    slug: taxon.slug,
    id: `taxon:${taxon.code}`,
  },
}
```

`slug` is the field the frontend's `linkResolver` uses for route generation (page-types declare `resolveFor: [{ referenceType: 'Category' }]` and consume `slug`). `id` is supplementary — it is consumed by custom `frontend-core:link-resolver:resolve` hooks for analytics, deduplication, or stable identity. Always include both.

The connector emits no URL strings.

## Query/link wiring

### `category/by-slug.query.ts`

- `singleEntity: true`.
- Input: `{ slug: string }`.
- Components: `[CategoryBase]`.
- Implementation: `GET /taxons-by-slug/{slug}`. 404 → return null entity (no throw; orchestr handles as not-found).
- Cache: `{ ttl: '1 day' }`.

### `menu/by-alias.query.ts`

- List query.
- Input: `{ alias: string }`.
- Components: `[MenuItemBase]`.
- Implementation: `GET /taxons/{alias}` (alias = code). Read `children[]` IRIs, fetch them in parallel. Return flattened list. Each entity carries `parentId` and `childIds` so the frontend reconstructs the tree.
- Depth: one level per query. Deeper trees re-query lazily with the children's codes as new aliases.
- Unknown code → empty list (no throw).
- Cache: `{ ttl: '1 day' }`.

### `product/by-category-slug.query.ts`

- List query.
- Input: `{ categorySlug: string, page?: number, itemsPerPage?: number, sort?: string }`.
- Components: `[ProductBase, ProductPrices, ProductMedia, ProductDefaultVariant]`.
- Implementation: two calls — (1) `GET /taxons-by-slug/{slug}` to resolve the code; (2) `GET /products?taxon={code}&page=…&itemsPerPage=…&order[…]`.
- Response shape (multi-entity query contract):
  ```ts
  {
    ids: [...],            // product canonical IDs
    total: number,         // hydra:totalItems from Sylius
    availableSortings: [   // static list, hardcoded for MVP
      { id: 'name:asc',  label: 'Name A–Z' },
      { id: 'name:desc', label: 'Name Z–A' },
      { id: 'price:asc', label: 'Price low to high' },
      { id: 'price:desc', label: 'Price high to low' },
    ],
    availableFilters: [],  // facets out of scope
    sorting: '<input.sort or default>',
  }
  ```
- Sort mapping: `name:asc` → `order[name]=asc` etc. Default sort: `name:asc`.
- 404 on slug lookup → empty result (`ids: []`, `total: 0`); frontend renders "no products".
- Slug→code lookup cached `{ ttl: '1 day' }` separately to avoid the double round-trip on repeat hits.
- Product list cached `{ ttl: '5 minutes' }` (catalog moves more often than the tree).
- Does **not** pre-resolve the Category entity; that is the frontend's separate `category/by-slug` call. Pattern matches reference connectors (Shopify/nimstrata, Shopware, Adobe Commerce).

### `product/breadcrumb.link.ts`

- Link `Product → BreadcrumbItem[]`.
- Implementation: read `product.mainTaxon` (IRI). Walk parents serially via repeated `GET /taxons/{code}` until `parent === null` or the unnamed root. Return ancestors in root-to-leaf order.
- Cycle guard: hard cap at depth 16 (defensive — corrupted Sylius data could in principle loop).
- Missing `mainTaxon` → empty array.
- Disabled `mainTaxon` → empty array (frontend falls back to no-breadcrumb).
- Cache: `{ ttl: '1 day' }`.

### `Product.defaultVariant` (modify `product/base.resolver.ts`)

- Add `defaultVariant: () => ({ id, options })` alongside the existing `base`, `media`, `prices`, `description` resolvers in `product/base.resolver.ts:40-63`.
- Cache TTL inherits the resolver default (1 day, matching `prices`'s explicit override pattern).

## Edge cases

- **Disabled taxons:** filtered out of every list.
- **Empty menu:** root with zero enabled children → `[]`, not an error.
- **Locale:** the existing `client/index.ts` sends the channel's `defaultLocale` header, which auto-localizes taxon `name` and `slug`. No special handling.
- **404 on `taxons-by-slug` from PLP:** return empty product list, not a 500.
- **Product without `mainTaxon`:** breadcrumb returns `[]`.
- **Cycle in taxon tree:** depth-16 cap on the breadcrumb walk.

## Out of scope (explicitly deferred)

- Category components beyond `base` (no `description`, `media`, `seo`).
- `type: 'folder'` MenuItems.
- Recursive menu pre-walk (only direct children per query).
- PLP facets / `availableFilters` (returns `[]`).
- Brand entity, search, customer auth, wishlist, reviews, newsletter, blog (per Laioutr's "optional add-ons" list).
- Tests (per decision 3).

## Verification path before merge

Since tests are deferred, manual verification is required.

1. Run `pnpm dev`, open the playground at `/orchestr`.
2. Issue each new query through `LfcOrchestrRequestEditor` against the local Sylius instance:
   - `category/by-slug` with a known slug.
   - `menu/by-alias` with the storefront's menu root code.
   - `product/by-category-slug` with `page=1`, default sort.
   - `product/by-slug` with `defaultVariant` in components and `breadcrumb` requested as a link.
3. Pin one captured response per endpoint into `test/fixtures/` to seed the deferred test work.
4. Run the README's grep guard:
   ```sh
   grep -RIn --include='*.ts' -E "client\.(POST|PATCH|PUT|DELETE)\(" src \
     | grep -v 'src/runtime/server/client/index.ts' || echo "GUARD: pass"
   ```
5. Run `pnpm test:types`. Type checks must pass against `@laioutr-core/canonical-types` for every new component.

## README update

Single-paragraph diff to the "MVP scope" block:

- **Read:** Product, ProductVariant (PLP, PDP, variant selection), **Category, MenuItem, BreadcrumbItem (taxons)**.
- **Out of scope:** ~~taxons~~ customer auth, addresses, payments, shipping, CMS pages, wishlist, bundles, reviews, attributes, associations, promotions.

Architecture-invariant section unchanged.
