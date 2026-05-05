# Design: `@laioutr-app/sylius` — MVP (Sylius Shop API v2 Wrapper)

**Status:** validated against running local Sylius instance at `http://localhost/api/v2` on 2026-04-30. Supersedes the original `PLAN.md`.

## Goal

Ship the smallest end-to-end Laioutr connector for Sylius that supports a working storefront flow: **browse PLP → PDP with variant selection → add/update/remove cart line-items**. No checkout, no auth, no wishlist, no CMS, no taxon navigation.

## Validation findings (live API probe)

The local Sylius exposes 70 shop paths, OpenAPI 3.1.0, 268 operations all carrying `operationId`, 774 schemas. Hydra wrapping confirmed (`@context`, `@id`, `@type`, `hydra:member`, `hydra:totalItems`, `hydra:view`, `hydra:search`).

**Plugins absent in the local instance** — these were in the original PLAN.md but are **dropped from MVP and from the project entirely** per scope decision (local instance is the target):

- SyliusWishlistPlugin → no `/wishlists*` endpoints
- SyliusProductBundlePlugin → no `/products/{code}/bundle`, `/product-bundles/{id}`, `/product-bundle-items/{id}`
- SyliusCmsPlugin → no `/cms/pages*`
- ChannelPricingLogEntry → admin-only resource (confirmed not on Shop API)

**Confirmed present and in MVP scope:**
- Products, ProductVariants, ProductImages, ProductOptions, ProductOptionValues, Cart (`/orders/*` line-item operations).

**Confirmed present but deferred (post-MVP):** ProductAttribute(/Value), ProductAssociation(/Type), ProductReview, ProductTaxon, CatalogPromotion, Channel.

## MVP scope

**Entities:** Product, ProductVariant, Cart, CartItem.

**Operations:**

| Sylius endpoint | Method | Purpose |
|---|---|---|
| `/products` | GET | PLP (paginated) |
| `/products/{code}` | GET | PDP by code |
| `/products-by-slug/{slug}` | GET | PDP by slug |
| `/products/{code}/images` | GET | gallery |
| `/product-variants` | GET | filter by product / batch by codes |
| `/product-variants/{code}` | GET | single variant |
| `/product-options` | GET | hydrate option-axis labels |
| `/product-option-values` | GET | hydrate option-value labels |
| `/orders` | POST | create anonymous cart |
| `/orders/{tokenValue}` | GET | read current cart |
| `/orders/{tokenValue}/items` | POST | add line item |
| `/orders/{tokenValue}/items/{orderItemId}` | PATCH | change quantity |
| `/orders/{tokenValue}/items/{orderItemId}` | DELETE | remove line item |

ProductOption/Value endpoints are read internally by an option-resolver helper; they are **not** exposed as canonical entities.

## Architecture decisions

1. **Hybrid codegen — `openapi-typescript` for types, hand-written client.**
   - `pnpm gen:sylius` runs `npx openapi-typescript http://localhost/api/v2/docs.json -o src/runtime/server/client/sylius-types.ts`.
   - Output is committed; CI does not hit the live API.
   - Hand-written `client/index.ts` consumes generated types as parameter/return types.
   - Rationale: zero runtime overhead from codegen; preserves the static grep-invariant that POST/PATCH/DELETE only appear inside cart-write methods; gives us full control over Hydra unwrapping, locale headers, and error mapping.

2. **No Sylius SDK** — Nitro's global `$fetch` (ofetch) suffices.

3. **Hostname → channel.** Sylius determines channel from the Host header; `apiURL` per environment points at the right host.

4. **Locale via `Accept-Language` header**, sourced from `clientEnv.locale`, with `defaultLocale` from module options as fallback.

5. **Prices** are integers in smallest-currency-units (cents). Mapper: `Money.fromDecimal(cents/100, currency)`. **Currency for MVP** comes from `ModuleOptions.defaultCurrency` (post-MVP: `/channels/{code}` lookup).

6. **Hydra unwrapping** at the client layer. Single private `fetchCollection<T>(path, params): { items: T[], total: number }` for list endpoints; orchestr handlers never see `hydra:member`.

7. **Read/write separation.** `method: 'POST'|'PATCH'|'PUT'|'DELETE'` may appear **only** in cart-write client methods (`createCart`, `addCartItem`, `changeCartItemQuantity`, `removeCartItem`) and inside `orchestr/cart/*.action.ts`. Static guard via grep-check in CI.

8. **Cart token in httpOnly cookie.** `tokenValue` from `POST /orders` → cookie `sylius-cart-token` (httpOnly, secure, SameSite=Lax, maxAge 30 days). `assertCartExists(event)` creates an anonymous cart on demand. 404 on `GET /orders/{token}` (expired token) → cookie cleared, empty cart returned.

9. **PATCH content-type quirk.** `changeCartItemQuantity` sends `Content-Type: application/merge-patch+json`; isolated in a `patchMergeJson()` helper.

10. **IRIs vs codes.** Sylius write bodies require IRIs (`/api/v2/shop/product-variants/{code}`); orchestr handlers receive variant *codes* and the client constructs the IRI internally via an `iri('product-variants', code)` helper.

11. **Option resolution via per-request memoized helper.** Sylius variants reference option-values by IRI only; the axis name lives on the option, not the variant. `orchestr-helper/option-resolver.ts` lazily fetches all options + all option-values once per request into a `Map<iri, label>` cache, then resolves each variant's `optionValues[]` to `{ name, value }` pairs for `ProductVariantOptions.selected`.

## Module configuration

```ts
// src/module.ts
export interface ModuleOptions {
  apiURL: string;            // e.g. "http://localhost/api/v2/shop"
  defaultLocale?: string;    // fallback Accept-Language, e.g. "en_US"
  defaultCurrency: string;   // MVP: required, e.g. "USD"
  imageFilter?: string;      // LiipImagine filter, default "sylius_large"
  itemsPerPage?: number;     // default 20
}
```

Cookie constant: `SYLIUS_CART_TOKEN_COOKIE = 'sylius-cart-token'`.

## Client surface

```ts
function createSyliusClient(opts: ModuleOptions) {
  return {
    // ===== Read (Product) =====
    getProducts(params): Promise<HydraCollection<Product>>
    getProductByCode(code): Promise<Product>
    getProductBySlug(slug): Promise<Product>
    getProductImages(productCode): Promise<HydraCollection<ProductImage>>

    // ===== Read (ProductVariant) =====
    getVariantsByProduct(productIri): Promise<HydraCollection<ProductVariant>>
    getVariantByCode(code): Promise<ProductVariant>
    getVariantsByCodes(codes: string[]): Promise<ProductVariant[]>

    // ===== Read (Options — internal helper consumers only) =====
    getProductOptions(): Promise<HydraCollection<ProductOption>>
    getProductOptionValues(): Promise<HydraCollection<ProductOptionValue>>

    // ===== Write (Cart only) =====
    createCart({ localeCode? }): Promise<Order>                          // POST /orders
    getCart(tokenValue: string): Promise<Order | null>                   // GET; null on 404
    addCartItem(tokenValue, { productVariant, quantity }): Promise<Order>// POST .../items
    changeCartItemQuantity(tokenValue, orderItemId, { quantity }): Promise<Order> // PATCH (merge-patch+json)
    removeCartItem(tokenValue, orderItemId): Promise<Order>              // DELETE
  }
}
```

Default headers: `Accept: application/ld+json`, `Accept-Language: <event-locale or defaultLocale>`. List params: `{ page?, itemsPerPage?, sort?: { field, dir }, filter?: Record<string, unknown> }`. The mapper at `mappers/filters/index.ts` translates `sort` → `?order[<field>]=<dir>`, `filter` → Sylius's `filter[name]=` syntax. MVP only requires `page`/`itemsPerPage`/`sort`; `filter` is a passthrough stub.

## Canonical-types mapping

| Sylius source | Canonical entity / component | Notes |
|---|---|---|
| `Product` | `Product` (Base, Info, Media, Prices, Seo, Description, Flags) | single resolver |
| `Product.images` + `/products/{code}/images` | `ProductMedia.images: MediaImage[]` | URL = `${apiOrigin}/media/cache/resolve/${imageFilter}/${image.path}` |
| `Product.translations[].name` | `ProductBase.name` | locale-resolved |
| `Product.translations[].slug` | `ProductBase.slug` | |
| `Product.shortDescription` | `ProductInfo.shortDescription` | |
| `Product.description` | `ProductDescription` (HtmlFragment) | |
| `min/max(variants[].price)` | `ProductPrices.price` | `Money.fromDecimal(cents/100, currency)` |
| `originalPrice > price` | `ProductPrices.isOnSale`, `strikethroughPrice` | |
| `ProductVariant` | `ProductVariant` (Base, Info, Prices, Options, Availability) | |
| `variant.code` | `ProductVariantBase.sku` | |
| `variant.name` | `ProductVariantBase.name` | |
| `variant.optionValues[]` | `ProductVariantOptions.selected[]` | hydrated via option-resolver helper |
| `variant.inStock` | `ProductVariantAvailability.status` | `inStock ? 'inStock' : 'outOfStock'`; `quantity: 0` (Sylius shop does not expose stock count) |
| `Order` (cart) | `Cart` (Base, Cost) | `totalQuantity = sum(items[].quantity)` |
| `Order.itemsTotal/total/taxTotal` | `CartCost.subtotal/total/tax` | cents → Money |
| `Order.items[]` | `CartItem[]` via `cart-items.link` | each item is its own canonical entity |
| `OrderItem.variant.code` | `CartItem.product-variant.link` | |
| `OrderItem.{unitPrice, total}` | `CartItemCost.{single, total}` | |

**No standalone canonical entities for ProductImage, ProductOption, or ProductOptionValue** — their data flows into Product/Variant components.

## File layout

```
src/runtime/server/
├── const/keys.ts                                   # SYLIUS_CART_TOKEN_COOKIE
├── client/
│   ├── sylius-types.ts                             # GENERATED (openapi-typescript)
│   ├── index.ts                                    # hand-written factory
│   └── cartTokenCookie.ts                          # get/setCartToken(event)
├── middleware/
│   └── defineSylius.ts                             # defineSyliusQuery / Action / Link / ComponentResolver
├── mappers/
│   ├── media/index.ts                              # mapSyliusImage()
│   └── filters/index.ts                            # sort/filter param mapping
├── orchestr-helper/
│   ├── products/index.ts                           # centsToDecimal, getMinMaxPrices, description utils
│   ├── product-variants/index.ts                   # mapVariantOptions, computeAvailability
│   ├── option-resolver.ts                          # per-request memoized iri→label cache
│   └── cart/index.ts                               # assertCartExists, mapCartLineItems
└── orchestr/
    ├── product/
    │   ├── base.resolver.ts                        # provides Base, Info, Media, Prices, Seo, Description, Flags
    │   ├── by-slug.query.ts                        # lib/ecommerce/product/by-slug.query
    │   ├── by-code.query.ts                        # custom
    │   ├── list.query.ts                           # custom (paginated PLP)
    │   └── variants.link.ts                        # lib/ecommerce/product/variants.link
    ├── product-variant/
    │   └── base.resolver.ts                        # provides Base, Info, Prices, Options, Availability
    ├── cart/
    │   ├── base.resolver.ts                        # provides CartBase, CartCost
    │   ├── cart-items.link.ts                      # lib/ecommerce/cart/cart-items.link
    │   ├── get-current.query.ts                    # lib/ecommerce/cart/get-current.query
    │   ├── add-items.action.ts                     # lib/ecommerce/cart/add-items.action
    │   ├── update-items.action.ts                  # lib/ecommerce/cart/update-items.action
    │   └── remove-items.action.ts                  # lib/ecommerce/cart/remove-items.action
    └── cart-item/
        ├── base.resolver.ts                        # provides CartItemBase, CartItemCost
        └── product-variant.link.ts                 # lib/ecommerce/cart/cart-item-product-variant.link
```

13 orchestr handlers + 8 supporting files + 1 generated types file.

## Implementation phases

1. **Setup & codegen.** Rename to `@laioutr-app/sylius`, define `ModuleOptions`, wire `module.ts`, add `pnpm gen:sylius` script, generate `sylius-types.ts`. Verify: `pnpm dev:prepare` green.
2. **Client.** `client/index.ts` factory with all 14 methods, Hydra unwrapping, error mapping, `cartTokenCookie.ts`. Verify: client unit tests against the local API.
3. **Product domain.** `orchestr/product/*` (base resolver + 4 handlers), `orchestr-helper/products`, `mappers/media`, `mappers/filters`. Verify: PLP loads from `/products`; PDP by-slug returns full product with images.
4. **ProductVariant + option-resolver.** `orchestr/product-variant/base.resolver.ts`, `orchestr-helper/product-variants`, `orchestr-helper/option-resolver.ts`. Verify: PDP shows variant options ("T-shirt size: S/M/L") with correct labels.
5. **Cart (writes).** `orchestr/cart/*`, `orchestr/cart-item/*`, `orchestr-helper/cart/index.ts`. Verify: AddToCart on empty cookie creates cart and sets `sylius-cart-token`; UpdateItems changes quantity; RemoveItems removes; GetCurrentCart returns consistent totals; manual invalid cookie → empty cart and cookie cleared.
6. **Tests + docs.** Client/mapper unit tests, read-only integration tests against the local API, manual cart smoke. Update README with coverage table and MVP scope note.

## Verification

1. `pnpm dev:prepare && pnpm dev` — playground starts.
2. Orchestr devtools list all 13 handlers.
3. Read smoke against `http://localhost/api/v2`:
   - `ProductListQuery` → 87 products
   - `ProductBySlugQuery {slug: <demo-slug>}` → full product
   - PDP for `Apollo_T_Shirt` → 5 size variants with labels
4. Cart smoke: `AddToCart {variantCode, quantity: 2}` on empty cookie → new cart created, cookie set, item present; `UpdateItems {orderItemId, quantity: 5}` → new quantity; `GetCurrentCartQuery` → totals consistent; `RemoveItems {orderItemId}` → item gone; manually invalid cookie → empty cart and cookie cleared.
5. `pnpm test`, `pnpm lint`, `pnpm test:types` green.
6. Grep guard: `method: ['"](POST|PATCH|PUT|DELETE)['"]` outside `client/index.ts` (cart methods only) and `orchestr/cart/*.action.ts` → no hits.

## Out of scope

Checkout (addressing, shipping/payment selection, complete), completed orders, customer auth/account, addresses, payments (PSP), shipping methods, taxon-tree/menu, CMS, geography (countries/currencies/locales), contact, multi-channel switching, ProductBundle, ProductBundleItem, Wishlist, Page, ChannelPricingLogEntry, ProductAttribute(/Value), ProductAssociation(/Type), ProductReview, ProductTaxon, CatalogPromotion, Channel resolver.

## Resolved open questions

| # | Question | Resolution |
|---|---|---|
| 1 | ChannelPricingLogEntry | Out of MVP. Endpoint is admin-only; not in Shop API. |
| 2 | ProductReview POST | Out of MVP. Review entity is dropped entirely. |
| 3 | Canonical-type coverage | Resolved. ProductImage → `ProductMedia.images`. ProductOption/Value → option-resolver helper, not canonical entities. Bundle/Page/Wishlist/Promotion/Channel/Review/AssociationType all out of MVP. |
| 4 | Wishlist channelCode | Moot — Wishlist out. |
