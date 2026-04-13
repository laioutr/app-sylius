# Plan: `@laioutr-app/sylius` — Sylius Shop API v2 Wrapper

## Context
Das Repo `app-sylius` wurde aus `app-starter` erzeugt und enthält zu 100% Template-Boilerplate (`my-laioutr-app` Platzhalter, leere Orchestr-Dirs). Ziel: ein produktionsreifer Nuxt 3 / Laioutr Orchestr API-Wrapper für die Sylius Shop API v2 — analog zum `app-commercetools`-Pattern.

**Scope (vom User festgelegt):** Nur die folgenden Sylius-Entitäten werden abgebildet. Alle GET/read-only, **außer `Wishlist` und `Cart`** — dort dürfen `POST`, `PATCH`, `DELETE` implementiert werden (Cart nur für Line-Item-Operationen: AddToCart, ChangeQuantity, RemoveFromCart; **kein Checkout**).

| Entität | Endpoints (Shop API v2) | Schreibend? |
|---------|-------------------------|-------------|
| Product | `GET /products`, `GET /products/{code}`, `GET /products-by-slug/{slug}`, `GET /products/{code}/bundle`, `GET /products/{code}/attributes` | nein |
| ProductVariant | `GET /product-variants`, `GET /product-variants/{code}` | nein |
| ProductBundle | `GET /product-bundles/{id}` | nein |
| ProductBundleItem | `GET /product-bundle-items/{id}` | nein |
| CatalogPromotion | `GET /catalog-promotions/{code}` | nein |
| Channel | `GET /channels`, `GET /channels/{code}` | nein |
| ChannelPricingLogEntry | *nicht in der Shop-API v2 OpenAPI verfügbar — siehe §Offene Fragen* | nein |
| ProductAssociation | `GET /product-associations/{id}` | nein |
| ProductAssociationType | `GET /product-association-types`, `GET /product-association-types/{code}` | nein |
| ProductAttribute | `GET /product-attributes/{code}` | nein |
| ProductAttributeValue | `GET /product-attribute-values/{id}` | nein |
| ProductImage | `GET /products/{code}/images`, `GET /products/{code}/images/{id}` | nein |
| ProductOption | `GET /product-options`, `GET /product-options/{code}` | nein |
| ProductOptionValue | `GET /product-option-values`, `GET /product-options/{optionCode}/values/{code}` | nein |
| ProductReview | `GET /product-reviews`, `GET /product-reviews/{id}` | nein (POST erfordert Auth → out of scope) |
| ProductTaxon | `GET /product-taxons/{id}` | nein |
| Page (CMS) | `GET /cms/pages`, `GET /cms/pages/{id}` | nein |
| **Wishlist** | `POST /wishlists`, `GET /wishlists/{token}`, `DELETE /wishlists/{token}`, `PATCH /wishlists/{token}/product`, `PATCH /wishlists/{token}/variant`, `DELETE /wishlists/{token}/products/{productId}`, `DELETE /wishlists/{token}/productVariants/{productVariantId}` | **ja** (POST/PATCH/DELETE) |
| **Cart** (Order in `cart` state) | `POST /orders` (createCart), `GET /orders/{tokenValue}`, `POST /orders/{tokenValue}/items` (AddToCart), `PATCH /orders/{tokenValue}/items/{orderItemId}` (ChangeQuantity), `DELETE /orders/{tokenValue}/items/{orderItemId}` (RemoveFromCart) | **ja** (POST/PATCH/DELETE — nur Line-Items, kein Checkout) |

**Ausgeschlossen** (nicht in dieser Iteration): Checkout (Addressing, Shipping-/Payment-Method-Selection, Complete), Completed Orders, Customer-Auth/Account, Addresses, Payments (PSP), Shipping-Methods, Taxon-Tree-Navigation (Menu), CMS-Blocks/Collections/Media/Templates, Contact, Geography (Countries/Currencies/Locales).

---

## Architektur-Entscheidungen

1. **Kein Sylius-SDK** — Nitros globales `$fetch` (ofetch) reicht für JSON-LD Requests.
2. **Sylius `code`/`tokenValue` = Orchestr entity ID** — Products/Variants/Taxa via `code`, Wishlist via `tokenValue`, numerische IDs (ProductImage, ProductAssociation, ProductAttributeValue, ProductTaxon, ProductBundle, ProductBundleItem, Page) als Strings.
3. **Hostname-Channel** — Sylius bestimmt Channel aus Host-Header → `apiURL` zeigt pro Env auf richtigen Channel-Host.
4. **Locale via `Accept-Language`** — aus `clientEnv.locale`.
5. **Preise** — Integer in Smallest-Currency-Unit → `Money.fromDecimal(cents/100, currency)`.
6. **Hydra unwrapping** — Client entpackt `hydra:member` / `hydra:totalItems` transparent.
7. **Read/Write-Trennung** — Nur Wishlist- und Cart-Handler sind als `action` implementiert; alle anderen sind `query`/`link`/`componentResolver`. Grep-Check `method: 'POST'|'PATCH'|'PUT'|'DELETE'` darf außerhalb von `orchestr/wishlist/*`, `orchestr/cart/*` und den entsprechenden Client-Methoden keine Treffer liefern.
8. **Wishlist-Token in httpOnly-Cookie** — `tokenValue` aus `POST /wishlists` wird als `sylius-wishlist-token` gesetzt; folgende Requests lesen ihn automatisch.
9. **Cart-Token in httpOnly-Cookie** — `tokenValue` aus `POST /orders` wird als `sylius-cart-token` gesetzt (httpOnly, secure, SameSite=Lax, maxAge 30 Tage). `assertCartExists` erstellt bei Bedarf einen anonymen Cart. Sylius-Carts sind persistent und überleben Session-Ende.

---

## Modulkonfiguration

```ts
// src/module.ts
export interface ModuleOptions {
  apiURL: string;            // z.B. "https://v2.demo.sylius.com/api/v2/shop"
  defaultLocale?: string;    // Fallback für Accept-Language, z.B. "en_US"
  imageFilter?: string;      // LiipImagine-Filter, default "sylius_large"
  itemsPerPage?: number;     // Default 20
  defaultChannelCode?: string; // für `POST /wishlists` Body
}
```

Runtime-Config: `apiURL` privat, public-Interface leer. Cookie-Konstanten: `SYLIUS_WISHLIST_TOKEN_COOKIE = 'sylius-wishlist-token'`, `SYLIUS_CART_TOKEN_COOKIE = 'sylius-cart-token'`.

---

## Datei-Layout

**Modifizieren:** `package.json` (rename, deps), `src/module.ts`, `src/globalExtensions.ts`, `README.md`, `playground/nuxt.config.ts`, `build.config.ts`.

**Neu anlegen:**

```
src/runtime/server/
├── const/keys.ts                                      # SYLIUS_WISHLIST_TOKEN_COOKIE, SYLIUS_CART_TOKEN_COOKIE
├── client/
│   ├── index.ts                                       # $fetch-Wrapper, Hydra-Unwrapping, alle Endpoints
│   ├── wishlistTokenCookie.ts                         # get/setWishlistToken(event)
│   └── cartTokenCookie.ts                             # get/setCartToken(event)
├── middleware/
│   └── defineSylius.ts                                # defineSyliusQuery/Action/Link/ComponentResolver
├── mappers/
│   ├── media/index.ts                                 # mapSyliusImage()
│   └── filters/index.ts                               # Sort/Filter-Param-Mapping
├── orchestr-helper/
│   ├── products/index.ts                              # centsToDecimal, getMinMaxPrices, Description-Utils
│   ├── product-variants/index.ts                      # mapVariantOptions, computeAvailability
│   ├── wishlist/index.ts                              # assertWishlistExists (create on demand, set cookie)
│   └── cart/index.ts                                  # assertCartExists (create on demand, set cookie), mapCartLineItems
└── orchestr/
    ├── plugins/zodFix.ts                              # bleibt
    ├── product/
    │   ├── base.resolver.ts                           # ProductBase/Info/Media/Prices/Seo/Description/Flags
    │   ├── by-slug.query.ts                           # GET /products-by-slug/{slug}
    │   ├── by-code.query.ts                           # GET /products/{code}
    │   ├── list.query.ts                              # GET /products (pagination, sort)
    │   ├── variants.link.ts                           # GET /product-variants?product={iri}
    │   ├── images.link.ts                             # via GET /products/{code}/images
    │   ├── attributes.link.ts                         # via GET /products/{code}/attributes
    │   ├── associations.link.ts                       # aus /products/{code} response → ProductAssociation-IDs
    │   └── bundle.link.ts                             # GET /products/{code}/bundle
    ├── product-variant/
    │   └── base.resolver.ts                           # ProductVariantBase/Info/Prices/Options/Availability
    ├── product-bundle/
    │   ├── base.resolver.ts                           # GET /product-bundles/{id}
    │   └── items.link.ts                              # bundle.items → ProductBundleItem-IDs
    ├── product-bundle-item/
    │   └── base.resolver.ts                           # GET /product-bundle-items/{id}
    ├── product-image/
    │   └── base.resolver.ts                           # aus /products/{code}/images (batch per parent)
    ├── product-attribute/
    │   └── base.resolver.ts                           # GET /product-attributes/{code}
    ├── product-attribute-value/
    │   └── base.resolver.ts                           # GET /product-attribute-values/{id}
    ├── product-option/
    │   ├── base.resolver.ts                           # GET /product-options/{code}
    │   └── list.query.ts                              # GET /product-options
    ├── product-option-value/
    │   ├── base.resolver.ts                           # GET /product-options/{optionCode}/values/{code}
    │   └── list.query.ts                              # GET /product-option-values
    ├── product-association/
    │   └── base.resolver.ts                           # GET /product-associations/{id}
    ├── product-association-type/
    │   ├── base.resolver.ts                           # GET /product-association-types/{code}
    │   └── list.query.ts                              # GET /product-association-types
    ├── product-taxon/
    │   └── base.resolver.ts                           # GET /product-taxons/{id}
    ├── product-review/
    │   ├── base.resolver.ts                           # GET /product-reviews/{id}
    │   └── list.query.ts                              # GET /product-reviews?reviewSubject=…
    ├── catalog-promotion/
    │   └── base.resolver.ts                           # GET /catalog-promotions/{code}
    ├── channel/
    │   ├── base.resolver.ts                           # GET /channels/{code}
    │   └── list.query.ts                              # GET /channels
    ├── page/                                          # CMS Pages
    │   ├── base.resolver.ts                           # GET /cms/pages/{id}
    │   ├── by-id.query.ts                             # GET /cms/pages/{id}
    │   └── list.query.ts                              # GET /cms/pages
    ├── wishlist/                                      # WRITES ALLOWED
    │   ├── base.resolver.ts                           # GET /wishlists/{token}
    │   ├── get-current.query.ts                       # Cookie → GET /wishlists/{token}
    │   ├── create.action.ts                           # POST /wishlists, sets cookie
    │   ├── add-product.action.ts                      # PATCH /wishlists/{token}/product
    │   ├── add-variant.action.ts                      # PATCH /wishlists/{token}/variant
    │   ├── remove-product.action.ts                   # DELETE /wishlists/{token}/products/{id}
    │   ├── remove-variant.action.ts                   # DELETE /wishlists/{token}/productVariants/{id}
    │   └── delete.action.ts                           # DELETE /wishlists/{token}, clears cookie
    └── cart/                                          # WRITES ALLOWED (Line-Items only, kein Checkout)
        ├── base.resolver.ts                           # CartBase, CartCost, CartLineItems aus /orders/{tokenValue}
        ├── get-current.query.ts                       # Cookie → GET /orders/{tokenValue}; 404 → Cookie clear, leeres Result
        ├── add-to-cart.action.ts                      # assertCartExists → POST /orders/{token}/items  {productVariant, quantity}
        ├── change-quantity.action.ts                  # PATCH /orders/{token}/items/{orderItemId}  {quantity}
        └── remove-from-cart.action.ts                 # DELETE /orders/{token}/items/{orderItemId}
```

*ChannelPricingLogEntry: Kein Shop-API-Endpoint gefunden → siehe Offene Fragen (wird ggf. aus Variant-Response als Fragment ohne eigenen Fetch mitgemappt).*

---

## Sylius-Client (Methoden-Katalog)

`$fetch`-basiert, Base-URL aus Config, Default-Headers `Accept: application/ld+json`, `Accept-Language`.

**Read (GET-only):**
- `getProducts(params)`, `getProductByCode(code)`, `getProductBySlug(slug)`, `getProductsByCodes(codes[])`
- `getProductBundle(id)`, `getProductBundleItem(id)`
- `getProductImages(productCode)`, `getProductImage(productCode, id)`
- `getProductAttributes(productCode)`, `getProductAttribute(code)`, `getProductAttributeValue(id)`
- `getProductOptions()`, `getProductOption(code)`, `getProductOptionValues()`, `getProductOptionValue(optionCode, code)`
- `getProductAssociation(id)`, `getProductAssociationTypes()`, `getProductAssociationType(code)`
- `getProductReviews(params)`, `getProductReview(id)`
- `getProductTaxon(id)`
- `getVariantsByProduct(productIri)`, `getVariantsByCodes(codes[])`, `getVariantByCode(code)`
- `getCatalogPromotion(code)`
- `getChannels()`, `getChannel(code)`
- `getCmsPages(params)`, `getCmsPage(id)`

**Write (Wishlist):**
- `createWishlist({ channelCode })` → `POST /wishlists`
- `getWishlist(tokenValue)` → `GET /wishlists/{tokenValue}`
- `deleteWishlist(tokenValue)` → `DELETE /wishlists/{tokenValue}`
- `addProductToWishlist(tokenValue, productIri)` → `PATCH .../product`
- `addVariantToWishlist(tokenValue, variantIri)` → `PATCH .../variant`
- `removeProductFromWishlist(tokenValue, productId)` → `DELETE .../products/{id}`
- `removeVariantFromWishlist(tokenValue, variantId)` → `DELETE .../productVariants/{id}`

**Write (Cart — nur Line-Items, kein Checkout):**
- `createCart({ localeCode? })` → `POST /orders` → `{ tokenValue }`
- `getCart(tokenValue)` → `GET /orders/{tokenValue}`
- `addCartItem(tokenValue, { productVariant, quantity })` → `POST /orders/{tokenValue}/items`  *(body: `{ productVariant: "/api/v2/shop/product-variants/{code}", quantity: N }`)*
- `changeCartItemQuantity(tokenValue, orderItemId, { quantity })` → `PATCH /orders/{tokenValue}/items/{orderItemId}` *(Content-Type: `application/merge-patch+json`)*
- `removeCartItem(tokenValue, orderItemId)` → `DELETE /orders/{tokenValue}/items/{orderItemId}`

---

## Canonical-Type-Mapping (Kurzüberblick)

- **Product** → `ProductBase`, `ProductInfo`, `ProductMedia`, `ProductPrices`, `ProductSeo`, `ProductDescription`, `ProductFlags` (Mapping analog commercetools; Preis = `variants[0].price` in Cents → `Money.fromDecimal`).
- **ProductVariant** → `ProductVariantBase/Info/Prices/Options/Availability` (`sku` ← `code`, `status` aus `tracked && inStock`).
- **ProductBundle/ProductBundleItem** → Custom canonical fragments oder als ProductInfo-Extension (Canonical-Type-Support prüfen; ggf. als Link auf dem Product).
- **ProductImage** → `MediaImage` via `mapSyliusImage()` mit `imageFilter`.
- **ProductAttribute/AttributeValue** → Map auf canonical `Attribute` / `AttributeValue` (name, code, value, valueType).
- **ProductOption/OptionValue** → `Option`/`OptionValue` (code, name, translations).
- **ProductAssociation/AssociationType** → Links zwischen Produkten (related, up-sell, cross-sell).
- **ProductReview** → `Review` (rating, title, comment, author, createdAt).
- **ProductTaxon** → Junction-Info (Product-IRI, Taxon-IRI, Position).
- **CatalogPromotion** → `Promotion` canonical (code, name, labels, dates).
- **Channel** → `Channel` canonical (code, name, baseCurrency, defaultLocale, currencies, locales).
- **Page** (CMS) → `CmsPage` canonical (slug, name, content, meta).
- **Wishlist** → `Wishlist` canonical (tokenValue, products[], variants[]).
- **Cart** → `Cart` canonical: `CartBase` (totalQuantity=`sum(items[].quantity)`, id=`tokenValue`), `CartCost` (`itemsTotal`/`total`/`taxTotal` Integer-Cents → Money mit `currencyCode`), `CartLineItems` (`items[]` → `{id: items[].id, variantId: items[].variant.code, quantity, unitPrice, subtotal, total}`). 404 beim Read → Cookie wird geleert, leeres Cart-Ergebnis zurückgegeben.

**Image-URL:** `{domainOf(apiURL)}/media/cache/resolve/{imageFilter}/{image.path}`.

---

## Implementierungs-Phasen

1. **Setup & Client** — Rename (`@laioutr-app/sylius`), `ModuleOptions`, `module.ts`, `client/index.ts` (alle Methoden), `defineSylius.ts`, Mapper, Helper. Verify: `pnpm dev:prepare` grün.
2. **Product-Domäne** — `product/*`, `product-variant/*`, `product-image/*`, `product-attribute/*`, `product-attribute-value/*`, `product-option/*`, `product-option-value/*`, `product-taxon/*`. Verify: PLP/PDP gegen `v2.demo.sylius.com`.
3. **Katalog-Relationen** — `product-association/*`, `product-association-type/*`, `product-bundle/*`, `product-bundle-item/*`, `product-review/*`, `catalog-promotion/*`. Verify: Cross-Sells, Bundle-Detail, Review-Listing.
4. **Channel & CMS** — `channel/*`, `page/*`. Verify: Channel-Listing, CMS-Page-Detail.
5. **Wishlist (Write)** — `wishlist/*`, Cookie-Helper, `assertWishlistExists`. Verify: Wishlist anlegen, Produkt hinzufügen/entfernen, Cookie persistiert.
6. **Cart (Write, Line-Items only)** — `cart/*`, `cartTokenCookie.ts`, `assertCartExists`. Verify: `AddToCart` erstellt bei leerem Cookie einen Cart und setzt `sylius-cart-token`; `ChangeQuantity` setzt Menge; `RemoveFromCart` entfernt das Item; `GetCurrentCart` liefert konsistente Totals. 404 auf expired Token → Cookie wird geräumt.
7. **Tests & Docs** — Client-/Mapper-Unit-Tests, read-only Integration-Tests gegen Demo-API (GET), Wishlist manuell gegen lokalen Sylius (nicht gegen Demo), README mit Coverage-Tabelle und Scope-Hinweis.

---

## Kritische Dateien

- `src/runtime/server/client/index.ts` — die einzige Stelle, an der `method: 'POST'|'PATCH'|'DELETE'` auftauchen darf (ausschließlich in Wishlist- und Cart-Methoden).
- `src/runtime/server/middleware/defineSylius.ts`
- `src/runtime/server/orchestr/product/base.resolver.ts` — Referenz-Pattern für alle anderen Resolver.
- `src/runtime/server/orchestr/wishlist/*`, `src/runtime/server/orchestr/cart/*` — einzige Mutation-Handler.
- `src/module.ts`, `src/globalExtensions.ts`, `package.json`.

---

## Wiederverwendung aus `app-commercetools`

- `middleware/defineCommercetools.ts` → `defineSylius.ts`
- `client/index.ts` Factory-Pattern
- `client/tokenCacheProvider.ts` → `wishlistTokenCookie.ts` (vereinfacht)
- `orchestr/product/base.resolver.ts` Mapping-Pattern
- `orchestr-helper/products/*`, `orchestr-helper/product-variants/*`
- `mappers/media/*`, `mappers/filters/*`
- `module.ts` Registrierung (`registerLaioutrApp`, peer-Module-Install)

Aus `app-commercetools` 1:1 übernommen (nur Line-Item-Teile): `orchestr/cart/base.resolver.ts`, `orchestr/cart/get-current.query.ts`, `orchestr/cart/add-to-cart.action.ts`, `orchestr-helper/cart/*`. `tokenCacheProvider.ts` → `cartTokenCookie.ts` (vereinfacht, nur ein Cookie, kein Refresh-Token).

**NICHT übernommen:** `orchestr/menu/*` (Taxon-Tree ist nicht im Scope), alle Checkout-bezogenen commercetools-Handler (Addressing, Shipping-/Payment-Selection, Order-Complete).

---

## Verification (End-to-End)

1. `pnpm dev:prepare && pnpm dev` — playground startet.
2. Orchestr-Devtools: alle Handler der Scope-Tabelle registriert.
3. Read-Smoke gegen `v2.demo.sylius.com`:
   - `ProductListQuery`, `ProductBySlugQuery {slug: "knitted-wool-blend-green-cap"}`
   - `ChannelListQuery`, `ProductOptionListQuery`, `ProductAssociationTypeListQuery`
   - `CmsPageListQuery` (falls Demo-CMS-Pages hat)
4. Wishlist-Smoke (lokaler Sylius oder Demo falls Endpoint offen): `WishlistCreate` → Cookie gesetzt; `WishlistAddProduct` → Produkt in Liste; `WishlistRemoveProduct` → Liste leer; `WishlistDelete` → 204 und Cookie geleert.
5. Cart-Smoke (lokaler Sylius — Demo nicht mit Writes belasten): `AddToCart {variantCode, quantity: 2}` bei leerem Cookie → neuer Cart wird erstellt, `sylius-cart-token` gesetzt, Item drin; `ChangeQuantity {orderItemId, quantity: 5}` → neue Menge; `GetCurrentCartQuery` → Totals konsistent; `RemoveFromCart {orderItemId}` → Item weg; Cookie manuell auf ungültigen Wert → `GetCurrentCartQuery` liefert leer und räumt Cookie.
6. `pnpm test`, `pnpm lint`, `pnpm test:types` — grün.
7. Grep-Check: `method: ['"](POST|PATCH|PUT|DELETE)['"]` außerhalb `orchestr/wishlist/*`, `orchestr/cart/*` und der entsprechenden Client-Methoden → keine Treffer.

---

## Offene Fragen / Klärung mit CTO

1. **ChannelPricingLogEntry** — ist kein dokumentierter Shop-API-v2-Endpoint (nur Admin API). Soll der Wrapper dieses Feld aus der Variant-/Product-Response als Subfragment mappen, oder wird es gestrichen?
2. **ProductReview POST** — laut OpenAPI authenticated; da Auth nicht im Scope, bleibt Review read-only. Bestätigung?
3. **Canonical-Type-Coverage** — mehrere neue Entitäten (ProductAttribute, ProductOption, ProductAssociationType, CatalogPromotion, Page, Wishlist) benötigen entweder existierende canonical-types oder müssen als custom Fragment definiert werden. Vor Implementierung: Abgleich mit `@laioutr-core/canonical-types` welche Types bereits existieren.
4. **Wishlist Channel** — `POST /wishlists` braucht `channelCode`. Soll dieser aus `ModuleOptions.defaultChannelCode` gezogen, oder pro Request übergeben werden?

---

## Out-of-Scope

Checkout (Addressing, Shipping-/Payment-Method-Selection, Complete), Completed Orders, Customer-Auth/Account, Addresses, Payments (PSP), Shipping-Methods, Taxon-Tree/Menu-Navigation, CMS-Blocks/Collections/Media/Templates, Geography, Contact, Multi-Channel-Switching via Config.
