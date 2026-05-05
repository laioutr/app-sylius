import { deleteCookie, getCookie, setCookie } from '#imports';
import type { H3Event } from 'h3';
import { SYLIUS_CART_TOKEN_COOKIE } from '../const/keys';

export function getCartToken(event: H3Event): string | null {
  return getCookie(event, SYLIUS_CART_TOKEN_COOKIE) ?? null;
}

export function setCartToken(event: H3Event, tokenValue: string): void {
  setCookie(event, SYLIUS_CART_TOKEN_COOKIE, tokenValue, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });
}

export function clearCartToken(event: H3Event): void {
  deleteCookie(event, SYLIUS_CART_TOKEN_COOKIE);
}
