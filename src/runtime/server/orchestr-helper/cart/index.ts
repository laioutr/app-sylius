import type { createSyliusClient, Order } from '../../client';
import type { H3Event } from 'h3';
import { clearCartToken, getCartToken, setCartToken } from '../../client/cartTokenCookie';

type Client = ReturnType<typeof createSyliusClient>;

export async function assertCartExists(event: H3Event, client: Client): Promise<{ tokenValue: string; cart: Order }> {
  const existing = getCartToken(event);
  if (existing) {
    const cart = await client.getCart(existing);
    if (cart) return { tokenValue: existing, cart };
    clearCartToken(event);
  }
  const cart = await client.createCart({ localeCode: client.locale });
  setCartToken(event, cart.tokenValue!);
  return { tokenValue: cart.tokenValue!, cart };
}

export function variantIri(code: string): string {
  return `/api/v2/shop/product-variants/${encodeURIComponent(code)}`;
}
