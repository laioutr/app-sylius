import { describe, expect, it } from 'vitest';
import { mapSyliusImage } from './index';

describe('mapSyliusImage', () => {
  it('builds a canonical MediaImage from path + filter + origin', () => {
    const result = mapSyliusImage(
      { id: 7, path: 'a/b/c.jpg', type: null },
      { apiOrigin: 'http://localhost', imageFilter: 'sylius_large' }
    );
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
    const result = mapSyliusImage(
      { id: 7, path: 'p.jpg', type: 'main' },
      { apiOrigin: 'http://localhost', imageFilter: 'sylius_large' }
    );
    expect(result.alt).toBe('main');
  });
});
