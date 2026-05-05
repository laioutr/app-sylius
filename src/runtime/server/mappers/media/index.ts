import type { MediaImage } from '@laioutr-core/core-types/common';

export interface SyliusImageInput {
  id: number;
  path: string;
  type: string | null | undefined;
}

export interface MapSyliusImageOptions {
  apiOrigin: string;
  imageFilter: string;
}

export function mapSyliusImage(image: SyliusImageInput, opts: MapSyliusImageOptions): MediaImage {
  return {
    type: 'image',
    sources: [
      {
        provider: 'sylius',
        src: `${opts.apiOrigin}/media/cache/resolve/${opts.imageFilter}/${image.path}`,
      },
    ],
    alt: image.type ?? '',
  };
}

export function deriveApiOrigin(apiURL: string): string {
  return new URL(apiURL).origin;
}
