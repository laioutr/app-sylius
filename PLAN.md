# Plan: `@laioutr-app/sylius` — Sylius Shop API v2 Wrapper

## Context
Das Repo `app-sylius` wurde aus `app-starter` erzeugt und enthält zu 100% Template-Boilerplate (`my-laioutr-app` Platzhalter, leere Orchestr-Dirs). Ziel: ein produktionsreifer Nuxt 3 / Laioutr Orchestr API-Wrapper für die Sylius Shop API v2 — analog zum `app-commercetools`-Pattern.

**Scope (vom User festgelegt):** Nur die folgenden Sylius-Entitäten werden abgebildet. Alle GET/read-only, **außer `Wishlist`** — dort dürfen `POST`, `PATCH`, `DELETE` implementiert werden.

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

**Ausgeschlossen** (nicht in dieser Iteration): Cart/Checkout/Orders, Customer-Auth/Account, Addresses, Payments, Shipping, Taxon-Tree-Navigation (Menu), CMS-Blocks/Collections/Media/Templates, Contact, Geography (Countries/Currencies/Locales).

---

## Architektur-Entscheidungen

1. **Kein Sylius-SDK** — Nitros globales `$fetch` (ofetch) reicht für JSON-LD Requests.
2. **Sylius `code`/`tokenValue` = Orchestr entity ID** — Products/Variants/Taxa via `code`, Wishlist via `tokenValue`, numerische IDs (ProductImage, ProductAssociation, ProductAttributeValue, ProductTaxon, ProductBundle, ProductBundleItem, Page) als Strings.
3. **Hostname-Channel** — Sylius bestimmt Channel aus Host-Header → `apiURL` zeigt pro Env auf richtigen Channel-Host.
4. **Locale via `Accept-Language`** — aus `clientEnv.locale`.
5. **Preise** — Integer in Smallest-Currency-Unit → `Money.fromDecimal(cents/100, currency)`.
6. **Hydra unwrapping** — Client entpackt `hydra:member` / `hydra:totalItems` transparent.
7. **Read/Write-Trennung** — Nur Wishlist-Handler sind als `action` implementiert; alle anderen sind `query`/`link`/`componentResolver`. Grep-Check `method: 'POST'|'PATCH'|'PUT'|'DELETE'` darf außerhalb von `orchestr/wishlist/*` und `client/*wishlist*` keine Treffer liefern.
8. **Wishlist-Token in httpOnly-Cookie** — `tokenValue` aus `POST /wishlists` wird als `sylius-wishlist-token` gesetzt; folgende Requests lesen ihn automatisch.

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

Runtime-Config: `apiURL` privat, public-Interface leer. Cookie-Konstante: `SYLIUS_WISHLIST_TOKEN_COOKIE = 'sylius-wishlist-token'`.

---

## Datei-Layout

**Modifizieren:** `package.json` (rename, deps), `src/module.ts`, `src/globalExtensions.ts`, `README.md`, `playground/nuxt.config.ts`, `build.config.ts`.

**Neu anlegen:**

```
src/runtime/server/
├── const/keys.ts                                      # SYLIUS_WISHLIST_TOKEN_COOKIE
├── client/
│   ├── index.ts                                       # $fetch-Wrapper, Hydra-Unwrapping, alle Endpoints
│   └── wishlistTokenCookie.ts                         # get/setWishlistToken(event)
├── middleware/
│   └── defineSylius.ts                                # defineSyliusQuery/Action/Link/ComponentResolver
├── mappers/
│   ├── media/index.ts                                 # mapSyliusImage()
│   └── filters/index.ts                               # Sort/Filter-Param-Mapping
├── orchestr-helper/
│   ├── products/index.ts                              # centsToDecimal, getMinMaxPrices, Description-Utils
│   ├── product-variants/index.ts                      # mapVariantOptions, computeAvailability
│   └── wishlist/index.ts                              # assertWishlistExists (create on demand, set cookie)
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
    └── wishlist/                                      # WRITES ALLOWED
        ├── base.resolver.ts                           # GET /wishlists/{token}
        ├── get-current.query.ts                       # Cookie → GET /wishlists/{token}
        ├── create.action.ts                           # POST /wishlists, sets cookie
        ├── add-product.action.ts                      # PATCH /wishlists/{token}/product
        ├── add-variant.action.ts                     # PATCH /wishlists/{token}/variant
        ├── remove-product.action.ts                   # DELETE /wishlists/{token}/products/{id}
        ├── remove-variant.action.ts                   # DELETE /wishlists/{token}/productVariants/{id}
        └── delete.action.ts                           # DELETE /wishlists/{token}, clears cookie
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

**Write (nur Wishlist):**
- `createWishlist({ channelCode })` → `POST /wishlists`
- `getWishlist(tokenValue)` → `GET /wishlists/{tokenValue}`
- `deleteWishlist(tokenValue)` → `DELETE /wishlists/{tokenValue}`
- `addProductToWishlist(tokenValue, productIri)` → `PATCH .../product`
- `addVariantToWishlist(tokenValue, variantIri)` → `PATCH .../variant`
- `removeProductFromWishlist(tokenValue, productId)` → `DELETE .../products/{id}`
- `removeVariantFromWishlist(tokenValue, variantId)` → `DELETE .../productVariants/{id}`

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

**Image-URL:** `{domainOf(apiURL)}/media/cache/resolve/{imageFilter}/{image.path}`.

---

## Implementierungs-Phasen

1. **Setup & Client** — Rename (`@laioutr-app/sylius`), `ModuleOptions`, `module.ts`, `client/index.ts` (alle Methoden), `defineSylius.ts`, Mapper, Helper. Verify: `pnpm dev:prepare` grün.
2. **Product-Domäne** — `product/*`, `product-variant/*`, `product-image/*`, `product-attribute/*`, `product-attribute-value/*`, `product-option/*`, `product-option-value/*`, `product-taxon/*`. Verify: PLP/PDP gegen `v2.demo.sylius.com`.
3. **Katalog-Relationen** — `product-association/*`, `product-association-type/*`, `product-bundle/*`, `product-bundle-item/*`, `product-review/*`, `catalog-promotion/*`. Verify: Cross-Sells, Bundle-Detail, Review-Listing.
4. **Channel & CMS** — `channel/*`, `page/*`. Verify: Channel-Listing, CMS-Page-Detail.
5. **Wishlist (Write)** — `wishlist/*`, Cookie-Helper, `assertWishlistExists`. Verify: Wishlist anlegen, Produkt hinzufügen/entfernen, Cookie persistiert.
6. **Tests & Docs** — Client-/Mapper-Unit-Tests, read-only Integration-Tests gegen Demo-API (GET), Wishlist manuell gegen lokalen Sylius (nicht gegen Demo), README mit Coverage-Tabelle und Scope-Hinweis.

---

## Kritische Dateien

- `src/runtime/server/client/index.ts` — die einzige Stelle, an der `method: 'POST'|'PATCH'|'DELETE'` auftauchen darf (ausschließlich in Wishlist-Methoden).
- `src/runtime/server/middleware/defineSylius.ts`
- `src/runtime/server/orchestr/product/base.resolver.ts` — Referenz-Pattern für alle anderen Resolver.
- `src/runtime/server/orchestr/wishlist/*` — einzige Mutation-Handler.
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

**NICHT übernommen:** `orchestr/cart/*`, `orchestr-helper/cart/*`, `orchestr/menu/*` (Taxon-Tree ist nicht im Scope).

---

## Verification (End-to-End)

1. `pnpm dev:prepare && pnpm dev` — playground startet.
2. Orchestr-Devtools: alle Handler der Scope-Tabelle registriert.
3. Read-Smoke gegen `v2.demo.sylius.com`:
   - `ProductListQuery`, `ProductBySlugQuery {slug: "knitted-wool-blend-green-cap"}`
   - `ChannelListQuery`, `ProductOptionListQuery`, `ProductAssociationTypeListQuery`
   - `CmsPageListQuery` (falls Demo-CMS-Pages hat)
4. Wishlist-Smoke (lokaler Sylius oder Demo falls Endpoint offen): `WishlistCreate` → Cookie gesetzt; `WishlistAddProduct` → Produkt in Liste; `WishlistRemoveProduct` → Liste leer; `WishlistDelete` → 204 und Cookie geleert.
5. `pnpm test`, `pnpm lint`, `pnpm test:types` — grün.
6. Grep-Check: `method: ['"](POST|PATCH|PUT|DELETE)['"]` außerhalb `orchestr/wishlist/*` und Wishlist-Client-Methoden → keine Treffer.

---

## Offene Fragen / Klärung mit CTO

1. **ChannelPricingLogEntry** — ist kein dokumentierter Shop-API-v2-Endpoint (nur Admin API). Soll der Wrapper dieses Feld aus der Variant-/Product-Response als Subfragment mappen, oder wird es gestrichen?
2. **ProductReview POST** — laut OpenAPI authenticated; da Auth nicht im Scope, bleibt Review read-only. Bestätigung?
3. **Canonical-Type-Coverage** — mehrere neue Entitäten (ProductAttribute, ProductOption, ProductAssociationType, CatalogPromotion, Page, Wishlist) benötigen entweder existierende canonical-types oder müssen als custom Fragment definiert werden. Vor Implementierung: Abgleich mit `@laioutr-core/canonical-types` welche Types bereits existieren.
4. **Wishlist Channel** — `POST /wishlists` braucht `channelCode`. Soll dieser aus `ModuleOptions.defaultChannelCode` gezogen, oder pro Request übergeben werden?

---

## Out-of-Scope

Cart, Checkout, Orders, Customer-Auth/Account, Addresses, Payments, Shipping, Taxon-Tree/Menu-Navigation, CMS-Blocks/Collections/Media/Templates, Geography, Contact, Multi-Channel-Switching via Config.
