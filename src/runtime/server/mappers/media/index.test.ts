import { describe, expect, it } from 'vitest';
import { mapSyliusImage } from './index';

describe('mapSyliusImage', () => {
  it('passes the server-resolved URL through to the canonical MediaImage', () => {
    const result = mapSyliusImage({
      id: 7,
      path: 'http://localhost/media/cache/resolve/sylius_large/a/b/c.jpg',
      type: null,
    });
    expect(result).toEqual({
      type: 'image',
      sources: [
        {
          provider: 'sylius',
          src: 'http://localhost/media/cache/resolve/sylius_large/a/b/c.jpg',
        },
      ],
      alt: '',
    });
  });

  it('uses image type for alt when set', () => {
    const result = mapSyliusImage({ id: 7, path: 'http://localhost/x.jpg', type: 'main' });
    expect(result.alt).toBe('main');
  });
});
