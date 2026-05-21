import type { MediaImage } from '@laioutr-core/core-types/common';

export interface SyliusImageInput {
  id: number;
  /**
   * Sylius returns a fully-resolved URL here when the request includes
   * the `imageFilter` query param — e.g.
   *   http://localhost/media/cache/resolve/sylius_large/e3/c3/<hash>.webp
   * The mapper passes it through unchanged.
   */
  path: string;
  type: string | null | undefined;
}

export function mapSyliusImage(image: SyliusImageInput): MediaImage {
  return {
    type: 'image',
    sources: [{ provider: 'sylius', src: image.path }],
    alt: image.type ?? '',
  };
}
